/* Witness calls, finite response staffing and searches around the last confirmed location. */
const LAW={
 anchor:new V3(),known:false,seen:false,lastSeen:-Infinity,report:null,dispatchAt:0,spent:0,roadblocks:0,airSent:0,
 nextEscalation:0, gunCalls:[], recentShots:new Map(), budgets:[0,1,2,5,8,12],activeLimit:[0,1,2,3,5,7],lastLevel:0
};
const WANTED_MAX=1350;

function resetDispatch(){
 LAW.known=LAW.seen=false;
 LAW.report=null;
 LAW.lastSeen=-Infinity;LAW.nextEscalation=0;
 LAW.dispatchAt=LAW.spent=LAW.roadblocks=LAW.airSent=LAW.lastLevel=0;
 for(const car of cars){
  car.dispatched=false;
  if(car.driver==='police'){car.route=null;if(car.officer)PoliceDepartment.bindings.set(car.officer.personId,'Motor patrol');}
 }
}

function policeCanSee(source,target,yaw,range,level){
 const dx=target.x-source.x,dz=target.z-source.z,d2=dx*dx+dz*dz;
 if(d2>range*range||!los(source,target))return false;
 if(d2<3.6**2||level>=3)return true;
 const alignment=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/Math.sqrt(d2);
 return alignment>(level===1?.52:.31);
}

function witnessesFor(x,z,y,exclude=null){
 const victim={x,y,z};
 const officers=departmentPeople.some(u=>u.team==='law'&&!u.dead&&policeCanSee(u.pos,victim,u.c.yaw,28,2))||cops.some(u=>!u.dead&&policeCanSee(u.pos,victim,u.c.yaw,28,2))||
  cars.some(c=>c.driver==='police'&&policeCanSee(c.pos,victim,c.h,32,2));
 if(officers)return {officers:true};
 let nearest=null,dist=31;
 for(const ped of peds){
  if(ped===exclude||ped.dead||ped.c?.root.visible===false)continue;
  const d=dist2(ped.pos,victim);
  if(d<dist&&los(ped.pos,victim)){
   dist=d;
   nearest=ped;
  }
 }
 return {officers:false,ped:nearest};
}

function recordOffence(amount,x,z,property,y){
 if(property){
  if(heat<TH[3])heat=Math.min(TH[3]-1,Math.max(TH[2],heat+Math.min(8,amount)));
 }else heat=Math.min(WANTED_MAX,Math.max(TH[1],heat+amount));
 LAW.anchor.set(x,y,z);
 if(!LAW.known||!LAW.dispatchAt)LAW.dispatchAt=time+(property?2:1);
 LAW.known=true;
 evadeT=0;
}

function fileWitnessReport(amount,x,z,immediate=false,property=false){
 if(state!=='play')return;
 const y=groundY(x,z,player.pos.y);
 const source=immediate?{officers:true}:witnessesFor(x,z,y);
 if(source.officers){
  recordOffence(amount,x,z,property,y);
  return;
 }
 if(!source.ped)return;
 const already=LAW.report;
 if(already&&Math.hypot(already.x-x,already.z-z)<28){
  if(property&&already.amount<TH[2])already.property=true;
  if(!property&&amount>=TH[2])already.property=false;
  already.amount=Math.max(already.amount,amount);
  already.x=x;
  already.z=z;
  already.y=y;
  return;
 }
 if(already&&already.amount>=amount)return;
 LAW.report={amount,x,y,z,ped:source.ped,witnessId:source.ped.personId,left:property?3.1:2.15,property};

}

// Hearing a shot reports its location. A personal pursuit needs an observation of the shooter.
function reportGunfire(shooter){
 if(state!=='play')return;
 const at=shooter.car?.pos||shooter.pos,id=shooter.personId;
 const observation=witnessesFor(at.x,at.z,at.y,shooter);
 const caller=observation.ped||peds.find(p=>p!==shooter&&!p.dead&&p.c.root.visible&&dist2(p.pos,at)<44);
 if(!observation.officers&&!caller)return;
 const identified=observation.officers||!!observation.ped;
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
 if(subject===player.personId)recordOffence(TH[2],at.x,at.z,false,at.y);
}

function searchGoal(x,z,offset,scale=1){
 if(!LAW.known)return {x,z};
 const anchor=LAW.anchor;
 const sector=offset+Math.floor((time-Math.max(LAW.lastSeen,0))/6);
 const dist=LAW.seen?0:(wanted===1?10:wanted===2?23:38)*scale;
 const angle=sector*2.399963;
 const gx=anchor.x+Math.cos(angle)*dist,gz=anchor.z+Math.sin(angle)*dist;
 if(inFreightPort(anchor.x,anchor.z))return {x:clamp(gx,FREIGHT.x0+2,FREIGHT.x1-2),z:clamp(gz,FREIGHT.z0+1,FREIGHT.z1-2)};
 const coast=Math.abs(gz-W*.42)<3.76?W+149.45:harborWalkingLimit(gz)??MAXX;
 return {x:clamp(gx,MINX+1,coast-1),z:clamp(gz,MINZ+1,MAXZ-1)};
}

