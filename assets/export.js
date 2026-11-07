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
      ])
        node.style.setProperty(key, style.getPropertyValue(key));
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
      legend: document.querySelector("#legend")?.textContent || "",
    };
  }
  function exportRuntime() {
    const data = JSON.parse(document.getElementById("chart-data").textContent),
      select = document.querySelector("select"),
      tip = document.querySelector(".tip");
    document.querySelector("h1").textContent = data.title;
    data.frames.forEach((f, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = f.label;
      select.append(o);
    });
    select.value = data.active;
    document.querySelector("label").hidden = data.frames.length < 2;
    function show() {
      const f = data.frames[+select.value];
      document.querySelector("main").innerHTML = f.svg;
      document.querySelector(".legend").textContent = f.legend;
      document.querySelectorAll("[data-tooltip]").forEach((n) => {
        n.setAttribute("tabindex", "0");
        n.setAttribute("aria-label", n.dataset.tooltip);
        const enter = () => {
          tip.textContent = n.dataset.tooltip;
          tip.style.opacity = 1;
        };
        n.onmouseenter = n.onfocus = enter;
        n.onmouseleave = n.onblur = () => (tip.style.opacity = 0);
        n.onmousemove = (e) => {
          tip.style.left = Math.min(innerWidth - 240, e.clientX + 12) + "px";
          tip.style.top = e.clientY + 12 + "px";
        };
      });
    }
    select.onchange = show;
    show();
  }
  function download(frames, active = 0) {
    const title = document.querySelector("#diagramTitle")?.value || "Chart";
    const payload = JSON.stringify({ title, frames, active }).replace(
      /</g,
      "\\u003c",
    );
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ChartUtils.escape(title)}</title><style>body{font-family:system-ui;margin:24px;color:#17212b}h1{font-size:24px}main{overflow:auto}svg{max-width:100%;height:auto}.legend{margin-top:16px}.tip{position:fixed;bottom:16px;left:16px;white-space:pre-line;background:#17212b;color:white;padding:12px;border-radius:8px;pointer-events:none;opacity:0;max-width:240px}:focus-visible{outline:3px solid #5653ff}</style><h1></h1><label>Period <select></select></label><main></main><div class="legend"></div><div class="tip" role="status"></div><script type="application/json" id="chart-data">${payload}</script><script>(${exportRuntime.toString()})();</script></html>`;
    const u = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = u;
    a.download = title.replace(/[\\/:*?"<>|]/g, "-") + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  window.ChartExport = { frame, download };
})();
