"""Build checked-in CSV snapshots from downloaded source files.

Inputs: .review-tools/story-sources (download URLs recorded in assets/samples/provenance.json).
Requires openpyxl and pandas. Nothing here runs in visitors' browsers.
"""
import csv,json,re,html
from pathlib import Path
from collections import defaultdict
import pandas as pd
from source_workbooks import read

RAW=Path('.review-tools/story-sources'); OUT=Path('assets/samples'); OUT.mkdir(exist_ok=True)
catalog={k:[] for k in ['sankey','donut','bar','line','scatter','map']}
urls=json.loads((RAW/'urls.json').read_text())
HOUSING='https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/housepriceexistingdwellingstoresidencebasedearningsratio'
EMISSIONS='https://www.gov.uk/government/statistics/final-uk-greenhouse-gas-emissions-statistics-1990-to-2024'
SPENDING='https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook1detailedexpenditureandtrends'
TREASURY='https://fiscaldata.treasury.gov/americas-finance-guide/federal-spending/'
def add(mode,id,title,header,rows,source,url,reference,notes):
 rows=list(rows); assert rows, id
 labels={
  'refugees':['Origin region','Asylum region','Refugees (people)'],
  'federal-functions':['Federal function','Expenditure subfunction','Net outlays (US$ billion)'],
  'industry-gases':['Economic sector','Greenhouse gas','Emissions (thousand tonnes CO2e)'],
  'income-spending':['Disposable-income quintile','Spending purpose','Weekly expenditure (£ per household)'],
  'homelessness-flows':['From duty or assessment','To duty or outcome','Households'],
  'federal-outlays':['Federal function','Net outlays (US$ billion)'],
  'uk-emissions':['Sector','Emissions (million tonnes CO2e)'],
  'world-energy':['Energy source','Primary energy (TWh)'],
  'household-spending':['Spending purpose','Weekly expenditure (£ per household)'],
  'child-death-causes':['Cause of death','Share of under-five deaths (%)'],
  'maternal-mortality':['Race and Hispanic origin','Deaths per 100,000 live births'],
  'france-identity-checks':['Population group','2016','2024'],
  'migration-fiscal':['Visa route and applicant group','Net lifetime fiscal contribution (£ million)'],
  'unpaid-work':['Country and sex','Series','Unpaid work (minutes per day)'],
  'housing-regions':['Region','Median house-price-to-earnings ratio'],
  'income-longevity':['Country','GDP per capita (2011 international $)','Life expectancy (years)','Region'],
  'health-longevity':['Country','Health spending per person (2020 international $)','Life expectancy (years)','Region'],
  'income-carbon':['Country','GDP per capita (2011 international $)','CO2 emissions (tonnes per person)','Region'],
  'income-child-survival':['Country','GDP per capita (2011 international $)','Under-five deaths per 1,000 live births','Region'],
  'growth-carbon':['Country','Year','Annual real GDP change (%)','Annual CO2 emissions change (%)'],
  'extreme-poverty':['Country','Name','Population below $3/day (%)'],
  'clean-cooking':['Country','Name','Population without clean cooking (%)'],
  'carbon-per-person':['Country','Name','Territorial CO2 (tonnes per person)'],
  'housing-authorities':['Council code','Name','Median house-price-to-earnings ratio'],
 }
 header=labels.get(id,header)
 with (OUT/(id+'.csv')).open('w',newline='',encoding='utf-8') as f:
  csv.writer(f).writerows([header]+rows)
 catalog[mode].append(dict(id=id,title=title,csv='assets/samples/'+id+'.csv',source=source,url=url,reference=reference,notes=notes))
 units={'emissions-history':'Emissions (million tonnes CO2e)','housing-history':'Median house-price-to-earnings ratio','crime-history':'Estimated incidents (thousands)','rough-sleeping':'People sleeping rough on one night','vaccination':'Children vaccinated (%)','france-identity-checks':'Reported identity check in preceding five years (%)','unpaid-work':'Unpaid work (minutes per day)'}
 if id in units:catalog[mode][-1]['valueLabel']=units[id]
def num(x):
 try:return float(str(x).replace(',',''))
 except:return None
def owid(slug):return pd.read_csv(RAW/(slug+'.csv'))
def owidurl(slug):return 'https://ourworldindata.org/grapher/'+slug
def clean(x):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',re.sub(r'<sup>.*?</sup>','',str(x))))).strip()

