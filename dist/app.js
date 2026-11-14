import {CROPS, SEASONS, summarize, recommend, powerUrl, mean, slope} from './model.js';

const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n,d=0) => Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed = (n,d=0) => `${n>0?'+':''}${fmt(n,d)}`;
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const state = {climate:null,raw:null,results:null,location:{lat:12.97,lon:77.6,name:'Bengaluru, Karnataka'},chart:'rain',mode:'archive',busy:false,map:null,marker:null,overlay:null};
const defaultRotation=['rice','maize','fallow'];
let computeTimer,abortController;
const inputStatus=document.createElement('p');
inputStatus.id='input-status';inputStatus.className='input-status';inputStatus.hidden=true;inputStatus.setAttribute('role','status');
$('farm-form').append(inputStatus);
$('ph').setAttribute('aria-describedby','input-status');
$('detail-dialog').setAttribute('aria-labelledby','dialog-title');

for(let i=0;i<3;i++){
  $('crop-'+i).innerHTML=CROPS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('crop-'+i).value=defaultRotation[i];
}
try{
  const saved=JSON.parse(localStorage.getItem('fieldshift-preferences-v1')||'null');
  if(saved){
    if(['loam','clay','sandy'].includes(saved.soil))$('soil').value=saved.soil;
    if(['0','150','350'].includes(String(saved.irrigation)))$('irrigation').value=saved.irrigation;
    if(saved.ph!==''&&saved.ph>=3&&saved.ph<=10)$('ph').value=saved.ph;
    saved.rotation?.forEach((id,i)=>{if(i<3&&CROPS.some(c=>c.id===id))$('crop-'+i).value=id;});
    for(const name of ['water','soil','income','risk'])if(Number.isFinite(saved.weights?.[name]))$('weight-'+name).value=Math.max(0,Math.min(100,saved.weights[name]));
  }
}catch{/* Browser storage is optional. */}

function settings(){return {soil:$('soil').value,ph:$('ph').value,irrigation:+$('irrigation').value,rotation:[0,1,2].map(i=>$('crop-'+i).value),weights:Object.fromEntries(['water','soil','income','risk'].map(k=>[k,+$('weight-'+k).value]))};}
function scenario(){return {rain:+$('scenario-rain').value,temp:+$('scenario-temp').value};}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function syncOutputs(){
  for(const name of ['water','soil','income','risk'])document.querySelector(`output[for="weight-${name}"]`).textContent=$('weight-'+name).value;
  document.querySelector('output[for="scenario-rain"]').textContent=signed(+$('scenario-rain').value)+'%';
  document.querySelector('output[for="scenario-temp"]').textContent='+'+$('scenario-temp').value+'°C';
}
function recalculate(){
  if(!state.climate)return;
  if(!validateInputs())return;
  const config=settings();
  try{localStorage.setItem('fieldshift-preferences-v1',JSON.stringify(config));}catch{}
  state.analysis={settings:config,scenario:scenario()};
  state.results=recommend(state.climate,config,state.analysis.scenario);
  $('export').disabled=false;
  renderRotations();
}
function validateInputs(){
  const valid=$('ph').checkValidity();
  inputStatus.hidden=valid;
  inputStatus.textContent=valid?'':'Enter a soil pH between 3 and 10, or leave it blank. Comparisons still use the last valid inputs.';
  $('ph').setAttribute('aria-invalid',String(!valid));
  $('export').disabled=!valid||!state.results;
  return valid;
}
function scheduleRecalculate(){syncOutputs();clearTimeout(computeTimer);if(validateInputs())computeTimer=setTimeout(recalculate,120);}

