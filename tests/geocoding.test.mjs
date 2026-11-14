import assert from 'node:assert/strict';
import {normalizePhoton,normalizeGeoNames,mergePlaces,placeSearchUrls,searchPlaces} from '../dist/geocoding.js';
const photon={features:[
  {geometry:{type:'Point',coordinates:[76.6,12.5]},properties:{name:'Kallur',county:'Mandya',state:'Karnataka',country:'India',osm_value:'village'}},
  {geometry:{type:'Point',coordinates:[78.3,17.2]},properties:{name:'Kallur',county:'Nalgonda',state:'Telangana',country:'India',osm_value:'hamlet'}},
  {geometry:{type:'Point',coordinates:[200,95]},properties:{name:'Invalid coordinates'}},
]};
const geonames={results:[{name:'Kallur',latitude:12.5001,longitude:76.6001,admin2:'Mandya',admin1:'Karnataka',country:'India',feature_code:'PPL'}]};
const normalized=normalizePhoton(photon);assert.equal(normalized.length,2);
const merged=mergePlaces([...normalized,...normalizeGeoNames(geonames)],'Kallur','Telangana');
assert.equal(merged.length,2,'The same village from two sources is merged; distant namesakes remain distinct.');
assert.equal(merged[0].context,'Nalgonda, Telangana, India');
assert.equal(merged[1].sources.length,2);
assert.equal(normalizeGeoNames({}).length,0);
assert.throws(()=>normalizePhoton({error:'unavailable'}));
assert.throws(()=>placeSearchUrls(' '));
assert.equal(new URL(placeSearchUrls('ಹುಲಿಕೆರೆ','ಮಂಡ್ಯ').photon).searchParams.get('q'),'ಹುಲಿಕೆರೆ, ಮಂಡ್ಯ');
assert.equal(new URL(placeSearchUrls('Kallur','Mandya').geonames).searchParams.get('name'),'Kallur');
assert.equal(new URL(placeSearchUrls('Kallur').photon).searchParams.has('bbox'),false,'Search is not restricted to the default farm region.');
const fetcher=async url=>({ok:true,json:async()=>url.includes('photon')?photon:geonames});
const result=await searchPlaces('Kallur','Telangana',{fetcher});
assert.equal(result.places.length,2);assert.equal(result.partial,false);
const partial=await searchPlaces('Kallur','',{fetcher:async url=>{if(url.includes('photon'))throw new Error('Network down');return {ok:true,json:async()=>geonames};}});
assert.equal(partial.partial,true);assert.equal(partial.places.length,1);
await assert.rejects(()=>searchPlaces('Kallur','',{fetcher:async()=>{throw new Error('Network down');}}),/unavailable/);
const controller=new AbortController();controller.abort();
await assert.rejects(()=>searchPlaces('Kallur','',{signal:controller.signal,fetcher}),e=>e.name==='AbortError');
console.log('Place search checks passed: Unicode, ambiguous villages, context ranking, deduplication, invalid coordinates, provider failure and cancellation.');
