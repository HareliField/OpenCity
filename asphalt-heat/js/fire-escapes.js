/* Steel exterior stairs on old-town buildings. The same deck elevations carry feet and rigid bodies. */
function fireEscapeSite(block,s){
 const overlaps=(a,b)=>a&&b&&a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;
 for(const side of streetSides(block,s)){
  const along=side==='N'||side==='S',a=along?s.x0:s.z0,b=along?s.x1:s.z1;
  const count=Math.max(1,Math.round((b-a)/s.levels[1].tier.bay)),bay=(b-a)/count;
  const center=(a+b)/2,cross=side==='N'?s.z0:side==='S'?s.z1:side==='W'?s.x0:s.x1;
  const away=side==='S'||side==='E'?1:-1;
  for(let i=0;i<count;i++){
   const landing=a+(i+.5)*bay,dir=Math.sign(landing-center),end=landing+dir*4.38;
   if(Math.abs(landing-center)<2.29||end<a+.26||end>b-.26||bay-.92<1.33)continue;
   const approach=wallRect(s,side,landing-.72,landing+.72,.19,1.28);
   if(s.core&&overlaps(s.core.approach,approach))continue;
   const clear=s.levels.slice(1).every(l=>{
    if((l.fittings||[]).some(f=>overlaps(f,approach)))return false;
    return (l.rooms||[]).every(r=>{
     const c=s.core;
     if(overlaps(orientedRect(c.alongX,r.partition-.07,r.partition+.07,r.v0,r.v1),approach))return false;
     if(!r.bath)return true;
     const {u,end,direction,depth}=r.bath;
     return !overlaps(orientedRect(c.alongX,Math.min(u,r.partition),Math.max(u,r.partition),
      Math.min(end,end+direction*depth),Math.max(end,end+direction*depth)),approach);
    });
   });
   if(clear)return {side,bay:i,along,cross,away,landing,dir,run:2.87};
  }
 }return null;
}
function installFireEscapes(block){
 for(const s of block.structures||[]){
  if(!s.escapeCandidate||s.levels.length<2)continue;
  const plan=fireEscapeSite(block,s);if(plan)buildFireEscape(block,s,plan);
 }
}
function fireEscapeGroundAt(block,x,z,reference,y){
 const limit=(reference??y)+.38;
 for(const tread of block.escapeFloors)
  if(tread.y<=limit&&tread.y>=y&&withinRect(tread,x,z))y=tread.y;
 return y;
}
function buildFireEscape(block,s,plan){
 const {side,along,cross,away,landing,dir,run}=plan;
 const map=(u,v)=>along?{x:landing+dir*v,z:cross+away*u}:{x:cross+away*u,z:landing+dir*v};
 const R=(u0,u1,v0,v1)=>{const a=map(u0,v0),b=map(u1,v1);return {x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)};};
 const visible=block.escapeParts||(block.escapeParts=[]),floors=block.escapeFloors||(block.escapeFloors=[]);
 const paint=MAT.darkMetal,steel=MAT.metal;
 const draw=(r,lo,hi,mat,far=false,beam=null)=>{
  const p=partBox(r,lo,hi,'trim',mat);if(beam)p.beam=beam;visible.push(p);
  if(far)collectBuildingProxy(block,mat,unitBox.clone().applyMatrix4(partMatrix(p)));
 };
 const solid=(r,lo,hi)=>block.bld.push({...r,y0:lo,h:hi});
 function deck(u0,u1,v0,v1,top,spacing){
  const r=R(u0,u1,v0,v1);floors.push({...r,y:top});
  block.bld.push({...r,y0:top-.059,h:top,walkIgnore:true});
  const n=Math.max(2,Math.ceil((v1-v0)/spacing)),d=(v1-v0)/n;
  for(let i=0;i<n;i++)draw(R(u0,u1,v0+i*d+.008,v0+(i+1)*d-.008),top-.035,top,steel);
  for(const u of [u0+.025,u1-.025])draw(R(u-.021,u+.021,v0,v1),top-.077,top-.021,paint,v1-v0>.55);
 }
 function slopingRail(u,v0,v1,lo,hi){
  const c=(v0+v1)/2,h=(lo+hi)/2,length=Math.hypot(v1-v0,hi-lo);
  draw(R(u-.03,u+.03,c-.03,c+.03),h-.031,h+.031,paint,true,
   {axis:along?'x':'z',length,slope:Math.atan((hi-lo)/(dir*(v1-v0)))});
 }
 function endRail(u0,u1,v,base){
  const fence=R(u0,u1,v-.026,v+.026);solid(fence,base,base+1.02);
  draw(fence,base+.97,base+1.024,paint,true);draw(fence,base+.49,base+.518,paint);
  for(const u of [u0+.035,(u0+u1)/2,u1-.035])draw(R(u-.024,u+.024,v-.025,v+.025),base,base+.98,paint);
 }
 const start=.72,turn=start+run;
 for(const [index,l] of s.levels.entries()){
  const y=l.y0;deck(.008,2.24,-.79,start,y,.104);
  if(index){
   const at=map(0,0),M=new THREE.Matrix4().makeRotationY(SIDEANG[side]);M.setPosition(at.x,0,at.z);
   const d=registerDoor(M,0,.025,y,1.13,2.102,'egress');d.opensOut=true;d.suiteBlock=block;
   l.fireDoor={side,bay:plan.bay,center:landing,door:d};endRail(.04,2.22,-.754,y);
  }
  const outside=R(2.193,2.245,-.76,start);solid(outside,y,y+1.025);
  draw(outside,y+.973,y+1.025,paint,true);
  for(const v of [-.71,start-.045])draw(R(2.194,2.238,v-.023,v+.023),y,y+1,paint);
  if(index===s.levels.length-1)break;
  const mid=(y+l.h)/2;deck(.04,2.24,turn,turn+.79,mid,.102);endRail(.04,2.22,turn+.762,mid);
  for(const up of [false,true]){
   const u0=up?1.17:.045,u1=up?2.24:1.115,lower=up?mid:y,upper=up?l.h:mid;
   const n=Math.ceil((upper-lower)/.18),at=k=>up?turn-run*k/n:start+run*k/n;
   for(let k=0;k<n;k++){
    const v=at(k),w=at(k+1),a=Math.min(v,w),b=Math.max(v,w),top=lerp(lower,upper,(k+1)/n);
    deck(u0,u1,a,b,top,.084);
    for(const u of [u0+.026,u1-.026]){
     solid(R(u-.024,u+.024,a,b),top-.11,top+.96);
     if(k%3===0||k===n-1)draw(R(u-.020,u+.020,(v+w)/2-.020,(v+w)/2+.020),top,top+.94,paint);
    }
   }
   for(const u of [u0+.026,u1-.026]){
    slopingRail(u,at(0),at(n),lower+.95,upper+.95);slopingRail(u,at(0),at(n),lower-.10,upper-.10);
   }
  }
 }
 (block.fireEscapes||(block.fireEscapes=[])).push(plan);
}
