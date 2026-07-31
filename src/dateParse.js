import * as XLSX from "xlsx";

export const DATE_FORMAT_OPTIONS = [
  {
    id: "DMY",
    label: "DD/MM/YYYY — day first (HDFC, most Indian banks)",
    example: "01/07/2026 → 1 Jul 2026",
  },
  {
    id: "MDY",
    label: "MM/DD/YYYY — month first (US format)",
    example: "07/01/2026 → 1 Jul 2026",
  },
  {
    id: "YMD",
    label: "YYYY-MM-DD — ISO",
    example: "2026-07-01",
  },
];

function expandTwoDigitYear(yy) {
  const n = Number(yy);
  if (!Number.isFinite(n)) return null;
  if (n >= 100) return n;
  return n >= 70 ? 1900 + n : 2000 + n;
}

function toISODateFromParts(partA, partB, partC, formatId) {
  let day;
  let month;
  let year;

  if (formatId === "YMD") {
    year = partA;
    month = partB;
    day = partC;
  } else if (formatId === "MDY") {
    month = partA;
    day = partB;
    year = partC;
  } else {
    day = partA;
    month = partB;
    year = partC;
  }

  const d = Number(day);
  const m = Number(month);
  const y =
    String(year).length <= 2 ? expandTwoDigitYear(year) : Number(year);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseExcelSerial(value) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  const y = parsed.y;
  const m = String(parsed.m).padStart(2, "0");
  const d = String(parsed.d).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateWithFormat(value, formatId = "DMY") {
  if (value == null || value === "") return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return parseExcelSerial(value);
  }

  const str = String(value).trim();

  const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashMatch) {
    return toISODateFromParts(
      slashMatch[1],
      slashMatch[2],
      slashMatch[3],
      formatId
    );
  }

  const isoLike = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoLike) {
    return toISODateFromParts(isoLike[1], isoLike[2], isoLike[3], "YMD");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return null;
}

export function normalizeLedgerDate(value, formatId = "DMY") {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return parseDateWithFormat(value, formatId);
}

export function formatISODateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function previewStatementDates(rows, mapping, formatId = "DMY", limit = 3) {
  if (!mapping?.date || !Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const raw = row[mapping.date];
      if (raw == null || raw === "") return null;
      const parsed = parseDateWithFormat(raw, formatId);
      return parsed
        ? {
            rowNum: index + 2,
            raw: String(raw).trim(),
            parsed,
            label: formatISODateLabel(parsed),
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, limit);
}
