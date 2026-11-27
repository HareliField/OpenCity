/* An encounter belongs to the pedestrians. Watching it never starts or advances it. */
const streetIncidents={current:null,nextCheck:6};
const discoveryCalls=new Map();
const neighborhoodResidents=[
 ['AH-R0032','Hollis Fry','Male_Adult_04'],['AH-R0033','Opal Finch','Female_Adult_03'],
 ['AH-R0034','Priya Tal','Business_Female_01'],['AH-R0035','Jude Wick','Male_Adult_08'],
 ['AH-R0037','Art Robles','Business_Male_01'],['AH-R0038','Toby Lin','Male_Adult_03']
];
const bagLeather=new THREE.MeshStandardMaterial({color:0x774a30,roughness:.78});
const bagHandle=new THREE.TorusGeometry(.096,.012,8,16,Math.PI);
let callHandsetModel;
function callHandset(){
 if(!callHandsetModel){
  const phone=new THREE.Group(),outline=new THREE.Shape(),w=.034,h=.071,r=.006;
  outline.moveTo(-w+r,-h);outline.lineTo(w-r,-h);outline.quadraticCurveTo(w,-h,w,-h+r);
  outline.lineTo(w,h-r);outline.quadraticCurveTo(w,h,w-r,h);
  outline.lineTo(-w+r,h);outline.quadraticCurveTo(-w,h,-w,h-r);
  outline.lineTo(-w,-h+r);outline.quadraticCurveTo(-w,-h,-w+r,-h);
  const shell=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.007,bevelEnabled:true,bevelThickness:.001,
   bevelSize:.001,bevelSegments:2,curveSegments:4}),new THREE.MeshStandardMaterial({color:0x101416,roughness:.47,metalness:.43}));
  shell.position.z=-.004;phone.add(shell);
  const lensMaterial=new THREE.MeshStandardMaterial({color:0x09111b,roughness:.14,metalness:.62});
  for(const y of [.056,.045]){
   const lens=new THREE.Mesh(new THREE.CylinderGeometry(.0043,.0043,.003,12),lensMaterial);
   lens.rotation.x=Math.PI/2;lens.position.set(-.022,y,.005);phone.add(lens);
  }
  callHandsetModel=phone;
 }
 return callHandsetModel.clone();
}

