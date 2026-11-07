/* The parent owns source data, mapping, history, and portable project state. */
(() => {
  const $ = (s) => document.querySelector(s),
    modes = ["sankey", "donut", "bar", "line", "scatter", "map"];
  const examples = {
    sankey: [
      ["Source", "Target", "Value"],
      ["Website", "Enquiry", "120"],
      ["Social", "Enquiry", "80"],
      ["Enquiry", "Sale", "65"],
      ["Enquiry", "Follow-up", "135"],
    ],
    bar: [
      ["Category", "Series", "Value"],
      ["North", "Income", "120"],
      ["North", "Costs", "-45"],
      ["South", "Income", "95"],
      ["South", "Costs", "-55"],
    ],
    donut: [
      ["Category", "2025", "2026"],
      ["Research", "35", "40"],
      ["Design", "25", "30"],
      ["Engineering", "40", "30"],
    ],
    line: [
      ["Month", "Series", "Value"],
      ["2026-01-01", "Visitors", "120"],
      ["2026-02-01", "Visitors", "155"],
      ["2026-03-01", "Visitors", "135"],
      ["2026-04-01", "Visitors", "190"],
    ],
    scatter: [
      ["X", "Y", "Series", "Label"],
      ["12", "22", "North", "A"],
      ["18", "29", "North", "B"],
      ["25", "41", "South", "C"],
      ["32", "44", "South", "D"],
    ],
    map: [
      ["Latitude", "Longitude", "Name", "Value", "Category"],
      ["51.5074", "-0.1278", "London", "120", "South"],
      ["53.4808", "-2.2426", "Manchester", "80", "North"],
      ["55.9533", "-3.1883", "Edinburgh", "60", "North"],
    ],
  };
  const roles = {
    sankey: ["Source", "Target", "Value", "Period"],
    bar: ["Category", "Value", "Series", "Period"],
    donut: ["Category", "Value"],
    line: ["X", "Value", "Series", "Target", "Note"],
    scatter: ["X", "Y", "Series", "Size", "Label", "Period"],
    map: [
      "Latitude",
      "Longitude",
      "Postcode",
      "Ward",
      "Council",
      "Location",
      "Name",
      "Value",
      "Category",
      "Colour",
    ],
  };
  const aliases = {
    Category: ["CATEGORY", "NAME", "LABEL", "SERVICE", "GROUP"],
    Value: [
      "VALUE",
      "AMOUNT",
      "COUNT",
      "TOTAL",
      "NUMBER",
      "SCORE",
      "RATE",
      "Y",
    ],
    X: ["X", "DATE", "TIME", "MONTH", "YEAR", "PERIOD", "CATEGORY"],
    Y: ["Y", "VALUE", "OUTPUT"],
    Series: ["SERIES", "GROUP", "TYPE", "MEASURE"],
    Size: ["SIZE", "WEIGHT", "VOLUME"],
    Label: ["LABEL", "NAME"],
    Name: ["NAME", "LABEL", "SITE"],
    Latitude: ["LATITUDE", "LAT"],
    Longitude: ["LONGITUDE", "LON", "LNG"],
    Colour: ["COLOUR", "COLOR", "HEX"],
  };
  const guide = {
    sankey:
      "Show flows between stages. Columns: Source, Target, Value. Values must be positive.",
    bar: "Compare categories, including gains and losses. Columns: Category, Value. Add Series for stacked bars.",
    donut:
      "Show parts of a whole. Put categories first, followed by positive numeric columns. Multiple value columns become periods.",
    line: "Show change over time. Use X or Date, Value, and optionally Series. Use ISO dates such as 2026-01-01.",
    scatter:
      "Explore relationships. Use numeric X and Y columns; add Series, Size, Label or Period as needed.",
    map: "Map places or regions. Use Latitude / Longitude, Postcode, Council, or Ward. Add Council to disambiguate wards. The sample uses coordinates and needs no geocoding.",
  };
  let data = [Array(4).fill("")],
    mode = "sankey",
    mappings = {},
    states = {},
    undo = [],
    redo = [],
    selection = null,
    editSnapshot = null,
    remember = false,
    persistTimer,
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
      mappings: copy(mappings),
      states: copy(states),
    };
  }
  function checkpoint(snapshot = capture()) {
    undo.push(snapshot);
    if (undo.length > 50) undo.shift();
    redo = [];
    historyButtons();
  }
  function historyButtons() {
    $("#undo").disabled = !undo.length;
    $("#redo").disabled = !redo.length;
  }
  function normalise() {
    const width = Math.max(4, ...data.map((r) => r.length));
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
          refreshMapping();
        };
        td.onpointerdown = (e) => {
          if (e.shiftKey && selection) {
            e.preventDefault();
            selection.end = { r, c };
          } else selection = { start: { r, c }, end: { r, c } };
          paintSelection();
        };
        td.oninput = () => {
          data[r][c] = td.textContent;
          clearTimeout(renderTimer);
          renderTimer = setTimeout(() => {
            refreshMapping();
            push();
            persist();
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
            refreshMapping();
            push();
            persist();
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
            refreshMapping();
            push();
            persist();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (r === data.length - 1)
              data.push(Array(data[0].length).fill(""));
            renderGrid({ r: Math.max(0, r + (e.shiftKey ? -1 : 1)), c });
          }
        };
        tr.append(td);
      });
      (r ? body : head).append(tr);
    });
    if (focus) cellAt(focus.r, focus.c)?.focus();
    paintSelection();
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
  function infer(role) {
    const header = data[0] || [],
      matches = aliases[role] || [norm(role)];
    let i = header.findIndex((x) => norm(x) === norm(role));
    if (i < 0) i = header.findIndex((x) => matches.includes(norm(x)));
    if (i >= 0) return i;
    const numeric = header
      .map((_, j) => j)
      .filter((j) =>
        data.slice(1).some((r) => Number.isFinite(ChartUtils.number(r[j]))),
      );
    if (role === "Value") return numeric[0] ?? -1;
    if (role === "Category")
      return header.findIndex(
        (x, j) => String(x).trim() && !numeric.includes(j),
      );
    return -1;
  }
  function refreshMapping() {
    const m = mappings[mode] || { enabled: false, columns: {} };
    $("#mapping-enabled").checked = m.enabled;
    const box = $("#mapping-fields");
    box.replaceChildren();
    const choices = [];
    roles[mode].forEach((role) => {
      const index = m.columns[role] ?? infer(role),
        label = document.createElement("label");
      label.textContent = role;
      const select = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = -1;
      empty.textContent = "Not used";
      select.append(empty);
      data[0].forEach((name, i) => {
        if (!name.trim()) return;
        const o = document.createElement("option");
        o.value = i;
        o.textContent = name;
        select.append(o);
      });
      select.value = index;
      select.disabled = !m.enabled;
      select.onchange = () => {
        checkpoint();
        mappings[mode] ||= { enabled: true, columns: {} };
        mappings[mode].columns[role] = +select.value;
        push();
        persist();
        refreshMapping();
      };
      label.append(select);
      box.append(label);
      if (index >= 0) choices.push(role + ": " + data[0][index]);
    });
    $("#interpretation").textContent = m.enabled
      ? "Using " + choices.join(" · ")
      : "Automatic detection. Suggested roles: " +
        (choices.join(" · ") || "paste a header row to identify columns") +
        ". Wide tables may produce multiple series or periods.";
    $("#mapping-summary").textContent = m.enabled
      ? "Column mapping · explicit"
      : "Column mapping · automatic";
  }
  function mapped() {
    const m = mappings[mode];
    if (!m?.enabled) return copy(data);
    const active = roles[mode]
      .map((role) => ({ role, index: m.columns[role] ?? infer(role) }))
      .filter((x) => x.index >= 0 && x.index < data[0].length);
    return [
      active.map((x) => x.role),
      ...data.slice(1).map((r) => active.map((x) => r[x.index] || "")),
    ];
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
    if (mode === "donut")
      indices = h.map((_, i) => i).filter((i) => i > 0 && h[i]?.trim());
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
        `${invalid.length} missing or invalid numeric cell(s): ${invalid.slice(0, 6).join("; ")}${invalid.length > 6 ? "; …" : ""}. These values cannot be plotted.`,
      );
    if (nonpositive.length)
      issues.push(
        `${nonpositive.length} nonpositive value(s) excluded from this chart: ${nonpositive.slice(0, 6).join("; ")}. Use a bar or line chart to include signed values.`,
      );
    $("#diagnostics").textContent = issues.join("\n");
  }
  function push() {
    const table = mapped();
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
      b.tabIndex = active ? 0 : -1;
    });
    for (const n of modes) {
      frames[n].classList.toggle("active", n === mode);
      frames[n].hidden = n !== mode;
    }
    $("#data-heading").textContent =
      "Build a " + (mode === "map" ? "map" : mode + " chart");
    $("#guide").textContent = guide[mode];
    refreshMapping();
    const f = frames[mode];
    if (!f.getAttribute("src")) f.src = f.dataset.src;
    else {
      push();
      f.contentWindow.dispatchEvent(new Event("resize"));
    }
    history.replaceState(null, "", "#" + mode);
    persist();
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
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!remember) return;
      try {
        localStorage.setItem(
          "data-visualisation-project",
          JSON.stringify(capture()),
        );
        $("#storage-note").textContent =
          "Saved on this device. Uncheck to remove the saved copy.";
      } catch {
        $("#storage-note").textContent =
          "Device storage is unavailable or full. Use Save project.";
      }
    }, 400);
  }
  function restore(p) {
    ChartUtils.validateProject(p);
    data = copy(p.data);
    mode = p.mode;
    mappings = copy(p.mappings || {});
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
    historyButtons();
    persist();
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
  $("#undo").onclick = undoAction;
  $("#redo").onclick = redoAction;
  $("#sample").onclick = () => {
    checkpoint();
    data = copy(examples[mode]);
    mappings[mode] = { enabled: false, columns: {} };
    selection = null;
    renderGrid();
    refreshMapping();
    push();
    persist();
    notice("Sample loaded. Undo restores your previous data.");
  };
  $("#mapping-enabled").onchange = (e) => {
    checkpoint();
    mappings[mode] ||= { columns: {} };
    mappings[mode].enabled = e.target.checked;
    refreshMapping();
    push();
    persist();
  };
  $("#add-row").onclick = () => {
    if (data.length > 10000) {
      notice("Maximum 10,000 data rows.");
      return;
    }
    checkpoint();
    data.push(Array(data[0].length).fill(""));
    renderGrid({ r: data.length - 1, c: 0 });
  };
  $("#add-column").onclick = () => {
    if (data[0].length >= 100) {
      notice("Maximum 100 columns.");
      return;
    }
    checkpoint();
    data.forEach((r) => r.push(""));
    renderGrid({ r: 0, c: data[0].length - 1 });
    refreshMapping();
  };
  $("#clear").onclick = () => {
    checkpoint();
    data = [Array(4).fill("")];
    mappings = {};
    states = {};
    selection = null;
    for (const n of modes) frames[n].contentWindow?.chartBridge?.resetAll();
    renderGrid();
    refreshMapping();
    push();
    persist();
    notice("Project reset. Undo restores the previous project.");
  };
  $("#save").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(capture(), null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "visualisation-project.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Project saved with data, column mappings and chart settings.");
  };
  async function readFile(input, project) {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error("Choose a file smaller than 10 MB.");
      const text = await file.text();
      if (project) {
        const p = ChartUtils.validateProject(JSON.parse(text));
        checkpoint();
        restore(p);
      } else {
        const rows = ChartUtils.parseDelimited(text);
        ChartUtils.validateProject({ version: 1, data: rows, mode });
        checkpoint();
        data = rows;
        mappings = {};
        renderGrid();
        refreshMapping();
        push();
        persist();
      }
      notice(
        project
          ? "Project opened."
          : "Data imported. Check the column mapping.",
      );
    } catch (e) {
      notice(e.message);
    }
    input.value = "";
  }
  $("#import-data").onchange = (e) => readFile(e.target, false);
  $("#open-project").onchange = (e) => readFile(e.target, true);
  document.querySelectorAll(".file-button").forEach((label) => {
    label.tabIndex = 0;
    label.setAttribute("role", "button");
    label.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        label.querySelector("input").click();
      }
    };
  });
  $("#remember").onchange = (e) => {
    remember = e.target.checked;
    if (remember) persist();
    else {
      try {
        localStorage.removeItem("data-visualisation-project");
      } catch {}
      $("#storage-note").textContent =
        "Saved device copy removed. Use Save project to keep your work.";
    }
  };
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const n = e.data?.mode;
    if (!modes.includes(n) || e.source !== frames[n].contentWindow) return;
    if (e.data.type === "chart-height" && Number.isFinite(e.data.height))
      frames[n].style.height =
        Math.min(8000, Math.max(300, e.data.height)) + "px";
    if (e.data.type === "chart-changed") persist();
  });
  window.addEventListener("hashchange", () => {
    if (modes.includes(location.hash.slice(1)))
      activate(location.hash.slice(1));
  });
  window.addEventListener("beforeunload", (e) => {
    if (!remember && data.some(filled)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  renderGrid();
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("data-visualisation-project"));
  } catch {}
  if (saved) {
    try {
      remember = true;
      $("#remember").checked = true;
      restore(saved);
      notice("Restored the project saved on this device.");
    } catch {
      activate("sankey");
    }
  } else
    activate(
      modes.includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "sankey",
    );
})();
