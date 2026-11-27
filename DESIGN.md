---
name: Departures
description: Live train times from your nearest station, set as 1960s British Rail station sign plates.
colors:
  wall: "#e9ebee"
  plate: "#ffffff"
  ink: "#101418"
  muted: "#5d646d"
  line: "#e0e3e7"
  edge: "#8a919a"
  press: "#eef0f3"
  rail-red: "#c8102e"
  on-ink: "#ffffff"
  ok: "#12763a"
  warn: "#9e4d00"
  warn-bg: "#fff2df"
  bad: "#c3141f"
  bad-bg: "#fdeceb"
  wall-dark: "#0b0d10"
  plate-dark: "#171a1f"
  ink-dark: "#f1f3f5"
  muted-dark: "#9aa2ab"
  line-dark: "#272b31"
  edge-dark: "#5c636c"
  press-dark: "#22262c"
  rail-red-dark: "#f04a5f"
  ok-dark: "#4cc27a"
  warn-dark: "#ffb547"
  warn-bg-dark: "#2b2111"
  bad-dark: "#ff6b6b"
  bad-bg-dark: "#2e1515"
typography:
  display:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.01em"
  label:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.35
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "16px"
    height: "56px"
  button-action:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "44px"
  button-action-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
  button-link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "44px"
  plate:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.none}"
    padding: "0 16px"
  input-field:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
    height: "48px"
  station-tab:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.muted}"
    padding: "10px 12px 11px"
  station-tab-selected:
    textColor: "{colors.ink}"
  segmented-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    height: "44px"
  banner-offline:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.ink}"
    padding: "12px 16px"
  banner-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.ink}"
    padding: "12px 16px"
---

# Design System: Departures

## Overview

**Creative North Star: "Station Sign Plates"**

Every section of the app is a station sign plate in the 1960s British Rail corporate-identity manner: a flat, square-cornered white plate fixed to a grey wall, a heavy rule under its caption, and rows set like the lines of a sign. The phone becomes a piece of station furniture: read at a glance, on the move, on a platform or heading home. It replaced an undocumented generic look of rounded inset cards and system blue.

The world is literal, not costumed. There is no fake split-flap, no dot-matrix, no signage pastiche: the reference shows only in the flatness, the rules, the heavy grotesk, and the discipline of one red. TfL line and National Rail operator colours appear at full strength on square tags, because they are facts about the service, not decoration. Light and dark carry equal finish: in dark mode the wall goes near-black and the plates go graphite, with every role preserved.

Density is a working board's density: rows of time, destination, tag, platform and status, separated by hairlines, with nothing between the reader and the next train.

**Key Characteristics:**
- Flat white plates on a grey wall; no radii, no shadows, no gradients.
- Captions sit on a heavy 3px rule; the home plate's caption and rule are rail red.
- One rail red, used structurally only: it marks what is yours.
- Heavy grotesk (Hanken Grotesk, 700 to 800) with tabular figures throughout.
- Line and operator colours as full-strength square tags.

## Colors

A cool grey-and-ink signage palette with a single structural red and a small, separate set of status colours.

### Primary
- **Rail Red** (light `rail-red`, dark `rail-red-dark`): the one accent, and it only ever marks what is yours. It appears in exactly three places: the selected station tab's 4px top bar, the home plate's caption and its 3px rule, and the underline of the retry link inside the home plate. The dark value is lifted to a lighter, pinker red so it clears AA on graphite plates.

### Neutral
- **Station Wall** (`wall` / `wall-dark`): the page ground everything is fixed to; also drives the browser `theme-color`. Bottom sheets sit on the wall colour too.
- **Plate White / Graphite Plate** (`plate` / `plate-dark`): every container: board plates, the tab strip, action buttons, inputs, search results, the usage table.
- **Sign Ink** (`ink` / `ink-dark`): all primary text, the 3px caption rules, the primary button fill, the selected segment, the focus outline.
- **Weathered Grey** (`muted` / `muted-dark`): countdowns, unselected tab names, distances, hints, the update age, empty-state copy.
- **Hairline** (`line` / `line-dark`): 1px row separators inside plates and the dividers between tabs.
- **Edge** (`edge` / `edge-dark`): 1.5px outlines on inputs, banners and the segmented control, and the loader's track. Darkened to hold 3:1 against both wall and plate.
- **Press** (`press` / `press-dark`): the pressed state of plate-coloured buttons and rows.
- **On Ink** (`on-ink`): text on ink fills (primary button, selected segment).