# Actual origin/destination records; the two regional dimensions must be retained in the API query.
ref=json.loads((RAW/'refugees-full.json').read_text())
assert not ref['pagination']['has_next']
detail=[r for r in ref['data'] if r['area_ori_adm0']!='_T' and r['ref_area_adm0']!='_T']
totals=[r for r in ref['data'] if r['area_ori_adm0']=='_T']
assert len(detail)==4792
assert sum(r['obs_value'] for r in detail)==sum(r['obs_value'] for r in totals)==30958200
for t in totals:assert t['obs_value']==sum(r['obs_value'] for r in detail if r['ref_area_adm0']==t['ref_area_adm0'])
regions=defaultdict(int)
for r in detail:regions[(r['area_ori_region_unhcr_label'],r['ref_area_region_unhcr_label'])]+=r['obs_value']
with (OUT/'refugees-all-country-routes.csv').open('w',newline='',encoding='utf8') as f:
 csv.writer(f).writerows([['Country of origin','Country of asylum','Refugees (people)','Year']]+[[r['area_ori_adm0_label'],r['ref_area_adm0_label'],r['obs_value'],2024] for r in detail])
add('sankey','refugees','Where do refugees go?',['Source','Target','Value'],
 [[a+' (origin)',b+' (asylum)',v] for (a,b),v in sorted(regions.items()) if v>0],
 'UNHCR','https://refugeedata.unhcr.org/en/documentation/data-coverage/metadata-catalog/PopStatsOfficial/','End of 2024 · 30,958,200 refugees · all reported routes, grouped by region',
 'Complete country-route snapshot aggregated to UNHCR regions for readability, including unspecified origins. All 4,792 country records are available in the linked CSV and reconcile to all 170 asylum-country totals. Refugees under UNHCR’s mandate; excludes UNRWA refugees and other displaced populations. These are resident populations, not movements during the year.')
catalog['sankey'][-1]['extraSources']=[{'label':'Complete country-route CSV (4,792 records)','url':'assets/samples/refugees-all-country-routes.csv'}]

t=json.loads((RAW/'treasury.json').read_text())['data']; parent=next(r['classification_id'] for r in t if r['classification_desc']=='Net Outlays')
functions={r['classification_desc']:float(r['current_fytd_rcpt_outly_amt'])/1e9 for r in t if r['parent_id']==parent and r['classification_desc']!='Total'}
large=['Social Security','Medicare','Health','Net Interest','National Defense','Income Security','Veterans Benefits and Services']
donut=[[k,round(functions[k],6)] for k in large]+[['Other functions (net)',round(sum(v for k,v in functions.items() if k not in large),6)]]
assert abs(sum(r[1] for r in donut)-7009.9736670493)<0.00001
add('donut','federal-outlays','Where does US federal spending go?',['Category','Value'],donut,'US Treasury',TREASURY,'Fiscal year 2025 · US$ billion','Net federal outlays only. Other functions includes negative credit and undistributed offsetting receipts so the slices sum to total net outlays; not total US public/private expenditure.')
details=json.loads((RAW/'treasury-detail.json').read_text())['data']; selected=['National Defense','Health','Income Security','Veterans Benefits and Services']
flow=[]
for f in selected:
 parts=[r for r in details if r['function_desc']==f and num(r['current_fytd_outly_amt']) is not None and r['sub_function_desc'].lower()!='total']
 # These selected functions have positive subfunctions, avoiding misleading negative-width ribbons.
 assert parts and all(float(r['current_fytd_outly_amt'])>=0 for r in parts),f
 for r in parts:
  v=float(r['current_fytd_outly_amt'])/1e9
  if v:flow.append([f,'Other retirement and disability insurance' if r['sub_function_desc'].startswith('General retirement and disability insurance') else r['sub_function_desc'],round(v,6)])
add('sankey','federal-functions','Where does US government money go?',['Source','Target','Value'],flow,'US Treasury',TREASURY,'Fiscal year 2025 · US$ billion','Four selected federal functions and their expenditure subfunctions, from MTS table 9A. This is a subset, not all federal spending.')

