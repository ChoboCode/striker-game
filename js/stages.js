/* 스테이지 정의와 웨이브 스크립트.
   at: 스테이지 경과 시간(초). 시간이 되면 게임 루프가 해당 항목을 실행한다. */
const Stages = (function () {
  'use strict';

  /* 적 기본값. w는 화면에 그려지는 폭(논리 픽셀), hit는 피격 반지름. */
  const ENEMY = {
    crimson: {name:'레드 팽', art:'mini', w:54, hit:18, hp:9, score:420, prop:'#ffb6a2', banks:true, tint:'crimson', move:'crossDive', fire:'wingPair', speed:165},
    scarlet: {name:'스칼렛 에이스', art:'mini', w:58, hit:19, hp:14, score:560, prop:'#ffd0b4', banks:true, tint:'scarlet', move:'slalom', fire:'wingPair', speed:145},
    carbon: {name:'블랙 레이븐', art:'mini', w:62, hit:21, hp:24, score:780, prop:'#b9d4f2', banks:true, tint:'carbon', move:'patrol', fire:'lockBurst', speed:100},
    obsidian: {name:'옵시디언', art:'s3fighter', w:88, hit:28, hp:46, score:1200, prop:'#cbbadf', banks:true, tint:'obsidian', move:'patrol', fire:'splitFan', speed:78},
    mini:   { art: 'mini',   w: 42,  hit: 15, hp: 3,  score: 120,  prop: '#d5d8ce', banks: true },
    medium: { art: 'medium', w: 92,  hit: 28, hp: 26, score: 700,  prop: '#d5d8ce', banks: false },
    heavy:  { art: 'medium', w: 150, hit: 46, hp: 120, score: 3500, prop: '#d5d8ce', banks: false, heavy: true },
    /* 색조는 원본 PNG 를 그대로 두고 그릴 때만 얹는다. 전용 원화가 생기면 art 만 바꾸면 된다. */
    sniper: { art: 'mini',   w: 48,  hit: 17, hp: 7,  score: 300, prop: '#d5d8ce', banks: true,  tint: '#6f56d8' },
    kamikaze: { art: 'mini', w: 44,  hit: 16, hp: 4,  score: 340, prop: '#e2564a', banks: true,  tint: '#d8443a' },
    bomber: { art: 'medium', w: 86,  hit: 27, hp: 38, score: 1000, prop: '#c07a28', banks: false, tint: '#c07a28' },

    /* 색조와 표식이 각각 다른 공격형 3종. 색만으로 구분하지 않도록 꼬리 표식과 공격 방식을 함께 나눈다.
       빨강 = 훑는 연사, 노랑 = 원형 확산, 초록 = 유도탄 */
    gunner:  { art: 'mini',   w: 48, hit: 17, hp: 6,  score: 280, prop: '#f0cdc6', banks: true,  tint: '#c22f28' },
    spinner: { art: 'mini',   w: 52, hit: 18, hp: 10, score: 420, prop: '#f4de9c', banks: true,  tint: '#d9a915' },
    hunter:  { art: 'medium', w: 80, hit: 26, hp: 26, score: 820, prop: '#bfe3c6', banks: false, tint: '#2e8f4d' },

    /* 3스테이지 설상 요격기: 전용 원화, 좌우 자세 있음 */
    s3fighter: { art: 's3fighter', w: 62, hit: 21, hp: 10, score: 380, prop: '#cfe3f2', banks: true },
    /* 밀림·화산 전역기는 생성 원화만 사용한다. */
    canopyFighter: { art: 'canopyFighter', w: 64, hit: 22, hp: 16, score: 520, prop: '#d5e8b7', banks: true, move: 'slalom', fire: 'wingPair', speed: 158 },
    calderaFighter: { art: 'calderaFighter', w: 68, hit: 23, hp: 22, score: 680, prop: '#ffd1a1', banks: true, move: 'crossDive', fire: 'splitFan', speed: 172 },
    /* 5스테이지 강철 편대 */
    s5fighter: { art: 's5fighter', w: 58, hit: 20, hp: 12, score: 420, prop: '#f0a13c', banks: false },
    s5heavy:   { art: 's5heavy',   w: 74, hit: 25, hp: 30, score: 800, prop: '#f0a13c', banks: false },
    s5gunship: { art: 's5gunship', w: 96, hit: 31, hp: 62, score: 1500, prop: '#f0a13c', banks: false }
  };

  /* 스테이지별 중간 보스. 같은 원화를 쓰되 크기·패턴·이름이 다르다.
     전용 원화가 생기면 art 와 tint 만 바꾸면 된다. */
  /* 중간 보스. 잡몹보다 확실히 단단하고, 호위기를 부르며 미사일을 쏜다. */
  const MIDBOSS = [
    { name: '해상 편대장',   art: 'medium',     tint: '#2f6f9f', scale: 1.70, hp: 520,  score: 6000,  pattern: 'spread', move: 'sway', escort: 'mini',      escortCd: 7.5 },
    { name: '사막 강습기',   art: 'medium',     tint: '#b06a24', scale: 1.78, hp: 680,  score: 7200,  pattern: 'ring',   move: 'sway', escort: 'mini',      escortCd: 7.0 },
    { name: '빙원 요격 대장', art: 's3midboss', tint: null,      scale: 1.95, hp: 880,  score: 8600,  pattern: 'burst',  move: 'dash', escort: 's3fighter', escortCd: 6.5 },
    { name: '수관 돌격 대장', art: 'canopyMidboss', tint: null,    scale: 1.88, hp: 1080, score: 10000, pattern: 'burst',  move: 'dash', escort: 'canopyFighter', escortCd: 6.0 },
    { name: '칼데라 포격 대장', art: 'calderaMidboss', tint: null, scale: 2.00, hp: 1250, score: 11600, pattern: 'ring',  move: 'sway', escort: 'calderaFighter', escortCd: 5.7 },
    { name: '야간 폭격 대장', art: 'stage4Vtol', banks: true, tint: null, scale: 1.86, hp: 1080, score: 10000, pattern: 'carpet', move: 'slow', escort: 'kamikaze',  escortCd: 6.0 },
    { name: '요새 친위 대장', art: 's5midboss', tint: null,      scale: 2.05, hp: 1350, score: 12000, pattern: 'mixed',  move: 'dash', escort: 's5fighter', escortCd: 5.5 }
  ];

  /* 지상 목표물. base 는 고정 레이어, gun 은 회전 레이어(없으면 고정)다.
     rot: 'aim' 은 기체를 겨냥, 'spin' 은 계속 회전한다. */
  const GROUND = {
    aa:     { base: 'aa-base', gun: 'aa-gun', rot: 'aim', w: 64, hit: 25, hp: 26, score: 400, fire: 'aimed2', cd: [2.0, 3.0] },
    tank:   { base: 'tank-hull', gun: 'tank-turret', rot: 'aim', w: 58, hit: 22, hp: 20, score: 350, fire: 'aimed', cd: [2.2, 3.4], drift: 26 },
    bunker: { base: 'bunker', w: 72, hit: 28, hp: 44, score: 600, fire: 'spread3', cd: [2.4, 3.6] },
    radar:  { base: 'radar-base', gun: 'radar-dish', rot: 'spin', w: 66, hit: 25, hp: 18, score: 900, fire: 'none' },
    fuel:   { base: 'fuel', w: 68, hit: 27, hp: 14, score: 500, fire: 'none', blast: 90 },
    boat:   { base: 'boat', w: 86, hit: 30, hp: 34, score: 700, fire: 'aimed', cd: [2.0, 3.0], drift: 18 },

    /* 5스테이지 요새 시설(전용 원화) */
    s5turret:  { base: 's5-turret',  w: 74, hit: 27, hp: 40, score: 700,  fire: 'aimed2',  cd: [1.7, 2.6] },
    s5battery: { base: 's5-battery', w: 92, hit: 33, hp: 70, score: 1200, fire: 'missile', cd: [2.6, 3.6] },
    s5tank:    { base: 's5-tank',    w: 68, hit: 24, hp: 34, score: 600,  fire: 'aimed',   cd: [1.9, 2.8], drift: 30 },
    s5core:    { base: 's5-core',    w: 78, hit: 28, hp: 46, score: 1600, fire: 'spread3', cd: [2.2, 3.0], blast: 96 }
  };

  /* 지상 목표물 배치 항목: x 는 0(좌)~1(우) */
  GROUND.patrol4 = { art: 'stage4Patrol', base: 'boat', w: 122, hit: 28, hp: 34, score: 700, fire: 'aimed', cd: [2, 3], drift: 18 };
  GROUND.missile4 = { art: 'stage4MissileBoat', base: 'boat', w: 138, hit: 31, hp: 48, score: 950, fire: 'spread3', cd: [2.4, 3.6], drift: 14 };

  function enemyForStage(key, stageIndex) {
    const base = ENEMY[key];
    const stage = STAGES[stageIndex];
    const regional = stage && (stage.boss === 'canopy' ? 'canopyFighter' : (stage.boss === 'caldera' ? 'calderaFighter' : null));
    if (regional && ['carbon','obsidian','gunner','hunter','bomber','medium','heavy'].includes(key)) {
      // 무장 역할은 넓은 중무장 기체 원화로 구분한다. 체력·공격·피격 판정은 기존 역할을 따른다.
      return Object.assign({},base,{art:stage.boss==='canopy'?'canopyGunship':'calderaBomber',w:Math.max(base.w,84),banks:false,tint:null});
    }
    if (regional && ['mini', 'crimson', 'scarlet', 'carbon', 'obsidian', 'sniper', 'kamikaze', 'gunner', 'spinner'].includes(key)) {
      return Object.assign({}, base, { art: regional, banks: true });
    }
    return stage && stage.boss === 'nightark' && ['medium', 'heavy', 'bomber'].includes(key)
      ? Object.assign({}, base, { art: 'stage4Vtol', banks: true, tint: null }) : base;
  }
  function groundForStage(key, stageIndex) {
    const base = GROUND[key];
    const stage = STAGES[stageIndex];
    return stage && stage.boss === 'nightark' && (key === 'aa' || key === 'bunker')
      ? Object.assign({}, base, { art: 'stage4Artillery', gun: null, rot: 'aim', w: 86 }) : base;
  }

  function G(at, type, x, o) {
    o = o || {};
    return { at: at, kind: 'ground', type: type, x: x, drop: o.drop || null };
  }

  /* 편대 한 무리를 만드는 항목 */
  function F(at, o) {
    const def = ENEMY[o.type] || ENEMY.mini;
    return {
      at: at, kind: 'formation',
      shape: o.shape || 'line',
      type: o.type || 'mini',
      n: o.n || 4,
      x: o.x === undefined ? 0.5 : o.x,          // 0(좌)~1(우)
      speed: o.speed || def.speed || 120,
      move: o.move || def.move || 'straight',
      fire: o.fire || def.fire || 'none',
      gap: o.gap || 0.25,                        // 편대 내 등장 간격(초)
      drop: o.drop || null,                      // 편대 전멸 시 드롭
      from: o.from || 'top'                      // top | left | right
    };
  }
  function EV(at, name) { return { at: at, kind: 'event', name: name }; }

  const STAGES = [
    /* ── 1 군도 해역 ─────────────────────────── */
    {
      no: 1, name: '군도 해역', sub: '해상 봉쇄선을 돌파하라',
      bg: 1, scroll: 46, tint: 'rgba(10,30,60,.18)', boss: 'breakwater',
      script: [
        F(1.5,  { shape: 'v', n: 5, x: 0.5, speed: 130, fire: 'none' }),
        F(6.0,  { shape: 'line', n: 4, x: 0.25, speed: 140, move: 'sine', fire: 'aimed' }),
        F(9.0,  { shape: 'line', n: 4, x: 0.75, speed: 140, move: 'sine', fire: 'aimed', drop: 'power' }),
        F(14.0, { shape: 'arc', n: 6, x: 0.5, speed: 120, move: 'swoop', from: 'left', fire: 'none' }),
        F(17.0, { shape: 'arc', n: 6, x: 0.5, speed: 120, move: 'swoop', from: 'right', fire: 'none', drop: 'power' }),
        F(22.0, { type: 'medium', n: 1, x: 0.35, speed: 70, move: 'hover', fire: 'spread3' }),
        F(24.0, { type: 'medium', n: 1, x: 0.65, speed: 70, move: 'hover', fire: 'spread3', drop: 'bomb' }),
        F(29.0, { shape: 'v', n: 5, x: 0.3, speed: 150, fire: 'aimed' }),
        F(32.0, { shape: 'v', n: 5, x: 0.7, speed: 150, fire: 'aimed', drop: 'power' }),
        F(37.0, { shape: 'column', n: 6, x: 0.5, speed: 175, move: 'dive', fire: 'none' }),
        F(40.0, { type: 'gunner', shape: 'line', n: 2, x: 0.5, speed: 100, move: 'hover', fire: 'sweep', gap: 0.5 }),
        EV(44.0, 'midboss'),
        F(52.0, { shape: 'line', n: 5, x: 0.5, speed: 150, move: 'sine', fire: 'aimed', drop: 'power' }),
        EV(58.0, 'boss')
      ],
      ground: [
        G(3.5, 'boat', .18), G(5.2, 'boat', .80),
        G(11.0, 'aa', .50, { drop: 'power' }),
        G(19.0, 'fuel', .24), G(20.2, 'fuel', .34),
        G(26.0, 'boat', .60),
        G(33.0, 'aa', .18), G(34.2, 'aa', .82, { drop: 'bomb' }),
        G(41.0, 'boat', .40), G(42.5, 'fuel', .72),
        G(50.0, 'aa', .30), G(51.5, 'boat', .70)
      ]
    },

    /* ── 2 사막 전선 ─────────────────────────── */
    {
      no: 2, name: '사막 전선', sub: '보급 철도를 끊어라',
      bg: 2, scroll: 54, tint: 'rgba(60,40,10,.16)', boss: 'dune',
      script: [
        F(1.5,  { shape: 'line', n: 5, x: 0.5, speed: 150, fire: 'aimed' }),
        F(5.0,  { shape: 'arc', n: 6, speed: 135, move: 'swoop', from: 'left', fire: 'aimed' }),
        F(7.5,  { shape: 'arc', n: 6, speed: 135, move: 'swoop', from: 'right', fire: 'aimed', drop: 'power' }),
        F(12.0, { type: 'medium', n: 2, x: 0.5, speed: 75, move: 'hover', fire: 'spread3', gap: 0.9 }),
        F(18.0, { shape: 'column', n: 7, x: 0.2, speed: 185, move: 'dive' }),
        F(20.0, { shape: 'column', n: 7, x: 0.8, speed: 185, move: 'dive', drop: 'power' }),
        F(25.0, { shape: 'v', n: 6, x: 0.5, speed: 160, fire: 'burst' }),
        F(29.0, { type: 'medium', n: 1, x: 0.2, speed: 80, move: 'hover', fire: 'aimed' }),
        F(30.5, { type: 'medium', n: 1, x: 0.8, speed: 80, move: 'hover', fire: 'aimed', drop: 'bomb' }),
        F(16.0, { type: 'sniper', shape: 'line', n: 2, x: 0.5, speed: 90, move: 'hover', fire: 'snipe', gap: 0.5 }),
        F(32.5, { type: 'kamikaze', shape: 'column', n: 4, x: 0.5, speed: 150, move: 'chase', gap: 0.4, drop: 'power' }),
        F(22.0, { type: 'gunner', shape: 'line', n: 2, x: 0.35, speed: 105, move: 'hover', fire: 'sweep', gap: 0.5 }),
        EV(36.0, 'midboss'),
        F(45.0, { shape: 'line', n: 6, x: 0.35, speed: 165, move: 'sine', fire: 'aimed' }),
        F(48.0, { shape: 'line', n: 6, x: 0.65, speed: 165, move: 'sine', fire: 'aimed', drop: 'power' }),
        EV(55.0, 'boss')
      ],
      ground: [
        G(3.0, 'tank', .22), G(4.2, 'tank', .36),
        G(9.0, 'fuel', .78), G(10.2, 'fuel', .88),
        G(15.0, 'bunker', .50, { drop: 'power' }),
        G(22.0, 'aa', .16), G(23.0, 'aa', .84),
        G(28.0, 'tank', .60), G(29.2, 'tank', .74),
        G(34.0, 'bunker', .28), G(35.2, 'fuel', .62),
        G(44.0, 'aa', .50, { drop: 'bomb' }),
        G(49.0, 'tank', .30), G(50.2, 'tank', .70)
      ]
    },

    /* ── 3 빙하 협곡 ─────────────────────────── */
    {
      no: 3, name: '빙하 협곡', sub: '설원의 통신 기지를 지나라',
      bg: 3, scroll: 62, tint: 'rgba(30,60,90,.14)', boss: 'gemini',
      script: [
        F(1.2,  { shape: 'v', n: 6, x: 0.5, speed: 165, fire: 'aimed' }),
        F(8.5,  { type: 's3fighter', shape: 'line', n: 4, x: 0.5, speed: 180, move: 'sine', fire: 'aimed' }),
        F(21.0, { type: 's3fighter', shape: 'v', n: 5, x: 0.35, speed: 185, fire: 'burst' }),
        F(22.5, { type: 's3fighter', shape: 'v', n: 5, x: 0.65, speed: 185, fire: 'burst', drop: 'power' }),
        F(40.0, { type: 's3fighter', shape: 'arc', n: 6, speed: 175, move: 'swoop', from: 'left', fire: 'aimed' }),
        F(41.5, { type: 's3fighter', shape: 'arc', n: 6, speed: 175, move: 'swoop', from: 'right', fire: 'aimed', drop: 'bomb' }),
        F(5.0,  { shape: 'column', n: 8, x: 0.15, speed: 200, move: 'dive' }),
        F(6.2,  { shape: 'column', n: 8, x: 0.85, speed: 200, move: 'dive', drop: 'power' }),
        F(11.0, { shape: 'arc', n: 7, speed: 150, move: 'swoop', from: 'left', fire: 'burst' }),
        F(13.0, { shape: 'arc', n: 7, speed: 150, move: 'swoop', from: 'right', fire: 'burst' }),
        F(18.0, { type: 'medium', n: 2, x: 0.3, speed: 85, move: 'hover', fire: 'spread3', gap: 0.7 }),
        F(20.0, { type: 'medium', n: 2, x: 0.7, speed: 85, move: 'hover', fire: 'spread3', gap: 0.7, drop: 'power' }),
        F(27.0, { shape: 'line', n: 7, x: 0.5, speed: 175, move: 'sine', fire: 'aimed' }),
        F(14.5, { type: 'sniper', shape: 'line', n: 3, x: 0.5, speed: 95, move: 'hover', fire: 'snipe', gap: 0.45 }),
        F(25.0, { type: 'kamikaze', shape: 'column', n: 5, x: 0.35, speed: 165, move: 'chase', gap: 0.35 }),
        F(26.5, { type: 'kamikaze', shape: 'column', n: 5, x: 0.65, speed: 165, move: 'chase', gap: 0.35, drop: 'power' }),
        F(16.0, { type: 'gunner', shape: 'line', n: 2, x: 0.65, speed: 110, move: 'hover', fire: 'sweep', gap: 0.45 }),
        F(29.5, { type: 'spinner', shape: 'line', n: 2, x: 0.5, speed: 95, move: 'hover', fire: 'ring', gap: 0.6 }),
        EV(33.0, 'midboss'),
        F(43.0, { shape: 'v', n: 7, x: 0.35, speed: 180, fire: 'burst' }),
        F(45.5, { shape: 'v', n: 7, x: 0.65, speed: 180, fire: 'burst', drop: 'bomb' }),
        EV(52.0, 'boss')
      ],
      ground: [
        G(3.0, 'radar', .24), G(4.5, 'aa', .40),
        G(9.5, 'bunker', .70), G(11.0, 'aa', .84),
        G(16.0, 'radar', .50, { drop: 'power' }),
        G(23.0, 'aa', .20), G(24.2, 'bunker', .36),
        G(30.0, 'fuel', .66), G(31.2, 'fuel', .78),
        G(38.0, 'radar', .30), G(39.5, 'aa', .62, { drop: 'bomb' }),
        G(46.0, 'bunker', .50)
      ]
    },

    /* ── 4 밀림 협곡 ─────────────────────────── */
    {
      no: 4, name: '밀림 협곡', sub: '수관 방공망을 뚫고 강을 따라 진입하라',
      bg: 6, scroll: 66, tint: 'rgba(16,70,36,.16)', boss: 'canopy',
      script: [
        F(1.2, { type:'canopyFighter', shape:'v', n:6, x:.5, speed:165, fire:'wingPair' }),
        F(5.0, { type:'crimson', shape:'arc', n:6, x:.5, speed:170, move:'crossDive', fire:'wingPair', from:'left' }),
        F(8.0, { type:'scarlet', shape:'arc', n:6, x:.5, speed:165, move:'slalom', fire:'wingPair', from:'right', drop:'power' }),
        F(13.0,{ type:'canopyFighter', shape:'line', n:4, x:.5, speed:150, move:'slalom', fire:'wingPair' }),
        F(17.0,{ type:'carbon', shape:'line', n:3, x:.5, speed:110, move:'patrol', fire:'lockBurst' }),
        F(21.0,{ type:'gunner', shape:'line', n:3, x:.5, speed:110, move:'hover', fire:'sweep', gap:.45 }),
        F(26.0,{ type:'canopyFighter', shape:'column', n:7, x:.28, speed:190, move:'dive', fire:'burst' }),
        F(27.3,{ type:'canopyFighter', shape:'column', n:7, x:.72, speed:190, move:'dive', fire:'burst', drop:'bomb' }),
        F(32.0,{ type:'obsidian', shape:'v', n:3, x:.5, speed:105, move:'patrol', fire:'splitFan' }),
        EV(35.0,'midboss'),
        F(43.0,{ type:'scarlet', shape:'line', n:6, x:.5, speed:175, move:'slalom', fire:'wingPair' }),
        F(47.0,{ type:'canopyFighter', shape:'arc', n:7, x:.5, speed:180, move:'swoop', fire:'aimed', from:'left' }),
        F(49.0,{ type:'canopyFighter', shape:'arc', n:7, x:.5, speed:180, move:'swoop', fire:'aimed', from:'right', drop:'power' }),
        EV(55.0,'boss')
      ],
      ground: [
        G(3.0,'radar',.22), G(4.5,'aa',.76), G(10.0,'bunker',.50),
        G(15.0,'fuel',.18), G(16.0,'fuel',.82), G(22.0,'aa',.30,{drop:'power'}),
        G(29.0,'radar',.68), G(31.0,'bunker',.26), G(39.0,'aa',.72),
        G(45.0,'bunker',.50,{drop:'bomb'}), G(51.0,'aa',.50)
      ]
    },

    /* ── 5 화산 기지 ─────────────────────────── */
    {
      no: 5, name: '화산 기지', sub: '용암 방어선 너머의 포격 지휘부를 무력화하라',
      bg: 7, scroll: 60, tint: 'rgba(96,30,10,.17)', boss: 'caldera',
      script: [
        F(1.2, { type:'calderaFighter', shape:'line', n:6, x:.5, speed:175, fire:'splitFan' }),
        F(5.0, { type:'crimson', shape:'column', n:7, x:.25, speed:195, move:'crossDive', fire:'wingPair' }),
        F(6.5, { type:'scarlet', shape:'column', n:7, x:.75, speed:195, move:'slalom', fire:'wingPair', drop:'power' }),
        F(12.0,{ type:'calderaFighter', shape:'v', n:6, x:.5, speed:185, fire:'splitFan' }),
        F(16.0,{ type:'carbon', shape:'line', n:3, x:.5, speed:115, move:'patrol', fire:'lockBurst' }),
        F(20.0,{ type:'bomber', shape:'line', n:2, x:.5, speed:78, move:'hover', fire:'drop', gap:.7 }),
        F(25.0,{ type:'calderaFighter', shape:'arc', n:7, x:.5, speed:185, move:'swoop', fire:'aimed', from:'left' }),
        F(27.0,{ type:'calderaFighter', shape:'arc', n:7, x:.5, speed:185, move:'swoop', fire:'aimed', from:'right', drop:'bomb' }),
        F(31.0,{ type:'obsidian', shape:'line', n:3, x:.5, speed:110, move:'patrol', fire:'splitFan' }),
        EV(34.0,'midboss'),
        F(42.0,{ type:'scarlet', shape:'v', n:6, x:.5, speed:180, move:'slalom', fire:'wingPair' }),
        F(46.0,{ type:'calderaFighter', shape:'line', n:7, x:.5, speed:190, fire:'splitFan' }),
        F(49.0,{ type:'carbon', shape:'line', n:3, x:.5, speed:120, move:'patrol', fire:'lockBurst', drop:'power' }),
        EV(56.0,'boss')
      ],
      ground: [
        G(2.5,'tank',.20), G(3.8,'tank',.80), G(9.0,'aa',.50), G(11.0,'fuel',.28),
        G(14.0,'bunker',.72,{drop:'power'}), G(19.0,'aa',.16), G(21.0,'aa',.84),
        G(28.0,'tank',.38), G(29.2,'tank',.62), G(37.0,'bunker',.50),
        G(43.0,'aa',.30), G(44.0,'aa',.70), G(51.0,'bunker',.50,{drop:'bomb'})
      ]
    },

    /* ── 6 야간 공업지대 ─────────────────────── */
    {
      no: 6, name: '야간 공업지대', sub: '어둠 속 제련 단지를 돌파하라',
      bg: 4, scroll: 58, tint: 'rgba(20,10,40,.20)', boss: 'nightark',
      script: [
        F(1.2,  { shape: 'line', n: 6, x: 0.5, speed: 160, fire: 'burst' }),
        F(5.0,  { type: 'medium', n: 2, x: 0.5, speed: 85, move: 'hover', fire: 'spread3', gap: 0.8 }),
        F(10.0, { shape: 'arc', n: 8, speed: 160, move: 'swoop', from: 'right', fire: 'aimed' }),
        F(12.0, { shape: 'arc', n: 8, speed: 160, move: 'swoop', from: 'left', fire: 'aimed', drop: 'power' }),
        F(17.0, { shape: 'column', n: 8, x: 0.3, speed: 205, move: 'dive', fire: 'aimed' }),
        F(18.5, { shape: 'column', n: 8, x: 0.7, speed: 205, move: 'dive', fire: 'aimed' }),
        F(24.0, { type: 'medium', n: 3, x: 0.5, speed: 90, move: 'hover', fire: 'burst', gap: 0.6, drop: 'bomb' }),
        F(30.0, { shape: 'v', n: 7, x: 0.5, speed: 185, fire: 'spread3' }),
        F(20.0, { type: 'bomber', shape: 'line', n: 2, x: 0.5, speed: 70, move: 'hover', fire: 'drop', gap: 0.8, drop: 'bomb' }),
        F(33.0, { type: 'sniper', shape: 'line', n: 3, x: 0.4, speed: 100, move: 'hover', fire: 'snipe', gap: 0.4 }),
        F(14.0, { type: 'gunner', shape: 'line', n: 3, x: 0.5, speed: 110, move: 'hover', fire: 'sweep', gap: 0.4 }),
        F(27.0, { type: 'spinner', shape: 'line', n: 2, x: 0.3, speed: 100, move: 'hover', fire: 'ring', gap: 0.5 }),
        F(40.0, { type: 'hunter', shape: 'line', n: 1, x: 0.5, speed: 80, move: 'hover', fire: 'homing' }),
        EV(35.0, 'midboss'),
        F(44.0, { type: 'kamikaze', shape: 'column', n: 6, x: 0.5, speed: 175, move: 'chase', gap: 0.3 }),
        F(46.0, { shape: 'line', n: 7, x: 0.3, speed: 180, move: 'sine', fire: 'burst' }),
        F(48.0, { shape: 'line', n: 7, x: 0.7, speed: 180, move: 'sine', fire: 'burst', drop: 'power' }),
        EV(55.0, 'boss')
      ],
      ground: [
        G(2.5, 'fuel', .20), G(3.6, 'fuel', .30), G(4.7, 'fuel', .40),
        G(6.5, 'patrol4', .50), G(18.0, 'missile4', .56),
        G(9.0, 'aa', .72), G(10.2, 'bunker', .86),
        G(15.0, 'radar', .50, { drop: 'power' }),
        G(21.0, 'aa', .18), G(22.2, 'aa', .34),
        G(27.0, 'bunker', .64), G(28.2, 'fuel', .80),
        G(34.0, 'radar', .26), G(35.5, 'aa', .50, { drop: 'bomb' }),
        G(39.0, 'patrol4', .42), G(47.0, 'missile4', .58),
        G(43.0, 'bunker', .30), G(44.5, 'bunker', .70),
        G(50.0, 'aa', .50)
      ]
    },

    /* ── 7 철의 요새 ─────────────────────────── */
    {
      no: 7, name: '철의 요새', sub: '최종 방어선을 무너뜨려라',
      bg: 5, scroll: 50, tint: 'rgba(40,10,20,.18)', boss: 'regent',
      script: [
        F(1.2,  { type: 's5fighter', shape: 'v', n: 7, x: 0.5, speed: 185, fire: 'burst' }),
        F(9.5,  { type: 's5heavy', shape: 'line', n: 3, x: 0.5, speed: 105, move: 'hover', fire: 'spread3', gap: 0.6 }),
        F(17.0, { type: 's5fighter', shape: 'column', n: 8, x: 0.3, speed: 215, move: 'dive', fire: 'aimed' }),
        F(18.2, { type: 's5fighter', shape: 'column', n: 8, x: 0.7, speed: 215, move: 'dive', fire: 'aimed', drop: 'power' }),
        F(25.0, { type: 's5gunship', shape: 'line', n: 2, x: 0.5, speed: 85, move: 'hover', fire: 'burst', gap: 1.0, drop: 'bomb' }),
        F(42.0, { type: 's5heavy', shape: 'v', n: 5, x: 0.5, speed: 190, fire: 'burst' }),
        F(52.0, { type: 's5gunship', shape: 'line', n: 2, x: 0.35, speed: 90, move: 'hover', fire: 'spread3', gap: 0.8 }),
        F(4.5,  { shape: 'column', n: 9, x: 0.2, speed: 215, move: 'dive', fire: 'aimed' }),
        F(6.0,  { shape: 'column', n: 9, x: 0.8, speed: 215, move: 'dive', fire: 'aimed', drop: 'power' }),
        F(11.0, { type: 'medium', n: 2, x: 0.25, speed: 90, move: 'hover', fire: 'spread3', gap: 0.6 }),
        F(12.0, { type: 'medium', n: 2, x: 0.75, speed: 90, move: 'hover', fire: 'spread3', gap: 0.6 }),
        F(18.0, { shape: 'arc', n: 9, speed: 170, move: 'swoop', from: 'left', fire: 'burst' }),
        F(20.0, { shape: 'arc', n: 9, speed: 170, move: 'swoop', from: 'right', fire: 'burst', drop: 'bomb' }),
        F(26.0, { shape: 'line', n: 8, x: 0.5, speed: 190, move: 'sine', fire: 'spread3' }),
        F(15.0, { type: 'bomber', shape: 'line', n: 2, x: 0.35, speed: 75, move: 'hover', fire: 'drop', gap: 0.7 }),
        F(24.0, { type: 'kamikaze', shape: 'column', n: 6, x: 0.5, speed: 180, move: 'chase', gap: 0.3, drop: 'power' }),
        F(29.0, { type: 'sniper', shape: 'line', n: 4, x: 0.5, speed: 105, move: 'hover', fire: 'snipe', gap: 0.35 }),
        F(22.0, { type: 'gunner', shape: 'line', n: 3, x: 0.5, speed: 115, move: 'hover', fire: 'sweep', gap: 0.35 }),
        F(37.0, { type: 'hunter', shape: 'line', n: 2, x: 0.5, speed: 85, move: 'hover', fire: 'homing', gap: 0.9 }),
        F(40.0, { type: 'spinner', shape: 'line', n: 2, x: 0.5, speed: 100, move: 'hover', fire: 'ring', gap: 0.5, drop: 'power' }),
        EV(32.0, 'midboss'),
        F(44.0, { type: 'medium', n: 3, x: 0.5, speed: 95, move: 'hover', fire: 'burst', gap: 0.5, drop: 'power' }),
        F(47.0, { type: 'bomber', shape: 'line', n: 2, x: 0.6, speed: 78, move: 'hover', fire: 'drop', gap: 0.6, drop: 'bomb' }),
        F(50.0, { shape: 'v', n: 8, x: 0.5, speed: 195, fire: 'burst' }),
        EV(56.0, 'boss')
      ],
      ground: [
        G(2.5, 's5turret', .16), G(3.5, 's5turret', .84),
        G(8.0, 's5tank', .30), G(9.2, 's5tank', .70),
        G(14.0, 's5core', .50, { drop: 'power' }),
        G(19.0, 's5battery', .24), G(21.0, 's5tank', .44), G(22.2, 's5tank', .60),
        G(27.0, 's5turret', .28), G(28.2, 's5turret', .72),
        G(33.0, 's5battery', .18), G(34.2, 's5battery', .82),
        G(40.0, 's5core', .50, { drop: 'bomb' }),
        G(46.0, 's5turret', .22), G(47.2, 's5core', .50), G(48.4, 's5turret', .78)
      ]
    }
  ];

  /* 기존 웨이브 일부를 교체해 총 적 수가 급증하지 않도록 새 편대를 도입한다. */
  const colorWaves = [
    [[29,'crimson',3],[52,'scarlet',3]],
    [[18,'crimson',3],[20,'crimson',3],[29,'carbon',1],[30.5,'carbon',1],[45,'scarlet',3]],
    [[5,'crimson',4],[6.2,'crimson',4],[27,'scarlet',4],[29.5,'carbon',2]],
    [[5,'crimson',4],[8,'scarlet',4],[17,'carbon',2],[32,'obsidian',2]],
    [[5,'crimson',4],[6.5,'scarlet',4],[16,'carbon',2],[31,'obsidian',2]],
    [[1.2,'scarlet',4],[10,'carbon',2],[12,'carbon',2],[44,'obsidian',2]],
    [[4.5,'crimson',4],[6,'crimson',4],[26,'scarlet',4],[44,'obsidian',2]]
  ];
  colorWaves.forEach(function(waves,index){
    for(const [at,type,n] of waves){
      const i=STAGES[index].script.findIndex(ev=>ev.kind==='formation' && ev.at===at);
      if(i<0)continue;
      const old=STAGES[index].script[i];
      STAGES[index].script[i]=F(at,{type:type,n:n,x:old.x,shape:'line',drop:old.drop});
    }
  });

  const difficulty = [
    [1, 1, 1], [1.22, 1.18, 1.06], [1.46, 1.38, 1.14],
    [1.58, 1.46, 1.18], [1.68, 1.54, 1.22], [1.78, 1.62, 1.26], [2.1, 1.9, 1.38]
  ];

  /* 지상 항목을 웨이브 스크립트에 합치고 시간 순으로 정렬한다 */
  STAGES.forEach(function (st) {
    const mul = difficulty[st.no - 1];
    st.enemyHpMul = mul[0]; st.groundHpMul = mul[1]; st.bulletMul = mul[2];
    let originalTotal=0,expandedTotal=0;
    st.script.forEach(function(ev){
      if(ev.kind!=='formation')return;
      ev.baseN=ev.n;originalTotal+=ev.n;
      const target=Math.round(originalTotal*1.5);
      ev.n=target-expandedTotal;expandedTotal=target;
    });
    st.aircraftBefore=originalTotal;st.aircraftAfter=expandedTotal;
    if (st.ground) st.script = st.script.concat(st.ground);
    st.script.sort(function (a, b) { return a.at - b.at; });
  });

  /* 편대 모양별 상대 위치(논리 픽셀 오프셋) */
  function slotOffset(shape, i, n) {
    // 늘어난 횡대는 최대 7기씩 여러 줄로 나눠 가장자리에 겹치지 않게 한다.
    if(shape!=='column' && n>7){
      const row=Math.floor(i/7),count=Math.min(7,n-row*7);
      const pos=slotOffset(shape,i%7,count);pos.y+=row*76;return pos;
    }
    const mid = (n - 1) / 2;
    switch (shape) {
      case 'v':      return { x: (i - mid) * 40, y: Math.abs(i - mid) * 34 };
      case 'arc':    return { x: (i - mid) * 46, y: -Math.abs(i - mid) * 12 };
      case 'column': return { x: 0, y: 0 };
      default:       return { x: (i - mid) * 46, y: 0 };
    }
  }

  return { STAGES: STAGES, ENEMY: ENEMY, GROUND: GROUND, MIDBOSS: MIDBOSS, slotOffset: slotOffset,
    enemyForStage: enemyForStage, groundForStage: groundForStage };
})();
