const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../tmp/gradient-comparison-qa/node_modules/playwright');

const project = path.resolve(__dirname, '..');
const output = path.resolve(project, '../output/striker-difficulty-qa');
const port = Number(process.env.STRIKER_QA_PORT || 8778);
const url = `http://127.0.0.1:${port}/striker-game/`;
fs.mkdirSync(output, { recursive: true });
const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: path.dirname(project), stdio: 'ignore', windowsHide: true
});

const hooks = `
  window.__sevenQA = {
    G, P, newGame, startStage, nextStage, pauseGame, resumeGame,
    stage, killBoss, damageBoss, damageEnemy, spawnMidboss, makeEnemy, render,
    spawnFormation, spawnGround, eShot, eMissile, eFan, eRing,
    hitPlayer, continueGame, saveScore, toTitle, updatePlayer, updateBullets, collide,
    setShip: i => { shipIndex=i; },
    boss: () => boss, enemies: () => enemies, grounds: () => grounds,
    shots: () => eBullets, attract: () => attract,
    attractStage: i => { attract.stage=i; attract.cycleT=0; attract.boss=null; attract.planes=[]; attract.props=[]; },
    now: 1000,
    step(n) { for(let i=0;i<n;i++){ this.now+=1000/60; loop(this.now); } },
    state: () => ({state:G.state,index:G.stageIndex,stage:stage().no,mode:G.difficulty,boss:boss && boss.id,time:G.stageTime})
  };
`;

