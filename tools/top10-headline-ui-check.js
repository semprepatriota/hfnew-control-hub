async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:5184/')) throw Error('Loopback QA only');
  let generated = 0;
  await page.route('**/__qa-caption.jpg',route=>route.fulfill({path:'E:/HFNEW-TOP10-TOOLS/headline-verification/translation-source-frame.jpg',contentType:'image/jpeg'}));
  await page.route('**/api/top10/projects/*/scenes/*/generate-headline', route => {
    generated++;
    return route.fulfill({json:{headline:'Ele confiou demais no plano. Voce faria igual?',original_text:'When your husband insists on helping',translation:'Quando seu marido insiste em ajudar',text_found:true,box:{x:.06,y:0,width:.88,height:.4},reference_frame_url:'http://127.0.0.1:5184/__qa-caption.jpg',generated:true,sampled_frames:3}});
  });
  const editor = page.locator('.t10-scene-headline').first();
  if (!await editor.locator('details').first().evaluate(element=>element.open)) await editor.locator('summary').first().click();
  await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).uncheck();
  await editor.getByRole('button',{name:'Hook + CTA',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.t10-scene-generate').disabled);
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Headline da cena 10"]').value.startsWith('Quando seu marido'));
  if (await editor.locator('input[type=range],input[type=color]').count()) throw Error('Manual adjustments are still present');
  if (await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).isChecked()) throw Error('Generation enabled headline automatically');
  await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).check();
  await page.waitForFunction(()=>document.querySelector('.t10-scene-poster').querySelectorAll('img').length===2);
  await page.getByRole('button',{name:'Editar cena 10',exact:true}).click();
  await page.locator('.t10-stage img[src*="headline_"]').waitFor();
  const cover=page.locator('.t10-stage img[src*="headline_"]').first();
  const y=await cover.evaluate(image=>parseFloat(image.style.top)*(image.style.top.endsWith('%') ? 1 : 100/1920));
  if (y<15 || y>18) throw Error('Real OCR did not replace the deliberately incorrect AI position');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/headline-verification/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Mobile overflow');
  await page.screenshot({path:'E:/HFNEW-TOP10-TOOLS/headline-verification/mobile.png',fullPage:true});
  if (!await editor.locator('.t10-caption-reading').evaluate(element=>element.open)) await editor.locator('.t10-caption-reading summary').click();
  await editor.getByRole('button',{name:'Usar tradução',exact:true}).click();
  if (await editor.getByRole('textbox',{name:'Headline da cena 10',exact:true}).inputValue()!=='Quando seu marido insiste em ajudar') throw Error('Translation was not applied');
  if (generated!==1) throw Error('Unexpected automatic or duplicate generation');
  await editor.getByRole('checkbox',{name:'Usar headline',exact:true}).uncheck();
}
