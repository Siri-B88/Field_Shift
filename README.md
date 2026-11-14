# Field Shift

A working crop-rotation explorer built from the supplied **Field-Shift-Hackathon-Guide.pdf** and the pasted **Field Shift: Adapting Farms with NASA Data** challenge resources.

## Run locally

From this directory, run:

```powershell
python -m http.server 5173 --directory dist --bind 127.0.0.1
```

Open **http://127.0.0.1:5173**. No build, API key, database, or runtime package installation is required. Python serves files only; the calculations run in browser JavaScript. Opening `index.html` directly with `file://` will not work because ES modules and fetch require an HTTP origin.

## Implemented guide requirements

| Guide requirement | Implementation |
| --- | --- |
| Location selection | Clickable Leaflet map and validated latitude/longitude inputs |
| NASA observations | Real NASA POWER daily rainfall, mean/max/min air temperature and modeled root-zone wetness; 2006–2025 |
| Local soil knowledge | Sandy / loam / clay, optional pH, explicit irrigation assumptions |
| Crop characteristics | 12 crops plus residue-covered fallow; all traits visible in Method & limitations |
| Farmer priorities | Water, soil, income index, lower exposure; weights normalized |
| Climate history | Annual rainfall/temperature charts, least-squares trends, heat days, wetness, seasonal rain and longest dry spells |
| Rotation comparison | Baseline always retained; highest weighted score; distinct water-first alternative |
| Historical uncertainty | Every rotation replayed over all complete June–May cycles; coverage counts and shortfall range |
| What-if | Rainfall −30% to +30%; temperature +0 to +3°C; scores recomputed |
| Explanations | Why / risk / evidence / unknowns, seasonal water accounting, exposed rules |
| Satellite map | Real NASA GIBS MODIS archived image; live MODIS NDVI/true color, GPM IMERG and SMAP visualizations |
| Offline demonstration | Original NASA POWER response and MODIS image bundled; Leaflet self-hosted |
| Provenance | Source URL, retrieval timestamp, numerical versus imagery versus reference status, raw JSON download |
| Export | Standalone HTML report containing location, inputs, scenario, all comparisons, source and limitations |

The guide describes several possible technology stacks. This implementation uses a deployable static app instead of requiring FastAPI/React servers: the same climate summaries, exhaustive search and explanations run locally in the browser. There is no trained ML, yield prediction, profit forecast, or Earthdata credential storage.

## Genuine data and coverage

`dist/data/bengaluru-power.json` is the original NASA POWER API response for **12.97° N, 77.6° E**, **1 Jan 2006–31 Dec 2025**, with an added `_fieldShift` provenance object. The default view labels it a **saved NASA response**, not live telemetry. New coordinates request their own response from NASA, cached locally when storage permits. A failed request never substitutes Bengaluru data under another location label.

Twenty complete calendar years give **19 complete June–May rotation cycles** (June 2006–May 2025). Incomplete years/cycles are excluded. Missing values, including NASA's −999 fill value, are never treated as real observations.

`dist/data/karnataka-modis.jpg` is a NASA GIBS MODIS Terra true-color WMS image for **15 Jan 2025**, bounding box **73,9,82,18**. Its exact request is in `imagery-source.json`. Outside this extent, use live imagery or the base map. Imagery dates are independent of the historical climate analysis. Cloud cover and missing coverage are possible. No image pixels are used as numerical scoring inputs.

Regenerate the bundled resources when intentionally updating the snapshot:

```powershell
python scripts/fetch-resources.py
```

The script preserves an existing POWER snapshot and uses public NASA/Leaflet URLs. It requires network access. Internet is required for other locations, live layers, OpenStreetMap base tiles, and the optional web font. The saved default numerical example and imagery work without those external services once the local app is served.

## Scientific scope

