export function normalizeMerchant(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function lookupCategoryRule(rules, description, type) {
  const key = normalizeMerchant(description);
  if (!key || !rules) return null;

  const exact = rules[key];
  if (exact && exact.type === type) return exact.category;

  let bestCategory = null;
  let bestScore = 0;

  for (const [pattern, rule] of Object.entries(rules)) {
    if (rule.type !== type) continue;

    let score = 0;
    if (key.includes(pattern)) score = pattern.length;
    else if (pattern.includes(key) && key.length >= 3) score = key.length;
    else if (key.length >= 3 && pattern.startsWith(key)) score = key.length;

    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  return bestCategory;
}

export function saveCategoryRule(rules, description, type, category) {
  const key = normalizeMerchant(description);
  if (!key) return rules;
  return { ...rules, [key]: { category, type } };
}

export function removeCategoryRule(rules, description) {
  const key = normalizeMerchant(description);
  if (!key || !rules[key]) return rules;
  const next = { ...rules };
  delete next[key];
  return next;
}

export function clearCategoryRules() {
  return {};
}

export function entryMatchesRule(entry, pattern, rule) {
  if (entry.type !== rule.type) return false;
  const key = normalizeMerchant(entry.description);
  if (!key) return false;
  if (key === pattern) return true;
  if (pattern.length >= 3 && key.includes(pattern)) return true;
  if (key.length >= 3 && pattern.includes(key)) return true;
  return false;
}

export function pruneUnusedCategoryRules(rules, entries) {
  const next = {};
  for (const [pattern, rule] of Object.entries(rules)) {
    const used = entries.some((entry) => entryMatchesRule(entry, pattern, rule));
    if (used) next[pattern] = rule;
  }
  return next;
}

export function filterCategoryRuleEntries(rules, query, catInfoFor) {
  const q = normalizeMerchant(query);
  const list = Object.entries(rules).map(([pattern, rule]) => ({
    pattern,
    ...rule,
    label: catInfoFor?.(rule.type, rule.category)?.label ?? rule.category,
  }));
  if (!q) return list.sort((a, b) => a.pattern.localeCompare(b.pattern));
  return list
    .filter(
      (rule) =>
        rule.pattern.includes(q) ||
        rule.label.toLowerCase().includes(q) ||
        rule.type.includes(q)
    )
    .sort((a, b) => a.pattern.localeCompare(b.pattern));
}
