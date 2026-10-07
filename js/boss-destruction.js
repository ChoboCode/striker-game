/* 보스 격파 전용 원화 연출. 전투·점수·다음 탄 타이밍과 독립된 2.4초 시퀀스다. */
const BossDestruction = (function () {
  'use strict';
  const DURATION = 2.4, FINAL_AT = 1.5;
  function create(b) {
    const reactor = b.id === 'regent';
    const anchors = b.parts.map(p => ({x:p.ox*b.w*(b.flip?-1:1), y:p.oy*b.h}));
    anchors.push({x:-b.w*.18,y:-b.h*.21},{x:b.w*.18,y:b.h*.21},{x:0,y:-b.h*.05},
      {x:-b.w*.12,y:b.h*.28},{x:b.w*.12,y:-b.h*.28});
    const bursts = anchors.map((p,i) => ({x:b.x+p.x,y:b.y+p.y,
      start:i<b.parts.length ? .015+i*.18 : .54+(i-b.parts.length)*.14,
      duration:.64,size:Math.min(144,Math.max(88,b.w*.32))}));
    return {id:b.id,x:b.x,y:b.y,w:b.w,h:b.h,t:0,reactor,bursts,
      imageKey:reactor?'boss-reactor-blast':'boss-heavy-blast',
      size:Math.min(352,Math.max(240,Math.min(b.w*.9,b.h*1.15)))};
  }
  function update(effect,time) { if(effect)effect.t=Math.max(0,time); }
  function stats(effect) {
    if(!effect)return null;
    const t=effect.t;
    return {time:t,finished:t>=DURATION,imageKey:effect.imageKey,
      bursts:effect.bursts.filter(b=>t>=b.start&&t<b.start+b.duration).length,
      fragments:0,
      finalActive:t>=FINAL_AT&&t<DURATION};
  }
  function draw(effect,ctx) {
    if(!effect||effect.t>=DURATION)return;
    const t=effect.t;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    // 기체·적탄 파티클 풀과 분리해 탄막이 많아도 격파 원화가 누락되지 않게 한다.
    for(const burst of effect.bursts) {
      const age=t-burst.start;
      if(age>=0&&age<burst.duration) {
        // 함체와 같은 금속 질감의 원화로 작은 점화부터 최종 붕괴까지 이어 준다.
        if(!Assets.drawExplosion(ctx,burst.x,burst.y,burst.size,age/burst.duration,'boss-heavy-blast'))
          Assets.drawExplosion(ctx,burst.x,burst.y,burst.size,age/burst.duration);
      }
    }
    if(t>=FINAL_AT) {
      const progress=(t-FINAL_AT)/(DURATION-FINAL_AT);
      if(!Assets.drawExplosion(ctx,effect.x,effect.y,effect.size,progress,effect.imageKey))
        Assets.drawExplosion(ctx,effect.x,effect.y,effect.size,progress);
    }
    ctx.restore();
  }
  return {create,update,draw,stats,DURATION,FINAL_AT};
})();
