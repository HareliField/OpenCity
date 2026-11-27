// Municipal traffic enforcement. Fines are in game dollars and speeds are in km/h.
const TRAFFIC_OFFENSES={
 speeding:['Speeding',80],red:['Running a red light',150],stop:['Failure to stop',100],
 wrongWay:['Wrong-way driving',125],restricted:['Driving on a sidewalk or cycle track',120],
 yield:['Failure to yield at a crosswalk',150],pedestrian:['Striking a pedestrian',250],
 collision:['Damaging another vehicle',175],property:['Damaging roadside property',200],
 destruction:['Destroying a vehicle',300]
};
const TRAFFIC_PATROL={posts:[],drive:null,calls:[],recentDamage:new WeakMap(),limit:null};

function installTrafficPosts(){
 const station=PoliceDepartment.stations[0];
 if(!station)return;
 for(const [i,j,side] of [[4,5,1],[2,4,-1],[14,12,-1]]){
  const x=i*CELL+side*(HALF+1.35);
  for(const d of [23,28,18,34]){
   const z=j*CELL-side*d,at=new V3(x,groundY(x,z),z),checked=at.clone();
   if(nearDriveway(x,z,1) || PROPS.list.some(p=>dist2(p.renderPosition,at)<1.3))continue;
   collideWorld(checked,.40);
   if(dist2(at,checked)>.04)continue;
   const street=STREET_NAMES.ns[i],room='Traffic patrol · '+street;
   const post={role:'Patrol',point:at,yaw:Math.atan2(i*CELL-x,j*CELL-z),room,traffic:true,member:null,actor:null};
   station.posts.push(post);TRAFFIC_PATROL.posts.push(post);break;
  }
 }
}

function roadsideTicketAction(pos){
 const post=TRAFFIC_PATROL.posts.find(p=>p.unit && !p.unit.dead && stationReach(pos,p.unit.pos,1.8));
 if(post)return {label:'TRAFFIC TICKETS',fn:()=>openPoliceDesk({name:post.member.name,roadside:true},'Tickets')};
 return null;
}

function roadForTraffic(pos,yaw){
 const grade=sampleGrade(pos.x,pos.z,pos.y);
 if(grade?.height>.24 && Math.abs(pos.y-grade.height)<.22){
  const s=grade.section,forward=s.dx*Math.sin(yaw)+s.dz*Math.cos(yaw);
  return {name:s.name,limit:40,wrongWay:grade.lateral*Math.sign(forward)>.65,deck:true};
 }
 if(pos.y>1 || pos.y<-.4 || pos.x< -HALF || pos.x>W+HALF || pos.z< -HALF || pos.z>W+HALF)return null;
 const [i,j]=nearestNode(pos),u=pos.x-i*CELL,v=pos.z-j*CELL;
 const inBox=Math.abs(u)<=HALF && Math.abs(v)<=HALF;
 const ew=inBox?Math.abs(Math.sin(yaw))>Math.abs(Math.cos(yaw)):Math.abs(v)<Math.abs(u);
 const axis=ew?'ew':'ns',line=ew?j:i,across=ew?v:u,parallel=ew?Math.sin(yaw):Math.cos(yaw);
 if(Math.abs(across)>HALF+3.55)return null;
 const along=ew?pos.x:pos.z,part=clamp(Math.floor(along/CELL),0,N-1),section=streetSection(axis,line,part);
 const dir=Math.sign(parallel),right=(across-(section.median||0))*dir*(ew?1:-1);
 const midblock=Math.abs(ew?u:v)>STREET_DESIGN.crossing+2;
 const apron=midblock && nearDriveway(pos.x,pos.z,1.5);
 const restricted=midblock && !apron && (Math.abs(across)>HALF+.2 || section===ROAD_SECTIONS.waterfront && across>4.91);
 return {name:STREET_NAMES[axis][line],limit:Math.round(section.limitMph*1.609344),axis,i,j,dir,along,right,inBox,
  aligned:Math.abs(parallel)>.82,restricted,wrongWay:midblock && !restricted && !apron && right<-.65};
}

