const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '../../tmp/gradient-comparison-qa/node_modules/playwright');
const root=path.resolve(__dirname,'..'),port=8785,base=`http://127.0.0.1:${port}/striker-game/`;
const output=path.resolve(root,'../output/striker-boss-destruction-qa-v3');fs.mkdirSync(output,{recursive:true});
const server=spawn('python',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:path.dirname(root),stdio:'ignore',windowsHide:true});

(async()=>{
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:920}}),page=await context.newPage(),errors=[],failed=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.status()+' '+r.url());});

  await page.goto(base+'tools/boss-destruction.html');
  await page.waitForFunction(()=>window.BossDestructionPreview?.stats().ready);
  for(let stage=1;stage<=7;stage++){
   await page.locator('#stageSelect').selectOption(String(stage-1));
   await page.waitForFunction(stage=>BossDestructionPreview.stats().ready&&BossDestructionPreview.stats().index===stage,stage);
   const state=await page.evaluate(()=>BossDestructionPreview.stats());
   assert.ok(state.effect&&state.boss,'preview stage '+stage+' creates the actual boss effect');
  }
  await page.locator('#togglePlay').click();const stopped=await page.evaluate(()=>BossDestructionPreview.stats().time);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>BossDestructionPreview.stats().time),stopped,'preview pause freezes timeline');
  await page.locator('#timeline').fill('180');assert.equal((await page.evaluate(()=>BossDestructionPreview.stats().time)).toFixed(1),'1.8');
  await page.locator('#replay').click();assert.ok((await page.evaluate(()=>BossDestructionPreview.stats().time))<.1,'replay resets timeline');
  await page.screenshot({path:path.join(output,'preview-stage7.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'preview has no narrow-screen overflow');await page.screenshot({path:path.join(output,'preview-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:920});

  const source=fs.readFileSync(path.join(root,'js/game.js'),'utf8');assert.ok(source.includes('  boot();'));
  const hooks=`
  window.__bossQA={G,P,newGame,startStage,pauseGame,resumeGame,damageBoss,render,boss:()=>boss,particles:()=>parts,
    forceBoss(i){startStage(i,false);G.titleCard=0;boss=Bosses.create(stage().boss,i,mode());boss.x=W/2;boss.y=boss.entryY;boss.state='fight';return boss;},
    setDeath(t){if(!boss||!boss.deathFx)throw new Error('death effect missing');boss.dying=t;BossDestruction.update(boss.deathFx,t);},
    saturate(){while(parts.length<MAX_PART)addParticle({type:'spark',cool:false,x:240,y:360,vx:0,vy:0,life:1,max:1,size:3});},
    now:1000,step(n){for(let i=0;i<n;i++){this.now+=1000/60;loop(this.now);}}
  };`;
  const game=await context.newPage(),gameErrors=[],gameFailed=[],gameRequests=[];
  game.on('pageerror',e=>gameErrors.push(e.message));game.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))gameFailed.push(r.status()+' '+r.url());});game.on('request',r=>gameRequests.push(r.url()));
  await game.route('**/js/game.js',route=>route.fulfill({contentType:'application/javascript',body:source.replaceAll('requestAnimationFrame(loop);','/* manual boss QA */').replace('  boot();',hooks+'\n  boot();')}));
  await game.goto(base);await game.waitForFunction(()=>window.__bossQA?.G.state==='title');
  const initialFxRequests=gameRequests.filter(u=>/boss-(heavy|reactor)|regent-damaged/.test(u));
  assert.ok(!gameRequests.some(u=>/boss-reactor-blast|regent-damaged/.test(u)),'initial load defers reactor and regent damaged assets');
  assert.ok(!gameRequests.some(u=>/s3-boss-damaged|canopy-boss-damaged/.test(u)),'initial load defers stage 3 and 4 damage artwork');
  assert.equal(gameRequests.filter(u=>u.endsWith('boss1-breakwater-damaged-v1.webp')).length,1,'stage 1 loads its own damage artwork');
  assert.ok(gameRequests.some(u=>u.endsWith('boss-heavy-blast-v3.webp')),'flame and smoke sheet is active');
  assert.ok(!gameRequests.some(u=>/boss-(heavy|reactor)-blast-v[12]/.test(u)),'previous sheets are not requested');
  const assetTiles=await game.evaluate(async()=>{
   await Promise.all(Stages.STAGES.map(s=>Assets.loadBg(s.bg)));
   return ['boss-heavy-blast','boss-reactor-blast'].map(key=>{const image=Assets.image(key),c=document.createElement('canvas'),g=c.getContext('2d'),tiles=[];c.width=Math.ceil(image.width/4);c.height=Math.ceil(image.height/4);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){g.clearRect(0,0,c.width,c.height);g.drawImage(image,x*image.width/4,y*image.height/4,image.width/4,image.height/4,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height).data;let visible=0,clear=0;for(let i=3;i<d.length;i+=4){if(d[i]>5)visible++;if(d[i]===0)clear++;}tiles.push({visible,clear});}return {key,width:image.width,height:image.height,tiles};});
  });
  for(const image of assetTiles){assert.equal(image.tiles.length,16);for(const tile of image.tiles)assert.ok(tile.visible>25&&tile.clear>25,image.key+' has real alpha content in every tile');}
  assert.ok(!gameRequests.some(u=>/boss-metal-debris/.test(u)),'removed flying debris is not downloaded');
  assert.equal(gameRequests.filter(u=>u.endsWith('boss-heavy-blast-v3.webp')).length,1,'shared flame sheet is requested once');
  assert.ok(gameRequests.some(u=>/boss-reactor-blast/.test(u))&&gameRequests.some(u=>/regent-damaged/.test(u)),'late stage background load requests reactor and regent damaged assets');
  for(const file of ['s3-boss-damaged-v1.webp','canopy-boss-damaged-v1.webp'])assert.equal(gameRequests.filter(u=>u.endsWith(file)).length,1,'dedicated artwork loads once: '+file);

  const damageCases=[{stage:0,kind:'boss1',width:330},{stage:2,kind:'boss3',width:340},{stage:3,kind:'bossCanopy',width:360}];
  const damageManifest=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-damage-imagegen-v1.json'),'utf8'));
  const independentDamage=[];
  for(let index=0;index<damageCases.length;index++){
   const spec={...damageCases[index],regions:damageManifest[index].regions};
   const metrics=await game.evaluate(spec=>{
    const shape=Bosses.create(Stages.STAGES[spec.stage].boss,spec.stage,Difficulty.get('easy')),base=Assets.body(spec.kind,'neutral',spec.width),g=base.c.getContext('2d'),original=g.getImageData(0,0,base.c.width,base.c.height).data;
    return Object.entries(spec.regions).map(([key,r])=>{
     const art=Assets.bossDamageBody(spec.kind,spec.width,shape.parts.map(p=>({...p,alive:p.key!==key}))),pixels=art.c.getContext('2d').getImageData(0,0,art.c.width,art.c.height).data;
     const rect=[Math.floor(4+r[0]*base.w),Math.floor(4+r[1]*base.h),Math.ceil(4+(r[0]+r[2])*base.w),Math.ceil(4+(r[1]+r[3])*base.h)];
     let inside=0,outside=0;
     for(let y=0;y<base.c.height;y++)for(let x=0;x<base.c.width;x++){
      const at=(y*base.c.width+x)*4;if(![0,1,2,3].some(n=>original[at+n]!==pixels[at+n]))continue;
      if(x>=rect[0]&&x<rect[2]&&y>=rect[1]&&y<rect[3])inside++;else outside++;
     }
     return {stage:spec.stage+1,key,inside,outside};
    });
   },spec);
   for(const metric of metrics){assert.ok(metric.inside>100,'destroyed module has dedicated damage pixels '+JSON.stringify(metric));assert.equal(metric.outside,0,'live modules and hull remain registered '+JSON.stringify(metric));}
   independentDamage.push(...metrics);
   for(const dead of [[],...Object.keys(spec.regions).map(key=>[key]),Object.keys(spec.regions)]){
    await game.evaluate(({stage,dead})=>{const q=window.__bossQA;q.newGame();q.P.inv=99999;const b=q.forceBoss(stage);b.parts.forEach(p=>p.hidden=false);for(const p of b.parts)if(dead.includes(p.key))q.damageBoss(p.maxHp/1.5+1,b.x+p.ox*b.w,b.y+p.oy*b.h,p);q.step(50);q.render(1);},{stage:spec.stage,dead});
    await game.locator('#game').screenshot({path:path.join(output,`stage-${spec.stage+1}-${dead.length?dead.length===Object.keys(spec.regions).length?'fully-damaged':dead[0]+'-damaged':'intact'}.png`)});
   }
  }

  const results=[];
  for(let i=0;i<7;i++){
   const result=await game.evaluate(async i=>{
    const q=window.__bossQA;await Assets.loadBg(Stages.STAGES[i].bg);q.newGame();q.P.inv=99999;const b=q.forceBoss(i),score=q.G.score;
    q.damageBoss(b.hp+999,b.x,b.y,null);const reward=q.G.score-score,afterKill=q.G.score;const state=b.state,fx=!!b.deathFx;
    q.damageBoss(999,b.x,b.y,null);const duplicateReward=q.G.score-afterKill;
    q.pauseGame();const frozen=b.dying;q.step(90);const paused=b.dying===frozen;q.resumeGame();
    for(let n=0;n<700&&['play','resume'].includes(q.G.state);n++)q.step(1);
    return {stage:i+1,id:b.id,state,fx,reward,duplicateReward,paused,finalState:q.G.state,cleared:q.G.bossCleared,parts:b.parts.map(p=>p.alive),duration:b.dying};
   },i);
   assert.equal(result.state,'dying');assert.ok(result.fx);assert.equal(result.reward,20000+i*5000,'one boss reward for stage '+(i+1));assert.equal(result.duplicateReward,0,'no repeat reward while dying');assert.ok(result.paused,'pause freezes destruction');assert.equal(result.finalState,'clear');assert.ok(result.cleared);assert.ok(result.parts.every(v=>!v),'all parts are sequentially destroyed');assert.ok(result.duration>2.4&&result.duration<=2.42,'settlement opens immediately after the 2.4 second destruction window');results.push(result);
  }
  for(const stage of [4,5,6])for(const moment of [.4,1.65,1.8,2.2]){
   await game.evaluate(async({stage,moment})=>{const q=window.__bossQA;await Assets.loadBg(Stages.STAGES[stage].bg);q.newGame();q.P.inv=99999;const b=q.forceBoss(stage);q.damageBoss(b.hp+999,b.x,b.y,null);for(let n=0;b.dying<moment&&n<900;n++)q.step(1);if(b.dying<moment)throw new Error('death timeline did not reach '+moment);q.render(1);},{stage,moment});
   await game.locator('#game').screenshot({path:path.join(output,`stage-${stage+1}-death-${String(moment).replace('.','_')}.png`)});
  }
  const caldera=await game.evaluate(()=>{
   const base=Assets.body('bossCaldera','neutral',380),shape=Bosses.create('caldera',4,Difficulty.get('easy'));
   function variant(dead){return Assets.bossDamageBody('bossCaldera',380,shape.parts.map(p=>({...p,alive:!dead.includes(p.key)})));}
   const left=variant(['wingL']),right=variant(['wingR']),both=variant(['wingL','wingR','core']);
   function region(art,r){return art.c.getContext('2d').getImageData(Math.floor(4+r[0]*base.w),Math.floor(4+r[1]*base.h),Math.floor(r[2]*base.w),Math.floor(r[3]*base.h)).data;}
   function coverage(art,r){const d=region(art,r);let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>30)n++;return n;}
   function changes(a,b,r){const aa=region(a,r),bb=region(b,r);let n=0;for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])n++;return n;}
   const leftBarrels=[.21,.77,.15,.17],rightBarrels=[.64,.77,.15,.17];
   const beforeL=coverage(base,leftBarrels),beforeR=coverage(base,rightBarrels);
   return {beforeL,afterL:coverage(left,leftBarrels),beforeR,afterR:coverage(right,rightBarrels),
    intactRightChanges:changes(base,left,[.60,.24,.23,.71]),intactLeftChanges:changes(base,right,[.17,.24,.23,.71]),
    intactCoreChanges:changes(base,left,[.44,.26,.12,.23]),coreChanges:changes(base,both,[.44,.26,.12,.23])};
  });
  assert.ok(caldera.beforeL>100&&caldera.beforeR>100,'original Caldera has long visible barrels');
  assert.ok(caldera.afterL<caldera.beforeL*.1&&caldera.afterR<caldera.beforeR*.1,'destroyed guns remove long original barrel pixels '+JSON.stringify(caldera));
  assert.equal(caldera.intactRightChanges,0,'left damage leaves right cannon intact');
  assert.equal(caldera.intactLeftChanges,0,'right damage leaves left cannon intact');
  assert.equal(caldera.intactCoreChanges,0,'cannon damage leaves live reactor intact');assert.ok(caldera.coreChanges>100,'reactor uses its damaged region');
  for(const dead of [[],['wingL'],['wingR'],['wingL','wingR','core']]){
   await game.evaluate(dead=>{const q=window.__bossQA;q.newGame();q.P.inv=99999;const b=q.forceBoss(4);b.parts.forEach(p=>p.hidden=false);for(const p of b.parts)if(dead.includes(p.key))q.damageBoss(p.maxHp/1.5+1,b.x+p.ox*b.w,b.y+p.oy*b.h,p);q.step(50);q.render(1);},dead);
   await game.locator('#game').screenshot({path:path.join(output,`stage-5-${dead.length?dead.length===3?'fully-damaged':dead[0]+'-damaged':'intact'}.png`)});
  }
  await game.evaluate(async()=>{const q=window.__bossQA;await Assets.loadBg(Stages.STAGES[6].bg);q.newGame();q.P.inv=99999;q.forceBoss(6);q.render(1);});
  await game.locator('#game').screenshot({path:path.join(output,'stage-7-intact.png')});
  const damaged=await game.evaluate(()=>{const q=window.__bossQA,b=q.boss();b.hp=b.maxHp*.2;q.step(1);b.hp=b.maxHp;b.parts.forEach(p=>p.hidden=false);for(const p of b.parts.slice())q.damageBoss(p.maxHp/1.5+1,b.x+p.ox*b.w,b.y+p.oy*b.h,p);q.render(1);return b.parts.map(p=>p.alive);});
  assert.ok(damaged.every(alive=>!alive),'regent damage artwork shows every destructible module');
  await game.locator('#game').screenshot({path:path.join(output,'stage-7-fully-damaged.png')});
  const saturation=await game.evaluate(async()=>{const q=window.__bossQA;await Assets.loadBg(Stages.STAGES[6].bg);const b=q.forceBoss(6);q.damageBoss(b.hp+999,b.x,b.y,null);q.saturate();q.setDeath(1.8);q.render(1);const s=BossDestruction.stats(b.deathFx);return {pool:q.particles().length,finalActive:s.finalActive,fragments:s.fragments,canvas:document.querySelector('#game').toDataURL().length};});
  assert.ok(saturation.pool>=120&&saturation.finalActive&&saturation.fragments===0&&saturation.canvas>1000,'flame-only destruction remains renderable with saturated particle pool '+JSON.stringify(saturation));
  const noFragments=await game.evaluate(()=>Object.keys(Bosses.DEFS).every(id=>{const b=Bosses.create(id,0,Difficulty.get('easy')),fx=BossDestruction.create(b);return [.2,.8,1.8,2.2].every(t=>{BossDestruction.update(fx,t);return BossDestruction.stats(fx).fragments===0;});}));assert.ok(noFragments,'all seven bosses have no flying debris at every destruction phase');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(gameErrors,[]);assert.deepEqual(gameFailed,[]);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({assetTiles,independentDamage,caldera,noFragments,results,saturation,initialRequests:initialFxRequests,lateRequests:gameRequests.filter(u=>/boss-(heavy|reactor)|regent-damaged|caldera.*damaged|breakwater-damaged|s3-boss-damaged|canopy-boss-damaged/.test(u))},null,2));
  console.log('PASS dedicated stage 1/3/4 independent damage pixels and lazy loading, Caldera barrel removal, no flying debris, preview controls, 7 real kills, settlement, rewards, pause, 32 alpha tiles and saturated-pool rendering.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
