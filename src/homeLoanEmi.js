export const HOME_LOAN_EMI_KEYWORDS = [
  "home loan",
  "homeloan",
  "housing loan",
  "hl emi",
  "home loan emi",
  "mortgage",
  "hdfc home",
  "hdfc ltd",
  "sbi home",
  "lic housing",
  "pnb housing",
  "bajaj home",
  "loan against property",
  "lap emi",
  "property loan",
];

export const BUDGET_SETTINGS_KEY = "ledger-budget-settings";

export function looksLikeHomeLoanEmi(description) {
  const text = String(description || "").toLowerCase();
  if (HOME_LOAN_EMI_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return true;
  }
  return /\bemi\b/.test(text) && /(home|housing|mortgage|property|\bhl\b)/.test(text);
}

import { normalizeBudgetSettings as normalizeBudgetSettingsBase } from "./budgetSettings.js";

export function normalizeBudgetSettings(raw) {
  return normalizeBudgetSettingsBase(raw);
}

function monthsAgoYm(ym, count) {
  const [y, m] = ym.split("-").map(Number);
  let year = y;
  let month = m - count;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function detectHomeLoanEmi(recurring, entries, { month, lookbackMonths = 6 } = {}) {
  const fromRecurring = recurring
    .filter(
      (item) =>
        item.active !== false &&
        item.type === "expense" &&
        (item.category === "housing" || looksLikeHomeLoanEmi(item.description))
    )
    .filter((item) => looksLikeHomeLoanEmi(item.description) || item.category === "housing")
    .sort((a, b) => b.amount - a.amount)[0];

  if (fromRecurring) {
    return {
      amount: fromRecurring.amount,
      source: "recurring",
      description: fromRecurring.description,
    };
  }

  const cutoffYm = month ? monthsAgoYm(month, lookbackMonths) : null;
  const candidates = entries.filter((entry) => {
    if (entry.hidden || entry.type !== "expense") return false;
    if (cutoffYm && entry.date.slice(0, 7) < cutoffYm) return false;
    return (
      looksLikeHomeLoanEmi(entry.description) ||
      (entry.category === "housing" && /\bemi\b/i.test(entry.description))
    );
  });

  const frequency = new Map();
  for (const entry of candidates) {
    frequency.set(entry.amount, (frequency.get(entry.amount) || 0) + 1);
  }

  let best = null;
  for (const [amount, count] of frequency.entries()) {
    if (!best || count > best.count || (count === best.count && amount > best.amount)) {
      best = { amount, count };
    }
  }

  if (!best) return null;

  const sample = candidates.find((entry) => entry.amount === best.amount);
  return {
    amount: best.amount,
    source: "history",
    description: sample?.description || "Home loan EMI",
    occurrences: best.count,
  };
}
