const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { JSDOM } = require("jsdom");
function app() {
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }),
    w = dom.window;
  w.structuredClone = structuredClone;
  const context = dom.getInternalVMContext();
  for (const file of ["shared", "samples", "app"])
    new vm.Script(
      fs.readFileSync("assets/" + file + ".js", "utf8"),
    ).runInContext(context);
  return { dom, w, doc: w.document };
}
test("sample, reset and undo restore source data", () => {
  const h = app();
  try {
    h.doc.querySelector("#sample").click();
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "Website",
    );
    h.doc.querySelector("#clear").click();
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "",
    );
    h.doc.dispatchEvent(
      new h.w.KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
    );
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "Website",
    );
    h.doc.dispatchEvent(
      new h.w.KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        shiftKey: true,
      }),
    );
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "",
    );
  } finally {
    h.dom.window.close();
  }
});
test("switching chart type preserves source cells and automatic interpretation", () => {
  const h = app();
  try {
    h.doc.querySelector("#tab-bar").click();
    let passed;
    h.doc.querySelector("#panel-bar").contentWindow.chartBridge = {
      setData: (data) => (passed = data),
      getState: () => ({}),
      resetAll() {},
      setState() {},
    };
    h.doc.querySelector("#sample").click();
    assert.deepEqual(Array.from(passed[0]).slice(0, 4), [
      "Category",
      "Series",
      "Value",
      "Period",
    ]);
    assert.equal(passed[1][2], "120");
    h.doc.querySelector("#tab-line").click();
    assert.equal(
      h.doc.querySelector('[data-r="0"][data-c="1"]').textContent,
      "Series",
    );
  } finally {
    h.dom.window.close();
  }
});
test("nonpositive donut values produce concise actionable advice", () => {
  const h = app();
  try {
    h.doc.querySelector("#tab-donut").click();
    h.doc.querySelector("#sample").click();
    const cell = h.doc.querySelector('[data-r="1"][data-c="1"]');
    cell.textContent = "-3";
    cell.dispatchEvent(new h.w.Event("input"));
    h.doc.querySelector("#tab-bar").click();
    h.doc.querySelector("#tab-donut").click();
    assert.match(
      h.doc.querySelector("#diagnostics").textContent,
      /needs positive amounts.*bar or line/,
    );
  } finally {
    h.dom.window.close();
  }
});
test("pasted multiline CSV adds rows and is undoable", () => {
  const h = app();
  try {
    const cell = h.doc.querySelector('[data-r="0"][data-c="0"]'),
      event = new h.w.Event("paste", { cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => 'Category,Value\n"North, west",5\nSouth,7' },
    });
    cell.dispatchEvent(event);
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "North, west",
    );
    h.doc.dispatchEvent(
      new h.w.KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
    );
    assert.equal(
      h.doc.querySelector('[data-r="0"][data-c="0"]').textContent,
      "",
    );
  } finally {
    h.dom.window.close();
  }
});

test("typing at table edges grows a blank row and column without replacing the focused cell", () => {
  const h = app();
  try {
    const cell = h.doc.querySelector('[data-r="1"][data-c="7"]');
    cell.focus();
    cell.textContent = "edge";
    cell.dispatchEvent(new h.w.Event("input"));
    assert.equal(h.doc.activeElement, cell);
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="8"]').textContent,
      "",
    );
    assert.equal(
      h.doc.querySelector('[data-r="2"][data-c="7"]').textContent,
      "",
    );
  } finally {
    h.dom.window.close();
  }
});
test("CSV upload replaces the table and remains undoable", async () => {
  const h = app();
  try {
    h.doc.querySelector("#sample").click();
    const input = h.doc.querySelector("#uploadFile");
    const target = {
      files: [
        { text: async () => '\uFEFFCategory,Value\n"Advice, support",42' },
      ],
      value: "sample.csv",
    };
    await input.onchange({ target });
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "Advice, support",
    );
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="1"]').textContent,
      "42",
    );
    h.doc.dispatchEvent(
      new h.w.KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
    );
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "Website",
    );
    assert.equal(target.value, "");
  } finally {
    h.dom.window.close();
  }
});

test("curated samples cycle and wrap independently without generating a title", () => {
  const h = app();
  try {
    h.w.chartSampleSets = {
      sankey: [
        {
          title: "First",
          rows: [
            ["Source", "Target", "Value"],
            ["A", "B", "1"],
          ],
        },
        {
          title: "Second",
          rows: [
            ["Source", "Target", "Value"],
            ["C", "D", "2"],
          ],
        },
      ],
    };
    const sample = h.doc.querySelector("#sample"),
      cell = () => h.doc.querySelector('[data-r="1"][data-c="0"]').textContent;
    sample.click();
    assert.equal(cell(), "A");
    sample.click();
    assert.equal(cell(), "C");
    sample.click();
    assert.equal(cell(), "A");
    assert.match(
      h.doc.querySelector(".privacyNote").textContent,
      /Maps send\s+location fields/,
    );
  } finally {
    h.dom.window.close();
  }
});

test("CSV samples keep one source line, clear it on edits, and restore it with Undo", async () => {
  const h = app();
  try {
    h.w.chartSampleSets = {
      sankey: [
        {
          title: "A sourced story",
          csv: "assets/samples/example.csv",
          source: "Official source",
          url: "https://example.org/data",
          reference: "2024",
          notes: "Counts, not rates",
        },
      ],
    };
    h.w.fetch = async () => ({
      ok: true,
      text: async () => "Source,Target,Value\nA,B,10",
    });
    await h.doc.querySelector("#sample").onclick();
    const source = h.doc.querySelector("#sampleSource");
    assert.equal(source.querySelectorAll("a").length, 1);
    assert.match(source.textContent, /Official source/);
    const cell = h.doc.querySelector('[data-r="1"][data-c="2"]');
    cell.focus();
    cell.textContent = "20";
    cell.dispatchEvent(new h.w.Event("input"));
    cell.blur();
    assert.equal(source.hidden, true);
    h.doc.dispatchEvent(
      new h.w.KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
    );
    assert.equal(source.hidden, false);
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="2"]').textContent,
      "10",
    );
  } finally {
    h.dom.window.close();
  }
});

test("a late sample download cannot overwrite an edit or reset", async () => {
  const h = app();
  try {
    h.w.chartSampleSets = {
      sankey: [{ csv: "assets/samples/slow.csv", title: "Slow" }],
    };
    let finish;
    h.w.fetch = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = h.doc.querySelector("#sample").onclick();
    h.doc.querySelector("#clear").click();
    finish({ ok: true, text: async () => "Source,Target,Value\nA,B,10" });
    await pending;
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "",
    );
    assert.equal(h.doc.querySelector("#sampleSource").hidden, true);
  } finally {
    h.dom.window.close();
  }
});
