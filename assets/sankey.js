"use strict";
let M = [Array(6).fill("")],
  model = null,
  lay = null,
  sk = null,
  timer = null,
  nodeOrder = new Map(),
  sourceLinkOrder = new Map(),
  targetLinkOrder = new Map(),
  detSeed = 0,
  periodModels = [],
  activePeriod = 0,
  widthTouched = false;
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
];
const C = Object.create(null);
const STAGE_PALETTES = [
  ["#5653FF", "#2B82C4"],
  ["#00B188", "#3EB86D", "#7CBE52"],
  ["#F8CA1C", "#F9B322", "#BAC437"],
  ["#FA9C28", "#F57022", "#EF431B"],
  ["#F56DAB", "#FF5C67"],
  ["#844AFF", "#B240FF"],
];
function nodeColour(d, nodes = model?.nodes || []) {
  if (C[d.name]) return C[d.name];
  const names = [...new Set(nodes.map((n) => n.name))];
  return PALETTE[Math.max(0, names.indexOf(d.name)) % PALETTE.length];
}

const norm = (s) =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const clean = (s) => String(s ?? "").trim();
const alias = {
  source: ["SOURCE", "FROM", "ORIGIN", "START", "SOURCEID"],
  target: ["TARGET", "TO", "DESTINATION", "END", "TARGETID"],
  value: [
    "VALUE",
    "AMOUNT",
    "WEIGHT",
    "COUNT",
    "PEOPLE",
    "CANDIDATES",
    "GWH",
    "TOTAL",
    "VOLUME",
    "FREQUENCY",
  ],
  period: ["PERIOD", "DATE", "MONTH", "QUARTER", "YEAR", "WEEK", "TIME"],
  stage: ["STAGE", "STEP", "LAYER", "SEQUENCE", "ORDER"],
  colour: ["LINKCOLOUR", "LINKCOLOR", "COLOUR", "COLOR", "HEX"],
  group: ["GROUP", "CATEGORY", "COHORT", "SEGMENT", "TYPE"],
  nodeId: ["NODEID"],
  label: ["LABEL", "NODENAME", "NAME"],
};
function hidx(h, names) {
  return h.findIndex((v) => names.includes(norm(v)));
}
function number(v) {
  let s = String(v ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/£|\$|%/g, "");
  if (!s) return NaN;
  return /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}
