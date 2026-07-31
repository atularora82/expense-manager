import { normalizeLedgerDate } from "./dateParse.js";

export function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

export function dateAmountKey(date, amount) {
  const normalizedDate = normalizeLedgerDate(date) || date;
  const normalizedAmount = Number.isFinite(Number(amount))
    ? Number(amount).toFixed(2)
    : String(amount ?? "");
  return `${normalizedDate}|${normalizedAmount}`;
}

export function findDateAmountDuplicates(entries, { date, amount, excludeId = null }) {
  const targetDate = normalizeLedgerDate(date);
  if (!targetDate || amount == null || Number.isNaN(Number(amount))) return [];
  return entries.filter(
    (e) =>
      e.id !== excludeId &&
      normalizeLedgerDate(e.date) === targetDate &&
      amountsMatch(e.amount, amount)
  );
}
