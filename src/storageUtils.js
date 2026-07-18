export function isStorageNotFoundError(error) {
  const message = String(error?.message || error || "");
  return message.includes("not found");
}

export function parseStoredJson(value, fallback) {
  if (value == null || value === "") return fallback;
  return JSON.parse(value);
}

export function isEmptyStoredValue(key, value) {
  if (value == null || value === "") return true;
  try {
    const parsed = JSON.parse(value);
    if (key === "ledger-entries" || key === "ledger-recurring") {
      return Array.isArray(parsed) && parsed.length === 0;
    }
    if (
      key === "ledger-budgets" ||
      key === "ledger-category-rules" ||
      key === "ledger-statement-profiles"
    ) {
      return typeof parsed === "object" && parsed !== null && Object.keys(parsed).length === 0;
    }
  } catch {
    return true;
  }
  return false;
}

export function shouldRecoverFromLocal(key, cloudValue, localValue) {
  if (!localValue || isEmptyStoredValue(key, localValue)) return false;
  if (!cloudValue) return true;
  if (key !== "ledger-entries") return false;

  try {
    const cloudEntries = JSON.parse(cloudValue);
    const localEntries = JSON.parse(localValue);
    return (
      Array.isArray(cloudEntries) &&
      cloudEntries.length === 0 &&
      Array.isArray(localEntries) &&
      localEntries.length > 0
    );
  } catch {
    return false;
  }
}
