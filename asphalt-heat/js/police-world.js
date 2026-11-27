/* The two front counters read the same watch board. Station geometry is baked into city chunks. */
const policeSigns=new Map();
function buildPoliceOffice(block,M,side,box){
 function sign(label,u,y,v,w,h){
  if(!policeSigns.has(label)){
   const [canvas,g]=cvs(512,96);g.fillStyle='#173847';g.fillRect(0,0,512,96);
   g.strokeStyle='#98b8c5';g.strokeRect(7,7,498,82);g.fillStyle='#e3edf1';g.textAlign='center';g.textBaseline='middle';
   g.font='bold 46px Arial,sans-serif';g.fillText(label,256,48,474);
   policeSigns.set(label,new THREE.MeshBasicMaterial({map:ctex(canvas)}));
  }
  const p=lpt(M,u,v),g=new THREE.PlaneGeometry(w,h);
  g.rotateY(SIDEANG[side]);g.translate(p.x,y,p.z);addGeo(policeSigns.get(label),g,false);
 }
 const headquarters=block.i===2&&block.j===2;
 const station={name:headquarters?'Old Town headquarters':'South district field office',posts:[],desk:lpt(M,0,8.6)};
 const mat=INTERIORS.materials;
 function solid(material,l,r,b,t,front,back){
  const rect=box(material,l,r,b,t,front,back);
  block.bld.push({...rect,y0:b,h:t});
 }
 function counter(x,v,width,title){
  solid(mat.darkWood,x-width/2,x+width/2,.15,1.05,v,v+.78);
  box(mat.steel,x-width/2-.05,x+width/2+.05,1.05,1.12,v-.05,v+.83);
  sign(title,x,.77,v-.02,Math.min(width-.2,3.4),.46);
  box(mat.black,x-.33,x+.33,1.19,1.59,v+.32,v+.39);
  box(mat.steel,x-.05,x+.05,1.12,1.23,v+.33,v+.38);
  box(mat.black,x+.55,x+.72,1.12,1.40,v+.24,v+.40);
 }
 if(headquarters){
  furnishHeadquarters(block,M,side,box,sign,solid,station);
  PoliceDepartment.stations.push(station);return station;
 }
 counter(0,10,6,'PUBLIC RECORDS');
 sign(headquarters?'OLD TOWN HEADQUARTERS':'SOUTH DISTRICT OFFICE',0,5.5,3.73,12,1.05);
 counter(-10,18,5,headquarters?'COMMUNICATIONS':'PATROL');
 counter(9,20,5,headquarters?'EVIDENCE':'DETECTIVES');
 counter(0,26,4,'DETECTIVES');
 for(const [x,v] of [[-9,7],[-6,7],[8,8],[10,8]])placeRoomFurniture(block,M,'seat',x,v,.15,[.65,.85,.65]);
 // Open doorways lead from reception to the interview, dispatch and evidence desks.
 for(const [lo,hi] of [[-18.8,-12],[-9,-2],[2,7],[10,18.8]])solid(mat.plaster,lo,hi,.15,2.8,14,14.18);
 for(let i=0;i<7;i++){
  const x=11+i*.87;
  solid(mat.steel,x,x+.83,.15,2.35,28,28.75);
  box(mat.black,x+.11,x+.29,1.23,1.27,27.97,28);
 }
 for(const [x,v,role] of [[0,11.25,headquarters?'Command':'Patrol'],[-10,19.45,headquarters?'Communications':'Patrol'],
  [9,21.45,headquarters?'Forensics':'Detectives'],[0,27.45,'Detectives']]){
  const point=lpt(M,x,v);station.posts.push({point,role,yaw:SIDEANG[side],member:null,actor:null});
  INTERIORS.emitters.push({x:point.x,y:3.25,z:point.z,cool:true});
  box(mat.neutral,x-.65,x+.65,3.34,3.40,v-.17,v+.17);
 }
 PoliceDepartment.stations.push(station);
 return station;
}

