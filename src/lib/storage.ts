import { DEFAULT_API_BASE } from './nr';
import type { Place, Settings } from './types';
import type { PlaceData } from './load';

const SETTINGS_KEY = 'departures:settings';
const CACHE_KEY = 'departures:last';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  homeCrs: 'MAI',
  homeName: 'Maidenhead',
  apiBase: DEFAULT_API_BASE,
  setupDone: false,
};

function read<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) – app still works for this visit */
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY) };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export interface Snapshot {
  places: Place[];
  data: Record<string, PlaceData>;
}

export function loadSnapshot(): Snapshot | undefined {
  return read<Snapshot>(CACHE_KEY);
}

export function saveSnapshot(s: Snapshot) {
  write(CACHE_KEY, s);
}
