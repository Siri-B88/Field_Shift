// Transparent screening model. Trait assumptions and limitations are exposed in the UI.
export const CROPS = [
  {id:'rice',name:'Rice',family:'Cereal',water:[450,700],temp:[20,35],days:120,legume:false,cover:65,income:85,ph:[5,7.5],soils:['clay','loam'],seasons:[0,1]},
  {id:'maize',name:'Maize',family:'Cereal',water:[500,800],temp:[18,32],days:110,legume:false,cover:60,income:70,ph:[5.5,7.5],soils:['loam'],seasons:[0,1,2]},
  {id:'millet',name:'Pearl millet',family:'Cereal',water:[450,650],temp:[25,35],days:105,legume:false,cover:70,income:45,ph:[5.5,8],soils:['sandy','loam'],seasons:[0,2]},
  {id:'sorghum',name:'Sorghum',family:'Cereal',water:[450,650],temp:[22,35],days:120,legume:false,cover:70,income:50,ph:[5.5,8],soils:['loam','clay'],seasons:[0,1,2]},
  {id:'chickpea',name:'Chickpea',family:'Legume',water:[300,500],temp:[15,30],days:100,legume:true,cover:75,income:65,ph:[6,8],soils:['loam','clay'],seasons:[1]},
  {id:'bean',name:'Dry bean',family:'Legume',water:[300,500],temp:[15,30],days:100,legume:true,cover:75,income:65,ph:[5.5,7],soils:['loam'],seasons:[0,1,2]},
  {id:'groundnut',name:'Groundnut',family:'Legume',water:[500,700],temp:[22,30],days:110,legume:true,cover:80,income:70,ph:[5.5,7],soils:['sandy','loam'],seasons:[0,2]},
  {id:'soybean',name:'Soybean',family:'Legume',water:[450,700],temp:[20,30],days:110,legume:true,cover:80,income:65,ph:[6,7.5],soils:['loam','clay'],seasons:[0]},
  {id:'wheat',name:'Wheat',family:'Cereal',water:[450,650],temp:[12,25],days:120,legume:false,cover:70,income:65,ph:[6,7.5],soils:['loam','clay'],seasons:[1]},
  {id:'pea',name:'Pea',family:'Legume',water:[350,500],temp:[10,25],days:100,legume:true,cover:75,income:65,ph:[6,7.5],soils:['loam'],seasons:[1]},
  {id:'sunflower',name:'Sunflower',family:'Oilseed',water:[600,1000],temp:[18,30],days:110,legume:false,cover:50,income:75,ph:[6,8],soils:['loam','clay'],seasons:[0,1,2]},
  {id:'mungbean',name:'Mung bean',family:'Legume',water:[300,500],temp:[20,35],days:70,legume:true,cover:75,income:55,ph:[6,7.5],soils:['sandy','loam'],seasons:[0,2]},
  {id:'fallow',name:'Fallow + residue',family:'Rest',water:[0,0],temp:[-50,60],days:0,legume:false,cover:45,income:0,ph:[0,14],soils:['sandy','loam','clay'],seasons:[0,1,2]},
];
export const SEASONS = [
  {name:'Monsoon',range:'Jun–Sep',months:[6,7,8,9],days:122},
  {name:'Post-monsoon',range:'Oct–Jan',months:[10,11,12,1],days:123},
  {name:'Summer',range:'Feb–May',months:[2,3,4,5],days:120},
];
export const byId = id => CROPS.find(c=>c.id===id);
export const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
const sum = arr => arr.reduce((a,b)=>a+b,0);
const clamp = n => Math.max(0,Math.min(100,n));
const valid = (v,fill=-999) => Number.isFinite(v) && v !== fill && v > -900;
const yearLength = year => year%4===0&&(year%100!==0||year%400===0)?366:365;
export function distribution(values){
  const numbers=values.filter(Number.isFinite);
  if(!numbers.length)return {min:null,max:null,sd:null,cv:null};
  const average=mean(numbers),sd=Math.sqrt(mean(numbers.map(v=>(v-average)**2)));
  return {min:Math.min(...numbers),max:Math.max(...numbers),sd,cv:average>0?sd/average*100:null};
}
export function slope(points) {
  if(points.length<2) return 0;
  const x=mean(points.map(p=>p[0])),y=mean(points.map(p=>p[1]));
  const denom=sum(points.map(p=>(p[0]-x)**2));
  return denom ? sum(points.map(p=>(p[0]-x)*(p[1]-y)))/denom : 0;
}
export function summarize(raw) {
  const p=raw?.properties?.parameter;
  if(!p?.PRECTOTCORR || !p?.T2M || !p?.T2M_MAX) throw new Error('NASA response is missing required climate parameters.');
  const fill=raw.header?.fill_value ?? -999;
  const all=Object.keys(p.PRECTOTCORR).sort().map(date=>({date,year:+date.slice(0,4),month:+date.slice(4,6),rain:p.PRECTOTCORR[date],temp:p.T2M[date],max:p.T2M_MAX[date],wet:p.GWETROOT?.[date]}));
  const calendarYears=[...new Set(all.map(d=>d.year))];
  const annual=calendarYears.map(year=>{
    const days=all.filter(d=>d.year===year), rains=days.filter(d=>valid(d.rain,fill)), temps=days.filter(d=>valid(d.temp,fill)), highs=days.filter(d=>valid(d.max,fill));
    const expected=yearLength(year);
    return {year,rain:sum(rains.map(d=>d.rain)),temp:mean(temps.map(d=>d.temp)),peak:highs.length?Math.max(...highs.map(d=>d.max)):null,hot:highs.filter(d=>d.max>35).length,complete:rains.length===expected&&temps.length===expected&&highs.length===expected};
  }).filter(d=>d.complete);
  // A rotation year runs June to May; incomplete boundary years are excluded.
  const rotations=calendarYears.map(year=>({year,seasons:SEASONS.map((season,i)=>{
    const days=all.filter(d=>season.months.includes(d.month) && d.year===(i===2||d.month===1?year+1:year));
    const expected=i===2 ? ((year+1)%4===0 && ((year+1)%100!==0||(year+1)%400===0)?121:120):season.days;
    let run=0,dry=0;
    for(const day of days){run=valid(day.rain,fill)&&day.rain<1?run+1:0;dry=Math.max(dry,run);}
    const complete=days.length===expected && days.every(d=>valid(d.rain,fill)&&valid(d.temp,fill)&&valid(d.max,fill));
    return {rain:sum(days.filter(d=>valid(d.rain,fill)).map(d=>d.rain)),temp:mean(days.filter(d=>valid(d.temp,fill)).map(d=>d.temp)),max:Math.max(...days.filter(d=>valid(d.max,fill)).map(d=>d.max)),hot:days.filter(d=>valid(d.max,fill)&&d.max>35).length,wet:mean(days.filter(d=>valid(d.wet,fill)).map(d=>d.wet)),dry,complete,days};
  })})).filter(y=>y.seasons.every(s=>s.complete));
  if(annual.length<3 || rotations.length<2) throw new Error('Not enough complete years returned. At least three calendar years are required.');
  const seasons=SEASONS.map((s,i)=>({...s,rain:mean(rotations.map(y=>y.seasons[i].rain)),rainStats:distribution(rotations.map(y=>y.seasons[i].rain)),temp:mean(rotations.map(y=>y.seasons[i].temp)),peak:Math.max(...rotations.map(y=>y.seasons[i].max)),hot:mean(rotations.map(y=>y.seasons[i].hot)),wet:mean(rotations.map(y=>y.seasons[i].wet).filter(v=>v!==null)),dry:mean(rotations.map(y=>y.seasons[i].dry))}));
  const missingDays=sum(calendarYears.map(year=>yearLength(year)-all.filter(d=>d.year===year&&valid(d.rain,fill)&&valid(d.temp,fill)&&valid(d.max,fill)).length));
  return {annual,rotations,seasons,rainStats:distribution(annual.map(y=>y.rain)),peak:Math.max(...annual.map(y=>y.peak)),rain:mean(annual.map(y=>y.rain)),temp:mean(annual.map(y=>y.temp)),hot:mean(annual.map(y=>y.hot)),wet:mean(all.filter(d=>valid(d.wet,fill)).map(d=>d.wet)),rainTrend:slope(annual.map(y=>[y.year,y.rain]))*10,tempTrend:slope(annual.map(y=>[y.year,y.temp]))*10,missingDays,raw};
}
export function scoreRotation(ids, climate, settings, scenario={rain:0,temp:0}) {
  const crops=ids.map(byId);
  if(crops.some(c=>!c)) throw new Error('Unknown crop.');
  const rainFactor=1+scenario.rain/100;
  const capture={sandy:0.65,loam:0.8,clay:0.75}[settings.soil]??0.8;
  const irrigation=Number(settings.irrigation)||0;
  const active=crops.filter(c=>c.water[1]>0).length;
  const yearly=climate.rotations.map(y=>{
    const parts=crops.map((crop,i)=>{
      const s=y.seasons[i];
      // Use rainfall only within the assumed crop's growth window, not after harvest.
      const days=s.days.slice(0,crop.days);
      const need=mean(crop.water)*(1+scenario.temp*0.04);
      const rain=sum(days.map(d=>d.rain))*rainFactor;
      const available=rain*capture+(crop.days?irrigation:0);
      const deficit=Math.max(0,need-available);
      const heat=days.length ? days.filter(d=>d.max+scenario.temp>crop.temp[1]).length/days.length:0;
      const temp=days.length?mean(days.map(d=>d.temp))+scenario.temp:s.temp+scenario.temp;
      const distance=Math.max(crop.temp[0]-temp,temp-crop.temp[1],0);
      const fit=crop.days?clamp(100-distance*12-heat*45):100;
      return {need,available,rain,deficit,water:need?clamp(available/need*100):100,climate:fit};
    });
    return {year:y.year,parts,deficit:sum(parts.map(p=>p.deficit)),rainCovered:parts.every(p=>p.rain*capture>=p.need),covered:parts.every(p=>p.deficit===0)};
  });
  const parts=crops.map((c,i)=>({crop:c,...Object.fromEntries(['need','rain','available','deficit','water','climate'].map(k=>[k,mean(yearly.map(y=>y.parts[i][k]))]))}));
  const adjacent=crops.reduce((n,c,i)=>n+(c.family!=='Rest'&&c.family===crops[(i+1)%3].family?1:0),0);
  const repeats=crops.length-new Set(ids).size;
  const phPenalty=settings.ph===''?0:mean(crops.map(c=>Math.max(c.ph[0]-Number(settings.ph),Number(settings.ph)-c.ph[1],0)*12));
  const soilPenalty=mean(crops.map(c=>c.soils.includes(settings.soil)?0:12));
  const soil=clamp(50+(crops.some(c=>c.legume)?25:0)+new Set(crops.filter(c=>c.family!=='Rest').map(c=>c.family)).size*8-adjacent*12-repeats*10-phPenalty-soilPenalty);
  const cover=mean(crops.map((c,i)=>c.days?(c.cover*Math.min(c.days,SEASONS[i].days)+25*Math.max(0,SEASONS[i].days-c.days))/SEASONS[i].days:c.cover));
  const scores={water:mean(parts.map(p=>p.water)),climate:mean(parts.map(p=>p.climate)),soil,cover,income:mean(crops.map(c=>c.income))};
  const w=settings.weights,denom=w.water+w.soil+w.income+w.risk;
  const score=denom?(scores.water*w.water+scores.soil*w.soil+scores.income*w.income+(scores.climate+scores.cover)/2*w.risk)/denom:mean(Object.values(scores));
  const gaps=yearly.map(y=>y.deficit).sort((a,b)=>a-b);
  return {ids,crops,parts,score,scores,yearly,active,need:sum(parts.map(p=>p.need)),deficit:mean(gaps),gapRange:[gaps[0],gaps.at(-1)],covered:yearly.filter(y=>y.covered).length,rainCovered:yearly.filter(y=>y.rainCovered).length,severe:yearly.filter(y=>y.deficit>100).length,adjacent,phPenalty,soilPenalty,feasible:crops.every((c,i)=>c.seasons.includes(i)&&c.days<=SEASONS[i].days)};
}
export function recommend(climate,settings,scenario={rain:0,temp:0}) {
  const baseline=scoreRotation(settings.rotation,climate,settings,scenario);
  const eligible=SEASONS.map((s,i)=>CROPS.filter(c=>c.seasons.includes(i)&&c.days<=s.days));
  // Exhaustively evaluate the bounded, season-eligible candidate set.
  const results=[];
  for(const a of eligible[0])for(const b of eligible[1])for(const c of eligible[2]){
    const ids=[a.id,b.id,c.id];
    if(new Set(ids).size===1 || ids.filter(id=>id==='fallow').length>1 || ids.join()===settings.rotation.join())continue;
    results.push(scoreRotation(ids,climate,settings,scenario));
  }
  results.sort((a,b)=>b.score-a.score||a.need-b.need);
  const best=results[0];
  const chosen=[baseline,best];
  const distance=(a,b)=>a.ids.filter((id,i)=>id!==b.ids[i]).length;
  // Keep the true weighted winner. Other categories prefer at least two changed
  // season slots from every already displayed plan, including the baseline.
  const pick=(compare)=>{
    const unique=results.filter(r=>chosen.every(c=>distance(r,c)>0));
    const diverse=unique.filter(r=>chosen.every(c=>distance(r,c)>=2));
    const pool=diverse.length?diverse:unique;
    const winner=[...pool].sort(compare)[0];
    if(!winner)throw new Error('Not enough distinct season-eligible plans.');
    const result={...winner,diversityRelaxed:!diverse.length};
    chosen.push(result);return result;
  };
  const alternate=pick((a,b)=>b.scores.water-a.scores.water||a.need-b.need||b.score-a.score);
  const soil=pick((a,b)=>b.scores.soil-a.scores.soil||b.scores.cover-a.scores.cover||b.score-a.score);
  const weather=pick((a,b)=>b.scores.climate-a.scores.climate||b.covered-a.covered||a.deficit-b.deficit||b.score-a.score);
  return {baseline,best,alternate,soil,climate:weather,count:results.length,scenario};
}
export function powerUrl(lat,lon) {
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Enter valid latitude (−90 to 90) and longitude (−180 to 180).');
  return 'https://power.larc.nasa.gov/api/temporal/daily/point?'+new URLSearchParams({parameters:'PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETROOT',community:'AG',latitude:lat,longitude:lon,start:'20060101',end:'20251231',format:'JSON','time-standard':'LST'});
}
