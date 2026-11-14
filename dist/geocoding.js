// User-triggered place lookup. Neither provider is used as climate or soil evidence.
const cache=new Map();
const clean=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):'';
const fold=value=>clean(value).toLocaleLowerCase();
const unique=items=>[...new Map(items.filter(Boolean).map(x=>[fold(x),x])).values()];
const validPoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;

export function normalizePhoton(data){
  if(!Array.isArray(data?.features))throw new Error('Photon returned an unexpected response.');
  return data.features.flatMap(feature=>{
    const p=feature.properties||{},coords=feature.geometry?.coordinates;
    if(feature.geometry?.type!=='Point'||!Array.isArray(coords))return [];
    const [lon,lat]=coords,name=clean(p.name||p.city||p.district);
    if(!name||!validPoint(lat,lon))return [];
    const context=unique([p.district,p.city,p.county,p.state,p.country].map(clean)).filter(x=>fold(x)!==fold(name));
    return [{name,context:context.join(', '),label:[name,...context].join(', '),lat,lon,kind:clean(p.osm_value)||'place',sources:['OpenStreetMap / Photon']}];
  });
}
export function normalizeGeoNames(data){
  if(data?.error||!data||typeof data!=='object'||(data.results!==undefined&&!Array.isArray(data.results)))throw new Error('GeoNames lookup returned an unexpected response.');
  return (data.results||[]).flatMap(p=>{
    const name=clean(p.name),lat=p.latitude,lon=p.longitude;
    if(!name||!validPoint(lat,lon))return [];
    const context=unique([p.admin4,p.admin3,p.admin2,p.admin1,p.country].map(clean)).filter(x=>fold(x)!==fold(name));
    return [{name,context:context.join(', '),label:[name,...context].join(', '),lat,lon,kind:p.feature_code?.startsWith('PPL')?'settlement':'place',sources:['GeoNames / Open-Meteo']}];
  });
}
function distance(a,b){
  const rad=Math.PI/180,dy=(a.lat-b.lat)*rad,dx=(a.lon-b.lon)*rad;
  const h=Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2;
  return 12742000*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function mergePlaces(places,query,region=''){
  const merged=[];
  for(const place of places){
    const same=merged.find(p=>fold(p.name)===fold(place.name)&&distance(p,place)<250);
    if(same)same.sources=unique([...same.sources,...place.sources]);
    else merged.push({...place,sources:[...place.sources]});
  }
  const target=fold(query.split(',')[0]),context=fold(region||query.split(',').slice(1).join(' ')).split(/[\s,]+/).filter(t=>t.length>1);
  const settlement=new Set(['village','hamlet','town','city','locality','suburb','neighbourhood','settlement']);
  const rank=p=>(fold(p.name)===target?200:fold(p.name).startsWith(target)?100:0)+(settlement.has(p.kind)?20:0)+context.filter(t=>fold(p.label).includes(t)).length*60;
  return merged.sort((a,b)=>rank(b)-rank(a));
}
export function placeSearchUrls(query,region=''){
  const name=clean(query),area=clean(region);
  if(name.length<2)throw new Error('Enter at least two characters of a village, town or postal code.');
  if(name.length>120||area.length>120)throw new Error('Keep the place name and district/state under 120 characters each.');
  return {
    photon:'https://photon.komoot.io/api/?'+new URLSearchParams({q:[name,area].filter(Boolean).join(', '),limit:'15'}),
    // A district is not necessarily a GeoNames admin1 qualifier: keep this query
    // broad, and rank its results against the user's district/state locally.
    geonames:'https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:name.split(',')[0].trim(),count:'30',language:'en',format:'json'}),
  };
}
async function request(url,signal,fetcher){
  const controller=new AbortController(),cancel=()=>controller.abort();
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,15000);
  try{
    const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Place service returned HTTP ${response.status}.`);
    return await response.json();
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function searchPlaces(query,region='',{signal,fetcher=fetch}={}){
  const urls=placeSearchUrls(query,region),key=fold(query)+'|'+fold(region);
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  const saved=cache.get(key);
  if(fetcher===fetch&&saved&&Date.now()-saved.time<600000)return {...saved.value,cached:true};
  const responses=await Promise.allSettled([
    request(urls.photon,signal,fetcher).then(normalizePhoton),
    request(urls.geonames,signal,fetcher).then(normalizeGeoNames),
  ]);
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  const failures=responses.filter(r=>r.status==='rejected').length;
  if(failures===responses.length)throw new Error('Place search is unavailable. Check your connection and try again, or use your current location or the map pin.');
  const value={places:mergePlaces(responses.flatMap(r=>r.status==='fulfilled'?r.value:[]),query,region),partial:failures>0,cached:false};
  if(fetcher===fetch&&!value.partial){if(cache.size>=25)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),value});}
  return value;
}
