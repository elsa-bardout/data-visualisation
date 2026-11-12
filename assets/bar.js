"use strict";
let M = [Array(6).fill("")],
  timer = null,
  periods = [],
  activePeriod = 0,
  orderMode = 0,
  manualOrder = [],
  model = null,
  orientation = "vertical",
  showValues = true,
  selectionAnchor = null,
  selectionFocus = null,
  selecting = false;
const $ = (s) => document.querySelector(s),
  S = d3.select("#svg"),
  tip = d3.select("#tip");
const PALETTE = [
    "#5653FF",
    "#00B188",
    "#F8CA1C",
    "#F56DAB",
    "#FA9C28",
    "#EF431B",
    "#844AFF",
    "#2B82C4",
    "#3EB86D",
    "#F57022",
    "#B240FF",
    "#7CBE52",
    "#FF5C67",
    "#F9B322",
    "#BAC437",
  ],
  SINGLE_GRADIENT = PALETTE,
  C = Object.create(null);
const clean = (v) => String(v ?? "").trim(),
  norm = (v) =>
    clean(v)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""),
  num = ChartUtils.number;
const A = {
  category: [
    "CATEGORY",
    "NAME",
    "LABEL",
    "ITEM",
    "SERVICE",
    "GROUP",
    "TYPE",
    "BAR",
    "OUTCOME",
  ],
  value: [
    "VALUE",
    "AMOUNT",
    "COUNT",
    "TOTAL",
    "NUMBER",
    "VOLUME",
    "FREQUENCY",
    "SCORE",
    "PERCENT",
    "PERCENTAGE",
  ],
  series: [
    "SERIES",
    "SEGMENT",
    "STACK",
    "SUBCATEGORY",
    "MEASURE",
    "COHORT",
    "BREAKDOWN",
  ],
  period: ["PERIOD", "DATE", "MONTH", "QUARTER", "YEAR", "WEEK", "TIME"],
  colour: ["COLOUR", "COLOR", "HEX"],
};
const idx = (h, a) => h.findIndex((x) => a.includes(norm(x)));
function status(msg, type = "error") {
  let e = $("#status");
  e.textContent = msg;
  e.className = "status " + type;
}
function clearStatus() {
  let e = $("#status");
  e.textContent = "";
  e.className = "status";
}
function selectionBounds() {
  if (!selectionAnchor || !selectionFocus) return null;
  return {
    r1: Math.min(selectionAnchor.r, selectionFocus.r),
    r2: Math.max(selectionAnchor.r, selectionFocus.r),
    c1: Math.min(selectionAnchor.c, selectionFocus.c),
    c2: Math.max(selectionAnchor.c, selectionFocus.c),
  };
}
function paintSelection() {
  let b = selectionBounds();
  document.querySelectorAll("#grid td[data-r]").forEach((td) => {
    let r = +td.dataset.r,
      c = +td.dataset.c;
    td.classList.toggle(
      "cellSelected",
      !!b && r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2,
    );
  });
}
function startSelection(e) {
  if (e.button !== 0) return;
  if (e.shiftKey && selectionAnchor)
    selectionFocus = { r: +this.dataset.r, c: +this.dataset.c };
  else
    selectionAnchor = selectionFocus = {
      r: +this.dataset.r,
      c: +this.dataset.c,
    };
  selecting = true;
  paintSelection();
}
function extendSelection() {
  if (selecting) {
    selectionFocus = { r: +this.dataset.r, c: +this.dataset.c };
    paintSelection();
  }
}
function clearSelectedCells() {
  let b = selectionBounds();
  if (!b) return false;
  for (let r = b.r1; r <= b.r2; r++) {
    while (M.length <= r) M.push([]);
    for (let c = b.c1; c <= b.c2; c++) M[r][c] = "";
  }
  selectionAnchor = selectionFocus = null;
  grid();
  refresh(0);
  return true;
}
function grid() {}
function paste(e) {
  e.preventDefault();
  let sr = +e.currentTarget.dataset.r,
    sc = +e.currentTarget.dataset.c,
    a = e.clipboardData
      .getData("text/plain")
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((r) => r.split("\t")),
    nc = sc + Math.max(...a.map((r) => r.length));
  while (M.length < sr + a.length) M.push([]);
  M.forEach((r) => {
    while (r.length < nc) r.push("");
  });
  a.forEach((r, i) => r.forEach((v, j) => (M[sr + i][sc + j] = v)));
  grid();
  refresh(0);
}
function refresh(ms = 100) {
  clearTimeout(timer);
  timer = setTimeout(build, ms);
}
function rows() {
  return M.filter((r) => r.some(clean)).map((r) => {
    let z = [...r];
    while (z.length && !clean(z.at(-1))) z.pop();
    return z;
  });
}
function looksHeader(r) {
  return (
    r.some((x) => Object.values(A).flat().includes(norm(x))) ||
    r.filter((x) => Number.isFinite(num(x))).length < Math.max(1, r.length - 1)
  );
}
function parse() {
  let rr = rows();
  if (rr.length < 2) return null;
  let header = looksHeader(rr[0])
      ? rr[0]
      : rr[0].map((_, i) =>
          i === 0 ? "Category" : i === 1 ? "Value" : "Detail " + i,
        ),
    data = looksHeader(rr[0]) ? rr.slice(1) : rr;
  let ci = idx(header, A.category),
    vi = idx(header, A.value),
    si = idx(header, A.series),
    pi = idx(header, A.period),
    coli = idx(header, A.colour);
  if (ci < 0)
    ci = header.findIndex(
      (_, i) =>
        ![si, pi, coli].includes(i) &&
        data.some((r) => clean(r[i])) &&
        !data.some((r) => Number.isFinite(num(r[i]))),
    );
  if (ci < 0) ci = 0;
  if (vi < 0) {
    const numeric = header
      .map((_, i) => i)
      .filter(
        (i) =>
          ![ci, si, pi, coli].includes(i) &&
          data.some((r) => Number.isFinite(num(r[i]))),
      );
    if (numeric.length === 1) vi = numeric[0];
  }
  let points = [];
  if (vi >= 0) {
    for (const r of data) {
      let category = clean(r[ci]),
        value = num(r[vi]);
      if (!category || !Number.isFinite(value)) continue;
      let series =
          si >= 0
            ? clean(r[si]) || clean(header[vi])
            : clean(header[vi]) || "Value",
        period = pi >= 0 ? clean(r[pi]) || "All" : "All",
        colour = coli >= 0 ? clean(r[coli]) : "",
        meta = {};
      header.forEach((x, i) => {
        if (![ci, vi, si, pi, coli].includes(i) && clean(x) && clean(r[i]))
          meta[clean(x)] = clean(r[i]);
      });
      points.push({ category, series, value, period, colour, meta });
    }
  } else {
    let candidate = [];
    for (let j = 0; j < header.length; j++)
      if (
        j !== ci &&
        j !== pi &&
        j !== si &&
        j !== coli &&
        data.some((r) => Number.isFinite(num(r[j])))
      )
        candidate.push(j);
    if (!candidate.length) return null;
    if (pi >= 0) {
      for (const r of data)
        for (const j of candidate) {
          let value = num(r[j]),
            category = clean(r[ci]);
          if (category && Number.isFinite(value))
            points.push({
              category,
              series: clean(header[j]) || "Value",
              value,
              period: clean(r[pi]) || "All",
              colour: "",
              meta: {},
            });
        }
    } else if (candidate.length === 1) {
      let j = candidate[0];
      for (const r of data) {
        let category = clean(r[ci]),
          value = num(r[j]);
        if (category && Number.isFinite(value))
          points.push({
            category,
            series: clean(header[j]) || "Value",
            value,
            period: "All",
            colour: "",
            meta: Object.fromEntries(
              header
                .map((x, k) => [clean(x), clean(r[k])])
                .filter(([k, v], k2) => k && v && ![ci, j].includes(k2)),
            ),
          });
      }
    } else {
      let textualExtras = header
        .map((_, j) => j)
        .filter((j) => j !== ci && !candidate.includes(j) && j !== coli);
      let periodLike = candidate.every((j) =>
        /^(FY)?\d{2,4}|Q[1-4]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i.test(
          clean(header[j]),
        ),
      );
      if (periodLike) {
        for (const r of data)
          for (const j of candidate) {
            let category = clean(r[ci]),
              value = num(r[j]);
            if (category && Number.isFinite(value))
              points.push({
                category,
                series: "Value",
                value,
                period: clean(header[j]),
                colour: "",
                meta: Object.fromEntries(
                  textualExtras
                    .map((k) => [clean(header[k]), clean(r[k])])
                    .filter((x) => x[0] && x[1]),
                ),
              });
          }
      } else {
        for (const r of data)
          for (const j of candidate) {
            let category = clean(r[ci]),
              value = num(r[j]);
            if (category && Number.isFinite(value))
              points.push({
                category,
                series: clean(header[j]),
                value,
                period: "All",
                colour: "",
                meta: Object.fromEntries(
                  textualExtras
                    .map((k) => [clean(header[k]), clean(r[k])])
                    .filter((x) => x[0] && x[1]),
                ),
              });
          }
      }
    }
  }
  points.categoryLabel = clean(header[ci]);
  points.valueLabel = vi >= 0 ? clean(header[vi]) : "";
  return points.length ? points : null;
}
function build() {
  clearStatus();
  let pts = parse();
  if (!pts) {
    clear();
    if (rows().length)
      status(
        "I could not identify numeric values. Use category/value columns, long data with series or period, or a wide table with numeric columns.",
      );
    return;
  }
  periods = [...new Set(pts.map((d) => d.period))];
  activePeriod = Math.min(activePeriod, periods.length - 1);
  model = pts.filter((d) => d.period === periods[activePeriod]);
  model.categoryLabel = pts.categoryLabel;
  model.valueLabel = pts.valueLabel;
  model.forEach((d) => {
    if (d.colour && /^#[0-9A-F]{6}$/i.test(d.colour))
      C[d.series] = d.colour.toUpperCase();
    if (!C[d.series])
      C[d.series] = PALETTE[Object.keys(C).length % PALETTE.length];
  });
  $("#periodCtrl").style.display = periods.length > 1 ? "grid" : "none";
  $("#period").max = Math.max(0, periods.length - 1);
  $("#period").value = activePeriod;
  $("#periodLabel").textContent = periods[activePeriod];
  render();
}
function clear() {
  model = null;
  S.style("display", "none").selectAll("*").remove();
  $("#empty").style.display = "block";
  $("#legend").innerHTML = "";
  $("#share").disabled = $("#reorder").disabled = true;
}
function orderedCategories() {
  let cats = [...new Set(model.map((d) => d.category))],
    tot = new Map(
      cats.map((c) => [
        c,
        d3.sum(
          model.filter((d) => d.category === c),
          (d) => d.value,
        ),
      ]),
    );
  if (manualOrder.length) {
    let pos = new Map(manualOrder.map((c, i) => [c, i]));
    return cats.sort((a, b) => (pos.get(a) ?? 9999) - (pos.get(b) ?? 9999));
  }
  return cats.sort(
    orderMode === 0
      ? (a, b) => tot.get(b) - tot.get(a) || a.localeCompare(b)
      : orderMode === 1
        ? (a, b) => tot.get(a) - tot.get(b) || a.localeCompare(b)
        : (a, b) => a.localeCompare(b),
  );
}
function tooltipHtml(d, total) {
  let meta = Object.entries(d.data.meta || {})
    .filter((x) => x[0] && x[1])
    .map(([k, v]) => `${k}: ${v}`);
  return `<b>${d.data.category}</b><br>${d.data.series}: ${d.data.value.toLocaleString()}${total !== d.data.value ? `<br>Total: ${total.toLocaleString()}` : ""}${meta.length ? "<br>" + meta.join("<br>") : ""}`;
}
function contrastText(hex) {
  let h = String(hex || "#000000").replace("#", "");
  if (h.length !== 6) return "#FFFFFF";
  let r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16),
    lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 155 ? "#17212B" : "#FFFFFF";
}
function drawVertical(target, D, interactive = false) {
  return drawBars(target, D, false);
}
function drawHorizontal(target, D, interactive = false) {
  return drawBars(target, D, true);
}
function draw(target, D, interactive = false) {
  return orientation === "horizontal"
    ? drawHorizontal(target, D, interactive)
    : drawVertical(target, D, interactive);
}
function render() {
  if (!model) return;
  let categories = orderedCategories(),
    series = [...new Set(model.map((d) => d.series))];
  if (series.length === 1)
    categories.forEach((c, i) => {
      if (!C[c]) C[c] = SINGLE_GRADIENT[i % SINGLE_GRADIENT.length];
    });
  let D = {
    data: model,
    valueLabel:
      window.sampleAttribution?.valueLabel ||
      model.valueLabel ||
      (series.length === 1 ? series[0] : ""),
    categoryLabel: model.categoryLabel || "",
    width: +$("#w").value,
    height: +$("#h").value,
    spacing: +$("#p").value,
    series,
    categories,
    colors: C,
  };
  $("#wv").textContent = D.width;
  $("#hv").textContent = D.height;
  $("#pv").textContent = D.spacing + "%";
  $("#empty").style.display = "none";
  S.style("display", "block");
  draw(S, D);
  if (!showValues) S.selectAll(".valueLabel,.stackValue").remove();
  legend(series.length === 1 ? categories : series);
  $("#share").disabled = $("#reorder").disabled = false;
}
function legend(series) {
  let b = $("#legend");
  b.innerHTML = "";
  series.forEach((n) => {
    let l = document.createElement("label"),
      i = document.createElement("button");
    i.type = "button";
    i.className = "swatch";
    i.style.background = C[n];
    i.title = "Change colour for " + n;
    i.onclick = (e) => openColour(e, n);
    l.append(i, document.createTextNode(n));
    b.append(l);
  });
}
function openColour(e, n) {
  let pop = $("#colourPop"),
    hex = $("#hex"),
    native = $("#nativeColour"),
    r = e.currentTarget.getBoundingClientRect();
  pop.style.left = Math.min(innerWidth - 150, r.left) + "px";
  pop.style.top = r.bottom + 7 + "px";
  pop.classList.add("open");
  hex.value = C[n].toUpperCase();
  native.value = C[n];
  let apply = (v) => {
    if (/^#[0-9A-F]{6}$/i.test(v)) {
      C[n] = v.toUpperCase();
      render();
    }
  };
  hex.oninput = () => apply(hex.value);
  native.oninput = () => {
    hex.value = native.value.toUpperCase();
    apply(native.value);
  };
}
function svgText() {
  return ChartExport.frame("Chart").svg;
}
function base() {
  return (
    ($("#diagramTitle").value || "bar chart")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 120) || "bar chart"
  );
}
function dl(b, n) {
  let u = URL.createObjectURL(b),
    a = document.createElement("a");
  a.href = u;
  a.download = n;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function png() {
  let im = new Image(),
    u = URL.createObjectURL(
      new Blob([svgText()], { type: "image/svg+xml;charset=utf-8" }),
    );
  im.onload = () => {
    let c = document.createElement("canvas");
    c.width = im.width * 2;
    c.height = im.height * 2;
    let x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(im, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (b) dl(b, base() + ".png");
    }, "image/png");
    URL.revokeObjectURL(u);
  };
  im.onerror = () => {
    URL.revokeObjectURL(u);
    status("PNG export failed. Try the editable SVG export instead.");
  };
  im.src = u;
}
function interactive() {
  const old = activePeriod,
    frames = [];
  try {
    for (let i = 0; i < periods.length; i++) {
      activePeriod = i;
      model = periodModel(periods[i]);
      render();
      frames.push(ChartExport.frame(periods[i]));
    }
  } finally {
    activePeriod = old;
    model = periodModel(periods[old]);
    render();
  }
  ChartExport.download(frames, old);
}
function periodModel(period) {
  const points = parse();
  return Object.assign(
    points.filter((d) => d.period === period),
    { categoryLabel: points.categoryLabel, valueLabel: points.valueLabel },
  );
}
["w", "h", "p"].forEach((x) => ($("#" + x).oninput = render));
$("#period").oninput = (e) => {
  activePeriod = +e.target.value;
  manualOrder = [];
  model = periodModel(periods[activePeriod]);
  $("#periodLabel").textContent = periods[activePeriod];
  render();
};
$("#orientationBtn").onclick = () => {
  orientation = orientation === "vertical" ? "horizontal" : "vertical";
  $("#orientationBtn").textContent =
    orientation === "vertical" ? "Vertical" : "Horizontal";
  render();
};
$("#valuesBtn").onclick = () => {
  showValues = !showValues;
  $("#valuesBtn").classList.toggle("active", showValues);
  render();
};
$("#reorder").title =
  "Change the order automatically, or drag a bar to move it manually.";
