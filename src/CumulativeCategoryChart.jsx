import React, { useState, useCallback } from "react";
import { formatChartAmount } from "./cumulativeChart.js";
import ChartTooltip from "./ChartTooltip.jsx";

export default function CumulativeCategoryChart({
  chartData,
  subtitle,
  emptyMessage = "No data to chart for this period.",
  ariaLabel = "Cumulative chart by category",
}) {
  const [hovered, setHovered] = useState(null);

  const handleMouseMove = useCallback(
    (event) => {
      if (!chartData?.tooltips?.length) return;
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      const relativeX = ((event.clientX - rect.left) / rect.width) * chartData.width;
      let closest = chartData.tooltips[0];
      let minDist = Math.abs(closest.x - relativeX);
      for (const tip of chartData.tooltips) {
        const dist = Math.abs(tip.x - relativeX);
        if (dist < minDist) {
          minDist = dist;
          closest = tip;
        }
      }
      setHovered(closest);
    },
    [chartData]
  );

  if (!chartData?.areas?.length) {
    return (
      <div style={{ fontSize: 13, color: "#74836A", padding: "12px 0" }}>
        {emptyMessage}
      </div>
    );
  }

  const { width, height, pad, areas, linePath, yTicks, xLabels } = chartData;

  const tooltipLeft = hovered ? (hovered.x / width) * 100 : 0;
  const flipTooltip = tooltipLeft > 72;

  return (
    <div>
      {subtitle && (
        <div style={{ fontSize: 12.5, color: "#74836A", marginBottom: 12 }}>
          {subtitle}
        </div>
      )}
      <div
        style={{
          position: "relative",
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          background: "#FFFDF8",
          padding: "12px 8px 8px",
          overflow: "hidden",
        }}
      >
        {hovered && (
          <ChartTooltip
            tooltip={hovered}
            style={{
              position: "absolute",
              top: 10,
              left: `${tooltipLeft}%`,
              transform: flipTooltip ? "translateX(-100%)" : "translateX(-8px)",
              zIndex: 2,
            }}
          />
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          style={{ display: "block", minHeight: 200 }}
          role="img"
          aria-label={ariaLabel}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={tick.y}
                y2={tick.y}
                stroke="#E4DCC5"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#74836A"
                fontFamily="'IBM Plex Mono', monospace"
              >
                {formatChartAmount(tick.value)}
              </text>
            </g>
          ))}

          {areas.map((area) => (
            <path
              key={area.id}
              d={area.path}
              fill={area.color}
              fillOpacity="0.72"
              stroke={area.color}
              strokeWidth="0.5"
              strokeOpacity="0.9"
            />
          ))}

          <path
            d={linePath}
            fill="none"
            stroke="#1F2A22"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
          />

          {hovered && (
            <g pointerEvents="none">
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={pad.top}
                y2={height - pad.bottom}
                stroke="#3C6E91"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.8"
              />
              <circle cx={hovered.x} cy={hovered.y} r="4.5" fill="#1F2A22" />
              <circle cx={hovered.x} cy={hovered.y} r="2.5" fill="#FFFDF8" />
            </g>
          )}

          <rect
            x={pad.left}
            y={pad.top}
            width={width - pad.left - pad.right}
            height={height - pad.top - pad.bottom}
            fill="transparent"
          />

          {xLabels.map((item) => (
            <text
              key={`${item.label}-${item.x}`}
              x={item.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="10.5"
              fill="#74836A"
              pointerEvents="none"
            >
              {item.label}
            </text>
          ))}
        </svg>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 14px",
            padding: "8px 10px 4px",
            borderTop: "1px dashed #E4DCC5",
          }}
        >
          {areas.map((area) => (
            <div
              key={area.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#1F2A22",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: area.color,
                  flexShrink: 0,
                }}
              />
              {area.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
