async page => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1100});
  await page.goto('http://127.0.0.1:4187/tools/top10-preview.html');
  const off=page.getByRole('button',{name:'Sem contadores',exact:true});
  const on=page.getByRole('button',{name:'Com contadores',exact:true});
  await off.waitFor();
  const check=async(value,expected)=>{
    await page.waitForFunction(value=>document.querySelector(`.t10-format button:nth-child(${value?1:2})`)?.getAttribute('aria-pressed')==='true',value);
    if(await page.locator('.t10-timeline button.scene').count()!==10) throw new Error('Missing scene cards');
    if(await page.locator('.t10-timeline button.counter').count()!==expected) throw new Error('Wrong number of counters');
    await page.getByText('Salvo',{exact:true}).first().waitFor();
  };
  await check(false,0);
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await page.waitForTimeout(400);
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/no-counters/desktop.png',fullPage:true});
  await on.click();await check(true,10);
  await off.click();await check(false,0);
  await page.reload();await off.waitFor();await check(false,0);
  await page.locator('.t10-timeline button[title="Cena 1 · 0.40s"]').click();
  await page.waitForTimeout(500);
  if(!await page.locator('.t10-timeline button[title="Cena 1 · 0.40s"]').evaluate(el=>el.classList.contains('active')))
    throw new Error('Selected scene was not sought');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/no-counters/mobile.png',fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) throw new Error('Mobile overflow');
  if(errors.length) throw new Error(errors.join('; '));
  console.log('TOP10_NO_COUNTERS_UI=OK');
}
