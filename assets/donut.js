let M = [Array(5).fill("")],
  timer,
  data = [],
  periodCols = [],
  activePeriod = 0,
  titleEdited = false,
  chartType = "donut",
  labelMode = "both";
const $ = (s) => document.querySelector(s),
  S = d3.select("#svg"),
  tip = d3.select("#tip"),
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
    "#F57022",
    "#B240FF",
    "#7CBE52",
    "#FF5C67",
    "#F9B322",
    "#BAC437",
  ],
  C = Object.create(null);
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
function num(v) {
  return ChartUtils.number(v);
}
function refresh(ms = 100) {
  clearTimeout(timer);
  timer = setTimeout(build, ms);
}
function periodName(v) {
  return String(v || "")
    .trim()
    .replace(/_/g, " ");
}
function getPeriod(j) {
  let a = new Map();
  M.slice(1).forEach((r) => {
    let name = String(r[0] || "").trim(),
      value = num(r[j]);
    if (name && name.toUpperCase() !== "TOTAL" && value > 0)
      a.set(name, (a.get(name) || 0) + value);
  });
  return [...a]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
function build() {
  let u = M.filter((r) => r.some((x) => String(x).trim()));
  if (u.length < 2) return clear();
  let h = u[0];
  periodCols = h
    .map((x, j) => ({ j, label: String(x || "").trim() }))
    .filter(
      (x) => x.j !== 0 && x.label && u.slice(1).some((r) => num(r[x.j]) > 0),
    );
  if (!periodCols.length) return clear();
  activePeriod = Math.min(activePeriod, periodCols.length - 1);
  data = getPeriod(periodCols[activePeriod].j);
  if (!data.length) return clear();
  data.forEach((d) => {
    if (!C[d.name]) C[d.name] = palette[Object.keys(C).length % palette.length];
  });
  $("#periodCtrl").style.display = periodCols.length > 1 ? "grid" : "none";
  $("#period").min = 0;
  $("#period").max = periodCols.length - 1;
  $("#period").value = activePeriod;
  $("#periodLabel").textContent = periodName(periodCols[activePeriod].label);
  if (!titleEdited)
    $("#diagramTitle").value =
      "Services · " + periodName(periodCols[activePeriod].label);
  render();
}
function clear() {
  data = [];
  S.style("display", "none").selectAll("*").remove();
  $("#empty").style.display = "block";
  $("#legend").innerHTML = "";
  $("#share").disabled = true;
}
function spread(pie, r) {
  let groups = { left: [], right: [] };
  pie
    .filter((d) => d.endAngle - d.startAngle > 0.025)
    .forEach((d) => {
      let a = (d.startAngle + d.endAngle) / 2,
        k = Math.sin(a) >= 0 ? "right" : "left";
      groups[k].push({ d, a, y: -Math.cos(a) * (r + 38) });
    });
  for (const k of ["left", "right"]) {
    let q = groups[k].sort((a, b) => a.y - b.y),
      gap = 27,
      min = -(r + 45),
      max = r + 45;
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
  }
  return [...groups.left, ...groups.right];
}
function draw(target, D, interactive = false) {
  let size = D.size,
    longest =
      d3.max((D.data || []).map((d) => String(d.name || "").length)) || 0,
    W = Math.round(Math.max(size * 2.2, size + 390 + longest * 8)),
    H = Math.round(size * 1.28),
    cx = W / 2,
    cy = H / 2,
    r = Math.max(54, Math.min(W - 440, H - 140) / 2),
    total = d3.sum(D.data, (d) => d.value),
    pie = d3
      .pie()
      .sort(null)
      .startAngle(-Math.PI / 4)
      .endAngle((7 * Math.PI) / 4)
      .value((d) => d.value)
      .padAngle(Math.min(0.18, (D.gap * Math.PI) / 180))(D.data),
    arc = d3
      .arc()
      .innerRadius((r * D.hole) / 100)
      .outerRadius(r)
      .cornerRadius(Math.min(8, D.gap * 1.1));
  target
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .selectAll("*")
    .remove();
  let g = target.append("g").attr("transform", `translate(${cx},${cy})`),
    paths = g
      .selectAll(".slice")
      .data(pie)
      .join("path")
      .attr("class", "slice")
      .attr("d", arc)
      .attr("fill", (d) => D.colors[d.data.name] || "#888")
      .attr("stroke-width", Math.max(1, D.gap * 0.65))
      .on("mouseenter", (e, d) => highlight(d, true))
      .on("mousemove", (e) =>
        tip
          .style("left", e.clientX + 12 + "px")
          .style("top", e.clientY + 8 + "px"),
      )
      .on("mouseleave", () => highlight(null, false));
  let labs = spread(pie, r),
    lx = r + 74;
  g.selectAll(".leader")
    .data(labs)
    .join("polyline")
    .attr("class", "leader")
    .attr("points", (x) => {
      let side = Math.sin(x.a) >= 0 ? 1 : -1,
        start = [Math.sin(x.a) * (r + 2), -Math.cos(x.a) * (r + 2)],
        radial = [Math.sin(x.a) * (r + 26), -Math.cos(x.a) * (r + 26)],
        elbow = [side * (r + 50), x.y],
        end = [side * (lx - 7), x.y];
      return [start, radial, elbow, end];
    });
  let l = g
    .selectAll(".lab")
    .data(labs)
    .join("g")
    .attr("class", "lab")
    .attr(
      "transform",
      (x) => `translate(${(Math.sin(x.a) >= 0 ? 1 : -1) * lx},${x.y})`,
    )
    .attr("text-anchor", (x) => (Math.sin(x.a) >= 0 ? "start" : "end"));
  l.append("text")
    .attr("class", "label")
    .attr("y", -3)
    .text((x) => x.d.data.name);
  l.append("text")
    .attr("class", "value")
    .attr("y", 12)
    .text((x) =>
      D.labelMode === "value"
        ? x.d.data.value.toLocaleString()
        : D.labelMode === "percent"
          ? ((x.d.data.value / total) * 100).toFixed(1) + "%"
          : `${x.d.data.value.toLocaleString()} · ${((x.d.data.value / total) * 100).toFixed(1)}%`,
    );
  l.on("mouseenter", (e, x) => highlight(x.d, true))
    .on("mousemove", (e) =>
      tip
        .style("left", e.clientX + 12 + "px")
        .style("top", e.clientY + 8 + "px"),
    )
    .on("mouseleave", () => highlight(null, false));
  let dropIndex = null,
    preview = g
      .append("line")
      .attr("class", "dropPreview")
      .style("display", "none");
  l.call(
    d3
      .drag()
      .clickDistance(3)
      .on("start", function (e, x) {
        dropIndex = data.indexOf(x.d.data);
        preview.style("display", null);
      })
      .on("drag", function (e, x) {
        let ordered = labs.slice().sort((a, b) => a.y - b.y),
          nearest = ordered.reduce(
            (best, z) =>
              Math.abs(z.y - e.y) < Math.abs(best.y - e.y) ? z : best,
            ordered[0],
          );
        dropIndex = data.indexOf(nearest.d.data);
        let side = Math.sin(nearest.a) >= 0 ? 1 : -1;
        preview
          .attr("x1", side * (lx - 18))
          .attr("x2", side * (lx + 18))
          .attr("y1", nearest.y + 8)
          .attr("y2", nearest.y + 8);
      })
      .on("end", function (e, x) {
        preview.style("display", "none");
        let from = data.indexOf(x.d.data);
        if (
          dropIndex != null &&
          from >= 0 &&
          dropIndex >= 0 &&
          from !== dropIndex
        ) {
          let item = data.splice(from, 1)[0];
          data.splice(dropIndex, 0, item);
          render();
        }
        dropIndex = null;
      }),
  );
  function highlight(d, on) {
    paths.classed("dim", (x) => on && x !== d);
    g.selectAll(".lab").classed("active", (x) => on && x.d === d);
    g.selectAll(".leader").classed("active", (x) => on && x.d === d);
    if (on && d)
      tip
        .style("opacity", 1)
        .html(
          ChartUtils.tooltip(
            `<b>${d.data.name}</b><br>${d.data.value.toLocaleString()} · ${((d.data.value / total) * 100).toFixed(1)}%`,
          ),
        );
    else tip.style("opacity", 0);
  }
  if (D.hole > 0)
    g.append("text")
      .attr("class", "centreTotal")
      .attr("x", 0)
      .attr("y", 2)
      .attr("text-anchor", "middle")
      .text(total.toLocaleString());
  if (D.hole > 0)
    g.append("text")
      .attr("class", "centreLabel")
      .attr("x", 0)
      .attr("y", 24)
      .attr("text-anchor", "middle")
      .text("Total");
}
function render() {
  let D = {
    data,
    colors: C,
    size: +$("#size").value,
    gap: +$("#p").value,
    hole: chartType === "pie" ? 0 : +$("#hole").value,
    labelMode,
  };
  $("#sizev").textContent = D.size;
  $("#pv").textContent = D.gap;
  $("#holev").textContent = D.hole + "%";
  $("#empty").style.display = "none";
  S.style("display", "block");
  draw(S, D);
  legend();
  $("#share").disabled = false;
}
function legend() {
  let b = $("#legend");
  b.innerHTML = "";
  data.forEach((x) => {
    let l = document.createElement("label"),
      i = document.createElement("button");
    i.className = "swatch";
    i.style.background = C[x.name];
    i.onclick = (e) => openColour(e, x.name);
    l.append(i, document.createTextNode(x.name));
    b.append(l);
  });
}
function openColour(e, n) {
  e.preventDefault();
  let pop = $("#colourPop"),
    hex = $("#hex"),
    native = $("#nativeColour"),
    r = e.currentTarget.getBoundingClientRect();
  pop.style.left = Math.min(innerWidth - 150, r.left) + "px";
  pop.style.top = r.bottom + 7 + "px";
  pop.classList.add("open");
  hex.value = C[n];
  native.value = C[n];
  let apply = (v) => {
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      C[n] = v;
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
  let c = $("#svg").cloneNode(true);
  c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  let st = document.createElementNS("http://www.w3.org/2000/svg", "style");
  st.textContent =
    "svg{background:transparent}text{font-family:Inter,Segoe UI,sans-serif}.label{font-size:12px;font-weight:700;fill:#17212b}.value,.centreLabel{font-size:11px;fill:#707986}.centreTotal{font-size:24px;font-weight:800;fill:#17212b;text-anchor:middle}.centreLabel{text-anchor:middle}.leader{fill:none;stroke:#aeb8c0;stroke-width:1}.dropPreview{stroke:#172b3f;stroke-width:2;stroke-dasharray:5 4;pointer-events:none}.slice{stroke:#fff}";
  c.prepend(st);
  return new XMLSerializer().serializeToString(c);
}
function base() {
  return ($("#diagramTitle").value || "donut chart").replace(
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
  const old = activePeriod,
    frames = [];
  try {
    for (let i = 0; i < periodCols.length; i++) {
      activePeriod = i;
      data = getPeriod(periodCols[i].j);
      render();
      frames.push(ChartExport.frame(periodCols[i].label));
    }
  } finally {
    activePeriod = old;
    data = getPeriod(periodCols[old].j);
    render();
  }
  ChartExport.download(frames, old);
}
$("#typeToggle").onclick = () => {
  chartType = chartType === "donut" ? "pie" : "donut";
  $("#typeToggle").textContent = chartType === "donut" ? "Donut" : "Pie";
  $("#hole").closest(".ctrl").style.display =
    chartType === "pie" ? "none" : "grid";
  render();
};
$("#labelToggle").onclick = () => {
  let a = ["both", "value", "percent"],
    i = a.indexOf(labelMode);
  labelMode = a[(i + 1) % 3];
  $("#labelToggle").textContent =
    labelMode === "both" ? "Value + %" : labelMode === "value" ? "Value" : "%";
  render();
};
["size", "p", "hole"].forEach((x) => ($("#" + x).oninput = render));
$("#period").oninput = (e) => {
  let t = $("#diagramTitle").value,
    z = titleEdited;
  activePeriod = +e.target.value;
  titleEdited = true;
  build();
  $("#diagramTitle").value = t;
  titleEdited = z;
};
$("#diagramTitle").oninput = () => (titleEdited = true);
$("#reset").onclick = () => {
  M = [Array(5).fill("")];
  titleEdited = false;
  grid();
  clear();
};
$("#share").onclick = () => $("#menu").classList.toggle("open");
$("#menu").onclick = (e) => {
  if (e.target.dataset.x === "svg")
    dl(new Blob([svgText()], { type: "image/svg+xml" }), base() + ".svg");
  if (e.target.dataset.x === "png") png();
  if (e.target.dataset.x === "html") interactive();
  $("#menu").classList.remove("open");
};
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".colourPop") && !e.target.closest(".swatch"))
    $("#colourPop").classList.remove("open");
});
grid();

