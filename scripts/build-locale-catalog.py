"""Build the English source catalog from a browser capture plus controlled templates.
Existing localized values are preserved. Run only when intentionally updating UI copy.
"""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
texts=json.loads((root/'.tools/ui-texts.json').read_text(encoding='utf-8'))
for file in ['dist/farmer-tools.js','dist/app.js']:
    source=(root/file).read_text(encoding='utf-8')
    texts+=re.findall(r"\bt\('([^'\n]+)'",source)
texts+='''Reading NASA history…
Loading NASA history
Use this location
Searching places…
Search places
Selected: Your own priorities
Your previous answers are filled in where available. Check them for this field.
Enter a soil pH between 3 and 10, or leave it blank. Comparisons still use the last valid inputs.
Choose your village or use the example, then press “Use this location”.
Check your soil pH, or leave it blank if you do not know it.
Reading the saved NASA POWER historical estimates…
Fetching 20 years from NASA POWER. This may take a minute.
The archived NASA dataset could not be loaded.
NASA POWER returned HTTP {{code}}. Please try again later.
The NASA request timed out. Try again or use the saved Bengaluru example.
Data unavailable
Climate data could not be loaded. Use “Use this location” to retry. No substitute data has been inserted.
Complete valid field inputs to compare rotations for this location.
History is ready for this location.
NASA analysis loaded for {{place}}. These are regional weather estimates, not measurements on your field.
Pin selected: {{place}}. Check the map, then press “Use this location”.
We’ll load the NASA history for this pin before you continue.
New pin selected. Use this location to load its NASA history. The previous analysis still describes {{place}}.
Searching village names in two place databases…
No matching place was found. Try another spelling, a local-script name, or a nearby town / PIN code. You can also use your current location or click the map.
One place service is unavailable. No matching place was found. Try another spelling, a local-script name, or a nearby town / PIN code. You can also use your current location or click the map.
{{count}} matching places. Choose the correct district/state and check the pin.
{{count}} matching places. Choose the correct district/state and check the pin. One database is unavailable; these matches are from the other source.
1 matching place. Choose the correct district/state and check the pin.
Location access is unavailable in this browser. Search for a place or use the map pin.
Waiting for your browser’s location permission…
Current location selected (reported accuracy about {{distance}} m). Move the pin if your field is elsewhere.
Location permission was declined. You can still search by village name or place the pin on the map.
Your current location could not be determined. Try village search or place the pin on the map.
Your current location
Selected farm location
Press Search places to find matches.
Place selected. Check the map pin, then press “Use this location”.
Enter at least two characters of a village, town or postal code.
Keep the place name and district/state under 120 characters each.
Place search is unavailable. Check your connection and try again, or use your current location or the map pin.
Enter valid latitude (−90 to 90) and longitude (−180 to 180).
NASA response is missing required climate parameters.
Not enough complete years returned. At least three calendar years are required.
NASA imagery could not load. Try another date, another layer, or the saved MODIS image.
Costs and harvest quantity below are per hectare, per crop season.
Rest periods have no harvest revenue. Enter any residue-management costs; enter 0 where there is no cost.
Enter a positive farm area and a valid non-negative budget. Incomplete estimates will not be calculated.
Investment needed
Estimated net income
Downside net income
Add your budget to check affordability.
Within the entered cultivation budget.
Farmer-entered scenario, not guaranteed earnings. Costs cover all three seasons before any harvest income is reused.
Farmer estimate
Source / entered date
Break-even price · INR/kg
Break-even harvest · kg/acre
A dash means the calculation is undefined because cost, price or harvest quantity is zero. Rest periods do not have a harvest break-even value.
No voice for this language is installed. You can still read or print the plan.
Speech is unavailable in this browser.
Reading the selected plan.
Farming report
Financial estimates are incomplete. Missing values have not been replaced with invented prices or yields.
Financial assumptions
Climate scenario
Main risks and limitations
Sources
Original data request
Last successful retrieval:
Regional historical estimates, not field measurements or forecasts.
Financial figures use farmer-entered assumptions and are not guaranteed earnings. No live market prices or NASA yield predictions are used.
Soil and water indicators are simplified model estimates. Local varieties, pests, soil depth and weather timing can change outcomes. Confirm the plan with a local agriculture adviser.
Financial inputs: farmer estimates. Satellite imagery is visual context only. Crop traits and the calendar use the app’s disclosed prototype assumptions.
Rest field with retained residues
No planting assumed
Keep the ground covered; bare soil increases exposure.
At least one crop season had estimated water needs above the assumed supply.
The model found no seasonal water gap, but dry spells within a season can still matter.
This count uses your changed-weather scenario.
Rainfall change {{rain}}%; temperature rise {{temp}}°C; irrigation reduction {{irrigation}}%.
What-if: {{rain}}% rainfall · +{{temp}}°C · irrigation −{{irrigation}}% · historical years adjusted
Similar estimated water needs to your current crops.
{{amount}} mm more estimated crop water needed per cycle than your current crops.
{{amount}} mm less estimated crop water needed per cycle than your current crops.
{{crop}}: {{amount}} mm mean unmet demand in its season.
Some crop families repeat; check local pest pressure.
A crop in your current plan falls outside this example calendar. Check the planting months.
A rest season means one less crop to harvest. Keep crop residues on the soil. Repeated crop families also need a local pest check.
The current plan includes a crop outside this template’s seasonal eligibility.
Different crop families diversify the sequence.
Repeated cereals offer limited family diversity.
Alternating families can help interrupt pest cycles.
Soil and water
Water and soil
Monsoon
Post-monsoon
Summer
loam
sandy
clay
archive
cached
live
acres
hectares
Language
Language file unavailable. English is shown for missing text.
'''.splitlines()
crop_names=['Fallow + residue','Pearl millet','Groundnut','Chickpea','Sunflower','Mung bean','Dry bean','Soybean','Sorghum','Wheat','Maize','Rice','Pea']
def generalize(text):
    if '{{' in text:return text
    if text in crop_names or len(text)<15:return text
    for i,crop in enumerate(crop_names):
        if crop in text:text=text.replace(crop,'{{crop'+str(i)+'}}')
    text=text.replace('Bengaluru, Karnataka','{{place}}')
    count=0
    def placeholder(match):
        nonlocal count
        value='{{n'+str(count)+'}}';count+=1;return value
    # Numeric values remain parameters, never translated as agricultural facts.
    return re.sub(r'(?<![A-Za-z_\d])[-−+]?\d[\d,]*(?:\.\d+)?',placeholder,text)
catalog={}
for text in texts:
    text=text.strip()
    if text and re.search('[A-Za-z]',text):
        key=generalize(text);catalog[key]=key
directory=root/'dist/locales';directory.mkdir(exist_ok=True)
(directory/'en.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(catalog)} source keys, {sum(len(k.split()) for k in catalog)} words')
