export const BACKUP_SCHEDULE_KEY = "ledger-backup-schedule";

export const BACKUP_FREQUENCIES = [
  { id: "daily", label: "Daily", intervalMs: 24 * 60 * 60 * 1000 },
  { id: "weekly", label: "Weekly", intervalMs: 7 * 24 * 60 * 60 * 1000 },
];

const DEFAULT_SCHEDULE = {
  enabled: false,
  frequency: "daily",
  lastBackupAt: null,
  driveFolderId: null,
};

export function normalizeBackupSchedule(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCHEDULE };
  const frequency = BACKUP_FREQUENCIES.some((f) => f.id === raw.frequency)
    ? raw.frequency
    : "daily";
  return {
    enabled: Boolean(raw.enabled),
    frequency,
    lastBackupAt: raw.lastBackupAt || null,
    driveFolderId: raw.driveFolderId || null,
  };
}

export function getBackupFrequency(frequencyId) {
  return BACKUP_FREQUENCIES.find((f) => f.id === frequencyId) || BACKUP_FREQUENCIES[0];
}

export function shouldRunScheduledBackup(schedule, now = Date.now()) {
  if (!schedule?.enabled) return false;
  if (!schedule.lastBackupAt) return true;
  const last = Date.parse(schedule.lastBackupAt);
  if (!Number.isFinite(last)) return true;
  const interval = getBackupFrequency(schedule.frequency).intervalMs;
  return now - last >= interval;
}

export function formatLastBackup(iso) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function markBackupCompleted(schedule) {
  return {
    ...schedule,
    lastBackupAt: new Date().toISOString(),
  };
}