async function loadClimate(lat,lon,force=false){
  if(!validateInputs())return;
  let url;try{url=powerUrl(lat,lon);}catch(e){status(e.message,true);return;}
  abortController?.abort();const controller=new AbortController();abortController=controller;
  state.busy=true;$('load-climate').disabled=true;$('load-climate').textContent='Reading NASA history…';
  const isDemo=Math.abs(lat-12.97)<0.00001&&Math.abs(lon-77.6)<0.00001;
  const cacheKey=`fieldshift-power-2006-2025-${lat.toFixed(3)}-${lon.toFixed(3)}`;
  status(isDemo&&!force?'Reading the saved NASA POWER observations…':'Fetching 20 years from NASA POWER. Your existing analysis stays visible while it loads.');
  const timeout=setTimeout(()=>controller.abort(),120000);
  try{
    let raw,mode='live';
    if(isDemo&&!force){const r=await fetch('data/bengaluru-power.json',{signal:controller.signal});if(!r.ok)throw new Error('The archived NASA dataset could not be loaded.');raw=await r.json();mode='archive';}
    else{
      if(!force){try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?._fieldShift?.latitude===lat&&cached?._fieldShift?.longitude===lon){raw=cached;mode='cached';}}catch{}}
      if(!raw){
        const r=await fetch(url,{signal:controller.signal});
        if(!r.ok)throw new Error(`NASA POWER returned HTTP ${r.status}. Please try again later.`);
        raw=await r.json();
        raw._fieldShift={sourceUrl:url,retrievedAt:new Date().toISOString(),latitude:lat,longitude:lon,start:'2006-01-01',end:'2025-12-31',kind:'NASA POWER fetched response'};
      }
    }
    if(controller.signal.aborted)return;
    const climate=summarize(raw);
    if(mode==='live'){try{localStorage.setItem(cacheKey,JSON.stringify(raw));}catch{}}
    state.raw=raw;state.climate=climate;state.mode=mode;state.location={lat,lon,name:isDemo?'Bengaluru, Karnataka':'Selected farm location'};
    // Never show previous-location comparisons beneath a newly loaded location.
    state.results=null;state.analysis=null;
    $('rotation-results').innerHTML='<div class="empty-state">Complete valid field inputs to compare rotations for this location.</div>';
    $('location-name').textContent=state.location.name;
    $('location-coords').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    $('latitude').value=lat.toFixed(3);$('longitude').value=lon.toFixed(3);
    moveMarker(lat,lon,false);state.map?.setView([lat,lon],7);
    document.querySelector('.source-pill').innerHTML='<i></i> NASA history loaded';
    const years=climate.annual;
    status(`${mode==='archive'?'Saved NASA response':mode==='cached'?'Locally cached NASA response':'NASA response fetched'} · ${years[0].year}–${years.at(-1).year} · ${years.length} complete calendar years · ${climate.rotations.length} complete Jun–May rotations${climate.missingDays?` · ${climate.missingDays} missing days excluded`:''}.`);
    renderClimate();recalculate();
  }catch(e){
    if(abortController!==controller)return;
    const text=e.name==='AbortError'?'The NASA request timed out. Try again or use the saved Bengaluru example.':`${e.message} Check your connection or use the saved Bengaluru example.`;
    status(`${text}${state.climate?' Results still describe '+state.location.name+' at '+state.location.lat.toFixed(3)+', '+state.location.lon.toFixed(3)+'.':''}`,true);
    if(!state.climate){document.querySelector('.source-pill').textContent='Data unavailable';$('rotation-results').innerHTML='<div class="empty-state">Climate data could not be loaded. Use “Load NASA history” to retry. No substitute observations have been inserted.</div>';}
  }finally{
    clearTimeout(timeout);
    if(abortController===controller){state.busy=false;$('load-climate').disabled=false;$('load-climate').innerHTML='Load NASA history '+icon('arrow');}
  }
}