$("#reorder").onclick = () => {
  manualOrder = [];
  orderMode = (orderMode + 1) % 3;
  $("#reorder").textContent = [
    "Order: ↓ value",
    "Order: ↑ value",
    "Order: A–Z",
  ][orderMode];
  render();
};
$("#reset").onclick = () => {
  M = [Array(6).fill("")];
  periods = [];
  activePeriod = 0;
  orderMode = 0;
  manualOrder = [];
  $("#reorder").textContent = "Order: ↓ value";
  $("#diagramTitle").value = "";
  grid();
  clear();
  clearStatus();
};
$("#share").onclick = () => $("#menu").classList.toggle("open");
$("#menu").onclick = (e) => {
  let x = e.target.dataset.x;
  if (x === "svg")
    dl(
      new Blob([svgText()], { type: "image/svg+xml;charset=utf-8" }),
      base() + ".svg",
    );
  if (x === "png") png();
  if (x === "html") interactive();
  $("#menu").classList.remove("open");
};
document.addEventListener("mouseup", () => (selecting = false));
document.addEventListener("keydown", (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectionBounds()) {
    e.preventDefault();
    clearSelectedCells();
  }
  if (e.key === "Escape") {
    selectionAnchor = selectionFocus = null;
    paintSelection();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#colourPop") && !e.target.closest(".swatch"))
    $("#colourPop").classList.remove("open");
  if (!e.target.closest(".menuWrap")) $("#menu").classList.remove("open");
});
grid();

