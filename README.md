# Data visualisation

A static, browser-based chart builder for Sankey, bar, donut/pie, line, scatter, and geographic visualisations.

## Use

Choose an icon in the floating toolbar, then paste a spreadsheet range or try the chart's sample. The toolbar hides on scrolling down and returns on scrolling up. Hover an icon to see its chart name.

The table automatically grows an empty row and column as you type or paste. The bin resets data and charts; Ctrl/Cmd+Z undoes data edits, samples and resets (Shift+Ctrl/Cmd+Z redoes). The source table stays in place when switching charts. Chart settings and data stay in memory for the current page session.

The sample button cycles through five sourced stories per chart, plus a sixth Camden map example. The 31 small CSVs are bundled locally in `assets/samples/`; titles and reference information appear above the chart, while source links and scope share a table footer excluded from chart data. Descriptive column names become chart labels. The refugee sample covers all reported routes by region, with the complete 4,792-record country table linked alongside it. Editing or uploading data clears the sample attribution; Undo restores it. See [SOURCES.md](SOURCES.md) for provenance, units and derivations.

Charts support SVG, PNG, and standalone HTML exports. HTML snapshots retain the title, colour key, tooltips, hover emphasis and period slider. Map HTML is a presentation view without editing controls; it embeds resolved geographic data but still needs online Leaflet resources and basemap tiles. Map SVG keeps shapes and labels editable and embeds the basemap as a separate raster layer. PNG uses the same composition. Basemap inclusion needs loaded tiles whose provider permits cross-origin capture.

The Camden sample keeps the twenty wards and supplied five neighbourhood groups, with full addresses for nine council libraries and three public community libraries. It contains no invented population or activity values. Country and US-state examples use bundled Natural Earth boundaries. Outline, label, area and pin colours can be edited independently. Fixed-size inside labels are fitted to the projected shapes; labels that cannot fit use outside callouts. Map opacity starts at 50%. The dark-map toggle uses a dark basemap with light roads.

Map lookups send geographic fields to Postcodes.io or Esri. Ambiguous wards require a council hint or a ward code; unmatched locations are reported. Coordinates can be used without geocoding. All other data processing occurs in the browser. Third-party chart libraries and tiles require internet access.

## Develop

No build step is required for deployment. Serve this directory over HTTP (rather than opening `index.html` as a local file), for example:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. GitHub Pages can serve the repository root on `main`.

For development checks, use Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
```

`pnpm format` formats maintained source files. Dependencies are for tests and formatting only; the deployed site remains static.

## Structure

- `index.html`, `assets/app.js`, and `assets/app.css`: shared data editor, automatic table growth, navigation, and undo history.
- `assets/samples.js`: chart-specific demonstration tables.
- `builders/*.html`: chart document markup, loaded on demand.
- `assets/<chart>.js` and `.css`: chart-specific parsing, rendering, and settings.
- `assets/shared.js`: numeric parsing, delimited-text parsing, project validation, safe tooltip formatting, and signed extents.
- `assets/export.js`: standalone chart HTML exports without dependencies on builder globals.
- `assets/builder.js` and `.css`: common accessibility, state access, responsive preview styling, and iframe sizing.
- `tests/`: isolated DOM and unit regressions covering data interpretation, exports, signed values, history, and asynchronous map behaviour.

The map redesign from `map-redesign` is the baseline for this version. Existing branch history is preserved.

Titles start empty with an “Enter title here” placeholder across all charts. Samples supply an editable title; clearing data restores the placeholder. No AI title inference is used. Line endpoints identify their series; donut sections and bars can be dragged to reorder. Sankey routes can skip steps while retaining shared node identities. Map outline thickness and label/outline colours are editable; label text has no blurry halo.

Privacy: data and Undo history live in tab memory; there is no application autosave or full-table upload. Map lookups send location fields to external providers and basemap requests reveal the viewed area. See [privacy details](PRIVACY.html).
