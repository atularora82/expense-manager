import React, { useEffect, useState } from "react";
import {
  initialSplitLines,
  linesFromSplitSiblings,
  splitGroupTotal,
  splitRemaining,
  validateSplitLines,
} from "./splitTransaction.js";

const fieldLabel = {
  fontSize: 11,
  fontWeight: 600,
  color: "#74836A",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 5,
};

export default function SplitTransactionModal({
  entry,
  siblings,
  categories,
  fmtMoney,
  fmtDateFull,
  onApply,
  onUnsplit,
  onClose,
}) {
  const isExistingSplit = siblings.length > 1;
  const totalAmount = isExistingSplit ? splitGroupTotal(siblings) : entry.amount;

  const [lines, setLines] = useState(() =>
    isExistingSplit ? linesFromSplitSiblings(siblings) : initialSplitLines(entry, categories)
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setLines(
      isExistingSplit ? linesFromSplitSiblings(siblings) : initialSplitLines(entry, categories)
    );
    setError("");
  }, [entry, siblings, categories, isExistingSplit]);

  const remaining = splitRemaining(totalAmount, lines);

  function updateLine(index, patch) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setError("");
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        amount: remaining > 0 ? remaining : "",
        category: entry.category,
        splitNote: "",
      },
    ]);
  }

  function removeLine(index) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
    setError("");
  }

  function handleApply() {
    const result = validateSplitLines(lines, totalAmount);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(lines);
  }

  return (
    <div className="ledger-modal-backdrop" onClick={onClose}>
      <div
        className="ledger-modal"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Split transaction
        </div>
        <div style={{ fontSize: 13, color: "#74836A", marginBottom: 16, lineHeight: 1.5 }}>
          Divide <strong>{fmtMoney(totalAmount)}</strong> across categories. Useful for mixed
          grocery trips (food vs household supplies).
        </div>

        <div
          style={{
            border: "1px solid #D8CDB4",
            borderRadius: 6,
            background: "#F6F1E6",
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, color: "#1F2A22" }}>
            {entry.description.includes(" — ")
              ? entry.description.split(" — ")[0]
              : entry.description}
          </div>
          <div style={{ color: "#74836A", marginTop: 4 }}>
            {fmtDateFull(entry.date)} · {fmtMoney(totalAmount)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {lines.map((line, index) => (
            <div
              key={line.existingId || `line-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px minmax(0, 1.2fr) auto",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div>
                <label style={fieldLabel}>Category</label>
                <select
                  className="ledger-select"
                  value={line.category}
                  onChange={(e) => updateLine(index, { category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Amount</label>
                <input
                  className="ledger-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                />
              </div>
              <div>
                <label style={fieldLabel}>Note (optional)</label>
                <input
                  className="ledger-input"
                  type="text"
                  placeholder="e.g. Food, Household"
                  value={line.splitNote || ""}
                  onChange={(e) => updateLine(index, { splitNote: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{
                  padding: "9px 10px",
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 500,
                  color: lines.length <= 2 ? "#C8BDA8" : "#A93B3B",
                }}
                onClick={() => removeLine(index)}
                disabled={lines.length <= 2}
                title={lines.length <= 2 ? "At least 2 lines required" : "Remove line"}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 500,
              padding: "7px 12px",
            }}
            onClick={addLine}
          >
            + Add line
          </button>
          <div
            style={{
              fontSize: 13,
              fontFamily: "'IBM Plex Mono', monospace",
              color:
                Math.abs(remaining) <= 0.01
                  ? "#2F6B4F"
                  : remaining > 0
                  ? "#C08A28"
                  : "#A93B3B",
            }}
          >
            {Math.abs(remaining) <= 0.01
              ? "Balanced"
              : remaining > 0
              ? `${fmtMoney(remaining)} remaining`
              : `${fmtMoney(Math.abs(remaining))} over`}
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#A93B3B",
              background: "#FBF0F0",
              border: "1px solid #E8B4B4",
              borderRadius: 4,
              padding: "10px 12px",
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {isExistingSplit && onUnsplit && (
            <button
              type="button"
              className="ledger-btn ledger-btn-ghost"
              style={{
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
                marginRight: "auto",
                color: "#8B5E34",
              }}
              onClick={onUnsplit}
            >
              Merge back
            </button>
          )}
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="button" className="ledger-btn" onClick={handleApply}>
            Apply split
          </button>
        </div>
      </div>
    </div>
  );
}
