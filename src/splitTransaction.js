export const SPLIT_TOLERANCE = 0.01;

export function roundMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

export function sumSplitLines(lines) {
  return roundMoney(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0));
}

export function splitRemaining(originalAmount, lines) {
  return roundMoney(originalAmount - sumSplitLines(lines));
}

export function validateSplitLines(lines, originalAmount) {
  if (!lines || lines.length < 2) {
    return { ok: false, error: "Add at least 2 lines to split this transaction." };
  }
  for (const line of lines) {
    const amt = Number(line.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, error: "Each line needs an amount greater than 0." };
    }
    if (!line.category) {
      return { ok: false, error: "Pick a category for each line." };
    }
  }
  const remaining = splitRemaining(originalAmount, lines);
  if (Math.abs(remaining) > SPLIT_TOLERANCE) {
    if (remaining > 0) {
      return {
        ok: false,
        error: `Amounts are ${remaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })} short of the total.`,
      };
    }
    return {
      ok: false,
      error: `Amounts exceed the total by ${Math.abs(remaining).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`,
    };
  }
  return { ok: true };
}

export function getSplitSiblings(entries, entry) {
  if (!entry) return [];
  if (!entry.splitGroupId) return [entry];
  return entries.filter((e) => e.splitGroupId === entry.splitGroupId);
}

export function splitGroupTotal(siblings) {
  return roundMoney(siblings.reduce((sum, entry) => sum + entry.amount, 0));
}

export function baseDescription(description) {
  const text = String(description || "");
  const idx = text.indexOf(" — ");
  return idx === -1 ? text : text.slice(0, idx);
}

export function lineNoteFromDescription(description, fallbackBase) {
  const text = String(description || "");
  const base = fallbackBase || baseDescription(text);
  if (!text.startsWith(base)) return "";
  const suffix = text.slice(base.length).replace(/^ — /, "");
  return suffix;
}

export function linesFromSplitSiblings(siblings) {
  const rootDesc = baseDescription(siblings[0]?.description);
  return siblings.map((entry) => ({
    existingId: entry.id,
    amount: entry.amount,
    category: entry.category,
    splitNote: lineNoteFromDescription(entry.description, rootDesc),
  }));
}

export function initialSplitLines(entry, categories) {
  const half = roundMoney(entry.amount / 2);
  const rest = roundMoney(entry.amount - half);
  const altCategory =
    entry.category === "groceries"
      ? "shopping"
      : categories.find((c) => c.id !== entry.category)?.id || entry.category;
  return [
    { amount: half, category: entry.category, splitNote: "" },
    { amount: rest, category: altCategory, splitNote: "" },
  ];
}

export function buildSplitEntriesFromLines({ sourceEntry, lines, splitGroupId, createId }) {
  const groupId = splitGroupId || createId();
  const rootDesc = baseDescription(sourceEntry.description);

  return lines.map((line) => {
    const note = String(line.splitNote || "").trim();
    return {
      id: line.existingId || createId(),
      type: sourceEntry.type,
      amount: roundMoney(Number(line.amount)),
      category: line.category,
      description: note ? `${rootDesc} — ${note}` : rootDesc,
      date: sourceEntry.date,
      recordedAt: sourceEntry.recordedAt || new Date().toISOString(),
      splitGroupId: groupId,
      ...(sourceEntry.accountId ? { accountId: sourceEntry.accountId } : {}),
      ...(sourceEntry.hidden ? { hidden: true } : {}),
      ...(sourceEntry.label ? { label: sourceEntry.label } : {}),
    };
  });
}

export function mergeSplitGroup(entries, splitGroupId) {
  const siblings = entries.filter((entry) => entry.splitGroupId === splitGroupId);
  if (siblings.length < 2) return entries;

  const first = siblings[0];
  const merged = {
    ...first,
    amount: splitGroupTotal(siblings),
    description: baseDescription(first.description),
  };
  delete merged.splitGroupId;

  const removeIds = new Set(siblings.slice(1).map((entry) => entry.id));
  return entries
    .filter((entry) => !removeIds.has(entry.id))
    .map((entry) => (entry.id === first.id ? merged : entry));
}
