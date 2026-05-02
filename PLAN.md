# When Is F1 — Implementation Plan

A phased plan for a vanilla HTML/CSS/JS web app that lists upcoming F1 events, converts session times into the user's chosen timezone, and exports events to calendar apps.

**Stack decision (no negotiation):** plain HTML + CSS + ES modules. No bundler, no framework, no npm install. Hostable on any static server (GitHub Pages, Netlify drop, `python -m http.server`). This matches the user's "simple" requirement.

---

## Phase 0 — Documentation Discovery (already completed)

The conclusions below were verified against live HTTP responses on 2026-05-01. Treat the **Allowed APIs** list as canon for later phases — do not invent endpoints, params, or field names.

### Allowed APIs

**Jolpica (Ergast successor) — primary data source**
- Base URL: `https://api.jolpi.ca/ergast/f1/`
- Endpoint: `GET /ergast/f1/current.json` (returns the full current season; "current" resolves to 2026 today)
- No auth, no API key. Soft limit ~4 req/sec, 500 req/hour.
- **CORS verified:** server returns `access-control-allow-origin: *`, so the browser can fetch directly. No proxy needed.
- Response shape (verbatim, every value is a string unless marked):
  ```
  MRData.RaceTable.Races[]
    season, round, url, raceName
    Circuit { circuitId, url, circuitName,
              Location { lat, long, locality, country } }
    date            // "2026-03-08"
    time            // "04:00:00Z"
    FirstPractice   { date, time }
    SecondPractice  { date, time }   // absent on sprint weekends
    ThirdPractice   { date, time }   // absent on sprint weekends
    Qualifying      { date, time }
    Sprint          { date, time }   // sprint weekends only
    SprintQualifying{ date, time }   // sprint weekends only
  ```
- Combine date + time → ISO instant: `` `${date}T${time}` `` (the `Z` is already present).
- **2026 schedule confirmed:** 22 rounds. Sprint rounds: 2 (Shanghai), 4 (Miami), 5 (Villeneuve/Canada), 9 (Silverstone), 12 (Zandvoort), 16 (Marina Bay).
- **Naming quirk:** round 14 (Madring/Madrid) is labeled `raceName: "Spanish Grand Prix"` while round 7 (Catalunya/Barcelona) is `"Barcelona Grand Prix"`. Use `raceName` verbatim — don't try to "correct" it.

**Canonical 2026 circuitIds** (verified live, copy-paste this list, do NOT invent):
```
albert_park, shanghai, suzuka, miami, villeneuve, monaco, catalunya,
red_bull_ring, silverstone, spa, hungaroring, zandvoort, monza, madring,
baku, marina_bay, americas, rodriguez, interlagos, vegas, losail, yas_marina
```
Note: `bahrain`, `jeddah`, `imola` are NOT in 2026 — do not include them.

**Browser APIs (no library needed)**
- `new Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).format(dateObj)` — format any UTC instant in any IANA zone.
- `Intl.DateTimeFormat().resolvedOptions().timeZone` — detect user's local IANA zone.
- `Intl.supportedValuesOf("timeZone")` — list of ~400 primary IANA IDs, sorted.

**Fonts**
- `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap">` plus the two `preconnect` hints.
- `font-family: 'Space Mono', monospace;`

### Anti-patterns (do NOT do these)

- **Do NOT call `ergast.com/api/...`** — original Ergast is deprecated; use `api.jolpi.ca/ergast/...`.
- **Do NOT read `race.SprintShootout`** — the 2026 schedule names this `SprintQualifying`. Reading the old name returns `undefined`.
- **Do NOT assume numeric types.** `round`, `lat`, `long`, `total` are JSON strings.
- **Do NOT hotlink Wikimedia images** at `upload.wikimedia.org` — Wikimedia discourages it. Download the SVG once, commit to `assets/circuits/`.
- **Do NOT hotlink formula1.com circuit illustrations** — copyrighted.
- **Do NOT use `\n` line endings in `.ics` files** — RFC 5545 requires `\r\n`. Outlook rejects `\n`-only.
- **Do NOT combine `Z` UTC dates with `&ctz=` in the Google Calendar URL** — pass UTC OR local + ctz, not both.
- **Do NOT rely on `<a download>` for `.ics` on iOS Safari** — it tends to open inline. For now, ship a desktop-first solution; iOS workaround (server-hosted `.ics` URL with `Content-Disposition: attachment`) is out of scope for a static site.

