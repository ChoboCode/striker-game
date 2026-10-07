# -*- coding: utf-8 -*-
"""headless 검증용 임시 파일을 만든다(개발 도구).

  python tools/make-test.py          # __test.html, js/__game_test.js 생성
  python tools/make-test.py clean    # 생성한 임시 파일 삭제

게임 원본은 건드리지 않는다. js/game.js 를 읽어 테스트 훅을 넣은 사본을 만들고,
그 사본과 tools/harness.js 를 쓰는 __test.html 을 만든다.
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'js', 'game.js')
COPY = os.path.join(ROOT, 'js', '__game_test.js')
INDEX = os.path.join(ROOT, 'index.html')
TEST = os.path.join(ROOT, '__test.html')

HOOKS = """
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

  boot();"""


def build():
    src = io.open(GAME, encoding='utf-8').read()

    def swap(a, b):
        assert a in src, 'anchor not found: ' + a[:60]
        return src.replace(a, b, 1)

    src = swap("  function loop(now) {\n    requestAnimationFrame(loop);",
               "  function loop(now) {\n    if (!window.__NO_RAF) requestAnimationFrame(loop);")
    src = swap("      showScreen('scTitle');\n      requestAnimationFrame(loop);",
               "      showScreen('scTitle');\n      if (!window.__NO_RAF) requestAnimationFrame(loop);")
    src = swap("    if (P.inv > 0) P.inv -= dt;",
               "    if (window.__GOD) P.inv = 99;\n    if (P.inv > 0) P.inv -= dt;")
    src = swap("\n  boot();", "\n" + HOOKS)
    io.open(COPY, 'w', encoding='utf-8').write(src)

    html = io.open(INDEX, encoding='utf-8').read()
    html = html.replace('<script src="js/game.js"></script>',
                        '<script src="js/__game_test.js"></script>')
    html = html.replace('<script src="js/assets.js"></script>',
                        '<script>window.__NO_RAF = true;</script>\n<script src="js/assets.js"></script>')
    html = html.replace('</body>',
                        '<pre id="SHOT" style="position:fixed;left:-9999px"></pre>\n'
                        '<pre id="TESTOUT" style="position:fixed;left:-9999px"></pre>\n'
                        '<script src="tools/harness.js"></script>\n</body>')
    io.open(TEST, 'w', encoding='utf-8').write(html)
    print('made: __test.html, js/__game_test.js')


def clean():
    for p in (COPY, TEST):
        if os.path.exists(p):
            os.remove(p)
            print('removed:', os.path.basename(p))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'clean':
        clean()
    else:
        build()
