let M = [Array(8).fill("")],
  all = [],
  model = [],
  periods = [],
  active = 0,
  timer,
  labels = false,
  trends = false,
  zero = false,
  equal = false,
  hidden = new Set();
const $ = (s) => document.querySelector(s),
  S = d3.select("#svg"),
  tip = d3.select("#tip"),
  P = [
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
  C = Object.create(null);
const cl = (v) => String(v ?? "").trim(),
  nm = (v) =>
    cl(v)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""),
  num = ChartUtils.number,
  A = {
    x: ["X", "XVALUE", "XAXIS", "INPUT"],
    y: ["Y", "YVALUE", "YAXIS", "VALUE", "OUTPUT"],
    s: ["SERIES", "GROUP", "CATEGORY", "TYPE", "SEGMENT", "COHORT"],
    z: ["SIZE", "BUBBLE", "WEIGHT", "VOLUME", "COUNT", "POPULATION"],
    l: ["LABEL", "NAME", "ITEM", "POINT", "SERVICE"],
    p: ["PERIOD", "DATE", "MONTH", "QUARTER", "YEAR", "WEEK", "TIME"],
    c: ["COLOUR", "COLOR", "HEX"],
    n: ["NOTE", "ANNOTATION", "COMMENT"],
  },
  ix = (h, a) => h.findIndex((x) => a.includes(nm(x)));
