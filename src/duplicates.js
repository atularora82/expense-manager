export function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

export function findDateAmountDuplicates(entries, { date, amount, excludeId = null }) {
  if (!date || amount == null || Number.isNaN(Number(amount))) return [];
  return entries.filter(
    (e) =>
      e.id !== excludeId &&
      e.date === date &&
      amountsMatch(e.amount, amount)
  );
}
