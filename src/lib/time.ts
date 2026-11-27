/**
 * Turn a UK "HH:MM" clock time into epoch ms, choosing the day closest to `ref`
 * (so 00:05 seen at 23:50 means tomorrow, and 23:55 seen at 00:10 means yesterday).
 * Uses the device's local time zone, which for this app is UK time.
 */
export function clockToEpoch(hhmm: string, ref: number): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const d = new Date(ref);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let t = d.getTime();
  const twelveHours = 12 * 3600_000;
  if (t - ref > twelveHours) t -= 2 * twelveHours;
  else if (ref - t > twelveHours) t += 2 * twelveHours;
  return t;
}

export function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(t: number, now: number): string {
  const mins = Math.round((t - now) / 60_000);
  if (mins <= 0) return 'due';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

/** How long ago something happened, for "Updated just now" / "Updated 3 min ago" / "Updated at 08:31". */
export function formatAge(t: number, now: number): string {
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `at ${formatClock(t)}`;
}
