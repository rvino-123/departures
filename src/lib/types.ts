export type Mode = 'nr' | 'tube' | 'dlr';

/** A National Rail station from the bundled stations list. */
export interface NrStation {
  name: string;
  crs: string;
  lat: number;
  lon: number;
}

/** A Tube or DLR station from TfL's nearby search. */
export interface TflStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  /** e.g. "HUBLST" – TfL's interchange code, which embeds the CRS code at big stations. */
  hub?: string;
}

/** One "station" as the user sees it: NR + Tube/DLR platforms merged together. */
export interface Place {
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** metres from the user, when found by GPS */
  distance?: number;
  crs: string[];
  tflIds: string[];
}

export type Status = 'on-time' | 'late' | 'cancelled' | 'live';

export interface Departure {
  id: string;
  mode: Mode;
  /** best-known departure time, epoch ms (scheduled time when cancelled) */
  time: number;
  scheduled?: number;
  status: Status;
  statusText: string;
  /** Delayed with no expected time yet; stays listed until National Rail drops it. */
  awaitingEstimate?: boolean;
  destination: string;
  /** extra context: "via Clapham Jn" for rail, "Eastbound" for Tube */
  detail?: string;
  line: string;
  color: string;
  platform?: string;
}

export interface Settings {
  apiKey: string;
  homeCrs: string;
  homeName: string;
  apiBase: string;
  setupDone: boolean;
}
