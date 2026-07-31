import { entryKey } from "./excelImport.js";
import { dateAmountKey, findDateAmountDuplicates } from "./duplicates.js";
import { parseDateWithFormat, normalizeLedgerDate } from "./dateParse.js";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getRowValidationError(row) {
  if (!row.date) return "Date required";
  if (!String(row.description || "").trim()) return "Description required";
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Valid amount required";
  if (!row.category) return "Category required";
  if (!row.type) return "Type required";
  return null;
}

export function reparseImportPreviewDates(rows, dateFormat = "DMY") {
  return rows.map((row) => {
    if (!row.dateRaw) return row;
    const date = parseDateWithFormat(row.dateRaw, dateFormat);
    return date ? { ...row, date } : { ...row, date: "" };
  });
}

export function markImportPreviewDuplicates(rows, existingEntries = []) {
  const seenKeys = new Set(
    existingEntries.map((entry) =>
      dateAmountKey(normalizeLedgerDate(entry.date), entry.amount)
    )
  );

  return rows.map((row) => {
    if (getRowValidationError(row)) {
      return { ...row, dateAmountMatches: [], isDuplicate: false };
    }

    const normalizedDate = normalizeLedgerDate(row.date);
    const key = dateAmountKey(normalizedDate, row.amount);
    const ledgerMatches = findDateAmountDuplicates(existingEntries, {
      date: normalizedDate,
      amount: row.amount,
    });
    const isDuplicate = seenKeys.has(key);

    if (!isDuplicate) {
      seenKeys.add(key);
    }

    const included = isDuplicate
      ? row.included === true && row.isDuplicate
        ? true
        : false
      : row.included !== false;

    return {
      ...row,
      isDuplicate,
      dateAmountMatches: ledgerMatches,
      included,
    };
  });
}

export function refreshImportPreviewDuplicates(rows, existingEntries = []) {
  return markImportPreviewDuplicates(rows, existingEntries);
}

export function getImportPreviewStats(rows) {
  const included = rows.filter((r) => r.included);
  const importable = included.filter((r) => !getRowValidationError(r));
  return {
    total: rows.length,
    included: included.length,
    importable: importable.length,
    duplicates: rows.filter((r) => r.isDuplicate).length,
    invalidIncluded: included.filter((r) => getRowValidationError(r)).length,
  };
}

export function setAllImportPreviewIncluded(rows, included) {
  return rows.map((r) => ({ ...r, included }));
}

export function updateImportPreviewRow(rows, previewId, patch) {
  return rows.map((r) => (r.previewId === previewId ? { ...r, ...patch } : r));
}

export function buildEntriesFromPreview(rows) {
  const recordedAt = new Date().toISOString();
  return rows
    .filter((r) => r.included && !getRowValidationError(r))
    .map((r) => ({
      id: uid(),
      type: r.type,
      date: r.date,
      description: String(r.description).trim(),
      amount: Number(r.amount),
      category: r.category,
      recordedAt,
    }));
}

export function mergeImportedEntries(existingEntries, importedEntries) {
  const existingDateAmountKeys = new Set(
    existingEntries.map((entry) => dateAmountKey(entry.date, entry.amount))
  );
  const uniqueImported = [];

  for (const entry of importedEntries) {
    const key = dateAmountKey(entry.date, entry.amount);
    if (existingDateAmountKeys.has(key)) continue;
    existingDateAmountKeys.add(key);
    uniqueImported.push(entry);
  }

  return [...uniqueImported, ...existingEntries];
}

export function isNewImportEntry(entry, existingEntries) {
  const key = dateAmountKey(entry.date, entry.amount);
  return !existingEntries.some(
    (existing) => dateAmountKey(existing.date, existing.amount) === key
  );
}

export function createImportPreviewState(
  parseResult,
  meta = {},
  existingEntries = []
) {
  const rows = markImportPreviewDuplicates(
    parseResult.rows || [],
    existingEntries
  );

  return {
    ...meta,
    rows,
    errors: parseResult.errors || [],
    duplicateCount: rows.filter((row) => row.isDuplicate).length,
  };
}

export function defaultImportLabel(fileName = "") {
  return String(fileName)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export function buildImportConfirmationSummary({
  rows,
  errors = [],
  fileName = "",
  mergedEntries = [],
  mergedCount = 0,
}) {
  const stats = getImportPreviewStats(rows);
  const totals = { expense: 0, income: 0, investment: 0 };
  for (const entry of mergedEntries) {
    totals[entry.type] = (totals[entry.type] || 0) + entry.amount;
  }
  const dates = mergedEntries.map((entry) => entry.date).sort();

  return {
    fileName,
    mergedCount,
    attemptedCount: mergedEntries.length,
    stats,
    parseErrors: errors.length,
    totals,
    dateFrom: dates[0] || null,
    dateTo: dates[dates.length - 1] || null,
    importedIds: mergedEntries.map((entry) => entry.id),
    suggestedLabel: defaultImportLabel(fileName),
  };
}
