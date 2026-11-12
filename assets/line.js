"use strict";
let M = [Array(7).fill("")],
  timer = null,
  model = null,
  currentCurve = "monotone",
  showArea = false,
  showLabels = false,
  startZero = false,
  hidden = new Set();
const $ = (s) => document.querySelector(s),
  S = d3.select("#svg"),
  tip = d3.select("#tip"),
  PALETTE = [
    "#5653FF",
    "#00B188",
    "#F8CA1C",
    "#F56DAB",
    "#FA9C28",
    "#EF431B",
    "#844AFF",
    "#2B82C4",
    "#3EB86D",
  ],
  C = Object.create(null),
  TC = Object.create(null);
const clean = (v) => String(v ?? "").trim(),
  norm = (v) =>
    clean(v)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""),
  num = ChartUtils.number;
const aliases = {
  x: [
    "X",
    "DATE",
    "TIME",
    "PERIOD",
    "MONTH",
    "QUARTER",
    "YEAR",
    "WEEK",
    "DAY",
    "CATEGORY",
    "LABEL",
  ],
  value: [
    "Y",
    "VALUE",
    "AMOUNT",
    "COUNT",
    "TOTAL",
    "NUMBER",
    "VOLUME",
    "SCORE",
    "PERCENT",
    "RATE",
  ],
  series: [
    "SERIES",
    "MEASURE",
    "METRIC",
    "GROUP",
    "TYPE",
    "SEGMENT",
    "COHORT",
    "LINE",
  ],
  colour: ["COLOUR", "COLOR", "HEX"],
  target: ["TARGET", "BENCHMARK", "REFERENCE", "GOAL"],
  targetColour: [
    "TARGETCOLOUR",
    "TARGETCOLOR",
    "BENCHMARKCOLOUR",
    "BENCHMARKCOLOR",
  ],
  note: ["ANNOTATION", "NOTE", "COMMENT"],
};
const idx = (h, a) => h.findIndex((x) => a.includes(norm(x)));
function rows() {
  return M.filter((r) => r.some(clean)).map((r) => {
    let z = [...r];
    while (z.length && !clean(z.at(-1))) z.pop();
    return z;
  });
}
function status(m) {
  let e = $("#status");
  e.textContent = m;
  e.className = "status error";
}
function clearStatus() {
  $("#status").className = "status";
  $("#status").textContent = "";
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
function refresh(ms = 80) {
  clearTimeout(timer);
  timer = setTimeout(build, ms);
}
function dateish(v) {
  let s = clean(v);
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return new Date(+s, 0, 1);
  let d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}
function finalise(points) {
  if (!points.length) return null;
  let allDates = points.every(
      (d) =>
        /^\d{4}$/.test(clean(d.x)) ||
        (!Number.isFinite(num(d.x)) && dateish(d.x)),
    ),
    allNums = points.every((d) => Number.isFinite(num(d.x))),
    xType = allDates ? "date" : allNums ? "number" : "category";
  points.forEach((d, i) => {
    d.xv =
      xType === "date" ? dateish(d.x) : xType === "number" ? num(d.x) : d.x;
    d.order = i;
    if (d.colour && /^#[0-9A-F]{6}$/i.test(d.colour)) C[d.series] = d.colour;
    if (d.targetColour && /^#[0-9A-F]{6}$/i.test(d.targetColour))
      TC[d.series] = d.targetColour;
    if (!C[d.series])
      C[d.series] = PALETTE[Object.keys(C).length % PALETTE.length];
    if (!TC[d.series]) TC[d.series] = "#65717C";
  });
  return { points, xType };
}
function transpose(rr) {
  let points = [];
  for (const r of rr.slice(1)) {
    let series = clean(r[0]);
    for (let j = 1; j < r.length; j++) {
      let value = num(r[j]);
      if (series && clean(rr[0][j]) && Number.isFinite(value))
        points.push({
          x: clean(rr[0][j]),
          series,
          value,
          colour: "",
          target: NaN,
          targetColour: "",
          note: "",
          meta: {},
        });
    }
  }
  return finalise(points);
}
function parse() {
  let rr = rows();
  if (rr.length < 2) return null;
  if (
    rr[0].length > 2 &&
    ["SERIES", "MEASURE", "METRIC", "LINE"].includes(norm(rr[0][0]))
  )
    return transpose(rr);
  let known = Object.values(aliases).flat(),
    hasHeader =
      rr[0].some((x) => known.includes(norm(x))) ||
      rr[0].slice(1).some((x) => !Number.isFinite(num(x))),
    h = hasHeader ? rr[0] : rr[0].map((_, i) => (i ? "Value" : "X")),
    data = hasHeader ? rr.slice(1) : rr,
    xi = idx(h, aliases.x);
  if (xi < 0) xi = 0;
  let vi = idx(h, aliases.value),
    si = idx(h, aliases.series),
    ci = idx(h, aliases.colour),
    ti = idx(h, aliases.target),
    tci = idx(h, aliases.targetColour),
    ni = idx(h, aliases.note),
    points = [];
  if (vi < 0) {
    const numeric = h
      .map((_, j) => j)
      .filter(
        (j) =>
          ![xi, si, ci, ti, tci, ni].includes(j) &&
          data.some((r) => Number.isFinite(num(r[j]))),
      );
    if (numeric.length === 1) vi = numeric[0];
  }
  if (vi >= 0) {
    for (const r of data) {
      let x = clean(r[xi]),
        value = num(r[vi]);
      if (!x || !Number.isFinite(value)) continue;
      let series =
          si >= 0 ? clean(r[si]) || clean(h[vi]) : clean(h[vi]) || "Value",
        used = [xi, vi, si, ci, ti, tci, ni],
        meta = Object.fromEntries(
          h
            .map((x, i) => [clean(x), clean(r[i])])
            .filter(([k, v], i) => k && v && !used.includes(i)),
        );
      points.push({
        x,
        series,
        value,
        colour: ci >= 0 ? clean(r[ci]) : "",
        target: ti >= 0 ? num(r[ti]) : NaN,
        targetColour: tci >= 0 ? clean(r[tci]) : "",
        note: ni >= 0 ? clean(r[ni]) : "",
        meta,
      });
    }
  } else {
    let candidates = h
      .map((_, j) => j)
      .filter((j) => j !== xi && data.some((r) => Number.isFinite(num(r[j]))));
    for (const r of data)
      for (const j of candidates) {
        let x = clean(r[xi]),
          value = num(r[j]);
        if (x && Number.isFinite(value))
          points.push({
            x,
            series: clean(h[j]),
            value,
            colour: "",
            target: NaN,
            targetColour: "",
            note: "",
            meta: {},
          });
      }
  }
  const result = finalise(points);
  if (result) {
    result.valueLabel = vi >= 0 ? clean(h[vi]) : "";
    result.xLabel = clean(h[xi]);
  }
  return result;
}
function build() {
  clearStatus();
  let p = parse();
  if (!p) {
    clear();
    if (rows().length) status("I could not identify line-chart values.");
    return;
  }
  model = p;
  render();
}
function clear() {
  model = null;
  S.style("display", "none").selectAll("*").remove();
  $("#empty").style.display = "block";
  $("#legend").innerHTML = "";
  $("#share").disabled = true;
}
function fmt(v) {
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function xLabel(d) {
  return model.xType === "date" ? d3.timeFormat("%d %b %Y")(d.xv) : String(d.x);
}
function curveFn() {
  return currentCurve === "step"
    ? d3.curveStepAfter
    : currentCurve === "linear"
      ? d3.curveLinear
      : d3.curveMonotoneX;
}
function draw(target, D, interactive = false) {
  let W = D.width,
    maxLabel =
      d3.max((D.points || []).map((d) => String(d.x || "").length)) || 0,
    labelExtra = Math.min(180, Math.max(0, maxLabel * 5.8 - 42)),
    H = D.height + labelExtra,
    m = {
      top: 42,
      right: Math.min(
        W * 0.4,
        Math.max(110, ...D.points.map((d) => d.series.length * 7 + 20)),
      ),
      bottom: 65 + labelExtra,
      left: 70,
    },
    iw = W - m.left - m.right,
    ih = H - m.top - m.bottom,
    series = [...new Set(D.points.map((d) => d.series))].filter(
      (s) => !hidden.has(s),
    ),
    pts = D.points.filter((d) => series.includes(d.series));
  if (!pts.length) {
    target.selectAll("*").remove();
    return;
  }
  let groups = d3
      .groups(pts, (d) => d.series)
      .map(([s, v]) => [
        s,
        v.sort((a, b) =>
          model.xType === "category"
            ? a.order - b.order
            : d3.ascending(a.xv, b.xv),
        ),
      ]),
    x;
  if (model.xType === "category") {
    x = d3
      .scalePoint()
      .domain([
        ...new Set(pts.sort((a, b) => a.order - b.order).map((d) => d.x)),
      ])
      .range([0, iw])
      .padding(0.35);
  } else {
    x = (model.xType === "date" ? d3.scaleTime() : d3.scaleLinear())
      .domain(d3.extent(pts, (d) => d.xv))
      .range([0, iw]);
  }
  let vals = pts.flatMap((d) => [d.value, d.target]).filter(Number.isFinite),
    yd = d3.extent(vals),
    pad = (yd[1] - yd[0] || 1) * 0.1,
    lo = startZero ? Math.min(0, yd[0] - pad) : yd[0] - pad,
    hi = startZero ? Math.max(0, yd[1] + pad) : yd[1] + pad;
  let y = d3.scaleLinear().domain([lo, hi]).nice();
  y.range([ih, 0]);
  target
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .selectAll("*")
    .remove();
  let g = target.append("g").attr("transform", `translate(${m.left},${m.top})`);
  let grid = g
    .append("g")
    .attr("class", "gridline")
    .call(
      d3
        .axisLeft(y)
        .ticks(Math.max(3, Math.floor(ih / 60)))
        .tickSize(-iw)
        .tickFormat(""),
    );
  grid.selectAll("line").attr("stroke", "#edf1f4");
  grid.selectAll("path").attr("stroke", "none");
  let yAxis = g
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisLeft(y)
        .ticks(Math.max(3, Math.floor(ih / 60)))
        .tickFormat(d3.format("~s")),
    );
  yAxis.selectAll("path,line").attr("stroke", "#d9e0e5");
  yAxis.selectAll("text").attr("fill", "#59636e");
  let xa = d3.axisBottom(x),
    xItems = [
      ...new Map(
        pts.map((d) => [model.xType === "date" ? +d.xv : d.x, d]),
      ).values(),
    ];
  if (model.xType === "date") {
    if (xItems.length <= 14) xa.tickValues(xItems.map((d) => d.xv));
    else xa.ticks(Math.min(10, Math.floor(iw / 80)));
    xa.tickFormat(
      d3.timeFormat(
        pts.every((d) => /^\d{4}$/.test(String(d.x))) ? "%Y" : "%b %Y",
      ),
    );
  }
  let xAxis = g
    .append("g")
    .attr("class", "axis xAxis")
    .attr("transform", `translate(0,${ih})`)
    .call(xa);
  xAxis.selectAll("path,line").attr("stroke", "#d9e0e5");
  let tickText = xAxis.selectAll("text").attr("fill", "#59636e"),
    labels = tickText.nodes().map((n) => n.textContent),
    slots = Math.max(1, labels.length),
    slot = iw / slots,
    maxChars = d3.max(labels, (d) => d.length) || 0,
    diagonal = model.xType === "category" || maxChars * 6.2 > slot * 0.92;
  if (diagonal)
    tickText
      .attr("transform", "rotate(-35)")
      .attr("text-anchor", "end")
      .attr("dx", "-.45em")
      .attr("dy", ".35em");
  let X = (d) => x(model.xType === "category" ? d.x : d.xv),
    line = d3
      .line()
      .x(X)
      .y((d) => y(d.value))
      .curve(curveFn()),
    area = d3
      .area()
      .x(X)
      .y0(y(Math.max(0, y.domain()[0])))
      .y1((d) => y(d.value))
      .curve(curveFn()),
    sg = g.selectAll(".series").data(groups).join("g").attr("class", "series");
  if (showArea)
    sg.append("path")
      .attr("class", "area")
      .attr("fill", (d) => C[d[0]])
      .attr("fill-opacity", 0.16)
      .attr("stroke", "none")
      .attr("d", (d) => area(d[1]));
  sg.append("path")
    .attr("class", "seriesLine")
    .attr("fill", "none")
    .attr("stroke", (d) => C[d[0]])
    .attr("stroke-width", D.lineWidth)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("d", (d) => line(d[1]));
  let flat = groups.flatMap(([series, v]) => v.map((d) => ({ ...d, series }))),
    points = g
      .selectAll(".point")
      .data(flat)
      .join("circle")
      .attr("class", "point")
      .attr("cx", X)
      .attr("cy", (d) => y(d.value))
      .attr("r", D.pointSize)
      .attr("fill", (d) => C[d.series]);
  const ends = groups
    .map(([name, values]) => ({
      name,
      point: values.at(-1),
      y: y(values.at(-1).value),
    }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++)
    ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 16);
  if (ends.length && ends.at(-1).y > ih) {
    ends.at(-1).y = ih;
    for (let i = ends.length - 2; i >= 0; i--)
      ends[i].y = Math.min(ends[i].y, ends[i + 1].y - 16);
  }
  g.selectAll(".seriesEndLeader")
    .data(ends)
    .join("path")
    .attr("class", "seriesEndLeader")
    .attr("d", (d) => `M${X(d.point) + 4},${y(d.point.value)}L${iw + 8},${d.y}`)
    .attr("stroke", (d) => C[d.name])
    .attr("fill", "none");
  g.selectAll(".seriesEndLabel")
    .data(ends)
    .join("text")
    .attr("class", "seriesEndLabel")
    .attr("x", iw + 12)
    .attr("y", (d) => d.y + 4)
    .attr("fill", (d) => C[d.name])
    .attr("font-size", 11)
    .attr("font-weight", 600)
    .text((d) => d.name);
  g.append("text")
    .attr("class", "axisTitle")
    .attr("y", -18)
    .attr("fill", "#59636e")
    .attr("font-size", 11)
    .text(D.valueLabel || "");
  let hits = g
    .selectAll(".pointHit")
    .data(flat)
    .join("circle")
    .attr("class", "pointHit")
    .attr("cx", X)
    .attr("cy", (d) => y(d.value))
    .attr("r", (d) => Math.max(10, D.pointSize + 7))
    .on("mouseenter", (e, d) => {
      if (!interactive) {
        g.selectAll(".series,.point,.valueLabel").classed("dim", (x) => {
          let s = x?.series || x?.[0];
          return s && s !== d.series;
        });
        tip.style("opacity", 1).html(ChartUtils.tooltip(tooltip(d)));
      }
    })
    .on("mousemove", (e) => {
      if (!interactive)
        tip
          .style("left", e.clientX + 12 + "px")
          .style("top", e.clientY + 8 + "px");
    })
    .on("mouseleave", () => {
      if (!interactive) {
        g.selectAll(".series,.point,.valueLabel").classed("dim", false);
        tip.style("opacity", 0);
      }
    });
  hits.each(function (d) {
    this.dataset.tooltip = [
      d.series,
      xLabel(d),
      fmt(d.value),
      ...Object.entries(d.meta || {}).map(([k, v]) => k + ": " + v),
      ...(d.note ? ["Note: " + d.note] : []),
    ].join("\n");
  });
  if (showLabels)
    g.selectAll(".valueLabel")
      .data(flat)
      .join("text")
      .attr("class", "valueLabel")
      .attr("x", X)
      .attr("y", (d) => y(d.value) - 9)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => C[d.series])
      .text((d) => fmt(d.value));
  let targets = targetGroups(groups);
  const sorted = targets
    .slice()
    .sort((a, b) => y(d3.mean(a.v)) - y(d3.mean(b.v)));
  sorted.forEach(
    (d, i) =>
      (d.labelY = Math.max(
        12,
        y(d3.mean(d.v)) - 7,
        i ? sorted[i - 1].labelY + 15 : 0,
      )),
  );
  g.selectAll(".targetLine")
    .data(targets)
    .join("line")
    .attr("x1", 0)
    .attr("x2", iw)
    .attr("y1", (d) => y(d3.mean(d.v)))
    .attr("y2", (d) => y(d3.mean(d.v)))
    .attr("stroke", (d) => TC[d.s])
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6 5");
  g.selectAll(".targetLabel")
    .data(targets)
    .join("text")
    .attr("class", "annotation")
    .attr("x", iw - 2)
    .attr("y", (d) => d.labelY)
    .attr("text-anchor", "end")
    .attr("fill", (d) => TC[d.s])
    .text(
      (d) => `${d.shared ? "Target" : d.s + " target"} ${fmt(d3.mean(d.v))}`,
    );
}
function tooltip(d) {
  return `<b>${d.series}</b><br>${xLabel(d)}: ${fmt(d.value)}${Number.isFinite(d.target) ? `<br>Target: ${fmt(d.target)}` : ""}${d.note ? `<br>${d.note}` : ""}`;
}
function render() {
  if (!model) return;
  let D = {
    points: model.points,
    valueLabel: window.sampleAttribution?.valueLabel || model.valueLabel || "",
    width: +$("#w").value,
    height: +$("#h").value,
    lineWidth: +$("#lw").value,
    pointSize: +$("#ps").value,
  };
  ["w", "h", "lw", "ps"].forEach(
    (x) => ($("#" + x + "v").textContent = $("#" + x).value),
  );
  $("#empty").style.display = "none";
  S.style("display", "block");
  draw(S, D);
  legend();
  $("#share").disabled = false;
}
function targetGroups(groups) {
  const out = [];
  for (const [s, points] of groups) {
    const v = points.map((d) => d.target).filter(Number.isFinite);
    if (!v.length) continue;
    const value = d3.mean(v);
    let same = out.find((d) => Math.abs(d3.mean(d.v) - value) < 1e-9);
    if (same) {
      same.shared = true;
      same.series.push(s);
    } else out.push({ s, v, series: [s], shared: false });
  }
  return out;
}
function legend() {
  let names = [...new Set(model.points.map((d) => d.series))],
    b = $("#legend");
  b.innerHTML = "";
  const targets = targetGroups(d3.groups(model.points, (d) => d.series));
  names.forEach((n) => {
    let l = document.createElement("label"),
      i = document.createElement("button");
    l.className = hidden.has(n) ? "off" : "";
    i.className = "swatch";
    i.style.background = C[n];
    i.onclick = (e) => {
      e.stopPropagation();
      openColour(e, n, C);
    };
    l.onclick = () => {
      hidden.has(n) ? hidden.delete(n) : hidden.add(n);
      render();
    };
    l.append(i, document.createTextNode(n));
    b.append(l);
    const target = targets.find((d) => d.s === n);
    if (target) {
      let tl = document.createElement("label"),
        ti = document.createElement("button");
      tl.className = "targetItem";
      ti.className = "swatch";
      ti.style.background = TC[n];
      ti.onclick = (e) => {
        e.stopPropagation();
        openColour(e, n, TC);
        const input = $("#hex");
        const previous = input.oninput;
        input.oninput = () => {
          previous?.();
          target.series.forEach((name) => (TC[name] = TC[n]));
          render();
        };
      };
      tl.append(
        ti,
        document.createTextNode(target.shared ? "Target" : n + " target"),
      );
      b.append(tl);
    }
  });
}
function openColour(e, n, store) {
  let p = $("#colourPop"),
    hex = $("#hex"),
    native = $("#nativeColour"),
    r = e.currentTarget.getBoundingClientRect();
  p.style.left = Math.min(innerWidth - 150, r.left) + "px";
  p.style.top = r.bottom + 7 + "px";
  p.classList.add("open");
  hex.value = store[n];
  native.value = store[n];
  let apply = (v) => {
    if (/^#[0-9A-F]{6}$/i.test(v)) {
      store[n] = v.toUpperCase();
      render();
    }
  };
  hex.oninput = () => apply(hex.value);
  native.oninput = () => {
    hex.value = native.value;
    apply(native.value);
  };
}
function svgText() {
  return ChartExport.frame("Chart").svg;
}
function base() {
  return ($("#diagramTitle").value || "line chart").replace(
    /[\\/:*?"<>|]+/g,
    "-",
  );
}
function dl(b, n) {
  let u = URL.createObjectURL(b),
    a = document.createElement("a");
  a.href = u;
  a.download = n;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 500);
}
function png() {
  let im = new Image(),
    u = URL.createObjectURL(new Blob([svgText()], { type: "image/svg+xml" }));
  im.onload = () => {
    let c = document.createElement("canvas");
    c.width = im.width * 2;
    c.height = im.height * 2;
    let x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(im, 0, 0, c.width, c.height);
    c.toBlob((b) => dl(b, base() + ".png"));
    URL.revokeObjectURL(u);
  };
  im.src = u;
}
function interactive() {
  const frames = [ChartExport.frame("Chart")];
  ChartExport.download(frames);
}
["w", "h", "lw", "ps"].forEach((x) => ($("#" + x).oninput = render));
$("#curveBtn").onclick = () => {
  let a = [
      ["linear", "Straight"],
      ["monotone", "Smooth"],
      ["step", "Step"],
    ],
    i = a.findIndex((x) => x[0] === currentCurve),
    z = a[(i + 1) % a.length];
  currentCurve = z[0];
  $("#curveBtn").textContent = z[1];
  render();
};
$("#curveMenu").style.display = "none";
$("#area").onclick = () => {
  showArea = !showArea;
  $("#area").classList.toggle("active", showArea);
  render();
};
$("#labels").onclick = () => {
  showLabels = !showLabels;
  $("#labels").classList.toggle("active", showLabels);
  render();
};
$("#zero").onclick = () => {
  startZero = !startZero;
  $("#zero").classList.toggle("active", startZero);
  render();
};
$("#reset").onclick = () => {
  M = [Array(7).fill("")];
  hidden.clear();
  grid();
  clear();
  clearStatus();
};
$("#share").onclick = () => $("#menu").classList.toggle("open");
$("#menu").onclick = (e) => {
  let x = e.target.dataset.x;
  if (x === "svg")
    dl(new Blob([svgText()], { type: "image/svg+xml" }), base() + ".svg");
  if (x === "png") png();
  if (x === "html") interactive();
  $("#menu").classList.remove("open");
};
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#colourPop") && !e.target.closest(".swatch"))
    $("#colourPop").classList.remove("open");
  if (!e.target.closest(".menuWrap")) {
    $("#menu").classList.remove("open");
    $("#curveMenu").classList.remove("open");
  }
});
grid();