const policeGearMaterial=new THREE.MeshStandardMaterial({color:0x24303a,roughness:.74});
function equipOfficer(c,metro){
 // The skinned uniform already includes its belt, pouches and protective clothing.
 if(!metro)clipDepartmentCamera(c);
}
function updateStationPosts(dt){
 for(const station of PoliceDepartment.stations)for(const post of station.posts){
  const nearby=dist2(player.pos,post.point)<58&&Math.abs(player.pos.y-post.point.y)<3.5||caseViewNear(post.point,28,2.2);
  if(post.unit?.dead&&nearby&&post.unit.downT<15){
   post.unit.downT+=dt;updChar(post.actor,0,dt,true);continue;
  }
  const calledOut=post.member&&(PoliceDepartment.bindings.has(post.member.personId)||PoliceDepartment.cases.some(c=>PoliceDepartment.fieldAssignment(c,post.member.personId)));
  if(post.actor&&(!nearby||calledOut||!PoliceDepartment.working(post.member))){
   PoliceDepartment.workstations.delete(post.member.personId);removeDepartmentPerson(post.unit,false);post.member=post.actor=post.unit=null;
  }
  if(!nearby)continue;
  if(!post.actor){
   const member=PoliceDepartment.staff.find(s=>s.division===post.role&&PoliceDepartment.working(s)&&!PoliceDepartment.bindings.has(s.personId)&&
    !PoliceDepartment.workstations.has(s.personId)&&!PoliceDepartment.cases.some(c=>PoliceDepartment.fieldAssignment(c,s.personId)));
   if(!member)continue;
   post.member=member;PoliceDepartment.workstations.set(member.personId,post.room||station.name);
   const uniform=['Patrol','Command','Metro SWAT'].includes(member.division);
   post.actor=makeChar(officerModel(member),{gun:member.kit.some(k=>k.includes('sidearm'))});
   post.actor.personId=member.personId;
   post.unit=departmentPerson(member,post.actor,post.point,uniform);
   if(uniform)equipOfficer(post.actor,member.division==='Metro SWAT');
   personalizeOfficer(post.actor,member);fitIssuedEquipment(post.actor,member);
   post.actor.root.position.copy(post.point);post.actor.root.position.y=post.point.y||.16;post.actor.yaw=post.yaw;post.actor.talk=1;
  }
  const c=post.actor,u=post.unit;
  const phase=(PoliceDepartment.clock+post.member.badge*2.37)%24;
  const destination=post.workEnd&&phase>9&&phase<18?post.workEnd:post.point;
  const dx=destination.x-u.pos.x,dz=destination.z-u.pos.z,dist=Math.hypot(dx,dz),stride=Math.min(dt*.85,dist);
  if(dist>.04){
   u.pos.x+=dx*stride/dist;u.pos.z+=dz*stride/dist;collideWorld(u.pos,.30);
   c.yaw=lerpA(c.yaw,Math.atan2(dx,dz),Math.min(1,dt*6));
  }else c.yaw=lerpA(c.yaw,post.yaw+.12*Math.sin(phase*.48),Math.min(1,dt*2));
  c.talk=dist<.05&&(phase<2||phase>17&&phase<20)?1:0;
  c.root.position.copy(u.pos);
  if(post.seated)c.root.position.y-=.46;
  updChar(c,dist>.04?.85:0,dt,true);
  if(post.seated){
   const forward=new V3(Math.sin(c.yaw),0,Math.cos(c.yaw)),B=c.bones;
   for(const limb of ['Left','Right']){
    pointBone(B[limb+'Thigh'],B[limb+'Calf'],forward,.97);pointBone(B[limb+'Calf'],B[limb+'Foot'],new V3(0,-1,0),.98);
    pointBone(B[limb+'Arm'],B[limb+'ForeArm'],new V3(forward.x*.32,-.9,forward.z*.32).normalize(),.92);
    pointBone(B[limb+'ForeArm'],B[limb+'Hand'],new V3(forward.x,.1*Math.sin(phase*3),forward.z).normalize(),.92);
   }
  }
 }
}

