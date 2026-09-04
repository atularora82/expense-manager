function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createSavingsGoal({ name, targetAmount, targetDate = null, currentAmount = 0 }) {
  const trimmed = String(name || "").trim();
  const target = Number(targetAmount);
  const current = Number(currentAmount) || 0;
  if (!trimmed || !Number.isFinite(target) || target <= 0) return null;
  return {
    id: uid(),
    name: trimmed,
    targetAmount: target,
    currentAmount: Math.max(0, current),
    targetDate: targetDate || null,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeSavingsGoals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (g) =>
      g &&
      g.id &&
      String(g.name || "").trim() &&
      Number.isFinite(Number(g.targetAmount)) &&
      Number(g.targetAmount) > 0
  );
}

export function goalProgressPercent(goal) {
  if (!goal?.targetAmount) return 0;
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
}

export function goalRemaining(goal) {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const end = new Date(isoDate + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}
