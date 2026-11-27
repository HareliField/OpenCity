/* Active reports and searches. The department owns the longer-lived case files. */
const LAW={
 anchor:new V3(),known:false,seen:false,lastSeen:-Infinity,scene:null,dispatchAt:0,spent:0,airSent:0,
 reports:[],incidents:[],recognition:new Map(),plates:new Map(),gunCalls:[],recentShots:new Map(),
 identityUntil:0,threatUntil:0,revision:0,checked:new Set(),nextRecognition:0,
 budgets:[0,3,5,8,11,14],activeLimit:[0,2,3,4,5,7],lastLevel:0
};
const WANTED_MAX=1350;
const SEARCH_CHECKS=[0,2,3,3,4,4];
const RECOGNITION_TIME=135;

function clearPoliceBlock(car){
 car.block=false;
 car.closure=null;
 car.ai=null;
}

function resetDispatch(clearRecognition=true){
 LAW.known=LAW.seen=false;
 LAW.scene=null;LAW.reports.length=LAW.incidents.length=0;
 if(clearRecognition){
  LAW.recognition.clear();LAW.plates.clear();LAW.gunCalls.length=0;LAW.recentShots.clear();
 }
 LAW.lastSeen=-Infinity;LAW.lastObservedPlate=null;LAW.threatUntil=LAW.identityUntil=0;
 LAW.dispatchAt=LAW.spent=LAW.airSent=LAW.lastLevel=0;
 LAW.checked.clear();LAW.revision++;
 for(const car of cars){
  if(car.closure)clearPoliceBlock(car);
  if(!car.dispatched)continue;
  car.dispatched=false;car.radioAckAt=0;car.route=null;car.ai=null;car.siren=false;
  if(car.driver==='police'&&car.officer)PoliceDepartment.bindings.set(car.officer.personId,'Motor patrol');
 }
}

function policeCanSee(source,target,yaw,range,level){
 const dx=target.x-source.x,dz=target.z-source.z,d2=dx*dx+dz*dz;
 if(d2>range*range||Math.abs((target.y??0)-(source.y??0))>3.5||!los(source,target))return false;
 if(d2<3.6**2)return true;
 const alignment=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/Math.sqrt(d2);
 return alignment>(level===1?.30:level===2?.05:-.38);
}

function witnessesFor(x,z,y,exclude=null){
 const at={x,y,z};
 const officer=departmentPeople.find(u=>u.team==='law'&&!u.dead&&policeCanSee(u.pos,at,u.c.yaw,33,2))||
  cops.find(u=>!u.dead&&policeCanSee(u.pos,at,u.c.yaw,33,2))||
  cars.find(c=>c.driver==='police'&&!c.dead&&policeCanSee(c.pos,at,c.h,39,2));
 const civilians=[];
 for(const ped of peds){
  if(ped===exclude||ped.dead||ped.c?.root.visible===false)continue;
  const d=dist2(ped.pos,at);
  if(d<31&&Math.abs(ped.pos.y-y)<3.5&&los(ped.pos,at))civilians.push({ped,d});
 }
 civilians.sort((a,b)=>a.d-b.d);
 return {officers:!!officer,officer,ped:civilians[0]?.ped||null,civilians:civilians.slice(0,5).map(w=>w.ped)};
}

function updateSearchLead(at){
 if(!LAW.known||dist2(LAW.anchor,at)>13||Math.abs(LAW.anchor.y-at.y)>2){
  LAW.checked.clear();LAW.revision++;
 }
 LAW.anchor.copy(at);
 LAW.known=true;
 evadeT=0;
}

function rememberPlate(plate){
 if(!plate)return;
 LAW.plates.set(plate,time+RECOGNITION_TIME);
 if(LAW.lastObservedPlate!==plate)PoliceDepartment.sightVehicle(player.personId,plate);
 LAW.lastObservedPlate=plate;
}

function recordOffence(amount,x,z,property,y,threat=false){
 heat=Math.min(WANTED_MAX,Math.max(TH[1],heat+amount));
 const at=new V3(x,y,z);
 if(!LAW.known)LAW.dispatchAt=time+(property?1.4:.7);
 LAW.scene=at;
 updateSearchLead(at);
 LAW.identityUntil=time+12;
 if(threat)LAW.threatUntil=time+55;
}

