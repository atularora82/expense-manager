import { CATEGORY_ALLOCATION, getAllocationModel } from "./budgetAllocation.js";
import { getCategoryBucket } from "./budgetSettings.js";

export function getExpenseBucket(categoryId, settings) {
  const bucket = getCategoryBucket(categoryId, settings);
  if (bucket === "skip") return "wants";
  return bucket;
}

export function entryBelongsToBucket(entry, bucketId, settings) {
  if (bucketId === "investment") return entry.type === "investment";
  if (entry.type !== "expense") return false;
  const bucket = getCategoryBucket(entry.category, settings);
  if (bucket === "skip") return false;
  return bucket === bucketId;
}

export function groupEntriesForAllocationDrill(entries, settings) {
  const needs = [];
  const wants = [];
  const investment = [];
  for (const e of entries) {
    if (entryBelongsToBucket(e, "needs", settings)) needs.push(e);
    else if (entryBelongsToBucket(e, "wants", settings)) wants.push(e);
    else if (entryBelongsToBucket(e, "investment", settings)) investment.push(e);
  }
  const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  return {
    needs: needs.sort(byDate),
    wants: wants.sort(byDate),
    investment: investment.sort(byDate),
  };
}

export function categoryTotalsInBucket(entries, catMap = {}) {
  const map = {};
  for (const e of entries) {
    map[e.category] = (map[e.category] || 0) + e.amount;
  }
  return Object.entries(map)
    .map(([id, total]) => ({
      id,
      total,
      label: catMap[id]?.label || id,
      color: catMap[id]?.color || "#74836A",
    }))
    .sort((a, b) => b.total - a.total);
}

export function splitExpensesByBucket(spendingByCategory, settings) {
  let needs = 0;
  let wants = 0;
  for (const [id, amount] of Object.entries(spendingByCategory)) {
    if (!amount) continue;
    if (getCategoryBucket(id, settings) === "needs") needs += amount;
    else if (getCategoryBucket(id, settings) !== "skip") wants += amount;
  }
  return { needs, wants };
}

function rowStatus(id, actual, target) {
  if (target <= 0) return "empty";
  const tolerance = target * 0.05;
  const delta = actual - target;
  if (id === "investment") {
    if (delta < -tolerance) return "under";
    return "on_track";
  }
  if (delta > tolerance) return "over";
  if (delta < -tolerance) return "under";
  return "on_track";
}

function buildSuggestion(rows, income, expenseTotal, investmentTotal) {
  const needs = rows.find((r) => r.id === "needs");
  const wants = rows.find((r) => r.id === "wants");
  const invest = rows.find((r) => r.id === "investment");
  const parts = [];

  if (needs?.status === "over") {
    parts.push(
      `Needs are over target by ${Math.round(needs.delta).toLocaleString("en-IN")} — check housing, groceries, and utilities.`
    );
  }
  if (wants?.status === "over") {
    parts.push(
      `Wants are over target by ${Math.round(wants.delta).toLocaleString("en-IN")} — cut back on dining, shopping, or entertainment.`
    );
  }
  if (invest?.status === "under") {
    parts.push(
      `Invest or save ${Math.round(-invest.delta).toLocaleString("en-IN")} more to reach the 20% target.`
    );
  }

  const unallocated = income - expenseTotal - investmentTotal;
  if (unallocated > income * 0.05 && invest?.status === "under") {
    parts.push(
      `You have ${Math.round(unallocated).toLocaleString("en-IN")} unallocated this month — direct it to SIP or emergency fund.`
    );
  }

  if (parts.length === 0) {
    if (needs?.status === "under" && wants?.status === "under" && invest?.status === "on_track") {
      return "Spending is below targets and investments are on track — strong month.";
    }
    return "You are broadly aligned with the 50/30/20 split this month.";
  }

  return parts.join(" ");
}

/**
 * Monthly 50/30/20 overview: needs / wants expenses vs investment target.
 */
export function buildMonthlyAllocationOverview({
  income,
  spendingByCategory = {},
  investmentTotal = 0,
  modelId = "50-30-20",
  incomeIsEstimated = false,
  budgetSettings = null,
}) {
  const model = getAllocationModel(modelId);
  const incomeBase = Math.max(0, Number(income) || 0);
  const { needs, wants } = splitExpensesByBucket(spendingByCategory, budgetSettings);
  const expenseTotal = needs + wants;

  if (incomeBase <= 0) {
    return {
      hasIncome: false,
      income: 0,
      model,
      rows: [],
      suggestion:
        "Add income for this month to see how your spending and investments compare to 50/30/20.",
      incomeIsEstimated: false,
      unallocated: 0,
    };
  }

  const rows = [
    {
      id: "needs",
      label: "Needs",
      pct: model.needs,
      target: incomeBase * model.needs,
      actual: needs,
    },
    {
      id: "wants",
      label: "Wants",
      pct: model.wants,
      target: incomeBase * model.wants,
      actual: wants,
    },
    {
      id: "investment",
      label: "Invest & save",
      pct: model.savings,
      target: incomeBase * model.savings,
      actual: investmentTotal,
    },
  ].map((row) => {
    const delta = row.actual - row.target;
    return {
      ...row,
      delta,
      status: rowStatus(row.id, row.actual, row.target),
      progress: row.target > 0 ? Math.min((row.actual / row.target) * 100, 150) : 0,
    };
  });

  return {
    hasIncome: true,
    income: incomeBase,
    model,
    rows,
    expenseTotal,
    investmentTotal,
    unallocated: incomeBase - expenseTotal - investmentTotal,
    suggestion: buildSuggestion(rows, incomeBase, expenseTotal, investmentTotal),
    incomeIsEstimated,
  };
}