window.chartSettings = {
  get() {
    return structuredClone({
      currentCurve: currentCurve,
      showArea: showArea,
      showLabels: showLabels,
      startZero: startZero,
      hidden: [...hidden],
      C: C,
      TC: TC,
    });
  },
  set(s) {
    if (!s || typeof s !== "object") return;
    if (
      typeof s.currentCurve === typeof currentCurve &&
      (typeof s.currentCurve !== "number" || Number.isFinite(s.currentCurve))
    )
      currentCurve = s.currentCurve;
    if (
      typeof s.showArea === typeof showArea &&
      (typeof s.showArea !== "number" || Number.isFinite(s.showArea))
    )
      showArea = s.showArea;
    if (
      typeof s.showLabels === typeof showLabels &&
      (typeof s.showLabels !== "number" || Number.isFinite(s.showLabels))
    )
      showLabels = s.showLabels;
    if (
      typeof s.startZero === typeof startZero &&
      (typeof s.startZero !== "number" || Number.isFinite(s.startZero))
    )
      startZero = s.startZero;
    if (Array.isArray(s.hidden))
      hidden = new Set(s.hidden.filter((x) => typeof x === "string"));
    if (s.C && typeof s.C === "object") {
      Object.keys(C).forEach((k) => delete C[k]);
      for (const [k, v] of Object.entries(s.C))
        if (/^#[0-9a-f]{6}$/i.test(v)) C[k] = v;
    }
    if (s.TC && typeof s.TC === "object") {
      Object.keys(TC).forEach((k) => delete TC[k]);
      for (const [k, v] of Object.entries(s.TC))
        if (/^#[0-9a-f]{6}$/i.test(v)) TC[k] = v;
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
    $("#curveBtn").textContent = {
      linear: "Straight",
      monotone: "Smooth",
      step: "Step",
    }[currentCurve];
    $("#area").classList.toggle("active", showArea);
    $("#labels").classList.toggle("active", showLabels);
    $("#zero").classList.toggle("active", startZero);
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
