const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  acorn = require("acorn");
const { JSDOM } = require("jsdom");
const utils = require("../assets/shared.js");
const samplesContext = { window: {} };
vm.runInNewContext(
  fs.readFileSync("assets/samples.js", "utf8"),
  samplesContext,
);
const samples = samplesContext.window.chartSamples;

test("descriptive numeric headers retain scatter axes, point names and groups", () => {
  const h = harness("scatter");
  try {
    h.w.chartBridge.setData([
      [
        "Country",
        "Year",
        "GDP per person ($)",
        "Life expectancy (years)",
        "Region",
      ],
      ["A", "2024", "12000", "72", "Europe"],
      ["B", "2024", "4000", "63", "Asia"],
    ]);
    const text = h.w.document.querySelector("#svg").textContent;
    assert.match(text, /GDP per person/);
    assert.match(text, /Life expectancy/);
    const pts = [...h.w.document.querySelectorAll(".pointHit")].map(
      (n) => n.__data__,
    );
    assert.equal(pts[0].x, 12000);
    assert.equal(pts[0].label, "A");
    assert.equal(pts[0].series, "Europe");
  } finally {
    h.dom.window.close();
  }
});

test("Sankey shares named nodes across explicit steps and preserves bypass ribbons", () => {
  const h = harness("sankey");
  try {
    h.w.chartBridge.setData([
      ["Source", "Target", "People helped", "Step"],
      ["Initial contact", "Step one", "50", "1"],
      ["Initial contact", "Step two", "30", "2"],
      ["Initial contact", "Step three", "20", "3"],
      ["Step one", "Step two", "50", "2"],
      ["Step two", "Step three", "80", "3"],
    ]);
    const nodes = [...h.w.document.querySelectorAll(".node")].map(
      (n) => n.__data__,
    );
    assert.equal(nodes.length, 4);
    assert.equal(nodes.find((n) => n.name === "Initial contact").layer, 0);
    assert.equal(nodes.find((n) => n.name === "Step three").layer, 3);
    const links = [...h.w.document.querySelectorAll("path.link")].map(
      (n) => n.__data__,
    );
    assert.ok(
      links.some(
        (l) =>
          l.source.name === "Initial contact" &&
          l.target.name === "Step three" &&
          l.value === 20,
      ),
    );
    h.w.chartBridge.setData([
      ["Contact", "Assessment", "Support", "Outcome", "Households"],
      ["Initial contact", "Step one", "Step two", "Step three", "50"],
      ["Initial contact", "", "Step two", "Step three", "30"],
      ["Initial contact", "", "", "Step three", "20"],
    ]);
    assert.equal(h.w.document.querySelectorAll(".node").length, 4);
    assert.equal(
      [...h.w.document.querySelectorAll(".node")].filter(
        (n) => n.__data__.name === "Initial contact",
      ).length,
      1,
    );
  } finally {
    h.dom.window.close();
  }
});

test("small Sankey values have separate muted normal-weight text and room for long labels", () => {
  const h = harness("sankey");
  try {
    const name = "Department of Defense—Military programmes and support";
    h.w.chartBridge.setData([
      ["Source", "Target", "Value"],
      ["Budget", name, "10000"],
      ["Budget", "Small programme", "1"],
    ]);
    const value = h.w.document.querySelector("tspan.value");
    assert.ok(value);
    assert.equal(value.getAttribute("font-weight"), "400");
    assert.equal(value.getAttribute("fill"), "#707986");
    const label = [...h.w.document.querySelectorAll(".node text")].find(
      (n) => n.textContent === name,
    );
    assert.ok(label);
    assert.ok(
      Number(label.getAttribute("x")) + name.length * 7 <
        Number(h.w.document.querySelector("#svg").getAttribute("width")),
    );
  } finally {
    h.dom.window.close();
  }
});

test("line series names appear beside their endpoints and annual ticks omit month", () => {
  const h = harness("line");
  try {
    h.w.chartBridge.setData([
      ["Year", "Violence", "Theft"],
      ["2020", "12", "25"],
      ["2021", "10", "20"],
    ]);
    assert.deepEqual(
      [...h.w.document.querySelectorAll(".seriesEndLabel")]
        .map((n) => n.textContent)
        .sort(),
      ["Theft", "Violence"],
    );
    assert.doesNotMatch(
      h.w.document.querySelector(".xAxis").textContent,
      /Jan/,
    );
  } finally {
    h.dom.window.close();
  }
});

