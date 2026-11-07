/* Pure data and export helpers, shared by every builder. */
(function (root) {
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function number(value) {
    let s = String(value ?? "").trim();
    if (!s) return NaN;
    const negative = /^\(.*\)$/.test(s);
    if (negative) s = s.slice(1, -1);
    s = s
      .replace(/^[£$€]\s*/, "")
      .replace(/%$/, "")
      .trim();
    if (
      !/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+|\d*\.\d+)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(
        s,
      )
    )
      return NaN;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? (negative ? -n : n) : NaN;
  }
  // Preserve only our two formatting tags, never attributes or arbitrary markup.
  const tooltip = (value) =>
    escape(value).replace(/&lt;(\/?b|br\s*\/?)&gt;/gi, "<$1>");
  function parseDelimited(text) {
    const delimiter = text.includes("\t") ? "\t" : ",";
    const rows = [[]];
    let value = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && (quoted || !value)) {
        if (quoted && text[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
        rows.at(-1).push(value);
        value = "";
        if (c !== delimiter) {
          if (c === "\r" && text[i + 1] === "\n") i++;
          rows.push([]);
        }
      } else value += c;
    }
    rows.at(-1).push(value);
    if (quoted) throw Error("A quoted cell is missing its closing quote.");
    while (rows.length > 1 && rows.at(-1).every((v) => !v.trim())) rows.pop();
    return rows;
  }
  function validateProject(p) {
    if (
      !p ||
      p.version !== 1 ||
      !Array.isArray(p.data) ||
      p.data.length > 10001 ||
      p.data.some(
        (r) =>
          !Array.isArray(r) ||
          r.length > 100 ||
          r.some((v) => typeof v !== "string" || v.length > 10000),
      )
    )
      throw Error(
        "This is not a supported project file (maximum 10,000 rows and 100 columns).",
      );
    if (!["sankey", "bar", "donut", "line", "scatter", "map"].includes(p.mode))
      throw Error("Unknown chart type.");
    return p;
  }
  function signedExtent(rows, keys) {
    return [
      Math.min(
        0,
        ...rows.map((r) =>
          keys.reduce((s, k) => s + Math.min(0, r[k] || 0), 0),
        ),
      ),
      Math.max(
        0,
        ...rows.map((r) =>
          keys.reduce((s, k) => s + Math.max(0, r[k] || 0), 0),
        ),
      ),
    ];
  }
  const api = {
    escape,
    number,
    tooltip,
    parseDelimited,
    validateProject,
    signedExtent,
  };
  if (typeof module !== "undefined") module.exports = api;
  root.ChartUtils = api;
})(typeof window === "undefined" ? globalThis : window);
