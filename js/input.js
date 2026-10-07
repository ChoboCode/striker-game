/* 키보드·마우스·터치 입력. 게임 루프가 매 프레임 읽어 간다. */
const Input = (function () {
  'use strict';

  const keys = Object.create(null);
  const st = {
    dirX: 0, dirY: 0,       // 키보드 방향 (-1~1)
    dragX: 0, dragY: 0,     // 포인터 이동량(게임 좌표, 읽으면 비워짐)
    fire: false,            // 발사 유지
    slow: false,            // 저속 이동
    bombEdge: false,        // 폭탄 입력(1회)
    pauseEdge: false,       // 일시정지 입력(1회)
    pointerDown: false,
    touchMode: false,       // 터치로 조작 중인지
    chargeHold: false       // 터치 차지 버튼
  };

  let canvas = null, logicalW = 480, logicalH = 720;

  function code(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

  function onKeyDown(e) {
    const k = code(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'z', 'x', 'w', 'a', 's', 'd'].indexOf(k) >= 0) e.preventDefault();
    if (keys[k]) return;
    keys[k] = true;
    if (k === 'p' || k === 'Escape') st.pauseEdge = true;
    if (k === 'x') st.bombEdge = true;
    syncKeys();
  }
  function onKeyUp(e) {
    keys[code(e)] = false;
    syncKeys();
  }
  function syncKeys() {
    const l = keys['ArrowLeft'] || keys['a'], r = keys['ArrowRight'] || keys['d'];
    const u = keys['ArrowUp'] || keys['w'], d = keys['ArrowDown'] || keys['s'];
    st.dirX = (r ? 1 : 0) - (l ? 1 : 0);
    st.dirY = (d ? 1 : 0) - (u ? 1 : 0);
    st.fire = !!(keys['z'] || keys[' ']);
    st.slow = !!keys['Shift'];
  }

  let lastX = 0, lastY = 0, pid = null;

  function scale() {
    const r = canvas.getBoundingClientRect();
    return r.width > 0 ? logicalW / r.width : 1;
  }

  function onPointerDown(e) {
    if (pid !== null) return;
    pid = e.pointerId;
    st.pointerDown = true;
    st.touchMode = e.pointerType !== 'mouse';
    lastX = e.clientX; lastY = e.clientY;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(pid); } catch (err) { /* 무시 */ } }
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (e.pointerId !== pid) return;
    const s = scale();
    st.dragX += (e.clientX - lastX) * s;
    st.dragY += (e.clientY - lastY) * s;
    lastX = e.clientX; lastY = e.clientY;
    e.preventDefault();
  }
  function onPointerUp(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    st.pointerDown = false;
  }

  function init(cv, w, h) {
    canvas = cv; logicalW = w; logicalH = h;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () {
      for (const k in keys) keys[k] = false;
      syncKeys();
      st.pointerDown = false; pid = null;
    });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* 터치 기기라면 화면 버튼을 노출한다. */
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      st.touchMode = true;
    }
  }

  function bindPadButtons(chargeBtn, bombBtn, pauseBtn) {
    if (chargeBtn) {
      chargeBtn.addEventListener('pointerdown', function (e) { st.chargeHold = true; e.preventDefault(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        chargeBtn.addEventListener(ev, function () { st.chargeHold = false; });
      });
    }
    if (bombBtn) {
      bombBtn.addEventListener('pointerdown', function (e) { st.bombEdge = true; e.preventDefault(); e.stopPropagation(); });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function (e) { st.pauseEdge = true; e.preventDefault(); e.stopPropagation(); });
    }
  }

  /* 매 프레임 1회 호출: 이동량과 1회성 입력을 가져가면서 비운다. */
  function take() {
    const out = {
      dirX: st.dirX, dirY: st.dirY,
      dragX: st.dragX, dragY: st.dragY,
      fire: st.fire || (st.pointerDown && st.touchMode) || st.chargeHold,
      charging: st.chargeHold,
      slow: st.slow,
      bomb: st.bombEdge,
      pause: st.pauseEdge,
      pointerDown: st.pointerDown
    };
    st.dragX = 0; st.dragY = 0;
    st.bombEdge = false; st.pauseEdge = false;
    return out;
  }

  function reset() {
    st.dragX = 0; st.dragY = 0; st.bombEdge = false; st.pauseEdge = false;
    st.chargeHold = false; st.pointerDown = false; pid = null;
    for (const k in keys) keys[k] = false;
    syncKeys();
  }

  return {
    init: init, take: take, reset: reset, bindPadButtons: bindPadButtons,
    get touchMode() { return st.touchMode; }
  };
})();
