import { DEFAULT_COLOR, OPERATOR_COLORS } from './colors';
import { clockToEpoch } from './time';
import type { Departure } from './types';
import { countRequest } from './usage';

export const DEFAULT_API_BASE =
  'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';

/** Addresses earlier versions saved as the default; upgraded to DEFAULT_API_BASE on load. */
export const OLD_API_BASES = ['https://api1.raildata.org.uk/1010-live-departure-board-dep/LDBWS/api/20220120'];

/* Shape of the Rail Data Marketplace "Live Departure Board" JSON (LDBWS). Kept loose on purpose. */
interface NrLocation {
  locationName?: string;
  crs?: string;
  via?: string | null;
}
interface NrService {
  std?: string;
  etd?: string;
  platform?: string | null;
  operator?: string;
  operatorCode?: string;
  isCancelled?: boolean;
  serviceID?: string;
  destination?: NrLocation[] | { location?: NrLocation[] };
}
export interface NrBoardResponse {
  generatedAt?: string;
  locationName?: string;
  crs?: string;
  trainServices?: NrService[] | null;
  busServices?: NrService[] | null;
}

function locations(dest: NrService['destination']): NrLocation[] {
  if (!dest) return [];
  return Array.isArray(dest) ? dest : (dest.location ?? []);
}

function toDeparture(s: NrService, ref: number, isBus: boolean): Departure | undefined {
  const scheduled = s.std ? clockToEpoch(s.std, ref) : undefined;
  if (scheduled === undefined) return undefined;
  const etd = (s.etd ?? '').trim();
  const expected = clockToEpoch(etd, ref);
  const cancelled = s.isCancelled === true || /cancel/i.test(etd);

  let status: Departure['status'] = 'on-time';
  let statusText = 'On time';
  let time = scheduled;
  if (cancelled) {
    status = 'cancelled';
    statusText = 'Cancelled';
  } else if (expected !== undefined) {
    time = expected;
    status = expected > scheduled ? 'late' : 'on-time';
    statusText = expected > scheduled ? `Exp ${etd}` : 'On time';
  } else if (/delay/i.test(etd)) {
    status = 'late';
    statusText = 'Delayed';
  } else if (etd && !/on time/i.test(etd)) {
    statusText = etd;
  }

  const dests = locations(s.destination);
  const destination = dests.map((d) => d.locationName).filter(Boolean).join(' & ') || 'Unknown';
  const via = dests.map((d) => d.via).find(Boolean) ?? undefined;
  const code = s.operatorCode ?? '';

  return {
    id: `nr:${s.serviceID ?? `${s.std}-${destination}`}`,
    mode: 'nr',
    time,
    scheduled,
    status,
    statusText,
    destination,
    detail: via,
    line: isBus ? 'Replacement bus' : (s.operator ?? code) || 'Rail',
    color: OPERATOR_COLORS[code] ?? DEFAULT_COLOR,
    platform: s.platform ?? undefined,
  };
}

export function parseNrBoard(body: NrBoardResponse, now: number): Departure[] {
  const ref = body.generatedAt ? Date.parse(body.generatedAt) || now : now;
  const out: Departure[] = [];
  for (const s of body.trainServices ?? []) {
    const d = toDeparture(s, ref, false);
    if (d) out.push(d);
  }
  for (const s of body.busServices ?? []) {
    const d = toDeparture(s, ref, true);
    if (d) out.push(d);
  }
  return out;
}

export class NrKeyError extends Error {}

export interface NrQuery {
  crs: string;
  apiKey: string;
  apiBase: string;
  numRows?: number;
  timeOffset?: number;
  timeWindow?: number;
  filterCrs?: string;
  signal?: AbortSignal;
}

// The plain board gives many rows; the "with details" board is capped at ~10.
// We prefer the plain one and fall back if this key's product doesn't include it.
let operation: 'GetDepartureBoard' | 'GetDepBoardWithDetails' = 'GetDepartureBoard';

// Once National Rail rejects a key, stop spending requests on it for a while,
// or until the user saves settings again.
const RETRY_REJECTED_MS = 5 * 60_000;
let rejected: { key: string; at: number } | undefined;

export function forgetRejectedKey() {
  rejected = undefined;
}

export async function fetchNrBoard(q: NrQuery): Promise<Departure[]> {
  if (rejected?.key === q.apiKey && Date.now() - rejected.at < RETRY_REJECTED_MS) {
    throw new NrKeyError('National Rail key was rejected');
  }
  const params = new URLSearchParams();
  params.set('numRows', String(q.numRows ?? 40));
  if (q.timeOffset !== undefined) params.set('timeOffset', String(q.timeOffset));
  if (q.timeWindow !== undefined) params.set('timeWindow', String(q.timeWindow));
  if (q.filterCrs) {
    params.set('filterCrs', q.filterCrs);
    params.set('filterType', 'to');
  }

  const call = async (op: typeof operation) => {
    if (op === 'GetDepBoardWithDetails') params.set('numRows', String(Math.min(q.numRows ?? 10, 10)));
    const url = `${q.apiBase.replace(/\/$/, '')}/${op}/${encodeURIComponent(q.crs)}?${params}`;
    countRequest(q.filterCrs ? 'nr-home' : 'nr-board');
    return fetch(url, { headers: { 'x-apikey': q.apiKey }, signal: q.signal });
  };

  let res = await call(operation);
  if ((res.status === 404 || res.status === 403) && operation === 'GetDepartureBoard') {
    const retry = await call('GetDepBoardWithDetails');
    if (retry.ok) {
      operation = 'GetDepBoardWithDetails';
      console.warn('[departures] GetDepartureBoard unavailable on this key; using GetDepBoardWithDetails (max 10 rows).');
    }
    res = retry;
  }
  if (res.status === 401 || res.status === 403) {
    rejected = { key: q.apiKey, at: Date.now() };
    throw new NrKeyError('National Rail key was rejected');
  }
  if (!res.ok) throw new Error(`National Rail error ${res.status}`);
  return parseNrBoard((await res.json()) as NrBoardResponse, Date.now());
}