function trafficWitness(at,subject=at){
 const sees=(pos,yaw)=>policeCanSee(pos,at,yaw,48,2) && (subject===at || policeCanSee(pos,subject,yaw,48,2));
 for(const c of cars){
  if(c.driver==='police' && !c.dead && c.officer && sees(c.pos,c.h))return {officer:c.officer,car:c};
 }
 for(const units of [departmentPeople,cops])for(const u of units){
  if(!u.dead && u.team==='law' && u.officer && sees(u.pos,u.c.yaw))return {officer:u.officer};
 }
 return null;
}
function ticketDetails(code,at,street,detail){
 const [offense,fine]=TRAFFIC_OFFENSES[code];
 return {code,offense,fine,street,detail,driver:player.personId,plate:player.car?.plate||null,
  at:{x:at.x,y:at.y,z:at.z}};
}
function deliverTrafficTicket(record,issuer,witness){
 const t=PoliceDepartment.issueTicket({...record,issuer:issuer.name,badge:issuer.badge,witness});
 toast('TICKET #'+t.id+' · '+t.offense+' · $'+t.fine,4200);
}
function observedTrafficTicket(code,at,street,detail){
 const observed=trafficWitness(at);
 if(!observed)return false;
 if(observed.car)observed.car.ticketLightsUntil=time+4;
 deliverTrafficTicket(ticketDetails(code,at,street,detail),observed.officer,'Officer observation');
 const danger={red:12,stop:7,wrongWay:12,restricted:10,yield:12,speeding:9}[code];
 if(wanted&&danger&&player.car&&LAW.plates.has(player.car.plate)){
  fileWitnessReport(danger,at.x,at.z,true,false,{kind:'Reckless driving',vehicle:player.car});
 }
 return true;
}

// Collision callbacks from both bodies and adjacent sections can describe the same crash.
function reportTrafficDamage(code,object,at,detail){
 if(state!=='play' || !object)return;
 const last=TRAFFIC_PATROL.recentDamage.get(object);
 if(last!==undefined && time-last<5){TRAFFIC_PATROL.recentDamage.set(object,time);return;}
 const impact=TRAFFIC_PATROL.lastImpact;
 if(impact && time-impact.time<1.25 && dist2(impact,at)<4 && Math.abs(impact.y-at.y)<2)return;
 const location=roadForTraffic(at,player.car?.h??player.yaw);
 const node=nearestNode(at),street=location?.name||STREET_NAMES.ns[node[0]]+' / '+STREET_NAMES.ew[node[1]];
 const direct=trafficWitness(at,player.car?.pos||player.pos);
 if(direct){
  if(direct.car)direct.car.ticketLightsUntil=time+4;
  deliverTrafficTicket(ticketDetails(code,at,street,detail),direct.officer,'Officer observation');
 }else{
  const ped=witnessesFor(at.x,at.z,at.y).ped,subject=player.car?.pos||player.pos;
  if(!ped || ped.dead || dist2(ped.pos,subject)>31 || !los(ped.pos,subject))return;
  TRAFFIC_PATROL.calls.push({record:ticketDetails(code,at,street,detail),ped,id:ped.personId,due:time+3.1});
 }
 TRAFFIC_PATROL.recentDamage.set(object,time);
 TRAFFIC_PATROL.lastImpact={time,x:at.x,y:at.y,z:at.z};
}

function checkTrafficApproach(track,car,road,dt){
 if(road.deck || road.restricted || !road.aligned || road.right<-.4 || car.speed<-.25){track.approach=null;return;}
 const {i,j,axis,dir}=road,ew=axis==='ew';
 const node=(ew?i:j)*CELL,alignment=Math.abs(ew?Math.sin(car.h):Math.cos(car.h));
 const front=(node-road.along)*dir-car.spec.L*.5*alignment;
 const control=junctionControl(i,j),gap=front-stopLine(control).outer;
 if(front<HALF-1 || gap>12){track.approach=null;return;}
 const key=[i,j,axis,dir].join('/');
 let approach=track.approach;
 if(approach?.key!==key){track.approach={key,gap,stoppedFor:0,stopped:false};return;}
 if(gap>=-.05 && gap<3.5 && Math.abs(car.speed)<.28){
  approach.stoppedFor+=dt;if(approach.stoppedFor>=.35)approach.stopped=true;
 }else approach.stoppedFor=0;
 const street=STREET_NAMES.ns[i]+' / '+STREET_NAMES.ew[j];
 if(!approach.entered && approach.gap>=0 && gap<0){
  approach.entered=true;
  const crossedAt=time-dt*(-gap)/(approach.gap-gap);
  if(control==='signal' && phaseForGroup(signalGroup(i,j),crossedAt)[axis].vehicle==='R')
   observedTrafficTicket('red',car.pos,street,'Front bumper crossed the stop bar on red.');
  else if(mustStop(control,axis) && !approach.stopped)
   observedTrafficTicket('stop',car.pos,street,'Entered without a full stop at the marked bar.');
 }
 approach.gap=gap;
}