function offenceReport(incident,from,at,plate,primary=false,lead=at){
 if(incident.accepted.has(from))return;
 incident.accepted.add(from);
 const first=incident.accepted.size===1;
 if(first){
  recordOffence(incident.amount,at.x,at.z,incident.property,at.y,incident.threat);
  PoliceDepartment.radio(from,'Report received · '+incident.kind+'.','report');
 }else{
  // Independent accounts corroborate the event. Crowd size cannot turn one minor act into a felony.
  const score=incident.corroboration;
  const extra=Math.min(primary?8:4,16-score);
  incident.corroboration+=extra;
  heat=Math.min(WANTED_MAX,Math.max(TH[1],heat+extra));
 }
 if(!first&&incident.threat)LAW.threatUntil=time+55;
 if(plate)rememberPlate(plate);
 if(first){
  updateSearchLead(lead);
  LAW.identityUntil=time+12;
 }
}

function incidentAt(amount,at,kind,property,threat){
 const window=property||kind==='Gunfire'||kind==='Reckless driving'?7:kind==='Assault on patrol'?4:2.5;
 const previous=LAW.incidents.find(i=>i.kind===kind&&time-i.time<window&&dist2(i.at,at)<21&&Math.abs(i.at.y-at.y)<2);
 if(previous){
  if(!previous.accepted.size)previous.amount=Math.max(previous.amount,amount);
  previous.threat||=threat;
  return previous;
 }
 const incident={at,time,kind,amount,property,threat,accepted:new Set(),queued:new Set(),corroboration:0};
 LAW.incidents.push(incident);
 return incident;
}

function trackWitness(ped,plate){
 const id=ped.personId;
 const existing=LAW.recognition.get(id);
 LAW.recognition.set(id,{ped,expires:time+RECOGNITION_TIME,next:time+9,last:existing?.last||LAW.anchor.clone(),
  plate:plate||existing?.plate||null,wasVisible:!plate});
}

function queueOffenceCall(incident,ped,lead,plate){
 if(!ped.personId||incident.queued.has(ped.personId))return;
 incident.queued.add(ped.personId);
 LAW.reports.push({incident,ped,id:ped.personId,lead,plate,due:time+(incident.property?3.1:2.2)});
}

function fileWitnessReport(amount,x,z,immediate=false,property=false,options={}){
 if(state!=='play')return;
 const {kind=property?'Property damage':'Public disturbance',threat=false,eyewitness=null,vehicle=null}=options;
 const playerTarget=player.car?.pos||player.pos;
 const at=new V3(x,groundY(x,z,playerTarget.y),z);
 const lead=playerTarget.clone();
 const observation=witnessesFor(x,z,at.y);
 const candidates=new Set(observation.civilians.filter(ped=>dist2(ped.pos,lead)<33&&los(ped.pos,lead)));
 if(eyewitness)candidates.add(eyewitness);
 if(!immediate&&!observation.officers&&!candidates.size)return;
 const incident=incidentAt(property?Math.min(22,amount):amount,at,kind,property,threat);
 const observedPlate=(vehicle||player.car)?.plate||null;
 if(immediate||observation.officers){
  const officer=observation.officer;
  const sawPlayer=officer&&policeCanSee(officer.pos,lead,officer.h??officer.c.yaw,42,2);
  const plate=sawPlayer||vehicle?observedPlate:null;
  offenceReport(incident,kind==='Robbery'||kind==='Vault breached'?'Alarm':'Patrol',at,plate,true,sawPlayer?lead:at);
 }
 for(const ped of candidates)queueOffenceCall(incident,ped,lead,observedPlate);
}

// A sound-only call opens an investigation. An identification can update it later.
function reportGunfire(shooter){
 if(state!=='play')return;
 const at=shooter.car?.pos||shooter.pos,id=shooter.personId;
 const observation=witnessesFor(at.x,at.z,at.y,shooter);
 const caller=observation.ped||peds.find(p=>p!==shooter&&!p.dead&&p.c.root.visible&&Math.abs(p.pos.y-at.y)<8&&dist2(p.pos,at)<44);
 if(!observation.officers&&!caller)return;
 const identified=observation.officers||!!observation.ped;
 if(shooter===player&&identified){
  const point=at.clone(),plate=shooter.car?.plate||null;
  const incident=incidentAt(34,point,'Gunfire',false,true);
  if(observation.officers)offenceReport(incident,'Patrol',point,plate,true);
  for(const ped of observation.civilians)queueOffenceCall(incident,ped,point,plate);
 }
 const previous=LAW.recentShots.get(id);
 if(previous&&time-previous.at<8&&(previous.identified||!identified))return;
 for(const [key,event] of LAW.recentShots)if(time-event.at>=8)LAW.recentShots.delete(key);
 LAW.recentShots.set(id,{at:time,identified});
 const call={at:{x:at.x,y:at.y,z:at.z},subject:identified?id:null,caller,callerId:caller?.personId,
  from:observation.officers?'Patrol observation':'911',plate:identified?shooter.car?.plate:null};
 if(observation.officers){receiveGunfire(call);return;}
 LAW.gunCalls.push({...call,due:time+2.2});
}

