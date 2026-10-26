// Day keys for saved board rankings. The board refreshes on a Pacific
// schedule, so a "day" is a Pacific calendar date written as YYYY-MM-DD.
// No imports, so the client, tests, and ogArt load it directly.

// How many days back the board keeps saved rankings, not counting today.
export const RANKING_HISTORY_DAYS = 7;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-24" for any moment on Oct 24 in Pacific time, DST included.
export function pacificDay(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Calendar math on the key itself, so DST never shifts a day.
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Fridays get the weekly top 10. Read at UTC noon on the key so DST never
// moves the weekday.
export function isFriday(day: string): boolean {
  return isDayKey(day) && new Date(`${day}T12:00:00Z`).getUTCDay() === 5;
}

// "Sat, Oct 24", or "Sat, Oct 24, 2026" with the year.
export function formatDayLabel(day: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(`${day}T12:00:00Z`));
}