function drawBars(target, D, horizontal) {
  const W = D.width,
    H = D.height,
    cats = D.categories,
    series = D.series,
    m = {
      top: 32,
      right: 60,
      bottom: horizontal ? 60 : 120,
      left: horizontal
        ? Math.min(220, Math.max(100, d3.max(cats, (c) => c.length) * 7))
        : 75,
    },
    iw = Math.max(40, W - m.left - m.right),
    ih = Math.max(40, H - m.top - m.bottom);
  const agg = new Map();
  D.data.forEach((d) => {
    const key = JSON.stringify([d.category, d.series]);
    const old = agg.get(key);
    agg.set(key, { ...d, value: (old?.value || 0) + d.value });
  });
  const matrix = cats.map((c) =>
      Object.fromEntries(
        series.map((k) => [k, agg.get(JSON.stringify([c, k]))?.value || 0]),
      ),
    ),
    extent = ChartUtils.signedExtent(matrix, series);
  if (extent[0] === extent[1]) extent[1] = 1;
  const stack = d3.stack().keys(series).offset(d3.stackOffsetDiverging)(matrix),
    v = d3
      .scaleLinear()
      .domain(extent)
      .nice()
      .range(horizontal ? [0, iw] : [ih, 0]),
    band = d3
      .scaleBand()
      .domain(cats)
      .range(horizontal ? [0, ih] : [0, iw])
      .padding(D.spacing / 100);
  target
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .selectAll("*")
    .remove();
  const g = target
    .append("g")
    .attr("transform", `translate(${m.left},${m.top})`);
  g.append("text")
    .attr("class", "axisTitle")
    .attr("x", horizontal ? iw / 2 : 0)
    .attr("y", horizontal ? ih + 44 : -16)
    .attr("text-anchor", horizontal ? "middle" : "start")
    .attr("font-size", 11)
    .attr("fill", "#59636e")
    .text(D.valueLabel || "");
  g.append("text")
    .attr("class", "categoryTitle")
    .attr("x", horizontal ? -12 : iw / 2)
    .attr("y", horizontal ? -16 : ih + 108)
    .attr("text-anchor", horizontal ? "end" : "middle")
    .attr("font-size", 11)
    .attr("fill", "#59636e")
    .text(D.categoryLabel || "");
  g.append("g")
    .attr("class", "gridline")
    .attr("transform", horizontal ? "translate(0," + ih + ")" : null)
    .call(
      horizontal
        ? d3.axisBottom(v).tickSize(-ih).tickFormat("")
        : d3.axisLeft(v).tickSize(-iw).tickFormat(""),
    );
  g.append("g")
    .attr("class", "axis")
    .attr("transform", horizontal ? "translate(0," + ih + ")" : null)
    .call(
      horizontal
        ? d3.axisBottom(v).tickFormat(d3.format("~s"))
        : d3.axisLeft(v).tickFormat(d3.format("~s")),
    );
  const categoryAxis = g
    .append("g")
    .attr("class", "axis categoryAxis")
    .attr("transform", horizontal ? null : "translate(0," + ih + ")")
    .call(horizontal ? d3.axisLeft(band) : d3.axisBottom(band));
  if (!horizontal)
    categoryAxis
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .attr("text-anchor", "end");
  g.append("line")
    .attr("stroke", "#59636e")
    .attr("x1", horizontal ? v(0) : 0)
    .attr("x2", horizontal ? v(0) : iw)
    .attr("y1", horizontal ? 0 : v(0))
    .attr("y2", horizontal ? ih : v(0));
  const values = stack.flatMap((layer) =>
    layer.map((r, i) => ({
      a: r[0],
      b: r[1],
      data: agg.get(JSON.stringify([cats[i], layer.key])) || {
        category: cats[i],
        series: layer.key,
        value: 0,
      },
      colour: series.length === 1 ? D.colors[cats[i]] : D.colors[layer.key],
    })),
  );
  const rects = g
    .selectAll(".barRect")
    .data(values)
    .join("rect")
    .attr("class", "barRect")
    .attr("x", (d) => (horizontal ? v(d.a) : band(d.data.category)))
    .attr("y", (d) => (horizontal ? band(d.data.category) : v(d.b)))
    .attr("width", (d) =>
      horizontal ? Math.abs(v(d.b) - v(d.a)) : band.bandwidth(),
    )
    .attr("height", (d) =>
      horizontal ? band.bandwidth() : Math.abs(v(d.a) - v(d.b)),
    )
    .attr("fill", (d) => d.colour);
  rects
    .each(function (d) {
      this.dataset.tooltip = [
        d.data.category,
        d.data.series + ": " + d.data.value.toLocaleString(),
        ...Object.entries(d.data.meta || {}).map(([k, v]) => k + ": " + v),
      ].join("\n");
    })
    .on("mouseenter", (e, d) => {
      tip
        .text(e.currentTarget.dataset.tooltip)
        .style("white-space", "pre-line")
        .style("opacity", 1);
    })
    .on("mousemove", (e) =>
      tip
        .style("left", e.clientX + 12 + "px")
        .style("top", e.clientY + 10 + "px"),
    )
    .on("mouseleave", () => tip.style("opacity", 0));
  if (showValues)
    g.selectAll(".stackValue")
      .data(
        values.filter(
          (d) => Math.abs(v(d.b) - v(d.a)) > 28 && d.data.value !== 0,
        ),
      )
      .join("text")
      .attr("class", "stackValue")
      .attr("x", (d) =>
        horizontal
          ? (v(d.a) + v(d.b)) / 2
          : band(d.data.category) + band.bandwidth() / 2,
      )
      .attr("y", (d) =>
        horizontal
          ? band(d.data.category) + band.bandwidth() / 2 + 4
          : (v(d.a) + v(d.b)) / 2 + 4,
      )
      .attr("fill", (d) => contrastText(d.colour))
      .text((d) => d.data.value.toLocaleString());
  const preview = g
    .append("line")
    .attr("class", "dragPreview")
    .attr("stroke", "#172b3f")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5 4")
    .style("display", "none")
    .style("pointer-events", "none");
  rects.style("cursor", "grab").call(
    d3
      .drag()
      .on("start", () => tip.style("opacity", 0))
      .on("drag", (e, d) => {
        const pos = horizontal ? e.y : e.x,
          to = Math.max(
            0,
            Math.min(cats.length - 1, Math.floor(pos / band.step())),
          ),
          from = cats.indexOf(d.data.category);
        const at = band(cats[to]) + (to > from ? band.bandwidth() : 0);
        preview
          .style("display", null)
          .attr("x1", horizontal ? 0 : at)
          .attr("x2", horizontal ? iw : at)
          .attr("y1", horizontal ? at : 0)
          .attr("y2", horizontal ? at : ih);
        rects.attr("opacity", (x) =>
          x.data.category === d.data.category?.toString() ? 0.6 : 1,
        );
      })
      .on("end", (e, d) => {
        preview.style("display", "none");
        rects.attr("opacity", 1);
        const pos = horizontal ? e.y : e.x,
          to = Math.max(
            0,
            Math.min(cats.length - 1, Math.floor(pos / band.step())),
          ),
          from = cats.indexOf(d.data.category);
        if (from !== to) {
          manualOrder = cats.slice();
          manualOrder.splice(from, 1);
          manualOrder.splice(to, 0, d.data.category);
          render();
        }
      }),
  );
}

