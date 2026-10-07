const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '../../tmp/gradient-comparison-qa/node_modules/playwright');
const root=path.resolve(__dirname,'..'),port=8784,base=`http://127.0.0.1:${port}/striker-game/`;
const output=path.resolve(root,'../output/striker-ground-qa');fs.mkdirSync(output,{recursive:true});
const server=spawn('python',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:path.dirname(root),stdio:'ignore',windowsHide:true});
(async()=>{
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.status()+' '+r.url());});
  await page.goto(base+'tools/ground-art.html');
  await page.waitForFunction(()=>window.GroundArtPreview?.stats().ready);
  const art=await page.evaluate(()=>{
   return Object.entries(Assets.FRAMES.ground).filter(([key])=>!key.startsWith('s5-')).map(([key,frame])=>{
    const image=Assets.image(frame.key),body=Assets.body('ground',key,72),pixels=body.c.getContext('2d').getImageData(0,0,body.c.width,body.c.height).data;
    let clear=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)opaque++;}
    return {key,src:image.src,width:image.width,clear,opaque,pivot:[body.px,body.py]};
   });
  });
  assert.equal(art.length,9);
  for(const item of art){assert.match(item.src,/-imagegen-v1\.webp$/);assert.equal(item.width,384);assert.ok(item.clear>100&&item.opaque>30,item.key+' has genuine transparent and painted pixels');assert.ok(item.pivot.every(Number.isFinite));}
  const layers=await page.locator('#layers img').evaluateAll(images=>images.map(i=>i.complete&&i.naturalWidth===384));
  assert.equal(layers.length,9);assert.ok(layers.every(Boolean));
  await page.locator('#togglePlay').click();
  const paused=await page.evaluate(()=>GroundArtPreview.stats().time);await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>GroundArtPreview.stats().time),paused);
  const before=await page.locator('#preview').screenshot();
  await page.locator('#preview').click({position:{x:55,y:95}});
  const after=await page.locator('#preview').screenshot();
  assert.ok(!before.equals(after),'pointer changes the aiming preview');
  const rotationPixels=await page.evaluate(()=>{
   const canvas=document.getElementById('preview'),ctx=canvas.getContext('2d');
   const result=['aa','tank','radar'].map(key=>{
    ctx.clearRect(0,0,480,600);GroundArtPreview.drawStructure(Stages.GROUND[key],240,250,140,0);
    const a=ctx.getImageData(130,140,220,220).data;
    ctx.clearRect(0,0,480,600);GroundArtPreview.drawStructure(Stages.GROUND[key],240,250,140,Math.PI/2);
    const b=ctx.getImageData(130,140,220,220).data;
    let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
    return {key,changed};
   });GroundArtPreview.render();return result;
  });
  assert.ok(rotationPixels.every(item=>item.changed>100),'all three separate upper layers visibly rotate');
  for(let i=0;i<7;i++){
   await page.locator('#stageSelect').selectOption(String(i));
   await page.waitForFunction(i=>GroundArtPreview.stats().ready&&GroundArtPreview.stats().stage===i+1,i);
  }
  await page.locator('#stageSelect').selectOption('1');
  await page.waitForFunction(()=>GroundArtPreview.stats().ready&&GroundArtPreview.stats().stage===2);
  await page.screenshot({path:path.join(output,'ground-gallery.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'preview fits narrow screens');
  await page.screenshot({path:path.join(output,'ground-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:1000});
  const source=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
  const hooks=`window.__groundQA={G,P,newGame,startStage,spawnGround,damageGround,updateGround,render,grounds:()=>grounds,shots:()=>eBullets,items:()=>items};`;
  await page.route('**/js/game.js',route=>route.fulfill({contentType:'application/javascript',body:source.replaceAll('requestAnimationFrame(loop);','/* manual ground QA */').replace('  boot();',hooks+'\n  boot();')}));
  await page.goto(base);
  await page.waitForFunction(()=>window.__groundQA?.G.state==='title');
  const gameplay=await page.evaluate(async()=>{
   const q=window.__groundQA;await Promise.all(Stages.STAGES.map(st=>Assets.loadBg(st.bg)));q.newGame();q.startStage(1,false);q.P.inv=99999;
   const aa=q.spawnGround({type:'aa',x:.2}),tank=q.spawnGround({type:'tank',x:.5}),radar=q.spawnGround({type:'radar',x:.8});
   aa.y=tank.y=radar.y=150;q.P.x=450;q.P.y=550;
   const expectedAim=Math.atan2(q.P.y-aa.y-Stages.STAGES[1].scroll*.1,q.P.x-aa.x)+Math.PI/2;
   q.updateGround(.1);const aimed=Math.abs(aa.ang-expectedAim)<.0001,spin=radar.ang===.17,drift=tank.x!==240;
   aa.fireCt=0;q.updateGround(.1);const fired=q.shots().length>0;
   const fuel=q.spawnGround({type:'fuel',x:.4}),victim=q.spawnGround({type:'aa',x:.5,drop:'power'});fuel.y=victim.y=330;
   const score=q.G.score;q.damageGround(fuel,fuel.hp);const blast=fuel.dead&&victim.dead&&q.G.score>score&&q.items().some(i=>i.kind==='power'||i.kind==='life');
   q.startStage(1,false);q.G.titleCard=0;q.G.stageTime=20;
   ['aa','tank','bunker','radar','fuel','boat'].forEach((type,i)=>{const t=q.spawnGround({type,x:(80+i%3*160)/480});t.y=140+Math.floor(i/3)*185;t.ang=type==='radar'?.8:Math.PI;});
   q.render(1);return {aimed,spin,drift,fired,blast};
  });
  assert.ok(gameplay.aimed&&gameplay.spin&&gameplay.drift&&gameplay.fired&&gameplay.blast,JSON.stringify(gameplay));
  await page.locator('#game').screenshot({path:path.join(output,'ground-in-game.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({art,rotationPixels,gameplay,errors,failed},null,2));
  console.log('PASS nine ImageGen layers, alpha, aim and radar rotation, seven backgrounds, mobile preview, real firing, drift, damage, score, drops and fuel blast.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