function receiveGunfire(call){
 const {at,subject,from,plate}=call;
 const existing=PoliceDepartment.cases.findLast(c=>c.kind==='Shots reported'&&!c.exercise&&Math.abs((c.at.y||0)-(at.y||0))<2&&PoliceDepartment.clock-c.opened<10&&
  Math.hypot(at.x-c.at.x,at.z-c.at.z)<12&&(!c.contact||c.contact===subject));
 if(existing){
  if(subject&&!existing.contact){
   existing.contact=subject;
   if(existing.stage==='Open leads'){existing.stage='Filed';existing.due=PoliceDepartment.clock;}
   existing.evidence.push({type:'Statement',source:from,value:call.callerId||from});
   PoliceDepartment.logCase(existing,from,'Follow-up witness identified the shooter.');PoliceDepartment.save();
  }
 }else PoliceDepartment.file({kind:'Shots reported',at,contact:subject,plate,witness:call.callerId||from,caller:from});
}

function searchGoal(x,z,offset,scale=1){
 if(!LAW.known)return {x,z,y:0};
 if(LAW.seen)return LAW.anchor;
 const anchor=LAW.anchor,sector=offset+LAW.checked.size;
 const radius=(wanted===1?14:wanted===2?22:34)*scale;
 return searchSector(anchor,radius+Math.min(38,LAW.checked.size*8),sector);
}

function searchSector(anchor,radius,sector){
 // Follow streets and approaches in separate sectors rather than converging on one point.
 const heading=sector*Math.PI/4;
 const gx=anchor.x+Math.cos(heading)*radius,gz=anchor.z+Math.sin(heading)*radius;
 let x=gx,z=gz;
 if(inFreightPort(anchor.x,anchor.z)){
  x=clamp(gx,FREIGHT.x0+2,FREIGHT.x1-2);z=clamp(gz,FREIGHT.z0+1,FREIGHT.z1-2);
 }else if(inDockYard(anchor.x,anchor.z)){
  x=clamp(gx,HARBOR.yard.x0+2,HARBOR.yard.x1-2);z=clamp(gz,HARBOR.yard.z0+1,HARBOR.yard.z1-2);
 }else{
  const coast=Math.abs(gz-W*.42)<3.76?W+149.45:harborWalkingLimit(gz)??MAXX;
  x=clamp(gx<MINX||gx>coast?2*anchor.x-gx:gx,MINX+1,coast-1);
  z=clamp(gz<MINZ||gz>MAXZ?2*anchor.z-gz:gz,MINZ+1,MAXZ-1);
  if(x>=0&&x<=W&&z>=0&&z<=W){
   const laneX=Math.round(x/CELL)*CELL,laneZ=Math.round(z/CELL)*CELL;
   if(Math.abs(x-laneX)<Math.abs(z-laneZ))x=laneX+Math.sign(x-laneX)*6;
   else z=laneZ+Math.sign(z-laneZ)*6;
  }
 }
 return {x,z,y:groundY(x,z,anchor.y)};
}

function unitSearchTarget(unit){
 let search=unit.search;
 if(search?.revision!==LAW.revision){
  const first=unit.sceneLead&&LAW.scene?LAW.scene:LAW.anchor;
  search=unit.search={revision:LAW.revision,phase:0,goal:first.clone(),key:unit.sceneLead?'scene':'lead'};
 }
 return search.goal;
}