industry=read('industry.xlsx'); flows=[]
sectors={1:'Agriculture, forestry and fishing',2:'Mining and quarrying',3:'Manufacturing',4:'Electricity and gas',5:'Water, sewerage and waste',8:'Transport and storage'}
for gas in ['CO2','CH4','N2O','HFC','PFC','SF6','NF3']:
 rows=industry[gas]; r=next(r for r in rows if str(r[0])=='2024')
 for c,name in sectors.items():
  v=num(r[c])
  if v is not None and v>0:flows.append([name,{'CO2':'Carbon dioxide','CH4':'Methane','N2O':'Nitrous oxide'}.get(gas,gas),round(v,6)])
add('sankey','industry-gases','Which industries produce which greenhouse gases?',['Source','Target','Value'],flows,'ONS environmental accounts','https://www.ons.gov.uk/economy/environmentalaccounts/datasets/ukenvironmentalaccountsatmosphericemissionsgreenhousegasemissionsbyeconomicsectorandgasunitedkingdom','2024 · thousand tonnes CO₂ equivalent','Six selected economic sectors and seven greenhouse gases; suppressed cells omitted, not treated as zero. ONS expresses non-CO₂ gases in carbon-dioxide equivalents. Residence-based accounts differ from territorial emissions.')
income=read('income.xlsx')['3.7']; flows=[]
for r in income:
 if str(r[0]).isdigit() and 1<=int(r[0])<=13 and all(num(r[c]) is not None for c in range(3,8)):
  for c,q in enumerate(['Lowest quintile','Second quintile','Middle quintile','Fourth quintile','Highest quintile'],3):flows.append([q,clean(r[1]),num(r[c])])
add('sankey','income-spending','How do spending patterns differ by income?',['Source','Target','Value'],flows,'ONS Family Spending','https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/datasets/familyspendingworkbook2expenditurebyincome','FYE 2025 · £ per household per week','Table 3.7: two-adult, non-retired households by disposable-income quintile. Health and education are suppressed and omitted. Weighted relationships between group averages, not literal transfers or group spending totals.')
flow=[['Assessed households','Prevention duty',108300],['Assessed households','Relief duty',134820],['Prevention duty','Accommodation secured after prevention',65260],['Prevention duty','Other prevention outcomes',25590],['Prevention duty','Relief duty',17450],['Relief duty','Accommodation secured after relief',63890],['Relief duty','Other relief outcomes',33440],['Relief duty','Main duty decision',54940],['Main duty decision','Main duty accepted',34590],['Main duty decision','Main duty not owed',20350]]
add('sankey','homelessness-flows','What happens to households seeking homelessness assistance?',['Source','Target','Value'],flow,'MHCLG · cohort table F1','https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness','Assessed April 2020–March 2021 · households','England cohort whose case closed or received a main-duty decision by March 2022. Actual transitions, rounded to the nearest ten; excludes cases still awaiting those outcomes.')

em=read('emissions.xlsx')['1.2']; sectors=[r for r in em if isinstance(r[0],str) and r[0].endswith(' total') and r[0]!='Grand total' and num(r[37]) is not None]
assert len(sectors)==8,len(sectors)
assert all(r[37]>=0 for r in sectors)
add('donut','uk-emissions','Which sectors produce the UK’s emissions?',['Category','Value'],[[r[0][:-6],round(r[37],5)] for r in sectors],'DESNZ',EMISSIONS,'2024 · million tonnes CO₂ equivalent','UK territorial greenhouse gases, including land use; excludes international aviation/shipping bunkers.')
add('line','emissions-history','Are UK greenhouse gas emissions falling?',['Year']+[r[0][:-6] for r in sectors],[[1990+c-3]+[round(r[c],5) for r in sectors] for c in range(3,38)],'DESNZ',EMISSIONS,'1990–2024 · million tonnes CO₂ equivalent','Consistent UK territorial series; excludes international aviation/shipping bunkers. Land-use totals include removals.')
energy=owid('primary-energy-source-bar'); world=energy[energy.Entity=='World'].dropna(subset=list(energy.columns[3:])); year=int(world.Year.max()); er=world[world.Year==year].iloc[0]
add('donut','world-energy','How dependent is the world on fossil fuels?',['Category','Value'],[[c,round(float(er[c]),3)] for c in energy.columns[3:]],'Energy Institute via OWID',owidurl('primary-energy-source-bar'),str(year)+' · terawatt-hours','World primary energy, measured as total energy supply in the 2026 Energy Institute release. Other renewables includes geothermal, biomass and waste; this is not electricity generation alone.')
spend=read('spending.xlsx')['A1']; cats=[r for r in spend if str(r[0]).isdigit() and 1<=int(r[0])<=13 and num(r[6]) is not None]
assert len(cats)==13,len(cats)
add('donut','household-spending','Where does the average UK household spend its money?',['Category','Value'],[[clean(r[1]).replace('(net)2','(net)').replace('Communication4','Communication'),num(r[6])] for r in cats],'ONS Family Spending',SPENDING,'FYE 2025 · £ per household per week','Table A1: mutually exclusive top-level expenditure groups, including other expenditure. Published averages are rounded; housing is net of benefits.')
add('donut','child-death-causes','What causes most deaths among young children?',['Category','Value'],[['Prematurity',18],['Pneumonia',13],['Birth asphyxia or trauma',10],['All other causes',59]],'UNICEF / UN IGME','https://data.unicef.org/topic/child-survival/under-five-mortality/','World, 2024 · % of under-five deaths','Three leading causes named in UNICEF’s summary. All other causes is 100 minus those rounded shares; it includes malaria, diarrhoea and other causes.')