function colour(name) {
  if (C[name]) return C[name];
  let used = new Set(Object.values(C).map((x) => String(x).toUpperCase())),
    pick =
      PALETTE.find((x) => !used.has(x)) ||
      PALETTE[Object.keys(C).length % PALETTE.length];
  return (C[name] = pick);
}
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
let selecting = false,
  selectionAnchor = null,
  selectionFocus = null;
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
  if (!selecting) return;
  selectionFocus = { r: +this.dataset.r, c: +this.dataset.c };
  paintSelection();
}
function endSelection() {
  selecting = false;
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
function refresh(ms = 120) {
  clearTimeout(timer);
  timer = setTimeout(build, ms);
}
function nonempty() {
  return M.filter((r) => r.some((x) => clean(x))).map((r) => {
    let z = [...r];
    while (z.length && !clean(z.at(-1))) z.pop();
    return z;
  });
}
function looksLikeHeader(row) {
  let n = row.map(norm),
    known = Object.values(alias).flat();
  return n.some((x) => known.includes(x));
}
function detectHeader(rows) {
  if (!rows.length) return null;
  if (looksLikeHeader(rows[0]))
    return { h: rows[0], data: rows.slice(1), inferred: false };
  let vals = rows[0].map(number),
    numeric = vals.map(Number.isFinite);
  if (rows[0].length >= 3 && numeric.filter(Boolean).length === 1) {
    let vi = numeric.indexOf(true),
      text = [0, 1, 2].filter((i) => i !== vi);
    let h = rows[0].map((_, i) =>
      i === vi
        ? "Value"
        : i === text[0]
          ? "Source"
          : i === text[1]
            ? "Target"
            : "Metadata",
    );
    return { h, data: rows, inferred: true };
  }
  return { h: rows[0], data: rows.slice(1), inferred: false };
}
function rowsToLinks(h, data, forced = {}) {
  let si = forced.si ?? hidx(h, alias.source),
    ti = forced.ti ?? hidx(h, alias.target),
    vi = forced.vi ?? hidx(h, alias.value),
    pi = hidx(h, alias.period),
    sti = hidx(h, alias.stage),
    ci = hidx(h, alias.colour),
    gi = hidx(h, alias.group);
  if (si < 0 || ti < 0 || vi < 0) return null;
  let links = [];
  for (const r of data) {
    let s = clean(r[si]),
      t = clean(r[ti]),
      v = number(r[vi]);
    if (!s || !t || !Number.isFinite(v) || v < 0) continue;
    links.push({
      s,
      t,
      v,
      period: pi >= 0 ? clean(r[pi]) : "",
      stage: sti >= 0 ? number(r[sti]) : NaN,
      colour: ci >= 0 ? clean(r[ci]) : "",
      group: gi >= 0 ? clean(r[gi]) : "",
      meta: Object.fromEntries(
        h
          .map((x, i) => [clean(x), clean(r[i])])
          .filter(
            ([k, v]) =>
              k && v && ![si, ti, vi, pi, sti, ci, gi].includes(h.indexOf(k)),
          ),
      ),
    });
  }
  return {
    links,
    periodIndex: pi,
    stageIndex: sti,
    valueLabel: clean(h[vi]) || "Value",
    groupLabel: gi >= 0 ? clean(h[gi]) : "",
  };
}
function wideToLinks(h, data) {
  let numericScores = h.map(
      (_, j) => data.filter((r) => Number.isFinite(number(r[j]))).length,
    ),
    vi = numericScores.indexOf(Math.max(...numericScores));
  if (vi < 0 || numericScores[vi] === 0) return null;
  let pathCols = h
    .map((_, i) => i)
    .filter((i) => i !== vi && data.some((r) => clean(r[i])));
  if (pathCols.length < 2) return null;
  let links = [];
  for (const r of data) {
    let v = number(r[vi]);
    if (!Number.isFinite(v) || v < 0) continue;
    let path = pathCols.map((i) => clean(r[i])).filter(Boolean);
    for (let i = 0; i < path.length - 1; i++)
      links.push({
        s: path[i],
        t: path[i + 1],
        v,
        period: "",
        stage: i + 1,
        colour: "",
        group: "",
        meta: { Path: path.join(" → ") },
      });
  }
  return {
    links,
    periodIndex: -1,
    stageIndex: 0,
    valueLabel: clean(h[vi]) || "Value",
    groupLabel: "",
  };
}
function nodesPlusLinks(h, data) {
  let ni = hidx(h, alias.nodeId),
    li = hidx(h, alias.label),
    gi = hidx(h, alias.group),
    si = hidx(h, ["SOURCEID"]),
    ti = hidx(h, ["TARGETID"]),
    vi = hidx(h, alias.value);
  if (ni < 0 || li < 0 || si < 0 || ti < 0 || vi < 0) return null;
  let nodes = new Map();
  for (const r of data)
    if (clean(r[ni]))
      nodes.set(clean(r[ni]), {
        label: clean(r[li]) || clean(r[ni]),
        group: gi >= 0 ? clean(r[gi]) : "",
      });
  let links = [];
  for (const r of data) {
    let a = nodes.get(clean(r[si])),
      b = nodes.get(clean(r[ti])),
      v = number(r[vi]);
    if (a && b && Number.isFinite(v) && v >= 0)
      links.push({
        s: a.label,
        t: b.label,
        v,
        period: "",
        stage: NaN,
        colour: "",
        group: a.group || b.group,
        meta: {},
      });
  }
  return links.length
    ? {
        links,
        periodIndex: -1,
        stageIndex: -1,
        valueLabel: clean(h[vi]) || "Value",
        groupLabel: gi >= 0 ? clean(h[gi]) : "",
      }
    : null;
}
function densifyNodeTables(rows) {
  let header = rows[0];
  let nid = header.findIndex((x) => norm(x) === "NODEID"),
    sid = header.findIndex((x) => norm(x) === "SOURCEID");
  if (nid < 0 || sid < 0) return null;
  return nodesPlusLinks(header, rows.slice(1));
}
function topoLayers(links, explicit) {
  let names = [...new Set(links.flatMap((x) => [x.s, x.t]))],
    ind = new Map(names.map((n) => [n, 0])),
    out = new Map(names.map((n) => [n, []]));
  for (const l of links) {
    if (l.s === l.t)
      return {
        error: `A self-link was found for “${l.s}”. Sankey and alluvial layouts need links between different nodes.`,
      };
    ind.set(l.t, ind.get(l.t) + 1);
    out.get(l.s).push(l.t);
  }
  let q = names.filter((n) => ind.get(n) === 0),
    order = [];
  while (q.length) {
    let n = q.shift();
    order.push(n);
    for (const t of out.get(n)) {
      ind.set(t, ind.get(t) - 1);
      if (ind.get(t) === 0) q.push(t);
    }
  }
  if (order.length !== names.length)
    return {
      error:
        "This table contains a cycle or backward loop. A Sankey/alluvial layout cannot place that flow left-to-right. Remove or split the loop into a separate step.",
    };
  let layer = new Map(names.map((n) => [n, 0]));
  for (const n of order)
    for (const t of out.get(n))
      layer.set(t, Math.max(layer.get(t), layer.get(n) + 1));
  if (explicit) {
    for (const l of links) {
      if (Number.isFinite(l.stage)) {
        layer.set(l.s, Math.max(layer.get(l.s) || 0, l.stage - 1));
        layer.set(l.t, Math.max(layer.get(l.t) || 0, l.stage));
      }
    }
  }
  return { layer };
}
function aggregate(links) {
  let m = new Map();
  for (const d of links) {
    if (d.v === 0) continue;
    let k = [d.s, d.t, d.stage, d.colour, d.group].join("\u0001"),
      o = m.get(k) || { ...d, v: 0, rows: 0, metaList: [] };
    o.v += d.v;
    o.rows++;
    if (Object.keys(d.meta || {}).length) o.metaList.push(d.meta);
    m.set(k, o);
  }
  return [...m.values()];
}
function makeModel(links, explicitStage) {
  let staged = explicitStage && links.every((l) => Number.isFinite(l.stage));
  if (staged) {
    let agg = aggregate(links),
      nodeMap = new Map(),
      outLinks = [];
    for (const [i, l] of agg.entries()) {
      let a = Math.max(0, l.stage - 1),
        b = Math.max(a + 1, l.stage),
        sid = `${a}|${l.s}`,
        tid = `${b}|${l.t}`;
      if (!nodeMap.has(sid)) nodeMap.set(sid, { id: sid, name: l.s, layer: a });
      if (!nodeMap.has(tid)) nodeMap.set(tid, { id: tid, name: l.t, layer: b });
      outLinks.push({
        id: `L${i}:${sid}>${tid}`,
        source: sid,
        target: tid,
        value: l.v,
        colour: l.colour,
        group: l.group,
        rows: l.rows,
        metaList: l.metaList,
      });
    }
    return { nodes: [...nodeMap.values()], links: outLinks };
  }
  let topo = topoLayers(links, false);
  if (topo.error) return topo;
  let agg = aggregate(links),
    nodeMap = new Map();
  for (const l of agg) {
    for (const n of [l.s, l.t])
      if (!nodeMap.has(n))
        nodeMap.set(n, { id: n, name: n, layer: topo.layer.get(n) || 0 });
  }
  let outLinks = agg.map((l, i) => ({
    id: `L${i}:${l.s}>${l.t}`,
    source: l.s,
    target: l.t,
    value: l.v,
    colour: l.colour,
    group: l.group,
    rows: l.rows,
    metaList: l.metaList,
  }));
  return { nodes: [...nodeMap.values()], links: outLinks };
}
function legacyWfsParse(rows) {
  if (!rows.length) return null;
  let dh = detectHeader(rows),
    h = dh.h,
    data = dh.data,
    si = hidx(h, ["WFSGROUP"]),
    ti = hidx(h, ["SUBSEQUENTWFSGROUP"]),
    ii = hidx(h, ["INITIATOR"]),
    zi = hidx(h, ["TERMINATOR"]);
  if (si < 0 || ti < 0) return null;
  const ignored = new Set(
    [si, ti, ii, zi, hidx(h, ["JOINKEY"])].filter((i) => i >= 0),
  );
  let periods = h
    .map((x, j) => ({ j, label: clean(x) }))
    .filter(
      (x) =>
        !ignored.has(x.j) &&
        data.some((r) => Number.isFinite(number(r[x.j])) && number(r[x.j]) > 0),
    );
  if (!periods.length) return null;
  const yes = (v) => ["YES", "TRUE", "1", "Y"].includes(norm(v)),
    node = (v) => {
      let q = clean(v),
        n = norm(q),
        m = n.match(/CONVERSATION(\d+)/);
      if (n.includes("HOSPITAL")) return "Hospital Referral";
      if (n.includes("INITIAL")) return "Initial Contact";
      if (m) return "Conversation " + m[1];
      if (n.includes("PURCHASE") || n.includes("PACKAGE"))
        return "Purchase Service";
      if (
        n === "NFA" ||
        n.includes("NOFURTHERACTION") ||
        n.includes("CLOSURE") ||
        n.includes("CANCEL")
      )
        return "NFA";
      return q || "Other";
    },
    fixed = (v) => {
      let n = norm(v),
        m = n.match(/CONVERSATION(\d+)/);
      return n.includes("HOSPITAL") || n.includes("INITIAL")
        ? 0
        : m
          ? +m[1]
          : null;
    };
  let routes = [];
  for (const r of data) {
    if (norm(r[si]) === "TOTAL") continue;
    let a = node(r[si]),
      b = node(r[ti]);
    if (!a || !b) continue;
    routes.push({
      a,
      b,
      i: ii >= 0 && yes(r[ii]),
      z: zi >= 0 && yes(r[zi]),
      r,
    });
  }
  if (!routes.length) return null;
  let st = new Map();
  routes.forEach((d) => {
    let a = fixed(d.a),
      b = fixed(d.b);
    if (d.i) a = 0;
    if (a != null) st.set(d.a, a);
    if (b != null) st.set(d.b, b);
  });
  for (let k = 0; k < 10; k++)
    routes.forEach((d) => {
      if (st.has(d.a) && !st.has(d.b) && !d.z) st.set(d.b, st.get(d.a) + 1);
      if (!st.has(d.a) && st.has(d.b) && !d.i)
        st.set(d.a, Math.max(0, st.get(d.b) - 1));
    });
  let links = [];
  for (const d of routes) {
    let a = st.get(d.a) ?? 0,
      b = d.z ? a + 1 : (st.get(d.b) ?? a + 1);
    if (b <= a) b = a + 1;
    for (const p of periods) {
      let v = number(d.r[p.j]);
      if (Number.isFinite(v) && v > 0)
        links.push({
          s: d.a,
          t: d.b,
          v,
          period: p.label,
          stage: b,
          colour: "",
          group: "",
          meta: {},
        });
    }
  }
  return links.length
    ? {
        links,
        periodIndex: 0,
        stageIndex: 0,
        valueLabel: "Value",
        groupLabel: "",
      }
    : null;
}
function build() {
  clearStatus();
  let rows = nonempty();
  if (!rows.length) return clear();
  let parsed = legacyWfsParse(rows) || densifyNodeTables(rows),
    dh = detectHeader(rows);
  if (
    !parsed &&
    hidx(dh.h, ["SERIES"]) >= 0 &&
    hidx(dh.h, ["SOURCE", "FROM"]) < 0
  ) {
    clear();
    status(
      "Add Source and Target columns to show where each amount goes, or choose the bar chart for categories and series.",
    );
    return;
  }
  if (!parsed) {
    parsed =
      nodesPlusLinks(dh.h, dh.data) ||
      rowsToLinks(dh.h, dh.data) ||
      wideToLinks(dh.h, dh.data);
  }
  if (!parsed || !parsed.links.length) {
    clear();
    status(
      "I could not identify this table. Use Source, Target and Value columns; a staged long table; a wide pathway with a numeric weight; or Node ID plus Source ID/Target ID tables.",
      "error",
    );
    return;
  }
  if (dh.inferred)
    status(
      "No headers were detected, so the first three columns were interpreted as Source, Target and Value.",
      "note",
    );
  if (parsed.groupLabel)
    status(
      `${parsed.groupLabel} is available as link metadata and appears in ribbon tooltips.`,
      `note`,
    );
  let periods =
    parsed.periodIndex >= 0
      ? [...new Set(parsed.links.map((x) => x.period).filter(Boolean))]
      : [];
  periodModels = [];
  if (periods.length) {
    for (const p of periods) {
      let mm = makeModel(
        parsed.links.filter((x) => x.period === p),
        parsed.stageIndex >= 0,
      );
      if (mm.error) {
        clear();
        status(mm.error);
        return;
      }
      periodModels.push({ label: p, model: mm });
    }
  } else {
    let mm = makeModel(parsed.links, parsed.stageIndex >= 0);
    if (mm.error) {
      clear();
      status(mm.error);
      return;
    }
    periodModels = [{ label: parsed.valueLabel, model: mm }];
  }
  activePeriod = Math.min(activePeriod, periodModels.length - 1);
  model = periodModels[activePeriod].model;
  let pc = $("#periodCtrl"),
    pr = $("#period");
  pc.style.display = periodModels.length > 1 ? "grid" : "none";
  pr.max = Math.max(0, periodModels.length - 1);
  pr.value = activePeriod;
  $("#periodLabel").textContent = periodModels[activePeriod].label;
  initialOrders();
  render();
}
function initialOrders() {
  let volume = new Map(model.nodes.map((n) => [n.id, 0]));
  model.links.forEach((l) => {
    volume.set(l.source, (volume.get(l.source) || 0) + l.value);
    volume.set(l.target, (volume.get(l.target) || 0) + l.value);
  });
  for (const layer of new Set(model.nodes.map((n) => n.layer))) {
    model.nodes
      .filter((n) => n.layer === layer)
      .sort(
        (a, b) =>
          (volume.get(b.id) || 0) - (volume.get(a.id) || 0) ||
          a.name.localeCompare(b.name),
      )
      .forEach((n, i) => {
        if (!nodeOrder.has(n.id)) nodeOrder.set(n.id, i);
      });
  }
  model.links
    .slice()
    .sort((a, b) => b.value - a.value)
    .forEach((l, i) => {
      if (!sourceLinkOrder.has(l.id)) sourceLinkOrder.set(l.id, i);
      if (!targetLinkOrder.has(l.id)) targetLinkOrder.set(l.id, i);
    });
}
function clear() {
  model = null;
  S.style("display", "none").selectAll("*").remove();
  $("#empty").style.display = "block";
  $("#legend").innerHTML = "";
  $("#det").disabled = $("#share").disabled = true;
}
function autoHeight() {
  let layers = d3.group(model.nodes, (d) => d.layer),
    max = Math.max(...[...layers.values()].map((a) => a.length)),
    labels = Math.max(...model.nodes.map((n) => n.name.length));
  return Math.max(360, 90 + max * 48 + (labels > 25 ? 50 : 0));
}
function render() {
  if (!model) return;
  let W = +$("#w").value,
    P = +$("#p").value,
    H = Math.max(+$("#h").value, autoHeight());
  if (+$("#h").value < H) $("#h").value = Math.min(H, +$("#h").max);
  H = +$("#h").value;
  $("#wv").textContent = W;
  $("#hv").textContent = H;
  $("#pv").textContent = P;
  $("#empty").style.display = "none";
  S.style("display", "block")
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .selectAll("*")
    .remove();
  let nr = (d) => nodeOrder.get(d.id) ?? 0,
    lr = (a, b) =>
      a.source.id === b.source.id
        ? (sourceLinkOrder.get(a.id) ?? a.index) -
          (sourceLinkOrder.get(b.id) ?? b.index)
        : a.target.id === b.target.id
          ? (targetLinkOrder.get(a.id) ?? a.index) -
            (targetLinkOrder.get(b.id) ?? b.index)
          : a.index - b.index;
  let layerCount = new Set(model.nodes.map((n) => n.layer)).size,
    isSimpleSankey = layerCount === 2,
    leftMargin = isSimpleSankey ? 170 : 20,
    rightMargin = isSimpleSankey ? 170 : 210;
  sk = d3
    .sankey()
    .nodeId((d) => d.id)
    .nodeWidth(16)
    .nodePadding(P)
    .nodeAlign((d) => d.layer)
    .nodeSort((a, b) => nr(a) - nr(b))
    .linkSort(lr)
    .extent([
      [leftMargin, 38],
      [W - rightMargin, H - 28],
    ]);
  try {
    lay = sk({
      nodes: model.nodes.map((d) => ({ ...d })),
      links: model.links.map((d) => ({ ...d })),
    });
  } catch (e) {
    status(
      "The table could not be laid out as a Sankey. Check for circular routes or steps that go backwards.",
    );
    return;
  }
  let defs = S.append("defs");
  lay.links.forEach((d, i) => {
    d.g = "g" + i;
    let g = defs
      .append("linearGradient")
      .attr("id", d.g)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d.source.x1)
      .attr("x2", d.target.x0);
    g.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d.colour || nodeColour(d.source, lay.nodes));
    g.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d.colour || nodeColour(d.target, lay.nodes));
  });
  let xs = [...new Set(lay.nodes.map((n) => n.x0))].sort((a, b) => a - b);
  S.append("g")
    .selectAll("text")
    .data(xs)
    .join("text")
    .attr("class", "stage")
    .attr("x", (d) => d + 8)
    .attr("y", 19)
    .text((d, i) =>
      i === 0 ? "Start" : i === xs.length - 1 ? "Outcome" : `Stage ${i}`,
    );
  let lg = S.append("g"),
    preview = S.append("g").style("display", "none");
  preview.append("path").attr("class", "dragPreview");
  preview.append("circle").attr("class", "dragDot").attr("r", 7);
  function tooltip(d, drag = false) {
    let meta = [];
    if (d.group) meta.push(d.group);
    if (d.rows > 1) meta.push(`${d.rows} rows combined`);
    let raw = d.metaList?.[0] || {};
    for (const [k, v] of Object.entries(raw))
      if (k && v) meta.push(`${k}: ${v}`);
    return `<b>${d.source.name} → ${d.target.name}</b><br>${d.value.toLocaleString()}${meta.length ? "<br>" + meta.join(" · ") : ""}${drag ? "<br>Release to place ribbon" : ""}`;
  }
  let ordered = lay.links.slice().sort((a, b) => b.width - a.width),
    q = lg
      .selectAll("path.link")
      .data(ordered, (d) => d.id)
      .join("path")
      .attr("class", "link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", (d) => `url(#${d.g})`)
      .attr("stroke-opacity", 0.58)
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .on("mousemove", (e, d) =>
        tip
          .style("opacity", 1)
          .style("left", e.clientX + 12 + "px")
          .style("top", e.clientY + 8 + "px")
          .html(ChartUtils.tooltip(tooltip(d))),
      )
      .on("mouseenter", (e, d) => q.classed("dim", (x) => x !== d))
      .on("mouseleave", () => {
        tip.style("opacity", 0);
        q.classed("dim", false);
      });
  let dragRibbon = d3
    .drag()
    .clickDistance(2)
    .on("start", (e, d) => {
      q.classed("dim", (x) => x !== d).classed("dragging", (x) => x === d);
      preview.style("display", null);
    })
    .on("drag", (e, d) => {
      let atSource = e.x < (d.source.x1 + d.target.x0) / 2,
        x1 = atSource ? e.x : d.source.x1,
        y1 = atSource ? e.y : d.y0,
        x2 = atSource ? d.target.x0 : e.x,
        y2 = atSource ? d.y1 : e.y,
        dx = Math.max(40, (x2 - x1) / 2);
      preview
        .select("path")
        .attr("d", `M${x1},${y1}C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`)
        .attr("stroke-width", Math.max(4, d.width));
      preview.select("circle").attr("cx", e.x).attr("cy", e.y);
      tip
        .style("opacity", 1)
        .style("left", e.sourceEvent.clientX + 12 + "px")
        .style("top", e.sourceEvent.clientY + 8 + "px")
        .html(ChartUtils.tooltip(tooltip(d, true)));
    })
    .on("end", (e, d) => {
      let atSource = e.x < (d.source.x1 + d.target.x0) / 2,
        sib = (atSource ? d.source.sourceLinks : d.target.targetLinks)
          .slice()
          .sort((a, b) => (atSource ? a.y0 - b.y0 : a.y1 - b.y1)),
        anchor = atSource ? d.source : d.target,
        span = Math.max(1, anchor.y1 - anchor.y0),
        idx = Math.max(
          0,
          Math.min(
            sib.length - 1,
            Math.floor(((e.y - anchor.y0) / span) * sib.length),
          ),
        );
      sib = sib.filter((x) => x !== d);
      sib.splice(idx, 0, d);
      sib.forEach((x, i) =>
        (atSource ? sourceLinkOrder : targetLinkOrder).set(x.id, i),
      );
      preview.style("display", "none");
      tip.style("opacity", 0);
      render();
    });
  lg.selectAll("path.linkHit")
    .data(ordered, (d) => d.id)
    .join("path")
    .attr("class", "linkHit")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke-width", (d) => Math.max(18, d.width + 12))
    .on("mousemove", (e, d) =>
      tip
        .style("opacity", 1)
        .style("left", e.clientX + 12 + "px")
        .style("top", e.clientY + 8 + "px")
        .html(ChartUtils.tooltip(tooltip(d))),
    )
    .on("mouseenter", (e, d) => q.classed("dim", (x) => x !== d))
    .on("mouseleave", () => {
      tip.style("opacity", 0);
      q.classed("dim", false);
    })
    .call(dragRibbon);
  let ng = S.append("g")
    .selectAll("g")
    .data(lay.nodes)
    .join("g")
    .attr("class", "node")
    .call(
      d3
        .drag()
        .on("drag", function (e, d) {
          let h = d.y1 - d.y0;
          d.y0 = Math.max(38, Math.min(H - 28 - h, e.y - h / 2));
          d.y1 = d.y0 + h;
          sk.update(lay);
          d3.select(this).select("rect").attr("y", d.y0);
          d3.select(this)
            .selectAll("text")
            .attr("y", (_, i) => (d.y0 + d.y1) / 2 + (i ? 9 : -6));
          lg.selectAll("path").attr("d", d3.sankeyLinkHorizontal());
        })
        .on("end", (e, d) => {
          lay.nodes
            .filter((n) => n.layer === d.layer)
            .sort((a, b) => a.y0 - b.y0)
            .forEach((n, i) => nodeOrder.set(n.id, i));
          render();
        }),
    );
  ng.append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => Math.max(2, d.y1 - d.y0))
    .attr("rx", 1.5)
    .attr("fill", (d) => nodeColour(d, lay.nodes));
  let small = (d) => d.y1 - d.y0 < 34,
    labelX = (d) =>
      isSimpleSankey ? (d.layer === 0 ? d.x0 - 12 : d.x1 + 12) : d.x1 + 8,
    labelAnchor = (d) =>
      isSimpleSankey ? (d.layer === 0 ? "end" : "start") : "start";
  ng.append("text")
    .attr("x", labelX)
    .attr("y", (d) => (d.y0 + d.y1) / 2 + (small(d) ? 4 : -6))
    .attr("text-anchor", labelAnchor)
    .text((d) =>
      small(d) ? `${d.name}  ${d.value.toLocaleString()}` : d.name,
    );
  ng.filter((d) => !small(d))
    .append("text")
    .attr("class", "value")
    .attr("x", labelX)
    .attr("y", (d) => (d.y0 + d.y1) / 2 + 9)
    .attr("text-anchor", labelAnchor)
    .text((d) => d.value.toLocaleString());
  legend();
  $("#det").disabled = $("#share").disabled = false;
}
function openColour(e, name) {
  let pop = $("#colourPop"),
    hex = $("#hex"),
    native = $("#nativeColour"),
    v = nodeColour(
      model.nodes.find((n) => n.name === name) || { name, layer: 0 },
      model.nodes,
    ).toUpperCase(),
    r = e.currentTarget.getBoundingClientRect();
  pop.style.left = Math.min(innerWidth - 150, r.left) + "px";
  pop.style.top = r.bottom + 7 + "px";
  pop.classList.add("open");
  hex.value = v;
  native.value = v;
  hex.focus();
  hex.select();
  let apply = (v) => {
    if (/^#[0-9A-F]{6}$/i.test(v)) {
      C[name] = v.toUpperCase();
      render();
    }
  };
  hex.oninput = () => apply(hex.value);
  native.oninput = () => {
    hex.value = native.value.toUpperCase();
    apply(native.value);
  };
}
function legend() {
  let seen = new Set(),
    items = model.nodes
      .filter((n) => {
        let k = n.layer + "|" + n.name;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.layer - b.layer || a.name.localeCompare(b.name)),
    b = $("#legend");
  b.innerHTML = "";
  items.forEach((n) => {
    let l = document.createElement("label"),
      i = document.createElement("button");
    i.type = "button";
    i.className = "swatch";
    i.style.background = nodeColour(n, model.nodes);
    i.title = "Change colour for " + n.name;
    i.onclick = (e) => openColour(e, n.name);
    l.append(i, document.createTextNode(n.name));
    b.append(l);
  });
}
function crossingScore(pos) {
  let score = 0,
    layer = new Map(model.nodes.map((n) => [n.id, n.layer]));
  for (let i = 0; i < model.links.length; i++)
    for (let j = i + 1; j < model.links.length; j++) {
      const a = model.links[i],
        b = model.links[j];
      if (
        layer.get(a.source) !== layer.get(b.source) ||
        layer.get(a.target) !== layer.get(b.target)
      )
        continue;
      if (
        ((pos.get(a.source) || 0) - (pos.get(b.source) || 0)) *
          ((pos.get(a.target) || 0) - (pos.get(b.target) || 0)) <
        0
      )
        score += Math.min(a.value, b.value);
    }
  return score;
}
function detangle() {
  let best = new Map(nodeOrder),
    score = crossingScore(best);
  const layers = [...new Set(model.nodes.map((n) => n.layer))].sort(
    (a, b) => a - b,
  );
  // Adjacent swaps only commit a strictly better order, so repeated clicks cannot worsen it.
  for (let pass = 0; pass < 12; pass++) {
    let improved = false;
    for (const layer of layers) {
      const ns = model.nodes
        .filter((n) => n.layer === layer)
        .sort((a, b) => (best.get(a.id) || 0) - (best.get(b.id) || 0));
      for (let i = 0; i < ns.length - 1; i++) {
        const a = ns[i].id,
          b = ns[i + 1].id,
          candidate = new Map(best);
        candidate.set(a, best.get(b) || 0);
        candidate.set(b, best.get(a) || 0);
        const next = crossingScore(candidate);
        if (next < score) {
          best = candidate;
          score = next;
          improved = true;
          [ns[i], ns[i + 1]] = [ns[i + 1], ns[i]];
        }
      }
    }
    if (!improved) break;
  }
  nodeOrder = best;
  sourceLinkOrder.clear();
  targetLinkOrder.clear();
  for (const node of model.nodes) {
    model.links
      .filter((l) => l.source === node.id)
      .sort((a, b) => (best.get(a.target) || 0) - (best.get(b.target) || 0))
      .forEach((l, i) => sourceLinkOrder.set(l.id, i));
    model.links
      .filter((l) => l.target === node.id)
      .sort((a, b) => (best.get(a.source) || 0) - (best.get(b.source) || 0))
      .forEach((l, i) => targetLinkOrder.set(l.id, i));
  }
  render();
}
function svgText() {
  return ChartExport.frame("Chart").svg;
}
function fileBase() {
  return (
    ($("#diagramTitle").value || "sankey")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 120) || "sankey"
  );
}
function dl(blob, name) {
  let u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 500);
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
    x.drawImage(im, 0, 0, c.width, c.height);
    c.toBlob((b) => dl(b, fileBase() + ".png"), "image/png");
    URL.revokeObjectURL(u);
  };
  im.src = u;
}
function interactive() {
  const old = activePeriod,
    frames = [];
  try {
    for (let i = 0; i < periodModels.length; i++) {
      activePeriod = i;
      model = periodModels[i].model;
      initialOrders();
      render();
      frames.push(ChartExport.frame(periodModels[i].label));
    }
  } finally {
    activePeriod = old;
    model = periodModels[old].model;
    render();
  }
  ChartExport.download(
    frames.length ? frames : [ChartExport.frame("Chart")],
    old,
  );
}
$("#w").oninput = () => {
  widthTouched = true;
  render();
};
["h", "p"].forEach((x) => ($("#" + x).oninput = render));
requestAnimationFrame(() => {
  if (widthTouched) return;
  let el = document.querySelector(".canvas"),
    r = $("#w"),
    fit = Math.floor(el.clientWidth / 20) * 20;
  r.value = Math.max(+r.min, Math.min(+r.max, fit));
  if (model) render();
});
$("#reset").onclick = () => {
  M = [Array(6).fill("")];
  model = null;
  periodModels = [];
  activePeriod = 0;
  $("#diagramTitle").value = "Enter title here";
  grid();
  clear();
  clearStatus();
};
let detTip = $("#detTip"),
  detBtn = $("#det");
