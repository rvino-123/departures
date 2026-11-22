import type { Place } from './types';

export const MAX_ACCURACY_METRES = 1000;
export const MAX_STATION_METRES = 3000;

export type FallbackReason = 'denied' | 'unavailable' | 'vague' | 'far';

export type LocationOutcome =
  | { kind: 'nearby'; places: Place[] }
  | { kind: 'fallback'; reason: FallbackReason };

export const REASON_TEXT: Record<FallbackReason, string> = {
  denied: 'Location access is off, so here’s your home station.',
  unavailable: 'Couldn’t get your location, so here’s your home station.',
  vague: 'Your location is too rough to pick a station, so here’s your home station.',
  far: 'No station within 3 km of you, so here’s your home station.',
};

/** Decide whether to trust GPS or fall back to the home station. */
export function decideLocation(
  fix: { accuracy: number } | { error: 'denied' | 'unavailable' },
  places: Place[],
  howMany = 3,
): LocationOutcome {
  if ('error' in fix) return { kind: 'fallback', reason: fix.error };
  if (fix.accuracy > MAX_ACCURACY_METRES) return { kind: 'fallback', reason: 'vague' };
  const near = places.filter((p) => (p.distance ?? Infinity) <= MAX_STATION_METRES).slice(0, howMany);
  if (near.length === 0) return { kind: 'fallback', reason: 'far' };
  return { kind: 'nearby', places: near };
}
