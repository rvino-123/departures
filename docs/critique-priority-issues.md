# Critique priority issues: repro, expected, actual

From the Impeccable critique of 2026-11-27 (score 26/40; snapshot in `.impeccable/critique/2026-11-27T08-35-24Z__src-app-tsx.md`). Each issue below gives steps to reproduce it, what good behaviour looks like and what happens today, with the code responsible.

Claims marked **verified** were checked against the code and, where relevant, the live TfL API on 2026-11-27.

## Setup for all repros

```bash
npm run dev          # → http://localhost:5173/departures/
```

- `.env.local` must set `VITE_DEV_NR_API_KEY` and `VITE_DEV_HOME_CRS` so setup is skipped.
- `?at=lat,lon` fakes a GPS fix. `?delay=5` holds loading states for 5 s.
- Use Chrome DevTools in device mode at 390×844. For failure repros, use **Network → Request blocking** (or the **Offline** throttle).

---

## P0: TfL "hub" search results show a false empty board

Principle broken: **Never mislead about a train.**

### Reproduce

1. Open `http://localhost:5173/departures/?at=51.5178,-0.0817`.
2. Tap the search button (⌕) and type `bank`.
3. Wait for **"Bank · DLR · TUBE"** to appear at the bottom of the results, and tap it.

### Expected

- Bank's board lists live Northern line, Waterloo & City line and DLR departures. It is one of the busiest stations in London; at 08:30 on a weekday there are dozens.
- If TfL returns nothing for a stop, the app says it couldn't get times ("No live times from TfL for this stop"). It does not say there are no trains.

### Actual

- The board says **"No departures in the next 90 minutes."**
- No partial or error banner appears. The request succeeded and returned an empty list, so the app treats it as a real "no trains".

### Why (verified)

- TfL's search returns the **hub** ID for Bank: `GET /StopPoint/Search/bank?modes=tube,dlr` → `HUBBAN Bank ['bus','dlr','tube']`.
- `placeForTfl` (`src/lib/stations.ts:42-49`) puts `HUBBAN` straight into `place.tflIds`.
- `fetchTflArrivals` (`src/lib/tfl.ts:104-109`) calls `GET /StopPoint/HUBBAN/Arrivals`, which returns **0** arrivals. The Tube child stop `940GZZLUBNK` returns **16** at the same moment.
- `loadPlace` gets `[]` with no error, so `partial` is false. `App.tsx:201-206` therefore picks the "No departures in the next 90 minutes." copy.
- Any search result whose ID starts with `HUB` (an interchange) has the same bug.
- Places found by GPS are not affected: nearby search returns child stop points.

### Fix direction

- When a picked TfL stop's ID starts with `HUB`, expand it to its child Tube and DLR stop points (`GET /StopPoint/{hubId}` → `children`, filtered to tube/dlr) before building the `Place`.
- Separately, when every source for a place is TfL and they all return zero arrivals, use copy that admits uncertainty instead of "No departures".
- Add a unit test: `placeForTfl` with a `HUB…` ID must not produce a `Place` whose `tflIds` contain the hub.

---

## P1: Late trains hide their scheduled time and show the expected time twice

Principle broken: **Never mislead about a train**. You can't identify your train.

### Reproduce

1. Open a busy National Rail board, e.g. `http://localhost:5173/departures/?at=51.5033,-0.1145` (Waterloo) or `?at=51.5178,-0.0817` (Liverpool Street).
2. Find any row with an amber **"Exp HH:MM"** status. This needs live delays, so it may take a couple of tries at peak times.
   - Deterministic version: a National Rail service with `std: "08:30"` and `etd: "08:41"` gives this row.

### Expected

Follow the station-board convention:

| Time | Destination | Status |
|---|---|---|
| **08:30** · in 11 min | Reading | **Exp 08:41** (amber), optionally "+11" |

- The time column keeps the **scheduled** time, which is how people know their train ("the 08:30").
- The status shows the expected time and makes the delay obvious.
- The countdown and the sort order can still use the expected time.

### Actual

| Time | Destination | Status |
|---|---|---|
| **08:41** · in 11 min | Reading | Exp 08:41 |

- The scheduled 08:30 appears nowhere, so you can't tell how late the train is.
- The same time is shown twice.
- The row moves to its expected position, so "my 08:30" seems to have disappeared.

