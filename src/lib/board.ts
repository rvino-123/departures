import type { Departure, Place } from './types';

export const BOARD_MINUTES = 90;
export const BOARD_MAX_ROWS = 25;
export const HOME_TRAINS = 4;
export const HOME_HOURS = 3;
/** How long a delayed train with no estimate stays listed after it was due, so old saved boards don't keep it forever. */
export const DELAYED_KEEP_MINUTES = 120;

/** Combine departures from every source into one time-ordered board. */
export function buildBoard(
  deps: Departure[],
  now: number,
  minutes = BOARD_MINUTES,
  maxRows = BOARD_MAX_ROWS,
): Departure[] {
  const seen = new Set<string>();
  return deps
    .filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      // A delayed train with no estimate hasn't left yet, even though it was due a while ago.
      const earliest = now - (d.awaitingEstimate ? DELAYED_KEEP_MINUTES : 1) * 60_000;
      return d.time >= earliest && d.time <= now + minutes * 60_000;
    })
    // Listed in timetable order, as on a station board, so the time column always reads in order.
    .sort((a, b) => boardTime(a) - boardTime(b) || a.destination.localeCompare(b.destination))
    .slice(0, maxRows);
}

/**
 * The time a row is listed under. Late and cancelled trains keep their timetabled time, which is how
 * people know their train ("the 08:30"); the expected time goes in the status instead.
 */
export function boardTime(d: Departure): number {
  if ((d.status === 'late' || d.status === 'cancelled') && d.scheduled !== undefined) return d.scheduled;
  return d.time;
}

export type HomeSection =
  | { kind: 'hidden' }
  /** A Tube/DLR-only stop: National Rail can't be asked about it. */
  | { kind: 'noRail'; homeName: string }
  /** We couldn't ask, so we can't say whether there are trains. */
  | { kind: 'unknown'; homeName: string; reason: 'failed' | 'rejected' }
  /** We asked, and nothing runs in the next HOME_HOURS. */
  | { kind: 'none'; homeName: string }
  | { kind: 'trains'; homeName: string; trains: Departure[] };

export interface HomeStatus {
  hasKey: boolean;
  keyRejected?: boolean;
  homeFailed?: boolean;
}

/**
 * What the pinned "To home" section should show.
 * `homeDeps` are departures already filtered (by National Rail) to ones calling at home.
 */
export function homeSection(
  place: Place,
  home: { crs: string; name: string },
  status: HomeStatus,
  homeDeps: Departure[],
  now: number,
): HomeSection {
  if (!home.crs || place.crs.includes(home.crs)) return { kind: 'hidden' };
  const homeName = home.name;
  if (place.crs.length === 0) return { kind: 'noRail', homeName };
  // Without a key the "add your key" banner already explains why there's nothing here.
  if (!status.hasKey) return { kind: 'hidden' };
  if (status.keyRejected) return { kind: 'unknown', homeName, reason: 'rejected' };
  if (status.homeFailed) return { kind: 'unknown', homeName, reason: 'failed' };
  const trains = buildBoard(homeDeps, now, HOME_HOURS * 60, HOME_TRAINS);
  if (trains.length === 0) return { kind: 'none', homeName };
  return { kind: 'trains', homeName, trains };
}
