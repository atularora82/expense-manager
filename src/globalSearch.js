const TYPE_LABELS = {
  expense: "expense",
  income: "income",
  investment: "investment",
};

export function matchesGlobalSearch(entry, query, catInfoFor) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const cat = catInfoFor(entry.type, entry.category);
  const fields = [
    entry.description,
    entry.label,
    cat?.label,
    entry.category,
    TYPE_LABELS[entry.type] || entry.type,
    entry.date,
    entry.date.slice(0, 7),
    entry.date.slice(0, 4),
    String(entry.amount),
    entry.amount.toFixed(2),
  ];

  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

export function filterEntriesGlobal(entries, query, catInfoFor, filters = {}) {
  const { type = "all", category = "all" } = filters;
  return entries
    .filter((e) => type === "all" || e.type === type)
    .filter((e) => category === "all" || e.category === category)
    .filter((e) => matchesGlobalSearch(e, query, catInfoFor))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
