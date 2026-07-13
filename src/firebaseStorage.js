import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";

export function createFirebaseStorage(uid) {
  const docRef = (key) => doc(db, "users", uid, "kv", key);

  return {
    async get(key) {
      const snap = await getDoc(docRef(key));
      if (!snap.exists()) {
        throw new Error(`storage: key "${key}" not found`);
      }
      return { key, value: snap.data().value, shared: false };
    },

    async set(key, value) {
      await setDoc(
        docRef(key),
        { value, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      return { key, value, shared: false };
    },

    async delete(key) {
      const snap = await getDoc(docRef(key));
      const existed = snap.exists();
      if (existed) await deleteDoc(docRef(key));
      return { key, deleted: existed, shared: false };
    },

    async list(prefix = "") {
      const snap = await getDocs(collection(db, "users", uid, "kv"));
      const keys = snap.docs.map((d) => d.id).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

export function installFirebaseStorage(uid) {
  window.storage = createFirebaseStorage(uid);
}