(async () => {
  let browser;
  const errors = [], failed = [], results = [];
  try {
    for(let i=0;i<100;i++) {
      try { if((await fetch(url)).ok) break; } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({viewport:{width:1366,height:900}});
    await page.addInitScript(()=>{
      if(!sessionStorage.getItem('difficultyQASeeded')) {
        localStorage.setItem('is_hi','987654');
        localStorage.setItem('is_scores',JSON.stringify([{score:987654,stage:6,ship:'LEGACY'}]));
        sessionStorage.setItem('difficultyQASeeded','1');
      }
    });
    page.on('pageerror', e=>errors.push(e.message));
    page.on('response', r=>{if(r.status()>=400 && !r.url().endsWith('favicon.ico')) failed.push(`${r.status()} ${r.url()}`);});
    // First verify real production input and layout with its normal animation loop.
    await page.goto(url);
    await page.locator('#scTitle').waitFor({state:'visible'});
    await page.locator('#difficultyHard').click();
    assert.equal(await page.locator('#tHi').textContent(),'987,654');
    assert.match(await page.locator('#ranking').textContent(),/LEGACY/);
    await page.locator('#difficultyEasy').click();
    assert.equal(await page.locator('#tHi').textContent(),'0');
    await page.locator('#btnHelp').click();
    await page.locator('#btnHelpBack').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('is_easy_scores')),null,'help before playing creates no record');
    await page.locator('#btnStart').click();
    await page.keyboard.down('z');
    await page.waitForTimeout(300);
    await page.keyboard.up('z');
    await page.keyboard.press('p');
    await page.locator('#scPause').waitFor({state:'visible'});
    await page.locator('#btnResume').click();
    await page.locator('#scPause').waitFor({state:'hidden'});
    await page.keyboard.press('p');
    await page.locator('#btnQuit').click();
    await page.locator('#scTitle').waitFor({state:'visible'});
    await page.screenshot({path:path.join(output,'title-desktop.png')});
    for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      const bounds=await page.locator('#stage').boundingBox();
      assert.ok(bounds.x>=-1 && bounds.y>=-1 && bounds.x+bounds.width<=viewport.width+1 && bounds.y+bounds.height<=viewport.height+1,'stage stays within viewport');
      await page.screenshot({path:path.join(output,`title-${viewport.width}x${viewport.height}.png`)});
      // Small landscape screens scroll the vertical game's title panel.
      await page.locator('#difficultyHard').click();
      assert.equal(await page.locator('#difficultyHard').getAttribute('aria-pressed'),'true');
      await page.locator('#difficultyEasy').click();
      await page.locator('#btnStart').scrollIntoViewIfNeeded();
      const start=await page.locator('#btnStart').boundingBox();
      assert.ok(start.y>=0 && start.y+start.height<=viewport.height+1,'start remains reachable');
    }
    await page.setViewportSize({width:1366,height:900});
    // Instrument the current production source only in this browser response.
    const source=fs.readFileSync(path.join(project,'js/game.js'),'utf8');
    assert.ok(source.includes('  boot();'));
    await page.route('**/js/game.js', route=>route.fulfill({contentType:'application/javascript',body:source.replaceAll('requestAnimationFrame(loop);','/* manual QA clock */').replace('  boot();',hooks+'\n  boot();')}));
    await page.reload();
    await page.waitForFunction(()=>window.__sevenQA?.G.state==='title');
    await page.evaluate(async()=>{await Promise.all(Stages.STAGES.map(st=>Assets.loadBg(st.bg)));});
    const art=await page.evaluate(()=>{
      const kinds=['canopyFighter','canopyGunship','canopyMidboss','bossCanopy','calderaFighter','calderaBomber','calderaMidboss','bossCaldera'];
      return kinds.map(kind=>{
        const body=Assets.body(kind,'neutral',160);
        if(!body) return {kind,missing:true};
        const pixels=body.c.getContext('2d').getImageData(0,0,body.c.width,body.c.height).data;
        let transparent=0,opaque=0;
        for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]>200)opaque++;}
        return {kind,transparent,opaque};
      });
    });
    for(const item of art){assert.ok(!item.missing,item.kind+' loads');assert.ok(item.transparent>100 && item.opaque>100,item.kind+' has actual alpha and painted pixels');}
    results.push({assets:art});
    for(let i=0;i<7;i++) {
      await page.evaluate(i=>{
        const q=window.__sevenQA;
        q.attractStage(i);q.G.state='title';q.step(520);
      },i);
      const demo=await page.evaluate(()=>({boss:window.__sevenQA.attract().boss?.id}));
      assert.ok(demo.boss,'stage '+(i+1)+' attract boss');
    }
    for(const difficulty of ['easy','hard']) {
      await page.locator(difficulty==='easy'?'#difficultyEasy':'#difficultyHard').click();
      const collision=await page.evaluate(()=>{
        const q=window.__sevenQA,cases=[];
        for(const ship of [0,1])for(const bank of [-1,0,1])for(const style of ['eSmall','eBig','eCore','eMissile']){
          for(const [name,dx,dy] of [['wing',24,0],['tail',0,24],['graze',style==='eSmall'?8.5:style==='eBig'?11:13,0],['core',2,0]]){
            q.setShip(ship);q.newGame();q.P.inv=0;q.P.bank=bank;q.P.x=240;q.P.y=570;
            const lives=q.P.lives;q.eShot(q.P.x+dx,q.P.y+dy,0,0,style);q.collide();
            cases.push({ship,bank,style,name,hit:q.P.lives<lives,alive:q.P.alive});
          }
        }
        q.setShip(0);q.newGame();return cases;
      });
      for(const item of collision){assert.equal(item.hit,item.name==='core','central player hitbox '+JSON.stringify(item));assert.equal(item.alive,item.name!=='core');}
      results.push({difficulty,collision});
      const mechanics=await page.evaluate(difficulty=>{
        const q=window.__sevenQA,d=Difficulty.get(difficulty);
        q.newGame();
        const initial={lives:q.P.lives,bombs:q.P.bombs,power:q.P.power,inv:q.P.inv};
        // Hidden title buttons cannot alter the active run's mode.
        document.getElementById(difficulty==='easy'?'difficultyHard':'difficultyEasy').click();
        const locked=q.G.difficulty;
        const ev=q.stage().script.find(e=>e.kind==='formation');
        q.spawnFormation(ev);
        const formation=q.enemies().length;
        const enemyHp=q.enemies()[0].maxHp;
        const rawEnemy=Stages.enemyForStage(ev.type,q.G.stageIndex);
        q.spawnGround({type:'aa',x:.5});
        const groundHp=q.grounds()[0].maxHp;
        const shot=q.eShot(0,0,120,160,'eSmall');
        const speed=Math.hypot(shot.vx,shot.vy);
        const missile=q.eMissile(240,190,180,2);
        const missileParams={speed:Math.hypot(missile.vx,missile.vy),max:missile.maxSpd,accel:missile.accel};
        for(let tick=0;tick<90;tick++)q.updateBullets(1/60);
        const acceleratedMissileSpeed=Math.hypot(missile.vx,missile.vy);
        const pre=q.shots().length;q.eFan(240,190,Math.PI/2,9,1,100,'eSmall');
        const fanCount=q.shots().length-pre;
        q.P.power=5;q.P.inv=0;q.hitPlayer();
        const afterHit={lives:q.P.lives,power:q.P.power};
        q.updatePlayer(1.21,{});
        const respawn={alive:q.P.alive,inv:q.P.inv};
        while(q.P.lives>=0){q.P.inv=0;q.hitPlayer();q.updatePlayer(1.21,{});}
        const gameOver=q.G.state;
        document.getElementById('btnContinue').click();
        const continued={lives:q.P.lives,bombs:q.P.bombs,power:q.P.power,mode:q.G.difficulty};
        const keys=Difficulty.recordKeys(difficulty),beforeContinueSave=localStorage.getItem(keys.ranking);
        q.G.score=222;q.saveScore();
        const continueRankExcluded=beforeContinueSave===localStorage.getItem(keys.ranking);
        // Restart to check a clean full campaign without continues or artificial score.
        q.newGame();q.P.inv=99999;
        return {difficulty,initial,locked,formation,expectedFormation:Difficulty.formationCount(ev,difficulty),
          enemyHp,expectedEnemyHp:Math.max(1,Math.round(rawEnemy.hp*q.stage().enemyHpMul*d.enemyHp)),
          groundHp,speed,missileParams,acceleratedMissileSpeed,fanCount,afterHit,respawn,gameOver,continued,continueRankExcluded};
      },difficulty);
      const easy=difficulty==='easy';
      assert.equal(mechanics.locked,difficulty);
      assert.deepEqual(mechanics.initial,{lives:easy?5:3,bombs:easy?3:2,power:easy?2:1,inv:easy?3.5:2.2});
      assert.equal(mechanics.formation,mechanics.expectedFormation);
      assert.equal(mechanics.enemyHp,mechanics.expectedEnemyHp);
      assert.equal(mechanics.groundHp,Math.round(26*(easy?.75:1)));
      assert.ok(Math.abs(mechanics.speed-200*(easy?.78:1))<.001);
      assert.ok(Math.abs(mechanics.missileParams.max-243*(easy?.78:1))<.001);
      assert.ok(Math.abs(mechanics.missileParams.accel-210*(easy?.78:1))<.001);
      assert.ok(Math.abs(mechanics.acceleratedMissileSpeed-243*(easy?.78:1))<.001,'homing acceleration respects mode speed cap');
      assert.equal(mechanics.fanCount,easy?5:9);
      assert.equal(mechanics.afterHit.power,easy?4:1);
      assert.equal(mechanics.afterHit.lives,easy?4:2);
      assert.deepEqual(mechanics.respawn,{alive:true,inv:easy?4:2.8});
      assert.equal(mechanics.gameOver,'over');
      assert.equal(mechanics.continueRankExcluded,true);
      assert.deepEqual(mechanics.continued,{lives:easy?5:3,bombs:easy?3:2,power:easy?2:1,mode:difficulty});
      results.push({mechanics});
      const progression=await page.evaluate(()=>{
        const q=window.__sevenQA,early=[];
        function stepTo(time) {
          for(let frames=0;q.G.stageTime<time && frames<12000;frames++)q.step(1);
          if(q.G.stageTime<time)throw new Error('stage clock did not reach '+time);
        }
        for(let i=0;i<7;i++) {
          q.startStage(i,false);q.P.inv=99999;
          const events=q.stage().script,midAt=events.find(e=>e.name==='midboss').at,bossAt=events.find(e=>e.name==='boss').at;
          stepTo(midAt+4);
          const mid=q.enemies().find(e=>e.isMidboss && !e.dead);
          q.damageEnemy(mid,mid.hp,mid.x,mid.y);
          stepTo(bossAt-.5);
          const beforeDeadline=!q.boss() && q.G.warning===0 && q.G.midbossDefeated;
          stepTo(bossAt+.2);
          const warningAtDeadline=!q.boss() && q.G.warning>0;
          q.step(420);
          early.push({stage:i+1,beforeDeadline,warningAtDeadline,boss:q.boss()?.id,
            expectedBoss:q.stage().boss,liveMidbosses:q.enemies().filter(e=>e.isMidboss && !e.dead).length});
        }
        q.newGame();q.P.inv=99999;
        stepTo(q.stage().script.find(e=>e.name==='boss').at+1);
        const waiting=q.G.bossPending && !q.G.midbossDefeated && !q.boss();
        q.continueGame();
        const continuedReset=q.G.stageTime===0 && !q.G.bossPending && !q.G.midbossDefeated && !q.G.warning && !q.boss();
        q.newGame();q.P.inv=99999;
        const newGameReset=q.G.continues===0 && !q.G.bossPending && !q.G.midbossDefeated && !q.G.warning && !q.boss();
        return {difficulty:q.G.difficulty,early,waiting,continuedReset,newGameReset};
      });
      for(const probe of progression.early) {
        assert.ok(probe.beforeDeadline,'early defeat still waits for scheduled boss time in stage '+probe.stage);
        assert.ok(probe.warningAtDeadline,'early defeat starts the warning at scheduled boss time');
        assert.equal(probe.boss,probe.expectedBoss);
        assert.equal(probe.liveMidbosses,0);
      }
      assert.ok(progression.waiting && progression.continuedReset && progression.newGameReset,'pending boss state resets on continue and new game');
      results.push({progression});
      for(let i=0;i<7;i++) {
      const before=await page.evaluate(()=>window.__sevenQA.state());
      assert.equal(before.index,i,'campaign reaches each stage in order');
      await page.evaluate(async()=>{const q=window.__sevenQA;await Assets.loadBg(q.stage().bg);q.P.inv=99999;});
      const middle=await page.evaluate(()=>{
        const q=window.__sevenQA,at=q.stage().script.find(e=>e.name==='midboss').at;
        q.step(Math.ceil((at+1.5)*60));
        const mid=q.enemies().find(e=>e.isMidboss);
        return {art:mid?.art,name:mid?.mid.name,ground:q.grounds().length,hp:mid?.maxHp,expectedHp:Math.round(Stages.MIDBOSS[q.G.stageIndex].hp*Difficulty.get(q.G.difficulty).midHp)};
      });
      assert.ok(middle.name,'stage '+(i+1)+' spawns its midboss');
      assert.equal(middle.hp,middle.expectedHp);
      const fight=await page.evaluate(()=>{
        const q=window.__sevenQA,at=q.stage().script.find(e=>e.name==='boss').at;
        q.step(Math.ceil((at+12-q.G.stageTime)*60));
        const mid=q.enemies().find(e=>e.isMidboss && !e.dead);
        return {boss:q.boss()?.id,warning:q.G.warning,midAlive:!!mid && mid.hp>0};
      });
      assert.ok(fight.midAlive,'midboss remains alive after scheduled boss time');
      assert.equal(fight.boss,undefined,'boss must wait for a living midboss');
      assert.equal(fight.warning,0,'boss warning must wait for midboss defeat');
      const pending=await page.evaluate(()=>{
        const q=window.__sevenQA,time=q.G.stageTime;
        q.pauseGame();q.step(180);const pauseStable=q.G.stageTime===time;q.resumeGame();q.step(180);
        const mid=q.enemies().find(e=>e.isMidboss && !e.dead);
        q.damageEnemy(mid,1,mid.x,mid.y);q.step(60);
        const partialWait=!q.boss() && q.G.warning===0;
        q.damageEnemy(mid,mid.hp,mid.x,mid.y);q.step(1);
        const warningAfterKill=q.G.warning>0;
        q.step(420);
        const b=q.boss();
        return {pauseStable,partialWait,warningAfterKill,liveMidbosses:q.enemies().filter(e=>e.isMidboss && !e.dead).length,
          id:b?.id,state:b?.state,shots:q.shots().length,hullHp:b?.maxHp,expectedHullHp:Math.round(b.def.hp*Difficulty.get(q.G.difficulty).bossHp)};
      });
      assert.ok(pending.pauseStable && pending.partialWait && pending.warningAfterKill);
      assert.equal(pending.liveMidbosses,0,'midboss and boss never fight together');
      Object.assign(fight,pending);
      assert.equal(fight.state,'fight','stage '+(i+1)+' enters boss fight');
      assert.equal(fight.hullHp,fight.expectedHullHp);
      for(const phase of [1,2,3]) {
        const status=await page.evaluate(phase=>{
          const q=window.__sevenQA,b=q.boss();
          const bullet=q.eShot(80,300,20,35,'eSmall'),missile=q.eMissile(140,300,100,2),split=q.eShot(200,300,0,30,'eBig');split.split=2;
          b.hp=b.maxHp*[.9,.5,.2][phase-1];q.step(1);
          const preserved=[bullet,missile,split].every(shot=>q.shots().includes(shot))&&bullet.x>80&&bullet.y>300&&missile.homing>0&&split.split>0;
          q.step(119);
          return {phase:b.phase,name:b.def.phaseNames[b.phase-1],preserved,finite:Number.isFinite(b.x+b.y),shots:q.shots().length};
        },phase);
        assert.equal(status.phase,phase);assert.ok(status.name && status.preserved && status.finite && status.shots>0,'phase keeps ordinary, homing and splitting bullets: '+JSON.stringify(status));
        if(difficulty==='hard')await page.locator('#game').screenshot({path:path.join(output,`stage-${i+1}-phase-${phase}.png`)});
      }
      if(i===3 || i===4 || i===5 || i===6) await page.locator('#game').screenshot({path:path.join(output,`${difficulty}-stage-${i+1}-boss.png`)});
      if(i===3 || i===4) {
        const destroyed=await page.evaluate(()=>{
          const q=window.__sevenQA,b=q.boss(),p=b.parts[0];q.damageBoss(p.hp+1,b.x+p.ox*b.w,b.y+p.oy*b.h,p);q.step(1);
          return {alive:p.alive,hp:p.hp,art:!!Assets.bossDamageBody(b.def.sprite,b.w,b.parts)};
        });
        assert.equal(destroyed.alive,false);assert.equal(destroyed.hp,0);assert.ok(destroyed.art);
        await page.locator('#game').screenshot({path:path.join(output,`${difficulty}-stage-${i+1}-damage.png`)});
      }
      await page.evaluate(()=>{const q=window.__sevenQA;q.killBoss();for(let n=0;n<500 && q.G.state==='play';n++)q.step(1);});
      assert.equal(await page.evaluate(()=>window.__sevenQA.G.state),'clear','boss death opens settlement');
      await page.evaluate(()=>window.__sevenQA.step(190));
      const after=await page.evaluate(()=>window.__sevenQA.state());
      if(i<6){assert.equal(after.index,i+1);assert.equal(after.state,'play');}
      else {assert.equal(after.state,'end');assert.equal(after.index,6);}
      results.push({difficulty,stage:i+1,...middle,...fight,transition:after.state});
      console.log(`PASS ${difficulty} stage ${i+1}: ${middle.name}, ${fight.id}, 3 phases, transition ${after.state}`);
    }
    assert.match(await page.locator('#endMode').textContent(),new RegExp(difficulty.toUpperCase()));
    await page.screenshot({path:path.join(output,`${difficulty}-all-clear.png`)});
    const saved=await page.evaluate(difficulty=>{
      const q=window.__sevenQA,keys=Difficulty.recordKeys(difficulty);
      const before=localStorage.getItem(keys.ranking);q.saveScore();q.saveScore();
      return {before,after:localStorage.getItem(keys.ranking),keys};
    },difficulty);
    assert.equal(saved.after,saved.before,'same run is saved once');
    await page.locator('#btnEndBack').click();
    assert.equal(await page.evaluate(()=>window.__sevenQA.G.state),'title');
    await page.locator('#btnHelp').click();await page.locator('#btnHelpBack').click();
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),saved.keys.ranking),saved.before,'opening help after a run creates no duplicate');
    }
    const records=await page.evaluate(()=>({easy:JSON.parse(localStorage.getItem('is_easy_scores')),
      hard:JSON.parse(localStorage.getItem('is_scores')),hi:localStorage.getItem('is_hi')}));
    assert.ok(records.easy.every(r=>r.difficulty==='easy'));
    assert.ok(records.hard.every(r=>r.ship==='LEGACY' || r.difficulty==='hard'));
    assert.equal(records.hi,'987654','legacy HARD high score survives EASY runs');
    results.push({records});
    await page.reload();
    await page.waitForFunction(()=>window.__sevenQA?.G.state==='title');
    assert.equal(await page.locator('#difficultyHard').getAttribute('aria-pressed'),'true','selection survives reload');
    assert.deepEqual(errors,[],'no browser runtime errors');
    assert.deepEqual(failed,[],'no failed asset HTTP responses');
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,results,errors,failed,limitations:'Campaign clock accelerated and invulnerability enabled. Physical devices, sound output and human difficulty feel not checked.'},null,2));
    console.log('PASS EASY/HARD early/late midboss defeat, pending boss resets, controls, actual mechanics, records, responsive bounds, raster alpha, 7 title demos and both full campaigns.');
  } finally {
    if(browser)await browser.close();
    server.kill();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
