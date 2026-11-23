import { DEFAULT_API_BASE, OLD_API_BASES } from './nr';
import { findNr } from './stations';
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
  const s = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY) };
  // Earlier versions saved an older default address; move those to the current one.
  if (!s.apiBase || OLD_API_BASES.includes(s.apiBase.replace(/\/$/, ''))) s.apiBase = DEFAULT_API_BASE;
  if (import.meta.env.DEV) fillFromEnv(s);
  return s;
}

/** Dev-only: fill empty settings from .env.local, and skip setup once both are known. */
function fillFromEnv(s: Settings) {
  if (!s.apiKey) s.apiKey = import.meta.env.VITE_DEV_NR_API_KEY?.trim() ?? '';
  const home = !s.homeCrs && findNr(import.meta.env.VITE_DEV_HOME_CRS?.trim().toUpperCase() ?? '');
  if (home) {
    s.homeCrs = home.crs;
    s.homeName = home.name;
  }
  if (s.apiKey && s.homeCrs) s.setupDone = true;
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
