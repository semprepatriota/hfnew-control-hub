async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:5184/')) throw Error('Loopback QA only');
  let generated = 0;
  await page.route('**/api/top10/projects/*/scenes/*/generate-headline', route => {
    generated++;
    return route.fulfill({json:{headline:'Ele confiou demais no plano. Voce faria igual?',original_text:'Trust me, this will work',translation:'Confia em mim, vai dar certo',text_found:true,box:{x:.06,y:.09,width:.88,height:.12},generated:true,sampled_frames:3}});
  });
  const editor = page.locator('.t10-scene-headline').first();
  await editor.locator('summary').first().click();
  await editor.getByRole('button',{name:'Hook + CTA',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Headline da cena 10"]').value.startsWith('Confia em mim'));
  if (await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).isChecked()) throw Error('Generation enabled headline automatically');
  await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).check();
  await page.waitForFunction(()=>document.querySelector('.t10-scene-poster').querySelectorAll('img').length===2);
  await page.getByRole('button',{name:'Editar cena 10',exact:true}).click();
  await page.locator('.t10-stage img[src*="headline_"]').waitFor();
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/headline-verification/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Mobile overflow');
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/headline-verification/mobile.png',fullPage:true});
  await editor.locator('.t10-caption-reading summary').click();
  await editor.getByRole('button',{name:'Usar tradução',exact:true}).click();
  if (await editor.getByRole('textbox',{name:'Headline da cena 10',exact:true}).inputValue()!=='Confia em mim, vai dar certo') throw Error('Translation was not applied');
  if (generated!==1) throw Error('Unexpected automatic or duplicate generation');
  await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).uncheck();
}
