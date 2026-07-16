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
