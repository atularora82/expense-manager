import React, { useRef, useState } from "react";
import { financeRecordTypeMap } from "./familyFinance.js";
import {
  applyFamilyFinanceImport,
  downloadFamilyFinanceExport,
  downloadFamilyFinanceTemplate,
  financeTypeOptionsForHelp,
  parseFamilyFinanceFile,
} from "./familyFinanceImport.js";

function fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return (
    "\u20B9" +
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function FamilyFinanceBulkImport({ registry, onImportComplete }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [createMembers, setCreateMembers] = useState(true);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setNote("");
    setBusy(true);
    try {
      const { rows, fileErrors } = await parseFamilyFinanceFile(file, registry);
      if (fileErrors.length > 0 && rows.length === 0) {
        setPreview(null);
        setNote(fileErrors.join(" "));
        return;
      }
      setPreview({
        fileName: file.name,
        rows,
        fileErrors,
      });
    } catch (err) {
      setPreview(null);
      setNote(err?.message || "Could not read file.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(previewId) {
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) =>
          row.previewId === previewId ? { ...row, included: !row.included } : row
        ),
      };
    });
  }

  function handleImport() {
    if (!preview) return;
    const { registry: nextRegistry, stats } = applyFamilyFinanceImport(
      registry,
      preview.rows,
      { createMembers }
    );
    onImportComplete(nextRegistry, stats);
    setPreview(null);
    const parts = [];
    if (stats.added) parts.push(`${stats.added} added`);
    if (stats.updated) parts.push(`${stats.updated} updated`);
    if (stats.membersCreated) parts.push(`${stats.membersCreated} new member(s)`);
    if (stats.skipped) parts.push(`${stats.skipped} skipped`);
    setNote(parts.length ? `Import done: ${parts.join(", ")}.` : "Nothing imported.");
  }

  const includedCount = preview?.rows.filter((r) => r.included && r.valid).length ?? 0;
  const invalidCount = preview?.rows.filter((r) => r.included && !r.valid).length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13, color: "var(--ledger-muted)", lineHeight: 1.55 }}>
        Upload a CSV or Excel file with columns: <strong>Member</strong>, <strong>Type</strong>,{" "}
        <strong>Title</strong>, <strong>Value</strong>, plus optional Institution, Identifier,
        Maturity, As Of, Notes. Matching member + type + title updates the existing row.
      </div>

      <div style={{ fontSize: 11.5, color: "var(--ledger-text-tertiary)", lineHeight: 1.5 }}>
        Type values: {financeTypeOptionsForHelp()}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="ledger-btn ledger-btn-ghost"
          style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
          onClick={downloadFamilyFinanceTemplate}
        >
          Download template
        </button>
        {registry.records.length > 0 && (
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={() => downloadFamilyFinanceExport(registry)}
          >
            Export current CSV
          </button>
        )}
        <button
          type="button"
          className="ledger-btn"
          style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 600 }}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Reading…" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--ledger-text)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={createMembers}
          onChange={(e) => setCreateMembers(e.target.checked)}
        />
        Create members from file if not found
      </label>

      {note && (
        <div style={{ fontSize: 12.5, color: "#3C6E91" }}>{note}</div>
      )}

      {preview?.fileErrors?.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#A93B3B" }}>{preview.fileErrors.join(" ")}</div>
      )}

      {preview && preview.rows.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ledger-muted)",
              marginBottom: 8,
            }}
          >
            {preview.fileName} — {includedCount} row{includedCount === 1 ? "" : "s"} ready
            {invalidCount > 0 && ` · ${invalidCount} invalid (excluded)`}
          </div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Import</th>
                  <th>Row</th>
                  <th>Action</th>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const typeInfo = row.type ? financeRecordTypeMap[row.type] : null;
                  const invalid = !row.valid;
                  return (
                    <tr
                      key={row.previewId}
                      className={
                        !row.included
                          ? "row-excluded"
                          : invalid
                            ? "row-invalid"
                            : undefined
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={() => toggleRow(row.previewId)}
                        />
                      </td>
                      <td>{row.sourceRow}</td>
                      <td>{row.action === "update" ? "Update" : "Add"}</td>
                      <td>
                        {row.memberName}
                        {!row.memberExists && (
                          <span style={{ color: "#3C6E91" }}> (new)</span>
                        )}
                      </td>
                      <td>{typeInfo?.label || row.typeLabel || "—"}</td>
                      <td>{row.title || "—"}</td>
                      <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmtMoney(row.value)}
                      </td>
                      <td style={{ fontSize: 11.5 }}>
                        {invalid ? row.errors.join("; ") : "OK"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="ledger-btn"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 600 }}
            disabled={includedCount === 0}
            onClick={handleImport}
          >
            Import {includedCount} record{includedCount === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 500,
              marginLeft: 8,
            }}
            onClick={() => setPreview(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}