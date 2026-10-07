/* 자산 로딩과 스프라이트 사전 렌더링.
   저사양 기기를 위해 원본 PNG를 매 프레임 축소하지 않고,
   최초 1회만 오프스크린 캔버스에 그려 두고 그 캔버스를 복사한다. */
const Assets = (function () {
  'use strict';

  const BASE = 'assets/';
  const IMG = Object.create(null);

  /* 기체 프레임 정보. pivot·hub 값은 원본 이미지 기준 비율(0~1)이다. */
  const FRAMES = {
    lancer: {
      neutral:{key:'lancer-sheet',rect:[.326,0,.348,1],pivot:[.5,.5],hubs:[[.31,.275],[.69,.275]],r:.10},
      left:{key:'lancer-sheet',rect:[0,0,1/3,1],pivot:[.5,.5],hubs:[[.345,.36],[.675,.275]],r:.10},
      right:{key:'lancer-sheet',rect:[2/3,0,1/3,1],pivot:[.5,.5],hubs:[[.32,.275],[.66,.36]],r:.10}
    },
    player: {
      neutral: { key: 'player-n', pivot: [.50, .50], hubs: [[.500, .105]], r: .20 },
      left:    { key: 'player-l', pivot: [.46, .50], hubs: [[.487, .105]], r: .18 },
      right:   { key: 'player-r', pivot: [.54, .50], hubs: [[.535, .105]], r: .18 }
    },
    mini: {
      neutral: { key: 'mini-n', pivot: [.50, .50], hubs: [[.500, .793]], r: .20 },
      left:    { key: 'mini-l', pivot: [.46, .50], hubs: [[.408, .826]], r: .18, scale: .95 },
      right:   { key: 'mini-r', pivot: [.55, .50], hubs: [[.567, .832]], r: .18, scale: .95 }
    },
    medium: {
      neutral: { key: 'medium', pivot: [.50, .50], hubs: [[.336, .775], [.664, .775]], r: .12 }
    },
    stage4Vtol: {
      neutral: { key: 's4-vtol-n', pivot: [.50, .50], hubs: [], ducts: [[.250,.354,.102],[.754,.354,.102]] },
      left: { key: 's4-vtol-l', pivot: [.50, .50], hubs: [], ducts: [[.280,.264,.099],[.767,.575,.100]] },
      right: { key: 's4-vtol-r', pivot: [.50, .50], hubs: [], ducts: [[.273,.447,.099],[.785,.279,.100]] }
    },
    stage4Patrol: {
      neutral: { key: 's4-patrol-n', pivot: [.5,.5], hubs: [], rotation: Math.PI },
      left: { key: 's4-patrol-ne', pivot: [.5,.5], hubs: [], rotation: Math.PI },
      right: { key: 's4-patrol-nw', pivot: [.5,.5], hubs: [], rotation: Math.PI }
    },
    stage4MissileBoat: {
      neutral: { key: 's4-missile-n', pivot: [.5,.5], hubs: [], rotation: Math.PI },
      left: { key: 's4-missile-ne', pivot: [.5,.5], hubs: [], rotation: Math.PI },
      right: { key: 's4-missile-nw', pivot: [.5,.5], hubs: [], rotation: Math.PI }
    },
    stage4Artillery: {
      neutral: { key: 's4-artillery-n', pivot: [.5,.5], hubs: [] },
      left: { key: 's4-artillery-l', pivot: [.5,.5], hubs: [] },
      right: { key: 's4-artillery-r', pivot: [.5,.5], hubs: [] }
    },
    boss4: { neutral: { key: 's4-boss', pivot: [.5,.5], hubs: [] } },
    /* 3스테이지(설상 위장) */
    s3fighter: {
      neutral: { key: 's3-fighter-n', pivot: [.5, .5], hubs: [] },
      left:    { key: 's3-fighter-l', pivot: [.5, .5], hubs: [] },
      right:   { key: 's3-fighter-r', pivot: [.5, .5], hubs: [] }
    },
    s3midboss: { neutral: { key: 's3-midboss', pivot: [.5, .5], hubs: [] } },
    boss3:     { neutral: { key: 's3-boss', pivot: [.5, .5], hubs: [] } },
    /* 4 밀림 협곡 — 생성 PNG는 기수 DOWN, 원점은 기체 중앙이다. */
    canopyFighter: { neutral: { key: 'canopy-fighter', pivot: [.5, .5], hubs: [] } },
    canopyGunship: { neutral: { key: 'canopy-gunship', pivot: [.5, .5], hubs: [] } },
    canopyMidboss: { neutral: { key: 'canopy-midboss', pivot: [.5, .5], hubs: [] } },
    bossCanopy: { neutral: { key: 'canopy-boss', pivot: [.5, .5], hubs: [] } },
    /* 5 화산 기지 — 생성 PNG는 기수 DOWN, 원점은 기체 중앙이다. */
    calderaFighter: { neutral: { key: 'caldera-fighter', pivot: [.5, .5], hubs: [] } },
    calderaBomber: { neutral: { key: 'caldera-bomber', pivot: [.5, .5], hubs: [] } },
    calderaMidboss: { neutral: { key: 'caldera-midboss', pivot: [.5, .5], hubs: [] } },
    bossCaldera: { neutral: { key: 'caldera-boss', pivot: [.5, .5], hubs: [] } },
    /* 5스테이지(강철·주황) */
    s5fighter: { neutral: { key: 's5-fighter', pivot: [.5, .5], hubs: [] } },
    s5heavy:   { neutral: { key: 's5-heavy', pivot: [.5, .5], hubs: [] } },
    s5gunship: { neutral: { key: 's5-gunship', pivot: [.5, .5], hubs: [] } },
    s5midboss: { neutral: { key: 's5-dreadnought', pivot: [.5, .5], hubs: [] } },
    boss5:     { neutral: { key: 's5-boss', pivot: [.5, .5], hubs: [] } },
    boss1: {
      neutral: { key: 'boss1', pivot: [.50, .50], r: .085,
                 hubs: [[.211, .757], [.354, .757], [.646, .757], [.789, .757]] }
    },
    boss2: {
      neutral: { key: 'boss2', pivot: [.50, .50], hubs: [], r: 0 }
    },
    /* 지상 시설. 기본 6종은 ImageGen 투명 원화 9장이다.
       회전축은 원화의 실제 연결부에 맞추고 scale로 기존 크기를 유지한다. */
    ground: {
      'aa-base':     { key: 'g-aa-base', pivot: [.5, .5], scale: .8, hubs: [] },
      'aa-gun':      { key: 'g-aa-gun', pivot: [.5, .715], scale: .66, hubs: [] },
      'tank-hull':   { key: 'g-tank-hull', pivot: [.5, .5], scale: .85, hubs: [] },
      'tank-turret': { key: 'g-tank-turret', pivot: [.5, .65], scale: .7, hubs: [] },
      'bunker':      { key: 'g-bunker', pivot: [.5, .5], scale: .74, hubs: [] },
      'radar-base':  { key: 'g-radar-base', pivot: [.5, .5], scale: .7, hubs: [] },
      'radar-dish':  { key: 'g-radar-dish', pivot: [.5, .565], scale: .66, hubs: [] },
      'fuel':        { key: 'g-fuel', pivot: [.5, .5], scale: .84, hubs: [] },
      'boat':        { key: 'g-boat', pivot: [.5, .5], scale: .94, hubs: [] },
      's5-turret':   { key: 'g-s5-turret', pivot: [.5, .5], hubs: [] },
      's5-battery':  { key: 'g-s5-battery', pivot: [.5, .5], hubs: [] },
      's5-tank':     { key: 'g-s5-tank', pivot: [.5, .5], hubs: [] },
      's5-core':     { key: 'g-s5-core', pivot: [.5, .5], hubs: [] }
    }
  };

  const CORE = [
    ['lancer-sheet','lancer-flight-sheet-v1.png'],
    ['bomb-plane','bomb_planet.png'], ['bomb-missile','bomb_missile.png'],
    ['bomb-impact', 'bomb-impact-sheet-v1.png'],
    ['boss-wreck', 'boss-wreck-modules-runtime-v1.webp'],
    ['charge-plasma', 'charge-plasma-sheet-v1.png'],
    ['lancer-burst', 'lancer-burst-sheet-v1.png'],
    ['boss2-damaged', 'boss2-dune-damaged-v2.png'],
    ['fx-explosion', 'explosion.png'],
    ['item-power', 'item-power.png'], ['item-bomb', 'item-bomb.png'], ['item-life', 'item-life.png'],
    ['p-missile', 'p-missile.png'], ['p-pod', 'p-pod.png'],
    ['charge-gather', 'charge-gather.png'],
    ['charge-shot1', 'charge-shot1.png'], ['charge-shot2', 'charge-shot2.png'], ['charge-shot3', 'charge-shot3.png'],
    ['s3-fighter-n', 's3-fighter-n.png'], ['s3-fighter-l', 's3-fighter-l.png'], ['s3-fighter-r', 's3-fighter-r.png'],
    ['s3-midboss', 's3-midboss.png'], ['s3-boss', 's3-boss.png'],
    ['s5-fighter', 's5-fighter.png'], ['s5-heavy', 's5-heavy.png'], ['s5-gunship', 's5-gunship.png'],
    ['s5-dreadnought', 's5-dreadnought.png'], ['s5-boss', 's5-boss.png'],
    ['g-s5-turret', 's5-turret.png'], ['g-s5-battery', 's5-battery.png'],
    ['g-s5-tank', 's5-tank.png'], ['g-s5-core', 's5-core.png'],
    ['player-n', 'player-n.png'], ['player-l', 'player-l.png'], ['player-r', 'player-r.png'],
    ['mini-n', 'mini-n.png'], ['mini-l', 'mini-l.png'], ['mini-r', 'mini-r.png'],
    ['medium', 'medium.png'],
    ['boss1', 'boss1-breakwater.png'], ['boss2', 'boss2-dune.png'],
    ['g-aa-base', 'ground/aa-base-imagegen-v1.webp'], ['g-aa-gun', 'ground/aa-gun-imagegen-v1.webp'],
    ['g-tank-hull', 'ground/tank-hull-imagegen-v1.webp'], ['g-tank-turret', 'ground/tank-turret-imagegen-v1.webp'],
    ['g-bunker', 'ground/bunker-imagegen-v1.webp'],
    ['g-radar-base', 'ground/radar-base-imagegen-v1.webp'], ['g-radar-dish', 'ground/radar-dish-imagegen-v1.webp'],
    ['g-fuel', 'ground/fuel-imagegen-v1.webp'], ['g-boat', 'ground/boat-imagegen-v1.webp']
  ];

  /* 4탄 원화는 배경을 준비할 때만 로드한다. 첫 실행에 13장을 모두 받지 않는다. */
  const STAGE4 = [
    ['s4-boss-damaged','stage4-boss-nightark-damaged-runtime-v1.webp'],
    ['s4-boss','stage4-boss-nightark-runtime-v1.webp'],
    ['s4-patrol-n','stage4-patrol-boat-n.png'],['s4-patrol-nw','stage4-patrol-boat-nw.png'],['s4-patrol-ne','stage4-patrol-boat-ne.png'],
    ['s4-missile-n','stage4-missile-boat-n.png'],['s4-missile-nw','stage4-missile-boat-nw.png'],['s4-missile-ne','stage4-missile-boat-ne.png'],
    ['s4-vtol-n','stage4-vtol-n.png'],['s4-vtol-l','stage4-vtol-l.png'],['s4-vtol-r','stage4-vtol-r.png'],
    ['s4-artillery-n','stage4-artillery-n.png'],['s4-artillery-l','stage4-artillery-l.png'],['s4-artillery-r','stage4-artillery-r.png']
  ];
  const STAGE6 = [
    ['canopy-fighter', 'canopy-fighter-v1.png'], ['canopy-midboss', 'canopy-midboss-v1.png'],
    ['canopy-gunship', 'canopy-gunship-v1.png'],
    ['canopy-boss', 'canopy-boss-v1.png']
  ];
  const STAGE7 = [
    ['caldera-fighter', 'caldera-fighter-v1.png'], ['caldera-midboss', 'caldera-midboss-v1.png'],
    ['caldera-bomber', 'caldera-bomber-v1.png'],
    ['caldera-boss', 'caldera-boss-v1.png'], ['caldera-damaged', 'caldera-boss-damaged-v1.webp']
  ];
  const stageArtPromise = Object.create(null);
  // 일반 격파 원화는 공용, 최종 동력로·전용 손상 원화는 bg5를 준비할 때만 받는다.
  const bossFxPromise = Object.create(null);
  function loadBossFxGroup(group,files) {
    if (!bossFxPromise[group]) {
      bossFxPromise[group] = Promise.all(files.map(p => IMG[p[0]] ? Promise.resolve(IMG[p[0]]) : loadImage(p[0],p[1])))
        .catch(error => { delete bossFxPromise[group]; throw error; });
    }
    return bossFxPromise[group];
  }
  function loadBossFx(n) {
    const shared=loadBossFxGroup('heavy',[
      ['boss-heavy-blast','boss-heavy-blast-v3.webp']
    ]);
    const localDamage={
      1:['breakwater-damaged','boss1-breakwater-damaged-v1.webp'],
      3:['gemini-damaged','s3-boss-damaged-v1.webp'],
      6:['canopy-damaged','canopy-boss-damaged-v1.webp']
    }[n];
    const ready=[shared];
    if(localDamage)ready.push(loadBossFxGroup('damage'+n,[localDamage]));
    if(n===5)ready.push(loadBossFxGroup('reactor',[
      ['boss-reactor-blast','boss-reactor-blast-v3.webp'],['regent-damaged','regent-damaged-v1.webp']
    ]));
    return Promise.all(ready);
  }
  function loadStageArt(n) {
    /* bg id 4의 기존 야간 원화는 이전처럼 필요할 때만 받는다. */
    const art = n === 4 ? STAGE4 : (n === 6 ? STAGE6 : (n === 7 ? STAGE7 : null));
    if (!art) return Promise.resolve();
    if (!stageArtPromise[n]) stageArtPromise[n] = Promise.all(art.map(function (p) {
      return IMG[p[0]] ? Promise.resolve(IMG[p[0]]) : loadImage(p[0],p[1]);
    })).catch(function (error) { delete stageArtPromise[n]; throw error; });
    return stageArtPromise[n];
  }

  function loadImage(key, file) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { IMG[key] = img; resolve(img); };
      img.onerror = function () { reject(new Error('이미지를 불러오지 못했습니다: ' + file)); };
      img.src = BASE + file;
    });
  }

  function loadCore(onProgress) {
    let done = 0;
    return Promise.all(CORE.map(function (pair) {
      return loadImage(pair[0], pair[1]).then(function (img) {
        done++;
        if (onProgress) onProgress(done / CORE.length);
        return img;
      });
    }));
  }

  /* 배경은 스테이지에 들어갈 때 필요한 것만 불러온다. */
  const bgPromise = Object.create(null);
  function loadBg(n) {
    const key = 'bg' + n;
    const file = n === 6 ? 'canopy-bg-v1.jpg' : (n === 7 ? 'caldera-bg-v1.jpg' : key + '.jpg');
    if (!bgPromise[key]) bgPromise[key] = (IMG[key] ? Promise.resolve(IMG[key]) : loadImage(key, file))
      .catch(function (error) { delete bgPromise[key]; throw error; });
    return Promise.all([bgPromise[key], loadStageArt(n), loadBossFx(n)]).then(function (result) { return result[0]; });
  }
  function hasBg(n) { return !!IMG['bg' + n]; }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ── 기체 본체 ─────────────────────────────── */
  const bodyCache = Object.create(null);

  function body(kind, pose, width, tint) {
    const w = Math.round(width);
    const id = kind + '|' + pose + '|' + w + '|' + (tint || '');
    if (bodyCache[id]) return bodyCache[id];

    const group = FRAMES[kind];
    if (!group) return null;
    const f = group[pose] || group.neutral;
    const img = IMG[f.key];
    if (!img) return null;

    const dw = Math.round(w * (f.scale || 1));
    const rect=f.rect || [0,0,1,1];
    const dh = Math.round(dw * (img.height*rect[3]) / (img.width*rect[2]));
    const pad = 4;
    const c = makeCanvas(dw + pad * 2, dh + pad * 2);
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 3;
    g.shadowOffsetY = 2;
    g.save();
    g.translate(pad + dw / 2, pad + dh / 2);
    g.rotate(f.rotation || 0);
    // 명암과 투명도를 보존하는 도장. 캐시 생성 때만 필터를 계산한다.
    const paint = {
      crimson: {filter:'grayscale(1) sepia(1) saturate(5) hue-rotate(310deg) brightness(.83) contrast(1.2)', color:'#e52e36', alpha:.26},
      scarlet: {filter:'grayscale(1) sepia(1) saturate(4) hue-rotate(315deg) brightness(1.05)', color:'#fc583e', alpha:.24},
      carbon: {filter:'grayscale(1) brightness(.74) contrast(1.08)', color:'#182537', alpha:.16},
      obsidian: {filter:'grayscale(1) brightness(.60) contrast(1.4)', color:'#25202f', alpha:.22}
    }[tint];
    if (paint) g.filter = paint.filter;
    g.drawImage(img,rect[0]*img.width,rect[1]*img.height,rect[2]*img.width,rect[3]*img.height,-dw / 2,-dh / 2,dw,dh);
    g.restore();

    /* 소속·기종 구분용 색조. 원본 PNG 는 그대로 두고 사본에만 얹는다. */
    if (tint) {
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = paint ? paint.alpha : .34;
      g.fillStyle = paint ? paint.color : tint;
      g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    const px = pad + f.pivot[0] * dw;
    const py = pad + f.pivot[1] * dh;
    const out = {
      c: c, px: px, py: py, w: dw, h: dh,
      r: dw * (f.r || 0), ducts: [],
      hubs: (f.hubs || []).map(function (h) {
        return { x: pad + h[0] * dw - px, y: pad + h[1] * dh - py };
      })
    };
    /* 원화 안의 덕트 팬만 원형으로 잘라 회전시킨다. 테두리·동체는 고정한다. */
    (f.ducts || []).forEach(function (d) {
      const radius = dw * d[2], frames = [];
      for (let i = 0; i < 8; i++) {
        const rotor = makeCanvas(radius * 2 + 2, radius * 2 + 2), rg = rotor.getContext('2d');
        rg.translate(rotor.width / 2, rotor.height / 2);
        rg.beginPath(); rg.arc(0,0,radius,0,Math.PI*2); rg.clip();
        rg.fillStyle = '#151b20'; rg.fillRect(-radius,-radius,radius*2,radius*2);
        rg.rotate(i / 8 * Math.PI / 2);
        const sr = img.width * d[2];
        rg.drawImage(img, img.width*d[0]-sr, img.height*d[1]-sr, sr*2,sr*2, -radius,-radius,radius*2,radius*2);
        frames.push(rotor);
      }
      out.ducts.push({x:pad+d[0]*dw-px,y:pad+d[1]*dh-py,frames:frames});
    });
    bodyCache[id] = out;
    return out;
  }

  function drawDucts(ctx, art, time) {
    (art.ducts || []).forEach(function (duct, index) {
      const image = duct.frames[(Math.floor(time * 32) + index * 3) % duct.frames.length];
      ctx.drawImage(image,duct.x-image.width/2,duct.y-image.height/2);
    });
  }

  // 파괴된 부위만 같은 위치의 잔해 원화로 바꾼다. 세 부위의 8가지 조합을 캐시한다.
  const damageCache = Object.create(null);
  const DAMAGE_REGIONS = {
    bayL: [.065, .328, .28, .282],
    bayR: [.655, .328, .28, .282],
    bridge: [.415, 0, .17, .30]
  };
  function boss4Body(width, destroyed) {
    const base = body('boss4', 'neutral', width), img = IMG['s4-boss-damaged'];
    if (!base || !img || !destroyed.length) return base;
    const id = Math.round(width) + '|' + destroyed.slice().sort().join(',');
    if (damageCache[id]) return damageCache[id];
    const c = makeCanvas(base.c.width, base.c.height), g = c.getContext('2d');
    g.drawImage(base.c, 0, 0);
    destroyed.forEach(function (key) {
      const r = DAMAGE_REGIONS[key];
      if (!r) return;
      const x = 4+r[0]*base.w, y = 4+r[1]*base.h, w = r[2]*base.w, h = r[3]*base.h;
      g.clearRect(x, y, w, h);
      g.drawImage(img, r[0]*img.width, r[1]*img.height, r[2]*img.width, r[3]*img.height, x,y,w,h);
    });
    return damageCache[id] = Object.assign({}, base, {c:c});
  }

  const explosionCache = Object.create(null);
  function duneDamageBody(base,dead,id) {
    const img=IMG['boss2-damaged'];
    if(!img)return base;
    const c=makeCanvas(base.c.width,base.c.height),g=c.getContext('2d');
    const layer=makeCanvas(c.width,c.height),lg=layer.getContext('2d');
    // 원화의 차체 실루엣으로 가장자리 광택을 제한한다.
    lg.drawImage(img,4,4-base.h*.012,base.w,base.h);
    lg.globalCompositeOperation='destination-in';lg.drawImage(base.c,0,0);
    // 차체 아래쪽으로 돌출되었던 포신은 파괴 후 완전히 사라진다.
    lg.clearRect(0,4+base.h*.585,c.width,c.height);
    g.drawImage(base.c,0,0);
    const regions={ammo:[0,.34],cannon:[.34,.68],loco:[.68,1]};
    dead.forEach(p=>{
      const r=regions[p.key];if(!r)return;
      const x=4+r[0]*base.w,w=(r[1]-r[0])*base.w;
      g.save();g.beginPath();g.rect(x,0,w,c.height);g.clip();
      g.clearRect(0,0,c.width,c.height);g.drawImage(layer,0,0);g.restore();
    });
    return damageCache[id]=Object.assign({},base,{c:c});
  }
  function bossDamageBody(kind,width,parts) {
    const base=body(kind,'neutral',width),sheet=IMG['boss-wreck'];
    if(!base)return base;
    const dead=parts.filter(p=>!p.alive);
    if(!dead.length)return base;
    const id='wreck|'+kind+'|'+width+'|'+dead.map(p=>p.key).join(',');
    if(damageCache[id])return damageCache[id];
    const registered={
      boss1:{image:'breakwater-damaged',regions:{turretR:[.435,.30,.13,.17],turretF:[.435,.49,.13,.16]}},
      boss3:{image:'gemini-damaged',regions:{podL:[.01,.335,.235,.43],podR:[.755,.335,.235,.43]}},
      bossCanopy:{image:'canopy-damaged',regions:{wingL:[.045,.435,.17,.385],wingR:[.785,.435,.17,.385],core:[.425,.285,.15,.205]}},
      bossCaldera:{image:'caldera-damaged',regions:{wingL:[.16,.23,.25,.73],wingR:[.59,.23,.25,.73],core:[.415,.22,.17,.30]}}
    }[kind];
    if(registered) {
      const image=IMG[registered.image];if(!image)return base;
      const c=makeCanvas(base.c.width,base.c.height),g=c.getContext('2d');g.drawImage(base.c,0,0);
      // 포대부터 포신 끝까지 원래 픽셀을 지운 뒤 동일 보스의 손상 영역으로 교체한다.
      const regions=registered.regions;
      for(const p of dead) {
        const r=regions[p.key];if(!r)continue;
        const x=4+r[0]*base.w,y=4+r[1]*base.h,w=r[2]*base.w,h=r[3]*base.h;
        g.clearRect(x,y,w,h);
        g.drawImage(image,r[0]*image.width,r[1]*image.height,r[2]*image.width,r[3]*image.height,x,y,w,h);
      }
      return damageCache[id]=Object.assign({},base,{c:c});
    }
    if(kind==='boss2')return duneDamageBody(base,dead,id);
    if(kind==='boss5' && IMG['regent-damaged']) {
      const c=makeCanvas(base.c.width,base.c.height),g=c.getContext('2d');g.drawImage(base.c,0,0);
      const image=IMG['regent-damaged'],regions={armL:[.03,.37,.31,.37],armR:[.66,.37,.31,.37],core:[.35,.29,.30,.40]};
      for(const p of dead) {
        const r=regions[p.key];if(!r)continue;
        const x=4+r[0]*base.w,y=4+r[1]*base.h,w=r[2]*base.w,h=r[3]*base.h;
        g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.clearRect(x,y,w,h);
        g.drawImage(image,4,4,base.w,base.h);g.restore();
      }
      return damageCache[id]=Object.assign({},base,{c:c});
    }
    if(!sheet)return base;
    const c=makeCanvas(base.c.width,base.c.height),g=c.getContext('2d');
    g.drawImage(base.c,0,0);
    for(const p of dead){
      const x=base.px+p.ox*base.w,y=base.py+p.oy*base.h;
      const size=p.r*2.65;
      const tile=/core|bridge/.test(p.key)?3:/loco|pod/.test(p.key)?1:/cannon|arm/.test(p.key)?2:0;
      g.save();g.beginPath();g.arc(x,y,p.r*.72,0,Math.PI*2);g.clip();g.clearRect(x-p.r,y-p.r,p.r*2,p.r*2);g.restore();
      g.drawImage(sheet,tile%2*sheet.width/2,Math.floor(tile/2)*sheet.height/2,sheet.width/2,sheet.height/2,x-size/2,y-size/2,size,size);
    }
    return damageCache[id]=Object.assign({},base,{c:c});
  }
  function drawExplosion(ctx, x, y, size, progress, imageKey = 'fx-explosion') {
    const img = IMG[imageKey];
    if (!img) return false;
    const width = Math.max(32, Math.ceil(size / 16) * 16);
    const cacheKey = imageKey + '|' + width;
    if (!explosionCache[cacheKey]) {
      explosionCache[cacheKey] = Array.from({length:16}, function (_, i) {
        const c = makeCanvas(width,width);
        c.getContext('2d').drawImage(img,(i%4)*img.width/4,Math.floor(i/4)*img.height/4,img.width/4,img.height/4,0,0,width,width);
        return c;
      });
    }
    const frame = Math.min(15,Math.max(0,Math.floor(progress*16)));
    ctx.save();
    ctx.globalAlpha *= progress > .72 ? Math.max(0,(1-progress)/.28) : 1;
    ctx.drawImage(explosionCache[cacheKey][frame],x-width/2,y-width/2);
    ctx.restore();
    return true;
  }

  /* ── 프로펠러(위에서 본 회전면은 얇은 타원으로 보인다) ── */
  const PROP_FRAMES = 6;
  const propCache = Object.create(null);

  function propSet(radius, hubColor) {
    const r = Math.max(3, Math.round(radius));
    const id = r + '|' + hubColor;
    if (propCache[id]) return propCache[id];

    const w = r * 2 + 6, h = Math.max(8, r * 0.9);
    const frames = [];
    for (let i = 0; i < PROP_FRAMES; i++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      g.translate(c.width / 2, c.height / 2);
      g.save();
      g.scale(1, .22);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(216,230,222,.13)';
      g.fill();
      g.strokeStyle = 'rgba(255,222,149,.22)';
      g.lineWidth = 1.1;
      g.stroke();
      const a0 = i / PROP_FRAMES * Math.PI * 2 / 3;
      for (let t = 0; t < 3; t++) {
        g.save();
        g.globalAlpha = t === 0 ? .55 : .2;
        g.rotate(a0 + t * Math.PI * 2 / 3);
        g.beginPath();
        g.moveTo(r * .1, -r * .05);
        g.quadraticCurveTo(r * .55, -r * .17, r * .95, -r * .09);
        g.quadraticCurveTo(r * 1.02, 0, r * .93, r * .09);
        g.quadraticCurveTo(r * .5, r * .15, r * .1, r * .05);
        g.closePath();
        g.fillStyle = '#cdd9da';
        g.fill();
        g.restore();
      }
      g.restore();
      g.beginPath();
      g.ellipse(0, 0, Math.max(1.2, r * .12), Math.max(1, r * .07), 0, 0, Math.PI * 2);
      g.fillStyle = hubColor;
      g.fill();
      frames.push(c);
    }
    propCache[id] = frames;
    return frames;
  }

  /* 임의 이미지를 표시 크기로 한 번만 줄여 캐시한다(아이템·탄환 등) */
  const spriteCache = Object.create(null);
  function sprite(key, width) {
    const w = Math.round(width);
    const id = key + '|' + w;
    if (spriteCache[id]) return spriteCache[id];
    const img = IMG[key];
    if (!img) return null;
    const h = Math.round(w * img.height / img.width);
    const c = makeCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    spriteCache[id] = c;
    return c;
  }
  const bulletCache = Object.create(null);
  const E_COLORS = {
    eSmall: ['#fff3c4', '#ff9f43', 'rgba(220,90,20,0)'],
    eBig:   ['#ffe7f6', '#e07ad8', 'rgba(150,40,180,0)'],
    eCore:  ['#ffffff', '#6fe0ff', 'rgba(40,140,220,0)']
  };

  const IMG_BULLET = { missile: ['p-missile', 20] };

  function bullet(style) {
    if (bulletCache[style]) return bulletCache[style];
    /* 전용 원화가 있으면 그것을 쓴다 */
    const art = IMG_BULLET[style];
    if (art && IMG[art[0]]) {
      const made = sprite(art[0], art[1]);
      if (made) { bulletCache[style] = made; return made; }
    }
    let c, g;
    if (style === 'lance' || style === 'lancePod') {
      c=makeCanvas(12,30);g=c.getContext('2d');
      const grd=g.createLinearGradient(0,0,0,30);
      grd.addColorStop(0,'#ffffed');grd.addColorStop(.4,'#ffd36c');grd.addColorStop(1,'rgba(255,128,29,0)');
      g.fillStyle=grd;g.beginPath();g.moveTo(6,0);g.lineTo(11,12);g.lineTo(8,22);g.lineTo(6,30);g.lineTo(4,22);g.lineTo(1,12);g.closePath();g.fill();
      g.fillStyle='#fffced';g.beginPath();g.moveTo(6,3);g.lineTo(8,13);g.lineTo(6,22);g.lineTo(4,13);g.closePath();g.fill();
    } else if (style === 'vulcan') {
      c = makeCanvas(8, 20); g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 20);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(.45, '#bfe4ff');
      grd.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(4, 9, 3, 9, 0, 0, Math.PI * 2); g.fill();
    } else if (style === 'pod') {
      c = makeCanvas(7, 14); g = c.getContext('2d');
      g.fillStyle = '#ffe9a8';
      g.beginPath(); g.ellipse(3.5, 7, 2.4, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(3.5, 5.5, 1.1, 3, 0, 0, Math.PI * 2); g.fill();
    } else if (style === 'missile') {
      c = makeCanvas(10, 22); g = c.getContext('2d');
      g.fillStyle = '#e6eef8';
      g.beginPath(); g.moveTo(5, 0); g.lineTo(8, 9); g.lineTo(8, 16); g.lineTo(2, 16); g.lineTo(2, 9); g.closePath(); g.fill();
      g.fillStyle = '#d8544a'; g.fillRect(2, 12, 6, 3);
      g.fillStyle = 'rgba(255,190,90,.85)';
      g.beginPath(); g.moveTo(3.4, 16); g.lineTo(6.6, 16); g.lineTo(5, 22); g.closePath(); g.fill();
    } else if (style === 'charge') {
      c = makeCanvas(56, 76); g = c.getContext('2d');
      const cg = g.createRadialGradient(28, 38, 3, 28, 38, 28);
      cg.addColorStop(0, 'rgba(255,255,255,.98)');
      cg.addColorStop(.35, 'rgba(150,215,255,.85)');
      cg.addColorStop(.75, 'rgba(70,140,255,.42)');
      cg.addColorStop(1, 'rgba(40,90,220,0)');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(28, 38, 26, 37, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath(); g.ellipse(28, 34, 7, 20, 0, 0, Math.PI * 2); g.fill();
    } else if (style === 'eMissile') {
      c = makeCanvas(12, 26); g = c.getContext('2d');
      g.fillStyle = '#d9dee6';
      g.beginPath();
      g.moveTo(6, 0); g.lineTo(9.5, 9); g.lineTo(9.5, 18); g.lineTo(2.5, 18); g.lineTo(2.5, 9);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,24,32,.85)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#c8473c'; g.fillRect(2.5, 13, 7, 3.2);
      const fl = g.createLinearGradient(0, 18, 0, 26);
      fl.addColorStop(0, 'rgba(255,220,140,.95)');
      fl.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = fl;
      g.beginPath(); g.moveTo(3.4, 18); g.lineTo(8.6, 18); g.lineTo(6, 26); g.closePath(); g.fill();
    } else if (E_COLORS[style]) {
      /* 배경이 밝거나 복잡해도 탄이 묻히지 않도록 어두운 테두리를 함께 그린다 */
      const core = style === 'eSmall' ? 11 : (style === 'eBig' ? 16 : 21);
      const size = core + 6;
      const col = E_COLORS[style];
      const cx = size / 2;
      c = makeCanvas(size, size); g = c.getContext('2d');
      g.beginPath(); g.arc(cx, cx, core / 2 + 1.6, 0, Math.PI * 2);
      g.fillStyle = 'rgba(20,10,4,.55)'; g.fill();
      const rg = g.createRadialGradient(cx, cx, 1, cx, cx, core / 2 + 2);
      rg.addColorStop(0, col[0]); rg.addColorStop(.45, col[1]); rg.addColorStop(1, col[2]);
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cx, core / 2 + 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,12,4,.75)'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(cx, cx, core / 2, 0, Math.PI * 2); g.stroke();
    } else {
      c = makeCanvas(8, 8); g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 8);
    }
    bulletCache[style] = c;
    return c;
  }

  /* ── 부드러운 발광 원(약점 표시·차지 등) ── */
  const glowCache = Object.create(null);
  function glow(radius, inner, outer) {
    const r = Math.max(4, Math.round(radius));
    const id = r + '|' + inner + '|' + outer;
    if (glowCache[id]) return glowCache[id];
    const c = makeCanvas(r * 2, r * 2);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(r, r, r * .15, r, r, r);
    rg.addColorStop(0, inner);
    rg.addColorStop(.55, outer);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
    glowCache[id] = c;
    return c;
  }

  /* ── 배경 타일(표시 크기에 맞춰 1회만 축소) ── */
  const bgCache = Object.create(null);
  const BG_OVERLAP = .12;   /* 타일 겹침 비율 (game.js 와 동일해야 한다) */
  function bgTile(n, w, h) {
    const id = n + '|' + Math.round(w) + 'x' + Math.round(h);
    if (bgCache[id]) return bgCache[id];
    const img = IMG['bg' + n];
    if (!img) return null;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    /* 위아래로 반복해도 경계선이 보이지 않도록 타일 위쪽을 서서히 투명하게 만든다.
       (원본 배경은 위아래 픽셀이 맞물리는 무한 타일이 아니다) */
    const fade = Math.round(c.height * BG_OVERLAP);
    const grd = g.createLinearGradient(0, 0, 0, fade);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, fade);
    g.globalCompositeOperation = 'source-over';
    bgCache[id] = c;
    return c;
  }

  /* 해상도가 바뀌면 크기에 의존하는 캐시만 버린다. */
  function clearSizedCaches() {
    Object.keys(bodyCache).forEach(function (k) { delete bodyCache[k]; });
    Object.keys(bgCache).forEach(function (k) { delete bgCache[k]; });
    Object.keys(propCache).forEach(function (k) { delete propCache[k]; });
    Object.keys(glowCache).forEach(function (k) { delete glowCache[k]; });
    Object.keys(damageCache).forEach(function (k) { delete damageCache[k]; });
    Object.keys(explosionCache).forEach(function (k) { delete explosionCache[k]; });
  }

  return {
    FRAMES: FRAMES, PROP_FRAMES: PROP_FRAMES,
    loadCore: loadCore, loadBg: loadBg, hasBg: hasBg, loadStageArt: loadStageArt, loadBossFx: loadBossFx, drawDucts: drawDucts,
    image: function (k) { return IMG[k]; },
    makeCanvas: makeCanvas,
    body: body, propSet: propSet, bullet: bullet, sprite: sprite, glow: glow, bgTile: bgTile, BG_OVERLAP: BG_OVERLAP,
    boss4Body: boss4Body, bossDamageBody: bossDamageBody, drawExplosion: drawExplosion,
    clearSizedCaches: clearSizedCaches
  };
})();
