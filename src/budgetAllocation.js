/**
 * Standard monthly budget allocation models.
 * Expense categories split the needs + wants pools; savings is shown separately.
 */

export const ALLOCATION_MODELS = [
  {
    id: "50-30-20",
    label: "50/30/20 — Balanced",
    needs: 0.5,
    wants: 0.3,
    savings: 0.2,
    description: "50% needs, 30% wants, 20% savings (classic rule)",
  },
  {
    id: "60-20-20",
    label: "60/20/20 — Conservative",
    needs: 0.6,
    wants: 0.2,
    savings: 0.2,
    description: "60% needs, 20% wants, 20% savings",
  },
  {
    id: "70-20-10",
    label: "70/20/10 — Essentials focus",
    needs: 0.7,
    wants: 0.2,
    savings: 0.1,
    description: "70% needs, 20% wants, 10% savings",
  },
];

/** Share of each expense category within its needs/wants bucket (weights sum to 1 per bucket). */
export const CATEGORY_ALLOCATION = {
  housing: { bucket: "needs", weight: 0.32 },
  groceries: { bucket: "needs", weight: 0.24 },
  utilities: { bucket: "needs", weight: 0.14 },
  transport: { bucket: "needs", weight: 0.14 },
  health: { bucket: "needs", weight: 0.1 },
  education: { bucket: "needs", weight: 0.06 },
  food: { bucket: "wants", weight: 0.22 },
  entertainment: { bucket: "wants", weight: 0.18 },
  shopping: { bucket: "wants", weight: 0.2 },
  travel: { bucket: "wants", weight: 0.15 },
  personal: { bucket: "wants", weight: 0.12 },
  other: { bucket: "wants", weight: 0.13 },
};

export function getAllocationModel(modelId) {
  return ALLOCATION_MODELS.find((m) => m.id === modelId) || ALLOCATION_MODELS[0];
}

function roundBudget(amount) {
  if (amount <= 0) return 0;
  if (amount < 500) return Math.round(amount / 50) * 50;
  return Math.round(amount / 100) * 100;
}

export function sumMonthIncome(entries, ym, { includeHidden = false } = {}) {
  return entries
    .filter(
      (e) =>
        e.type === "income" &&
        e.date.slice(0, 7) === ym &&
        (includeHidden || !e.hidden)
    )
    .reduce((s, e) => s + e.amount, 0);
}

export function averageMonthlyIncome(entries, endYm, months = 3, options = {}) {
  const [endY, endM] = endYm.split("-").map(Number);
  let total = 0;
  let count = 0;
  let y = endY;
  let m = endM;
  for (let i = 0; i < months; i++) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const income = sumMonthIncome(entries, ym, options);
    if (income > 0) {
      total += income;
      count += 1;
    }
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return count > 0 ? total / count : 0;
}

export function computeBudgetAllocation({
  monthlyIncome,
  modelId,
  categoryIds,
  housingEmiAmount = null,
  categoryBuckets = null,
}) {
  const model = getAllocationModel(modelId);
  const income = Math.max(0, Number(monthlyIncome) || 0);

  const needsPool = income * model.needs;
  const wantsPool = income * model.wants;
  const savingsPool = income * model.savings;

  const bucketMap = categoryBuckets || {};
  const bucketFor = (id) => {
    if (bucketMap[id] === "skip") return "skip";
    if (bucketMap[id] === "needs" || bucketMap[id] === "wants") return bucketMap[id];
    return CATEGORY_ALLOCATION[id]?.bucket === "needs" ? "needs" : "wants";
  };
  const needsIds = categoryIds.filter((id) => bucketFor(id) === "needs");
  const wantsIds = categoryIds.filter((id) => bucketFor(id) === "wants");

  function normalizedWeights(ids) {
    if (ids.length === 0) return {};
    const raw = ids.map((id) => ({
      id,
      weight: CATEGORY_ALLOCATION[id]?.weight ?? 1 / ids.length,
    }));
    const sum = raw.reduce((s, r) => s + r.weight, 0) || 1;
    return Object.fromEntries(raw.map((r) => [r.id, r.weight / sum]));
  }

  const needsWeights = normalizedWeights(needsIds);
  const wantsWeights = normalizedWeights(wantsIds);

  const budgets = {};
  for (const id of needsIds) {
    budgets[id] = roundBudget(needsPool * (needsWeights[id] || 0));
  }
  for (const id of wantsIds) {
    budgets[id] = roundBudget(wantsPool * (wantsWeights[id] || 0));
  }
  for (const id of categoryIds) {
    if (bucketMap[id] === "skip" && budgets[id] === undefined) {
      budgets[id] = 0;
    }
  }

  const emi = Number(housingEmiAmount);
  if (Number.isFinite(emi) && emi > 0 && categoryIds.includes("housing")) {
    budgets.housing = roundBudget(emi);
  }

  const allocated = Object.values(budgets).reduce((s, n) => s + n, 0);

  return {
    budgets,
    model,
    monthlyIncome: income,
    needsPool: roundBudget(needsPool),
    wantsPool: roundBudget(wantsPool),
    savingsPool: roundBudget(savingsPool),
    allocatedTotal: allocated,
    housingEmiApplied: Number.isFinite(emi) && emi > 0 ? roundBudget(emi) : null,
  };
}

export function averageCategorySpending(entries, endYm, categoryIds, months = 3) {
  const [endY, endM] = endYm.split("-").map(Number);
  const totals = {};
  for (const id of categoryIds) totals[id] = 0;

  let y = endY;
  let m = endM;
  for (let i = 0; i < months; i++) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    for (const e of entries) {
      if (
        e.type === "expense" &&
        e.date.slice(0, 7) === ym &&
        categoryIds.includes(e.category)
      ) {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
      }
    }
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  const budgets = {};
  for (const id of categoryIds) {
    budgets[id] = roundBudget((totals[id] || 0) / months);
  }
  return budgets;
}

/**
 * Move limits from categories with no spending to over-budget categories.
 * Zeroes unused heads and distributes the pool by each category's overshoot.
 */
export function rebalanceZeroSpendBudgets(budgets, spendingByCategory, categoryIds) {
  const donors = [];
  let pool = 0;
  const next = { ...budgets };

  for (const id of categoryIds) {
    const spent = spendingByCategory[id] || 0;
    const budget = budgets[id] || 0;
    if (spent === 0 && budget > 0) {
      pool += budget;
      donors.push({ id, amount: budget });
      next[id] = 0;
    }
  }

  if (pool <= 0 || donors.length === 0) {
    return { budgets, pool: 0, donors: [], recipients: [], applied: false };
  }

  const overs = categoryIds
    .map((id) => {
      const spent = spendingByCategory[id] || 0;
      const budget = budgets[id] || 0;
      return { id, spent, budget, need: Math.max(0, spent - budget) };
    })
    .filter((c) => c.need > 0);

  if (overs.length === 0) {
    return {
      budgets,
      pool: 0,
      donors: [],
      recipients: [],
      applied: false,
      reason: "no_over_budget",
    };
  }

  const totalNeed = overs.reduce((s, c) => s + c.need, 0);
  let remaining = pool;
  const recipients = [];

  overs.forEach((c, idx) => {
    let add;
    if (idx === overs.length - 1) {
      add = remaining;
    } else {
      add = roundBudget((c.need / totalNeed) * pool);
      remaining -= add;
    }
    next[c.id] = (next[c.id] || 0) + add;
    recipients.push({ id: c.id, amount: add, newBudget: next[c.id] });
  });

  return { budgets: next, pool, donors, recipients, applied: true };
}
