import React from "react";
import { ALLOCATION_MODELS } from "./budgetAllocation.js";
import { BUDGET_BUCKETS, BUDGET_METHODS, getCategoryBucket } from "./budgetSettings.js";

const fieldLabel = {
  fontSize: 11,
  fontWeight: 600,
  color: "#74836A",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 5,
};

function CategoryRow({
  c,
  spent,
  budget,
  bucket,
  avgSpend,
  budgetValueFor,
  updateBudgetDraft,
  commitBudget,
  onBucketChange,
  onUseAvg,
  fmtMoney,
}) {
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.min((spent / budget) * 100, 100) : 0;
  const over = hasBudget && spent > budget;
  const fillColor = !hasBudget
    ? "#D8CDB4"
    : over
    ? "#A93B3B"
    : pct >= 80
    ? "#C08A28"
    : "#6B8E4E";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderTop: "1px dashed #E4DCC5",
        flexWrap: "wrap",
      }}
    >
      <div style={{ width: 118, fontSize: 12.5, color: "#1F2A22", flexShrink: 0 }}>
        {c.label}
        {hasBudget && spent === 0 && (
          <div style={{ fontSize: 10, color: "#8B5E34", marginTop: 2 }}>
            Unused {fmtMoney(budget)}
          </div>
        )}
      </div>
      <select
        className="ledger-select"
        style={{ width: 108, padding: "6px 8px", fontSize: 12 }}
        value={bucket}
        onChange={(e) => onBucketChange(c.id, e.target.value)}
        title="Needs, Wants, or Exclude from auto-budget"
      >
        {BUDGET_BUCKETS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <div
        style={{
          flex: 1,
          minWidth: 80,
          background: "#EDE6D6",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: hasBudget ? `${pct}%` : spent > 0 ? "100%" : "0%",
            background: fillColor,
            height: "100%",
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11.5,
          color: over ? "#A93B3B" : "#4A5A4E",
          width: 128,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {hasBudget
          ? `${fmtMoney(spent)} / ${fmtMoney(budget)}`
          : spent > 0
          ? fmtMoney(spent)
          : "—"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <input
          className="ledger-input"
          style={{ width: 82, padding: "6px 8px", fontSize: 12.5 }}
          type="number"
          min="0"
          step="1"
          placeholder={avgSpend > 0 ? String(Math.round(avgSpend)) : "0"}
          value={budgetValueFor(c.id)}
          onChange={(e) => updateBudgetDraft(c.id, e.target.value)}
          onBlur={() => commitBudget(c.id)}
        />
        {avgSpend > 0 && (
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 500,
              padding: "5px 8px",
              fontSize: 11,
            }}
            onClick={() => onUseAvg(c.id, avgSpend)}
            title={`Use 3-month avg ${fmtMoney(avgSpend)}`}
          >
            Avg
          </button>
        )}
      </div>
    </div>
  );
}

function GroupHeader({ title, hint }) {
  return (
    <div
      style={{
        padding: "10px 14px 6px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#74836A",
        background: "#F6F1E6",
        borderTop: "1px solid #E4DCC5",
      }}
    >
      {title}
      {hint && (
        <span
          style={{
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
            marginLeft: 8,
            color: "#A69C82",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export default function MonthlyBudgetSection({
  monthLabel,
  categories,
  catTotals,
  budgets,
  budgetValueFor,
  updateBudgetDraft,
  commitBudget,
  fmtMoney,
  zeroSpendRebalancePreview,
  onMoveUnusedBudgets,
  catMap,
  budgetSettings,
  onBudgetSettingsChange,
  onCategoryBucketChange,
  onApplyBudgets,
  avgSpendingByCategory,
  onUseCategoryAvg,
}) {
  const needs = categories.filter((c) => getCategoryBucket(c.id, budgetSettings) === "needs");
  const wants = categories.filter((c) => getCategoryBucket(c.id, budgetSettings) === "wants");
  const excluded = categories.filter((c) => getCategoryBucket(c.id, budgetSettings) === "skip");

  function renderGroup(title, hint, list) {
    if (!list.length) return null;
    return (
      <>
        <GroupHeader title={title} hint={hint} />
        {list.map((c) => {
          const spent = (catTotals.find((t) => t.id === c.id) || {}).total || 0;
          return (
            <CategoryRow
              key={c.id}
              c={c}
              spent={spent}
              budget={budgets[c.id] || 0}
              bucket={getCategoryBucket(c.id, budgetSettings)}
              avgSpend={avgSpendingByCategory?.[c.id] || 0}
              budgetValueFor={budgetValueFor}
              updateBudgetDraft={updateBudgetDraft}
              commitBudget={commitBudget}
              onBucketChange={onCategoryBucketChange}
              onUseAvg={onUseCategoryAvg}
              fmtMoney={fmtMoney}
            />
          );
        })}
      </>
    );
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
        Category limits &mdash; {monthLabel}
      </div>

      <div
        style={{
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          background: "#F6F1E6",
          padding: "14px 16px",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12.5, color: "#74836A", marginBottom: 12, lineHeight: 1.45 }}>
          Classify each category, then auto-fill limits from an <strong>income rule</strong> or your{" "}
          <strong>3-month average</strong> spending. Use <strong>Avg</strong> on any row to copy
          history into that limit.
        </div>
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
              style={{ minWidth: 150 }}
              value={budgetSettings.budgetMethod || "rule"}
              onChange={(e) => onBudgetSettingsChange({ budgetMethod: e.target.value })}
            >
              {BUDGET_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {budgetSettings.budgetMethod !== "avg-spend" && (
            <div>
              <label style={fieldLabel}>Income rule</label>
              <select
                className="ledger-select"
                style={{ minWidth: 180 }}
                value={budgetSettings.allocationModelId || "50-30-20"}
                onChange={(e) =>
                  onBudgetSettingsChange({ allocationModelId: e.target.value })
                }
              >
                {ALLOCATION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            className="ledger-btn"
            style={{ padding: "10px 16px" }}
            onClick={onApplyBudgets}
          >
            {budgetSettings.budgetMethod === "avg-spend"
              ? "Set from spending"
              : "Apply income rule"}
          </button>
        </div>
      </div>

      {zeroSpendRebalancePreview?.pool > 0 && (
        <div
          style={{
            border: "1px solid #D8CDB4",
            borderRadius: 8,
            background: "#FFFDF8",
            padding: "12px 16px",
            marginBottom: 12,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#4A5A4E", lineHeight: 1.45, flex: 1 }}>
            {zeroSpendRebalancePreview.donors
              .map((d) => `${catMap[d.id]?.label || d.id} (${fmtMoney(d.amount)})`)
              .join(", ")}{" "}
            {zeroSpendRebalancePreview.donors.length === 1 ? "has" : "have"} no spending — move{" "}
            {fmtMoney(zeroSpendRebalancePreview.pool)} to over-budget categories?
          </div>
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 500,
              padding: "8px 14px",
              whiteSpace: "nowrap",
            }}
            onClick={onMoveUnusedBudgets}
            disabled={!zeroSpendRebalancePreview.applied}
          >
            Move unused limits
          </button>
        </div>
      )}

      <div
        style={{
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          background: "#FFFDF8",
          overflow: "hidden",
        }}
      >
        {renderGroup("Needs", "essentials", needs)}
        {renderGroup("Wants", "discretionary", wants)}
        {renderGroup("Excluded", "manual limits only", excluded)}
      </div>
    </div>
  );
}
