import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  for(const [query,region] of [['Hampi','Karnataka'],['Hulikere','Karnataka'],['Kallur','Telangana']]){
    const result=await page.evaluate(async({query,region})=>{
      const {searchPlaces}=await import('/geocoding.js');
      const r=await searchPlaces(query,region);
      return {query,region,count:r.places.length,partial:r.partial,examples:r.places.slice(0,3).map(p=>({name:p.label,lat:p.lat,lon:p.lon,sources:p.sources}))};
    },{query,region});
    assert.ok(result.count>0,query+' should return at least one real place match.');
    console.log(JSON.stringify(result));
  }
}finally{await browser.close();}
