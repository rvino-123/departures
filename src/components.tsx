import { useEffect, useState } from 'react';
import type { HomeSection } from './lib/board';
import { textOn } from './lib/colors';
import { DEFAULT_API_BASE } from './lib/nr';
import { searchNr } from './lib/stations';
import { searchTfl } from './lib/tfl';
import { cleanTflName } from './lib/geo';
import { formatClock, formatCountdown } from './lib/time';
import type { Departure, NrStation, Settings, TflStop } from './lib/types';

export function Row({ d, now }: { d: Departure; now: number }) {
  const cancelled = d.status === 'cancelled';
  const late = d.status === 'late';
  return (
    <li className={`row${cancelled ? ' cancelled' : ''}`}>
      <div className="row-time">
        <span className="clock">{formatClock(cancelled && d.scheduled ? d.scheduled : d.time)}</span>
        {!cancelled && <span className="countdown">{formatCountdown(d.time, now)}</span>}
      </div>
      <div className="row-main">
        <div className="dest">{d.destination}</div>
        <div className="meta">
          <span className="tag" style={{ background: d.color, color: textOn(d.color) }}>
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

export function HomeCard({ section, now }: { section: HomeSection; now: number }) {
  if (section.kind === 'hidden') return null;
  if (section.kind === 'none') {
    return <p className="home-none">No direct trains to {section.homeName} from here</p>;
  }
  return (
    <section className="home">
      <h2>To {section.homeName}</h2>
      <ul className="board">
        {section.trains.map((d) => (
          <Row key={d.id} d={d} now={now} />
        ))}
      </ul>
    </section>
  );
}

export type SearchPick = { kind: 'nr'; station: NrStation } | { kind: 'tfl'; stop: TflStop };

export function StationSearch({
  onPick,
  placeholder = 'Search for a station',
  railOnly = false,
  autoFocus = false,
}: {
  onPick: (p: SearchPick) => void;
  placeholder?: string;
  railOnly?: boolean;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [tfl, setTfl] = useState<TflStop[]>([]);
  const nr = searchNr(q, 6);
  // Hide Tube/DLR results that duplicate a rail result (e.g. Bond Street) – picking the rail one merges them anyway.
  const railNames = new Set(nr.map((s) => s.name.toLowerCase()));
  const tflShown = tfl.filter((s) => !railNames.has(cleanTflName(s.name).toLowerCase()));

  useEffect(() => {
    if (railOnly || q.trim().length < 3) {
      setTfl([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => searchTfl(q.trim(), ctrl.signal).then(setTfl).catch(() => {}), 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, railOnly]);

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
      {(nr.length > 0 || tflShown.length > 0) && (
        <ul className="results">
          {nr.map((s) => (
            <li key={s.crs}>
              <button onClick={() => pick({ kind: 'nr', station: s })}>
                {s.name} <small>{s.crs}</small>
              </button>
            </li>
          ))}
          {tflShown.map((s) => (
            <li key={s.id}>
              <button onClick={() => pick({ kind: 'tfl', stop: s })}>
                {cleanTflName(s.name)} <small>{s.modes.join(' · ').toUpperCase()}</small>
              </button>
            </li>
          ))}
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

export function SettingsSheet({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
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
        <details className="help">
          <summary>Advanced</summary>
          <label htmlFor="base">Live Departure Board API address</label>
          <input id="base" value={s.apiBase} onChange={(e) => setS({ ...s, apiBase: e.target.value })} />
          <button className="link" onClick={() => setS({ ...s, apiBase: DEFAULT_API_BASE })}>
            Reset to default
          </button>
        </details>
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
