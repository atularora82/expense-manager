import { createFirebaseStorage } from "./firebaseStorage.js";
import { createLocalStorageAdapter } from "./localStorageAdapter.js";
import { isEmptyStoredValue } from "./storageUtils.js";

const LEDGER_KEYS = [
  "ledger-entries",
  "ledger-budgets",
  "ledger-recurring",
  "ledger-category-rules",
  "ledger-statement-profiles",
  "ledger-backup-schedule",
];

export async function migrateLocalToFirebase(uid) {
  const firebaseStorage = createFirebaseStorage(uid);
  const localStorage = createLocalStorageAdapter();

  for (const key of LEDGER_KEYS) {
    let cloudValue = null;
    let hasCloudData = false;

    try {
      const cloud = await firebaseStorage.get(key);
      cloudValue = cloud?.value ?? null;
      hasCloudData = true;
    } catch {
      // no cloud data yet
    }

    let localValue = null;
    try {
      const local = await localStorage.get(key);
      localValue = local?.value ?? null;
    } catch {
      // no local data to migrate
    }

    if (!localValue) continue;

    if (!hasCloudData) {
      await firebaseStorage.set(key, localValue);
      continue;
    }

    if (isEmptyStoredValue(key, cloudValue) && !isEmptyStoredValue(key, localValue)) {
      await firebaseStorage.set(key, localValue);
    }
  }
}
