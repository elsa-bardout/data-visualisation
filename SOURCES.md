# Sample data sources

Static snapshots prepared 10 November 2026. CSVs are bundled with the site; clicking Try sample data does not query source data providers. Map location lookup is separate (see PRIVACY.html). Missing observations are never filled with zero.

## sankey

**Where do refugees go?** — End of 2024 · 30,958,200 refugees · all reported routes, grouped by region

[UNHCR](https://refugeedata.unhcr.org/en/documentation/data-coverage/metadata-catalog/PopStatsOfficial/) · [CSV](assets/samples/refugees.csv)

Complete country-route snapshot aggregated to UNHCR regions for readability, including unspecified origins. All 4,792 country records are available in the linked CSV and reconcile to all 170 asylum-country totals. Refugees under UNHCR’s mandate; excludes UNRWA refugees and other displaced populations. These are resident populations, not movements during the year.

**Where does US government money go?** — Fiscal year 2025 · US$ billion

[US Treasury](https://fiscaldata.treasury.gov/americas-finance-guide/federal-spending/) · [CSV](assets/samples/federal-functions.csv)

Four selected federal functions and their expenditure subfunctions, from MTS table 9A. This is a subset, not all federal spending.

**Which industries produce which greenhouse gases?** — 2024 · thousand tonnes CO₂ equivalent

[ONS environmental accounts](https://www.ons.gov.uk/economy/environmentalaccounts/datasets/ukenvironmentalaccountsatmosphericemissionsgreenhousegasemissionsbyeconomicsectorandgasunitedkingdom) · [CSV](assets/samples/industry-gases.csv)

Six selected economic sectors and seven greenhouse gases; suppressed cells omitted, not treated as zero. ONS expresses non-CO₂ gases in carbon-dioxide equivalents. Residence-based accounts differ from territorial emissions.

**How do spending patterns differ by income?** — FYE 2025 · £ per household per week

[ONS Family Spending](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook2expenditurebyincome) · [CSV](assets/samples/income-spending.csv)

Table 3.7: two-adult, non-retired households by disposable-income quintile. Health and education are suppressed and omitted. Weighted relationships between group averages, not literal transfers or group spending totals.

**What happens to households seeking homelessness assistance?** — Assessed April 2020–March 2021 · households

[MHCLG · cohort table F1](https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness) · [CSV](assets/samples/homelessness-flows.csv)

England cohort whose case closed or received a main-duty decision by March 2022. Actual transitions, rounded to the nearest ten; excludes cases still awaiting those outcomes.

## donut

**Where does US federal spending go?** — Fiscal year 2025 · US$ billion

[US Treasury](https://fiscaldata.treasury.gov/americas-finance-guide/federal-spending/) · [CSV](assets/samples/federal-outlays.csv)

Net federal outlays only. Other functions includes negative credit and undistributed offsetting receipts so the slices sum to total net outlays; not total US public/private expenditure.

**Which sectors produce the UK’s emissions?** — 2024 · million tonnes CO₂ equivalent

[DESNZ](https://www.gov.uk/government/statistics/final-uk-greenhouse-gas-emissions-statistics-1990-to-2024) · [CSV](assets/samples/uk-emissions.csv)

UK territorial greenhouse gases, including land use; excludes international aviation/shipping bunkers.

**How dependent is the world on fossil fuels?** — 2025 · terawatt-hours

[Energy Institute via OWID](https://ourworldindata.org/grapher/primary-energy-source-bar) · [CSV](assets/samples/world-energy.csv)

World primary energy, measured as total energy supply in the 2026 Energy Institute release. Other renewables includes geothermal, biomass and waste; this is not electricity generation alone.

**Where does the average UK household spend its money?** — FYE 2025 · £ per household per week

[ONS Family Spending](https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook1detailedexpenditureandtrends) · [CSV](assets/samples/household-spending.csv)

Table A1: mutually exclusive top-level expenditure groups, including other expenditure. Published averages are rounded; housing is net of benefits.

**What causes most deaths among young children?** — World, 2024 · % of under-five deaths

[UNICEF / UN IGME](https://data.unicef.org/topic/child-survival/under-five-mortality/) · [CSV](assets/samples/child-death-causes.csv)

Three leading causes named in UNICEF’s summary. All other causes is 100 minus those rounded shares; it includes malaria, diarrhoea and other causes.

## bar

**How much higher is maternal mortality among Black women?** — United States, 2024 · deaths per 100,000 live births

[CDC / NCHS](https://www.cdc.gov/nchs/data/hestat/hestat113.htm) · [CSV](assets/samples/maternal-mortality.csv)

National rates by race and Hispanic origin. These data alone cannot measure the effect of state abortion policies.

**Who gets stopped by police in France?** — Surveys 2016 and 2024 · %

[Défenseur des droits · annex 1](https://www.defenseurdesdroits.fr/la-confiance-police-population-les-enseignements-dune-enquete-en-population-generale-au-prisme-des) · [CSV](assets/samples/france-identity-checks.csv)

Metropolitan France, ages 18–79: at least one reported identity check in the preceding five years. Sex, age and perceived-origin groups overlap; these are not counts of police brutality.

**What is the modelled fiscal contribution of work-visa cohorts?** — 2022/23 entry cohorts · £ million, lifetime model

[Migration Advisory Committee · table 23](https://www.gov.uk/government/publications/the-fiscal-impact-of-immigration-in-the-uk) · [CSV](assets/samples/migration-fiscal.csv)

Modelled cohort totals, not per-person estimates or observed accounts. Skilled Worker excludes Health and Care; results depend on earnings, residence and fiscal assumptions. Does not cover all migration routes.

**How much unpaid work do women do?** — Snapshot 10 November 2026 · minutes per day

[OECD Time Use](https://data-explorer.oecd.org/vis?df[ag]=OECD.WISE.INE&df[id]=DSD_TIME_USE@DF_TIME_USE) · [CSV](assets/samples/unpaid-work.csv)

Unpaid care and domestic work. Latest available country surveys have different survey years and methods; selected countries, not a same-year ranking. Each bar is one sex’s average; women and men are not added together.

**Where is housing most unaffordable?** — 2025 · house-price-to-earnings ratio

[ONS](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/housepriceexistingdwellingstoresidencebasedearningsratio) · [CSV](assets/samples/housing-regions.csv)

Existing dwellings: median house price divided by median gross annual residence-based earnings. Nine English regions and Wales; not a mortgage-payment ratio.

## line

**Are UK greenhouse gas emissions falling?** — 1990–2024 · million tonnes CO₂ equivalent

[DESNZ](https://www.gov.uk/government/statistics/final-uk-greenhouse-gas-emissions-statistics-1990-to-2024) · [CSV](assets/samples/emissions-history.csv)

Consistent UK territorial series; excludes international aviation/shipping bunkers. Land-use totals include removals.

**Has housing become less affordable?** — 2002–2025 · house-price-to-earnings ratio

[ONS](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/housepriceexistingdwellingstoresidencebasedearningsratio) · [CSV](assets/samples/housing-history.csv)

Existing-dwelling prices / residence-based median annual earnings. Selected regions and Wales.

**Has crime actually increased?** — 1981–2026 · estimated incidents, thousands

[ONS · Crime Survey for England and Wales](https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/crimeinenglandandwalesappendixtables) · [CSV](assets/samples/crime-history.csv)

Calendar years before 2002; year ending March thereafter. Adults 16+ / households. Pandemic gap: no comparable 2021–2022 estimates; connecting lines do not supply missing observations. Survey estimates, not police-recorded offences.

**Is rough sleeping increasing?** — 2010–2025 · people

[MHCLG](https://www.gov.uk/government/statistics/rough-sleeping-snapshot-in-england-autumn-2025) · [CSV](assets/samples/rough-sleeping.csv)

Estimated people sleeping rough on one autumn night, not everyone experiencing homelessness. London is included in England.

**How has childhood vaccination coverage changed?** — 1980–2024 · % of one-year-olds

[WHO / UNICEF via OWID](https://ourworldindata.org/grapher/global-vaccination-coverage) · [CSV](assets/samples/vaccination.csv)

World coverage estimates; these series show programme reach, not a direct estimate of deaths prevented.

## scatter

**Does being richer mean living longer?** — 2022 · X: GDP/person, 2011 international $ · Y: life expectancy, years

[OWID · underlying sources in chart metadata](https://ourworldindata.org/grapher/life-expectancy-vs-gdp-per-capita) · [CSV](assets/samples/income-longevity.csv)

Countries with both measures in this year. Association is not evidence of causation.

**Does more healthcare spending mean better outcomes?** — 2023 · X: healthcare/person, 2020 international $ · Y: life expectancy, years

[OWID · underlying sources in chart metadata](https://ourworldindata.org/grapher/life-expectancy-vs-health-expenditure) · [CSV](assets/samples/health-longevity.csv)

Countries with both measures in this year. Association is not evidence of causation.

**Do richer countries pollute more?** — 2022 · X: GDP/person, 2011 international $ · Y: tonnes CO₂/person

[OWID · underlying sources in chart metadata](https://ourworldindata.org/grapher/co2-emissions-vs-gdp) · [CSV](assets/samples/income-carbon.csv)

Countries with both measures in this year. Association is not evidence of causation.

**Does national income relate to child survival?** — 2022 · X: GDP/person, 2011 international $ · Y: under-five deaths/1,000 births

[OWID / UN IGME](https://ourworldindata.org/grapher/child-mortality) · [CSV](assets/samples/income-child-survival.csv)

Joined by country code and year to OWID GDP per capita. Mortality converted from deaths per 100 to per 1,000 live births; association, not causation.

**How does economic growth relate to emissions?** — 2022–2024 · X: annual real GDP change % · Y: annual CO₂ change %

[OWID · World Bank / Global Carbon Budget](https://ourworldindata.org/grapher/co2-emissions-and-gdp) · [CSV](assets/samples/growth-carbon.csv)

Changes calculated as (this year / previous year − 1) × 100, requiring consecutive years and positive bases. Territorial CO₂; associations are not causal effects.

## map

**Where is extreme poverty most prevalent?** — 2018 · % below $3/day in 2021 purchasing-power prices

[World Bank via OWID](https://ourworldindata.org/grapher/share-of-population-in-extreme-poverty) · [CSV](assets/samples/extreme-poverty.csv)

Common-year snapshot of countries with data and bundled boundaries; missing countries are not zero.

**Where do people lack clean cooking fuels?** — 2024 · % without clean cooking access

[WHO via OWID](https://ourworldindata.org/grapher/access-to-clean-fuels-and-technologies-for-cooking) · [CSV](assets/samples/clean-cooking.csv)

Common-year snapshot of countries with data and bundled boundaries; missing countries are not zero. Calculated as 100 minus access percentage.

**Which countries emit the most CO₂ per person?** — 2024 · tonnes of territorial CO₂ per person

[Global Carbon Budget via OWID](https://ourworldindata.org/grapher/co-emissions-per-capita) · [CSV](assets/samples/carbon-per-person.csv)

Common-year snapshot of countries with data and bundled boundaries; missing countries are not zero.

**Where is abortion banned in the US?** — 16 October 2026 · policy snapshot

[KFF policy tracker](https://www.kff.org/womens-health-policy/exceptions-in-state-abortion-bans-and-early-gestational-limits/) · [CSV](assets/samples/abortion-policies.csv)

Dated summary, not current legal or medical advice. X means an exception is listed, subject to conditions. Later-limit category does not mean unrestricted access. Consult the linked tracker for court orders and detailed exceptions.

**Which English places have the greatest housing affordability problem?** — 2025 · house-price-to-earnings ratio

[ONS](https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/housepriceexistingdwellingstoresidencebasedearningsratio) · [CSV](assets/samples/housing-authorities.csv)

The 25 English local authorities with the highest available existing-dwelling median price / residence-based median annual earnings ratios. Missing or suppressed ratios excluded.

**Camden wards and public libraries** — Directory checked 10 November 2026

[Camden Council](https://www.camden.gov.uk/libraries-opening-times) · [CSV](assets/samples/camden-libraries.csv)

Twenty wards in five neighbourhoods, plus nine council libraries and three community libraries open to the public. Pins use full street addresses; no invented activity or population figures.

## Rebuilding

Download source files using `assets/samples/provenance.json` into `.review-tools/story-sources`, then run `python scripts/build_samples.py` (pandas and openpyxl required). The Camden ward grouping is retained from the existing sample; public library addresses are listed in the build script. Manually transcribed tables are identified in the script. Natural Earth country and US state boundaries are public-domain cartography, not legal boundary determinations.

## Source-link check — 11 November 2026

All catalog source pages were checked. The broken UNHCR data-finder link was replaced with the official dataset documentation. UNICEF and Camden block automated HTTP clients but their relevant pages were verified separately. The unavailable Keats website link was removed; Camden’s community-library directory identifies Keats.

The refugee sample now covers all reported country routes, aggregated by UNHCR region to keep the chart readable. [Complete country-route CSV (4,792 records)](assets/samples/refugees-all-country-routes.csv). For rebuilding, fetch every page of the UNHCR query in provenance.json, concatenate its data, and preserve the pagination record with has_next set to false only after all 4,962 records have been retrieved.
