import React from "react";
import { formatTooltipAmount } from "./cumulativeChart.js";

export default function ChartTooltip({ tooltip, style }) {
  if (!tooltip) return null;

  const categories = tooltip.categories || [];

  return (
    <div
      style={{
        minWidth: 210,
        maxWidth: 280,
        background: "#1F2A22",
        color: "#FFFDF8",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(31,42,34,0.18)",
        pointerEvents: "none",
        fontSize: 12,
        lineHeight: 1.45,
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{tooltip.title}</div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 600,
          color: "#E4DCC5",
          marginBottom: categories.length ? 8 : 0,
        }}
      >
        Total {formatTooltipAmount(tooltip.total)}
      </div>
      {categories.map((cat) => (
        <div
          key={cat.id}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: cat.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cat.label}
            </span>
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {cat.daily > 0 && (
              <span style={{ color: "#C08A28" }}>
                +{formatTooltipAmount(cat.daily)}{" "}
              </span>
            )}
            <span style={{ color: "#A69C82" }}>
              {formatTooltipAmount(cat.cumulative)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
