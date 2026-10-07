/* 아이언 스트라이커 — 7스테이지 EASY/HARD 종스크롤 슈팅 코어 */
const Game = (function () {
  'use strict';

  /* ── 기본 설정 ─────────────────────────────── */
  const W = 480, H = 720;                 // 논리 해상도(그리기 좌표)
  const MAX_EBULLET = 240, MAX_PART = 220, MAX_PBULLET = 140;

  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d', { alpha: false });
  const $ = function (id) { return document.getElementById(id); };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* HTML 메뉴와 캔버스 HUD에 같은 한글 아케이드 서체를 사용한다. */
  const FONT = '"NeoDunggeunmo","Malgun Gothic",monospace';

  /* 학교 관리형 브라우저·사생활 보호 모드처럼 저장소가 막힌 환경에서도 게임은 계속 돌아가야 한다.
     읽기 실패는 기본값, 쓰기 실패는 이번 실행에서만 유지되는 값으로 처리한다. */
  const store = {
    get: function (key) { try { return localStorage.getItem(key); } catch (err) { return null; } },
    set: function (key, value) { try { localStorage.setItem(key, value); return true; } catch (err) { return false; } }
  };

  let renderScale = 1;
  let highQuality = store.get('is_quality') !== '0';
  let autoCharge = store.get('is_autocharge') !== '0';
  let selectedDifficulty = Difficulty.normalize(store.get('is_difficulty'));

  function resize() {
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const fit = rect.width > 0 ? rect.width / W : 1;
    let s = Math.min(highQuality ? 1.5 : 1, Math.max(1, fit * Math.min(dpr, 2)));
    s = Math.round(s * 4) / 4;
    if (s === renderScale && cv.width === Math.round(W * s)) return;
    renderScale = s;
    cv.width = Math.round(W * s);
    cv.height = Math.round(H * s);
    Assets.clearSizedCaches();
  }

  /* ── 상태 ─────────────────────────────────── */
  const G = {
    state: 'load',            // load | title | help | play | pause | clear | over | end
    score: 0,
    difficulty: selectedDifficulty,
    hasRun: false, scoreSaved: false,
    hi: +(store.get(Difficulty.recordKeys(selectedDifficulty).hi) || 0),
    lastScore: +(store.get(Difficulty.recordKeys(selectedDifficulty).last) || 0),
    stageIndex: 0,
    stageTime: 0,
    scriptIdx: 0,
    continues: 0,
    stageMiss: 0,
    combo: 0, comboT: 0, maxCombo: 0,
    shake: 0, flash: 0, bombFlash: 0, hitStop: 0,
    bulletBonus: 0,
    warning: 0, titleCard: 0,
    bossPending: false, midbossDefeated: false,
    bossCleared: false,
    slowFrames: 0, quality: 1,
    nextExtend: 300000,
    bulletMul: 1
  };

  const P = {
    x: W / 2, y: H - 110,
    power: 1, bombs: 2, lives: 3,
    inv: 0, fireCd: 0, missileCd: 0,
    charge: 0, chargeFull: 0, firingPrev: false,
    bank: 0, alive: true, deadT: 0,
    hitR: 5
  };

  let enemies = [], grounds = [], pBullets = [], eBullets = [], items = [], parts = [], floats = [];
  let effects = [];   // 지연 연출: 게임이 멈추면 함께 멈춘다
  let bombRun = null;
  let boss = null;
  let bgScroll = 0, bgReady = false, bgError = '';
  const formations = Object.create(null);
  let formSeq = 0;

  /* ── 유틸 ─────────────────────────────────── */
  const rand = function (a, b) { return a + Math.random() * (b - a); };
  const clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  function removeAt(arr, i) { arr[i] = arr[arr.length - 1]; arr.pop(); }
  function stage() { return Stages.STAGES[G.stageIndex]; }
  function mode() { return Difficulty.get(G.difficulty); }

  /* ── 효과 ─────────────────────────────────── */
  function shake(v) { if (!reduceMotion) G.shake = Math.min(14, G.shake + v); }

  function addParticle(p) {
    if (parts.length < MAX_PART) parts.push(p);
  }

  /* 불똥. 네모가 아니라 발광 점으로 튄다. */
  function spawnParticles(x, y, n, color, spd, size) {
    const cool = color === '#cfe6ff' || color === '#9fd0ff';
    const count = Math.max(1, Math.round(n * G.quality));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(spd * .4, spd);
      addParticle({
        type: 'spark', cool: cool,
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(.18, .4), max: .4, size: Math.max(2.5, size * rand(1.1, 2.2))
      });
    }
  }

  function boom(x, y, size, color) {
    const cool = color === '#9fd0ff';
    const duration = size < 40 ? .72 : .95;
    addParticle({ x: x, y: y, vx: 0, vy: 0, life: duration, max: duration, size: size * 2.8, explosion: true });
    spawnParticles(x, y, size < 40 ? 5 : 9, color || '#ffbd65', size * 3.4, size * .06);
    if (cool) addParticle({ type: 'ring', cool: true, x: x, y: y, life: .3, max: .3, size: size * .55 });
    shake(size * .08);
  }

  /* 격추 순간 기체가 하얗게 타오르며 사라진다 */
  function flashWreck(art, x, y, vx, vy) {
    if (!art) return;
    addParticle({
      type: 'wreck', art: art, x: x, y: y,
      vx: vx || 0, vy: vy || 0, rot: 0, spin: rand(-3.2, 3.2),
      life: .22, max: .22
    });
  }
  /* 일정 시간 뒤에 실행할 연출. setTimeout 과 달리 일시정지·화면 전환에 따라간다. */
  function later(sec, fn) { effects.push({ t: sec, fn: fn }); }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].t -= dt;
      if (effects[i].t <= 0) {
        const fn = effects[i].fn;
        removeAt(effects, i);
        fn();
      }
    }
  }

  function floatText(x, y, text, color) {
    if (floats.length > 24) return;
    floats.push({ x: x, y: y, text: text, life: .9, color: color || '#ffe9a8' });
  }

  /* ── 점수 ─────────────────────────────────── */
  function comboMul() { return 1 + Math.min(G.combo, 40) * .1; }

  function addScore(base, x, y, showText) {
    const gained = Math.round(base * comboMul());
    G.score += gained;
    if (G.score >= G.nextExtend) {
      G.nextExtend += 300000;
      if (P.lives < 5) { P.lives++; Snd.play('extend'); floatText(P.x, P.y - 40, '잔기 +1', '#9fe8a0'); }
    }
    if (showText) floatText(x, y, '+' + gained, '#ffe9a8');
  }
  function registerKill() {
    G.combo++; G.comboT = 2.5;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
  }

  /* ── 적 생성 ──────────────────────────────── */
  function makeEnemy(typeKey, x, y, opts) {
    const base = Stages.enemyForStage(typeKey, G.stageIndex);
    const hpMul = (stage().enemyHpMul || 1) * mode().enemyHp;
    const e = {
      typeKey: typeKey, art: base.art, banks: base.banks, heavy: !!base.heavy, tint: base.tint || null,
      x: x, y: y, vx: 0, vy: 0,
      w: base.w * (opts.scale || 1),
      hit: base.hit * (opts.scale || 1),
      hp: Math.max(1, Math.round(base.hp * hpMul)),
      maxHp: Math.max(1, Math.round(base.hp * hpMul)),
      score: base.score,
      move: opts.move || base.move || 'straight',
      fire: opts.fire || base.fire || 'none',
      speed: opts.speed || base.speed || 130,
      x0: x, t: rand(0, 6), age: 0, bank: 0, flash: 0,
      fireCt: rand(.7, 1.8),
      dir: opts.dir || (x < W / 2 ? 1 : -1),
      targetY: opts.targetY || rand(110, 210),
      hoverT: 0,
      lockAng: null,          // 저격기: 발사 직전 고정한 조준 각도
      form: opts.form || null,
      vx: 0, vy: (opts.move === 'chase') ? (opts.speed || 130) * .7 : 0,
      prop: base.prop
    };
    enemies.push(e);
    return e;
  }

  function spawnFormation(ev) {
    const id = ++formSeq;
    const count = Difficulty.formationCount(ev,G.difficulty);
    formations[id] = { total: count, alive: count, drop: ev.drop, x: W / 2, y: 120 };
    const side = ev.from !== 'top';
    const dir = ev.from === 'left' ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const off = Stages.slotOffset(ev.shape, i, count);
      const delay = ev.shape === 'column' ? i * ev.gap : 0;
      let sx, sy, move = ev.move;
      if (side) {
        /* 옆에서 들어오는 편대는 화면 밖에서 한 줄로 이어져 들어온다 */
        sx = (dir > 0 ? -60 : W + 60) - dir * i * 54;
        sy = 70 + (i % 2) * 26 + Math.abs(off.y);
        move = 'swoop';
      } else {
        sx = clamp(ev.x * W + off.x, 24, W - 24);
        sy = -60 - off.y - delay * ev.speed;
      }
      makeEnemy(ev.type, sx, sy, {
        move: move, fire: ev.fire, speed: ev.speed, form: id,
        dir: side ? dir : (sx < W / 2 ? 1 : -1)
      });
    }
  }

  function spawnMidboss() {
    G.midbossDefeated = false;
    if (!boss && G.warning > 0) { G.warning = 0; G.bossPending = true; }
    const def = Stages.MIDBOSS[G.stageIndex] || Stages.MIDBOSS[0];
    const e = makeEnemy('heavy', W / 2, -130, { move: 'hover', fire: 'none', speed: 62, targetY: 152 });
    const medium = Stages.ENEMY.medium;
    e.isMidboss = true;
    e.mid = def;
    e.art = def.art;
    e.banks = !!def.banks;
    e.tint = def.tint;
    e.w = medium.w * def.scale;
    e.hit = medium.hit * def.scale;
    e.hp = e.maxHp = Math.round(def.hp * mode().midHp);
    e.score = def.score;
    e.fireCt = 1.4;
    e.step = 0;
    e.dashCt = 2.2;
    e.dashX = 0;
    e.escortCt = 3.2;
    Snd.play('warning');
    floatText(W / 2, 210, def.name + ' 접근', '#ffb35c');
    return e;
  }

  /* 중간보스 이동·공격: 스테이지마다 다르다 */
  function midbossMove(e, dt) {
    /* 자리를 잡았는지는 좌표가 아니라 도착 여부로 판단한다.
       좌표로 보면 아래위 흔들림이 targetY 보다 위로 갈 때마다 다시 '하강 중'이 되어,
       위아래로 튕기고 그 프레임에는 좌우 이동도 멈춰 움직임이 끊겼다. */
    if (!e.arrived) {
      e.y += e.speed * dt;
      if (e.y >= e.targetY) { e.y = e.targetY; e.arrived = true; }
      return;
    }
    e.hoverT += dt;
    /* e.t 는 등장 전부터 쌓이므로 그대로 쓰면 자리를 잡는 순간 세로 위치가 튄다.
       도착 후부터 쌓는 위상을 따로 두어 targetY 에서 이어지게 한다. */
    e.bobT = (e.bobT || 0) + dt;
    if (e.mid.move === 'dash') {
      e.dashCt -= dt;
      if (e.dashCt <= 0) {
        e.dashCt = 2.6;
        e.dashSide = -(e.dashSide || -1);        // 좌우를 번갈아 잡아 종잡을 수 없이 튀지 않게 한다
        e.dashX = e.dashSide * rand(70, 130);
      }
      e.x += (W / 2 + e.dashX - e.x) * Math.min(1, dt * 2.2);
      e.y = e.targetY + Math.sin(e.bobT * 1.2) * 16;
    } else if (e.mid.move === 'slow') {
      e.x += Math.sin(e.t * .55) * 34 * dt;
      e.y = e.targetY + Math.sin(e.bobT * .5) * 20;
    } else {
      e.x += Math.sin(e.t * .9) * 58 * dt;
      e.y = e.targetY + Math.sin(e.bobT * .8) * 12;
    }
    e.x = clamp(e.x, e.w * .4, W - e.w * .4);
    // 중간보스는 시간 제한으로 퇴장하지 않고 격파될 때까지 전장에 남는다.
  }

  function midbossFire(e, dt) {
    if (!P.alive || e.y < 40) return;

    /* 호위기를 주기적으로 붙인다 */
    if (e.mid.escort) {
      e.escortCt -= dt;
      if (e.escortCt <= 0) {
        e.escortCt = e.mid.escortCd || 7;
        [-1, 1].forEach(function (side) {
          const es = makeEnemy(e.mid.escort, clamp(e.x + side * 72, 30, W - 30), e.y + 10, {
            move: 'dive', fire: 'aimed', speed: 175
          });
          es.dir = side;
        });
      }
    }

    e.fireCt -= dt;
    if (e.fireCt > 0) return;
    const spd = 140 * G.bulletMul;
    const a = aimAngle(e.x, e.y);
    switch (e.mid.pattern) {
      case 'ring':
        if (e.step % 2 === 0) eRing(e.x, e.y, 14, spd * .7, e.t, 'eSmall');
        else eFan(e.x, e.y + 18, a, 3, .5, spd, 'eBig');
        if (e.step % 6 === 5) eMissile(e.x, e.y + 18, spd);
        e.fireCt = 1.15;
        break;
      case 'burst':
        eFan(e.x, e.y + 18, a, 3, .26, spd * 1.25, 'eSmall');
        if (e.step % 3 === 2) eFan(e.x, e.y + 18, Math.PI / 2, 8, 1.8, spd * .8, 'eSmall');
        if (e.step % 5 === 4) eMissile(e.x, e.y + 18, spd * 1.05);
        e.fireCt = .8;
        break;
      case 'carpet': {
        const b = eShot(e.x + rand(-40, 40), e.y + 20, rand(-26, 26), 95, 'eBig');
        if (b) b.split = 1.15;
        if (e.step % 2 === 1) eFan(e.x, e.y + 18, Math.PI / 2, 5, 1.3, spd * .75, 'eSmall');
        if (e.step % 3 === 2) { eMissile(e.x - 26, e.y + 16, spd); eMissile(e.x + 26, e.y + 16, spd); }
        e.fireCt = 1.25;
        break;
      }
      case 'mixed':
        if (e.step % 3 === 2) eRing(e.x, e.y, 16, spd * .72, -e.t, 'eSmall');
        else eFan(e.x, e.y + 18, a, 5, .9, spd * 1.05, e.step % 2 ? 'eBig' : 'eSmall');
        if (e.step % 4 === 3) { eMissile(e.x - 34, e.y + 14, spd); eMissile(e.x + 34, e.y + 14, spd); }
        e.fireCt = .85;
        break;
      default:
        eFan(e.x, e.y + 18, a, 3, .42, spd, 'eSmall');
        if (e.step % 3 === 2) eFan(e.x, e.y + 18, Math.PI / 2, 6, 1.5, spd * .8, 'eSmall');
        if (e.step % 6 === 5) eMissile(e.x, e.y + 18, spd * .95);
        e.fireCt = 1.1;
    }
    e.step++;
  }

  /* ── 지상 목표물 ──────────────────────────── */
  function spawnGround(ev) {
    const base = Stages.groundForStage(ev.type, G.stageIndex);
    if (!base) return null;
    const hpMul = (stage().groundHpMul || 1) * mode().groundHp;
    const t = {
      type: ev.type, def: base,
      x: clamp(ev.x * W, base.w * .5, W - base.w * .5),
      y: -base.w,
      w: base.w, hit: base.hit,
      hp: Math.round(base.hp * hpMul), maxHp: Math.round(base.hp * hpMul),
      score: base.score,
      ang: 0, t: 0, flash: 0,
      fireCt: base.cd ? rand(base.cd[0], base.cd[1]) * .6 : 0,
      drift: base.drift ? (Math.random() < .5 ? -1 : 1) : 0,
      drop: ev.drop || null
    };
    grounds.push(t);
    return t;
  }

  function killGround(t) {
    t.dead = true;
    registerKill();
    addScore(t.score, t.x, t.y, true);
    flashWreck(Assets.body('ground', t.def.base, t.w), t.x, t.y, 0, stage().scroll * .4);
    boom(t.x, t.y, t.def.blast ? 62 : 36);
    Snd.play(t.def.blast ? 'explodeB' : 'explodeS');
    if (t.drop) dropItem(t.x, t.y, t.drop);
    /* 연료 저장고는 주변 지상 목표물까지 터뜨린다 */
    if (t.def.blast) {
      grounds.forEach(function (o) {
        if (o !== t && !o.dead && Math.hypot(o.x - t.x, o.y - t.y) < t.def.blast) {
          damageGround(o, 30);
        }
      });
      shake(6);
    }
  }

  function damageGround(t, dmg) {
    if (t.dead) return;
    t.hp -= dmg;
    t.flash = .08;
    if (t.hp <= 0) killGround(t);
    else Snd.play('hit');
  }

  function updateGround(dt) {
    const scroll = stage().scroll;
    for (let i = grounds.length - 1; i >= 0; i--) {
      const t = grounds[i];
      t.t += dt;
      if (t.flash > 0) t.flash -= dt;
      t.y += scroll * dt;                       // 배경과 같은 속도로 흘러간다
      if (t.drift) {
        t.x += t.drift * t.def.drift * dt;
        if (t.x < t.w * .5 || t.x > W - t.w * .5) t.drift *= -1;
      }
      if (t.def.rot === 'spin') t.ang += dt * 1.7;
      else if (t.def.rot === 'aim' && P.alive) t.ang = Math.atan2(P.y - t.y, P.x - t.x) + Math.PI / 2;

      if (t.def.fire !== 'none' && P.alive && t.y > 40 && t.y < H - 60) {
        t.fireCt -= dt * mode().attackRate;
        if (t.fireCt <= 0) {
          const spd = 132 * G.bulletMul;
          const a = aimAngle(t.x, t.y);
          if (t.def.fire === 'aimed') {
            eShot(t.x, t.y, Math.cos(a) * spd, Math.sin(a) * spd, 'eSmall');
          } else if (t.def.fire === 'aimed2') {
            [-.09, .09].forEach(function (o) {
              eShot(t.x, t.y, Math.cos(a + o) * spd, Math.sin(a + o) * spd, 'eSmall');
            });
          } else if (t.def.fire === 'missile') {
            eMissile(t.x, t.y, spd * 1.1);
            if (G.stageIndex >= 3) eMissile(t.x + rand(-18, 18), t.y, spd);
          } else if (t.def.fire === 'spread3') {
            for (let k = -1; k <= 1; k++) {
              eShot(t.x, t.y, Math.cos(a + k * .3) * spd * .9, Math.sin(a + k * .3) * spd * .9, 'eSmall');
            }
          }
          t.fireCt = rand(t.def.cd[0], t.def.cd[1]);
        }
      }

      if (t.dead || t.y > H + t.w) removeAt(grounds, i);
    }
  }

  function drawGroundArt(def, x, y, ang, drift, w, flash) {
    const turn = def.art === 'stage4Artillery' ? Math.sin(ang) : drift;
    const pose = turn < -.25 ? 'left' : turn > .25 ? 'right' : 'neutral';
    const special = def.art && Assets.body(def.art, pose, w);
    const base = special || Assets.body('ground', def.base, w);
    if (!base) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flash) ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(base.c, -base.px, -base.py);
    if (!special && def.gun) {
      const gun = Assets.body('ground', def.gun, w);
      if (gun) { ctx.rotate(ang); ctx.drawImage(gun.c, -gun.px, -gun.py); }
    }
    ctx.restore();
  }

  function drawGround() {
    for (let i = 0; i < grounds.length; i++) {
      const t = grounds[i];
      if (t.y < -t.w || t.y > H + t.w) continue;
      drawGroundArt(t.def, t.x, t.y, t.ang, t.drift, t.w, t.flash > 0);
      /* 내구도가 높은 시설만 막대를 보여 준다 */
      if (t.maxHp > 30) {
        const bw = t.w * .6, ratio = Math.max(0, t.hp / t.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(t.x - bw / 2, t.y + t.w * .42, bw, 3);
        ctx.fillStyle = ratio > .3 ? '#7fd08a' : '#e8a33d';
        ctx.fillRect(t.x - bw / 2, t.y + t.w * .42, bw * ratio, 3);
      }
    }
  }

  /* 보스 격납고 등에서 즉시 사출하는 소형기 */
  function spawnMini(x, y, opts) {
    opts = opts || {};
    const e = makeEnemy('mini', x, y, { move: 'dive', fire: 'aimed', speed: opts.speed || 175 });
    e.dir = x < W / 2 ? -1 : 1;
    return e;
  }

  /* ── 플레이어 기체와 무기 ─────────────────── */
  /* 각 항목은 [총구 x오프셋, (미사용), 좌우 퍼짐] 이다. */
  const VULCAN_A = [
    [[0, -1, 0]],
    [[-7, -1, 0], [7, -1, 0]],
    [[-10, -1, -.06], [0, -1, 0], [10, -1, .06]],
    [[-13, -1, -.09], [-5, -1, -.02], [5, -1, .02], [13, -1, .09]],
    [[-16, -1, -.14], [-8, -1, -.05], [0, -1, 0], [8, -1, .05], [16, -1, .14]],
    [[-18, -1, -.2], [-11, -1, -.1], [-4, -1, -.02], [4, -1, .02], [11, -1, .1], [18, -1, .2]]
  ];
  const VULCAN_B = [
    [[0, -1, 0]],
    [[-8, -1, -.05], [8, -1, .05]],
    [[-12, -1, -.13], [0, -1, 0], [12, -1, .13]],
    [[-16, -1, -.21], [-6, -1, -.07], [6, -1, .07], [16, -1, .21]],
    [[-18, -1, -.27], [-9, -1, -.14], [0, -1, 0], [9, -1, .14], [18, -1, .27]],
    [[-20, -1, -.35], [-14, -1, -.24], [-7, -1, -.12], [0, -1, 0], [7, -1, .12], [14, -1, .24], [20, -1, .35]]
  ];

  /* 기체별 전용 원화와 무기 구성을 선택한다. */
  const SHIPS = [
    {
      id: 'striker', name: '스트라이커', en: 'STRIKER', desc: '연사형 · 관통 차지샷',
      art: 'player', tint: null, pod: '#d8544a', prop: '#ef5647',
      vulcan: VULCAN_A, dmg: 1.2, fireCd: .105, podFrom: 3, podDmg: 1.0,
      missiles: true, chargeDmg: 60, chargeTime: 1.5
    },
    {
      id: 'lancer', name: '랜서', en: 'LANCER', desc: '확산형 · 넓은 탄막',
      art: 'lancer', tint: null, pod: '#ffce6a', prop: '#ffb347',
      vulcan: VULCAN_B, dmg: 1.0, fireCd: .12, podFrom: 2, podDmg: 1.0,
      missiles: false, chargeDmg: 84, chargeTime: 1.35
    }
  ];
  let shipIndex = Math.max(0, Math.min(SHIPS.length - 1, +(store.get('is_ship') || 0)));
  function ship() { return SHIPS[shipIndex]; }

  function podPositions() {
    const a = performance.now() / 420;
    return [
      { x: P.x - 30 + Math.sin(a) * 4, y: P.y + 14 + Math.cos(a) * 3 },
      { x: P.x + 30 - Math.sin(a) * 4, y: P.y + 14 + Math.cos(a) * 3 }
    ];
  }

  function pShot(x, y, vx, vy, dmg, style, pierce) {
    if (pBullets.length > MAX_PBULLET) return null;
    const b = {
      x: x, y: y, vx: vx, vy: vy, dmg: dmg, style: style,
      pierce: !!pierce, r: style === 'charge' ? 20 : 5,
      hits: pierce ? [] : null,   // 관통탄이 같은 대상을 반복 타격하지 않도록
      bossCt: 0, t: 0, palette:ship().id==='lancer'?'gold':'blue'
    };
    pBullets.push(b);
    return b;
  }

  function fireVulcan() {
    const sh = ship();
    const set = sh.vulcan[clamp(P.power, 1, 5)];
    const speed = 720;
    for (let i = 0; i < set.length; i++) {
      const s = set[i];
      pShot(P.x + s[0], P.y - 22, s[2] * speed, -speed, sh.dmg, sh.id==='lancer'?'lance':'vulcan');
    }
    if (P.power >= sh.podFrom) {
      podPositions().forEach(function (p) { pShot(p.x, p.y - 8, 0, -640, sh.podDmg, sh.id==='lancer'?'lancePod':'pod'); });
    }
    Snd.play('shot');
  }

  /* 유도 미사일. 화력 4부터 2발, 5에서 4발이 나간다. */
  function missileTarget() {
    let best = null, bd = 1e9;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.y < -20) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < bd) { bd = d; best = e; }
    }
    for (let i = 0; i < grounds.length; i++) {
      const t = grounds[i];
      if (t.dead || t.y < 0) continue;
      const d = Math.hypot(t.x - P.x, t.y - P.y) * 1.2;   // 공중 표적을 조금 더 선호
      if (d < bd) { bd = d; best = t; }
    }
    if (!best && boss && boss.state === 'fight') best = boss;
    return best;
  }

  function fireMissiles(count) {
    const target = missileTarget();
    const offsets = count >= 4 ? [-30, -16, 16, 30] : [-24, 24];
    offsets.forEach(function (ox) {
      const tx = target ? target.x : P.x + ox * 3;
      const ty = target ? target.y : -120;
      const a = Math.atan2(ty - P.y, tx - (P.x + ox));
      const b = pShot(P.x + ox, P.y - 6, Math.cos(a) * 430, Math.sin(a) * 430, 7, 'missile');
      if (b) { b.homing = 1.1; b.turn = 4.2; b.maxSpd = 620; b.target = target; }
    });
    Snd.play('missile');
  }

  function fireCharge() {
    pShot(P.x, P.y - 34, 0, -840, ship().chargeDmg, 'charge', true);
    P.chargeRelease = .28;
    P.charge = 0; P.chargeFull = 0;
    Snd.play('chargeFire');
    shake(4);
  }

  function useBomb() {
    if (G.state !== 'play' || P.bombs <= 0 || !P.alive || bombRun) return;
    P.bombs--;
    const lancer=ship().id==='lancer';
    bombRun = lancer?LancerBurst.create(W,H,P):BombRun.create(W,H);
    P.inv = Math.max(P.inv, (lancer?LancerBurst.DURATION:BombRun.DURATION)+.3);
    if(lancer){P.charge=0;P.chargeFull=0;P.chargeRelease=0;}
    G.bombFlash = reduceMotion ? 0 : .1;
    Snd.play('bomb');
    shake(4);
    eBullets.length = 0;
    floatText(W/2,H*.73,lancer?'랜서 · 초고출력 에너지포':'지원기 접근 · 전면 폭격',lancer?'#ffe4a0':'#bce8ff');
    updateBombBtn();
  }

  function bombImpact(x,y,radius,run) {
    for(let i=eBullets.length-1;i>=0;i--) {
      if(Math.hypot(eBullets[i].x-x,eBullets[i].y-y)<radius) removeAt(eBullets,i);
    }
    enemies.forEach(function(e){
      if(!e.dead && !run.hitEnemies.has(e) && Math.hypot(e.x-x,e.y-y)<radius+e.hit) {
        run.hitEnemies.add(e); damageEnemy(e,140,e.x,e.y);
      }
    });
    grounds.slice().forEach(function(g){
      if(!g.dead && !run.hitGrounds.has(g) && Math.hypot(g.x-x,g.y-y)<radius+g.hit) {
        run.hitGrounds.add(g); damageGround(g,120);
      }
    });
    if(boss && boss.state==='fight' && !run.hitBosses.has(boss) &&
      Math.abs(boss.x-x)<boss.hitW/2+radius && Math.abs(boss.y-y)<boss.hitH/2+radius) {
      run.hitBosses.add(boss);damageBoss(350,boss.x,boss.y,null);
    }
    // 인접 착탄의 음향이 겹쳐 찢어지지 않도록 한 줄당 한 번만 울린다.
    if(x<65) {Snd.play('explodeB');shake(3);}
  }

  function updateBombRun(dt) {
    if(!bombRun)return;
    if(bombRun.kind==='lancer'){
      if(LancerBurst.update(bombRun,dt,P,lancerPulse,()=>{Snd.play('chargeFire');shake(7);}))bombRun=null;
    }else if(BombRun.update(bombRun,dt,bombImpact)) bombRun=null;
  }

  function lancerPulse(run,dt){
    const hit=(x,y,rx,ry)=>LancerBurst.intersects(run,x,y,rx,ry);
    for(let i=eBullets.length-1;i>=0;i--)if(hit(eBullets[i].x,eBullets[i].y,6))removeAt(eBullets,i);
    enemies.slice().forEach(e=>{if(!e.dead&&hit(e.x,e.y,e.hit))damageEnemy(e,500*dt,e.x,e.y);});
    grounds.slice().forEach(g=>{if(!g.dead&&hit(g.x,g.y,g.hit))damageGround(g,400*dt);});
    if(boss&&boss.state==='fight'){
      const targets=boss.parts.filter(p=>p.alive&&!p.hidden&&hit(boss.x+p.ox*boss.w*(boss.flip?-1:1),boss.y+p.oy*boss.h,p.r));
      for(const p of targets){if(boss.state!=='fight')break;damageBoss(180*dt,boss.x,boss.y,p);}
      if(boss.state==='fight'&&hit(boss.x,boss.y,boss.hitW/2,boss.hitH/2))damageBoss(320*dt,boss.x,boss.y,null);
    }
  }

  /* ── 피해 처리 ────────────────────────────── */
  function damageEnemy(e, dmg, x, y) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = .08;
    if (e.hp <= 0) {
      e.dead = true;
      registerKill();
      addScore(e.score, e.x, e.y, e.score >= 500);
      flashWreck(Assets.body(e.art, 'neutral', e.w, e.tint), e.x, e.y, (e.vx || 0) * .3, (e.vy || 40) * .3);
      boom(e.x, e.y, e.heavy ? 54 : (e.w > 60 ? 34 : 22));
      Snd.play(e.heavy ? 'explodeB' : 'explodeS');
      if (e.isMidboss) {
        G.midbossDefeated = !enemies.some(function(other){return other.isMidboss && !other.dead;});
        for (let i = 0; i < 6; i++) {
          const bx = e.x + rand(-40, 40), by = e.y + rand(-30, 30);
          later(i * .09, function () { boom(bx, by, 34); });
        }
        G.hitStop = Math.max(G.hitStop, .22);
        dropItem(e.x, e.y, 'bomb');
        dropItem(e.x - 24, e.y, 'power');
      }
      if (e.form && formations[e.form]) {
        const f = formations[e.form];
        f.alive--;
        if (f.alive <= 0 && f.drop) dropItem(e.x, e.y, f.drop);
      }
    } else {
      Snd.play('hit');
    }
  }

  function damageBoss(dmg, x, y, part) {
    if (!boss || boss.state === 'dying') return;
    if (part) {
      if (!part.alive || part.hidden) return;
      part.hp = Math.max(0, part.hp - dmg * 1.5);
      part.flash = .08;
      boss.hp -= dmg * .35;
      if (part.hp <= 0) {
        part.alive = false;
        x = boss.x + part.ox * boss.w * (boss.flip ? -1 : 1);
        y = boss.y + part.oy * boss.h;
        boom(x, y, 52);
        Snd.play('explodeB');
        addScore(5000, x, y, true);
        floatText(x, y - 20, part.name + ' 파괴', '#9fe8a0');
        /* 부위를 잃으면 보스가 폭주한다 — 점수와 위험을 맞바꾼 것을 바로 알린다 */
        floatText(x, y - 44, '폭주 — 탄막 강화', '#ffb08a');
        shake(5);
      }
    } else {
      boss.hp -= dmg;
    }
    boss.flash = part ? 0 : .07;
    if (boss.hp <= 0) killBoss();
    else Snd.play('hit');
  }

  function killBoss() {
    boss.hp = 0;
    boss.state = 'dying';
    boss.dying = 0;
    boss.deathStep = 0;
    boss.explodeCt = 0;
    boss.finalBlast = false;
    Snd.play('bossDown');
    Snd.bgmStop();
    shake(12);
    G.hitStop = .5;
    addScore(20000 + G.stageIndex * 5000, boss.x, boss.y, true);
    /* 화면에 남은 적탄을 점수로 바꾼다 */
    G.bulletBonus = eBullets.length * 150;
    eBullets.forEach(function (b) {
      spawnParticles(b.x, b.y, 1, '#ffe9a8', 40, 3);
    });
    eBullets.length = 0;
    if (G.bulletBonus > 0) floatText(W / 2, H / 2 + 40, '잔탄 보너스 ' + G.bulletBonus.toLocaleString(), '#ffe9a8');
  }

  function hitPlayer() {
    if (!P.alive || P.inv > 0) return;
    P.alive = false;
    P.deadT = 0;
    P.lives--;
    P.power = mode().resetPower ? 1 : Math.max(1,P.power-1);
    G.stageMiss++;
    G.combo = 0;
    Snd.play('damage');
    boom(P.x, P.y, 48, '#9fd0ff');
    shake(10);
    /* 주변 탄을 지워 부활 직후 연속 피격을 막는다 */
    for (let i = eBullets.length - 1; i >= 0; i--) {
      if (Math.hypot(eBullets[i].x - P.x, eBullets[i].y - P.y) < 130) removeAt(eBullets, i);
    }
  }

  /* ── 아이템 ───────────────────────────────── */
  function dropItem(x, y, kind) {
    if (kind === 'power' && Math.random() < .06) kind = 'life';
    items.push({ x: x, y: y, vy: 42, kind: kind, t: 0 });
  }

  function takeItem(it) {
    if (it.kind === 'power') {
      if (P.power < 5) { P.power++; floatText(P.x, P.y - 34, '화력 ' + P.power, '#9fd0ff'); }
      else { addScore(3000, P.x, P.y, true); }
      Snd.play('power');
    } else if (it.kind === 'bomb') {
      if (P.bombs < 5) { P.bombs++; floatText(P.x, P.y - 34, '폭탄 ' + P.bombs, '#ffb35c'); }
      else addScore(3000, P.x, P.y, true);
      Snd.play('power');
      updateBombBtn();
    } else if (it.kind === 'life') {
      if (P.lives < 5) { P.lives++; floatText(P.x, P.y - 34, '잔기 +1', '#9fe8a0'); }
      else addScore(10000, P.x, P.y, true);
      Snd.play('extend');
    }
  }

  /* ── 보스가 쓰는 공개 함수 ────────────────── */
  function eShot(x, y, vx, vy, style) {
    if (eBullets.length >= MAX_EBULLET) return null;
    const r = style === 'eSmall' ? 4.5 : (style === 'eBig' ? 7 : 9);
    const speed = mode().bulletSpeed;
    const b = { x: x, y: y, vx: vx * speed, vy: vy * speed, style: style, r: r };
    eBullets.push(b);
    return b;
  }
  function aimAngle(x, y) { return Math.atan2(P.y - y, P.x - x); }

  /* 적 유도 미사일: 천천히 나가 기체 쪽으로 선회하며 가속한다 */
  function eMissile(x, y, spd, turnTime) {
    const a = aimAngle(x, y);
    const b = eShot(x, y, Math.cos(a) * spd * .45, Math.sin(a) * spd * .45, 'eMissile');
    if (b) {
      b.homing = turnTime === undefined ? 1.2 : turnTime;
      b.turn = 2.6 * mode().attackRate;
      b.accel = 210 * mode().bulletSpeed;
      b.maxSpd = spd * 1.35 * mode().bulletSpeed;
    }
    return b;
  }

  function eFan(x, y, baseAng, n, spread, spd, style) {
    n = Difficulty.patternCount(n,G.difficulty);
    if (n <= 1) { eShot(x, y, Math.cos(baseAng) * spd, Math.sin(baseAng) * spd, style); return; }
    for (let i = 0; i < n; i++) {
      const a = baseAng - spread / 2 + spread * i / (n - 1);
      eShot(x, y, Math.cos(a) * spd, Math.sin(a) * spd, style);
    }
  }
  function eRing(x, y, n, spd, offset, style) {
    n = Difficulty.patternCount(n,G.difficulty);
    for (let i = 0; i < n; i++) {
      const a = offset + Math.PI * 2 * i / n;
      eShot(x, y, Math.cos(a) * spd, Math.sin(a) * spd, style);
    }
  }

  /* ── 갱신 ─────────────────────────────────── */
  function updatePlayer(dt, inp) {
    if (!P.alive) {
      P.deadT += dt;
      if (P.deadT > 1.2) {
        if (P.lives < 0) { gameOver(); return; }
        P.alive = true; P.inv = mode().respawnInv; P.charge = 0; P.chargeFull = 0;
        P.x = W / 2; P.y = H - 110;
        P.bombs = Math.max(P.bombs, 1);
        updateBombBtn();
      }
      return;
    }
    if (window.__GOD) P.inv = 99;
    if (P.inv > 0) P.inv -= dt;

    const speed = (inp.slow ? 155 : 320)*(bombRun&&bombRun.kind==='lancer'?.5:1);
    P.x += inp.dirX * speed * dt + inp.dragX;
    P.y += inp.dirY * speed * dt + inp.dragY;
    P.x = clamp(P.x, 18, W - 18);
    P.y = clamp(P.y, 40, H - 26);

    /* 기울기(자세 스프라이트 선택) */
    const target = clamp(inp.dirX + clamp(inp.dragX * 3, -1, 1), -1, 1);
    P.bank += (target - P.bank) * (1 - Math.exp(-dt * 11));

    /* 필살기 중에는 기수의 에너지를 한 발에 집중한다. */
    if(bombRun&&bombRun.kind==='lancer'){P.charge=0;P.chargeFull=0;return;}
    /* 사격 */
    if (inp.fire) {
      P.fireCd -= dt;
      if (P.fireCd <= 0) { fireVulcan(); P.fireCd = ship().fireCd; }
      if (ship().missiles && P.power >= 4) {
        P.missileCd -= dt;
        if (P.missileCd <= 0) {
          const many = P.power >= 5;
          fireMissiles(many ? 4 : 2);
          P.missileCd = many ? .52 : .7;
        }
      }
      if (P.charge < 1) {
        P.charge = Math.min(1, P.charge + dt / ship().chargeTime);
        if (P.charge >= 1 && P.chargeFull === 0) { P.chargeFull = .01; Snd.play('chargeReady'); }
      } else {
        P.chargeFull += dt;
        /* 터치 자동 연사에서도 차지샷이 나가도록 기본은 자동 발사 */
        if (autoCharge && P.chargeFull > .9) fireCharge();
      }
    } else {
      if (P.charge >= 1) fireCharge();
      else P.charge = Math.max(0, P.charge - dt * .5);
      P.chargeFull = 0;
      P.fireCd = 0;
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t += dt;
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.isMidboss) {
        if (e.dead) { removeAt(enemies,i); continue; }
        const previousX = e.x;
        midbossMove(e, dt);
        if (e.banks) e.bank = clamp((e.x - previousX) / Math.max(dt, .001) / 40, -1, 1);
        midbossFire(e, dt * mode().attackRate);
        continue;
      }

      if (!EnemyPatterns.move(e,dt,W)) switch (e.move) {
        case 'chase': {
          /* 자폭기: 기체 쪽으로 가속해 들이받는다 */
          const ca = P.alive ? Math.atan2(P.y - e.y, P.x - e.x) : Math.PI / 2;
          e.vx += Math.cos(ca) * 210 * dt;
          e.vy += Math.sin(ca) * 210 * dt;
          const sp = Math.hypot(e.vx, e.vy), max = e.speed * 1.35;
          if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.bank = clamp(e.vx / 110, -1, 1);
          break;
        }
        case 'sine':
          e.y += e.speed * dt;
          e.x = e.x0 + Math.sin(e.t * 2.2) * 62;
          e.bank = Math.cos(e.t * 2.2) * .9;
          break;
        case 'dive':
          e.y += e.speed * dt;
          if (e.y > 260) { e.x += e.dir * 120 * dt; e.bank = e.dir * .8; }
          break;
        case 'swoop':
          e.x += e.dir * (e.speed * .85) * dt;
          e.y += Math.sin(e.t * 1.1) * 60 * dt + 38 * dt;
          e.bank = e.dir * .85;
          break;
        case 'hover':
          if (e.y < e.targetY) { e.y += e.speed * dt; }
          else {
            e.hoverT += dt;
            e.x += Math.sin(e.t * .9) * 48 * dt;
            e.bank = Math.cos(e.t * .9) * .5;
            if (e.hoverT > (e.isMidboss ? 28 : 6)) e.y += e.speed * 1.4 * dt;
          }
          break;
        default:
          e.y += e.speed * dt;
          e.x += Math.sin(e.t * 1.3) * 18 * dt;
          e.bank = Math.cos(e.t * 1.3) * .35;
      }

      /* 사격 */
      if (e.fire !== 'none' && e.y > 0 && e.y < H - 120 && P.alive) {
        e.fireCt -= dt * mode().attackRate;
        /* 저격기는 쏘기 전 조준선을 보여 주고, 그때 각도를 고정한다(보고 피할 수 있게) */
        if ((e.fire === 'snipe' || e.fire === 'lockBurst') && e.fireCt <= SNIPE_TELE && e.lockAng === null) {
          e.lockAng = aimAngle(e.x, e.y);
        }
        if (e.fireCt <= 0) {
          const spd = (e.heavy ? 150 : 135) * G.bulletMul;
          const a = aimAngle(e.x, e.y);
          if (EnemyPatterns.fire(e,a,spd,eShot)) {
            // 특수 편대 사격과 재장전은 공용 패턴 모듈에서 처리한다.
          } else if (e.fire === 'aimed') {
            eShot(e.x, e.y + 12, Math.cos(a) * spd, Math.sin(a) * spd, 'eSmall');
            e.fireCt = rand(1.4, 2.4);
          } else if (e.fire === 'spread3') {
            for (let k = -1; k <= 1; k++) {
              eShot(e.x, e.y + 12, Math.cos(a + k * .26) * spd, Math.sin(a + k * .26) * spd, 'eSmall');
            }
            e.fireCt = rand(1.5, 2.2);
          } else if (e.fire === 'snipe') {
            /* 저격기: 조준선 방향으로 빠른 2연사 */
            const sa = e.lockAng === null ? a : e.lockAng;
            for (let k = 0; k < 2; k++) {
              eShot(e.x, e.y + 10, Math.cos(sa) * spd * (1.3 + k * .12), Math.sin(sa) * spd * (1.3 + k * .12), 'eSmall');
            }
            e.lockAng = null;
            e.fireCt = rand(1.7, 2.4);
          } else if (e.fire === 'drop') {
            /* 폭격기: 잠시 뒤 흩어지는 폭탄 */
            const bomb = eShot(e.x, e.y + 16, rand(-30, 30), 92, 'eBig');
            if (bomb) bomb.split = 1.1;
            e.fireCt = rand(2.4, 3.4);
          } else if (e.fire === 'burst') {
            for (let k = 0; k < 2; k++) {
              const aa = a + rand(-.12, .12);
              eShot(e.x, e.y + 12, Math.cos(aa) * spd * (1 + k * .12), Math.sin(aa) * spd * (1 + k * .12), 'eSmall');
            }
            e.fireCt = rand(1.1, 1.9);
          } else if (e.fire === 'sweep') {
            /* 빨강 연사기: 한쪽에서 시작해 조준선을 훑으며 5발을 연달아 쏜다.
               탄이 지나간 쪽은 비므로 훑는 반대쪽으로 빠지면 피할 수 있다. */
            if (!e.sweepLeft) {
              e.sweepLeft = 5;
              e.sweepDir = Math.random() < .5 ? -1 : 1;
              e.sweepAng = a - .32 * e.sweepDir;
            }
            eShot(e.x, e.y + 12, Math.cos(e.sweepAng) * spd * 1.05, Math.sin(e.sweepAng) * spd * 1.05, 'eSmall');
            e.sweepAng += .16 * e.sweepDir;
            e.sweepLeft--;
            e.fireCt = e.sweepLeft > 0 ? .1 : rand(1.7, 2.5);
          } else if (e.fire === 'ring') {
            /* 노랑 산탄기: 사방으로 퍼지는 원형 탄막. 느리게 퍼지므로 탄 사이로 빠져나간다. */
            e.ringOff = (e.ringOff || 0) + .34;
            eRing(e.x, e.y, 10, spd * .68, e.ringOff, 'eSmall');
            e.fireCt = rand(2.0, 2.8);
          } else if (e.fire === 'homing') {
            /* 초록 추격기: 느리게 선회하는 유도탄. 옆으로 크게 돌면 떨궈낼 수 있다. */
            eMissile(e.x, e.y + 16, spd * .8);
            e.fireCt = rand(2.8, 3.8);
          }
          if (e.heavy && Math.random() < .5) {
            for (let k = 0; k < 8; k++) {
              const ang = Math.PI * 2 * k / 8 + e.t;
              eShot(e.x, e.y, Math.cos(ang) * spd * .55, Math.sin(ang) * spd * .55, 'eSmall');
            }
          }
        }
      }

      if (e.dead || e.y > H + 90 || e.x < -140 || e.x > W + 140) {
        if (e.dead) { /* 이미 처리됨 */ }
        else if (e.form && formations[e.form]) formations[e.form].alive--;
        removeAt(enemies, i);
      }
    }
  }

  function updateBullets(dt) {
    for (let i = pBullets.length - 1; i >= 0; i--) {
      const b = pBullets[i];
      if (b.homing > 0) {
        b.homing -= dt;
        let tg = b.target;
        if (!tg || tg.dead || tg.y > H + 40) tg = b.target = missileTarget();
        if (tg) {
          const want = Math.atan2(tg.y - b.y, tg.x - b.x);
          let cur = Math.atan2(b.vy, b.vx);
          let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          cur += clamp(diff, -b.turn * dt, b.turn * dt);
          const sp = Math.min(b.maxSpd, Math.hypot(b.vx, b.vy) + 260 * dt);
          b.vx = Math.cos(cur) * sp;
          b.vy = Math.sin(cur) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (b.bossCt > 0) b.bossCt -= dt;
      if (b.y < -60 || b.y > H + 40 || b.x < -40 || b.x > W + 40) removeAt(pBullets, i);
    }
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      if (b.homing > 0 && P.alive) {
        b.homing -= dt;
        const want = aimAngle(b.x, b.y);
        let cur = Math.atan2(b.vy, b.vx);
        let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        cur += clamp(diff, -b.turn * dt, b.turn * dt);
        const sp = Math.min(b.maxSpd, Math.hypot(b.vx, b.vy) + b.accel * dt);
        b.vx = Math.cos(cur) * sp;
        b.vy = Math.sin(cur) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.split !== undefined) {
        b.split -= dt * mode().attackRate;
        if (b.split <= 0) {
          eRing(b.x, b.y, 8, 118 * G.bulletMul, Math.random() * 6, 'eSmall');
          boom(b.x, b.y, 16);
          removeAt(eBullets, i);
          continue;
        }
      }
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) removeAt(eBullets, i);
    }
  }

  function updateItems(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt;
      const d = Math.hypot(P.x - it.x, P.y - it.y);
      if (P.alive && d < 110) {                 // 가까우면 끌려온다
        it.x += (P.x - it.x) * Math.min(1, dt * 4);
        it.y += (P.y - it.y) * Math.min(1, dt * 4);
      } else {
        it.y += it.vy * dt;
        it.x += Math.sin(it.t * 2) * 24 * dt;
      }
      if (P.alive && d < 26) { takeItem(it); removeAt(items, i); continue; }
      if (it.y > H + 30) removeAt(items, i);
    }
  }

  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { removeAt(parts, i); continue; }
      if (p.type === 'spark') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= .92; p.vy *= .92;
        p.vy += 120 * dt;                     // 약한 중력으로 흩어진다
      } else if (p.type === 'wreck') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.spin * dt;
      } else if (!p.ring && !p.explosion) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= .94; p.vy *= .94;
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) removeAt(floats, i);
    }
  }

  /* ── 충돌 ─────────────────────────────────── */
  function collide() {
    /* 내 탄 → 적 */
    for (let i = pBullets.length - 1; i >= 0; i--) {
      const b = pBullets[i];
      let consumed = false;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (e.dead) continue;
        if (b.hits && b.hits.indexOf(e) >= 0) continue;
        if (Math.abs(b.x - e.x) < e.hit + b.r && Math.abs(b.y - e.y) < e.hit + b.r) {
          damageEnemy(e, b.dmg, b.x, b.y);
          spawnParticles(b.x, b.y, 2, '#cfe6ff', 60, 2.4);
          if (b.hits) b.hits.push(e);
          else { consumed = true; break; }
        }
      }
      if (!consumed) {
        for (let j = 0; j < grounds.length; j++) {
          const t = grounds[j];
          if (t.dead || t.y < -20) continue;
          if (b.hits && b.hits.indexOf(t) >= 0) continue;
          if (Math.abs(b.x - t.x) < t.hit + b.r && Math.abs(b.y - t.y) < t.hit + b.r) {
            /* 차지샷은 한 대상을 한 번만 때리므로 지상 구조물에는 배율을 준다 */
            damageGround(t, b.pierce ? b.dmg * 1.8 : b.dmg);
            if (b.pierce) { spawnParticles(t.x, t.y, 7, '#ffd9a0', 170, 2.2); shake(2); }
            else spawnParticles(b.x, b.y, 2, '#ffd9a0', 60, 1.2);
            if (b.hits) b.hits.push(t);
            else { consumed = true; break; }
          }
        }
      }
      if (!consumed && boss && boss.state === 'fight' && b.bossCt <= 0) {
        const hitPart = Bosses.partAt(boss, b.x, b.y, b.r);
        if (hitPart) {
          damageBoss(b.dmg, b.x, b.y, hitPart);
          spawnParticles(b.x, b.y, 2, '#ffd9a0', 60, 2.4);
          if (b.pierce) b.bossCt = .12; else consumed = true;
        } else if (Math.abs(b.x - boss.x) < boss.hitW / 2 && Math.abs(b.y - boss.y) < boss.hitH / 2) {
          damageBoss(b.dmg, b.x, b.y, null);
          spawnParticles(b.x, b.y, 2, '#cfe6ff', 60, 2.4);
          if (b.pierce) b.bossCt = .12; else consumed = true;
        }
      }
      if (consumed) removeAt(pBullets, i);
    }

    if (!P.alive || P.inv > 0) return;

    /* 적 탄 → 나 */
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      if (Math.hypot(b.x - P.x, b.y - P.y) < b.r + P.hitR) {
        removeAt(eBullets, i);
        hitPlayer();
        return;
      }
    }
    /* 적 기체 → 나 */
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.dead && Math.abs(e.x - P.x) < e.hit * .7 && Math.abs(e.y - P.y) < e.hit * .7) {
        damageEnemy(e, 40, e.x, e.y);
        hitPlayer();
        return;
      }
    }
    /* 보스 몸체 → 나 */
    if (boss && boss.state === 'fight' &&
        Math.abs(boss.x - P.x) < boss.hitW / 2 && Math.abs(boss.y - P.y) < boss.hitH / 2) {
      hitPlayer();
    }
  }

  /* ── 스테이지 진행 ────────────────────────── */
  function runScript(dt) {
    const st = stage();
    G.stageTime += dt;
    while (G.scriptIdx < st.script.length && st.script[G.scriptIdx].at <= G.stageTime) {
      const ev = st.script[G.scriptIdx++];
      if (ev.kind === 'formation') spawnFormation(ev);
      else if (ev.kind === 'ground') spawnGround(ev);
      else if (ev.name === 'midboss') spawnMidboss();
      else if (ev.name === 'boss') G.bossPending = true;
    }
    // 보스 시각은 등장 요청만 예약한다. 중간보스 격파 후에만 경고를 시작한다.
    if (G.bossPending && G.midbossDefeated && !boss) {
      G.bossPending = false; G.warning = 2.4; Snd.play('warning');
    }
    if (G.warning > 0 && G.midbossDefeated) {
      G.warning -= dt;
      if (G.warning <= 0 && !boss) {
        boss = Bosses.create(st.boss, G.stageIndex, mode());
        Snd.bgmStart(G.stageIndex, 'boss');   /* 보스 전용 곡으로 전환 */
      }
    }
  }

  function updateBoss(dt) {
    if (!boss) return;
    Bosses.update(boss, dt, api);
    if (boss.state === 'dying') {
      boss.explodeCt -= dt;
      if (boss.dying < 1.5 && boss.explodeCt <= 0) {
        boss.explodeCt = .18;
        const p = boss.parts[boss.deathStep++];
        if (p) {
          p.hp = 0; p.alive = false;
          boom(boss.x+p.ox*boss.w*(boss.flip?-1:1),boss.y+p.oy*boss.h,52);
        } else boom(boss.x+rand(-boss.w*.25,boss.w*.25),boss.y+rand(-boss.h*.25,boss.h*.25),42);
      }
      if (boss.dying >= 1.5 && !boss.finalBlast) {
        boss.finalBlast = true;
        boom(boss.x,boss.y,110);
      }
      if (boss.dying > 2.4 && !G.bossCleared) {
        G.bossCleared = true;
        stageClear();
      }
    }
  }

  /* ── 화면 전환 ────────────────────────────── */
  function showScreen(id) {
    ['scLoad', 'scTitle', 'scHelp', 'scPause', 'scClear', 'scOver', 'scEnd'].forEach(function (s) {
      $(s).classList.toggle('hidden', s !== id);
    });
    $('touchPad').classList.toggle('hidden', !(id === null && Input.touchMode));
    $('touchPad').setAttribute('aria-hidden', id === null ? 'false' : 'true');
  }

  function startStage(index, keepScore) {
    G.stageIndex = index;
    G.stageTime = 0; G.scriptIdx = 0; G.stageMiss = 0;
    G.warning = 0; G.bossCleared = false;
    G.bossPending = false;
    G.midbossDefeated = !stage().script.some(function(ev){return ev.name === 'midboss';});
    G.titleCard = 2.6;
    G.bulletMul = stage().bulletMul || 1;
    enemies = []; grounds = []; pBullets = []; eBullets = []; items = []; parts = []; floats = []; effects = [];
    bombRun = null;
    G.hitStop = 0; G.bulletBonus = 0;
    boss = null; bgScroll = 0;
    Object.keys(formations).forEach(function (k) { delete formations[k]; });
    P.x = W / 2; P.y = H - 110; P.alive = true; P.inv = mode().stageInv;
    P.charge = 0; P.chargeFull = 0; P.bank = 0; P.chargeRelease = 0; P.chargeClock = 0;
    if (!keepScore) { /* 점수는 이어진다 */ }

    bgReady = Assets.hasBg(stage().bg);
    bgError = '';
    Assets.loadBg(stage().bg).then(function () {
      bgReady = true;
      /* 다음 스테이지 배경을 미리 받아 둔다 */
      const next = Stages.STAGES[index + 1];
      if (next) Assets.loadBg(next.bg).catch(function () { });
    }).catch(function (err) {
      bgError = '배경 이미지를 불러오지 못했습니다. 게임은 계속 진행됩니다.';
      console.error(err);
    });

    G.state = 'play';
    showScreen(null);
    Snd.resume();
    Snd.bgmStart(index);
    Input.reset();
    updateBombBtn();
  }

  function stageClear() {
    if (G.state === 'clear' || G.state === 'end') return;
    bombRun = null;
    Snd.play('clear');
    G.state = 'clear';
    G.clearRemaining = 3;
    const noMiss = G.stageMiss === 0 ? 10000 : 0;
    const lifeBonus = P.lives * 5000;
    const bombBonus = P.bombs * 1000;
    const bulletBonus = G.bulletBonus;
    G.score += noMiss + lifeBonus + bombBonus + bulletBonus;
    G.bulletBonus = 0;
    const rows = [
      ['잔기 보너스 (' + P.lives + '기)', lifeBonus],
      ['폭탄 보너스 (' + P.bombs + '개)', bombBonus],
      ['잔탄 보너스', bulletBonus],
      ['노미스 보너스', noMiss],
      ['최대 연속 격추', G.maxCombo]
    ];
    const ul = $('clearList');
    ul.innerHTML = '';
    rows.forEach(function (r) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = r[0];
      const val = document.createElement('b');
      val.textContent = r[1].toLocaleString();
      li.appendChild(label); li.appendChild(val);
      ul.appendChild(li);
    });
    const total = document.createElement('li');
    total.className = 'total';
    const tl = document.createElement('span'); tl.textContent = '현재 점수';
    const tv = document.createElement('b'); tv.textContent = G.score.toLocaleString();
    total.appendChild(tl); total.appendChild(tv);
    ul.appendChild(total);

    const last = G.stageIndex >= Stages.STAGES.length - 1;
    $('clearTitle').textContent = last ? '최종 스테이지 돌파' : 'STAGE ' + stage().no + ' 클리어';
    $('clearCountdown').textContent = last ? '3초 후 최종 결과로 이동합니다.' : '3초 후 다음 스테이지로 이동합니다.';
    showScreen('scClear');
    Snd.bgmStop();
  }

  function nextStage() {
    if (G.state !== 'clear') return;
    if (G.stageIndex >= Stages.STAGES.length - 1) { ending(); return; }
    startStage(G.stageIndex + 1, true);
  }

  function ending() {
    G.state = 'end';
    $('endMode').textContent = mode().label + ' · 7 STAGES';
    saveScore();
    $('eScore').textContent = G.score.toLocaleString();
    $('eCont').textContent = G.continues;
    showScreen('scEnd');
    Snd.bgmStop();
  }

  function gameOver() {
    G.state = 'over';
    saveScore();
    $('oScore').textContent = G.score.toLocaleString();
    $('oStage').textContent = stage().no;
    $('overMsg').textContent = G.continues === 0
      ? '컨티뉴하면 최고 점수에는 기록되지 않습니다.'
      : '컨티뉴 ' + G.continues + '회 사용 중 — 최고 점수 기록 제외';
    showScreen('scOver');
    Snd.bgmStop();
  }

  function loadRanking(difficulty) {
    try {
      const raw = JSON.parse(store.get(Difficulty.recordKeys(difficulty || selectedDifficulty).ranking) || '[]');
      return Array.isArray(raw) ? raw.slice(0, 5) : [];
    } catch (err) { return []; }
  }
  function pushRanking(entry) {
    const list = loadRanking(G.difficulty);
    list.push(entry);
    list.sort(function (a, b) { return b.score - a.score; });
    const top = list.slice(0, 5);
    store.set(Difficulty.recordKeys(G.difficulty).ranking, JSON.stringify(top));
    return top;
  }
  function renderRanking() {
    const ol = $('ranking');
    if (!ol) return;
    const list = loadRanking();
    ol.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'NO RECORDS YET';
      ol.appendChild(li);
      return;
    }
    list.forEach(function (r, i) {
      const li = document.createElement('li');
      const rk = document.createElement('span');
      rk.className = 'rk';
      rk.textContent = (i === 0 ? '👑 ' : '') + (i + 1) + '.';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = (r.ship || '') + '  ST.' + (r.stage || 1);
      const sc = document.createElement('b');
      sc.textContent = Number(r.score || 0).toLocaleString();
      const go = document.createElement('i');
      go.className = 'go';
      go.setAttribute('aria-hidden', 'true');
      go.textContent = '›';
      li.appendChild(rk); li.appendChild(nm); li.appendChild(sc); li.appendChild(go);
      ol.appendChild(li);
    });
  }

  function saveScore() {
    if (!G.hasRun || G.scoreSaved) return;
    G.scoreSaved = true;
    const keys = Difficulty.recordKeys(G.difficulty);
    G.lastScore = G.score;
    store.set(keys.last, String(G.score));
    if (G.continues === 0) {
      if (G.score > G.hi) {
        G.hi = G.score;
        store.set(keys.hi, String(G.score));
      }
      pushRanking({ score: G.score, stage: stage().no, ship: ship().name, difficulty: G.difficulty });
      renderRanking();
    }
    $('tHi').textContent = G.hi.toLocaleString();
    $('tLast').textContent = G.lastScore.toLocaleString();
  }

  function refreshDifficultyUI() {
    const profile = Difficulty.get(selectedDifficulty), keys = Difficulty.recordKeys(selectedDifficulty);
    G.hi = +(store.get(keys.hi) || 0);
    G.lastScore = +(store.get(keys.last) || 0);
    $('difficultyEasy').setAttribute('aria-pressed',String(selectedDifficulty==='easy'));
    $('difficultyHard').setAttribute('aria-pressed',String(selectedDifficulty==='hard'));
    $('difficultyDescription').textContent = profile.description;
    $('rankingMode').textContent = profile.label+' HIGH SCORES';
    $('tHi').textContent = G.hi.toLocaleString();
    $('tLast').textContent = G.lastScore.toLocaleString();
    renderRanking();
  }

  function newGame() {
    setAttractPhase('panel');
    G.difficulty = selectedDifficulty;
    G.hasRun = true; G.scoreSaved = false;
    G.score = 0; G.combo = 0; G.maxCombo = 0; G.continues = 0;
    G.nextExtend = 300000;
    P.power = mode().power; P.bombs = mode().bombs; P.lives = mode().lives; P.inv = 0;
    startStage(0, false);
  }

  function continueGame() {
    G.continues++;
    G.scoreSaved = false;
    P.power = mode().power; P.bombs = mode().bombs; P.lives = mode().lives; P.alive = true;
    startStage(G.stageIndex, true);
  }

  function toTitle() {
    G.state = 'title';
    Snd.bgmStop();
    saveScore();
    showScreen('scTitle');
  }

  function pauseGame() {
    if (G.state !== 'play') return;
    G.state = 'pause';
    $('pauseMode').textContent = mode().label + ' · STAGE ' + stage().no;
    Snd.bgmPause();
    showScreen('scPause');
  }
  function resumeGame() {
    if (G.state !== 'pause') return;
    G.state = 'play';
    showScreen(null);
    Input.reset();
    Snd.bgmResume(G.stageIndex, boss && boss.state !== 'dying' ? 'boss' : 'stage');
  }

  /* ── 그리기 ───────────────────────────────── */
  function drawBackgroundTile(bgNo, scroll, tint) {
    const tile = Assets.hasBg(bgNo) ? Assets.bgTile(bgNo, W, W * 2) : null;
    if (!tile) {
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const overlap = tile.height * Assets.BG_OVERLAP;
    const period = tile.height - overlap;
    let y = (scroll % period) - period;
    while (y < H) {
      ctx.drawImage(tile, 0, Math.round(y));
      y += period;
    }
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBackground() {
    const st = stage();
    drawBackgroundTile(st.bg, bgReady ? bgScroll : 0, bgReady ? st.tint : null);
  }

  /* ── 타이틀 대기화면(어트랙트 모드) ─────────
     스테이지를 돌아가며 배경·적·지상 시설을 보여 주고, 후반에는 보스가 등장한다.
     조작이 없으면 안내 패널이 사라지고 데모만 남았다가 다시 돌아온다. */
  const ATTRACT_CYCLE = 12;     // 스테이지 한 바퀴(초)
  const ATTRACT_BOSS_AT = 7.6;  // 이 시각부터 보스 등장
  const PANEL_HOLD = 13;        // 패널을 보여 주는 시간(초)
  const DEMO_HOLD = 15;         // 데모만 보여 주는 시간(초)

  const ATTRACT_MIX = [
    { planes: ['mini'], grounds: ['boat', 'fuel'] },
    { planes: ['mini', 'mini', 'sniper'], grounds: ['tank', 'fuel', 'bunker'] },
    { planes: ['mini', 'sniper'], grounds: ['radar', 'aa', 'bunker'] },
    { planes: ['canopyFighter', 'crimson', 'carbon'], grounds: ['radar', 'aa', 'bunker'] },
    { planes: ['calderaFighter', 'scarlet', 'hunter'], grounds: ['s5turret', 's5battery', 'fuel'] },
    { planes: ['mini', 'bomber', 'medium'], grounds: ['patrol4', 'missile4', 'aa'] },
    { planes: ['s5fighter', 's5heavy', 's5gunship'], grounds: ['s5turret', 's5battery', 's5tank'] }
  ];

  const attract = {
    t: 0, scroll: 0, x: W / 2, bank: 0,
    planes: [], shots: [], props: [],
    spawnCt: 0, fireCt: 0, propCt: 0,
    stage: 0, cycleT: 0, boss: null,
    phase: 'panel', phaseT: 0, lastInput: 0
  };

  function attractStage() { return Stages.STAGES[attract.stage]; }

  function setAttractPhase(phase) {
    attract.phase = phase;
    attract.phaseT = 0;
    const el = $('scTitle');
    if (el) el.classList.toggle('demo', phase === 'demo');
  }

  function attractNextStage() {
    attract.stage = (attract.stage + 1) % Stages.STAGES.length;
    attract.cycleT = 0;
    attract.boss = null;
    attract.planes.length = 0;
    attract.props.length = 0;
    Assets.loadBg(attractStage().bg).catch(function () { /* 실패하면 이전 배경을 계속 쓴다 */ });
  }

  function updateAttract(dt) {
    const st = attractStage();
    const mix = ATTRACT_MIX[attract.stage];
    attract.t += dt;
    attract.scroll += st.scroll * dt;
    attract.cycleT += dt;
    attract.phaseT += dt;

    /* 패널 ↔ 데모 전환 */
    if (attract.phase === 'panel' && attract.phaseT > PANEL_HOLD &&
        performance.now() - attract.lastInput > PANEL_HOLD * 1000) {
      setAttractPhase('demo');
    } else if (attract.phase === 'demo' && attract.phaseT > DEMO_HOLD) {
      setAttractPhase('panel');
    }

    if (attract.cycleT > ATTRACT_CYCLE) attractNextStage();

    /* 우리 기체 */
    const nx = W / 2 + Math.sin(attract.t * .55) * 120;
    attract.bank = clamp((nx - attract.x) * 3, -1, 1);
    attract.x = nx;
    const py = H - 150;

    /* 적 편대 */
    attract.spawnCt -= dt;
    if (attract.spawnCt <= 0 && attract.planes.length < 8 && !attract.boss) {
      attract.spawnCt = .7;
      const key = mix.planes[Math.floor(Math.random() * mix.planes.length)];
      const base = Stages.enemyForStage(key, attract.stage);
      const x = rand(50, W - 50);
      attract.planes.push({
        key: key, art: base.art, tint: base.tint || null, prop: base.prop,
        w: base.w, x: x, x0: x, y: -50, t: rand(0, 6), spd: rand(115, 170), bank: 0
      });
    }
    for (let i = attract.planes.length - 1; i >= 0; i--) {
      const e = attract.planes[i];
      e.t += dt;
      e.y += e.spd * dt;
      e.x = e.x0 + Math.sin(e.t * 1.6) * 40;
      e.bank = Math.cos(e.t * 1.6) * .8;
      if (e.y > H + 60) removeAt(attract.planes, i);
    }

    /* 지상 시설 */
    attract.propCt -= dt;
    if (attract.propCt <= 0 && attract.props.length < 4) {
      attract.propCt = rand(1.6, 2.6);
      const key = mix.grounds[Math.floor(Math.random() * mix.grounds.length)];
      const def = Stages.groundForStage(key, attract.stage);
      attract.props.push({
        def: def, x: rand(def.w * .6, W - def.w * .6), y: -def.w, ang: 0, t: 0, dmg: 0
      });
    }
    for (let i = attract.props.length - 1; i >= 0; i--) {
      const g = attract.props[i];
      g.t += dt;
      g.y += st.scroll * dt;
      if (g.def.rot === 'spin') g.ang += dt * 1.7;
      else if (g.def.rot === 'aim') g.ang = Math.atan2(py - g.y, attract.x - g.x) + Math.PI / 2;
      if (g.y > H + g.def.w) removeAt(attract.props, i);
    }

    /* 보스 등장 */
    if (!attract.boss && attract.cycleT > ATTRACT_BOSS_AT) {
      attract.boss = Bosses.create(st.boss, attract.stage);
      if (attract.boss) { attract.boss.state = 'fight'; attract.boss.y = -attract.boss.h * .6; }
    }
    if (attract.boss) {
      const b = attract.boss;
      b.t += dt;
      b.y += (b.entryY - b.y) * Math.min(1, dt * 1.3);
      b.x = W / 2 + Math.sin(b.t * .55) * (b.id === 'nightark' ? Math.min(68, (W - b.w) / 2 - 12) : 95);
      if (b.def.sideRun) b.flip = Math.cos(b.t * .55) < 0;
    }

    /* 사격과 격추 연출 */
    attract.fireCt -= dt;
    if (attract.fireCt <= 0) {
      attract.fireCt = .14;
      attract.shots.push({ x: attract.x - 9, y: py - 22 });
      attract.shots.push({ x: attract.x + 9, y: py - 22 });
    }
    for (let i = attract.shots.length - 1; i >= 0; i--) {
      const b = attract.shots[i];
      b.y -= 720 * dt;
      if (b.y < -20) { removeAt(attract.shots, i); continue; }
      let hit = false;
      for (let j = attract.planes.length - 1; j >= 0; j--) {
        const e = attract.planes[j];
        if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20) {
          boom(e.x, e.y, 22);
          removeAt(attract.planes, j);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let j = attract.props.length - 1; j >= 0; j--) {
          const g = attract.props[j];
          if (Math.abs(b.x - g.x) < g.def.hit && Math.abs(b.y - g.y) < g.def.hit) {
            g.dmg += 1;
            if (g.dmg > 6) { boom(g.x, g.y, 34); removeAt(attract.props, j); }
            hit = true;
            break;
          }
        }
      }
      if (hit) removeAt(attract.shots, i);
    }
    updateParticles(dt);
  }

  function renderAttract(t) {
    const st = attractStage();
    const bgNo = Assets.hasBg(st.bg) ? st.bg : 1;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    drawBackgroundTile(bgNo, attract.scroll, st.tint);

    /* 지상 시설 */
    for (let i = 0; i < attract.props.length; i++) {
      const g = attract.props[i];
      drawGroundArt(g.def, g.x, g.y, g.ang, 0, g.def.w, false);
    }

    const bullet = Assets.bullet('vulcan');
    for (let i = 0; i < attract.shots.length; i++) {
      const b = attract.shots[i];
      ctx.drawImage(bullet, b.x - bullet.width / 2, b.y - bullet.height / 2);
    }
    for (let i = 0; i < attract.planes.length; i++) {
      const e = attract.planes[i];
      drawPlane(e.art, e.x, e.y, e.w, e.bank, e.prop, false, t, e.tint);
    }
    if (attract.boss) Bosses.draw(attract.boss, ctx, api);
    drawPlane(ship().art, attract.x, H - 150, 62, attract.bank, ship().prop, false, t, ship().tint);
    drawParticles();

    /* 데모일 때만 스테이지 이름과 시작 안내를 띄운다 */
    if (attract.phase === 'demo') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(6,10,20,.55)';
      ctx.fillRect(0, 44, W, 48);
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = '#9fb4d8';
      ctx.fillText('STAGE ' + st.no, W / 2, 50);
      ctx.font = '19px ' + FONT;
      ctx.fillStyle = '#eaf2ff';
      ctx.fillText(st.name, W / 2, 66);

      if (attract.boss) {
        ctx.font = '12px ' + FONT;
        ctx.fillStyle = '#ffc879';
        ctx.fillText('BOSS  ' + attract.boss.name, W / 2, H - 118);
      }
      if (Math.floor(attract.t * 1.6) % 2 === 0) {
        ctx.font = '20px ' + FONT;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS START', W / 2, H - 94);
      }
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawPlane(kind, x, y, w, bank, propColor, flash, t, tint) {
    const pose = !bank ? 'neutral' : (bank < -.35 ? 'left' : (bank > .35 ? 'right' : 'neutral'));
    const art = Assets.body(kind, pose, w, tint) || (kind === 'stage4Vtol' && Assets.body('medium', pose, w));
    if (!art) return;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flash) { ctx.globalCompositeOperation = 'lighter'; }
    ctx.drawImage(art.c, -art.px, -art.py);
    Assets.drawDucts(ctx, art, t);
    if (flash) ctx.globalCompositeOperation = 'source-over';
    if (art.hubs.length && G.quality > .6) {
      const frames = Assets.propSet(art.r, propColor);
      const f = frames[Math.floor(t * 30) % frames.length];
      for (let i = 0; i < art.hubs.length; i++) {
        const hub = art.hubs[i];
        ctx.drawImage(f, hub.x - f.width / 2, hub.y - f.height / 2);
      }
    }
    ctx.restore();
  }

  function drawPlayer(t) {
    if (!P.alive) return;
    if (P.inv > 0 && Math.floor(P.inv * 14) % 2 === 0) return;   // 무적 깜빡임
    /* 포드 */
    if (P.power >= ship().podFrom) {
      const podArt = Assets.sprite('p-pod', 26);
      podPositions().forEach(function (p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (podArt) {
          ctx.drawImage(podArt, -podArt.width / 2, -podArt.height / 2);
        } else {
          ctx.fillStyle = '#c9d6e8';
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = ship().pod;
          ctx.fillRect(-2.5, -1.5, 5, 3);
        }
        ctx.restore();
      });
    }
    drawPlane(ship().art, P.x, P.y, 62, P.bank, ship().prop, false, t, ship().tint);

    ChargeFX.gather(ctx,P,G.quality,ship().id==='lancer'?'gold':'blue');
  }

  function drawEnemies(t) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.y < -80) continue;
      drawPlane(e.art, e.x, e.y, e.w, e.banks ? e.bank : 0, e.prop, e.flash > 0, t, e.tint);
      /* 특수 적은 꼬리 쪽에 도형 표식을 붙인다 */
      if (MARK_SHAPE[e.typeKey]) {
        const mk = markCanvas(e.typeKey);
        ctx.drawImage(mk, Math.round(e.x - mk.width / 2), Math.round(e.y - e.w * .52 - mk.height / 2));
      }
      if (e.heavy || e.maxHp > 40) {
        const w = e.w * .7, ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.w * .62, w, 4);
        ctx.fillStyle = ratio > .3 ? '#7fd08a' : '#e8a33d';
        ctx.fillRect(e.x - w / 2, e.y - e.w * .62, w * ratio, 4);
        if (e.isMidboss) {
          ctx.font = '11px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#e8eefc';
          ctx.fillText(e.mid.name, e.x, e.y - e.w * .62 - 3);
        }
      }
    }
  }

  function drawBullets() {
    for (let i = 0; i < pBullets.length; i++) {
      const b = pBullets[i];
      const img = Assets.bullet(b.style);
      if (b.style === 'charge') {
        ChargeFX.shot(ctx,b);
      } else if (b.style === 'missile' || b.style === 'lance' || b.style === 'lancePod') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, b.x - img.width / 2, b.y - img.height / 2);
      }
    }
    for (let i = 0; i < eBullets.length; i++) {
      const b = eBullets[i];
      const img = Assets.bullet(b.style);
      if (b.style === 'eMissile') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, b.x - img.width / 2, b.y - img.height / 2);
      }
    }
  }

  /* ── 특수 적 식별 표식 ─────────────────────
     색만으로 구분하지 않도록, 종류마다 다른 도형 표식과 행동 예고선을 함께 그린다. */
  const SNIPE_TELE = .5;                     // 조준선을 보여 주는 시간(초)
  const MARK_SHAPE = {
    sniper: 'diamond', kamikaze: 'triangle', bomber: 'square',
    gunner: 'cross', spinner: 'ring', hunter: 'hex',
    crimson:'triangle', scarlet:'diamond', carbon:'cross', obsidian:'hex'
  };
  const MARK_COLOR = {
    sniper: '#b9a6ff', kamikaze: '#ff9a8f', bomber: '#ffcf8a',
    gunner: '#ff6a5e', spinner: '#ffe27a', hunter: '#86e3a2',
    crimson:'#ff6758', scarlet:'#ffb08b', carbon:'#bad9ff', obsidian:'#dfc4ff'
  };
  const markCache = Object.create(null);

  function markCanvas(type) {
    if (markCache[type]) return markCache[type];
    const S = 18, c = Assets.makeCanvas(S, S), g = c.getContext('2d');
    const shape = MARK_SHAPE[type], r = 6;
    g.translate(S / 2, S / 2);
    g.beginPath();
    if (shape === 'diamond') {
      g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0);
    } else if (shape === 'triangle') {
      g.moveTo(0, -r); g.lineTo(r, r * .85); g.lineTo(-r, r * .85);
    } else if (shape === 'cross') {
      const t = r * .36;
      g.moveTo(-t, -r); g.lineTo(t, -r); g.lineTo(t, -t); g.lineTo(r, -t);
      g.lineTo(r, t); g.lineTo(t, t); g.lineTo(t, r); g.lineTo(-t, r);
      g.lineTo(-t, t); g.lineTo(-r, t); g.lineTo(-r, -t); g.lineTo(-t, -t);
    } else if (shape === 'ring') {
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.moveTo(r * .45, 0);
      g.arc(0, 0, r * .45, 0, Math.PI * 2, true);   // 반대 방향으로 그려 가운데를 비운다
    } else if (shape === 'hex') {
      for (let k = 0; k < 6; k++) {
        const ha = Math.PI / 6 + Math.PI * 2 * k / 6;
        const hx = Math.cos(ha) * r, hy = Math.sin(ha) * r;
        if (k === 0) g.moveTo(hx, hy); else g.lineTo(hx, hy);
      }
    } else {
      g.rect(-r * .85, -r * .85, r * 1.7, r * 1.7);
    }
    g.closePath();
    g.fillStyle = MARK_COLOR[type];
    g.fill();
    g.strokeStyle = 'rgba(12,14,20,.9)';
    g.lineWidth = 2;
    g.stroke();
    markCache[type] = c;
    return c;
  }

  /* 저격 조준선 · 자폭 돌진선 */
  function drawEnemyCues() {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.y < -20) continue;

      if (e.lockAng !== null && !e.volleyLeft) {
        const p = 1 - clamp(e.fireCt / SNIPE_TELE, 0, 1);   // 발사가 가까울수록 진해진다
        ctx.save();
        ctx.globalAlpha = .18 + p * .5;
        ctx.strokeStyle = '#ffb0a4';
        ctx.lineWidth = 1 + p * 2;
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = -e.t * 40;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(e.lockAng) * 16, e.y + Math.sin(e.lockAng) * 16);
        ctx.lineTo(e.x + Math.cos(e.lockAng) * 300, e.y + Math.sin(e.lockAng) * 300);
        ctx.stroke();
        ctx.restore();
      }

      if (e.move === 'chase') {
        const sp = Math.hypot(e.vx, e.vy);
        if (sp > 30) {
          const ux = e.vx / sp, uy = e.vy / sp;
          const pulse = .35 + Math.sin(e.t * 9) * .18;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = '#ff7a68';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.x + ux * 18, e.y + uy * 18);
          ctx.lineTo(e.x + ux * 66, e.y + uy * 66);
          ctx.stroke();
          /* 진행 방향 갈매기 표시 */
          const hx = e.x + ux * 66, hy = e.y + uy * 66;
          ctx.beginPath();
          ctx.moveTo(hx + (-ux * 10 - uy * 7), hy + (-uy * 10 + ux * 7));
          ctx.lineTo(hx, hy);
          ctx.lineTo(hx + (-ux * 10 + uy * 7), hy + (-uy * 10 - ux * 7));
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  /* 폭격기가 떨어뜨린 폭탄이 터질 지점 */
  function drawBombMarkers() {
    for (let i = 0; i < eBullets.length; i++) {
      const b = eBullets[i];
      if (b.split === undefined) continue;
      const px = b.x + b.vx * b.split, py = b.y + b.vy * b.split;
      const k = clamp(b.split / 1.1, 0, 1);
      ctx.save();
      ctx.globalAlpha = .25 + (1 - k) * .45;
      ctx.strokeStyle = '#ffc06a';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = k * 30;
      ctx.beginPath();
      ctx.arc(px, py, 12 + k * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py);
      ctx.moveTo(px, py - 6); ctx.lineTo(px, py + 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  const ITEM_LABEL = { power: 'P', bomb: 'B', life: '1UP' };
  const ITEM_COLOR = { power: '#2f6fd0', bomb: '#c47420', life: '#2f8f55' };

  /* 차지샷의 응축과 방출은 ChargeFX에서 연속적으로 그린다. */


  const ITEM_ART = { power: 'item-power', bomb: 'item-bomb', life: 'item-life' };
  const ITEM_SIZE = 34;

  function drawItems() {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pulse = 1 + Math.sin(it.t * 6) * .07;
      const art = Assets.sprite(ITEM_ART[it.kind], ITEM_SIZE);
      if (art) {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.scale(pulse, pulse);
        /* 눈에 띄도록 은은한 빛을 깔고 그린다 */
        const gl = Assets.glow(26, 'rgba(255,255,255,.28)', 'rgba(140,190,255,.16)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(gl, -gl.width / 2, -gl.height / 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(art, -art.width / 2, -art.height / 2);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = ITEM_COLOR[it.kind];
      ctx.strokeStyle = '#f2f6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-13, -13, 26, 26, 5) : ctx.rect(-13, -13, 26, 26);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '' + (it.kind === 'life' ? 10 : 15) + 'px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ITEM_LABEL[it.kind], 0, 1);
      ctx.restore();
    }
  }

  const SPARK_WARM = ['rgba(255,242,208,.95)', 'rgba(255,150,45,.45)'];
  const SPARK_COOL = ['rgba(226,242,255,.95)', 'rgba(90,170,255,.45)'];

  function drawParticles() {
    /* 1) 시트 폭발 — 불과 연기가 함께 그려져 있어 보통 합성으로 둔다 */
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.explosion) continue;
      ctx.globalAlpha = 1;
      Assets.drawExplosion(ctx, p.x, p.y, p.size, 1 - Math.max(0, p.life / p.max));
    }

    /* 2) 불똥과 격추 섬광 — 가산 합성 */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.explosion || p.ring) continue;
      const a = Math.max(0, p.life / p.max);
      if (p.type === 'wreck') {
        ctx.save();
        ctx.globalAlpha = a * .9;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const k = 1 + (1 - a) * .25;
        ctx.scale(k, k);
        ctx.drawImage(p.art.c, -p.art.px, -p.art.py);
        ctx.restore();
      } else {
        const col = p.cool ? SPARK_COOL : SPARK_WARM;
        const img = Assets.glow(7, col[0], col[1]);
        const s = Math.max(3, (p.size || 3) * (.6 + a));
        ctx.globalAlpha = a;
        ctx.drawImage(img, p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    /* 3) 충격파 */
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.ring) continue;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * .75;
      ctx.strokeStyle = p.cool ? '#bcdcff' : '#ffd9a0';
      ctx.lineWidth = Math.max(1, 3.5 * a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2.4 - a * 1.4), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      ctx.fillStyle = f.color;
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.textBaseline = 'top';
    ctx.font = '15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(6,10,20,.55)';
    ctx.fillRect(0, 0, W, 30);
    ctx.fillStyle = '#e8eefc';
    ctx.fillText('점수 ' + G.score.toLocaleString(), 10, 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText('최고 ' + G.hi.toLocaleString(), W - 10, 8);
    ctx.textAlign = 'center';
    if (G.combo > 1) {
      ctx.fillStyle = '#ffd46a';
      ctx.fillText('연속 ' + G.combo + ' ×' + comboMul().toFixed(1), W / 2, 8);
    } else {
      ctx.fillStyle = '#cfe0ff';
      ctx.fillText(mode().label + ' · STAGE ' + stage().no, W / 2, 8);
    }

    /* 하단 상태 막대 */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(6,10,20,.55)';
    ctx.fillRect(0, H - 34, W, 34);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#e8eefc';
    ctx.fillText('잔기 ' + Math.max(0, P.lives), 10, H - 11);
    ctx.fillStyle = '#ffc879';
    ctx.fillText('폭탄 ' + P.bombs, 68, H - 11);

    /* 화력: 칸과 숫자를 함께 표시 */
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText('화력', 126, H - 11);
    for (let i = 0; i < 5; i++) {
      const x = 158 + i * 14;
      ctx.fillStyle = i < P.power ? '#4f8fe8' : 'rgba(120,140,180,.28)';
      ctx.fillRect(x, H - 20, 11, 9);
    }
    ctx.fillStyle = '#e8eefc';
    ctx.fillText(String(P.power), 230, H - 11);

    /* 차지 게이지 */
    const cgX = 286, cgW = W - 12 - cgX;
    const full = P.charge >= 1;
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText('차지', 254, H - 11);
    ctx.fillStyle = 'rgba(120,140,180,.25)';
    ctx.fillRect(cgX, H - 20, cgW, 9);
    ctx.fillStyle = full ? '#ffd46a' : '#5aa0e8';
    ctx.fillRect(cgX, H - 20, cgW * P.charge, 9);
    if (full) {
      ctx.textAlign = 'right';
      ctx.font = '11px ' + FONT;
      ctx.fillStyle = '#2a2008';
      ctx.fillText('완료', W - 16, H - 12);
      ctx.textAlign = 'left';
      ctx.font = '13px ' + FONT;
    }

    /* 보스 체력 */
    if (boss && boss.state !== 'dying') {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(6,10,20,.6)';
      ctx.fillRect(28, 36, W - 56, 42);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(32, 50, W - 64, 7);
      ctx.fillStyle = ratio > .66 ? '#6fbf73' : (ratio > .33 ? '#e8a33d' : '#e05a52');
      ctx.fillRect(32, 50, (W - 64) * ratio, 7);
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = '#e8eefc';
      ctx.fillText(boss.name, 34, 38, W - 260);
      ctx.textAlign = 'right';
      const wrecked = boss.parts.filter(function (p) { return !p.alive; }).length;
      ctx.fillStyle = wrecked ? '#ff9a86' : '#9fb4d8';
      ctx.fillText('페이즈 ' + boss.phase + '/3' +
        (wrecked ? ' · 폭주 ' + wrecked + '/' + boss.parts.length : ''), W - 34, 38);
      ctx.font = '11px ' + FONT;
      ctx.textAlign = 'left';ctx.fillStyle = '#b5d9ed';
      ctx.fillText(boss.def.phaseNames[boss.phase-1],34,63);

      /* 약점 모듈 상태: 이름과 남은 내구도를 글자로 함께 보여 준다 */
      const mods = boss.id === 'nightark' ? boss.parts : boss.parts.filter(function (p) { return !p.hidden; });
      if (mods.length) {
        const gap = 6, pw = (W - 64 - gap * (mods.length - 1)) / mods.length;
        ctx.font = '10px ' + FONT;
        ctx.textAlign = 'center';
        mods.forEach(function (p, i) {
          const x = 32 + i * (pw + gap);
          ctx.fillStyle = 'rgba(6,10,20,.55)';
          ctx.fillRect(x, 81, pw, 15);
          if (p.alive && !p.hidden) {
            ctx.fillStyle = 'rgba(255,186,90,.45)';
            ctx.fillRect(x, 81, pw * Math.max(0, p.hp / p.maxHp), 15);
          }
          ctx.fillStyle = p.hidden ? '#9aa5b6' : p.alive ? '#f2f6ff' : '#7f8ea8';
          const state = p.hidden ? '장갑' : p.alive ? Math.ceil(p.hp / p.maxHp * 100) + '%' : '파괴';
          ctx.fillText(p.name + ' ' + state, x + pw / 2, 84);
        });
      }
    }

    /* 경고 배너 */
    if (G.warning > 0) {
      const blink = Math.floor(G.warning * 6) % 2 === 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(120,20,20,.75)';
      ctx.fillRect(0, H / 2 - 44, W, 88);
      ctx.font = '30px ' + FONT;
      ctx.fillStyle = blink ? '#ffffff' : '#ffb1a8';
      ctx.fillText('WARNING', W / 2, H / 2 - 34);
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = '#ffe1de';
      ctx.fillText('대형 적기 접근 — ' + Bosses.DEFS[stage().boss].name, W / 2, H / 2 + 6);
    }

    /* 스테이지 타이틀 카드 */
    if (G.titleCard > 0) {
      const a = Math.min(1, G.titleCard > 2.2 ? (2.6 - G.titleCard) / .4 : Math.min(1, G.titleCard / .6));
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(6,10,20,.6)';
      ctx.fillRect(0, H / 2 - 60, W, 104);
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = '#9fb4d8';
      ctx.fillText('STAGE ' + stage().no, W / 2, H / 2 - 36);
      ctx.font = '30px ' + FONT;
      ctx.fillStyle = '#eaf2ff';
      ctx.fillText(stage().name, W / 2, H / 2);
      ctx.font = '14px ' + FONT;
      ctx.fillStyle = '#9fb4d8';
      ctx.fillText(stage().sub, W / 2, H / 2 + 28);
      ctx.globalAlpha = 1;
    }

    if (bgError) {
      ctx.textAlign = 'center';
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = '#ffb1a8';
      ctx.fillText(bgError, W / 2, 68);
    }
  }

  function render(t) {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.save();
    if (G.shake > .2) {
      ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    }
    drawBackground();
    drawGround();
    drawItems();
    drawEnemyCues();
    drawEnemies(t);
    drawBombMarkers();
    if (boss) Bosses.draw(boss, ctx, api);
    drawBullets();
    drawPlayer(t);
    drawParticles();
    if(bombRun){if(bombRun.kind==='lancer')LancerBurst.draw(bombRun,ctx);else BombRun.draw(bombRun,ctx);}
    ctx.restore();

    if (G.bombFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (G.bombFlash * .8) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawHud();
  }

  /* ── 루프 ─────────────────────────────────── */
  let lastT = 0, acc = 0, frameCount = 0, frameSum = 0;

  function loop(now) {
    if (!window.__NO_RAF) requestAnimationFrame(loop);
    if (!lastT) lastT = now;
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > .05) dt = .05;                     // 탭 전환 후 급점프 방지

    /* 성능 적응: 느린 프레임이 이어지면 효과를 줄인다 */
    frameSum += dt; frameCount++;
    if (frameCount >= 30) {
      const avg = frameSum / frameCount;
      if (avg > .026 && G.quality > .5) G.quality = .5;
      else if (avg < .019 && G.quality < 1) G.quality = 1;
      frameCount = 0; frameSum = 0;
    }

    if (G.state === 'play') {
      const inp = Input.take();
      if (inp.pause) { pauseGame(); return; }
      if (inp.bomb) useBomb();

      /* 격파 연출용 순간 정지: 실제 시간은 흐르되 게임 시간만 느려진다 */
      if (G.hitStop > 0) {
        G.hitStop = Math.max(0, G.hitStop - dt);
        dt *= .18;
      }
      updateEffects(dt);

      bgScroll += stage().scroll * dt;
      if (G.titleCard > 0) G.titleCard -= dt;
      if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
      if (G.bombFlash > 0) G.bombFlash = Math.max(0, G.bombFlash - dt * 1.6);

      updatePlayer(dt, inp);
      P.chargeClock = (P.chargeClock || 0) + dt;
      P.chargeRelease = Math.max(0, (P.chargeRelease || 0) - dt);
      if (!G.bossCleared) runScript(dt);
      updateGround(dt);
      updateEnemies(dt);
      updateBoss(dt);
      updateBullets(dt);
      updateBombRun(dt);
      updateItems(dt);
      updateParticles(dt);
      collide();
      render(now / 1000);
      updateBombBtn();
    } else if (G.state === 'clear') {
      Input.take();
      G.clearRemaining = Math.max(0,G.clearRemaining-dt);
      const destination = G.stageIndex === Stages.STAGES.length-1 ? '최종 결과' : '다음 스테이지';
      $('clearCountdown').textContent = Math.ceil(G.clearRemaining)+'초 후 '+destination+'로 이동합니다.';
      render(now/1000);
      if (G.clearRemaining <= 0) nextStage();
    } else if (G.state === 'pause') {
      render(now / 1000);
    } else if (G.state === 'over' || G.state === 'end') {
      updateParticles(dt);
      render(now / 1000);
    } else {
      Input.take();              // 메뉴 화면에서도 입력 버퍼를 비운다
      if ((G.state === 'title' || G.state === 'help') && Assets.hasBg(1)) {
        updateAttract(dt);
        renderAttract(now / 1000);
      } else {
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx.fillStyle = '#080b14';
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  /* ── UI 연결 ──────────────────────────────── */
  function updateBombBtn() {
    const el = $('bombCount');
    if (el) el.textContent = String(P.bombs);
    const btn = $('btnBomb');
    if (btn) {btn.classList.toggle('empty', P.bombs <= 0 || !!bombRun);btn.disabled=P.bombs<=0 || !!bombRun;}
  }

  function bindUI() {
    ['easy','hard'].forEach(function(id){
      $('difficulty'+(id==='easy'?'Easy':'Hard')).addEventListener('click',function(){
        if (G.state !== 'title') return;
        selectedDifficulty=id; G.difficulty=id;
        store.set('is_difficulty',id);
        refreshDifficultyUI();
        Snd.play('menu');
      });
    });
    $('btnStart').addEventListener('click', function () { Snd.init(); Snd.resume(); Snd.play('menu'); newGame(); });
    $('btnHelp').addEventListener('click', function () { Snd.play('menu'); G.state = 'help'; showScreen('scHelp'); });
    $('btnHelpBack').addEventListener('click', function () { Snd.play('menu'); toTitle(); });
    $('btnResume').addEventListener('click', resumeGame);
    $('btnQuit').addEventListener('click', toTitle);
    $('btnContinue').addEventListener('click', function () { Snd.play('menu'); continueGame(); });
    $('btnOverQuit').addEventListener('click', toTitle);
    $('btnEndBack').addEventListener('click', toTitle);

    const bgmBtn = $('btnBgm'), sfxBtn = $('btnSfx'), qBtn = $('btnQual'), acBtn = $('btnAutoCharge');
    function chipLabel(btn, text, on) {
      if (!btn) return;
      const label = btn.querySelector('span');
      if (label) label.textContent = text; else btn.textContent = text;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    function syncOpts() {
      chipLabel(bgmBtn, Snd.bgmOn ? 'BGM ON' : 'BGM OFF', Snd.bgmOn);
      chipLabel(sfxBtn, Snd.sfxOn ? 'SFX ON' : 'SFX OFF', Snd.sfxOn);
      chipLabel(qBtn, highQuality ? 'QUALITY HIGH' : 'QUALITY LOW', highQuality);
      chipLabel(acBtn, autoCharge ? 'AUTO CHARGE ON' : 'AUTO CHARGE OFF', autoCharge);
    }
    bgmBtn.addEventListener('click', function () { Snd.init(); Snd.setBgm(!Snd.bgmOn); syncOpts(); });
    sfxBtn.addEventListener('click', function () { Snd.init(); Snd.setSfx(!Snd.sfxOn); syncOpts(); Snd.play('menu'); });
    qBtn.addEventListener('click', function () {
      highQuality = !highQuality;
      store.set('is_quality', highQuality ? '1' : '0');
      syncOpts();
      renderScale = 0; resize();
    });
    if (acBtn) {
      acBtn.addEventListener('click', function () {
        autoCharge = !autoCharge;
        store.set('is_autocharge', autoCharge ? '1' : '0');
        syncOpts();
        Snd.play('menu');
      });
    }
    syncOpts();

    /* 기체 카드의 성능 막대(칸)와 그림 */
    function buildStatBars() {
      const bars = document.querySelectorAll('.ship .stat em');
      Array.prototype.forEach.call(bars, function (em) {
        const fill = +em.getAttribute('data-fill') || 0;
        em.textContent = '';
        for (let i = 0; i < 5; i++) {
          const sp = document.createElement('span');
          if (i < fill) sp.className = 'on';
          em.appendChild(sp);
        }
      });
    }
    buildStatBars();

    /* 기체 선택 */
    function syncShips() {
      SHIPS.forEach(function (sh, i) {
        const btn = $('ship' + i);
        if (btn) btn.setAttribute('aria-pressed', i === shipIndex ? 'true' : 'false');
      });
    }
    SHIPS.forEach(function (sh, i) {
      const btn = $('ship' + i);
      if (!btn) return;
      btn.addEventListener('click', function () {
        shipIndex = i;
        store.set('is_ship', String(i));
        syncShips();
        Snd.play('menu');
      });
    });
    syncShips();

    Input.bindPadButtons($('btnCharge'), $('btnBomb'));

    /* 조작이 들어오면 대기 데모에서 안내 패널로 돌아온다 */
    ['keydown', 'pointerdown'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        attract.lastInput = performance.now();
        if (attract.phase === 'demo') setAttractPhase('panel');
      });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.state === 'play') pauseGame();
    });
    window.addEventListener('resize', resize);
    /* 화면 회전·주소창 변화 대응 */
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  }

  /* 타이틀 카드에 실제 기체 그림을 넣는다 */
  function drawShipCards() {
    SHIPS.forEach(function (sh, i) {
      const el = $('shipArt' + i);
      if (!el) return;
      const g = el.getContext('2d');
      const art = Assets.body(sh.art, 'neutral', 66, sh.tint);
      if (!art) return;
      g.clearRect(0, 0, el.width, el.height);
      const cx = el.width / 2, cy = el.height / 2;
      g.drawImage(art.c, cx - art.px, cy - art.py);
      const frames = Assets.propSet(art.r, sh.prop);
      const f = frames[0];
      art.hubs.forEach(function (h) {
        g.drawImage(f, cx + h.x - f.width / 2, cy + h.y - f.height / 2);
      });
    });
  }

  /* ── 시작 ─────────────────────────────────── */
  function boot() {
    resize();
    bindUI();
    refreshDifficultyUI();
    Input.init(cv, W, H);
    $('tHi').textContent = G.hi.toLocaleString();
    $('tLast').textContent = G.lastScore.toLocaleString();
    renderRanking();

    Assets.loadCore(function (p) {
      $('loadBar').style.width = Math.round(p * 100) + '%';
      $('loadMsg').textContent = Math.round(p * 100) + '%';
    }).then(function () {
      const fontReady = document.fonts ? document.fonts.load('16px "NeoDunggeunmo"').catch(function(){}) : Promise.resolve();
      return Promise.all([
        Assets.loadBg(1).catch(function () { /* 배경 실패는 진행 가능 */ }),
        Promise.race([fontReady,new Promise(function(resolve){setTimeout(resolve,2500);})])
      ]);
    }).then(function () {
      G.state = 'title';
      drawShipCards();
      showScreen('scTitle');
      if (!window.__NO_RAF) requestAnimationFrame(loop);
    }).catch(function (err) {
      console.error(err);
      $('loadMsg').textContent = err.message + ' — assets 폴더가 함께 있는지 확인하세요.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn';
      retry.textContent = '다시 시도';
      retry.addEventListener('click', function () { location.reload(); });
      $('scLoad').appendChild(retry);
    });
  }

  /* 보스 스크립트가 사용하는 공개 API */
  const api = {
    W: W, H: H,
    get px() { return P.x; },
    get py() { return P.y; },
    get bulletMul() { return G.bulletMul; },
    get attackRate() { return mode().attackRate; },
    patternCount: function(n) { return Difficulty.patternCount(n,G.difficulty); },
    onBossPhase: function(b) {
      eBullets.length = 0;
      floatText(W/2,H*.43,'PHASE '+b.phase+' · '+b.def.phaseNames[b.phase-1],'#b5edff');
      Snd.play('warning');
    },
    eShot: eShot,
    aimAngle: aimAngle,
    spawnMini: spawnMini,
    boom: boom,
    shake: shake
  };


  /* test-only hooks (copy only) */
  window.__T = {
    G: G, P: P, api: api, _t: 1000,
    newGame: newGame, startStage: startStage, nextStage: nextStage, stage: stage,
    enemies: function () { return enemies; },
    grounds: function () { return grounds; },
    eBullets: function () { return eBullets; },
    pBullets: function () { return pBullets; },
    items: function () { return items; },
    parts: function () { return parts; },
    getBoss: function () { return boss; },
    step: function (n, dtms) {
      dtms = dtms || 16.7;
      for (var i = 0; i < n; i++) { window.__T._t += dtms; loop(window.__T._t); }
    },
    forceBoss: function () {
      G.scriptIdx = stage().script.length;
      G.warning = 0;
      boss = Bosses.create(stage().boss, G.stageIndex);
      boss.state = 'fight';
      boss.y = boss.entryY;
      G.titleCard = 0;
      return boss;
    },
    hurtBoss: function (frac) { if (boss) boss.hp = Math.max(1, Math.round(boss.maxHp * frac)); },
    killBossNow: function () { if (boss) { boss.hp = 1; damageBoss(999, boss.x, boss.y, null); } },
    killPart: function (key) {
      if (!boss) return;
      var p = boss.parts.filter(function (q) { return q.key === key; })[0];
      if (p) { p.hidden = false; damageBoss(p.hp * 2, boss.x, boss.y, p); }
    },
    setPower: function (p, b) { P.power = p; P.bombs = b; },
    setCharge: function (v) { P.charge = v; },
    killPlayer: function () { P.inv = 0; hitPlayer(); },
    god: function () { window.__GOD = true; },
    fakeItems: function () { dropItem(140, 300, 'power'); dropItem(220, 330, 'bomb'); dropItem(300, 300, 'life'); },
    bomb: useBomb,
    bombState: function () { return bombRun; },
    spawnMid: spawnMidboss,
    spawnType: function (type, x, y, move, fire) {
      return makeEnemy(type, x, y, {
        move: move || 'hover', fire: fire || 'none', speed: 90, targetY: y + 40
      });
    },
    attract: function () { return attract; },
    spawnGroundAt: function (type, x, y) {
      var t = spawnGround({ type: type, x: x / 480, drop: null });
      if (t && y !== undefined) t.y = y;
      return t;
    },
    fireCharge: function () { P.charge = 1; fireCharge(); },
    shootAt: function (dmg, x, y, pierce) { pShot(x, y, 0, -520, dmg, pierce ? 'charge' : 'vulcan', !!pierce); },
    attractDemo: function () { setAttractPhase('demo'); },
    attractStage: function (i) { attract.stage = i; attract.cycleT = 0; attract.boss = null; attract.planes.length = 0; attract.props.length = 0; },
    render: function () { render(window.__T._t / 1000); }
  };

  boot();

  return api;
})();