### Why (verified)

- `toDeparture` in `src/lib/nr.ts:56-58` sets `time = expected` and `statusText = 'Exp ' + etd` for late trains.
- `Row` (`src/components.tsx:19`) shows `d.time` in the clock column. The scheduled time is used only for cancelled trains.

### Fix direction

- In `Row`, show `d.scheduled ?? d.time` in the clock column whenever `d.status === 'late'`, and keep the countdown on `d.time`.
- Optionally add `+N` to the status.
- No parser change is needed: `scheduled` is already on the `Departure`.

---

## P1: The home section fails silently, and "none" claims more than the app knows

Principle broken: **Home is the anchor**. Also **Never mislead**.

### Case A: home request fails

#### Reproduce

1. Open `http://localhost:5173/departures/?at=51.5178,-0.0817`. The "To {home}" card shows trains.
2. In DevTools → Network → Request blocking, add the pattern `*filterCrs*`. This blocks only the "to home" National Rail query.
3. Tap refresh (↻).

#### Expected

- The home card stays in place, with its heading, and says it couldn't check: **"To Maidenhead · couldn't check trains home"**, with a retry.
- The general board carries on as normal.

#### Actual

- The home card **disappears completely**.
- The only sign is the generic banner "Some departures couldn't load." That doesn't say *home* is what failed, and the board below looks complete.
- The "All departures" heading also vanishes, because it only shows when `home.kind !== 'hidden'`.

#### Why (verified)

- `loadPlace` sets `homeFailed` (`src/lib/load.ts:63`).
- `App.tsx:115` then passes `canAsk = false`, and `homeSection` returns `{ kind: 'hidden' }` (`src/lib/board.ts:48`).
- `HomeCard` renders `null` for `hidden` (`src/components.tsx:49`).

### Case B: no home trains in the 3-hour window

#### Reproduce

Any of these:

- Open the app late at night (after the last direct train, roughly 00:30–05:00) at a station that has direct trains to home in the daytime.
- Set the home station (Settings) to a station with sparse direct service from the station you're at.
- In a unit test, call `homeSection(place, home, true, [], now)` for a place whose `crs` is non-empty. It returns `{ kind: 'none' }`.

#### Expected

- **"To Maidenhead · none in the next 3 hours"** (and, if known, the first train after that).
- The wording claims only what was actually checked.

#### Actual

- **"No direct trains to Maidenhead from here"**. That reads as a permanent fact about the route, when all the app checked was a 3-hour window.

#### Why (verified)

- `homeSection` returns `none` whenever `buildBoard(homeDeps, now, 180, 4)` is empty (`src/lib/board.ts:49-50`).
- `HomeCard` renders the fixed "No direct trains…" copy for every `none` (`src/components.tsx:51`).
- The "permanent" wording is only true in the `place.crs.length === 0` branch (`board.ts:47`): a Tube/DLR-only stop, where National Rail can't be asked at all.

### Fix direction

- Split `HomeSection` into explicit kinds: `trains`, `noneInWindow`, `noRail` (Tube-only place) and `unknown` (key missing, rejected, or the home request failed).
- `HomeCard` keeps the card's heading in every kind except "home is this station".

---

## P2: It's hard to tell how fresh the data is

Principle broken: **Never mislead about a train** (stale data must look stale).

### Case A: "Updated" is a clock time

#### Reproduce

Open any board and look under the station name: **"Updated 08:31"**.

#### Expected

- **"Updated 40 s ago"** on a live tick. It changes to the warning colour and "Updated 3 min ago" once the data is older than about 2 minutes (four missed refreshes).
- Platform glances last under 2 seconds, so you shouldn't have to compare two clocks.

#### Actual

- You have to compare "08:31" with the phone's clock yourself.
- A failed background refresh that leaves old data on screen looks exactly like fresh data until you do that sum.

#### Why

`App.tsx:131` uses `formatClock(data.fetchedAt)`.

### Case B: offline view dims the whole board

#### Reproduce

1. Open a board and let it load.
2. In DevTools → Network, set throttling to **Offline**.
3. Tap refresh (↻).

#### Expected

