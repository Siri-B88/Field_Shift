# Field Shift: farmer-friendly upgrade audit and proposal

Prepared from the actual project and the supplied upgrade brief. The findings below record the pre-upgrade audit. The implementation status at the end identifies what has since changed.

## Existing architecture to preserve

The site is a static JavaScript application. `dist/model.js` contains pure climate summaries, crop traits and rotation scoring. `dist/app.js` connects the forms, map, NASA requests, charts, explanations and report. `dist/index.html` and `dist/styles.css` define the interface. `dist/geocoding.js` adds the separately requested village search. `run.py` serves the same files locally. No framework or server migration is needed.

NASA POWER is the numerical source. The saved default response contains 2006–2025 history; changing coordinates requests another POWER response. Twenty calendar years give 19 complete June–May cycles. MODIS, SMAP and IMERG are GIBS visualizations only; the other listed resources are reference links. Their names do not establish numerical integration.

## What the audit found

| Finding in the current code | Consequence | Proposed treatment |
| --- | --- | --- |
| `recommend()` returns the baseline and only two alternatives | It does not yet satisfy the brief's five categories | Add overall, water, soil and climate-focused selectors, keeping the baseline |
| Alternatives need differ by only one crop | Cards may look like small variations of the same plan | Prefer substantive differences in at least two season slots where feasible; explain any relaxation |
| Default Bengaluru inputs generate 690 alternatives, using a Southern Karnataka calendar | Global coordinates do not imply global agronomic validity | Keep the regional-template limit visible and avoid suitability guarantees |
| Water is crop-range midpoint versus growth-window rain × assumed capture plus assumed irrigation | This is a water-availability proxy, not a measured soil-water balance | Use farmer-facing “possible water gap”; keep exact assumptions in “See why” |
| Fallow contributes 100 to the water and climate fit components | It can improve a composite partly because no crop is exposed | Compare water demand and cropped-season fit separately; explain the lost cropped season |
| A crop's illustrative temperature range also determines daily-maximum heat exposure | Those thresholds are not validated heat-damage limits | Label as exposure to an assumed threshold; separate mean suitability from supported heat thresholds in Phase 2 |
| Soil bonuses, pH penalties, cover scores and income indices are hand-set | Scores are not measured soil improvement, erosion, profit or yield | Expose these as assumptions and explain relative trade-offs |
| All candidates are replayed against complete historical cycles | Cross-year accounting is already present and must be retained | Add regression cases for Oct–Jan and leap years when extending the model |
| Risk has mean/range and coverage counts, but no median or drier-year cohort | Useful detail in the new brief is still missing | Add these in the risk phase; define the dry-year cohort before reporting it |
| Main screen opens with climate metrics, indices, dense charts and small supporting text | A farmer must interpret technical terms before doing the basic task | Lead with a short guided flow; move supporting science into expandable details |
| POWER history is sometimes called “observations” or “observed” broadly | This can blur reanalysis/model-derived estimates and direct measurements | Use “NASA historical estimates”; preserve dataset identity and dates |

