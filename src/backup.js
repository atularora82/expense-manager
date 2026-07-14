export const BACKUP_VERSION = 1;

export function createBackup({ entries, budgets, recurring, categoryRules }) {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
    budgets,
    recurring,
    categoryRules,
  };
}

export function parseBackupFile(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid backup file.");
  }
  if (!Array.isArray(data.entries)) {
    throw new Error("Backup is missing entries.");
  }
  return {
    version: data.version ?? 0,
    exportedAt: data.exportedAt ?? null,
    entries: data.entries,
    budgets: data.budgets && typeof data.budgets === "object" ? data.budgets : {},
    recurring: Array.isArray(data.recurring) ? data.recurring : [],
    categoryRules:
      data.categoryRules && typeof data.categoryRules === "object"
        ? data.categoryRules
        : {},
  };
}

export function downloadBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `expense-book-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