### Status
- **On Time** (`ok` / `ok-dark`), **Delayed** (`warn` / `warn-dark`), **Cancelled** (`bad` / `bad-dark`): right-aligned status text only. `warn` also marks a stale update age.
- **Warn Wash / Bad Wash** (`warn-bg`, `bad-bg` and dark pairs): banner fills, always with a 1.5px border in the matching status colour.

### Named Rules
**The Yours-Only Red Rule.** Rail red marks only what belongs to the owner: the selected station and the trains home. It is never a fill, never a button colour, never an error colour (errors use `bad`, a separate red). If a new use of red does not answer "is this mine?", it is not red.

**The Facts At Full Strength Rule.** Line and operator colours from `src/lib/colors.ts` render at full saturation on square tags, text colour chosen for contrast, edge to edge. Only a tag under 2.5:1 against the current plate gets a 1px inset edge (`tagEdges()` in `src/lib/colors.ts`): `rgb(0 0 0 / 0.22)` on pale lines in light (Circle, Hammersmith & City), `rgb(255 255 255 / 0.3)` on near-black lines in dark (Northern, Piccadilly). Every other tag has no edge. Never tint, mute or restyle them to suit the palette.

## Typography

**Display Font:** Hanken Grotesk, self-hosted variable (with -apple-system, system-ui fallback)
**Body Font:** Hanken Grotesk
**Label/Mono Font:** none; tabular figures (`tnum`) are on globally.

**Character:** A heavy, plain grotesk in the spirit of station lettering: bold for everything a reader acts on, medium for everything they glance past. Tabular figures keep times aligned down the board.

### Hierarchy
- **Display** (800, 28px, 1.02, -0.025em): the station name in the header and the setup title. 28px rather than 32px so long names like "London Liverpool Street" wrap to two balanced lines instead of three.
- **Headline** (800, 24px, -0.02em): bottom-sheet titles.
- **Title** (700 to 800, 18px, 1.15): destinations (700) and clock times (800) in board rows; the primary button and setup lead.
- **Body** (500 to 700, 16px, 1.4): banners, search results, notes, empty states, form inputs.
- **Caption** (800, 14px, 1.2, 0.01em): plate captions over their rule, field labels; 14px 700 for tab station names and status.
- **Label** (500 to 700, 12px): countdowns, distances, line tags, platform, table heads.

### Named Rules
**The Heavy Or Quiet Rule.** Type is either heavy ink (700 to 800) or medium grey (500). Nothing in between carries meaning; nothing is light.

**The Sentence Case Caption Rule.** Plate captions are sentence case ("To Maidenhead", "All departures"), never uppercase or tracked, and they sit on their rule rather than floating above content as a label.

## Layout

A single phone column, max 640px, centred, with a 16px side gutter plus safe-area insets. Plates stack with a 12px gap on the wall; internal padding is 16px horizontally. The header puts the station name and update age top-left and a group of three 44px square action plates top-right (4px apart).

Board rows are a three-column grid: a 58px time column (clock over countdown), a flexible destination column (destination over tag, platform and direction), and an auto-width right-aligned status. Rows are 12px top and bottom with a 1px hairline between, none after the last.

The station tabs are one plate split into equal columns, each with a 4px top border slot (transparent until selected) and a 1px hairline between columns.

Spacing steps observed: 4, 8, 12, 16, 24px, with 28 and 32px used for setup and empty-state air.

## Elevation & Depth

None. The system is flat: depth comes only from white plates on a grey wall, and from the 3px ink rules under captions. No `box-shadow` is used for elevation anywhere (the only inset shadows are the 1px tab divider and the low-contrast tag edge, both drawn lines). The bottom sheet is separated by a 50% ink scrim and a 4px ink top border, not a shadow.