function givePedestrianBag(p){
 const bag=new THREE.Group(),body=new THREE.Mesh(unitBox,bagLeather);
 body.scale.set(.40,.23,.18);body.position.y=-.18;bag.add(body);
 const handle=new THREE.Mesh(bagHandle,bagLeather);handle.position.y=-.073;bag.add(handle);
 p.c.root.add(bag);p.bag=bag;
 // The pavement holdalls and the carried exhibit share the same reviewed model.
 const asset=requestScenery('leather-holdall');
 asset?.then(template=>{
  if(!template||!bag.parent)return;
  const model=modelInstance(template,[.43,.32,.20],'leather-holdall');
  model.position.y=-.31;bag.clear();bag.add(model);
 });
}
function newStreetIdentity(p){
 if(p.castAssigned){delete p.castAssigned;delete p.personId;delete p.residentName;}
 p.startledAt=null;p.scenePass=null;
 if(p.neighborhood){delete p.personId;delete p.residentName;delete p.neighborhood;}
 p.bag?.parent?.remove(p.bag);p.bag=null;
}
function seedNeighborhoodWalkers(){
 const home=blocks.reduce((best,b)=>{
  const r=perim(b),t=perimT(r,player.pos.x,player.pos.z),[x,z]=perimPos(r,t);
  const d=Math.hypot(player.pos.x-x,player.pos.z-z);
  return !best||d<best.d?{r,t,d}:best;
 },null);
 // The six people who know each other from the Old Town bicycle story walk ordinary sidewalk routes.
 const residents=neighborhoodResidents.filter(([id])=>!PoliceDepartment.cases.some(f=>f.victimId===id||f.pendingScene?.victimId===id||f.suspect===id));
 for(let i=residents.length-1;i>0;i--){
  const j=rint(0,i);[residents[i],residents[j]]=[residents[j],residents[i]];
 }
 for(const [i,[id,name,model]] of residents.entries()){
  const p=peds[i];if(!p)break;
  p.bag?.parent?.remove(p.bag);
  if(TPL[model]){removeChar(p.c);p.c=makeChar(model,{});}
  globalThis.ResidentCast?.assign(p,'oldtown',id);p.personId=id;p.residentName=name;p.neighborhood='Old Town counter';PoliceDepartment.identify(p);
  p.R=home.r;p.t=home.t-14+i*5.6+rnd(-.65,.65);p.dir=i%2?-1:1;p.mode='walk';
  const [x,z]=perimPos(p.R,p.t);p.pos.set(x,groundY(x,z),z);
  collideWorld(p.pos,.31);p.c.root.position.copy(p.pos);p.c.root.visible=true;
  p.bag=null;if(i===Math.floor(residents.length/2))givePedestrianBag(p);
 }
}
function streetResidentName(p){return p.residentName||'Resident '+p.personId.replace(/^ah-person-/,'');}
function freeWalker(p){return !p.dead&&!p.cross&&(p.mode==='walk'||p.mode==='stand');}
function streetAddress(pos){
 const b=blockOf(pos.x,pos.z)||blocks[clamp(Math.floor(pos.x/CELL),0,N-1)*N+clamp(Math.floor(pos.z/CELL),0,N-1)];
 const district={oldtown:'Old Town',midtown:'Midtown',downtown:'Downtown',docks:'Docks',beach:'Coast Ridge',suburb:'Eastside'}[b?.dist]||'City';
 return district+' · block '+(b.i+1)+' / '+(b.j+1);
}
function streetWitnesses(a){
 return peds.filter(p=>p!==a.offender&&p!==a.victim&&!p.dead&&dist2(p.pos,a.victim.pos)<22&&los(p.pos,a.victim.pos))
  .sort((p,q)=>dist2(p.pos,a.victim.pos)-dist2(q.pos,a.victim.pos));
}
function faceStreetActor(p,target){p.c.yaw=Math.atan2(target.x-p.pos.x,target.z-p.pos.z);}
function startStreetEncounter(){
 const pd=PoliceDepartment;
 if(wanted||pd.cases.some(c=>c.origin==='street'&&pd.clock-c.opened<480))return;
 const nearby=peds.filter(p=>freeWalker(p)&&p.c.root.visible&&dist2(player.pos,p.pos)<58);
 let pair=null,best=Infinity;
 for(const victim of nearby){
  if(!victim.bag)continue;
  for(const other of nearby){
   if(other===victim||other.bag||Math.abs(victim.pos.y-other.pos.y)>.65)continue;
   const gap=dist2(victim.pos,other.pos);
   if(gap<1.3||gap>16||!los(victim.pos,other.pos))continue;
   const score=gap+.25*dist2(player.pos,victim.pos);
   if(score<best){best=score;pair={offender:other,victim};}
  }
 }
 if(!pair)return;
 const a={...pair,phase:'Approach',since:time,at:pair.victim.pos.clone(),file:null,call:null,eyes:new Map(),bag:null};
 a.offender.mode='encounter';a.victim.mode='encounter';streetIncidents.current=a;
 globalThis.commonstreetAgentEvent?.('street-encounter',{at:{x:a.at.x,z:a.at.z},victim:a.victim.personId});
}
function leaveEncounter(p){
 if(p&&!p.dead&&p.mode==='encounter'){p.c.talk=0;attachPed(p);}
}
const evidenceTentFace=new THREE.PlaneGeometry(.24,Math.hypot(.21,.078));
function clearStreetMarker(a){
 const marker=a.evidenceMarker;
 if(!marker)return;
 marker.parent?.remove(marker);
 const material=marker.children[0].material;
 material.map.dispose();material.dispose();a.evidenceMarker=null;
}
function markStreetExhibit(a){
 if(a.evidenceMarker||!a.bag||!a.file.custody)return;
 // Intake numbers the physical traces in evidence order. An incidental print can be ahead of the bag.
 const physical=a.file.evidence.filter(e=>e.type==='Print'||e.type==='DNA');
 const index=physical.findIndex(e=>e.exhibit&&e.exhibit===a.file.linkedExhibit);
 const tag=a.file.custody[index]?.tag;
 if(!tag)return;
 const [canvas,g]=cvs(288,256);
 g.fillStyle='#f5c342';g.fillRect(0,0,288,256);g.fillStyle='#262724';g.textAlign='center';
 g.font='bold 28px Arial';g.fillText('EXHIBIT',144,55);
 g.fillRect(24,75,240,4);g.font='bold 88px Arial';g.fillText(tag,144,185,254);
 const material=new THREE.MeshStandardMaterial({map:ctex(canvas),roughness:.91});
 const marker=new THREE.Group(),fold=Math.atan2(.078,.21);
 for(const side of [-1,1]){
  const panel=new THREE.Mesh(evidenceTentFace,material);
  panel.rotation.order='YXZ';panel.rotation.y=side<0?Math.PI:0;panel.rotation.x=-fold;
  panel.position.set(0,.105,side*.039);marker.add(panel);
 }
 const p=a.bag.position,f=sceneStreetFrame(p);
 const along=(p.x-a.file.at.x)*f.tx+(p.z-a.file.at.z)*f.tz>=0?.34:-.34;
 marker.position.set(p.x+along*f.tx-.29*f.nx,p.y,p.z+along*f.tz-.29*f.nz);
 collideWorld(marker.position,.13);
 marker.position.y=groundY(marker.position.x,marker.position.z,p.y)+.008;
 marker.rotation.y=Math.atan2(-f.nx,-f.nz);marker.userData.custodyTag=tag;
 scene.add(marker);a.evidenceMarker=marker;
}
function finishStreetEncounter(a){
 clearStreetMarker(a);
 leaveEncounter(a.offender);leaveEncounter(a.victim);leaveEncounter(a.onlooker);leaveEncounter(a.call?.ped);
 if(a.bag!==a.offender.bag)a.bag?.parent?.remove(a.bag);a.phone?.parent?.remove(a.phone);streetIncidents.current=null;streetIncidents.nextCheck=time+12;
 stopCaseCamera();
}
function seeStreetAttack(p,a){
 if(!los(p.pos,a.offender.pos))return false;
 const dx=a.offender.pos.x-p.pos.x,dz=a.offender.pos.z-p.pos.z;
 return dx*Math.sin(p.c.yaw)+dz*Math.cos(p.c.yaw)>.15*Math.hypot(dx,dz);
}
function strikeInStreet(a){
 const {victim,offender}=a,pd=PoliceDepartment,at=victim.pos.clone();
 // Snapshot hearing at the instant of the shot. Someone arriving later can only report what they find.
 a.heard=new Map();
 for(const p of peds){
  if(p===victim||p===offender||p.dead)continue;
  const distance=p.pos.distanceTo(offender.pos);
  if(distance>44||distance>30&&!los(p.pos,offender.pos))continue;
  a.heard.set(p.personId,{ped:p,at:p.pos.clone(),distance});
 }
 for(const p of streetWitnesses(a)){
  if(seeStreetAttack(p,a))a.eyes.set(p.personId,Boolean(p.neighborhood&&p.neighborhood===offender.neighborhood));
  if(p!==a.onlooker&&freeWalker(p)&&dist2(p.pos,at)<9){
   faceStreetActor(p,at);p.startledAt=at;p.mode='cower';p.cowerT=1.7+dist2(p.pos,at)*.14;
  }
 }
 offender.c.aim=.5;
 const from=offender.pos.clone();from.y+=1.28;const to=at.clone();to.y+=1.05;
 tracer(from,to);emit(from.x,from.y,from.z,0,0,0,.06,.30,.8,0xffdb9a,true);
 noise(.12,1800,distVol(from.x,from.z,.28));
 if(a.onlooker)a.onlooker.c.talk=0;
 const dx=at.x-offender.pos.x,dz=at.z-offender.pos.z;
 victim.hp=Math.max(0,victim.hp-80);
 if(victim.hp>0){finishStreetEncounter(a);return;}
 killPed(victim,dx*.65,.25,dz*.65,false,false);
 a.attacker={id:offender.personId,name:streetResidentName(offender)};
 a.at.copy(at);a.phase='Aftermath';a.since=time;
 a.file=pd.file({kind:'Homicide',origin:'street',linkedExhibit:a.bag.exhibit,at,victim:victim.personId,victimName:streetResidentName(victim),
  title:'Homicide · '+streetAddress(at),reported:false});
 offender.mode='flee';offender.c.talk=0;offender.fleeT=6;
 offender.fv.set(-dx,0,-dz).normalize();
 globalThis.commonstreetAgentEvent?.('street-death',{file:a.file.id,victim:victim.personId});
}
function beginStreetCall(a){
 const eligible=p=>freeWalker(p)||p===a.onlooker&&p.mode==='encounter'&&!p.dead;
 const nearby=streetWitnesses(a).filter(eligible);
 const listeners=[...a.heard.entries()].filter(([id,h])=>h.ped.personId===id&&eligible(h.ped))
  .sort(([,left],[,right])=>left.distance-right.distance);
 // An eyewitness can call after fleeing, even after losing sight of the scene.
 let ped=nearby.find(p=>a.eyes.has(p.personId))||listeners.find(([id,h])=>a.eyes.has(id)&&dist2(h.ped.pos,a.offender.pos)>8)?.[1].ped;
 let observation='eyewitness';
 if(!ped){
  ped=nearby.find(p=>{
   const dx=a.at.x-p.pos.x,dz=a.at.z-p.pos.z,d=Math.hypot(dx,dz);
   return d<2.6||d<12&&dx*Math.sin(p.c.yaw)+dz*Math.cos(p.c.yaw)>d*.16;
  });
  observation='discovery';
 }
 if(!ped&&time-a.since>=1.65){
  ped=listeners.find(([,h])=>dist2(h.ped.pos,a.offender.pos)>8)?.[1].ped;
  observation='heard';
 }
 if(!ped)return;
 ped.mode='encounter';faceStreetActor(ped,a.at);
 a.call={ped,id:ped.personId,observation,due:time+3.6};a.phase='Calling 911';
 globalThis.commonstreetAgentEvent?.('911-dial',{file:a.file.id,caller:ped.personId,observation});
}
function receiveStreetCall(a){
 const {ped,id,observation}=a.call;
 if(ped.dead||ped.personId!==id||ped.mode!=='encounter'){
  a.call=null;a.phase='Aftermath';return;
 }
 if(time<a.call.due)return;
 const f=a.file,name=streetResidentName(ped);
 const recognized=observation==='eyewitness'&&a.eyes.get(id);
 let statement='I found someone down on the pavement. I did not see who did it.';
 if(observation==='heard'){
  const reportArea=streetAddress(a.heard.get(id).at);
  statement='I heard a shot while I was near '+reportArea+'. I could not see who fired.';
  f.pendingScene={title:f.title,victimId:f.victimId,victimName:f.victimName,evidence:f.evidence.slice()};
  f.kind='Gunfire report';f.title='Gunfire report near '+reportArea;
  f.victimId=null;f.victimName=null;f.evidence=[];f.reportArea=reportArea;
 }else if(observation==='eyewitness'){
  statement=recognized?'I saw '+a.attacker.name+' fire. I know them from the Old Town counter.':'I saw someone fire, but I could not identify them.';
 }
 f.caller={id,name,observation};f.evidence.push({type:'Statement',source:name,value:statement});
 if(recognized){f.contact=a.attacker.id;f.subjectName=a.attacker.name;}
 PoliceDepartment.receiveCall(f,'911 · '+name,statement+(observation==='heard'?' Approximate area received.':' Location received.')+' Patrol requested.');
 a.phase='Reported';a.since=time;
}
function interviewAtScene(a){
 const f=a.file,officer=fieldInvestigators.get(f.id);
 if(f.contact||f.interviewed||!officer||officer.dead||dist2(officer.pos,f.at)>4.8)return;
 const witness=peds.find(p=>!p.dead&&p.personId!==f.caller?.id&&a.eyes.get(p.personId)&&
  dist2(p.pos,officer.pos)<8&&los(p.pos,officer.pos));
 if(!witness)return;
 const name=streetResidentName(witness);
 f.evidence.push({type:'Statement',source:name,value:'I know '+a.attacker.name+' and saw them fire.'});
 f.interviewed=witness.personId;f.contact=a.attacker.id;f.subjectName=a.attacker.name;
 PoliceDepartment.logCase(f,officer.officer.name,'Interviewed '+name+' at the scene. Witness named '+a.attacker.name+'.','Detectives');
 PoliceDepartment.save();
}
function streetPedReserved(p){
 const a=streetIncidents.current;
 if(!a)return false;
 if(!a.file)return p===a.offender||p===a.victim||p===a.onlooker;
 return (p===a.victim||p===a.call?.ped)&&['Unreported','Filed','Patrol assigned','Scene review','Lab review'].includes(a.file.stage);
}
function handoverGrip(p,a){
 if(!a||p!==a.victim&&p!==a.offender||a.phase!=='Dispute'&&a.phase!=='Struggle')return null;
 const other=p===a.victim?a.offender:a.victim;
 const b=p.c.bones;
 if(!b.RightArm||!b.RightForeArm||!b.RightHand||!other.c.bones.RightArm)return null;
 const age=time-a.since,victim=p===a.victim;
 const smooth=THREE.MathUtils.smoothstep;
 const weight=a.phase==='Dispute'?smooth(age,victim?.7:1.15,victim?1.85:2.18):
  1-smooth(age,victim?.08:.56,victim?.76:1.72);
 if(weight===0)return null;
 if(!a.gripCenter){
  const carrying=a.victim.c.bones.RightArm.getWorldPosition(new V3());
  const receiving=a.offender.c.bones.RightArm.getWorldPosition(new V3());
  a.gripCenter=carrying.clone().lerp(receiving,.5);a.gripCenter.y=Math.min(carrying.y,receiving.y)-.225;
  a.gripSide=new V3(Math.cos(a.victim.c.yaw),0,-Math.sin(a.victim.c.yaw));
 }
 const offset=a.gripSide.clone().multiplyScalar(victim?.031:-.031);
 const contact=a.gripCenter.clone().add(offset);
 const hand=b.RightHand.getWorldPosition(new V3()).lerp(contact,weight);
 const pole=new V3(-.45*Math.cos(p.c.yaw),-1,.45*Math.sin(p.c.yaw));
 reachDriverLimb(b.RightArm,b.RightForeArm,b.RightHand,hand,pole);
 return weight;
}
function poseStreetProps(p){
 const a=streetIncidents.current,gripWeight=handoverGrip(p,a);
 if(p.bag&&p.c.bones.RightHand){
  const world=p.c.bones.RightHand.getWorldPosition(new V3());
  if(gripWeight)world.lerp(a.gripCenter,gripWeight);
  p.c.root.worldToLocal(world);p.bag.position.copy(world);
 }
 if(a?.phase!=='Calling 911'||p!==a.call?.ped||p.dead)return;
 const b=p.c.bones,forward=new V3(Math.sin(p.c.yaw),0,Math.cos(p.c.yaw));
 pointBone(b.RightArm,b.RightForeArm,new V3(forward.x*.52,-.80,forward.z*.52).normalize());
 if(!b.Head||!b.RightArm||!b.RightForeArm||!b.RightHand)return;
 const head=b.Head.getWorldPosition(new V3()),side=b.RightArm.getWorldPosition(new V3()).sub(head);
 side.y=0;side.normalize();
 const ear=head.addScaledVector(side,.106);ear.y+=.065;
 pointBone(b.RightForeArm,b.RightHand,ear.clone().sub(b.RightForeArm.getWorldPosition(new V3())).normalize());
 if(!a.phone){
  a.phone=callHandset();scene.add(a.phone);
 }
 a.phone.position.copy(ear);a.phone.rotation.set(.07,Math.atan2(side.x,side.z),-.11);
}
function updateStreetEncounter(dt){
 let a=streetIncidents.current;
 if(!a){
  if(time<streetIncidents.nextCheck)return;
  streetIncidents.nextCheck=time+2;startStreetEncounter();return;
 }
 const {offender,victim}=a;
 if(!a.file){
  if(offender.dead||victim.dead||offender.mode!=='encounter'||victim.mode!=='encounter'||time-a.since>18||
   dist2(player.pos,victim.pos)>78||!los(offender.pos,victim.pos)){finishStreetEncounter(a);return;}
  faceStreetActor(offender,victim.pos);faceStreetActor(victim,offender.pos);
  if(a.phase==='Approach'){
   const dx=victim.pos.x-offender.pos.x,dz=victim.pos.z-offender.pos.z,d=Math.hypot(dx,dz);
   if(d>.78){
    const stride=Math.min(d-.74,1.6*dt);offender.pos.x+=dx/d*stride;offender.pos.z+=dz/d*stride;collideWorld(offender.pos,.29);
    return;
   }
   a.phase='Dispute';a.since=time;victim.c.talk=offender.c.talk=1;
   a.onlooker=streetWitnesses(a).find(freeWalker);
   if(a.onlooker){a.onlooker.mode='encounter';faceStreetActor(a.onlooker,victim.pos);}
  }else if(a.phase==='Dispute'&&time-a.since>=2.5){
   if(dist2(offender.pos,victim.pos)>1.35||!victim.bag){finishStreetEncounter(a);return;}
   const bag=victim.bag,at=bag.getWorldPosition(new V3());
   bag.exhibit=victim.personId+' / holdall / '+PoliceDepartment.clock.toFixed(2);
   PoliceDepartment.touch(victim,bag,at,'Dropped leather holdall');
   offender.c.root.attach(bag);offender.bag=bag;victim.bag=null;a.bag=bag;
   poseStreetProps(offender);
   PoliceDepartment.touch(offender,bag,bag.getWorldPosition(at),'Dropped leather holdall');
   a.phase='Struggle';a.since=time;
  }else if(a.phase==='Struggle'&&time-a.since>=2){
   scene.attach(a.bag);offender.bag=null;
   a.dropHeight=a.bag.position.y;
   a.pavement=groundY(a.bag.position.x,a.bag.position.z,victim.pos.y)+.32;
   if(!offender.c.gun)offender.c.gun=makeGun();
   offender.c.aim=.58;a.phase='Draw';a.since=time;
  }else if(a.phase==='Draw'){
   const fall=time-a.since;
   a.bag.position.y=Math.max(a.pavement,a.dropHeight-4.905*fall*fall);
   if(fall>=.38){
    if(dist2(offender.pos,victim.pos)<=1.7)strikeInStreet(a);else finishStreetEncounter(a);
   }
  }
  return;
 }
 if(a.phase==='Aftermath'&&time-a.since>=.95)beginStreetCall(a);
 else if(a.phase==='Calling 911')receiveStreetCall(a);
 if(a.phase!=='Calling 911'&&a.phone){scene.remove(a.phone);a.phone=null;}
 const stage=a.file.stage;
 if(stage==='Scene review'||stage==='Lab review')markStreetExhibit(a);
 else clearStreetMarker(a);
 if(stage==='Patrol assigned')interviewAtScene(a);
 if(stage==='Patrol assigned'||stage==='Scene review'||stage==='Lab review'){
  for(const p of peds){
   if(p.mode!=='walk'||p.dead||p.cross||p.scenePass===a.file.id||dist2(p.pos,a.at)>3.8)continue;
   const [nextX,nextZ]=perimPos(p.R,p.t+p.dir*.6);
   if(Math.hypot(nextX-a.at.x,nextZ-a.at.z)>=dist2(p.pos,a.at))continue;
   p.scenePass=a.file.id;p.dir*=-1;faceStreetActor(p,a.at);p.mode='stand';p.standT=1.8;p.c.talk=0;
  }
 }
 if(stage==='Lab queue'||stage==='Evidence examination'||stage==='Command queue'||stage==='Command review'||
  stage==='Wanted'||stage==='Booked'||stage==='Open leads'){
  leaveEncounter(a.call?.ped);leaveEncounter(a.onlooker);
  if(a.bag){
   const bench=PoliceDepartment.stations.find(s=>s.exhibitBench)?.exhibitBench;
   if(bench&&stage==='Evidence examination'){a.bag.visible=true;a.bag.position.copy(bench);}
   else a.bag.visible=false;
  }
 }
 if(['Wanted','Booked','Open leads'].includes(stage)){
  a.finishedAt??=time;if(time-a.finishedAt>12)finishStreetEncounter(a);
 }else if(stage==='Unreported'&&time-a.since>60&&!a.call){finishStreetEncounter(a);}
}

// Resumed files can outlive their street actors. A passerby who discovers the scene can report only that discovery.
function discoverStreetScene(file,observation){
 const pending=discoveryCalls.get(file.id);
 if(pending){
  if(pending.ped.dead||pending.ped.personId!==pending.id){discoveryCalls.delete(file.id);return;}
  if(time<pending.due)return;
  file.caller={id:pending.id,name:streetResidentName(pending.ped)};
  const message='I found someone down on the pavement. I did not see who did it.';
  file.evidence.push({type:'Statement',source:file.caller.name,value:message});
  PoliceDepartment.receiveCall(file,'911 · '+file.caller.name,message+' Location received. Patrol requested.');
  discoveryCalls.delete(file.id);return;
 }
 if(observation.officers){PoliceDepartment.receiveCall(file,'Patrol','Scene discovered on patrol. Assistance requested.');return;}
 if(observation.ped)discoveryCalls.set(file.id,{ped:observation.ped,id:observation.ped.personId,due:time+3.6});
}
