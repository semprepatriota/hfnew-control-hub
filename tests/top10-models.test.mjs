import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODELS, buildTimeline, emptyScene } from '../src/modules/top10/timeline.mjs';

test('three new counter sets are selectable without removing the two existing models',()=>{
  assert.deepEqual(MODELS.map(model=>model.id),['pink3d','film','comic_pop','aqua_badge','space_blue']);
  const project={assets:{scene:{duration:1}}};
  for (const model of MODELS) {
    const config={model:model.id,scenes:Array.from({length:10},()=>({...emptyScene(),asset_id:'scene',end:1}))};
    const timeline=buildTimeline(project,config);
    assert.equal(timeline.length,20);
    assert.deepEqual(timeline.filter(item=>item.kind==='counter').map(item=>item.rank),[10,9,8,7,6,5,4,3,2,1]);
    for (const item of timeline.filter(item=>item.kind==='counter')) assert.equal(item.frames,model.frames_by_rank?.[item.rank]||model.frames);
  }
});
test('real source mapping uses the corrected spatial 9 and 4 and does not duplicate the orange 5',()=>{
  const data=JSON.parse(readFileSync(new URL('../deploy/top10/backend/assets/top10/counters/imported-candidates-provenance.json',import.meta.url),'utf8'));
  for (const model of ['comic_pop','aqua_badge','space_blue']) assert.equal(Object.keys(data.models[model]).length,10);
  assert.match(data.models.space_blue['9'].source_file,/\(22\)\.mp4$/);
  assert.match(data.models.space_blue['4'].source_file,/\(21\)\.mp4$/);
  assert.match(data.models.comic_pop['5'].source_file,/\(10\)\.mp4$/);
  assert.match(data.omitted_duplicate,/\(11\)\.mp4$/);
});
