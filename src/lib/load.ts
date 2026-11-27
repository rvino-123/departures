import { HOME_TRAINS } from './board';
import { fetchNrBoard, NrKeyError } from './nr';
import { fetchTflArrivals } from './tfl';
import type { Departure, Place, Settings } from './types';

export interface PlaceData {
  placeKey: string;
  departures: Departure[];
  homeDeps: Departure[];
  /** the "trains calling at home" request failed, so we can't say there are none */
  homeFailed: boolean;
  fetchedAt: number;
  /** some (not all) sources failed */
  partial: boolean;
  keyRejected: boolean;
  /** Which board sources failed (not counting a rejected key, or home). Missing on older saved boards. */
  failedSources?: BoardSource[];
}

export type BoardSource = 'tfl' | 'nr';

/** The banner for a board where some sources failed, or undefined when the board itself is complete. */
export function partialMessage(data: Pick<PlaceData, 'partial' | 'failedSources'>): string | undefined {
  const failed = data.failedSources;
  if (!failed) return data.partial ? 'Some departures couldn’t load.' : undefined;
  const tfl = failed.includes('tfl');
  const nr = failed.includes('nr');
  if (tfl && nr) return 'Some departures couldn’t load.';
  if (tfl) return 'Tube and DLR times couldn’t load.';
  if (nr) return 'National Rail times couldn’t load.';
  return undefined;
}

export class AllSourcesFailed extends Error {}

/** Fetch everything one place needs: NR board, Tube/DLR arrivals, and trains calling at home. */
export async function loadPlace(place: Place, s: Settings, signal?: AbortSignal): Promise<PlaceData> {
  const hasKey = s.apiKey.trim() !== '';
  const nr = { apiKey: s.apiKey.trim(), apiBase: s.apiBase, signal };
  const wantHome = hasKey && s.homeCrs && place.crs.length > 0 && !place.crs.includes(s.homeCrs);

  const boardSources: BoardSource[] = [];
  const boardJobs: Promise<Departure[]>[] = [];
  for (const id of place.tflIds) {
    boardSources.push('tfl');
    boardJobs.push(fetchTflArrivals(id, signal));
  }
  if (hasKey) {
    for (const crs of place.crs) {
      boardSources.push('nr');
      boardJobs.push(fetchNrBoard({ ...nr, crs, timeWindow: 90, numRows: 40 }));
    }
  }

  const homeJob = async (): Promise<Departure[]> => {
    if (!wantHome) return [];
    const first = await Promise.all(
      place.crs.map((crs) => fetchNrBoard({ ...nr, crs, filterCrs: s.homeCrs, timeWindow: 120, numRows: 10 })),
    );
    let deps = first.flat();
    const live = deps.filter((d) => d.status !== 'cancelled');
    if (live.length < HOME_TRAINS) {
      // The API looks at most 2 hours ahead per request; ask again for hour three.
      const later = await Promise.all(
        place.crs.map((crs) =>
          fetchNrBoard({ ...nr, crs, filterCrs: s.homeCrs, timeOffset: 119, timeWindow: 61, numRows: 10 }),
        ),
      );
      deps = deps.concat(later.flat());
    }
    return deps;
  };

  const [boards, home] = await Promise.all([Promise.allSettled(boardJobs), Promise.allSettled([homeJob()])]);
  const results = [...boards, ...home];
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  const keyRejected = failed.some((r) => r.reason instanceof NrKeyError);

  if (results.length > 0 && failed.length === results.length && !keyRejected) {
    throw new AllSourcesFailed('Could not reach any departure source');
  }

  const failedSources = [
    ...new Set(
      boards.flatMap((r, i) => (r.status === 'rejected' && !(r.reason instanceof NrKeyError) ? [boardSources[i]] : [])),
    ),
  ];

  return {
    placeKey: place.key,
    departures: boards.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    homeDeps: home[0].status === 'fulfilled' ? home[0].value : [],
    homeFailed: home[0].status === 'rejected',
    fetchedAt: Date.now(),
    partial: failed.length > 0 && !keyRejected,
    keyRejected,
    failedSources,
  };
}
