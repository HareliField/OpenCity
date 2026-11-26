// Lane paths span the approach, curved intersection movement and receiving lane.
const TURN_EXTENT=12.6;
function gradeConnection(node,dx,dz){
 if(dz && ((node[0]===13 && node[1]===9 && dz===1) || (node[0]===14 && node[1]===12 && dz===-1))){
  return {route:GRADE_ROADS.routes[1],direction:dz,exit:dz>0?[14,12]:[13,9]};
 }
 if(dx && node[1]===11 && ((dx===1 && node[0]===6) || (dx===-1 && node[0]===14))){
  return {route:GRADE_ROADS.routes[0],direction:dx,exit:[dx>0?14:6,11]};
 }
 return null;
}
function planMovement(ai,forcedExit){
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
 const ramp=connection?.route && Math.random()<.55?connection:null;
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
function crossingOccupied(m){
 for(const p of peds){
  if(p.dead || p.mode!=='walk' || !p.cross || p.cross.waiting || p.pos.y>1)continue;
  const crossing=p.cross;
  if(crossing.i!==m.x/CELL || crossing.j!==m.z/CELL)continue;
  // A pedestrian may occupy the approach crosswalk or the crosswalk the car turns into.
  if(crossing.legX===-m.dx && crossing.legZ===-m.dz ||
     crossing.legX===m.ex && crossing.legZ===m.ez)return true;
 }
 return false;
}
function canEnter(c,m,gap,dt){
 if(m.committed)return true;
 const stop=mustStop(m.rule,m.axis);
 if(stop){
  if(gap<1.25 && Math.abs(c.speed)<.26){
   if(m.arrived===null)m.arrived=time;
   m.dwell+=dt;
  }
  if(m.dwell<.85)return false;
 }
 if(m.rule==='signal'){
  const light=phaseForGroup(signalGroup(...m.node),time)[m.axis].vehicle;
  if(light==='R')return false;
  // Continue on amber only when the front bumper can no longer stop comfortably.
  if(light==='Y' && (c.speed<1 || gap>Math.max(0,c.speed)*.55+c.speed*c.speed/7.5))return false;
 }
 if(gap>14)return true;
 if(crossingOccupied(m))return false;
 for(const o of cars){
  if(o===c || o.dead || !o.driver || Math.abs(o.pos.y-c.pos.y)>1.6 ||
    Math.abs(o.pos.x-m.x)>48 || Math.abs(o.pos.z-m.z)>48)continue;
  // The tail of a car ahead must have storage beyond the exit crosswalk.
  const end=m.points[m.points.length-1],ax=o.pos.x-end.x,az=o.pos.z-end.z;
  const forward=ax*m.ex+az*m.ez,lateral=ax*m.ez-az*m.ex;
  if(o.speed<1 && forward>0 && forward<c.spec.L+o.spec.L*.5+2.2 && Math.abs(lateral)<1.55)return false;
  if(o.driver==='player' || o.siren){
   if(m.points.some(p=>bodyInsideCar(o,{x:p.x,z:p.z,y:c.pos.y},c.spec.W*.54)))return false;
   continue;
  }
  if(o.clearing && o.clearing.x===m.x && o.clearing.z===m.z && conflictingPaths(m,o.clearing))return false;
  const other=o.ai?.movement;
  if(!other || other.x!==m.x || other.z!==m.z || !conflictingPaths(m,other))continue;
  if(other.committed)return false;
  const otherStop=mustStop(other.rule,other.axis);
  if(stop && otherStop && other.arrived!==null && (other.arrived<m.arrived ||
    other.arrived===m.arrived && cars.indexOf(o)<cars.indexOf(c)))return false;
  const opposing=m.dx===-other.dx && m.dz===-other.dz;
  const yieldToThrough=stop && !otherStop || m.turn<0 && opposing && other.turn>=0;
  if(yieldToThrough && o.speed>1 && approachGap(o,other)<o.speed*(m.turn<0?3.4:3.0))return false;
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
  target=Math.min(target,Math.max(0,Math.min(Math.sqrt(Math.max(0,leadSpeed**2+6*gap)),leadSpeed+gap/1.35)));
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
function trafficDrive(c,target,aim,dt){
 const diff=wrapA(Math.atan2(aim.x-c.pos.x,aim.z-c.pos.z)-c.h);
 // Pure pursuit uses the actual look-ahead distance and wheelbase of this car.
 const dist=Math.max(1,dist2(aim,c.pos)),angle=Math.atan2(4*c.spec.wb*Math.sin(diff),dist);
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
function aiTraffic(c,dt){
 if(!c.ai){
  const a=nearestNode(c.pos),fx=Math.sin(c.h),fz=Math.cos(c.h);
  const b=neighbors(a).sort((p,q)=>(q[0]-p[0])*fx+(q[1]-p[1])*fz)[0];
  c.ai={a,b};
 }
 if(c.ai.grade){followGradeRoad(c,dt);return;}
 const ai=c.ai,m=ai.movement||(ai.movement=planMovement(ai));
 if(c.clearing && (c.pos.x-c.clearing.x)*c.clearing.ex+(c.pos.z-c.clearing.z)*c.clearing.ez>
   STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+c.spec.L/2)c.clearing=null;
 const outDistance=(c.pos.x-m.x)*m.ex+(c.pos.z-m.z)*m.ez;
 if(m.committed && outDistance>=TURN_EXTENT-.3){
  c.clearing=m;c.ai={a:ai.b,b:m.exit,lane:m.exitLane};
  return aiTraffic(c,dt);
 }
 const gap=approachGap(c,m),s=pathProgress(m,c.pos);
 const look=clamp(3.6+Math.abs(c.speed)*.53,3.8,9.6);
 let target=m.section.speed*(c.driverPace??(c.driverPace=rnd(.89,1.05)));
 if(m.turn && s> -14)target=Math.min(target,m.turn>0?4.2:5.0);
 const block=m.dx?Math.min(ai.a[0],ai.b[0]):Math.min(ai.a[1],ai.b[1]);
 const line=m.dx?ai.b[1]:ai.b[0],at=m.dx?c.pos.x:c.pos.z;
 if(hasSpeedHump(m.axis,line,block) && Math.abs(at-(block+.5)*CELL)<9)target=Math.min(target,5.0);
 const allowed=canEnter(c,m,gap,dt);
 if(!allowed){
  const available=Math.max(0,gap-.57);
  target=Math.min(target,Math.sqrt(5.6*available),available*1.3);
 }
 if(m.ramp && m.committed && s>TURN_EXTENT-2){
  const next=m.ramp.route.sections.findIndex(section=>m.dx?section.b.x>c.pos.x:section.b.z>c.pos.z);
  ai.grade={...m.ramp,index:clamp(next-(m.ramp.direction<0?1:0),0,m.ramp.route.sections.length-1)};
  ai.movement=null;followGradeRoad(c,dt);return;
 }
 c.indicating=gap<18 || m.committed?m.turn:0;
 trafficDrive(c,obstacleSpeed(c,target),pathTarget(m,s+look),dt);
 if(c.phys && c.upY<.4 && c.driver==='ai'){
  c.flipT=(c.flipT||0)+dt;
  if(c.flipT>3){const exit=carDoorSpot(c);if(exit){c.driver=null;ejectPed(exit.x,exit.z,c.pos.x,c.pos.z,exit.y);}}
 }else c.flipT=0;
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
function tryCrosswalk(p){
 if(p.cross){
  if(p.cross.waiting && pedestrianCanStart(p,p.cross))p.cross.waiting=false;
  return;
 }
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
 const far=perim(blocks[a*N+b]),legX=acrossX?0:-sx,legZ=acrossX?-sz:0;
 const crossing={i:ni,j:nj,legX,legZ,axis:acrossX?'ew':'ns',
  x:acrossX?(sx>0?far.x0:far.x1):ni*CELL+legX*STREET_DESIGN.crossing,
  z:acrossX?nj*CELL+legZ*STREET_DESIGN.crossing:(sz>0?far.z0:far.z1)};
 crossing.waiting=!pedestrianCanStart(p,crossing);p.cross=crossing;
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
 for(const p of choices){
  if(cars.some(c=>dist2(c.pos,p)<6.4))continue;
  spawnCar(type,p.x,p.z,p.h,null).keep=true;
  if(--count===0)break;
 }
}