### Named Rules
**The Fixed To The Wall Rule.** Plates are bolted on, not floating. No shadows, no blur, no gradients, no lift on hover or press. State is shown by inverting fill (plate to ink) or by the press tint.

## Shapes

Square everywhere (`rounded.none`, 0px): plates, buttons, inputs, tags, banners, the segmented control, the sheet. The only curves are in the stroke icons (2px, round caps) and the help disclosure chevron. Recurring geometry is the rule: 3px under captions, 4px as the selected tab's top bar and the sheet's top edge, 1.5px for outlines, 1px for hairlines.

## Components

### Buttons
- **Shape:** square (0px).
- **Primary:** full-width ink slab, on-ink text, 18px 800, 56px tall. Pressed drops to 0.85 opacity; disabled to 0.35.
- **Action plates:** 44px square plate-white buttons with a 20px stroke icon; pressed or expanded inverts to ink fill with plate-coloured icon.
- **Link:** ink text, 2px underline offset 4px, 44px tall hit area. Inside the home plate the underline is rail red.
- **Sheet actions:** side by side 4px apart, 52px tall, plate fill (press tint when pressed); the confirming one is an ink slab.

### Cards / Containers (Plates)
- **Corner Style:** square (0px).
- **Background:** plate.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none; the caption carries a 3px ink rule beneath it (rail red on the home plate).
- **Internal Padding:** 0 16px; caption 14px top, 8px bottom.

### Inputs / Fields
- **Style:** plate fill, 1.5px edge outline, square, 48px min height, 16px 500 text, muted placeholder.
- **Focus:** the outline turns ink; no glow.
- **Labels:** 14px 800 above, 8px gap; hints 14px muted below.

### Navigation (Station tabs)
- One plate, equal-width columns, left-aligned station name (14px 700, clamped to two lines) over distance (12px muted).
- **Unselected:** name in muted grey.
- **Selected:** name in ink, 4px rail-red top bar.

### Segmented control
- Plate fill inside a 1.5px edge outline; segments 96px min, 44px tall. The pressed segment is an ink fill with on-ink text.

### Banners
- Full-width, square, 1.5px border, 16px 600 text. Default: plate with edge border. Offline: warn wash with warn border. Error: bad wash with bad border. Tappable banners take the press tint.

### Board row (signature)
- Clock 18px 800 tabular over a 12px muted countdown; destination 18px 700 over a meta line of line tag (square, full colour, 12px 700, 2px 6px padding), platform (12px 700 ink) and direction (muted). Status right-aligned, 14px 700 in ok, warn or bad. A cancelled row strikes clock and destination with a 2px line and greys them.

### Loader
- A 96 by 4px edge-coloured track with a 32px ink block running end to end (1.1s, ease-in-out, alternate). Reduced motion: a full-width block pulsing in opacity.

## Do's and Don'ts

### Do:
- **Do** put every new section on a plate: plate fill, 0 16px padding, a 14px 800 sentence-case caption on a 3px ink rule.
- **Do** keep rail red to the three structural marks: selected tab top bar, home plate caption and rule, home retry-link underline.
- **Do** show state by inverting to ink (selected segment, pressed action) or by the press tint.
- **Do** use Hanken Grotesk at 700 to 800 for anything read at a glance, with tabular figures for times.
- **Do** render line and operator colours at full strength on square tags with the inset tag edge.
- **Do** give light and dark the same finish; every token has a dark pair.
- **Do** keep touch targets at 44px or more.

### Don't:
- **Don't** round anything; corners are 0px.
- **Don't** add shadows, blur or gradients to show elevation.
- **Don't** use rail red as a fill, a button colour or an error colour.
- **Don't** imitate split-flap, dot-matrix or LED boards; the reference is the sign plate, not a costume.
- **Don't** tint, desaturate or recolour line and operator tags to match the palette.
- **Don't** set captions in uppercase or tracked small caps.
