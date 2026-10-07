const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '../../tmp/gradient-comparison-qa/node_modules/playwright');
const root=path.resolve(__dirname,'..'),port=8780,base=`http://127.0.0.1:${port}/striker-game/`;
const server=spawn('python',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:path.dirname(root),stdio:'ignore',windowsHide:true});
(async()=>{
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'tools/seven-stage-art.html');
  const art=await page.locator('img').evaluateAll(images=>images.map(img=>({loaded:img.complete&&img.naturalWidth>0,src:img.getAttribute('src')})));
  assert.equal(art.length,8);assert.ok(art.every(a=>a.loaded));
  await page.screenshot({path:path.resolve(root,'../output/striker-seven-qa/art-gallery.png'),fullPage:true});
  await page.goto(base+'tools/boss-patterns.html?manual=1');
  await page.waitForFunction(()=>window.PatternPreview);
  for(const mode of ['easy','hard'])for(let stage=0;stage<7;stage++)for(let phase=1;phase<=3;phase++){
   const result=await page.evaluate(async({mode,stage,phase})=>{
    await PatternPreview.change(stage,phase,mode);PatternPreview.tick(600);return PatternPreview.stats();
   },{mode,stage,phase});
   assert.equal(result.stage,stage+1);assert.equal(result.phase,phase);assert.equal(result.mode,mode);
   assert.ok(result.emitted>0 && result.finite && result.shots<=240);
  }
  await page.screenshot({path:path.resolve(root,'../output/striker-difficulty-qa/pattern-preview.png'),fullPage:true});
  await page.locator('#phaseButtons [data-phase="2"]').click();
  await page.waitForFunction(()=>PatternPreview.stats().phase===2);
  await page.locator('#modeButtons [data-mode="easy"]').click();
  await page.waitForFunction(()=>PatternPreview.stats().mode==='easy');
  await page.locator('#stageSelect').selectOption('4');
  await page.waitForFunction(()=>PatternPreview.stats().stage===5);
  await page.locator('#togglePlay').click();assert.equal(await page.locator('#togglePlay').textContent(),'계속 보기');
  await page.locator('#togglePlay').click();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'preview has no narrow-screen horizontal overflow');
  await page.setViewportSize({width:1280,height:1000});
  console.log('PASS 42 mode/phase previews and actual selector/pause controls');
  for(const scene of ['lancerburst&f=65','damage','ending&back=1']){
   await page.goto(base+'__beam_art_review.html?scene='+scene);
   await page.waitForFunction(()=>document.querySelector('#TESTOUT').textContent.includes('DONE'),null,{timeout:30000});
   const result=await page.locator('#TESTOUT').textContent();
   assert.ok(!/RUN ERROR|FAIL:/.test(result),result);
   assert.ok(result.includes('errors=0'),result);
   console.log('PASS review '+scene);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS new gallery images and regenerated development preview.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
