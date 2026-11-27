import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBoard, homeSection } from './board';
import { distanceMetres, mergeIntoPlaces, nearestNrStations } from './geo';
import { decideLocation } from './locate';
import { fetchNrBoard, forgetRejectedKey, NrKeyError, parseNrBoard } from './nr';
import { parseArrivals, parseNearby } from './tfl';
import { clockToEpoch, formatCountdown } from './time';
import type { Departure, NrStation, Place, TflStop } from './types';
import { countRequest, dayKey, lastMinute, loadUsage, prune, summarise, type UsageDays } from './usage';

const at = (h: number, m: number, day = 21) => new Date(2026, 10, day, h, m).getTime();

const LST: NrStation = { name: 'London Liverpool Street', crs: 'LST', lat: 51.51821, lon: -0.08143 };
const RDG: NrStation = { name: 'Reading', crs: 'RDG', lat: 51.45886, lon: -0.97186 };
const ZFD: NrStation = { name: 'Farringdon', crs: 'ZFD', lat: 51.52007, lon: -0.10466 };
const lstTube: TflStop = {
  id: '940GZZLULVT', name: 'Liverpool Street Underground Station',
  lat: 51.517372, lon: -0.083182, modes: ['tube'], hub: 'HUBLST',
};
const angel: TflStop = { id: '940GZZLUAGL', name: 'Angel Underground Station', lat: 51.532624, lon: -0.105898, modes: ['tube'] };

function dep(over: Partial<Departure>): Departure {
  return {
    id: Math.random().toString(), mode: 'nr', time: at(12, 0), status: 'on-time', statusText: 'On time',
    destination: 'Reading', line: 'Elizabeth line', color: '#6950A1', ...over,
  };
}

describe('time', () => {
  it('reads clock times on the right day around midnight', () => {
    expect(clockToEpoch('00:05', at(23, 50))).toBe(at(0, 5, 22));
    expect(clockToEpoch('23:55', at(0, 10, 22))).toBe(at(23, 55, 21));
    expect(clockToEpoch('14:30', at(14, 0))).toBe(at(14, 30));
    expect(clockToEpoch('On time', at(14, 0))).toBeUndefined();
  });
  it('formats countdowns', () => {
    expect(formatCountdown(at(12, 0), at(12, 0))).toBe('due');
    expect(formatCountdown(at(12, 7), at(12, 0))).toBe('7 min');
    expect(formatCountdown(at(13, 15), at(12, 0))).toBe('1h 15m');
  });
});

describe('finding and merging stations', () => {
  it('measures distance sensibly', () => {
    expect(distanceMetres(LST.lat, LST.lon, RDG.lat, RDG.lon)).toBeGreaterThan(60_000);
    expect(distanceMetres(LST.lat, LST.lon, RDG.lat, RDG.lon)).toBeLessThan(64_000);
  });

  it('keeps only stations within range, nearest first', () => {
    const near = nearestNrStations([RDG, ZFD, LST], 51.518, -0.085, 3000, 5);
    expect(near.map((s) => s.crs)).toEqual(['LST', 'ZFD']);
  });

  it('merges a Tube station into its National Rail station by hub code', () => {
    const places = mergeIntoPlaces([LST], [lstTube]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: 'London Liverpool Street', crs: ['LST'], tflIds: ['940GZZLULVT'] });
  });

  it('merges by distance when there is no hub code, and keeps far stops separate', () => {
    const nearby: TflStop = { ...lstTube, hub: undefined, lat: LST.lat + 0.0005 }; // ~55 m away
    expect(mergeIntoPlaces([LST], [nearby])).toHaveLength(1);
    const places = mergeIntoPlaces([LST], [angel], { lat: angel.lat, lon: angel.lon });
    expect(places.map((p) => p.name)).toEqual(['Angel', 'London Liverpool Street']);
    expect(places[0].distance).toBe(0);
  });
});

describe('National Rail parsing', () => {
  const body = {
    generatedAt: new Date(at(12, 0)).toISOString(),
    trainServices: [
      { std: '12:05', etd: 'On time', platform: 'A', operator: 'Elizabeth line', operatorCode: 'XR',
        serviceID: 'a', destination: [{ locationName: 'Reading', crs: 'RDG' }] },
      { std: '12:10', etd: '12:14', operator: 'Great Western Railway', operatorCode: 'GW',
        serviceID: 'b', destination: [{ locationName: 'Oxford', crs: 'OXF', via: 'via Reading' }] },
      { std: '12:20', etd: 'Cancelled', isCancelled: true, operator: 'Elizabeth line', operatorCode: 'XR',
        serviceID: 'c', destination: [{ locationName: 'Reading', crs: 'RDG' }] },
      { std: '12:25', etd: 'Delayed', operatorCode: 'ZZ', serviceID: 'd',
        destination: { location: [{ locationName: 'Slough' }] } },
    ],
  };
  const deps = parseNrBoard(body, at(12, 0));

  it('reads on-time, late, cancelled and delayed trains', () => {
    expect(deps.map((d) => [d.destination, d.status, d.statusText])).toEqual([
      ['Reading', 'on-time', 'On time'],
      ['Oxford', 'late', 'Exp 12:14'],
      ['Reading', 'cancelled', 'Cancelled'],
      ['Slough', 'late', 'Delayed'],
    ]);
    expect(deps.map((d) => d.awaitingEstimate)).toEqual([false, false, false, true]);
  });

  it('uses the expected time for late trains and keeps platform, via and colour', () => {
    expect(deps[1].time).toBe(at(12, 14));
    expect(deps[1].scheduled).toBe(at(12, 10));
    expect(deps[1].detail).toBe('via Reading');
    expect(deps[0].platform).toBe('A');
    expect(deps[0].color).toBe('#6950A1');
    expect(deps[3].color).toBe('#5B6770');
  });

  it('copes with an empty board', () => {
    expect(parseNrBoard({ trainServices: null }, at(12, 0))).toEqual([]);
  });
});

