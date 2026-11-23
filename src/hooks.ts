import { useCallback, useEffect, useRef, useState } from 'react';
import { AllSourcesFailed, loadPlace, type PlaceData } from './lib/load';
import { loadSnapshot, loadTheme, saveSnapshot, saveTheme, type Snapshot } from './lib/storage';
import type { Place, Settings } from './lib/types';

export const REFRESH_MS = 30_000;

export type Fix = { lat: number; lon: number; accuracy: number } | { error: 'denied' | 'unavailable' };

export function getFix(): Promise<Fix> {
  if (import.meta.env.DEV) {
    // Dev-only: ?at=51.5178,-0.0817 fakes a GPS fix for testing in a desktop browser.
    const at = new URLSearchParams(window.location.search).get('at');
    if (at) {
      const [lat, lon] = at.split(',').map(Number);
      return Promise.resolve({ lat, lon, accuracy: 20 });
    }
  }
  if (!('geolocation' in navigator)) return Promise.resolve({ error: 'unavailable' });
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => resolve({ error: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    ),
  );
}

/** Re-renders every `ms` so countdowns stay fresh. */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Calls `fn` whenever the app comes back to the foreground. */
export function useOnVisible(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && ref.current();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
}

const snapshot: Snapshot = loadSnapshot() ?? { places: [], data: {} };

function remember(data: PlaceData) {
  snapshot.data[data.placeKey] = data;
  const keys = Object.keys(snapshot.data);
  if (keys.length > 12) {
    keys
      .sort((a, b) => snapshot.data[a].fetchedAt - snapshot.data[b].fetchedAt)
      .slice(0, keys.length - 12)
      .forEach((k) => delete snapshot.data[k]);
  }
  saveSnapshot(snapshot);
}

export interface PlaceState {
  data?: PlaceData;
  loading: boolean;
  offline: boolean;
}

/** Live departures for one place: loads now, every 30 s while visible, and on demand. */
export function usePlaceData(place: Place | undefined, settings: Settings) {
  const [state, setState] = useState<PlaceState>({ loading: false, offline: false });
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!place) return;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true }));
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const data = await loadPlace(place, settings, ctrl.signal);
      if (id !== requestId.current) return;
      remember(data);
      setState({ data, loading: false, offline: false });
    } catch (e) {
      if (id !== requestId.current) return;
      const offline = e instanceof AllSourcesFailed || e instanceof TypeError || (e as Error).name === 'AbortError';
      setState((s) => ({ data: s.data ?? snapshot.data[place.key], loading: false, offline }));
    } finally {
      clearTimeout(timeout);
    }
  }, [place, settings]);

  // New place: show what we last saw there straight away, then fetch.
  useEffect(() => {
    if (!place) return;
    setState({ data: snapshot.data[place.key], loading: true, offline: false });
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [place, refresh]);

  useOnVisible(refresh);
  return { ...state, refresh };
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(theme: 'light' | 'dark' | undefined) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
}

/** The effective light/dark theme (manual override, or the OS setting), and a toggle for it. */
export function useTheme(): ['light' | 'dark', () => void] {
  const [override, setOverride] = useState(loadTheme);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const effective = override ?? (systemDark ? 'dark' : 'light');

  useEffect(() => {
    applyTheme(override);
  }, [override, systemDark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setOverride((current) => {
      const next = (current ?? (systemPrefersDark() ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  return [effective, toggle];
}

/** Pull down from the top to refresh; swipe sideways to change tabs. */
export function useGestures(opts: { onRefresh: () => void; onSwipe: (dir: 1 | -1) => void }) {
  const [pull, setPull] = useState(0);
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let atTop = false;
    let dy = 0;
    const start = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      atTop = window.scrollY <= 0;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (atTop && dy > 0 && Math.abs(dy) > Math.abs(dx)) setPull(Math.min(dy, 120));
    };
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const ddy = e.changedTouches[0].clientY - startY;
      if (atTop && ddy > 80 && Math.abs(ddy) > Math.abs(dx)) ref.current.onRefresh();
      else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(ddy) * 2) ref.current.onSwipe(dx < 0 ? 1 : -1);
      setPull(0);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, []);
  return pull;
}