- A clear "Offline · as of 08:31 (6 min ago)" banner (the banner exists today, which is good).
- The board stays **fully legible**, with staleness shown in the header or banner colour.

#### Actual

- The banner appears, but the whole board, home card included, drops to `opacity: 0.55` (`src/App.css:211-213`, the `.stale` class at `App.tsx:188`).
- Muted text (countdowns, platforms, operator tags) falls well below 3:1 contrast, exactly when you're relying on the last-known times.
- In dark mode the Northern line's black tag almost vanishes.

### Case C: the partial banner doesn't name what failed

#### Reproduce

1. Open `?at=51.5178,-0.0817`.
2. Block `*api.tfl.gov.uk*` in Request blocking and refresh. Then try blocking `*rail*` or the NR host instead.

#### Expected

A specific banner: **"Tube & DLR times missing"** or **"National Rail times missing"**. You can then tell whether the absence of Tube rows is real.

#### Actual

- Both cases show the same **"Some departures couldn't load."** (`App.tsx:186`).
- With TfL blocked, the board shows only National Rail rows and nothing says Tube is missing from them.

### Fix direction

- Add a relative age driven by the existing `useNow` tick.
- Replace `.stale { opacity }` with a tinted header and banner.
- Have `loadPlace` return which source kinds failed, not just `partial: boolean`.

---

## P2: Search ranking and control placement suit the wrong geography and the wrong thumb

Principle broken: **Zero taps to the answer** (the fallback path should be fast when it's needed).

### Case A: London stations rank below the rest of Britain

#### Reproduce

1. Tap ⌕ and type `bank`.
2. Watch the results.

#### Expected

- **Bank** (the London interchange) and **Embankment** come first: they are within a few km of the user and match the query.
- Results are one list ranked by match quality and distance from the current fix, and the list doesn't reshuffle while you aim.

#### Actual (verified)

1. **Immediately**, six National Rail stations from all over Britain: Bank Hall, Clydebank, Eskbank, Greenbank, Kents Bank, Ladybank (`searchNr(q, 6)`, `src/components.tsx:80`, `src/lib/stations.ts:16-25`).
2. About 250 ms later, plus a network round trip, **Bank · DLR · TUBE** and **Embankment** are **added below** them (`src/components.tsx:85-96`, `116-129`).
3. The list grows under your thumb, so a tap aimed at the bottom of the list can land on the wrong row. And if you do pick Bank, you hit the P0 bug.

### Case B: every control sits at the top edge

#### Reproduce

Hold a phone one-handed and open any board.

#### Expected

The actions you use often (search, and switching station) are within thumb reach. The theme toggle sits in Settings, not in the header.

#### Actual

- Seven targets sit in the top ~150 px (`App.tsx:134-158`): search ⌕, refresh ↻, theme ☀/☾, settings ⚙ and three station tabs.
- The glyphs render at uneven sizes: ⌕ is visibly smaller than ⚙.
- Pull-to-refresh is the only reachable action, and nothing on screen shows it exists.

### Case C: station tabs truncate the name that matters

#### Reproduce

1. Open `?at=51.5178,-0.0817` (Liverpool Street) or `?at=51.5308,-0.1238` (King's Cross).
2. Look at the third tab.

#### Expected

The name is readable enough to choose by ("Aldgate", "St Pancras").

#### Actual

- "Aldga…" and "London St Pancras Inter…".
- The cause is `max-width: 60%` with `white-space: nowrap; text-overflow: ellipsis` (`src/App.css:58-76`). Long "London …" prefixes use up the room.

### Fix direction

- Merge NR and TfL results, rank them by match score plus distance, and reserve the list's height.
- Show recent stations before any typing.
- Move the theme toggle into Settings.
- Use one SVG icon set.
- Drop the "London " prefix in tabs, or let tab names wrap to 2 lines.

---

## Also worth checking (not yet confirmed)

The Liverpool Street board showed Hammersmith & City rows but **no Central line rows**. Two possible causes:

- The 25-row cap (`BOARD_MAX_ROWS`) covers only about 16 minutes at a big terminus, so Central line trains are crowded out.
- The 150 m merge left Central line platforms out of the `Place`.

To find out, log `place.tflIds` for `?at=51.5178,-0.0817`, then check `/StopPoint/{id}/Arrivals` for the Central line.
