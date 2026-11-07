# Data visualisation

A static, browser-based chart builder for Sankey, bar, donut/pie, line, scatter, and geographic visualisations.

## Use

Choose a chart and try its sample, paste a spreadsheet range with a header row, or import CSV/TSV. Open **Column mapping** to inspect suggested roles or choose columns explicitly. The source table stays intact when changing chart type. Missing, invalid, and nonpositive values are reported where applicable.

Use **Save project** and **Open project** to retain the source table, mappings, chart controls, and colours. Device persistence is opt-in; unchecking it removes the saved device copy. Undo/redo covers source edits, sample replacement, mapping changes, and reset. It is not a history of every chart-control movement.

Charts support SVG, PNG, and standalone HTML exports. HTML snapshots retain period selection, colours, and tooltips. Map HTML includes resolved geographic data and local application code, but still needs online Leaflet resources and basemap tiles. Map SVG contains vector shapes and labels without basemap tiles; PNG includes the rendered basemap when its provider permits cross-origin capture.

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

- `index.html`, `assets/app.js`, and `assets/app.css`: shared data editor, import, explicit mapping, history, and project storage.
- `builders/*.html`: chart document markup, loaded on demand.
- `assets/<chart>.js` and `.css`: chart-specific parsing, rendering, and settings.
- `assets/shared.js`: numeric parsing, delimited-text parsing, project validation, safe tooltip formatting, and signed extents.
- `assets/export.js`: standalone chart HTML exports without dependencies on builder globals.
- `assets/builder.js` and `.css`: common accessibility, keyboard ordering, state access, responsive preview styling, and iframe sizing.
- `tests/`: isolated DOM and unit regressions covering data interpretation, exports, signed values, mapping/history, and asynchronous map behaviour.

The map redesign from `map-redesign` is the baseline for this version. Existing branch history is preserved.
