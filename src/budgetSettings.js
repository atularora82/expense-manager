import { ALLOCATION_MODELS, CATEGORY_ALLOCATION } from "./budgetAllocation.js";

export const BUDGET_BUCKETS = [
  { id: "needs", label: "Needs" },
  { id: "wants", label: "Wants" },
  { id: "skip", label: "Exclude" },
];

export const BUDGET_METHODS = [
  { id: "rule", label: "Income rule" },
  { id: "avg-spend", label: "3-month average" },
];

export function defaultCategoryBucket(categoryId) {
  return CATEGORY_ALLOCATION[categoryId]?.bucket === "needs" ? "needs" : "wants";
}

export function getCategoryBucket(categoryId, settings = {}) {
  const override = settings?.categoryBuckets?.[categoryId];
  if (override === "needs" || override === "wants" || override === "skip") {
    return override;
  }
  return defaultCategoryBucket(categoryId);
}

export function resolveCategoryBuckets(categoryIds, settings = {}) {
  const map = {};
  for (const id of categoryIds) {
    map[id] = getCategoryBucket(id, settings);
  }
  return map;
}

export function normalizeBudgetSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      housingEmiAmount: null,
      categoryBuckets: {},
      allocationModelId: "50-30-20",
      budgetMethod: "rule",
    };
  }
  const amount = Number(raw.housingEmiAmount);
  const categoryBuckets = {};
  if (raw.categoryBuckets && typeof raw.categoryBuckets === "object") {
    for (const [id, bucket] of Object.entries(raw.categoryBuckets)) {
      if (bucket === "needs" || bucket === "wants" || bucket === "skip") {
        categoryBuckets[id] = bucket;
      }
    }
  }
  const allocationModelId = ALLOCATION_MODELS.some((m) => m.id === raw.allocationModelId)
    ? raw.allocationModelId
    : "50-30-20";
  const budgetMethod = raw.budgetMethod === "avg-spend" ? "avg-spend" : "rule";
  return {
    housingEmiAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
    categoryBuckets,
    allocationModelId,
    budgetMethod,
  };
}

export function setCategoryBucketInSettings(settings, categoryId, bucket) {
  const nextBuckets = { ...(settings.categoryBuckets || {}) };
  if (bucket === defaultCategoryBucket(categoryId)) {
    delete nextBuckets[categoryId];
  } else {
    nextBuckets[categoryId] = bucket;
  }
  return { ...settings, categoryBuckets: nextBuckets };
}
