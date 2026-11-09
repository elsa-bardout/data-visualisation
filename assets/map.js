"use strict";
let M = [[]],
  colourMode = "auto",
  colourField = -1,
  categoryField = -1,
  numericFields = [],
  categoryFields = [],
  colourChoices = [],
  renderedItems = [],
  currentBounds = null,
  map = L.map("map", {
    zoomControl: false,
    dragging: true,
    scrollWheelZoom: false,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    touchZoom: true,
    attributionControl: true,
    zoomSnap: 0.05,
    zoomDelta: 0.05,
  }).setView([54.4, -3.3], 6),
  layers = [],
  labels = [],
  tile = null,
  mask = null,
  mapMode = "full",
  darkMap = false,
  boundaryMode = "fill",
  pinStyle = "marker",
  labelMode = "none",
  showValues = true,
  showDetails = false,
  current = null,
  colours = Object.create(null),
  colourTarget = null,
  baseZoom = 6;
map.createPane("maskPane");
map.getPane("maskPane").style.zIndex = 350;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  clean = (v) => String(v ?? "").trim(),
  norm = (v) =>
    clean(v)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""),
  num = ChartUtils.number,
  palette = [
    "#5653FF",
    "#00B188",
    "#F8CA1C",
    "#F56DAB",
    "#FA9C28",
    "#EF431B",
    "#844AFF",
    "#2B82C4",
    "#3EB86D",
  ];
