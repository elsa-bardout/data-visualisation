const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  acorn = require("acorn");
const { JSDOM } = require("jsdom");
const utils = require("../assets/shared.js");
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
