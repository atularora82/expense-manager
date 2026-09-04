import React, { useState } from "react";
import { ACCOUNT_TYPES, accountTypeMap } from "./accounts.js";

export default function AccountsPanel({ accounts, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");

  function handleAdd(e) {
    e.preventDefault();
    const ok = onAdd(name, type);
    if (ok) {
      setName("");
      setType("bank");
    }
  }

  return (
    <div>
      {accounts.length === 0 ? (
        <div style={{ fontSize: 13, color: "#74836A", marginBottom: 14 }}>
          Add bank accounts, credit cards, or wallets to tag imports and entries.
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {accounts.map((account, i) => {
            const typeInfo = accountTypeMap[account.type] || accountTypeMap.bank;
            return (
              <div
                key={account.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: typeInfo.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#1F2A22" }}>{account.name}</div>
                  <div style={{ fontSize: 12, color: "#74836A" }}>{typeInfo.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(account.id)}
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
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px auto",
            gap: 8,
            alignItems: "end",
          }}
          className="accounts-form-grid"
        >
          <div>
            <label style={labelStyle}>Account name</label>
            <input
              className="ledger-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HDFC Savings"
            />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select
              className="ledger-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
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
