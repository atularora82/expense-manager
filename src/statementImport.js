import * as XLSX from "xlsx";
import { lookupCategoryRule } from "./categoryRules.js";
import {
  parseExcelDate,
  parseAmount,
  entryKey,
  mapExcelCategory,
} from "./excelImport.js";

const COLUMN_GUESSES = {
  date: [
    "date",
    "transaction date",
    "txn date",
    "value date",
    "posting date",
    "trans date",
    "tran date",
  ],
  description: [
    "description",
    "narration",
    "particulars",
    "details",
    "remarks",
    "transaction details",
    "transaction remarks",
  ],
  debit: [
    "debit",
    "withdrawal",
    "withdrawal amt",
    "withdrawal amount",
    "dr",
    "debit amount",
    "debit amt",
  ],
  credit: [
    "credit",
    "deposit",
    "deposit amt",
    "deposit amount",
    "cr",
    "credit amount",
    "credit amt",
  ],
  amount: ["amount", "transaction amount", "txn amount", "transaction amt"],
};

const SKIP_DESCRIPTION = [
  "opening balance",
  "closing balance",
  "b/f",
  "c/f",
  "brought forward",
  "carried forward",
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function resolveIncomeCategory(description, categoryRules) {
  return lookupCategoryRule(categoryRules, description, "income") || "other_income";
}

function shouldSkipDescription(text) {
  const lower = text.toLowerCase();
  return SKIP_DESCRIPTION.some((p) => lower.includes(p));
}

function parseSignedAmount(value) {
  if (value == null || value === "") return null;
  const str = String(value).replace(/,/g, "").trim();
  const num = parseFloat(str);
  if (!Number.isFinite(num) || num === 0) return null;
  return num;
}

export const STATEMENT_MAP_FIELDS = [
  { id: "date", label: "Date", required: true },
  { id: "description", label: "Description / Narration", required: true },
  { id: "debit", label: "Debit / Withdrawal", required: false },
  { id: "credit", label: "Credit / Deposit", required: false },
  { id: "amount", label: "Amount (single column)", required: false },
];

export async function readStatementFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The file has no worksheets.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return { columns, rows, fileName: file.name };
}

export function columnSignature(columns) {
  return columns.map(normalizeKey).sort().join("|");
}

function sanitizeMappingForColumns(mapping, columns) {
  const columnSet = new Set(columns);
  const next = { date: "", description: "", debit: "", credit: "", amount: "" };
  for (const field of Object.keys(next)) {
    const col = mapping?.[field];
    if (col && columnSet.has(col)) {
      next[field] = col;
    }
  }
  return next;
}

export function guessColumnMapping(columns) {
  const mapping = {
    date: "",
    description: "",
    debit: "",
    credit: "",
    amount: "",
  };

  for (const col of columns) {
    const normalized = normalizeKey(col);
    for (const [field, patterns] of Object.entries(COLUMN_GUESSES)) {
      if (mapping[field]) continue;
      if (patterns.some((p) => normalized.includes(p) || p.includes(normalized))) {
        mapping[field] = col;
      }
    }
  }

  return mapping;
}

export function resolveColumnMapping(columns, savedProfiles = {}) {
  const signature = columnSignature(columns);
  if (savedProfiles[signature]) {
    const saved = sanitizeMappingForColumns(savedProfiles[signature], columns);
    if (mappingIsValid(saved)) {
      return saved;
    }
    const guessed = guessColumnMapping(columns);
    return {
      date: saved.date || guessed.date,
      description: saved.description || guessed.description,
      debit: saved.debit || guessed.debit,
      credit: saved.credit || guessed.credit,
      amount: saved.amount || guessed.amount,
    };
  }
  return guessColumnMapping(columns);
}

export function mappingIsValid(mapping) {
  if (!mapping.date || !mapping.description) return false;
  return Boolean(mapping.debit || mapping.credit || mapping.amount);
}

export function parseStatementWithMapping(
  rows,
  mapping,
  existingEntries = [],
  categoryRules = {}
) {
  const previewRows = [];
  const errors = [];
  let duplicateCount = 0;
  const existingKeys = new Set(existingEntries.map(entryKey));

  if (!mappingIsValid(mapping)) {
    return {
      rows: [],
      errors: ["Map Date and Description, plus Debit/Credit or Amount."],
      duplicateCount: 0,
    };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const dateRaw = mapping.date ? row[mapping.date] : null;
    const description = String(
      mapping.description ? row[mapping.description] ?? "" : ""
    ).trim();

    if (!dateRaw && !description) return;

    const date = parseExcelDate(dateRaw);
    if (!date) {
      if (dateRaw || description) {
        errors.push(`Row ${rowNum}: invalid date "${dateRaw}"`);
      }
      return;
    }
    if (!description) {
      errors.push(`Row ${rowNum}: missing description`);
      return;
    }
    if (shouldSkipDescription(description)) return;

    const rowEntries = [];

    const debit = mapping.debit ? parseAmount(row[mapping.debit]) : null;
    const credit = mapping.credit ? parseAmount(row[mapping.credit]) : null;
    const signed = mapping.amount ? parseSignedAmount(row[mapping.amount]) : null;

    if (debit) {
      rowEntries.push({
        type: "expense",
        amount: debit,
        category: mapExcelCategory("", description, categoryRules),
      });
    }
    if (credit) {
      rowEntries.push({
        type: "income",
        amount: credit,
        category: resolveIncomeCategory(description, categoryRules),
      });
    }
    if (!debit && !credit && signed != null) {
      if (signed < 0) {
        rowEntries.push({
          type: "expense",
          amount: Math.abs(signed),
          category: mapExcelCategory("", description, categoryRules),
        });
      } else {
        rowEntries.push({
          type: "income",
          amount: signed,
          category: resolveIncomeCategory(description, categoryRules),
        });
      }
    }

    if (rowEntries.length === 0) {
      errors.push(`Row ${rowNum}: no debit, credit, or amount value`);
      return;
    }

    for (const partial of rowEntries) {
      const candidate = {
        type: partial.type,
        amount: partial.amount,
        description,
        category: partial.category,
        date,
      };

      const key = entryKey(candidate);
      const isDuplicate = existingKeys.has(key);

      previewRows.push({
        previewId: uid(),
        sourceRow: rowNum,
        included: !isDuplicate,
        isDuplicate,
        ...candidate,
      });

      if (isDuplicate) {
        duplicateCount += 1;
      } else {
        existingKeys.add(key);
      }
    }
  });

  return { rows: previewRows, errors, duplicateCount };
}
