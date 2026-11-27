import raw from '../data/stations.json';
import { distanceMetres, MERGE_METRES, mergeIntoPlaces, nearestNrStations } from './geo';
import { MAX_STATION_METRES } from './locate';
import { fetchNearbyTfl } from './tfl';
import type { NrStation, Place, TflStop } from './types';

/** National Rail stations, from github.com/davwheat/uk-railway-stations (ODbL). */
export const NR_STATIONS: NrStation[] = (raw as [string, string, number, number][]).map(
  ([name, crs, lat, lon]) => ({ name, crs, lat, lon }),
);

export function findNr(crs: string): NrStation | undefined {
  return NR_STATIONS.find((s) => s.crs === crs);
}

export function searchNr(query: string, limit = 8): NrStation[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = NR_STATIONS.filter((s) => s.crs.toLowerCase() === q);
  const starts = NR_STATIONS.filter((s) => s.name.toLowerCase().startsWith(q) && !exact.includes(s));
  const contains = NR_STATIONS.filter(
    (s) => s.name.toLowerCase().includes(q) && !exact.includes(s) && !starts.includes(s),
  );
  return [...exact, ...starts, ...contains].slice(0, limit);
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
