const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../tmp/gradient-comparison-qa/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, '../output/striker-mobile-pause-qa');
const port = Number(process.env.STRIKER_PAUSE_QA_PORT || 8789);
const url = `http://127.0.0.1:${port}/striker-game/`;
fs.mkdirSync(output, { recursive: true });
const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: path.dirname(root), stdio: 'ignore', windowsHide: true
});

const hooks = `
window.__pauseQA = {
  G, P, newGame, startStage, pauseGame, resumeGame, toTitle,
  killBoss, eShot,
  audio: { pauses:0, resumes:0 },
  bullets: () => pBullets.length, enemies: () => enemies.length, boss: () => boss,
  forceBoss() { boss = Bosses.create(stage().boss, G.stageIndex, mode()); boss.x = W / 2; boss.y = boss.entryY; boss.state = 'fight'; return boss; },
  now: 1000,
  step(n) { for (let i = 0; i < n; i++) { this.now += 1000 / 60; loop(this.now); } },
  elapse(ms) { this.now += ms; loop(this.now); },
  snapshot() { return { state:G.state, remaining:G.resumeRemaining, time:G.stageTime, score:G.score,
    x:P.x, y:P.y, charge:P.charge, bombs:P.bombs, bullets:pBullets.length,
    enemies:enemies.length, dying:boss && boss.dying, bgmResumes:this.audio.resumes,
    enemyBullet: eBullets.length ? { x:eBullets[0].x, y:eBullets[0].y } : null }; }
};
const qaBgmPause=Snd.bgmPause,qaBgmResume=Snd.bgmResume;
Snd.bgmPause=function(...args){window.__pauseQA.audio.pauses++;return qaBgmPause(...args);};
Snd.bgmResume=function(...args){window.__pauseQA.audio.resumes++;return qaBgmResume(...args);};`;

function stable(before, after) {
  for (const key of ['time', 'score', 'x', 'y', 'charge', 'bombs', 'bullets', 'enemies', 'dying', 'bgmResumes']) {
    assert.equal(after[key], before[key], key + ' changes during resume countdown');
  }
  assert.deepEqual(after.enemyBullet, before.enemyBullet, 'enemy bullet moves during resume countdown');
}

