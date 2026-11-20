function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const FINANCE_RECORD_TYPES = [
  { id: "bank", label: "Bank account", side: "asset", color: "#3C6E91" },
  { id: "fixed_deposit", label: "Fixed deposit / RD", side: "asset", color: "#8B5E34" },
  { id: "mutual_fund", label: "Mutual funds", side: "asset", color: "#3C6E91" },
  { id: "stocks", label: "Shares / stocks", side: "asset", color: "#2F6B4F" },
  { id: "ppf_epf", label: "PPF / EPF / NPS", side: "asset", color: "#4A5A91" },
  { id: "insurance", label: "Life / health insurance", side: "asset", color: "#5C4A91" },
  { id: "gold", label: "Gold / SGB", side: "asset", color: "#C08A28" },
  { id: "property", label: "Property", side: "asset", color: "#8B5E34" },
  { id: "other_asset", label: "Other asset", side: "asset", color: "#74836A" },
  { id: "home_loan", label: "Home loan", side: "liability", color: "#A93B3B" },
  { id: "personal_loan", label: "Personal / other loan", side: "liability", color: "#B15E86" },
  { id: "credit_card", label: "Credit card outstanding", side: "liability", color: "#A93B3B" },
  { id: "other_liability", label: "Other liability", side: "liability", color: "#9E6B6B" },
];

export const financeRecordTypeMap = Object.fromEntries(
  FINANCE_RECORD_TYPES.map((t) => [t.id, t])
);

const VALID_TYPE_IDS = new Set(FINANCE_RECORD_TYPES.map((t) => t.id));

export function emptyFamilyFinanceRegistry() {
  return { members: [], records: [] };
}

export function createFamilyMember(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  return {
    id: uid(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
}

export function createFinancialRecord({
  memberId,
  type = "bank",
  title,
  institution = "",
  value,
  identifier = "",
  notes = "",
  maturityDate = null,
  asOfDate = null,
}) {
  const member = String(memberId || "").trim();
  const recordType = VALID_TYPE_IDS.has(type) ? type : "bank";
  const trimmedTitle = String(title || "").trim();
  const amount = Number(value);
  if (!member || !trimmedTitle || !Number.isFinite(amount)) return null;

  const now = new Date().toISOString();
  return {
    id: uid(),
    memberId: member,
    type: recordType,
    title: trimmedTitle,
    institution: String(institution || "").trim(),
    value: amount,
    identifier: String(identifier || "").trim(),
    notes: String(notes || "").trim(),
    maturityDate: maturityDate || null,
    asOfDate: asOfDate || now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeFamilyFinanceRegistry(raw) {
  if (!raw || typeof raw !== "object") return emptyFamilyFinanceRegistry();

  const members = Array.isArray(raw.members)
    ? raw.members.filter((m) => m && m.id && String(m.name || "").trim())
    : [];

  const memberIds = new Set(members.map((m) => m.id));

  const records = Array.isArray(raw.records)
    ? raw.records.filter(
        (r) =>
          r &&
          r.id &&
          memberIds.has(r.memberId) &&
          VALID_TYPE_IDS.has(r.type) &&
          String(r.title || "").trim() &&
          Number.isFinite(Number(r.value))
      )
    : [];

  return {
    members,
    records: records.map((r) => ({
      ...r,
      title: String(r.title).trim(),
      institution: String(r.institution || "").trim(),
      value: Number(r.value),
      identifier: String(r.identifier || "").trim(),
      notes: String(r.notes || "").trim(),
      maturityDate: r.maturityDate || null,
      asOfDate: r.asOfDate || null,
    })),
  };
}

export function summarizeFamilyFinance(registry, { memberId = null } = {}) {
  const records = registry.records.filter(
    (r) => !memberId || r.memberId === memberId
  );

  let assets = 0;
  let liabilities = 0;
  const byType = {};

  for (const record of records) {
    const typeInfo = financeRecordTypeMap[record.type];
    const side = typeInfo?.side === "liability" ? "liability" : "asset";
    const amount = Math.abs(Number(record.value) || 0);
    if (side === "liability") liabilities += amount;
    else assets += amount;

    if (!byType[record.type]) {
      byType[record.type] = { total: 0, count: 0, side };
    }
    byType[record.type].total += amount;
    byType[record.type].count += 1;
  }

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    recordCount: records.length,
    byType,
  };
}

export function memberLabel(registry, memberId) {
  if (!memberId) return null;
  const member = registry.members.find((m) => m.id === memberId);
  return member ? member.name : null;
}