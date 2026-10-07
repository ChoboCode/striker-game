/* 스테이지 3~5 보스 작화.
   이 세 보스는 아직 PNG 원화가 없어서 컨셉 문서(output/imagegen/boss-prompts-v1.txt)를
   기준으로 캔버스에 그린다. 원화가 준비되면 bosses.js 의 DEFS 에서 art 대신 sprite 로 바꾸면 된다.
   레이어를 본체와 파괴 가능한 모듈로 나눠 두어, 모듈이 파괴되면 그 레이어만 빠진다. */
const BossArt = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const OUTLINE = 'rgba(10,14,20,.95)';

  function poly(g, S, pts, close) {
    g.beginPath();
    pts.forEach(function (p, i) {
      const x = S * p[0], y = S * p[1];
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    if (close !== false) g.closePath();
  }

  /* 위→아래 방향 그라데이션으로 금속 면을 칠하고 어두운 외곽선을 긋는다 */
  function fillShape(g, S, pts, c1, c2, lw) {
    poly(g, S, pts);
    const ys = pts.map(function (p) { return p[1]; });
    const grd = g.createLinearGradient(0, S * Math.min.apply(null, ys), 0, S * Math.max.apply(null, ys));
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = lw === undefined ? S * .009 : lw;
    g.stroke();
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

  function box(g, S, x, y, w, h, r, c1, c2) {
    roundRect(g, S * x, S * y, S * w, S * h, S * r);
    const grd = g.createLinearGradient(S * x, S * y, S * x, S * (y + h));
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = S * .008;
    g.stroke();
  }

  function seam(g, S, x1, y1, x2, y2, color, w) {
    g.strokeStyle = color || 'rgba(0,0,0,.35)';
    g.lineWidth = w || Math.max(1, S * .004);
    g.beginPath();
    g.moveTo(S * x1, S * y1);
    g.lineTo(S * x2, S * y2);
    g.stroke();
  }

  function rivets(g, S, x1, y1, x2, y2, n, color) {
    g.fillStyle = color || 'rgba(255,255,255,.22)';
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? .5 : i / (n - 1);
      g.beginPath();
      g.arc(S * (x1 + (x2 - x1) * t), S * (y1 + (y2 - y1) * t), Math.max(.8, S * .006), 0, TAU);
      g.fill();
    }
  }

  return {
    /* ── 3 FROST GEMINI — 쌍동체 요격기 ───────── */
    gemini: {
      ratio: 1,
      body: function (g, S) {
        /* 후방 연결 다리 */
        fillShape(g, S, [[.30, .08], [.70, .08], [.75, .20], [.25, .20]], '#61718a', '#2e3a4a');
        seam(g, S, .30, .14, .70, .14);

        /* 중앙 날개 다리 */
        fillShape(g, S, [[.24, .36], [.76, .36], [.86, .50], [.76, .66], [.24, .66], [.14, .50]], '#8093ad', '#33404f');
        seam(g, S, .24, .44, .76, .44);
        seam(g, S, .24, .58, .76, .58);
        rivets(g, S, .20, .50, .80, .50, 9, 'rgba(255,255,255,.18)');

        /* 좌우 동체 */
        [.22, .64].forEach(function (bx) {
          fillShape(g, S, [
            [bx + .02, .06], [bx + .12, .06], [bx + .14, .26], [bx + .14, .72],
            [bx + .07, .93], [bx, .72], [bx, .26]
          ], '#93a5bd', '#2c3846');
          /* 조종석 */
          box(g, S, bx + .035, .30, .07, .12, .03, '#2b3444', '#161d27');
          /* 구리색 식별 밴드 */
          g.fillStyle = '#b5703a';
          g.fillRect(S * bx, S * .48, S * .14, S * .030);
          g.fillRect(S * bx, S * .64, S * .14, S * .030);
          /* 패널 라인 */
          for (let i = 0; i < 4; i++) seam(g, S, bx + .01, .20 + i * .12, bx + .13, .20 + i * .12);
          /* 기수 끝 */
          fillShape(g, S, [[bx + .035, .84], [bx + .105, .84], [bx + .07, .97]], '#c3cedb', '#7c8899');
        });

        /* 중앙 조준 장치 */
        g.beginPath();
        g.arc(S * .5, S * .50, S * .085, 0, TAU);
        g.fillStyle = '#39465a';
        g.fill();
        g.strokeStyle = '#9aa9bd';
        g.lineWidth = S * .010;
        g.stroke();
        g.beginPath();
        g.arc(S * .5, S * .50, S * .040, 0, TAU);
        const lens = g.createRadialGradient(S * .49, S * .49, S * .004, S * .5, S * .5, S * .04);
        lens.addColorStop(0, '#d9b6ff');
        lens.addColorStop(1, '#6b3fa0');
        g.fillStyle = lens;
        g.fill();
      },
      parts: {
        podL: function (g, S) {
          fillShape(g, S, [[.02, .40], [.14, .36], [.17, .50], [.14, .64], [.02, .60]], '#93a5bd', '#2f3b4a');
          g.fillStyle = '#b5703a';
          g.fillRect(S * .03, S * .47, S * .12, S * .028);
          seam(g, S, .03, .55, .15, .55);
          g.beginPath();
          g.ellipse(S * .095, S * .645, S * .026, S * .016, 0, 0, TAU);
          g.fillStyle = '#c9d2dc';
          g.fill();
        },
        podR: function (g, S) {
          fillShape(g, S, [[.98, .40], [.86, .36], [.83, .50], [.86, .64], [.98, .60]], '#93a5bd', '#2f3b4a');
          g.fillStyle = '#b5703a';
          g.fillRect(S * .85, S * .47, S * .12, S * .028);
          seam(g, S, .85, .55, .97, .55);
          g.beginPath();
          g.ellipse(S * .905, S * .645, S * .026, S * .016, 0, 0, TAU);
          g.fillStyle = '#c9d2dc';
          g.fill();
        }
      }
    },

    /* ── 4 NIGHT ARK — 비행 항공모함 ──────────── */
    nightark: {
      ratio: .66,
      body: function (g, S) {
        const R = .66;   // 세로 비율. 아래 좌표는 가로 기준이므로 y 는 R 을 곱해 쓴다.
        const y = function (v) { return v * R; };

        /* 전익 본체 */
        fillShape(g, S, [
          [.50, y(.98)], [.66, y(.86)], [.82, y(.70)], [.99, y(.40)],
          [.90, y(.10)], [.62, y(.06)], [.50, y(.14)], [.38, y(.06)], [.10, y(.10)],
          [.01, y(.40)], [.18, y(.70)], [.34, y(.86)]
        ], '#44262f', '#241119');

        /* 청동 구조 보강재 */
        g.strokeStyle = '#8a6a34';
        g.lineWidth = S * .011;
        [[.22, .30], [.78, .70]].forEach(function (p) {
          g.beginPath();
          g.moveTo(S * p[0], S * y(.14));
          g.lineTo(S * p[1], S * y(.84));
          g.stroke();
        });

        /* 중앙 비행 갑판 */
        box(g, S, .34, y(.14), .32, y(.74), .015, '#5d646f', '#2b2f36');
        seam(g, S, .50, y(.18), .50, y(.84), 'rgba(240,210,150,.35)', S * .006);
        for (let i = 0; i < 7; i++) seam(g, S, .355, y(.22 + i * .09), .645, y(.22 + i * .09), 'rgba(0,0,0,.35)');

        /* 갑판 유도등 */
        g.fillStyle = 'rgba(245,190,110,.8)';
        for (let i = 0; i < 6; i++) {
          g.fillRect(S * .358, S * y(.24 + i * .10), S * .016, S * y(.02));
          g.fillRect(S * .626, S * y(.24 + i * .10), S * .016, S * y(.02));
        }

        /* 외측 리프트 엔진 4기 */
        [.09, .23, .77, .91].forEach(function (nx) {
          box(g, S, nx - .052, y(.22), .104, y(.46), .02, '#737a86', '#22262c');
          seam(g, S, nx - .04, y(.34), nx + .04, y(.34));
          g.beginPath();
          g.ellipse(S * nx, S * y(.60), S * .028, S * y(.035), 0, 0, TAU);
          g.fillStyle = '#c9d2dc';
          g.fill();
          g.strokeStyle = OUTLINE;
          g.lineWidth = S * .006;
          g.stroke();
        });

        /* 수직 안정판 */
        fillShape(g, S, [[.28, y(.02)], [.34, y(.02)], [.34, y(.16)], [.28, y(.16)]], '#3d242c', '#1d0f15');
        fillShape(g, S, [[.66, y(.02)], [.72, y(.02)], [.72, y(.16)], [.66, y(.16)]], '#3d242c', '#1d0f15');

        /* 선체 리벳 */
        rivets(g, S, .16, y(.42), .32, y(.42), 5, 'rgba(230,200,150,.25)');
        rivets(g, S, .68, y(.42), .84, y(.42), 5, 'rgba(230,200,150,.25)');
      },
      parts: {
        bayL: function (g, S) {
          const y = function (v) { return v * .66; };
          box(g, S, .24, y(.62), .18, y(.16), .015, '#7d848f', '#2d3138');
          g.fillStyle = '#120c0a';
          g.fillRect(S * .263, S * y(.655), S * .134, S * y(.09));
          const glow = g.createLinearGradient(0, S * y(.655), 0, S * y(.745));
          glow.addColorStop(0, 'rgba(250,180,80,.9)');
          glow.addColorStop(1, 'rgba(250,140,50,.25)');
          g.fillStyle = glow;
          g.fillRect(S * .272, S * y(.665), S * .116, S * y(.07));
          seam(g, S, .33, y(.655), .33, y(.745), 'rgba(0,0,0,.6)', S * .006);
        },
        bayR: function (g, S) {
          const y = function (v) { return v * .66; };
          box(g, S, .58, y(.62), .18, y(.16), .015, '#7d848f', '#2d3138');
          g.fillStyle = '#120c0a';
          g.fillRect(S * .603, S * y(.655), S * .134, S * y(.09));
          const glow = g.createLinearGradient(0, S * y(.655), 0, S * y(.745));
          glow.addColorStop(0, 'rgba(250,180,80,.9)');
          glow.addColorStop(1, 'rgba(250,140,50,.25)');
          g.fillStyle = glow;
          g.fillRect(S * .612, S * y(.665), S * .116, S * y(.07));
          seam(g, S, .67, y(.655), .67, y(.745), 'rgba(0,0,0,.6)', S * .006);
        },
        bridge: function (g, S) {
          const y = function (v) { return v * .66; };
          box(g, S, .43, y(.32), .14, y(.20), .022, '#9aa2ae', '#3a4049');
          g.beginPath();
          g.arc(S * .50, S * y(.42), S * .038, 0, TAU);
          const dome = g.createRadialGradient(S * .49, S * y(.40), S * .004, S * .50, S * y(.42), S * .038);
          dome.addColorStop(0, '#ffe0a8');
          dome.addColorStop(1, '#c07a24');
          g.fillStyle = dome;
          g.fill();
          g.strokeStyle = OUTLINE;
          g.lineWidth = S * .007;
          g.stroke();
        }
      }
    },

    /* ── 5 IRON REGENT — 공중 요새 ────────────── */
    regent: {
      ratio: 1,
      body: function (g, S) {
        const OCT = [[.50, .14], [.78, .25], [.89, .52], [.75, .80], [.50, .91], [.25, .80], [.11, .52], [.22, .25]];

        /* 상부 출력 조절기 */
        [.34, .66].forEach(function (x) {
          box(g, S, x - .07, .10, .14, .18, .025, '#5a5f66', '#232529');
          g.fillStyle = '#7a2230';
          g.fillRect(S * (x - .05), S * .15, S * .10, S * .035);
        });

        /* 본체 팔각 장갑 */
        fillShape(g, S, OCT, '#454a51', '#2a2d32', S * .012);

        /* 진홍 장갑 띠와 황동 테두리 */
        g.fillStyle = '#7a2230';
        g.fillRect(S * .28, S * .28, S * .44, S * .065);
        g.fillRect(S * .28, S * .70, S * .44, S * .065);
        g.strokeStyle = '#b08b3e';
        g.lineWidth = S * .008;
        g.strokeRect(S * .28, S * .28, S * .44, S * .065);
        g.strokeRect(S * .28, S * .70, S * .44, S * .065);

        /* 장갑 패널 분할선 */
        [[.22, .38, .78, .38], [.20, .62, .80, .62]].forEach(function (l) {
          seam(g, S, l[0], l[1], l[2], l[3], 'rgba(0,0,0,.4)');
        });
        rivets(g, S, .24, .46, .76, .46, 11, 'rgba(210,180,120,.30)');

        /* 반응로 둘레의 강철 링 */
        g.beginPath();
        g.arc(S * .5, S * .52, S * .205, 0, TAU);
        g.strokeStyle = '#b08b3e';
        g.lineWidth = S * .014;
        g.stroke();
        g.beginPath();
        g.arc(S * .5, S * .52, S * .16, 0, TAU);
        const core = g.createRadialGradient(S * .5, S * .52, S * .01, S * .5, S * .52, S * .16);
        core.addColorStop(0, '#ffcf80');
        core.addColorStop(.6, '#e07a1e');
        core.addColorStop(1, '#5c2a0c');
        g.fillStyle = core;
        g.fill();

        /* 후방 나셀(본체 위로 보이도록 나중에 그린다) */
        [.26, .74].forEach(function (x) {
          box(g, S, x - .085, .02, .17, .22, .03, '#4f545b', '#1c1e22');
          g.beginPath();
          g.ellipse(S * x, S * .085, S * .055, S * .033, 0, 0, TAU);
          g.fillStyle = '#12141a';
          g.fill();
          g.strokeStyle = 'rgba(180,190,200,.5)';
          g.lineWidth = S * .006;
          g.stroke();
        });

        /* 지휘 선수 */
        fillShape(g, S, [[.36, .84], [.64, .84], [.50, .99]], '#5f656d', '#2a2e34');
        g.fillStyle = '#1a1d22';
        g.fillRect(S * .44, S * .87, S * .12, S * .022);
      },
      parts: {
        armL: function (g, S) {
          fillShape(g, S, [[.01, .40], [.19, .36], [.23, .52], [.19, .68], [.01, .64]], '#5c6169', '#232529');
          g.fillStyle = '#7a2230';
          g.fillRect(S * .03, S * .46, S * .16, S * .045);
          g.strokeStyle = '#b08b3e';
          g.lineWidth = S * .006;
          g.strokeRect(S * .03, S * .46, S * .16, S * .045);
          /* 하향 포신 2문 */
          [.06, .13].forEach(function (bx) {
            box(g, S, bx, .64, .042, .16, .008, '#6d737b', '#2a2d33');
          });
        },
        armR: function (g, S) {
          fillShape(g, S, [[.99, .40], [.81, .36], [.77, .52], [.81, .68], [.99, .64]], '#5c6169', '#232529');
          g.fillStyle = '#7a2230';
          g.fillRect(S * .81, S * .46, S * .16, S * .045);
          g.strokeStyle = '#b08b3e';
          g.lineWidth = S * .006;
          g.strokeRect(S * .81, S * .46, S * .16, S * .045);
          [.818, .888].forEach(function (bx) {
            box(g, S, bx, .64, .042, .16, .008, '#6d737b', '#2a2d33');
          });
        },
        /* 반응로 차폐 셔터 3장. 최종 단계에서 열리면 그리지 않는다. */
        core: function (g, S) {
          g.save();
          g.translate(S * .5, S * .52);
          for (let i = 0; i < 3; i++) {
            g.save();
            g.rotate(i * TAU / 3);
            g.beginPath();
            g.moveTo(-S * .155, -S * .012);
            g.lineTo(S * .155, -S * .012);
            g.lineTo(S * .085, -S * .165);
            g.lineTo(-S * .085, -S * .165);
            g.closePath();
            const grd = g.createLinearGradient(0, -S * .165, 0, 0);
            grd.addColorStop(0, '#6a7079');
            grd.addColorStop(1, '#3a3e45');
            g.fillStyle = grd;
            g.fill();
            g.strokeStyle = OUTLINE;
            g.lineWidth = S * .009;
            g.stroke();
            g.restore();
          }
          g.restore();
        }
      }
    }
  };
})();