function registerIncident(kind,at,{victim=null,vehicle=null,handContact=false,alarm=false,eyewitness=null}={}){
 if(state!=='play')return;
 const witness=witnessesFor(at.x,at.z,at.y);
 const actor=eyewitness||witness.ped;
 const target=player.car?.pos||player.pos;
 const patrolSaw=witness.officers&&witnessesFor(target.x,target.z,target.y).officers;
 const saw=Boolean(eyewitness||patrolSaw||actor&&dist2(actor.pos,target)<31&&los(actor.pos,target));
 const statement=witness.officers?'Patrol observation':actor?PoliceDepartment.identify(actor):null;
 const print=handContact&&!player.gloves?player.fingerprintId:vehicle?.contactPrint;
 const entry=PoliceDepartment.file({kind,at,victim:victim&&PoliceDepartment.identify(victim),
  touch:print,source:vehicle?'Vehicle contact':'Scene contact',plate:saw?vehicle?.plate:null,
  trace:handContact&&player.hp<70?player.dnaId:null,witness:statement,contact:saw?'ah-player':null,
  reported:alarm||!!statement});
 return entry;
}
let policeNextTick=0;
function updateDepartment(dt){
 PoliceDepartment.clock+=dt;
 updatePoliceLives(dt);updateStationPosts(dt);updateFieldDetectives(dt);
 if(PoliceDepartment.clock<policeNextTick)return;
 policeNextTick=PoliceDepartment.clock+1;
 for(const entry of PoliceDepartment.cases){
  if(entry.stage!=='Unreported'||streetIncidents.current?.file===entry)continue;
  const witness=witnessesFor(entry.at.x,entry.at.z,entry.at.y);
  if(entry.origin==='street'){discoverStreetScene(entry,witness);continue;}
  if(witness.officers||witness.ped){
   PoliceDepartment.receiveCall(entry,witness.officers?'Patrol':'911','Scene discovered. Patrol requested.');
  }
 }
 PoliceDepartment.process();
 if(!wanted&&!heat){
  const at=player.car?.pos||player.pos;
  const bulletin=PoliceDepartment.cases.find(c=>c.stage==='Wanted'&&
   (player.car?c.plate===player.car.plate:c.suspect===player.personId));
  if(bulletin&&witnessesFor(at.x,at.z,at.y).officers){
   recordOffence(TH[3],at.x,at.z,false,at.y);
   PoliceDepartment.radio('Patrol','Positive sighting · file '+bulletin.id+'.','sighting');
  }
 }
 if(policeDesk.open)renderPoliceDesk();
}

function assignCivilianIdentity(actor){
 // A recycled pedestrian slot now represents a new passerby. Preserve externally assigned resident IDs.
 if(actor.personId?.startsWith('ah-person-'))delete actor.personId;
 PoliceDepartment.identify(actor);
}
const departmentPeople=[];
function departmentPerson(member,c,point,uniform){
 const unit={personId:member.personId,officer:member,c,pos:new V3(point.x,point.y||.16,point.z),
  kind:uniform?'cop':'civilian',team:uniform?'law':'staff',hp:uniform?100:65,dead:false,downT:0};
 PoliceDepartment.identify(unit);
 globalThis.ResidentCast?.bind(c,member.personId,uniform);departmentPeople.push(unit);return unit;
}
function removeDepartmentPerson(unit,release=true){
 const i=departmentPeople.indexOf(unit);
 if(i>=0)departmentPeople.splice(i,1);
 removeChar(unit.c);if(release)PoliceDepartment.release(unit.officer);
}
function meetDepartmentPerson(){
 const person=[...departmentPeople,...cops].find(u=>u.officer&&!u.dead&&stationReach(player.pos,u.pos,1.8));
 if(!person)return null;
 return {label:'TALK',fn:()=>openStaffProfile(person.officer)};
}