add('bar','maternal-mortality','How much higher is maternal mortality among Black women?',['Category','Value'],[['Black, non-Hispanic',44.8],['Asian, non-Hispanic',18.1],['White, non-Hispanic',14.2],['Hispanic',12.1]],'CDC / NCHS','https://www.cdc.gov/nchs/data/hestat/hestat113.htm','United States, 2024 · deaths per 100,000 live births','National rates by race and Hispanic origin. These data alone cannot measure the effect of state abortion policies.')
add('bar','france-identity-checks','Who gets stopped by police in France?',['Category','2016','2024'],[['Men',23,35],['Women',10,18],['Age 18–24',39,41],['Age 25–34',22,35],['Age 35–44',16,28],['Age 45–54',13,27],['Age 55–64',8,20],['Age 65–79',6,13],['Perceived as white only',13,23],['Perceived as Arab, Black or Maghrebi',38,39],['Other perceived origin',17,32]],'Défenseur des droits · annex 1','https://www.defenseurdesdroits.fr/la-confiance-police-population-les-enseignements-dune-enquete-en-population-generale-au-prisme-des','Surveys 2016 and 2024 · %','Metropolitan France, ages 18–79: at least one reported identity check in the preceding five years. Sex, age and perceived-origin groups overlap; these are not counts of police brutality.')
mac=read('migration.ods')['Table_23']
assert [r[4] for r in mac[2:8]]==[47700,100,-800,5500,-3300,-2000]
# Values transcribed from Table 23, net lifetime fiscal impacts of the 2022/23 entry cohorts (£m).
add('bar','migration-fiscal','What is the modelled fiscal contribution of work-visa cohorts?',['Category','Value'],[['Skilled Worker: main applicants',47700],['Skilled Worker: adult dependants',100],['Skilled Worker: child dependants',-800],['Health and Care: main applicants',5500],['Health and Care: adult dependants',-3300],['Health and Care: child dependants',-2000]],'Migration Advisory Committee · table 23','https://www.gov.uk/government/publications/the-fiscal-impact-of-immigration-in-the-uk','2022/23 entry cohorts · £ million, lifetime model','Modelled cohort totals, not per-person estimates or observed accounts. Skilled Worker excludes Health and Care; results depend on earnings, residence and fiscal assumptions. Does not cover all migration routes.')
o=pd.read_csv(RAW/'oecd.csv'); names={'AUS':'Australia','BEL':'Belgium','CAN':'Canada','FRA':'France','DEU':'Germany','ITA':'Italy','JPN':'Japan','KOR':'South Korea','MEX':'Mexico','ESP':'Spain','GBR':'United Kingdom','USA':'United States'}; orows=[]
for code,name in names.items():
 d=o[(o.REF_AREA==code)&(o.MEASURE=='UPW')]; vals={r.SEX:float(r.OBS_VALUE) for _,r in d.iterrows()}
 if 'F' in vals and 'M' in vals:orows.append([name,vals['F'],vals['M']])