### Project structure (decided)

```
/index.html
/styles.css
/app.js                  -- entry, wires up everything
/lib/
  api.js                 -- Jolpica fetch + normalize
  format.js              -- Intl-based time formatting
  ics.js                 -- .ics builder + download
  gcal.js                -- Google Calendar URL builder
  theme.js               -- dark/light toggle + persist
/data/
  circuit-timezones.js   -- circuitId -> IANA tz (22 entries, hardcoded)
  country-timezones.js   -- ISO-2 country code -> [IANA tz, ...] (static, ~250 entries)
  countries.js           -- ISO-2 -> display name (static)
/assets/
  circuits/<circuitId>.svg
  flags/<iso2>.svg       -- optional, for nicer country labels
  icons/sun.svg, moon.svg
ATTRIBUTION.md           -- circuit image credits (CC BY-SA requirement)
```

---

## Phase 0.5 — Pre-flight verification (do once, before Phase 1)

These checks are already done as of 2026-05-01, but re-run them when starting fresh in a new chat context. They each take seconds and prevent rebuilding around wrong assumptions.

1. **CORS** — `curl -sI -H "Origin: https://example.com" "https://api.jolpi.ca/ergast/f1/current.json" | grep -i access-control` must show `access-control-allow-origin: *`. If absent, the static-only architecture is invalid; pause and decide on a proxy or serverless shim before proceeding.
2. **Canonical circuitIds** — `curl -s "https://api.jolpi.ca/ergast/f1/current.json" | python3 -c "import json,sys; [print(r['Circuit']['circuitId']) for r in json.load(sys.stdin)['MRData']['RaceTable']['Races']]"` — output must match the 22-id list in Phase 0. If not, update CIRCUIT_TZ and the SVG download list before Phase 6.
3. **Sprint round verification** — confirm rounds 2, 4, 5, 9, 12, 16 have `Sprint` and `SprintQualifying` keys; rounds outside that set have `SecondPractice` and `ThirdPractice`. If the API drift is more than cosmetic, update Phase 4 session rendering accordingly.

---

## Phase 1 — Static skeleton + theming

**What to implement**

1. `index.html` with semantic structure: `<header>` (title + theme toggle), `<main>` (location picker + events list), `<footer>` (attribution + data source link).
2. Add the Google Fonts preconnect + Space Mono `<link>` tags (verbatim from Phase 0).
3. `styles.css`:
   - CSS custom properties for the palette, declared on `:root` (light) and `:root[data-theme="dark"]` (dark).
   - Token names: `--bg`, `--bg-elev`, `--fg`, `--fg-muted`, `--accent`, `--border`.
   - Light: `#fafafa` bg, `#111` fg, `#e10600` accent (F1 red).
   - Dark: `#0e0e10` bg, `#f5f5f5` fg, `#ff1e1e` accent.
   - `body { font-family: 'Space Mono', monospace; }`.
   - **Mobile-first.** Default styles target ~360px screens. Add media queries at `min-width: 600px` (tablet) and `min-width: 960px` (desktop). Container max-width 960px on desktop.
   - **Touch targets ≥ 44×44px** for buttons and the picker (Apple HIG).
4. `lib/theme.js`: detects `prefers-color-scheme`, persists choice in `localStorage` under `wif:theme`, toggles `data-theme` on `<html>`. Exports `init()` and `toggle()`.
5. **Accessibility** — theme toggle button must have `aria-label="Switch to dark theme"` / `"Switch to light theme"`, kept in sync. Picker `<select>` elements must have associated `<label>`s. All cards keyboard-focusable in tab order.