function checkSearchArea(unit,dt,radius){
 const search=unit.search;
 if(!search||search.revision!==LAW.revision||LAW.seen)return;
 const close=dist2(unit.pos,search.goal)<radius&&Math.abs(unit.pos.y-search.goal.y)<4&&los(unit.pos,search.goal);
 search.dwell=close?(search.dwell||0)+dt:0;
 if(search.dwell<2)return;
 const fresh=!LAW.checked.has(search.key);
 LAW.checked.add(search.key);
 if(fresh)PoliceDepartment.radio(unit.officer.callSign,search.phase?'Search sector clear. Continuing sweep.':'Reported area checked. Extending the search.','search');
 const sector=((unit.officer.badge||0)+search.phase*3)%8;
 const band=Math.floor(search.phase/4);
 search.phase++;search.dwell=0;
 search.key=band+':'+sector;
 search.goal=searchSector(LAW.anchor,(18+Math.min(3,wanted)*8)+band*18,sector);
}

function patrolIdentifies(pos,target,yaw,range,level){
 if(state!=='play'||!policeCanSee(pos,target,yaw,range,level))return false;
 if(!player.car)return dist2(pos,target)<(time<LAW.identityUntil?range:range*.78);
 return LAW.plates.get(player.car.plate)>time;
}

function reportVehicleEntry(car){
 if(wanted&&activePatrolSees(player.pos,wanted))rememberPlate(car.plate);
 for(const [id,witness] of LAW.recognition){
  const ped=witness.ped;
  if(witness.expires<=time||ped.dead||ped.personId!==id||!ped.c.root.visible||dist2(ped.pos,player.pos)>16||
   !los(ped.pos,player.pos)||!los(ped.pos,car.pos))continue;
  witness.plate=car.plate;witness.wasVisible=false;
 }
}

function confirmContact(target){
 const first=!LAW.seen&&time-LAW.lastSeen>1.5;
 if(first){
  updateSearchLead(target);
  PoliceDepartment.radio('Patrol',player.car?'Suspect vehicle located · '+player.car.plate+'.':'Suspect located. Units converge.','sighting');
 }
 if(player.car)rememberPlate(player.car.plate);
 else LAW.lastObservedPlate=null;
 LAW.anchor.copy(target);
 LAW.seen=LAW.known=true;
 LAW.lastSeen=time;
 evadeT=0;
}

function lawCanFire(){
 return time<LAW.threatUntil&&(player.car||player.weapon!=='fist'||time-lastShot<1.5);
}

function updateRecognition(){
 const target=player.car?.pos||player.pos,plate=player.car?.plate||null;
 for(const [id,witness] of LAW.recognition){
  const ped=witness.ped;
  if(witness.expires<=time||ped.dead||ped.personId!==id){LAW.recognition.delete(id);continue;}
  const visible=ped.c.root.visible&&dist2(ped.pos,target)<24&&Math.abs(ped.pos.y-target.y)<2&&los(ped.pos,target);
  const recognized=visible&&(!plate||plate===witness.plate||witness.wasVisible&&dist2(ped.pos,target)<10);
  witness.wasVisible=recognized&&!plate;
  const newPlate=plate&&!LAW.plates.has(plate);
  if(!recognized||time<witness.next||LAW.seen||wanted&&!newPlate&&dist2(witness.last,target)<24)continue;
  witness.next=time+18;witness.last=target.clone();
  LAW.reports.push({ped,id,lead:target.clone(),plate,due:time+2.1});
 }
 for(const [id,until] of LAW.plates)if(until<=time)LAW.plates.delete(id);
 if(!wanted&&plate&&LAW.plates.has(plate)&&activePatrolSees(target,1)){
  recordOffence(TH[1],target.x,target.z,false,target.y);
  PoliceDepartment.radio('Patrol','Reported plate located · '+plate+'.','sighting');
 }
}

function deliverLawCalls(){
 for(const call of LAW.gunCalls.filter(c=>c.due<=time)){
  if(!call.caller.dead&&call.caller.personId===call.callerId)receiveGunfire(call);
 }
 LAW.gunCalls=LAW.gunCalls.filter(c=>c.due>time);
 const due=LAW.reports.filter(c=>c.due<=time);
 LAW.reports=LAW.reports.filter(c=>c.due>time);
 for(const call of due){
  if(call.ped.dead||call.ped.personId!==call.id)continue;
  if(call.incident){
   offenceReport(call.incident,call.id,call.incident.at,call.plate,false,call.lead);
   trackWitness(call.ped,call.plate);
  }else{
   if(!wanted)recordOffence(TH[1],call.lead.x,call.lead.z,false,call.lead.y);
   if(!LAW.seen)updateSearchLead(call.lead);
   if(call.plate)rememberPlate(call.plate);
   LAW.identityUntil=time+12;
   PoliceDepartment.radio('911','Witness recognized the suspect'+(call.plate?' in '+call.plate:'')+'. Updating the search.','sighting');
  }
 }
 LAW.incidents=LAW.incidents.filter(i=>time-i.time<9);
}

