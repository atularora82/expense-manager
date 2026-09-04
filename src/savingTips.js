import { goalProgressPercent, goalRemaining } from "./savingsGoals.js";

function sumByType(entries, type) {
  return entries
    .filter((e) => e.type === type)
    .reduce((s, e) => s + e.amount, 0);
}

function expenseByCategory(entries) {
  const map = {};
  entries
    .filter((e) => e.type === "expense")
    .forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
  return map;
}

function pct(n) {
  return Math.round(n * 100);
}

function prevMonthYm(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

const EVERGREEN_TIPS = [
  {
    id: "evergreen-50-30-20",
    priority: 80,
    type: "tip",
    title: "Try the 50/30/20 split",
    body: "Aim for 50% on needs, 30% on wants, and 20% toward savings or debt payoff. Use your category totals to see where you stand.",
  },
  {
    id: "evergreen-subscriptions",
    priority: 81,
    type: "tip",
    title: "Audit recurring charges",
    body: "Review subscriptions and auto-debits once a quarter. Cancel what you have not used in the last 30 days.",
  },
  {
    id: "evergreen-emergency-fund",
    priority: 82,
    type: "tip",
    title: "Build an emergency fund",
    body: "Keep 3–6 months of essential expenses in a separate savings account before chasing higher-risk investments.",
  },
  {
    id: "evergreen-impulse",
    priority: 83,
    type: "tip",
    title: "Pause before impulse buys",
    body: "Wait 24 hours on non-essential purchases above ₹1,000. Many impulse buys lose their appeal overnight.",
  },
  {
    id: "evergreen-cash-envelope",
    priority: 84,
    type: "tip",
    title: "Set category limits",
    body: "Monthly budgets per category help you spot overspending early. Start with your top two spending categories.",
  },
];

/**
 * Build personalized saving tips from ledger data.
 * Returns up to `limit` tips sorted by priority (lower = more important).
 */
export function buildSavingTips(
  {
    entries,
    periodEntries,
    periodMode,
    periodLabel,
    month,
    budgets = {},
    catMap = {},
    periodIncomeTotal,
    periodExpenseTotal,
    periodInvestmentTotal,
    catTotals = [],
    savingsGoals = [],
  },
  { limit = 6 } = {}
) {
  const tips = [];
  const periodNet =
    periodIncomeTotal - periodExpenseTotal - periodInvestmentTotal;

  if (periodExpenseTotal > 0 || periodIncomeTotal > 0) {
    if (periodIncomeTotal > 0 && periodNet < 0) {
      tips.push({
        id: "deficit-spending",
        priority: 1,
        type: "warning",
        title: "Spending exceeds income",
        body: `Your net for ${periodLabel} is negative. Trim discretionary categories or delay large purchases until income catches up.`,
      });
    }

    if (periodIncomeTotal > 0) {
      const savingsRate = periodNet / periodIncomeTotal;
      if (savingsRate >= 0.2) {
        tips.push({
          id: "strong-savings-rate",
          priority: 5,
          type: "success",
          title: "Healthy savings rate",
          body: `You are saving about ${pct(savingsRate)}% of income this period. Consider directing surplus into investments or your emergency fund.`,
        });
      } else if (savingsRate >= 0.1) {
        tips.push({
          id: "moderate-savings-rate",
          priority: 15,
          type: "info",
          title: "Room to save more",
          body: `You are saving about ${pct(savingsRate)}% of income. The classic target is 20% — even a 2% bump adds up over time.`,
        });
      } else if (savingsRate >= 0) {
        tips.push({
          id: "low-savings-rate",
          priority: 10,
          type: "warning",
          title: "Savings rate is low",
          body: `Only about ${pct(savingsRate)}% of income is left after expenses and investments. Review your largest categories for quick wins.`,
        });
      }
    }

    if (periodIncomeTotal > 0 && periodInvestmentTotal === 0) {
      tips.push({
        id: "no-investments",
        priority: 20,
        type: "info",
        title: "Start investing regularly",
        body: "No investments logged this period. Even a small monthly SIP builds long-term wealth through compounding.",
      });
    } else if (
      periodIncomeTotal > 0 &&
      periodInvestmentTotal > 0 &&
      periodInvestmentTotal / periodIncomeTotal < 0.1
    ) {
      tips.push({
        id: "low-investment-ratio",
        priority: 25,
        type: "info",
        title: "Investments are a small share of income",
        body: `Investments are about ${pct(periodInvestmentTotal / periodIncomeTotal)}% of income. Many planners suggest 10–20% once essentials are covered.`,
      });
    }
  }

  if (catTotals.length > 0 && periodExpenseTotal > 0) {
    const top = catTotals[0];
    const share = top.total / periodExpenseTotal;
    if (share >= 0.35) {
      tips.push({
        id: `top-category-${top.id}`,
        priority: 12,
        type: "info",
        title: `${top.label} dominates spending`,
        body: `${top.label} is about ${pct(share)}% of expenses this period. A 10% reduction there frees meaningful cash without touching essentials.`,
        categoryId: top.id,
      });
    }
  }

  if (periodMode === "month" && month && entries.length > 0) {
    const prevYm = prevMonthYm(month);
    const prevExpense = sumByType(
      entries.filter((e) => e.date.slice(0, 7) === prevYm),
      "expense"
    );
    const curExpense = periodExpenseTotal;
    if (prevExpense > 0 && curExpense > prevExpense * 1.15) {
      const jump = pct((curExpense - prevExpense) / prevExpense);
      tips.push({
        id: "mom-expense-spike",
        priority: 8,
        type: "warning",
        title: "Spending jumped vs last month",
        body: `Expenses are up about ${jump}% compared to the previous month. Check whether this is a one-off or a trend worth budgeting for.`,
      });
    } else if (prevExpense > 0 && curExpense < prevExpense * 0.9) {
      const drop = pct((prevExpense - curExpense) / prevExpense);
      tips.push({
        id: "mom-expense-drop",
        priority: 40,
        type: "success",
        title: "Spending is down vs last month",
        body: `You spent about ${drop}% less than the previous month. If this is sustainable, redirect the difference to savings.`,
      });
    }
  }

  if (periodMode === "month" && month) {
    const spentByCat = expenseByCategory(periodEntries);
    const overBudget = Object.entries(spentByCat)
      .filter(([id, spent]) => {
        const limit = budgets[id] || 0;
        return limit > 0 && spent > limit;
      })
      .map(([id, spent]) => ({
        id,
        spent,
        budget: budgets[id],
        label: catMap[id]?.label || id,
        overBy: spent - budgets[id],
      }))
      .sort((a, b) => b.overBy - a.overBy);

    if (overBudget.length > 0) {
      const worst = overBudget[0];
      tips.push({
        id: `over-budget-${worst.id}`,
        priority: 3,
        type: "warning",
        title: `Over budget: ${worst.label}`,
        body: `You have exceeded your ${worst.label} limit this month. Pause non-essential spend in this category until next month.`,
        categoryId: worst.id,
      });
    }

    const unbudgetedHigh = catTotals
      .filter((c) => !(budgets[c.id] > 0) && c.total > 0)
      .slice(0, 1);
    if (unbudgetedHigh.length > 0 && overBudget.length === 0) {
      const c = unbudgetedHigh[0];
      tips.push({
        id: `set-budget-${c.id}`,
        priority: 30,
        type: "tip",
        title: `Set a limit for ${c.label}`,
        body: `${c.label} is one of your top spending categories but has no monthly budget. Adding a limit helps you catch overspending early.`,
        categoryId: c.id,
      });
    }
  }

  if (periodMode === "week" && periodExpenseTotal > 0) {
    const dailyAvg = periodExpenseTotal / 7;
    tips.push({
      id: "weekly-daily-average",
      priority: 50,
      type: "info",
      title: "Daily spend pace",
      body: `You are averaging about ₹${Math.round(dailyAvg).toLocaleString("en-IN")} per day this week. Multiply by 30 for a rough monthly run-rate.`,
    });
  }

  if (savingsGoals.length > 0) {
    for (const goal of savingsGoals) {
      const progress = goalProgressPercent(goal);
      const remaining = goalRemaining(goal);
      if (progress >= 100) {
        tips.push({
          id: `goal-complete-${goal.id}`,
          priority: 4,
          type: "success",
          title: `Goal reached: ${goal.name}`,
          body: "You've hit your target. Consider setting a new goal or moving surplus to investments.",
        });
      } else if (progress >= 40) {
        tips.push({
          id: `goal-progress-${goal.id}`,
          priority: 28,
          type: "info",
          title: `${goal.name} is ${progress}% funded`,
          body: `About ₹${Math.round(remaining).toLocaleString("en-IN")} left to reach your target. Keep contributing steadily.`,
        });
      }
    }
  }

  const seenEvergreen = new Set(
    tips.map((t) => t.id).filter((id) => id.startsWith("evergreen-"))
  );
  for (const tip of EVERGREEN_TIPS) {
    if (!seenEvergreen.has(tip.id)) tips.push(tip);
  }

  return tips.sort((a, b) => a.priority - b.priority).slice(0, limit);
}
