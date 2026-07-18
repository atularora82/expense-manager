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

function expandTwoDigitYear(yy) {
  const n = Number(yy);
  if (!Number.isFinite(n)) return null;
  if (n >= 100) return n;
  return n >= 70 ? 1900 + n : 2000 + n;
}

function toISODateFromParts(dayStr, monthStr, yearStr) {
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year =
    String(yearStr).length <= 2 ? expandTwoDigitYear(yearStr) : Number(yearStr);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseExcelDate(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

  const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    return toISODateFromParts(ddmmyyyy[1], ddmmyyyy[2], ddmmyyyy[3]);
  }

  const ddmmyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (ddmmyy) {
    return toISODateFromParts(ddmmyy[1], ddmmyy[2], ddmmyy[3]);
  }

  const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    return toISODateFromParts(yyyymmdd[3], yyyymmdd[2], yyyymmdd[1]);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

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
  return `${entry.date}|${entry.description.toLowerCase()}|${entry.amount}|${entry.type}`;
}

export { parseExcelDate, parseAmount, entryKey, mapExcelCategory };

/**
 * Parse an Excel/CSV file in the IDL format: Date, Description, Expense, Category.
 * Returns { rows, errors, duplicateCount }.
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
    return { rows: [], errors: ["The file has no worksheets."], duplicateCount: 0 };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (rows.length === 0) {
    return { rows: [], errors: ["The worksheet is empty."], duplicateCount: 0 };
  }

  const existingKeys = new Set(existingEntries.map(entryKey));
  const previewRows = [];
  const errors = [];
  let duplicateCount = 0;

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

    const candidate = {
      type: "expense",
      amount,
      description,
      category: mapExcelCategory(categoryRaw || "", description, categoryRules),
      date,
    };

    const key = entryKey(candidate);
    const isDuplicate = existingKeys.has(key);

    previewRows.push({
      previewId: uid(),
      sourceRow: rowNum,
      included: !isDuplicate,
      isDuplicate,
      ...candidate,
    });

    if (isDuplicate) {
      duplicateCount += 1;
    } else {
      existingKeys.add(key);
    }
  });

  return { rows: previewRows, errors, duplicateCount };
}
