import React from "react";

export const LEDGER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "plan", label: "Plan" },
  { id: "settings", label: "Settings" },
];

export default function LedgerTabBar({ activeTab, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      {LEDGER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`seg-btn ledger-tab-btn${activeTab === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