function activePatrolSees(target,level){
 const range=LV.sees[level];
 return cars.some(c=>c.driver==='police'&&!c.dead&&patrolIdentifies(c.pos,target,c.h,range*1.22,level))||
  cops.some(u=>!u.dead&&patrolIdentifies(u.pos,target,u.c.yaw,range,level))||
  departmentPeople.some(u=>u.team==='law'&&!u.dead&&patrolIdentifies(u.pos,target,u.c.yaw,range,level));
}

function updateLaw(dt){
 deliverLawCalls();
 if(time>=LAW.nextRecognition){LAW.nextRecognition=time+.5;updateRecognition();}
 wanted=levelOf(heat);
 if(wanted>LAW.lastLevel){banner(wanted);beep(500,.20,.09,'sawtooth');}
 LAW.lastLevel=wanted;
 if(!wanted){player.hp=Math.min(100,player.hp+dt*1.2);return;}
 const target=player.car?.pos||player.pos;
 if(activePatrolSees(target,wanted)||wanted>=4&&helis.some(h=>!h.dead&&h.spotted))confirmContact(target);
 else{
  LAW.seen=false;
  if(!LAW.reports.length)evadeT+=dt;
  const quiet=LV.evade[wanted];
  // Finite coverage when the watch is tied up, or when a lead is inaccessible.
  if(evadeT>=quiet&&(LAW.checked.size>=SEARCH_CHECKS[wanted]||evadeT>=quiet*2)){
   const before=wanted;
   heat=before===1?0:TH[before-1];
   wanted=levelOf(heat);LAW.lastLevel=wanted;
   evadeT=0;LAW.checked.clear();LAW.revision++;
   if(!wanted){resetDispatch(false);toast('ACTIVE SEARCH CALLED OFF',1700);}
   else toast('SEARCH WINDING DOWN',1400);
  }
 }
}

function lawHasReserve(){
 return wanted>0&&LAW.spent<LAW.budgets[wanted];
}

function serviceDispatch(){
 if(state!=='play'||!wanted||!LAW.known||time<LAW.dispatchAt)return;
 const active=cars.filter(c=>c.driver==='police'&&c.dispatched&&!c.dead).length+cops.filter(u=>!u.dead).length;
 if(active>=LAW.activeLimit[wanted]||!lawHasReserve())return;
 const needMetro=wanted>=4&&PoliceDepartment.available('Metro SWAT')&&!cars.some(c=>c.driver==='police'&&!c.dead&&c.unit==='swat')&&!cops.some(u=>!u.dead&&u.kind==='swat');
 const patrol=!needMetro&&cars.filter(c=>c.driver==='police'&&!c.dispatched&&!c.dead&&PoliceDepartment.duty(c.officer))
  .sort((a,b)=>dist2(a.pos,LAW.anchor)-dist2(b.pos,LAW.anchor))[0];
 const parked=PoliceDepartment.available('Patrol')&&cars.filter(c=>c.stationFleet&&c.type==='police'&&!c.driver&&!c.dead&&!c.returningOfficer)
  .sort((a,b)=>dist2(a.pos,LAW.anchor)-dist2(b.pos,LAW.anchor))[0];
 const closerStation=parked&&(!patrol||dist2(parked.pos,LAW.anchor)+28<dist2(patrol.pos,LAW.anchor));
 const responder=needMetro?stationResponder('swat')||patrol||stationResponder('police'):
  closerStation?stationResponder('police',parked)||patrol:patrol||stationResponder('police');
 LAW.dispatchAt=time+(wanted===1?4:2.5);
 if(!responder)return;
 LAW.spent++;
 responder.dispatched=true;responder.sceneLead=active===0;responder.search=null;
 responder.radioAckAt=time+.9;
 PoliceDepartment.bindings.set(responder.officer.personId,'Responding');
 PoliceDepartment.radio('Dispatch',responder.officer.callSign+' · respond to the last reported location.',needMetro?'backup':'report');
}
