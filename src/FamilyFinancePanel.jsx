import React, { useEffect, useMemo, useState } from "react";
import {
  FINANCE_RECORD_BUCKETS,
  FINANCE_RECORD_TYPES,
  HOUSEHOLD_VIEW_ID,
  financeRecordTypeMap,
  groupRecordsByBucket,
  memberLabel,
  summarizeBucketRecords,
  summarizeFamilyFinance,
} from "./familyFinance.js";
import FamilyFinanceBulkImport from "./FamilyFinanceBulkImport.jsx";

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

function CollapseHeader({ title, meta, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--ledger-fill)",
        border: "1px solid var(--ledger-border)",
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ledger-text)" }}>{title}</div>
        {meta && (
          <div style={{ fontSize: 12, color: "var(--ledger-muted)", marginTop: 2 }}>{meta}</div>
        )}
      </div>
      <span style={{ fontSize: 12, color: "var(--ledger-muted)", flexShrink: 0 }}>
        {open ? "Hide" : "Show"}
      </span>
    </button>
  );
}

function RecordRow({
  record,
  showMember,
  registry,
  onUpdateRecord,
  onRemoveRecord,
  showTopBorder = true,
}) {
  const typeInfo = financeRecordTypeMap[record.type] || financeRecordTypeMap.bank;
  const isLiability = typeInfo.side === "liability";
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderTop: showTopBorder ? "1px dashed var(--ledger-border-light)" : "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: typeInfo.color,
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ledger-text)" }}>
            {record.title}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--ledger-muted)" }}>{typeInfo.label}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ledger-muted)", marginTop: 2, lineHeight: 1.45 }}>
          {showMember && memberLabel(registry, record.memberId) && (
            <span>{memberLabel(registry, record.memberId)} · </span>
          )}
          {record.institution && <span>{record.institution}</span>}
          {record.asOfDate && (
            <span>
              {record.institution ? " · " : ""}
              As of {record.asOfDate}
            </span>
          )}
          {(record.identifier || record.maturityDate || record.notes) && (
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              style={{
                marginLeft: 6,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "#3C6E91",
                fontSize: 11.5,
              }}
            >
              {showDetail ? "Less" : "More"}
            </button>
          )}
        </div>
        {showDetail && (
          <div style={{ fontSize: 11.5, color: "var(--ledger-text-tertiary)", marginTop: 4 }}>
            {record.identifier && <div>Ref: {record.identifier}</div>}
            {record.maturityDate && <div>Matures: {record.maturityDate}</div>}
            {record.notes && <div>{record.notes}</div>}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
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
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 6,
            alignItems: "center",
          }}
        >
          <input
            className="ledger-input"
            type="number"
            step="1"
            placeholder="Update"
            title="Press Enter to save"
            style={{ width: 72, padding: "4px 6px", fontSize: 11 }}
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
              fontSize: 11,
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function BucketSection({ bucket, records, showMember, registry, open, onToggle, onUpdateRecord, onRemoveRecord }) {
  const stats = summarizeBucketRecords(records);
  const isLoans = bucket.id === "loans_credit";
  const headerTotal = isLoans ? stats.liabilities : stats.assets;

  const meta =
    stats.count === 0
      ? "No records"
      : `${stats.count} · ${isLoans ? "Owed" : "Total"} ${fmtMoney(headerTotal)}`;

  return (
    <div style={{ marginBottom: 10 }}>
      <CollapseHeader title={bucket.label} meta={meta} open={open} onToggle={onToggle} />
      {open && (
        <div
          style={{
            border: "1px solid var(--ledger-border)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            padding: "4px 12px 10px",
            background: "var(--ledger-surface)",
          }}
        >
          {records.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ledger-muted)", padding: "8px 0" }}>
              Nothing in this group yet.
            </div>
          ) : (
            records.map((record, i) => (
              <RecordRow
                key={record.id}
                record={record}
                showMember={showMember}
                registry={registry}
                onUpdateRecord={onUpdateRecord}
                onRemoveRecord={onRemoveRecord}
                showTopBorder={i > 0}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MemberHoldingsView({
  memberId,
  registry,
  records,
  showMemberInRows,
  onUpdateRecord,
  onRemoveRecord,
}) {
  const grouped = useMemo(() => groupRecordsByBucket(records), [records]);
  const [openBuckets, setOpenBuckets] = useState(() =>
    Object.fromEntries(FINANCE_RECORD_BUCKETS.map((b) => [b.id, true]))
  );

  return (
    <div>
      {FINANCE_RECORD_BUCKETS.map((bucket) => (
        <BucketSection
          key={`${memberId}-${bucket.id}`}
          bucket={bucket}
          records={grouped[bucket.id]}
          showMember={showMemberInRows}
          registry={registry}
          open={openBuckets[bucket.id]}
          onToggle={() => setOpenBuckets((prev) => ({ ...prev, [bucket.id]: !prev[bucket.id] }))}
          onUpdateRecord={onUpdateRecord}
          onRemoveRecord={onRemoveRecord}
        />
      ))}
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
  onBulkImportRegistry,
}) {
  const [memberName, setMemberName] = useState("");
  const [viewMemberId, setViewMemberId] = useState(null);

  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [formMemberId, setFormMemberId] = useState("");

  const [type, setType] = useState("bank");
  const [title, setTitle] = useState("");
  const [institution, setInstitution] = useState("");
  const [value, setValue] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (registry.members.length === 0) {
      setViewMemberId(null);
      return;
    }
    const stillValid =
      viewMemberId &&
      (viewMemberId === HOUSEHOLD_VIEW_ID ||
        registry.members.some((m) => m.id === viewMemberId));
    if (!stillValid) {
      setViewMemberId(registry.members[0].id);
    }
  }, [registry.members, viewMemberId]);

  const isHouseholdView = viewMemberId === HOUSEHOLD_VIEW_ID;
  const activeMemberId = isHouseholdView ? null : viewMemberId;

  useEffect(() => {
    if (registry.members.length === 0) {
      setShowManageMembers(true);
      return;
    }
    if (activeMemberId) {
      setFormMemberId(activeMemberId);
    } else if (!registry.members.some((m) => m.id === formMemberId)) {
      setFormMemberId(registry.members[0].id);
    }
  }, [registry.members, activeMemberId, formMemberId]);

  const summary = useMemo(
    () => summarizeFamilyFinance(registry, activeMemberId ? { memberId: activeMemberId } : {}),
    [registry, activeMemberId]
  );

  const activeMemberRecords = useMemo(() => {
    if (!activeMemberId) return [];
    return registry.records.filter((r) => r.memberId === activeMemberId);
  }, [registry.records, activeMemberId]);

  const householdByMember = useMemo(() => {
    return registry.members.map((member) => ({
      member,
      records: registry.records.filter((r) => r.memberId === member.id),
      summary: summarizeFamilyFinance(registry, { memberId: member.id }),
    }));
  }, [registry]);

  const addTargetMemberId = formMemberId || activeMemberId || registry.members[0]?.id || "";

  function handleAddMember(e) {
    e.preventDefault();
    const ok = onAddMember(memberName);
    if (ok) setMemberName("");
  }

  function handleAddRecord(e) {
    e.preventDefault();
    const ok = onAddRecord({
      memberId: addTargetMemberId,
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
      setShowAddForm(false);
    }
  }

  const viewLabel = isHouseholdView
    ? "Household"
    : memberLabel(registry, activeMemberId) || "Member";

  return (
    <div>
      <div style={{ fontSize: 13.5, color: "var(--ledger-muted)", lineHeight: 1.55, marginBottom: 18 }}>
        Pick a family member to see grouped holdings. Use <strong>Household</strong> for a rolled-up
        view. Amounts are snapshots — update when you reconcile.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryCard label="Total assets" amount={summary.assets} tone="#2F6B4F" />
        <SummaryCard label="Total liabilities" amount={summary.liabilities} tone="#A93B3B" />
        <SummaryCard
          label="Net worth"
          amount={summary.netWorth}
          tone={summary.netWorth >= 0 ? "#3C6E91" : "#A93B3B"}
        />
      </div>
      <div style={{ fontSize: 12, color: "var(--ledger-muted)", marginBottom: 16 }}>
        Viewing: <strong style={{ color: "var(--ledger-text)" }}>{viewLabel}</strong>
        {!isHouseholdView && summary.recordCount > 0 && (
          <span> · {summary.recordCount} record{summary.recordCount === 1 ? "" : "s"}</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: 18,
          alignItems: "center",
        }}
      >
        {registry.members.map((member) => (
          <button
            key={member.id}
            type="button"
            className={`seg-btn ledger-tab-btn${viewMemberId === member.id ? " active" : ""}`}
            onClick={() => setViewMemberId(member.id)}
          >
            {member.name}
          </button>
        ))}
        {registry.members.length > 0 && (
          <button
            type="button"
            className={`seg-btn ledger-tab-btn${isHouseholdView ? " active" : ""}`}
            onClick={() => setViewMemberId(HOUSEHOLD_VIEW_ID)}
          >
            Household
          </button>
        )}
        {registry.members.length > 0 && (
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 500,
              padding: "8px 12px",
              marginLeft: 4,
            }}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "Close add form" : "+ Add holding"}
          </button>
        )}
      </div>

      {registry.members.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--ledger-border)",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--ledger-muted)", marginBottom: 12 }}>
            Add at least one family member to start recording assets and loans.
          </div>
        </div>
      ) : isHouseholdView ? (
        <div style={{ marginBottom: 20 }}>
          {householdByMember.map(({ member, records, summary: memberSummary }) => {
            if (records.length === 0) return null;
            return (
              <HouseholdMemberBlock
                key={member.id}
                member={member}
                memberSummary={memberSummary}
                registry={registry}
                records={records}
                onUpdateRecord={onUpdateRecord}
                onRemoveRecord={onRemoveRecord}
              />
            );
          })}
          {registry.records.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--ledger-muted)" }}>
              No holdings yet. Choose a member and use <strong>Add holding</strong>.
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {activeMemberRecords.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ledger-muted)", marginBottom: 12 }}>
              No records for {viewLabel} yet. Use <strong>Add holding</strong> above.
            </div>
          ) : (
            <MemberHoldingsView
              memberId={activeMemberId}
              registry={registry}
              records={activeMemberRecords}
              showMemberInRows={false}
              onUpdateRecord={onUpdateRecord}
              onRemoveRecord={onRemoveRecord}
            />
          )}
        </div>
      )}

      {showAddForm && registry.members.length > 0 && (
        <div
          style={{
            border: "1px solid var(--ledger-border)",
            borderRadius: 8,
            padding: "14px 16px 16px",
            marginBottom: 20,
            background: "var(--ledger-surface)",
          }}
        >
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ledger-text)",
              marginBottom: 12,
            }}
          >
            Add holding
          </div>
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
              {registry.members.length > 1 && (
                <div>
                  <label style={labelStyle}>Member</label>
                  <select
                    className="ledger-select"
                    value={addTargetMemberId}
                    onChange={(e) => setFormMemberId(e.target.value)}
                  >
                    {registry.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
            <button type="submit" className="ledger-btn" style={{ marginTop: 12, padding: "10px 16px" }}>
              Save record
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <CollapseHeader
          title="Bulk upload"
          meta="Import or export family holdings from CSV / Excel"
          open={showBulkUpload}
          onToggle={() => setShowBulkUpload((v) => !v)}
        />
        {showBulkUpload && (
          <div
            style={{
              border: "1px solid var(--ledger-border)",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              padding: "14px 16px",
              marginBottom: 8,
            }}
          >
            <FamilyFinanceBulkImport
              registry={registry}
              onImportComplete={(nextRegistry, stats) => {
                onBulkImportRegistry(nextRegistry, stats);
              }}
            />
          </div>
        )}
      </div>

      <div className="family-members-collapse">
        <CollapseHeader
          title="Family members"
          meta={
            registry.members.length > 0
              ? `${registry.members.length} member${registry.members.length === 1 ? "" : "s"}`
              : "Add household members"
          }
          open={showManageMembers}
          onToggle={() => setShowManageMembers((v) => !v)}
        />
        {showManageMembers && (
          <div
            style={{
              border: "1px solid var(--ledger-border)",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              padding: "12px 14px",
              marginBottom: 8,
            }}
          >
            {registry.members.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {registry.members.map((member) => (
                  <div key={member.id} className="member-chip">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 4,
                        border: "1px solid var(--ledger-border)",
                        fontSize: 13,
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
        )}
      </div>
    </div>
  );
}

function HouseholdMemberBlock({
  member,
  memberSummary,
  registry,
  records,
  onUpdateRecord,
  onRemoveRecord,
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 14 }}>
      <CollapseHeader
        title={member.name}
        meta={`Net ${fmtMoney(memberSummary.netWorth)} · ${memberSummary.recordCount} record${
          memberSummary.recordCount === 1 ? "" : "s"
        }`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div style={{ padding: "10px 0 4px" }}>
          <MemberHoldingsView
            memberId={member.id}
            registry={registry}
            records={records}
            showMemberInRows={false}
            onUpdateRecord={onUpdateRecord}
            onRemoveRecord={onRemoveRecord}
          />
        </div>
      )}
    </div>
  );
}