NASA describes its POWER meteorology as based on assimilation/reanalysis products, including MERRA-2. Its documented meteorological grid is 0.5° × 0.625°, so a precise village pin does not make the climate estimate field-scale. Sources: [NASA POWER meteorological sources](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/), [NASA POWER services](https://power.larc.nasa.gov/docs/services/).

FAO describes crop-water requirements as dependent on climate, crop type and growth stage. The current midpoint table and fixed capture percentages cannot replace a locally parameterized ET and soil-water calculation. Source: [FAO crop-water guidance](https://www.fao.org/4/s2022e/s2022e07.htm).

## Proposed simple farmer flow

The visible journey should have four short steps. Existing calculations and evidence remain available.

1. **Find my farm.** Village name first. Show district/state beside matches. Offer current location and a labeled map. Coordinates and satellite-layer settings sit under “More map options.”
2. **Tell us about the field.** Use familiar soil descriptions, water availability and crops for the three seasons. Keep pH optional under “I have a soil test.” Clearly separate an example farm from the farmer's own location.
3. **Choose what matters.** Large choices such as “Save water,” “Improve soil,” “Balance my needs,” and “Reduce weather exposure.” Presets set the existing weights; “Adjust priorities” retains all sliders. Any income preference must retain the warning that the current index is not local profit data.
4. **Compare planting plans.** Show one selected plan clearly, with five labeled categories: “My current crops,” “Fits my priorities,” “Uses less water,” “Supports soil health,” and “Handles the recorded climate better.” Allow a simple comparison with the current plan rather than five dense cards at once.

Each plan should initially show crop order, one benefit, one concern, and the historical water-gap count. “See why” reveals all five scores, crop water assumptions, seasonal calculations, historical cycles, source dates and limitations. “Try a drier or hotter season” retains both scenario sliders. “Climate history” keeps the charts and data table. “Save my comparison” keeps report export. “Data and assumptions” retains the resource catalog and raw NASA download.

Preserve the cream/forest-green/sage identity. Use readable text, strong contrast, large touch targets, labeled controls, keyboard-accessible expandable details and mobile layouts with no horizontal page overflow.

## Proposed Phase 1 implementation scope

If proceeding with Phase 1, modify:

- `dist/model.js`: category selection and explicit diversity rules; preserve the baseline and existing scenario behavior. Do not quietly replace crop requirements or introduce an unvalidated agronomic model.
- `dist/app.js`: five-category presentation, plain-language benefit/concern text, complete report coverage and traceable “See why” explanations.
- `dist/index.html` and `dist/styles.css`: only the controls/layout needed for that comparison; keep the larger guided-flow reorganization separate if following the brief's full phase order.
- `tests/model.test.mjs` and browser tests: unique recommendations, seasonal eligibility, baseline retention, deterministic ranking, zero weights, scenario changes, export and mobile behavior.
- `README.md`: update the implemented scope and remaining validation limits.

The direct user request for a simpler farmer interface was used to scope the guided UI work, alongside the audited recommendation selection. The attachment’s later scientific upgrades remain separate.

## Work already authorized separately

Village search was completed under the preceding request: Photon/OpenStreetMap and GeoNames/Open-Meteo results, district/state context, matching-name disambiguation, local-script query preservation, a road-map view, a draggable pin, current-location fallback, and clear separation between the selected pin and loaded NASA analysis. This does not constitute implementing the broader upgrade phases.

## Still unverified

- The user's particular missing villages: no names/districts have been supplied yet.
- Agronomic validity across regions or local cultivars; crop assumptions remain a Southern Karnataka prototype.
- Real farm outcomes, calibrated irrigation demand, yield, profit or future probabilities.
- Full multi-location climate validation requested for Phase 5; the new search feature's location checks are not a substitute for that work.
- No trained recommendation model, recent-weather monitoring, numerical SMAP/IMERG ingestion, or measured soil-water model has been added.

## Implemented after the audit

- Preserved the static app and existing numerical calculations. Added four guided steps in `index.html` / `app.js`, with `farmer.css` overriding the existing visual system.
- Added plain-language field choices, four priority presets, explicit location confirmation, and one visible planting-plan card at a time. Expanded controls preserve all map, history, scenario, evidence and export functions.
- Expanded `recommend()` to five unique categories. Kept the true weighted winner and preferred at least two season-slot differences for the remaining categories. The UI and method disclose any relaxed diversity rule and the trade-off between variety and category rank.
- Kept water, temperature, soil, income and cover formulas unchanged. Corrected broad “POWER observations” wording to historical estimates. Exposed possible historical water gaps without presenting them as future odds.
- Export now includes all five categories. Model tests cover uniqueness, two-slot diversity, baseline retention, seasonal feasibility, score bounds and zero-weight/scenario cases. Browser tests cover all four steps, presets, validation, every category, NASA failure handling, preserved tools and mobile overflow.
- The deferred scientific findings above remain relevant. This is not completion of all five upgrade phases and does not constitute agronomic validation.
