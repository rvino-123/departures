import type { NrStation, Place, TflStop } from './types';

/** Platforms closer than this are treated as one station. */
export const MERGE_METRES = 150;

export function distanceMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestNrStations(
  stations: NrStation[],
  lat: number,
  lon: number,
  maxMetres: number,
  limit: number,
): (NrStation & { distance: number })[] {
  return stations
    .map((s) => ({ ...s, distance: distanceMetres(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distance <= maxMetres)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function cleanTflName(name: string): string {
  return name
    .replace(/\s+(Underground|DLR|Rail)\s+Station$/i, '')
    .replace(/\s+Station$/i, '')
    .trim();
}

interface Member {
  lat: number;
  lon: number;
}

/**
 * Merge NR stations and Tube/DLR stops into places.
 * A TfL stop joins a place if its hub code names one of the place's CRS codes
 * (e.g. HUBLST ↔ LST), or if it is within MERGE_METRES of any member.
 */
export function mergeIntoPlaces(
  nr: NrStation[],
  tfl: TflStop[],
  user?: { lat: number; lon: number },
): Place[] {
  const places: (Place & { members: Member[] })[] = nr.map((s) => ({
    key: `nr:${s.crs}`,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    crs: [s.crs],
    tflIds: [],
    members: [{ lat: s.lat, lon: s.lon }],
  }));

  for (const stop of tfl) {
    const hubCrs = stop.hub?.startsWith('HUB') ? stop.hub.slice(3) : undefined;
    let target = hubCrs ? places.find((p) => p.crs.includes(hubCrs)) : undefined;
    target ??= places.find((p) =>
      p.members.some((m) => distanceMetres(m.lat, m.lon, stop.lat, stop.lon) <= MERGE_METRES),
    );
    if (target) {
      if (!target.tflIds.includes(stop.id)) target.tflIds.push(stop.id);
      target.members.push({ lat: stop.lat, lon: stop.lon });
    } else {
      places.push({
        key: `tfl:${stop.id}`,
        name: cleanTflName(stop.name),
        lat: stop.lat,
        lon: stop.lon,
        crs: [],
        tflIds: [stop.id],
        members: [{ lat: stop.lat, lon: stop.lon }],
      });
    }
  }

  const result: Place[] = places.map(({ members, ...p }) => {
    if (!user) return p;
    const distance = Math.min(...members.map((m) => distanceMetres(user.lat, user.lon, m.lat, m.lon)));
    return { ...p, distance };
  });
  if (user) result.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return result;
}
