function sumByType(entries, type) {
  return entries
    .filter((e) => e.type === type)
    .reduce((s, e) => s + e.amount, 0);
}

function totalsByCategory(entries, type, catInfoFn) {
  const map = {};
  entries
    .filter((e) => e.type === type)
    .forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
  return Object.entries(map)
    .map(([id, total]) => ({
      id,
      total,
      label: catInfoFn(type, id)?.label || id,
      color: catInfoFn(type, id)?.color || "#74836A",
    }))
    .sort((a, b) => b.total - a.total);
}

export function buildPeriodReport({
  periodLabel,
  periodEntries,
  budgets = {},
  catInfoFor,
  expenseCategories = [],
}) {
  const income = sumByType(periodEntries, "income");
  const expense = sumByType(periodEntries, "expense");
  const investment = sumByType(periodEntries, "investment");
  const net = income - expense - investment;
  const savingsRate = income > 0 ? net / income : null;

  const expenseByCategory = totalsByCategory(periodEntries, "expense", catInfoFor);
  const incomeByCategory = totalsByCategory(periodEntries, "income", catInfoFor);

  const budgetSummary = expenseCategories
    .map((c) => {
      const spent = expenseByCategory.find((t) => t.id === c.id)?.total || 0;
      const limit = budgets[c.id] || 0;
      if (limit <= 0 && spent <= 0) return null;
      return {
        id: c.id,
        label: c.label,
        spent,
        limit,
        over: limit > 0 && spent > limit,
        pct: limit > 0 ? Math.round((spent / limit) * 100) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.spent - a.spent);

  const topExpenses = periodEntries
    .filter((e) => e.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e) => ({
      date: e.date,
      description: e.description,
      amount: e.amount,
      category: catInfoFor(e.type, e.category)?.label || e.category,
    }));

  return {
    periodLabel,
    generatedAt: new Date().toISOString(),
    income,
    expense,
    investment,
    net,
    savingsRate,
    entryCount: periodEntries.length,
    expenseByCategory,
    incomeByCategory,
    budgetSummary,
    topExpenses,
  };
}

export function formatReportPct(rate) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}
