/**
 * Release history (newest first). Keep RELEASE_HISTORY[0].version in sync with package.json.
 */
export const RELEASE_HISTORY = [
  {
    version: "1.1.0",
    date: "2025-11-03",
    summary: "Categories, income detection, and version tracking",
    changes: [
      "Expense: Insurance, Gifts & Donations, Taxes & Fees, Debt Repayment",
      "Income: Rental, Bonus, Pension; investment returns label clarified",
      "Investments: EPF/VPF, Bonds/debt funds, Real estate",
      "Bank statement credits auto-categorize with income keywords",
      "App version shown in Settings; backups record appVersion",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-10-01",
    summary: "Initial release",
    changes: [
      "Ledger with expenses, income, and investments",
      "Monthly budgets and 50/30/20 allocation",
      "Excel/CSV import, category rules, split transactions",
      "Local storage and optional Firebase cloud sync",
      "Backup/restore and Google Drive scheduled backup",
    ],
  },
];

export function getLatestRelease() {
  return RELEASE_HISTORY[0] ?? null;
}
