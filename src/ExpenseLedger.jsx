import React, { useState, useEffect, useMemo, useRef } from "react";
import { parseExcelFile, entryKey } from "./excelImport.js";
import {
  readStatementFile,
  resolveColumnMapping,
  columnSignature,
  parseStatementWithMapping,
  mappingIsValid,
  STATEMENT_MAP_FIELDS,
} from "./statementImport.js";
import {
  lookupCategoryRule,
  saveCategoryRule,
  removeCategoryRule,
} from "./categoryRules.js";
import { processRecurringItems } from "./recurring.js";
import { createBackup, downloadBackup, parseBackupFile } from "./backup.js";
import {
  BACKUP_SCHEDULE_KEY,
  BACKUP_FREQUENCIES,
  normalizeBackupSchedule,
  shouldRunScheduledBackup,
  formatLastBackup,
  markBackupCompleted,
} from "./backupSchedule.js";
import {
  runGoogleDriveBackup,
  userHasGoogleProvider,
} from "./googleDriveBackup.js";
import { auth, googleProvider } from "./firebase.js";
import {
  INVESTMENT_CATEGORIES,
  investmentCatMap,
  detectInvestmentCategory,
} from "./investments.js";
import { filterEntriesGlobal } from "./globalSearch.js";
import { findDateAmountDuplicates } from "./duplicates.js";
import {
  createImportPreviewState,
  updateImportPreviewRow,
  setAllImportPreviewIncluded,
  getImportPreviewStats,
  buildEntriesFromPreview,
  getRowValidationError,
  mergeImportedEntries,
  buildImportConfirmationSummary,
  defaultImportLabel,
} from "./importPreview.js";
import { isStorageNotFoundError, parseStoredJson } from "./storageUtils.js";

const CATEGORIES = [
  { id: "food", label: "Food & Dining", color: "#A93B3B" },
  { id: "groceries", label: "Groceries", color: "#6B8E4E" },
  { id: "transport", label: "Transportation", color: "#3C6E91" },
  { id: "housing", label: "Housing", color: "#8B5E34" },
  { id: "utilities", label: "Utilities", color: "#C08A28" },
  { id: "entertainment", label: "Entertainment", color: "#7A4E8C" },
  { id: "health", label: "Health & Fitness", color: "#4E8C7A" },
  { id: "shopping", label: "Shopping", color: "#B15E86" },
  { id: "education", label: "Education", color: "#4A5A91" },
  { id: "travel", label: "Travel", color: "#3E8C8C" },
  { id: "personal", label: "Personal Care", color: "#A67C52" },
  { id: "other", label: "Other", color: "#74836A" },
];

const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", color: "#2F6B4F" },
  { id: "freelance", label: "Freelance", color: "#3C6E91" },
  { id: "business", label: "Business", color: "#8B5E34" },
  { id: "investment", label: "Investment", color: "#4A5A91" },
  { id: "gift", label: "Gift", color: "#B15E86" },
  { id: "refund", label: "Refund / Cashback", color: "#74836A" },
  { id: "other_income", label: "Other income", color: "#C08A28" },
];

const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const incomeCatMap = Object.fromEntries(
  INCOME_CATEGORIES.map((c) => [c.id, c])
);

