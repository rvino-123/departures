import { useEffect, useState } from 'react';
import { boardTime, HOME_HOURS, type HomeSection } from './lib/board';
import { tagEdges, textOn } from './lib/colors';
import { DEFAULT_API_BASE } from './lib/nr';
import { rankSearch, searchNr } from './lib/stations';
import { searchTfl } from './lib/tfl';
import { cleanTflName } from './lib/geo';
import { formatClock, formatCountdown } from './lib/time';
import type { Departure, SearchPick, Settings, TflStop } from './lib/types';
import { lastMinute, loadUsage, type Counts, type RequestKind } from './lib/usage';
import { useNow } from './hooks';

export function Row({ d, now }: { d: Departure; now: number }) {
  const cancelled = d.status === 'cancelled';
  const late = d.status === 'late';
  return (
    <li className={`row${cancelled ? ' cancelled' : ''}`}>
      <div className="row-time">
        <span className="clock">{formatClock(boardTime(d))}</span>
        {!cancelled && !d.awaitingEstimate && <span className="countdown">{formatCountdown(d.time, now)}</span>}
      </div>
      <div className="row-main">
        <div className="dest">{d.destination}</div>
        <div className="meta">
          <span className={`tag ${tagEdges(d.color)}`} style={{ background: d.color, color: textOn(d.color) }}>
            {d.line}
          </span>
          {d.platform && <span className="plat">Plat {d.platform}</span>}
          {d.detail && <span className="detail">{d.detail}</span>}
        </div>
      </div>
      <div className={`status ${cancelled ? 'bad' : late ? 'warn' : ''}`}>
        {d.mode === 'nr' ? d.statusText : ''}
      </div>
    </li>
  );
}

