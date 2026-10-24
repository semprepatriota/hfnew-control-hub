async (page) => {
  const root = 'E:/HFNEW-PILOTOS/ranking-multimidia/data';
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('http://127.0.0.1:4182/tools/ranking-pilot/index.html');
  await page.waitForFunction(() => window.rankingPilot && document.fonts.check('800 64px RankingMontserrat'));
  const fixture = await (await page.request.get('http://127.0.0.1:4182/api/pilot/state')).json();
  await page.evaluate(presets => {
    for (const [name, project] of Object.entries(presets)) {
      localStorage.setItem(`hfnew:ranking-local-pilot:v1:${name}`, JSON.stringify(project));
    }
  }, fixture.presets);
  await page.reload();
  await page.waitForFunction(() => !!window.rankingPilot);
  await page.getByRole('radio', { name: /Clássico/ }).click();
  await page.waitForFunction(() => window.rankingPilot.project().model === 'classic');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const original = await page.evaluate(() => window.rankingPilot.project());
  await page.evaluate(() => window.rankingPilot.seek(150));
  await page.waitForFunction(() => document.querySelectorAll('[data-revealed=true]').length === 3);
  await page.screenshot({ path: `${root}/desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Ajustar cena 6', exact: true }).click();
  const ending = page.getByRole('spinbutton', { name: 'Fim (s)', exact: true });
  await ending.fill('1');
  await page.waitForFunction(() => window.rankingPilot.project().items[0].clips[0].endFrame === 30);
  await ending.fill('2');
  await page.getByRole('button', { name: 'Mover para baixo', exact: true }).click();
  await page.waitForFunction(() => window.rankingPilot.project().items[1].id === 'classic-1');
  await page.getByRole('button', { name: 'Mover para cima', exact: true }).click();
  await page.getByRole('button', { name: 'Assistir cena 3', exact: true }).click();
  await page.waitForFunction(() => window.rankingPilot.frame() > 185 && window.rankingPilot.frame() < 240);
  await page.waitForTimeout(2300);
  const stopped = await page.evaluate(() => window.rankingPilot.frame());
  if (stopped < 180 || stopped > 239) throw new Error('Selected scene did not stop at its own boundary: ' + stopped);
  await page.evaluate(data => localStorage.setItem('hfnew:ranking-local-pilot:v1:classic', JSON.stringify(data)), original);
  await page.reload();
  await page.waitForFunction(() => !!window.rankingPilot);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: `${root}/mobile-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error('Mobile horizontal overflow: ' + width);
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole('radio', { name: /Com vinhetas/ }).click();
  await page.waitForFunction(() => window.rankingPilot.project().model === 'interludes');
  await page.evaluate(() => window.rankingPilot.seek(72));
  await page.waitForFunction(() => document.querySelectorAll('[data-revealed=true]').length === 1);
  await page.screenshot({ path: `${root}/interlude-preview.png`, fullPage: true });
  await page.getByRole('button', { name: 'Ajustar cena 5', exact: true }).click();
  await page.getByRole('combobox', { name: 'Vinheta após a cena', exact: true }).selectOption('');
  await page.waitForFunction(() => window.rankingPilot.project().items[0].interlude === null);
  await page.getByRole('combobox', { name: 'Vinheta após a cena', exact: true }).selectOption('interlude-1');
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  console.log(JSON.stringify({ preview: 'OK', cuts: 'OK', reorder: 'OK', selectedScenePlayback: 'OK',
    interludes: 'OK', mobile: [390, 320], errors }));
}