assert len(orows)>=10
add('bar','unpaid-work','How much unpaid work do women do?',['Category','Series','Value'],[[r[0]+' · '+sex,sex,round(r[i],2)] for r in orows for i,sex in [(1,'Women'),(2,'Men')]],'OECD Time Use','https://data-explorer.oecd.org/vis?df[ag]=OECD.WISE.INE&df[id]=DSD_TIME_USE@DF_TIME_USE','Snapshot 10 November 2026 · minutes per day','Unpaid care and domestic work. Latest available country surveys have different survey years and methods; selected countries, not a same-year ranking. Each bar is one sex’s average; women and men are not added together.')
catalog['bar'][-1]['preset']={'settings':{'orientation':'horizontal'},'controls':{'h':'850','w':'980'}}
housing=read('housing.xlsx'); regions=housing['1c']; use=regions[4:14]
add('bar','housing-regions','Where is housing most unaffordable?',['Category','Value'],[[r[1],r[25]] for r in use],'ONS',HOUSING,'2025 · house-price-to-earnings ratio','Existing dwellings: median house price divided by median gross annual residence-based earnings. Nine English regions and Wales; not a mortgage-payment ratio.')
selected=[regions[i] for i in [4,5,6,11,12]]
add('line','housing-history','Has housing become less affordable?',['Year']+[r[1] for r in selected],[[2000+c]+[r[c] for r in selected] for c in range(2,26)],'ONS',HOUSING,'2002–2025 · house-price-to-earnings ratio','Existing-dwelling prices / residence-based median annual earnings. Selected regions and Wales.')
crime=read('crime.xlsx')['Table A1a']; crows=[]
for c in range(1,32):
 years=re.findall(r'\d{4}',crime[7][c]); yr=int(years[-1]); crows.append([yr,crime[8][c],crime[14][c]])
add('line','crime-history','Has crime actually increased?',['Year','Violence','Theft'],crows,'ONS · Crime Survey for England and Wales','https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/crimeinenglandandwalesappendixtables','1981–2026 · estimated incidents, thousands','Calendar years before 2002; year ending March thereafter. Adults 16+ / households. Pandemic gap: no comparable 2021–2022 estimates; connecting lines do not supply missing observations. Survey estimates, not police-recorded offences.')
rough=read('rough.ods')['Table_1_Total']
add('line','rough-sleeping','Is rough sleeping increasing?',['Year','England','London'],[[2010+c-4,rough[5][c],rough[6][c]] for c in range(4,20)],'MHCLG','https://www.gov.uk/government/statistics/rough-sleeping-snapshot-in-england-autumn-2025','2010–2025 · people','Estimated people sleeping rough on one autumn night, not everyone experiencing homelessness. London is included in England.')
vacc=owid('global-vaccination-coverage'); vcols=['Measles, first dose (MCV1)','Diptheria/tetanus/pertussis (DTP3)','Polio (Pol3, historical)']; vr=vacc[(vacc.Entity=='World')&(vacc.Year>=1980)].dropna(subset=vcols)
add('line','vaccination','How has childhood vaccination coverage changed?',['Year','Measles (first dose)','DTP (third dose)','Polio (third dose)'],[[int(r.Year)]+[float(r[c]) for c in vcols] for _,r in vr.iterrows()],'WHO / UNICEF via OWID',owidurl('global-vaccination-coverage'),f'{int(vr.Year.min())}–{int(vr.Year.max())} · % of one-year-olds','World coverage estimates; these series show programme reach, not a direct estimate of deaths prevented.')

# Country scatter plots use a common year and explicit X/Y columns, with units in the source line.
for id,slug,title,xcol,ycol,unit in [
 ('income-longevity','life-expectancy-vs-gdp-per-capita','Does being richer mean living longer?','GDP per capita','Life expectancy at birth','X: GDP/person, 2011 international $ · Y: life expectancy, years'),
 ('health-longevity','life-expectancy-vs-health-expenditure','Does more healthcare spending mean better outcomes?','Health expenditure per capita','Life expectancy','X: healthcare/person, 2020 international $ · Y: life expectancy, years'),
 ('income-carbon','co2-emissions-vs-gdp','Do richer countries pollute more?','GDP per capita','Per capita emissions','X: GDP/person, 2011 international $ · Y: tonnes CO₂/person')]:
 d=owid(slug); d=d[d.Code.fillna('').str.fullmatch('[A-Z]{3}')].dropna(subset=[xcol,ycol]); year=int(d.groupby('Year').size().loc[lambda x:x>=40].index.max()); d=d[d.Year==year]
 add('scatter',id,title,['Name','X','Y','Category'],[[r.Entity,round(r[xcol],4),round(r[ycol],4),r.get('World region according to OWID','Countries')] for _,r in d.iterrows()],'OWID · underlying sources in chart metadata',owidurl(slug),str(year)+' · '+unit,'Countries with both measures in this year. Association is not evidence of causation.')
