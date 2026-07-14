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

  for (const [pattern, rule] of Object.entries(rules)) {
    if (rule.type !== type) continue;
    if (key.includes(pattern) || pattern.includes(key)) return rule.category;
  }
  return null;
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
