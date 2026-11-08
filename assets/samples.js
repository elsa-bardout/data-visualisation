/* Demonstration values are fictional. Camden ward names and library postcodes
   are real: https://www.camden.gov.uk/libraries-opening-times and
   https://www.ons.gov.uk/explore-local-statistics/areas/E09000007-camden */
window.chartSamples = (() => {
  const sankey = [["Source", "Target", "Value", "Period"]];
  const flows = [
    ["Website", "Self-service", 320],
    ["Website", "Advice team", 180],
    ["Phone", "Advice team", 240],
    ["Phone", "Specialist team", 90],
    ["Walk-in", "Advice team", 120],
    ["Walk-in", "Specialist team", 50],
    ["Self-service", "Resolved", 260],
    ["Self-service", "Follow-up", 60],
    ["Advice team", "Resolved", 350],
    ["Advice team", "Follow-up", 140],
    ["Advice team", "Referral", 50],
    ["Specialist team", "Resolved", 80],
    ["Specialist team", "Referral", 60],
  ];
  for (const [period, factor] of [
    ["2024", 0.8],
    ["2025", 1],
    ["2026", 1.2],
  ])
    flows.forEach(([a, b, v]) =>
      sankey.push([a, b, String(Math.round(v * factor)), period]),
    );
  const bar = [["Category", "Series", "Value", "Period"]];
  for (const [period, factor] of [
    ["2025", 1],
    ["2026", 1.15],
  ])
    ["North", "South", "East", "West", "Central"].forEach((name, i) => {
      [
        ["Income", 120 + i * 27],
        ["Grants", 35 + i * 12],
        ["Staff costs", -75 - i * 14],
        ["Other costs", -28 - i * 9],
      ].forEach(([series, v]) =>
        bar.push([name, series, String(Math.round(v * factor)), period]),
      );
    });
  const donut = [
    ["Category", "2024", "2025", "2026"],
    ["Housing", 32, 35, 38],
    ["Public spaces", 22, 24, 26],
    ["Libraries", 16, 18, 21],
    ["Transport", 15, 17, 19],
    ["Youth services", 12, 16, 20],
    ["Culture", 8, 10, 12],
    ["Community grants", 5, 7, 9],
    ["Other", 3, 4, 5],
  ];
  const line = [["Date", "Series", "Value", "Target", "Note"]];
  ["Online", "Phone", "In person"].forEach((series, i) => {
    [82, 91, 86, 108, 118, 125, 112, 130, 142, 137, 155, 167].forEach((v, m) =>
      line.push([
        `2026-${String(m + 1).padStart(2, "0")}-01`,
        series,
        String(v - i * 22 + (m % 3) * i * 6),
        "130",
        m === 5 && i === 0 ? "New booking service" : "",
      ]),
    );
  });
  const scatter = [["X", "Y", "Series", "Size", "Label", "Period", "Note"]];
  for (const [period, factor] of [
    ["2025", 1],
    ["2026", 1.12],
  ])
    ["Neighbourhood hub", "Library", "Advice centre"].forEach((series, i) => {
      for (let j = 0; j < 5; j++)
        scatter.push([
          String(12 + j * 13 + i * 5),
          String(Math.round((22 + j * 9 + i * 12 + (j % 2) * 8) * factor)),
          series,
          String(40 + j * 35 + i * 25),
          `${series} ${j + 1}`,
          period,
          j === 4 ? "Extended opening hours" : "",
        ]);
    });
  // Separate ward and pin rows avoid assigning a library's value to a ward.
  const map = [
    ["Ward", "Council", "Postcode", "Name", "Value", "Category"],
    ["Camden Town", "Camden", "", "Camden Town", 120, "Central"],
    [
      "St Pancras & Somers Town",
      "Camden",
      "",
      "St Pancras & Somers Town",
      95,
      "Central",
    ],
    ["King's Cross", "Camden", "", "King's Cross", 80, "South"],
    ["Bloomsbury", "Camden", "", "Bloomsbury", 145, "South"],
    [
      "Holborn & Covent Garden",
      "Camden",
      "",
      "Holborn & Covent Garden",
      110,
      "South",
    ],
    ["Kentish Town North", "Camden", "", "Kentish Town North", 72, "North"],
    ["Kentish Town South", "Camden", "", "Kentish Town South", 98, "North"],
    ["Haverstock", "Camden", "", "Haverstock", 65, "North"],
    ["Belsize", "Camden", "", "Belsize", 130, "West"],
    ["South Hampstead", "Camden", "", "South Hampstead", 88, "West"],
    ["Camden Square", "Camden", "", "Camden Square", 115, "Central"],
    ["Fortune Green", "Camden", "", "Fortune Green", 78, "West"],
    ["Frognal", "Camden", "", "Frognal", 90, "West"],
    ["Gospel Oak", "Camden", "", "Gospel Oak", 106, "North"],
    ["Hampstead Town", "Camden", "", "Hampstead Town", 138, "North"],
    ["Highgate", "Camden", "", "Highgate", 82, "North"],
    ["Kilburn", "Camden", "", "Kilburn", 67, "West"],
    ["Primrose Hill", "Camden", "", "Primrose Hill", 123, "Central"],
    ["Regent's Park", "Camden", "", "Regent's Park", 101, "Central"],
    ["West Hampstead", "Camden", "", "West Hampstead", 94, "West"],
    ["", "Camden", "NW1 1BD", "Camden Town Library", 55, "Library"],
    ["", "Camden", "NW5 2AA", "Kentish Town Library", 75, "Library"],
    ["", "Camden", "NW3 3HA", "Swiss Cottage Library", 100, "Library"],
  ];
  return Object.fromEntries(
    Object.entries({ sankey, bar, donut, line, scatter, map }).map(
      ([key, rows]) => [key, rows.map((r) => r.map(String))],
    ),
  );
})();
