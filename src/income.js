export const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", color: "#2F6B4F" },
  { id: "freelance", label: "Freelance", color: "#3C6E91" },
  { id: "business", label: "Business", color: "#8B5E34" },
  { id: "rental", label: "Rental income", color: "#6B8E4E" },
  { id: "bonus", label: "Bonus / variable pay", color: "#7A4E8C" },
  { id: "investment", label: "Investment returns", color: "#4A5A91" },
  { id: "pension", label: "Pension / retirement", color: "#3E8C8C" },
  { id: "gift", label: "Gift", color: "#B15E86" },
  { id: "refund", label: "Refund / Cashback", color: "#74836A" },
  { id: "other_income", label: "Other income", color: "#C08A28" },
];

export const incomeCatMap = Object.fromEntries(
  INCOME_CATEGORIES.map((c) => [c.id, c])
);

export const INCOME_KEYWORDS = {
  salary: [
    "salary",
    "paycheck",
    "pay check",
    "stipend",
    "sal cr",
    "neft salary",
    "salary credit",
  ],
  freelance: ["freelance", "client payment", "project payment", "gig"],
  business: ["business income", "sales", "revenue"],
  rental: [
    "rent received",
    "rental income",
    "tenant",
    "lease income",
    "property rent",
    "house rent received",
  ],
  bonus: [
    "bonus",
    "variable pay",
    "incentive",
    "esop",
    "rsu",
    "performance pay",
    "ex gratia",
    "variable payout",
  ],
  investment: [
    "dividend",
    "interest credited",
    "interest income",
    "fd interest",
    "mutual fund redemption",
    "mf redemption",
    "investment return",
    "capital gain",
  ],
  pension: [
    "pension",
    "family pension",
    "superannuation",
    "annuity payout",
    "retirement payout",
    "nps withdrawal",
  ],
  gift: ["gift", "gifted", "birthday money"],
  refund: ["refund", "cashback", "reimbursement"],
};

export function detectIncomeCategory(lowerText) {
  for (const cat of INCOME_CATEGORIES) {
    if (cat.id === "other_income") continue;
    const words = INCOME_KEYWORDS[cat.id];
    if (words && words.some((w) => lowerText.includes(w))) return cat.id;
  }
  return "other_income";
}
