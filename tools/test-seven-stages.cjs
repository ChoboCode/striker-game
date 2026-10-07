const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const stagesSource = fs.readFileSync(path.join(root, 'js/stages.js'), 'utf8');
const assetsSource = fs.readFileSync(path.join(root, 'js/assets.js'), 'utf8');
const audioSource = fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8');
const scope = {};
vm.createContext(scope);
vm.runInContext(stagesSource + ';this.S=Stages;', scope);
const S = scope.S;

assert.equal(S.STAGES.length, 7, 'campaign has seven stages');
assert.deepEqual(Array.from(S.STAGES, st => st.no), [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(Array.from(S.STAGES, st => st.boss), ['breakwater', 'dune', 'gemini', 'canopy', 'caldera', 'nightark', 'regent']);
assert.deepEqual(Array.from(S.MIDBOSS, b => b.art), ['medium', 'medium', 's3midboss', 'canopyMidboss', 'calderaMidboss', 'stage4Vtol', 's5midboss']);

const multipliers = [[1,1,1], [1.22,1.18,1.06], [1.46,1.38,1.14], [1.58,1.46,1.18], [1.68,1.54,1.22], [1.78,1.62,1.26], [2.1,1.9,1.38]];
for (const [i, st] of S.STAGES.entries()) {
  assert.deepEqual([st.enemyHpMul, st.groundHpMul, st.bulletMul], multipliers[i], 'difficulty stage ' + st.no);
  assert.equal(st.aircraftAfter, Math.round(st.aircraftBefore * 1.5), '1.5x formation total stage ' + st.no);
  const colored = st.script.filter(e => e.kind === 'formation' && ['crimson','scarlet','carbon','obsidian'].includes(e.type));
  assert.ok(colored.length >= 2, 'two colored waves stage ' + st.no);
  for (const ev of st.script.filter(e => e.kind === 'formation')) assert.ok(S.ENEMY[ev.type], 'known enemy ' + ev.type);
}
assert.equal(S.STAGES[5].bg, 4); assert.equal(S.STAGES[6].bg, 5);
assert.equal(S.enemyForStage('medium', 5).art, 'stage4Vtol', 'Night Ark behavior follows boss identity after move');
assert.equal(S.enemyForStage('crimson', 3).art, 'canopyFighter');
assert.equal(S.enemyForStage('scarlet', 4).art, 'calderaFighter');
assert.equal(S.groundForStage('aa', 5).art, 'stage4Artillery');

for (const token of ['canopy-fighter-v1.png','canopy-midboss-v1.png','canopy-boss-v1.png','caldera-fighter-v1.png','caldera-midboss-v1.png','caldera-boss-v1.png','canopy-bg-v1.jpg','caldera-bg-v1.jpg','canopyFighter','canopyMidboss','bossCanopy','calderaFighter','calderaMidboss','bossCaldera']) assert.ok(assetsSource.includes(token), 'asset reference '+token);
assert.ok(/stage3bgm\.mp3'[\s\S]*stage45bgm\.mp3'[\s\S]*stage45bgm\.mp3'[\s\S]*stage45bgm\.mp3'/.test(audioSource), 'explicit seven-stage BGM reuse');

const bossScope = { BossArt: {}, Assets: { body: (_kind, _pose, width) => ({ h: width * .72 }) } };
vm.createContext(bossScope);
vm.runInContext(fs.readFileSync(path.join(root, 'js/bosses.js'), 'utf8') + ';this.B=Bosses;', bossScope);
const B = bossScope.B;
function api(shots) { return { W:480, H:720, bulletMul:1, aimAngle:()=>Math.PI/2, eShot:(x,y,vx,vy)=>{ assert.ok(Number.isFinite(x+y+vx+vy)); shots.push([x,y,vx,vy]); } }; }
for (const id of ['canopy','caldera']) {
  const b = B.create(id, id === 'canopy' ? 3 : 4);
  assert.ok(b.def.projectParts && b.parts.length === 3, id+' has destructible wing guns and core');
  b.state='fight'; b.x=240; b.y=b.entryY;
  let lastX=b.x;
  for (const ratio of [.9,.5,.2]) {
    b.hp=b.maxHp*ratio; b.ct=0;
    const shots=[];
    for (let tick=0; tick<90 && !shots.length; tick++) {
      B.update(b, 1/60, api(shots));
      assert.ok(Math.abs(b.x-lastX) < 24 && Number.isFinite(b.x+b.y), id+' movement is smooth');
      assert.ok(b.x-b.w/2>=11 && b.x+b.w/2<=469, id+' wings stay on screen');
      lastX=b.x;
    }
    assert.ok(shots.length, id+' phase '+b.phase+' fires');
  }
  b.parts.forEach(p => { p.hidden=false; p.alive=false; }); b.hp=b.maxHp*.2; b.ct=0; b.step=0; b.lockAng=null;
  const wreckShots=[]; B.update(b, .5, api(wreckShots));
  assert.ok(wreckShots.length, id+' wreck overlay state still attacks');
}
const split = B.create('canopy',3);split.x=240;split.y=184;split.phase=2;split.step=1;split.ct=0;
const splitShots=[];split.def.fire(split,1/60,api(splitShots));
assert.ok(splitShots.filter(s=>s[0]<240).every(s=>s[2]<0),'left fan heads outward');
assert.ok(splitShots.filter(s=>s[0]>240).every(s=>s[2]>0),'right fan heads outward');
const lock = B.create('caldera',4);lock.x=240;lock.y=188;lock.phase=2;lock.step=1;lock.ct=0;lock.state='fight';
const lockShots=[];lock.def.fire(lock,1/60,api(lockShots));
assert.equal(lockShots.length,0,'locked salvo first gives warning');
assert.equal(lock.lockAng,Math.PI/2);
let lines=0;
lock.def.fx(lock,{save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){lines++;},stroke(){}});
assert.equal(lines,2,'both live guns display aim warnings');
const changedAim=api(lockShots);changedAim.aimAngle=()=>0;
lock.def.fire(lock,.49,changedAim);
assert.ok(lockShots.length>0 && lockShots.every(s=>s[3]>Math.abs(s[2])),'salvo keeps original downward aim');
console.log('PASS: seven-stage mapping, difficulty, asset references, wave keys, new boss phases/parts, visible warning, safe split and bounds');
