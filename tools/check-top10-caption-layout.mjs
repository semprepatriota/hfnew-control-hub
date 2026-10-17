import { createWorker } from 'tesseract.js';
import { writeFile } from 'node:fs/promises';
import { locateCaptionWords } from '../src/modules/top10/caption-locator.mjs';
import { fixedHeadline } from '../src/modules/top10/headline.mjs';

const root='E:/HFNEW-TOP10-TOOLS/headline-verification';
const worker=await createWorker('eng',1,{cachePath:'E:/HFNEW-TOP10-TOOLS/ocr-cache'});
const results=[];
try {
  for (const rank of [10,9,8,7,6,5,4,3,1]) {
    const original=rank===1 ? 'Yo iniciando la vida fit' : 'When your husband insists on helping';
    const {data}=await worker.recognize(`${root}/scene-${String(rank).padStart(2,'0')}-2.jpg`,{}, {blocks:true});
    const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[])));
    const box=locateCaptionWords(words,original,270,480);
    if (!box) throw Error(`Caption not located: ${rank}; ${data.text}`);
    const text=rank===1 ? 'Eu comecando a vida fitness:' : 'Quando seu marido insiste em ajudar';
    results.push({rank,original,box,headline:fixedHeadline({enabled:true,text},box)});
    console.log(`SCENE_${rank}_OCR=OK ${JSON.stringify(box)}`);
  }
  await writeFile(`${root}/verified-caption-layout.json`,JSON.stringify(results,null,2));
} finally { await worker.terminate(); }
console.log('ACTUAL_CAPTION_LAYOUT=9/9');