function renderClimate(){
  const c=state.climate;
  $('rain-value').innerHTML=`${fmt(c.rain)}<small>mm / year</small>`;
  $('temp-value').innerHTML=`${fmt(c.temp,1)}<small>°C</small>`;
  $('wet-value').innerHTML=`${fmt(c.wet,2)}<small>index</small>`;
  $('hot-value').innerHTML=`${fmt(c.hot,1)}<small>days / year</small>`;
  $('rain-note').textContent=`${signed(c.rainTrend)} mm / decade · historical trend`;
  $('temp-note').textContent=`${signed(c.tempTrend,2)}°C / decade · historical trend`;
  $('wetness-bar').style.left=(c.wet??0)*100+'%';
  $('wetness-bar').hidden=c.wet===null;
  document.querySelector('.metric-foot').textContent=`${fmt(c.peak,1)}°C highest daily maximum in the record`;
  for(const [field,cls] of [['rain','rain-spark'],['temp','heat-spark']]){
    const values=c.annual.map(y=>y[field]), min=Math.min(...values), max=Math.max(...values);
    document.querySelector('.'+cls).innerHTML=values.map(v=>`<i style="height:${25+75*(v-min)/(max-min||1)}%"></i>`).join('');
  }
  const maxRain=Math.max(...c.seasons.map(s=>s.rain));
  $('season-summary').innerHTML=c.seasons.map(s=>`<div class="season-row"><div class="season-title"><div>${s.name}<span>${s.range}</span></div><b>${fmt(s.rain)} mm</b></div><div class="season-bar"><i style="width:${maxRain?s.rain/maxRain*100:0}%"></i></div><div class="season-sub">${fmt(s.temp,1)}°C average · ${fmt(s.dry)}-day longest dry spell on average</div><div class="season-sub season-range">Rain range ${fmt(s.rainStats.min)}–${fmt(s.rainStats.max)} mm · ${fmt(s.peak,1)}°C peak</div></div>`).join('');
  renderChart();
}
function renderChart(){
  if(!state.climate)return;
  const key=state.chart, data=state.climate.annual, width=600,height=185,left=42,right=12,top=10,bottom=27;
  const values=data.map(d=>d[key]),lo=Math.min(...values),hi=Math.max(...values),padding=(hi-lo||1)*.15;
  const max=key==='rain'?Math.max(1,hi*1.13):hi+padding,min=key==='rain'?0:lo-padding,span=max-min;
  const step=(width-left-right)/data.length;
  const y=v=>top+(max-v)/span*(height-top-bottom);
  const x=i=>left+(i+.5)*step;
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${key==='rain'?'Annual rainfall in millimetres':'Annual temperature in degrees Celsius'}, ${data[0].year} to ${data.at(-1).year}">`;
  for(let i=0;i<4;i++){const value=min+span*i/3,yy=y(value);svg+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#edf0e7" stroke-dasharray="3 4"/><text x="${left-8}" y="${yy+3}" text-anchor="end" font-size="8" fill="#9ba68e">${fmt(value,key==='rain'?0:1)}</text>`;}
  if(key==='rain')svg+=data.map((d,i)=>`<rect x="${x(i)-step*.31}" y="${y(d[key])}" width="${step*.62}" height="${height-bottom-y(d[key])}" rx="2" fill="${i===data.length-1?'#547b44':'#b0c49a'}"><title>${d.year}: ${fmt(d[key])} mm</title></rect>`).join('');
  else svg+=`<polyline points="${data.map((d,i)=>`${x(i)},${y(d[key])}`).join(' ')}" stroke="#7e9d65" fill="none" stroke-width="2"/>`+data.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d[key])}" r="3" fill="#7e9d65"><title>${d.year}: ${fmt(d[key],2)}°C</title></circle>`).join('');
  const m=slope(data.map(d=>[d.year,d[key]])),mx=mean(data.map(d=>d.year)),my=mean(values);
  svg+=`<line x1="${x(0)}" x2="${x(data.length-1)}" y1="${y(my+m*(data[0].year-mx))}" y2="${y(my+m*(data.at(-1).year-mx))}" stroke="#b99a4b" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  data.forEach((d,i)=>{if(i%4===0||i===data.length-1)svg+=`<text x="${x(i)}" y="${height-5}" text-anchor="middle" font-size="8" fill="#9ba68e">${d.year}</text>`;});
  $('history-chart').innerHTML=svg+'</svg>';
  $('chart-unit').textContent=key==='rain'?'Annual rainfall · mm':'Mean annual temperature · °C';
  $('trend-description').textContent=`${signed(m*10,key==='rain'?0:2)} ${key==='rain'?'mm':'°C'} per decade · linear fit to recorded years, not a forecast`;
  let variability=$('climate-variability');
  if(!variability){variability=document.createElement('p');variability.id='climate-variability';variability.className='climate-variability';$('history-chart').after(variability);}
  const stats=state.climate.rainStats;
  variability.textContent=key==='rain'?`Annual range ${fmt(stats.min)}–${fmt(stats.max)} mm · year-to-year variability ${fmt(stats.cv,1)}% (standard deviation ÷ mean)`:`Highest daily maximum ${fmt(state.climate.peak,1)}°C in the complete-year record`;
}

function reason(r){
  const legume=r.crops.find(c=>c.legume);
  const rest=r.crops.some(c=>c.id==='fallow');
  const family=new Set(r.crops.filter(c=>c.family!=='Rest').map(c=>c.family)).size;
  return `${legume?legume.name+' adds a nitrogen-fixing legume to the sequence.':family>1?'Different crop families diversify the sequence.':'Repeated cereals offer limited family diversity.'} ${rest?'A residue-covered rest season reduces cropped water demand.':r.adjacent?'Some crop families repeat; check local pest pressure.':'Alternating families can help interrupt pest cycles.'}`;
}
function risk(r){
  const worst=r.parts.reduce((a,b)=>a.deficit>b.deficit?a:b);
  if(!r.feasible)return 'The current plan includes a crop outside this template’s seasonal eligibility.';
  if(worst.deficit>20)return `${worst.crop.name}: ${fmt(worst.deficit)} mm mean unmet demand in its season.`;
  return 'Seasonal totals can hide within-season dry spells; check local timing.';
}
function renderRotations(){
  const {baseline,best,alternate,count}=state.results,sc=state.analysis.scenario;
  $('candidate-count').textContent=`${fmt(count)} alternatives evaluated`;
  $('scenario-label').textContent=sc.rain||sc.temp?`What-if: ${signed(sc.rain)}% rainfall · +${sc.temp}°C · historical years adjusted`:'Comparing against the historical climate';
  $('rotation-results').innerHTML=[['baseline','YOUR REFERENCE','Current rotation',baseline],['best','TOP-SCORING ALTERNATIVE','Fits your priorities',best],['alternate','ANOTHER WAY FORWARD','Water-first alternative',alternate]].map(([key,eyebrow,title,r])=>{
    const metrics=[['water','Water fit'],['soil','Soil health'],['climate','Climate fit'],['cover','Soil cover'],['income','Income index']];
    return `<article class="rotation-card ${key}" data-rotation="${key}"><div class="rotation-top"><div><p class="eyebrow">${eyebrow}</p><h3>${title}</h3></div><div class="score-circle" title="Weighted screening score out of 100">${fmt(r.score)}<small>/100</small></div></div><div class="rotation-body"><div class="crop-sequence">${r.crops.map((c,i)=>`<div class="crop-line"><span class="crop-number">${i+1}</span><div class="crop-name">${c.name}${c.legume?'<span class="crop-family">LEGUME</span>':''}</div><span class="crop-season">${SEASONS[i].range}</span></div>`).join('')}</div><div class="score-bars">${metrics.map(([k,label])=>`<div class="score-bar">${label}<span>${fmt(r.scores[k])}</span><div class="bar-track"><i style="width:${r.scores[k]}%"></i></div></div>`).join('')}</div><div class="replay"><strong>${r.covered} of ${r.yearly.length} rotation years</strong><p>Available water met demand in every crop season${sc.rain||sc.temp?' under this what-if':''}.</p><div class="year-dots" aria-label="Green: demand met; gold: a seasonal shortfall">${r.yearly.map(y=>`<i class="${y.covered?'good':''}" title="Jun ${y.year}–May ${y.year+1}: ${fmt(y.deficit)} mm total unmet demand"></i>`).join('')}</div></div><p class="rotation-reason">${reason(r)}</p><p class="rotation-risk">${risk(r)}</p></div><div class="rotation-details"><span>${fmt(r.need)} mm crop demand / cycle</span><button class="text-button" data-detail="${key}">Why this score ↗</button></div></article>`;
  }).join('');
}

function dialog(title,html,eyebrow='FIELD SHIFT / THE EVIDENCE'){
  $('dialog-title').textContent=title;$('dialog-eyebrow').textContent=eyebrow;$('dialog-body').innerHTML=html;
  if(!$('detail-dialog').open)$('detail-dialog').showModal();$('dialog-body').scrollTop=0;
}
function showRotation(key){
  const r=state.results?.[key];if(!r)return;const sc=state.analysis.scenario,w=state.analysis.settings.weights;
  dialog(r.crops.map(c=>c.name).join(' → '),`<div class="notice">${fmt(r.score,1)} / 100 weighted screening score. This is a comparison index, not a probability of success or a yield forecast.</div><div class="detail-grid"><div><h3>Why this option</h3><p>${reason(r)}</p><h3>What could go wrong</h3><p>${risk(r)} ${r.phPenalty?'The supplied pH reduces the soil suitability score.':''} ${r.soilPenalty?'Some crops prefer a different soil texture.':''}</p></div><div><h3>Evidence</h3><p>NASA POWER, ${state.climate.annual[0].year}–${state.climate.annual.at(-1).year}, at ${state.location.lat.toFixed(3)}, ${state.location.lon.toFixed(3)}. ${r.yearly.length} complete June–May cycles replayed. Rainfall adjustment ${signed(sc.rain)}%; temperature +${sc.temp}°C.</p><h3>What we do not know</h3><p>POWER is a coarse regional grid, not a field sensor. Local varieties, prices, pests, soil depth, infiltration and management can change the result. Verify with local agronomic advice.</p></div></div><h3>Season-by-season water accounting</h3><div class="table-scroll"><table><thead><tr><th>Season / crop</th><th>Crop demand</th><th>Rain in growth window</th><th>Available water*</th><th>Mean unmet demand</th></tr></thead><tbody>${r.parts.map((p,i)=>`<tr><td>${SEASONS[i].range}<br>${p.crop.name}</td><td>${fmt(p.need)} mm</td><td>${fmt(p.rain)} mm</td><td>${fmt(p.available)} mm</td><td>${fmt(p.deficit)} mm</td></tr>`).join('')}</tbody></table></div><p>*Rainfall × an illustrative capture factor (${({sandy:0.65,loam:0.8,clay:0.75})[state.analysis.settings.soil]} for ${state.analysis.settings.soil}) + ${state.analysis.settings.irrigation} mm irrigation per cropped season. No water carries between seasons. Deficits are clipped at zero before averaging, so average demand minus average supply may differ from the mean deficit.</p><h3>Replay the past</h3><p>${r.rainCovered} of ${r.yearly.length} cycles met all crop demand with captured rain alone. With your irrigation input, ${r.covered} cycles met demand; ${r.severe} cycles had more than 100 mm total unmet demand. The annual deficit range is ${fmt(r.gapRange[0])}–${fmt(r.gapRange[1])} mm. These are historical counts, not future odds.</p><h3>How priorities affect the score</h3><p>Water × ${w.water}, soil health × ${w.soil}, income index × ${w.income}, and the average of climate fit and soil cover × ${w.risk}; divided by the total slider weight. With all weights at zero, the five component scores receive equal weight.</p><button class="button secondary" data-open="method">Read all assumptions</button>`);
  $('dialog-body').insertAdjacentHTML('beforeend',`<details class="replay-table"><summary>Inspect all ${r.yearly.length} historical rotation cycles</summary><p>Unmet demand is the sum of each crop-season shortfall. A surplus in one season does not cancel a shortfall in another. Values use the displayed scenario and irrigation assumptions.</p><div class="table-scroll"><table><thead><tr><th>Jun–May cycle</th>${r.crops.map(c=>`<th>${c.name}<br>shortfall (mm)</th>`).join('')}<th>Total (mm)</th><th>All demand met?</th></tr></thead><tbody>${r.yearly.map(y=>`<tr><td>${y.year}–${y.year+1}</td>${y.parts.map(p=>`<td>${fmt(p.deficit,1)}</td>`).join('')}<td>${fmt(y.deficit,1)}</td><td>${y.covered?'Yes':'No'}</td></tr>`).join('')}</tbody></table></div></details>`);
}

const resources=[
  ['NASA POWER','Numerical input','Daily rainfall, air temperature and modeled root-zone wetness. Archived 2006–2025 example; live API requests for selected coordinates. Only rainfall and temperature enter water/climate scoring; wetness is displayed as context.','https://power.larc.nasa.gov/docs/services/api/temporal/daily/'],
  ['MODIS / NASA GIBS','Map imagery','Saved MODIS Terra true-color image and live true-color / NDVI visualization. Imagery is not sampled into the rotation scores.','https://nasa-gibs.github.io/gibs-api-docs/'],
  ['GPM & IMERG','Map imagery','Live NASA GIBS precipitation visualization. Rainfall numbers in this app come from POWER, not IMERG.','https://gpm.nasa.gov/data/imerg'],
  ['SMAP','Map imagery','Live NASA GIBS root-zone soil-moisture visualization. POWER GWETROOT is a separate modeled wetness index, not SMAP moisture.','https://smap.jpl.nasa.gov/'],
  ['Landsat & VIIRS','Reference','Vegetation, reflectance and land-surface context. No numerical extraction is implemented.','https://search.earthdata.nasa.gov/search?q=Landsat'],
  ['SRTM','Reference','Terrain and slope context for later erosion modeling. Current soil-cover scores do not use measured slope.','https://www.earthdata.nasa.gov/data/instruments/srtm'],
  ['ECOSTRESS','Reference','Land-surface temperature and evapotranspiration. No thermal or ET measurements feed the current model.','https://ecostress.jpl.nasa.gov/'],
  ['USDA Ag Data Commons','Reference · agricultural research','Open agricultural research and ground observations to calibrate assumptions.','https://agdatacommons.nal.usda.gov/'],
  ['Web Soil Survey','Reference · US','Official soil maps and properties for US farms. The current app uses farmer-entered soil.','https://websoilsurvey.nrcs.usda.gov/'],
  ['USDA Cropland Data Layer / CropScape','Reference · US','Crop history and cropland classes for US locations; not applicable as a Karnataka field survey.','https://nassgeodata.gmu.edu/CropScape/'],
  ['PRISM Climate Data','Reference · US','Terrain-aware historical climate context. Not fetched by this app.','https://prism.oregonstate.edu/'],
  ['SSURGO / STATSGO2','Reference · US','Detailed and regional soil data. No soil properties are inferred from these sources here.','https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo'],
  ['NAIP','Reference · US','Aerial imagery for field boundaries and cover validation.','https://naip-usdaonline.hub.arcgis.com/'],
  ['USGS NLCD','Reference · US','Land-cover history and landscape context.','https://www.usgs.gov/centers/eros/science/national-land-cover-database'],
  ['NLDAS / GLDAS','Reference','Continuous modeled land-surface histories for future comparisons.','https://ldas.gsfc.nasa.gov/'],
  ['FAO GAEZ / ECOCROP','Reference · crop suitability','Agroecological suitability and crop requirements. Temperature, pH and seasonal eligibility here remain editable prototype assumptions.','https://gaez.fao.org/'],
  ['CoCoRaHS','Reference','Local precipitation observations for validating satellite rainfall.','https://www.cocorahs.org/'],
  ['USGS NWIS','Reference · US','Surface-water and groundwater records for irrigation context.','https://waterdata.usgs.gov/nwis'],
  ['USDA AMS Market News','Reference · US','Market information for replacing the illustrative income index with local evidence.','https://www.ams.usda.gov/market-news'],
  ['USDA NASS QuickStats','Reference · US','Historical agricultural statistics for external calibration.','https://quickstats.nass.usda.gov/'],
  ['OpenET','Reference','Satellite-derived evapotranspiration products. No OpenET measurements are used in scoring.','https://openetdata.org/'],
  ['USFS LANDFIRE','Reference · US','Vegetation, fuels and surrounding landscape context.','https://landfire.gov/'],
  ['GEDI','Reference','Forest structure and biomass context around farms; not a direct crop-yield sensor.','https://gedi.umd.edu/'],
  ['Copernicus Sentinel-2','Partner reference','Multispectral imagery for future finer-scale vegetation analysis.','https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data/sentinel-2'],
  ['ERA5 / ECMWF','Partner reference','Reanalysis climate context for cross-checking the numerical inputs.','https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5'],
];
function showSources(){
  const meta=state.raw?._fieldShift;
  dialog('The data behind your decisions',`<p>Every resource in your challenge brief is listed here. The status identifies what this version actually uses.</p><div class="notice">Scoring uses NASA POWER numerical history + the crop-trait table + your inputs. GIBS imagery provides visual context only. Reference links are research paths, not active integrations.</div>${meta?`<p>Current numerical source: <a href="${esc(meta.sourceUrl)}" target="_blank" rel="noreferrer">NASA POWER request ↗</a><br>Retrieved ${esc(meta.retrievedAt)} · ${esc(state.mode)} · ${state.location.lat}, ${state.location.lon}</p><button class="button secondary" id="download-raw">Download original NASA JSON</button> <button class="button secondary" id="reset-example">Load Bengaluru example</button>`:''}${resources.map(([name,mode,desc,url])=>`<div class="resource-row"><div><h3><a href="${url}" target="_blank" rel="noreferrer">${name} ↗</a></h3><p>${desc}</p></div><span class="resource-status ${['Numerical input','Map imagery'].includes(mode)?'connected':''}">${mode}</span></div>`).join('')}<p>Additional tools: <a href="https://worldview.earthdata.nasa.gov" target="_blank" rel="noreferrer">NASA Worldview</a> · <a href="https://appeears.earthdatacloud.nasa.gov" target="_blank" rel="noreferrer">AppEEARS</a> · <a href="https://urs.earthdata.nasa.gov" target="_blank" rel="noreferrer">Earthdata Login</a>. No Earthdata credentials are needed for the current POWER and GIBS features.</p>`);
}
function showMethod(){
  dialog('Clear rules. Visible assumptions.',`<h3>What Field Shift does</h3><p>Compares three-season rotations using NASA weather history, farmer-entered soil and irrigation, a small crop table, and adjustable priorities. This prototype follows a Southern Karnataka June–September / October–January / February–May calendar. Coordinates work globally, but this crop calendar and crop list are not calibrated for other regions.</p><h3>Climate history and quality</h3><p>Daily NASA POWER observations are requested for 1 Jan 2006–31 Dec 2025. Fill values (including −999) are treated as missing, never as rain or temperature. Only complete calendar years enter annual charts. Only complete June–May cycles enter the replay: a complete 20-calendar-year file therefore yields 19 rotation cycles. A dry day has less than 1 mm rain; a very hot day exceeds 35°C. Trends are ordinary least squares, reported per decade.</p><h3>Water fit</h3><p>Indicative crop water demand is the midpoint of the table range. The crop starts on the first day of its planning season; only rain during its assumed growth duration counts. Captured rain is 65% for sandy soil, 80% for loam and 75% for clay, plus 0 / 150 / 350 mm of selected irrigation. These are illustrative capture assumptions, not a measured soil-water balance. There is no water storage between seasons, irrigation efficiency model, runoff routing, or daily stress model. Water fit is min(100, supply ÷ demand × 100), averaged across seasons and complete cycles. Fallow has zero crop demand and a water score of 100.</p><h3>What-if controls</h3><p>The rainfall slider scales daily rain by −30% to +30%. Temperature adds 0–3°C to mean and maximum air temperature. Crop water demand rises by an illustrative 4% per added °C. The model recomputes water and climate fit against the adjusted historical days. This is a sensitivity test, not a downscaled climate projection.</p><h3>The other four scores</h3><p><strong>Climate:</strong> 100 minus 12 points per °C outside the assumed mean-temperature range and 45 times the fraction of growth-window days above the crop’s upper temperature bound, clipped to 0–100. <strong>Soil:</strong> starts at 50, adds 25 for a legume and 8 per distinct cropped family; subtracts 12 for each adjacent same-family pair (including the year boundary), 10 per duplicate crop, average pH distance × 12, and 12 per crop with a nonpreferred soil texture (averaged). <strong>Cover:</strong> duration-weighted assumed crop cover with 25/100 cover after harvest; retained-residue fallow scores 45. This is a cover proxy, not a measured erosion rate. <strong>Income:</strong> an illustrative relative index, not prices, profit or yield.</p><h3>Search and priorities</h3><p>All season-eligible combinations from 12 crops plus fallow are scored. Three identical crops and more than one fallow season are excluded from alternatives. The baseline is always shown even if it breaks those assumptions. Alternatives include the highest weighted score and a distinct option ranked by water fit, then lower demand. Farmer weights map to water, soil, income, and the average of climate and cover. All-zero weights fall back to equal weights across the five components. “Highest” always refers to this model and candidate set.</p><h3>Crop-trait table</h3><p>Water ranges use the supplied guide and <a href="https://www.fao.org/4/s2022e/s2022e07.htm" target="_blank" rel="noreferrer">FAO indicative crop-water guidance</a>. Growth durations, temperature ranges, pH, cover, income and seasonal eligibility are prototype assumptions; they need local cultivar and extension-service validation. A legume’s nitrogen benefit depends on nodulation, residue handling and other management.</p><div class="table-scroll"><table><thead><tr><th>Crop</th><th>Family</th><th>Water mm</th><th>Temp °C</th><th>Days</th><th>pH</th><th>Income index</th></tr></thead><tbody>${CROPS.map(c=>`<tr><td>${c.name}</td><td>${c.family}</td><td>${c.water.join('–')}</td><td>${c.temp.join('–')}</td><td>${c.days}</td><td>${c.ph.join('–')}</td><td>${c.income}</td></tr>`).join('')}</tbody></table></div><div class="notice warning">POWER is regional gridded data (roughly tens of kilometres), not field-scale measurement. The wetness index is modeled; it is not the same quantity as volumetric SMAP moisture. These scores have not been validated against farm outcomes. Review the assumptions with local agricultural expertise before making a planting decision.</div><p>Built from the supplied Field Shift guide and challenge resource text. NASA supplies data; NASA does not endorse this independent project. The app uses explainable rules, not a trained yield or profit prediction model.</p>`);
}

function moveMarker(lat,lon,pending=true){
  if(state.marker){state.marker.setLatLng([lat,lon]);state.marker.setTooltipContent(pending?'Selected location · load history':state.location.name);}
  $('map-selection').textContent=pending?`${lat.toFixed(3)}, ${lon.toFixed(3)} · press “Load NASA history” to analyse`:`${state.location.name} · ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}