function catsForType(type) {
  if (type === "income") return INCOME_CATEGORIES;
  if (type === "investment") return INVESTMENT_CATEGORIES;
  return CATEGORIES;
}
function catInfoFor(type, id) {
  if (type === "income") return incomeCatMap[id];
  if (type === "investment") return investmentCatMap[id];
  return catMap[id];
}

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return localISODate(new Date());
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function monthNameOnly(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
  });
}

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    "\u20B9" +
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtDateFull(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTransactionDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toISODate(d) {
  return localISODate(d);
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekRange(anchorStr) {
  const startDate = startOfWeek(anchorStr);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return {
    startDate,
    endDate,
    startStr: toISODate(startDate),
    endStr: toISODate(endDate),
  };
}

function weekLabel(range) {
  const startLabel = range.startDate.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
  const endLabel = range.endDate.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} \u2013 ${endLabel}`;
}

function getWeeklyExpenseTotals(sourceEntries, ym) {
  const map = new Map();
  sourceEntries
    .filter((entry) => entry.type === "expense" && entry.date.slice(0, 7) === ym)
    .forEach((entry) => {
      const weekStart = toISODate(startOfWeek(entry.date));
      map.set(weekStart, (map.get(weekStart) || 0) + entry.amount);
    });

  return Array.from(map.entries())
    .map(([startStr, total]) => {
      const range = getWeekRange(startStr);
      return {
        startStr,
        endStr: range.endStr,
        total,
        label: weekLabel(range),
      };
    })
    .sort((a, b) => a.startStr.localeCompare(b.startStr));
}

function getDailyExpenseTotals(sourceEntries, startStr, endStr) {
  const map = {};
  sourceEntries
    .filter(
      (entry) =>
        entry.type === "expense" &&
        entry.date >= startStr &&
        entry.date <= endStr
    )
    .forEach((entry) => {
      map[entry.date] = (map[entry.date] || 0) + entry.amount;
    });

  return Object.entries(map)
    .map(([date, total]) => ({
      date,
      total,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const EXPENSE_KEYWORDS = {
  food: ["food", "restaurant", "lunch", "dinner", "breakfast", "coffee", "tea", "snack", "swiggy", "zomato", "dine", "cafe"],
  groceries: ["grocery", "groceries", "vegetable", "vegetables", "supermarket", "bigbasket", "kirana", "milk", "fruits"],
  transport: ["uber", "ola", "taxi", "auto", "rickshaw", "bus", "train ticket", "metro", "fuel", "petrol", "diesel", "cab", "toll", "parking"],
  housing: ["rent", "maintenance", "housing", "society"],
  utilities: ["electricity", "electric bill", "water bill", "wifi", "internet", "recharge", "mobile bill", "gas cylinder", "broadband", "dth"],
  entertainment: ["movie", "netflix", "entertainment", "concert", "game", "cinema", "bookmyshow", "subscription", "spotify", "prime video"],
  health: ["medicine", "doctor", "hospital", "pharmacy", "gym", "clinic", "medical", "health"],
  shopping: ["shopping", "clothes", "amazon", "flipkart", "myntra", "shoes", "electronics"],
  education: ["book", "course", "tuition", "fees", "school", "college", "class", "exam"],
  travel: ["flight", "hotel booking", "travel", "trip", "vacation", "irctc", "makemytrip", "holiday"],
  personal: ["salon", "haircut", "spa", "parlour", "personal care", "cosmetics"],
};

const INCOME_KEYWORDS = {
  salary: ["salary", "paycheck", "pay check", "stipend"],
  freelance: ["freelance", "client payment", "project payment", "gig"],
  business: ["business income", "sales", "revenue"],
  investment: ["dividend", "interest", "mutual fund", "stocks", "shares", "investment return"],
  gift: ["gift", "gifted", "birthday money"],
  refund: ["refund", "cashback", "reimbursement"],
};

function detectCategory(lowerText, type) {
  if (type === "investment") return detectInvestmentCategory(lowerText);
  const list = catsForType(type);
  const keywords = type === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  for (const cat of list) {
    const words = keywords[cat.id];
    if (words && words.some((w) => lowerText.includes(w))) return cat.id;
  }
  return type === "income" ? "other_income" : "other";
}

function resolveCategory(description, type, rules = {}) {
  const fromRule = lookupCategoryRule(rules, description, type);
  if (fromRule) return fromRule;
  return detectCategory(description.toLowerCase(), type);
}

function weekdayFromDate(dateStr) {
  const jsDow = new Date(dateStr + "T00:00:00").getDay();
  return jsDow === 0 ? 7 : jsDow;
}

function parseVoiceText(raw, type, rules = {}) {
  const lower = raw.toLowerCase();
  const numMatch = lower.match(/(\d+(?:[.,]\d+)?)/);
  const amount = numMatch ? parseFloat(numMatch[1].replace(",", "")) : null;

  let desc = raw;
  if (numMatch) desc = desc.replace(numMatch[0], " ");
  desc = desc
    .replace(/rupees?|rs\.?|inr|\u20B9/gi, " ")
    .replace(/\b(for|on|spent|spend|paid|received|got|towards|at|of|i|to|from)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!desc) desc = raw.trim();
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  const category = resolveCategory(desc, type, rules);
  return { amount, description: desc, category };
}

function csvValue(v) {
  const s = String(v == null ? "" : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function resolveFormCategory(type, categoryId) {
  const list = catsForType(type);
  return list.some((c) => c.id === categoryId) ? categoryId : list[0].id;
}

function CollapsiblePanel({ title, meta, open, onToggle, hideToggle = false, children }) {
  return (
    <div
      style={{
        background: "#FFFDF8",
        border: "1px solid #D8CDB4",
        borderRadius: 8,
        marginBottom: 28,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={hideToggle ? undefined : onToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: hideToggle ? "default" : "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#1F2A22",
            }}
          >
            {title}
          </div>
          {meta && (
            <div style={{ fontSize: 12.5, color: "#74836A", marginTop: 3 }}>{meta}</div>
          )}
        </div>
        {!hideToggle && (
          <span style={{ fontSize: 12, color: "#74836A", flexShrink: 0 }}>
            {open ? "Hide" : "Show"}
          </span>
        )}
      </button>
      {open && (
        <div style={{ borderTop: "1px dashed #E4DCC5", padding: "12px 18px 16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ExpenseLedger({ user, cloudSync = false, onSignOut }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState(false);

  const [budgets, setBudgets] = useState({});
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState({});

  const [recurring, setRecurring] = useState([]);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [categoryRules, setCategoryRules] = useState({});
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const [formType, setFormType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [date, setDate] = useState(todayStr());
  const [formRecurring, setFormRecurring] = useState(false);
  const [formRecurringFreq, setFormRecurringFreq] = useState("monthly");
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [duplicateBypass, setDuplicateBypass] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [periodMode, setPeriodMode] = useState("month");
  const [year, setYear] = useState(todayStr().slice(0, 4));
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [weekAnchor, setWeekAnchor] = useState(todayStr());
  const [periodDrillDay, setPeriodDrillDay] = useState(null);

  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [importNote, setImportNote] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importConfirm, setImportConfirm] = useState(null);
  const [statementImport, setStatementImport] = useState(null);
  const [statementProfiles, setStatementProfiles] = useState({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [statementDragActive, setStatementDragActive] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const [backupSchedule, setBackupSchedule] = useState(() => normalizeBackupSchedule());
  const [backupScheduleLoaded, setBackupScheduleLoaded] = useState(false);
  const [driveBackupBusy, setDriveBackupBusy] = useState(false);
  const [showDriveBackup, setShowDriveBackup] = useState(false);
  const driveBackupRanRef = useRef(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showExpenseDetails, setShowExpenseDetails] = useState(true);
  const [showInvestmentDetails, setShowInvestmentDetails] = useState(true);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const importInputRef = useRef(null);
  const statementInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const categoryRulesRef = useRef(categoryRules);
  categoryRulesRef.current = categoryRules;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const saveEntriesTimerRef = useRef(null);
  const recognitionRef = React.useRef(null);
  const voiceSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    let cancelled = false;

    async function readKey(key) {
      try {
        const res = await window.storage.get(key);
        return { ok: true, value: res?.value ?? null };
      } catch (error) {
        if (isStorageNotFoundError(error)) {
          return { ok: true, value: null };
        }
        return { ok: false, value: null, error };
      }
    }

    (async () => {
      const [
        entriesResult,
        budgetsResult,
        recurringResult,
        profilesResult,
        rulesResult,
        scheduleResult,
      ] = await Promise.all([
        readKey("ledger-entries"),
        readKey("ledger-budgets"),
        readKey("ledger-recurring"),
        readKey("ledger-statement-profiles"),
        readKey("ledger-category-rules"),
        readKey(BACKUP_SCHEDULE_KEY),
      ]);

      if (cancelled) return;

      if (!entriesResult.ok) {
        setLoadError(
          "Could not load your ledger from cloud sync. Edits are paused so your cloud data is not overwritten."
        );
        setLoaded(true);
        setBudgetsLoaded(true);
        setRecurringLoaded(true);
        setProfilesLoaded(true);
        setRulesLoaded(true);
        setBackupScheduleLoaded(true);
        return;
      }

      if (entriesResult.value) {
        const parsed = parseStoredJson(entriesResult.value, []).map((e) => ({
          type: "expense",
          ...e,
        }));
        setEntries(parsed);
      }

      if (budgetsResult.ok && budgetsResult.value) {
        setBudgets(parseStoredJson(budgetsResult.value, {}));
      }
      if (recurringResult.ok && recurringResult.value) {
        setRecurring(parseStoredJson(recurringResult.value, []));
      }
      if (profilesResult.ok && profilesResult.value) {
        const parsed = parseStoredJson(profilesResult.value, {});
        if (parsed && typeof parsed === "object") {
          setStatementProfiles(parsed);
        }
      }
      if (rulesResult.ok && rulesResult.value) {
        setCategoryRules(parseStoredJson(rulesResult.value, {}));
      }
      if (scheduleResult.ok && scheduleResult.value) {
        setBackupSchedule(normalizeBackupSchedule(parseStoredJson(scheduleResult.value, {})));
      }

      setLoaded(true);
      setBudgetsLoaded(true);
      setRecurringLoaded(true);
      setProfilesLoaded(true);
      setRulesLoaded(true);
      setBackupScheduleLoaded(true);
      setStorageHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;

    if (saveEntriesTimerRef.current) {
      clearTimeout(saveEntriesTimerRef.current);
    }

    saveEntriesTimerRef.current = setTimeout(async () => {
      const payload = JSON.stringify(entriesRef.current);
      try {
        await window.storage.set("ledger-entries", payload);
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    }, 400);

    return () => {
      if (saveEntriesTimerRef.current) {
        clearTimeout(saveEntriesTimerRef.current);
      }
    };
  }, [entries, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || !budgetsLoaded) return;
    (async () => {
      try {
        await window.storage.set("ledger-budgets", JSON.stringify(budgets));
      } catch (e) {
        // ignore, budgets are non-critical
      }
    })();
  }, [budgets, budgetsLoaded]);

  useEffect(() => {
    if (!storageHydrated || !recurringLoaded) return;
    (async () => {
      try {
        await window.storage.set("ledger-recurring", JSON.stringify(recurring));
      } catch (e) {
        // ignore
      }
    })();
  }, [recurring, recurringLoaded]);

  useEffect(() => {
    if (!storageHydrated || !rulesLoaded) return;
    (async () => {
      try {
        await window.storage.set(
          "ledger-category-rules",
          JSON.stringify(categoryRules)
        );
      } catch (e) {
        // ignore
      }
    })();
  }, [categoryRules, rulesLoaded, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || !backupScheduleLoaded) return;
    (async () => {
      try {
        await window.storage.set(
          BACKUP_SCHEDULE_KEY,
          JSON.stringify(backupSchedule)
        );
      } catch (e) {
        // ignore
      }
    })();
  }, [backupSchedule, backupScheduleLoaded, storageHydrated]);

  useEffect(() => {
    if (editingId) setShowManualEntry(true);
  }, [editingId]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!storageHydrated || !loaded || !recurringLoaded || recurring.length === 0) return;
    const generated = processRecurringItems(recurring, entries, todayStr());
    if (generated.length > 0) {
      setEntries((prev) => [...generated, ...prev]);
    }
  }, [loaded, recurringLoaded, recurring.length]);

  useEffect(() => {
    if (!loaded || !rulesLoaded) return;
    if (Object.keys(categoryRules).length > 0 || entries.length === 0) return;
    learnCategoryRulesFromEntries(entries);
  }, [loaded, rulesLoaded, entries.length]);

  function learnCategoryRulesFromEntries(list) {
    const next = list.reduce(
      (rules, en) =>
        saveCategoryRule(rules, en.description, en.type, en.category),
      categoryRulesRef.current
    );
    categoryRulesRef.current = next;
    setCategoryRules(next);
  }

  function resetForm() {
    setAmount("");
    setDesc("");
    setCategory(catsForType(formType)[0].id);
    setDate(todayStr());
    setFormRecurring(false);
    setFormRecurringFreq("monthly");
    setCategoryLocked(false);
    setDuplicateBypass(false);
    setEditingId(null);
    setShowManualEntry(false);
    setFormError("");
  }

  function switchFormType(t) {
    setFormType(t);
    setCategoryLocked(false);
    setDuplicateBypass(false);
    setFormRecurring(t === "investment");
    setFormError("");
    const nextCategory = desc.trim()
      ? resolveCategory(desc, t, categoryRulesRef.current)
      : catsForType(t)[0].id;
    setCategory(nextCategory);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setFormError("Enter an amount greater than 0.");
      return;
    }
    if (!desc.trim()) {
      setFormError("Add a short description.");
      return;
    }
    const trimmedDesc = desc.trim();
    const duplicates = findDateAmountDuplicates(entries, {
      date,
      amount: num,
      excludeId: editingId,
    });
    if (duplicates.length > 0 && !duplicateBypass) {
      setFormError("");
      return;
    }
    const savedCategory = resolveFormCategory(formType, categoryRef.current);
    const nextRules = saveCategoryRule(
      categoryRulesRef.current,
      trimmedDesc,
      formType,
      savedCategory
    );
    categoryRulesRef.current = nextRules;
    setCategoryRules(nextRules);

    if (editingId) {
      setEntries((prev) =>
        prev.map((en) =>
          en.id === editingId
            ? {
                ...en,
                amount: num,
                description: trimmedDesc,
                category: savedCategory,
                date: date || todayStr(),
                type: formType,
              }
            : en
        )
      );
    } else {
      const newEntry = {
        id: uid(),
        type: formType,
        amount: num,
        description: trimmedDesc,
        category: savedCategory,
        date: date || todayStr(),
        recordedAt: new Date().toISOString(),
      };
      setEntries((prev) => [newEntry, ...prev]);

      if (formRecurring) {
        const template = {
          id: uid(),
          type: formType,
          amount: num,
          description: trimmedDesc,
          category: savedCategory,
          frequency: formRecurringFreq,
          dayOfMonth: Number(date.slice(8, 10)),
          weekday: weekdayFromDate(date),
          startDate: date,
          createdAt: new Date().toISOString(),
          active: true,
        };
        setRecurring((prev) => [...prev, template]);
      }
    }
    resetForm();
  }

  const duplicateMatches = useMemo(() => {
    const num = parseFloat(amount);
    if (!date || !amount || isNaN(num) || num <= 0) return [];
    return findDateAmountDuplicates(entries, {
      date,
      amount: num,
      excludeId: editingId,
    });
  }, [entries, date, amount, editingId]);

  useEffect(() => {
    if (duplicateMatches.length === 0) setDuplicateBypass(false);
  }, [duplicateMatches.length, date, amount]);

  function handleAmountChange(value) {
    setAmount(value);
    setDuplicateBypass(false);
  }

  function handleDateChange(value) {
    setDate(value);
    setDuplicateBypass(false);
  }

  function suggestCategoryFromDesc(value) {
    if (categoryLocked || !value.trim()) return;
    const matched = resolveCategory(value, formType, categoryRulesRef.current);
    setCategory(matched);
  }

  function handleDescChange(value) {
    setDesc(value);
    suggestCategoryFromDesc(value);
  }

  function handleCategoryChange(value) {
    setCategory(value);
    // Only lock when overriding after description was entered
    if (desc.trim()) setCategoryLocked(true);
  }

  function deleteRecurring(id) {
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleRecurringActive(id) {
    setRecurring((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, active: r.active === false ? true : false } : r
      )
    );
  }

  function handleEdit(en) {
    setFormType(en.type);
    setEditingId(en.id);
    setAmount(String(en.amount));
    setDesc(en.description);
    setCategory(resolveFormCategory(en.type, en.category));
    setDate(en.date);
    setFormRecurring(false);
    setCategoryLocked(true);
    setDuplicateBypass(false);
    setFormError("");
  }

  function handleDelete(id) {
    setEntries((prev) => prev.filter((en) => en.id !== id));
    if (editingId === id) resetForm();
  }

  function startListening() {
    if (!voiceSupported) {
      setVoiceNote("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceNote("");
      setVoiceTranscript("");
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "no-speech") {
        setVoiceNote("Didn't catch that. Tap the mic and try again.");
      } else if (event.error === "not-allowed" || event.error === "denied") {
        setVoiceNote("Microphone access was blocked. Allow it and retry.");
      } else {
        setVoiceNote("Voice input hit a snag. Try again.");
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) recognitionRef.current.stop();
  }

  useEffect(() => {
    if (!voiceTranscript || isListening) return;
    const { amount: parsedAmount, description, category: parsedCat } =
      parseVoiceText(voiceTranscript, formType, categoryRules);
    if (parsedAmount) setAmount(String(parsedAmount));
    if (description) setDesc(description);
    setCategory(parsedCat);
    setCategoryLocked(false);
    setVoiceNote(
      `Heard: "${voiceTranscript.trim()}" \u2014 review the fields below and add the entry.`
    );
    setVoiceTranscript("");
  }, [voiceTranscript, isListening, formType, categoryRules]);

  const weekRange = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);

  const years = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 4)));
    set.add(todayStr().slice(0, 4));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const months = useMemo(() => {
    const set = new Set(
      entries
        .filter((e) => e.date.slice(0, 4) === year)
        .map((e) => e.date.slice(0, 7))
    );
    const currentMonth = todayStr().slice(0, 7);
    if (currentMonth.slice(0, 4) === year) set.add(currentMonth);
    return Array.from(set).sort().reverse();
  }, [entries, year]);

  useEffect(() => {
    if (periodMode !== "month") return;
    if (months.length === 0) return;
    if (!months.includes(month)) setMonth(months[0]);
  }, [periodMode, months, month]);

  const periodEntries = useMemo(() => {
    let list;
    if (periodMode === "year") {
      list = entries.filter((e) => e.date.slice(0, 4) === year);
    } else if (periodMode === "month") {
      list = entries.filter((e) => e.date.slice(0, 7) === month);
    } else {
      list = entries.filter(
        (e) => e.date >= weekRange.startStr && e.date <= weekRange.endStr
      );
    }
    if (periodDrillDay) {
      list = list.filter((e) => e.date === periodDrillDay);
    }
    return list;
  }, [entries, periodMode, year, month, weekRange, periodDrillDay]);

  const periodLabel = periodDrillDay
    ? fmtDateFull(periodDrillDay)
    : periodMode === "year"
    ? year
    : periodMode === "month"
    ? monthLabel(month)
    : weekLabel(weekRange);

  function switchPeriodMode(mode) {
    setPeriodMode(mode);
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  function drillToYearView() {
    setPeriodMode("year");
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  function drillToMonth(ym) {
    setYear(ym.slice(0, 4));
    setMonth(ym);
    setPeriodMode("month");
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  function drillToWeek(dateStr) {
    setWeekAnchor(dateStr);
    setPeriodMode("week");
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  function drillToDay(dateStr) {
    setPeriodDrillDay(dateStr);
    setFilterCat("all");
  }

  function drillToCategory(categoryId, type) {
    setFilterType(type);
    setFilterCat((prev) => (prev === categoryId ? "all" : categoryId));
  }

  function clearPeriodDrill() {
    setPeriodDrillDay(null);
    setFilterCat("all");
  }

  const globalSearchActive = Boolean(search.trim());

  const displayEntries = useMemo(() => {
    if (globalSearchActive) {
      return filterEntriesGlobal(entries, search, catInfoFor, {
        type: filterType,
        category: filterCat,
      });
    }
    return periodEntries
      .filter((e) => filterType === "all" || e.type === filterType)
      .filter((e) => filterCat === "all" || e.category === filterCat)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [
    entries,
    periodEntries,
    filterType,
    filterCat,
    search,
    globalSearchActive,
  ]);

  const expenseEntries = useMemo(
    () => displayEntries.filter((e) => e.type === "expense"),
    [displayEntries]
  );
  const investmentEntries = useMemo(
    () => displayEntries.filter((e) => e.type === "investment"),
    [displayEntries]
  );
  const incomeEntries = useMemo(
    () => displayEntries.filter((e) => e.type === "income"),
    [displayEntries]
  );

  function renderEntryRows(list) {
    if (list.length === 0) {
      return (
        <div style={{ fontSize: 13, color: "#74836A", padding: "8px 0" }}>
          No entries in this section for the current view.
        </div>
      );
    }
    return (
      <div
        style={{
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          overflow: "hidden",
          background: "#FFFDF8",
        }}
      >
        {list.map((en, i) => {
          const cat = catInfoFor(en.type, en.category);
          const isIncome = en.type === "income";
          const isInvestment = en.type === "investment";
          const amountColor = isIncome
            ? "#2F6B4F"
            : isInvestment
            ? "#4A5A91"
            : "#1F2A22";
          const amountPrefix = isIncome ? "+" : isInvestment ? "↗" : "-";
          return (
            <div
              key={en.id}
              className="row-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 18px",
                borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "#74836A",
                  width: 92,
                  flexShrink: 0,
                  lineHeight: 1.3,
                }}
              >
                <div>{fmtDateFull(en.date)}</div>
                {en.recordedAt && en.date !== en.recordedAt.slice(0, 10) && (
                  <div style={{ fontSize: 10, color: "#A69C82", marginTop: 2 }}>
                    Logged {fmtDateFull(en.recordedAt.slice(0, 10))}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    color: "#1F2A22",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {en.description}
                </div>
                {en.label && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#3C6E91",
                      marginTop: 3,
                    }}
                  >
                    {en.label}
                  </div>
                )}
              </div>
              <div
                className="cat-stamp"
                style={{ color: cat.color, borderColor: cat.color }}
              >
                {cat.label}
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: amountColor,
                  width: 90,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {amountPrefix}
                {fmtMoney(en.amount)}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleEdit(en)}
                  title="Edit"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#74836A",
                    fontSize: 13,
                    padding: 4,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(en.id)}
                  title="Delete"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#A93B3B",
                    fontSize: 13,
                    padding: 4,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const globalSearchTotals = useMemo(() => {
    if (!globalSearchActive) return null;
    const expense = displayEntries
      .filter((e) => e.type === "expense")
      .reduce((s, e) => s + e.amount, 0);
    const income = displayEntries
      .filter((e) => e.type === "income")
      .reduce((s, e) => s + e.amount, 0);
    const investment = displayEntries
      .filter((e) => e.type === "investment")
      .reduce((s, e) => s + e.amount, 0);
    return { expense, income, investment, count: displayEntries.length };
  }, [displayEntries, globalSearchActive]);

  const periodIncomeTotal = useMemo(
    () =>
      periodEntries
        .filter((e) => e.type === "income")
        .reduce((s, e) => s + e.amount, 0),
    [periodEntries]
  );
  const periodExpenseTotal = useMemo(
    () =>
      periodEntries
        .filter((e) => e.type === "expense")
        .reduce((s, e) => s + e.amount, 0),
    [periodEntries]
  );
  const periodInvestmentTotal = useMemo(
    () =>
      periodEntries
        .filter((e) => e.type === "investment")
        .reduce((s, e) => s + e.amount, 0),
    [periodEntries]
  );
  const periodNet =
    periodIncomeTotal - periodExpenseTotal - periodInvestmentTotal;

  const catTotals = useMemo(() => {
    const map = {};
    periodEntries
      .filter((e) => e.type === "expense")
      .forEach((e) => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });
    return Object.entries(map)
      .map(([id, total]) => ({ id, total, ...catMap[id] }))
      .sort((a, b) => b.total - a.total);
  }, [periodEntries]);

  const maxCatTotal = catTotals.length ? catTotals[0].total : 1;

  const investmentTotals = useMemo(() => {
    const map = {};
    periodEntries
      .filter((e) => e.type === "investment")
      .forEach((e) => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });
    return Object.entries(map)
      .map(([id, total]) => ({ id, total, ...investmentCatMap[id] }))
      .filter((c) => c.label)
      .sort((a, b) => b.total - a.total);
  }, [periodEntries]);

  const maxInvestmentTotal = investmentTotals.length
    ? investmentTotals[0].total
    : 1;

  const monthlyExpenseTotals = useMemo(() => {
    if (periodMode !== "year") return [];
    const totals = Array.from({ length: 12 }, (_, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
      const total = entries
        .filter((e) => e.type === "expense" && e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + e.amount, 0);
      return { ym, total, label: monthNameOnly(ym) };
    });
    return totals.filter((t) => t.total > 0);
  }, [entries, year, periodMode]);

  const maxMonthlyTotal = monthlyExpenseTotals.length
    ? Math.max(...monthlyExpenseTotals.map((t) => t.total))
    : 1;

  const weeklyExpenseTotals = useMemo(() => {
    if (periodMode !== "month" || periodDrillDay) return [];
    return getWeeklyExpenseTotals(entries, month);
  }, [entries, month, periodMode, periodDrillDay]);

  const maxWeeklyTotal = weeklyExpenseTotals.length
    ? Math.max(...weeklyExpenseTotals.map((t) => t.total))
    : 1;

  const dailyExpenseTotals = useMemo(() => {
    if (periodMode !== "week" || periodDrillDay) return [];
    return getDailyExpenseTotals(
      entries,
      weekRange.startStr,
      weekRange.endStr
    );
  }, [entries, weekRange, periodMode, periodDrillDay]);

  const maxDailyTotal = dailyExpenseTotals.length
    ? Math.max(...dailyExpenseTotals.map((t) => t.total))
    : 1;

  const categoryRuleList = useMemo(
    () =>
      Object.entries(categoryRules).map(([pattern, rule]) => ({
        pattern,
        ...rule,
        label: catInfoFor(rule.type, rule.category)?.label ?? rule.category,
      })),
    [categoryRules]
  );

  function updateBudgetDraft(id, value) {
    setBudgetDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitBudget(id) {
    const raw = budgetDrafts[id];
    const num = parseFloat(raw);
    setBudgets((prev) => {
      const next = { ...prev };
      if (!raw || isNaN(num) || num <= 0) {
        delete next[id];
      } else {
        next[id] = num;
      }
      return next;
    });
  }

  function budgetValueFor(id) {
    if (budgetDrafts[id] !== undefined) return budgetDrafts[id];
    return budgets[id] ? String(budgets[id]) : "";
  }

  async function persistStatementProfile(columns, mapping) {
    if (!mappingIsValid(mapping) || !storageHydrated) return;
    const signature = columnSignature(columns);
    setStatementProfiles((prev) => {
      const next = { ...prev, [signature]: mapping };
      window.storage
        .set("ledger-statement-profiles", JSON.stringify(next))
        .catch(() => {});
      return next;
    });
  }

  async function processStatementFile(file) {
    if (!file) return;

    setImportNote("");
    try {
      const { columns, rows, fileName } = await readStatementFile(file);
      if (rows.length === 0) {
        setImportNote("Statement file is empty.");
        return;
      }
      const mapping = resolveColumnMapping(columns, statementProfiles);
      setStatementImport({
        fileName,
        columns,
        rows,
        mapping,
        mappingRemembered:
          profilesLoaded &&
          Boolean(statementProfiles[columnSignature(columns)]),
      });
    } catch (err) {
      setImportNote(err.message || "Could not read the statement file.");
      console.error(err);
    }
  }

  async function handleStatementFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    await processStatementFile(file);
  }

  function handleStatementDrop(e) {
    e.preventDefault();
    setStatementDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processStatementFile(file);
  }

  function updateStatementMapping(field, column) {
    setStatementImport((prev) =>
      prev
        ? {
            ...prev,
            mapping: { ...prev.mapping, [field]: column },
          }
        : prev
    );
  }

  function handleStatementPreview() {
    if (!statementImport) return;
    const result = parseStatementWithMapping(
      statementImport.rows,
      statementImport.mapping,
      entriesRef.current,
      categoryRulesRef.current
    );
    if (result.rows.length === 0 && result.errors.length === 0) {
      setImportNote("No transactions found with the current column mapping.");
      return;
    }
    persistStatementProfile(statementImport.columns, statementImport.mapping);
    setImportPreview(
      createImportPreviewState(result, {
        fileName: statementImport.fileName,
        source: "statement",
      })
    );
    setStatementImport(null);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportNote("");
    try {
      const result = await parseExcelFile(file, entriesRef.current, categoryRules);
      if (result.rows.length === 0 && result.errors.length === 0) {
        setImportNote("No rows found to import.");
        return;
      }
      setImportPreview(createImportPreviewState(result, { fileName: file.name }));
    } catch (err) {
      setImportNote("Import failed. Check that the file matches the IDL format.");
      console.error(err);
    }
  }

  function patchImportPreviewRow(previewId, patch) {
    setImportPreview((prev) => {
      if (!prev) return prev;
      let rows = updateImportPreviewRow(prev.rows, previewId, patch);
      if (patch.type) {
        rows = rows.map((row) => {
          if (row.previewId !== previewId) return row;
          const cats = catsForType(row.type);
          if (!cats.some((c) => c.id === row.category)) {
            return { ...row, category: cats[0].id };
          }
          return row;
        });
      }
      return { ...prev, rows };
    });
  }

  function setAllImportRowsIncluded(included) {
    setImportPreview((prev) =>
      prev
        ? { ...prev, rows: setAllImportPreviewIncluded(prev.rows, included) }
        : prev
    );
  }

  function confirmImport() {
    if (!importPreview) return;
    const imported = buildEntriesFromPreview(importPreview.rows);
    const existingKeys = new Set(entries.map(entryKey));
    const newEntries = imported.filter((entry) => !existingKeys.has(entryKey(entry)));
    let mergedCount = 0;

    if (newEntries.length > 0) {
      setEntries((prev) => {
        const merged = mergeImportedEntries(prev, imported);
        mergedCount = merged.length - prev.length;
        return merged;
      });
      learnCategoryRulesFromEntries(newEntries);
    }

    if (importPreview.errors.length > 0) {
      console.warn("Import parse errors:", importPreview.errors);
    }

    setImportConfirm({
      ...buildImportConfirmationSummary({
        rows: importPreview.rows,
        errors: importPreview.errors,
        fileName: importPreview.fileName,
        mergedEntries: newEntries,
        mergedCount: newEntries.length,
      }),
      label: defaultImportLabel(importPreview.fileName),
    });
    setImportPreview(null);
  }

  function finishImportConfirm() {
    if (!importConfirm) return;
    const trimmedLabel = String(importConfirm.label || "").trim();
    if (trimmedLabel && importConfirm.importedIds.length > 0) {
      const ids = new Set(importConfirm.importedIds);
      setEntries((prev) =>
        prev.map((entry) =>
          ids.has(entry.id) ? { ...entry, label: trimmedLabel } : entry
        )
      );
    }

    const { mergedCount, attemptedCount, stats, parseErrors } = importConfirm;
    const parts = [];
    if (mergedCount > 0) {
      parts.push(`Imported ${mergedCount} new entr${mergedCount === 1 ? "y" : "ies"}`);
      if (trimmedLabel) parts.push(`tagged "${trimmedLabel}"`);
    } else if (attemptedCount > 0) {
      parts.push("No new entries added (all selected rows already exist)");
    } else {
      parts.push("Nothing imported");
    }
    if (stats.included > attemptedCount) {
      parts.push(
        `${stats.included - attemptedCount} selected row${stats.included - attemptedCount === 1 ? "" : "s"} skipped (invalid fields)`
      );
    }
    if (stats.total - stats.included > 0) {
      parts.push(`${stats.total - stats.included} excluded`);
    }
    if (parseErrors > 0) {
      parts.push(
        `${parseErrors} source row${parseErrors === 1 ? "" : "s"} could not be parsed`
      );
    }
    setImportNote(parts.join("; ") + ".");
    setImportConfirm(null);
  }

  function buildCurrentBackup() {
    return createBackup({ entries, budgets, recurring, categoryRules });
  }

  function exportBackup() {
    downloadBackup(buildCurrentBackup());
    setBackupNote("Full backup downloaded.");
  }

  async function runDriveBackup({ manual = false, forceAuth = false } = {}) {
    if (!cloudSync || !userHasGoogleProvider(user)) {
      setBackupNote("Sign in with Google to back up to Drive.");
      return false;
    }
    if (driveBackupBusy) return false;

    setDriveBackupBusy(true);
    if (manual) setBackupNote("");
    try {
      const result = await runGoogleDriveBackup({
        auth,
        googleProvider,
        backup: buildCurrentBackup(),
        schedule: backupSchedule,
        forceAuth,
      });
      const nextSchedule = markBackupCompleted({
        ...backupSchedule,
        driveFolderId: result.folderId,
      });
      setBackupSchedule(nextSchedule);
      setBackupNote(
        manual
          ? `Backup saved to Google Drive (${result.uploaded.name}).`
          : `Scheduled backup saved to Google Drive (${result.uploaded.name}).`
      );
      return true;
    } catch (err) {
      const message = err?.message || "Google Drive backup failed.";
      setBackupNote(manual ? message : `Scheduled backup skipped: ${message}`);
      console.error(err);
      return false;
    } finally {
      setDriveBackupBusy(false);
    }
  }

  async function enableDriveBackupSchedule() {
    if (!cloudSync || !userHasGoogleProvider(user)) {
      setBackupNote("Sign in with Google to use scheduled Drive backup.");
      return;
    }
    const ok = await runDriveBackup({ manual: true, forceAuth: true });
    if (ok) {
      setBackupSchedule((prev) => ({ ...prev, enabled: true }));
    }
  }

  useEffect(() => {
    if (
      !storageHydrated ||
      !backupScheduleLoaded ||
      !cloudSync ||
      !userHasGoogleProvider(user) ||
      !backupSchedule.enabled
    ) {
      return;
    }
    if (!shouldRunScheduledBackup(backupSchedule)) return;
    if (driveBackupRanRef.current) return;

    driveBackupRanRef.current = true;
    runDriveBackup({ manual: false }).then((ok) => {
      if (!ok) driveBackupRanRef.current = false;
    });
  }, [
    storageHydrated,
    backupScheduleLoaded,
    cloudSync,
    user,
    backupSchedule.enabled,
    backupSchedule.lastBackupAt,
    backupSchedule.frequency,
  ]);

  async function handleRestoreBackup(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBackupNote("");
    try {
      const text = await file.text();
      const data = parseBackupFile(text);
      setEntries(data.entries.map((en) => ({ type: "expense", ...en })));
      setBudgets(data.budgets);
      setRecurring(data.recurring);
      setCategoryRules(data.categoryRules);
      setBackupNote(
        `Restored backup from ${data.exportedAt ? data.exportedAt.slice(0, 10) : "file"} (${data.entries.length} entries).`
      );
    } catch (err) {
      setBackupNote(err.message || "Restore failed.");
    }
  }

  function exportCSV() {
    const header = ["Date", "Type", "Category", "Description", "Amount (INR)"];
    const rows = displayEntries.map((en) => {
      const info = catInfoFor(en.type, en.category);
      return [
        en.date,
        en.type,
        info ? info.label : en.category,
        en.description,
        en.amount.toFixed(2),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map(csvValue).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const periodTag =
      periodMode === "year"
        ? year
        : periodMode === "month"
        ? month
        : `${weekRange.startStr}_to_${weekRange.endStr}`;
    a.href = url;
    a.download = `ledger-${periodTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const categoryFilterOptions = useMemo(() => {
    if (filterType === "income") return INCOME_CATEGORIES;
    if (filterType === "expense") return CATEGORIES;
    if (filterType === "investment") return INVESTMENT_CATEGORIES;
    return null;
  }, [filterType]);

  const importPreviewStats = useMemo(
    () => (importPreview ? getImportPreviewStats(importPreview.rows) : null),
    [importPreview]
  );

  function renderDrillBar({
    id,
    label,
    total,
    maxTotal,
    color,
    active = false,
    onClick,
    labelWidth = 72,
  }) {
    return (
      <button
        type="button"
        key={id}
        className={`drill-bar${active ? " drill-bar-active" : ""}`}
        onClick={onClick}
        title="Click to filter"
      >
        <div className="drill-bar-label" style={{ width: labelWidth }}>
          {label}
        </div>
        <div className="drill-bar-track">
          <div
            className="drill-bar-fill"
            style={{
              width: `${maxTotal > 0 ? (total / maxTotal) * 100 : 0}%`,
              background: color,
            }}
          />
        </div>
        <div className="drill-bar-amount">{fmtMoney(total)}</div>
      </button>
    );
  }

  const activeCategoryLabel =
    filterCat !== "all"
      ? catInfoFor(filterType === "all" ? "expense" : filterType, filterCat)?.label
      : null;

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#F6F1E6",
        minHeight: "100vh",
        padding: "0",
        color: "#1F2A22",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        .ledger-input, .ledger-select {
          font-family: 'Inter', sans-serif;
          background: #FFFDF8;
          border: 1px solid #D8CDB4;
          border-radius: 4px;
          padding: 9px 10px;
          font-size: 14px;
          color: #1F2A22;
          width: 100%;
          outline: none;
        }
        .ledger-input:focus, .ledger-select:focus {
          border-color: #C08A28;
          box-shadow: 0 0 0 3px rgba(192,138,40,0.15);
        }
        .ledger-btn {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #1F2A22;
          color: #F6F1E6;
          border: none;
          border-radius: 4px;
          padding: 11px 18px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .ledger-btn:hover { opacity: 0.85; }
        .ledger-btn-ghost {
          background: transparent;
          color: #4A5A4E;
          border: 1px solid #D8CDB4;
        }
        .ledger-btn-ghost:hover { background: #EDE6D6; opacity: 1; }
        .import-preview-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .import-preview-table th {
          position: sticky;
          top: 0;
          background: #F6F1E6;
          z-index: 1;
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #74836A;
          padding: 8px 6px;
          border-bottom: 1px solid #D8CDB4;
        }
        .import-preview-table td {
          padding: 6px;
          border-bottom: 1px dashed #E4DCC5;
          vertical-align: middle;
        }
        .import-preview-table tr.row-excluded td { opacity: 0.45; }
        .import-preview-table tr.row-duplicate td { background: #FBF6EA; }
        .import-preview-table tr.row-invalid td { background: #FDF0F0; }
        .import-preview-input {
          font-family: 'Inter', sans-serif;
          background: #FFFDF8;
          border: 1px solid #D8CDB4;
          border-radius: 4px;
          padding: 6px 8px;
          font-size: 12.5px;
          color: #1F2A22;
          width: 100%;
          outline: none;
        }
        .import-preview-input:focus {
          border-color: #C08A28;
          box-shadow: 0 0 0 2px rgba(192,138,40,0.12);
        }
        .import-preview-check { width: 16px; height: 16px; cursor: pointer; }
        .drill-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 5px 8px;
          margin: -2px -8px;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 5px;
          text-align: left;
          font: inherit;
          color: inherit;
        }
        .drill-bar:hover { background: #F6F1E6; }
        .drill-bar-active {
          background: #EEF4F0;
          box-shadow: inset 0 0 0 1px #2F6B4F;
        }
        .drill-bar-label {
          font-size: 12.5px;
          color: #1F2A22;
          flex-shrink: 0;
          text-align: left;
        }
        .drill-bar-track {
          flex: 1;
          background: #EDE6D6;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
        }
        .drill-bar-fill { height: 100%; border-radius: 4px; }
        .drill-bar-amount {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12.5px;
          width: 70px;
          text-align: right;
          color: #1F2A22;
          flex-shrink: 0;
        }
        .drill-crumb {
          background: #FFFDF8;
          border: 1px solid #D8CDB4;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          color: #1F2A22;
          cursor: pointer;
        }
        .drill-crumb:hover { background: #F6F1E6; }
        .drill-crumb-active {
          background: #EEF4F0;
          border-color: #2F6B4F;
          color: #2F6B4F;
        }
        .seg-btn {
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          padding: 8px 14px;
          border: 1px solid #D8CDB4;
          background: #FFFDF8;
          color: #4A5A4E;
          cursor: pointer;
        }
        .seg-btn.active {
          background: #1F2A22;
          color: #F6F1E6;
          border-color: #1F2A22;
        }
        .cat-stamp {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px dashed;
          white-space: nowrap;
        }
        .row-hover:hover { background: #FBF8F1 !important; }
        .ledger-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(31,42,34,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .ledger-modal {
          background: #FFFDF8;
          border: 1px solid #D8CDB4;
          border-radius: 8px;
          max-width: 640px;
          width: 100%;
          max-height: 85vh;
          overflow: auto;
          padding: 22px 24px;
        }
        .ledger-search-wrap {
          position: relative;
          margin-bottom: 28px;
        }
        .ledger-search-input {
          padding-left: 36px;
          padding-right: 72px;
        }
        .ledger-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #74836A;
          font-size: 14px;
          pointer-events: none;
        }
        .ledger-search-hint {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 10.5px;
          color: #A69C82;
          letter-spacing: 0.04em;
        }
        ::placeholder { color: #A69C82; }
        @media (max-width: 720px) {
          .lg-grid { grid-template-columns: 1fr !important; }
          .lg-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Header */}
        <div
          className="lg-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 32,
            borderBottom: "2px solid #1F2A22",
            paddingBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#74836A",
                marginBottom: 4,
              }}
            >
              Daily ledger
              {cloudSync && (
                <span
                  style={{
                    marginLeft: 10,
                    color: "#2F6B4F",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                  }}
                >
                  Cloud sync on
                </span>
              )}
            </div>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 34,
                fontWeight: 600,
                margin: 0,
                color: "#1F2A22",
              }}
            >
              Expense Book
            </h1>
            {user?.email && (
              <div style={{ fontSize: 12.5, color: "#74836A", marginTop: 6 }}>
                {user.email}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {onSignOut && (
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 500,
                  padding: "9px 14px",
                }}
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#2F6B4F",
                }}
              >
                +{fmtMoney(periodIncomeTotal)}
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#A93B3B",
                  marginTop: 2,
                }}
              >
                -{fmtMoney(periodExpenseTotal)}
              </div>
              {periodInvestmentTotal > 0 && (
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#4A5A91",
                    marginTop: 2,
                  }}
                >
                  ↗{fmtMoney(periodInvestmentTotal)}
                </div>
              )}
            </div>

            {/* Signature stamp: net balance */}
            <div
              style={{
                position: "relative",
                border: `2px solid ${periodNet >= 0 ? "#2F6B4F" : "#A93B3B"}`,
                borderRadius: "50%",
                width: 128,
                height: 128,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(-4deg)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 5,
                  border: `1px dashed ${periodNet >= 0 ? "#2F6B4F" : "#A93B3B"}`,
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: periodNet >= 0 ? "#2F6B4F" : "#A93B3B",
                }}
              >
                Net
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 18,
                  fontWeight: 600,
                  color: periodNet >= 0 ? "#2F6B4F" : "#A93B3B",
                  lineHeight: 1.2,
                }}
              >
                {fmtMoney(periodNet)}
              </div>
              <div
                style={{
                  fontSize: 8.5,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: periodNet >= 0 ? "#2F6B4F" : "#A93B3B",
                  textAlign: "center",
                  padding: "0 10px",
                }}
              >
                {periodLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Global search */}
        <div className="ledger-search-wrap">
          <span className="ledger-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchInputRef}
            className="ledger-input ledger-search-input"
            type="search"
            placeholder="Search all entries — description, category, amount, date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search all entries"
          />
          {!search && (
            <span className="ledger-search-hint">Ctrl+K</span>
          )}
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#74836A",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Clear
            </button>
          )}
        </div>

        <input
          ref={statementInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={handleStatementFile}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />

        {/* Primary input: bank statement import */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setStatementDragActive(true);
          }}
          onDragLeave={() => setStatementDragActive(false)}
          onDrop={handleStatementDrop}
          style={{
            background: statementDragActive ? "#F0EBDD" : "#FFFDF8",
            border: statementDragActive
              ? "2px dashed #2F6B4F"
              : "2px solid #1F2A22",
            borderRadius: 8,
            padding: "24px 26px",
            marginBottom: 28,
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#2F6B4F",
                  marginBottom: 6,
                }}
              >
                Primary input
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#1F2A22",
                  marginBottom: 8,
                }}
              >
                Import bank statement
              </div>
              <div style={{ fontSize: 13.5, color: "#74836A", lineHeight: 1.55 }}>
                Download your monthly statement as CSV or Excel, then import it here.
                Debits become expenses, credits become income, and saved category
                rules apply automatically.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="ledger-btn"
                style={{
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 600,
                  padding: "12px 20px",
                }}
                onClick={() => statementInputRef.current?.click()}
              >
                Choose statement file
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#3C6E91",
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                Import Excel (legacy format)
              </button>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: statementDragActive ? "#2F6B4F" : "#74836A",
            }}
          >
            {statementDragActive
              ? "Drop your statement file here"
              : "Or drag and drop a .csv, .xlsx, or .xls file"}
          </div>
        </div>
        {importNote && (
          <div
            style={{
              fontSize: 12.5,
              color: "#3C6E91",
              marginTop: -20,
              marginBottom: 28,
            }}
          >
            {importNote}
          </div>
        )}

        {/* Manual entry — collapsed by default; statement import is primary */}
        <CollapsiblePanel
          title={editingId ? "Edit entry" : "Manual entry"}
          meta={
            editingId
              ? undefined
              : "Cash, one-offs, investments, or corrections"
          }
          open={editingId || showManualEntry}
          hideToggle={Boolean(editingId)}
          onToggle={() => setShowManualEntry((v) => !v)}
        >
        <form
          onSubmit={handleSubmit}
          style={{
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex" }}>
                <button
                  type="button"
                  className={`seg-btn ${formType === "expense" ? "active" : ""}`}
                  style={{ borderRadius: "4px 0 0 4px" }}
                  onClick={() => switchFormType("expense")}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={`seg-btn ${formType === "income" ? "active" : ""}`}
                  style={{ borderRadius: 0, borderLeft: "none" }}
                  onClick={() => switchFormType("income")}
                >
                  Income
                </button>
                <button
                  type="button"
                  className={`seg-btn ${formType === "investment" ? "active" : ""}`}
                  style={{ borderRadius: "0 4px 4px 0", borderLeft: "none" }}
                  onClick={() => switchFormType("investment")}
                >
                  Investment
                </button>
            </div>
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className="ledger-btn"
              style={{
                background: isListening ? "#A93B3B" : "#1F2A22",
                display: "flex",
                alignItems: "center",
                gap: 7,
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isListening ? "#F6F1E6" : "#C08A28",
                  animation: isListening ? "pulse 1s infinite" : "none",
                }}
              />
              {isListening
                ? "Listening... tap to stop"
                : formType === "income"
                ? "Speak income"
                : formType === "investment"
                ? "Speak investment"
                : "Speak an expense"}
            </button>
          </div>

          {voiceNote && (
            <div
              style={{
                fontSize: 12.5,
                color: "#4A5A4E",
                background: "#F6F1E6",
                border: "1px solid #E4DCC5",
                borderRadius: 4,
                padding: "8px 10px",
                marginBottom: 14,
              }}
            >
              {voiceNote}
            </div>
          )}
          {isListening && voiceTranscript && (
            <div
              style={{
                fontSize: 12.5,
                fontStyle: "italic",
                color: "#74836A",
                marginBottom: 14,
              }}
            >
              "{voiceTranscript}"
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
            className="lg-grid"
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#74836A",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Amount
              </label>
              <input
                className="ledger-input"
                type="number"
                step="0.01"
                min="0"
                placeholder=""
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#74836A",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Transaction date
              </label>
              <input
                className="ledger-input"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 5,
                }}
              >
                <span style={{ fontSize: 12, color: "#74836A" }}>
                  {formatTransactionDate(date)}
                  {date === todayStr() && (
                    <span style={{ color: "#2F6B4F", fontWeight: 600 }}> · Today</span>
                  )}
                </span>
                {date !== todayStr() && !editingId && (
                  <button
                    type="button"
                    onClick={() => handleDateChange(todayStr())}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#3C6E91",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Use today
                  </button>
                )}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#74836A",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Category
              </label>
              <select
                className="ledger-select"
                value={resolveFormCategory(formType, category)}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {catsForType(formType).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#74836A",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 5,
              }}
            >
              Description
            </label>
            <input
              className="ledger-input"
              type="text"
              placeholder={
                formType === "income"
                  ? "Freelance payment from client"
                  : formType === "investment"
                  ? "HDFC Flexi Cap SIP"
                  : "Chai and samosa with Priya"
              }
              value={desc}
              onChange={(e) => handleDescChange(e.target.value)}
            />
          </div>

          {!editingId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#4A5A4E",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formRecurring}
                  onChange={(e) => setFormRecurring(e.target.checked)}
                />
                Repeat this entry
                {formType === "investment" && (
                  <span style={{ color: "#74836A", fontSize: 12 }}>
                    {" "}(recommended for SIP / LIC)
                  </span>
                )}
              </label>
              {formRecurring && (
                <select
                  className="ledger-select"
                  style={{ width: "auto", minWidth: 120 }}
                  value={formRecurringFreq}
                  onChange={(e) => setFormRecurringFreq(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              )}
            </div>
          )}

          {duplicateMatches.length > 0 && (
            <div
              style={{
                fontSize: 13,
                color: "#8B5E34",
                background: "#FBF3E6",
                border: "1px solid #E4C88A",
                borderRadius: 4,
                padding: "10px 12px",
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Possible duplicate
              </div>
              <div style={{ color: "#4A5A4E", marginBottom: 8 }}>
                {fmtMoney(parseFloat(amount))} on {formatTransactionDate(date)}{" "}
                matches {duplicateMatches.length} existing entr
                {duplicateMatches.length === 1 ? "y" : "ies"}:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {duplicateMatches.slice(0, 3).map((en) => {
                  const cat = catInfoFor(en.type, en.category);
                  return (
                    <div key={en.id} style={{ fontSize: 12.5, color: "#1F2A22" }}>
                      &bull; {en.description}
                      {cat?.label ? ` (${cat.label})` : ""} &mdash; {en.type}
                    </div>
                  );
                })}
                {duplicateMatches.length > 3 && (
                  <div style={{ fontSize: 12, color: "#74836A" }}>
                    + {duplicateMatches.length - 3} more
                  </div>
                )}
              </div>
              {!duplicateBypass ? (
                <button
                  type="button"
                  className="ledger-btn ledger-btn-ghost"
                  style={{
                    marginTop: 10,
                    textTransform: "none",
                    letterSpacing: "normal",
                    fontWeight: 500,
                    padding: "8px 12px",
                  }}
                  onClick={() => setDuplicateBypass(true)}
                >
                  Add anyway
                </button>
              ) : (
                <div style={{ fontSize: 12, color: "#74836A", marginTop: 8 }}>
                  Duplicate acknowledged &mdash; click Add entry to save.
                </div>
              )}
            </div>
          )}

          {formError && (
            <div style={{ color: "#A93B3B", fontSize: 13, marginBottom: 12 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              className="ledger-btn"
              onMouseDown={(e) => e.preventDefault()}
            >
              {editingId
                ? "Save changes"
                : duplicateMatches.length > 0 && duplicateBypass
                ? "Add entry anyway"
                : "Add entry"}
            </button>
            {editingId && (
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        </CollapsiblePanel>

        {/* Recurring entries */}
        <div
          style={{
            background: "#FFFDF8",
            border: "1px solid #D8CDB4",
            borderRadius: 8,
            marginBottom: 28,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowRecurring((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Fraunces', serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#1F2A22",
            }}
          >
            Recurring entries ({recurring.length})
            <span style={{ fontSize: 12, color: "#74836A" }}>
              {showRecurring ? "Hide" : "Show"}
            </span>
          </button>
          {showRecurring && (
            <div style={{ borderTop: "1px dashed #E4DCC5", padding: "12px 18px 16px" }}>
              {recurring.length === 0 ? (
                <div style={{ fontSize: 13, color: "#74836A" }}>
                  No recurring entries yet. Check &ldquo;Repeat this entry&rdquo; when adding Netflix, rent, salary, etc.
                </div>
              ) : (
                recurring.map((r, i) => {
                  const cat = catInfoFor(r.type, r.category);
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 0",
                        borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
                        flexWrap: "wrap",
                        opacity: r.active === false ? 0.55 : 1,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 14, color: "#1F2A22" }}>{r.description}</div>
                        <div style={{ fontSize: 12, color: "#74836A", marginTop: 2 }}>
                          {r.frequency === "weekly" ? "Every week" : `Day ${r.dayOfMonth} each month`}
                          {r.active === false && " · paused"}
                        </div>
                      </div>
                      <div
                        className="cat-stamp"
                        style={{ color: cat.color, borderColor: cat.color }}
                      >
                        {cat.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 13,
                          fontWeight: 600,
                          width: 80,
                          textAlign: "right",
                        }}
                      >
                        {fmtMoney(r.amount)}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRecurringActive(r.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#74836A",
                          fontSize: 12,
                        }}
                      >
                        {r.active === false ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurring(r.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#A93B3B",
                          fontSize: 12,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Period toggle + navigation */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex" }}>
            <button
              type="button"
              className={`seg-btn ${periodMode === "year" ? "active" : ""}`}
              style={{ borderRadius: "4px 0 0 4px" }}
              onClick={() => switchPeriodMode("year")}
            >
              Year
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "month" ? "active" : ""}`}
              style={{ borderRadius: 0, borderLeft: "none" }}
              onClick={() => switchPeriodMode("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "week" ? "active" : ""}`}
              style={{ borderRadius: "0 4px 4px 0", borderLeft: "none" }}
              onClick={() => switchPeriodMode("week")}
            >
              Week
            </button>
          </div>

          {periodMode === "year" ? (
            <select
              className="ledger-select"
              style={{ width: "auto", minWidth: 100 }}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPeriodDrillDay(null);
                setFilterCat("all");
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : periodMode === "month" ? (
            <>
              <select
                className="ledger-select"
                style={{ width: "auto", minWidth: 100 }}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPeriodDrillDay(null);
                  setFilterCat("all");
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="ledger-select"
                style={{ width: "auto", minWidth: 140 }}
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPeriodDrillDay(null);
                  setFilterCat("all");
                }}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthNameOnly(m)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{ padding: "9px 12px" }}
                onClick={() => {
                  const d = new Date(weekAnchor + "T00:00:00");
                  d.setDate(d.getDate() - 7);
                  setWeekAnchor(toISODate(d));
                  setPeriodDrillDay(null);
                  setFilterCat("all");
                }}
              >
                &larr;
              </button>
              <div
                style={{
                  fontSize: 13.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: "#1F2A22",
                  minWidth: 150,
                  textAlign: "center",
                }}
              >
                {weekLabel(weekRange)}
              </div>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                style={{ padding: "9px 12px" }}
                onClick={() => {
                  const d = new Date(weekAnchor + "T00:00:00");
                  d.setDate(d.getDate() + 7);
                  setWeekAnchor(toISODate(d));
                  setPeriodDrillDay(null);
                  setFilterCat("all");
                }}
              >
                &rarr;
              </button>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                onClick={() => {
                  setWeekAnchor(todayStr());
                  setPeriodDrillDay(null);
                  setFilterCat("all");
                }}
              >
                This week
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select
            className="ledger-select"
            style={{ width: "auto", minWidth: 130 }}
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setFilterCat("all");
            }}
          >
            <option value="all">All entries</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
            <option value="investment">Investments only</option>
          </select>
          <select
            className="ledger-select"
            style={{ width: "auto", minWidth: 160 }}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="all">All categories</option>
            {categoryFilterOptions ? (
              categoryFilterOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))
            ) : (
              <>
                <optgroup label="Expenses">
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Income">
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Investments">
                  {INVESTMENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={exportCSV}
            disabled={displayEntries.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={exportBackup}
          >
            Backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleRestoreBackup}
          />
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={() => backupInputRef.current?.click()}
          >
            Restore
          </button>
        </div>

        {!globalSearchActive && (periodDrillDay || filterCat !== "all") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "#74836A", fontWeight: 600 }}>Drill-down:</span>
            {periodMode === "year" && !periodDrillDay && (
              <button type="button" className="drill-crumb" onClick={drillToYearView}>
                {year}
              </button>
            )}
            {periodMode === "month" && (
              <>
                <button type="button" className="drill-crumb" onClick={drillToYearView}>
                  {year}
                </button>
                <span style={{ color: "#A69C82" }}>›</span>
                <button
                  type="button"
                  className={`drill-crumb${periodDrillDay ? "" : " drill-crumb-active"}`}
                  onClick={() => drillToMonth(month)}
                >
                  {monthNameOnly(month)}
                </button>
              </>
            )}
            {periodMode === "week" && (
              <button
                type="button"
                className={`drill-crumb${periodDrillDay ? "" : " drill-crumb-active"}`}
                onClick={() => {
                  if (periodDrillDay) setPeriodDrillDay(null);
                }}
              >
                {weekLabel(weekRange)}
              </button>
            )}
            {periodDrillDay && (
              <>
                {(periodMode === "month" || periodMode === "week") && (
                  <span style={{ color: "#A69C82" }}>›</span>
                )}
                <button type="button" className="drill-crumb drill-crumb-active">
                  {fmtDateFull(periodDrillDay)}
                </button>
              </>
            )}
            {activeCategoryLabel && (
              <>
                <span style={{ color: "#A69C82" }}>·</span>
                <button
                  type="button"
                  className="drill-crumb drill-crumb-active"
                  onClick={() => setFilterCat("all")}
                >
                  {activeCategoryLabel} ✕
                </button>
              </>
            )}
            <button
              type="button"
              className="drill-crumb"
              style={{ color: "#3C6E91" }}
              onClick={clearPeriodDrill}
            >
              Clear
            </button>
          </div>
        )}

        {!globalSearchActive &&
          !periodDrillDay &&
          filterCat === "all" &&
          (periodMode === "year" ||
            periodMode === "month" ||
            periodMode === "week") && (
            <div
              style={{
                fontSize: 12,
                color: "#74836A",
                marginTop: -12,
                marginBottom: 16,
              }}
            >
              Click a bar below to drill down
              {periodMode === "year"
                ? " to a month"
                : periodMode === "month"
                ? " to a week or category"
                : " to a day or category"}
              .
            </div>
          )}

        {backupNote && (
          <div
            style={{
              fontSize: 12.5,
              color: "#3C6E91",
              marginTop: -16,
              marginBottom: 20,
            }}
          >
            {backupNote}
          </div>
        )}

        {cloudSync && (
          <CollapsiblePanel
            title="Google Drive backup"
            meta={
              backupSchedule.enabled
                ? `${BACKUP_FREQUENCIES.find((f) => f.id === backupSchedule.frequency)?.label || "Daily"} schedule · Last: ${formatLastBackup(backupSchedule.lastBackupAt)}`
                : "Schedule automatic backups to your Google Drive"
            }
            open={showDriveBackup}
            onToggle={() => setShowDriveBackup((v) => !v)}
          >
            {!userHasGoogleProvider(user) ? (
              <div style={{ fontSize: 13.5, color: "#74836A", lineHeight: 1.55 }}>
                Scheduled Drive backup requires signing in with Google. Email/password
                accounts can still use local Backup / Restore.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13.5,
                    color: "#1F2A22",
                    cursor: driveBackupBusy ? "wait" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={backupSchedule.enabled}
                    disabled={driveBackupBusy}
                    onChange={(e) => {
                      if (e.target.checked) {
                        enableDriveBackupSchedule();
                      } else {
                        setBackupSchedule((prev) => ({ ...prev, enabled: false }));
                      }
                    }}
                  />
                  Enable scheduled backup to Google Drive
                </label>

                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#74836A",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    Frequency
                  </label>
                  <select
                    className="ledger-select"
                    style={{ maxWidth: 180 }}
                    value={backupSchedule.frequency}
                    disabled={!backupSchedule.enabled || driveBackupBusy}
                    onChange={(e) =>
                      setBackupSchedule((prev) => ({
                        ...prev,
                        frequency: e.target.value,
                      }))
                    }
                  >
                    {BACKUP_FREQUENCIES.map((freq) => (
                      <option key={freq.id} value={freq.id}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: 13, color: "#74836A", lineHeight: 1.55 }}>
                  Backups are saved to the <strong>Expense Book Backups</strong> folder in
                  your Google Drive when you open the app. The last 14 backups are kept.
                  <div style={{ marginTop: 6 }}>
                    Last backup: {formatLastBackup(backupSchedule.lastBackupAt)}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="ledger-btn ledger-btn-ghost"
                    style={{
                      textTransform: "none",
                      letterSpacing: "normal",
                      fontWeight: 500,
                    }}
                    disabled={driveBackupBusy}
                    onClick={() => runDriveBackup({ manual: true, forceAuth: true })}
                  >
                    {driveBackupBusy ? "Uploading..." : "Backup to Drive now"}
                  </button>
                </div>
              </div>
            )}
          </CollapsiblePanel>
        )}

        {statementImport && (
          <div
            className="ledger-modal-backdrop"
            onClick={() => setStatementImport(null)}
          >
            <div
              className="ledger-modal"
              style={{ maxWidth: 520 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Map statement columns
              </div>
              <div style={{ fontSize: 13, color: "#74836A", marginBottom: 16 }}>
                {statementImport.fileName} &mdash; {statementImport.rows.length} rows
                {statementImport.mappingRemembered && (
                  <span style={{ color: "#2F6B4F", fontWeight: 600 }}>
                    {" "}
                    &middot; Using saved column mapping
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {STATEMENT_MAP_FIELDS.map((field) => (
                  <div key={field.id}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#74836A",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        display: "block",
                        marginBottom: 5,
                      }}
                    >
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    <select
                      className="ledger-select"
                      value={statementImport.mapping[field.id] || ""}
                      onChange={(e) =>
                        updateStatementMapping(field.id, e.target.value)
                      }
                    >
                      <option value="">
                        {field.required ? "Select column" : "Not used"}
                      </option>
                      {statementImport.columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#74836A", marginTop: 14 }}>
                Debits become expenses; credits become income. Category rules apply
                automatically.
              </div>
              {!mappingIsValid(statementImport.mapping) && (
                <div style={{ fontSize: 12.5, color: "#A93B3B", marginTop: 10 }}>
                  Map Date, Description, and at least one amount column.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="ledger-btn"
                  onClick={handleStatementPreview}
                  disabled={!mappingIsValid(statementImport.mapping)}
                >
                  Preview import
                </button>
                <button
                  type="button"
                  className="ledger-btn ledger-btn-ghost"
                  onClick={() => setStatementImport(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {importPreview && importPreviewStats && (
          <div className="ledger-modal-backdrop">
            <div
              className="ledger-modal"
              style={{
                maxWidth: 980,
                width: "95vw",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {importPreview.source === "statement"
                  ? "Review statement import"
                  : "Review import"}
              </div>
              <div style={{ fontSize: 13, color: "#74836A", marginBottom: 12 }}>
                {importPreview.fileName} &mdash; {importPreviewStats.total} record
                {importPreviewStats.total === 1 ? "" : "s"} found,{" "}
                {importPreviewStats.included} selected, {importPreviewStats.importable} ready
                {importPreviewStats.duplicates > 0 &&
                  ` (${importPreviewStats.duplicates} duplicate${importPreviewStats.duplicates === 1 ? "" : "s"} unchecked by default)`}
                {importPreviewStats.invalidIncluded > 0 && (
                  <span style={{ color: "#A93B3B" }}>
                    {" "}
                    &middot; {importPreviewStats.invalidIncluded} selected row
                    {importPreviewStats.invalidIncluded === 1 ? "" : "s"} need fixes
                  </span>
                )}
              </div>

              {importPreview.rows.length > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="ledger-btn ledger-btn-ghost"
                      style={{
                        textTransform: "none",
                        letterSpacing: "normal",
                        fontWeight: 500,
                        padding: "7px 12px",
                      }}
                      onClick={() => setAllImportRowsIncluded(true)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="ledger-btn ledger-btn-ghost"
                      style={{
                        textTransform: "none",
                        letterSpacing: "normal",
                        fontWeight: 500,
                        padding: "7px 12px",
                      }}
                      onClick={() => setAllImportRowsIncluded(false)}
                    >
                      Exclude all
                    </button>
                  </div>
                  <div
                    style={{
                      border: "1px solid #D8CDB4",
                      borderRadius: 6,
                      overflow: "auto",
                      marginBottom: 12,
                      flex: 1,
                      minHeight: 240,
                      maxHeight: "52vh",
                      background: "#FFFDF8",
                    }}
                  >
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>In</th>
                          <th style={{ width: 118 }}>Date</th>
                          <th style={{ width: 96 }}>Type</th>
                          <th>Description</th>
                          <th style={{ width: 150 }}>Category</th>
                          <th style={{ width: 96 }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((row) => {
                          const rowError =
                            row.included && getRowValidationError(row);
                          const rowClass = [
                            !row.included ? "row-excluded" : "",
                            row.isDuplicate && row.included ? "row-duplicate" : "",
                            rowError ? "row-invalid" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <tr key={row.previewId} className={rowClass}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="import-preview-check"
                                  checked={row.included}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      included: e.target.checked,
                                    })
                                  }
                                  aria-label={`Include ${row.description}`}
                                />
                              </td>
                              <td>
                                <input
                                  className="import-preview-input"
                                  type="date"
                                  value={row.date || ""}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      date: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className="import-preview-input"
                                  value={row.type}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      type: e.target.value,
                                    })
                                  }
                                >
                                  <option value="expense">Expense</option>
                                  <option value="income">Income</option>
                                  <option value="investment">Investment</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  className="import-preview-input"
                                  type="text"
                                  value={row.description}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                                {row.isDuplicate && (
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: "#8B5E34",
                                      marginTop: 3,
                                    }}
                                  >
                                    Matches existing ledger entry
                                  </div>
                                )}
                                {rowError && (
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: "#A93B3B",
                                      marginTop: 3,
                                    }}
                                  >
                                    {rowError}
                                  </div>
                                )}
                              </td>
                              <td>
                                <select
                                  className="import-preview-input"
                                  value={row.category}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      category: e.target.value,
                                    })
                                  }
                                >
                                  {catsForType(row.type).map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="import-preview-input"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.amount}
                                  onChange={(e) =>
                                    patchImportPreviewRow(row.previewId, {
                                      amount: e.target.value,
                                    })
                                  }
                                  style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importPreview.errors.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#A93B3B",
                    marginBottom: 12,
                    maxHeight: 100,
                    overflowY: "auto",
                    border: "1px solid #E4C88A",
                    background: "#FBF3E6",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Rows that could not be parsed
                  </div>
                  {importPreview.errors.map((err) => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  className="ledger-btn"
                  onClick={confirmImport}
                  disabled={importPreviewStats.importable === 0}
                >
                  Import {importPreviewStats.importable} entr
                  {importPreviewStats.importable === 1 ? "y" : "ies"}
                </button>
                <button
                  type="button"
                  className="ledger-btn ledger-btn-ghost"
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {importConfirm && (
          <div className="ledger-modal-backdrop">
            <div
              className="ledger-modal"
              style={{ maxWidth: 520 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Import complete
              </div>
              <div style={{ fontSize: 13, color: "#74836A", marginBottom: 16 }}>
                {importConfirm.fileName}
              </div>

              <div
                style={{
                  border: "1px solid #D8CDB4",
                  borderRadius: 6,
                  background: "#FFFDF8",
                  padding: "14px 16px",
                  marginBottom: 16,
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {importConfirm.mergedCount > 0 ? (
                  <div style={{ fontWeight: 600, color: "#2F6B4F", marginBottom: 8 }}>
                    {importConfirm.mergedCount} new entr
                    {importConfirm.mergedCount === 1 ? "y" : "ies"} added
                  </div>
                ) : (
                  <div style={{ fontWeight: 600, color: "#8B5E34", marginBottom: 8 }}>
                    No new entries added
                  </div>
                )}

                {importConfirm.dateFrom && importConfirm.dateTo && (
                  <div>
                    Date range: {fmtDateFull(importConfirm.dateFrom)}
                    {importConfirm.dateFrom !== importConfirm.dateTo &&
                      ` – ${fmtDateFull(importConfirm.dateTo)}`}
                  </div>
                )}

                {importConfirm.totals.expense > 0 && (
                  <div>Expenses: {fmtMoney(importConfirm.totals.expense)}</div>
                )}
                {importConfirm.totals.income > 0 && (
                  <div>Income: {fmtMoney(importConfirm.totals.income)}</div>
                )}
                {importConfirm.totals.investment > 0 && (
                  <div>Investments: {fmtMoney(importConfirm.totals.investment)}</div>
                )}

                {importConfirm.stats.total - importConfirm.stats.included > 0 && (
                  <div style={{ color: "#74836A" }}>
                    {importConfirm.stats.total - importConfirm.stats.included} row
                    {importConfirm.stats.total - importConfirm.stats.included === 1
                      ? ""
                      : "s"}{" "}
                    excluded
                  </div>
                )}
                {importConfirm.attemptedCount > importConfirm.mergedCount && (
                  <div style={{ color: "#74836A" }}>
                    {importConfirm.attemptedCount - importConfirm.mergedCount} duplicate
                    {importConfirm.attemptedCount - importConfirm.mergedCount === 1
                      ? ""
                      : "s"}{" "}
                    skipped
                  </div>
                )}
                {importConfirm.stats.included > importConfirm.attemptedCount && (
                  <div style={{ color: "#A93B3B" }}>
                    {importConfirm.stats.included - importConfirm.attemptedCount} selected row
                    {importConfirm.stats.included - importConfirm.attemptedCount === 1
                      ? ""
                      : "s"}{" "}
                    skipped (invalid fields)
                  </div>
                )}
                {importConfirm.parseErrors > 0 && (
                  <div style={{ color: "#A93B3B" }}>
                    {importConfirm.parseErrors} source row
                    {importConfirm.parseErrors === 1 ? "" : "s"} could not be parsed
                  </div>
                )}
              </div>

              {importConfirm.mergedCount > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#74836A",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Tag imported entries
                  </label>
                  <input
                    className="ledger-input"
                    type="text"
                    placeholder={
                      importConfirm.suggestedLabel || "e.g. HDFC Jan 2026"
                    }
                    value={importConfirm.label}
                    onChange={(e) =>
                      setImportConfirm((prev) =>
                        prev ? { ...prev, label: e.target.value } : prev
                      )
                    }
                  />
                  <div style={{ fontSize: 12, color: "#74836A", marginTop: 6 }}>
                    Optional label applied to all {importConfirm.mergedCount} imported
                    entr{importConfirm.mergedCount === 1 ? "y" : "ies"}. Searchable in the
                    ledger.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="ledger-btn"
                  onClick={finishImportConfirm}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {globalSearchActive && (
          <div
            style={{
              fontSize: 12.5,
              color: "#3C6E91",
              marginTop: -12,
              marginBottom: 20,
              background: "#F6F1E6",
              border: "1px solid #E4DCC5",
              borderRadius: 6,
              padding: "10px 14px",
            }}
          >
            Searching all entries for &ldquo;{search.trim()}&rdquo; &mdash;{" "}
            {globalSearchTotals?.count ?? 0} result
            {(globalSearchTotals?.count ?? 0) === 1 ? "" : "s"}
            {globalSearchTotals && globalSearchTotals.count > 0 && (
              <span style={{ color: "#74836A" }}>
                {" "}
                (expenses {fmtMoney(globalSearchTotals.expense)}
                {globalSearchTotals.income > 0 &&
                  ` · income ${fmtMoney(globalSearchTotals.income)}`}
                {globalSearchTotals.investment > 0 &&
                  ` · investments ${fmtMoney(globalSearchTotals.investment)}`}
                )
              </span>
            )}
          </div>
        )}

        {(catTotals.length > 0 ||
          expenseEntries.length > 0 ||
          (!globalSearchActive &&
            ((periodMode === "year" && monthlyExpenseTotals.length > 0) ||
              (periodMode === "month" && weeklyExpenseTotals.length > 0) ||
              (periodMode === "week" && dailyExpenseTotals.length > 0)))) &&
          (filterType === "all" || filterType === "expense") && (
            <CollapsiblePanel
              title="Expense details"
              meta={`${fmtMoney(periodExpenseTotal)} · ${expenseEntries.length} entr${expenseEntries.length === 1 ? "y" : "ies"} · ${periodLabel}`}
              open={showExpenseDetails}
              onToggle={() => setShowExpenseDetails((v) => !v)}
            >
              {!globalSearchActive &&
                periodMode === "year" &&
                monthlyExpenseTotals.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#74836A",
                        marginBottom: 10,
                      }}
                    >
                      Month-over-month spending &mdash; {year}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {monthlyExpenseTotals.map((m) =>
                        renderDrillBar({
                          id: m.ym,
                          label: m.label,
                          total: m.total,
                          maxTotal: maxMonthlyTotal,
                          color: "#3C6E91",
                          active:
                            periodMode === "month" &&
                            month === m.ym &&
                            !periodDrillDay,
                          onClick: () => drillToMonth(m.ym),
                        })
                      )}
                    </div>
                  </div>
                )}

              {!globalSearchActive &&
                periodMode === "month" &&
                !periodDrillDay &&
                weeklyExpenseTotals.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#74836A",
                        marginBottom: 10,
                      }}
                    >
                      Weekly spending &mdash; {monthNameOnly(month)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {weeklyExpenseTotals.map((w) =>
                        renderDrillBar({
                          id: w.startStr,
                          label: w.label,
                          total: w.total,
                          maxTotal: maxWeeklyTotal,
                          color: "#3C6E91",
                          active:
                            periodMode === "week" &&
                            weekRange.startStr === w.startStr &&
                            !periodDrillDay,
                          onClick: () => drillToWeek(w.startStr),
                          labelWidth: 118,
                        })
                      )}
                    </div>
                  </div>
                )}

              {!globalSearchActive &&
                periodMode === "week" &&
                !periodDrillDay &&
                dailyExpenseTotals.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#74836A",
                        marginBottom: 10,
                      }}
                    >
                      Daily spending &mdash; {weekLabel(weekRange)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {dailyExpenseTotals.map((d) =>
                        renderDrillBar({
                          id: d.date,
                          label: d.label,
                          total: d.total,
                          maxTotal: maxDailyTotal,
                          color: "#3C6E91",
                          active: periodDrillDay === d.date,
                          onClick: () => drillToDay(d.date),
                          labelWidth: 96,
                        })
                      )}
                    </div>
                  </div>
                )}

              {catTotals.length > 0 && !globalSearchActive && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#74836A",
                      marginBottom: 10,
                    }}
                  >
                    Spending by category
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {catTotals.map((c) =>
                      renderDrillBar({
                        id: c.id,
                        label: c.label,
                        total: c.total,
                        maxTotal: maxCatTotal,
                        color: c.color,
                        active: filterCat === c.id && filterType === "expense",
                        onClick: () => drillToCategory(c.id, "expense"),
                        labelWidth: 118,
                      })
                    )}
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#74836A",
                  marginBottom: 10,
                }}
              >
                Expense entries
              </div>
              {renderEntryRows(expenseEntries)}
            </CollapsiblePanel>
          )}

        {(investmentTotals.length > 0 || investmentEntries.length > 0) &&
          (filterType === "all" || filterType === "investment") && (
            <CollapsiblePanel
              title="Investment details"
              meta={`${fmtMoney(periodInvestmentTotal)} · ${investmentEntries.length} entr${investmentEntries.length === 1 ? "y" : "ies"} · ${periodLabel}`}
              open={showInvestmentDetails}
              onToggle={() => setShowInvestmentDetails((v) => !v)}
            >
              {investmentTotals.length > 0 && !globalSearchActive && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#74836A",
                      marginBottom: 10,
                    }}
                  >
                    Investments by type
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {investmentTotals.map((c) =>
                      renderDrillBar({
                        id: c.id,
                        label: c.label,
                        total: c.total,
                        maxTotal: maxInvestmentTotal,
                        color: c.color,
                        active: filterCat === c.id && filterType === "investment",
                        onClick: () => drillToCategory(c.id, "investment"),
                        labelWidth: 118,
                      })
                    )}
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#74836A",
                  marginBottom: 10,
                }}
              >
                Investment entries
              </div>
              {renderEntryRows(investmentEntries)}
            </CollapsiblePanel>
          )}

        {incomeEntries.length > 0 &&
          (filterType === "all" || filterType === "income") && (
            <CollapsiblePanel
              title="Income details"
              meta={`${fmtMoney(periodIncomeTotal)} · ${incomeEntries.length} entr${incomeEntries.length === 1 ? "y" : "ies"} · ${periodLabel}`}
              open={showIncomeDetails}
              onToggle={() => setShowIncomeDetails((v) => !v)}
            >
              {renderEntryRows(incomeEntries)}
            </CollapsiblePanel>
          )}

        {!loaded && (
          <div style={{ color: "#74836A", fontSize: 14, padding: "20px 0" }}>
            Loading your ledger...
          </div>
        )}

        {loaded &&
          expenseEntries.length === 0 &&
          investmentEntries.length === 0 &&
          incomeEntries.length === 0 && (
            <div
              style={{
                border: "1px dashed #D8CDB4",
                borderRadius: 8,
                padding: "40px 20px",
                textAlign: "center",
                color: "#74836A",
                fontSize: 14,
                marginBottom: 28,
              }}
            >
              {globalSearchActive
                ? `No entries match "${search.trim()}". Try another keyword or clear search.`
                : entries.length === 0
                ? "No transactions yet. Import your bank statement to populate the ledger."
                : "No entries for this period or filter."}
              {!globalSearchActive && entries.length === 0 && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ledger-btn"
                    style={{
                      textTransform: "none",
                      letterSpacing: "normal",
                      fontWeight: 600,
                    }}
                    onClick={() => statementInputRef.current?.click()}
                  >
                    Choose statement file
                  </button>
                </div>
              )}
            </div>
          )}

        {/* Category rules */}
        {categoryRuleList.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#74836A",
                marginBottom: 10,
              }}
            >
              Saved category rules
            </div>
            <div
              style={{
                border: "1px solid #D8CDB4",
                borderRadius: 8,
                background: "#FFFDF8",
                overflow: "hidden",
              }}
            >
              {categoryRuleList.map((rule, i) => (
                <div
                  key={rule.pattern}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1, color: "#1F2A22" }}>{rule.pattern}</div>
                  <div style={{ color: "#74836A", fontSize: 12 }}>
                    {rule.type} &rarr; {rule.label}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryRules((prev) => removeCategoryRule(prev, rule.pattern))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#A93B3B",
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly budgets */}
        {periodMode === "month" && !globalSearchActive ? (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#74836A",
                marginBottom: 10,
              }}
            >
              Monthly budgets &mdash; {monthLabel(month)}
            </div>
            <div
              style={{
                border: "1px solid #D8CDB4",
                borderRadius: 8,
                background: "#FFFDF8",
                overflow: "hidden",
              }}
            >
              {CATEGORIES.map((c, i) => {
                const spent = (catTotals.find((t) => t.id === c.id) || {}).total || 0;
                const budget = budgets[c.id] || 0;
                const hasBudget = budget > 0;
                const pct = hasBudget ? Math.min((spent / budget) * 100, 100) : 0;
                const over = hasBudget && spent > budget;
                const barColor = !hasBudget
                  ? "#D8CDB4"
                  : over
                  ? "#A93B3B"
                  : pct >= 80
                  ? "#C08A28"
                  : "#6B8E4E";
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 16px",
                      borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ width: 130, fontSize: 12.5, color: "#1F2A22" }}>
                      {c.label}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 120,
                        background: "#EDE6D6",
                        height: 8,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: hasBudget ? `${pct}%` : spent > 0 ? "100%" : "0%",
                          background: barColor,
                          height: "100%",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12,
                        color: over ? "#A93B3B" : "#4A5A4E",
                        width: 150,
                        textAlign: "right",
                      }}
                    >
                      {hasBudget
                        ? `${fmtMoney(spent)} of ${fmtMoney(budget)}`
                        : spent > 0
                        ? `${fmtMoney(spent)} spent`
                        : "No spend yet"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: "#A69C82" }}>Limit</span>
                      <input
                        className="ledger-input"
                        style={{ width: 90, padding: "6px 8px", fontSize: 12.5 }}
                        type="number"
                        min="0"
                        step="1"
                        placeholder=""
                        value={budgetValueFor(c.id)}
                        onChange={(e) => updateBudgetDraft(c.id, e.target.value)}
                        onBlur={() => commitBudget(c.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !globalSearchActive ? (
          <div
            style={{
              fontSize: 12.5,
              color: "#74836A",
              marginBottom: 28,
            }}
          >
            Budgets are tracked monthly &mdash; switch to Month view to set or check limits.
            {periodMode === "year" && " Year view shows spending totals only."}
          </div>
        ) : null}

        {loadError && (
          <div
            style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 6,
              border: "1px solid #E4C88A",
              background: "#FBF3E6",
              color: "#8B5E34",
              fontSize: 13,
            }}
          >
            {loadError}
          </div>
        )}

        {saveError && (
          <div style={{ marginTop: 16, fontSize: 12.5, color: "#A93B3B" }}>
            Your last change couldn't be saved. Check your connection and try
            again.
          </div>
        )}
      </div>
    </div>
  );
}