function checkOccupiedCrosswalk(track,car,road){
 const half=car.spec.L/2,noseX=car.pos.x+Math.sin(car.h)*half,noseZ=car.pos.z+Math.cos(car.h)*half;
 const oldX=track.noseX,oldZ=track.noseZ;track.noseX=noseX;track.noseZ=noseZ;
 if(oldX===undefined || road.deck || car.speed<=.25)return;
 for(const p of peds){
  const c=p.cross;
  if(p.dead || p.mode!=='walk' || !c || c.waiting || Math.abs(p.pos.y-car.pos.y)>1.5)continue;
  const cx=c.i*CELL,cz=c.j*CELL,edge=crossingEdge(c);
  if(Math.abs((p.pos.x-cx)*c.legZ-(p.pos.z-cz)*c.legX)>=edge)continue;
  const before=(oldX-cx)*c.legX+(oldZ-cz)*c.legZ,after=(noseX-cx)*c.legX+(noseZ-cz)*c.legZ;
  const entry=STREET_DESIGN.crossing+Math.sign(before-after)*STREET_DESIGN.crossWidth/2;
  if(before===after || (before-entry)*(after-entry)>0 || before===entry)continue;
  const t=(entry-before)/(after-before),across=(lerp(oldX,noseX,t)-cx)*c.legZ-(lerp(oldZ,noseZ,t)-cz)*c.legX;
  if(Math.abs(across)>edge+car.spec.W/2)continue;
  observedTrafficTicket('yield',car.pos,STREET_NAMES.ns[c.i]+' / '+STREET_NAMES.ew[c.j],'Entered an occupied marked crossing.');
  break;
 }
}

function sustainedTrafficOffense(track,code,active,dt,car,road,detail){
 if(!active){
  const previous=track.episodes[code];
  if(previous){previous.clear+=dt;if(!previous.issued || previous.clear>=2)delete track.episodes[code];}
  return;
 }
 const e=track.episodes[code]??={elapsed:0,next:1.2,issued:false,clear:0};
 e.clear=0;
 e.elapsed+=dt;
 if(!e.issued && e.elapsed>=e.next){
  e.issued=observedTrafficTicket(code,car.pos,road.name,detail);
  e.next=e.elapsed+.4;
 }
}
function updateTrafficPatrol(dt){
 for(const call of TRAFFIC_PATROL.calls.slice()){
  if(time<call.due)continue;
  TRAFFIC_PATROL.calls.splice(TRAFFIC_PATROL.calls.indexOf(call),1);
  if(call.ped.dead || call.ped.personId!==call.id)continue;
  const issuer=PoliceDepartment.staff.find(s=>s.division==='Patrol' && PoliceDepartment.duty(s));
  if(issuer)deliverTrafficTicket(call.record,issuer,'911 witness '+call.id);
 }
 const car=player.car,road=car && !car.dead?roadForTraffic(car.pos,car.h):null;
 TRAFFIC_PATROL.limit=road?.limit??null;
 if(!road){TRAFFIC_PATROL.drive=null;return;}
 let track=TRAFFIC_PATROL.drive;
 if(track?.car!==car || Math.hypot(car.pos.x-track.x,car.pos.z-track.z)>Math.max(3,Math.abs(car.speed)*dt+1)){
  track=TRAFFIC_PATROL.drive={car,episodes:{},approach:null};
 }
 track.x=car.pos.x;track.z=car.pos.z;
 checkTrafficApproach(track,car,road,dt);
 checkOccupiedCrosswalk(track,car,road);
 const kmh=Math.hypot(car.vel.x,car.vel.z)*3.6;
 sustainedTrafficOffense(track,'speeding',kmh>road.limit+3,dt,car,road,Math.round(kmh)+' km/h in a '+road.limit+' km/h zone.');
 sustainedTrafficOffense(track,'wrongWay',car.speed>2 && road.wrongWay && (road.deck || road.aligned),dt,car,road,'Travelled against the signed traffic direction.');
 sustainedTrafficOffense(track,'restricted',kmh>7 && road.restricted && road.aligned,dt,car,road,'Drove along a reserved pedestrian or cycle surface.');
}