**Verification checklist**

- Open `index.html` directly in a browser — Space Mono renders (check DevTools network for 200 on the css2 endpoint).
- Click the theme toggle — colors flip; reload page — choice persists.
- `prefers-color-scheme: dark` honored on first visit (no stored preference).
- Resize the viewport to 360px — header, picker, and footer remain readable, no horizontal scrollbar.
- Run axe DevTools or Lighthouse a11y — no violations.

**Anti-pattern guards**

- Do NOT add `transition: all` globally — flickers on theme switch. Transition specific properties.
- Do NOT inline styles on elements; use CSS variables.
- Do NOT use `<div>` for the theme toggle — it must be a `<button>` for keyboard/SR support.

---

## Phase 2 — Data fetch + normalization

**What to implement**

`lib/api.js` exports `fetchSchedule()`:
1. `fetch('https://api.jolpi.ca/ergast/f1/current.json')`, parse JSON.
2. Extract `data.MRData.RaceTable.Races`.
3. For each race, build a normalized object:
   ```js
   {
     id: `${season}-${round}`,
     round: Number(race.round),
     name: race.raceName,
     wikiUrl: race.url,
     circuit: {
       id: race.Circuit.circuitId,
       name: race.Circuit.circuitName,
       locality: race.Circuit.Location.locality,
       country: race.Circuit.Location.country,
       lat: Number(race.Circuit.Location.lat),
       lon: Number(race.Circuit.Location.long),
     },
     sessions: [
       { kind: 'fp1',   start: combine(race.FirstPractice) },
       { kind: 'fp2',   start: combine(race.SecondPractice) },   // optional
       { kind: 'fp3',   start: combine(race.ThirdPractice) },    // optional
       { kind: 'sprintQ', start: combine(race.SprintQualifying) },// optional
       { kind: 'sprint',  start: combine(race.Sprint) },          // optional
       { kind: 'qualifying', start: combine(race.Qualifying) },
       { kind: 'race',  start: combine({date: race.date, time: race.time}) },
     ].filter(s => s.start) // drop missing optional sessions
   }
   ```
   where `combine({date, time}) = date && time ? new Date(`${date}T${time}`) : null`.
