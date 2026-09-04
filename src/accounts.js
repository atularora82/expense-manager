export const ACCOUNT_TYPES = [
  { id: "bank", label: "Bank account", color: "#3C6E91" },
  { id: "credit_card", label: "Credit card", color: "#A93B3B" },
  { id: "cash", label: "Cash", color: "#6B8E4E" },
  { id: "wallet", label: "Wallet / UPI", color: "#C08A28" },
];

export const accountTypeMap = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.id, t])
);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createAccount(name, type = "bank") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  return {
    id: uid(),
    name: trimmed,
    type: ACCOUNT_TYPES.some((t) => t.id === type) ? type : "bank",
    createdAt: new Date().toISOString(),
  };
}

export function normalizeAccounts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a) => a && a.id && String(a.name || "").trim());
}

export function accountLabel(accounts, accountId) {
  if (!accountId) return null;
  const account = accounts.find((a) => a.id === accountId);
  return account ? account.name : null;
}
