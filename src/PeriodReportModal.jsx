import React from "react";
import { formatReportPct } from "./periodReport.js";

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

export default function PeriodReportModal({ report, onClose, onPrint }) {
  if (!report) return null;

  return (
    <div className="ledger-modal-backdrop" onClick={onClose}>
      <div
        className="ledger-modal period-report-modal"
        style={{ maxWidth: 640, width: "95vw", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="period-report-print">
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 22,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Period report
          </div>
          <div style={{ fontSize: 13, color: "#74836A", marginBottom: 20 }}>
            {report.periodLabel} &middot; Generated{" "}
            {new Date(report.generatedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {[
              { label: "Income", value: report.income, color: "#2F6B4F" },
              { label: "Expenses", value: report.expense, color: "#A93B3B" },
              { label: "Investments", value: report.investment, color: "#4A5A91" },
              { label: "Net", value: report.net, color: report.net >= 0 ? "#2F6B4F" : "#A93B3B" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: "1px solid #E4DCC5",
                  borderRadius: 6,
                  padding: "10px 12px",
                  background: "#FFFDF8",
                }}
              >
                <div style={{ fontSize: 11, color: "#74836A", fontWeight: 600, textTransform: "uppercase" }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 16,
                    fontWeight: 600,
                    color: item.color,
                    marginTop: 4,
                  }}
                >
                  {fmtMoney(item.value)}
                </div>
              </div>
            ))}
          </div>

          {report.savingsRate != null && (
            <div style={{ fontSize: 13, color: "#4A5A4E", marginBottom: 20 }}>
              Savings rate: <strong>{formatReportPct(report.savingsRate)}</strong> of income
              &middot; {report.entryCount} transaction{report.entryCount === 1 ? "" : "s"}
            </div>
          )}

          {report.expenseByCategory.length > 0 && (
            <Section title="Expenses by category">
              {report.expenseByCategory.map((c) => (
                <Row key={c.id} label={c.label} value={fmtMoney(c.total)} />
              ))}
            </Section>
          )}

          {report.incomeByCategory.length > 0 && (
            <Section title="Income by category">
              {report.incomeByCategory.map((c) => (
                <Row key={c.id} label={c.label} value={fmtMoney(c.total)} />
              ))}
            </Section>
          )}

          {report.budgetSummary.length > 0 && (
            <Section title="Budget vs actual">
              {report.budgetSummary.map((b) => (
                <Row
                  key={b.id}
                  label={b.label}
                  value={
                    b.limit > 0
                      ? `${fmtMoney(b.spent)} / ${fmtMoney(b.limit)} (${b.pct}%)`
                      : fmtMoney(b.spent)
                  }
                  accent={b.over ? "#A93B3B" : undefined}
                />
              ))}
            </Section>
          )}

          {report.topExpenses.length > 0 && (
            <Section title="Largest expenses">
              {report.topExpenses.map((e, i) => (
                <Row
                  key={`${e.date}-${i}`}
                  label={`${e.date} — ${e.description}`}
                  sub={e.category}
                  value={fmtMoney(e.amount)}
                />
              ))}
            </Section>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }} className="period-report-actions">
          <button type="button" className="ledger-btn" onClick={onPrint}>
            Print / Save PDF
          </button>
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#74836A",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ border: "1px solid #E4DCC5", borderRadius: 6, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, sub, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "9px 12px",
        borderTop: "1px dashed #E4DCC5",
        fontSize: 12.5,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: accent || "#1F2A22" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#74836A", marginTop: 2 }}>{sub}</div>}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 600,
          color: accent || "#1F2A22",
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}
