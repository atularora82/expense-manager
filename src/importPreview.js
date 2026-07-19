import { entryKey } from "./excelImport.js";

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
  const existingKeys = new Set(existingEntries.map(entryKey));
  const uniqueImported = [];

  for (const entry of importedEntries) {
    const key = entryKey(entry);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    uniqueImported.push(entry);
  }

  return [...uniqueImported, ...existingEntries];
}

export function createImportPreviewState(parseResult, meta = {}) {
  return {
    ...meta,
    rows: parseResult.rows || [],
    errors: parseResult.errors || [],
    duplicateCount: parseResult.duplicateCount ?? 0,
  };
}
