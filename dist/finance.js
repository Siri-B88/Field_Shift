// Farmer-entered scenarios only. No NASA-derived yield or market-price estimates.
export const ACRES_PER_HECTARE=2.471053814671653;
export const COST_FIELDS=['seed','fertilizer','labour','irrigation','machinery','transport','other'];
export const blankEntry=()=>Object.fromEntries([...COST_FIELDS,'yield','price'].map(k=>[k,'']));
export const numberOrNull=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
export function hectares(area,unit){return unit==='acre'?area/ACRES_PER_HECTARE:area;}
export function validateProfile(profile){
  const area=numberOrNull(profile.area),budget=numberOrNull(profile.budget);
  return area!==null&&area>0&&area<=100000&&['acre','ha'].includes(profile.unit)&&['acre','ha'].includes(profile.basis)&& (budget===null||budget>=0&&budget<=1e12);
}
export function validEntry(entry,rest=false){
  const fields=rest?COST_FIELDS:[...COST_FIELDS,'yield','price'];
  return fields.every(k=>{const n=numberOrNull(entry?.[k]);return n!==null&&n>=0&&n<=1e9;});
}
export function convertBasis(entries,from,to){
  if(from===to)return structuredClone(entries);
  const factor=from==='acre'?ACRES_PER_HECTARE:1/ACRES_PER_HECTARE;
  return Object.fromEntries(Object.entries(entries).map(([id,e])=>[id,Object.fromEntries(Object.entries(e).map(([k,v])=>[k,k==='price'||numberOrNull(v)===null?v:Number(v)*factor]))]));
}
export function estimateCrop(id,profile,entry,changes={}){
  if(!validateProfile(profile))return {complete:false,missing:['farm']};
  const rest=id==='fallow',fields=rest?COST_FIELDS:[...COST_FIELDS,'yield','price'];
  const missing=fields.filter(k=>{const n=numberOrNull(entry?.[k]);return n===null||n<0||n>1e9;});
  if(missing.length)return {complete:false,missing};
  const pct=k=>Math.max(-100,Math.min(200,numberOrNull(changes[k])??0))/100;
  const areaHa=hectares(Number(profile.area),profile.unit),acres=areaHa*ACRES_PER_HECTARE;
  const units=profile.basis==='acre'?acres:areaHa;
  const costs=Object.fromEntries(COST_FIELDS.map(k=>[k,Number(entry[k])*units*(1+(k==='fertilizer'?pct('fertilizer'):k==='labour'?pct('labour'):0))]));
  const cost=Object.values(costs).reduce((a,b)=>a+b,0);
  const quantity=rest?0:Number(entry.yield)*units*(1+pct('yield'));
  const price=rest?0:Number(entry.price)*(1+pct('price'));
  const revenue=quantity*price,net=revenue-cost;
  const downsideYield=Math.max(0,Math.min(100,numberOrNull(changes.downsideYield)??20))/100;
  const downsidePrice=Math.max(0,Math.min(100,numberOrNull(changes.downsidePrice)??20))/100;
  const downsideRevenue=revenue*(1-downsideYield)*(1-downsidePrice);
  return {complete:true,cost,costs,quantity,price,revenue,net,costPerAcre:cost/acres,netPerAcre:net/acres,breakEvenPrice:quantity>0?cost/quantity:null,breakEvenYieldPerAcre:price>0?cost/price/acres:null,roi:cost>0?net/cost*100:null,downsideNet:downsideRevenue-cost,loss:Math.max(0,cost-downsideRevenue)};
}
export function estimateRotation(ids,profile,entries,changes={}){
  const parts=ids.map(id=>({id,...estimateCrop(id,profile,entries[id],changes)}));
  if(parts.some(p=>!p.complete))return {complete:false,parts,missing:parts.filter(p=>!p.complete).map(p=>p.id)};
  const sum=key=>parts.reduce((n,p)=>n+p[key],0),cost=sum('cost'),revenue=sum('revenue'),net=revenue-cost,downsideNet=sum('downsideNet');
  const budget=numberOrNull(profile.budget);
  return {complete:true,parts,cost,revenue,net,downsideNet,loss:Math.max(0,-downsideNet),costPerAcre:sum('costPerAcre'),roi:cost>0?net/cost*100:null,budgetGap:budget===null?null:Math.max(0,cost-budget)};
}
