/* 색상 편대의 이동·사격. 미리보기와 실제 게임에서 같은 함수를 사용한다. */
const EnemyPatterns = (function () {
  'use strict';
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function move(e,dt,w) {
    const previousX=e.x;
    if(e.move==='crossDive') {
      if(e.y<125) e.y+=e.speed*dt;
      else {
        if(e.maneuverT===undefined){e.maneuverT=0;e.turnX=e.x;}
        e.maneuverT+=dt;
        const u=clamp(e.maneuverT/1.45,0,1), s=u*u*(3-2*u);
        e.x=e.turnX+(w-e.turnX*2)*s;
        e.y+=e.speed*(1+.75*u)*dt;
      }
    } else if(e.move==='slalom') {
      e.y+=e.speed*dt;
      e.x=clamp(e.x0,90,w-90)+Math.sin(e.age*3.2)*68*e.dir;
    } else if(e.move==='patrol') {
      if(e.y<e.targetY) e.y=Math.min(e.targetY,e.y+e.speed*dt);
      else {
        e.hoverT+=dt;
        e.x=clamp(e.x0,90,w-90)+Math.sin(e.hoverT*1.8)*64*e.dir;
        if(e.hoverT>5.2) e.y+=e.speed*1.8*dt;
      }
    } else return false;
    const desired=clamp((e.x-previousX)/Math.max(dt,.001)/105,-1,1);
    e.bank+=(desired-e.bank)*Math.min(1,dt*10);
    return true;
  }
  function fire(e,aim,spd,shot) {
    if(e.fire==='wingPair') {
      // 두 날개에서 약간 안쪽으로 모이는 탄. 한 번 쏘고 긴 회피 틈을 준다.
      for(const side of [-1,1]) shot(e.x+side*e.w*.24,e.y+12,-side*28,spd*1.12,'eSmall');
      e.fireCt=1.65;
    } else if(e.fire==='lockBurst') {
      // 예고 때 정한 방향을 3발 동안 유지한다. 플레이어를 계속 추적하지 않는다.
      if(!e.volleyLeft){e.volleyLeft=3;if(e.lockAng===null)e.lockAng=aim;}
      shot(e.x,e.y+16,Math.cos(e.lockAng)*spd*1.12,Math.sin(e.lockAng)*spd*1.12,'eSmall');
      e.volleyLeft--;
      e.fireCt=e.volleyLeft ? .16 : 2.2;
      if(!e.volleyLeft)e.lockAng=null;
    } else if(e.fire==='splitFan') {
      // 정면에 피할 통로를 남기는 좌우 부채꼴 탄막.
      for(const side of [-1,1])for(let k=0;k<3;k++) {
        const a=Math.PI/2+side*(.25+k*.18);
        shot(e.x+side*e.w*.22,e.y+12,Math.cos(a)*spd*.88,Math.sin(a)*spd*.88,'eSmall');
      }
      e.fireCt=2.6;
    } else return false;
    return true;
  }
  return {move:move,fire:fire};
})();