gdp=owid('life-expectancy-vs-gdp-per-capita'); mortality=owid('child-mortality'); joined=gdp.merge(mortality,on=['Entity','Code','Year']); joined=joined[joined.Code.fillna('').str.fullmatch('[A-Z]{3}')].dropna(subset=['GDP per capita','Under-five mortality rate (selected)']); year=int(joined.groupby('Year').size().loc[lambda x:x>=80].index.max()); joined=joined[joined.Year==year]
add('scatter','income-child-survival','Does national income relate to child survival?',['Name','X','Y','Category'],[[r.Entity,round(r['GDP per capita'],4),round(r['Under-five mortality rate (selected)']*10,4),r['World region according to OWID']] for _,r in joined.iterrows()],'OWID / UN IGME',owidurl('child-mortality'),str(year)+' · X: GDP/person, 2011 international $ · Y: under-five deaths/1,000 births','Joined by country code and year to OWID GDP per capita. Mortality converted from deaths per 100 to per 1,000 live births; association, not causation.')
catalog['scatter'][-1]['extraSources']=[{'label':'GDP data','url':owidurl('life-expectancy-vs-gdp-per-capita')}]
growth=owid('co2-emissions-and-gdp'); growth=growth[growth.Code.fillna('').str.fullmatch('[A-Z]{3}')].sort_values(['Code','Year']); vals=[]
for code,d in growth.groupby('Code'):
 prev=None
 for _,r in d.iterrows():
  if prev is not None and r.Year==prev.Year+1 and all(pd.notna(v) and v>0 for v in [r.GDP,r['CO₂ emissions'],prev.GDP,prev['CO₂ emissions']]):vals.append([r.Entity,int(r.Year),round((r.GDP/prev.GDP-1)*100,4),round((r['CO₂ emissions']/prev['CO₂ emissions']-1)*100,4)])
  prev=r
counts=defaultdict(int)
for r in vals:counts[r[1]]+=1
latest=max(y for y,n in counts.items() if n>=80)
add('scatter','growth-carbon','How does economic growth relate to emissions?',['Name','Period','X','Y'],[r for r in vals if latest-2<=r[1]<=latest],'OWID · World Bank / Global Carbon Budget',owidurl('co2-emissions-and-gdp'),f'{latest-2}–{latest} · X: annual real GDP change % · Y: annual CO₂ change %','Changes calculated as (this year / previous year − 1) × 100, requiring consecutive years and positive bases. Territorial CO₂; associations are not causal effects.')

countries=json.loads(Path('assets/countries.geojson').read_text()); codes={f['properties']['ISO3'] for f in countries['features']}
for id,slug,title,unit,invert in [
 ('extreme-poverty','share-of-population-in-extreme-poverty','Where is extreme poverty most prevalent?','% below $3/day in 2021 purchasing-power prices',False),
 ('clean-cooking','access-to-clean-fuels-and-technologies-for-cooking','Where do people lack clean cooking fuels?','% without clean cooking access',True),
 ('carbon-per-person','co-emissions-per-capita','Which countries emit the most CO₂ per person?','tonnes of territorial CO₂ per person',False)]:
 d=owid(slug); col=d.columns[3]; d=d[d.Code.isin(codes)].dropna(subset=[col]); year=int(d.groupby('Year').size().loc[lambda x:x>=80].index.max()); d=d[d.Year==year]
 source={'extreme-poverty':'World Bank via OWID','clean-cooking':'WHO via OWID','carbon-per-person':'Global Carbon Budget via OWID'}[id]
 add('map',id,title,['Country','Name','Value'],[[r.Code,r.Entity,round(100-r[col] if invert else r[col],4)] for _,r in d.iterrows()],source,owidurl(slug),str(year)+' · '+unit,'Common-year snapshot of countries with data and bundled boundaries; missing countries are not zero.'+(' Calculated as 100 minus access percentage.' if invert else ''))
