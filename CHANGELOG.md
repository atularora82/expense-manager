# Changelog

All notable changes to Expense Book are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The current version lives in `package.json` and must match the first entry in `src/releases.js` (run `npm run verify:release` before shipping).

## [1.1.0] - 2025-11-03

### Added

- Expense categories: Insurance, Gifts & Donations, Taxes & Fees, Debt Repayment
- Income categories: Rental income, Bonus / variable pay, Pension / retirement
- Investment categories: EPF / VPF, Bonds / debt funds, Real estate investment
- Income keyword detection for bank statement credits
- Release tracking: `CHANGELOG.md`, `src/releases.js`, in-app About panel, `appVersion` on backups

### Changed

- Income category **Investment** renamed to **Investment returns** (id unchanged: `investment`)

## [1.0.0] - 2025-10-01

### Added

- Core expense ledger, budgets, imports, backups, and cloud sync