function grid() {}
function paste(e) {
  e.preventDefault();
  let R = +e.currentTarget.dataset.r,
    Cc = +e.currentTarget.dataset.c,
    a = e.clipboardData
      .getData("text/plain")
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((r) => r.split("\t"));
  while (M.length < R + a.length) M.push([]);
  M.forEach((r) => {
    while (r.length < Cc + Math.max(...a.map((x) => x.length))) r.push("");
  });
  a.forEach((r, i) => r.forEach((v, j) => (M[R + i][Cc + j] = v)));
  grid();
  refresh(0);
}
function refresh(ms = 80) {
  clearTimeout(timer);
  timer = setTimeout(build, ms);
}
function rows() {
  return M.filter((r) => r.some(cl));
}
function parse() {
  let rr = rows();
  if (rr.length < 2) return null;
  let h = rr[0],
    data = rr.slice(1),
    xi = ix(h, A.x),
    yi = ix(h, A.y),
    si = ix(h, A.s),
    zi = ix(h, A.z),
    li = ix(h, A.l),
    pi = ix(h, A.p),
    ci = ix(h, A.c),
    ni = ix(h, A.n),
    out = [];
  if (xi < 0 || yi < 0) {
    let ns = h
      .map((_, i) => i)
      .filter((i) => data.some((r) => Number.isFinite(num(r[i]))));
    if (ns.length < 2) return null;
    xi = ns[0];
    for (const j of ns.slice(1)) {
      if (j === zi || j === pi) continue;
      for (const r of data) {
        let x = num(r[xi]),
          y = num(r[j]);
        if (Number.isFinite(x) && Number.isFinite(y))
          out.push({
            x,
            y,
            series: cl(h[j]) || "Series",
            size: NaN,
            label: li >= 0 ? cl(r[li]) : "",
            period: pi >= 0 ? cl(r[pi]) || "All" : "All",
            meta: {},
          });
      }
    }
  } else
    for (const r of data) {
      let x = num(r[xi]),
        y = num(r[yi]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      let used = [xi, yi, si, zi, li, pi, ci, ni],
        meta = {};
      h.forEach((k, j) => {
        if (!used.includes(j) && cl(k) && cl(r[j])) meta[cl(k)] = cl(r[j]);
      });
      out.push({
        x,
        y,
        series: si >= 0 ? cl(r[si]) || "Series 1" : "Series 1",
        size: zi >= 0 ? num(r[zi]) : NaN,
        label: li >= 0 ? cl(r[li]) : "",
        period: pi >= 0 ? cl(r[pi]) || "All" : "All",
        colour: ci >= 0 ? cl(r[ci]) : "",
        note: ni >= 0 ? cl(r[ni]) : "",
        meta,
      });
    }
  out.forEach((d) => {
    if (/^#[0-9a-f]{6}$/i.test(d.colour)) C[d.series] = d.colour;
    if (!C[d.series]) C[d.series] = P[Object.keys(C).length % P.length];
  });
  return out.length
    ? { out, xt: cl(h[xi]) || "X", yt: cl(h[yi]) || "Y" }
    : null;
}
function build() {
  let p = parse();
  if (!p) return clear();
  all = p.out;
  all.xt = p.xt;
  all.yt = p.yt;
  periods = [...new Set(all.map((d) => d.period))];
  active = Math.min(active, periods.length - 1);
  model = all.filter((d) => d.period === periods[active]);
  model.xt = p.xt;
  model.yt = p.yt;
  $("#periodCtrl").style.display = periods.length > 1 ? "grid" : "none";
  $("#period").min = 0;
  $("#period").max = periods.length - 1;
  $("#period").value = active;
  $("#periodLabel").textContent = periods[active];
  render();
}
function clear() {
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
function reg(v) {
  if (v.length < 2) return null;
  let X = d3.mean(v, (d) => d.x),
    Y = d3.mean(v, (d) => d.y),
    den = d3.sum(v, (d) => (d.x - X) ** 2);
  if (!den) return null;
  let m = d3.sum(v, (d) => (d.x - X) * (d.y - Y)) / den,
    b = Y - m * X,
    a = d3.extent(v, (d) => d.x);
  return [
    { x: a[0], y: m * a[0] + b },
    { x: a[1], y: m * a[1] + b },
  ];
}
function draw(target, D) {
  let W = D.w,
    H = D.h,
    m = { top: 24, right: 28, bottom: 62, left: 72 },
    iw = W - m.left - m.right,
    ih = H - m.top - m.bottom,
    pts = D.data.filter((d) => !hidden.has(d.series)),
    domain = all.filter((d) => !hidden.has(d.series)),
    xe = d3.extent(domain, (d) => d.x),
    ye = d3.extent(domain, (d) => d.y),
    xp = (xe[1] - xe[0] || 1) * 0.08,
    yp = (ye[1] - ye[0] || 1) * 0.1,
    xd = [zero ? Math.min(0, xe[0]) : xe[0] - xp, xe[1] + xp],
    yd = [zero ? Math.min(0, ye[0]) : ye[0] - yp, ye[1] + yp];
  if (!domain.length) {
    target.selectAll("*").remove();
    return;
  }
  if (zero) {
    xd[1] = Math.max(0, xd[1]);
    yd[1] = Math.max(0, yd[1]);
  }
  if (equal) {
    let a = Math.min(...xd, ...yd),
      b = Math.max(...xd, ...yd);
    xd = yd = [a, b];
  }
  let x = d3.scaleLinear().domain(xd).nice().range([0, iw]),
    y = d3.scaleLinear().domain(yd).nice().range([ih, 0]),
    zs = domain.map((d) => d.size).filter(Number.isFinite),
    r = zs.length
      ? d3
          .scaleSqrt()
          .domain(d3.extent(zs))
          .range([3, D.ps * 2.5 * D.bs])
      : () => D.ps;
  target
    .attr("width", W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .selectAll("*")
    .remove();
  let g = target.append("g").attr("transform", `translate(${m.left},${m.top})`);
  const ticks = (scale, id) => {
    const step = +$(id).value,
      [lo, hi] = scale.domain();
    if (!(step > 0) || (hi - lo) / step > 200) return null;
    return d3
      .range(Math.ceil(lo / step), Math.floor(hi / step) + 1)
      .map((n) => +(n * step).toPrecision(12));
  };
  const xt = ticks(x, "#xGrid"),
    yt = ticks(y, "#yGrid");
  g.append("g")
    .attr("class", "gridline")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickValues(xt).tickSize(-ih).tickFormat(""));
  g.append("g")
    .attr("class", "gridline")
    .call(d3.axisLeft(y).tickValues(yt).tickSize(-iw).tickFormat(""));
  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickValues(yt).tickFormat(d3.format("~s")));
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format("~s")));
  g.append("text")
    .attr("class", "axisTitle")
    .attr("x", iw / 2)
    .attr("y", ih + 48)
    .attr("text-anchor", "middle")
    .text(all.xt);
  g.append("text")
    .attr("class", "axisTitle")
    .attr("transform", "rotate(-90)")
    .attr("x", -ih / 2)
    .attr("y", -52)
    .attr("text-anchor", "middle")
    .text(all.yt);
  if (trends)
    g.selectAll(".trend")
      .data(
        d3
          .groups(pts, (d) => d.series)
          .map(([s, v]) => ({ s, v: reg(v) }))
          .filter((d) => d.v),
      )
      .join("path")
      .attr("class", "trend")
      .attr("stroke", (d) => C[d.s])
      .attr("d", (d) =>
        d3
          .line()
          .x((q) => x(q.x))
          .y((q) => y(q.y))(d.v),
      );
  let cs = g
      .selectAll(".point")
      .data(pts)
      .join("circle")
      .attr("class", "point")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", (d) =>
        Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps,
      )
      .attr("fill", (d) => C[d.series])
      .attr("fill-opacity", D.op),
    hits = g
      .selectAll(".pointHit")
      .data(pts)
      .join("circle")
      .attr("class", "pointHit")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", (d) =>
        Math.max(
          11,
          (Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps) + 5,
        ),
      )
      .on("mouseenter", (e, d) => {
        cs.classed("dim", (q) => q !== d);
        tip.style("opacity", 1).html(
          ChartUtils.tooltip(
            `<b>${d.label || d.series}</b><br>X: ${fmt(d.x)}<br>Y: ${fmt(d.y)}${Number.isFinite(d.size) ? "<br>Size: " + fmt(d.size) : ""}${d.note ? "<br>" + d.note : ""}${Object.entries(
              d.meta || {},
            )
              .map(([k, v]) => "<br>" + k + ": " + v)
              .join("")}`,
          ),
        );
      })
      .on("mousemove", (e) =>
        tip
          .style("left", e.clientX + 12 + "px")
          .style("top", e.clientY + 8 + "px"),
      )
      .on("mouseleave", () => {
        cs.classed("dim", false);
        tip.style("opacity", 0);
      });
  hits.each(function (d) {
    this.dataset.tooltip = [
      d.label || d.series,
      "X: " + fmt(d.x),
      "Y: " + fmt(d.y),
      ...(Number.isFinite(d.size) ? ["Size: " + fmt(d.size)] : []),
      ...Object.entries(d.meta || {}).map(([k, v]) => k + ": " + v),
    ].join("\n");
  });
  if (labels) {
    let ns = pts
      .filter((d) => d.label)
      .map((d) => ({
        d,
        x:
          x(d.x) +
          (Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps) +
          7,
        y:
          y(d.y) -
          (Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps) -
          5,
        tx:
          x(d.x) +
          (Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps) +
          7,
        ty:
          y(d.y) -
          (Number.isFinite(d.size) && d.size >= 0 ? r(d.size) : D.ps) -
          5,
        rr: Math.max(14, d.label.length * 3.2),
      }));
    for (let k = 0; k < 80; k++)
      for (let i = 0; i < ns.length; i++) {
        let a = ns[i];
        a.x += (a.tx - a.x) * 0.05;
        a.y += (a.ty - a.y) * 0.05;
        for (const p of pts) {
          let dx = a.x - x(p.x),
            dy = a.y - y(p.y),
            di = Math.hypot(dx, dy) || 1,
            sa =
              (Number.isFinite(p.size) && p.size >= 0 ? r(p.size) : D.ps) + 10;
          if (di < sa) {
            a.x += (dx / di) * (sa - di) * 0.35;
            a.y += (dy / di) * (sa - di) * 0.35;
          }
        }
        for (let j = i + 1; j < ns.length; j++) {
          let b = ns[j],
            dx = b.x - a.x,
            dy = b.y - a.y,
            di = Math.hypot(dx, dy) || 1,
            mi = a.rr + b.rr;
          if (di < mi) {
            let q = (mi - di) * 0.25;
            a.x -= (dx / di) * q;
            b.x += (dx / di) * q;
            a.y -= (dy / di) * q;
            b.y += (dy / di) * q;
          }
        }
        a.x = Math.max(2, Math.min(iw - a.rr * 2, a.x));
        a.y = Math.max(11, Math.min(ih - 2, a.y));
      }
    g.selectAll(".valueLabel")
      .data(ns)
      .join("text")
      .attr("class", "valueLabel")
      .attr("x", (n) => n.x)
      .attr("y", (n) => n.y)
      .attr("fill", (n) => C[n.d.series])
      .text((n) => n.d.label);
  }
}
function render() {
  let hasZ = all.some((d) => Number.isFinite(d.size)),
    hasL = all.some((d) => d.label),
    hasT = [...new Set(model.map((d) => d.series))].some(
      (s) => model.filter((d) => d.series === s).length > 1,
    );
  $("#bubbleCtrl").style.display = hasZ ? "grid" : "none";
  $("#labels").style.display = hasL ? "inline-block" : "none";
  $("#trend").style.display = hasT ? "inline-block" : "none";
  let D = {
    data: model,
    w: +$("#w").value,
    h: +$("#h").value,
    ps: +$("#ps").value,
    op: +$("#op").value / 100,
    bs: +$("#bs").value / 100,
  };
  ["w", "h", "ps"].forEach((k) => ($("#" + k + "v").textContent = D[k]));
  $("#opv").textContent = Math.round(D.op * 100) + "%";
  $("#bsv").textContent = Math.round(D.bs * 100) + "%";
  $("#empty").style.display = "none";
  S.style("display", "block");
  draw(S, D);
  legend();
  $("#share").disabled = false;
}
function legend() {
  let b = $("#legend");
  b.innerHTML = "";
  [...new Set(all.map((d) => d.series))].forEach((n) => {
    let l = document.createElement("label"),
      q = document.createElement("button");
    l.className = hidden.has(n) ? "off" : "";
    q.className = "swatch";
    q.style.background = C[n];
    q.onclick = (e) => {
      e.stopPropagation();
      colour(e, n);
    };
    l.onclick = () => {
      hidden.has(n) ? hidden.delete(n) : hidden.add(n);
      render();
    };
    l.append(q, document.createTextNode(n));
    b.append(l);
  });
}
function colour(e, n) {
  let p = $("#colourPop"),
    h = $("#hex"),
    c = $("#nativeColour"),
    r = e.target.getBoundingClientRect();
  p.style.left = r.left + "px";
  p.style.top = r.bottom + 7 + "px";
  p.classList.add("open");
  h.value = c.value = C[n];
  let f = (v) => {
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      C[n] = v;
      render();
    }
  };
  h.oninput = () => f(h.value);
  c.oninput = () => {
    h.value = c.value;
    f(c.value);
  };
}
function svgText() {
  return ChartExport.frame("Chart").svg;
}
function dl(b, n) {
  let u = URL.createObjectURL(b),
    a = document.createElement("a");
  a.href = u;
  a.download = n;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 800);
}
function name() {
  return ($("#diagramTitle").value || "scatter plot").replace(
    /[\\/:*?"<>|]+/g,
    "-",
  );
}
function png() {
  let i = new Image(),
    u = URL.createObjectURL(new Blob([svgText()], { type: "image/svg+xml" }));
  i.onload = () => {
    let c = document.createElement("canvas");
    c.width = i.width * 2;
    c.height = i.height * 2;
    let x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(i, 0, 0, c.width, c.height);
    c.toBlob((b) => dl(b, name() + ".png"), "image/png");
    URL.revokeObjectURL(u);
  };
  i.src = u;
}
function html() {
  const old = active,
    frames = [];
  try {
    for (let i = 0; i < periods.length; i++) {
      active = i;
      model = all.filter((d) => d.period === periods[i]);
      render();
      frames.push(ChartExport.frame(periods[i]));
    }
  } finally {
    active = old;
    model = all.filter((d) => d.period === periods[old]);
    render();
  }
  ChartExport.download(frames, old);
}
["w", "h", "ps", "op", "bs", "xGrid", "yGrid"].forEach(
  (x) => ($("#" + x).oninput = render),
);
$("#period").oninput = (e) => {
  active = +e.target.value;
  model = all.filter((d) => d.period === periods[active]);
  model.xt = all.xt;
  model.yt = all.yt;
  $("#periodLabel").textContent = periods[active];
  render();
};
[
  ["labels", () => (labels = !labels)],
  ["trend", () => (trends = !trends)],
  ["zero", () => (zero = !zero)],
  ["equal", () => (equal = !equal)],
].forEach(
  ([x, f]) =>
    ($("#" + x).onclick = () => {
      f();
      $("#" + x).classList.toggle("active");
      render();
    }),
);
$("#reset").onclick = () => {
  M = [Array(8).fill("")];
  all = [];
  model = [];
  grid();
  clear();
};
$("#share").onclick = () => $("#menu").classList.toggle("open");
$("#menu").onclick = (e) => {
  let x = e.target.dataset.x;
  if (x === "svg")
    dl(new Blob([svgText()], { type: "image/svg+xml" }), name() + ".svg");
  if (x === "png") png();
  if (x === "html") html();
  $("#menu").classList.remove("open");
};
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".menuWrap")) $("#menu").classList.remove("open");
  if (!e.target.closest("#colourPop") && !e.target.closest(".swatch"))
    $("#colourPop").classList.remove("open");
});
grid();

