/* An encounter belongs to the pedestrians. Watching it never starts or advances it. */
const streetIncidents={current:null,nextCheck:6};
const discoveryCalls=new Map();
const neighborhoodResidents=[
 ['AH-R0032','Hollis Fry','Male_Adult_04'],['AH-R0033','Opal Finch','Female_Adult_03'],
 ['AH-R0034','Priya Tal','Business_Female_01'],['AH-R0035','Jude Wick','Male_Adult_08'],
 ['AH-R0037','Art Robles','Business_Male_01'],['AH-R0038','Toby Lin','Male_Adult_03']
];
const bagLeather=new THREE.MeshStandardMaterial({color:0x774a30,roughness:.78});
const handsetMaterial=new THREE.MeshStandardMaterial({color:0x1c292f,roughness:.38});
const bagHandle=new THREE.TorusGeometry(.096,.012,8,16,Math.PI);

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
 const residents=neighborhoodResidents.filter(([id])=>!PoliceDepartment.cases.some(f=>f.victimId===id||f.suspect===id));
 for(let i=residents.length-1;i>0;i--){
  const j=rint(0,i);[residents[i],residents[j]]=[residents[j],residents[i]];
 }
 for(const [i,[id,name,model]] of residents.entries()){
  const p=peds[i];if(!p)break;
  p.bag?.parent?.remove(p.bag);
  if(TPL[model]){removeChar(p.c);p.c=makeChar(model,{});}
  p.personId=id;p.residentName=name;p.neighborhood='Old Town counter';PoliceDepartment.identify(p);
  p.R=home.r;p.t=home.t-14+i*5.6+rnd(-.65,.65);p.dir=i%2?-1:1;p.mode='walk';
  const [x,z]=perimPos(p.R,p.t);p.pos.set(x,groundY(x,z),z);
  collideWorld(p.pos,.31);p.c.root.position.copy(p.pos);p.c.root.visible=true;
  p.bag=null;if(i%3===0)givePedestrianBag(p);
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
   if(gap<1.3||gap>10||!los(victim.pos,other.pos))continue;
   const score=gap+.25*dist2(player.pos,victim.pos);
   if(score<best){best=score;pair={offender:other,victim};}
  }
 }
 if(!pair)return;
 const a={...pair,phase:'Approach',since:time,at:pair.victim.pos.clone(),file:null,call:null,eyes:new Map(),bag:null};
 a.offender.mode='encounter';a.victim.mode='encounter';streetIncidents.current=a;
 globalThis.asphaltAgentEvent?.('street-encounter',{at:{x:a.at.x,z:a.at.z},victim:a.victim.personId});
}
function leaveEncounter(p){
 if(p&&!p.dead&&p.mode==='encounter'){p.c.talk=0;attachPed(p);}
}
function finishStreetEncounter(a){
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
 for(const p of streetWitnesses(a))if(seeStreetAttack(p,a))a.eyes.set(p.personId,
  Boolean(p.neighborhood&&p.neighborhood===offender.neighborhood));
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
 globalThis.asphaltAgentEvent?.('street-death',{file:a.file.id,victim:victim.personId});
}
function beginStreetCall(a){
 const ped=streetWitnesses(a).find(p=>freeWalker(p)||p===a.onlooker&&p.mode==='encounter');
 if(!ped)return;
 ped.mode='encounter';faceStreetActor(ped,a.at);
 a.call={ped,id:ped.personId,due:time+3.6};a.phase='Calling 911';
 globalThis.asphaltAgentEvent?.('911-dial',{file:a.file.id,caller:ped.personId});
}
function receiveStreetCall(a){
 const {ped,id}=a.call;
 if(ped.dead||ped.personId!==id||ped.mode!=='encounter'){
  a.call=null;a.phase='Aftermath';return;
 }
 if(time<a.call.due)return;
 const f=a.file,seen=a.eyes.has(id),recognized=seen&&a.eyes.get(id);
 const name=streetResidentName(ped);
 const statement=recognized?'I saw '+a.attacker.name+' fire. I know them from the Old Town counter.':
  seen?'I saw someone fire, but I could not identify them.':'I found someone down on the pavement. I did not see who did it.';
 f.caller={id,name};f.evidence.push({type:'Statement',source:name,value:statement});
 if(recognized){f.contact=a.attacker.id;f.subjectName=a.attacker.name;}
 PoliceDepartment.receiveCall(f,'911 · '+name,statement+' Location received. Patrol requested.');
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
function poseStreetProps(p){
 if(p.bag&&p.c.bones.RightHand){
  const world=p.c.bones.RightHand.getWorldPosition(new V3());p.c.root.worldToLocal(world);p.bag.position.copy(world);
 }
 const a=streetIncidents.current;
 if(a?.phase!=='Calling 911'||p!==a.call?.ped||p.dead)return;
 const b=p.c.bones,forward=new V3(Math.sin(p.c.yaw),0,Math.cos(p.c.yaw));
 pointBone(b.RightArm,b.RightForeArm,new V3(forward.x*.52,-.80,forward.z*.52).normalize());
 if(!b.Head||!b.RightArm||!b.RightForeArm||!b.RightHand)return;
 const head=b.Head.getWorldPosition(new V3()),side=b.RightArm.getWorldPosition(new V3()).sub(head);
 side.y=0;side.normalize();
 const ear=head.addScaledVector(side,.106);ear.y+=.065;
 pointBone(b.RightForeArm,b.RightHand,ear.clone().sub(b.RightForeArm.getWorldPosition(new V3())).normalize());
 if(!a.phone){
  a.phone=new THREE.Mesh(unitBox,handsetMaterial);a.phone.scale.set(.078,.146,.016);scene.add(a.phone);
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
   if(d>.96){
    const stride=Math.min(d-.90,1.6*dt);offender.pos.x+=dx/d*stride;offender.pos.z+=dz/d*stride;collideWorld(offender.pos,.29);
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
   a.bag.position.y=groundY(a.bag.position.x,a.bag.position.z,victim.pos.y)+.32;
   if(!offender.c.gun)offender.c.gun=makeGun();
   offender.c.aim=.58;a.phase='Draw';a.since=time;
  }else if(a.phase==='Draw'&&time-a.since>=.25){
   if(dist2(offender.pos,victim.pos)<=1.7)strikeInStreet(a);else finishStreetEncounter(a);
  }
  return;
 }
 if(a.phase==='Aftermath'&&time-a.since>=.95)beginStreetCall(a);
 else if(a.phase==='Calling 911')receiveStreetCall(a);
 if(a.phase!=='Calling 911'&&a.phone){scene.remove(a.phone);a.phone=null;}
 const stage=a.file.stage;
 if(stage==='Patrol assigned')interviewAtScene(a);
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
