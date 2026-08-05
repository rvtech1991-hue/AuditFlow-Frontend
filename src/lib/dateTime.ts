/** Today's date as a "YYYY-MM-DD" string in the browser's local calendar day — safe to use
 * directly as a date-input `min` attribute or for a same-day comparison. Deliberately uses the
 * local getFullYear/getMonth/getDate (not the UTC variants), since IST is UTC+5:30 and a
 * UTC-based "today" can show yesterday's date for part of the evening. */
export function todayDateInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Converts a plain "YYYY-MM-DD" due-date into an end-of-local-day ISO timestamp before sending
 * it to the backend. The backend rejects a due date that isn't strictly after "now" — sending
 * bare midnight for today would always fail that check partway through the day, so this sends
 * 23:59:59 in the browser's local time instead, which keeps "today" valid all day. */
export function toEndOfDayIso(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59`).toISOString();
}

/** Normalizes an API datetime string before constructing a Date from it. EF Core reads SQL
 * Server's timezone-less `datetime2` columns back with DateTimeKind.Unspecified, so the backend
 * often serializes timestamps without a trailing "Z" even though the underlying value is always
 * UTC. `new Date(...)` treats an offset-less string as local time, not UTC, which silently shows
 * every timestamp shifted by the browser's UTC offset (5:30 hours off for IST). Treat any
 * datetime string with no explicit timezone marker as UTC. Date-only strings ("YYYY-MM-DD") are
 * intentionally left alone — those are formatted separately and aren't affected by this bug. */
export function parseApiDateTime(value: string): Date {
  const hasTimezoneMarker = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezoneMarker ? value : `${value}Z`);
}
