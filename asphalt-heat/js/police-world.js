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
const policeBadgeMaterial=new THREE.MeshStandardMaterial({color:0xd7b877,metalness:.62,roughness:.37});
function equipOfficer(c,metro){
 // Attach the assembled belt, radio and camera to the animated torso in its current world pose.
 const rig=new THREE.Group();
 function part(mat,x,y,z,w,h,d){
  const mesh=new THREE.Mesh(unitBox,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);rig.add(mesh);
 }
 part(policeGearMaterial,0,.98,0,.37,.065,.22);
 part(policeGearMaterial,-.21,1.01,.025,.072,.15,.06);
 part(policeGearMaterial,-.22,1.12,.02,.012,.09,.012);
 part(policeGearMaterial,.20,.94,.015,.079,.19,.10);
 part(policeGearMaterial,0,1.31,.135,.07,.085,.036);
 part(policeBadgeMaterial,.095,1.38,.131,.046,.062,.012);
 if(metro){
  part(policeGearMaterial,0,1.23,0,.39,.33,.245);
  for(const x of [-.12,0,.12])part(policeGearMaterial,x,1.17,.15,.085,.12,.05);
 }
 c.root.add(rig);c.root.updateMatrixWorld(true);c.bones.Spine2?.attach(rig);
}
function updateStationPosts(dt){
 for(const station of PoliceDepartment.stations)for(const post of station.posts){
  const nearby=dist2(player.pos,post.point)<58&&Math.abs(player.pos.y-post.point.y)<3.5;
  if(post.unit?.dead&&nearby&&post.unit.downT<15){
   post.unit.downT+=dt;updChar(post.actor,0,dt,true);continue;
  }
  const calledOut=post.member&&(PoliceDepartment.bindings.has(post.member.personId)||PoliceDepartment.cases.some(c=>PoliceDepartment.assigned(c)===post.member.personId));
  if(post.actor&&(!nearby||calledOut||!PoliceDepartment.working(post.member))){
   PoliceDepartment.workstations.delete(post.member.personId);removeDepartmentPerson(post.unit,false);post.member=post.actor=post.unit=null;
  }
  if(!nearby)continue;
  if(!post.actor){
   const member=PoliceDepartment.staff.find(s=>s.division===post.role&&PoliceDepartment.working(s)&&!PoliceDepartment.bindings.has(s.personId)&&
    !PoliceDepartment.workstations.has(s.personId)&&!PoliceDepartment.cases.some(c=>PoliceDepartment.assigned(c)===s.personId));
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
  if(entry.stage!=='Unreported')continue;
  const witness=witnessesFor(entry.at.x,entry.at.z,entry.at.y);
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
 departmentPeople.push(unit);return unit;
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
 if(dist2(player.pos,file.at)>48)return true;
 const unit=fieldInvestigators.get(file.id);
 return !!unit&&!unit.dead&&Math.abs(unit.pos.y-(file.at.y||0))<1.8&&dist2(unit.pos,file.at)<4.8;
};
function updateFieldDetectives(dt){
 const pd=PoliceDepartment;
 for(const [fileId,u] of fieldInvestigators){
  const file=u.file;
  if(u.dead){u.downT+=dt;updChar(u.c,0,dt,true);if(u.downT<15)continue;}
  if(pd.assigned(file)===u.personId&&!u.dead&&dist2(player.pos,file.at)<64){
   const dx=file.at.x-u.pos.x,dz=file.at.z-u.pos.z,length=Math.hypot(dx,dz),pace=length>1.45?1.35:0;
   if(pace){u.pos.x+=dx/length*pace*dt;u.pos.z+=dz/length*pace*dt;collideWorld(u.pos,.34);}
   u.pos.y=groundY(u.pos.x,u.pos.z,u.pos.y);u.c.root.position.copy(u.pos);
   u.c.yaw=Math.atan2(dx,dz);u.c.talk=pace?0:1;updChar(u.c,pace,dt,true);continue;
  }
  removeDepartmentPerson(u);fieldInvestigators.delete(fileId);
 }
 for(const file of pd.cases){
  const assignee=pd.assigned(file);
  if(!assignee||fieldInvestigators.has(file.id)||dist2(player.pos,file.at)>52)continue;
  const member=pd.staff.find(s=>s.personId===assignee);
  if(!member||pd.bindings.has(member.personId)||pd.unavailable.has(member.personId))continue;
  const at=new V3(file.at.x,file.at.y||0,file.at.z);
  for(const [dx,dz] of [[4,0],[-4,0],[0,4],[0,-4]]){
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
