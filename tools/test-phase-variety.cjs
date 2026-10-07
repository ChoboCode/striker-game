const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const scope={BossArt:{},Assets:{body:(_kind,_pose,w)=>({h:w*.72})}};
vm.createContext(scope);
for(const file of ['stages','difficulty','bosses'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),scope);
const {S,D,B}=vm.runInContext('({S:Stages,D:Difficulty,B:Bosses})',scope);
const inventory=[];
for(const [index,st] of S.STAGES.entries()) {
  const regular=[...new Set(st.script.filter(e=>e.kind==='formation').map(e=>S.enemyForStage(e.type,index).art))];
  assert.ok(regular.length>=2,'stage '+st.no+' has different regular aircraft silhouettes');
  const names=B.DEFS[st.boss].phaseNames;
  assert.equal(names.length,3);assert.equal(new Set(names).size,3);
  const signatures=[];
  for(const mode of ['easy','hard'])for(const ratio of [.9,.5,.2]) {
    const profile=D.get(mode),b=B.create(st.boss,index,profile),shots=[];
    b.x=240;b.y=b.entryY;b.state='fight';b.hp=b.maxHp*ratio;
    const api={W:480,H:720,bulletMul:st.bulletMul,attackRate:profile.attackRate,
      patternCount:n=>D.patternCount(n,mode),aimAngle:(x,y)=>Math.atan2(620-y,240-x),
      eShot:(x,y,vx,vy,style)=>{assert.ok(Number.isFinite(x+y+vx+vy));shots.push([x,y,vx,vy,style]);},
      spawnMini:()=>{},shake:()=>{},onBossPhase:()=>{}};
    for(let tick=0;tick<600;tick++)B.update(b,1/60,api);
    assert.ok(shots.length>0);
    if(mode==='hard')signatures.push(shots.slice(0,35).map(s=>s.slice(0,4).map(n=>Math.round(n)).join(',')).join(';'));
  }
  assert.equal(new Set(signatures).size,3,st.boss+' phase trajectories differ');
  inventory.push({stage:st.no,name:st.name,regular,midboss:S.MIDBOSS[index].art,boss:B.DEFS[st.boss].sprite,phases:Array.from(names)});
}
assert.ok(inventory[3].regular.includes('canopyGunship'));
assert.ok(inventory[4].regular.includes('calderaBomber'));
for(const [key,index,art] of [['carbon',3,'canopyGunship'],['obsidian',3,'canopyGunship'],['bomber',4,'calderaBomber']]){
  const old=S.ENEMY[key],regional=S.enemyForStage(key,index);
  assert.equal(regional.art,art);assert.equal(regional.hp,old.hp);assert.equal(regional.hit,old.hit);
}
// A phase transition cancels queued old attacks, reveals parts, and calls its cue exactly once.
for(const id of ['dune','caldera','nightark']){
  const b=B.create(id,0);b.x=240;b.y=b.entryY;b.state='fight';b.hp=b.maxHp*.5;
  if(id==='dune'){b.salvo=8;b.salvoCt=0;}
  if(id==='caldera')b.lockAng=.1;
  if(id==='nightark')b.launchCt=0;
  let cues=0,shots=0;
  const api={W:480,H:720,bulletMul:1,aimAngle:()=>Math.PI/2,eShot:()=>{shots++;},spawnMini:()=>{},shake:()=>{},onBossPhase:()=>{cues++;}};
  B.update(b,1/60,api);assert.equal(cues,1);assert.equal(shots,0);
  for(let i=0;i<20;i++)B.update(b,1/60,api);
  assert.equal(cues,1);assert.equal(shots,0,'new phase has a short pause');
  if(id==='dune')assert.equal(b.salvo,0);
  if(id==='caldera')assert.equal(b.lockAng,null);
  b.parts.filter(p=>p.key==='core'||p.key==='bridge').forEach(p=>assert.equal(p.hidden,false));
}
// A wall leaves its advertised gap in both modes, even when its shots are refused by a full pool.
for(const mode of ['easy','hard']){
  const b=B.create('breakwater',0,D.get(mode));b.x=240;b.y=170;b.phase=2;b.step=0;b.ct=0;
  const shots=[],api={W:480,H:720,bulletMul:1,patternCount:n=>D.patternCount(n,mode),aimAngle:()=>Math.PI/2,
    eShot:(x,y,vx,vy)=>{shots.push({x,y,vx,vy});return null;},spawnMini:()=>{}};
  b.def.fire(b,1/60,api);assert.ok(b.laneCue && shots.length);
  assert.ok(shots.every(s=>s.vx===0 && Math.abs(s.x-b.laneCue.x)>=b.laneCue.width/2));
  assert.ok(shots.some(s=>s.x<b.laneCue.x) && shots.some(s=>s.x>b.laneCue.x));
}
const output=path.resolve(root,'../output/striker-difficulty-qa');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'phase-inventory.json'),JSON.stringify(inventory,null,2));
console.log('PASS: aircraft silhouettes across 7 stages, 21 phase labels and differing trajectories, transition pause/cleanup, mode-scaled wall gaps and pool refusal');
