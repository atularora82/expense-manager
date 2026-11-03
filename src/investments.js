export const INVESTMENT_CATEGORIES = [
  { id: "lic", label: "LIC Premium", color: "#5C4A91" },
  { id: "mf_sip", label: "Mutual Fund SIP", color: "#3C6E91" },
  { id: "shares", label: "Shares / Stocks", color: "#2F6B4F" },
  { id: "post_office", label: "Post Office", color: "#B15E86" },
  { id: "fixed_deposit", label: "Fixed Deposit", color: "#8B5E34" },
  { id: "ppf", label: "PPF", color: "#4A5A91" },
  { id: "epf", label: "EPF / VPF", color: "#2F6B4F" },
  { id: "nps", label: "NPS", color: "#3E8C8C" },
  { id: "bonds", label: "Bonds / debt funds", color: "#5A7A9E" },
  { id: "gold", label: "Gold / SGB", color: "#C08A28" },
  { id: "real_estate", label: "Real estate investment", color: "#8B5E34" },
  { id: "other_investment", label: "Other investment", color: "#74836A" },
];

export const investmentCatMap = Object.fromEntries(
  INVESTMENT_CATEGORIES.map((c) => [c.id, c])
);

export const INVESTMENT_KEYWORDS = {
  lic: ["lic", "life insurance", "insurance premium", "jeevan"],
  mf_sip: ["sip", "mutual fund", "mf", "hdfc fund", "axis fund", "icici prudential", "groww", "zerodha coin"],
  shares: ["share", "shares", "stock", "stocks", "equity", "nifty", "demat", "zerodha", "upstox"],
  fixed_deposit: ["fixed deposit", "fd", "term deposit", "bank rd", "recurring deposit"],
  ppf: ["ppf", "public provident fund"],
  epf: [
    "epf",
    "employee pf",
    "employer pf",
    "pf contribution",
    "provident fund",
    "vpf",
    "voluntary pf",
    "uan",
  ],
  nps: ["nps", "national pension", "nps contribution"],
  bonds: [
    "bond",
    "bonds",
    "debt fund",
    "gilt",
    "govt bond",
    "government bond",
    "corporate bond",
    "rbi retail",
    "ncd",
  ],
  gold: ["gold", "sgb", "sovereign gold bond", "digital gold"],
  real_estate: [
    "property investment",
    "real estate",
    "down payment",
    "builder payment",
    "reit",
    "realty",
    "flat booking",
  ],
  post_office: [
    "post office",
    "postoffice",
    "india post",
    "nsc",
    "kvp",
    "scss",
    "mis",
    "po rd",
    "po fd",
    "post office rd",
    "post office fd",
    "post office savings",
  ],
};

export function detectInvestmentCategory(lowerText) {
  for (const cat of INVESTMENT_CATEGORIES) {
    const words = INVESTMENT_KEYWORDS[cat.id];
    if (words && words.some((w) => lowerText.includes(w))) return cat.id;
  }
  return "other_investment";
}