function initMap(){
  if(!window.L){$('map').innerHTML='<p style="padding:30px">Map assets could not load. Use the latitude and longitude fields to select your farm.</p>';return;}
  const L=window.L;
  state.map=L.map('map',{zoomControl:false,scrollWheelZoom:false,minZoom:2,maxZoom:12}).setView([12.97,77.6],7);
  L.control.zoom({position:'topright'}).addTo(state.map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(state.map);
  state.marker=L.marker([12.97,77.6],{icon:L.divIcon({className:'farm-marker',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(state.map).bindTooltip('Bengaluru, Karnataka',{direction:'top',offset:[0,-10]});
  state.map.on('click',event=>{const lat=Math.max(-90,Math.min(90,event.latlng.lat)),lon=((event.latlng.lng+180)%360+360)%360-180;$('latitude').value=lat.toFixed(3);$('longitude').value=lon.toFixed(3);moveMarker(lat,lon);});
  setLayer();
}
const layerDefs={ndvi:['MODIS_Terra_L3_NDVI_16Day','MODIS NDVI · 16-day vegetation composite'],rain:['IMERG_Precipitation_Rate','GPM IMERG · precipitation-rate visualization'],soil:['SMAP_L4_Analyzed_Root_Zone_Soil_Moisture','SMAP · modeled root-zone moisture visualization'],truecolor:['MODIS_Terra_CorrectedReflectance_TrueColor','MODIS Terra · true-color imagery']};
function setLayer(){
  if(!state.map)return;const L=window.L,key=$('layer').value;let date=$('imagery-date').value;
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  if(key==='ndvi'){
    const selected=new Date(date+'T00:00:00Z'),start=Date.UTC(selected.getUTCFullYear(),0,1);
    date=new Date(start+Math.floor((selected.getTime()-start)/86400000/16)*16*86400000).toISOString().slice(0,10);
    $('imagery-date').value=date;
  }
  if(state.overlay)state.map.removeLayer(state.overlay);
  $('imagery-date').disabled=key==='archive';
  if(key==='archive'){
    state.overlay=L.imageOverlay('data/karnataka-modis.jpg',[[9,73],[18,82]],{opacity:.95,attribution:'NASA GIBS / MODIS Terra · 15 Jan 2025'}).addTo(state.map);
    $('map-note').textContent='Saved NASA image · 15 Jan 2025 · Karnataka region only; base map elsewhere. Visual context, not field measurements.';
  }else{
    const [layer,label]=layerDefs[key];
    let failures=0;
    state.overlay=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{layers:layer,format:'image/png',transparent:true,version:'1.1.1',time:date,attribution:'NASA GIBS',opacity:key==='truecolor'?.95:.72}).addTo(state.map);
    state.overlay.on('tileerror',()=>{failures++;$('map-note').textContent='NASA imagery could not load. Try another date, another layer, or the saved MODIS image.';});
    state.overlay.on('load',()=>{if(!failures){
      const legends={ndvi:'MODIS_L3_NDVI_H.png',rain:'GPM_Precipitation_Rate_H.png',soil:'SMAP_Analyzed_Soil_Moisture_H.png'};
      $('map-note').innerHTML=`${label} · ${key==='ndvi'?'composite starts':'requested'} ${date}. Blank areas can indicate no data. Visual only. ${legends[key]?`<a href="https://gibs.earthdata.nasa.gov/legends/${legends[key]}" target="_blank" rel="noreferrer">NASA color scale ↗</a>`:''}`;
    }});
    $('map-note').textContent=`Loading ${label} for ${date}…`;
  }
  const [lat,lon]=[+$('latitude').value,+$('longitude').value];
  const layer=key==='archive'?layerDefs.truecolor[0]:layerDefs[key][0];
  $('worldview').href='https://worldview.earthdata.nasa.gov/?'+new URLSearchParams({v:`${lon-3},${lat-3},${lon+3},${lat+3}`,t:key==='archive'?'2025-01-15':date,l:layer});
}
function download(filename,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportReport(){
  if(!state.results)return;recalculate();if(!$('ph').checkValidity())return;const config=state.analysis.settings,sc=state.analysis.scenario,meta=state.raw._fieldShift;
  const rows=[['Current rotation',state.results.baseline],['Fits your priorities',state.results.best],['Water-first alternative',state.results.alternate]];
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Field Shift rotation report</title><style>body{font:15px/1.7 system-ui,sans-serif;color:#244d3d;max-width:1000px;margin:50px auto;padding:0 25px}h1{font:40px Georgia}h2{margin-top:35px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #dce4d5;padding:10px;text-align:left}aside{background:#f0f4e8;padding:20px}a{color:#376432}@media print{body{margin:0}}</style><h1>Field Shift · Rotation report</h1><p>${esc(state.location.name)} · ${state.location.lat}, ${state.location.lon}<br>Generated ${esc(new Date().toISOString())}</p><p>NASA POWER ${state.climate.annual[0].year}–${state.climate.annual.at(-1).year} · ${state.climate.rotations.length} complete June–May cycles · ${esc(state.mode)} response</p><aside>Soil: ${config.soil}; pH: ${esc(config.ph||'unknown')}; irrigation: ${config.irrigation} mm per cropped season.<br>What-if: rainfall ${signed(sc.rain)}%, temperature +${sc.temp}°C.<br>Priority weights: water ${config.weights.water}, soil ${config.weights.soil}, income ${config.weights.income}, exposure ${config.weights.risk}.</aside><h2>Climate context</h2><p>Average annual rainfall ${fmt(state.climate.rain)} mm; mean temperature ${fmt(state.climate.temp,1)}°C. Historical rainfall trend ${signed(state.climate.rainTrend)} mm/decade; temperature ${signed(state.climate.tempTrend,2)}°C/decade.</p>${rows.map(([name,r])=>`<h2>${name} · ${fmt(r.score)}/100</h2><p><strong>${r.crops.map(c=>c.name).join(' → ')}</strong></p><p>${reason(r)} ${risk(r)}</p><table><tr><th>Water fit</th><th>Soil health</th><th>Climate fit</th><th>Soil cover</th><th>Income index</th></tr><tr>${['water','soil','climate','cover','income'].map(k=>`<td>${fmt(r.scores[k])}</td>`).join('')}</tr></table><p>${r.covered}/${r.yearly.length} cycles met every crop’s demand with assumed captured rainfall and irrigation. ${r.severe} cycles exceeded 100 mm total unmet demand. Mean deficit ${fmt(r.deficit)} mm; historical range ${fmt(r.gapRange[0])}–${fmt(r.gapRange[1])} mm. Total indicative crop demand ${fmt(r.need)} mm.</p>`).join('')}<h2>Evidence and assumptions</h2><p><a href="${esc(meta.sourceUrl)}">Original NASA POWER request</a> · retrieved ${esc(meta.retrievedAt)}. NASA GIBS map images do not enter scores. Crop-water guidance: <a href="https://www.fao.org/4/s2022e/s2022e07.htm">FAO indicative crop water needs</a>.</p><p>Rain is counted within the assumed crop duration. Capture fractions: sandy 0.65, loam 0.8, clay 0.75. Irrigation is an assumed per-crop input; there is no interseason water storage. Water demand uses crop-range midpoints and rises by an illustrative 4% per added °C. Scores and crop traits are screening assumptions, not calibrated agronomy. Income is a relative index, not profit. The crop calendar is a Southern Karnataka template.</p><aside>Regional gridded history cannot describe every field. These are historical comparisons and sensitivity experiments, not yield predictions or future probabilities. Verify local soil, crop variety, market access and management with an agriculture adviser. NASA does not endorse this independent project.</aside></html>`;
  download('field-shift-rotation-report.html',html,'text/html');
}

$('farm-form').addEventListener('submit',event=>{event.preventDefault();loadClimate(+$('latitude').value,+$('longitude').value);});
for(const id of ['soil','ph','irrigation','crop-0','crop-1','crop-2'])$(id).addEventListener('change',scheduleRecalculate);
for(const id of ['weight-water','weight-soil','weight-income','weight-risk','scenario-rain','scenario-temp'])$(id).addEventListener('input',scheduleRecalculate);
for(const id of ['latitude','longitude'])$(id).addEventListener('change',()=>{if($(id).checkValidity())moveMarker(+$('latitude').value,+$('longitude').value);});
$('reset-scenario').addEventListener('click',()=>{$('scenario-rain').value=0;$('scenario-temp').value=0;scheduleRecalculate();});
$('close-dialog').addEventListener('click',()=>$('detail-dialog').close());
$('detail-dialog').addEventListener('click',event=>{if(event.target===$('detail-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
document.addEventListener('click',event=>{
  const open=event.target.closest('[data-open]');if(open){if(open.dataset.open==='sources')showSources();else showMethod();}
  const detail=event.target.closest('[data-detail]');if(detail)showRotation(detail.dataset.detail);
  const chart=event.target.closest('[data-chart]');if(chart){state.chart=chart.dataset.chart;document.querySelectorAll('[data-chart]').forEach(b=>b.classList.toggle('selected',b===chart));renderChart();}
  if(event.target.closest('#download-raw')&&state.raw)download('field-shift-nasa-power.json',JSON.stringify(state.raw,null,2),'application/json');
  if(event.target.closest('#reset-example')){$('detail-dialog').close();loadClimate(12.97,77.6);}
  const nav=event.target.closest('a.nav-link');if(nav){document.querySelectorAll('a.nav-link').forEach(n=>n.classList.toggle('active',n===nav));document.querySelector('.breadcrumb strong').textContent=nav.textContent.trim();}
});
$('history-table').addEventListener('click',()=>{if(state.climate)dialog('The recorded years',`<p>Complete calendar years from NASA POWER at ${state.location.lat}, ${state.location.lon}. <strong>Annual</strong> totals; rotation replay uses June–May cycles.</p><div class="table-scroll"><table><thead><tr><th>Year</th><th>Rainfall (mm)</th><th>Mean temperature (°C)</th><th>Days above 35°C</th></tr></thead><tbody>${state.climate.annual.map(y=>`<tr><td>${y.year}</td><td>${fmt(y.rain,1)}</td><td>${fmt(y.temp,2)}</td><td>${y.hot}</td></tr>`).join('')}</tbody></table></div>`);});
$('layer').addEventListener('change',setLayer);$('imagery-date').addEventListener('change',setLayer);
$('recenter').addEventListener('click',()=>state.map?.setView([+$('latitude').value,+$('longitude').value],7));
$('export').addEventListener('click',exportReport);
syncOutputs();document.querySelector('.source-pill').textContent='Loading NASA history';initMap();loadClimate(12.97,77.6);
