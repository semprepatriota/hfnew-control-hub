import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyHeadline, fixedHeadline, headlineImage, headlineStyle, needsHeadlineRefresh } from '../src/modules/top10/headline.mjs';
import { locateCaptionWords } from '../src/modules/top10/caption-locator.mjs';
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

test('fixed white and black format covers the original caption without manual sliders', () => {
  const box = {x:.1,y:.18,width:.8,height:.07};
  const h = fixedHeadline({...emptyHeadline(),enabled:true,text:'Quando seu marido insiste em ajudar',background:'#ff0000',font_size:120},box);
  assert.equal(h.width,1); assert.equal(h.x,0);
  assert.equal(h.font_size,64); assert.equal(h.background,'#ffffff'); assert.equal(h.color,'#000000');
  assert.equal(h.opacity,1); assert.ok(h.y < box.y); assert.ok(h.y+h.height > box.y+box.height);
  assert.equal(fixedHeadline(emptyHeadline(),box).enabled,false);
  assert.ok(fixedHeadline(emptyHeadline(),{...box,y:.99}).y+.13<=1);
  const component=readFileSync(new URL('../src/modules/top10/SceneHeadlineEditor.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(component,/type="(?:range|color)"/);
});

test('caption positioning requires matching real OCR words, not a guessed AI box or watermark', () => {
  const words=['When','your','husband','insists','on','helping'].map((text,i)=>({text,confidence:96,bbox:{x0:50+i*60,y0:178,x1:100+i*60,y1:245}}));
  const box=locateCaptionWords(words,'When your husband insists on helping');
  assert.equal(box.y,178/960); assert.equal(box.height,67/960);
  assert.equal(locateCaptionWords(words,'Fluffel'),null);
  assert.equal(locateCaptionWords(words.map(w=>({...w,confidence:10})),'When your husband insists on helping'),null);
  assert.equal(locateCaptionWords([],'\ud83d\ude02\ud83d\ude02'),null);
});

test('compact headline image upgrade is needed once, without changing text or requesting AI', () => {
  const headline = { ...emptyHeadline(), enabled: true, text: 'Quando seu marido insiste em ajudar' };
  const config = { scenes: [{ asset_id: 'video', headline }] };
  const project = { assets: { video: {} }, scene_headlines: { '0': { layout_version: 1 } } };
  const original = structuredClone(config);
  assert.equal(needsHeadlineRefresh(project, config), true);
  project.scene_headlines['0'].layout_version = 2;
  assert.equal(needsHeadlineRefresh(project, config), false);
  assert.deepEqual(config, original);
  delete project.scene_headlines['0'];
  headline.enabled = false;
  assert.equal(needsHeadlineRefresh(project, config), false);
});
