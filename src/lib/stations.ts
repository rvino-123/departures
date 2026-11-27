import raw from '../data/stations.json';
import { cleanTflName, distanceMetres, MERGE_METRES, mergeIntoPlaces, nearestNrStations } from './geo';
import { MAX_STATION_METRES } from './locate';
import { fetchNearbyTfl } from './tfl';
import type { NrStation, Place, SearchPick, TflStop } from './types';

/** National Rail stations, from github.com/davwheat/uk-railway-stations (ODbL). */
export const NR_STATIONS: NrStation[] = (raw as [string, string, number, number][]).map(
  ([name, crs, lat, lon]) => ({ name, crs, lat, lon }),
);

export function findNr(crs: string): NrStation | undefined {
  return NR_STATIONS.find((s) => s.crs === crs);
}

export function searchNr(query: string, limit = Infinity): NrStation[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = NR_STATIONS.filter((s) => s.crs.toLowerCase() === q);
  const starts = NR_STATIONS.filter((s) => s.name.toLowerCase().startsWith(q) && !exact.includes(s));
  const contains = NR_STATIONS.filter(
    (s) => s.name.toLowerCase().includes(q) && !exact.includes(s) && !starts.includes(s),
  );
  return [...exact, ...starts, ...contains].slice(0, limit);
}

/** Stations this close to where the user is rank above better name matches further away. */
export const LOCAL_SEARCH_METRES = 40_000;

/** 0 exact, 1 name starts with it, 2 a word starts with it, 3 somewhere inside; undefined if no match. */
function matchTier(name: string, q: string, crs?: string): number | undefined {
  const n = name.toLowerCase();
  if (n === q || crs?.toLowerCase() === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s\-&'(),./]+/).some((w) => w.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  return undefined;
}

/**
 * National Rail and TfL search results as one list: stations near the user first (so "bank" finds
 * London's Bank before Bank Hall), then by how well the name matches, then by distance.
 */
export function rankSearch(
  query: string,
  nr: NrStation[],
  tfl: TflStop[],
  near?: { lat: number; lon: number },
  limit = 8,
): SearchPick[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // A Tube/DLR stop with the same name as a rail station would merge into it anyway (e.g. Bond Street).
  const railNames = new Set(nr.map((s) => s.name.toLowerCase()));
  const ranked: { pick: SearchPick; name: string; tier: number; dist: number }[] = [];
  const add = (pick: SearchPick, name: string, lat: number, lon: number, crs?: string) => {
    // TfL's own search already decided its results match (it forgives typos), so keep them all.
    const tier = matchTier(name, q, crs) ?? (pick.kind === 'tfl' ? 3 : undefined);
    if (tier === undefined) return;
    ranked.push({ pick, name, tier, dist: near ? distanceMetres(near.lat, near.lon, lat, lon) : 0 });
  };
  for (const s of nr) add({ kind: 'nr', station: s }, s.name, s.lat, s.lon, s.crs);
  for (const s of tfl) {
    const name = cleanTflName(s.name);
    if (!railNames.has(name.toLowerCase())) add({ kind: 'tfl', stop: s }, name, s.lat, s.lon);
  }
  const far = (d: number) => (d > LOCAL_SEARCH_METRES ? 1 : 0);
  return ranked
    .sort((a, b) => far(a.dist) - far(b.dist) || a.tier - b.tier || a.dist - b.dist || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((r) => r.pick);
}

/** Stations around a GPS fix, nearest first, with NR and Tube/DLR platforms merged. */
export async function placesNear(lat: number, lon: number, signal?: AbortSignal): Promise<Place[]> {
  const nr = nearestNrStations(NR_STATIONS, lat, lon, MAX_STATION_METRES, 6);
  const tfl = await fetchNearbyTfl(lat, lon, 1000, signal).catch((): TflStop[] => []);
  return mergeIntoPlaces(nr, tfl, { lat, lon });
}

/** A single place built around a chosen NR station (adds any Tube/DLR platforms next to it). */
export async function placeForNr(station: NrStation, signal?: AbortSignal): Promise<Place> {
  const tfl = await fetchNearbyTfl(station.lat, station.lon, 400, signal).catch((): TflStop[] => []);
  const places = mergeIntoPlaces([station], tfl);
  return places.find((p) => p.crs.includes(station.crs)) ?? places[0];
}

/** How far a station can be from a Tube/DLR stop and still be joined to it by hub code. */
const HUB_CRS_METRES = 1000;
/** How long to wait for the stations inside an interchange before falling back to the interchange. */
const HUB_LOOKUP_MS = 3000;

/**
 * A single place built around a chosen Tube/DLR stop (adds an NR station if one is right next to it).
 * Search can return an interchange ("HUBBAN") rather than a station. TfL has no arrivals for an
 * interchange, so it is swapped for the Tube and DLR stations inside it.
 */
export async function placeForTfl(stop: TflStop, signal?: AbortSignal): Promise<Place> {
  const isHub = stop.id.startsWith('HUB');
  const hub = isHub ? stop.id : stop.hub;
  let stops = [stop];
  if (isHub) {
    // The user is waiting on this with the search closed, so don't let a slow network hold them up.
    const nearby = await fetchNearbyTfl(stop.lat, stop.lon, 400, signal ?? AbortSignal.timeout(HUB_LOOKUP_MS)).catch(
      (): TflStop[] => [],
    );
    const inside = nearby.filter((s) => s.hub === stop.id);
    if (inside.length > 0) stops = inside;
  }
  // A hub code only sometimes embeds a CRS code (HUBLST is Liverpool Street, but HUBBAN is Bank, not
  // Banbury), so only trust it for a station that's actually nearby.
  const nr = NR_STATIONS.filter((s) => {
    const d = distanceMetres(s.lat, s.lon, stop.lat, stop.lon);
    return d <= MERGE_METRES || (hub === `HUB${s.crs}` && d <= HUB_CRS_METRES);
  });
  const places = mergeIntoPlaces(nr, stops);
  return places.find((p) => stops.some((s) => p.tflIds.includes(s.id))) ?? places[0];
}
