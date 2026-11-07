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
  for (const file of ["shared", "app"])
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
    h.doc.querySelector("#undo").click();
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "Website",
    );
    h.doc.querySelector("#redo").click();
    assert.equal(
      h.doc.querySelector('[data-r="1"][data-c="0"]').textContent,
      "",
    );
  } finally {
    h.dom.window.close();
  }
});
test("explicit mapping changes chart input without changing source cells", () => {
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
    const toggle = h.doc.querySelector("#mapping-enabled");
    toggle.checked = true;
    toggle.dispatchEvent(new h.w.Event("change"));
    assert.deepEqual(Array.from(passed[0]), ["Category", "Value", "Series"]);
    assert.equal(passed[1][1], "120");
    assert.equal(
      h.doc.querySelector('[data-r="0"][data-c="1"]').textContent,
      "Series",
    );
  } finally {
    h.dom.window.close();
  }
});
test("invalid and nonpositive donut values are reported with row references", () => {
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
      /nonpositive.*row 1/,
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
    h.doc.querySelector("#undo").click();
    assert.equal(
      h.doc.querySelector('[data-r="0"][data-c="0"]').textContent,
      "",
    );
  } finally {
    h.dom.window.close();
  }
});
