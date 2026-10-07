const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const scope={};vm.createContext(scope);
for(const file of ['stages','enemy-patterns'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),scope);
const {S,E}=vm.runInContext('({S:Stages,E:EnemyPatterns})',scope);
for(const key of ['crimson','scarlet','carbon','obsidian']){
 const d=S.ENEMY[key],e={...d,x:130,x0:130,y:-60,age:0,dir:1,bank:0,hoverT:0,targetY:145};
 let left=false,right=false;
 for(let i=0;i<1500&&e.y<810;i++){e.age+=1/60;assert.equal(E.move(e,1/60,480),true);assert.ok(Number.isFinite(e.x+e.y+e.bank));assert.ok(e.x>=0&&e.x<=480);left ||= e.bank<-.35;right ||= e.bank>.35;}
 assert.ok(e.y>=810,key+' exits battlefield');
 if(d.move!=='crossDive')assert.ok(left&&right,key+' banks both ways');
}
for(const [fire,count] of [['wingPair',2],['splitFan',6]]){
 const e={fire,x:240,y:120,w:80},shots=[];E.fire(e,Math.PI/2,135,(...b)=>shots.push(b));assert.equal(shots.length,count);assert.ok(shots.every(b=>b[3]>0));
 if(fire==='splitFan')assert.ok(shots.every(b=>Math.abs(b[2]/b[3])>.2),'fan leaves center gap');
}
const lock={fire:'lockBurst',x:240,y:150,w:60,lockAng:1.2},bullets=[];
for(let i=0;i<3;i++)E.fire(lock,2+i*.2,135,(...b)=>bullets.push(b));
assert.equal(bullets.length,3);assert.ok(bullets.every(b=>Math.abs(Math.atan2(b[3],b[2])-1.2)<1e-10));assert.equal(lock.lockAng,null);assert.equal(lock.volleyLeft,0);assert.ok(lock.fireCt>2);
for(const st of S.STAGES){const waves=st.script.filter(e=>['crimson','scarlet','carbon','obsidian'].includes(e.type));assert.ok(waves.length>=2);for(const wave of waves){assert.equal(wave.move,S.ENEMY[wave.type].move);assert.equal(wave.fire,S.ENEMY[wave.type].fire);}assert.ok(st.script.every((e,i,a)=>!i||a[i-1].at<=e.at));console.log('stage '+st.no+': '+waves.map(w=>w.type+'@'+w.at).join(', '));}
console.log('PASS: exits, finite movement, both bank poses, shot counts, safe fan gap, locked burst direction, 7-stage integration');
for(const st of S.STAGES){assert.equal(st.aircraftAfter,Math.round(st.aircraftBefore*1.5));console.log('Aircraft stage '+st.no+': '+st.aircraftBefore+' -> '+st.aircraftAfter);}
for(let n=8;n<=20;n++){
 const positions=Array.from({length:n},(_,i)=>S.slotOffset('line',i,n));
 assert.equal(new Set(positions.map(p=>p.x+','+p.y)).size,n,'expanded formation slots are unique');
 assert.ok(positions.every(p=>Math.abs(p.x)<=138),'wide formations wrap into rows');
}