detBtn.onmouseenter = () => {
  let r = detBtn.getBoundingClientRect();
  detTip.style.left =
    Math.max(8, Math.min(innerWidth - 253, r.left + r.width / 2 - 122)) + "px";
  detTip.style.top = r.bottom + 8 + "px";
  detTip.classList.add("open");
};
detBtn.onmouseleave = () => detTip.classList.remove("open");
$("#period").oninput = (e) => {
  activePeriod = +e.target.value;
  model = periodModels[activePeriod].model;
  $("#periodLabel").textContent = periodModels[activePeriod].label;
  initialOrders();
  render();
};
document.addEventListener("mouseup", endSelection);
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
});
$("#det").onclick = detangle;
$("#share").onclick = () => $("#menu").classList.toggle("open");
$("#menu").onclick = (e) => {
  let x = e.target.dataset.x;
  if (x === "svg")
    dl(new Blob([svgText()], { type: "image/svg+xml" }), fileBase() + ".svg");
  if (x === "png") png();
  if (x === "html") interactive();
  $("#menu").classList.remove("open");
};
grid();

window.chartSettings = {
  get() {
    return structuredClone({
      activePeriod: activePeriod,
      widthTouched: widthTouched,
      nodeOrder: [...nodeOrder],
      sourceLinkOrder: [...sourceLinkOrder],
      targetLinkOrder: [...targetLinkOrder],
      C: C,
    });
  },
  set(s) {
    if (!s || typeof s !== "object") return;
    if (
      typeof s.activePeriod === typeof activePeriod &&
      (typeof s.activePeriod !== "number" || Number.isFinite(s.activePeriod))
    )
      activePeriod = s.activePeriod;
    if (
      typeof s.widthTouched === typeof widthTouched &&
      (typeof s.widthTouched !== "number" || Number.isFinite(s.widthTouched))
    )
      widthTouched = s.widthTouched;
    if (Array.isArray(s.nodeOrder))
      nodeOrder = new Map(
        s.nodeOrder.filter(
          (x) => Array.isArray(x) && x.length === 2 && typeof x[1] === "number",
        ),
      );
    if (Array.isArray(s.sourceLinkOrder))
      sourceLinkOrder = new Map(
        s.sourceLinkOrder.filter(
          (x) => Array.isArray(x) && x.length === 2 && typeof x[1] === "number",
        ),
      );
    if (Array.isArray(s.targetLinkOrder))
      targetLinkOrder = new Map(
        s.targetLinkOrder.filter(
          (x) => Array.isArray(x) && x.length === 2 && typeof x[1] === "number",
        ),
      );
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
  },
  items() {
    return model
      ? model.nodes
          .slice()
          .sort(
            (a, b) =>
              a.layer - b.layer ||
              (nodeOrder.get(a.id) || 0) - (nodeOrder.get(b.id) || 0),
          )
          .map((x) => ({ id: x.id, name: x.name }))
      : [];
  },
  move(id, delta) {
    const n = model?.nodes.find((x) => x.id === id);
    if (!n) return;
    const list = model.nodes
        .filter((x) => x.layer === n.layer)
        .sort(
          (a, b) => (nodeOrder.get(a.id) || 0) - (nodeOrder.get(b.id) || 0),
        ),
      i = list.findIndex((x) => x.id === id),
      j = Math.max(0, Math.min(list.length - 1, i + delta));
    list.splice(i, 1);
    list.splice(j, 0, n);
    list.forEach((x, k) => nodeOrder.set(x.id, k));
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
