import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const raw=JSON.parse(readFileSync(new URL('../dist/data/bengaluru-power.json',import.meta.url)));
const browser=await chromium.launch({headless:true,executablePath:process.env.FIELD_SHIFT_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let requests=0;
try{
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  for(const provider of ['photon.komoot.io','geocoding-api.open-meteo.com'])await page.route('https://'+provider+'/**',async route=>{
    requests++;const url=new URL(route.request().url()),query=url.searchParams.get('q')||url.searchParams.get('name');
    if(query.startsWith('Unavailable'))return route.fulfill({status:503,body:'Unavailable'});
    if(query.startsWith('Partial')&&provider.includes('photon'))return route.fulfill({status:503,body:'Unavailable'});
    if(query.startsWith('Slow'))await new Promise(resolve=>setTimeout(resolve,250));
    const entries=query.startsWith('Missing')?[]:[{name:query.startsWith('Slow')?'Old result':'Kallur',lat:12.50012,lon:76.60012,district:'Mandya',state:'Karnataka'},{name:'Kallur',lat:17.2,lon:78.3,district:'Nalgonda',state:'Telangana'}];
    const body=provider.includes('photon')?{features:entries.map(p=>({geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{name:p.name,county:p.district,state:p.state,country:'India',osm_value:'village'}}))}:{results:entries.map(p=>({name:p.name,latitude:p.lat+.00001,longitude:p.lon+.00001,admin2:p.district,admin1:p.state,country:'India',feature_code:'PPL'}))};
    try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});}catch{/* An intentionally cancelled request may already be closed. */}
  });
  // Synthetic NASA fixture is confined to this browser test, never bundled as farm data.
  await page.route('https://power.larc.nasa.gov/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(raw)}));
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.locator('.rotation-card').first().waitFor({state:'attached'});
  await page.locator('#place-query').fill('Kallur');assert.equal(requests,0,'Typing alone must not call place services.');
  await page.locator('#place-region').fill('Telangana');await page.locator('#place-query').press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('.place-result').length===2);
  assert.match(await page.locator('.place-result').first().innerText(),/Nalgonda/);
  await page.locator('.place-result').first().click();
  assert.equal(await page.locator('#latitude').inputValue(),'17.20000');
  assert.equal(await page.locator('#longitude').inputValue(),'78.30000');
  assert.equal(await page.locator('#layer').inputValue(),'streets');
  assert.match(await page.locator('#location-name').innerText(),/Bengaluru/,'Selecting a pin must not relabel the old NASA analysis.');
  await page.locator('#load-climate').click();
  await page.waitForFunction(()=>document.querySelector('#location-name').textContent.includes('Nalgonda'));
  assert.match(await page.locator('#selected-place').textContent(),/NASA analysis loaded/);
  // Names must survive in the downloadable report.
  await page.locator('.step-nav [data-step="4"]').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
  const report=await downloadPromise;assert.equal(report.suggestedFilename(),'field-shift-rotation-report.html');
  await page.locator('.step-nav [data-step="1"]').click();
  async function lookup(query){await page.locator('#place-query').fill(query);await page.locator('#place-query').press('Enter');await page.waitForFunction(()=>!document.querySelector('#search-places').disabled);}
  await lookup('Missing');assert.match(await page.locator('#place-search-status').innerText(),/No matching place/);assert.equal(await page.locator('#place-results').isVisible(),false);
  await lookup('Unavailable');assert.match(await page.locator('#place-search-status').innerText(),/unavailable/);
  await lookup('Partial');assert.match(await page.locator('#place-search-status').innerText(),/One database is unavailable/);assert.equal(await page.locator('.place-result').count(),2);
  await page.locator('#place-query').fill('Slow');await page.locator('#place-query').press('Enter');
  await page.locator('#place-query').fill('Kallur');await page.locator('#place-query').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#search-places').disabled);await page.waitForTimeout(300);
  assert.doesNotMatch(await page.locator('#place-results').innerText(),/Old result/);
  await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_success,error)=>error({code:1});});
  await page.locator('#use-location').click();assert.match(await page.locator('#place-search-status').innerText(),/permission was declined/);
  await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:13.12345,longitude:77.12345,accuracy:25}});});
  await page.locator('#use-location').click();assert.equal(await page.locator('#latitude').inputValue(),'13.12345');
  assert.match(await page.locator('#selected-place').innerText(),/Your current location/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.locator('.place-search-card').screenshot({path:'qa/place-search-mobile.png'});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Village search browser checks passed: keyboard search, district ranking, pin selection, named NASA analysis, missing villages, failures, stale responses, GPS fallback and mobile layout.');
}finally{await browser.close();}
