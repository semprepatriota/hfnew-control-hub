async (page)=>{
  if (!page.url().startsWith('http://127.0.0.1:5184/')) throw Error('Loopback QA only');
  await page.getByRole('heading',{name:'TOP 10',exact:true}).waitFor();
  await page.evaluate(()=>{history.pushState({},'','/the-forge-max');dispatchEvent(new PopStateEvent('popstate'));});
  await page.waitForFunction(()=>document.querySelectorAll('.forge-max-extractor-scene').length===3);
  const video=page.locator('.forge-max-extractor-player-shell video');
  for (const [index,start,end] of [[0,0,32/30],[1,32/30,66/30],[2,66/30,94/30]]) {
    await page.locator('.forge-max-extractor-scene').nth(index).click();
    await page.waitForFunction(({start,end})=>{
      const video=document.querySelector('.forge-max-extractor-player-shell video');
      return video.paused && video.currentTime>start+.1 && video.currentTime<end;
    },{start,end});
    const stop=await video.evaluate(video=>video.currentTime);
    if (Math.floor(stop*30)!==Math.round(end*30)-1) throw Error('Preview did not freeze on its last selected frame');
    await video.screenshot({path:`E:/HFNEW-FORGE-MAX-PRECISION/preview-scene-${index+1}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Mobile overflow');
  console.log('SCENE_PREVIEW_STOP=3/3_LAST_FRAME; MOBILE=OK');
}
