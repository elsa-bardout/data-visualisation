/* Shared source data and undo history; chart styling stays in each builder. */
(() => {
  const $ = (s) => document.querySelector(s),
    modes = ["sankey", "donut", "bar", "line", "scatter", "map"];
  const examples = window.chartSamples;
  let data = [Array(4).fill("")],
    mode = "sankey",
    states = {},
    undo = [],
    redo = [],
    selecting = false,
    selection = null,
    editSnapshot = null,
    renderTimer;
  const frames = Object.fromEntries(
    modes.map((n) => [n, document.getElementById("panel-" + n)]),
  );
  const copy = (x) => structuredClone(x),
    norm = (x) =>
      String(x || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    filled = (r) => r.some((x) => String(x).trim());
  function notice(message) {
    $("#notice").textContent = message;
  }
  function capture() {
    for (const n of modes) {
      try {
        const b = frames[n].contentWindow?.chartBridge;
        if (b?.getState) states[n] = b.getState();
      } catch {}
    }
    return {
      version: 1,
      data: copy(data),
      mode,
      states: copy(states),
    };
  }
  function checkpoint(snapshot = capture()) {
    undo.push(snapshot);
    if (undo.length > 50) undo.shift();
    redo = [];
  }
  function normalise() {
    const used = data.reduce(
      (max, row) =>
        row.reduce(
          (n, v, i) => (String(v ?? "").trim() ? Math.max(n, i) : n),
          max,
        ),
      -1,
    );
    const width = Math.max(8, used + 2);
    data.forEach((r) => {
      while (r.length < width) r.push("");
    });
    if (data.length < 2 || filled(data.at(-1)))
      data.push(Array(width).fill(""));
  }
  function cellAt(r, c) {
    return document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }
  function renderGrid(focus) {
    normalise();
    const table = $("#grid");
    table.replaceChildren();
    const head = document.createElement("thead"),
      body = document.createElement("tbody");
    table.append(head, body);
    data.forEach((row, r) => {
      const tr = document.createElement("tr"),
        rn = document.createElement("th");
      rn.scope = "row";
      rn.className = "rn";
      rn.textContent = r || "#";
      tr.append(rn);
      row.forEach((value, c) => {
        const td = createCell(value, r, c);
        tr.append(td);
      });
      (r ? body : head).append(tr);
    });
    if (focus) cellAt(focus.r, focus.c)?.focus();
    paintSelection();
  }
  function createCell(value, r, c) {
    const td = document.createElement("td");
    td.contentEditable = "plaintext-only";
    td.tabIndex = 0;
    td.dataset.r = r;
    td.dataset.c = c;
    td.textContent = value;
    td.setAttribute(
      "aria-label",
      (r ? "Row " + r : "Header") + ", column " + (c + 1),
    );
    td.onfocus = () => {
      editSnapshot = capture();
    };
    td.onblur = () => {
      if (
        editSnapshot &&
        JSON.stringify(editSnapshot.data) !== JSON.stringify(data)
      ) {
        checkpoint(editSnapshot);
        editSnapshot = null;
      }
      if (!cellAt(data.length - 1, 0) || filled(data.at(-1))) renderGrid();
    };
    td.onpointerdown = (e) => {
      if (e.button !== 0) return;
      selecting = true;
      if (e.shiftKey && selection) {
        e.preventDefault();
        selection.end = { r, c };
      } else selection = { start: { r, c }, end: { r, c } };
      paintSelection();
    };
    td.onpointerenter = () => {
      if (selecting && selection) {
        selection.end = { r, c };
        paintSelection();
      }
    };
    td.oninput = () => {
      data[r][c] = td.textContent;
      growGrid();
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        push();
      }, 200);
    };
    td.onpaste = (e) => {
      e.preventDefault();
      try {
        const incoming = ChartUtils.parseDelimited(
          e.clipboardData.getData("text/plain"),
        );
        if (
          incoming.length + r > 10001 ||
          Math.max(...incoming.map((x) => x.length)) + c > 100
        )
          throw Error("Limit: 10,000 rows and 100 columns.");
        checkpoint();
        while (data.length < r + incoming.length) data.push([]);
        incoming.forEach((row, i) =>
          row.forEach((v, j) => (data[r + i][c + j] = v)),
        );
        editSnapshot = null;
        renderGrid({ r, c });

        push();
      } catch (error) {
        notice(error.message);
      }
    };
    td.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redoAction() : undoAction();
        return;
      }
      if (
        e.key === "Delete" &&
        selection &&
        (selection.start.r !== selection.end.r ||
          selection.start.c !== selection.end.c)
      ) {
        e.preventDefault();
        checkpoint();
        for (
          let i = Math.min(selection.start.r, selection.end.r);
          i <= Math.max(selection.start.r, selection.end.r);
          i++
        )
          for (
            let j = Math.min(selection.start.c, selection.end.c);
            j <= Math.max(selection.start.c, selection.end.c);
            j++
          )
            data[i][j] = "";
        selection = null;
        renderGrid({ r, c });

        push();

        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (r === data.length - 1) data.push(Array(data[0].length).fill(""));
        renderGrid({ r: Math.max(0, r + (e.shiftKey ? -1 : 1)), c });
      }
    };

    return td;
  }
  function growGrid() {
    normalise();
    const table = $("#grid");
    data.forEach((row, r) => {
      let tr = table.rows[r];
      if (!tr) {
        tr = table.tBodies[0].insertRow();
        const rn = document.createElement("th");
        rn.className = "rn";
        rn.scope = "row";
        rn.textContent = r;
        tr.append(rn);
      }
      for (let c = tr.cells.length - 1; c < row.length; c++)
        tr.append(createCell(row[c], r, c));
    });
  }
  function paintSelection() {
    document.querySelectorAll("#grid td").forEach((td) => {
      const r = +td.dataset.r,
        c = +td.dataset.c,
        s = selection;
      td.classList.toggle(
        "selected",
        !!s &&
          r >= Math.min(s.start.r, s.end.r) &&
          r <= Math.max(s.start.r, s.end.r) &&
          c >= Math.min(s.start.c, s.end.c) &&
          c <= Math.max(s.start.c, s.end.c),
      );
    });
  }
  function diagnostics(table) {
    const h = table[0] || [],
      rows = table.slice(1).filter(filled),
      issues = [];
    if (!rows.length) {
      $("#diagnostics").textContent = "";
      return;
    }
    let indices = h
      .map((v, i) => ({ v, i }))
      .filter(
        (x) =>
          [
            "VALUE",
            "Y",
            "X",
            "SIZE",
            "LATITUDE",
            "LONGITUDE",
            "COUNT",
            "AMOUNT",
            "TOTAL",
          ].includes(norm(x.v)) && !(mode === "line" && norm(x.v) === "X"),
      )
      .map((x) => x.i);
    if (mode === "donut") {
      if (
        h.some((v) =>
          ["SERIES", "SOURCE", "TARGET", "PERIOD"].includes(norm(v)),
        )
      ) {
        $("#diagnostics").textContent =
          "For a donut, put one category per row and a positive amount in the next column. To compare periods, give each period its own amount column. Try the donut sample to see the layout.";
        return;
      }
      indices = h.map((_, i) => i).filter((i) => i > 0 && h[i]?.trim());
    }
    if (
      mode === "sankey" &&
      h.some((v) => norm(v) === "SERIES") &&
      !h.some((v) => norm(v) === "SOURCE")
    ) {
      $("#diagnostics").textContent =
        "This looks like a bar-chart table. For flows, add Source and Target columns to say where each amount comes from and goes to. Try the flow sample for an example.";
      return;
    }
    if (!indices.length && ["bar", "line"].includes(mode))
      indices = h
        .map((_, i) => i)
        .filter(
          (i) =>
            rows.some((r) => Number.isFinite(ChartUtils.number(r[i]))) &&
            i !== 0,
        );
    const invalid = [],
      nonpositive = [];
    table.slice(1).forEach((r, i) => {
      if (!filled(r)) return;
      for (const j of indices) {
        const n = ChartUtils.number(r[j]);
        if (!Number.isFinite(n))
          invalid.push(
            `row ${i + 1}, ${h[j]} (${String(r[j] || "").trim() ? "invalid number" : "missing"})`,
          );
        else if (["donut", "sankey"].includes(mode) && n <= 0)
          nonpositive.push(`row ${i + 1}, ${h[j]}`);
      }
    });
    if (invalid.length)
      issues.push(
        "Some amounts are blank or are not numbers. Fill in the numeric columns with numbers such as 120 or 12.5; leave out rows you do not want to plot.",
      );
    if (nonpositive.length)
      issues.push(
        "This chart needs positive amounts. Remove zero or negative values, or use a bar or line chart to show gains and losses.",
      );
    $("#diagnostics").textContent = issues.join(" ");
  }
  function push() {
    const table = copy(data);
    diagnostics(table);
    const b = frames[mode].contentWindow?.chartBridge;
    if (!b) return;
    try {
      b.setData(table);
    } catch (e) {
      notice("Chart could not be built: " + e.message);
    }
  }
  function activate(next) {
    if (!modes.includes(next)) return;
    capture();
    mode = next;
    document.querySelectorAll(".mode").forEach((b) => {
      const active = b.dataset.mode === mode;
      b.setAttribute("aria-selected", active);
      b.classList.toggle("active", active);
      b.tabIndex = active ? 0 : -1;
    });
    for (const n of modes) {
      frames[n].classList.toggle("active", n === mode);
      frames[n].hidden = n !== mode;
    }
    document.querySelector(".sharedHint").textContent = {
      sankey:
        "Use Source, Target and Value to show flows between steps. Add Period for a time slider, and extra columns for hover details.",
      donut:
        "Put names in the first column and positive amounts beside them. Extra amount columns become periods. Drag labels to change the order.",
      bar: "Use Category and Value; add Series for stacked bars and Period for a time slider. Negative values work too. Drag bars to reorder them.",
      line: "Use Date or X, Value and optionally Series. Add Target for a reference line and Note for an annotation. Extra details appear on hover.",
      scatter:
        "Use X and Y for positions, Size for bubbles and Series for groups. Add Label, Period or extra hover details as needed.",
      map: "Postcodes and coordinates make pins; ward or council names make areas. Add Council to identify wards, Category for groups, and extra columns for hover details.",
    }[mode];
    updateTitle();
    moveIndicator();

    const f = frames[mode];
    if (!f.getAttribute("src")) f.src = f.dataset.src;
    else {
      push();
      f.contentWindow.dispatchEvent(new Event("resize"));
    }
    history.replaceState(null, "", "#" + mode);
  }
  for (const n of modes) {
    frames[n].onload = () => {
      const b = frames[n].contentWindow?.chartBridge;
      if (!b) {
        notice(
          "A chart library could not load. Check your connection and reload.",
        );
        return;
      }
      if (n === mode) push();
      if (states[n]) b.setState(states[n]);
    };
  }
  document.querySelectorAll(".mode").forEach((b) => {
    b.onclick = () => activate(b.dataset.mode);
    b.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const i = modes.indexOf(mode),
          next =
            e.key === "Home"
              ? modes[0]
              : e.key === "End"
                ? modes.at(-1)
                : modes[
                    (i + (e.key === "ArrowRight" ? 1 : -1) + modes.length) %
                      modes.length
                  ];
        activate(next);
        document.getElementById("tab-" + next).focus();
      }
    };
  });
  function restore(p) {
    ChartUtils.validateProject(p);
    data = copy(p.data);
    mode = p.mode;

    states = copy(p.states || {});
    selection = null;
    editSnapshot = null;
    renderGrid();
    for (const n of modes) {
      const b = frames[n].contentWindow?.chartBridge;
      if (b) {
        b.resetAll();
        if (states[n]) b.setState(states[n]);
      }
    }
    const wantedStates = copy(states);
    activate(mode);
    states = wantedStates;
    push();
    if (states[mode])
      frames[mode].contentWindow?.chartBridge?.setState(states[mode]);
  }
  function undoAction() {
    if (
      editSnapshot &&
      JSON.stringify(editSnapshot.data) !== JSON.stringify(data)
    ) {
      checkpoint(editSnapshot);
      editSnapshot = null;
    }
    if (!undo.length) return;
    redo.push(capture());
    const p = undo.pop();
    restore(p);
    notice("Undone.");
  }
  function redoAction() {
    if (!redo.length) return;
    undo.push(capture());
    restore(redo.pop());
    notice("Redone.");
  }

  $("#upload").onclick = () => $("#uploadFile").click();
  $("#uploadFile").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const incoming = ChartUtils.parseDelimited(
        (await file.text()).replace(/^\uFEFF/, ""),
      );
      if (!incoming.some((row) => row.some((cell) => String(cell).trim())))
        throw new Error("empty");
      checkpoint();
      data = incoming;
      selection = null;
      renderGrid();
      push();
      notice("Data uploaded. Undo restores your previous table.");
    } catch {
      notice(
        "Could not read this file. Save your spreadsheet as CSV or tab-separated text, then upload it again.",
      );
    } finally {
      event.target.value = "";
    }
  };
  $("#sample").onclick = () => {
    checkpoint();
    data = copy(examples[mode]);
    frames[mode].contentWindow?.chartBridge?.resetAll();
    delete states[mode];

    selection = null;
    renderGrid();

    push();

    notice("Sample loaded. Undo restores your previous data.");
  };
  $("#clear").onclick = () => {
    checkpoint();
    data = [Array(4).fill("")];

    states = {};
    selection = null;
    for (const n of modes) frames[n].contentWindow?.chartBridge?.resetAll();
    renderGrid();

    push();

    notice("Project reset. Undo restores the previous project.");
  };
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const n = e.data?.mode;
    if (!modes.includes(n) || e.source !== frames[n].contentWindow) return;
    if (e.data.type === "chart-height" && Number.isFinite(e.data.height))
      frames[n].style.height =
        Math.min(8000, Math.max(300, e.data.height)) + "px";
  });
  window.addEventListener("hashchange", () => {
    if (modes.includes(location.hash.slice(1)))
      activate(location.hash.slice(1));
  });
  document.addEventListener("pointerup", () => (selecting = false));
  let lastY = scrollY;
  function updateTitle(next = mode) {
    $("#activeTitle").textContent =
      next === "map"
        ? "Map builder"
        : next === "scatter"
          ? "Scatter plot builder"
          : next === "sankey"
            ? "Sankey builder"
            : next[0].toUpperCase() + next.slice(1) + " chart builder";
  }
  function moveIndicator() {
    const button = document.querySelector(".mode.active");
    if (button)
      document
        .querySelector(".modes")
        .style.setProperty("--x", button.offsetLeft - 3 + "px");
  }
  document.querySelectorAll(".mode").forEach((b) => {
    b.onmouseenter = () => updateTitle(b.dataset.mode);
    b.onmouseleave = () => updateTitle();
  });
  addEventListener("resize", moveIndicator);
  addEventListener(
    "scroll",
    () => {
      const y = scrollY,
        down = y > lastY + 4,
        up = y < lastY - 4;
      if (y < 70 || up)
        document.querySelector(".top").classList.remove("hidden");
      else if (down && y > 120)
        document.querySelector(".top").classList.add("hidden");
      lastY = y;
    },
    { passive: true },
  );
  document.addEventListener("keydown", (e) => {
    if (
      e.defaultPrevented ||
      !(e.ctrlKey || e.metaKey) ||
      e.key.toLowerCase() !== "z"
    )
      return;
    e.preventDefault();
    e.shiftKey ? redoAction() : undoAction();
  });
  renderGrid();
  activate(
    modes.includes(location.hash.slice(1)) ? location.hash.slice(1) : "sankey",
  );
  requestAnimationFrame(moveIndicator);
})();
