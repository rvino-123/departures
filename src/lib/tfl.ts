import { DEFAULT_COLOR, TUBE_COLORS } from './colors';
import { cleanTflName } from './geo';
import type { Departure, TflStop } from './types';
import { countRequest } from './usage';

const BASE = 'https://api.tfl.gov.uk';
const MODES = ['tube', 'dlr'];

interface TflStopPoint {
  naptanId: string;
  commonName: string;
  lat: number;
  lon: number;
  modes?: string[];
  hubNaptanCode?: string;
}

export function parseNearby(body: { stopPoints?: TflStopPoint[] }): TflStop[] {
  return (body.stopPoints ?? [])
    .filter((s) => (s.modes ?? []).some((m) => MODES.includes(m)))
    .map((s) => ({
      id: s.naptanId,
      name: s.commonName,
      lat: s.lat,
      lon: s.lon,
      modes: (s.modes ?? []).filter((m) => MODES.includes(m)),
      hub: s.hubNaptanCode,
    }));
}

export async function fetchNearbyTfl(
  lat: number,
  lon: number,
  radius: number,
  signal?: AbortSignal,
): Promise<TflStop[]> {
  const url = `${BASE}/StopPoint?lat=${lat}&lon=${lon}&radius=${Math.round(radius)}&stopTypes=NaptanMetroStation&modes=${MODES.join(',')}`;
  countRequest('tfl-nearby');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  return parseNearby(await res.json());
}

interface TflPrediction {
  id?: string;
  vehicleId?: string;
  lineId?: string;
  lineName?: string;
  platformName?: string;
  destinationName?: string;
  towards?: string;
  expectedArrival?: string;
  modeName?: string;
  naptanId?: string;
  destinationNaptanId?: string;
}

function splitPlatform(name?: string): { platform?: string; direction?: string } {
  if (!name) return {};
  const num = /platform\s*(\w+)/i.exec(name)?.[1];
  const direction = name.split(/\s*-\s*/)[0];
  return {
    platform: num,
    direction: direction && !/^platform/i.test(direction) && direction !== 'Unknown' ? direction : undefined,
  };
}

export function parseArrivals(body: TflPrediction[]): Departure[] {
  const seen = new Set<string>();
  const out: Departure[] = [];
  for (const p of body) {
    if (!p.modeName || !MODES.includes(p.modeName)) continue;
    const time = p.expectedArrival ? Date.parse(p.expectedArrival) : NaN;
    if (Number.isNaN(time)) continue;
    // Trains terminating here are arrivals, not departures.
    if (p.destinationNaptanId && p.destinationNaptanId === p.naptanId) continue;
    // DLR sends an empty vehicleId and one shared id for every train at the stop,
    // so tell its trains apart by destination and time instead.
    const train = p.vehicleId || `${p.destinationNaptanId}@${p.expectedArrival}`;
    const id = `tfl:${p.lineId}:${train}:${p.platformName}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const { platform, direction } = splitPlatform(p.platformName);
    const destination =
      (p.destinationName && cleanTflName(p.destinationName)) ||
      (p.towards && p.towards !== 'Check Front of Train' ? p.towards : '') ||
      'Check front of train';
    out.push({
      id,
      mode: p.modeName === 'dlr' ? 'dlr' : 'tube',
      time,
      status: 'live',
      statusText: '',
      destination,
      detail: direction,
      line: p.lineName ?? p.lineId ?? 'Tube',
      color: TUBE_COLORS[p.lineId ?? ''] ?? DEFAULT_COLOR,
      platform,
    });
  }
  return out;
}

export async function fetchTflArrivals(naptanId: string, signal?: AbortSignal): Promise<Departure[]> {
  countRequest('tfl-arrivals');
  const res = await fetch(`${BASE}/StopPoint/${encodeURIComponent(naptanId)}/Arrivals`, { signal });
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  return parseArrivals(await res.json());
}

export async function searchTfl(query: string, signal?: AbortSignal): Promise<TflStop[]> {
  const url = `${BASE}/StopPoint/Search/${encodeURIComponent(query)}?modes=${MODES.join(',')}&maxResults=8`;
  countRequest('tfl-search');
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    matches?: { id: string; name: string; lat: number; lon: number; modes?: string[] }[];
  };
  return (body.matches ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    lat: m.lat,
    lon: m.lon,
    modes: (m.modes ?? []).filter((x) => MODES.includes(x)),
  }));
}
