import React, { useMemo, useState } from "react";
import {
  FINANCE_RECORD_TYPES,
  financeRecordTypeMap,
  memberLabel,
  summarizeFamilyFinance,
} from "./familyFinance.js";

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

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ledger-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 5,
};

function SummaryCard({ label, amount, tone }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        border: "1px solid var(--ledger-border)",
        borderRadius: 6,
        padding: "12px 14px",
        background: "var(--ledger-surface)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ledger-muted)", marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 17,
          fontWeight: 600,
          color: tone,
        }}
      >
        {fmtMoney(amount)}
      </div>
    </div>
  );
}

export default function FamilyFinancePanel({
  registry,
  onAddMember,
  onRemoveMember,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) {
  const [memberName, setMemberName] = useState("");
  const [filterMember, setFilterMember] = useState("all");

  const [type, setType] = useState("bank");
  const [recordMemberId, setRecordMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [institution, setInstitution] = useState("");
  const [value, setValue] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [notes, setNotes] = useState("");

  const summary = useMemo(
    () =>
      summarizeFamilyFinance(
        registry,
        filterMember === "all" ? {} : { memberId: filterMember }
      ),
    [registry, filterMember]
  );

  const visibleRecords = useMemo(() => {
    const list = registry.records.slice();
    list.sort((a, b) => {
      const ma = memberLabel(registry, a.memberId) || "";
      const mb = memberLabel(registry, b.memberId) || "";
      if (ma !== mb) return ma.localeCompare(mb);
      return a.title.localeCompare(b.title);
    });
    if (filterMember === "all") return list;
    return list.filter((r) => r.memberId === filterMember);
  }, [registry, filterMember]);

  const defaultMemberId = registry.members[0]?.id || "";

  function handleAddMember(e) {
    e.preventDefault();
    const ok = onAddMember(memberName);
    if (ok) setMemberName("");
  }

  function handleAddRecord(e) {
    e.preventDefault();
    const memberId = recordMemberId || defaultMemberId;
    const ok = onAddRecord({
      memberId,
      type,
      title,
      institution,
      value,
      identifier,
      maturityDate: maturityDate || null,
      notes,
    });
    if (ok) {
      setTitle("");
      setInstitution("");
      setValue("");
      setIdentifier("");
      setMaturityDate("");
      setNotes("");
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, color: "var(--ledger-muted)", lineHeight: 1.55, marginBottom: 18 }}>
        Register bank accounts, FDs, investments, insurance, and loans for each family member.
        Amounts are snapshots — update them whenever you reconcile. Totals here are separate from
        day-to-day ledger entries.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        <SummaryCard label="Total assets" amount={summary.assets} tone="#2F6B4F" />
        <SummaryCard label="Total liabilities" amount={summary.liabilities} tone="#A93B3B" />
        <SummaryCard
          label="Net worth"
          amount={summary.netWorth}
          tone={summary.netWorth >= 0 ? "#3C6E91" : "#A93B3B"}
        />
      </div>

      <div
        style={{
          border: "1px solid var(--ledger-border)",
          borderRadius: 6,
          padding: "12px 14px",
          marginBottom: 20,
          background: "var(--ledger-surface)",
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ledger-text)",
            marginBottom: 10,
          }}
        >
          Family members
        </div>
        {registry.members.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ledger-muted)", marginBottom: 12 }}>
            Add yourself and other household members before recording holdings.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {registry.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--ledger-border)",
                  fontSize: 13,
                  color: "var(--ledger-text)",
                }}
              >
                {member.name}
                <button
                  type="button"
                  onClick={() => onRemoveMember(member.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#A93B3B",
                    fontSize: 11,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleAddMember}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Member name</label>
              <input
                className="ledger-input"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Self, Spouse, Child…"
              />
            </div>
            <button type="submit" className="ledger-btn" style={{ padding: "10px 14px" }}>
              Add member
            </button>
          </div>
        </form>
      </div>

      {registry.members.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ledger-text)",
              }}
            >
              Holdings & liabilities
            </div>
            <select
              className="ledger-select"
              style={{ width: "auto", minWidth: 160 }}
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
            >
              <option value="all">All members</option>
              {registry.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {visibleRecords.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ledger-muted)", marginBottom: 16 }}>
              No records yet for this view. Add a bank account, FD, policy, or loan below.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {visibleRecords.map((record) => {
                const typeInfo = financeRecordTypeMap[record.type] || financeRecordTypeMap.bank;
                const isLiability = typeInfo.side === "liability";
                return (
                  <div
                    key={record.id}
                    style={{
                      border: "1px solid var(--ledger-border)",
                      borderRadius: 6,
                      padding: "12px 14px",
                      background: "var(--ledger-surface)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: typeInfo.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ledger-text)" }}>
                            {record.title}
                          </span>
                          <span
                            className="cat-stamp"
                            style={{ color: typeInfo.color, borderColor: typeInfo.color }}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ledger-muted)", marginTop: 6, lineHeight: 1.5 }}>
                          <span>{memberLabel(registry, record.memberId)}</span>
                          {record.institution && <span> · {record.institution}</span>}
                          {record.identifier && <span> · Ref {record.identifier}</span>}
                          {record.maturityDate && <span> · Matures {record.maturityDate}</span>}
                          {record.asOfDate && <span> · As of {record.asOfDate}</span>}
                        </div>
                        {record.notes && (
                          <div style={{ fontSize: 12, color: "var(--ledger-text-tertiary)", marginTop: 4 }}>
                            {record.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 15,
                            fontWeight: 600,
                            color: isLiability ? "#A93B3B" : "#2F6B4F",
                          }}
                        >
                          {isLiability ? "-" : ""}
                          {fmtMoney(Math.abs(record.value))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            justifyContent: "flex-end",
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            className="ledger-input"
                            type="number"
                            step="1"
                            placeholder="Update value"
                            style={{ width: 120, padding: "5px 8px", fontSize: 12 }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  onUpdateRecord(record.id, {
                                    value: val,
                                    asOfDate: new Date().toISOString().slice(0, 10),
                                  });
                                  e.target.value = "";
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveRecord(record.id)}
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleAddRecord}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 1fr 120px",
                gap: 8,
                alignItems: "end",
              }}
              className="family-finance-form-grid"
            >
              <div>
                <label style={labelStyle}>Type</label>
                <select
                  className="ledger-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <optgroup label="Assets">
                    {FINANCE_RECORD_TYPES.filter((t) => t.side === "asset").map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Liabilities">
                    {FINANCE_RECORD_TYPES.filter((t) => t.side === "liability").map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Member</label>
                <select
                  className="ledger-select"
                  value={recordMemberId || defaultMemberId}
                  onChange={(e) => setRecordMemberId(e.target.value)}
                >
                  {registry.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Name / description</label>
                <input
                  className="ledger-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="HDFC Savings, LIC Jeevan…"
                />
              </div>
              <div>
                <label style={labelStyle}>Current value</label>
                <input
                  className="ledger-input"
                  type="number"
                  step="1"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Bank / provider</label>
                <input
                  className="ledger-input"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label style={labelStyle}>Account / policy ref</label>
                <input
                  className="ledger-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Last 4 digits, folio…"
                />
              </div>
              <div>
                <label style={labelStyle}>Maturity (assets)</label>
                <input
                  className="ledger-input"
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Notes</label>
                <input
                  className="ledger-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <button
              type="submit"
              className="ledger-btn"
              style={{ marginTop: 12, padding: "10px 16px" }}
            >
              Add record
            </button>
          </form>
        </>
      )}
    </div>
  );
}