/* headless 검증용 하니스(개발 도구). tools/make-test.py 가 만든 __test.html 에서만 쓰인다.
   headless 환경에서는 가상 시간 때문에 requestAnimationFrame 이 초당 수천 번 발화하므로,
   테스트 사본에서는 내부 rAF 를 끄고 여기서 loop() 를 직접 호출해 결정적으로 돌린다. */
(function () {
  var log = [], errs = [], NL = String.fromCharCode(10);
  function out(m) {
    log.push(m);
    var el = document.getElementById('TESTOUT');
    if (el) el.textContent = log.join(NL);
  }
  window.addEventListener('error', function (e) {
    errs.push('ERROR: ' + e.message + ' @' + e.filename + ':' + e.lineno);
    out('ERROR: ' + e.message + ' @' + e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('REJECT: ' + e.reason);
    out('REJECT: ' + e.reason);
  });
  var ce = console.error;
  console.error = function () {
    errs.push('console.error: ' + [].join.call(arguments, ' '));
    out('console.error: ' + [].join.call(arguments, ' '));
    ce.apply(console, arguments);
  };

  var params = new URLSearchParams(location.search);
  var scene = params.get('scene') || 'title';
  var F = parseInt(params.get('f') || '0', 10);
  out('harness scene=' + scene);

  function step(n) { window.__T.step(n); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function holdKey(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }
  function releaseKey(k) { window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })); }
  function el(id) { return document.getElementById(id); }
  function visible(id) { return !el(id).classList.contains('hidden'); }

  async function run() {
    var T = window.__T;
    if(scene==='lancerburst') {
      el('ship1').click();T.newGame();T.god();T.G.titleCard=0;
      const target=T.spawnType('mini',240,220,'hover','none');target.hp=1000;target.maxHp=1000;
      const before=T.P.bombs;T.bomb();T.bomb();
      if(T.P.bombs!==before-1||T.bombState().kind!=='lancer')throw new Error('lancer special activation failed');
      step(F||60);
      if(F)return;
      if(target.hp>=1000)throw new Error('beam did not damage target');
      const frozen=T.bombState().t;T.G.state='pause';step(20);
      if(T.bombState().t!==frozen)throw new Error('beam moved while paused');
      T.G.state='play';step(140);if(T.bombState())throw new Error('beam did not finish');
      T.bomb();T.startStage(0,true);if(T.bombState())throw new Error('beam survived reset');
      el('ship0').click();T.newGame();T.bomb();if(T.bombState().kind==='lancer')throw new Error('striker special changed');
      out('PASS lancer beam damage, single consumption, pause, finish, reset, striker bombing');return;
    }
    if(scene==='lancer') {
      el('ship1').click();T.newGame();T.god();T.setPower(4,2);holdKey('z');step(22);releaseKey('z');
      if(!T.pBullets().some(b=>b.style==='lance'))throw new Error('lancer bullets missing');
      if(T.pBullets().some(b=>b.style==='vulcan'))throw new Error('lancer uses striker bullets');
      for(const pose of ['left','neutral','right'])if(!Assets.body('lancer',pose,62))throw new Error('lancer pose missing');
      out('PASS lancer own sprite, three poses, gold lance bullets');T.render();return;
    }
    if(scene==='wreckcheck') {
      if(!Assets.image('boss-wreck'))throw new Error('wreck sheet not loaded');
      for(const id of ['breakwater','dune','gemini','regent']){
        var b=Bosses.create(id,0),intact=Assets.body(b.def.sprite,'neutral',b.w);
        b.parts[0].alive=false;
        var damaged=Assets.bossDamageBody(b.def.sprite,b.w,b.parts);
        if(damaged.c===intact.c)throw new Error(id+' shares intact canvas');
        var a=intact.c.getContext('2d').getImageData(0,0,intact.c.width,intact.c.height).data;
        var d=damaged.c.getContext('2d').getImageData(0,0,damaged.c.width,damaged.c.height).data;
        var changed=0;for(var pi=0;pi<a.length;pi+=4)if(a[pi]!==d[pi]||a[pi+1]!==d[pi+1]||a[pi+2]!==d[pi+2])changed++;
        if(changed<100)throw new Error(id+' wreck not visible: '+changed);
        out('PASS '+id+' changed pixels='+changed);
      }return;
    }
    if(scene==='chargefx') {
      T.newGame();T.god();holdKey('z');step(55);
      if(!(T.P.charge>.1))throw new Error('charge did not gather');
      if(F===1)return;
      T.fireCharge();releaseKey('z');step(4);
      if(!T.pBullets().some(b=>b.style==='charge'))throw new Error('charge projectile missing');
      if(!(T.P.chargeRelease>0))throw new Error('release glow missing');
      var frozen=T.P.chargeClock;T.G.state='pause';step(10);
      if(T.P.chargeClock!==frozen)throw new Error('charge particles moved during pause');
      T.G.state='play';out('PASS gather, projectile, release glow, pause freeze');return;
    }
    if(scene==='variants') {
      await Promise.all([Assets.loadBg(4),Assets.loadStageArt(4)]);
      T.newGame();T.startStage(3,true);T.god();T.G.time=-1000;T.G.titleCard=0;
      var keys=['crimson','scarlet','carbon','obsidian'];
      var squad=keys.map(function(key,i){var d=Stages.ENEMY[key];var e=T.spawnType(key,65+i*115,130,d.move,d.fire);e.speed=d.speed;e.fireCt=.5;return e;});
      if(F){step(F);return;}
      step(48);
      if(!T.eBullets().length)throw new Error('variants did not fire in real game');
      if(!squad.every(function(e){return Number.isFinite(e.x+e.y+e.bank);}))throw new Error('invalid variant position');
      out('PASS new variants move and fire in game');
      var ages=squad.map(function(e){return e.age;});T.G.state='pause';step(20);
      if(!squad.every(function(e,i){return e.age===ages[i];}))throw new Error('variant moved while paused');
      out('PASS pause freezes new motion');T.G.state='play';
      T.startStage(4,true);
      if(T.enemies().some(function(e){return keys.includes(e.typeKey);}))throw new Error('variant survived stage reset');
      out('PASS stage reset clears variants');return;
    }
    if (scene === 'bomb') {
      await Assets.loadBg(4);
      T.newGame(); T.startStage(Stages.STAGES.findIndex(function(st){return st.boss==='nightark';}),true);
      var bomberBoss=T.forceBoss();step(2);
      var victim=T.spawnType('medium',240,330,'hover','none');victim.hp=victim.maxHp=1000;
      var target=T.spawnGroundAt('bunker',240,300);target.hp=target.maxHp=1000;
      var stock=T.P.bombs, bossHP=bomberBoss.hp;
      function verifyBomb(ok,msg){if(!ok)throw new Error(msg);out('PASS '+msg);}
      T.bomb();T.bomb();
      verifyBomb(T.P.bombs===stock-1,'one bomb consumed; repeated activation ignored');
      verifyBomb(victim.hp===1000 && target.hp===1000 && bomberBoss.hp===bossHP,'damage waits for impact');
      if(F){step(F);out('airstrike time='+T.bombState().t.toFixed(2));return;}
      step(12);var frozen=T.bombState().t;T.G.state='pause';step(60);
      verifyBomb(T.bombState().t===frozen,'pause freezes missile timeline');T.G.state='play';
      step(Math.ceil((BombRun.DURATION-frozen+.05)/.0167));
      verifyBomb(!T.bombState(),'completed airstrike cleaned up');
      verifyBomb(victim.hp===860,'enemy damaged once across overlapping blasts');
      verifyBomb(target.hp===880,'ground target damaged once');
      verifyBomb(bomberBoss.hp===bossHP-350,'boss damage remains 350 per use');
      verifyBomb(T.P.alive && T.P.inv>0,'invulnerability covers the full airstrike');
      T.bomb();verifyBomb(!!T.bombState(),'next use available after completion');
      T.startStage(4,true);verifyBomb(!T.bombState(),'stage transition clears airstrike');
      T.P.bombs=0;T.bomb();verifyBomb(!T.bombState(),'empty inventory blocks activation');
      out('font ready='+document.fonts.check('16px "NeoDunggeunmo"'));
      return;
    }
    /* 일반탄 → 부위 내구도 → 잔해·폭발·보상까지 실제 충돌 경로를 검증한다. */
    if (scene === 'damage') {
      await Assets.loadBg(4);
      T.newGame(); T.startStage(Stages.STAGES.findIndex(function(st){return st.boss==='nightark';}), true); T.god();
      var db = T.forceBoss(); step(2);
      function checkDamage(ok, msg) { if (!ok) throw new Error(msg); out('PASS ' + msg); }
      function shootModule(key) {
        var p = db.parts.find(function (p) { return p.key === key; });
        for (var i = 0; i < 20 && p.alive; i++) {
          T.shootAt(40, db.x + p.ox * db.w, db.y + db.hitH / 2 + 3, false);
          step(2);
        }
        checkDamage(!p.alive && p.hp === 0, key + ' destroyed by ordinary bullets');
      }
      var beforeDamage = T.G.score;
      shootModule('bayL');
      checkDamage(db.parts[1].hp === db.parts[1].maxHp, 'right module stays intact');
      checkDamage(T.parts().some(function (p) { return p.explosion; }), 'raster explosion spawned');
      checkDamage(T.G.score - beforeDamage === 5000, 'one module gives one reward');
      shootModule('bayR');
      checkDamage(db.parts[2].hp === db.parts[2].maxHp, 'armored bridge stays intact');
      T.hurtBoss(.6); step(2);
      checkDamage(!db.parts[2].hidden, 'phase 2 opens bridge armor');
      shootModule('bridge');
      checkDamage(T.G.score - beforeDamage === 15000, 'three independent rewards');
      step(params.get('fx') === '1' ? 10 : 65); T.render(); return;
    }
    /* 타이틀: 뒤에서 도는 데모 화면을 돌려 본다 */
    if (scene === 'title') {
      var pre = params.get('bg');
      if (pre) { await Promise.all(Stages.STAGES.map(function (st) { return Assets.loadBg(st.bg); })); await sleep(300); }
      if (params.get('s')) T.attractStage(parseInt(params.get('s'), 10) - 1);
      if (params.get('demo') === '1') T.attractDemo();
      step(F || 240);
      out('attract planes=' + T.attract().planes.length + ' shots=' + T.attract().shots.length);
      return;
    }

    var shipSel = params.get('ship');
    if (shipSel !== null && el('ship' + shipSel)) {
      el('ship' + shipSel).click();
      out('ship selected: ' + el('ship' + shipSel).textContent.trim().split(String.fromCharCode(10))[0]);
    }

    T.newGame();
    await sleep(400);

    if (scene === 'stage1') { T.setPower(3, 2); holdKey('z'); step(F || 400); return; }

    if (scene === 'play') {
      T.setPower(parseInt(params.get('p') || '3', 10), 2);
      holdKey('z');
      var total = F || 400, half = Math.floor(total / 2);
      holdKey('ArrowLeft'); step(half); releaseKey('ArrowLeft');
      holdKey('ArrowRight'); step(total - half); releaseKey('ArrowRight');
      return;
    }

    /* 무적으로 스테이지를 끝까지 흘려 본다 */
    if (scene === 'full') {
      var s = parseInt(params.get('s') || '1', 10) - 1;
      if (s > 0) { T.startStage(s, true); await sleep(400); }
      T.god(); T.setPower(5, 3); holdKey('z');
      var n = F || 4200, chunk = 60, moved = 0;
      while (moved < n) {
        if ((moved / chunk) % 2 === 0) { releaseKey('ArrowRight'); holdKey('ArrowLeft'); }
        else { releaseKey('ArrowLeft'); holdKey('ArrowRight'); }
        step(Math.min(chunk, n - moved));
        moved += chunk;
      }
      return;
    }

    /* 지상 목표물: 등장·사격·파괴 확인 */
    if (scene === 'ground') {
      var gs = parseInt(params.get('s') || '1', 10) - 1;
      if (gs > 0) { T.startStage(gs, true); await sleep(400); }
      T.god(); T.setPower(parseInt(params.get('p') || '3', 10), 3);
      if (params.get('fire') !== '0') holdKey('z');
      var seenMax = 0, killedBefore = T.G.score;
      for (var k = 0; k < (F || 1200) / 20; k++) {
        step(20);
        seenMax = Math.max(seenMax, T.grounds().length);
      }
      out('ground peak=' + seenMax + ' alive=' + T.grounds().length +
          ' score gained=' + (T.G.score - killedBefore));
      return;
    }

    /* 특수 적 표식·예고선 확인 */
    if (scene === 'marks') {
      T.god(); T.setPower(3, 2);
      T.spawnType('sniper', 110, 120, 'hover', 'snipe');
      T.spawnType('kamikaze', 240, 60, 'chase', 'none');
      T.spawnType('bomber', 370, 110, 'hover', 'drop');
      step(F || 150);
      var cues = T.enemies().filter(function (e) { return e.lockAng !== null; }).length;
      var bombs = T.eBullets().filter(function (b) { return b.split !== undefined; }).length;
      out('조준 중=' + cues + ' 투하 폭탄=' + bombs + ' 적=' + T.enemies().length);
      return;
    }

    /* 차지샷이 지상 목표물에 맞는지 확인 */
    if (scene === 'chargeground') {
      T.god(); T.setPower(5, 3);
      var g1 = T.spawnGroundAt('tank', 240, 300);
      var g2 = T.spawnGroundAt('bunker', 150, 260);
      out('before: tank hp=' + g1.hp + ' bunker hp=' + g2.hp + ' count=' + T.grounds().length);
      T.fireCharge();
      step(40);
      /* 흐르는 지상체에 빗맞는 거리까지 확인 */
      var off = [0, 20, 35, 45, 60];
      var res = off.map(function (d) {
        var g = T.spawnGroundAt('tank', 240, 320);
        T.shootAt(60, 240 - d, 560, true);
        step(46);
        var alive = T.grounds().indexOf(g) >= 0;
        if (alive) { g.hp = -1; }
        return d + 'px:' + (alive ? 'miss' : 'hit');
      });
      out('offset test ' + res.join(' '));
      out('after charge: count=' + T.grounds().length +
          ' list=' + T.grounds().map(function (g) { return g.type + ':' + Math.round(g.hp); }).join(','));
      return;
    }

    if (scene === 'items') { T.fakeItems(); step(F || 40); return; }
    if (scene === 'pickup') {
      T.fakeItems();
      var before = T.P.power + '/' + T.P.bombs + '/' + T.P.lives;
      T.god();
      step(700);
      out('items before=' + before + ' after=' + T.P.power + '/' + T.P.bombs + '/' + T.P.lives +
          ' remaining=' + T.items().length);
      return;
    }
    if (scene === 'mid') {
      var ms = parseInt(params.get('s') || '1', 10) - 1;
      if (ms > 0) { T.startStage(ms, true); await sleep(400); }
      T.setPower(4, 2); T.spawnMid(); step(F || 260);
      return;
    }
    if (scene === 'bomb') { T.setPower(5, 3); T.god(); step(F || 240); T.bomb(); step(parseInt(params.get('after') || '6', 10)); return; }

    if (scene === 'hud') {
      T.startStage(parseInt(params.get('s') || '2', 10) - 1, true);
      await sleep(400);
      T.setPower(4, 3);
      T.forceBoss();
      step(40);
      T.killPart(params.get('part') || 'ammo');
      holdKey('z');
      step(55);
      return;
    }

    if (scene.indexOf('boss') === 0) {
      var idx = parseInt(scene.slice(4), 10) - 1;
      T.startStage(idx, true);
      await sleep(400);
      T.setPower(5, 3);
      holdKey('z');
      step(30);
      T.forceBoss();
      var ph = params.get('phase');
      if (ph) T.hurtBoss(parseFloat(ph));
      step(F || 150);
      return;
    }

    if (scene === 'clear') {
      T.startStage(parseInt(params.get('s') || '1', 10) - 1, true);
      await sleep(400);
      T.forceBoss();
      T.killBossNow();
      for(var ci=0;ci<600&&T.G.state!=='clear';ci++)step(1);
      if(T.G.state!=='clear')throw new Error('clear screen did not open');
      out('after kill: state=' + T.G.state + ' clearScreen=' + visible('scClear'));
      out('clearList: ' + el('clearList').textContent.replace(/\s+/g, ' ').trim());
      if(el('btnNext'))throw new Error('next stage button still exists');
      step(120);if(T.G.state!=='clear')throw new Error('clear ended before 3 seconds');
      step(65);
      if(T.G.state==='clear')throw new Error('clear did not advance automatically');
      out('PASS clear holds 2 seconds and advances after 3 seconds without button');
      await sleep(400);
      out('after next: state=' + T.G.state + ' stage=' + (T.G.stageIndex + 1));
      step(120);
      return;
    }

    if (scene === 'over') {
      step(60);
      for (var d = 0; d < 6; d++) { T.killPlayer(); step(120); }
      out('after deaths: state=' + T.G.state + ' overScreen=' + visible('scOver'));
      el('btnContinue').click();
      await sleep(400);
      out('after continue: state=' + T.G.state + ' lives=' + T.P.lives + ' continues=' + T.G.continues);
      step(60);
      return;
    }

    if (scene === 'ending') {
      T.startStage(Stages.STAGES.length-1, true);
      await sleep(400);
      T.forceBoss();
      T.killBossNow();
      step(200);
      step(200);
      await sleep(200);
      out('after next: state=' + T.G.state + ' endScreen=' + visible('scEnd') +
          ' finalScore=' + el('eScore').textContent);
      if (params.get('back') === '1') {
        el('btnEndBack').click();
        step(60);
        out('back to title: ' + visible('scTitle') + ' ranking=' +
            el('ranking').textContent.replace(/\s+/g, ' ').trim());
      }
      return;
    }

    if (scene === 'pause') {
      step(60);
      holdKey('p');
      step(3);
      out('paused: state=' + T.G.state + ' screen=' + visible('scPause'));
      el('btnResume').click();
      step(30);
      out('resumed: state=' + T.G.state);
      return;
    }

    step(F || 120);
  }

  function report() {
    var T = window.__T, G = T.G, P = T.P;
    out('state=' + G.state + ' stage=' + (G.stageIndex + 1) + ' time=' + G.stageTime.toFixed(1) + ' quality=' + G.quality);
    out('score=' + G.score + ' combo=' + G.combo + ' maxCombo=' + G.maxCombo);
    out('enemies=' + T.enemies().length + ' ground=' + T.grounds().length +
        ' ebul=' + T.eBullets().length + ' pbul=' + T.pBullets().length + ' items=' + T.items().length);
    var b = T.getBoss();
    out('boss=' + (b ? b.name + ' hp=' + Math.round(b.hp) + '/' + b.maxHp + ' ph=' + b.phase + ' st=' + b.state +
      ' partsAlive=' + b.parts.filter(function (p) { return p.alive; }).length : 'none'));
    out('player alive=' + P.alive + ' lives=' + P.lives + ' power=' + P.power + ' bombs=' + P.bombs +
      ' pos=' + Math.round(P.x) + ',' + Math.round(P.y));
    out('errors=' + errs.length);
    try {
      var shot = el('SHOT');
      if (shot) shot.textContent = el('game').toDataURL('image/png');
    } catch (e) { out('SHOT FAIL: ' + e.message); }
    out('DONE');
  }

  var waited = 0;
  function waitReady() {
    if (window.__T && window.__T.G.state !== 'load') {
      out('ready after ' + waited + 'ms');
      run().then(report, function (err) { out('RUN ERROR: ' + err.message + ' | ' + err.stack); report(); });
      return;
    }
    waited += 50;
    if (waited > 20000) { out('FAIL: assets not ready'); out('DONE'); return; }
    setTimeout(waitReady, 50);
  }
  setTimeout(waitReady, 50);
})();
