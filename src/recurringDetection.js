function normalizeDesc(desc) {
  return String(desc || "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function recurringKey(type, amount, desc) {
  return `${type}|${amount.toFixed(2)}|${normalizeDesc(desc)}`;
}

function medianIntervalDays(dates) {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1] + "T00:00:00");
    const b = new Date(sorted[i] + "T00:00:00");
    gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)));
  }
  gaps.sort((x, y) => x - y);
  return gaps[Math.floor(gaps.length / 2)];
}

function inferFrequency(intervalDays) {
  if (intervalDays == null) return null;
  if (intervalDays >= 25 && intervalDays <= 35) return "monthly";
  if (intervalDays >= 6 && intervalDays <= 8) return "weekly";
  return null;
}

function weekdayFromDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const jsDow = d.getDay();
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Detect recurring patterns from ledger entries.
 * Returns suggestions not already covered by existing recurring templates.
 */
export function detectRecurringPatterns(
  entries,
  { existingRecurring = [], minOccurrences = 3 } = {}
) {
  const covered = new Set(
    existingRecurring.map((r) =>
      recurringKey(r.type, Number(r.amount), r.description)
    )
  );

  const groups = new Map();
  for (const entry of entries) {
    if (!entry.amount || !entry.description) continue;
    const key = recurringKey(entry.type, entry.amount, entry.description);
    if (covered.has(key)) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        category: entry.category,
        dates: [],
      });
    }
    const group = groups.get(key);
    group.dates.push(entry.date);
    if (!group.category && entry.category) group.category = entry.category;
  }

  const suggestions = [];
  for (const group of groups.values()) {
    const uniqueDates = [...new Set(group.dates)];
    if (uniqueDates.length < minOccurrences) continue;

    const interval = medianIntervalDays(uniqueDates);
    const frequency = inferFrequency(interval);
    if (!frequency) continue;

    const latestDate = uniqueDates.sort().at(-1);
    suggestions.push({
      id: recurringKey(group.type, group.amount, group.description),
      type: group.type,
      amount: group.amount,
      description: group.description,
      category: group.category,
      frequency,
      occurrences: uniqueDates.length,
      dayOfMonth: frequency === "monthly" ? Number(latestDate.slice(8, 10)) : undefined,
      weekday: frequency === "weekly" ? weekdayFromDate(latestDate) : undefined,
      startDate: latestDate,
      lastSeen: latestDate,
    });
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences).slice(0, 8);
}

export function suggestionToRecurringTemplate(suggestion) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type: suggestion.type,
    amount: suggestion.amount,
    description: suggestion.description,
    category: suggestion.category,
    frequency: suggestion.frequency,
    dayOfMonth: suggestion.dayOfMonth || 1,
    weekday: suggestion.weekday ?? 1,
    startDate: suggestion.startDate,
    createdAt: new Date().toISOString(),
    active: true,
  };
}