describe('TfL parsing', () => {
  it('keeps only Tube and DLR stops from nearby search', () => {
    const stops = parseNearby({
      stopPoints: [
        { naptanId: '940GZZLULVT', commonName: 'Liverpool Street Underground Station', lat: 1, lon: 1, modes: ['tube'], hubNaptanCode: 'HUBLST' },
        { naptanId: '910GLIVST', commonName: 'Liverpool Street Rail Station', lat: 1, lon: 1, modes: ['national-rail', 'elizabeth-line'] },
      ],
    });
    expect(stops.map((s) => s.id)).toEqual(['940GZZLULVT']);
  });

  it('turns predictions into departures and drops duplicates and other modes', () => {
    const p = {
      id: '1', vehicleId: '011', lineId: 'central', lineName: 'Central', modeName: 'tube',
      platformName: 'Eastbound - Platform 4', destinationName: 'Epping Underground Station',
      expectedArrival: '2026-11-21T15:38:54Z',
    };
    const deps = parseArrivals([p, { ...p, id: '2' }, { ...p, modeName: 'elizabeth-line', vehicleId: 'x' }]);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({
      destination: 'Epping', platform: '4', detail: 'Eastbound', line: 'Central', color: '#E32017', status: 'live',
    });
  });

  it('falls back to "towards" when there is no destination', () => {
    const [d] = parseArrivals([{ lineId: 'northern', modeName: 'tube', towards: 'Edgware', expectedArrival: '2026-11-21T15:38:54Z' }]);
    expect(d.destination).toBe('Edgware');
  });

  it('drops trains that terminate here', () => {
    const p = {
      id: '1', vehicleId: '201', lineId: 'victoria', modeName: 'tube', naptanId: '940GZZLUBXN',
      destinationName: 'Brixton Underground Station', expectedArrival: '2026-11-21T15:38:54Z',
    };
    const deps = parseArrivals([
      { ...p, destinationNaptanId: '940GZZLUBXN' },
      { ...p, id: '2', vehicleId: '202', destinationName: 'Walthamstow Central Underground Station', destinationNaptanId: '940GZZLUWWL' },
    ]);
    expect(deps.map((d) => d.destination)).toEqual(['Walthamstow Central']);
  });

  it('keeps separate DLR trains that have no vehicle id', () => {
    const p = {
      // Real DLR data: no vehicleId, and the same id on every prediction at the stop.
      id: '-846781707', vehicleId: '', lineId: 'dlr', modeName: 'dlr', platformName: 'Platform 1',
      destinationName: 'Woolwich Arsenal DLR Station', destinationNaptanId: '940GZZDLWLA',
      expectedArrival: '2026-11-21T15:38:54Z',
    };
    const deps = parseArrivals([p, { ...p, expectedArrival: '2026-11-21T15:48:54Z' }, p]);
    expect(deps).toHaveLength(2);
  });
});

describe('the board', () => {
  const now = at(12, 0);
  it('sorts all modes by time and limits to the next 90 minutes', () => {
    const board = buildBoard(
      [
        dep({ id: 'late', time: at(13, 40) }),
        dep({ id: 'tube', mode: 'tube', time: at(12, 3) }),
        dep({ id: 'rail', time: at(12, 1) }),
        dep({ id: 'gone', time: at(11, 50) }),
      ],
      now,
    );
    expect(board.map((d) => d.id)).toEqual(['rail', 'tube']);
  });

  it('keeps a delayed train with no estimate after it was due', () => {
    const board = buildBoard(
      [
        dep({ id: 'delayed', time: at(11, 50), awaitingEstimate: true }),
        dep({ id: 'gone', time: at(11, 50) }),
        dep({ id: 'stale', time: at(9, 50), awaitingEstimate: true }),
      ],
      now,
    );
    expect(board.map((d) => d.id)).toEqual(['delayed']);
  });

  it('caps the board at 25 rows and removes duplicates', () => {
    const many = Array.from({ length: 40 }, (_, i) => dep({ id: `d${i}`, time: at(12, 1 + i) }));
    expect(buildBoard([...many, ...many], now)).toHaveLength(25);
  });
});

