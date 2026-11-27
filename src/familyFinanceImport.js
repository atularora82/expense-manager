import * as XLSX from "xlsx";
import { parseAmount, parseExcelDate } from "./excelImport.js";
import {
  FINANCE_RECORD_TYPES,
  createFamilyMember,
  createFinancialRecord,
  financeRecordTypeMap,
  normalizeFamilyFinanceRegistry,
} from "./familyFinance.js";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getField(row, ...names) {
  for (const name of names) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(name));
    if (key != null && row[key] !== "") return row[key];
  }
  return null;
}

const TYPE_ALIASES = {
  bank: ["bank", "bank account", "savings", "current", "savings account"],
  fixed_deposit: ["fd", "fixed deposit", "term deposit", "rd", "recurring deposit"],
  mutual_fund: ["mf", "mutual fund", "mutual funds", "sip"],
  stocks: ["stock", "stocks", "shares", "equity", "demat"],
  ppf_epf: ["ppf", "epf", "nps", "vpf", "provident fund"],
  insurance: ["insurance", "lic", "life insurance", "health insurance", "policy"],
  gold: ["gold", "sgb", "sovereign gold bond"],
  property: ["property", "real estate", "flat", "house"],
  other_asset: ["other asset", "other"],
  home_loan: ["home loan", "housing loan", "hl"],
  personal_loan: ["personal loan", "pl", "car loan", "loan"],
  credit_card: ["credit card", "cc outstanding", "card outstanding"],
  other_liability: ["other liability", "liability"],
};

export function resolveFinanceRecordType(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  if (financeRecordTypeMap[s]) return s;

  const byLabel = FINANCE_RECORD_TYPES.find((t) => t.label.toLowerCase() === s);
  if (byLabel) return byLabel.id;

  for (const [typeId, aliases] of Object.entries(TYPE_ALIASES)) {
    if (aliases.some((a) => s === a || s.includes(a))) return typeId;
  }

  const byPartialLabel = FINANCE_RECORD_TYPES.find((t) =>
    t.label.toLowerCase().includes(s)
  );
  return byPartialLabel ? byPartialLabel.id : null;
}

function recordDedupeKey(memberId, type, title) {
  return `${memberId}|${type}|${String(title || "").toLowerCase().trim()}`;
}

export const FAMILY_FINANCE_TEMPLATE_HEADERS = [
  "Member",
  "Type",
  "Title",
  "Value",
  "Institution",
  "Identifier",
  "Maturity",
  "As Of",
  "Notes",
];

