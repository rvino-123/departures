---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components.tsx","src/App.css","src/index.css"]
---

# Surface: the departures board (App.tsx + components.tsx)

Mode: Operate. Phone-first portrait PWA; the owner glances at it on the move, on platforms and heading home (no single scene leads; balanced hierarchy). Redesign of the whole visual world; every behaviour, state and piece of copy stays.

User constraints: keep line/operator colours as facts, at full strength; nothing too stylised (no fake split-flap or dot-matrix); light and dark get equal finish.

## Direction contract

THESIS: Every section is a station sign plate: a flat white plate on a grey wall, a heavy rule under its caption, rows set like sign lines. It refuses the category default of rounded inset cards with system blue.

OWN-WORLD: Grey wall ground (#e9ebee light / near-black wall dark), flat square-cornered white plates, ink #101418, muted #6a717a, one rail red (#c8102e) used structurally only: the selected station's top bar and the home plate's caption and rule. Square line/operator tags at full colour. Bold heavy grotesk (system SF, 700–800) for times and destinations; tabular figures. No radii, no shadows, no gradients.

STORY: The owner sees the station they're at, which tab is selected, whether a train goes home and when, then the full board. They can switch station, search, refresh and open settings without hunting.

FIRST VIEWPORT: Large 32px bold station name top-left with the update age under it; three square plate action buttons top-right. Below, a white tab plate whose selected station carries a red 4px top bar. Then the home plate (red caption + red 3px rule), then the "All departures" plate (ink caption + ink 3px rule). Rows: 58px time column (clock + minutes), destination at 18px bold with tag + platform beneath, status right-aligned.

FORM: IMPECCABLE'S PICK, the user's choice: 1960s British Rail corporate-identity signage, position 1 on my ordered list (assigned was 3, pocket timetable). seed:d7feff183a4f0f34

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Chosen sketch: .impeccable/mocks/decision/model-pick.html
