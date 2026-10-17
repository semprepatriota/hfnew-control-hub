import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyHeadline, headlineImage, headlineStyle } from '../src/modules/top10/headline.mjs';
import { emptyScene, swapScenes } from '../src/modules/top10/timeline.mjs';
test('scene headlines are optional, independent and move with their scene', () => {
  const scenes = Array.from({length:10}, emptyScene);
  assert.ok(scenes.every(s=>!s.headline.enabled));
  scenes[0].headline.text='Primeira cena'; scenes[0].headline.enabled=true;
  assert.equal(scenes[1].headline.text,'');
  const next=swapScenes({scenes},0,3);
  assert.equal(next.scenes[3].headline.text,'Primeira cena');
  assert.equal(next.scenes[0].headline.enabled,false);
});
test('preview uses the saved render PNG only when all painting settings match', () => {
  const headline={...emptyHeadline(),enabled:true,text:'Comedia',x:.9,y:.9,width:.8,height:.2};
  const settings=Object.fromEntries(['text','width','height','font_size','color','background','opacity','cover_original'].map(k=>[k,headline[k]]));
  const project={scene_headlines:{'2':{url:'shared.png',settings}}};
  assert.equal(headlineImage(project,2,{headline}).url,'shared.png');
  assert.equal(headlineImage(project,0,{headline}),null);
  assert.equal(headlineImage(project,2,{headline:{...headline,enabled:false}}),null);
  assert.equal(headlineImage(project,2,{headline:{...headline,text:'Outro'}}),null);
  assert.ok(parseFloat(headlineStyle(headline).left)<21);
  assert.equal(headlineStyle(headline).top,'80%');
});
test('generation is an explicit per-scene POST and cannot run from load or render', () => {
  const page=readFileSync(new URL('../src/modules/top10/Top10.jsx',import.meta.url),'utf8');
  assert.match(page,/onGenerate=\{\(\)=>generateHeadline\(slot\)\}/);
  assert.equal((page.match(/api\.generateSceneHeadline\(/g)||[]).length,1);
  const api=readFileSync(new URL('../src/modules/top10/api.js',import.meta.url),'utf8');
  assert.match(api,/generate-headline/); assert.match(api,/retries: 0/);
});