const policeHouseholds=[];
function initializePoliceLives(){
 for(const [i,member] of PoliceDepartment.staff.entries()){
  const district={Eastside:'suburb',Midtown:'midtown','Old Town':'oldtown','Coast Ridge':'beach'}[member.home];
  const lots=blocks.filter(b=>b.dist===district&&!b.park&&b.bld.length);
  if(!lots.length)continue;
  const block=lots[(i*13)%lots.length];
  policeHouseholds.push({member,route:perim(block),unit:null,start:i*7});
 }
}
function updatePoliceLives(dt){
 const pd=PoliceDepartment;
 for(const home of policeHouseholds){
  const member=home.member;
  const phase=(pd.clock/480-member.watch+3)%3;
  // Between watches a resident walks in their neighborhood, then spends the overnight period at home.
  const outside=phase>=1.13&&phase<1.82||phase>2.82;
  const [x,z]=perimPos(home.route,home.start+pd.clock*.98);
  const nearby=outside&&!pd.activeFile(member)&&Math.hypot(x-player.pos.x,z-player.pos.z)<48;
  if(home.unit&&home.unit.dead){
   updChar(home.unit.c,0,dt,true);home.unit.downT+=dt;
   if(home.unit.downT<15)continue;
  }
  if(home.unit&&(!nearby||pd.unavailable.has(member.personId))){
   removeDepartmentPerson(home.unit);home.unit=null;
  }
  if(!nearby||pd.unavailable.has(member.personId))continue;
  if(!home.unit){
   if(pd.bindings.has(member.personId))continue;
   pd.bindings.set(member.personId,'Off duty · '+member.home);
   const c=makeChar(officerModel(member,false),{});personalizeOfficer(c,member);
   home.unit=departmentPerson(member,c,{x,z},false);
  }
  const u=home.unit,[aheadX,aheadZ]=perimPos(home.route,home.start+pd.clock*.98+.3);
  u.pos.set(x,groundY(x,z),z);u.c.root.position.copy(u.pos);u.c.yaw=Math.atan2(aheadX-x,aheadZ-z);
  updChar(u.c,.98,dt,true);
 }
}

const policeGloveShape=new THREE.SphereGeometry(1,8,6);
function dressPlayerHands(){
 const c=player.c;
 for(const name of ['LeftHand','RightHand']){
  const hand=c.bones[name];if(!hand)continue;
  hand.userData.fingerprintId=player.fingerprintId;
  if(!hand.userData.glove){
   const glove=new THREE.Mesh(policeGloveShape,policeGearMaterial);
   const palm=hand.getWorldPosition(new V3()),finger=hand.children.find(o=>o.isBone);
   if(finger)palm.lerp(finger.getWorldPosition(new V3()),.75);
   glove.position.copy(palm);glove.scale.set(.048,.058,.042);scene.add(glove);hand.attach(glove);hand.userData.glove=glove;
  }
  hand.userData.glove.visible=!!player.gloves;
 }
}

const fieldInvestigators=new Map();
PoliceDepartment.atScene=file=>{
 if(dist2(player.pos,file.at)>48&&!caseViewNear(file.at,52,5))return true;
 const unit=fieldInvestigators.get(file.id);
 return !!unit&&!unit.dead&&Math.abs(unit.pos.y-(file.at.y||0))<1.8&&dist2(unit.pos,file.at)<4.8;
};
function updateFieldDetectives(dt){
 const pd=PoliceDepartment;
 updateStreetTeams(dt);
 for(const [fileId,u] of fieldInvestigators){
  const file=u.file;
  if(file.response)continue;
  if(u.dead){u.downT+=dt;updChar(u.c,0,dt,true);if(u.downT<15)continue;}
  if(pd.assigned(file)===u.personId&&!u.dead&&(dist2(player.pos,file.at)<64||caseViewNear(file.at,64,5))){
   const dx=file.at.x-u.pos.x,dz=file.at.z-u.pos.z,length=Math.hypot(dx,dz),pace=length>1.45?1.35:0;
   if(pace){u.pos.x+=dx/length*pace*dt;u.pos.z+=dz/length*pace*dt;collideWorld(u.pos,.34);}
   u.pos.y=groundY(u.pos.x,u.pos.z,u.pos.y);u.c.root.position.copy(u.pos);
   u.c.yaw=Math.atan2(dx,dz);u.c.talk=pace?0:1;updChar(u.c,pace,dt,true);continue;
  }
  removeDepartmentPerson(u);fieldInvestigators.delete(fileId);
 }
 for(const file of pd.cases){
  if(file.response)continue;
  const assignee=pd.assigned(file);
  if(!assignee||fieldInvestigators.has(file.id)||dist2(player.pos,file.at)>52&&!caseViewNear(file.at,52,5))continue;
  const member=pd.staff.find(s=>s.personId===assignee);
  if(!member||pd.bindings.has(member.personId)||pd.unavailable.has(member.personId))continue;
  const at=new V3(file.at.x,file.at.y||0,file.at.z);
  const offset=file.origin==='street'?8:4;
  for(const [dx,dz] of [[offset,0],[-offset,0],[0,offset],[0,-offset]]){
   if(rayWorld(at.x,at.z,at.x+dx,at.z+dz,at.y+1,at.y+1)<1)continue;
   at.x+=dx;at.z+=dz;break;
  }
  collideWorld(at,.34);
  const uniform=member.division==='Patrol';
  const c=makeChar(officerModel(member),{gun:true}),u=departmentPerson(member,c,at,uniform);
  personalizeOfficer(c,member);fitIssuedEquipment(c,member);
  if(uniform)equipOfficer(c,false);
  u.pos.copy(at);c.root.position.copy(at);u.file=file;
  pd.bindings.set(member.personId,'Scene · file '+file.id);fieldInvestigators.set(file.id,u);
 }
}