test("donut slice dragging previews an insertion and preserves the resulting order", () => {
  const h = harness("donut");
  try {
    const rows = [
      ["Spending purpose", "Pounds"],
      ["Housing", "50"],
      ["Food", "30"],
      ["Travel", "20"],
    ];
    h.w.chartBridge.setData(rows);
    const slice = h.w.document.querySelector(".slice");
    slice.dispatchEvent(
      new h.w.MouseEvent("mousedown", {
        bubbles: true,
        view: h.w,
        clientX: 60,
        clientY: 0,
        buttons: 1,
      }),
    );
    h.w.dispatchEvent(
      new h.w.MouseEvent("mousemove", {
        bubbles: true,
        view: h.w,
        clientX: -90,
        clientY: -70,
        buttons: 1,
      }),
    );
    assert.notEqual(
      h.w.document.querySelector(".dropPreview").style.display,
      "none",
    );
    assert.ok(h.w.document.querySelector(".slice.dragging"));
    h.w.dispatchEvent(
      new h.w.MouseEvent("mouseup", {
        bubbles: true,
        view: h.w,
        clientX: -90,
        clientY: -70,
      }),
    );
    const order = h.w.chartSettings.get().manualOrder;
    assert.notEqual(order[0], "Housing");
    h.w.chartBridge.setData(rows);
    assert.deepEqual(
      Array.from(h.w.chartSettings.items(), (x) => x.name),
      Array.from(order),
    );
  } finally {
    h.dom.window.close();
  }
});

