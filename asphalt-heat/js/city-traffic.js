// Lane paths span the approach, curved intersection movement and receiving lane.
const TURN_EXTENT=12.6;
function gradeConnection(node,dx,dz){
 for(const route of GRADE_ROADS.routes){
  const direction=route.axis==='ew'?dx:dz;
  if(!direction)continue;
  const [entry,exit]=direction>0?route.ends:[route.ends[1],route.ends[0]];
  if(node[0]===entry[0] && node[1]===entry[1])return {route,direction,exit};
 }
 return null;
}
function planMovement(ai,forcedExit,allowRamp=true){
 const {a,b}=ai,dx=b[0]-a[0],dz=b[1]-a[1],section=segmentSection(a,b);
 let lane=section.outer?ai.lane||0:0;
 const options=neighbors(b).filter(n=>n[0]!==a[0] || n[1]!==a[1]);
 const turnOf=n=>dx*(n[1]-b[1])-dz*(n[0]-b[0]);
 const legal=options.filter(n=>!section.outer || (lane?turnOf(n)>=0:turnOf(n)<=0));
 const straight=options.find(n=>n[0]-b[0]===dx && n[1]-b[1]===dz);
 const exit=forcedExit || (straight && Math.random()<.62?straight:pick(legal.length?legal:options));
 const ex=exit[0]-b[0],ez=exit[1]-b[1],turn=turnOf(exit),out=segmentSection(b,exit);
 if(section.outer && turn)lane=turn>0?1:0;
 const exitLane=out.outer?(turn?Number(turn>0):section.outer?lane:1):0;
 const connection=!turn && gradeConnection(b,dx,dz);
 const ramp=connection?.route && allowRamp && Math.random()<.55?connection:null;
 const u=ai.incomingOffset??laneCenter(section,dx,dz,lane);
 const v=ramp?ramp.route.width*.225:laneCenter(out,ex,ez,exitLane);
 const x=b[0]*CELL,z=b[1]*CELL;
 const start={x:x-dx*TURN_EXTENT-dz*u,z:z-dz*TURN_EXTENT+dx*u};
 const end={x:x+ex*TURN_EXTENT-ez*v,z:z+ez*TURN_EXTENT+ex*v};
 const control=turn ? {x:dx?end.x:start.x,z:dz?end.z:start.z} :
  {x:(start.x+end.x)/2,z:(start.z+end.z)/2};
 const points=[];
 for(let k=0;k<=12;k++){
  const t=k/12,r=1-t;
  const p={x:r*r*start.x+2*r*t*control.x+t*t*end.x,z:r*r*start.z+2*r*t*control.z+t*t*end.z};
  p.s=k?points[k-1].s+dist2(points[k-1],p):0;points.push(p);
 }
 const rule=junctionControl(...b);
 return {dx,dz,ex,ez,x,z,u,node:b,exit,exitLane,turn,section,points,rule,ramp,axis:dx?'ew':'ns',
  stop:stopLine(rule).outer,arrived:null,dwell:0,committed:false};
}
function pathProgress(m,pos){
 const before=(pos.x-m.x)*m.dx+(pos.z-m.z)*m.dz+TURN_EXTENT;
 if(before<0)return before;
 let nearest=Infinity,progress=0;
 for(let n=1;n<m.points.length;n++){
  const a=m.points[n-1],b=m.points[n],dx=b.x-a.x,dz=b.z-a.z;
  const t=clamp(((pos.x-a.x)*dx+(pos.z-a.z)*dz)/(dx*dx+dz*dz),0,1);
  const d=(pos.x-a.x-t*dx)**2+(pos.z-a.z-t*dz)**2;
  if(d<nearest){nearest=d;progress=lerp(a.s,b.s,t);}
 }
 return progress;
}
function pathTarget(m,s){
 const first=m.points[0],last=m.points[m.points.length-1];
 if(s<=0)return {x:first.x+m.dx*s,z:first.z+m.dz*s};
 if(s>=last.s)return {x:last.x+m.ex*(s-last.s),z:last.z+m.ez*(s-last.s)};
 const n=m.points.findIndex(p=>p.s>=s),a=m.points[n-1],b=m.points[n],t=(s-a.s)/(b.s-a.s);
 return {x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t)};
}
function conflictingPaths(a,b){
 if(a.dx===b.dx && a.dz===b.dz && Math.abs(a.u-b.u)<1)return false;
 return a.points.some(p=>b.points.some(q=>(p.x-q.x)**2+(p.z-q.z)**2<2.55**2));
}
function approachGap(c,m){
 return (m.x-c.pos.x)*m.dx+(m.z-c.pos.z)*m.dz-m.stop-c.spec.L*.5;
}
function crossingEdge(crossing){
 const {i,j,legX,legZ}=crossing;
 return HALF-(hasCurbExtension(i,j,-legX,-legZ)?EXTENSION_WIDTH:0);
}
function crossingOccupied(m){
 for(const p of peds){
  if(p.dead || p.mode!=='walk' || !p.cross || p.cross.waiting || p.pos.y>1)continue;
  const crossing=p.cross;
  if(crossing.i!==m.x/CELL || crossing.j!==m.z/CELL)continue;
  const across=crossing.axis==='ew'?p.pos.x-m.x:p.pos.z-m.z;
  if(Math.abs(across)>crossingEdge(crossing)+.30)continue;
  // A pedestrian may occupy the approach crosswalk or the crosswalk the car turns into.
  if(crossing.legX===-m.dx && crossing.legZ===-m.dz ||
     crossing.legX===m.ex && crossing.legZ===m.ez)return true;
 }
 return false;
}
// Build the order once for the arrivals at this stop. A four-way tie can otherwise
// leave every driver waiting for the one on their right indefinitely.
function hasStopPriority(c,m){
 const waiting=cars.filter(o=>{
  const n=o.ai?.movement;
  return o.driver && !o.dead && n && n.x===m.x && n.z===m.z && n.arrived!=null &&
   !n.committed && Math.abs(o.pos.y-c.pos.y)<1.6 && mustStop(n.rule,n.axis);
 }).sort((a,b)=>a.ai.movement.arrived-b.ai.movement.arrived);
 while(waiting.length>1){
  const firstTime=waiting[0].ai.movement.arrived;
  const tied=waiting.filter(o=>o.ai.movement.arrived-firstTime<=.18);
  const next=tied.find(a=>!tied.some(b=>{
   if(b===a)return false;
   const p=a.ai.movement,q=b.ai.movement;
   if(!conflictingPaths(p,q))return false;
   const fromRight=q.dx*p.dz-q.dz*p.dx>0;
   return fromRight || p.dx===-q.dx && p.dz===-q.dz && p.turn<0 && q.turn>=0;
  })) || tied[0];
  if(c===next)return true;
  if(conflictingPaths(m,next.ai.movement))return false;
  waiting.splice(waiting.indexOf(next),1);
 }
 return true;
}
function exitIsBlocked(c,m,o){
 if(Math.abs(o.speed)>=1)return false;
 const end=m.points[m.points.length-1],dx=o.pos.x-end.x,dz=o.pos.z-end.z;
 const forward=dx*m.ex+dz*m.ez,side=dx*m.ez-dz*m.ex;
 const aligned=Math.abs(Math.sin(o.h)*m.ex+Math.cos(o.h)*m.ez);
 const across=Math.abs(Math.sin(o.h)*m.ez-Math.cos(o.h)*m.ex);
 const halfLength=(aligned*o.spec.L+across*o.spec.W)*.5,halfWidth=(aligned*o.spec.W+across*o.spec.L)*.5;
 return forward+halfLength>0 && forward-halfLength<STREET_DESIGN.crossWidth/2+c.spec.L+1.3 &&
  Math.abs(side)<halfWidth+c.spec.W*.5+.12;
}
function approachingPriorityCar(c,m,o){
 if(!o.driver || o.dead || o.speed<=1)return false;
 const dx=Math.sin(o.h),dz=Math.cos(o.h),heading=dx*m.dx+dz*m.dz;
 const crossing=Math.abs(heading)<.42,opposing=heading<-.85;
 const onMainRoad=crossing && mustStop(m.rule,m.axis) && !mustStop(m.rule,m.dx?'ns':'ew');
 if(!(onMainRoad || opposing && m.turn<0 || o.siren))return false;
 if((m.x-o.pos.x)*dx+(m.z-o.pos.z)*dz<=0)return false;
 const halfLength=o.spec.L*.5,reach=o.speed*(m.turn<0?3.4:3)+halfLength;
 const sideClearance=(c.spec.W+o.spec.W)*.5+.15;
 return m.points.some(p=>{
  const x=p.x-o.pos.x,z=p.z-o.pos.z,along=x*dx+z*dz;
  return along>=-halfLength && along<reach && Math.abs(x*dz-z*dx)<sideClearance;
 });
}
function canEnter(c,m,gap,dt,emergency=false){
 if(m.committed)return true;
 const stop=mustStop(m.rule,m.axis);
 if(stop&&!emergency){
  if(gap<1.25 && Math.abs(c.speed)<.26){
   if(m.arrived===null)m.arrived=time;
   m.dwell+=dt;
  }else if(m.dwell<.85){m.arrived=null;m.dwell=0;}
  if(m.dwell<.85)return false;
  if(!hasStopPriority(c,m))return false;
 }
 if(m.rule==='signal'&&!emergency){
  const light=phaseForGroup(signalGroup(...m.node),time)[m.axis].vehicle;
  if(light==='R')return false;
  // Continue on amber only when the front bumper can no longer stop comfortably.
  if(light==='Y' && (c.speed<1 || gap>Math.max(0,c.speed)*.55+c.speed*c.speed/7.5))return false;
 }
 if(gap>14)return true;
 if(crossingOccupied(m))return false;
 if(emergency&&gap>3&&gap<c.speed**2/7+2)return false;
 for(const o of cars){
  if(o===c || Math.abs(o.pos.y-c.pos.y)>1.6 ||
    Math.abs(o.pos.x-m.x)>48 || Math.abs(o.pos.z-m.z)>48)continue;
  if(exitIsBlocked(c,m,o))return false;
  if(!o.driver || o.dead || o.driver==='player' || o.siren){
   if(approachingPriorityCar(c,m,o) || m.points.some(p=>bodyInsideCar(o,{x:p.x,z:p.z,y:c.pos.y},c.spec.W*.54)))return false;
   continue;
  }
  if(o.clearing && o.clearing.x===m.x && o.clearing.z===m.z && conflictingPaths(m,o.clearing))return false;
  const other=o.ai?.movement;
  if(!other || other.x!==m.x || other.z!==m.z || !conflictingPaths(m,other))continue;
  if(other.committed)return false;
  const otherStop=mustStop(other.rule,other.axis);
  const opposing=m.dx===-other.dx && m.dz===-other.dz;
  const permissiveLeft=m.turn<0 && opposing && other.turn>=0 && !otherStop;
  const otherGap=approachGap(o,other);
  if((stop && !otherStop || permissiveLeft) && o.speed>1 && otherGap<o.speed*(m.turn<0?3.4:3.0))return false;
  if(permissiveLeft && Math.abs(o.speed)<=1 && otherGap<2.1 && !crossingOccupied(other))return false;
 }
 if(gap<.48)m.committed=true;
 return true;
}
function obstacleSpeed(c,target){
 const fx=Math.sin(c.h),fz=Math.cos(c.h),range=8+Math.max(c.speed,4)*2.4;
 function limit(pos,width,front,leadSpeed){
  if(Math.abs(c.pos.y-pos.y)>1.5)return;
  const dx=pos.x-c.pos.x,dz=pos.z-c.pos.z,f=dx*fx+dz*fz;
  if(f<=0 || f>=range || Math.abs(dx*fz-dz*fx)>(c.spec.W+width)*.5+.23)return;
  const gap=f-c.spec.L*.5-front-1.25;
  target=Math.min(target,Math.max(0,Math.min(Math.sqrt(Math.max(0,leadSpeed**2+6*weather.trafficPace*gap)),leadSpeed+gap*weather.trafficPace/1.35)));
 }
 for(const o of cars){
  if(o===c)continue;
  const cos=Math.cos(o.h-c.h),sin=Math.abs(Math.sin(o.h-c.h));
  if(cos<-.75 && Math.abs((o.pos.x-c.pos.x)*fz-(o.pos.z-c.pos.z)*fx)>1)continue;
  limit(o.pos,o.spec.W*Math.abs(cos)+o.spec.L*sin,(o.spec.L*Math.abs(cos)+o.spec.W*sin)*.5,Math.max(0,o.speed*cos));
 }
 if(!player.car)limit(player.pos,.52,.3,0);
 for(const p of peds)if(!p.dead)limit(p.pos,.50,.25,0);
 return target;
}
function trafficDrive(c,target,aim,dt,origin=c.pos){
 const diff=wrapA(Math.atan2(aim.x-origin.x,aim.z-origin.z)-c.h);
 const dist=Math.max(1,dist2(aim,origin)),angle=Math.atan2(4*c.spec.wb*Math.sin(diff),dist);
 const limit=Math.min(.61,Math.atan(2*c.spec.wb*8.2/(c.speed*c.speed+7))+.024);
 const steer=clamp(angle/limit,-1,1),stopped=target<.55 && Math.abs(c.speed)<.82;
 c.hb=stopped;
 if(c.phys){
  const command=clamp((target-c.speed)*.54,-1,1);
  physCarControl(c,stopped || command<0 && c.speed<.75?0:command,steer,stopped);
 }else{
  c.braking=target<c.speed-.55 || stopped;
  kinematicDrive(c,target/c.spec.max,clamp(angle*2.1,-1,1),dt);
 }
 setCarLights(c,c.braking || stopped);
}
function responseExit(ai,response){
 const {a,b}=ai;
 if(response.approach&&b[0]===response.approach[0]&&b[1]===response.approach[1]&&
  (a[0]!==response.cross[0]||a[1]!==response.cross[1]))return response.cross;
 const [x,z]=response.approach||nearestNode(response.goal);
 const options=neighbors(b).filter(n=>n[0]!==a[0]||n[1]!==a[1]);
 return options.sort((p,q)=>Math.abs(p[0]-x)+Math.abs(p[1]-z)-Math.abs(q[0]-x)-Math.abs(q[1]-z))[0];
}
function resumeStreetLane(c){
 const [i,j]=nearestNode(c.pos),dx=Math.sin(c.h),dz=Math.cos(c.h);
 const ew=Math.abs(dx)>Math.abs(dz),dir=ew?Math.sign(dx):Math.sign(dz);
 const a=ew?[clamp(Math.floor(c.pos.x/CELL)+(dir<0?1:0),0,N),j]:
  [i,clamp(Math.floor(c.pos.z/CELL)+(dir<0?1:0),0,N)];
 const b=[a[0]+(ew?dir:0),a[1]+(ew?0:dir)];
 if(b.some(n=>n<0||n>N))return null;
 const offset=ew?(c.pos.z-j*CELL)*dir:-(c.pos.x-i*CELL)*dir;
 const section=segmentSection(a,b);
 return {a,b,lane:section.outer&&Math.abs(offset-section.outer)<Math.abs(offset-section.inner)?1:0,incomingOffset:clamp(offset,-HALF,HALF)};
}
function aiTraffic(c,dt,response=null){
 if(response&&!c.ai)c.ai=resumeStreetLane(c);
 if(!c.ai){
  const a=nearestNode(c.pos),fx=Math.sin(c.h),fz=Math.cos(c.h);
  const b=neighbors(a).sort((p,q)=>(q[0]-p[0])*fx+(q[1]-p[1])*fz)[0];
  c.ai={a,b};
 }
 if(c.ai.grade){followGradeRoad(c,dt);return;}
 const ai=c.ai,exit=response?responseExit(ai,response):null;
 const current=ai.movement;
 if(!current||exit&&!current.committed&&approachGap(c,current)>14&&(current.exit[0]!==exit[0]||current.exit[1]!==exit[1]))ai.movement=planMovement(ai,exit,!response);
 const m=ai.movement;
 if(c.clearing && (c.pos.x-c.clearing.x)*c.clearing.ex+(c.pos.z-c.clearing.z)*c.clearing.ez>
   STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+c.spec.L/2)c.clearing=null;
 const outDistance=(c.pos.x-m.x)*m.ex+(c.pos.z-m.z)*m.ez;
 if(m.committed && outDistance>=TURN_EXTENT-.3){
  c.clearing=m;c.ai={a:ai.b,b:m.exit,lane:m.exitLane};
  return aiTraffic(c,dt,response);
 }
 const gap=approachGap(c,m);
 // Guide the rear axle along the curve so the inside rear tyre of a long vehicle clears the curb.
 const rear={x:c.pos.x-c.spec.wb*Math.sin(c.h),z:c.pos.z-c.spec.wb*Math.cos(c.h)};
 const s=pathProgress(m,rear),look=m.turn && s> -12?clamp(2.9+Math.abs(c.speed)*.29,3.4,5.6):
  clamp(3.6+Math.abs(c.speed)*.53,3.8,9.6);
 let target=response?response.speed*weather.trafficPace:m.section.speed*weather.trafficPace*(c.driverPace??(c.driverPace=rnd(.89,1.05)));
 if(response){
  if(m.turn)target=Math.min(target,Math.sqrt(40+7*Math.max(0,gap)));
  else if(gap<10&&!m.committed)target=Math.min(target,10);
 }
 if(!response)target=closureApproachSpeed(c,m,target);
 if(m.turn && s> -14)target=Math.min(target,m.turn>0?4.2:5.0);
 const block=m.dx?Math.min(ai.a[0],ai.b[0]):Math.min(ai.a[1],ai.b[1]);
 const line=m.dx?ai.b[1]:ai.b[0],at=m.dx?c.pos.x:c.pos.z;
 if(hasSpeedHump(m.axis,line,block) && Math.abs(at-(block+.5)*CELL)<9)target=Math.min(target,5.0);
 const allowed=canEnter(c,m,gap,dt,!!response&&c.siren);
 if(!allowed){
  const available=Math.max(0,gap-.57);
  target=Math.min(target,Math.sqrt(5.6*weather.trafficPace*available),available*1.3);
 }
 if(m.ramp && m.committed && s>TURN_EXTENT-2){
  const next=m.ramp.route.sections.findIndex(section=>m.dx?section.b.x>c.pos.x:section.b.z>c.pos.z);
  ai.grade={...m.ramp,index:clamp(next-(m.ramp.direction<0?1:0),0,m.ramp.route.sections.length-1)};
  ai.movement=null;followGradeRoad(c,dt);return;
 }
 c.indicating=gap<18 || m.committed?m.turn:0;
 trafficDrive(c,obstacleSpeed(c,target),pathTarget(m,s+look),dt,rear);
 if(c.phys && c.upY<.4 && c.driver==='ai'){
  c.flipT=(c.flipT||0)+dt;
  if(c.flipT>3){const exit=carDoorSpot(c);if(exit){c.driver=null;ejectPed(exit.x,exit.z,c.pos.x,c.pos.z,exit.y);}}
 }else c.flipT=0;
}
function closureApproachSpeed(car,m,target){
 for(const unit of cars){
  const closure=unit.closure;
  if(!closure?.closed||unit===car||closure.axis!==m.axis||closure.line!==(m.axis==='ew'?m.node[1]:m.node[0]))continue;
  const gap=(closure.at-(m.axis==='ew'?car.pos.x:car.pos.z))*(m.dx||m.dz);
  if(gap>0&&gap<CELL)target=Math.min(target,Math.max(0,(gap-7)*.65));
 }
 return target;
}
function pedestrianCanStart(p,crossing){
 const {i,j,axis,legX,legZ}=crossing,control=junctionControl(i,j);
 if(control==='signal' && phaseForGroup(signalGroup(i,j),time)[axis].ped!=='walk')return false;
 // At unsigned crossings wait for a gap; at all crossings avoid a vehicle already on the stripes.
 const x=i*CELL+legX*STREET_DESIGN.crossing,z=j*CELL+legZ*STREET_DESIGN.crossing;
 for(const c of cars){
  if(c.pos.y>1.5)continue;
  const movement=c.ai?.movement?.committed?c.ai.movement:c.clearing;
  if(movement && movement.x===i*CELL && movement.z===j*CELL &&
    movement.ex===legX && movement.ez===legZ &&
    (c.pos.x-x)*legX+(c.pos.z-z)*legZ<c.spec.L/2+.5)return false;
  const dx=c.pos.x-x,dz=c.pos.z-z,forward=dx*legX+dz*legZ,side=dx*legZ-dz*legX;
  if(Math.abs(side)>HALF+.15 || Math.abs(forward)>30)continue;
  if(Math.abs(forward)<c.spec.L/2+.55)return false;
  const speedToward=-(Math.sin(c.h)*legX+Math.cos(c.h)*legZ)*c.speed*Math.sign(forward);
  if(speedToward>1 && (Math.abs(forward)-c.spec.L*.5)/speedToward<3.2)return false;
 }
 return true;
}
function crossingRoute(i,j,legX,legZ,dx,dz,far){
 const route={i,j,legX,legZ,dx,dz,axis:dx?'ew':'ns',waiting:true};
 // Opposing walkers keep right, within the two-metre clear width of each ramp.
 const x=i*CELL+legX*STREET_DESIGN.crossing-dz*.47,z=j*CELL+legZ*STREET_DESIGN.crossing+dx*.47;
 const landing=crossingEdge(route)+.47;
 route.waitX=x-dx*landing;route.waitZ=z-dz*landing;
 route.x=dx?(dx>0?far.x0:far.x1):x;route.z=dz?(dz>0?far.z0:far.z1):z;
 return route;
}
function advanceCrossing(p,dt){
 const route=p.cross;
 const waitX=route.waitX??p.pos.x,waitZ=route.waitZ??p.pos.z;
 if(route.waiting && Math.hypot(waitX-p.pos.x,waitZ-p.pos.z)<.085 && pedestrianCanStart(p,route))route.waiting=false;
 const x=(route.waiting?waitX:route.x)-p.pos.x,z=(route.waiting?waitZ:route.z)-p.pos.z,d=Math.hypot(x,z);
 if(d<.02){if(!route.waiting)attachPed(p);return;}
 let stride=Math.min(d,p.spd*dt);
 for(const peer of peds){
  const other=peer.cross;
  if(peer===p || peer.dead || !other || other.dx!==route.dx || other.dz!==route.dz ||
   other.i!==route.i || other.j!==route.j || other.legX!==route.legX || other.legZ!==route.legZ)continue;
  const px=peer.pos.x-p.pos.x,pz=peer.pos.z-p.pos.z;
  const gap=(px*x+pz*z)/d;
  if(gap>0 && Math.abs(px*z-pz*x)/d<.63)stride=Math.min(stride,Math.max(0,gap-.75));
 }
 p.pos.x+=x/d*stride;p.pos.z+=z/d*stride;
}
function tryCrosswalk(p){
 if(p.cross)return;
 if(time<p.crossAfter)return;
 const {x,z}=p.pos,R=p.R,i=Math.floor(x/CELL),j=Math.floor(z/CELL);
 const sx=x<(R.x0+R.x1)/2?-1:1,sz=z<(R.z0+R.z1)/2?-1:1;
 const ni=i+Number(sx>0),nj=j+Number(sz>0),ox=x-ni*CELL,oz=z-nj*CELL;
 const acrossX=Math.abs(Math.abs(oz)-STREET_DESIGN.crossing)<.42 && Math.abs(ox)<HALF+2.45;
 const acrossZ=Math.abs(Math.abs(ox)-STREET_DESIGN.crossing)<.42 && Math.abs(oz)<HALF+2.45;
 if(!acrossX && !acrossZ)return;
 p.crossAfter=time+6;
 const a=i+(acrossX?sx:0),b=j+(acrossX?0:sz);
 if(a<0 || b<0 || a>=N || b>=N || Math.random()>.46)return;
 const far=perim(blocks[a*N+b]);
 p.cross=crossingRoute(ni,nj,acrossX?0:-sx,acrossX?-sz:0,acrossX?sx:0,acrossX?0:sz,far);
}
function trafficEntrySpeed(c){
 const m=c.ai.movement=planMovement(c.ai),speed=m.section.speed*.8;
 const signal=m.rule==='signal' && phaseForGroup(signalGroup(...m.node),time)[m.axis].vehicle!=='G';
 if(signal || mustStop(m.rule,m.axis)){
  const room=Math.max(0,approachGap(c,m)-.65);
  return obstacleSpeed(c,Math.min(speed,Math.sqrt(4.6*room),room*1.1));
 }
 return obstacleSpeed(c,speed);
}
function parkServiceVehicles(place,type,count){
 const block=blocks[cellKey(place.door.x,place.door.z)];
 const choices=[];
 for(const [axis,line,part,dx,dz] of [['ns',block.i,block.j,0,-1],['ns',block.i+1,block.j,0,1],
  ['ew',block.j,block.i,1,0],['ew',block.j+1,block.i,-1,0]]){
  const offset=parkingCenter(streetSection(axis,line,part),dz);
  if(offset==null)continue;
  for(const along of [25,32,39]){
   const x=(dx?part*CELL+along:line*CELL)-dz*offset,z=(dz?part*CELL+along:line*CELL)+dx*offset;
   if(!nearDriveway(x,z,3))choices.push({x,z,h:Math.atan2(dx,dz)});
  }
 }
 choices.sort((a,b)=>dist2(a,place.door)-dist2(b,place.door));
 const headings=new Set();
 while(count>0&&choices.length){
  const preferred=type==='police'?choices.findIndex(p=>!headings.has(p.h)):-1;
  const [p]=choices.splice(Math.max(0,preferred),1);
  if(cars.some(c=>dist2(c.pos,p)<6.4))continue;
  const car=spawnCar(type,p.x,p.z,p.h,null);car.keep=true;
  if(type==='police'){car.stationFleet=place;headings.add(p.h);}
  count--;
 }
}
