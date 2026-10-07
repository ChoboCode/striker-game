const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const scope={};vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/bomb-run.js'),'utf8')+';this.B=BombRun;',scope);
const B=scope.B,run=B.create(480,720),hits=[];
B.update(run,.3, (...hit)=>hits.push(hit));assert.equal(hits.length,0,'no damage before landing');
for(let i=0;i<250;i++) B.update(run,1/60,(...hit)=>hits.push(hit));
assert.equal(hits.length,25,'all missiles land exactly once');
B.update(run,20,(...hit)=>hits.push(hit));assert.equal(hits.length,25,'completed missiles never re-hit');
for(let y=0;y<=720;y+=20)for(let x=0;x<=480;x+=20) {
 assert.ok(hits.some(([hx,hy,r])=>Math.hypot(hx-x,hy-y)<=r),'uncovered battlefield point '+x+','+y);
}
for(const m of run.missiles) {
 assert.ok(m.launch+m.flight+B.BLAST_TIME<=B.DURATION,'last explosion must finish before cleanup');
 let y=m.sy;
 assert.ok(m.sy>720 && m.y<m.sy,'missile starts below the field and targets upward');
 for(let i=0;i<=10;i++){const p=B.missileAt(m,i/10);assert.equal(p.x,m.x,'missile must rise vertically');assert.ok(p.y<=y,'never descend or curve back');y=p.y;}
 assert.equal(B.missileAt(m,1).y,m.y,'nose reaches explosion center');
}
assert.equal(B.PLANE_WIDTH,520,'support plane is twice the original width');
assert.ok(B.FLYBY<.8,'support plane exits in under 0.8 seconds');
assert.ok(B.planeAt(run,0).y>720 && B.planeAt(run,B.FLYBY).y<0);
const jump=B.create(480,720);let n=0;assert.ok(B.update(jump,10,()=>n++));assert.equal(n,25,'large time step does not skip impacts');
console.log('PASS: 25 delayed one-shot impacts, full-field coverage including corners, effect cleanup, large-step timing');
