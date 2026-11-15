import i18next from './vendor/i18next.js';
export const LANGUAGES={en:'English',kn:'ಕನ್ನಡ',hi:'हिन्दी',ta:'தமிழ்',te:'తెలుగు',ml:'മലയാളം',mr:'मराठी'};
const resources={},records=new WeakMap(),attributes=new WeakMap();
let current='en',observer,queued=false,patterns=[];
export const language=()=>current;
export const locale=()=>current+'-IN';
export const number=(value,digits=0)=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):'—';
export const money=value=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value):'—';
export const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeZone:'UTC'}).format(d):'—';};
export function t(key,values={}){return i18next.t(key,{...values,defaultValue:key,escapeValue:false,interpolation:{escapeValue:false}});}
export function translateText(text){
  const key=text.trim().replace(/\s+/g,' ');if(!key||!/[A-Za-z]/.test(key))return text;
  if(i18next.exists(key))return text.replace(text.trim(),t(key));
  for(const {key:template,re,names} of patterns){
    const m=key.match(re);if(!m)continue;
    const seen={};if(names.some((name,i)=>{if(name in seen)return seen[name]!==m[i+1];seen[name]=m[i+1];return false;}))continue;
    const values=Object.fromEntries(names.map((name,i)=>[name,translateAtom(m[i+1])]));
    return text.replace(text.trim(),t(template,values));
  }
  const sentences=key.split(/(?<=[.!?])\s+(?=[A-Z])/);
  if(sentences.length>1){const translated=sentences.map(sentence=>translateSentence(sentence));if(translated.some((s,i)=>s!==sentences[i]))return text.replace(text.trim(),translated.join(' '));}
  return text;
}
function translateSentence(text){if(i18next.exists(text))return t(text);for(const {key,re,names} of patterns){const m=text.match(re);if(m)return t(key,Object.fromEntries(names.map((n,i)=>[n,translateAtom(m[i+1])])));}return text;}
function translateAtom(value){return i18next.exists(value)?t(value):value;}
function translateNode(node){
  if(node.nodeType===3){
    if(node.parentElement?.closest('script,style,[translate="no"],#location-name,.place-result-name,.place-result-context,.place-result-source'))return;
    const old=records.get(node),raw=old&&node.nodeValue===old.translated?old.raw:node.nodeValue;
    const translated=current==='en'?raw:translateText(raw);
    records.set(node,{raw,translated});if(node.nodeValue!==translated)node.nodeValue=translated;
  }else if(node.nodeType===1){
    for(const name of ['title','placeholder','aria-label','alt'])if(node.hasAttribute(name)){
      const saved=attributes.get(node)||{},old=saved[name],value=node.getAttribute(name),raw=old&&value===old.translated?old.raw:value;
      const translated=current==='en'?raw:translateText(raw);saved[name]={raw,translated};attributes.set(node,saved);
      if(value!==translated)node.setAttribute(name,translated);
    }
  }
}
export function translateDOM(root=document.body){
  observer?.disconnect();
  translateNode(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let node;while(node=walker.nextNode())translateNode(node);
  observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});
}
function compilePatterns(){
  patterns=Object.keys(resources.en?.translation||{}).filter(k=>k.includes('{{')&&k.replace(/\{\{\w+\}\}/g,'').trim()).map(key=>{
    const names=[];const parts=key.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
    const source=parts.map(p=>p.startsWith('{{')?(names.push(p.slice(2,-2)),'(.+?)'):p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
    return {key,names,re:new RegExp('^'+source+'$')};
  }).sort((a,b)=>b.key.length-a.key.length);
}
export async function changeLanguage(code){
  if(!LANGUAGES[code])return;
  await i18next.changeLanguage(code);current=code;document.documentElement.lang=code;
  const warning=document.getElementById('language-status');if(warning){warning.hidden=!!resources[code];warning.textContent=t('Language file unavailable. English is shown for missing text.');}
  try{localStorage.setItem('fieldshift-language',code);}catch{}
  translateDOM();document.dispatchEvent(new CustomEvent('fieldshift:language',{detail:code}));
}
export function localizeHTML(html){const doc=new DOMParser().parseFromString(html,'text/html');doc.documentElement.lang=current;translateDOM(doc.body);return '<!doctype html>'+doc.documentElement.outerHTML;}
export async function initLanguages(){
  await Promise.all(Object.keys(LANGUAGES).map(async code=>{try{const r=await fetch(`locales/${code}.json`);if(r.ok)resources[code]={translation:await r.json()};}catch{}}));
  await i18next.init({lng:'en',fallbackLng:'en',resources,keySeparator:false,nsSeparator:false,returnEmptyString:false,interpolation:{escapeValue:false}});
  compilePatterns();
  const label=document.createElement('label');label.className='language-control';label.innerHTML='<span>Language</span><select id="language" aria-label="Language">'+Object.entries(LANGUAGES).map(([code,name])=>`<option value="${code}" translate="no">${name}</option>`).join('')+'</select>';
  document.querySelector('.top-actions').prepend(label);
  const warning=document.createElement('p');warning.id='language-status';warning.hidden=true;warning.setAttribute('role','status');label.after(warning);
  let preferred='en';try{preferred=localStorage.getItem('fieldshift-language')||'en';}catch{}
  if(!LANGUAGES[preferred]||!resources[preferred])preferred='en';
  label.querySelector('select').value=preferred;
  observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;translateDOM();});});
  label.querySelector('select').addEventListener('change',e=>changeLanguage(e.target.value));
  await changeLanguage(preferred);
}
