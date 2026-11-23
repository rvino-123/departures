# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Development process

Every new feature, fix, or tech change follows this loop. Each step ends on its completion criterion before the next starts.

1. **Branch.** Start from an up-to-date `main` and create a new branch named for the change (`feat/…`, `fix/…`, `chore/…`). Done when you're on the new branch.
2. **Plan.** Ask the user whether they want to plan the change first, whatever mode the session is in. If yes, write the plan and get their approval before touching code. Done when the user has approved a plan or declined planning.
3. **Build.** Implement the change. Done when `npm run lint`, `npm test` and `npm run build` all pass.
4. **Review.** Straight after building, launch subagents in parallel to review the diff against `main` (correctness bugs; whether it matches the plan). Fix what they confirm. Done when every finding is fixed or reported to the user as deliberately left.
5. **Test link.** Start the dev server (`npm run dev`, in the background) and give the user the local URL. The app is served under the `/departures/` base path, so the link is `http://localhost:5173/departures/` (use the port Vite actually prints). Done when the user has a working link.
6. **Commit.** Once the user approves the change, write a commit message and commit. Then ask whether to push or whether they have more to add. Push only when they say so.

# Commands

```bash
npm run dev                         # Vite dev server at /departures/
npm run lint                        # ESLint
npm test                            # Vitest, single run (all tests live in src/lib/logic.test.ts)
npx vitest run -t "the board"       # run one describe/it block by name
npm run build                       # tsc -b type-check, then vite build
```

Dev-only URL params (stripped from production by `import.meta.env.DEV`):
- `?at=51.5178,-0.0817` fakes a GPS fix (`getFix` in `src/hooks.ts`).
- `?delay=5` holds locating and each fetch back 5 s and skips the saved snapshot, to see loading states.

`.env.local` (copy `.env.example`) sets `VITE_DEV_NR_API_KEY` / `VITE_DEV_HOME_CRS`. In dev these fill any empty settings and skip first-run setup (`fillFromEnv` in `src/lib/storage.ts`). Comment a line out to test setup or the "no key" path.

Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml` runs `npm test` and `npm run build`, not lint).

# Architecture

A client-only React 19 + Vite PWA with no backend. The phone calls the National Rail and TfL APIs directly. The NR key lives only in the browser's localStorage. Domain terms (Request, Request kind, Usage) are defined in `GLOSSARY.md`.

**Split:** `src/lib/` is pure, framework-free logic, and it's what the tests cover. `src/hooks.ts` holds the React/browser glue (geolocation, 30 s refresh, foreground refresh, offline snapshot, theme). `src/App.tsx` holds the view state machine (`locating` → `nearby` | `fallback` | `manual`). `src/components.tsx` holds every UI component in one file.

**Data flow:**
1. **Locate.** `getFix` → `placesNear` (`lib/stations.ts`) combines the bundled NR list (`src/data/stations.json`, compact `[name, crs, lat, lon]` tuples) with TfL nearby search. `mergeIntoPlaces` (`lib/geo.ts`) then merges platforms within 150 m, or linked by TfL hub code, into one `Place` (a `Place` can have several `crs` and `tflIds`). `decideLocation` (`lib/locate.ts`) picks between nearby and fallback (denied, unavailable, accuracy over 1 km, or station over 3 km away). The fallback shows the home station.
2. **Load.** `loadPlace` (`lib/load.ts`) fires every source in parallel with `Promise.allSettled`: TfL arrivals per `tflId`, an NR board per `crs`, and the "to home" NR query (`filterCrs` + `filterType=to`). NR looks at most 2 h ahead per request, so if fewer than `HOME_TRAINS` live trains come back it makes a second request with `timeOffset: 119` to cover hour three. Partial failure sets `partial`. A 401/403 throws `NrKeyError` → `keyRejected`. Only when every source fails does it throw `AllSourcesFailed`.
3. **Normalise.** `lib/nr.ts` and `lib/tfl.ts` each parse into the shared `Departure` type (`lib/types.ts`). `lib/board.ts` (`buildBoard`, `homeSection`) dedupes, windows (90 min, 25 rows) and sorts.
4. **Persist.** `lib/storage.ts` wraps localStorage under `departures:*` keys and survives storage being unavailable. The last `PlaceData` for up to 12 places is kept as the offline snapshot.

**NR API specifics** (`lib/nr.ts`): `DEFAULT_API_BASE` is the Rail Data Marketplace LDBWS v1.2 (`dep1_2`) address. When you change it, add the old value to `OLD_API_BASES` so saved settings migrate on load. `fetchNrBoard` prefers `GetDepartureBoard` and falls back once, for the session, to `GetDepBoardWithDetails` (capped at 10 rows) if the key's product returns 404/403.

**Usage tracking:** every outgoing fetch must call `countRequest(kind)` (`lib/usage.ts`) with one of `REQUEST_KINDS`. That's what feeds Settings → Usage. Counts are per day, pruned after 30 days.
