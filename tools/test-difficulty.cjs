const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = {BossArt:{},Assets:{body:(_kind,_pose,width)=>({h:width*.72})}};
vm.createContext(context);
for(const file of ['difficulty','stages','bosses'])
  vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context);
const {D,S,B} = vm.runInContext('({D:Difficulty,S:Stages,B:Bosses})',context);
const output = path.resolve(root,'../output/striker-difficulty-qa');
fs.mkdirSync(output,{recursive:true});

assert.equal(D.normalize('unknown'),'easy');
assert.equal(D.normalize('hard'),'hard');
assert.notEqual(D.recordKeys('easy').ranking,D.recordKeys('hard').ranking);
assert.equal(D.recordKeys('hard').ranking,'is_scores','legacy HARD scores remain accessible');
for(let n=1;n<=30;n++) {
  assert.equal(D.patternCount(n,'hard'),n);
  const easy=D.patternCount(n,'easy');
  assert.ok(easy>=1 && easy<=n);
  if(n>3) {assert.ok(easy<n);assert.equal(easy%2,n%2,'fan symmetry stays consistent');}
}

// Run each actual boss phase for 20 seconds, with and without destroyed parts.
// Count emitted projectiles before the runtime pool cap; escorts are counted separately.
function sample(stage,index,mode,phase,wrecked) {
  const profile=D.get(mode),b=B.create(stage.boss,index,profile);
  b.state='fight';b.x=240;b.y=b.entryY;b.hp=b.maxHp*[.9,.5,.2][phase-1];
  if(wrecked)b.parts.forEach(p=>{p.alive=false;p.hp=0;});
  let shots=0,escorts=0,maxSpeed=0;
  const api={W:480,H:720,bulletMul:stage.bulletMul,attackRate:profile.attackRate,
    patternCount:n=>D.patternCount(n,mode),
    aimAngle:(x,y)=>Math.atan2(620-y,240-x),
    eShot:(x,y,vx,vy)=>{
      assert.ok(Number.isFinite(x+y+vx+vy),stage.boss+' finite projectile');
      shots++;maxSpeed=Math.max(maxSpeed,Math.hypot(vx,vy)*profile.bulletSpeed);
    },spawnMini:()=>{escorts++;},boom:()=>{},shake:()=>{}};
  for(let tick=0;tick<1200;tick++) {
    B.update(b,1/60,api);
    assert.ok(Number.isFinite(b.x+b.y),stage.boss+' finite movement');
  }
  assert.equal(b.phase,phase);assert.ok(shots>0);
  return {shots,escorts,maxSpeed:Math.round(maxSpeed*100)/100};
}
const stages=S.STAGES.map((stage,index)=>{
  const formations=stage.script.filter(ev=>ev.kind==='formation');
  const counts={};
  for(const mode of ['easy','hard']) {
    const profile=D.get(mode),b=B.create(stage.boss,index,profile);
    const count=formations.reduce((sum,ev)=>sum+D.formationCount(ev,mode),0);
    assert.equal(count,mode==='easy'?stage.aircraftBefore:stage.aircraftAfter);
    assert.equal(b.maxHp,Math.round(b.def.hp*profile.bossHp));
    b.parts.forEach(p=>{
      const raw=b.def.parts.find(def=>def.key===p.key);
      assert.equal(p.maxHp,Math.round(raw.hp*profile.partHp));
    });
    const bossAt=stage.script.find(ev=>ev.name==='boss').at;
    counts[mode]={formationAircraft:count,aircraftPerSecond:Math.round(count/bossAt*100)/100,
      midbossHp:Math.round(S.MIDBOSS[index].hp*profile.midHp),bossHp:b.maxHp};
  }
  const phases=[];
  for(let phase=1;phase<=3;phase++)for(const wrecked of [false,true]) {
    const easy=sample(stage,index,'easy',phase,wrecked),hard=sample(stage,index,'hard',phase,wrecked);
    assert.ok(easy.shots<hard.shots,stage.boss+' phase '+phase+' EASY emits fewer shots');
    assert.ok(easy.maxSpeed<hard.maxSpeed,stage.boss+' phase '+phase+' EASY shots are slower');
    phases.push({phase,wrecked,easy,hard});
  }
  return {stage:stage.no,name:stage.name,boss:stage.boss,...counts,phases};
});
const report={passed:true,method:'20 seconds per phase at 60 Hz, fixed player target (240,620), intact/wrecked parts. Actual boss update/fire functions; projectile count before pool cap; escorts excluded from projectile counts.',
  limitations:'Code simulation does not establish human difficulty, reaction time, collision safety, frame rate or audio output. Full browser progression uses an accelerated clock and invulnerability.',
  profiles:JSON.parse(JSON.stringify(D.profiles)),stages};
fs.writeFileSync(path.join(output,'balance-audit.json'),JSON.stringify(report,null,2));
for(const stage of stages) {
  const count=mode=>stage.phases.reduce((sum,p)=>sum+p[mode].shots,0);
  console.log(`ST.${stage.stage} formation ${stage.easy.formationAircraft}/${stage.hard.formationAircraft}, boss HP ${stage.easy.bossHp}/${stage.hard.bossHp}, phase sample shots ${count('easy')}/${count('hard')} (EASY/HARD)`);
}
console.log('PASS: mode isolation, legacy records, formation counts, part/hull HP, all 7 bosses and 3 phases in intact/wrecked states');