describe('the "To home" section', () => {
  const home = { crs: 'RDG', name: 'Reading' };
  const now = at(12, 0);
  const lst: Place = { key: 'nr:LST', name: 'Liverpool Street', lat: 0, lon: 0, crs: ['LST'], tflIds: ['x'] };
  const angelPlace: Place = { key: 'tfl:a', name: 'Angel', lat: 0, lon: 0, crs: [], tflIds: ['a'] };
  const homePlace: Place = { key: 'nr:RDG', name: 'Reading', lat: 0, lon: 0, crs: ['RDG'], tflIds: [] };

  it('is hidden at the home station', () => {
    expect(homeSection(homePlace, home, true, [dep({})], now)).toEqual({ kind: 'hidden' });
  });

  it('says there are no direct trains from a Tube-only station', () => {
    expect(homeSection(angelPlace, home, true, [], now)).toEqual({ kind: 'none', homeName: 'Reading' });
  });

  it('shows the next 4 trains within 3 hours', () => {
    const trains = Array.from({ length: 6 }, (_, i) => dep({ id: `h${i}`, time: at(12, 10 + i * 40) }));
    const s = homeSection(lst, home, true, trains, now);
    expect(s.kind).toBe('trains');
    if (s.kind === 'trains') expect(s.trains.map((t) => t.id)).toEqual(['h0', 'h1', 'h2', 'h3']);
  });

  it('says none when nothing runs in the next 3 hours', () => {
    expect(homeSection(lst, home, true, [dep({ time: at(15, 30) })], now).kind).toBe('none');
  });

  it('is hidden without a National Rail key', () => {
    expect(homeSection(lst, home, false, [], now)).toEqual({ kind: 'hidden' });
  });
});

describe('deciding where you are', () => {
  const place = (d: number): Place => ({ key: `p${d}`, name: 'x', lat: 0, lon: 0, distance: d, crs: ['X'], tflIds: [] });

  it('uses the nearest three stations', () => {
    const r = decideLocation({ accuracy: 30 }, [place(100), place(400), place(900), place(1200)]);
    expect(r.kind === 'nearby' && r.places.map((p) => p.distance)).toEqual([100, 400, 900]);
  });

  it('falls back when location is denied, vague or far from any station', () => {
    expect(decideLocation({ error: 'denied' }, [])).toEqual({ kind: 'fallback', reason: 'denied' });
    expect(decideLocation({ accuracy: 5000 }, [place(100)])).toEqual({ kind: 'fallback', reason: 'vague' });
    expect(decideLocation({ accuracy: 20 }, [place(3500)])).toEqual({ kind: 'fallback', reason: 'far' });
  });
});

describe('usage', () => {
  const now = at(9, 0, 23);
  const days: UsageDays = {
    [dayKey(now)]: { 'nr-board': 4, 'tfl-arrivals': 2 },
    [dayKey(at(9, 0, 17))]: { 'nr-board': 1 },
    [dayKey(at(9, 0, 16))]: { 'nr-home': 5 },
    '2026-09-01': { 'nr-board': 100 },
  };

  it('totals today, the last 7 days and the last 30 days', () => {
    const s = summarise(days, now);
    expect(s.today['nr-board']).toBe(4);
    expect(s.week['nr-board']).toBe(5);
    expect(s.week['nr-home']).toBe(0);
    expect(s.month['nr-home']).toBe(5);
    expect(s.month['nr-board']).toBe(5);
    expect(s.today['tfl-search']).toBe(0);
  });

  it('drops days older than 30', () => {
    expect(Object.keys(prune(days, now))).not.toContain('2026-09-01');
    expect(Object.keys(prune(days, now))).toHaveLength(3);
  });

  it('counts requests per day and in the last minute', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    countRequest('nr-board', now);
    countRequest('nr-board', now + 1_000);
    countRequest('tfl-search', now + 30_000);
    expect(loadUsage(now).today).toMatchObject({ 'nr-board': 2, 'tfl-search': 1 });
    expect(lastMinute(now + 30_000)).toBe(3);
    expect(lastMinute(now + 61_000)).toBe(1);

    store.set('departures:usage', 'null');
    expect(() => countRequest('tfl-arrivals', now)).not.toThrow();
    expect(loadUsage(now).today['tfl-arrivals']).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe('a rejected National Rail key', () => {
  afterEach(() => {
    forgetRejectedKey();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('stops sending requests with it until settings are saved again', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const q = { crs: 'LST', apiKey: 'bad', apiBase: 'https://example.test' };

    await expect(fetchNrBoard(q)).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(fetchNrBoard(q)).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(fetchNrBoard({ ...q, apiKey: 'other' })).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    forgetRejectedKey();
    await expect(fetchNrBoard({ ...q, apiKey: 'other' })).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('tries the key again after 5 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(12, 0));
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const q = { crs: 'LST', apiKey: 'bad', apiBase: 'https://example.test' };

    await expect(fetchNrBoard(q)).rejects.toBeInstanceOf(NrKeyError);
    vi.setSystemTime(at(12, 4));
    await expect(fetchNrBoard(q)).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(at(12, 5));
    await expect(fetchNrBoard(q)).rejects.toBeInstanceOf(NrKeyError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
