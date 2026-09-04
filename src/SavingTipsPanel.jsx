import React from "react";

const TYPE_STYLES = {
  warning: { border: "#E8C4C4", bg: "#FDF6F6", accent: "#A93B3B", icon: "!" },
  success: { border: "#B8D4C4", bg: "#F2F9F5", accent: "#2F6B4F", icon: "✓" },
  info: { border: "#B8CDDC", bg: "#F3F7FA", accent: "#3C6E91", icon: "i" },
  tip: { border: "#E4D4A8", bg: "#FBF6EA", accent: "#C08A28", icon: "★" },
};

function TipCard({ tip, onCategoryClick }) {
  const style = TYPE_STYLES[tip.type] || TYPE_STYLES.tip;
  const clickable = tip.categoryId && onCategoryClick;

  return (
    <div
      style={{
        border: `1px solid ${style.border}`,
        background: style.bg,
        borderRadius: 6,
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `1.5px solid ${style.accent}`,
          color: style.accent,
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {style.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#1F2A22",
            marginBottom: 4,
          }}
        >
          {tip.title}
        </div>
        <div style={{ fontSize: 12.5, color: "#4A5A4E", lineHeight: 1.45 }}>
          {tip.body}
        </div>
        {clickable && (
          <button
            type="button"
            onClick={() => onCategoryClick(tip.categoryId)}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: style.accent,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            View category →
          </button>
        )}
      </div>
    </div>
  );
}

export default function SavingTipsPanel({ tips, periodLabel, onCategoryClick }) {
  if (!tips.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "#74836A", lineHeight: 1.45 }}>
        Personalized suggestions based on your {periodLabel} ledger. Tips refresh as
        you add entries and set budgets.
      </div>
      {tips.map((tip) => (
        <TipCard key={tip.id} tip={tip} onCategoryClick={onCategoryClick} />
      ))}
    </div>
  );
}
