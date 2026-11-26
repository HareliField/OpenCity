/* An optional observer of the current street case. All state transitions belong to the simulation. */
const caseCamera={enabled:false,focus:null,shot:null,position:new V3(),aim:new V3(),cutAt:0};
const caseControl=$('followStreetCase'),caseCaption=$('caseCaption');
function stopCaseCamera(){
 if(!caseCamera.enabled)return;
 caseCamera.enabled=false;caseCamera.focus=null;caseCamera.shot=null;
 caseControl.textContent='Follow street incident';caseCaption.hidden=true;document.body.classList.remove('watchingCase');camInit=false;
}
function toggleCaseCamera(){
 if(caseCamera.enabled){stopCaseCamera();return;}
 if(!streetIncidents.current||state!=='play'||player.car||player.down>0||shopOpen)return;
 caseCamera.enabled=true;caseControl.textContent='Return to player';document.body.classList.add('watchingCase');
}
caseControl.onclick=toggleCaseCamera;
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
 if(stage==='Filed')return room('Communications','Call received',(f.caller?.name||'A resident')+' reports a person down. Communications takes the location.');
 if(stage==='Patrol assigned'||stage==='Lab review'){
  const unit=fieldInvestigators.get(f.id),patrol=stage==='Patrol assigned';
  const mid=new V3(base.x,base.y,base.z);
  if(unit)mid.lerp(unit.pos,.55);
  return street(patrol?'Patrol response':'Detective at scene',mid,1.0,Math.max(4.35,unit?dist2(unit.pos,base)*.92:5),
   patrol?name(f.patrol)+' responds to the caller’s location.':name(f.detective)+' reviews the witness statement and the exhibits.');
 }
 if(stage==='Scene review')return street('Evidence collection',base,.62,3.7,
  name(f.patrol)+' records '+f.custody.length+' exhibits for the detective.');
 if(stage==='Lab queue'||stage==='Evidence examination'){
  const submitted=f.timeline.findLast(e=>e.message.startsWith('Requested comparison'));
  if(submitted&&PoliceDepartment.clock-submitted.at<2){
   const site=places.find(p=>p.office===hq),pos=new V3(site.door.x,groundY(site.door.x,site.door.z),site.door.z);
   return {key:'Headquarters',pos,height:3.3,distance:12,yaw:SIDEANG[site.side]+.21,location:hq.name,
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
 caseControl.hidden=!a||state!=='play'||!!player.car||shopOpen;
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
  const end=new V3(aim.x+dx,aim.y+(shot.key==='Headquarters'?2.2:.57),aim.z+dz);
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