function confirmContact(target){
 if(player.car&&LAW.lastSeen>time-1&&LAW.lastObservedPlate!==player.car.plate){
  PoliceDepartment.sightVehicle(player.personId,player.car.plate);
 }
 LAW.lastObservedPlate=player.car?.plate||null;
 LAW.anchor.copy(target);
 LAW.seen=LAW.known=true;
 LAW.lastSeen=time;
 evadeT=0;
}

function updateLaw(dt){
 for(const call of LAW.gunCalls.slice())if(time>=call.due){
  LAW.gunCalls.splice(LAW.gunCalls.indexOf(call),1);
  if(!call.caller.dead&&call.caller.personId===call.callerId)receiveGunfire(call);
 }
 const report=LAW.report;
 if(report){
  report.left-=dt;
  if(report.left<=0){
   LAW.report=null;
   if(!report.ped.dead&&report.ped.personId===report.witnessId)recordOffence(report.amount,report.x,report.z,report.property,report.y);
  }
 }
 const targetLevel=levelOf(heat);
 let newLevel=Math.min(wanted,targetLevel);
 if(targetLevel>wanted&&time>=LAW.nextEscalation){
  newLevel=wanted+1;
  LAW.nextEscalation=time+[0,3,6,10,15,20][newLevel];
 }
 if(newLevel>LAW.lastLevel){
  banner(newLevel);
  beep(500,.20,.09,'sawtooth');
 }
 wanted=newLevel;
 LAW.lastLevel=newLevel;
 if(!wanted){
  if(!LAW.report&&LAW.known)resetDispatch();
  player.hp=Math.min(100,player.hp+dt*1.2);
  return;
 }
 const target=player.car?player.car.pos:player.pos;
 const range=LV.sees[wanted];
 if(!LAW.known){
  LAW.anchor.copy(target);
  LAW.known=true;
 }
 LAW.seen=cars.some(c=>c.driver==='police'&&!c.dead&&policeCanSee(c.pos,target,c.h,range*1.22,wanted))||
  cops.some(u=>!u.dead&&policeCanSee(u.pos,target,u.c.yaw,range,wanted))||
  helis.some(h=>!h.dead&&h.spotted);
 if(LAW.seen)confirmContact(target);
 else if((evadeT+=dt)>=LV.evade[wanted]){
  const before=wanted;
  heat=before===1?0:TH[before-1]+(TH[before]-TH[before-1])*.20;
  wanted=levelOf(heat);
  LAW.lastLevel=wanted;
  evadeT=0;
  if(!wanted){
   resetDispatch();
   toast('SEARCH CALLED OFF',1700);
  }else toast('SEARCH WINDING DOWN',1400);
 }
}

function lawHasReserve(n=1){
 return wanted>0&&LAW.spent+n<=LAW.budgets[wanted];
}

function reserveOfficer(){
 if(!lawHasReserve())return false;
 LAW.spent++;
 return true;
}

function serviceDispatch(){
 if(!wanted||!LAW.known||time<LAW.dispatchAt)return;
 const active=cars.filter(c=>c.driver==='police'&&c.dispatched&&!c.dead).length+
  cops.filter(u=>!u.dead).length;
 if(active>=LAW.activeLimit[wanted]||!lawHasReserve())return;
 const needMetro=wanted>=4&&PoliceDepartment.available('Metro SWAT')&&!cars.some(c=>c.dispatched&&c.unit==='swat')&&!cops.some(u=>!u.dead&&u.kind==='swat');
 const patrol=!needMetro&&cars.filter(c=>c.driver==='police'&&!c.dispatched&&!c.dead&&dist2(c.pos,LAW.anchor)<143)
  .sort((a,b)=>dist2(a.pos,LAW.anchor)-dist2(b.pos,LAW.anchor))[0];
 if(patrol){
  reserveOfficer();
  patrol.dispatched=true;
  patrol.route=null;
 }
 const responder=patrol||spawnPolice(true);
 if(responder){
  if(!patrol)reserveOfficer();
  const officer=responder.officer;
  PoliceDepartment.bindings.set(officer.personId,'Responding');
  PoliceDepartment.radio('Dispatch',officer.callSign+' · respond to the last reported location.',needMetro?'backup':'report');
  responder.radioAckAt=time+.9;
 }
 LAW.dispatchAt=time+(wanted<=2?3.5:2.5);
}