window.chartSettings = {
  get() {
    return structuredClone({
      active: active,
      labels: labels,
      trends: trends,
      zero: zero,
      equal: equal,
      hidden: [...hidden],
      C: C,
    });
  },
  set(s) {
    if (!s || typeof s !== "object") return;
    if (
      typeof s.active === typeof active &&
      (typeof s.active !== "number" || Number.isFinite(s.active))
    )
      active = s.active;
    if (
      typeof s.labels === typeof labels &&
      (typeof s.labels !== "number" || Number.isFinite(s.labels))
    )
      labels = s.labels;
    if (
      typeof s.trends === typeof trends &&
      (typeof s.trends !== "number" || Number.isFinite(s.trends))
    )
      trends = s.trends;
    if (
      typeof s.zero === typeof zero &&
      (typeof s.zero !== "number" || Number.isFinite(s.zero))
    )
      zero = s.zero;
    if (
      typeof s.equal === typeof equal &&
      (typeof s.equal !== "number" || Number.isFinite(s.equal))
    )
      equal = s.equal;
    if (Array.isArray(s.hidden))
      hidden = new Set(s.hidden.filter((x) => typeof x === "string"));
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
    for (const [id, value] of [
      ["labels", labels],
      ["trend", trends],
      ["zero", zero],
      ["equal", equal],
    ])
      $("#" + id).classList.toggle("active", value);
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
