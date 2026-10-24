async page => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1080,height:1920});
  await page.goto('http://127.0.0.1:4187/tools/top10-cta-preview.html');
  await page.waitForFunction(()=>!!window.top10CtaQa);
  await page.evaluate(()=>window.top10CtaQa.seek(130));
  await page.waitForFunction(()=>document.querySelector('[data-top10-cta]') && [...document.querySelectorAll('img')].every(img=>img.complete && img.naturalWidth>0));
  await page.waitForTimeout(1200);
  await page.evaluate(async()=>{
    const project=window.top10CtaQa.project();
    const video=document.createElement('video');
    video.id='render-qa'; video.muted=true; video.crossOrigin='anonymous';
    video.style.cssText='position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:10;display:none';
    const ready=new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=reject;});
    video.src=new URL(project.last_render.url,'http://127.0.0.1:9016').href;
    document.body.append(video); await ready;
  });
  for(const frame of [60,75,82,85,100,118,130,164,180]) {
    await page.evaluate(frame=>window.top10CtaQa.seek(frame),frame);
    await page.waitForTimeout(600);
    await page.screenshot({path:`E:/HFNEW-TOP10-TOOLS/headline-cta/preview-${frame}.png`});
    await page.evaluate(async frame=>{
      const video=document.getElementById('render-qa');video.style.display='block';
      const ready=new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
      video.currentTime=(frame+.1)/30;await ready;
    },frame);
    await page.waitForTimeout(120);
    await page.screenshot({path:`E:/HFNEW-TOP10-TOOLS/headline-cta/browser-render-${frame}.png`});
    await page.evaluate(()=>document.getElementById('render-qa').style.display='none');
  }
  if(errors.length) throw new Error(errors.join('; '));
  console.log('TOP10_CTA_PREVIEW=OK');
}
