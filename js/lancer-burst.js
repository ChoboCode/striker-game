/* 랜서 필살기: 기수 응축 → 지속 에너지포 → 잔광. 게임 시간으로만 진행한다. */
const LancerBurst = (function () {
  'use strict';
  const CHARGE=.65, FIRE=1.6, FADE=.35, DURATION=CHARGE+FIRE+FADE;
  function create(w,h,p){return {kind:'lancer',w,h,x:p.x,y:p.y-34,t:0,pulse:0,fired:false};}
  function shape(r){
    const age=r.t-CHARGE,fade=Math.max(0,Math.min(1,(DURATION-r.t)/FADE));
    return {active:age>=0&&age<FIRE,length:Math.max(0,Math.min(r.y+70,age*2600)),
      radius:52*Math.min(1,Math.max(0,age)*10)*fade,alpha:fade};
  }
  function intersects(r,x,y,rx=0,ry=rx){
    const s=shape(r);return s.active && Math.abs(x-r.x)<=s.radius+rx && y+ry>=r.y-s.length && y-ry<=r.y;
  }
  function update(r,dt,p,onPulse,onFire){
    const before=r.t;r.t+=dt;r.x=p.x;r.y=p.y-34;
    if(!r.fired&&r.t>=CHARGE){r.fired=true;onFire();}
    r.pulse+=Math.max(0,Math.min(r.t,CHARGE+FIRE)-Math.max(before,CHARGE));
    while(r.pulse>=.1-1e-8){r.pulse-=.1;onPulse(Object.assign({},r,{t:Math.min(r.t,CHARGE+FIRE-1e-6)}),.1);}
    return r.t>=DURATION;
  }
  let beamFrames=null;
  function frames(){
    if(beamFrames)return beamFrames;
    const img=Assets.image('lancer-burst');if(!img)return null;
    beamFrames=Array.from({length:4},(_,i)=>{
      const c=Assets.makeCanvas(192,768),g=c.getContext('2d');
      g.drawImage(img,i*img.width/4,0,img.width/4,img.height,0,0,192,768);
      g.globalCompositeOperation='destination-in';
      const mask=g.createLinearGradient(0,0,192,0);
      mask.addColorStop(0,'transparent');mask.addColorStop(.12,'#fff');mask.addColorStop(.88,'#fff');mask.addColorStop(1,'transparent');
      g.fillStyle=mask;g.fillRect(0,0,192,768);
      const ends=g.createLinearGradient(0,0,0,768);
      ends.addColorStop(0,'transparent');ends.addColorStop(.025,'#fff');ends.addColorStop(.96,'#fff');ends.addColorStop(1,'transparent');
      g.fillStyle=ends;g.fillRect(0,0,192,768);
      function section(y,h,start=.12,end=.84){
        const out=Assets.makeCanvas(192,h),og=out.getContext('2d');og.drawImage(c,0,y,192,h,0,0,192,h);
        og.globalCompositeOperation='destination-in';const fade=og.createLinearGradient(0,0,0,h);
        fade.addColorStop(0,'transparent');fade.addColorStop(start,'#fff');fade.addColorStop(end,'#fff');fade.addColorStop(1,'transparent');
        og.fillStyle=fade;og.fillRect(0,0,192,h);return out;
      }
      return {body:section(92,524,.035,.96),tip:section(0,130),core:section(599,169)};
    });return beamFrames;
  }
  function core(ctx,img,x,y,size){
    ctx.drawImage(img.core,x-size/2,y-size*.34,size,size*169/192);
  }
  function draw(r,ctx){
    const sprites=frames();if(!sprites)return;
    const q=Math.min(1,r.t/CHARGE),s=shape(r),t=r.t;
    const phase=t*16,index=Math.floor(phase)%4,mix=phase-Math.floor(phase);
    ctx.save();
    if(t<CHARGE){
      for(let i=0;i<34;i++){
        const u=(t*1.8+i/34)%1,a=i*2.39996,d=(28+(i%6)*16)*(1-u*u);
        ctx.globalAlpha=Math.sin(u*Math.PI)*q;ctx.fillStyle=i%3?'#ffd778':'#ffffff';
        ctx.beginPath();ctx.arc(r.x+Math.cos(a)*d,r.y+Math.sin(a)*d*.8,2+i%3,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.globalCompositeOperation='lighter';
    for(let k=0;k<2;k++){
      const img=sprites[(index+k)%4];ctx.globalAlpha=(k?mix:1-mix)*(t<CHARGE?.4+q*.6:s.alpha);
      if(t<CHARGE){core(ctx,img,r.x,r.y,30+q*65);continue;}
      const length=s.length,width=156*Math.min(1,Math.max(.15,s.radius/52));
      const tipHeight=Math.min(90,length),bodyHeight=Math.max(0,length-tipHeight+60);
      // Registered image sections keep the muzzle round as the beam extends.
      if(bodyHeight>0)ctx.drawImage(img.body,r.x-width/2,r.y-length+tipHeight-44,width,bodyHeight);
      if(length>0)ctx.drawImage(img.tip,r.x-width/2,r.y-length-12,width,tipHeight);
      core(ctx,img,r.x,r.y,98*(.8+.2*s.alpha));
    }
    ctx.restore();
  }
  return {create,update,draw,intersects,shape,DURATION};
})();
