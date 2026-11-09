/* Standalone HTML exports contain snapshots, not functions with hidden globals. */
(function () {
  function frame(label) {
    const svg = document.querySelector("#svg").cloneNode(true);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = document.querySelector("#svg");
    const originals = [source, ...source.querySelectorAll("*")];
    [svg, ...svg.querySelectorAll("*")].forEach((node, i) => {
      const style = getComputedStyle(originals[i]);
      for (const key of [
        "fill",
        "stroke",
        "stroke-width",
        "stroke-opacity",
        "fill-opacity",
        "font-family",
        "font-size",
        "font-weight",
        "text-anchor",
        "stroke-dasharray",
        "font-style",
        "letter-spacing",
        "text-transform",
        "display",
        "visibility",
        "stroke-linecap",
        "stroke-linejoin",
      ])
        node.style.setProperty(key, style.getPropertyValue(key));
      node.classList.remove("dim", "dragging", "active");
      node.style.removeProperty("opacity");
      if (
        node.tagName.toLowerCase() === "text" &&
        style.textTransform === "uppercase"
      )
        node.textContent = node.textContent.toUpperCase();
      if (originals[i].matches(".link,.linkHit"))
        node.dataset.linkIndex = originals[i].__data__?.index;
      if (originals[i].matches(".slice"))
        node.dataset.group = originals[i].__data__?.data?.name || "";
      if (originals[i].matches(".lab"))
        node.dataset.group = originals[i].__data__?.d?.data?.name || "";
      if (originals[i].dataset.tooltip)
        node.dataset.tooltip = originals[i].dataset.tooltip;
      else if (originals[i].matches(".slice,.linkHit")) {
        const d = originals[i].__data__;
        if (d)
          node.dataset.tooltip = d.source
            ? `${d.source.name} → ${d.target.name}\n${d.value}`
            : `${d.data.name}\n${d.data.value}`;
      }
    });
    svg
      .querySelectorAll(".dragPreview,.dragDot,.dropPreview")
      .forEach((n) => n.remove());
    return {
      label,
      svg: new XMLSerializer().serializeToString(svg),
      title: document.querySelector("#diagramTitle")?.value || "",
      legend: [...document.querySelectorAll("#legend label")].map((n) => ({
        name: n.textContent.trim(),
        colour: getComputedStyle(n.querySelector(".swatch") || n)
          .backgroundColor,
      })),
    };
  }
  function exportRuntime() {
    const data = JSON.parse(document.getElementById("chart-data").textContent),
      select = document.querySelector("#period"),
      tip = document.querySelector(".tip");
    document.querySelector("h1").textContent = data.title;
    select.max = data.frames.length - 1;
    select.value = data.active;
    document.querySelector("label").hidden = data.frames.length < 2;
    function show() {
      const f = data.frames[+select.value];
      document.querySelector("main").innerHTML = f.svg;
      document.querySelector("h1").textContent = f.title || data.title;
      document.querySelector("output").textContent = f.label;
      const legend = document.querySelector(".legend");
      legend.replaceChildren();
      (Array.isArray(f.legend) ? f.legend : []).forEach((item) => {
        const entry = document.createElement("span"),
          swatch = document.createElement("i");
        swatch.style.background = item.colour;
        entry.append(swatch, document.createTextNode(item.name));
        legend.append(entry);
      });
      tip.style.opacity = 0;
      const marks = [
        ...document.querySelectorAll(
          "main .slice,main .barRect,main .point,main .seriesLine,main .link,main .node",
        ),
      ];
      document.querySelectorAll("[data-tooltip]").forEach((n) => {
        n.setAttribute("tabindex", "0");
        n.setAttribute("aria-label", n.dataset.tooltip);
        const enter = (e) => {
          tip.textContent = n.dataset.tooltip;
          tip.style.opacity = 1;
          marks.forEach(
            (m) =>
              (m.style.opacity =
                m === n ||
                m.contains(n) ||
                n.contains(m) ||
                (n.dataset.group && m.dataset.group === n.dataset.group) ||
                (n.dataset.linkIndex &&
                  m.dataset.linkIndex === n.dataset.linkIndex)
                  ? "1"
                  : ".28"),
          );
          const r = n.getBoundingClientRect();
          tip.style.left =
            Math.max(
              8,
              Math.min(
                innerWidth - tip.offsetWidth - 12,
                (e?.clientX ?? r.right) + 12,
              ),
            ) + "px";
          tip.style.top =
            Math.max(
              8,
              Math.min(
                innerHeight - tip.offsetHeight - 12,
                (e?.clientY ?? r.top) + 12,
              ),
            ) + "px";
        };
        n.onmouseenter = n.onfocus = enter;
        n.onmouseleave = n.onblur = () => {
          tip.style.opacity = 0;
          marks.forEach((m) => m.style.removeProperty("opacity"));
        };
        n.onmousemove = (e) => {
          tip.style.left =
            Math.max(
              8,
              Math.min(innerWidth - tip.offsetWidth - 12, e.clientX + 12),
            ) + "px";
          tip.style.top =
            Math.max(
              8,
              Math.min(innerHeight - tip.offsetHeight - 12, e.clientY + 12),
            ) + "px";
        };
      });
    }
    select.oninput = show;
    show();
  }
  function download(frames, active = 0) {
    const title = document.querySelector("#diagramTitle")?.value || "";
    const payload = JSON.stringify({ title, frames, active }).replace(
      /</g,
      "\\u003c",
    );
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ChartUtils.escape(title)}</title><style>*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f7f8fa;color:#17212b;font:14px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.app{max-width:1900px;margin:auto;padding:18px}.card{background:white;border:1px solid #e5e9ed;border-radius:16px;box-shadow:0 10px 30px #14283a0d;overflow:hidden}header{padding:18px 20px}h1:empty{display:none}h1{font-size:20px;line-height:1.2;margin:0;font-weight:700}.period{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:12px;color:#707986}.period input{width:180px;accent-color:#172b3f}.period output{color:#17212b}.legend{display:flex;flex-wrap:wrap;gap:14px 20px;padding:14px 20px;border-top:1px solid #e5e9ed;border-bottom:1px solid #e5e9ed;font-size:12px;color:#59636e}.legend:empty{display:none}.legend span{display:flex;align-items:center;gap:9px}.legend i{width:18px;height:18px;border-radius:5px;box-shadow:0 0 0 1px #dce2e8;outline:2px solid white;outline-offset:-2px}main{overflow:auto;padding:20px}svg{max-width:100%;height:auto;display:block;margin:auto}.tip{position:fixed;left:0;top:0;bottom:auto;width:max-content;height:auto;white-space:pre-line;background:#17212b;color:white;padding:8px 10px;border-radius:8px;pointer-events:none;opacity:0;max-width:260px;font-size:12px;line-height:1.45;box-shadow:0 6px 18px #0003;z-index:10}svg [data-tooltip]{transition:opacity .15s}:focus-visible{outline:2px dotted #707986;outline-offset:2px}@media(max-width:600px){.app{padding:10px}main{padding:10px}}</style><div class="app"><section class="card"><header><h1></h1><label class="period">Period <input id="period" type="range" min="0" step="1"><output></output></label></header><div class="legend"></div><main></main></section></div><div class="tip" role="status"></div><script type="application/json" id="chart-data">${payload}</script><script>(${exportRuntime.toString()})();</script></html>`;
    const u = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = u;
    a.download = (title || "Chart").replace(/[\\/:*?"<>|]/g, "-") + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  window.ChartExport = { frame, download };
})();