window.chartSettings = {
  get() {
    return structuredClone({
      activePeriod: activePeriod,
      titleEdited: titleEdited,
      chartType: chartType,
      labelMode: labelMode,
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
      typeof s.titleEdited === typeof titleEdited &&
      (typeof s.titleEdited !== "number" || Number.isFinite(s.titleEdited))
    )
      titleEdited = s.titleEdited;
    if (
      typeof s.chartType === typeof chartType &&
      (typeof s.chartType !== "number" || Number.isFinite(s.chartType))
    )
      chartType = s.chartType;
    if (
      typeof s.labelMode === typeof labelMode &&
      (typeof s.labelMode !== "number" || Number.isFinite(s.labelMode))
    )
      labelMode = s.labelMode;
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
    $("#typeToggle").textContent = chartType === "pie" ? "Pie" : "Donut";
    $("#labelToggle").textContent = {
      both: "Value + %",
      value: "Value",
      percent: "%",
    }[labelMode];
    $("#hole").closest(".ctrl").style.display =
      chartType === "pie" ? "none" : "grid";
  },
  items() {
    return data.map((x) => ({ id: x.name, name: x.name }));
  },
  move(id, delta) {
    const i = data.findIndex((x) => x.name === id),
      j = Math.max(0, Math.min(data.length - 1, i + delta));
    if (i < 0) return;
    const x = data.splice(i, 1)[0];
    data.splice(j, 0, x);
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