test("complete refugee country records reconcile with the regional sample", () => {
  const detail = utils
    .parseDelimited(
      fs.readFileSync("assets/samples/refugees-all-country-routes.csv", "utf8"),
    )
    .slice(1);
  const regions = utils
    .parseDelimited(fs.readFileSync("assets/samples/refugees.csv", "utf8"))
    .slice(1);
  assert.equal(detail.length, 4792);
  assert.equal(new Set(detail.map((r) => r[1])).size, 170);
  const sum = (rows) => rows.reduce((s, r) => s + Number(r[2]), 0);
  assert.equal(sum(detail), 30958200);
  assert.equal(sum(regions), sum(detail));
});
function harness(name) {
  const dom = new JSDOM(fs.readFileSync(`builders/${name}.html`, "utf8"), {
    runScripts: "outside-only",
    url: `http://localhost/builders/${name}.html`,
    pretendToBeVisual: true,
  });
  const w = dom.window,
    context = dom.getInternalVMContext();
  w.structuredClone = structuredClone;
  w.requestAnimationFrame = () => 0;
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  const run = (file) =>
    new vm.Script(fs.readFileSync(file, "utf8"), {
      filename: file,
    }).runInContext(context);
  run("node_modules/d3/dist/d3.min.js");
  if (name === "sankey") run("node_modules/d3-sankey/dist/d3-sankey.min.js");
  run("assets/shared.js");
  run("assets/export.js");
  run(`assets/${name}.js`);
  return { w, dom, run, context };
}
test("numeric parsing distinguishes missing and invalid values, signed and formatted values", () => {
  for (const [s, n] of [
    ["0", 0],
    ["-15", -15],
    ["£1,234.50", 1234.5],
    ["(25)", -25],
    ["1e3", 1000],
    ["15%", 15],
  ])
    assert.equal(utils.number(s), n);
  for (const s of ["", "unknown", "12 apples", "1,23", "12.3.4", "Infinity"])
    assert.ok(Number.isNaN(utils.number(s)), s);
});
test("CSV and spreadsheet paste preserve quoted delimiters and multiline cells", () => {
  assert.deepEqual(
    utils.parseDelimited('Name,Value\r\n"North, west",12\r\n"Two\nlines",3'),
    [
      ["Name", "Value"],
      ["North, west", "12"],
      ["Two\nlines", "3"],
    ],
  );
  assert.deepEqual(utils.parseDelimited('A\tB\n"a""b"\t2\n'), [
    ["A", "B"],
    ['a"b', "2"],
  ]);
  assert.throws(() => utils.parseDelimited('"unfinished'));
});
test("tooltip markup cannot create executable elements or attributes", () => {
  const dom = new JSDOM("<div></div>"),
    d = dom.window.document.querySelector("div");
  d.innerHTML = utils.tooltip(
    "<b>Label</b><br><img src=x onerror=alert(1)><svg onload=alert(1)>",
  );
  assert.equal(
    d.querySelectorAll("img,svg,script,[onerror],[onload]").length,
    0,
  );
  assert.equal(d.querySelector("b").textContent, "Label");
});
test("bar charts render negative and positive stacks in both orientations", () => {
  const h = harness("bar");
  try {
    h.w.chartBridge.setData([
      ["Category", "Series", "Value"],
      ["A", "Profit", "12"],
      ["A", "Loss", "-8"],
      ["B", "Profit", "4"],
      ["B", "Loss", "-15"],
    ]);
    for (const horizontal of [false, true]) {
      if (horizontal) h.w.document.querySelector("#orientationBtn").click();
      const marks = [...h.w.document.querySelectorAll(".barRect")];
      assert.equal(marks.length, 4);
      assert.ok(
        marks.every(
          (r) => +r.getAttribute(horizontal ? "width" : "height") > 0,
        ),
      );
      assert.match(h.w.document.querySelector("#svg").textContent, /−/);
    }
  } finally {
    h.dom.window.close();
  }
});
test("donut pie mode and value labels export without builder globals", () => {
  const h = harness("donut");
  try {
    h.w.chartBridge.setData([
      ["Category", "2025", "2026"],
      ["A", "12", "14"],
      ["B", "8", "6"],
    ]);
    h.w.document.querySelector("#typeToggle").click();
    h.w.document.querySelector("#labelToggle").click();
    assert.equal(h.w.document.querySelector(".centreTotal"), null);
    assert.equal(
      h.w.document.querySelector("#labelToggle").textContent,
      "Value",
    );
    let captured;
    h.w.ChartExport.download = (frames, active) =>
      (captured = { frames, active });
    h.w.document.querySelector('[data-x="html"]').click();
    assert.equal(captured.frames.length, 2);
    assert.ok(captured.frames.every((f) => !f.svg.includes("centreTotal")));
    assert.equal(captured.active, 0);
  } finally {
    h.dom.window.close();
  }
});
test("line include-zero retains negative observations; numeric X values stay numeric", () => {
  const h = harness("line");
  try {
    h.w.chartBridge.setData([
      ["X", "Value"],
      ["1", "-10"],
      ["2", "20"],
    ]);
    h.w.document.querySelector("#zero").click();
    const svg = h.w.document.querySelector("#svg");
    assert.match(svg.textContent, /−/);
    assert.doesNotMatch(svg.textContent, /1970|2001|2002/);
    assert.equal(svg.querySelectorAll(".point").length, 2);
  } finally {
    h.dom.window.close();
  }
});
test("scatter tolerates missing sizes and hiding every series", () => {
  const h = harness("scatter");
  try {
    h.w.chartBridge.setData([
      ["X", "Y", "Size"],
      ["1", "2", "10"],
      ["2", "4", ""],
    ]);
    assert.ok(
      [...h.w.document.querySelectorAll(".point")].every((n) =>
        Number.isFinite(+n.getAttribute("r")),
      ),
    );
    h.w.document.querySelector("#legend label").click();
    assert.equal(h.w.document.querySelectorAll("#svg .point").length, 0);
  } finally {
    h.dom.window.close();
  }
});
test("Sankey export retains all period snapshots", () => {
  const h = harness("sankey");
  try {
    h.w.chartBridge.setData([
      ["Source", "Target", "Value", "Period"],
      ["A", "B", "10", "2025"],
      ["A", "B", "20", "2026"],
    ]);
    let frames;
    h.w.ChartExport.download = (f) => (frames = f);
    h.w.document.querySelector('[data-x="html"]').click();
    assert.equal(frames.length, 2);
    assert.deepEqual(
      Array.from(frames, (f) => f.label),
      ["2025", "2026"],
    );
    assert.ok(frames.every((f) => f.svg.includes("path")));
  } finally {
    h.dom.window.close();
  }
});
test("standalone export safely round-trips less-than labels and title", () => {
  const h = harness("bar");
  try {
    h.w.chartBridge.setData([
      ["Category", "Value"],
      ["<script>literal</script>", "4"],
    ]);
    h.w.document.querySelector("#diagramTitle").value = "A < B";
    let blob;
    h.w.Blob = Blob;
    h.w.URL.createObjectURL = (b) => ((blob = b), "blob:test");
    h.w.URL.revokeObjectURL = () => {};
    h.w.HTMLAnchorElement.prototype.click = function () {};
    h.w.ChartExport.download([h.w.ChartExport.frame("All")]);
    return blob.text().then((html) => {
      const exported = new JSDOM(html, { runScripts: "dangerously" });
      assert.equal(
        exported.window.document.querySelector("h1").textContent,
        "A < B",
      );
      assert.match(
        exported.window.document.querySelector("main").textContent,
        /<script>literal<\/script>/,
      );
      assert.equal(exported.window.document.querySelector("main script"), null);
      exported.window.close();
    });
  } finally {
    h.dom.window.close();
  }
});
test("invalid project payload is rejected before replacing data", () => {
  assert.throws(() =>
    utils.validateProject({ version: 1, data: [["a"], [4]], mode: "bar" }),
  );
  assert.throws(() =>
    utils.validateProject({ version: 1, data: [], mode: "unknown" }),
  );
  assert.equal(
    utils.validateProject({
      version: 1,
      data: [
        ["A", "Value"],
        ["B", "0"],
      ],
      mode: "bar",
    }).mode,
    "bar",
  );
});
test("all source files parse as JavaScript", () => {
  for (const f of fs.readdirSync("assets").filter((f) => f.endsWith(".js")))
    assert.doesNotThrow(
      () =>
        new vm.Script(fs.readFileSync("assets/" + f, "utf8"), { filename: f }),
    );
});
function mapFunction(name) {
  const s = fs.readFileSync("assets/map.js", "utf8"),
    n = acorn
      .parse(s, { ecmaVersion: "latest" })
      .body.find((n) => n.type === "FunctionDeclaration" && n.id.name === name);
  return s.slice(n.start, n.end);
}