export function Loader({ message }: { message: string }) {
  return (
    <div className="loader" role="status">
      <div className="loader-bar" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function HomeCard({
  section,
  now,
  onRetry,
}: {
  section: HomeSection;
  now: number;
  onRetry: () => void;
}) {
  if (section.kind === 'hidden') return null;
  return (
    <section className="plate home">
      <h2>To {section.homeName}</h2>
      {section.kind === 'trains' && (
        <ul className="board">
          {section.trains.map((d) => (
            <Row key={d.id} d={d} now={now} />
          ))}
        </ul>
      )}
      {section.kind === 'none' && <p className="home-note">None in the next {HOME_HOURS} hours.</p>}
      {section.kind === 'noRail' && <p className="home-note">No direct trains from here.</p>}
      {section.kind === 'unknown' && section.reason === 'rejected' && (
        <p className="home-note">Couldn’t check: your National Rail key was rejected.</p>
      )}
      {section.kind === 'unknown' && section.reason === 'failed' && (
        <p className="home-note">
          Couldn’t check trains home.{' '}
          <button className="link" onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
    </section>
  );
}

/** Line icons drawn to one size and stroke, in place of mismatched Unicode glyphs. */
export function Icon({ name }: { name: 'search' | 'refresh' | 'settings' | 'locate' }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'search' && (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v5h-5" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === 'locate' && (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </>
      )}
    </svg>
  );
}

/** TfL search runs from this many characters; shorter queries search National Rail only. */
const TFL_SEARCH_MIN = 3;
/** Stop waiting for TfL and show the rail results after this long. */
const TFL_SEARCH_GIVE_UP_MS = 2500;

export function StationSearch({
  onPick,
  placeholder = 'Search for a station',
  railOnly = false,
  autoFocus = false,
  near,
}: {
  onPick: (p: SearchPick) => void;
  placeholder?: string;
  railOnly?: boolean;
  autoFocus?: boolean;
  /** Where the user is (or the station they're looking at), so nearby stations rank first. */
  near?: { lat: number; lon: number };
}) {
  const [q, setQ] = useState('');
  // TfL results, tagged with the query they answer, so stale ones are never shown.
  const [tfl, setTfl] = useState<{ q: string; stops: TflStop[] }>({ q: '', stops: [] });
  const query = q.trim();
  const wantTfl = !railOnly && query.length >= TFL_SEARCH_MIN;
  // Wait for TfL before showing anything, so the list appears once instead of reshuffling under a thumb.
  const waiting = wantTfl && tfl.q !== query;
  const results = waiting ? [] : rankSearch(query, searchNr(query), wantTfl ? tfl.stops : [], near);

  useEffect(() => {
    if (!wantTfl) return;
    const ctrl = new AbortController();
    const settle = (stops: TflStop[]) => setTfl((r) => (r.q === query ? r : { q: query, stops }));
    const t = setTimeout(
      () =>
        searchTfl(query, ctrl.signal)
          .then(settle)
          .catch(() => {
            if (!ctrl.signal.aborted) settle([]);
          }),
      250,
    );
    const giveUp = setTimeout(() => {
      ctrl.abort();
      settle([]);
    }, TFL_SEARCH_GIVE_UP_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(giveUp);
      ctrl.abort();
    };
  }, [query, wantTfl]);

  const pick = (p: SearchPick) => {
    setQ('');
    onPick(p);
  };

  return (
    <div className="search">
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
      />
      {waiting && (
        <ul className="results" aria-busy="true">
          <li className="searching">Searching…</li>
        </ul>
      )}
      {results.length > 0 && (
        <ul className="results">
          {results.map((r) =>
            r.kind === 'nr' ? (
              <li key={r.station.crs}>
                <button onClick={() => pick(r)}>
                  {r.station.name} <small>{r.station.crs}</small>
                </button>
              </li>
            ) : (
              <li key={r.stop.id}>
                <button onClick={() => pick(r)}>
                  {cleanTflName(r.stop.name)} <small>{r.stop.modes.join(' · ').toUpperCase()}</small>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function KeyHelp() {
  return (
    <details className="help">
      <summary>How do I get a key?</summary>
      <ol>
        <li>
          Register (free) at{' '}
          <a href="https://raildata.org.uk" target="_blank" rel="noreferrer">
            raildata.org.uk
          </a>
          .
        </li>
        <li>Search the catalogue for “Live Departure Board” and subscribe to it.</li>
        <li>Open the product’s Specification/Credentials tab and copy the Consumer key.</li>
        <li>Paste it here. It’s saved only on this phone.</li>
      </ol>
    </details>
  );
}

function HomePicker({
  settings,
  onChange,
  label = 'Home station',
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  label?: string;
}) {
  const [editing, setEditing] = useState(!settings.homeCrs);
  return (
    <div className="field">
      <label>{label}</label>
      {editing ? (
        <StationSearch
          railOnly
          autoFocus={!!settings.homeCrs}
          placeholder="Type your home station"
          onPick={(p) => {
            if (p.kind === 'nr') onChange({ ...settings, homeCrs: p.station.crs, homeName: p.station.name });
            setEditing(false);
          }}
        />
      ) : (
        <div className="home-pick">
          <strong>{settings.homeName}</strong>
          <button className="link" onClick={() => setEditing(true)}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}

export function Setup({ initial, onDone }: { initial: Settings; onDone: (s: Settings) => void }) {
  const [s, setS] = useState(initial);
  return (
    <main className="setup">
      <h1>Departures</h1>
      <p className="lead">Live trains from the station you’re nearest to. Three quick things:</p>

      <div className="field">
        <label htmlFor="key">1. National Rail key</label>
        <input
          id="key"
          value={s.apiKey}
          onChange={(e) => setS({ ...s, apiKey: e.target.value })}
          placeholder="Paste your Rail Data Marketplace key"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <KeyHelp />
        <p className="hint">You can skip this: the Tube and DLR work without it.</p>
      </div>

      <HomePicker settings={s} onChange={setS} label="2. Home station" />

      <button
        className="primary"
        disabled={!s.homeCrs}
        onClick={() => onDone({ ...s, apiKey: s.apiKey.trim(), setupDone: true })}
      >
        3. Use my location
      </button>
      {!s.homeCrs && <p className="hint">Pick your home station first.</p>}
    </main>
  );
}

const USAGE_ROWS: { label: string; kinds: RequestKind[]; total?: boolean }[] = [
  { label: 'National Rail', kinds: ['nr-board', 'nr-home'], total: true },
  { label: 'Station boards', kinds: ['nr-board'] },
  { label: 'Trains home', kinds: ['nr-home'] },
  { label: 'TfL', kinds: ['tfl-arrivals', 'tfl-nearby', 'tfl-search'], total: true },
  { label: 'Arrivals', kinds: ['tfl-arrivals'] },
  { label: 'Nearby stops', kinds: ['tfl-nearby'] },
  { label: 'Station search', kinds: ['tfl-search'] },
];

function UsageStats() {
  const now = useNow(5_000);
  const usage = loadUsage(now);
  const sum = (c: Counts, kinds: RequestKind[]) => kinds.reduce((n, k) => n + c[k], 0);
  return (
    <details className="help">
      <summary>Usage · {lastMinute(now)} requests in the last minute</summary>
      <table className="usage">
        <thead>
          <tr>
            <th />
            <th>Today</th>
            <th>7 days</th>
            <th>30 days</th>
          </tr>
        </thead>
        <tbody>
          {USAGE_ROWS.map((r) => (
            <tr key={r.label} className={r.total ? 'total' : undefined}>
              <th>{r.label}</th>
              <td>{sum(usage.today, r.kinds)}</td>
              <td>{sum(usage.week, r.kinds)}</td>
              <td>{sum(usage.month, r.kinds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Every request this phone has sent, including failed ones.</p>
    </details>
  );
}

export function SettingsSheet({
  settings,
  onSave,
  onClose,
  theme,
  onToggleTheme,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const [s, setS] = useState(settings);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="field">
          <label htmlFor="key2">National Rail key</label>
          <input
            id="key2"
            value={s.apiKey}
            onChange={(e) => setS({ ...s, apiKey: e.target.value })}
            placeholder="Paste your Rail Data Marketplace key"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <KeyHelp />
        </div>
        <HomePicker settings={s} onChange={setS} />
        <div className="field">
          <span className="label" id="appearance">
            Appearance
          </span>
          <div className="segmented" role="group" aria-labelledby="appearance">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} aria-pressed={theme === t} onClick={() => theme !== t && onToggleTheme()}>
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        <details className="help">
          <summary>Advanced</summary>
          <label htmlFor="base">Live Departure Board API address</label>
          <input id="base" value={s.apiBase} onChange={(e) => setS({ ...s, apiBase: e.target.value })} />
          <button className="link" onClick={() => setS({ ...s, apiBase: DEFAULT_API_BASE })}>
            Reset to default
          </button>
        </details>
        <UsageStats />
        <div className="sheet-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() => onSave({ ...s, apiKey: s.apiKey.trim(), apiBase: s.apiBase.trim() || DEFAULT_API_BASE })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
