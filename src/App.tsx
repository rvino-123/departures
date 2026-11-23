import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeCard, Loader, Row, SettingsSheet, Setup, StationSearch, type SearchPick } from './components';
import { getFix, useGestures, useNow, useOnVisible, usePlaceData, useTheme } from './hooks';
import { buildBoard, homeSection } from './lib/board';
import { decideLocation, REASON_TEXT, type FallbackReason } from './lib/locate';
import { findNr, placeForNr, placeForTfl, placesNear } from './lib/stations';
import { forgetRejectedKey } from './lib/nr';
import { loadSettings, saveSettings } from './lib/storage';
import { formatClock } from './lib/time';
import type { Place, Settings } from './lib/types';
import './App.css';

type View =
  | { kind: 'locating' }
  | { kind: 'nearby'; places: Place[] }
  | { kind: 'fallback'; reason: FallbackReason; place?: Place }
  | { kind: 'manual'; place: Place };

const RELOCATE_AFTER_MS = 60_000;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (s: Settings) => {
    forgetRejectedKey();
    saveSettings(s);
    setSettings(s);
  };
  if (!settings.setupDone) return <Setup initial={settings} onDone={update} />;
  return <Main settings={settings} onSettings={update} />;
}

function formatDistance(m?: number) {
  if (m === undefined) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

function Main({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [view, setView] = useState<View>({ kind: 'locating' });
  const [tab, setTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const lastLocate = useRef(0);
  // Bumped by every locate and every pick, so a slow one can't overwrite a newer choice.
  const nav = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const now = useNow();
  const [theme, toggleTheme] = useTheme();

  const locate = useCallback(async () => {
    const id = ++nav.current;
    lastLocate.current = Date.now();
    const fix = await getFix();
    if (id !== nav.current) return;
    const places = 'error' in fix ? [] : await placesNear(fix.lat, fix.lon).catch(() => []);
    if (id !== nav.current) return;
    const outcome = decideLocation(fix, places);
    if (outcome.kind === 'nearby') {
      setView((v) => {
        // Keep the same tab if the nearest station hasn't changed.
        if (v.kind !== 'nearby' || v.places[0]?.key !== outcome.places[0]?.key) setTab(0);
        return { kind: 'nearby', places: outcome.places };
      });
      return;
    }
    const home = findNr(settings.homeCrs);
    const place = home ? await placeForNr(home) : undefined;
    if (id !== nav.current) return;
    setView({ kind: 'fallback', reason: outcome.reason, place });
    setTab(0);
  }, [settings.homeCrs]);

  // On start, and when the home station changes – but leave a station the user picked alone.
  useEffect(() => {
    if (viewRef.current.kind !== 'manual') locate();
  }, [locate]);

  useOnVisible(() => {
    if (view.kind !== 'manual' && Date.now() - lastLocate.current > RELOCATE_AFTER_MS) locate();
  });

  const places: Place[] =
    view.kind === 'nearby'
      ? view.places
      : view.kind === 'manual'
        ? [view.place]
        : view.kind === 'fallback' && view.place
          ? [view.place]
          : [];
  const place = places[Math.min(tab, places.length - 1)];
  const { data, loading, offline, refresh } = usePlaceData(place, settings);

  const pull = useGestures({
    onRefresh: () => {
      if (view.kind !== 'manual') locate();
      refresh();
    },
    onSwipe: (dir) => setTab((t) => Math.max(0, Math.min(places.length - 1, t + dir))),
  });

  const pick = async (p: SearchPick) => {
    setShowSearch(false);
    const id = ++nav.current;
    const chosen = p.kind === 'nr' ? await placeForNr(p.station) : placeForTfl(p.stop);
    if (id !== nav.current) return;
    setTab(0);
    setView({ kind: 'manual', place: chosen });
  };

  const hasKey = settings.apiKey.trim() !== '';
  const board = useMemo(() => (data ? buildBoard(data.departures, now) : []), [data, now]);
  const home = useMemo(() => {
    if (!place) return { kind: 'hidden' } as const;
    // If the key was rejected or the home request failed, we can't honestly say "no trains".
    const canAsk = hasKey && !data?.keyRejected && !data?.homeFailed;
    return homeSection(place, { crs: settings.homeCrs, name: settings.homeName }, canAsk, data?.homeDeps ?? [], now);
  }, [place, settings.homeCrs, settings.homeName, hasKey, data, now]);
  const showData = data && place && data.placeKey === place.key;

  return (
    <div className="app">
      <div className="pull" style={{ height: pull ? pull / 2 : 0 }}>
        {pull > 80 ? 'Release to refresh' : 'Pull to refresh'}
      </div>

      <header className="top">
        <div className="title">
          <h1>{place?.name ?? (view.kind === 'locating' ? 'Finding your station…' : 'Departures')}</h1>
          <p className="sub">
            {loading && 'Updating… '}
            {data && !loading && `Updated ${formatClock(data.fetchedAt)}`}
          </p>
        </div>
        <div className="actions">
          <button aria-label="Search stations" onClick={() => setShowSearch((s) => !s)}>
            ⌕
          </button>
          <button aria-label="Refresh" onClick={refresh}>
            ↻
          </button>
          <button aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button aria-label="Settings" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </header>

      {places.length > 1 && (
        <nav className="tabs">
          {places.map((p, i) => (
            <button key={p.key} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
              <span>{p.name}</span>
              <small>{formatDistance(p.distance)}</small>
            </button>
          ))}
        </nav>
      )}

      {(showSearch || view.kind === 'fallback') && (
        <StationSearch onPick={pick} autoFocus={showSearch} />
      )}

      {view.kind === 'fallback' && <p className="note">{REASON_TEXT[view.reason]}</p>}
      {view.kind === 'manual' && (
        <button className="note link" onClick={locate}>
          ⦿ Use my location instead
        </button>
      )}

      {offline && data && (
        <p className="banner offline">Offline · as of {formatClock(data.fetchedAt)}</p>
      )}
      {offline && !data && <p className="banner offline">Offline, and nothing saved for this station yet.</p>}
      {!hasKey && (
        <button className="banner" onClick={() => setShowSettings(true)}>
          Add your National Rail key to see trains →
        </button>
      )}
      {data?.keyRejected && (
        <button className="banner bad" onClick={() => setShowSettings(true)}>
          Your National Rail key was rejected. Check it in settings →
        </button>
      )}
      {data?.partial && !offline && <p className="banner">Some departures couldn’t load.</p>}

      <div className={offline ? 'stale' : ''}>
        {showData && <HomeCard section={home} now={now} />}

        {showData && (
          <section>
            {home.kind !== 'hidden' && <h2>All departures</h2>}
            {board.length > 0 ? (
              <ul className="board">
                {board.map((d) => (
                  <Row key={d.id} d={d} now={now} />
                ))}
              </ul>
            ) : (
              <p className="empty">
                {!hasKey && place.tflIds.length === 0
                  ? 'Add your National Rail key to see trains here.'
                  : data.keyRejected || data.partial
                    ? 'Couldn’t load departures for this station.'
                    : 'No departures in the next 90 minutes.'}
              </p>
            )}
          </section>
        )}
        {view.kind === 'locating' && <Loader message="Finding stations near you…" />}
        {!showData && place && !offline && <Loader message="Checking train times…" />}
      </div>

      <footer>
        Powered by TfL Open Data · National Rail Enquiries data via Rail Data Marketplace · Station list ©{' '}
        <a href="https://github.com/davwheat/uk-railway-stations" target="_blank" rel="noreferrer">
          uk-railway-stations
        </a>{' '}
        (ODbL)
      </footer>

      {showSettings && (
        <SettingsSheet
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => {
            onSettings(s);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
