// Text formatting for the UI. Use these in server components only: formatDateTime follows the
// server's time zone, and the browser's may differ, which would break hydration.

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

// Report dates are calendar days saved as midnight UTC (see process-meeting.ts), so they are
// shown in UTC; any other time zone could move them to the day before.
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// e.g. "28 Oct 2026, 14:05"
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

// e.g. "13 Nov 2026"
export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

// e.g. plural(1, "task") -> "1 task", plural(3, "task") -> "3 tasks"
export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}
