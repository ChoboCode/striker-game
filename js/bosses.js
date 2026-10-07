/* 보스 정의. 5개 스테이지의 원화에 부위별 파손 이미지를 합성한다.
   캔버스 원화는 이미지가 없는 경우의 대체 표현으로 유지한다. */
const Bosses = (function () {
  'use strict';

  const TAU = Math.PI * 2;

  /* ── 공통 발사 헬퍼 ───────────────────────── */
  function shot(G, x, y, ang, spd, style) { G.eShot(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, style); }

  function fan(G, x, y, baseAng, n, spread, spd, style) {
    n = G.patternCount ? G.patternCount(n) : n;
    if (n <= 1) { shot(G, x, y, baseAng, spd, style); return; }
    for (let i = 0; i < n; i++) shot(G, x, y, baseAng - spread / 2 + spread * i / (n - 1), spd, style);
  }
  function ring(G, x, y, n, spd, offset, style) {
    n = G.patternCount ? G.patternCount(n) : n;
    for (let i = 0; i < n; i++) shot(G, x, y, offset + TAU * i / n, spd, style);
  }
  function aimed(G, x, y, spd, style) { shot(G, x, y, G.aimAngle(x, y), spd, style); }

  /* 탄 수보다 궤적과 발사 위치로 구분하는 페이즈 패턴. */
  function petals(G, x, y, count, spd, offset, style) {
    count = G.patternCount ? G.patternCount(count) : count;
    for (let i = 0; i < count; i++) fan(G, x, y, offset + TAU * i / count, 3, .16, spd, style);
  }
  function spiral(G, x, y, arms, spd, offset, style) {
    arms = G.patternCount ? G.patternCount(arms) : arms;
    for (let i = 0; i < arms; i++) shot(G, x, y, offset + TAU * i / arms, spd, style);
  }
  function laneWall(G, b, y, count, spd, gapX) {
    count = G.patternCount ? G.patternCount(count) : count;
    const gapWidth = 96;
    for (let i = 0; i < count; i++) {
      const x = 24 + (G.W - 48) * i / (count - 1);
      if (Math.abs(x - gapX) < gapWidth / 2) continue;
      G.eShot(x, y, 0, spd, 'eSmall');
    }
    // 표시한 통로는 이 탄벽 한 줄의 빈 공간이다. 다른 공격까지 안전한 구역은 아니다.
    b.laneCue = {x:gapX,y:y,width:gapWidth,life:.7};
  }

  /* ── 좌우·상하 흔들림 ──────────────────────
     b.t 는 등장 연출 동안에도 쌓이므로 Math.sin(b.t * f) 를 위치에 바로 쓰면
     교전이 시작되는 순간 기체가 엉뚱한 x 로 순간이동한다(한 프레임에 100px 넘게 튀었다).
     그래서 교전 중에만 쌓이는 전용 위상을 쓴다. 위상은 0 에서 시작하므로
     첫 프레임 위치가 등장이 끝난 자리(화면 중앙)와 이어진다.
     진폭·중심은 목표값으로 천천히 옮겨 페이즈가 바뀔 때도 튀지 않는다. */
  function swingX(b, dt, freq, amp) {
    b.swing = (b.swing || 0) + dt * freq;
    b.swingAmp = b.swingAmp === undefined ? amp : ease(b.swingAmp, amp, dt, 1.1);
    return Math.sin(b.swing) * b.swingAmp;
  }
  function bobY(b, dt, freq, amp) {
    b.bob = (b.bob || 0) + dt * freq;
    return Math.sin(b.bob) * amp;
  }
  function ease(cur, target, dt, rate) { return cur + (target - cur) * Math.min(1, dt * rate); }

  /* ── 발악(폭주) ────────────────────────────
     부위를 부수면 그 자리의 공격은 사라지지만 남은 기체가 폭주한다.
     파괴 비율만큼 연사 주기가 짧아지고 탄이 늘며, 부서진 자리에서도 탄이 새어 나온다.
     세 페이즈 모두에 적용되므로 부위 파괴는 점수를 노린 선택이지 쉬운 길이 아니다. */
  function rageOf(b) {
    const n = b.parts.length;
    if (!n) return 0;
    let dead = 0;
    for (const p of b.parts) if (!p.alive) dead++;
    return dead / n;
  }
  /* 연사 주기: 폭주할수록 짧아지고, 후반 페이즈일수록 더 크게 줄어든다 */
  function rageCt(b, base) { return base * (1 - (.10 + .04 * b.phase) * rageOf(b)); }
  /* 탄수: 넓게 퍼지는 탄막에만 쓴다(조준탄은 대신 각을 넓힌다) */
  function rageN(b, n) { return n + Math.round(rageOf(b) * (.5 + .5 * b.phase)); }
  /* 조준탄은 수를 늘리는 대신 퍼짐을 키워 피할 틈을 남긴다 */
  function rageWide(b, spread) { return spread * (1 + .55 * rageOf(b)); }
  function rageSpd(b, sp) { return sp * (1 + (.04 + .03 * b.phase) * rageOf(b)); }
  function partPos(b, p) { return { x: b.x + p.ox * b.w * (b.flip ? -1 : 1), y: b.y + p.oy * b.h }; }

  /* 파손부 분출: 부서진 자리는 조용해지지 않는다.
     그 포대가 하던 조준 사격 대신, 조준을 잃은 넓은 탄막이 같은 주기로 뿜어져 나온다.
     각 보스의 사격 주기 안에서 호출하므로 부위를 부술수록 탄막은 촘촘해진다. */
  function wreckFan(G, b, parts, sp, n, spread) {
    parts.forEach(function (p) {
      if (p.alive) return;
      const q = partPos(b, p);
      fan(G, q.x, q.y, Math.PI / 2, n, spread, sp, 'eSmall');
    });
  }

  /* ── 컨셉 기반 캔버스 보스 그리기 ─────────── */

  const ART = BossArt;

  /* 컨셉 보스의 레이어를 1회만 그려 캐시한다. */
  const artCache = Object.create(null);
  function artFor(id, width) {
    const w = Math.round(width);
    const key = id + '|' + w;
    if (artCache[key]) return artCache[key];
    const def = ART[id];
    if (!def) return null;
    const h = Math.round(w * def.ratio);
    function layer(fn) {
      const c = Assets.makeCanvas(w, h);
      const g = c.getContext('2d');
      fn(g, w);
      return c;
    }
    const out = { w: w, h: h, body: layer(def.body), parts: {} };
    Object.keys(def.parts || {}).forEach(function (k) { out.parts[k] = layer(def.parts[k]); });
    artCache[key] = out;
    return out;
  }

  /* ── 보스 정의 ───────────────────────────── */
  /* 듄 콜로서스 주포: boss2-dune.png 에서 실측한 두 포신의 가로 위치(폭 비율)와 포구 높이(높이 비율) */
  const DUNE_BARREL = [-.016, .038], DUNE_MUZZLE_Y = .228;
  const DUNE_SALVO_GAP = .08, DUNE_SWEEP = .052, DUNE_MUZZLE_LIFE = .16;

  const DEFS = {
    /* 1 BREAKWATER — 4발 중폭격기 (PNG 스프라이트) */
    breakwater: {
      name: '브레이크워터', tag: '4발 중폭격기', sprite: 'boss1',
      width: 330, hp: 2200, hitW: .58, hitH: .42, entryY: 170, projectParts:true,
      parts: [
        { key: 'turretF', name: '전방 포탑', ox: 0, oy: .018, r: .075, hp: 240 },
        { key: 'turretR', name: '후방 포탑', ox: 0, oy: -.115, r: .075, hp: 240 }
      ],
      move: function (b, dt, G) {
        b.x = G.W / 2 + swingX(b, dt, b.phase === 1 ? .5 : .9, b.phase === 1 ? 110 : 145);
        b.y = b.entryY + bobY(b, dt, .7, 14);
      },
      fire: function (b, dt, G) {
        b.ct -= dt;
        if (b.ct > 0) return;
        const sp = rageSpd(b, 150 * G.bulletMul);
        const alive = b.parts.filter(function (p) { return p.alive; });
        const lost = b.parts.length - alive.length;
        /* 부서진 포탑 자리는 조준을 잃은 대신 더 넓게 쏟아 낸다.
           사격 주기가 짧아지는 3페이즈에서는 한 번 걸러 터뜨려 밀도를 맞춘다. */
        if (b.phase < 3) wreckFan(G, b, b.parts, sp * .92, 4, b.phase === 1 ? 1.3 : 1.5);
        else if (b.step % 2 === 0) wreckFan(G, b, b.parts, sp * .9, 5, 1.9);
        if (b.phase === 1) {
          alive.forEach(function (p) {
            const px = b.x + p.ox * b.w, py = b.y + p.oy * b.h;
            fan(G, px, py, G.aimAngle(px, py), 3, .34, sp, 'eSmall');
          });
          if (b.step % 3 === 2) fan(G, b.x, b.y + b.h * .3, Math.PI / 2, rageN(b, 7), 1.5, sp * .8, 'eSmall');
          b.ct = rageCt(b, .98);
        } else if (b.phase === 2) {
          if (b.step % 2 === 0) {
            const gap = [.28, .5, .72][Math.floor(b.step / 2) % 3] * G.W;
            laneWall(G, b, b.y + b.h * .3, rageN(b, 13), sp * .80, gap);
          } else {
            [-.34, .34].forEach(function (o) {
              const px = b.x + o * b.w;
              fan(G, px, b.y + b.h * .25, G.aimAngle(px, b.y), 3, rageWide(b, .5), sp * 1.05, 'eBig');
            });
          }
          /* 폭주하면 예비 편대를 더 자주 사출한다 */
          const gap = lost ? 4 : 6;
          if (b.step % gap === gap - 1) G.spawnMini(b.x - 70, b.y, {}), G.spawnMini(b.x + 70, b.y, {});
          b.ct = rageCt(b, .95);
        } else {
          if (b.step % 3 === 2) {
            spiral(G, b.x, b.y + b.h * .2, rageN(b, 6), sp * .72, b.step * .47, 'eSmall');
          } else {
            fan(G, b.x, b.y + b.h * .3, G.aimAngle(b.x, b.y), 5, rageWide(b, .8), sp * 1.15, 'eBig');
            fan(G, b.x, b.y + b.h * .3, Math.PI / 2, rageN(b, 8), 2.4, sp * .78, 'eSmall');
          }
          b.ct = rageCt(b, .8);
        }
        b.step++;
      }
    },

    /* 2 DUNE COLOSSUS — 장갑 열차 (PNG 스프라이트) */
    dune: {
      name: '듄 콜로서스', tag: '사막 장갑 열차', sprite: 'boss2',
      width: 430, hp: 2800, hitW: .92, hitH: .34, entryY: 150, sideRun: true, projectParts:true,
      parts: [
        { key: 'ammo', name: '탄약차 포탑', ox: -.30, oy: -.02, r: .10, hp: 320 },
        { key: 'cannon', name: '주포', ox: 0, oy: -.06, r: .12, hp: 480 },
        { key: 'loco', name: '기관차', ox: .31, oy: -.02, r: .10, hp: 380 }
      ],
      init: function (b) {
        b.dir = 1; b.speed = 90;
        b.salvo = 0; b.salvoN = 0; b.salvoCt = 0; b.salvoAng = Math.PI / 2;
        b.muzzle = [];
      },
      move: function (b, dt, G) {
        /* 차량을 잃을수록 제동이 풀린 듯 더 빠르게 왕복한다 */
        b.speed = (b.phase === 1 ? 120 : (b.phase === 2 ? 150 : 185)) * (1 + .25 * rageOf(b));
        b.x += b.dir * b.speed * dt;
        const margin = b.w * .30;
        if (b.x > G.W - margin) { b.x = G.W - margin; b.dir = -1; }
        if (b.x < margin) { b.x = margin; b.dir = 1; }
        b.y = b.entryY + bobY(b, dt, .6, 6);
        b.flip = b.dir < 0;
      },
      fire: function (b, dt, G) {
        const sp = rageSpd(b, 145 * G.bulletMul);
        const face = b.flip ? -1 : 1;
        const part = function (k) { return b.parts.find(function (p) { return p.key === k; }); };
        const cannon = part('cannon'), ammo = part('ammo'), loco = part('loco');

        /* 주포: 한 번 잡은 각도로 두 포신이 번갈아 연속 포격한다.
           조준은 포격 시작 때 고정되므로 옆으로 비키면 탄막 전체를 피할 수 있다. */
        if (!cannon.alive) b.salvo = 0;
        if (b.salvo > 0) {
          b.salvoCt -= dt;
          while (b.salvo > 0 && b.salvoCt <= 0) {
            const i = b.salvoN - b.salvo;
            const mx = b.x + DUNE_BARREL[i % 2] * b.w * face;
            const my = b.y + b.h * DUNE_MUZZLE_Y;
            shot(G, mx, my, b.salvoAng + (i - (b.salvoN - 1) / 2) * DUNE_SWEEP, sp * .85, 'eBig');
            b.muzzle.push({ x: mx, y: my, born: b.t });
            b.salvo--;
            b.salvoCt += DUNE_SALVO_GAP;
          }
        }

        b.ct -= dt;
        if (b.ct > 0) return;
        if (b.step % 2 === 0) {
          if (cannon.alive) {
            b.salvoN = b.phase === 3 ? 8 : (b.phase === 2 ? 6 : 4);
            b.salvo = b.salvoN;
            b.salvoCt = 0;
            b.salvoAng = G.aimAngle(b.x, b.y + b.h * DUNE_MUZZLE_Y);
            G.shake(2);
          } else {
            /* 주포를 잃으면 파열된 포신에서 화염이 터져 나온다.
               조준은 못 하지만 앞을 넓게 덮으므로 열차 옆으로 빠져야 한다. */
            fan(G, b.x, b.y + b.h * DUNE_MUZZLE_Y, Math.PI / 2, rageN(b, 6), 2.1, sp * .78, 'eSmall');
            G.shake(2);
          }
        }
        const ax = b.x + ammo.ox * b.w * face, ay = b.y + b.h * .1;
        if (ammo.alive) {
          const swing = b.phase === 2 ? (b.step % 2 ? -.28 : .28) : 0;
          fan(G, ax, ay, Math.PI / 2 + swing, b.phase === 1 ? 3 : 5, 1.1, sp, 'eSmall');
        } else {
          /* 탄약차가 터진 자리에서 남은 포탄이 계속 유폭한다 */
          fan(G, ax, ay, Math.PI / 2, 2 + b.phase, 1.6, sp * .9, 'eSmall');
          if (b.step % 4 === 1) ring(G, ax, b.y, 4 + b.phase * 2, sp * .6, b.t * 1.7, 'eSmall');
        }
        if (b.step % 2 === 1) {
          const lx = b.x + loco.ox * b.w * face, ly = b.y + b.h * .1;
          if (loco.alive) fan(G, lx, ly, G.aimAngle(lx, ly), 2, rageWide(b, .28), sp * 1.1, 'eSmall');
          /* 기관차가 뚫리면 보일러가 터지며 증기와 파편이 쏟아진다 */
          else fan(G, lx, ly, Math.PI / 2, 2 + b.phase, 1.4, sp * .95, 'eSmall');
        }
        /* 폭주가 심하면 3페이즈를 기다리지 않고 전방위 탄이 나온다 */
        if ((b.phase === 3 || rageOf(b) >= .66) && b.step % 4 === 3) {
          if (b.phase === 3) laneWall(G, b, b.y + b.h * .18, rageN(b, 13), sp * .7, (b.dir > 0 ? .30 : .70) * G.W);
          else ring(G, b.x, b.y, rageN(b, 14), sp * .7, b.t, 'eSmall');
        }
        b.ct = rageCt(b, b.phase === 3 ? .68 : .9);
        b.step++;
      },
      /* 포구 섬광이 짧게 남아 포탄이 쌏아지는 것처럼 보이게 한다. */
      fx: function (b, ctx) {
        if (!b.muzzle || !b.muzzle.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = b.muzzle.length - 1; i >= 0; i--) {
          const m = b.muzzle[i], age = (b.t - m.born) / DUNE_MUZZLE_LIFE;
          if (age >= 1 || age < 0) { b.muzzle.splice(i, 1); continue; }
          const k = 1 - age;
          const img = Assets.glow(8 + 14 * k, 'rgba(255,246,214,.95)', 'rgba(255,146,46,.4)');
          ctx.globalAlpha = k;
          ctx.drawImage(img, m.x - img.width / 2, m.y - img.height / 2);
        }
        ctx.restore();
      }
    },

    /* 3 FROST GEMINI — 쌍동체 요격기 (캔버스 작화) */
    gemini: {
      name: '프로스트 제미니', tag: '설상 요격 기함', sprite: 'boss3', art: 'gemini',
      width: 340, hp: 3600, hitW: .58, hitH: .56, entryY: 190, projectParts:true,
      parts: [
        { key: 'podL', name: '좌현 포대', ox: -.33, oy: -.02, r: .10, hp: 480 },
        { key: 'podR', name: '우현 포대', ox: .33, oy: -.02, r: .10, hp: 480 }
      ],
      init: function (b) { b.dashCt = 4; b.dashX = 0; },
      move: function (b, dt, G) {
        /* 포대를 모두 잃으면 1페이즈에서도 몸으로 들이받듯 좌우로 돌진한다 */
        if (b.phase >= 2 || rageOf(b) >= 1) {
          b.dashCt -= dt;
          if (b.dashCt <= 0) { b.dashCt = 3.2 * (1 - .3 * rageOf(b)); b.dashSide = -(b.dashSide || -1); b.dashX = b.dashSide * 150; }
          const tx = G.W / 2 + b.dashX;
          b.x += (tx - b.x) * Math.min(1, dt * 2.4);
          b.cy = ease(b.cy === undefined ? b.entryY : b.cy, b.entryY - 20, dt, 1.2);
          b.y = b.cy + bobY(b, dt, 1.4, 22);
        } else {
          b.x = G.W / 2 + swingX(b, dt, .62, 125);
          b.cy = b.cy === undefined ? b.entryY : b.cy;
          b.y = b.cy + bobY(b, dt, .9, 18);
        }
      },
      fire: function (b, dt, G) {
        b.ct -= dt;
        if (b.ct > 0) return;
        const sp = rageSpd(b, 160 * G.bulletMul);
        const noseAt = function (i) { return { x: b.x + (i ? 1 : -1) * b.w * .22, y: b.y + b.h * .42 }; };
        const noses = [], holes = [];
        b.parts.forEach(function (p, i) { (p.alive ? noses : holes).push(noseAt(i)); });
        /* 포대를 잃으면 뚫린 자리에서 냉각재가 터져 나오고, 둘 다 잃으면 동체가 직접 쏜다 */
        const body = { x: b.x, y: b.y + b.h * .3 };
        const vent = function (n, spread) {
          holes.forEach(function (q) { fan(G, q.x, q.y, Math.PI / 2, n, spread, sp * .92, 'eSmall'); });
        };
        if (b.phase === 1) {
          const nose = noses[b.step % Math.max(1, noses.length)];
          if (nose) fan(G, nose.x, nose.y, G.aimAngle(nose.x, nose.y), 5, .65, sp, 'eSmall');
          else fan(G, body.x, body.y, G.aimAngle(body.x, body.y), 5, rageWide(b, .8), sp * 1.05, 'eSmall');
          vent(4, 1.3);
          if (b.step % 3 === 2) fan(G, b.x, b.y + b.h * .25, Math.PI / 2, rageN(b, 5), 1.6, sp * .75, 'eSmall');
          b.ct = rageCt(b, .62);
        } else if (b.phase === 2) {
          noses.forEach(function (n) {
            const inward = n.x < b.x ? -.38 : .38;
            fan(G, n.x, n.y, Math.PI / 2 + inward + Math.sin(b.step * .7) * .15, 3, .4, sp * 1.05, 'eSmall');
          });
          if (!noses.length) fan(G, body.x, body.y, G.aimAngle(body.x, body.y), 5, rageWide(b, .7), sp * 1.1, 'eSmall');
          vent(5, 1.5);
          if (b.step % 3 === 2) petals(G, b.x, b.y + b.h * .05, 4, sp * .62, b.step * .24, 'eBig');
          b.ct = rageCt(b, .85);
        } else {
          noses.forEach(function (n) { fan(G, n.x, n.y, Math.PI / 2 + Math.sin(b.step * .6) * .25, 5, 1.2, sp * .9, 'eSmall'); });
          vent(7, 2.0);
          if (!noses.length && b.step % 3 === 0) ring(G, b.x, b.y, 10, sp * .6, -b.t, 'eSmall');
          if (b.step % 2 === 1) aimed(G, b.x, b.y + b.h * .3, sp * 1.4, 'eBig');
          b.ct = rageCt(b, .6);
        }
        b.step++;
      }
    },

    /* 4 CANOPY WARDEN — 수관 방공함 */
    canopy: {
      name: '캐노피 워든', tag: '수관 방공함', sprite: 'bossCanopy', art: 'canopy',
      width: 360, hp: 3900, hitW: .62, hitH: .60, entryY: 184, projectParts: true,
      parts: [
        { key: 'wingL', name: '좌익 기관포', ox: -.31, oy: .05, r: .105, hp: 560 },
        { key: 'wingR', name: '우익 기관포', ox: .31, oy: .05, r: .105, hp: 560 },
        { key: 'core', name: '수관 동력핵', ox: 0, oy: -.10, r: .12, hp: 840, hidden: true }
      ],
      init: function () {},
      move: function (b, dt, G) {
        b.x = G.W / 2 + swingX(b, dt, b.phase === 3 ? .72 : .48, Math.min(b.phase === 3 ? 126 : 92, (G.W - b.w) / 2 - 12));
        b.y = b.entryY + bobY(b, dt, .76, 12);
      },
      fire: function (b, dt, G) {
        b.ct -= dt;
        if (b.ct > 0) return;
        const sp = rageSpd(b, 156 * G.bulletMul);
        const wings = b.parts.filter(function (p) { return p.key.indexOf('wing') === 0; });
        const alive = wings.filter(function (p) { return p.alive; });
        const coreAlive = b.parts.some(function (p) { return p.key === 'core' && p.alive; });
        if (b.phase === 1 || (b.phase === 2 && b.step % 2 === 0)) {
          /* 교차 조준: 좌우 날개가 번갈아 겨냥해 이동 경로를 읽는다. */
          const p = alive[b.step % Math.max(1, alive.length)];
          if (p) { const q = partPos(b, p); q.y += b.h * .16; fan(G, q.x, q.y, G.aimAngle(q.x, q.y), 3, .46, sp, 'eSmall'); }
          else wreckFan(G, b, wings, sp * .9, 4, 1.4);
          b.ct = rageCt(b, .76);
        } else {
          /* 이 양갈래 사격은 바깥을 향한다. 고리탄은 별도의 회피가 필요하다. */
          const y = b.y + b.h * .28, a = Math.PI / 2 + .48;
          fan(G, b.x - b.w * .16, y, a, 4 + b.phase, .42, sp * .86, 'eSmall');
          fan(G, b.x + b.w * .16, y, Math.PI - a, 4 + b.phase, .42, sp * .86, 'eSmall');
          if (b.phase === 3 && coreAlive) {
            // 날개를 바깥으로 펼치고 박자마다 각도를 바꾼다. 중앙 통로는 유지한다.
            const spread = .54 + Math.sin(b.step * .55) * .12;
            fan(G, b.x - b.w * .12, y, Math.PI / 2 + spread, 5, .38, sp * .64, 'eCore');
            fan(G, b.x + b.w * .12, y, Math.PI / 2 - spread, 5, .38, sp * .64, 'eCore');
          }
          wreckFan(G, b, wings, sp * .82, 3 + b.phase, 1.5);
          b.ct = rageCt(b, b.phase === 3 ? .62 : .94);
        }
        b.step++;
      }
    },

    /* 5 CALDERA CROWN — 화산 포격함 */
    caldera: {
      name: '칼데라 크라운', tag: '화산 포격함', sprite: 'bossCaldera', art: 'caldera',
      width: 380, hp: 4300, hitW: .64, hitH: .60, entryY: 188, projectParts: true,
      parts: [
        { key: 'wingL', name: '좌익 용융포', ox: -.22, oy: .10, r: .11, hp: 620 },
        { key: 'wingR', name: '우익 용융포', ox: .22, oy: .10, r: .11, hp: 620 },
        { key: 'core', name: '열핵 노심', ox: 0, oy: -.07, r: .125, hp: 920, hidden: true }
      ],
      init: function (b) { b.spin = 0; b.lockAng = null; },
      move: function (b, dt, G) {
        b.spin += dt * (b.phase === 3 ? 1.16 : .66);
        b.x = G.W / 2 + swingX(b, dt, .42, Math.min(b.phase === 3 ? 116 : 82, (G.W - b.w) / 2 - 12));
        b.y = b.entryY + bobY(b, dt, .68, 13);
      },
      fire: function (b, dt, G) {
        b.ct -= dt;
        if (b.ct > 0) return;
        const sp = rageSpd(b, 160 * G.bulletMul);
        const guns = b.parts.filter(function (p) { return p.key.indexOf('wing') === 0; });
        const alive = guns.filter(function (p) { return p.alive; });
        const coreAlive = b.parts.some(function (p) { return p.key === 'core' && p.alive; });
        if (b.lockAng === null && b.step % 2 === 1) {
          /* 짧은 락온 간격 뒤에만 같은 방향으로 쏘므로 회피할 여유가 있다. */
          b.lockAng = G.aimAngle(b.x, b.y + b.h * .2); b.ct = .48; return;
        }
        if (b.lockAng !== null) {
          alive.forEach(function (p) { const q = partPos(b, p); q.y += b.h * .25; fan(G, q.x, q.y, b.lockAng, 3 + b.phase, .52, sp * 1.08, 'eBig'); });
          if (!alive.length) fan(G, b.x, b.y + b.h * .25, b.lockAng, 4, .72, sp, 'eSmall');
          b.lockAng = null; b.ct = rageCt(b, .84);
        } else {
          /* 고리탄은 밀도가 낮고 회전하므로 그 사이에 넓은 회피 간격이 남는다. */
          if (b.phase === 1) ring(G, b.x, b.y + b.h * .08, 10, sp * .59, b.spin, coreAlive ? 'eCore' : 'eSmall');
          else if (b.phase === 2 || b.step % 4 === 0) petals(G, b.x, b.y + b.h * .08, b.phase === 2 ? 4 : 6, sp * .59, b.step * .27, coreAlive ? 'eCore' : 'eSmall');
          else spiral(G, b.x, b.y + b.h * .08, 8, sp * .65, b.step * .49, coreAlive ? 'eCore' : 'eSmall');
          wreckFan(G, b, guns, sp * .84, 3 + b.phase, 1.55);
          b.ct = rageCt(b, b.phase === 3 ? .66 : 1.02);
        }
        b.step++;
      },
      fx: function (b, ctx) {
        if (b.state !== 'fight' || b.lockAng === null) return;
        ctx.save();
        ctx.strokeStyle = '#ffc980'; ctx.lineWidth = 2;
        ctx.globalAlpha = .65; ctx.setLineDash([7, 9]);
        const guns = b.parts.filter(function (p) { return p.alive && p.key.indexOf('wing') === 0; });
        const origins = guns.length ? guns : [{ox:0,oy:.25}];
        origins.forEach(function (p) {
          const x=p.ox*b.w, y=(p.oy+(guns.length ? .25 : 0))*b.h;
          ctx.beginPath(); ctx.moveTo(x,y);
          ctx.lineTo(x+Math.cos(b.lockAng)*720,y+Math.sin(b.lockAng)*720); ctx.stroke();
        });
        ctx.restore();
      }
    },

    /* 6 NIGHT ARK — 해상 기동 요새 */
    nightark: {
      name: '나이트 아크', tag: '해상 기동 요새', sprite: 'boss4', art: 'nightark',
      width: 320, hp: 3100, hitW: .76, hitH: .84, entryY: 190,
      projectParts: true,
      parts: [
        { key: 'bayL', name: '좌현 무장부', ox: -.25, oy: -.09, r: .12, hp: 460 },
        { key: 'bayR', name: '우현 무장부', ox: .25, oy: -.09, r: .12, hp: 460 },
        { key: 'bridge', name: '함교', ox: 0, oy: -.31, r: .095, hp: 620, hidden: true }
      ],
      init: function (b) { b.launchCt = 3; },
      move: function (b, dt, G) {
        b.x = G.W / 2 + swingX(b, dt, .42, Math.min(68, (G.W - b.w) / 2 - 12));
        b.y = b.entryY + bobY(b, dt, .8, 10);
      },
      fire: function (b, dt, G) {
        const sp = rageSpd(b, 150 * G.bulletMul);
        const bays = b.parts.filter(function (p) { return p.key.indexOf('bay') === 0; });
        const bayAlive = bays.filter(function (p) { return p.alive; });
        const bridgeAlive = b.parts.some(function (p) { return p.key === 'bridge' && p.alive; });
        /* 무장부를 잃으면 조준 사격 대신 뚫린 파공에서 탄이 터져 나온다. */
        b.launchCt -= dt;
        if (b.launchCt <= 0) {
          bayAlive.forEach(function (p) {
            const x = b.x+p.ox*b.w, y = b.y+p.oy*b.h;
            fan(G,x,y,bridgeAlive ? G.aimAngle(x,y) : Math.PI/2,3,.35,sp,'eSmall');
          });
          wreckFan(G, b, bays, sp * .9, 4 + b.phase, 1.5);
          b.launchCt = (b.phase === 3 ? 3.4 : 4.6) * (1 - .35 * rageOf(b));
        }
        b.ct -= dt;
        if (b.ct > 0) return;
        if (b.phase < 3) wreckFan(G, b, bays, sp * .9, 2 + b.phase, 1.3 + .2 * b.phase);
        else if (b.step % 2 === 1) wreckFan(G, b, bays, sp * .9, 6, 1.9);
        if (b.phase === 1) {
          fan(G, b.x, b.y + b.h * .3, Math.PI / 2, rageN(b, 7), 1.6, sp * .85, 'eSmall');
          b.ct = rageCt(b, 1.1);
        } else if (b.phase === 2) {
          fan(G, b.x, b.y+b.h*.3, Math.PI/2, rageN(b, 3), .6, sp*.85, 'eSmall');
          bayAlive.forEach(function (p) {
            const px = b.x + p.ox * b.w, py = b.y+p.oy*b.h;
            fan(G, px, py, bridgeAlive ? G.aimAngle(px, py) : Math.PI/2, 3, rageWide(b, .45), sp, 'eSmall');
          });
          /* 함교를 잃으면 조준은 못 하지만 잔해가 불타며 전방위로 탄을 흩뿌린다 */
          if (b.step % 3 === 2) {
            if (bridgeAlive) petals(G, b.x, b.y-b.h*.31, 4, sp * .66, b.step * .31, 'eBig');
            else ring(G, b.x, b.y-b.h*.31, rageN(b, 10), sp * .72, -b.t, 'eSmall');
          }
          b.ct = rageCt(b, .9);
        } else {
          if (b.step % 2 === 0) {
            for (let i = 0; i < 3; i++) {
              if (i !== 1 && !bayAlive.some(function (p) { return p.key === (i === 0 ? 'bayL' : 'bayR'); })) continue;
              const px = b.x + (i - 1) * b.w * .24;
              fan(G, px, b.y + b.h * .28, Math.PI / 2 + Math.sin(b.step * .7 + i) * .24, rageN(b, 5), 1.0, sp * .95, 'eSmall');
            }
          } else {
            if (bridgeAlive) {
              aimed(G, b.x, b.y + b.h * .3, sp * 1.45, 'eBig');
              laneWall(G, b, b.y + b.h * .20, 15, sp * .7, (b.step % 4 === 1 ? .28 : .72) * G.W);
            } else {
              /* 조준을 잃은 대신 앞을 통째로 덮는 탄벽을 친다 — 좌우 끝으로 빠져야 한다 */
              fan(G, b.x, b.y+b.h*.3, Math.PI/2, rageN(b, 9), 2.3, sp * .9, 'eSmall');
              ring(G, b.x, b.y-b.h*.31, 12, sp * .62, -b.t, 'eSmall');
            }
          }
          b.ct = rageCt(b, .7);
        }
        b.step++;
      }
    },

    /* 7 IRON REGENT — 공중 요새 (캔버스 작화) */
    regent: {
      name: '아이언 리전트', tag: '강철 기함', sprite: 'boss5', art: 'regent',
      width: 400, hp: 4400, hitW: .60, hitH: .58, entryY: 200, projectParts:true,
      parts: [
        { key: 'armL', name: '좌현 주포', ox: -.33, oy: .04, r: .11, hp: 700 },
        { key: 'armR', name: '우현 주포', ox: .33, oy: .04, r: .11, hp: 700 },
        { key: 'core', name: '중앙 동력로', ox: 0, oy: -.02, r: .12, hp: 1000, hidden: true }
      ],
      init: function (b) { b.spin = 0; },
      move: function (b, dt, G) {
        b.spin += dt * (b.phase === 3 ? 1.1 : .55) * (1 + .4 * rageOf(b));
        b.x = G.W / 2 + swingX(b, dt, .45, b.phase === 3 ? 120 : 80);
        b.y = b.entryY + bobY(b, dt, .7, 12);
      },
      fire: function (b, dt, G) {
        const sp = rageSpd(b, 155 * G.bulletMul);
        const arms = b.parts.filter(function (p) { return p.alive && p.key.indexOf('arm') === 0; });
        const coreAlive = b.parts.some(function (p) { return p.key === 'core' && p.alive; });
        const armsLost = 2 - arms.length;
        /* 동력로가 터지면 노심이 폭주한다. 사격 주기와 무관하게 일정 간격으로
           감속·가속을 반복하는 고열탄을 뿜으므로 나선탄이 사라져도 압박은 남는다. */
        if (!coreAlive) {
          b.meltCt = (b.meltCt || 0) - dt;
          if (b.meltCt <= 0) {
            ring(G, b.x, b.y, 8 + b.phase * 2, sp * (.52 + .22 * Math.sin(b.t * 2.2)), b.spin * 2.4, 'eCore');
            b.meltCt = .86 - .08 * b.phase;
          }
        }
        b.ct -= dt;
        if (b.ct > 0) return;
        b.parts.forEach(function (p) {
          if (p.key.indexOf('arm') !== 0) return;
          const px = b.x + p.ox * b.w, py = b.y + p.oy * b.h + b.h * .12;
          if (p.alive) fan(G, px, py, G.aimAngle(px, py), b.phase === 1 ? 2 : 4, .55, sp * 1.05, 'eSmall');
          /* 포신이 날아간 자리에서는 눌러 담긴 출력이 그대로 터져 나온다 */
          else if (b.phase < 3) fan(G, px, py, Math.PI / 2, 2 + b.phase, 1.5, sp * .95, 'eSmall');
          else if (b.step % 2 === 0) fan(G, px, py, Math.PI / 2, 7, 1.9, sp * .95, 'eSmall');
        });
        /* 주포를 잃을수록 남은 출력이 선체 사출구로도 몰린다 */
        if (armsLost && (b.phase < 3 || b.step % 2 === 1)) {
          fan(G, b.x, b.y + b.h * .28, G.aimAngle(b.x, b.y), 2 + armsLost * 2, rageWide(b, .7), sp, 'eSmall');
        }
        if (b.phase === 1) {
          fan(G, b.x, b.y + b.h * .35, Math.PI / 2, rageN(b, 9), 2.0, sp * .8, 'eSmall');
          b.ct = rageCt(b, 1.15);
        } else if (b.phase === 2) {
          if (coreAlive) petals(G, b.x, b.y, 6, sp * .66, b.step * .22, 'eSmall');
          if (b.step % 2 === 1) fan(G, b.x, b.y + b.h * .3, G.aimAngle(b.x, b.y), 5, rageWide(b, .7), sp * 1.2, 'eBig');
          b.ct = rageCt(b, .9);
        } else {
          /* 최종: 반응로 개방. 나선탄 + 조준 고속탄 */
          if (coreAlive) {
            spiral(G, b.x - b.w * .10, b.y + b.h * .10, 3, sp * .78, b.step * .36, 'eCore');
            spiral(G, b.x + b.w * .10, b.y + b.h * .10, 3, sp * .78, -b.step * .36 + .4, 'eCore');
          }
          if (b.step % 3 === 2) fan(G, b.x, b.y + b.h * .3, G.aimAngle(b.x, b.y), 7, rageWide(b, 1.0), sp * 1.25, 'eBig');
          if (b.step % 5 === 4 && coreAlive) laneWall(G, b, b.y + b.h * .25, 15, sp * .68, [.25,.5,.75][Math.floor(b.step / 5) % 3] * G.W);
          b.ct = rageCt(b, .42);
        }
        b.step++;
      }
    }
  };

  const PHASE_NAMES = {
    breakwater:['쌍포 조준','물결 통로','회전 나선'],
    dune:['주포 연속 포격','진자 포화','철도 탄벽'],
    gemini:['교대 저격','빙결 교차','고속 창탄'],
    canopy:['수관 교차 조준','양갈래 회랑','나비 날개'],
    caldera:['화염 고리','용융 꽃잎','분화 나선'],
    nightark:['전방 부채','함교 꽃잎','세 갈래 탄벽'],
    regent:['주포 압박','동력로 꽃잎','이중 나선']
  };
  Object.keys(DEFS).forEach(function(id){DEFS[id].phaseNames=PHASE_NAMES[id];});

  /* ── 생성 ─────────────────────────────────── */
  function create(id, stageIndex, difficulty) {
    const d = DEFS[id];
    if (!d) return null;
    const hpMul = difficulty ? difficulty.bossHp : 1;
    const partHpMul = difficulty ? difficulty.partHp : 1;
    let w = d.width, h;
    if (d.sprite) {
      const art = Assets.body(d.sprite, 'neutral', w);
      h = art ? art.h : w;
    } else {
      const art = artFor(d.art, w);
      h = art ? art.h : w;
    }
    const b = {
      id: id, def: d, name: d.name, tag: d.tag,
      x: 0, y: -h, w: w, h: h,
      entryY: d.entryY,
      hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul),
      phase: 1, state: 'enter', t: 0, ct: 1.6, step: 0, flash: 0, dying: 0,
      flip: false, spin: 0,
      hitW: d.hitW * w, hitH: d.hitH * h,
      parts: (d.parts || []).map(function (p) {
        return {
          key: p.key, name: p.name, ox: p.ox, oy: p.oy,
          r: p.r * w, hp: Math.round(p.hp * partHpMul), maxHp: Math.round(p.hp * partHpMul),
          alive: true, hidden: !!p.hidden, flash: 0
        };
      })
    };
    if (d.init) d.init(b);
    return b;
  }

  /* 페이즈 전환 조건: 체력 비율 */
  function phaseOf(b) {
    const r = b.hp / b.maxHp;
    return r > .66 ? 1 : (r > .33 ? 2 : 3);
  }

  function update(b, dt, G) {
    b.t += dt;
    if (b.laneCue) { b.laneCue.life -= dt; if (b.laneCue.life <= 0) b.laneCue = null; }
    if (b.flash > 0) b.flash -= dt;
    b.parts.forEach(function (p) { if (p.flash > 0) p.flash -= dt; });

    if (b.state === 'enter') {
      b.x = G.W / 2;
      b.y += (b.entryY - b.y) * Math.min(1, dt * 1.6);
      if (Math.abs(b.y - b.entryY) < 3) { b.y = b.entryY; b.state = 'fight'; }
      return;
    }
    if (b.state === 'dying') { b.dying += dt; return; }

    const ph = phaseOf(b);
    if (ph !== b.phase) {
      b.phase = ph;
      b.ct = 1.0; b.step = 0; b.laneCue = null;
      // 이전 페이즈의 대기 중인 포격을 다음 패턴으로 넘기지 않는다.
      if (b.salvo !== undefined) b.salvo = 0;
      if (b.lockAng !== undefined) b.lockAng = null;
      if (b.launchCt !== undefined) b.launchCt = Math.max(b.launchCt,1);
      if (b.meltCt !== undefined) b.meltCt = Math.max(b.meltCt,1);
      /* 2페이즈 이후 숨은 약점(함교·반응로)이 드러난다. */
      b.parts.forEach(function (p) { if (p.hidden && ph >= 2) p.hidden = false; });
      if (G.onBossPhase) G.onBossPhase(b);
    }
    b.def.move(b, dt, G);
    b.def.fire(b, dt * (G.attackRate || 1), G);
  }

  /* ── 그리기 ───────────────────────────────── */
  function partAt(b, x, y, radius) {
    if (!b) return null;
    const r = radius || 0;
    const onHull = Math.abs(x-b.x) < b.hitW/2+r && Math.abs(y-b.y) < b.hitH/2+r;
    for (const p of b.parts) {
      if (!p.alive || p.hidden) continue;
      const px = b.x+p.ox*b.w*(b.flip ? -1 : 1), py = b.y+p.oy*b.h;
      if (Math.hypot(x-px,y-py) < p.r+r) return p;
      // 세로 진행하는 탄이 선체 앞에서 소멸해 상부 부위에 영원히 닿지 못하는 것을 방지한다.
      if (b.def.projectParts && onHull && y >= py && Math.abs(x-px) < p.r+r) return p;
    }
    return null;
  }

  function draw(b, ctx, G) {
    ctx.save();
    if (b.state === 'dying') ctx.globalAlpha = Math.max(0, 1 - Math.max(0,b.dying-1.48)/.58);
    ctx.translate(b.x, b.y);
    if (b.flip) ctx.scale(-1, 1);
    let flashDraw = null;   // 피격 시 같은 모양으로만 밝게 덧그린다

    if (b.def.sprite) {
      const kind = b.def.sprite;
      const art = b.id === 'nightark'
        ? Assets.boss4Body(b.w, b.parts.filter(function(p){return !p.alive;}).map(function(p){return p.key;}))
        : Assets.bossDamageBody(kind, b.w, b.parts);
      if (art) {
        flashDraw = function () { ctx.drawImage(art.c, -art.px, -art.py); };
        ctx.drawImage(art.c, -art.px, -art.py);
        /* 엔진 프로펠러 */
        if (art.hubs.length) {
          const frames = Assets.propSet(art.r, '#d5d8ce');
          const f = frames[Math.floor(b.t * 26) % frames.length];
          art.hubs.forEach(function (hub) {
            ctx.drawImage(f, hub.x - f.width / 2, hub.y - f.height / 2);
          });
        }
      } else if (b.def.art) {
        const fallback = artFor(b.def.art, b.w);
        if (fallback) ctx.drawImage(fallback.body, -b.w / 2, -b.h / 2, b.w, b.h);
      }
    } else {
      const art = artFor(b.def.art, b.w);
      if (art) {
        flashDraw = function () { ctx.drawImage(art.body, -art.w / 2, -art.h / 2); };
        ctx.drawImage(art.body, -art.w / 2, -art.h / 2);
        b.parts.forEach(function (p) {
          const layer = art.parts[p.key];
          if (!layer || !p.alive) return;
          if (p.key === 'core' && b.phase === 3) return; // 최종 단계: 셔터 개방
          ctx.drawImage(layer, -art.w / 2, -art.h / 2);
        });
        /* 반응로 노출 연출 */
        if (b.id === 'regent' && b.phase === 3) {
          const pulse = .55 + Math.sin(b.t * 7) * .25;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.beginPath();
          ctx.arc(0, art.h * .02, art.w * .10, 0, TAU);
          ctx.fillStyle = '#ff9d3c';
          ctx.fill();
          ctx.restore();
        }
      }
    }

    /* 피격 플래시: 기체 실루엣만 밝아지도록 같은 그림을 덧그린다 */
    if (b.flash > 0 && flashDraw) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(.35, b.flash * 3);
      flashDraw();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    /* 살아 있는 약점은 은은하게 달아오르는 빛으로만 알린다.
       (모듈 이름과 내구도는 HUD 에 글자로 함께 표시한다) */
    if (b.state === 'dying') return;
    if (b.def.fx) b.def.fx(b, ctx, G);
    if (b.laneCue) {
      const q=b.laneCue;
      ctx.save();ctx.globalAlpha=Math.min(.36,q.life*.5);
      ctx.strokeStyle='#9ee8d1';ctx.lineWidth=1.5;ctx.setLineDash([5,7]);
      for (const side of [-1,1]) {ctx.beginPath();ctx.moveTo(q.x+side*q.width/2,q.y);ctx.lineTo(q.x+side*q.width/2,Math.min(G.H-44,q.y+100));ctx.stroke();}
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    b.parts.forEach(function (p, i) {
      if (!p.alive || p.hidden) return;
      const px = b.x + p.ox * b.w * (b.flip ? -1 : 1);
      const py = b.y + p.oy * b.h;
      const pulse = .16 + Math.sin(b.t * 3.4 + i * 1.7) * .07;
      const img = Assets.glow(p.r * .95, 'rgba(255,224,160,.7)', 'rgba(255,150,50,.22)');
      ctx.globalAlpha = p.flash > 0 ? .6 : pulse;
      ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
    });
    /* 파괴된 부위는 불길이 남아 탄이 새어 나오는 자리를 알려 준다 */
    b.parts.forEach(function (p, i) {
      if (p.alive) return;
      const px = b.x + p.ox * b.w * (b.flip ? -1 : 1);
      const py = b.y + p.oy * b.h;
      const img = Assets.glow(p.r * .7, 'rgba(255,146,60,.8)', 'rgba(214,52,24,.28)');
      ctx.globalAlpha = .24 + Math.abs(Math.sin(b.t * 9.3 + i * 2.1)) * .2;
      ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
    });
    ctx.restore();
  }

  return { create: create, update: update, draw: draw, artFor: artFor, DEFS: DEFS, partAt: partAt };
})();
