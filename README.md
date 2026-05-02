# When Is F1

A small static site that shows upcoming Formula 1 sessions in your local time and lets you add them to your calendar.

- See every session of every remaining round of the current season.
- Pick your country (searchable, with flag icons) — times convert automatically.
- Each session is shown both in the circuit's local time and in yours.
- One-click add to Google Calendar, or download an `.ics` for the race or the full weekend.
- Light / dark theme, responsive layout, no build step.

## Run locally

No dependencies, no bundler. Any static server works:

```sh
python -m http.server 8000
```

Then open http://localhost:8000.

Opening `index.html` directly via `file://` will not work — the app uses ES modules and `fetch`, both of which require an HTTP origin.

## Stack

- Vanilla HTML, CSS, ES modules. No framework, no build.
- F1 schedule from [Jolpica F1](https://api.jolpi.ca/) (a free, key-less Ergast successor).
- Country / IANA timezone data inlined from [`countries-and-timezones`](https://github.com/manuelmhtr/countries-and-timezones) (MIT).
- Flag SVGs from [`flag-icons`](https://github.com/lipis/flag-icons) (MIT).
- Track-layout SVGs from Wikimedia Commons (see [ATTRIBUTION.md](ATTRIBUTION.md)).
- Typeface: [Space Mono](https://fonts.google.com/specimen/Space+Mono) (SIL OFL 1.1).

## Layout

```
index.html              # entry
styles.css              # all styles, light + dark via CSS variables
app.js                  # wires the pieces together
lib/
  api.js                # fetch + normalize Jolpica response
  format.js             # Intl-based date / time / relative formatting
  ics.js                # RFC 5545 .ics builder + Blob download
  gcal.js               # Google Calendar URL builder
  theme.js              # light/dark toggle, persisted in localStorage
  combobox.js           # custom searchable country picker with SVG flags
data/
  countries.js          # ISO-2 -> display name (247 entries)
  country-timezones.js  # ISO-2 -> [IANA zones], plus zone -> primary country
  circuit-timezones.js  # F1 circuitId -> IANA zone
assets/
  flags/                # 247 SVG country flags
  circuits/             # 21 SVG track maps
ATTRIBUTION.md
```

## Limitations

- iOS Safari does not reliably download `.ics` files from Blob URLs, so on iOS the `.ics` option is hidden and only the Google Calendar link is shown. Working around this would need a server.
- Madring (Madrid, round 14 of 2026) does not have a track-layout SVG on Wikimedia Commons yet — the card shows a "Map coming soon" placeholder.
