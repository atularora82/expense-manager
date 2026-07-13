export function createLocalStorageAdapter() {
  return {
    async get(key) {
      const value = localStorage.getItem(key);
      if (value === null) {
        throw new Error(`storage: key "${key}" not found`);
      }
      return { key, value, shared: false };
    },

    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },

    async delete(key) {
      const existed = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
      return { key, deleted: existed, shared: false };
    },

    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

export function installLocalStorage() {
  window.storage = createLocalStorageAdapter();
}
