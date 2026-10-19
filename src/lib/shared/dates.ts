// Date helpers. All "dates" are local Asia/Karachi calendar days as YYYY-MM-DD strings.
// Timestamps are ISO strings in UTC. Weeks start on Monday.

export const TZ = "Asia/Karachi";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function zonedParts(d: Date) {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** The "logical" day: before dayStartHour, it still counts as the previous day. */
export function logicalDate(at: Date = new Date(), dayStartHour = 0): string {
  return zonedParts(new Date(at.getTime() - dayStartHour * 3_600_000)).date;
}

export function localHour(at: Date = new Date()): number {
  return zonedParts(at).hour;
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** 1 = Monday … 7 = Sunday */
export function weekday(iso: string): number {
  const w = toUTC(iso).getUTCDay();
  return w === 0 ? 7 : w;
}

export function weekStart(iso: string): string {
  return addDays(iso, 1 - weekday(iso));
}

export function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(iso: string, today?: string): string {
  if (today) {
    const diff = diffDays(iso, today);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return WEEKDAY_LONG[weekday(iso) - 1];
  }
  const [, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekday(iso) - 1]}, ${d} ${MONTHS[m - 1]}`;
}

export function formatShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatMinutes(min: number): string {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** UTC instant of local midnight at the start of a date (Karachi has no DST). */
export function startOfDayUTC(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const p = zonedParts(new Date(guess));
  const [ly, lm, ld] = p.date.split("-").map(Number);
  const localAsUTC = Date.UTC(ly, lm - 1, ld, p.hour, p.minute);
  return new Date(guess - (localAsUTC - guess)).toISOString();
}
