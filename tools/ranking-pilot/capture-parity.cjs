async (page) => {
  const root = 'E:/HFNEW-PILOTOS/ranking-multimidia/data';
  await page.setViewportSize({ width: 1080, height: 1920 });
  for (const [model, frames] of [['classic', [15, 90, 150, 359]], ['interludes', [15, 72, 99, 404]]]) {
    await page.goto(`http://127.0.0.1:4182/tools/ranking-pilot/index.html?verify=1&model=${model}`);
    await page.waitForFunction(() => window.rankingPilot && document.fonts.check('800 64px RankingMontserrat'));
    for (const frame of frames) {
      await page.evaluate(value => window.rankingPilot.seek(value), frame);
      await page.waitForFunction(value => window.rankingPilot.frame() === value, frame);
      await page.waitForTimeout(700);
      await page.getByTestId('preview-stage').screenshot({ path: `${root}/preview-${model}-${frame}.png` });
      const state = await page.evaluate(() => ({ frame: window.rankingPilot.frame(),
        labels: [...document.querySelectorAll('[data-rank]')].map(el => ({ rank: el.dataset.rank, revealed: el.dataset.revealed })),
        videos: [...document.querySelectorAll('video')].map(video => ({ ready: video.readyState, time: video.currentTime, width: video.videoWidth })) }));
      console.log(JSON.stringify({ model, ...state }));
    }
  }
}
