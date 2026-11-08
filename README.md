# Data visualisation

A static, browser-based chart builder for Sankey, bar, donut/pie, line, scatter, and geographic visualisations.

## Use

Choose an icon in the floating toolbar, then paste a spreadsheet range or try the chart's sample. The toolbar hides on scrolling down and returns on scrolling up. Hover an icon to see its chart name.

The table automatically grows an empty row and column as you type or paste. The bin resets data and charts; Ctrl/Cmd+Z undoes data edits, samples and resets (Shift+Ctrl/Cmd+Z redoes). The source table stays in place when switching charts. Chart settings and data stay in memory for the current page session.

Samples demonstrate multiple periods, series, signed stacks, targets, annotations and bubble sizes. Values are fictional. The map combines all 20 [Camden wards](https://www.ons.gov.uk/explore-local-statistics/areas/E09000007-camden) with three [library postcode locations](https://www.camden.gov.uk/libraries-opening-times). Ward and pin rows are separate so each has its own value; the Council column disambiguates ward names.

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

- `index.html`, `assets/app.js`, and `assets/app.css`: shared data editor, automatic table growth, navigation, and undo history.
- `assets/samples.js`: chart-specific demonstration tables.
- `builders/*.html`: chart document markup, loaded on demand.
- `assets/<chart>.js` and `.css`: chart-specific parsing, rendering, and settings.
- `assets/shared.js`: numeric parsing, delimited-text parsing, project validation, safe tooltip formatting, and signed extents.
- `assets/export.js`: standalone chart HTML exports without dependencies on builder globals.
- `assets/builder.js` and `.css`: common accessibility, state access, responsive preview styling, and iframe sizing.
- `tests/`: isolated DOM and unit regressions covering data interpretation, exports, signed values, history, and asynchronous map behaviour.

The map redesign from `map-redesign` is the baseline for this version. Existing branch history is preserved.
