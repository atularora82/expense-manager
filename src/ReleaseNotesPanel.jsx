import React from "react";
import { APP_VERSION } from "./version.js";
import { RELEASE_HISTORY } from "./releases.js";

export default function ReleaseNotesPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 13.5, color: "var(--ledger-text)", lineHeight: 1.5 }}>
        You&apos;re running{" "}
        <strong style={{ fontWeight: 600 }}>v{APP_VERSION}</strong>. Release notes below
        match <code style={{ fontSize: 12 }}>CHANGELOG.md</code> in the project repo.
      </div>
      {RELEASE_HISTORY.map((release) => (
        <section key={release.version}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: "8px 12px",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--ledger-text)",
              }}
            >
              v{release.version}
            </span>
            {release.date && (
              <span style={{ fontSize: 12, color: "var(--ledger-muted)" }}>{release.date}</span>
            )}
            {release.version === APP_VERSION && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#2F6B4F",
                  background: "#E8F0EB",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                Current
              </span>
            )}
          </div>
          {release.summary && (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ledger-muted)" }}>
              {release.summary}
            </p>
          )}
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: "var(--ledger-text)",
              lineHeight: 1.55,
            }}
          >
            {release.changes.map((line) => (
              <li key={line} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