(async () => {
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(url)).ok) break; } catch (err) { /* server starting */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const source = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
    assert.ok(source.includes('  boot();'));

    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktop.newPage();
    const desktopErrors = [];
    desktopPage.on('pageerror', error => desktopErrors.push(error.message));
    await desktopPage.route('**/js/game.js', route => route.fulfill({ contentType: 'application/javascript', body: source.replaceAll('requestAnimationFrame(loop);', '/* manual pause QA */').replace('  boot();', hooks + '\n  boot();') }));
    await desktopPage.goto(url);
    await desktopPage.waitForFunction(() => window.__pauseQA?.G.state === 'title');
    await desktopPage.locator('#btnStart').click();
    await desktopPage.keyboard.press('p');
    await desktopPage.evaluate(() => window.__pauseQA.step(1));
    assert.equal(await desktopPage.evaluate(() => window.__pauseQA.G.state), 'pause', 'keyboard pauses desktop game');
    await desktopPage.locator('#btnResume').click();
    assert.equal(await desktopPage.evaluate(() => window.__pauseQA.G.state), 'resume', 'desktop resume starts countdown');
    assert.equal(await desktopPage.locator('#resumeCountdown').textContent(), '3');
    await desktopPage.keyboard.press('p');
    await desktopPage.evaluate(() => window.__pauseQA.step(1));
    assert.equal(await desktopPage.evaluate(() => window.__pauseQA.G.state), 'pause', 'keyboard pauses an active countdown');
    assert.ok(await desktopPage.locator('#resumeCountdown').evaluate(el => el.classList.contains('hidden')));
    await desktopPage.locator('#btnResume').click();
    await desktopPage.evaluate(() => window.__pauseQA.step(180));
    assert.equal(await desktopPage.evaluate(() => window.__pauseQA.G.state), 'play', 'desktop countdown resumes after three seconds');
    await desktopPage.evaluate(()=>{const q=window.__pauseQA;q.pauseGame();q.resumeGame();q.elapse(1500);});
    assert.equal(await desktopPage.evaluate(()=>window.__pauseQA.G.state),'resume');
    assert.equal(await desktopPage.locator('#resumeCountdown').textContent(),'2','countdown follows elapsed time on slow frames');
    await desktopPage.evaluate(()=>window.__pauseQA.elapse(1500));
    assert.equal(await desktopPage.evaluate(()=>window.__pauseQA.G.state),'play','slow frames still resume after three real seconds');
    assert.deepEqual(desktopErrors, []);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await mobile.newPage();
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failed.push(response.status() + ' ' + response.url()); });
    await page.route('**/js/game.js', route => route.fulfill({ contentType: 'application/javascript', body: source.replaceAll('requestAnimationFrame(loop);', '/* manual pause QA */').replace('  boot();', hooks + '\n  boot();') }));
    await page.goto(url);
    await page.waitForFunction(() => window.__pauseQA?.G.state === 'title');
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => !document.querySelector('#btnPause').classList.contains('hidden'));
    assert.equal(await page.locator('#btnPause').getAttribute('aria-hidden'), 'false');
    const pauseBox = await page.locator('#btnPause').boundingBox();
    const canvasBox = await page.locator('#game').boundingBox();
    assert.ok(pauseBox.x > canvasBox.x + canvasBox.width * .7 && pauseBox.y < canvasBox.y + canvasBox.height * .18, 'pause button stays in the top-right safe area');

    await page.locator('#game').dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: 170, clientY: 600 });
    await page.locator('#game').dispatchEvent('pointermove', { pointerId: 11, pointerType: 'touch', clientX: 230, clientY: 545 });
    await page.locator('#btnCharge').dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch' });
    await page.evaluate(() => window.__pauseQA.step(10));
    const moving = await page.evaluate(() => window.__pauseQA.snapshot());
    assert.ok(moving.charge > 0 && moving.bullets > 0, 'drag and charge can run before pause');
    await page.evaluate(() => {
      const q = window.__pauseQA, boss = q.forceBoss();
      q.killBoss(); q.step(10);
      q.eShot(boss.x, boss.y + 80, 0, 130, 'eSmall');
    });
    assert.ok(await page.evaluate(() => window.__pauseQA.boss().dying > 0), 'boss destruction is active before pausing');
    await page.locator('#btnPause').click();
    await page.evaluate(() => window.__pauseQA.step(1));
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'pause', 'touch pause stops an active drag and charge');
    await page.locator('#btnResume').click();
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'resume');
    assert.equal(await page.locator('#resumeCountdown').textContent(), '3');
    await page.screenshot({ path: path.join(output, 'mobile-countdown-3.png') });
    const frozen = await page.evaluate(() => window.__pauseQA.snapshot());
    assert.ok(frozen.enemyBullet, 'an actual enemy bullet exists during the countdown');
    await page.evaluate(() => window.__pauseQA.step(60));
    const afterOne = await page.evaluate(() => window.__pauseQA.snapshot());
    stable(frozen, afterOne);
    assert.equal(afterOne.state, 'resume');
    assert.equal(await page.locator('#resumeCountdown').textContent(), '2');
    await page.evaluate(() => window.__pauseQA.step(60));
    assert.equal(await page.locator('#resumeCountdown').textContent(), '1');
    await page.evaluate(() => window.__pauseQA.step(60));
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'play');
    assert.equal(await page.evaluate(() => window.__pauseQA.audio.resumes), frozen.bgmResumes + 1, 'BGM resumes exactly once after countdown');
    assert.ok(await page.locator('#btnPause').isVisible(), 'mobile pause control returns after countdown');

    await page.locator('#btnPause').click();
    await page.evaluate(() => window.__pauseQA.step(1));
    await page.locator('#btnResume').click();
    assert.ok(await page.locator('#btnPause').isVisible(), 'touch pause stays available during the countdown');
    await page.locator('#btnPause').click();
    await page.evaluate(() => window.__pauseQA.step(1));
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'pause', 'touch pause cancels an active countdown');
    assert.ok(await page.locator('#resumeCountdown').evaluate(el => el.classList.contains('hidden')));
    await page.locator('#btnResume').click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'pause', 'visibility interruption cancels countdown back to pause');
    assert.equal(await page.evaluate(() => window.__pauseQA.G.resumeRemaining), 0);
    assert.ok(await page.locator('#resumeCountdown').evaluate(el => el.classList.contains('hidden')));

    await page.locator('#btnResume').click();
    await page.evaluate(() => window.__pauseQA.toTitle());
    assert.equal(await page.evaluate(() => window.__pauseQA.G.state), 'title', 'title navigation cancels countdown');
    assert.equal(await page.evaluate(() => window.__pauseQA.G.resumeRemaining), 0);
    assert.ok(await page.locator('#resumeCountdown').evaluate(el => el.classList.contains('hidden')));
    assert.ok(await page.locator('#scTitle').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'narrow mobile layout has no horizontal overflow');
    await page.screenshot({ path: path.join(output, 'mobile-title-after-cancel.png') });
    for(const viewport of [{width:320,height:568},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      await page.evaluate(()=>window.__pauseQA.newGame());
      const canvas=await page.locator('#game').boundingBox(),button=await page.locator('#btnPause').boundingBox();
      assert.ok(button.x>=canvas.x&&button.x+button.width<=canvas.x+canvas.width&&button.y+button.height<=canvas.y+canvas.height,'pause button stays within '+viewport.width+'x'+viewport.height);
      assert.ok(button.y>=canvas.y+canvas.height*96/720,'pause control does not cover boss HUD');
      await page.locator('#btnPause').focus();await page.keyboard.press('Enter');
      await page.evaluate(()=>window.__pauseQA.step(1));
      assert.equal(await page.evaluate(()=>window.__pauseQA.G.state),'pause','pause button supports keyboard activation');
      await page.locator('#btnResume').click();
      assert.equal(await page.evaluate(()=>window.__pauseQA.G.state),'resume');
      const resumePause=await page.locator('#btnPause').boundingBox(),heading=await page.locator('#scPause h2').boundingBox();
      assert.ok(resumePause.y+resumePause.height<=heading.y||resumePause.x>=heading.x+heading.width,'countdown control does not obscure pause heading');
      await page.screenshot({path:path.join(output,`mobile-countdown-${viewport.width}x${viewport.height}.png`)});
      await page.evaluate(()=>window.__pauseQA.toTitle());
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, desktop: 'keyboard pause and 3-second resume', mobile: 'touch pause, drag/charge reset, frozen countdown, repeat pause, visibility and title cancellation', errors, failed }, null, 2));
    console.log('PASS desktop keyboard and touch pause, 3-2-1 freeze with active bullets/destruction, BGM timing, slow frames, input reset, cancellations and portrait/landscape layouts.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