const TEMPLATE_SAMPLE_ROWS = [
  [
    "Self",
    "bank",
    "HDFC Savings",
    "125000",
    "HDFC Bank",
    "XXXX1234",
    "",
    "2026-11-01",
    "",
  ],
  [
    "Spouse",
    "mutual_fund",
    "Axis Bluechip SIP",
    "450000",
    "Axis MF",
    "folio-991",
    "",
    "2026-11-01",
    "",
  ],
  [
    "Self",
    "home_loan",
    "SBI Home Loan",
    "3200000",
    "SBI",
    "HL-009",
    "",
    "2026-11-01",
    "Outstanding principal",
  ],
];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadFamilyFinanceTemplate() {
  const lines = [
    FAMILY_FINANCE_TEMPLATE_HEADERS.join(","),
    ...TEMPLATE_SAMPLE_ROWS.map((row) => row.map(csvEscape).join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "family-assets-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadFamilyFinanceExport(registry) {
  const lines = [FAMILY_FINANCE_TEMPLATE_HEADERS.join(",")];
  for (const record of registry.records) {
    const member = registry.members.find((m) => m.id === record.memberId);
    lines.push(
      [
        member?.name || "",
        record.type,
        record.title,
        record.value,
        record.institution || "",
        record.identifier || "",
        record.maturityDate || "",
        record.asOfDate || "",
        record.notes || "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `family-assets-export-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseRowToPreview(row, rowNum, registry) {
  const memberName = String(
    getField(row, "member", "family member", "name", "person") ?? ""
  ).trim();
  const typeRaw = getField(row, "type", "category", "asset type", "record type");
  const title = String(getField(row, "title", "name", "description", "holding") ?? "").trim();
  const valueRaw = getField(row, "value", "amount", "current value", "balance", "outstanding");
  const institution = String(
    getField(row, "institution", "bank", "provider", "company") ?? ""
  ).trim();
  const identifier = String(
    getField(row, "identifier", "ref", "reference", "account", "policy", "folio") ?? ""
  ).trim();
  const maturityRaw = getField(row, "maturity", "maturity date", "matureson");
  const asOfRaw = getField(row, "as of", "asof", "as_of", "snapshot date", "date");
  const notes = String(getField(row, "notes", "remark", "comments") ?? "").trim();

  if (!memberName && !title && !valueRaw && !typeRaw) {
    return null;
  }

  const errors = [];
  if (!memberName) errors.push("missing member");
  if (!title) errors.push("missing title");
  const type = resolveFinanceRecordType(typeRaw);
  if (!type) errors.push(`unknown type "${typeRaw || ""}"`);
  const value = parseAmount(valueRaw);
  if (value == null) errors.push(`invalid value "${valueRaw ?? ""}"`);

  const maturityDate = maturityRaw ? parseExcelDate(maturityRaw) : null;
  if (maturityRaw && !maturityDate) errors.push(`invalid maturity "${maturityRaw}"`);

  const asOfDate = asOfRaw ? parseExcelDate(asOfRaw) : null;
  if (asOfRaw && !asOfDate) errors.push(`invalid as-of date "${asOfRaw}"`);

  const memberMatch = registry.members.find(
    (m) => m.name.toLowerCase() === memberName.toLowerCase()
  );

  let action = "add";
  if (memberMatch && type && title) {
    const key = recordDedupeKey(memberMatch.id, type, title);
    const existing = registry.records.find(
      (r) => recordDedupeKey(r.memberId, r.type, r.title) === key
    );
    if (existing) action = "update";
  }

  return {
    previewId: uid(),
    sourceRow: rowNum,
    included: errors.length === 0,
    valid: errors.length === 0,
    errors,
    action,
    memberName,
    memberExists: Boolean(memberMatch),
    type,
    typeLabel: type ? financeRecordTypeMap[type]?.label : String(typeRaw || ""),
    title,
    value,
    institution,
    identifier,
    maturityDate,
    asOfDate: asOfDate || (errors.length === 0 ? new Date().toISOString().slice(0, 10) : null),
    notes,
  };
}

export async function parseFamilyFinanceFile(file, registry = { members: [], records: [] }) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], fileErrors: ["The file has no worksheets."] };
  }

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (rawRows.length === 0) {
    return { rows: [], fileErrors: ["The worksheet is empty."] };
  }

  const rows = [];
  const fileErrors = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;
    const preview = parseRowToPreview(row, rowNum, registry);
    if (preview) rows.push(preview);
  });

  if (rows.length === 0) {
    fileErrors.push("No data rows found. Use the template headers (Member, Type, Title, Value…).");
  }

  return { rows, fileErrors };
}

export function applyFamilyFinanceImport(registry, previewRows, { createMembers = true } = {}) {
  const members = registry.members.map((m) => ({ ...m }));
  const memberByLower = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));

  const records = registry.records.map((r) => ({ ...r }));
  const recordIndex = new Map(
    records.map((r) => [recordDedupeKey(r.memberId, r.type, r.title), r.id])
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let membersCreated = 0;

  for (const row of previewRows) {
    if (!row.included || !row.valid) {
      skipped += 1;
      continue;
    }

    let memberId = memberByLower.get(row.memberName.toLowerCase());
    if (!memberId) {
      if (!createMembers) {
        skipped += 1;
        continue;
      }
      const member = createFamilyMember(row.memberName);
      if (!member) {
        skipped += 1;
        continue;
      }
      members.push(member);
      memberByLower.set(member.name.toLowerCase(), member.id);
      memberId = member.id;
      membersCreated += 1;
    }

    const existingId = recordIndex.get(recordDedupeKey(memberId, row.type, row.title));
    if (existingId) {
      const idx = records.findIndex((r) => r.id === existingId);
      if (idx >= 0) {
        records[idx] = {
          ...records[idx],
          value: row.value,
          institution: row.institution,
          identifier: row.identifier,
          maturityDate: row.maturityDate,
          asOfDate: row.asOfDate,
          notes: row.notes,
          updatedAt: new Date().toISOString(),
        };
        updated += 1;
      }
      continue;
    }

    const created = createFinancialRecord({
      memberId,
      type: row.type,
      title: row.title,
      institution: row.institution,
      value: row.value,
      identifier: row.identifier,
      maturityDate: row.maturityDate,
      asOfDate: row.asOfDate,
      notes: row.notes,
    });
    if (!created) {
      skipped += 1;
      continue;
    }
    records.push(created);
    recordIndex.set(recordDedupeKey(memberId, row.type, row.title), created.id);
    added += 1;
  }

  return {
    registry: normalizeFamilyFinanceRegistry({ members, records }),
    stats: { added, updated, skipped, membersCreated },
  };
}

export function financeTypeOptionsForHelp() {
  return FINANCE_RECORD_TYPES.map((t) => `${t.id} — ${t.label}`).join(", ");
}