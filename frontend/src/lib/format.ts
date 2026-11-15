const DAY_MS = 86_400_000;

/**
 * The API returns MongoDB datetimes without a timezone ("2026-11-14T01:52:47"), and they are UTC.
 * Plain `new Date()` would read them as local time, so every API timestamp goes through here.
 */
export const toDate = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

/** Value for <input type="datetime-local"> in the user's own timezone. */
export function toLocalInput(iso: string): string {
  const d = toDate(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Local calendar date key, e.g. "2026-11-15". Local, not UTC, so late shows stay on the right day. */
export function dateKey(iso: string): string {
  const d = toDate(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysFromToday(key: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${key}T00:00:00`).getTime() - today.getTime()) / DAY_MS);
}

/** "Today", "Tomorrow" or "Sat, 15 Nov". */
export function dayLabel(key: string): string {
  const diff = daysFromToday(key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export const formatTime = (iso: string) =>
  toDate(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const formatDate = (iso: string) =>
  toDate(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

export const formatPrice = (amount: number) => `PKR ${amount.toLocaleString()}`;

/** "1 ticket", "2 tickets". */
export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** "(IMAX Re-Release)" is a format note, not part of the title. */
export const shortTitle = (title: string) => title.replace(" (IMAX Re-Release)", "");
