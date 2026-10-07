/* 효과음은 WebAudio 합성, 배경음은 assets/*.mp3 음원 파일을 재생한다.
   음원을 불러오지 못하면 기존 합성 트랙으로 대신하므로 오프라인에서도 소리가 끊기지 않는다. */
const Snd = (function () {
  'use strict';

  let ctx = null;
  let master = null, sfxGain = null, bgmGain = null;
  let voices = 0;
  const last = Object.create(null);

  /* 저장소가 막힌 환경에서도 소리 설정은 이번 실행 동안 유지된다. */
  function readPref(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
  function writePref(key, value) { try { localStorage.setItem(key, value); } catch (err) { /* 이번 실행에서만 유지 */ } }

  const state = {
    sfxOn: readPref('is_sfx') !== '0',
    bgmOn: readPref('is_bgm') !== '0'
  };

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = state.sfxOn ? 1 : 0; sfxGain.connect(master);
    bgmGain = ctx.createGain(); bgmGain.gain.value = state.bgmOn ? 0.55 : 0; bgmGain.connect(master);
    return ctx;
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function busy() { return voices > 14; }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || !state.sfxOn) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain);
    voices++;
    o.onended = function () { voices--; };
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol, cutoff, type) {
    if (!ctx || !state.sfxOn) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    const t = ctx.currentTime;
    src.buffer = noiseBuf;
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(cutoff || 900, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, (cutoff || 900) * 0.25), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    voices++;
    src.onended = function () { voices--; };
    src.start(t); src.stop(t + dur);
  }

  /* 같은 효과음이 몰릴 때 간격을 둬 저사양 기기에서 소리가 뭉치지 않게 한다. */
  function throttled(name, gap) {
    const now = performance.now();
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now;
    return true;
  }

  const sfx = {
    shot: function () { if (throttled('shot', 55) && !busy()) tone(900, 0.06, 'square', 0.045, 1500); },
    pod: function () { if (throttled('pod', 90) && !busy()) tone(1350, 0.05, 'triangle', 0.035, 1900); },
    missile: function () { if (throttled('missile', 120)) noise(0.18, 0.06, 1400); },
    chargeReady: function () { tone(880, 0.12, 'sine', 0.09, 1320); tone(1320, 0.16, 'sine', 0.07); },
    chargeFire: function () { tone(220, 0.4, 'sawtooth', 0.13, 60); noise(0.35, 0.14, 2200); },
    hit: function () { if (throttled('hit', 35) && !busy()) noise(0.05, 0.05, 2600, 'highpass'); },
    explodeS: function () { if (throttled('explodeS', 50)) { noise(0.26, 0.16, 1100); tone(180, 0.18, 'square', 0.05, 60); } },
    explodeB: function () { noise(0.55, 0.24, 700); tone(120, 0.4, 'sawtooth', 0.1, 40); },
    bossDown: function () { noise(1.2, 0.3, 500); tone(90, 1.0, 'sawtooth', 0.14, 30); },
    power: function () { tone(660, 0.09, 'square', 0.09); setTimeout(function () { tone(990, 0.12, 'square', 0.09); }, 80); },
    extend: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.14, 'square', 0.09); }, i * 90); }); },
    bomb: function () { noise(0.9, 0.3, 1800); tone(70, 0.9, 'sine', 0.16, 30); },
    damage: function () { noise(0.4, 0.22, 600); tone(200, 0.3, 'sawtooth', 0.12, 50); },
    warning: function () { tone(440, 0.2, 'square', 0.08); setTimeout(function () { tone(392, 0.28, 'square', 0.08); }, 220); },
    menu: function () { tone(740, 0.07, 'triangle', 0.07, 980); },
    clear: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'triangle', 0.1); }, i * 120); }); }
  };

  function play(name) {
    if (!ctx || !state.sfxOn) return;
    const fn = sfx[name];
    if (fn) fn();
  }

  /* ── 대체 배경음: 음원 파일을 못 쓸 때만 쓰는 합성 트랙 ── */
  const TRACKS = [
    { scale: [0, 3, 5, 7, 10], root: 55, tempo: 132, drums: 'march', arp: 3, name: '군도' },
    { scale: [0, 2, 5, 7, 9],  root: 49, tempo: 124, drums: 'skip',  arp: 2, name: '사막' },
    { scale: [0, 2, 3, 7, 8],  root: 58, tempo: 118, drums: 'march', arp: 4, name: '빙하' },
    { scale: [0, 2, 3, 7, 8],  root: 58, tempo: 118, drums: 'march', arp: 4, name: '밀림' },
    { scale: [0, 3, 5, 6, 10], root: 44, tempo: 116, drums: 'heavy', arp: 3, name: '화산' },
    { scale: [0, 1, 5, 6, 10], root: 46, tempo: 128, drums: 'skip',  arp: 2, name: '야간' },
    { scale: [0, 3, 5, 6, 10], root: 44, tempo: 116, drums: 'heavy', arp: 3, name: '요새' }
  ];
  const BOSS_TRACK = { scale: [0, 1, 4, 6, 7], root: 41, tempo: 104, drums: 'heavy', arp: 5, name: '보스' };

  const bgm = { timer: null, step: 0, cfg: TRACKS[0], boss: false };

  function bgmNote(freq, dur, type, vol) {
    if (!ctx || !state.bgmOn) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bgmGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function bgmDrum(dur, vol, cutoff) {
    if (!ctx || !state.bgmOn || !noiseBuf) return;
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    const t = ctx.currentTime;
    src.buffer = noiseBuf;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bgmGain);
    src.start(t); src.stop(t + dur);
  }

  function note(semi, octave) {
    return bgm.cfg.root * Math.pow(2, semi / 12 + octave);
  }

  function drums(pattern, s) {
    if (pattern === 'heavy') {
      if (s % 2 === 0) bgmDrum(0.13, 0.30, 200);
      if (s % 4 === 2) bgmDrum(0.11, 0.18, 1900);
      if (s % 16 === 14) bgmDrum(0.18, 0.20, 420);
    } else if (pattern === 'skip') {
      if (s % 4 === 0 || s % 8 === 3) bgmDrum(0.12, 0.26, 220);
      if (s % 2 === 1) bgmDrum(0.06, 0.10, 2600);
    } else {
      if (s % 4 === 0) bgmDrum(0.13, 0.28, 220);
      if (s % 8 === 4) bgmDrum(0.12, 0.16, 1800);
    }
  }

  function step() {
    const cfg = bgm.cfg, sc = cfg.scale, s = bgm.step;
    drums(cfg.drums, s);

    /* 베이스 */
    if (s % 2 === 0) bgmNote(note(sc[0], 1), 0.16, 'triangle', 0.16);
    if (bgm.boss && s % 8 === 6) bgmNote(note(sc[2], 1), 0.18, 'triangle', 0.14);

    /* 아르페지오: arp 가 클수록 촘촘하다 */
    if (s % Math.max(1, 6 - cfg.arp) === 0) {
      const idx = (s * 3 + ((s / 16) | 0) * 2) % sc.length;
      bgmNote(note(sc[idx], 3), 0.13, 'square', 0.055);
      if (cfg.arp >= 4) bgmNote(note(sc[(idx + 2) % sc.length], 3), 0.10, 'square', 0.035);
    }
    if (s % 16 === 12) bgmNote(note(sc[(s / 4 | 0) % sc.length], 4), 0.2, 'square', 0.04);

    bgm.step = (s + 1) % 32;
  }

  /* mode: 'stage'(기본) | 'boss' */
  function synthStart(stageIndex, mode) {
    if (!ctx) return;
    bgm.boss = mode === 'boss';
    bgm.cfg = bgm.boss ? BOSS_TRACK : (TRACKS[stageIndex] || TRACKS[0]);
    synthStop();
    bgm.step = 0;
    bgm.timer = setInterval(step, bgm.cfg.tempo);
  }
  function synthStop() {
    if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = null; }
  }

  /* ── 배경음: 스테이지별 음원과 보스 등장 음원 ──────────────
     4탄은 3탄 음원, 5~7탄은 기존 4·5탄 음원을 함께 쓴다. 파일명 대소문자는 실제 파일 그대로여야 한다
     (대소문자를 구분하는 서버에 올리면 이름이 다르면 404 가 난다). */
  const BGM_FILES = [
    'assets/stage1bgm.mp3',
    'assets/stage2BGM.mp3',
    'assets/stage3bgm.mp3',
    'assets/stage3bgm.mp3',
    'assets/stage45bgm.mp3',
    'assets/stage45bgm.mp3',
    'assets/stage45bgm.mp3'
  ];
  const BGM_BOSS = 'assets/bossBGM.mp3';
  const BGM_VOLUME = 0.26;         // 효과음(탄환·폭발)이 묻히지 않는 크기. 조절은 이 값만 바꾼다
  const FADE_MS = 320;             // 곡을 바꿀 때 이전 곡이 줄어드는 시간
  const WARM_DELAY = 5000;         // 스테이지 음원이 자리잡은 뒤 보스 음원을 미리 받는다

  const players = Object.create(null);
  let cur = null, curKey = '', fadeTimer = null, warmTimer = null;

  function player(url) {
    if (players[url]) return players[url];
    const a = new Audio();
    a.loop = true;
    a.preload = 'none';
    a.volume = BGM_VOLUME;
    a.src = url;
    /* 음원을 못 읽으면 조용해지지 않도록 합성 트랙으로 넘긴다 */
    a.addEventListener('error', function () {
      a.broken = true;
      if (cur === a) { cur = null; curKey = ''; synthStart(a.stageIndex, a.mode); }
    });
    players[url] = a;
    return a;
  }

  function rewind(el) { try { el.currentTime = 0; } catch (e) { /* 아직 못 읽은 상태 */ } }
  function playSafe(el) {
    const p = el.play();
    if (p && p.catch) p.catch(function () { /* 자동재생 차단·로드 실패는 조용히 넘긴다 */ });
  }
  function clearFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }

  function fadeOut(el, done) {
    clearFade();
    if (!el || el.paused) { if (el) { rewind(el); el.volume = BGM_VOLUME; } done(); return; }
    const stepDown = BGM_VOLUME / Math.max(1, FADE_MS / 40);
    fadeTimer = setInterval(function () {
      const v = el.volume - stepDown;
      if (v <= 0.02) {
        clearFade();
        el.pause(); rewind(el); el.volume = BGM_VOLUME;
        done();
      } else el.volume = v;
    }, 40);
  }

  /* 보스 음원은 4MB 가 넘으므로 등장 순간에 받기 시작하면 늦는다.
     스테이지 음원이 자리잡을 시간을 준 뒤 미리 받아 둔다. */
  function warmBoss() {
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = setTimeout(function () {
      warmTimer = null;
      const a = player(BGM_BOSS);
      if (!a.broken && a.preload !== 'auto') { a.preload = 'auto'; a.load(); }
    }, WARM_DELAY);
  }

  /* mode: 'stage'(기본) | 'boss' */
  function bgmStart(stageIndex, mode) {
    const isBoss = mode === 'boss';
    const key = (isBoss ? 'boss:' : 'stage:') + stageIndex;
    const next = player(isBoss ? BGM_BOSS : (BGM_FILES[stageIndex] || BGM_FILES[0]));
    if (curKey === key && cur === next && !cur.paused) return;   // 같은 곡이 이미 흐르는 중

    synthStop();
    const begin = function () {
      cur = next; curKey = key;
      next.stageIndex = stageIndex; next.mode = mode;
      clearFade();
      next.volume = BGM_VOLUME;
      rewind(next);
      if (next.broken) { synthStart(stageIndex, mode); return; }
      if (state.bgmOn) playSafe(next);      // 꺼둔 상태면 위치만 잡아 두고 켤 때 재생한다
    };
    if (cur && cur !== next) fadeOut(cur, begin); else begin();
    if (!isBoss) warmBoss();
  }

  function bgmStop() {
    clearFade(); synthStop();
    if (warmTimer) { clearTimeout(warmTimer); warmTimer = null; }
    if (cur) { cur.pause(); rewind(cur); cur.volume = BGM_VOLUME; }
    cur = null; curKey = '';
  }

  /* 일시정지: 위치를 남긴 채 멈춘다 */
  function bgmPause() {
    clearFade(); synthStop();
    if (cur) cur.pause();
  }
  function bgmResume(stageIndex, mode) {
    const key = (mode === 'boss' ? 'boss:' : 'stage:') + stageIndex;
    if (cur && curKey === key && !cur.broken) {
      cur.volume = BGM_VOLUME;
      if (state.bgmOn) playSafe(cur);
      return;
    }
    bgmStart(stageIndex, mode);
  }

  function setSfx(on) {
    state.sfxOn = on;
    writePref('is_sfx', on ? '1' : '0');
    if (sfxGain) sfxGain.gain.value = on ? 1 : 0;
  }
  function setBgm(on) {
    state.bgmOn = on;
    writePref('is_bgm', on ? '1' : '0');
    if (bgmGain) bgmGain.gain.value = on ? 0.55 : 0;   // 합성 대체 트랙용
    if (!on) { synthStop(); if (cur) cur.pause(); }
    else if (cur && !cur.broken) { cur.volume = BGM_VOLUME; playSafe(cur); }
  }

  return {
    init: init, resume: resume, play: play,
    bgmStart: bgmStart, bgmStop: bgmStop, bgmPause: bgmPause, bgmResume: bgmResume,
    setSfx: setSfx, setBgm: setBgm,
    get sfxOn() { return state.sfxOn; },
    get bgmOn() { return state.bgmOn; }
  };
})();
