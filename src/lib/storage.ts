import { DEFAULT_API_BASE } from './nr';
import type { Place, Settings } from './types';
import type { PlaceData } from './load';

const SETTINGS_KEY = 'departures:settings';
const CACHE_KEY = 'departures:last';
const THEME_KEY = 'departures:theme';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  homeCrs: '',
  homeName: '',
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

/** The user's manual theme choice, or undefined to follow the OS setting. */
export function loadTheme(): 'light' | 'dark' | undefined {
  return read<'light' | 'dark'>(THEME_KEY);
}

export function saveTheme(theme: 'light' | 'dark') {
  write(THEME_KEY, theme);
}
