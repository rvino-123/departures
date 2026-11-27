# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner, on their own phone, around London. Departures is a personal tool. Anyone else using it is incidental, and decisions are made for the owner's own habits rather than for a general audience.

## Product Purpose

You open it and it immediately shows live departures from the nearest station, with trains that call at home pinned at the top. One glance replaces picking a station in a journey planner. It works when it answers "what's my next train, and is there one home?" without a single tap.

## Positioning

The station is chosen by GPS and pulled together from several sources. National Rail (including the Elizabeth line and Overground), the Tube and the DLR are merged into one board per physical station: platforms within 150 m of each other, or linked by TfL's hub code, count as one station. A "to home" section filters to trains that call at the owner's home station, looking up to 3 hours ahead. There is no account and no server.

## Operating Context

- Installed as a standalone portrait PWA on the owner's phone and opened from the home screen.
- Locates on every open. The view states are `locating`, then `nearby` (the nearest station plus tabs for the next two), `fallback` (the home station's board, shown when location is denied, the fix is accuracy over 1 km, or the nearest station is over 3 km away) or `manual` (station search).
- Refreshes every 30 s and again when the app comes back to the foreground. With no signal it shows the last loaded board, marked "Offline".
- The situations the app is opened in (walking to a station, on the platform, heading home, choosing between stations) have not been ranked yet. That is still an **open decision**.

## Capabilities and Constraints

- **No backend, ever.** It stays client-only on GitHub Pages under `/departures/`. The phone calls the National Rail (Rail Data Marketplace LDBWS) and TfL Unified APIs directly. *Binding.*
- The owner's National Rail key is stored only in that browser's localStorage. TfL needs no key.
- NR looks ahead at most 2 h per request. Getting a third hour of home trains costs a second request.
- If some sources fail the board is marked partial. If the key is rejected, the app says so and stops polling. Only when every source fails does it show an error.
- Every outgoing request is counted by kind, and Settings → Usage shows the counts. Terms are defined in `GLOSSARY.md`.
- First-run setup asks for a home station and an NR key.

## Brand Commitments

- Name: **Departures**. Manifest description: "Live train times from your nearest station."
- Plain British English, short and literal: "Finding stations near you…", "Checking train times…".
- TfL line and NR operator colours (`src/lib/colors.ts`) identify services as facts.
- Required attributions: "Powered by TfL Open Data", NRE data via Rail Data Marketplace, and the station list from davwheat/uk-railway-stations (ODbL).

## Evidence on Hand

- Live data only. There are no testimonials, users or metrics, and none should be invented.
- App icons are in `public/` (`icon.svg` plus the generated PNG sizes).

## Product Principles

1. **Zero taps to the answer.** The useful board appears on open. Anything that needs input is a fallback, not the main path.
2. **Never mislead about a train.** Show stale, partial or offline data as exactly that. Never hide or invent services.
3. **Home is the anchor.** Getting home is the question asked most often, so it gets priority.
4. **Stay serverless and private.** The key and usage stay on the device, and requests are kept frugal and counted.

## Accessibility & Inclusion

No specific standard has been set. It is used by one person, so this is an **open decision**.
