/* Witness calls, finite response staffing and searches around the last confirmed location. */
const LAW={
 anchor:new V3(),known:false,seen:false,lastSeen:-Infinity,report:null,dispatchAt:0,spent:0,roadblocks:0,airSent:0,
 budgets:[0,1,2,5,8,12],activeLimit:[0,1,2,3,5,7],lastLevel:0
};
const WANTED_MAX=1350;

function resetDispatch(){
 LAW.known=LAW.seen=false;
 LAW.report=null;
 LAW.lastSeen=-Infinity;
 LAW.dispatchAt=LAW.spent=LAW.roadblocks=LAW.airSent=LAW.lastLevel=0;
 for(const car of cars){
  car.dispatched=false;
  if(car.driver==='police')car.route=null;
 }
}

function policeCanSee(source,target,yaw,range,level){
 const dx=target.x-source.x,dz=target.z-source.z,d2=dx*dx+dz*dz;
 if(d2>range*range||!los(source,target))return false;
 if(d2<3.6**2||level>=3)return true;
 const alignment=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/Math.sqrt(d2);
 return alignment>(level===1?.52:.31);
}

function witnessesFor(x,z,y){
 const victim={x,y,z};
 const officers=cops.some(u=>!u.dead&&policeCanSee(u.pos,victim,u.c.yaw,28,2))||
  cars.some(c=>c.driver==='police'&&policeCanSee(c.pos,victim,c.h,32,2));
 if(officers)return {officers:true};
 let nearest=null,dist=31;
 for(const ped of peds){
  if(ped.dead)continue;
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
 if(!LAW.known||!LAW.dispatchAt)LAW.dispatchAt=time+(property?2.8:1.5);
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
 LAW.report={amount,x,y,z,ped:source.ped,left:property?3.1:2.15,property};
 if(property&&wanted<2)toast('WITNESS CALLING 911',1800);
}

function searchGoal(x,z,offset,scale=1){
 if(!LAW.known)return {x,z};
 const anchor=LAW.anchor;
 const sector=offset+Math.floor((time-Math.max(LAW.lastSeen,0))/6);
 const dist=LAW.seen?0:(wanted===1?10:wanted===2?23:38)*scale;
 const angle=sector*2.399963;
 return {x:clamp(anchor.x+Math.cos(angle)*dist,MINX+1,MAXX-1),z:clamp(anchor.z+Math.sin(angle)*dist,MINZ+1,MAXZ-1)};
}

function confirmContact(target){
 LAW.anchor.copy(target);
 LAW.seen=LAW.known=true;
 LAW.lastSeen=time;
 evadeT=0;
}

function updateLaw(dt){
 const report=LAW.report;
 if(report){
  report.left-=dt;
  if(report.left<=0){
   LAW.report=null;
   if(!report.ped.dead)recordOffence(report.amount,report.x,report.z,report.property,report.y);
  }
 }
 const newLevel=levelOf(heat);
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
 const patrol=cars.filter(c=>c.driver==='police'&&!c.dispatched&&!c.dead&&dist2(c.pos,LAW.anchor)<143)
  .sort((a,b)=>dist2(a.pos,LAW.anchor)-dist2(b.pos,LAW.anchor))[0];
 if(patrol){
  reserveOfficer();
  patrol.dispatched=true;
  patrol.route=null;
 }else if(spawnPolice(true))reserveOfficer();
 LAW.dispatchAt=time+(wanted<=2?5:3.2);
}
