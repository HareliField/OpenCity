/* An optional observer of the current street case. All state transitions belong to the simulation. */
const caseCamera={enabled:false,focus:null,shot:null,position:new V3(),aim:new V3(),cutAt:0};
const caseReturn=$('caseReturn'),caseCaption=$('caseCaption');
function stopCaseCamera(){
 if(!caseCamera.enabled)return;
 caseCamera.enabled=false;caseCamera.focus=null;caseCamera.shot=null;
 caseReturn.hidden=true;caseCaption.hidden=true;document.body.classList.remove('watchingCase');camInit=false;
}
function canFollowStreetCase(){
 return !!streetIncidents.current&&state==='play'&&!player.car&&player.down<=0&&!shopOpen;
}
function toggleCaseCamera(){
 if(caseCamera.enabled){stopCaseCamera();return;}
 if(!canFollowStreetCase())return;
 caseCamera.enabled=true;caseReturn.hidden=false;document.body.classList.add('watchingCase');
}
caseReturn.addEventListener('click',stopCaseCamera);
window.addEventListener('keydown',e=>{
 if(e.repeat||e.target.closest?.('input,textarea,dialog'))return;
 if(e.code==='KeyY'&&state==='play')toggleCaseCamera();
 else if(e.code==='Escape'&&caseCamera.enabled)stopCaseCamera();
});
function caseViewNear(point,radius,height){
 const pos=caseCamera.focus;
 return !!pos&&Math.abs(point.y-pos.y)<height&&dist2(point,pos)<radius;
}
function caseShot(a){
 const f=a.file,stage=f?.stage,hq=PoliceDepartment.stations.find(s=>s.lift);
 const name=id=>PoliceDepartment.staff.find(s=>s.personId===id)?.name;
 const base=f?.at||a.victim.pos;
 const street=(key,pos,height,distance,caption)=>({key,pos,height,distance,caption,location:streetAddress(base)});
 const room=(role,key,caption)=>{
  const post=hq.posts.find(p=>p.role===role);
  return {key,pos:post.unit?.pos||post.point,height:post.seated?.92:1.28,distance:3.65,eye:post.cameraStand,
   caption,location:hq.name+' · '+post.room};
 };
 if(!f){
  const mid=a.victim.pos.clone().lerp(a.offender.pos,.48);
  if(a.phase==='Struggle'||a.phase==='Draw')return street('Holdall taken',mid,1.04,3.6,
   streetResidentName(a.offender)+' takes the holdall from '+streetResidentName(a.victim)+'.');
  return street('Encounter',mid,1.04,Math.max(4.35,dist2(a.offender.pos,a.victim.pos)*.95),
   streetResidentName(a.offender)+' approaches '+streetResidentName(a.victim)+' on the pavement.');
 }
 if(stage==='Unreported'){
  if(a.phase==='Calling 911'&&a.call){
   const caller=a.call.ped;
   return {...street('911 call',caller.pos,1.37,2.65,streetResidentName(caller)+' stops and calls 911.'),yaw:caller.c.yaw-.85};
  }
  return street('Street incident',base,.82,4.3,f.victimName+' falls. The leather holdall is on the pavement.');
 }
 if(stage==='Filed'){
  const caller=f.caller?.name||'A resident';
  return room('Communications','Call received',f.caller?.observation==='heard'?caller+' reports hearing gunfire. Communications takes the approximate location.':
   f.caller?.observation==='eyewitness'?caller+' reports seeing the shooting. Communications takes the location.':
   caller+' reports a person down. Communications takes the location.');
 }
 if(stage==='Patrol assigned'||stage==='Scene review'||stage==='Lab review'){
  const units=departmentPeople.filter(u=>u.file===f&&!u.dead&&dist2(u.pos,base)<13);
  const curb=sceneStreetFrame(base),outward=Math.atan2(-curb.nx,-curb.nz);
  const mid=new V3(base.x,base.y,base.z);
  const unit=fieldInvestigators.get(f.id);
  if(stage==='Patrol assigned'){
   const ride=cars.find(c=>c.sceneFileId===f.id&&!c.dead&&dist2(c.pos,base)<27);
   if(ride&&units.length<2)mid.lerp(ride.pos,.58);
   else if(unit)mid.lerp(unit.pos,.4);
   const caption=f.pendingScene?name(f.patrol)+' checks the area where the caller heard gunfire.':units.length<2?name(f.patrol)+' responds to the caller’s location.':'Patrol stays with the injured resident and takes the caller’s account.';
   return {...street('Patrol response',mid,.96,9.5,caption),yaw:outward+1.02,rise:1.45};
  }
  const detectiveAtScene=stage==='Lab review'&&unit&&dist2(unit.pos,base)<3.8;
  if(detectiveAtScene&&PoliceDepartment.clock>=f.due-4.5){
   mid.lerp(unit.pos,.68);
   return {...street('Detective at scene',mid,1.07,4.85,name(f.detective)+' reviews the witness account and collected exhibits.'),
    yaw:outward-1.26,rise:.85};
  }
  for(const u of units)mid.add(u.pos);
  mid.divideScalar(units.length+1);
  const radius=Math.max(3.1,dist2(mid,base),...units.map(u=>dist2(mid,u.pos)));
  const key=stage==='Scene review'?'Evidence collection':'Scene handover';
  const caption=stage==='Scene review'?name(f.patrol)+' logs '+f.custody.length+' exhibits.':
   name(f.detective)+' takes the case from '+name(f.patrol)+'.';
  return {...street(key,mid,.95,Math.max(8.6,radius*1.75),caption),yaw:outward+.55,rise:2.7};
 }
 if(stage==='Lab queue'||stage==='Evidence examination'){
  const submitted=f.timeline.findLast(e=>e.message.startsWith('Requested comparison'));
  if(submitted&&PoliceDepartment.clock-submitted.at<2){
   const site=places.find(p=>p.office===hq),pos=new V3(site.door.x,groundY(site.door.x,site.door.z),site.door.z);
   return {key:'Headquarters',pos,height:5.3,distance:23,yaw:SIDEANG[site.side]+.36,location:hq.name,
    caption:'The detective sends the sealed exhibits to headquarters.'};
  }
  return room('Forensics','Evidence laboratory',f.analyst?name(f.analyst)+' examines the leather holdall and checks the contact records.':'The exhibits are waiting for an available analyst.');
 }
 if(stage==='Command queue')return room('Forensics','Lab findings',
  name(f.analyst)+' matches a print on the holdall to '+f.subjectName+', corroborating the witness.');
 if(stage==='Command review')return room('Command','Bulletin review',
  name(f.detective)+' submits the identification for review.');
 if(stage==='Wanted'||stage==='Booked')return room('Command','Wanted bulletin',
  name(f.supervisor)+' authorizes the bulletin for '+f.subjectName+'.');
 return room('Detectives','Open leads',name(f.detective)+' keeps the file open. The evidence cannot identify the offender.');
}
function updateCaseCamera(dt){
 const a=streetIncidents.current;
 if(!a||!caseCamera.enabled)return;
 if(state!=='play'||player.down>0||player.car){stopCaseCamera();return;}
 const shot=caseShot(a),p=shot.pos,cut=caseCamera.shot?.key!==shot.key;
 if(cut)caseCamera.cutAt=time;
 caseCamera.focus=p;caseCamera.shot=shot;
 const r=perim(blocks[clamp(Math.floor(p.x/CELL),0,N-1)*N+clamp(Math.floor(p.z/CELL),0,N-1)]);
 const edge=perimT(r,p.x,p.z),[x,z]=perimPos(r,edge);
 const outward=Math.atan2(x-(r.x0+r.x1)/2,z-(r.z0+r.z1)/2);
 const heading=shot.yaw??outward,drift=.11*Math.sin((time-caseCamera.cutAt)*.33);
 const aim=new V3(p.x,p.y+shot.height,p.z);
 let view=null,maxClear=-1;
 if(shot.eye){
  view=shot.eye.clone();view.y+=1.75;view.x+=drift*.6;
 }else for(const angle of [heading+drift,heading+.8,heading-.8,heading+Math.PI]){
  const dx=Math.sin(angle)*shot.distance,dz=Math.cos(angle)*shot.distance;
  const end=new V3(aim.x+dx,aim.y+(shot.rise??(shot.key==='Headquarters'?2.6:.57)),aim.z+dz);
  const clearance=cameraClearance(aim.x,aim.y,aim.z,end.x,end.y,end.z);
  if(clearance>maxClear){view=end.lerp(aim,1-clearance);maxClear=clearance;}
  if(clearance>.98)break;
 }
 if(cut){caseCamera.position.copy(view);caseCamera.aim.copy(aim);}
 else{const blend=1-Math.exp(-5.5*dt);caseCamera.position.lerp(view,blend);caseCamera.aim.lerp(aim,blend);}
 camera.position.copy(caseCamera.position);camera.lookAt(caseCamera.aim);
 camera.fov=innerWidth<innerHeight?65:48;camera.updateProjectionMatrix();
 const line=shot.location+' · '+shot.key;
 if(caseCaption.firstElementChild.textContent!==line)caseCaption.firstElementChild.textContent=line;
 if(caseCaption.lastElementChild.textContent!==shot.caption)caseCaption.lastElementChild.textContent=shot.caption;
 caseCaption.hidden=false;
}
