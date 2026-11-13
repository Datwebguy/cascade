/** Timezone helpers so custom schedules use the channel's timezone, not the browser's. */

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-14T09:00" wall-clock time in `timeZone` -> ISO UTC string. */
export function zonedLocalToUtcIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Invalid date and time.");
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = naive - offsetMs(naive, timeZone);
  utc = naive - offsetMs(utc, timeZone); // second pass handles DST boundaries
  return new Date(utc).toISOString();
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" wall-clock in `timeZone` (for datetime-local inputs). */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + offsetMs(date.getTime(), timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** A sensible default: the next full hour, one hour from now, in the channel's timezone. */
export function defaultLocalSlot(timeZone: string, now = new Date()): string {
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return utcToZonedLocal(new Date(d.getTime() + 60 * 60 * 1000), timeZone);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
