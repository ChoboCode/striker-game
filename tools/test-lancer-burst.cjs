const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/lancer-burst.js'),'utf8')+';this.B=LancerBurst;',c);
for(const dt of [1/60,1/30,.05]){
 const p={x:240,y:600},r=c.B.create(480,720,p);let damageTime=0,fired=0;
 assert(!c.B.intersects(r,240,100,10));
 for(let i=0;i<300;i++)if(c.B.update(r,dt,p,(run,t)=>{damageTime+=t;assert(c.B.intersects(run,240,run.y-30,10));assert(!c.B.intersects(run,30,100,5));assert(!c.B.intersects(run,240,650,5));},()=>fired++))break;
 assert.equal(fired,1);assert(Math.abs(damageTime-1.6)<1e-6);assert(!c.B.intersects(r,240,100,10));
}
console.log('PASS: beam phases, forward-only bounds, frame-independent damage duration, single release');