window.chartSettings = {
  get() {
    return structuredClone({
      orderMode: orderMode,
      manualOrder: manualOrder,
      orientation: orientation,
      showValues: showValues,
      activePeriod: activePeriod,
      C: C,
    });
  },
  set(s) {
    if (!s || typeof s !== "object") return;
    if (
      typeof s.orderMode === typeof orderMode &&
      (typeof s.orderMode !== "number" || Number.isFinite(s.orderMode))
    )
      orderMode = s.orderMode;
    if (Array.isArray(s.manualOrder))
      manualOrder = s.manualOrder.filter((x) => typeof x === "string");
    if (
      typeof s.orientation === typeof orientation &&
      (typeof s.orientation !== "number" || Number.isFinite(s.orientation))
    )
      orientation = s.orientation;
    if (
      typeof s.showValues === typeof showValues &&
      (typeof s.showValues !== "number" || Number.isFinite(s.showValues))
    )
      showValues = s.showValues;
    if (
      typeof s.activePeriod === typeof activePeriod &&
      (typeof s.activePeriod !== "number" || Number.isFinite(s.activePeriod))
    )
      activePeriod = s.activePeriod;
    if (s.C && typeof s.C === "object") {
      Object.keys(C).forEach((k) => delete C[k]);
      for (const [k, v] of Object.entries(s.C))
        if (/^#[0-9a-f]{6}$/i.test(v)) C[k] = v;
    }
  },
  rebuild() {
    try {
      build();
    } catch (e) {
      const node = document.querySelector("#status");
      node.textContent = e.message;
      node.className = "status error";
    }
  },
  reset() {
    M = [[]];
    clear();
  },
  sync() {
    window.refreshOrderControls?.();
    $("#orientationBtn").textContent =
      orientation === "horizontal" ? "Horizontal" : "Vertical";
    $("#valuesBtn").classList.toggle("active", showValues);
  },
  items() {
    return model ? orderedCategories().map((x) => ({ id: x, name: x })) : [];
  },
  move(id, delta) {
    if (!model) return;
    const list = orderedCategories(),
      i = list.indexOf(id),
      j = Math.max(0, Math.min(list.length - 1, i + delta));
    if (i < 0) return;
    list.splice(i, 1);
    list.splice(j, 0, id);
    manualOrder = list;
    render();
  },
};

window.chartBridge = {
  setData(rows) {
    clearTimeout(timer);
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
