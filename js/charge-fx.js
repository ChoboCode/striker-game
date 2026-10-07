/* 둥근 에너지 입자 → 기수의 응축구 → 고속 관통탄. */
const ChargeFX = (function () {
  'use strict';
  const TAU=Math.PI*2;
  const palettes={blue:{edge:'#48caff',core:'#f1fdff',halo:'rgba(40,163,255,.45)'},gold:{edge:'#ffbb49',core:'#fff8dc',halo:'rgba(255,153,32,.45)'}};
  function halo(ctx,x,y,r,alpha,c,sx=1,sy=1){
    const img=Assets.glow(r,c.core,c.halo);
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.scale(sx,sy);ctx.drawImage(img,-img.width/2,-img.height/2);ctx.restore();
  }
  function orb(ctx,x,y,r,alpha,c){
    // 원형 외곽과 작은 밝은 중심을 함께 그린다.
    ctx.save();ctx.globalAlpha*=alpha;
    halo(ctx,x,y,Math.ceil(r*3),.32,c);
    ctx.fillStyle=c.edge;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.fillStyle=c.core;ctx.beginPath();ctx.arc(x-r*.14,y-r*.18,r*.62,0,TAU);ctx.fill();
    ctx.restore();
  }
  function gather(ctx,p,quality,palette='blue'){
    const q=Math.max(0,Math.min(1,p.charge)),t=p.chargeClock||0,c=palettes[palette]||palettes.blue;
    if(q<.01 && !(p.chargeRelease>0))return;
    const nx=p.x,ny=p.y-34;
    ctx.save();
    if(q>.01){
      const count=quality>.6?24:14;
      for(let i=0;i<count;i++){
        // 고정된 방향에서 태어나 안쪽으로 가속하며 흡수된다.
        const age=t*(.72+(i%4)*.08)+i*.6180339;
        const u=age-Math.floor(age),a=i*2.399963+Math.floor(age)*.71;
        const radius=(40+(i%5)*7)*(1-u*u);
        const x=nx+Math.cos(a)*radius,y=ny+Math.sin(a)*radius*.8+18*(1-u);
        const fade=Math.min(1,u*7)*Math.min(1,(1-u)*9)*Math.min(1,q*5);
        orb(ctx,x,y,(1.7+(i%3)*.65)*(1-u*.3),fade*.92,c);
      }
      const r=2+q*7,pulse=q>=1?1+Math.sin(t*12)*.06:1;
      halo(ctx,nx,ny,Math.round(10+q*14),.25+q*.3,c);
      orb(ctx,nx,ny,r*pulse,.45+q*.5,c);
      if(q>=1){
        ctx.strokeStyle=c.edge;ctx.globalAlpha=.45;ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(nx,ny,r+4+Math.sin(t*8),0,TAU);ctx.stroke();
      }
    }
    if(p.chargeRelease>0){
      const u=1-Math.min(1,p.chargeRelease/.28);
      ctx.globalAlpha=1;
      halo(ctx,nx,ny,22,(1-u)*.75,c,1,.75);
      ctx.strokeStyle=c.edge;ctx.lineWidth=2*(1-u)+.5;ctx.globalAlpha=(1-u)*.65;
      ctx.beginPath();ctx.ellipse(nx,ny,6+u*25,3+u*12,0,0,TAU);ctx.stroke();
    }
    ctx.restore();
  }
  let plasmaFrames=null;
  function frames(){
    if(plasmaFrames)return plasmaFrames;
    const img=Assets.image('charge-plasma');if(!img)return null;
    plasmaFrames=Array.from({length:8},(_,i)=>{
      const c=Assets.makeCanvas(96,128),g=c.getContext('2d');
      g.drawImage(img,(i%4)*img.width/4,Math.floor(i/4)*img.height/2,img.width/4,img.height/2,0,0,96,128);
      // 시트 셀의 미세한 잔광이 사각 경계로 보이지 않도록 바깥쪽만 감쇠한다.
      g.globalCompositeOperation='destination-in';
      const x=g.createLinearGradient(0,0,96,0);
      x.addColorStop(0,'transparent');x.addColorStop(.22,'#fff');x.addColorStop(.78,'#fff');x.addColorStop(1,'transparent');
      g.fillStyle=x;g.fillRect(0,0,96,128);
      const y=g.createLinearGradient(0,0,0,128);
      y.addColorStop(0,'transparent');y.addColorStop(.12,'#fff');y.addColorStop(.8,'#fff');y.addColorStop(1,'transparent');
      g.fillStyle=y;g.fillRect(0,0,96,128);return c;
    });
    return plasmaFrames;
  }
  function shot(ctx,b){
    const sprites=frames();if(!sprites)return;
    const phase=Math.max(0,b.t)*18,i=Math.floor(phase)%4,mix=phase-Math.floor(phase),row=b.palette==='gold'?4:0;
    // 원화의 밝은 탄두 중심을 실제 충돌 좌표에 맞춘다.
    const grow=.78+.22*Math.min(1,Math.max(0,b.t)/.07);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx)+Math.PI/2);ctx.scale(grow,grow);
    ctx.globalCompositeOperation='lighter';const alpha=ctx.globalAlpha;
    ctx.globalAlpha=alpha*(1-mix);ctx.drawImage(sprites[row+i],-48,-40);
    ctx.globalAlpha=alpha*mix;ctx.drawImage(sprites[row+(i+1)%4],-48,-40);
    ctx.restore();
  }
  return {gather:gather,shot:shot};
})();