states=json.loads((RAW/'us-states.geojson').read_text()); features=[]
for f in states['features']:
 if f['properties'].get('admin')=='United States of America':features.append(dict(type='Feature',properties={'NAME':f['properties']['name'],'ISO2':f['properties'].get('postal','')},geometry=f['geometry']))
assert len(features)==51,len(features)
Path('assets/us-states.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')),encoding='utf8')
kff=list(csv.DictReader((RAW/'kff-map.csv').open(encoding='utf8'))); exceptions=list(csv.DictReader((RAW/'kff-table.csv').open(encoding='utf8'),delimiter='\t')); krows=[]
for r in exceptions:r['State']=clean(r['State'])
for r in kff:
 ex=[x for x in exceptions if x['State']==r['State']]; ban=next((clean(x['Ban']) for x in ex if clean(x['Ban']).startswith('Total')),clean(ex[0]['Ban']) if ex else '')
 category='Total ban' if ban.startswith('Total') else ('6-week limit' if ban.startswith('6-week') else '12-week limit' if ban.startswith('12-week') else 'Later limit or no gestational limit')
 details='; '.join(' / '.join(clean(x[k]) or 'No exception listed' for k in ['Ban','Life','Health*','Rape/Incest','Lethal Fetal Anomaly']) for x in ex)
 krows.append([r['State'],category,r['Information'],details or 'See source for later-gestation rules and exceptions'])
assert sum(r[1]=='Total ban' for r in krows)==13
assert sum(r[1] in ['6-week limit','12-week limit'] for r in krows)==6
add('map','abortion-policies','Where is abortion banned in the US?',['State','Category','Policy summary','Exceptions: ban / life / health / rape-incest / fetal anomaly'],krows,'KFF policy tracker','https://www.kff.org/womens-health-policy/exceptions-in-state-abortion-bans-and-early-gestational-limits/','16 October 2026 · policy snapshot','Dated summary, not current legal or medical advice. X means an exception is listed, subject to conditions. Later-limit category does not mean unrestricted access. Consult the linked tracker for court orders and detailed exceptions.')
la=[r for r in housing['5c'][2:] if str(r[2]).startswith('E') and num(r[27]) is not None]; la=sorted(la,key=lambda r:r[27],reverse=True)[:25]
add('map','housing-authorities','Which English places have the greatest housing affordability problem?',['Council code','Name','Value'],[[r[2],r[3],r[27]] for r in la],'ONS',HOUSING,'2025 · house-price-to-earnings ratio','The 25 English local authorities with the highest available existing-dwelling median price / residence-based median annual earnings ratios. Missing or suppressed ratios excluded.')
groups={'Central':['Camden Town','Primrose Hill',"Regent’s Park",'St Pancras & Somers Town'],'West':['Fortune Green','West Hampstead','South Hampstead','Kilburn'],'East':['Gospel Oak','Haverstock','Kentish Town North','Kentish Town South','Camden Square'],'South':["King’s Cross",'Bloomsbury','Holborn & Covent Garden'],'North':['Belsize','Frognal','Hampstead Town','Highgate']}
wards=[[w.replace('’',"'"),g] for g,ws in groups.items() for w in ws]; lib=[
 ('Camden Town Library','218 Eversholt Street, London NW1 1BD'),('Highgate Library','Chester Road, London N19 5DH'),('Holborn Library','32–38 Theobalds Road, London WC1X 8PA'),('Kentish Town Library','262–266 Kentish Town Road, London NW5 2AA'),('Kilburn Library','12–22 Kilburn High Road, London NW6 5UH'),('Pancras Square Library','5 Pancras Square, London N1C 4AG'),('Queen’s Crescent Library','165 Queen’s Crescent, London NW5 4HH'),('Swiss Cottage Library','88 Avenue Road, London NW3 3HA'),('West Hampstead Library','Dennington Park Road, London NW6 1AU'),('Primrose Hill Community Library','11–16 Sharples Hall Street, London NW1 8YN'),('Belsize Community Library','Antrim Road, London NW3 4XN'),('Keats Community Library','10 Keats Grove, London NW3 2RR')]
