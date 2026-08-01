function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getPeriodBuckets(periodMode, { year, month, weekRange }) {
  if (periodMode === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ym = `${year}-${pad(m)}`;
      return {
        key: ym,
        label: new Date(Number(year), i, 1).toLocaleDateString("en-IN", {
          month: "short",
        }),
      };
    });
  }

  if (periodMode === "month") {
    const [, mo] = month.split("-").map(Number);
    const daysInMonth = new Date(
      Number(month.slice(0, 4)),
      mo,
      0
    ).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = `${month}-${pad(day)}`;
      return { key: date, label: String(day) };
    });
  }

  const buckets = [];
  const cur = new Date(weekRange.startStr + "T00:00:00");
  const end = new Date(weekRange.endStr + "T00:00:00");
  while (cur <= end) {
    const date = toISODate(cur);
    buckets.push({
      key: date,
      label: cur.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
      }),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

export function formatBucketTooltipLabel(bucket) {
  if (bucket.key.length === 10) {
    return new Date(bucket.key + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (bucket.key.length === 7) {
    const [y, m] = bucket.key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  return bucket.label;
}

export function buildTimeDrillBarTooltips(
  entries,
  buckets,
  catMap,
  entryType,
  matchEntry
) {
  let runningTotal = 0;
  const categoryRunning = {};

  return buckets.map((bucket) => {
    const dailyByCat = {};
    entries
      .filter((e) => e.type === entryType && matchEntry(e, bucket))
      .forEach((e) => {
        dailyByCat[e.category] = (dailyByCat[e.category] || 0) + e.amount;
      });

    const categories = Object.entries(dailyByCat)
      .map(([id, daily]) => {
        categoryRunning[id] = (categoryRunning[id] || 0) + daily;
        const meta = catMap[id] || {};
        return {
          id,
          label: meta.label || id,
          color: meta.color || "#74836A",
          daily,
          cumulative: categoryRunning[id],
        };
      })
      .filter((cat) => cat.daily > 0 || cat.cumulative > 0)
      .sort((a, b) => b.cumulative - a.cumulative);

    runningTotal += categories.reduce((sum, cat) => sum + cat.daily, 0);

    return {
      id: bucket.id,
      title: bucket.title,
      total: runningTotal,
      categories,
    };
  });
}

export function formatTooltipAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildCumulativeCategoryChart(
  entries,
  buckets,
  catMap,
  entryType = "expense"
) {
  if (!buckets.length) {
    return { buckets: [], series: [], maxY: 1, stackedTotals: [] };
  }

  const typedEntries = entries.filter((e) => e.type === entryType);
  const bucketKeys = new Set(buckets.map((b) => b.key));
  const isMonthlyBuckets = buckets[0].key.length === 7;

  const totals = {};
  typedEntries.forEach((entry) => {
    const bucketKey = isMonthlyBuckets ? entry.date.slice(0, 7) : entry.date;
    if (!bucketKeys.has(bucketKey)) return;
    totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
  });

  const categories = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ id, ...catMap[id] }))
    .filter((cat) => cat?.label);

  const dailyAmounts = {};
  for (const entry of typedEntries) {
    const bucketKey = isMonthlyBuckets ? entry.date.slice(0, 7) : entry.date;
    if (!bucketKeys.has(bucketKey)) continue;
    dailyAmounts[entry.category] = dailyAmounts[entry.category] || {};
    dailyAmounts[entry.category][bucketKey] =
      (dailyAmounts[entry.category][bucketKey] || 0) + entry.amount;
  }

  const series = categories.map((cat) => {
    let cumulative = 0;
    const values = buckets.map((bucket) => {
      cumulative += dailyAmounts[cat.id]?.[bucket.key] || 0;
      return cumulative;
    });
    return { ...cat, values };
  });

  const stackedTotals = buckets.map((_, index) =>
    series.reduce((sum, cat) => sum + cat.values[index], 0)
  );
  const maxY = Math.max(...stackedTotals, 1);

  return { buckets, series, maxY, stackedTotals };
}

export function buildCumulativeChartBundle(
  entries,
  periodMode,
  periodContext,
  entryType,
  catMap
) {
  const buckets = getPeriodBuckets(periodMode, periodContext);
  const built = buildCumulativeCategoryChart(entries, buckets, catMap, entryType);
  if (!built.series.length) return null;
  return {
    ...built,
    render: buildStackedAreaPaths(built.series, built.buckets, built.maxY),
  };
}

export function getCumulativeChartSubtitle(periodMode, entryType, context) {
  const { year, month, weekRange, monthLabel, weekLabel } = context;
  const label =
    entryType === "expense"
      ? "expense"
      : entryType === "income"
      ? "income"
      : "investment";

  if (periodMode === "year") {
    return `Cumulative ${label} by category across ${year}, month by month.`;
  }
  if (periodMode === "month") {
    return `Cumulative ${label} by category across ${monthLabel(month)}, day by day.`;
  }
  return `Cumulative ${label} by category for ${weekLabel(weekRange)}, day by day.`;
}

export function buildStackedAreaPaths(series, buckets, maxY) {
  if (!series.length || !buckets.length) return null;

  const width = 800;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 36, left: 56 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const n = buckets.length;

  const xAt = (index) => pad.left + (index / Math.max(n - 1, 1)) * chartW;
  const yAt = (value) => pad.top + (1 - value / maxY) * chartH;

  const areas = [];
  for (let s = 0; s < series.length; s++) {
    const lower = buckets.map((_, index) =>
      series.slice(0, s).reduce((sum, cat) => sum + cat.values[index], 0)
    );
    const upper = buckets.map((_, index) =>
      series.slice(0, s + 1).reduce((sum, cat) => sum + cat.values[index], 0)
    );

    if (upper.every((value) => value === 0)) continue;

    const top = upper.map((value, index) => `${xAt(index)},${yAt(value)}`);
    const bottom = lower
      .map((value, index) => `${xAt(index)},${yAt(value)}`)
      .reverse();
    areas.push({
      id: series[s].id,
      label: series[s].label,
      color: series[s].color,
      path: `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`,
    });
  }

  const totalLine = buckets.map((_, index) =>
    series.reduce((sum, cat) => sum + cat.values[index], 0)
  );
  const linePath = totalLine
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xAt(index)},${yAt(value)}`)
    .join(" ");

  const yTicks = [0, maxY / 2, maxY];
  const xLabelIndexes =
    n <= 8
      ? buckets.map((_, index) => index)
      : buckets.map((_, index) => index).filter((index) => index % Math.ceil(n / 8) === 0 || index === n - 1);

  const tooltips = buckets.map((bucket, index) => {
    const categories = series
      .map((cat) => {
        const cumulative = cat.values[index];
        const previous = index > 0 ? cat.values[index - 1] : 0;
        return {
          id: cat.id,
          label: cat.label,
          color: cat.color,
          cumulative,
          daily: cumulative - previous,
        };
      })
      .filter((cat) => cat.cumulative > 0 || cat.daily > 0)
      .sort((a, b) => b.cumulative - a.cumulative);

    return {
      index,
      x: xAt(index),
      y: yAt(totalLine[index]),
      title: formatBucketTooltipLabel(bucket),
      total: totalLine[index],
      categories,
    };
  });

  return {
    width,
    height,
    pad,
    areas,
    linePath,
    tooltips,
    yTicks: yTicks.map((value) => ({ value, y: yAt(value) })),
    xLabels: xLabelIndexes.map((index) => ({
      label: buckets[index].label,
      x: xAt(index),
    })),
  };
}

export function formatChartAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}
