import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=code=>JSON.parse(readFileSync(new URL(`../dist/locales/${code}.json`,import.meta.url),'utf8'));
const base=read('en'),keys=Object.keys(base).sort(),slots=s=>[...s.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]).sort();
for(const code of ['en','kn','hi','ta','te','ml','mr']){
  const data=read(code);assert.deepEqual(Object.keys(data).sort(),keys,code+' key parity');
  for(const key of keys){assert.ok(typeof data[key]==='string'&&data[key].trim(),code+' empty '+key);assert.deepEqual(slots(data[key]),slots(key),code+' placeholders '+key);assert.doesNotMatch(data[key],/\{\{[^{}]*\{/,code+' malformed placeholder');}
}
console.log('Locale checks passed: seven complete catalogs, nonempty text and identical interpolation placeholders.');