4. Filter to **future** races: keep race if `race.start > now` (use the race session's start).
5. Cache result in `sessionStorage` under `wif:schedule` keyed by today's date so reloads within the same day don't re-hit the API.

`data/circuit-timezones.js` exports a hand-curated map for the 22 circuits in the canonical list from Phase 0:
```js
export const CIRCUIT_TZ = {
  albert_park:   'Australia/Melbourne',
  shanghai:      'Asia/Shanghai',
  suzuka:        'Asia/Tokyo',
  miami:         'America/New_York',
  villeneuve:    'America/Toronto',
  monaco:        'Europe/Monaco',
  catalunya:     'Europe/Madrid',
  red_bull_ring: 'Europe/Vienna',
  silverstone:   'Europe/London',
  spa:           'Europe/Brussels',
  hungaroring:   'Europe/Budapest',
  zandvoort:     'Europe/Amsterdam',
  monza:         'Europe/Rome',
  madring:       'Europe/Madrid',
  baku:          'Asia/Baku',
  marina_bay:    'Asia/Singapore',
  americas:      'America/Chicago',
  rodriguez:     'America/Mexico_City',
  interlagos:    'America/Sao_Paulo',
  vegas:         'America/Los_Angeles',
  losail:        'Asia/Qatar',
  yas_marina:    'Asia/Dubai',
};
```
- This list is the canonical 2026 set verified in Phase 0.5. If Phase 0.5 surfaces a new circuitId (e.g., a 2027 calendar change), add the entry; if a circuit drops, leave the entry — extras are harmless.
- Fallback in `fetchSchedule`: if `CIRCUIT_TZ[id]` is missing, log a warning and use `'UTC'`.

**Verification checklist**

- `await fetchSchedule()` in DevTools console returns an array; first entry has `sessions` with at least `qualifying` and `race`.
- All circuitIds in the response have a tz entry in `CIRCUIT_TZ`. If not, log a warning and fall back to `'UTC'`.
- Filtering: races whose race-session is in the past are excluded.

**Anti-pattern guards**

- No `JSON.parse(JSON.stringify(...))` for cloning. The normalized shape is the source of truth.
- No `try/catch` that swallows errors silently — let `fetchSchedule` reject; the caller renders an inline error state.

---

## Phase 3 — Country + timezone picker

The user explicitly asked: *"I can select where I'm at. Like I can select the country."* Lead with country names, fall back to a sub-zone picker only when a country has multiple zones.

**What to implement**

1. Bundle two small static datasets into `data/`:
   - `countries.js` — `{ FR: 'France', US: 'United States', ... }` (~250 entries). Source: any ISO-3166 list; copy as a `.js` module exporting an object literal.
   - `country-timezones.js` — `{ FR: ['Europe/Paris'], US: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles', ...], ... }`. Source: the [`countries-and-timezones`](https://github.com/manuelmhtr/countries-and-timezones) project's `data` table — copy and inline as a JS object literal. License is MIT — credit in `ATTRIBUTION.md`.

2. Picker UI in `<header>` or top of `<main>`:
   - **Primary `<select id="country">`** — alphabetically sorted country names. First option: "📍 Use detected location ({country derived from `Intl` tz})".
   - **Secondary `<select id="zone">`** — only shown when the chosen country has > 1 zone. Populated with that country's IANA zones, formatted as the city portion (e.g., `America/Los_Angeles` → "Los Angeles"). Hidden via `hidden` attribute when the country has exactly one zone.
   - Storage: persist `wif:country` (ISO-2) and `wif:tz` (IANA) in `localStorage`. Resolve on load: stored country + stored zone → use as-is; stored country only → use first zone for that country; nothing stored → derive country from `Intl.DateTimeFormat().resolvedOptions().timeZone` via reverse lookup, fall back to user's detected tz directly.
   - Reverse lookup: build `tz → country` map at module init by inverting `country-timezones.js`.

3. On any change → re-render events list.

**Verification checklist**

- First visit in France → "France" selected, secondary picker hidden, "Your time" shows Paris time.
- Pick "United States" → secondary picker appears with 4+ options, defaults to first one.
- Pick "Japan" → secondary picker stays hidden (single zone).
- Reload after picking United States + "Chicago" → both restored.
- Country list is alphabetically sorted by display name (not ISO code).

**Anti-pattern guards**

- Do NOT silently substitute a raw `Intl.supportedValuesOf("timeZone")` picker — the user asked for country selection.
- Do NOT use `eval` or dynamic `import()` for the static data; ship it as ESM.
- Do NOT format the secondary zone label as the raw IANA ID — extract the city portion (last `/` segment, with `_` → space).

---

## Phase 4 — Events list rendering

**What to implement**

`lib/format.js` exports:
- `formatInZone(date, tz, locale)` → `{ date: "Sun, 8 Mar 2026", time: "15:00" }` using two `Intl.DateTimeFormat` instances.
- `relativeDays(date, now)` → e.g. `"in 12 days"` using `Intl.RelativeTimeFormat`.
- `sessionLabel(kind)` → `"Race"`, `"Qualifying"`, `"Sprint"`, `"FP1"`, etc.

`app.js` renders one card per upcoming race:
```
┌──────────────────────────────────────────────────────────┐
│ ROUND 4 · Miami Grand Prix                in 12 days     │
│ Miami International Autodrome — Miami, USA               │
│ [circuit svg]                                            │
│                                                          │
│  Session     Local at circuit       Your time            │
│  FP1         Fri 1 May, 18:30 ET    Fri 2 May, 00:30     │
│  Sprint Q    Fri 1 May, 22:30 ET    Sat 2 May, 04:30     │
│  …                                                       │
│  Race        Sun 3 May, 16:00 ET    Sun 3 May, 22:00     │
│                                                          │
│ [ Add Race to Calendar ▼ ]   [ Add full weekend ]        │
└──────────────────────────────────────────────────────────┘
```
- "Local at circuit" uses `CIRCUIT_TZ[circuit.id]`; show the zone abbreviation if `Intl` provides it (`timeZoneName: 'short'`).
- "Your time" uses the picker selection.
- Circuit image: `<img src="assets/circuits/${circuit.id}.svg" alt="${circuit.name} layout" loading="lazy">`. Fallback: hide on 404 with `onerror`.

**Mobile layout (< 600px)**

The 3-column session table does not fit on phones. At `max-width: 599px`:
- Stack each session as a vertical mini-card: session label on row 1, "Local at circuit" on row 2 (with small label), "Your time" on row 3 (with small label).
- Circuit image renders full-width above the session block.
- "Add Race" / "Add full weekend" buttons stack vertically, full-width, ≥ 44px tall.
- Round badge moves above the race name.

**Verification checklist**

- Scroll through every upcoming race — both columns render valid dates, no `Invalid Date`.
- Switching the timezone picker updates the right column instantly without re-fetching.
- Sprint weekends show 5 sessions (FP1, SprintQ, Sprint, Qualifying, Race); regular weekends show 5 sessions (FP1, FP2, FP3, Qualifying, Race).

**Anti-pattern guards**

- Do NOT format dates with `toLocaleString()` and string concatenation — use a single `Intl.DateTimeFormat` instance per locale/zone pair, reused.
- Do NOT generate HTML via `innerHTML` with user-controlled values — even though API data is trusted, build with `document.createElement` to avoid future XSS surface.

---

## Phase 5 — Calendar export

**What to implement**

`lib/ics.js` exports `buildIcs(events)` and `downloadIcs(events, filename)`:
- Each event in `events` is `{ uid, start, end, summary, location, description }`.
- Builder joins lines with `\r\n` and emits the verbatim minimal template from Phase 0.
- `DTSTART`/`DTEND` formatted as `YYYYMMDDTHHMMSSZ` (UTC).
- Escape `,`, `;`, `\`, and newlines in text fields (`\,` `\;` `\\` `\n`).
- `UID` format: `${eventId}@when-is-f1.app`.
- `DTEND` defaults to `start + 2h` for race, `+1h` for qualifying/sprint, `+90min` for practice.
- `downloadIcs` creates a `Blob` with `type: 'text/calendar;charset=utf-8'`, uses the temporary `<a download>` pattern, then `URL.revokeObjectURL`.

`lib/gcal.js` exports `gcalUrl(event)`:
- Returns `https://calendar.google.com/calendar/render?action=TEMPLATE&...` with `URLSearchParams`.
- `dates=YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ` (UTC).
- Do NOT pass `ctz` (we're using UTC `Z` form).

UI per event card:
- Primary button: **"Add Race to Calendar"** → opens a small popover with two choices:
  - "Download .ics" → `downloadIcs([raceEvent], 'f1-race-round-N.ics')` — **hidden on iOS** (see below)
  - "Add to Google Calendar" → `window.open(gcalUrl(raceEvent), '_blank', 'noopener')`
- Secondary button: **"Add full weekend"** → bundles all sessions into one `.ics` file (multiple `VEVENT` blocks). Google Calendar URL form does not support multi-event; on iOS this button is hidden entirely.

**iOS Safari handling**

`<a download>` triggered Blob downloads are unreliable on iOS Safari (often opens inline as text). Detect with:
```js
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
                    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
```
On iOS:
- Hide the "Download .ics" option in the popover.
- Hide the "Add full weekend" button (no fallback exists for static-only multi-event).
- "Add to Google Calendar" works fine and remains visible.
- Show a small footer note: "iOS users: tap Add to Google Calendar — `.ics` downloads are not reliable on iOS Safari."

**Verification checklist**

- Generated `.ics` opens cleanly in Apple Calendar AND imports into Google Calendar via "Settings → Import & export".
- Run a generated `.ics` through `https://icalendar.org/validator.html` (or open it in a text editor and visually confirm `\r\n`, UID, DTSTAMP, DTSTART format).
- Google Calendar URL: when clicked, lands on the Google Calendar create-event page with title, time, and location pre-filled.
- Special characters in `description` (commas, line breaks) survive the round trip.

**Anti-pattern guards**

- Do NOT join `.ics` lines with `\n`. Must be `\r\n`.
- Do NOT skip `DTSTAMP` — RFC 5545 requires it.
- Do NOT forget `URL.revokeObjectURL(url)` after the click — leaks blobs.
- Do NOT include both `Z`-suffix dates and `&ctz=` in the gcal URL.

---

## Phase 6 — Circuit images

**What to implement**

1. From Wikimedia Commons [Category:Maps of Formula One racing circuits](https://commons.wikimedia.org/wiki/Category:Maps_of_Formula_One_racing_circuits), download the SVG for each of the 22 circuits in the canonical Phase 0 list.
2. Save as `assets/circuits/<circuitId>.svg` (matching Jolpica's `circuitId` naming).
3. Inspect each SVG: ensure it scales (no fixed `width`/`height` attributes blocking responsive sizing, or override with CSS `width: 100%; height: auto;`).
4. Strip embedded `<title>`/`<desc>` only if they contain author info you want to surface — otherwise keep.
5. Create `ATTRIBUTION.md` listing per-file: filename, Wikimedia source URL, author, license (most are CC BY-SA 4.0). Link to it from the page footer.

**Verification checklist**

- Every circuitId in the live API response has a corresponding SVG.
- SVGs render crisply at the card's display width on retina displays.
- Page footer links to ATTRIBUTION.md and to https://api.jolpi.ca data source.

**Anti-pattern guards**

- Do NOT use `<img src="https://upload.wikimedia.org/...">` — Wikimedia discourages hotlinking.
- Do NOT use formula1.com images.
- Do NOT skip attribution — CC BY-SA mandates it.

---

## Phase 7 — Final verification

1. **API contract** — re-fetch `https://api.jolpi.ca/ergast/f1/current.json` and confirm field names match the normalized shape. Specifically grep the codebase for invented fields:
   - `grep -rn "SprintShootout" .` → must be empty (use `SprintQualifying`).
   - `grep -rn "ergast.com" .` → must be empty (use `api.jolpi.ca`).
2. **`.ics` sanity** — open a generated `.ics` in a hex editor or run `xxd` on the first 200 bytes to confirm `0d 0a` (CRLF) line endings.
3. **No console errors** on a fresh load. No 404s in DevTools network tab (every `assets/circuits/*.svg` resolves).
4. **Theme + tz persistence** — set both, hard reload (Ctrl-Shift-R), confirm both restored.
5. **Lighthouse run** — Performance ≥ 90, Accessibility ≥ 95 (run `npx -y lighthouse http://localhost:8000 --view` against a `python -m http.server`).
6. **Cross-browser sanity** — open in Firefox + Chromium. The `Intl.supportedValuesOf` call works in both (Baseline since 2022).
7. **Manual scenario** — pick `Asia/Tokyo` as user tz, find a race in Brazil, confirm "Your time" is roughly 12 hours ahead of "Local at circuit". Click "Download .ics", import into Google Calendar via Settings → Import, confirm the event appears at the expected wall-clock time in Tokyo.

---

## Out of scope (explicitly)

- Build tooling (Vite, webpack). Vanilla ES modules only.
- Backend / proxy. Direct browser → Jolpica fetch.
- iOS Safari `.ics` download workaround (would require a server).
- Push notifications, email reminders, account system.
- Past races / historical results.
- Live timing during sessions (use OpenF1 if added later).
- Multi-language i18n (English only for v1).
- PWA / offline mode.
