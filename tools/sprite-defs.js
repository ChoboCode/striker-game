/* 지상 목표물 스프라이트 정의(제작 도구 전용).
   게임은 여기서 뽑은 PNG(assets/ground/*.png)를 읽는다. 이 파일은 게임에 포함되지 않는다.
   - 캔버스 192×192, 피벗은 정중앙, 위쪽이 화면 위(북)이다.
   - 회전하는 부품(포신·접시)은 따로 뽑아 게임에서 각도를 계산해 돌린다.
   - 나중에 원화 PNG로 교체할 때도 같은 규격(정사각·중앙 피벗·투명 배경)을 지키면 코드 수정이 필요 없다. */
const SpriteDefs = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const OUTLINE = 'rgba(12,14,18,.92)';

  function shadow(g, S, fn) {
    g.save();
    g.translate(S * .022, S * .028);
    g.globalAlpha = .38;
    g.filter = 'blur(2px)';
    fn(g);
    g.filter = 'none';
    g.restore();
  }

  function disc(g, cx, cy, r, c1, c2, lw) {
    const grd = g.createRadialGradient(cx - r * .35, cy - r * .4, r * .1, cx, cy, r);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = grd;
    g.fill();
    if (lw) { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.stroke(); }
  }

  function poly(g, pts) {
    g.beginPath();
    pts.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
  }

  function shadedPoly(g, pts, c1, c2, lw) {
    const ys = pts.map(function (p) { return p[1]; });
    const grd = g.createLinearGradient(0, Math.min.apply(null, ys), 0, Math.max.apply(null, ys));
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    poly(g, pts);
    g.fillStyle = grd;
    g.fill();
    if (lw) { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.stroke(); }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function shadedBox(g, x, y, w, h, r, c1, c2, lw) {
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    roundRect(g, x, y, w, h, r);
    g.fillStyle = grd;
    g.fill();
    if (lw) { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.stroke(); }
  }

  function bolts(g, cx, cy, r, n, size, color) {
    g.fillStyle = color || 'rgba(232,222,196,.55)';
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, 0, TAU);
      g.fill();
    }
  }

  function hatch(g, x, y, w, h, step, color) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = color || 'rgba(0,0,0,.28)';
    g.lineWidth = 1.5;
    for (let i = -h; i < w + h; i += step) {
      g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + h, y + h); g.stroke();
    }
    g.restore();
  }

  return {
    /* ── 대공 포탑: 받침 + 회전 포신 ─────────── */
    'aa-base': {
      note: '대공 포탑 받침',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) { x.beginPath(); x.arc(c, c, S * .34, 0, TAU); x.fillStyle = '#000'; x.fill(); });
        disc(g, c, c, S * .34, '#7f858d', '#33383f', S * .016);       // 콘크리트 받침
        hatch(g, c - S * .34, c - S * .34, S * .68, S * .68, 14, 'rgba(0,0,0,.14)');
        disc(g, c, c, S * .25, '#5d636b', '#2b3036', S * .012);       // 장갑 링
        bolts(g, c, c, S * .295, 12, S * .014);
        disc(g, c, c, S * .15, '#8d949d', '#414750', S * .010);       // 회전 베어링
        g.strokeStyle = 'rgba(200,160,70,.5)';
        g.lineWidth = S * .012;
        g.beginPath(); g.arc(c, c, S * .205, 0, TAU); g.stroke();
      }
    },
    'aa-gun': {
      note: '대공 포신(회전)',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) {
          roundRect(x, c - S * .13, c - S * .34, S * .26, S * .48, S * .05);
          x.fillStyle = '#000'; x.fill();
        });
        /* 포신 2문: 위쪽을 향한다 */
        [-1, 1].forEach(function (s) {
          shadedBox(g, c + s * S * .055 - S * .035, c - S * .40, S * .07, S * .34, S * .016, '#9aa1a9', '#43484f', S * .012);
          g.fillStyle = 'rgba(20,22,26,.9)';
          g.fillRect(c + s * S * .055 - S * .028, c - S * .40, S * .056, S * .035);
        });
        /* 포방패와 포탑 몸체 */
        shadedPoly(g, [
          [c - S * .17, c - S * .06], [c + S * .17, c - S * .06],
          [c + S * .13, c + S * .17], [c - S * .13, c + S * .17]
        ], '#8b929b', '#3b4047', S * .014);
        g.fillStyle = '#b5703a';
        g.fillRect(c - S * .15, c + S * .02, S * .30, S * .035);
        bolts(g, c, c + S * .06, S * .10, 6, S * .012);
      }
    },

    /* ── 전차: 차체 + 회전 포탑 ──────────────── */
    'tank-hull': {
      note: '전차 차체',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) {
          roundRect(x, c - S * .24, c - S * .33, S * .48, S * .66, S * .04);
          x.fillStyle = '#000'; x.fill();
        });
        /* 궤도 */
        [-1, 1].forEach(function (s) {
          shadedBox(g, c + s * S * .19 - S * .06, c - S * .33, S * .12, S * .66, S * .02, '#4a4f56', '#22262b', S * .012);
          g.strokeStyle = 'rgba(0,0,0,.45)';
          g.lineWidth = 1.4;
          for (let i = 0; i < 12; i++) {
            const y = c - S * .31 + i * S * .055;
            g.beginPath(); g.moveTo(c + s * S * .19 - S * .06, y); g.lineTo(c + s * S * .19 + S * .06, y); g.stroke();
          }
        });
        /* 차체 상판 */
        shadedBox(g, c - S * .155, c - S * .30, S * .31, S * .60, S * .03, '#6f7681', '#333940', S * .014);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(c - S * .13, c - S * .06, S * .26, S * .02);
        g.fillRect(c - S * .13, c + S * .12, S * .26, S * .02);
        g.fillStyle = '#b5703a';
        g.fillRect(c - S * .13, c + S * .20, S * .26, S * .03);
        bolts(g, c, c, S * .125, 8, S * .012);
      }
    },
    'tank-turret': {
      note: '전차 포탑(회전)',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) { x.beginPath(); x.arc(c, c, S * .17, 0, TAU); x.fillStyle = '#000'; x.fill(); });
        shadedBox(g, c - S * .035, c - S * .42, S * .07, S * .34, S * .012, '#9aa1a9', '#474d55', S * .012);
        g.fillStyle = 'rgba(20,22,26,.9)';
        g.fillRect(c - S * .028, c - S * .42, S * .056, S * .03);
        disc(g, c, c, S * .17, '#8d949d', '#3a4047', S * .014);
        g.fillStyle = '#7a2230';
        g.fillRect(c - S * .12, c + S * .03, S * .24, S * .032);
        bolts(g, c, c, S * .12, 8, S * .012);
        disc(g, c, c - S * .02, S * .055, '#b9c0c8', '#5a6068', S * .008);
      }
    },

    /* ── 벙커 ───────────────────────────────── */
    bunker: {
      note: '콘크리트 벙커',
      draw: function (g, S) {
        const c = S / 2, r = S * .36;
        const hex = [];
        for (let i = 0; i < 6; i++) {
          const a = TAU * i / 6 - Math.PI / 6;
          hex.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
        }
        shadow(g, S, function (x) { poly(x, hex); x.fillStyle = '#000'; x.fill(); });
        shadedPoly(g, hex, '#8a8b83', '#3b3d3a', S * .016);
        hatch(g, c - r, c - r, r * 2, r * 2, 18, 'rgba(0,0,0,.10)');
        const inner = hex.map(function (p) { return [c + (p[0] - c) * .62, c + (p[1] - c) * .62]; });
        shadedPoly(g, inner, '#767870', '#33352f', S * .012);
        /* 총안구 */
        g.fillStyle = '#12140f';
        g.fillRect(c - S * .16, c - S * .06, S * .32, S * .07);
        g.fillStyle = 'rgba(255,190,110,.35)';
        g.fillRect(c - S * .14, c - S * .045, S * .28, S * .02);
        g.fillStyle = '#b5703a';
        g.fillRect(c - S * .20, c + S * .14, S * .40, S * .03);
      }
    },

    /* ── 레이더: 받침 + 회전 접시 ───────────── */
    'radar-base': {
      note: '레이더 받침',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) { x.beginPath(); x.arc(c, c, S * .26, 0, TAU); x.fillStyle = '#000'; x.fill(); });
        disc(g, c, c, S * .26, '#767d86', '#2f343a', S * .014);
        bolts(g, c, c, S * .215, 10, S * .013);
        shadedBox(g, c - S * .10, c - S * .10, S * .20, S * .20, S * .03, '#8d949d', '#3c4148', S * .012);
        disc(g, c, c, S * .06, '#b9c0c8', '#5a6068', S * .008);
      }
    },
    'radar-dish': {
      note: '레이더 접시(회전)',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) {
          x.beginPath(); x.ellipse(c, c - S * .12, S * .30, S * .16, 0, 0, TAU);
          x.fillStyle = '#000'; x.fill();
        });
        g.save();
        g.beginPath();
        g.ellipse(c, c - S * .12, S * .30, S * .16, 0, 0, TAU);
        const grd = g.createLinearGradient(c, c - S * .28, c, c + S * .04);
        grd.addColorStop(0, '#aeb6be');
        grd.addColorStop(1, '#4c525a');
        g.fillStyle = grd;
        g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = S * .014; g.stroke();
        /* 격자 */
        g.clip();
        g.strokeStyle = 'rgba(0,0,0,.30)';
        g.lineWidth = 1.6;
        for (let i = -6; i <= 6; i++) {
          g.beginPath(); g.moveTo(c + i * S * .05, c - S * .30); g.lineTo(c + i * S * .05, c + S * .06); g.stroke();
        }
        for (let i = -3; i <= 3; i++) {
          g.beginPath(); g.moveTo(c - S * .32, c - S * .12 + i * S * .05); g.lineTo(c + S * .32, c - S * .12 + i * S * .05); g.stroke();
        }
        g.restore();
        /* 급전부 */
        shadedBox(g, c - S * .022, c - S * .12, S * .044, S * .20, S * .01, '#c2c9d1', '#5a6068', S * .010);
        disc(g, c, c + S * .07, S * .05, '#d6dce3', '#6b7078', S * .008);
      }
    },

    /* ── 연료 탱크 ──────────────────────────── */
    fuel: {
      note: '연료 저장고',
      draw: function (g, S) {
        const c = S / 2;
        shadow(g, S, function (x) { x.beginPath(); x.arc(c, c, S * .31, 0, TAU); x.fillStyle = '#000'; x.fill(); });
        disc(g, c, c, S * .31, '#9aa39a', '#39433c', S * .016);
        g.strokeStyle = 'rgba(0,0,0,.30)';
        g.lineWidth = 1.8;
        [.22, .13].forEach(function (rr) {
          g.beginPath(); g.arc(c, c, S * rr, 0, TAU); g.stroke();
        });
        /* 상부 점검구와 배관 */
        disc(g, c, c, S * .075, '#b6bfb6', '#4d564e', S * .010);
        g.fillStyle = '#5c646a';
        g.fillRect(c - S * .02, c - S * .44, S * .04, S * .14);
        g.fillRect(c - S * .02, c + S * .30, S * .04, S * .14);
        g.fillStyle = '#b5703a';
        g.fillRect(c - S * .26, c + S * .22, S * .52, S * .035);
        bolts(g, c, c, S * .27, 14, S * .012, 'rgba(240,230,200,.4)');
      }
    },

    /* ── 경비정(해상 스테이지) ──────────────── */
    boat: {
      note: '경비정',
      draw: function (g, S) {
        const c = S / 2;
        const hull = [
          [c, c - S * .44], [c + S * .17, c - S * .18], [c + S * .19, c + S * .30],
          [c + S * .12, c + S * .42], [c - S * .12, c + S * .42], [c - S * .19, c + S * .30],
          [c - S * .17, c - S * .18]
        ];
        shadow(g, S, function (x) { poly(x, hull); x.fillStyle = '#000'; x.fill(); });
        shadedPoly(g, hull, '#7d848d', '#2f353c', S * .016);
        /* 갑판 */
        shadedBox(g, c - S * .12, c - S * .12, S * .24, S * .34, S * .02, '#666d76', '#343a41', S * .010);
        hatch(g, c - S * .12, c - S * .12, S * .24, S * .34, 12, 'rgba(0,0,0,.16)');
        /* 함교 */
        shadedBox(g, c - S * .085, c + S * .02, S * .17, S * .14, S * .02, '#98a0a9', '#464c54', S * .010);
        g.fillStyle = 'rgba(250,210,140,.6)';
        g.fillRect(c - S * .06, c + S * .05, S * .12, S * .03);
        /* 함수 기관포 */
        disc(g, c, c - S * .22, S * .06, '#a7aeb6', '#4a5058', S * .010);
        g.fillStyle = '#8f969e';
        g.fillRect(c - S * .016, c - S * .38, S * .032, S * .16);
        g.fillStyle = '#b5703a';
        g.fillRect(c - S * .14, c + S * .26, S * .28, S * .03);
      }
    }
  };
})();
