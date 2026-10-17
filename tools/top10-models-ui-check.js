async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:5184/')) throw Error('Loopback QA only');
  await page.waitForFunction(()=>document.querySelectorAll('.t10-models button').length===5);
  await page.waitForFunction(()=>[...document.querySelectorAll('.t10-models video')].every(video=>video.readyState>=2));
  const models=[['comic_pop','HQ Laranja'],['aqua_badge','Azul e Dourado'],['space_blue','Espacial Azul']];
  for (const [id,label] of models) {
    const button=page.getByRole('button',{name:label,exact:true});
    await button.click();
    await page.waitForFunction(label=>[...document.querySelectorAll('.t10-models button')].some(b=>b.textContent.trim()===label && b.getAttribute('aria-pressed')==='true'),label);
    const video=button.locator('video');
    const pixels=await video.evaluate(async source=>{
      const video=document.createElement('video');video.crossOrigin='anonymous';video.muted=true;
      const loaded=new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=reject;});
      video.src=source.src;await loaded;
      const sought=new Promise(resolve=>{video.onseeked=resolve;});video.currentTime=.5;await sought;
      const canvas=document.createElement('canvas');canvas.width=48;canvas.height=80;
      const context=canvas.getContext('2d');context.drawImage(video,0,0,48,80);
      const pixels=[...context.getImageData(0,0,48,80).data].filter((_,index)=>index%4!==3).reduce((sum,value)=>sum+value,0);
      video.removeAttribute('src');video.load();return pixels;
    });
    if (pixels<10000) throw Error(`Blank model preview: ${id}`);
    const saving=page.waitForResponse(response=>response.request().method()==='PUT' && response.url().includes('/api/top10/projects/') && response.status()===200);
    await page.getByRole('button',{name:'Salvar projeto',exact:true}).click();
    const saved=await (await saving).json();
    if (saved.config.model!==id) throw Error(`Wrong saved model: ${id}`);
  }
  const rangeResults=await page.evaluate(async()=>{
    const results=[];
    for (const model of ['comic_pop','aqua_badge','space_blue']) for (let rank=10;rank>=1;rank--) {
      const response=await fetch(`http://127.0.0.1:9014/api/top10/counters/${model}/${rank}.mp4`,{headers:{Range:'bytes=0-63'}});
      const bytes=await response.arrayBuffer();results.push({model,rank,status:response.status,size:bytes.byteLength});
    }
    return results;
  });
  if (rangeResults.some(result=>result.status!==206 || result.size!==64)) throw Error('A new counter cannot be streamed');
  for (const [width,height,name] of [[1440,1000,'desktop'],[390,844,'mobile']]) {
    await page.setViewportSize({width,height});
    if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Horizontal overflow');
    await page.screenshot({path:`E:/HFNEW-TOP10-TOOLS/new-counter-models/models-${name}.png`,fullPage:true});
  }
  console.log('FIVE_MODEL_CARDS=OK; NEW_MODEL_SELECTIONS=3/3; NEW_COUNTER_STREAMS=30/30; MOBILE=OK');
}
