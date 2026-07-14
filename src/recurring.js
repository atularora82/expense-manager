function pad(n) {
  return String(n).padStart(2, "0");
}

function monthEndDay(year, month) {
  return new Date(year, month, 0).getDate();
}

function addMonths(year, month, count) {
  let y = year;
  let m = month + count;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getMonthlyOccurrences(item, fromDate, toDate) {
  const dates = [];
  const day = Math.max(1, Math.min(31, item.dayOfMonth || 1));
  const [startY, startM] = fromDate.slice(0, 7).split("-").map(Number);
  const [endY, endM] = toDate.slice(0, 7).split("-").map(Number);

  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const d = Math.min(day, monthEndDay(y, m));
    const dateStr = `${y}-${pad(m)}-${pad(d)}`;
    if (dateStr >= fromDate && dateStr <= toDate) dates.push(dateStr);
    ({ year: y, month: m } = addMonths(y, m, 1));
  }
  return dates;
}

export function getWeeklyOccurrences(item, fromDate, toDate) {
  const dates = [];
  const targetDow = item.weekday ?? 1;
  const cur = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");

  while (cur <= end) {
    const jsDow = cur.getDay();
    const monBased = jsDow === 0 ? 7 : jsDow;
    if (monBased === targetDow) {
      const dateStr = cur.toISOString().slice(0, 10);
      if (dateStr >= fromDate) dates.push(dateStr);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function processRecurringItems(recurringItems, entries, today) {
  const newEntries = [];
  const seen = new Set(
    entries
      .filter((e) => e.recurringId)
      .map((e) => `${e.recurringId}|${e.date}`)
  );

  for (const item of recurringItems) {
    if (item.active === false) continue;

    const fromDate = item.startDate || item.createdAt?.slice(0, 10) || today;
    if (fromDate > today) continue;

    const dates =
      item.frequency === "weekly"
        ? getWeeklyOccurrences(item, fromDate, today)
        : getMonthlyOccurrences(item, fromDate, today);

    for (const date of dates) {
      const key = `${item.id}|${date}`;
      if (seen.has(key)) continue;

      const duplicate = entries.some(
        (e) =>
          e.date === date &&
          e.description.toLowerCase() === item.description.toLowerCase() &&
          e.amount === item.amount &&
          e.type === item.type
      );
      if (duplicate) continue;

      newEntries.push({
        id: uid(),
        recurringId: item.id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        category: item.category,
        date,
      });
      seen.add(key);
    }
  }

  return newEntries;
}
