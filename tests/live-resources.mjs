import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage();
try{
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const url='https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETROOT&community=AG&latitude=12.97&longitude=77.6&start=20250101&end=20250110&format=JSON&time-standard=LST';
    const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw new Error('NASA POWER '+response.status);
    const data=await response.json();
    return {status:response.status,days:Object.keys(data.properties.parameter.PRECTOTCORR).length,temperature:data.properties.parameter.T2M['20250101']};
  });
  assert.equal(result.days,10);assert.ok(Number.isFinite(result.temperature));
  console.log('Live NASA POWER browser/CORS check:',JSON.stringify(result));
  for(const [name,id] of [['NDVI','MODIS_Terra_L3_NDVI_16Day'],['IMERG','IMERG_Precipitation_Rate'],['SMAP','SMAP_L4_Analyzed_Root_Zone_Soil_Moisture']]){
    const url='https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?'+new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:id,STYLES:'',SRS:'EPSG:3857',BBOX:'8200000,1000000,9200000,2000000',WIDTH:'256',HEIGHT:'256',FORMAT:'image/png',TIME:'2025-01-17'});
    const response=await page.request.get(url,{timeout:60000});
    assert.equal(response.status(),200);
    assert.match(response.headers()['content-type'],/image\/png/);
    if(name==='NDVI')assert.ok((await response.body()).length>1000,'NDVI must contain imagery for this land region, not a transparent no-data tile.');
    console.log('Live NASA GIBS '+name+': valid PNG, '+(await response.body()).length+' bytes');
  }
}finally{await browser.close();}