- The **Southern Karnataka calendar** and crop list are a prototype template. Coordinates can be changed globally; the agronomy is not globally calibrated.
- POWER is a regional gridded product, not a field sensor. `GWETROOT` is a modeled wetness index, not a measured volumetric SMAP moisture value.
- Scoring uses POWER rainfall/temperature. Root-zone wetness is contextual; it is not silently substituted for a measured soil-water balance.
- Water demand uses crop-range midpoints, assumed first-day planting and assumed growth durations. Rain is counted only during that growth window.
- Illustrative captured-rain fractions: sandy 0.65, loam 0.80, clay 0.75. Irrigation is 0, 150 or 350 mm per cropped season. No interseason storage, daily water balance, runoff, irrigation-efficiency or field-scale ET model is implemented.
- The scenario assumes a 4% increase in crop water demand per additional °C. It is an exposed sensitivity assumption, not a NASA-derived forecast.
- Soil health and cover are rule-based indices, not measured fertility or erosion rates. Income is an illustrative relative index, not price, yield or profit.
- Two legumes are penalized for adjacent family repetition; crop families across the year boundary also count. The farmer's baseline is retained even if season-ineligible. Candidate alternatives exclude three identical crops and more than one fallow.
- High relative scores do not guarantee water adequacy. Even the top option can have unmet demand in every historical cycle; this is displayed explicitly.
- All rules and crop values are in `dist/model.js` and the app's Method & limitations panel. Local cultivar and extension-service validation is needed.

## Resource integration status

The app's Data & resources panel includes all 25 resource entries from the brief (some combined entries are grouped):

- **Numerical integration:** NASA POWER.
- **Live map visualizations:** MODIS (GIBS), GPM IMERG, SMAP. MODIS also has a saved image.
- **Reference paths, not integrated measurements:** Landsat/VIIRS, SRTM, ECOSTRESS, Ag Data Commons, WSS, CDL/CropScape, PRISM, SSURGO/STATSGO2, NAIP, NLCD, NLDAS/GLDAS, FAO GAEZ/ECOCROP, CoCoRaHS, NWIS, AMS Market News, NASS QuickStats, OpenET, LANDFIRE, GEDI, Sentinel-2 and ERA5.
- NASA Worldview, AppEEARS and Earthdata Login are linked for further exploration. US-only datasets are explicitly labeled and not used as Indian field measurements.

The official challenge page returned HTTP 502 during implementation. The supplied guide/challenge text was used as the requirements source; challenge registration, judging wording and submission rules have not been independently confirmed.

## Validation

```powershell
npm install
npm test
# With the local server running; uses Microsoft Edge on Windows:
node tests/browser.test.mjs
```

The numerical suite checks calendar boundaries/leap years, missing observations, coordinate validation, water-shortfall monotonicity, irrigation, zero weights, baseline retention, candidate uniqueness and score bounds against the real snapshot. Browser checks cover desktop/mobile overflow, the scenario sliders, baseline edits, evidence panels, historical data, exported report and simulated NASA outage behavior. Screenshots and exported QA output are stored in ignored `qa/`.

## Files

- `dist/index.html`, `styles.css`, `app.js`: interface, map, data loading, provenance and export.
- `dist/model.js`: pure climate summarization and rotation scoring/search.
- `dist/data/`: original numerical snapshot, MODIS imagery and imagery metadata.
- `dist/vendor/`: Leaflet 1.9.4 assets, retaining upstream license comments.
- `scripts/fetch-resources.py`: reproducible NASA/Leaflet downloads.
- `tests/`: numerical and browser regression checks.
- `.openai/hosting.json`: private Sites deployment identity and static output directory.

## Sources

- NASA POWER daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- NASA GIBS service access: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- FAO indicative crop water needs: https://www.fao.org/4/s2022e/s2022e07.htm
- Supplied Field Shift guide and pasted challenge resource text.

NASA does not endorse this independent project. Leaflet is distributed under its BSD 2-Clause license; OpenStreetMap attribution appears on the map. This app supplies decision support and makes no validated farm-outcome claims.
