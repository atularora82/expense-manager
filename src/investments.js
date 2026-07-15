export const INVESTMENT_CATEGORIES = [
  { id: "lic", label: "LIC Premium", color: "#5C4A91" },
  { id: "mf_sip", label: "Mutual Fund SIP", color: "#3C6E91" },
  { id: "shares", label: "Shares / Stocks", color: "#2F6B4F" },
  { id: "fixed_deposit", label: "Fixed Deposit", color: "#8B5E34" },
  { id: "ppf", label: "PPF", color: "#4A5A91" },
  { id: "nps", label: "NPS", color: "#3E8C8C" },
  { id: "gold", label: "Gold / SGB", color: "#C08A28" },
  { id: "other_investment", label: "Other investment", color: "#74836A" },
];

export const investmentCatMap = Object.fromEntries(
  INVESTMENT_CATEGORIES.map((c) => [c.id, c])
);

export const INVESTMENT_KEYWORDS = {
  lic: ["lic", "life insurance", "insurance premium", "jeevan"],
  mf_sip: ["sip", "mutual fund", "mf", "hdfc fund", "axis fund", "icici prudential", "groww", "zerodha coin"],
  shares: ["share", "shares", "stock", "stocks", "equity", "nifty", "demat", "zerodha", "upstox"],
  fixed_deposit: ["fixed deposit", "fd", "term deposit", "recurring deposit", "rd"],
  ppf: ["ppf", "public provident fund"],
  nps: ["nps", "national pension"],
  gold: ["gold", "sgb", "sovereign gold bond", "digital gold"],
};

export function detectInvestmentCategory(lowerText) {
  for (const cat of INVESTMENT_CATEGORIES) {
    const words = INVESTMENT_KEYWORDS[cat.id];
    if (words && words.some((w) => lowerText.includes(w))) return cat.id;
  }
  return "other_investment";
}
