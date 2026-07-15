import React, { useState, useEffect, useMemo, useRef } from "react";
import { parseExcelFile } from "./excelImport.js";
import {
  lookupCategoryRule,
  saveCategoryRule,
  removeCategoryRule,
} from "./categoryRules.js";
import { processRecurringItems } from "./recurring.js";
import { createBackup, downloadBackup, parseBackupFile } from "./backup.js";
import {
  INVESTMENT_CATEGORIES,
  investmentCatMap,
  detectInvestmentCategory,
} from "./investments.js";
import { filterEntriesGlobal } from "./globalSearch.js";

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

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

function fmtDateFull(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
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

export default function ExpenseLedger({ user, cloudSync = false, onSignOut }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
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
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [periodMode, setPeriodMode] = useState("month");
  const [year, setYear] = useState(todayStr().slice(0, 4));
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [weekAnchor, setWeekAnchor] = useState(todayStr());

  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [importNote, setImportNote] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [backupNote, setBackupNote] = useState("");
  const [showRecurring, setShowRecurring] = useState(false);
  const importInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const recognitionRef = React.useRef(null);
  const voiceSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("ledger-entries");
        if (res && res.value) {
          const parsed = JSON.parse(res.value).map((e) => ({
            type: "expense",
            ...e,
          }));
          setEntries(parsed);
        }
      } catch (e) {
        // no existing data yet
      } finally {
        setLoaded(true);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ledger-budgets");
        if (res && res.value) {
          setBudgets(JSON.parse(res.value));
        }
      } catch (e) {
        // no budgets set yet
      } finally {
        setBudgetsLoaded(true);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ledger-recurring");
        if (res && res.value) {
          setRecurring(JSON.parse(res.value));
        }
      } catch (e) {
        // no recurring set yet
      } finally {
        setRecurringLoaded(true);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ledger-category-rules");
        if (res && res.value) {
          setCategoryRules(JSON.parse(res.value));
        }
      } catch (e) {
        // no rules set yet
      } finally {
        setRulesLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const result = await window.storage.set(
          "ledger-entries",
          JSON.stringify(entries)
        );
        setSaveError(!result);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [entries, loaded]);

  useEffect(() => {
    if (!budgetsLoaded) return;
    (async () => {
      try {
        await window.storage.set("ledger-budgets", JSON.stringify(budgets));
      } catch (e) {
        // ignore, budgets are non-critical
      }
    })();
  }, [budgets, budgetsLoaded]);

  useEffect(() => {
    if (!recurringLoaded) return;
    (async () => {
      try {
        await window.storage.set("ledger-recurring", JSON.stringify(recurring));
      } catch (e) {
        // ignore
      }
    })();
  }, [recurring, recurringLoaded]);

  useEffect(() => {
    if (!rulesLoaded) return;
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
  }, [categoryRules, rulesLoaded]);

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
    if (!loaded || !recurringLoaded || recurring.length === 0) return;
    const generated = processRecurringItems(recurring, entries, todayStr());
    if (generated.length > 0) {
      setEntries((prev) => [...generated, ...prev]);
    }
  }, [loaded, recurringLoaded, recurring.length]);

  function learnCategoryRulesFromEntries(list) {
    setCategoryRules((prev) => {
      let next = prev;
      for (const en of list) {
        next = saveCategoryRule(next, en.description, en.type, en.category);
      }
      return next;
    });
  }

  function resetForm() {
    setAmount("");
    setDesc("");
    setCategory(catsForType(formType)[0].id);
    setDate(todayStr());
    setFormRecurring(false);
    setFormRecurringFreq("monthly");
    setCategoryLocked(false);
    setEditingId(null);
    setFormError("");
  }

  function switchFormType(t) {
    setFormType(t);
    setCategory(catsForType(t)[0].id);
    setCategoryLocked(false);
    setFormRecurring(t === "investment");
    setFormError("");
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
    const savedCategory = resolveFormCategory(formType, categoryRef.current);
    setCategoryRules((prev) =>
      saveCategoryRule(prev, trimmedDesc, formType, savedCategory)
    );

    if (editingId) {
      setEntries((prev) =>
        prev.map((en) =>
          en.id === editingId
            ? {
                ...en,
                amount: num,
                description: trimmedDesc,
                category: savedCategory,
                date,
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
        date,
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

  function suggestCategoryFromDesc(value) {
    if (categoryLocked || !value.trim()) return;
    const matched = lookupCategoryRule(categoryRules, value, formType);
    if (matched) setCategory(matched);
  }

  function handleDescChange(value) {
    setDesc(value);
    suggestCategoryFromDesc(value);
  }

  function handleCategoryChange(value) {
    setCategory(value);
    setCategoryLocked(true);
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
    if (periodMode === "year") {
      return entries.filter((e) => e.date.slice(0, 4) === year);
    }
    if (periodMode === "month") {
      return entries.filter((e) => e.date.slice(0, 7) === month);
    }
    return entries.filter(
      (e) => e.date >= weekRange.startStr && e.date <= weekRange.endStr
    );
  }, [entries, periodMode, year, month, weekRange]);

  const periodLabel =
    periodMode === "year"
      ? year
      : periodMode === "month"
      ? monthLabel(month)
      : weekLabel(weekRange);

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

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportNote("");
    try {
      const result = await parseExcelFile(file, entries, categoryRules);
      if (result.entries.length === 0 && result.errors.length === 0) {
        setImportNote("No rows found to import.");
        return;
      }
      setImportPreview({ ...result, fileName: file.name });
    } catch (err) {
      setImportNote("Import failed. Check that the file matches the IDL format.");
      console.error(err);
    }
  }

  function confirmImport() {
    if (!importPreview) return;
    const { entries: imported, errors, skipped } = importPreview;
    if (imported.length > 0) {
      setEntries((prev) => [...imported, ...prev]);
      learnCategoryRulesFromEntries(imported);
    }
    const parts = [];
    if (imported.length > 0) {
      parts.push(`Imported ${imported.length} entr${imported.length === 1 ? "y" : "ies"}`);
    }
    if (skipped > 0) {
      parts.push(`skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}`);
    }
    if (errors.length > 0) {
      parts.push(`${errors.length} row${errors.length === 1 ? "" : "s"} skipped due to errors`);
    }
    setImportNote(parts.length ? parts.join("; ") + "." : "Nothing imported.");
    if (errors.length > 0) console.warn("Excel import errors:", errors);
    setImportPreview(null);
  }

  function exportBackup() {
    downloadBackup(
      createBackup({ entries, budgets, recurring, categoryRules })
    );
    setBackupNote("Full backup downloaded.");
  }

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

        {/* Add / edit entry - receipt slip */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#FFFDF8",
            border: "1px solid #D8CDB4",
            borderRadius: 8,
            padding: "22px 24px",
            marginBottom: 28,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -1,
              left: 18,
              right: 18,
              height: 0,
              borderTop: "1px dashed #C9BE9F",
            }}
          />

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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1F2A22",
                }}
              >
                {editingId ? "Edit entry" : "New entry"}
              </div>
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
                onChange={(e) => setAmount(e.target.value)}
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
                Date
              </label>
              <input
                className="ledger-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
              {editingId ? "Save changes" : "Add entry"}
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
              onClick={() => setPeriodMode("year")}
            >
              Year
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "month" ? "active" : ""}`}
              style={{ borderRadius: 0, borderLeft: "none" }}
              onClick={() => setPeriodMode("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === "week" ? "active" : ""}`}
              style={{ borderRadius: "0 4px 4px 0", borderLeft: "none" }}
              onClick={() => setPeriodMode("week")}
            >
              Week
            </button>
          </div>

          {periodMode === "year" ? (
            <select
              className="ledger-select"
              style={{ width: "auto", minWidth: 100 }}
              value={year}
              onChange={(e) => setYear(e.target.value)}
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
                onChange={(e) => setYear(e.target.value)}
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
                onChange={(e) => setMonth(e.target.value)}
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
                }}
              >
                &rarr;
              </button>
              <button
                type="button"
                className="ledger-btn ledger-btn-ghost"
                onClick={() => setWeekAnchor(todayStr())}
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
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="ledger-btn ledger-btn-ghost"
            style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
            onClick={() => importInputRef.current?.click()}
          >
            Import Excel
          </button>
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
        {(importNote || backupNote) && (
          <div
            style={{
              fontSize: 12.5,
              color: "#3C6E91",
              marginTop: -16,
              marginBottom: 20,
            }}
          >
            {[importNote, backupNote].filter(Boolean).join(" ")}
          </div>
        )}

        {importPreview && (
          <div className="ledger-modal-backdrop" onClick={() => setImportPreview(null)}>
            <div
              className="ledger-modal"
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
                Import preview
              </div>
              <div style={{ fontSize: 13, color: "#74836A", marginBottom: 16 }}>
                {importPreview.fileName} &mdash; {importPreview.entries.length} to import
                {importPreview.skipped > 0 &&
                  `, ${importPreview.skipped} duplicate${importPreview.skipped === 1 ? "" : "s"} skipped`}
                {importPreview.errors.length > 0 &&
                  `, ${importPreview.errors.length} error${importPreview.errors.length === 1 ? "" : "s"}`}
              </div>
              {importPreview.entries.length > 0 && (
                <div
                  style={{
                    border: "1px solid #D8CDB4",
                    borderRadius: 6,
                    overflow: "hidden",
                    marginBottom: 12,
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {importPreview.entries.slice(0, 15).map((en, i) => {
                    const cat = catInfoFor(en.type, en.category);
                    return (
                      <div
                        key={en.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "8px 12px",
                          fontSize: 12.5,
                          borderTop: i === 0 ? "none" : "1px dashed #E4DCC5",
                        }}
                      >
                        <span style={{ color: "#74836A", width: 72 }}>{en.date}</span>
                        <span style={{ flex: 1 }}>{en.description}</span>
                        <span style={{ color: "#74836A" }}>{cat?.label}</span>
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 600,
                          }}
                        >
                          {fmtMoney(en.amount)}
                        </span>
                      </div>
                    );
                  })}
                  {importPreview.entries.length > 15 && (
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#74836A" }}>
                      + {importPreview.entries.length - 15} more rows
                    </div>
                  )}
                </div>
              )}
              {importPreview.errors.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#A93B3B",
                    marginBottom: 12,
                    maxHeight: 80,
                    overflowY: "auto",
                  }}
                >
                  {importPreview.errors.slice(0, 5).map((err) => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="ledger-btn"
                  onClick={confirmImport}
                  disabled={importPreview.entries.length === 0}
                >
                  Import {importPreview.entries.length} entr
                  {importPreview.entries.length === 1 ? "y" : "ies"}
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

        {/* Category breakdown */}
        {!globalSearchActive && periodMode === "year" && monthlyExpenseTotals.length > 0 && (
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
              Month-over-month spending &mdash; {year}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monthlyExpenseTotals.map((m) => (
                <div
                  key={m.ym}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ width: 72, fontSize: 12.5, color: "#1F2A22" }}>
                    {m.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#EDE6D6",
                      height: 8,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(m.total / maxMonthlyTotal) * 100}%`,
                        background: "#3C6E91",
                        height: "100%",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12.5,
                      width: 70,
                      textAlign: "right",
                      color: "#1F2A22",
                    }}
                  >
                    {fmtMoney(m.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {catTotals.length > 0 && !globalSearchActive && (
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
              Spending by category &mdash; {periodLabel}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {catTotals.map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ width: 118, fontSize: 12.5, color: "#1F2A22" }}>
                    {c.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#EDE6D6",
                      height: 8,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(c.total / maxCatTotal) * 100}%`,
                        background: c.color,
                        height: "100%",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12.5,
                      width: 70,
                      textAlign: "right",
                      color: "#1F2A22",
                    }}
                  >
                    {fmtMoney(c.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {investmentTotals.length > 0 && !globalSearchActive && (
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
              Investments by type &mdash; {periodLabel}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {investmentTotals.map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ width: 118, fontSize: 12.5, color: "#1F2A22" }}>
                    {c.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#EDE6D6",
                      height: 8,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(c.total / maxInvestmentTotal) * 100}%`,
                        background: c.color,
                        height: "100%",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12.5,
                      width: 70,
                      textAlign: "right",
                      color: "#1F2A22",
                    }}
                  >
                    {fmtMoney(c.total)}
                  </div>
                </div>
              ))}
            </div>
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

        {/* Ledger list */}
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
          Entries ({displayEntries.length})
          {globalSearchActive && (
            <span style={{ fontWeight: 500, color: "#3C6E91", marginLeft: 8 }}>
              all time
            </span>
          )}
        </div>

        {!loaded ? (
          <div style={{ color: "#74836A", fontSize: 14, padding: "20px 0" }}>
            Loading your ledger...
          </div>
        ) : displayEntries.length === 0 ? (
          <div
            style={{
              border: "1px dashed #D8CDB4",
              borderRadius: 8,
              padding: "40px 20px",
              textAlign: "center",
              color: "#74836A",
              fontSize: 14,
            }}
          >
            {globalSearchActive
              ? `No entries match "${search.trim()}". Try another keyword or clear search.`
              : "No entries yet for this view. Add one above to start the ledger."}
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #D8CDB4",
              borderRadius: 8,
              overflow: "hidden",
              background: "#FFFDF8",
            }}
          >
            {displayEntries.map((en, i) => {
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
                      width: globalSearchActive ? 88 : 46,
                      flexShrink: 0,
                    }}
                  >
                    {globalSearchActive ? fmtDateFull(en.date) : fmtDate(en.date)}
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