test("US state sample resolves all 50 states and DC from bundled geometry", async () => {
  const rows = utils.parseDelimited(
    fs.readFileSync("assets/samples/abortion-policies.csv", "utf8"),
  );
  const context = {
    norm: (s) =>
      String(s || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    fetchJSONResponse: async (path) => ({
      json: async () =>
        JSON.parse(fs.readFileSync(path.replace("../", ""), "utf8")),
    }),
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("prepare"), context);
  const result = await context.prepare({
    geo: "state",
    I: { state: 0 },
    d: rows.slice(1),
  });
  assert.equal(result.gj.features.length, 51);
  assert.equal(result.missing.length, 0);
  assert.equal(new Set(rows.slice(1).map((r) => r[0])).size, 51);
  assert.equal(rows.slice(1).filter((r) => r[1] === "Total ban").length, 13);
});

test("Camden sample resolves mixed ward and full-address rows without discarding either layer", async () => {
  const rows = utils.parseDelimited(
    fs.readFileSync("assets/samples/camden-libraries.csv", "utf8"),
  );
  const context = {
    clean: (x) => String(x || "").trim(),
    norm: (x) => String(x || "").toUpperCase(),
    fetchArea: async (p) => ({
      kind: "area",
      p,
      missing: [],
      gj: { features: p.d },
    }),
    geocodeRows: async (p, ni) => ({
      kind: "points",
      p,
      coords: p.d.map((r) => ({ r, lat: 51.5, lon: -0.1 })),
      missing: [],
    }),
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("prepare"), context);
  const result = await context.prepare({
    geo: "ward",
    I: {
      ward: 0,
      council: 1,
      address: 2,
      wardcode: -1,
      councilcode: -1,
      postcode: -1,
    },
    d: rows.slice(1),
  });
  assert.equal(result.gj.features.length, 20);
  assert.equal(result.points.coords.length, 12);
  assert.equal(result.missing.length, 0);
  assert.equal(
    new Set(
      rows
        .slice(1)
        .filter((r) => r[0])
        .map((r) => r[4]),
    ).size,
    5,
  );
});

test("sample totals, geography codes and growth derivation stay consistent", () => {
  const csv = (id) =>
    utils
      .parseDelimited(fs.readFileSync(`assets/samples/${id}.csv`, "utf8"))
      .slice(1);
  const flow = csv("homelessness-flows"),
    incoming = new Map(),
    outgoing = new Map();
  for (const [a, b, v] of flow) {
    incoming.set(b, (incoming.get(b) || 0) + +v);
    outgoing.set(a, (outgoing.get(a) || 0) + +v);
  }
  for (const [node, value] of incoming)
    if (outgoing.has(node)) assert.equal(outgoing.get(node), value, node);
  assert.ok(
    Math.abs(
      csv("uk-emissions").reduce((s, r) => s + +r[1], 0) - 373.400251224,
    ) < 0.0001,
  );
  for (const r of csv("growth-carbon"))
    assert.ok(
      Number.isFinite(+r[2]) &&
        Number.isFinite(+r[3]) &&
        +r[2] > -100 &&
        +r[3] > -100,
    );
});
test("ward lookup can replace ambiguous feature collection without const reassignment", async () => {
  const feature = { properties: { WD25NM: "Test" }, geometry: {} },
    context = {
      clean: String,
      norm: (s) => String(s).toUpperCase(),
      queryAreas: async () => ({ features: [feature] }),
      chooseLogicalFeatures: () => ({ features: [feature] }),
      featureName: (f, k) => f.properties[k],
      Map,
      Set,
    };
  vm.createContext(context);
  vm.runInContext(mapFunction("fetchArea"), context);
  const result = await context.fetchArea(
    { I: { wardcode: -1, councilcode: -1 }, d: [["Test"]] },
    "ward",
    0,
  );
  assert.equal(result.kind, "area");
  assert.equal(result.missing.length, 0);
});
test("map ignores stale asynchronous responses and does not resurrect cleared data", async () => {
  const pending = [];
  const context = {
    buildVersion: 0,
    current: null,
    M: [["Latitude"]],
    clear() {},
    parse: () => ({ d: [] }),
    status() {},
    prepare: () => new Promise((r) => pending.push(r)),
    updateColourControls() {},
    syncControls() {},
    map: { invalidateSize() {} },
    render() {},
    clean: String,
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("build"), context);
  const first = context.build(),
    second = context.build();
  pending[1]({ kind: "area", id: "new" });
  await second;
  pending[0]({ kind: "area", id: "old" });
  await first;
  assert.equal(context.current.id, "new");
  const third = context.build();
  context.buildVersion++;
  context.current = null;
  pending[2]({ kind: "area", id: "cleared" });
  await third;
  assert.equal(context.current, null);
});
test("map HTML export embeds local assets and resolved geography safely", async () => {
  const dom = new JSDOM(fs.readFileSync("builders/map.html", "utf8"), {
      url: "http://localhost/builders/map.html",
      runScripts: "outside-only",
    }),
    w = dom.window;
  const context = dom.getInternalVMContext();
  w.$ = (s) => w.document.querySelector(s);
  w.M = [["Name"], ["</script><img src=x onerror=alert(1)>"]];
  w.current = { kind: "points", coords: [], p: {} };
  w.chartSettings = { get: () => ({ mapMode: "none" }) };
  w.fetch = async (url) => ({
    text: async () => fs.readFileSync(new URL(url).pathname.slice(1), "utf8"),
  });
  vm.runInContext(mapFunction("interactiveHtml"), context);
  const html = await w.interactiveHtml(),
    exported = new JSDOM(html);
  assert.equal(
    exported.window.document.querySelectorAll(
      'script[src^="../"],link[href^="../"]',
    ).length,
    0,
  );
  assert.equal(
    exported.window.document.querySelectorAll("img[onerror]").length,
    0,
  );
  for (const script of exported.window.document.querySelectorAll(
    "script:not([src])",
  ))
    assert.doesNotThrow(() => new vm.Script(script.textContent));
  assert.match(html, /current=saved.current/);
  dom.window.close();
  exported.window.close();
});
test("map lookup cache deduplicates requests and retries failures", async () => {
  let calls = 0;
  const context = {
    requestCache: new Map(),
    AbortSignal,
    structuredClone,
    fetch: async () => {
      calls++;
      return { ok: true, json: async () => ({ features: [] }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("fetchJSONResponse"), context);
  await Promise.all([
    context.fetchJSONResponse("one"),
    context.fetchJSONResponse("one"),
  ]);
  assert.equal(calls, 1);
  context.fetch = async () => {
    throw Error("offline");
  };
  await assert.rejects(context.fetchJSONResponse("two"));
  assert.equal(context.requestCache.has("two"), false);
});
test("ambiguous wards are not silently assigned to a guessed council", () => {
  const context = {
    norm: (s) => String(s || "").toUpperCase(),
    featureName: (f, k) => f.properties[k],
    parentName: (f) => f.properties.LAD25NM,
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("chooseLogicalFeatures"), context);
  const features = [
    { properties: { WD25NM: "Central", LAD25NM: "North" } },
    { properties: { WD25NM: "Central", LAD25NM: "South" } },
  ];
  assert.equal(
    context.chooseLogicalFeatures(features, [["Central"]], 0, "WD25NM", {
      I: { council: -1 },
    }).features.length,
    0,
  );
  assert.equal(
    context.chooseLogicalFeatures(
      features,
      [["Central", "South"]],
      0,
      "WD25NM",
      { I: { council: 1 } },
    ).features[0].properties.LAD25NM,
    "South",
  );
});

test("all chart samples render multiple series, periods or categories", () => {
  for (const name of ["bar", "donut", "sankey", "line", "scatter"]) {
    const h = harness(name);
    try {
      h.w.chartBridge.setData(samples[name]);
      assert.ok(
        h.w.document.querySelectorAll("#svg path,#svg rect,#svg circle")
          .length > 5,
        name,
      );
      assert.equal(
        h.w.document.querySelector("#status")?.textContent || "",
        "",
        name,
      );
    } finally {
      h.dom.window.close();
    }
  }
});

test("donut leaders have one angled segment followed by a horizontal segment", () => {
  const h = harness("donut");
  try {
    h.w.chartBridge.setData(samples.donut);
    const lines = [...h.w.document.querySelectorAll(".leader")];
    assert.equal(lines.length, 8);
    for (const line of lines) {
      const points = line
        .getAttribute("points")
        .split(/[,\s]+/)
        .map(Number);
      assert.equal(points.length, 6);
      assert.equal(points[3], points[5]);
      assert.ok(Math.abs(points[4] - points[2]) > 10);
    }
  } finally {
    h.dom.window.close();
  }
});

test("mixed ward and postcode tables resolve both layers and report unmatched pins", async () => {
  const context = {
    clean: (x) => String(x || "").trim(),
    norm: (x) => String(x || "").toUpperCase(),
    fetchArea: async (p) => ({
      kind: "area",
      p,
      missing: [],
      gj: { features: [] },
    }),
    fetchJSONResponse: async () => ({
      json: async () => ({
        result: [
          { query: "NW1 1BD", result: { latitude: 51.5, longitude: -0.1 } },
        ],
      }),
    }),
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("prepare"), context);
  const p = {
    geo: "ward",
    I: { ward: 0, wardcode: -1, council: 1, councilcode: -1, postcode: 2 },
    d: [
      ["Camden Town", "Camden", ""],
      ["", "Camden", "NW1 1BD"],
      ["", "Camden", "INVALID"],
    ],
  };
  const result = await context.prepare(p);
  assert.equal(result.kind, "area");
  assert.equal(result.p.d.length, 1);
  assert.equal(result.points.coords.length, 1);
  assert.deepEqual(Array.from(result.missing), ["INVALID"]);
  context.fetchArea = async () => {
    throw Error("Boundary service unavailable");
  };
  const fallback = await context.prepare(p);
  assert.equal(fallback.kind, "points");
  assert.equal(fallback.coords.length, 1);
  assert.ok(fallback.missing.includes("Camden Town"));
});

test("shared line targets draw once and distinct targets have separated labels", () => {
  const h = harness("line");
  try {
    h.w.chartBridge.setData(samples.line);
    assert.equal(h.w.document.querySelectorAll(".targetItem").length, 1);
    assert.equal(h.w.document.querySelectorAll(".annotation").length, 1);
    assert.equal(
      [...h.w.document.querySelectorAll(".annotation")].filter(
        (n) => n.textContent === "Target 130",
      ).length,
      1,
    );
    h.w.chartBridge.setData([
      ["X", "Series", "Value", "Target"],
      ["1", "A", "10", "30"],
      ["2", "A", "20", "30"],
      ["1", "B", "14", "31"],
      ["2", "B", "19", "31"],
    ]);
    const labels = [...h.w.document.querySelectorAll(".annotation")].filter(
      (n) => n.textContent.includes("target"),
    );
    assert.equal(labels.length, 2);
    assert.ok(
      Math.abs(+labels[0].getAttribute("y") - +labels[1].getAttribute("y")) >=
        14.99,
    );
  } finally {
    h.dom.window.close();
  }
});

test("flow periods change geometry and detangle never increases weighted crossings", () => {
  const h = harness("sankey");
  try {
    h.w.chartBridge.setData(samples.sankey);
    const before = h.w.document.querySelector(".link").getAttribute("d");
    const slider = h.w.document.querySelector("#period");
    slider.value = "2";
    slider.dispatchEvent(new h.w.Event("input"));
    assert.notEqual(
      h.w.document.querySelector(".link").getAttribute("d"),
      before,
    );
    assert.equal(slider.max, "2");
    const score = vm.runInContext("crossingScore(nodeOrder)", h.context);
    h.w.document.querySelector("#det").click();
    assert.ok(vm.runInContext("crossingScore(nodeOrder)", h.context) <= score);
    const second = vm.runInContext("crossingScore(nodeOrder)", h.context);
    h.w.document.querySelector("#det").click();
    assert.ok(vm.runInContext("crossingScore(nodeOrder)", h.context) <= second);
  } finally {
    h.dom.window.close();
  }
});

test("donut HTML keeps a coloured key, live period slider, compact tooltip and hover emphasis", async () => {
  const h = harness("donut");
  let exported;
  try {
    h.w.chartBridge.setData(samples.donut);
    let blob;
    h.w.Blob = Blob;
    h.w.URL.createObjectURL = (b) => ((blob = b), "blob:test");
    h.w.URL.revokeObjectURL = () => {};
    h.w.HTMLAnchorElement.prototype.click = function () {};
    vm.runInContext("interactive()", h.context);
    exported = new JSDOM(await blob.text(), { runScripts: "dangerously" });
    const doc = exported.window.document,
      slider = doc.querySelector("#period");
    assert.equal(slider.type, "range");
    assert.equal(doc.querySelectorAll(".legend i").length, 8);
    slider.value = "2";
    slider.dispatchEvent(new exported.window.Event("input"));
    assert.equal(doc.querySelector("h1").textContent, "");
    const slice = doc.querySelector(".slice");
    slice.dispatchEvent(
      new exported.window.MouseEvent("mouseenter", {
        clientX: 100,
        clientY: 100,
      }),
    );
    assert.equal(doc.querySelector(".tip").style.opacity, "1");
    assert.equal(doc.querySelectorAll(".slice")[1].style.opacity, "0.28");
    assert.match(doc.querySelector("style").textContent, /bottom:auto/);
  } finally {
    h.dom.window.close();
    exported?.window.close();
  }
});

test("Camden samples use the reference neighbourhoods and add clearly fictional tooltip details", () => {
  const rows = samples.map.slice(1),
    find = (ward) => rows.find((r) => r[0] === ward);
  assert.equal(find("Belsize")[5], "North");
  assert.equal(find("Haverstock")[5], "East");
  assert.equal(find("St Pancras & Somers Town")[5], "Central");
  assert.equal(find("King's Cross")[5], "South");
  assert.equal(find("Kilburn")[5], "West");
  assert.equal(new Set(rows.filter((r) => r[0]).map((r) => r[5])).size, 5);
  assert.match(samples.map[0][6], /illustrative/);
  assert.ok(+find("Belsize")[6] > 0);
});
test("static sample catalog renders every non-map dataset with one external source record", () => {
  vm.runInNewContext(
    fs.readFileSync("assets/sample-sets.js", "utf8"),
    samplesContext,
  );
  for (const [name, sets] of Object.entries(
    samplesContext.window.chartSampleSets,
  )) {
    assert.equal(sets.length, { sankey: 4, donut: 3, map: 4 }[name] || 5);
    for (const set of sets) {
      assert.match(set.url, /^https:\/\//);
      assert.ok(set.reference && set.notes);
      const rows = utils.parseDelimited(fs.readFileSync(set.csv, "utf8"));
      assert.ok(!rows[0].some((h) => /source.*url/i.test(h)), set.title);
      assert.ok(rows.length > 2, set.title);
      if (name === "map") continue;
      const h = harness(name);
      try {
        h.w.chartBridge.setData(rows);
        assert.ok(
          h.w.document.querySelectorAll("#svg path,#svg rect,#svg circle")
            .length >= 2,
          set.title,
        );
        assert.equal(
          h.w.document.querySelector("#status")?.textContent || "",
          "",
          set.title,
        );
      } finally {
        h.dom.window.close();
      }
    }
  }
});
test("scatter major grid intervals apply to both axes", () => {
  const h = harness("scatter");
  try {
    h.w.chartBridge.setData([
      ["Name", "X", "Y"],
      ["A", "3", "8"],
      ["B", "38", "46"],
    ]);
    for (const id of ["xGrid", "yGrid"]) {
      const el = h.w.document.getElementById(id);
      el.value = "10";
      el.oninput();
    }
    const values = [...h.w.document.querySelectorAll(".axis .tick")].map(
      (n) => n.__data__,
    );
    assert.ok(values.length > 4);
    assert.ok(values.every((v) => v % 10 === 0));
  } finally {
    h.dom.window.close();
  }
});
test("donut accepts tidy rows and transposed periods", () => {
  const h = harness("donut");
  try {
    for (const rows of [
      [
        ["Category", "Period", "Value"],
        ["A", "2020", "10"],
        ["B", "2020", "20"],
        ["A", "2021", "30"],
        ["B", "2021", "40"],
      ],
      [
        ["Year", "A", "B"],
        ["2020", "10", "20"],
        ["2021", "30", "40"],
      ],
    ]) {
      h.w.chartBridge.setData(rows);
      assert.equal(h.w.document.querySelector("#period").max, "1");
      assert.equal(
        vm.runInContext("data.reduce((n,d)=>n+d.value,0)", h.context),
        30,
      );
    }
  } finally {
    h.dom.window.close();
  }
});
test("semicolon CSV preserves punctuation inside quoted cells", () => {
  assert.deepEqual(utils.parseDelimited('Name;Value\n"Address, London";12'), [
    ["Name", "Value"],
    ["Address, London", "12"],
  ]);
});

test("map label boxes stay inside boundaries and avoid holes and pins", () => {
  const context = {
    map: { latLngToContainerPoint: ([y, x]) => ({ x, y }) },
    document: {
      createElement: () => ({
        getContext: () => ({ measureText: (t) => ({ width: t.length * 5.7 }) }),
      }),
    },
    labelParts: (d) => ({ main: d.name, sub: [] }),
  };
  vm.createContext(context);
  for (const fn of ["pointInRing", "segmentDistance", "fitAreaLabel"])
    vm.runInContext(mapFunction(fn), context);
  const outer = [
      [0, 0],
      [220, 0],
      [220, 130],
      [0, 130],
      [0, 0],
    ],
    hole = [
      [85, 45],
      [135, 45],
      [135, 85],
      [85, 85],
      [85, 45],
    ];
  const fit = context.fitAreaLabel(
    {
      feature: { geometry: { type: "Polygon", coordinates: [outer, hole] } },
      data: { name: "Example area" },
    },
    [{ x: 0, y: 0, w: 35, h: 50 }],
  );
  assert.ok(fit);
  const b = fit.box;
  for (let x = b.x; x <= b.x + b.w; x += 2)
    for (let y = b.y; y <= b.y + b.h; y += 2) {
      assert.ok(context.pointInRing([x, y], outer));
      assert.ok(!context.pointInRing([x, y], hole));
    }
  assert.equal(
    context.fitAreaLabel(
      {
        feature: {
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
        },
        data: { name: "Too small" },
      },
      [],
    ),
    null,
  );
});
test("address geocoding tolerates punctuation and reports uncertain matches", async () => {
  const urls = [];
  const context = {
    clean: (v) => String(v ?? "").trim(),
    fetchJSONResponse: async (url) => {
      urls.push(url);
      return {
        json: async () => ({
          candidates: [
            {
              score: urls.length === 1 ? 99 : 42,
              address: "Matched street",
              location: { x: -0.1, y: 51.5 },
            },
          ],
        }),
      };
    },
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("geocodeRows"), context);
  const result = await context.geocodeRows(
    {
      I: { council: -1, country: -1 },
      d: [["218 EVERSHOLT STREET; London NW1 1BD"], ["uncertain place"]],
    },
    0,
  );
  assert.equal(result.coords.length, 1);
  assert.equal(result.missing.length, 1);
  assert.equal(result.coords[0].matchedAddress, "Matched street");
  assert.ok(decodeURIComponent(urls[0]).includes("STREET, London"));
  assert.ok(urls[0].includes("geocode.arcgis.com"));
});

test("all builders start with an empty title and preserve a supplied title", () => {
  for (const name of ["bar", "line", "scatter", "donut", "sankey"]) {
    const h = harness(name);
    try {
      const title = h.w.document.querySelector(
        '[placeholder="Enter title here"]',
      );
      assert.equal(title.value, "");
      h.w.chartBridge.setData(samples[name]);
      assert.equal(title.value, "");
      title.value = "My own title";
      title.dispatchEvent(new h.w.Event("input"));
      h.w.chartBridge.setData(samples[name]);
      assert.equal(title.value, "My own title");
    } finally {
      h.dom.window.close();
    }
  }
});

test("outside map labels choose the nearer edge, even when all fall on one side", () => {
  const placements = [];
  const context = {
    currentBounds: {
      isValid: () => true,
      getSouthWest: () => ({ x: 200, y: 600 }),
      getNorthEast: () => ({ x: 800, y: 0 }),
    },
    map: {
      getSize: () => ({ x: 1000, y: 600 }),
      latLngToContainerPoint: (p) => p,
      containerPointToLatLng: (p) => p,
    },
    labels: [],
    labelHtml: (_data, _size, _outside, side) => side,
    L: {
      point: (x, y) => ({ x, y }),
      polyline: () => ({
        addTo() {
          return this;
        },
      }),
      divIcon: (o) => o,
      marker: (p, o) => ({
        addTo() {
          placements.push({ p, side: o.icon.html });
          return this;
        },
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(mapFunction("outsideLabels"), context);
  context.items = [
    { latlng: { x: 230, y: 100 }, data: {} },
    { latlng: { x: 310, y: 110 }, data: {} },
  ];
  vm.runInContext("outsideLabels(items)", context);
  assert.deepEqual(
    placements.map((x) => x.side),
    ["left", "left"],
  );
  assert.ok(placements[1].p.y > placements[0].p.y);
  placements.length = 0;
  context.items = [{ latlng: { x: 780, y: 100 }, data: {} }];
  vm.runInContext("outsideLabels(items)", context);
  assert.equal(placements[0].side, "right");
});

test("year headings are periods, never population observations", () => {
  const h = harness("bar");
  try {
    h.w.chartBridge.setData(
      utils.parseDelimited(
        fs.readFileSync("assets/samples/france-identity-checks.csv", "utf8"),
      ),
    );
    const points = vm.runInContext("parse()", h.context);
    assert.ok(points.length > 0);
    assert.ok(
      points.every((p) => p.category !== "Population group" && p.value < 100),
    );
    assert.deepEqual([...new Set(points.map((p) => p.period))].sort(), [
      "2016",
      "2024",
    ]);
    assert.equal(h.w.document.querySelector("#period").max, "1");
  } finally {
    h.dom.window.close();
  }
});

test("line label leaders are black independently of series colours", () => {
  const h = harness("line");
  try {
    h.w.chartBridge.setData(samples.line);
    const leaders = [...h.w.document.querySelectorAll(".seriesEndLeader")];
    assert.ok(leaders.length);
    assert.ok(leaders.every((p) => p.getAttribute("stroke") === "#000"));
  } finally {
    h.dom.window.close();
  }
});

test("map prioritises countries over regions and offers both measures and continent groups", async () => {
  const source = fs.readFileSync("assets/map.js", "utf8");
  const context = {
    M: [
      ["Country", "Health spending", "Life expectancy", "Region"],
      ["France", "5000", "82", "Europe"],
      ["Germany", "6000", "81", "Europe"],
      ["United States", "10000", "78", "North America"],
    ],
    clean: (x) => String(x ?? "").trim(),
    norm: (x) =>
      String(x ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    num: utils.number,
    colourField: -1,
    fetchJSONResponse: async (path) => ({
      json: async () =>
        JSON.parse(fs.readFileSync(path.replace("../", ""), "utf8")),
    }),
  };
  vm.createContext(context);
  vm.runInContext(
    source.slice(
      source.indexOf("const alias ="),
      source.indexOf("function status"),
    ),
    context,
  );
  for (const f of ["headerScore", "fieldProfiles", "parse", "prepare"])
    vm.runInContext(mapFunction(f), context);
  const p = context.parse();
  assert.equal(p.geo, "country");
  assert.deepEqual(Array.from(context.numericFields), [1, 2]);
  assert.deepEqual(Array.from(context.categoryFields), [3]);
  const result = await context.prepare(p);
  assert.equal(result.kind, "area");
  assert.equal(result.gj.features.length, 3);
  const catalog = { window: {} };
  vm.runInNewContext(fs.readFileSync("assets/sample-sets.js", "utf8"), catalog);
  for (const sample of catalog.window.chartSampleSets.scatter) {
    const rows = utils.parseDelimited(fs.readFileSync(sample.csv, "utf8"));
    const areas = await context.prepare({
      geo: "country",
      I: { country: 0 },
      d: rows.slice(1),
    });
    assert.equal(
      areas.missing.length,
      0,
      sample.id + ": " + areas.missing.join(", "),
    );
  }
  context.M = [
    ["Name", "Ratio"],
    ["London", "12"],
    ["North East", "4"],
  ];
  const regions = await context.prepare(context.parse());
  assert.equal(regions.kind, "area");
  assert.equal(regions.gj.features.length, 2);
});
