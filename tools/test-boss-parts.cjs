const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {BossArt:{},Assets:{body:(_kind,_pose,width)=>({h:width})}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/bosses.js'),'utf8')+';this.B=Bosses;',context);
const B=context.B;
function boss(){const b=B.create('nightark',3);b.x=240;b.y=190;b.state='fight';return b;}
let b=boss();
const front=b.y+b.hitH/2-1;
assert.equal(B.partAt(b,160,front,2).key,'bayL','ordinary shots reach left weapon through front hull');
assert.equal(B.partAt(b,320,front,2).key,'bayR');
assert.equal(B.partAt(b,240,front,2),null,'armored bridge receives no part damage');
assert.equal(B.partAt(b,160,front+100,2),null,'no damage before bullet reaches hull');
b.parts[2].hidden=false;
assert.equal(B.partAt(b,240,front,2).key,'bridge');
b.parts[0].alive=false;
assert.equal(B.partAt(b,160,front,2),null,'destroyed module cannot receive repeat damage');
function fire(b,phase,step){const shots=[];b.phase=phase;b.step=step;b.ct=0;b.launchCt=99;
 b.def.fire(b,.016,{bulletMul:1,aimAngle:()=>1,eShot:(x,y,vx,vy)=>shots.push({x,y,vx,vy})});return shots;}
/* 발악 규칙: 부위를 부숴도 그 자리가 조용해지지 않는다.
   조준은 잃지만 더 넓은 탄막이 같은 주기로 나오므로 탄 수는 줄지 않는다. */
b=boss();const bay2=fire(b,2,1).length;
b.parts[0].alive=false;let shots=fire(b,2,1);
assert.ok(shots.length>=bay2,'destroyed weapon bay keeps firing: '+shots.length+' >= '+bay2);
assert.ok(shots.some(s=>s.x<b.x),'shots still come from the wrecked port side');
b.parts[1].alive=false;const both=fire(b,2,1).length;
assert.ok(both>=shots.length,'losing both bays does not thin the curtain: '+both+' >= '+shots.length);
const bridge3=fire(b,3,1).length;
b.parts[2].alive=false;
assert.ok(fire(b,3,1).length>=bridge3,'a wrecked bridge trades aim for a wall of shots');
assert.ok(fire(b,3,0).length>=5,'the three-lane volley still covers the wrecked lanes');
const old=B.create('breakwater',0);old.x=240;old.y=190;
assert.equal(B.partAt(old,old.x+old.parts[0].ox*old.w,old.y+old.hitH/2+100,0),null,'other bosses do not inherit projected zones');
console.log('PASS: part targeting, armor, destroyed-state exclusion, wrecked-part rage fire, other-boss isolation');
for(const [id,hp] of [['breakwater',2200],['dune',2800],['gemini',3600]]){
 const b=B.create(id,0);assert.equal(b.maxHp,hp);assert.ok(b.def.projectParts);
}
const gem=B.create('gemini',2);gem.x=240;gem.y=190;gem.phase=2;gem.ct=0;gem.step=0;
const gshots=[],api={bulletMul:1,aimAngle:()=>1,eShot:(x,y)=>gshots.push({x,y})};
gem.def.fire(gem,.016,api);const gemBase=gshots.length;
gem.parts[0].alive=false;gem.ct=0;gem.step=0;gshots.length=0;gem.def.fire(gem,.016,api);
assert.ok(gshots.length>=gemBase,'Gemini keeps firing from the wrecked battery: '+gshots.length+' >= '+gemBase);
assert.ok(gshots.some(s=>s.x<gem.x),'the wrecked port battery still vents shots');
console.log('PASS: stage 1-3 balance and Gemini wrecked battery keeps firing');

/* 5개 보스 · 3페이즈 모두에서 부위를 잃으면 탄막이 강해져야 한다(발악). */
function burst(id,phase,kill){
 const b=B.create(id,0);b.x=240;b.y=b.entryY;b.state='fight';b.ct=0;
 const ratio=phase===1?.9:(phase===2?.5:.2);
 if(phase>=2)b.parts.forEach(p=>{p.hidden=false;});
 if(kill)b.parts.forEach(p=>{if(!p.hidden){p.alive=false;p.hp=0;}});
 let n=0;
 const api={W:480,H:720,bulletMul:1,aimAngle:()=>Math.PI/2,
  eShot:()=>{n++;},spawnMini:()=>{},boom:()=>{},shake:()=>{}};
 for(let t=0;t<20;t+=1/60){b.hp=b.maxHp*ratio;B.update(b,1/60,api);}
 return n;
}
for(const id of ['breakwater','dune','gemini','nightark','regent'])
 for(let ph=1;ph<=3;ph++){
  const calm=burst(id,ph,false),rage=burst(id,ph,true);
  assert.ok(rage>calm*1.1,id+' phase '+ph+' must rage when parts break: '+calm+' -> '+rage);
 }
console.log('PASS: every boss and phase fires harder once its parts are destroyed');
