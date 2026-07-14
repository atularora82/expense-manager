import { lookupCategoryRule } from "./categoryRules.js";

const EXCEL_CATEGORY_MAP = {
  groceries: "groceries",
  health: "health",
  "personal care": "personal",
  electricity: "utilities",
  "bills and utilities": "utilities",
  cable: "entertainment",
  internet: "utilities",
  "auto and transport": "transport",
  misc: "other",
  food: "food",
  dining: "food",
  transport: "transport",
  transportation: "transport",
  housing: "housing",
  utilities: "utilities",
  entertainment: "entertainment",
  shopping: "shopping",
  education: "education",
  travel: "travel",
  other: "other",
};

const EXPENSE_KEYWORDS = {
  food: ["food", "restaurant", "lunch", "dinner", "breakfast", "coffee", "tea", "snack", "swiggy", "zomato", "dine", "cafe"],
  groceries: ["grocery", "groceries", "vegetable", "vegetables", "supermarket", "bigbasket", "kirana", "milk", "fruits"],
  transport: ["uber", "ola", "taxi", "auto", "rickshaw", "bus", "train ticket", "metro", "fuel", "petrol", "diesel", "cab", "toll", "parking", "insurance"],
  housing: ["rent", "maintenance", "housing", "society"],
  utilities: ["electricity", "electric bill", "water bill", "wifi", "internet", "recharge", "mobile bill", "gas cylinder", "broadband", "dth", "airtel"],
  entertainment: ["movie", "netflix", "entertainment", "concert", "game", "cinema", "bookmyshow", "subscription", "spotify", "prime video"],
  health: ["medicine", "doctor", "hospital", "pharmacy", "gym", "clinic", "medical", "health", "apollo"],
  shopping: ["shopping", "clothes", "amazon", "flipkart", "myntra", "shoes", "electronics"],
  education: ["book", "course", "tuition", "fees", "school", "college", "class", "exam"],
  travel: ["flight", "hotel booking", "travel", "trip", "vacation", "irctc", "makemytrip", "holiday"],
  personal: ["salon", "haircut", "spa", "parlour", "personal care", "cosmetics"],
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function detectCategoryFromText(text) {
  const lower = text.toLowerCase();
  for (const [catId, words] of Object.entries(EXPENSE_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return catId;
  }
  return "other";
}

function mapExcelCategory(excelCategory, description, categoryRules = {}) {
  const fromRule = lookupCategoryRule(categoryRules, description, "expense");
  if (fromRule) return fromRule;

  const normalized = normalizeKey(excelCategory);
  if (EXCEL_CATEGORY_MAP[normalized]) return EXCEL_CATEGORY_MAP[normalized];

  for (const [label, id] of Object.entries(EXCEL_CATEGORY_MAP)) {
    if (normalized.includes(label) || label.includes(normalized)) return id;
  }

  return detectCategoryFromText(`${excelCategory} ${description}`);
}

function parseAmount(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const num = parseFloat(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseExcelDate(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(value).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

function getField(row, ...names) {
  for (const name of names) {
    const key = Object.keys(row).find((k) => normalizeKey(k) === normalizeKey(name));
    if (key != null && row[key] !== "") return row[key];
  }
  return null;
}

function entryKey(entry) {
  return `${entry.date}|${entry.description.toLowerCase()}|${entry.amount}`;
}

/**
 * Parse an Excel/CSV file in the IDL format: Date, Description, Expense, Category.
 * Returns { entries, errors, skipped }.
 */
export async function parseExcelFile(
  file,
  existingEntries = [],
  categoryRules = {}
) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { entries: [], errors: ["The file has no worksheets."], skipped: 0 };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (rows.length === 0) {
    return { entries: [], errors: ["The worksheet is empty."], skipped: 0 };
  }

  const existingKeys = new Set(existingEntries.map(entryKey));
  const entries = [];
  const errors = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const dateRaw = getField(row, "date");
    const description = String(getField(row, "description") ?? "").trim();
    const amountRaw = getField(row, "expense", "amount", "expense (inr)", "cost");
    const categoryRaw = getField(row, "category");

    if (!dateRaw && !description && !amountRaw && !categoryRaw) return;

    const date = parseExcelDate(dateRaw);
    const amount = parseAmount(amountRaw);

    if (!date) {
      errors.push(`Row ${rowNum}: invalid date "${dateRaw}"`);
      return;
    }
    if (!description) {
      errors.push(`Row ${rowNum}: missing description`);
      return;
    }
    if (amount == null) {
      errors.push(`Row ${rowNum}: invalid amount "${amountRaw}"`);
      return;
    }

    const entry = {
      id: uid(),
      type: "expense",
      amount,
      description,
      category: mapExcelCategory(categoryRaw || "", description, categoryRules),
      date,
    };

    const key = entryKey(entry);
    if (existingKeys.has(key)) {
      skipped += 1;
      return;
    }

    existingKeys.add(key);
    entries.push(entry);
  });

  return { entries, errors, skipped };
}