const alias = {
  address: ["ADDRESS", "FULLADDRESS", "STREETADDRESS", "ADDRESSLINE1"],
  country: ["COUNTRY", "COUNTRYNAME"],
  postcode: ["POSTCODE", "POSTCODEAREA", "POSTALCODE", "ZIP", "ZIPCODE"],
  lat: ["LAT", "LATITUDE"],
  lon: ["LON", "LNG", "LONGITUDE"],
  ward: ["WARD", "WARDNAME", "WARD25NM"],
  wardcode: ["WARDCODE", "WD25CD"],
  council: ["COUNCIL", "BOROUGH", "LOCALAUTHORITY", "LAD25NM"],
  councilcode: ["COUNCILCODE", "LAD25CD"],
  neighbourhood: ["NEIGHBOURHOOD", "NEIGHBORHOOD", "DISTRICT", "REGION"],
  location: ["LOCATION", "PLACE", "AREA", "ZONE", "GEOGRAPHY"],
  value: [
    "VALUE",
    "COUNT",
    "TOTAL",
    "NUMBER",
    "AMOUNT",
    "SCORE",
    "RATE",
    "PERCENT",
    "PERCENTAGE",
  ],
  category: ["CATEGORY", "TYPE", "SERVICE", "GROUP", "SERIES"],
  label: ["LABEL", "NAME", "SITE", "FACILITY"],
  colour: ["COLOUR", "COLOR", "HEX"],
};
const idx = (h, a) => h.findIndex((x) => a.includes(norm(x)));
function status(x) {
  $("#status").textContent = x;
  $("#status").classList.toggle("on", !!x);
}
function clearLabels() {
  labels.forEach((x) => {
    try {
      map.removeLayer(x);
    } catch {}
  });
  labels = [];
}
function clear() {
  layers.forEach((x) => {
    try {
      map.removeLayer(x);
    } catch {}
  });
  layers = [];
  clearLabels();
  if (mask) {
    map.removeLayer(mask);
    mask = null;
  }
  $("#legend").innerHTML = "";
  $("#empty").style.display = "grid";
  $("#download").disabled = true;
}
function looksPostcode(v) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(clean(v));
}
function headerScore(r) {
  return r.reduce(
    (n, x) => n + Object.values(alias).some((a) => a.includes(norm(x))),
    0,
  );
}
function inferTable(rows) {
  let width = Math.max(...rows.map((r) => r.length)),
    h = Array(width).fill(""),
    samples = Array.from({ length: width }, (_, i) =>
      rows.map((r) => clean(r[i])).filter(Boolean),
    );
  samples.forEach((a, i) => {
    if (a.length && a.filter(looksPostcode).length / a.length > 0.6)
      h[i] = "Postcode";
    else if (
      a.length &&
      a.filter((x) => Number.isFinite(num(x))).length / a.length > 0.8
    )
      h[i] = "Value";
    else h[i] = i === 0 ? "Location" : i === 1 ? "Label" : "Detail " + i;
  });
  let nums = h.map((x, i) => (x === "Value" ? i : -1)).filter((i) => i >= 0);
  if (nums.length >= 2) {
    let a = samples[nums[0]].map(num),
      b = samples[nums[1]].map(num);
    if (
      a.every((x) => x >= -90 && x <= 90) &&
      b.every((x) => x >= -180 && x <= 180)
    ) {
      h[nums[0]] = "Latitude";
      h[nums[1]] = "Longitude";
    }
  }
  return { h, d: rows };
}
function fieldProfiles(h, d) {
  return h.map((name, i) => {
    let values = d.map((r) => clean(r[i])).filter(Boolean),
      numbers = values.map(num).filter(Number.isFinite),
      hexes = values.filter((v) => /^#[0-9a-f]{6}$/i.test(v)),
      unique = new Set(values.map(norm)).size;
    return {
      i,
      name: clean(name) || "Column " + (i + 1),
      values,
      numeric: values.length > 0 && numbers.length / values.length >= 0.8,
      hex: values.length > 0 && hexes.length / values.length >= 0.8,
      grouped: values.length > 1 && unique > 1 && unique < values.length,
    };
  });
}
function parse() {
  let r = M.filter((x) => x.some(clean));
  if (!r.length) return null;
  let t = headerScore(r[0]) ? { h: r[0], d: r.slice(1) } : inferTable(r),
    h = t.h,
    d = t.d;
  if (!d.length) return null;
  let I = Object.fromEntries(
      Object.entries(alias).map(([k, a]) => [k, idx(h, a)]),
    ),
    geo =
      I.address >= 0
        ? "address"
        : I.lat >= 0 && I.lon >= 0
          ? "coords"
          : I.ward >= 0 || I.wardcode >= 0
            ? "ward"
            : I.council >= 0 || I.councilcode >= 0
              ? "council"
              : I.postcode >= 0
                ? "postcode"
                : I.lat >= 0 && I.lon >= 0
                  ? "coords"
                  : I.neighbourhood >= 0 || I.location >= 0
                    ? "location"
                    : I.country >= 0
                      ? "country"
                      : "",
    profiles = fieldProfiles(h, d),
    reserved = new Set(
      [
        I.postcode,
        I.lat,
        I.lon,
        I.ward,
        I.wardcode,
        I.location,
        I.label,
      ].filter((i) => i >= 0),
    );
  numericFields = profiles
    .filter((x) => x.numeric && !reserved.has(x.i))
    .map((x) => x.i);
  categoryFields = profiles
    .filter((x) => x.grouped && !x.numeric && !x.hex && !reserved.has(x.i))
    .map((x) => x.i);
  colourChoices = profiles.filter(
    (x) => x.hex || numericFields.includes(x.i) || categoryFields.includes(x.i),
  );
  if (colourField < 0 || !colourChoices.some((x) => x.i === colourField))
    colourField =
      I.colour >= 0
        ? I.colour
        : I.category >= 0 && categoryFields.includes(I.category)
          ? I.category
          : I.value >= 0
            ? I.value
            : (numericFields[0] ?? categoryFields[0] ?? -1);
  categoryField = categoryFields.includes(colourField)
    ? colourField
    : (categoryFields[0] ?? -1);
  return geo ? { h, d, I, geo, profiles } : null;
}
function meta(p, r) {
  let used = new Set(Object.values(p.I).filter((i) => i >= 0)),
    o = {};
  p.h.forEach((x, i) => {
    if (!used.has(i) && clean(x) && clean(r[i])) o[clean(x)] = clean(r[i]);
  });
  return o;
}
function esc(x) {
  return clean(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function rowName(p, r, fallback = "Location") {
  let i =
    p.I.label >= 0
      ? p.I.label
      : p.I.address >= 0
        ? p.I.address
        : p.I.location >= 0
          ? p.I.location
          : p.I.ward >= 0
            ? p.I.ward
            : p.I.council >= 0
              ? p.I.council
              : p.I.postcode;
  return clean(i >= 0 ? r[i] : "") || fallback;
}
function tipHtml(d) {
  let a = [`<b>${esc(d.name || "Location")}</b>`];
  if (Number.isFinite(d.value)) a.push(`Value: ${d.value.toLocaleString()}`);
  Object.entries(d.meta || {}).forEach(([k, v]) =>
    a.push(`${esc(k)}: ${esc(v)}`),
  );
  return a.join("<br>");
}
function hoverOn(layer, d) {
  layers.forEach((g) =>
    g.eachLayer?.((x) =>
      x.getElement?.()?.classList.toggle("dimmed", x !== layer),
    ),
  );
  layer.getElement?.()?.classList.add("feature-focus");
  $("#tip").innerHTML = tipHtml(d);
  $("#tip").style.opacity = 1;
}
function hoverOff() {
  layers.forEach((g) =>
    g.eachLayer?.((x) => {
      let e = x.getElement?.();
      e?.classList.remove("dimmed", "feature-focus");
    }),
  );
  $("#tip").style.opacity = 0;
}
function hoverMove(e) {
  $("#tip").style.left = e.originalEvent.clientX + 12 + "px";
  $("#tip").style.top = e.originalEvent.clientY + 8 + "px";
}
function getColour(k, v) {
  return colours[k] || (colours[k] = v);
}
function mix(a, b, t) {
  let p = (x) => parseInt(x, 16),
    A = a.slice(1),
    B = b.slice(1);
  return (
    "#" +
    [0, 2, 4]
      .map((i) =>
        Math.round(p(A.slice(i, i + 2)) * (1 - t) + p(B.slice(i, i + 2)) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function bands(v, n = 5) {
  let lo = Math.min(...v),
    hi = Math.max(...v),
    c = [];
  for (let i = 1; i < n; i++) c.push(lo + ((hi - lo) * i) / n);
  return {
    at: (x) => {
      let i = c.findIndex((y) => x <= y);
      return i < 0 ? n - 1 : i;
    },
  };
}
function hex(v) {
  v = clean(v);
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : "";
}
function activeColourMode(p) {
  if (colourMode === "single" || colourField < 0) return "single";
  let profile = p.profiles.find((x) => x.i === colourField);
  if (!profile) return "single";
  if (profile.hex) return "data";
  if (profile.numeric) return "gradient";
  if (profile.grouped) return "category";
  return "single";
}
function updateColourControls(p) {
  let menu = $("#colourByMenu");
  menu.innerHTML = "";
  let options = [{ i: -1, name: "Single colour" }, ...colourChoices];
  options.forEach((o) => {
    let b = document.createElement("button"),
      mode =
        o.i < 0
          ? "single"
          : o.hex
            ? "data"
            : o.numeric
              ? "gradient"
              : "category";
    b.textContent =
      o.name +
      (mode === "data"
        ? " · supplied colours"
        : mode === "gradient"
          ? " · gradient"
          : mode === "category"
            ? " · categories"
            : "");
    b.classList.toggle(
      "active",
      (o.i < 0 && colourMode === "single") || o.i === colourField,
    );
    b.onclick = () => {
      colourMode = o.i < 0 ? "single" : "field";
      colourField = o.i;
      if (mode === "category") categoryField = o.i;
      $("#colourByMenu").classList.remove("open");
      updateColourControls(p);
      render();
    };
    menu.appendChild(b);
  });
  let chosen = options.find(
    (o) => (o.i < 0 && colourMode === "single") || o.i === colourField,
  );
  $("#colourByBtn").innerHTML =
    "Colour by: " +
    esc(chosen?.name || "Automatic") +
    ' <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 4.5 3 3 3-3"/></svg>';
}
function legend(items) {
  let b = $("#legend");
  b.innerHTML = "";
  items.forEach((x) => {
    let l = document.createElement("label"),
      i = document.createElement(
        document.documentElement.dataset.export === "readonly"
          ? "span"
          : "button",
      );
    i.className = "swatch";
    i.style.background = x.c;
    i.onclick = (e) => openColour(e, x.key);
    l.append(i, document.createTextNode(x.n));
    b.append(l);
  });
}
function openColour(e, key) {
  if (document.documentElement.dataset.export === "readonly") return;
  colourTarget = key;
  let v = colours[key],
    r = e.currentTarget.getBoundingClientRect();
  $("#colourPop").style.left = Math.min(innerWidth - 150, r.left) + "px";
  $("#colourPop").style.top = r.bottom + 7 + "px";
  $("#hex").value = v;
  $("#nativeColour").value = v;
  $("#colourPop").classList.add("open");
}
function setMapMode() {
  $("#map").classList.toggle("dark-map", darkMap);
  if (mask) {
    map.removeLayer(mask);
    mask = null;
  }
  if (mapMode === "none") {
    if (tile) {
      map.removeLayer(tile);
      tile = null;
    }
  } else {
    const tileUrl = darkMap
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
    // Recreate the tile grid: setUrl/redraw can use a fractional map zoom
    // as a raster tile level, misaligning tiles after a theme change.
    if (tile) map.removeLayer(tile);
    tile = L.tileLayer(tileUrl, {
      attribution: "Tiles © Esri",
      maxZoom: 19,
      crossOrigin: "anonymous",
    }).addTo(map);
    tile.bringToBack();
  }
  applyMapOpacity();
}
function applyMapOpacity() {
  let v = +$("#mapOpacity").value / 100;
  document.documentElement.style.setProperty("--map-opacity", v);
  $("#mapOpacityV").textContent = Math.round(v * 100) + "%";
}
function updateRelevantControls() {
  let area = current?.kind === "area",
    points = current?.kind === "points" || !!current?.points;
  $("#fillOpacityControl").classList.toggle(
    "isHidden",
    !area || boundaryMode === "outline",
  );
  $("#pinControl").classList.toggle("isHidden", !points);
  $("#mapOpacityControl").classList.toggle("isHidden", mapMode === "none");
}
function ringsOf(g) {
  let out = [];
  (g.features || []).forEach((f) => {
    let c = f.geometry.coordinates;
    if (f.geometry.type === "Polygon") out.push(c[0]);
    else if (f.geometry.type === "MultiPolygon")
      c.forEach((p) => out.push(p[0]));
  });
  return out.map((r) => r.map((x) => [x[1], x[0]]));
}
function addMask(gj) {
  let world = [
      [-90, -360],
      [-90, 360],
      [90, 360],
      [90, -360],
    ],
    rings = ringsOf(gj);
  mask = L.polygon([world, ...rings], {
    pane: "maskPane",
    stroke: false,
    fillColor: "#fff",
    fillOpacity: 1,
    fillRule: "evenodd",
    interactive: false,
  }).addTo(map);
}
function labelParts(d) {
  let sub = [];
  if (showValues && Number.isFinite(d.value))
    sub.push(d.value.toLocaleString());
  if (showDetails)
    Object.entries(d.meta || {}).forEach(([k, v]) => sub.push(`${k}: ${v}`));
  return { main: d.name || "", sub };
}
function labelHtml(d, size = 11, out = false, side = "right") {
  let q = labelParts(d);
  return `<div class="${out ? "outsideLabel " + side : ""}"><span class="main" style="font-size:${size}px">${esc(q.main)}</span>${q.sub.map((x) => `<span class="sub">${esc(x)}</span>`).join("")}</div>`;
}
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    let a = ring[i],
      b = ring[j],
      hit =
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (hit) inside = !inside;
  }
  return inside;
}
function segmentDistance(p, a, b) {
  let x = a[0],
    y = a[1],
    dx = b[0] - x,
    dy = b[1] - y;
  if (dx || dy) {
    let t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return Math.sqrt(dx * dx + dy * dy);
}
function visualCentre(feature) {
  let polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates,
    best = null;
  polys.forEach((poly) => {
    let ring = poly[0],
      xs = ring.map((x) => x[0]),
      ys = ring.map((x) => x[1]),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys),
      candidate = [(minX + maxX) / 2, (minY + maxY) / 2],
      bestD = -1;
    for (let pass = 0; pass < 4; pass++) {
      let nx = pass ? 7 : 11,
        spanX = (maxX - minX) / (pass ? 4 : 1),
        spanY = (maxY - minY) / (pass ? 4 : 1),
        cx = candidate[0],
        cy = candidate[1],
        fromX = pass ? cx - spanX / 2 : minX,
        fromY = pass ? cy - spanY / 2 : minY;
      for (let ix = 0; ix < nx; ix++)
        for (let iy = 0; iy < nx; iy++) {
          let q = [
            fromX + (ix + 0.5) * (spanX / nx),
            fromY + (iy + 0.5) * (spanY / nx),
          ];
          if (!pointInRing(q, ring)) continue;
          let d = Math.min(
            ...ring.map((a, i) =>
              segmentDistance(q, a, ring[(i + 1) % ring.length]),
            ),
          );
          if (d > bestD) {
            bestD = d;
            candidate = q;
          }
        }
      minX = candidate[0] - spanX / nx;
      maxX = candidate[0] + spanX / nx;
      minY = candidate[1] - spanY / nx;
      maxY = candidate[1] + spanY / nx;
    }
    if (!best || bestD > best.d) best = { p: candidate, d: bestD };
  });
  return best ? L.latLng(best.p[1], best.p[0]) : null;
}
// Fit the entire fixed-size text block, not only its centre, inside a polygon.
function fitAreaLabel(item, obstacles) {
  const polys = (
    item.feature.geometry.type === "Polygon"
      ? [item.feature.geometry.coordinates]
      : item.feature.geometry.coordinates
  ).map((poly) =>
    poly.map((r) =>
      r.map((c) => {
        const p = map.latLngToContainerPoint([c[1], c[0]]);
        return [p.x, p.y];
      }),
    ),
  );
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  ctx.font = '700 11px Inter, "Segoe UI", sans-serif';
  const parts = labelParts(item.data),
    words = parts.main.split(/\s+/);
  const variants = [];
  for (const maxWidth of [140, 110, 90, 72, 56, 44, 34]) {
    const lines = [];
    let line = "";
    const wrappedWords = words.flatMap((word) => {
      if (ctx.measureText(word).width <= maxWidth || word.length < 9)
        return [word];
      const breaks = {
        Haverstock: ["Haver-", "stock"],
        Bloomsbury: ["Blooms-", "bury"],
        Hampstead: ["Hamp-", "stead"],
      };
      return breaks[word] || [word];
    });
    for (const word of wrappedWords) {
      const next = line ? line + " " + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const all = [...lines, ...parts.sub];
    variants.push({
      lines,
      sub: parts.sub,
      w: Math.max(...all.map((t) => ctx.measureText(t).width)) + 6,
      h: all.length * 14 + 4,
    });
  }
  let best = null;
  for (const poly of polys) {
    const outer = poly[0],
      xs = outer.map((p) => p[0]),
      ys = outer.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const inside = (p) =>
      pointInRing(p, outer) && !poly.slice(1).some((r) => pointInRing(p, r));
    const candidates = [];
    for (let ix = 0; ix < 23; ix++)
      for (let iy = 0; iy < 23; iy++) {
        const p = [
          minX + ((ix + 0.5) * (maxX - minX)) / 23,
          minY + ((iy + 0.5) * (maxY - minY)) / 23,
        ];
        if (!inside(p)) continue;
        let clearance = Infinity;
        for (const ring of poly)
          for (let i = 0; i < ring.length; i++)
            clearance = Math.min(
              clearance,
              segmentDistance(p, ring[i], ring[(i + 1) % ring.length]),
            );
        candidates.push({ p, clearance });
      }
    candidates.sort((a, b) => b.clearance - a.clearance);
    for (const { p, clearance } of candidates.slice(0, 100))
      for (const v of variants) {
        const box = { x: p[0] - v.w / 2, y: p[1] - v.h / 2, w: v.w, h: v.h };
        if (
          obstacles.some(
            (b) =>
              box.x < b.x + b.w &&
              box.x + box.w > b.x &&
              box.y < b.y + b.h &&
              box.y + box.h > b.y,
          )
        )
          continue;
        let fits = true;
        // Check the padded perimeter at 2px resolution, plus boundary vertices
        // to reject concave notches and holes completely enclosed by the box.
        for (let x = box.x; x <= box.x + box.w; x += 2)
          if (!inside([x, box.y]) || !inside([x, box.y + box.h])) {
            fits = false;
            break;
          }
        if (!fits) continue;
        for (let y = box.y; y <= box.y + box.h; y += 2)
          if (!inside([box.x, y]) || !inside([box.x + box.w, y])) {
            fits = false;
            break;
          }
        if (
          !fits ||
          poly.some((r) =>
            r.some(
              ([x, y]) =>
                x > box.x &&
                x < box.x + box.w &&
                y > box.y &&
                y < box.y + box.h,
            ),
          )
        )
          continue;
        const score = clearance - v.lines.length * 1.5;
        if (!best || score > best.score) best = { ...v, p, box, score };
      }
  }
  return best;
}
function insideLabels(items) {
  const areas = items.filter((x) => x.kind === "area"),
    fallback = [];
  const obstacles = items
    .filter((x) => x.kind === "point")
    .map((x) => {
      const p = map.latLngToContainerPoint(x.latlng);
      return { x: p.x - 14, y: p.y - 28, w: 28, h: 32 };
    });
  for (const x of areas.length ? areas : items) {
    const fit = x.feature ? fitAreaLabel(x, obstacles) : null;
    if (x.feature && !fit) {
      fallback.push(x);
      continue;
    }
    const pos = fit ? map.containerPointToLatLng(L.point(...fit.p)) : x.latlng;
    const html = fit
      ? '<div><span class="main" style="font-size:11px">' +
        fit.lines.map(esc).join("<br>") +
        "</span>" +
        fit.sub.map((t) => '<span class="sub">' + esc(t) + "</span>").join("") +
        "</div>"
      : labelHtml(x.data, 11);
    const w = fit ? fit.w : 100;
    labels.push(
      L.marker(pos, {
        interactive: false,
        icon: L.divIcon({
          className: "mapLabel insideLabel",
          html,
          iconSize: [w, 0],
          iconAnchor: [w / 2, 0],
        }),
      }).addTo(map),
    );
    if (fit) obstacles.push(fit.box);
  }
  // An area too small for an 11px label gets an outside callout, never clipped text.
  if (fallback.length) outsideLabels(fallback);
}
function outsideLabels(items) {
  let ranked = items
      .map((x) => ({ ...x, p: map.latLngToContainerPoint(x.latlng) }))
      .sort((a, b) => a.p.x - b.p.x),
    leftN = Math.ceil(ranked.length / 2),
    a = ranked.map((x, i) => ({
      ...x,
      side: i < leftN ? "left" : "right",
      y: x.p.y,
    })),
    gap = Math.min(
      56,
      Math.max(
        38,
        (map.getSize().y - 56) / Math.max(1, Math.ceil(items.length / 2)),
      ),
    ),
    min = 28,
    max = map.getSize().y - 28;
  ["left", "right"].forEach((side) => {
    let q = a.filter((x) => x.side === side).sort((x, y) => x.y - y.y);
    for (let i = 1; i < q.length; i++)
      q[i].y = Math.max(q[i].y, q[i - 1].y + gap);
    if (q.length && q.at(-1).y > max) {
      let z = q.at(-1).y - max;
      q.forEach((x) => (x.y -= z));
    }
    for (let i = q.length - 2; i >= 0; i--)
      q[i].y = Math.min(q[i].y, q[i + 1].y - gap);
    if (q.length && q[0].y < min) {
      let z = min - q[0].y;
      q.forEach((x) => (x.y += z));
    }
    q.forEach((x) => {
      let edge = currentBounds?.isValid?.()
          ? map.latLngToContainerPoint(
              x.side === "right"
                ? currentBounds.getNorthEast()
                : currentBounds.getSouthWest(),
            ).x
          : x.p.x,
        lineX =
          x.side === "right"
            ? Math.min(map.getSize().x - 180, edge + 32)
            : Math.max(180, edge - 32),
        labelX = x.side === "right" ? lineX + 12 : lineX - 12,
        end = L.point(lineX, x.y),
        elbow = L.point(x.side === "right" ? x.p.x + 28 : x.p.x - 28, x.y),
        endLL = map.containerPointToLatLng(end),
        labelLL = map.containerPointToLatLng(L.point(labelX, x.y)),
        line = L.polyline(
          [x.latlng, map.containerPointToLatLng(elbow), endLL],
          {
            className: "leader",
            color: "#aeb8c0",
            weight: 1,
            interactive: false,
          },
        ).addTo(map),
        w = 160,
        m = L.marker(labelLL, {
          interactive: false,
          icon: L.divIcon({
            className: "mapLabel",
            html: labelHtml(x.data, 11, true, x.side),
            iconSize: [w, 84],
            iconAnchor: [x.side === "right" ? 0 : w, 0],
          }),
        }).addTo(map);
      labels.push(line, m);
    });
  });
}
function applyLabels(items) {
  clearLabels();
  document.documentElement.style.setProperty(
    "--label-colour",
    getColour("labels", "#17212b"),
  );
  if (labelMode === "inside") insideLabels(items);
  if (labelMode === "outside") outsideLabels(items);
}
function nameVariants(v) {
  let x = clean(v),
    a = new Set([
      x,
      x.replace(/[’‘]/g, "'"),
      x.replace(/\s*&\s*/g, " and "),
      x.replace(/\s+and\s+/gi, " & "),
    ]);
  return [...a].filter(Boolean);
}
function parentName(f) {
  let p = f.properties || {};
  return clean(p.LAD25NM || p.LAD24NM || p.LAD23NM || p.DISTRICT || p.LADNM);
}
function featureName(f, field) {
  return clean((f.properties || {})[field]);
}
function featureCentre(f) {
  let pts = [];
  (function walk(x) {
    if (!Array.isArray(x)) return;
    if (typeof x[0] === "number" && typeof x[1] === "number") pts.push(x);
    else x.forEach(walk);
  })(f.geometry?.coordinates);
  if (!pts.length) return [0, 0];
  return [
    pts.reduce((n, x) => n + x[0], 0) / pts.length,
    pts.reduce((n, x) => n + x[1], 0) / pts.length,
  ];
}
function chooseLogicalFeatures(features, rows, ni, field, p) {
  const selected = [];
  for (const row of rows) {
    const candidates = features.filter(
        (f) => norm(featureName(f, field)) === norm(row[ni]),
      ),
      hint = p.I.council >= 0 ? norm(row[p.I.council]) : "",
      matching = hint
        ? candidates.filter((f) => norm(parentName(f)) === hint)
        : candidates;
    if (matching.length === 1) selected.push(matching[0]);
    else if (candidates.length === 1 && !hint) selected.push(candidates[0]);
  }
  return { type: "FeatureCollection", features: selected };
}
async function queryAreas(service, field, values) {
  let variants = [...new Set(values.flatMap(nameVariants))],
    names = variants.map((v) => "'" + v.replace(/'/g, "''") + "'").join(",");
  if (!names) return null;
  let where = field + " IN (" + names + ")",
    url = `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/${service}/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=true&outSR=4326&f=geojson`;
  let gj = await fetchJSONResponse(url).then((x) => x.json());
  return Array.isArray(gj.features) ? gj : null;
}
async function fetchArea(p, kind, ni) {
  let code = kind === "ward" ? p.I.wardcode : p.I.councilcode,
    field =
      kind === "ward"
        ? code >= 0
          ? "WD25CD"
          : "WD25NM"
        : code >= 0
          ? "LAD25CD"
          : "LAD25NM",
    service =
      kind === "ward" ? "WD_MAY_2025_UK_BGC_V2" : "LAD_MAY_2025_UK_BGC_V2",
    rows = p.d.filter((r) => clean(r[ni]) && norm(r[ni]) !== "TOTAL"),
    result = await queryAreas(
      service,
      field,
      rows.map((r) => clean(r[ni])),
    );
  let gj = result;
  if (!gj?.features?.length) return null;
  if (kind === "ward" && code < 0)
    gj = chooseLogicalFeatures(gj.features, rows, ni, field, p);
  let matched = new Set(gj.features.map((f) => norm(featureName(f, field)))),
    missing = rows
      .map((r) => clean(r[ni]))
      .filter((v) => !matched.has(norm(v)));
  return {
    kind: "area",
    p,
    gj,
    rowMap: new Map(rows.map((r) => [norm(r[ni]), r])),
    field,
    ni,
    missing,
    dominantParent: gj.dominantParent || "",
  };
}
async function geocodeRows(p, ni) {
  let coords = [],
    missing = [];
  for (let r of p.d) {
    let name = clean(r[ni]);
    if (!name) continue;
    let context = p.I.council >= 0 ? clean(r[p.I.council]) : "",
      q = [name, context, p.I.country >= 0 ? clean(r[p.I.country]) : ""]
        .filter(Boolean)
        .join(", ")
        .replace(/[;|]+/g, ", ")
        .replace(/\s+/g, " "),
      url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&f=json&maxLocations=1`,
      z = await fetchJSONResponse(url).then((x) => x.json()),
      c = z.candidates?.[0];
    if (c && c.score >= 85)
      coords.push({
        r,
        lat: c.location.y,
        lon: c.location.x,
        matchedAddress: c.address,
        matchScore: c.score,
      });
    else missing.push(name);
  }
  return coords.length ? { kind: "points", p, coords, missing } : null;
}
async function prepare(p) {
  if (p.geo === "country") {
    const gj = await fetchJSONResponse("../assets/countries.geojson").then(
      (r) => r.json(),
    );
    const aliases = {
      UK: "UNITEDKINGDOM",
      GB: "UNITEDKINGDOM",
      USA: "UNITEDSTATESOFAMERICA",
      US: "UNITEDSTATESOFAMERICA",
    };
    const key = (v) => aliases[norm(v)] || norm(v);
    const rowMap = new Map(),
      features = [],
      missing = [];
    for (const row of p.d) {
      const name = key(row[p.I.country]);
      const f = gj.features.find((f) =>
        [f.properties.NAME, f.properties.ISO2, f.properties.ISO3].some(
          (v) => key(v) === name,
        ),
      );
      if (f) {
        features.push(f);
        rowMap.set(norm(f.properties.NAME), row);
      } else missing.push(row[p.I.country]);
    }
    if (!features.length)
      throw Error(
        "No countries matched. Use country names or two- or three-letter country codes.",
      );
    return {
      kind: "area",
      p,
      gj: { type: "FeatureCollection", features },
      rowMap,
      field: "NAME",
      ni: p.I.country,
      missing,
    };
  }

  if (p.geo === "address") {
    const result = await geocodeRows(p, p.I.address);
    if (result) return result;
    throw Error(
      "No confident address matches were found. Include the street number, town, postcode and country, or use Latitude and Longitude columns.",
    );
  }
  // A table may contain ward boundaries and postcode pins. Resolve both sets;
  // neither a postcode column nor blank ward cells should discard the other.
  if (["ward", "council"].includes(p.geo) && p.I.postcode >= 0) {
    const ni =
      p.geo === "ward"
        ? p.I.wardcode >= 0
          ? p.I.wardcode
          : p.I.ward
        : p.I.councilcode >= 0
          ? p.I.councilcode
          : p.I.council;
    const areaRows = p.d.filter(
      (r) => clean(r[ni]) && (p.geo === "ward" || !clean(r[p.I.postcode])),
    );
    const pinRows = p.d.filter((r) => clean(r[p.I.postcode]));
    if (pinRows.length) {
      const [areaResult, pinResult] = await Promise.allSettled([
        areaRows.length
          ? fetchArea({ ...p, d: areaRows }, p.geo, ni)
          : Promise.resolve(null),
        prepare({ ...p, geo: "postcode", d: pinRows }),
      ]);
      const area = areaResult.status === "fulfilled" ? areaResult.value : null;
      const points = pinResult.status === "fulfilled" ? pinResult.value : null;
      if (!area && !points)
        throw Error("No ward boundaries or postcode pins could be resolved.");
      const result = area || points;
      result.missing = [...(area?.missing || [])];
      if (areaRows.length && !area)
        result.missing.push(...areaRows.map((r) => clean(r[ni])));
      result.missing.push(
        ...pinRows
          .filter((r) => !points?.coords.some((x) => x.r === r))
          .map((r) => clean(r[p.I.postcode])),
      );
      if (area && points) area.points = points;
      return result;
    }
  }
  if (p.geo === "ward") {
    let ni = p.I.wardcode >= 0 ? p.I.wardcode : p.I.ward,
      a = await fetchArea(p, "ward", ni);
    if (a) return a;
  }
  if (p.geo === "council") {
    let ni = p.I.councilcode >= 0 ? p.I.councilcode : p.I.council,
      a = await fetchArea(p, "council", ni);
    if (a) return a;
  }
  if (p.geo === "location") {
    let ni = p.I.neighbourhood >= 0 ? p.I.neighbourhood : p.I.location,
      a =
        (await fetchArea(p, "council", ni)) || (await fetchArea(p, "ward", ni));
    if (a) return a;
    let g = await geocodeRows(p, ni);
    if (g) return g;
  }
  let coords = [];
  if (p.geo === "postcode") {
    let pcs = [
        ...new Set(p.d.map((r) => clean(r[p.I.postcode])).filter(Boolean)),
      ],
      look = new Map();
    for (let i = 0; i < pcs.length; i += 100) {
      let z = await fetchJSONResponse("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: pcs.slice(i, i + 100) }),
      }).then((x) => x.json());
      (z.result || []).forEach(
        (x) => x.result && look.set(norm(x.query), x.result),
      );
    }
    p.d.forEach((r) => {
      let z = look.get(norm(r[p.I.postcode]));
      if (z) coords.push({ r, lat: z.latitude, lon: z.longitude });
    });
  } else if (p.geo === "coords")
    p.d.forEach((r) => {
      let lat = num(r[p.I.lat]),
        lon = num(r[p.I.lon]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      )
        coords.push({ r, lat, lon });
    });
  if (!coords.length)
    throw Error(
      "No valid locations were found. Check the area names or add a Council column to remove ambiguity.",
    );
  return { kind: "points", p, coords };
}
async function build() {
  const request = ++buildVersion;
  clear();
  current = null;
  status("");
  let p = parse();
  if (!p) {
    if (M.some((r) => r.some(clean)))
      status("Choose geography columns or use a sample table.");
    return;
  }
  status("Building visualisation…");
  try {
    const prepared = await prepare(p);
    if (request !== buildVersion) return;
    current = prepared;
    boundaryMode = "fill";
    updateColourControls(p);
    syncControls();
    map.invalidateSize(false);
    render();
    const missing = current.missing || [];
    const skipped = current.missing?.length
      ? current.missing.length
      : current.kind === "points"
        ? p.d.length - current.coords.length
        : missing.length;
    status(
      skipped
        ? skipped +
            " row(s) could not be matched" +
            (missing.length
              ? ": " + missing.join(", ")
              : ". Check coordinates or locations.")
        : "",
    );
  } catch (e) {
    if (request === buildVersion) status(e.message);
  }
}
function render() {
  if (!current) return;
  clear();
  setMapMode();
  updateRelevantControls();
  let z =
    current.kind === "area" ? renderAreaSet(current) : renderPointSet(current);
  if (current.points) {
    const pins = renderPointSet(current.points);
    z.items.push(...pins.items);
    z.bounds.extend(pins.bounds);
    z.legend.push(
      ...pins.legend.map((item) => ({ ...item, n: "Pins · " + item.n })),
    );
  }
  renderedItems = z.items;
  currentBounds = z.bounds;
  if (z.bounds?.isValid?.()) {
    map.fitBounds(z.bounds.pad(0.04), { animate: false });
    baseZoom = map.getZoom();
    applyScale();
  }
  if (mapMode === "partial" && current.kind === "area") addMask(current.gj);
  const drawn = current;
  setTimeout(() => {
    if (current === drawn) applyLabels(renderedItems);
  }, 40);
  legend(z.legend);
  $("#empty").style.display = "none";
  $("#download").disabled = false;
}
function renderAreaSet(area) {
  let { p, gj, rowMap, field } = area,
    recs = [];
  gj.features.forEach((f) => {
    let r = rowMap.get(norm(f.properties[field]));
    if (r)
      recs.push({
        f,
        r,
        name:
          clean(
            r[
              p.I.label >= 0
                ? p.I.label
                : p.I.ward >= 0
                  ? p.I.ward
                  : p.I.council >= 0
                    ? p.I.council
                    : p.I.neighbourhood >= 0
                      ? p.I.neighbourhood
                      : p.I.location
            ],
          ) || f.properties[field],
        meta: meta(p, r),
      });
  });
  let mode = activeColourMode(p),
    valueIndex = colourField >= 0 ? colourField : p.I.value,
    catIndex =
      activeColourMode(p) === "category"
        ? colourField
        : categoryField >= 0
          ? categoryField
          : p.I.category;
  recs.forEach((d) => {
    d.value = valueIndex >= 0 ? num(d.r[valueIndex]) : NaN;
    d.category = catIndex >= 0 ? clean(d.r[catIndex]) : "";
    d.dataColour = p.I.colour >= 0 ? hex(d.r[p.I.colour]) : "";
  });
  let vals = recs.map((x) => x.value).filter(Number.isFinite),
    lo = vals.length ? Math.min(...vals) : 0,
    hi = vals.length ? Math.max(...vals) : 1,
    base = getColour("gradientHigh", "#5653FF"),
    low = getColour("gradientLow", "#EEF0FF"),
    cats = [...new Set(recs.map((x) => x.category).filter(Boolean))];
  cats.forEach((c, i) => getColour("cat:" + c, palette[i % palette.length]));
  let colourFor = (d) => {
      if (mode === "data" && d.dataColour) return d.dataColour;
      if (mode === "category" && d.category)
        return colours["cat:" + d.category];
      if (mode === "gradient" && Number.isFinite(d.value)) {
        let t = hi === lo ? 0.5 : (d.value - lo) / (hi - lo);
        return mix(low, base, t);
      }
      return getColour("area", "#5653FF");
    },
    items = [],
    fillOpacity = +$("#opacity").value / 100,
    collection = { type: "FeatureCollection", features: recs.map((x) => x.f) };
  let layer = L.geoJSON(collection, {
    style: (f) => {
      let d = recs.find((x) => x.f === f),
        c = colourFor(d);
      return {
        color: getColour("outline", "#ffffff"),
        weight: 4,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        fillColor: c,
        fillOpacity,
      };
    },
    onEachFeature: (f, l) => {
      let d = recs.find((x) => x.f === f);
      l.on({
        mouseover: () => hoverOn(l, d),
        mousemove: hoverMove,
        mouseout: hoverOff,
      });
      l.once("add", () => {
        let z = l.getBounds(),
          nw = map.latLngToContainerPoint(z.getNorthWest()),
          se = map.latLngToContainerPoint(z.getSouthEast());
        items.push({
          latlng: visualCentre(f) || z.getCenter(),
          data: d,
          width: Math.abs(se.x - nw.x),
          feature: f,
          kind: "area",
        });
      });
    },
  }).addTo(map);
  layers.push(layer);
  let lg;
  if (mode === "data")
    lg = [
      ...new Map(
        recs
          .filter((d) => d.dataColour)
          .map((d) => [
            d.dataColour,
            { n: d.dataColour, c: d.dataColour, key: "data:" + d.dataColour },
          ]),
      ).values(),
    ];
  else if (mode === "category")
    lg = cats.map((c) => ({ n: c, c: colours["cat:" + c], key: "cat:" + c }));
  else if (mode === "gradient")
    lg = [
      { n: "Low · " + lo.toLocaleString(), c: low, key: "gradientLow" },
      { n: "High · " + hi.toLocaleString(), c: base, key: "gradientHigh" },
    ];
  else lg = [{ n: "Areas", c: getColour("area", "#5653FF"), key: "area" }];
  return { items, bounds: layer.getBounds(), legend: lg };
}
function pinIcon(style, c, size) {
  let s = style === "diamond" ? size / Math.SQRT2 : size;
  if (style === "marker") {
    let html = `<svg class="pinMarkerSvg" width="22" height="28" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 1.5C6.7 1.5 1.5 6.8 1.5 14c0 9.1 12.5 20.4 12.5 20.4S26.5 23.1 26.5 14C26.5 6.8 21.3 1.5 14 1.5Z" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="14" cy="13.5" r="4" fill="#fff"/></svg>`;
    return L.divIcon({
      className: "pinDiv",
      html,
      iconSize: [22, 28],
      iconAnchor: [11, 26],
    });
  }
  let cls =
      {
        dot: "pinDot",
        bubble: "pinDot",
        ring: "pinRing",
        square: "pinSquare",
        diamond: "pinDiamond",
      }[style] || "",
    html = `<span class="${cls}" style="--c:${c};width:${s}px;height:${s}px;min-width:${s}px;min-height:${s}px;max-width:${s}px;max-height:${s}px"></span>`,
    box = Math.max(30, Math.ceil(s + 10));
  return L.divIcon({
    className: "pinDiv",
    html,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}
function renderPointSet(points) {
  const { p, coords } = points,
    mode = activeColourMode(p),
    group = L.featureGroup().addTo(map),
    items = [],
    field = colourField,
    vals = coords.map((x) => num(x.r[field])).filter(Number.isFinite),
    low = vals.length ? Math.min(...vals) : 0,
    high = vals.length ? Math.max(...vals) : 1,
    max = Math.max(
      1,
      ...coords.map((x) => num(x.r[p.I.value])).filter(Number.isFinite),
    ),
    lowColour = getColour("pinGradientLow", "#EEF0FF"),
    highColour = getColour("pinGradientHigh", "#5653FF"),
    categories = [
      ...new Set(coords.map((x) => clean(x.r[field]) || "Locations")),
    ];
  categories.forEach((c, i) =>
    getColour("pin:" + c, palette[i % palette.length]),
  );
  coords.forEach((x) => {
    const r = x.r,
      value = p.I.value >= 0 ? num(r[p.I.value]) : NaN,
      name = rowName(p, r),
      cv = num(r[field]),
      category = clean(r[field]) || "Locations",
      c =
        mode === "gradient" && Number.isFinite(cv)
          ? mix(
              lowColour,
              highColour,
              high === low ? 0.5 : (cv - low) / (high - low),
            )
          : mode === "data"
            ? hex(r[field]) || "#5653FF"
            : mode === "category"
              ? colours["pin:" + category]
              : getColour("pin", "#5653FF"),
      d = {
        name,
        value,
        category,
        meta: {
          ...meta(p, r),
          ...(x.matchedAddress
            ? {
                "Matched address": x.matchedAddress,
                "Match confidence": x.matchScore,
              }
            : {}),
        },
      },
      size =
        pinStyle === "bubble" && Number.isFinite(value)
          ? Math.max(12, Math.sqrt(Math.max(0, value) / max) * 28)
          : 20,
      marker = L.marker([x.lat, x.lon], {
        title: name,
        alt: name,
        icon: pinIcon(pinStyle, c, size),
        opacity: 1,
      }).addTo(group);
    marker.on({
      mouseover: () => hoverOn(marker, d),
      mousemove: hoverMove,
      mouseout: hoverOff,
    });
    const element = marker.getElement();
    element.setAttribute(
      "aria-label",
      name + (Number.isFinite(value) ? ": " + value : ""),
    );
    element.onfocus = () => {
      $("#tip").innerHTML = tipHtml(d);
      $("#tip").style.opacity = 1;
      $("#tip").style.left = "16px";
      $("#tip").style.top = "16px";
    };
    element.onblur = hoverOff;
    items.push({
      latlng: L.latLng(x.lat, x.lon),
      data: d,
      width: 100,
      kind: "point",
    });
  });
  layers.push(group);
  const legend =
    mode === "gradient"
      ? [
          { n: "Low · " + low, c: lowColour, key: "pinGradientLow" },
          { n: "High · " + high, c: highColour, key: "pinGradientHigh" },
        ]
      : mode === "category"
        ? categories.map((c) => ({
            n: c,
            c: colours["pin:" + c],
            key: "pin:" + c,
          }))
        : mode === "data"
          ? []
          : [{ n: "Locations", c: getColour("pin", "#5653FF"), key: "pin" }];
  return { items, bounds: group.getBounds(), legend };
}
function applyScale() {
  let delta = (+$("#scale").value - 100) / 45;
  map.setZoom(
    Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), baseZoom + delta)),
    { animate: false },
  );
  $("#scaleV").textContent = $("#scale").value + "%";
}
function fileBase() {
  return ($("#title").value || "map visualisation").replace(
    /[\\/:*?"<>|]+/g,
    "-",
  );
}
function dl(blob, name) {
  let u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function waitMap() {
  map.invalidateSize(false);
  await new Promise((r) => setTimeout(r, 350));
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  applyLabels(renderedItems);
  await new Promise((r) => setTimeout(r, 120));
}
async function exportCanvas() {
  await waitMap();
  const svg = mapVectorSVG(await basemapImage());
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width * 2;
        canvas.height = image.height * 2;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      image.onerror = () =>
        reject(Error("The map image could not be prepared. Please try SVG."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function interactiveHtml() {
  const root = document.documentElement.cloneNode(true);
  root.dataset.export = "readonly";
  root.querySelector("#map").innerHTML = "";
  root.querySelector("#map").className = "map";
  root.querySelector("#legend").innerHTML = "";
  root.querySelector("#tip").textContent = "";
  root.querySelector("#tip").style.opacity = 0;
  root.querySelector("#status").textContent = "";
  root.querySelector("#status").className = "status";
  root.querySelector("#title").setAttribute("value", $("#title").value);
  root.querySelector(".downloadWrap").style.display = "none";
  root.querySelector(".toolbar").style.display = "none";
  root.querySelector("#title").setAttribute("readonly", "");
  root.querySelector("#title").removeAttribute("placeholder");
  root
    .querySelectorAll(".sr-only,.title-editor::after")
    .forEach((n) => n.remove());
  const exportStyle = document.createElement("style");
  exportStyle.textContent =
    ".toolbar,.downloadWrap,.colourPop,.title-editor::after{display:none!important}.title{border:0!important;outline:none!important;pointer-events:none}.legend .swatch{pointer-events:none;cursor:default}";
  root.querySelector("head").append(exportStyle);
  root.querySelectorAll(".chart-summary").forEach((n) => n.remove());
  for (const link of [...root.querySelectorAll('link[rel="stylesheet"]')]) {
    if (
      new URL(link.getAttribute("href"), location.href).origin ===
      location.origin
    ) {
      const style = document.createElement("style");
      style.textContent = await fetch(
        new URL(link.getAttribute("href"), location.href),
      ).then((r) => r.text());
      link.replaceWith(style);
    }
  }
  for (const script of [...root.querySelectorAll("script[src]")]) {
    const url = new URL(script.getAttribute("src"), location.href);
    if (url.origin === location.origin) {
      const source = await fetch(url).then((r) => r.text());
      script.removeAttribute("src");
      script.textContent = source.replace(/<\/script/gi, "<\\/script");
    }
  }
  const payload = JSON.stringify({
    data: M,
    current: {
      ...current,
      rowMap: current.rowMap ? [...current.rowMap] : null,
    },
    settings: chartSettings.get(),
    controls: Object.fromEntries(
      [...document.querySelectorAll("input[id]")].map((e) => [e.id, e.value]),
    ),
  }).replace(/</g, "\\u003c");
  const boot = document.createElement("script");
  boot.textContent =
    'addEventListener("load",()=>{const saved=' +
    payload +
    ";M=saved.data;current=saved.current;if(current.rowMap)current.rowMap=new Map(current.rowMap);current.p=parse();chartSettings.set(saved.settings);for(const [id,v] of Object.entries(saved.controls)){const e=document.getElementById(id);if(e)e.value=v}updateColourControls(current.p);syncControls();render();});";
  root.querySelector("body").append(boot);
  return "<!doctype html>" + root.outerHTML;
}
async function download(type) {
  try {
    status("Preparing download…");
    if (type === "html")
      dl(
        new Blob([await interactiveHtml()], { type: "text/html" }),
        fileBase() + ".html",
      );
    else if (type === "svg")
      dl(
        new Blob([mapVectorSVG(await basemapImage())], {
          type: "image/svg+xml",
        }),
        fileBase() + ".svg",
      );
    else {
      const c = await exportCanvas();
      await new Promise((resolve, reject) =>
        c.toBlob((b) => {
          if (!b) {
            reject(Error("PNG conversion failed"));
            return;
          }
          dl(b, fileBase() + ".png");
          resolve();
        }, "image/png"),
      );
    }
    status("");
  } catch (e) {
    status("Download failed: " + e.message);
  }
}
function mapVectorSVG(basemap = "") {
  const bounds = document.querySelector("#map").getBoundingClientRect(),
    W = bounds.width,
    H = bounds.height,
    parts = [];
  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      W +
      '" height="' +
      (H + 125) +
      '" viewBox="0 0 ' +
      W +
      " " +
      (H + 125) +
      '"><rect width="100%" height="100%" fill="white"/><text x="20" y="28" font-family="system-ui" font-size="20" font-weight="700">' +
      esc($("#title").value) +
      '</text><defs><clipPath id="mapclip"><rect width="' +
      W +
      '" height="' +
      H +
      '"/></clipPath></defs><g transform="translate(0,80)" clip-path="url(#mapclip)">',
  );
  let keyX = 20;
  const key = [];
  document.querySelectorAll("#legend label").forEach((n) => {
    const colour = getComputedStyle(n.querySelector(".swatch")).backgroundColor;
    const name = n.textContent.trim();
    key.push(
      '<rect x="' +
        keyX +
        '" y="45" width="12" height="12" rx="3" fill="' +
        colour +
        '"/><text x="' +
        (keyX + 19) +
        '" y="55" font-family="Inter,Segoe UI,sans-serif" font-size="11" fill="#59636e">' +
        esc(name) +
        "</text>",
    );
    keyX += name.length * 6 + 42;
  });
  parts.push(
    "</g>" +
      key.join("") +
      '<g transform="translate(0,80)" clip-path="url(#mapclip)">',
  );
  if (basemap)
    parts.push(
      '<g id="basemap"><image width="' +
        W +
        '" height="' +
        H +
        '" href="' +
        basemap +
        '"/></g>',
    );
  parts.push('<g id="features">');
  document
    .querySelectorAll(".leaflet-overlay-pane svg path")
    .forEach((node) => {
      const c = node.cloneNode(true),
        m = node.getScreenCTM();
      if (!m) return;
      c.removeAttribute("class");
      c.removeAttribute("tabindex");
      c.setAttribute(
        "transform",
        "matrix(" +
          [m.a, m.b, m.c, m.d, m.e - bounds.left, m.f - bounds.top].join(" ") +
          ")",
      );
      for (const k of [
        "fill",
        "stroke",
        "stroke-width",
        "fill-opacity",
        "stroke-opacity",
      ])
        c.setAttribute(k, getComputedStyle(node).getPropertyValue(k));
      parts.push(new XMLSerializer().serializeToString(c));
    });
  document.querySelectorAll(".pinDiv").forEach((node) => {
    const r = node.getBoundingClientRect(),
      x = r.left - bounds.left + r.width / 2,
      y = r.top - bounds.top + r.height / 2,
      shape = node.querySelector("span"),
      svg = node.querySelector("svg");
    if (svg) {
      const clone = svg.cloneNode(true);
      clone.setAttribute("x", r.left - bounds.left);
      clone.setAttribute("y", r.top - bounds.top);
      parts.push(clone.outerHTML);
    } else if (shape) {
      const sr = shape.getBoundingClientRect(),
        color =
          getComputedStyle(shape).getPropertyValue("--c").trim() || "#5653ff";
      if (
        shape.classList.contains("pinSquare") ||
        shape.classList.contains("pinDiamond")
      )
        parts.push(
          '<rect x="' +
            (x - sr.width / 2) +
            '" y="' +
            (y - sr.height / 2) +
            '" width="' +
            sr.width +
            '" height="' +
            sr.height +
            '" fill="' +
            esc(color) +
            '" stroke="white"/>',
        );
      else
        parts.push(
          '<circle cx="' +
            x +
            '" cy="' +
            y +
            '" r="' +
            sr.width / 2 +
            '" fill="' +
            (shape.classList.contains("pinRing") ? "white" : esc(color)) +
            '" stroke="' +
            (shape.classList.contains("pinRing") ? esc(color) : "white") +
            '" stroke-width="2"/>',
        );
    }
  });
  parts.push('</g><g id="labels">');
  document.querySelectorAll(".mapLabel .main,.mapLabel .sub").forEach((n) => {
    const style = getComputedStyle(n),
      box = n.getBoundingClientRect(),
      align = style.textAlign;
    const text = n.firstChild;
    if (!text || text.nodeType !== 3) return;
    const lines = [];
    for (let i = 0; i < text.length; i++) {
      const range = document.createRange();
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getBoundingClientRect();
      let line = lines.find((l) => Math.abs(l.y - rect.top) < 2);
      if (!line) {
        line = { y: rect.top, text: "" };
        lines.push(line);
      }
      line.text += text.data[i];
    }
    const anchor =
        align === "right" ? "end" : align === "center" ? "middle" : "start",
      x =
        align === "right"
          ? box.right
          : align === "center"
            ? box.left + box.width / 2
            : box.left;
    lines.forEach((line) =>
      parts.push(
        '<text x="' +
          (x - bounds.left) +
          '" y="' +
          (line.y - bounds.top + parseFloat(style.fontSize) * 0.85) +
          '" text-anchor="' +
          anchor +
          '" font-family="' +
          esc(style.fontFamily) +
          '" font-size="' +
          style.fontSize +
          '" font-weight="' +
          style.fontWeight +
          '" fill="' +
          style.color +
          '">' +
          esc(line.text.trim()) +
          "</text>",
      ),
    );
  });
  parts.push("</g>");
  parts.push(
    '</g><text x="16" y="' +
      (H + 108) +
      '" font-family="system-ui" font-size="11">Geographic data: Esri / ONS / Postcodes.io / Natural Earth.</text></svg>',
  );
  return parts.join("");
}
const cycle = (btn, states, fn) => {
  $(btn).onclick = () => {
    let i = states.findIndex((x) => x[0] === fn());
    let n = states[(i + 1) % states.length];
    n[2]();
    $(btn).textContent = n[1];
  };
};
cycle(
  "#mapModeBtn",
  [
    [
      "none",
      "No map",
      () => {
        mapMode = "none";
        render();
      },
    ],
    [
      "partial",
      "Partial map",
      () => {
        mapMode = "partial";
        render();
      },
    ],
    [
      "full",
      "Full map",
      () => {
        mapMode = "full";
        render();
      },
    ],
  ],
  () => mapMode,
);
cycle(
  "#labelBtn",
  [
    [
      "none",
      "No labels",
      () => {
        labelMode = "none";
        render();
      },
    ],
    [
      "inside",
      "Labels inside",
      () => {
        labelMode = "inside";
        render();
      },
    ],
    [
      "outside",
      "Labels outside",
      () => {
        labelMode = "outside";
        render();
      },
    ],
  ],
  () => labelMode,
);
$("#colourByBtn").onclick = (e) => {
  e.stopPropagation();
  $("#colourByMenu").classList.toggle("open");
};
$("#pinBtn").onclick = (e) => {
  e.stopPropagation();
  $("#pinMenu").classList.toggle("open");
};
$("#download").onclick = (e) => {
  e.stopPropagation();
  $("#downloadMenu").classList.toggle("open");
};
$$("[data-pin]").forEach(
  (x) =>
    (x.onclick = () => {
      pinStyle = x.dataset.pin;
      $("#pinBtn").innerHTML =
        `Pins: ${x.textContent.trim()} <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 4.5 3 3 3-3"/></svg>`;
      $$("[data-pin]").forEach((y) => y.classList.toggle("active", y === x));
      $("#pinMenu").classList.remove("open");
      render();
    }),
);
$("#valuesBtn").onclick = () => {
  showValues = !showValues;
  $("#valuesBtn").classList.toggle("active", showValues);
  render();
};
$("#detailsBtn").onclick = () => {
  showDetails = !showDetails;
  $("#detailsBtn").classList.toggle("active", showDetails);
  render();
};
$("#scale").oninput = () => applyScale();
$("#opacity").oninput = () => {
  $("#opacityV").textContent = $("#opacity").value + "%";
  if (current?.kind === "area" && boundaryMode !== "outline") render();
};
$("#mapOpacity").oninput = () => applyMapOpacity();
$$("[data-download]").forEach(
  (x) =>
    (x.onclick = () => {
      download(x.dataset.download);
      $("#downloadMenu").classList.remove("open");
    }),
);
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".menuWrap"))
    $$(".menu").forEach((x) => x.classList.remove("open"));
  if (!e.target.closest("#colourPop") && !e.target.closest(".swatch"))
    $("#colourPop").classList.remove("open");
});
function applyColour(v) {
  if (/^#[0-9a-f]{6}$/i.test(v) && colourTarget) {
    colours[colourTarget] = v.toUpperCase();
    render();
  }
}
$("#hex").oninput = () => applyColour($("#hex").value);
$("#nativeColour").oninput = () => {
  $("#hex").value = $("#nativeColour").value.toUpperCase();
  applyColour($("#nativeColour").value);
};
window.chartBridge = {
  setData(x) {
    M = (x || []).map((r) => r.slice());
    build();
  },
  resetAll() {
    buildVersion++;
    M = [[]];
    current = null;
    clear();
    status("");
  },
};

let buildVersion = 0;
const requestCache = new Map();
async function fetchJSONResponse(url, options) {
  const key = url + JSON.stringify(options || {});
  if (!requestCache.has(key)) {
    const promise = fetch(url, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      ...options,
      signal: AbortSignal.timeout(20000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Geography service returned " + response.status);
        const data = await response.json();
        if (data.error)
          throw Error(data.error.message || "Geography service error");
        return data;
      })
      .catch((error) => {
        requestCache.delete(key);
        throw error;
      });
    requestCache.set(key, promise);
    if (requestCache.size > 250)
      requestCache.delete(requestCache.keys().next().value);
  }
  const data = await requestCache.get(key);
  return { json: async () => structuredClone(data) };
}
function syncControls() {
  $("#outlineColour").value = getColour("outline", "#ffffff");
  $("#labelColour").value = getColour("labels", "#17212b");
  $("#themeBtn").textContent = "Dark map";
  $("#themeBtn").classList.toggle("active", darkMap);
  $("#themeBtn").setAttribute("aria-pressed", String(darkMap));
  $("#mapModeBtn").textContent = {
    none: "No map",
    partial: "Partial map",
    full: "Full map",
  }[mapMode];
  $("#labelBtn").textContent = {
    none: "No labels",
    inside: "Labels inside",
    outside: "Labels outside",
  }[labelMode];
  $("#pinBtn").textContent =
    "Pins: " +
    {
      dot: "Dots",
      bubble: "Bubbles",
      marker: "Map pins",
      ring: "Rings",
      square: "Squares",
      diamond: "Diamonds",
    }[pinStyle];
  $("#valuesBtn").classList.toggle("active", showValues);
  $("#detailsBtn").classList.toggle("active", showDetails);
}
[
  ["outlineColour", "outline"],
  ["labelColour", "labels"],
].forEach(([id, key]) => {
  $("#" + id).oninput = (e) => {
    colours[key] = e.target.value;
    if (current) render();
  };
});
$("#themeBtn").onclick = () => {
  darkMap = !darkMap;
  setMapMode();
  syncControls();
};
syncControls();
new ResizeObserver(() => {
  map.invalidateSize(false);
  if (current) applyLabels(renderedItems);
}).observe(document.querySelector("#map"));
map.on("moveend", () => {
  if (current) applyLabels(renderedItems);
});

window.chartSettings = {
  get() {
    return structuredClone({
      darkMap: darkMap,
      mapMode: mapMode,
      pinStyle: pinStyle,
      labelMode: labelMode,
      showValues: showValues,
      showDetails: showDetails,
      colourMode: colourMode,
      colourField: colourField,
      categoryField: categoryField,
      colours: colours,
    });
  },
  set(s) {
    if (!s || typeof s !== "object") return;
    if (typeof s.darkMap === "boolean") darkMap = s.darkMap;
    if (
      typeof s.mapMode === typeof mapMode &&
      (typeof s.mapMode !== "number" || Number.isFinite(s.mapMode))
    )
      mapMode = s.mapMode;
    if (
      typeof s.pinStyle === typeof pinStyle &&
      (typeof s.pinStyle !== "number" || Number.isFinite(s.pinStyle))
    )
      pinStyle = s.pinStyle;
    if (
      typeof s.labelMode === typeof labelMode &&
      (typeof s.labelMode !== "number" || Number.isFinite(s.labelMode))
    )
      labelMode = s.labelMode;
    if (
      typeof s.showValues === typeof showValues &&
      (typeof s.showValues !== "number" || Number.isFinite(s.showValues))
    )
      showValues = s.showValues;
    if (
      typeof s.showDetails === typeof showDetails &&
      (typeof s.showDetails !== "number" || Number.isFinite(s.showDetails))
    )
      showDetails = s.showDetails;
    if (
      typeof s.colourMode === typeof colourMode &&
      (typeof s.colourMode !== "number" || Number.isFinite(s.colourMode))
    )
      colourMode = s.colourMode;
    if (
      typeof s.colourField === typeof colourField &&
      (typeof s.colourField !== "number" || Number.isFinite(s.colourField))
    )
      colourField = s.colourField;
    if (
      typeof s.categoryField === typeof categoryField &&
      (typeof s.categoryField !== "number" || Number.isFinite(s.categoryField))
    )
      categoryField = s.categoryField;
    if (s.colours && typeof s.colours === "object") {
      Object.keys(colours).forEach((k) => delete colours[k]);
      for (const [k, v] of Object.entries(s.colours))
        if (/^#[0-9a-f]{6}$/i.test(v)) colours[k] = v;
    }
  },
  rebuild() {
    try {
      if (current) {
        syncControls();
        render();
      }
    } catch (e) {
      const node = document.querySelector("#status");
      node.textContent = e.message;
      node.className = "status error";
    }
  },
  reset() {
    M = [[]];
    buildVersion++;
    current = null;
    clear();
  },
  sync() {
    window.refreshOrderControls?.();
    syncControls();
  },
};

window.chartBridge = {
  setData(rows) {
    hoverOff();
    $("#tip").textContent = "";
    M = (rows || []).map((r) => r.slice());
    try {
      build();
    } catch (error) {
      document.querySelector("#status").textContent = error.message;
      document.querySelector("#status").className = "status error";
      clear();
    }
  },
  resetAll() {
    chartSettings.reset();
  },
};

async function basemapImage() {
  if (mapMode === "none") return "";
  const element = $("#map"),
    bounds = element.getBoundingClientRect(),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bounds.width);
  canvas.height = Math.round(bounds.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = darkMap ? "#171c24" : "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = +$("#mapOpacity").value / 100;
  if (darkMap) ctx.filter = "grayscale(1) contrast(2) brightness(1.3)";
  const tiles = [...element.querySelectorAll(".leaflet-tile-pane img")];
  await Promise.all(
    tiles
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 4000);
          }),
      ),
  );
  for (const img of tiles) {
    if (!img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    ctx.drawImage(
      img,
      r.left - bounds.left,
      r.top - bounds.top,
      r.width,
      r.height,
    );
  }
  return canvas.toDataURL("image/png");
}
