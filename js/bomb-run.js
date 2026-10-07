/* 지원기 → 하단에서 상승 → 착탄. 게임 시간만 사용하므로 일시정지와 함께 멈춘다. */
const BombRun = (function () {
  'use strict';
  const DURATION = 2.2, RADIUS = 112, PLANE_WIDTH = 520, FLYBY = .72, BLAST_TIME = .72;
  function planeAt(run, time) {
    return {x:run.w/2, y:run.h+240-(run.h+480)*Math.min(1,time/FLYBY)};
  }
  function create(w,h) {
    const run = {w:w,h:h,t:0,missiles:[],hitEnemies:new Set(),hitGrounds:new Set(),hitBosses:new Set()};
    for(let row=0;row<5;row++) for(let col=0;col<5;col++) {
      const x=48+col*(w-96)/4+(row%2 ? (col===0?8:col===4?-8:12) : 0);
      const y=65+row*(h-130)/4+[-18,20,-8,24,-16][(col+row)%5];
      // 기체 진행 방향과 같게 맨 아랫줄(row 4)이 먼저 터지고 위로 훑어 올라간다.
      run.missiles.push({launch:.26+(4-row)*.14+[.04,.08,0,.06,.02][col],
        flight:.12+(h+90-y)/2300,sx:x,sy:h+90,x:x,y:y,
        size:144+((row*7+col*3)%5)*9,angle:(row*2.3+col*1.7),hit:false});
    }
    return run;
  }
  function update(run,dt,onImpact) {
    run.t+=dt;
    for(const m of run.missiles) if(!m.hit && run.t>=m.launch+m.flight) {
      m.hit=true; onImpact(m.x,m.y,RADIUS,run);
    }
    return run.t>=DURATION;
  }
  function draw(run,ctx) {
    ctx.save();
    const plane=Assets.sprite('bomb-plane',PLANE_WIDTH), pos=planeAt(run,run.t);
    if(plane && run.t<FLYBY) {
      ctx.drawImage(plane,pos.x-plane.width/2,pos.y-plane.height/2);
    }
    // 미사일은 지원기보다 앞쪽 레이어에서 화면 아래에서 위로 솟는다. 기수가 정확히 착탄점에 닿는다.
    const art=Assets.sprite('bomb-missile',36);
    for(const m of run.missiles) {
      const u=(run.t-m.launch)/m.flight;
      if(u<0 || u>=1 || !art) continue;
      const pos=missileAt(m,u);
      // 원화는 기수가 아래를 향하므로 180° 돌려 상승 방향에 맞춘다. 잔상도 함께 아래쪽으로 깔린다.
      ctx.save();
      ctx.translate(pos.x,pos.y);
      ctx.rotate(Math.PI);
      ctx.globalAlpha=.14;
      ctx.drawImage(art,-art.width/2,-art.height*.92-30);
      ctx.globalAlpha=1;
      ctx.drawImage(art,-art.width/2,-art.height*.92);
      ctx.restore();
    }
    // 옆에서 본 연기 기둥 대신 탑뷰 폭발 16프레임을 착탄점 중심으로 재생한다.
    for(const m of run.missiles) {
      const age=run.t-m.launch-m.flight;
      if(age<0 || age>=BLAST_TIME) continue;
      ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle);
      Assets.drawExplosion(ctx,0,0,m.size,age/BLAST_TIME,'bomb-impact');
      ctx.restore();
    }
    ctx.restore();
  }
  function missileAt(m,u) {
    const t=Math.max(0,Math.min(1,u)), climb=.25*t+.75*t*t;
    return {x:m.x,y:m.sy+(m.y-m.sy)*climb};
  }
  return {create:create,update:update,draw:draw,missileAt:missileAt,planeAt:planeAt,
    DURATION:DURATION,RADIUS:RADIUS,PLANE_WIDTH:PLANE_WIDTH,FLYBY:FLYBY,BLAST_TIME:BLAST_TIME};
})();
