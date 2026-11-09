/* Curated, sourced snapshots. See SOURCES.md for scope and derivations. */
window.chartSampleSets = (() => {
  const food =
    "https://ec.europa.eu/eurostat/en/web/products-eurostat-news/w/ddn-20240301-1";
  const sleepSource = "https://faculty.washington.edu/chudler/chasleep.html";
  const nasa = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/";
  const libraries = "https://www.camden.gov.uk/libraries-opening-times";
  const sleep = [
    ["Brown bat", 19.9],
    ["Opossum", 19.4],
    ["Python", 18],
    ["Tiger", 15.8],
    ["Squirrel", 14.9],
    ["Cat", 12.1],
    ["Dog", 10.6],
    ["Giraffe", 4.5],
    ["Horse", 2.9],
  ];
  const fruit = [
    ["Apples", 12.6],
    ["Pears", 2.1],
    ["Citrus", 10.5],
    ["Stone fruit", 6.3],
    ["Tropical and subtropical", 2.6],
    ["Nuts", 1.1],
    ["Berries", 0.7],
  ];
  const veg = [
    ["Tomatoes", 15.4],
    ["Onions", 6.2],
    ["Carrots", 4.4],
    ["Other vegetables", 33.8],
  ];
  // name, diameter km, gravity m/s², distance million km, orbital days, day hours
  const planets = [
    ["Mercury", 4879, 3.7, 57.9, 88, 4222.6],
    ["Venus", 12104, 8.9, 108.2, 224.7, 2802],
    ["Earth", 12756, 9.8, 149.6, 365.2, 24],
    ["Mars", 6792, 3.7, 228, 687, 24.7],
    ["Jupiter", 142984, 23.1, 778.5, 4331, 9.9],
    ["Saturn", 120536, 9, 1432, 10747, 10.7],
    ["Uranus", 51118, 8.7, 2867, 30589, 17.2],
    ["Neptune", 49528, 11, 4515, 59800, 16.1],
  ];
  const boroughs = [
    ["Camden", 220300, 210100, "E09000007"],
    ["Islington", 206100, 216600, "E09000019"],
    ["Hackney", 246300, 259100, "E09000012"],
    ["Westminster", 219400, 204200, "E09000033"],
  ];
  const ons = (code) =>
    "https://www.ons.gov.uk/visualisations/censusareachanges/" + code + "/";
  const entry = (title, rows) => ({
    title,
    rows: rows.map((r) => r.map(String)),
  });
  const simple = (rows, source, unit) => [
    ["Category", "Value", "Unit", "Source URL"],
    ...rows.map((r) => [...r, unit, source]),
  ];
  const sleepFlow = [
    ["Source", "Target", "Value", "Unit", "Source URL", "Method"],
  ];
  sleep.forEach(([name, h]) => {
    sleepFlow.push(
      [
        "One day per species",
        name,
        24,
        "hours",
        sleepSource,
        "Each species contributes one 24-hour day; not population totals",
      ],
      [
        name,
        "Asleep",
        h,
        "hours",
        sleepSource,
        "Published average; varies by study and conditions",
      ],
      [
        name,
        "Awake",
        +(24 - h).toFixed(1),
        "hours",
        sleepSource,
        "Calculated as 24 minus sleep hours",
      ],
    );
  });
  const harvest = [
    ["Source", "Target", "Value", "Unit", "Source URL"],
    ["Fruit harvest", "Pome fruit", 14.7, "million tonnes", food],
    ["Pome fruit", "Apples", 12.6, "million tonnes", food],
    ["Pome fruit", "Pears", 2.1, "million tonnes", food],
    ...fruit
      .slice(2)
      .map(([n, v]) => ["Fruit harvest", n, v, "million tonnes", food]),
  ];
  const vegFlow = [
    ["Source", "Target", "Value", "Unit", "Source URL"],
    ...veg.map(([n, v]) => ["Vegetable harvest", n, v, "million tonnes", food]),
    ["Tomatoes", "Italy", 6.16, "million tonnes", food],
    ["Tomatoes", "Spain", 3.696, "million tonnes", food],
    ["Tomatoes", "Portugal", 1.386, "million tonnes", food],
    ["Tomatoes", "Other tomato producers", 4.158, "million tonnes", food],
    ["Onions", "Netherlands", 1.488, "million tonnes", food],
    ["Onions", "Spain", 1.24, "million tonnes", food],
    ["Onions", "France", 0.744, "million tonnes", food],
    ["Onions", "Other onion producers", 2.728, "million tonnes", food],
  ];
  const camden = [
    ["Ward", "Council", "Postcode", "Name", "Category", "Source URL"],
    ...window.chartSamples.map
      .slice(1)
      .map((r) => [
        r[0],
        r[1],
        r[2],
        r[3],
        r[5],
        r[0] ? "https://www.camden.gov.uk/wards" : libraries,
      ]),
  ];
  return {
    sankey: [
      entry("EU fruit harvest · 2022 · million tonnes", harvest),
      entry("Who grows the tomatoes? · EU 2022", vegFlow),
      entry("Who sleeps most? · one day per species", sleepFlow),
    ],
    bar: [
      entry(
        "Who sleeps most? · hours per day",
        simple(sleep, sleepSource, "hours/day"),
      ),
      entry(
        "EU fruit harvest · 2022 · million tonnes",
        simple(fruit, food, "million tonnes"),
      ),
      entry(
        "A day on Venus · solar day in hours",
        simple(
          planets.map((p) => [p[0], p[5]]),
          nasa,
          "hours per solar day",
        ),
      ),
    ],
    donut: [
      entry("EU fruit harvest · 2022", simple(fruit, food, "million tonnes")),
      entry("EU vegetables · 2022", simple(veg, food, "million tonnes")),
      entry("A day in the life · sleep versus awake", [
        ["Category", ...sleep.map((r) => r[0]), "Source URL"],
        ["Asleep", ...sleep.map((r) => r[1]), sleepSource],
        ["Awake", ...sleep.map((r) => +(24 - r[1]).toFixed(1)), sleepSource],
      ]),
    ],
    line: [
      entry("London neighbours · rounded census population", [
        ["Year", ...boroughs.map((r) => r[0]), "Source URL"],
        ...["2011", "2021"].map((y, i) => [
          y,
          ...boroughs.map((r) => r[i + 1]),
          boroughs.map((r) => ons(r[3])).join(" "),
        ]),
      ]),
      entry("Planetary orbits · distance from Sun", [
        ["X", "Value", "Name", "Unit", "Source URL"],
        ...planets.map((p) => [
          p[3],
          p[4],
          p[0],
          "X: million km; Y: orbital days",
          nasa,
        ]),
      ]),
      entry("Islington working hours · census percentages", [
        [
          "Year",
          "15 hours or less",
          "16–30 hours",
          "31–48 hours",
          "49+ hours",
          "Source URL",
        ],
        ["2011", 7.3, 13.6, 57.6, 21.4, ons("E09000019")],
        ["2021", 9.6, 13.8, 58.7, 17.9, ons("E09000019")],
      ]),
    ],
    scatter: [
      entry("Big planet, strong gravity?", [
        ["Name", "X", "Y", "Series", "X unit", "Y unit", "Source URL"],
        ...planets.map((p, i) => [
          p[0],
          p[1],
          p[2],
          i < 4 ? "Rocky planets" : "Giant planets",
          "diameter km",
          "gravity m/s²",
          nasa,
        ]),
      ]),
      entry("Planetary orbits · distance and year length", [
        ["Name", "X", "Y", "X unit", "Y unit", "Source URL"],
        ...planets.map((p) => [
          p[0],
          p[3],
          p[4],
          "million km",
          "orbital days",
          nasa,
        ]),
      ]),
      entry("London population · 2011 versus 2021", [
        ["Name", "X", "Y", "X unit", "Y unit", "Source URL"],
        ...boroughs.map((r) => [
          r[0],
          r[1],
          r[2],
          "2011 residents (rounded)",
          "2021 residents (rounded)",
          ons(r[3]),
        ]),
      ]),
    ],
    map: [
      entry("Camden · wards, neighbourhoods and libraries", camden),
      entry("London neighbours · Census 2021", [
        ["Council", "Value", "Unit", "Source URL"],
        ...boroughs.map((r) => [r[0], r[2], "residents (rounded)", ons(r[3])]),
      ]),
      entry("Europe · who grows the vegetables?", [
        ["Country", "Value", "Category", "Unit", "Year", "Source URL"],
        ["Italy", 40, "Tomatoes", "share of EU tomato harvest (%)", 2022, food],
        ["Spain", 24, "Tomatoes", "share of EU tomato harvest (%)", 2022, food],
        [
          "Portugal",
          9,
          "Tomatoes",
          "share of EU tomato harvest (%)",
          2022,
          food,
        ],
        [
          "Netherlands",
          24,
          "Onions",
          "share of EU onion harvest (%)",
          2022,
          food,
        ],
        [
          "Germany",
          18,
          "Carrots",
          "share of EU carrot harvest (%)",
          2022,
          food,
        ],
        ["Poland", 14, "Carrots", "share of EU carrot harvest (%)", 2022, food],
      ]),
      entry("British museums · from lawnmowers to dinosaurs", [
        ["Name", "Postcode", "Category", "Address details", "Source URL"],
        [
          "British Lawnmower Museum",
          "PR8 5AJ",
          "Unexpected collections",
          "106–114 Shakespeare Street, Southport",
          "https://www.lawnmowerworld.co.uk/contactUs.php",
        ],
        [
          "Eureka!",
          "HX1 2NE",
          "Hands-on discovery",
          "Discovery Road, Halifax",
          "https://eureka.org.uk/contact/",
        ],
        [
          "Natural History Museum",
          "SW7 5BD",
          "Natural history",
          "Cromwell Road, London",
          "https://www.nhm.ac.uk/visit.html",
        ],
        [
          "National Museum of Scotland",
          "EH1 1JF",
          "History and science",
          "Chambers Street, Edinburgh",
          "https://www.nms.ac.uk/scotland",
        ],
      ]),
    ],
  };
})();
// Real period changes, with rounded ONS percentages preserved verbatim.
window.chartSampleSets.sankey.push(
  (() => {
    const source =
      "https://www.ons.gov.uk/visualisations/censusareachanges/E09000019/";
    const groups = [
      "15 hours or less",
      "16–30 hours",
      "31–48 hours",
      "49+ hours",
    ];
    const rows = [
      ["Source", "Target", "Value", "Period", "Unit", "Source URL"],
    ];
    [
      ["2011", [7.3, 13.6, 57.6, 21.4]],
      ["2021", [9.6, 13.8, 58.7, 17.9]],
    ].forEach(([year, values]) => {
      groups.forEach((g, i) => {
        rows.push(
          [
            "Islington workers",
            g,
            String(values[i]),
            year,
            "percent (rounded)",
            source,
          ],
          [
            g,
            i < 2 ? "Up to 30 hours" : "Over 30 hours",
            String(values[i]),
            year,
            "percent (rounded)",
            source,
          ],
        );
      });
    });
    return { title: "Islington working hours · Census 2011 and 2021", rows };
  })(),
);
