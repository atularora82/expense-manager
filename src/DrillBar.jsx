import React, { useState } from "react";
import ChartTooltip from "./ChartTooltip.jsx";

export default function DrillBar({
  id,
  label,
  total,
  maxTotal,
  color,
  active = false,
  onClick,
  labelWidth = 72,
  tooltip,
  fmtMoney,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      key={id}
      className={`drill-bar${active ? " drill-bar-active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip ? undefined : "Click to filter"}
      style={{ position: "relative" }}
    >
      {hovered && tooltip && (
        <ChartTooltip
          tooltip={tooltip}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            zIndex: 3,
          }}
        />
      )}
      <div className="drill-bar-label" style={{ width: labelWidth }}>
        {label}
      </div>
      <div className="drill-bar-track">
        <div
          className="drill-bar-fill"
          style={{
            width: `${maxTotal > 0 ? (total / maxTotal) * 100 : 0}%`,
            background: color,
          }}
        />
      </div>
      <div className="drill-bar-amount">{fmtMoney(total)}</div>
    </button>
  );
}
