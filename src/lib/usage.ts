export const REQUEST_KINDS = ['nr-board', 'nr-home', 'tfl-arrivals', 'tfl-nearby', 'tfl-search'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** Request counts per local calendar day ('YYYY-MM-DD'). */
export type UsageDays = Record<string, Partial<Record<RequestKind, number>>>;

export const KEEP_DAYS = 30;
const USAGE_KEY = 'departures:usage';

// Own storage access rather than storage.ts: storage.ts imports nr.ts, which imports this module.
function loadDays(): UsageDays {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as UsageDays) : {};
  } catch {
    return {};
  }
}

function saveDays(days: UsageDays) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(days));
  } catch {
    /* storage unavailable – counts just aren't kept */
  }
}

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Keys for the `n` local days ending today, newest first. */
function lastDays(now: number, n: number): string[] {
  const d = new Date(now);
  return Array.from({ length: n }, (_, i) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i).getTime()));
}

export function prune(days: UsageDays, now: number): UsageDays {
  const keep = new Set(lastDays(now, KEEP_DAYS));
  return Object.fromEntries(Object.entries(days).filter(([k]) => keep.has(k)));
}

let recent: number[] = [];

export function countRequest(kind: RequestKind, now = Date.now()) {
  try {
    const days = prune(loadDays(), now);
    const today = (days[dayKey(now)] ??= {});
    today[kind] = (today[kind] ?? 0) + 1;
    saveDays(days);
  } catch {
    // Corrupt saved usage must never stop a departure request; start counting afresh.
    saveDays({ [dayKey(now)]: { [kind]: 1 } });
  }
  recent = recent.filter((t) => now - t < 60_000);
  recent.push(now);
}

export function lastMinute(now = Date.now()): number {
  return recent.filter((t) => now - t < 60_000).length;
}

export type Counts = Record<RequestKind, number>;
export interface UsageSummary {
  today: Counts;
  week: Counts;
  month: Counts;
}

function total(days: UsageDays, keys: string[]): Counts {
  const out = Object.fromEntries(REQUEST_KINDS.map((k) => [k, 0])) as Counts;
  for (const key of keys) for (const k of REQUEST_KINDS) out[k] += days[key]?.[k] ?? 0;
  return out;
}

export function summarise(days: UsageDays, now: number): UsageSummary {
  return {
    today: total(days, lastDays(now, 1)),
    week: total(days, lastDays(now, 7)),
    month: total(days, lastDays(now, KEEP_DAYS)),
  };
}

export function loadUsage(now = Date.now()): UsageSummary {
  return summarise(loadDays(), now);
}
