import React, { useEffect, useRef, useState } from "react";

export default function LedgerPeriodBar({
  periodMode,
  switchPeriodMode,
  year,
  setYear,
  month,
  setMonth,
  weekAnchor,
  setWeekAnchor,
  weekRange,
  years,
  months,
  monthNameOnly,
  weekLabel,
  todayStr,
  toISODate,
  setPeriodDrillDay,
  setFilterCat,
  onExportCSV,
  onPeriodReport,
  onBackup,
  onRestore,
  exportDisabled,
  reportDisabled,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function clearDrill() {
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  return (
    <div className="ledger-sticky-bar">
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex" }}>
            <button
              type="button"
              className={`seg-btn ${periodMode === "year" ? "active" : ""}`}
              style={{ borderRadius: "4px 0 0 4px" }}
              onClick={() => switchPeriodMode("year")}
            >
              Year
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "month" ? "active" : ""}`}
              style={{ borderRadius: 0, borderLeft: "none" }}
              onClick={() => switchPeriodMode("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "week" ? "active" : ""}`}
              style={{ borderRadius: "0 4px 4px 0", borderLeft: "none" }}
              onClick={() => switchPeriodMode("week")}
            >
              Week
            </button>
          </div>

          {periodMode === "year" ? (
            <select
              className="ledger-select"
              style={{ width: "auto", minWidth: 100 }}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                clearDrill();
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : periodMode === "month" ? (
            <>
              <select
                className="ledger-select"
                style={{ width: "auto", minWidth: 100 }}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  clearDrill();
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="ledger-select"
                style={{ width: "auto", minWidth: 140 }}
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  clearDrill();
                }}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthNameOnly(m)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{ padding: "9px 12px" }}
                onClick={() => {
                  const d = new Date(weekAnchor + "T00:00:00");
                  d.setDate(d.getDate() - 7);
                  setWeekAnchor(toISODate(d));
                  clearDrill();
                }}
              >
                &larr;
              </button>
              <div
                style={{
                  fontSize: 13.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: "#1F2A22",
                  minWidth: 150,
                  textAlign: "center",
                }}
              >
                {weekLabel(weekRange)}
              </div>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{ padding: "9px 12px" }}
                onClick={() => {
                  const d = new Date(weekAnchor + "T00:00:00");
                  d.setDate(d.getDate() + 7);
                  setWeekAnchor(toISODate(d));
                  clearDrill();
                }}
              >
                &rarr;
              </button>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                onClick={() => {
                  setWeekAnchor(todayStr());
                  clearDrill();
                }}
              >
                This week
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {children}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="ledger-btn ledger-btn-ghost"
              style={{
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
                padding: "9px 14px",
              }}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              Actions ▾
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  minWidth: 180,
                  background: "#FFFDF8",
                  border: "1px solid #D8CDB4",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(31,42,34,0.12)",
                  zIndex: 60,
                  overflow: "hidden",
                }}
              >
                {[
                  {
                    label: "Export CSV",
                    onClick: onExportCSV,
                    disabled: exportDisabled,
                  },
                  {
                    label: "Period report",
                    onClick: onPeriodReport,
                    disabled: reportDisabled,
                  },
                  { label: "Backup data", onClick: onBackup },
                  { label: "Restore backup", onClick: onRestore },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      if (!item.disabled) item.onClick();
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: "1px solid #EDE6D6",
                      background: "none",
                      textAlign: "left",
                      fontSize: 13,
                      color: item.disabled ? "#A69C82" : "#1F2A22",
                      cursor: item.disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
