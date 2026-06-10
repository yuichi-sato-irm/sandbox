/* Playwright による自動通しプレイ
   使い方: node tools/playtest.js [選択肢index=0..3] [mobile]
   例:     node tools/playtest.js 1 mobile
   常に同じindexの選択肢を選んで最後まで進め、JSエラーの有無とエンディングを報告する。
   スクリーンショットを /tmp/pt_*.png に保存。 */
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  // グローバルインストールへのフォールバック
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

(async () => {
  const pickIdx = Number(process.argv[2] || 0);
  const mobile = process.argv.includes('mobile');
  const indexUrl = 'file://' + path.join(__dirname, '..', 'index.html');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1000, height: 760 },
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(indexUrl);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/pt_title.png' });
  await page.click('#btn-start');
  await page.waitForTimeout(2500); // 章タイトルカード

  let shotChoice = false;
  for (let i = 0; i < 600; i++) {
    if (!(await page.locator('#ending-screen').isHidden())) break;
    const choices = page.locator('.choice-btn');
    if (await page.locator('#choices').isVisible() && await choices.count() > 0) {
      if (!shotChoice) { shotChoice = true; await page.screenshot({ path: '/tmp/pt_choice.png' }); }
      const n = await choices.count();
      await choices.nth(Math.min(pickIdx, n - 1)).click();
    } else {
      await page.locator('#textbox').click();
    }
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/pt_ending.png' });

  console.log('ENDING:', await page.locator('#ending-title').textContent().catch(() => '(未到達)'));
  console.log('NOTES:', await page.locator('.note').count());
  console.log(errors.length ? errors.join('\n') : 'NO JS ERRORS');
  await browser.close();
  if (errors.length) process.exit(1);
})();
