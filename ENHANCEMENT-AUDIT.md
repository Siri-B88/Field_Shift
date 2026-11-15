# Farmer language and financial planning upgrade

The repository is a static HTML/JavaScript app. Existing modules cover NASA POWER history, GIBS visual layers, place search, five unique rotation strategies, soil/pH/irrigation, priorities, rainfall/temperature experiments, explanations and HTML reports. The four-step interface and existing model remain the foundation.

The new brief's main missing features are complete localization and explicit farm financial planning. The implementation will add i18next with local language resources, a pure finance module with tests, and modular interface extensions for farm area, budget, preferred crops, per-crop costs/yield/price and financial comparisons. No market or yield numbers will be fabricated. Missing inputs remain missing, and the farmer supplies local estimates. All five existing strategies remain available.

Secondary additions will reuse these modules for hypothetical price/yield/cost/irrigation changes, an indicative crop calendar, optional browser speech and printable localized reports. NASA POWER remains the numerical source; imagery and reference datasets remain clearly distinct. The existing historical data period and regional crop-calendar limitations remain explicit.

Financial definitions follow enterprise budgeting: total entered costs; quantity times price for gross revenue; revenue less costs for net income; costs divided by quantity or price for break-even metrics. Sources: [Penn State Extension, agricultural budgeting](https://extension.psu.edu/budgeting-for-agricultural-decision-making), [i18next interpolation](https://www.i18next.com/translation-function/interpolation).

Validation will cover unit conversion, missing/zero/invalid values, losses and break-even calculations, all language resources, switching without NASA refetches or lost inputs, dynamic results, mobile layouts, reports and existing regressions. Translation wording still needs review by regional-language speakers; financial scenarios are not validated farm forecasts.