// A street team stays together through the detective's visit. Marked cars use the same tyres,
// acceleration and collision world as traffic, then rejoin the street when the team clears.
const streetTeams=new Map(),returningSceneCars=new Map();
function sceneStreetFrame(at){
 const lineX=Math.round(at.x/CELL)*CELL,lineZ=Math.round(at.z/CELL)*CELL;
 const northSouth=Math.abs(at.x-lineX)<Math.abs(at.z-lineZ);
 const side=Math.sign(northSouth?at.x-lineX:at.z-lineZ)||1;
 const tx=northSouth?0:side,tz=northSouth?-side:0,nx=-tz,nz=tx;
 const x=northSouth?lineX:at.x,z=northSouth?at.z:lineZ;
 return {tx,tz,nx,nz,x,z,northSouth};
}
function sceneCarSpot(team,index){
 const f=team.frame,along=f.northSouth?f.z:f.x,base=Math.floor(along/CELL)*CELL;
 const coords=(along,offset)=>new V3(f.northSouth?f.x+f.nx*offset:along,0,f.northSouth?along:f.z+f.nz*offset);
 const dir=f.tx||f.tz;
 for(const offset of [0,7.5,-7.5,15,-15]){
  const parallel=clamp(along+(index?5:-3)*dir+offset,base+17,base+CELL-17);
  const stop=coords(parallel,HALF-1.55),start=coords(parallel-dir*10,HALF-1.7);
  if(cars.some(c=>dist2(c.pos,stop)<5.7||dist2(c.pos,start)<5.1))continue;
  if(team.rides.some(r=>r&&dist2(r.stop,stop)<6))continue;
  if(rayWorld(start.x,start.z,stop.x,stop.z,.8,.8,.85)<1)continue;
  if(nearDriveway(stop.x,stop.z,2.5))continue;
  start.y=groundY(start.x,start.z);stop.y=groundY(stop.x,stop.z);
  return {start,stop};
 }
 return null;
}
function startSceneRide(team,index){
 const route=sceneCarSpot(team,index);
 if(!route)return null;
 const f=team.frame,car=spawnCar('police',route.start.x,route.start.z,Math.atan2(f.tx,f.tz),'scene');
 car.sceneFileId=team.file.id;car.sceneStop=route.stop;car.sceneDrivingSince=PoliceDepartment.clock;car.siren=true;
 return {car,stop:route.stop};
}
function driveSceneCar(car,dt){
 const stop=car.sceneStop,dx=stop.x-car.pos.x,dz=stop.z-car.pos.z,d=Math.hypot(dx,dz);
 const forward=dx*Math.sin(car.h)+dz*Math.cos(car.h);
 const pullingIn=d>1.2&&forward>.35&&PoliceDepartment.clock-car.sceneDrivingSince<7;
 const speed=pullingIn?Math.min(5.8,Math.max(1.1,d*.9)):0;
 const target=blockedAhead(car)?0:speed;
 const angle=pullingIn?wrapA(Math.atan2(dx,dz)-car.h):0;
 drive(car,clamp((target-car.speed)*.52,-1,1),clamp(angle*1.8,-1,1),!target&&Math.abs(car.speed)<.8,dt);
 if(!pullingIn&&Math.abs(car.speed)<.85){
  car.driver=null;car.sceneParked=true;setCarLights(car,false);
 }
}
function teamPoint(team,along,across){
 const {file,frame:f}=team;
 const p=new V3(file.at.x+f.tx*along+f.nx*across,file.at.y||0,file.at.z+f.tz*along+f.nz*across);
 collideWorld(p,.34);p.y=groundY(p.x,p.z,p.y);return p;
}
const scenePositions=[[0,.92],[-2.2,.65],[1.8,1.12],[4.1,-.65],[-4.4,-.5],[1.0,-1.2]];
function openSceneApproach(target,team,slot){
 const f=team.frame,sign=slot%2?-1:1;
 for(const [x,z] of [[f.tx*sign,f.tz*sign],[-f.tx*sign,-f.tz*sign],[-f.nx,-f.nz],[f.nx,f.nz]]){
  const p=target.clone();p.x+=x*7;p.z+=z*7;collideWorld(p,.34);
  if(rayWorld(p.x,p.z,target.x,target.z,p.y+1,target.y+1,.30)>=1)return p;
 }
 return target.clone();
}
function sceneCarDoor(team,car,slot){
 const f=team.frame,offset=slot%2?-.80:.82;
 const p=new V3(car.pos.x+f.nx*1.38+f.tx*offset,car.pos.y,car.pos.z+f.nz*1.38+f.tz*offset);
 collideWorld(p,.34);return p;
}
function spawnSceneResponder(team,entry){
 const pd=PoliceDepartment,member=pd.staff.find(s=>s.personId===entry.personId),slot=entry.slot;
 if(!member||pd.unavailable.has(member.personId)||pd.bindings.has(member.personId))return;
 const target=teamPoint(team,...scenePositions[slot]);
 const ride=slot<4?team.rides[Math.floor(slot/2)]:null,car=ride?.car;
 if(car?.driver==='scene'&&!car.dead)return;
 const at=entry.onSceneAt!=null?target:car&&cars.includes(car)&&!car.dead&&car.driver!=='player'?sceneCarDoor(team,car,slot):openSceneApproach(target,team,slot);
 const uniform=member.division==='Patrol',c=makeChar(officerModel(member),{gun:true});
 if(uniform)equipOfficer(c,false);
 personalizeOfficer(c,member);fitIssuedEquipment(c,member);
 const unit=departmentPerson(member,c,at,uniform);
 unit.file=team.file;unit.sceneRole=entry.role;unit.sceneEntry=entry;
 unit.sceneGoal=target;unit.sceneCar=car;
 unit.pos.copy(at);c.root.position.copy(at);team.units.set(member.personId,unit);
 pd.bindings.set(member.personId,entry.role+' · file '+team.file.id);
}
let incidentSheetMaterial;
function sceneNotebook(c){
 if(!incidentSheetMaterial){
  const [canvas,g]=cvs(192,256);
  g.fillStyle='#e2dfd1';g.fillRect(0,0,192,256);g.fillStyle='#21344a';g.fillRect(11,14,170,24);
  g.fillStyle='#f5f2e8';g.font='bold 14px Arial';g.fillText('INCIDENT NOTES',19,32);
  g.fillStyle='#687989';for(let y=63;y<239;y+=16)g.fillRect(12,y,168,1);
  g.font='9px Arial';g.fillText('LOCATION',13,55);g.fillText('FILE',125,55);
  incidentSheetMaterial=new THREE.MeshStandardMaterial({map:ctex(canvas),roughness:.91});
 }
 const group=new THREE.Group(),back=new THREE.Mesh(unitBox,policeGearMaterial);
 back.scale.set(.15,.012,.205);group.add(back);
 const sheet=new THREE.Mesh(new THREE.PlaneGeometry(.14,.19),incidentSheetMaterial);
 sheet.rotation.x=-Math.PI/2;sheet.position.y=.007;group.add(sheet);
 group.rotation.x=.25;c.root.add(group);return group;
}
function poseSceneWork(u,steady,dt){
 const c=u.c,b=c.bones,slot=u.sceneEntry.slot;
 if(!b.Root||slot!==0&&slot!==2&&slot!==5)return;
 const forward=new V3(Math.sin(c.yaw),0,Math.cos(c.yaw));
 const side=new V3(forward.z,0,-forward.x);
 const dir=(along,across,height)=>forward.clone().multiplyScalar(along).addScaledVector(side,across).setY(height).normalize();
 if(slot===0){
  u.kneel=(u.kneel||0)+(Number(steady)-(u.kneel||0))*Math.min(1,dt*3.4);
  if(u.kneel<.015)return;
  const w=u.kneel;
  c.root.position.y-=.39*w;c.root.updateMatrixWorld(true);
  pointBone(b.RightThigh,b.RightCalf,dir(.16,.07,-1),w);
  pointBone(b.RightCalf,b.RightFoot,dir(-1,.04,-.08),w);
  pointBone(b.LeftThigh,b.LeftCalf,dir(.96,-.14,-.21),w);
  pointBone(b.LeftCalf,b.LeftFoot,dir(-.04,0,-1),w);
  pointBone(b.RightArm,b.RightForeArm,dir(.54,.2,-.87),w);
  pointBone(b.RightForeArm,b.RightHand,dir(.72,-.12,-.55),w);
  return;
 }
 if(slot!==2&&slot!==5||!b.LeftHand)return;
 if(!steady){if(u.notebook)u.notebook.visible=false;return;}
 if(!u.notebook)u.notebook=sceneNotebook(c);
 u.notebook.visible=true;
 pointBone(b.LeftArm,b.LeftForeArm,dir(.22,-.18,-1));
 pointBone(b.LeftForeArm,b.LeftHand,dir(.81,.21,.29));
 const hand=b.LeftHand.getWorldPosition(new V3());
 u.notebook.position.copy(c.root.worldToLocal(hand.clone()));u.notebook.position.x+=.038;
 pointBone(b.RightArm,b.RightForeArm,dir(.35,.24,-.91));
 hand.addScaledVector(side,.09).addScaledVector(forward,.018*Math.sin(PoliceDepartment.clock*7));hand.y+=.032;
 if(b.RightForeArm)pointBone(b.RightForeArm,b.RightHand,hand.sub(b.RightForeArm.getWorldPosition(new V3())).normalize());
}
function advanceResponder(team,u,dt,departing){
 const entry=u.sceneEntry;
 let target=u.sceneGoal;
 if(departing){
  if(!u.departurePoint)u.departurePoint=u.sceneCar?.sceneFileId===team.file.id?sceneCarDoor(team,u.sceneCar,entry.slot):openSceneApproach(target,team,entry.slot);
  target=u.departurePoint;
 }
 const dx=target.x-u.pos.x,dz=target.z-u.pos.z,d=Math.hypot(dx,dz);
 const pace=d>.25?(departing?1.5:entry.slot===5?1.52:1.93):0;
 if(pace){
  const step=Math.min(d,dt*pace);
  u.pos.x+=dx/d*step;u.pos.z+=dz/d*step;
  const wall=collideWorld(u.pos,.31);
  if(wall){
   const side=Math.sign(dz*wall[0]-dx*wall[1])||1;
   u.pos.x-=wall[1]*side*step;u.pos.z+=wall[0]*side*step;collideWorld(u.pos,.31);
  }
 }
 const look=entry.slot===1&&streetIncidents.current?.file===team.file?streetIncidents.current.call?.ped?.pos:null;
 const face=pace?Math.atan2(dx,dz):look?Math.atan2(look.x-u.pos.x,look.z-u.pos.z):Math.atan2(team.file.at.x-u.pos.x,team.file.at.z-u.pos.z);
 u.c.yaw=lerpA(u.c.yaw,face,Math.min(1,dt*7));
 u.pos.y=groundY(u.pos.x,u.pos.z,u.pos.y);u.c.root.position.copy(u.pos);
 const visible=dist2(player.pos,u.pos)<90||caseViewNear(u.pos,90,6);
 u.c.root.visible=visible;
 u.c.talk=!departing&&!pace&&(entry.slot===1||entry.slot===5)&&Math.sin(PoliceDepartment.clock*.8+entry.slot)>.15?1:0;
 updChar(u.c,pace,dt,visible);
 if(visible)poseSceneWork(u,!departing&&!pace,dt);
 if(!departing&&entry.onSceneAt==null&&dist2(u.pos,team.file.at)<5){
  entry.onSceneAt=PoliceDepartment.clock;
  PoliceDepartment.logCase(team.file,u.officer.name,'On scene · '+entry.role+'.');PoliceDepartment.save();
 }
 return departing&&(d<.5||PoliceDepartment.clock-team.clearingAt>17);
}
function releaseSceneRide(team,ride){
 const car=ride?.car,driver=ride?.driver,pd=PoliceDepartment;
 if(!car||!cars.includes(car)){pd.release(driver);return;}
 car.siren=false;delete car.sceneFileId;delete car.sceneStop;
 if(car.dead||car.driver==='player'){pd.release(driver);return;}
 const f=team.frame,b=nearestNode(car.pos),a=b.slice();
 if(f.northSouth){
  b[1]=clamp(f.tz>0?Math.ceil(car.pos.z/CELL):Math.floor(car.pos.z/CELL),0,N);
  a[1]=clamp(b[1]-f.tz,0,N);
 }else{
  b[0]=clamp(f.tx>0?Math.ceil(car.pos.x/CELL):Math.floor(car.pos.x/CELL),0,N);
  a[0]=clamp(b[0]-f.tx,0,N);
 }
 const returningDriver=driver&&!pd.unavailable.has(driver.personId)?driver:null;
 if(returningDriver&&(a[0]!==b[0]||a[1]!==b[1])){
  car.ai={a,b,lane:0};car.driver='scene return';car.officer=returningDriver;
 }else{
  car.driver=null;pd.release(driver);
 }
 setCarLights(car,false);returningSceneCars.set(car,{site:team.file.at,leftAt:pd.clock});
}
function clearReturnedSceneCars(){
 for(const [car,returnTrip] of returningSceneCars){
  if(!cars.includes(car)||car.dead||car.driver==='player'){
   if(car.driver==='player'||car.dead){PoliceDepartment.release(car.officer);car.officer=null;}
   returningSceneCars.delete(car);continue;
  }
  const outOfView=dist2(car.pos,player.pos)>52&&!caseViewNear(car.pos,52,6);
  if(outOfView&&(!car.driver||dist2(car.pos,returnTrip.site)>32||PoliceDepartment.clock-returnTrip.leftAt>24)){
   removeCar(car);returningSceneCars.delete(car);
  }
 }
}
function updateStreetTeams(dt){
 const pd=PoliceDepartment;
 clearReturnedSceneCars();
 for(const file of pd.cases){
  if(!file.response||!pd.streetResponseActive(file)||streetTeams.has(file.id))continue;
  if(dist2(player.pos,file.at)>58&&!caseViewNear(file.at,58,5))continue;
  streetTeams.set(file.id,{file,frame:sceneStreetFrame(file.at),units:new Map(),rides:[]});
 }
 for(const [id,team] of streetTeams){
  const file=team.file,active=pd.streetResponseActive(file);
  for(const ride of team.rides){
   const car=ride?.car;
   if(!car||cars.includes(car)&&!car.dead&&car.driver!=='player')continue;
   pd.release(ride.driver);ride.driver=null;ride.car=null;car.siren=false;delete car.sceneFileId;
  }
  if(active){
   for(const entry of file.response){
    if(team.units.has(entry.personId)||pd.clock<entry.assignedAt+entry.slot*1.12)continue;
    const index=Math.floor(entry.slot/2);
    if(entry.slot<4&&team.rides[index]===undefined)team.rides[index]=startSceneRide(team,index);
    spawnSceneResponder(team,entry);
   }
   if(file.stage==='Lab review'&&!team.units.has(file.detective)){
    if(team.detective?.personId!==file.detective)team.detective={personId:file.detective,role:'Case detective',slot:5};
    spawnSceneResponder(team,team.detective);
   }
  }else team.clearingAt??=pd.clock;
  for(const [personId,u] of team.units){
   const leaving=!active||!pd.fieldAssignment(file,personId);
   if(u.dead){u.downT+=dt;updChar(u.c,0,dt,true);if(u.downT<15)continue;}
   else if(!advanceResponder(team,u,dt,leaving))continue;
   removeDepartmentPerson(u);team.units.delete(personId);
   const ride=u.sceneEntry.slot<4&&team.rides[Math.floor(u.sceneEntry.slot/2)];
   if(ride?.car&&!ride.driver&&!u.dead){
    ride.driver=u.officer;pd.bindings.set(personId,'Returning from file '+id);
   }
  }
  const lead=team.units.get(pd.assigned(file));
  if(lead)fieldInvestigators.set(id,lead);else fieldInvestigators.delete(id);
  if(!active&&!team.units.size){
   for(const ride of team.rides)releaseSceneRide(team,ride);
   streetTeams.delete(id);
  }
 }
}
