import { createFirebaseStorage } from "./firebaseStorage.js";
import { createLocalStorageAdapter } from "./localStorageAdapter.js";

const LEDGER_KEYS = [
  "ledger-entries",
  "ledger-budgets",
  "ledger-recurring",
  "ledger-category-rules",
];

export async function migrateLocalToFirebase(uid) {
  const firebaseStorage = createFirebaseStorage(uid);
  const localStorage = createLocalStorageAdapter();

  for (const key of LEDGER_KEYS) {
    let hasCloudData = false;
    try {
      await firebaseStorage.get(key);
      hasCloudData = true;
    } catch {
      // no cloud data yet
    }

    if (hasCloudData) continue;

    try {
      const local = await localStorage.get(key);
      if (local?.value) {
        await firebaseStorage.set(key, local.value);
      }
    } catch {
      // no local data to migrate
    }
  }
}