add('map','camden-libraries','Camden wards and public libraries',['Ward','Council','Address','Name','Category','Library type'],[[name,'Camden','',name,cat,''] for name,cat in wards]+[['','Camden',addr,name,'Library','Council-run' if i<9 else 'Community-run'] for i,(name,addr) in enumerate(lib)],'Camden Council','https://www.camden.gov.uk/libraries-opening-times','Directory checked 10 November 2026','Twenty wards in five neighbourhoods, plus nine council libraries and three community libraries open to the public. Pins use full street addresses; no invented activity or population figures.')
catalog['map'][-1]['extraSources']=[{'label':'Community libraries (including Keats)','url':'https://www.camden.gov.uk/community-libraries'},{'label':'Primrose Hill','url':'https://www.phcl.org/locations/primrose-hill-community-library/'},{'label':'Belsize','url':'https://thewinch.org/our-services/belsize-community-library/'}]
for mode,entries in catalog.items():assert len(entries)==(6 if mode=='map' else 5),(mode,len(entries))
Path('assets/sample-sets.js').write_text('/* Static source snapshots; generated by scripts/build_samples.py. */\nwindow.chartSampleSets = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
urls.update({'refugees.json':'https://api-data.unhcr.org/api/v0/data/PopStatsOfficial?c[pop_type]=REF_UNHCR&c[area_ori_adm0]=SYR,AFG,SSD&c[ref_area_adm0]=TUR,DEU,PAK,IRN,UGA,SDN&time_period=eq:2024&dimensions=pop_type,ref_area_region_unhcr,ref_area_adm0,area_ori_region_unhcr,area_ori_adm0&page_size=100','treasury-detail.json':'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9_outlays_functions_subfunctions?filter=record_date:eq:2025-09-30&page[size]=200','kff-map.csv':'https://datawrapper.dwcdn.net/6AHYt/33/dataset.csv','kff-table.csv':'https://datawrapper.dwcdn.net/0knfK/40/dataset.csv','global-vaccination-coverage.csv':owidurl('global-vaccination-coverage')+'.csv'})
urls.pop('refugees.json',None)
urls['refugees-full.json']='https://api-data.unhcr.org/api/v0/data/PopStatsOfficial?c[pop_type]=REF_UNHCR&time_period=eq:2024&dimensions=pop_type,ref_area_region_unhcr,ref_area_adm0,area_ori_region_unhcr,area_ori_adm0&page_size=100'
(OUT/'provenance.json').write_text(json.dumps({'retrieved':'2026-11-10','refugees_retrieved':'2026-11-11','refugees_pagination':'Fetch pages 1–50 and concatenate data. 4,962 records include 170 host totals; 4,792 country records sum to 30,958,200. Exclude _T aggregate origins to avoid double counting.','downloads':urls},indent=2),encoding='utf8')
Path('SOURCES.md').write_text('# Sample data sources\n\nStatic snapshots prepared 10 November 2026. CSVs are bundled with the site; clicking Try sample data does not query source data providers. Map location lookup is separate (see PRIVACY.html). Missing observations are never filled with zero.\n\n'+ '\n\n'.join('## '+mode+'\n\n'+'\n\n'.join('**'+e['title']+'** — '+e['reference']+'\n\n['+e['source']+']('+e['url']+') · [CSV]('+e['csv']+')\n\n'+e['notes'] for e in entries) for mode,entries in catalog.items())+'\n\n## Rebuilding\n\nDownload source files using `assets/samples/provenance.json` into `.review-tools/story-sources`, then run `python scripts/build_samples.py` (pandas and openpyxl required). The Camden ward grouping is retained from the existing sample; public library addresses are listed in the build script. Manually transcribed tables are identified in the script. Natural Earth country and US state boundaries are public-domain cartography, not legal boundary determinations.\n',encoding='utf8')
with Path('SOURCES.md').open('a',encoding='utf8') as f:
 f.write('\n## Source-link check — 11 November 2026\n\nAll catalog source pages were checked. The broken UNHCR data-finder link was replaced with the official dataset documentation. UNICEF and Camden block automated HTTP clients but their relevant pages were verified separately. The unavailable Keats website link was removed; Camden’s community-library directory identifies Keats.\n\nThe refugee sample now covers all reported country routes, aggregated by UNHCR region to keep the chart readable. [Complete country-route CSV (4,792 records)](assets/samples/refugees-all-country-routes.csv). For rebuilding, fetch every page of the UNHCR query in provenance.json, concatenate its data, and preserve the pagination record with has_next set to false only after all 4,962 records have been retrieved.\n')
print({m:len(v) for m,v in catalog.items()})
