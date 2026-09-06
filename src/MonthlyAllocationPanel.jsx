import React, { useState } from "react";

import { ALLOCATION_MODELS } from "./budgetAllocation.js";
import { BUDGET_METHODS } from "./budgetSettings.js";

function BudgetSetupForm({
  suggestedIncome,
  monthIncome,
  detectedEmi,
  savedEmi,
  customIncome,
  onCustomIncomeChange,
  emiInput,
  onEmiInputChange,
  onSetBudgets,
  fmtMoney,
  budgetMethod,
  onBudgetMethodChange,
  allocationModelId,
  onAllocationModelChange,
  compact = false,
}) {
  const fieldLabel = {
    fontSize: 11,
    fontWeight: 600,
    color: "#74836A",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 5,
  };

  return (
    <div
      style={{
        borderTop: compact ? "none" : "1px dashed #E4DCC5",
        paddingTop: compact ? 0 : 12,
      }}
    >
      {!compact && (
        <div style={{ fontSize: 12.5, color: "#74836A", marginBottom: 12, lineHeight: 1.45 }}>
          Auto-fill category limits from an income rule or your spending history. Customize
          Needs/Wants per category on the <strong>Plan</strong> tab.
          {suggestedIncome > 0 ? (
            <>
              {" "}
              Income basis {fmtMoney(suggestedIncome)}
              {monthIncome > 0 ? " (this month)" : " (3-month avg)"}.
            </>
          ) : (
            " Enter monthly income below."
          )}
          {detectedEmi && (
            <> EMI detected: {fmtMoney(detectedEmi.amount)}.</>
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={fieldLabel}>Build from</label>
          <select
            className="ledger-select"
            style={{ minWidth: 140 }}
            value={budgetMethod || "rule"}
            onChange={(e) => onBudgetMethodChange(e.target.value)}
          >
            {BUDGET_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {budgetMethod !== "avg-spend" && (
          <>
            <div>
              <label style={fieldLabel}>Income rule</label>
              <select
                className="ledger-select"
                style={{ minWidth: 170 }}
                value={allocationModelId || "50-30-20"}
                onChange={(e) => onAllocationModelChange(e.target.value)}
              >
                {ALLOCATION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Monthly income</label>
              <input
                className="ledger-input"
                type="number"
                min="0"
                step="1000"
                placeholder={suggestedIncome > 0 ? String(suggestedIncome) : "e.g. 80000"}
                value={customIncome}
                onChange={(e) => onCustomIncomeChange(e.target.value)}
                style={{ width: 130 }}
              />
            </div>
            <div>
              <label style={fieldLabel}>Home loan EMI</label>
              <input
                className="ledger-input"
                type="number"
                min="0"
                step="100"
                placeholder={
                  savedEmi
                    ? String(savedEmi)
                    : detectedEmi
                    ? String(detectedEmi.amount)
                    : "Optional"
                }
                value={emiInput}
                onChange={(e) => onEmiInputChange(e.target.value)}
                style={{ width: 120 }}
              />
            </div>
          </>
        )}
        <button
          type="button"
          className="ledger-btn"
          style={{ padding: "10px 16px" }}
          onClick={onSetBudgets}
        >
          {budgetMethod === "avg-spend" ? "Set from spending" : "Apply income rule"}
        </button>
      </div>
    </div>
  );
}

function fmtMoney(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function barColor(row) {
  if (row.id === "investment") {
    if (row.status === "under") return "#A93B3B";
    return "#4A5A91";
  }
  if (row.status === "over") return "#A93B3B";
  if (row.progress >= 80) return "#C08A28";
  return "#6B8E4E";
}

function statusLabel(row) {
  if (row.status === "over") return "Over";
  if (row.status === "under" && row.id === "investment") return "Below target";
  if (row.status === "under") return "Under";
  return "On track";
}

function BucketDrillDown({
  bucketId,
  entries,
  categoryTotals,
  fmtDateFull,
  catInfoFor,
  onCategoryClick,
}) {
  if (!entries.length) {
    return (
      <div style={{ fontSize: 12.5, color: "#74836A", padding: "8px 0 4px 20px" }}>
        No transactions in this bucket for this month.
      </div>
    );
  }

  const maxCat = categoryTotals[0]?.total || 1;
  const amountPrefix = bucketId === "investment" ? "↗" : "-";
  const amountColor = bucketId === "investment" ? "#4A5A91" : "#1F2A22";

  return (
    <div
      style={{
        marginTop: 8,
        marginLeft: 4,
        paddingLeft: 16,
        borderLeft: "2px solid #E4DCC5",
      }}
    >
      {categoryTotals.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {categoryTotals.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryClick?.(c.id, bucketId === "investment" ? "investment" : "expense")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "6px 8px",
                marginBottom: 4,
                border: "none",
                borderRadius: 6,
                background: "transparent",
                cursor: onCategoryClick ? "pointer" : "default",
                textAlign: "left",
              }}
              className={onCategoryClick ? "drill-bar" : undefined}
              title={onCategoryClick ? "Filter ledger to this category" : undefined}
            >
              <div style={{ width: 100, fontSize: 12, color: "#4A5A4E", flexShrink: 0 }}>
                {c.label}
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#EDE6D6",
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(c.total / maxCat) * 100}%`,
                    background: c.color,
                    height: "100%",
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11.5,
                  color: "#4A5A4E",
                  width: 72,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {fmtMoney(c.total)}
              </div>
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          border: "1px solid #E4DCC5",
          borderRadius: 6,
          overflow: "hidden",
          background: "#FFFCF5",
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {entries.map((en, i) => {
          const cat = catInfoFor(en.type, en.category);
          return (
            <div
              key={en.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderTop: i === 0 ? "none" : "1px dashed #EDE6D6",
                fontSize: 12.5,
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: "#A69C82",
                  width: 72,
                  flexShrink: 0,
                }}
              >
                {fmtDateFull(en.date)}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: "#1F2A22",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {en.description}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: cat.color,
                  border: `1px solid ${cat.color}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  flexShrink: 0,
                }}
              >
                {cat.label}
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: amountColor,
                  width: 72,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {amountPrefix}
                {fmtMoney(en.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MonthlyAllocationPanel({
  overview,
  monthLabel,
  drillGroups,
  categoryTotalsByBucket,
  fmtDateFull,
  catInfoFor,
  onCategoryClick,
  budgetSetup,
}) {
  const [expandedBucket, setExpandedBucket] = useState(null);

  if (!overview) return null;

  const pct = (n) => `${Math.round(n * 100)}%`;

  function toggleBucket(bucketId) {
    setExpandedBucket((prev) => (prev === bucketId ? null : bucketId));
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#74836A",
          marginBottom: 10,
        }}
      >
        50/30/20 overview &mdash; {monthLabel}
      </div>

      <div
        style={{
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          background: "#FFFDF8",
          padding: "14px 16px",
        }}
      >
        {!overview.hasIncome ? (
          <>
            <div style={{ fontSize: 12.5, color: "#74836A", lineHeight: 1.45, marginBottom: 14 }}>
              {overview.suggestion}
            </div>
            {budgetSetup && (
              <BudgetSetupForm {...budgetSetup} monthLabel={monthLabel} compact />
            )}
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 12.5,
                color: "#74836A",
                marginBottom: 14,
                lineHeight: 1.45,
              }}
            >
              Based on {fmtMoney(overview.income)} income
              {overview.incomeIsEstimated ? " (estimated)" : ""} — target split:{" "}
              {pct(overview.model.needs)} needs · {pct(overview.model.wants)} wants ·{" "}
              {pct(overview.model.savings)} invest & save.
              <span style={{ display: "block", marginTop: 4, fontSize: 11.5 }}>
                Click a row to see transactions.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
              {overview.rows.map((row) => {
                const expanded = expandedBucket === row.id;
                const entries = drillGroups?.[row.id] || [];
                const categoryTotals = categoryTotalsByBucket?.[row.id] || [];
                return (
                  <div key={row.id}>
                    <button
                      type="button"
                      onClick={() => toggleBucket(row.id)}
                      style={{
                        width: "100%",
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 8,
                          marginBottom: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontSize: 12.5, color: "#1F2A22", fontWeight: 500 }}>
                          <span style={{ marginRight: 6, color: "#A69C82" }}>
                            {expanded ? "▾" : "▸"}
                          </span>
                          {row.label}{" "}
                          <span style={{ color: "#A69C82", fontWeight: 400 }}>
                            ({pct(row.pct)} target {fmtMoney(row.target)})
                          </span>
                          {entries.length > 0 && (
                            <span style={{ color: "#A69C82", fontWeight: 400, marginLeft: 6 }}>
                              · {entries.length} txn
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 12,
                            color: row.status === "over" ? "#A93B3B" : "#4A5A4E",
                          }}
                        >
                          {fmtMoney(row.actual)} · {statusLabel(row)}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#EDE6D6",
                          height: 8,
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(row.progress, 100)}%`,
                            background: barColor(row),
                            height: "100%",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </button>
                    {expanded && (
                      <BucketDrillDown
                        bucketId={row.id}
                        entries={entries}
                        categoryTotals={categoryTotals}
                        fmtDateFull={fmtDateFull}
                        catInfoFor={catInfoFor}
                        onCategoryClick={onCategoryClick}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                borderTop: "1px dashed #E4DCC5",
                paddingTop: 12,
                fontSize: 12.5,
                color: "#4A5A4E",
                lineHeight: 1.5,
                marginBottom: budgetSetup ? 14 : 0,
              }}
            >
              <strong style={{ color: "#1F2A22" }}>Suggestion: </strong>
              {overview.suggestion}
            </div>
            {budgetSetup && <BudgetSetupForm {...budgetSetup} monthLabel={monthLabel} />}
          </>
        )}
      </div>
    </div>
  );
}
