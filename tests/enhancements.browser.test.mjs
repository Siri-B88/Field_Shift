import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.FIELD_SHIFT_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));let nasaRequests=0;
page.on('request',r=>{if(/power\.larc\.nasa\.gov/.test(r.url()))nasaRequests++;});
const input=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');};
try{
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});await page.locator('.rotation-card').first().waitFor({state:'attached'});
  await page.locator('#load-climate').click();await page.locator('#step-2').waitFor({state:'visible'});
  await input('farm-area',2);await input('farm-budget',5000);await page.locator('#budget-editor summary').click();
  for(const crop of ['rice','maize','chickpea','fallow']){
    await page.locator('#budget-crop').selectOption(crop);
    for(const key of ['seed','fertilizer','labour','irrigation','machinery','transport','other'])await input('cost-'+key,crop==='fallow'?0:100);
    if(crop!=='fallow'){await input('cost-yield',1000);await input('cost-price',2);}
  }
  await page.locator('.step-nav [data-step="4"]').click();
  const finance=page.locator('[data-rotation="best"] .finance-inline');assert.match(await finance.innerText(),/2,800/);assert.match(await finance.innerText(),/5,200/);
  await page.locator('#finance-results summary').click();assert.match(await page.locator('#financial-comparison').innerText(),/Needs inputs/,'Incomplete alternatives must stay unknown.');
  await page.locator('#financial-scenarios summary').click();await page.locator('#financial-price').fill('-50');await page.locator('#financial-price').dispatchEvent('input');
  assert.match(await finance.innerText(),/1,200/);await page.locator('#reset-financial').click();assert.match(await finance.innerText(),/5,200/);
  await page.locator('.step-nav [data-step="2"]').click();await page.locator('#budget-basis').selectOption('ha');
  assert.equal(await page.locator('#farm-area').inputValue(),'2');await page.locator('.step-nav [data-step="4"]').click();assert.match(await finance.innerText(),/5,200/,'Changing estimate units must preserve money totals.');
  const requestsBefore=nasaRequests;
  const scripts={kn:/[\u0C80-\u0CFF]/,hi:/[\u0900-\u097F]/,ta:/[\u0B80-\u0BFF]/,te:/[\u0C00-\u0C7F]/,ml:/[\u0D00-\u0D7F]/,mr:/[\u0900-\u097F]/};
  for(const [lang,script] of Object.entries(scripts)){
    await page.locator('#language').selectOption(lang);await page.waitForFunction(code=>document.documentElement.lang===code,lang);
    assert.match(await page.locator('#step-title-4').innerText(),script);
    assert.match(await page.locator('[data-rotation="best"] h3').innerText(),script);
    assert.match(await finance.innerText(),script);
    assert.doesNotMatch(await page.locator('#step-4').innerText(),/\{\{/,'No raw interpolation placeholders.');
    assert.equal(await page.locator('#farm-area').inputValue(),'2');
    await page.locator('[data-detail="best"]').click();assert.match(await page.locator('#dialog-body').innerText(),script);await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,lang+' mobile overflow');
  }
  assert.equal(nasaRequests,requestsBefore,'Language switches must not refetch NASA history.');
  await page.locator('#language').selectOption('kn');await page.waitForFunction(()=>document.documentElement.lang==='kn');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.rotation-card').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#language').inputValue(),'kn');assert.equal(await page.locator('#farm-area').inputValue(),'2');
  await page.locator('#load-climate').click();await page.locator('#step-2').waitFor({state:'visible'});await page.locator('.step-nav [data-step="4"]').click();
  await page.screenshot({path:'qa/enhanced-kannada-mobile.png',fullPage:true});
  // Print is tested without opening an operating-system dialog.
  await page.evaluate(()=>{window.addEventListener('load',()=>{},true);const append=Element.prototype.append;Element.prototype.append=function(...nodes){for(const node of nodes)if(node.tagName==='IFRAME'){node.addEventListener('load',()=>{node.contentWindow.print=()=>{window.__printed=true;};},{once:true});}return append.apply(this,nodes);};});
  await page.locator('#print-report').click();await page.waitForFunction(()=>window.__printed);
  const report=page.frameLocator('.report-frame');assert.match(await report.locator('body').innerText(),scripts.kn);assert.equal(await report.locator('html').getAttribute('lang'),'kn');
  await page.locator('#language').selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');
  await page.evaluate(()=>{if('speechSynthesis'in window)speechSynthesis.getVoices=()=>[];});await page.locator('#read-plan').click();assert.match(await page.locator('#voice-status').innerText(),/No voice|unavailable/);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Enhanced browser checks passed: entered budgets, unit conversion, scenarios, all seven languages, persistence, no NASA refetches, mobile, localized print report and voice fallback.');
}finally{await browser.close();}
