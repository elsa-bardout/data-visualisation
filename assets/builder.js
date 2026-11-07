/* Accessibility and sizing shared by the isolated chart documents. */
(() => {
  const mode = location.pathname.split("/").pop().replace(".html", "");
  const bridge = window.chartBridge;
  if (!bridge) return;
  const initial = window.chartSettings?.get();
  const controls = () =>
    Object.fromEntries(
      [...document.querySelectorAll("input[id],select[id]")].map((e) => [
        e.id,
        e.value,
      ]),
    );
  const initialControls = controls();
  bridge.getState = () => ({
    settings: window.chartSettings?.get(),
    controls: controls(),
  });
  bridge.setState = (state) => {
    if (!state || typeof state !== "object") return;
    window.chartSettings?.set(state.settings || initial);
    for (const [id, value] of Object.entries(state.controls || {})) {
      const e = document.getElementById(id);
      if (
        !e ||
        !["INPUT", "SELECT"].includes(e.tagName) ||
        typeof value !== "string"
      )
        continue;
      e.value = value.slice(0, 1000);
    }
    window.chartSettings?.rebuild();
  };
  bridge.resetAll = () => {
    window.chartSettings?.reset();
    bridge.setState({ settings: initial, controls: initialControls });
  };
  const summary = document.createElement("p");
  summary.className = "chart-summary";
  summary.id = "chart-summary";
  summary.textContent = "Paste data or choose a sample to start.";
  document.querySelector(".card").append(summary);
  let scheduled = false;
  function enhance() {
    observer.disconnect();
    scheduled = false;
    document.querySelectorAll("input,select").forEach((e) => {
      if (e.getAttribute("aria-label") || e.closest("label")) return;
      const label =
        e.closest(".ctrl")?.childNodes[0]?.textContent.trim() ||
        {
          diagramTitle: "Chart title",
          title: "Map title",
          hex: "Hex colour",
          nativeColour: "Colour picker",
        }[e.id];
      if (label) e.setAttribute("aria-label", label);
    });
    document
      .querySelectorAll(".swatch")
      .forEach((e) =>
        e.setAttribute(
          "aria-label",
          "Change colour for " + e.parentNode.textContent.trim(),
        ),
      );
    document.querySelectorAll(".legend label").forEach((e) => {
      if (e.onclick) {
        let toggle = e.querySelector(".series-toggle");
        if (!toggle) {
          const text = [...e.childNodes].find((n) => n.nodeType === 3);
          toggle = document.createElement("button");
          toggle.className = "series-toggle";
          toggle.textContent = text?.textContent || "Series";
          toggle.type = "button";
          if (text) text.replaceWith(toggle);
          else e.append(toggle);
          toggle.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            e.onclick(event);
          };
        }
        toggle.setAttribute(
          "aria-pressed",
          String(!e.classList.contains("off")),
        );
        toggle.setAttribute("aria-label", "Show series " + toggle.textContent);
      }
    });
    document
      .querySelectorAll(".arrange button,.toolbarActions>button")
      .forEach((e) => {
        if (
          ![
            "reorder",
            "det",
            "curveBtn",
            "orientationBtn",
            "typeToggle",
            "labelToggle",
            "mapModeBtn",
            "labelBtn",
          ].includes(e.id)
        )
          e.setAttribute(
            "aria-pressed",
            String(e.classList.contains("active")),
          );
      });
    document.querySelectorAll(".menuWrap>button").forEach((e) => {
      e.setAttribute("aria-haspopup", "true");
      e.setAttribute(
        "aria-expanded",
        String(e.parentNode.querySelector(".menu")?.classList.contains("open")),
      );
    });
    const svg = document.querySelector("#svg");
    if (svg) {
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        document.querySelector("#diagramTitle")?.value || mode + " chart",
      );
      svg.setAttribute("aria-describedby", "chart-summary");
    }
    document
      .querySelectorAll(
        "#svg .pointHit,#svg .barRect,#svg .slice,#svg .linkHit",
      )
      .forEach((e) => {
        const d = e.__data__;
        if (!e.dataset.tooltip && d) {
          const v = d.data || d;
          e.dataset.tooltip = d.source
            ? `${d.source.name} → ${d.target.name}\n${d.value}`
            : `${v.name || v.label || v.series || ""}\n${v.value ?? ""}`;
        }
        e.setAttribute("tabindex", "0");
        e.setAttribute("aria-label", e.dataset.tooltip || "Chart mark");
        e.onfocus = () => {
          const tip = document.querySelector("#tip");
          tip.textContent = e.dataset.tooltip;
          tip.style.opacity = 1;
          tip.style.left = "12px";
          tip.style.top = "12px";
        };
        e.onblur = () => (document.querySelector("#tip").style.opacity = 0);
      });
    const count = document.querySelectorAll(
      "#svg .barRect,#svg .pointHit,#svg .slice,#svg .node",
    ).length;
    const message = count
      ? `${count} chart marks. Use Tab to inspect values; the source table is available above. Drag to reorder where supported, or use the order controls.`
      : mode === "map"
        ? "Use the map controls to change its appearance. Geographic lookups require an internet connection."
        : "Paste data or choose a sample to start.";
    if (summary.textContent !== message) summary.textContent = message;
    const height = Math.ceil(
      document.querySelector(".app").getBoundingClientRect().height + 8,
    );
    if (parent !== window)
      parent.postMessage(
        { type: "chart-height", mode, height },
        location.origin,
      );
    window.chartSettings?.sync();
    observer.observe(document.querySelector(".app"), {
      childList: true,
      subtree: true,
    });
  }
  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(enhance);
    }
  });
  observer.observe(document.querySelector(".app"), {
    childList: true,
    subtree: true,
  });
  new ResizeObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(enhance);
    }
  }).observe(document.querySelector(".app"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".menu,.colourPop")
        .forEach((n) => n.classList.remove("open"));
    }
  });
  document.addEventListener("click", () => {
    setTimeout(enhance, 0);
    if (parent !== window)
      parent.postMessage({ type: "chart-changed", mode }, location.origin);
  });
  document.addEventListener("input", () => {
    if (parent !== window)
      parent.postMessage({ type: "chart-changed", mode }, location.origin);
  });
  if (["bar", "donut", "sankey"].includes(mode)) {
    const box = document.createElement("div");
    box.className = "keyboard-order";
    const label = document.createElement("label");
    label.textContent = "Reorder ";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Item to reorder");
    label.append(select);
    box.append(label);
    for (const [text, delta] of [
      ["Move up", -1],
      ["Move down", 1],
    ]) {
      const button = document.createElement("button");
      button.className = "btn";
      button.textContent = text;
      button.onclick = () => {
        window.chartSettings.move(select.value, delta);
        enhance();
        if (parent !== window)
          parent.postMessage({ type: "chart-changed", mode }, location.origin);
      };
      box.append(button);
    }
    document.querySelector(".card").append(box);
    window.refreshOrderControls = () => {
      const items = window.chartSettings.items();
      const signature = JSON.stringify(items);
      if (select.dataset.items === signature) return;
      const selected = select.value;
      select.replaceChildren();
      items.forEach((x) => {
        const o = document.createElement("option");
        o.value = x.id;
        o.textContent = x.name;
        select.append(o);
      });
      if (items.some((x) => x.id === selected)) select.value = selected;
      select.dataset.items = signature;
      box.hidden = !items.length;
    };
  }
  enhance();
})();
