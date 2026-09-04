import React, { useState } from "react";
import { goalProgressPercent, goalRemaining, daysUntil } from "./savingsGoals.js";

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    "\u20B9" +
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function SavingsGoalsPanel({ goals, onAdd, onUpdate, onRemove }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    const ok = onAdd({ name, targetAmount: target, targetDate: deadline || null });
    if (ok) {
      setName("");
      setTarget("");
      setDeadline("");
    }
  }

  return (
    <div>
      {goals.length === 0 ? (
        <div style={{ fontSize: 13, color: "#74836A", marginBottom: 14 }}>
          Set a savings target — emergency fund, vacation, or a big purchase.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {goals.map((goal) => {
            const pct = goalProgressPercent(goal);
            const remaining = goalRemaining(goal);
            const days = daysUntil(goal.targetDate);
            return (
              <div
                key={goal.id}
                style={{
                  border: "1px solid #D8CDB4",
                  borderRadius: 6,
                  padding: "12px 14px",
                  background: "#FFFDF8",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1F2A22" }}>
                      {goal.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#74836A", marginTop: 2 }}>
                      {fmtMoney(goal.currentAmount)} of {fmtMoney(goal.targetAmount)}
                      {goal.targetDate && days != null && (
                        <span>
                          {" "}
                          &middot; {days > 0 ? `${days} days left` : days === 0 ? "Due today" : "Past due"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(goal.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#A93B3B",
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div
                  style={{
                    background: "#EDE6D6",
                    height: 8,
                    borderRadius: 4,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? "#2F6B4F" : "#3C6E91",
                      height: "100%",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#74836A" }}>
                    {pct}% &middot; {fmtMoney(remaining)} to go
                  </span>
                  <input
                    className="ledger-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Update saved"
                    style={{ width: 120, padding: "5px 8px", fontSize: 12 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          onUpdate(goal.id, { currentAmount: val });
                          e.target.value = "";
                        }
                      }
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#A69C82" }}>Enter to save</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 130px auto",
            gap: 8,
            alignItems: "end",
          }}
          className="goals-form-grid"
        >
          <div>
            <label style={labelStyle}>Goal name</label>
            <input
              className="ledger-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emergency fund"
            />
          </div>
          <div>
            <label style={labelStyle}>Target</label>
            <input
              className="ledger-input"
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input
              className="ledger-input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <button type="submit" className="ledger-btn" style={{ padding: "10px 14px" }}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "#74836A",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 5,
};
