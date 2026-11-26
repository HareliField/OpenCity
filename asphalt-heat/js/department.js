const DEPARTMENT_KITS={
 Patrol:['Duty sidearm','Portable radio','Body camera','Restraints','Torch'],
 Detectives:['Holstered sidearm','Portable radio','Identification wallet','Field notebook'],
 'Metro SWAT':['Slung service carbine','Holstered sidearm','Protective helmet','Carrier','Radio'],
 Communications:['Console headset','Call terminal'],
 Forensics:['Protective coat','Gloves','Exhibit labels','Specimen case'],
 'Air Support':['Flight headset','Flight vest','Portable radio'],
 Command:['Holstered sidearm','Portable radio','Identification wallet']
};
/* One fictional city department. Records use game identities and simulation time. */
class CityPoliceDepartment {
 constructor(storage) {
  this.storage=storage;
  this.key='asphalt-heat.police.v1';
  this.staff=[];
  this.bindings=new Map();
  this.workstations=new Map();
  this.stations=[];
  this.transmissions=[];
  this.contacts=[];
  this.cases=[];
  this.serial=0;
  this.clock=0;
  this.unavailable=new Set();
  this.personSerial=0;
  this.plateSerial=2817;
  const names=[
   'Marisol Vega|Andre Bell|Samir Shah|Ruth Kim|Ben Ortiz|Tess Walker|Inez Park|Dev Cole|Nia Brooks|Eli Moreno|Kai Chen|Lena Price|Jo Grant|Ada Flynn|Tom Reyes|Maya Scott',
   'Nolan Reed|Sofia Cruz|Bea Morgan|Luis Soto|Ari Lane|Jay Owens|Noor Khan|Finn Ross|Eva Moss|Drew Silva|Mia Frost|Omar Blake|Rae Dove|Leo Hart|Nico Wells|Quinn Shaw',
   'Imani Ford|Alex Yu|Ravi Stone|Ana West|Cole Dunn|Jules Rice|Luz Dean|Max King|Pia Burke|Milan Gray|Zoe Nash|Theo Hall|Fern Lin|Kit Hale|Remy Cruz|Lara Finch'
  ];
  for(const [watch,line] of names.entries())for(const [i,name] of line.split('|').entries()){
   const badge=101+16*watch+i;
   const division=['Patrol','Metro SWAT','Detectives','Communications','Forensics','Air Support','Command'][i<8?0:i<10?1:i<12?2:i-9];
   const personId='ah-pd-'+badge;
   this.staff.push({personId,badge,name,division,watch,kit:DEPARTMENT_KITS[division],callSign:division.split(' ')[0]+' '+badge,
    home:['Old Town','Coast Ridge','Midtown','Eastside'][badge%4],...this.identity(personId)});
  }
  try{
   const save=JSON.parse(storage?.getItem(this.key)||'null');
   if(save?.version===1&&Array.isArray(save.cases)){
    this.cases=save.cases;this.transmissions=save.transmissions||[];this.serial=save.serial;this.clock=save.clock;
    this.unavailable=new Set(save.unavailable);this.personSerial=save.personSerial;this.plateSerial=save.plateSerial;
   }
  }catch{}
 }
 save(){
  try{this.storage?.setItem(this.key,JSON.stringify({version:1,cases:this.cases,transmissions:this.transmissions,serial:this.serial,clock:this.clock,
   unavailable:[...this.unavailable],personSerial:this.personSerial,plateSerial:this.plateSerial}));}catch{}
 }
 identity(personId){
  // Opaque in-game specimen labels. The registry key keeps different residents distinct.
  return {fingerprintId:'FP/'+personId,dnaId:'DNA/'+personId};
 }
 identify(actor){
  if(!actor.personId)actor.personId='ah-person-'+(++this.personSerial);
  Object.assign(actor,this.identity(actor.personId));
  for(const hand of ['LeftHand','RightHand']){
   const bone=actor.c?.bones?.[hand];
   if(bone)bone.userData.fingerprintId=actor.fingerprintId;
  }
  return actor.personId;
 }
 get watch(){return Math.floor(this.clock/480)%3;}
 duty(member){return member.watch===this.watch&&!this.unavailable.has(member.personId);}
 activeFile(member){
  return this.cases.find(f=>this.fieldAssignment(f,member.personId)||
   f.stage==='Evidence examination'&&f.analyst===member.personId||
   f.stage==='Command review'&&f.supervisor===member.personId);
 }
 working(member){return this.duty(member)||!this.unavailable.has(member.personId)&&!!this.activeFile(member);}
 status(member){
  if(this.unavailable.has(member.personId))return 'Out of service';
  const assigned=this.activeFile(member);
  if(assigned)return (this.duty(member)?'Assigned':'Held over')+' · file '+assigned.id;
  if(this.bindings.has(member.personId))return this.bindings.get(member.personId);
  if(this.workstations.has(member.personId))return this.workstations.get(member.personId);
  if(!this.duty(member))return 'Off duty · '+member.home;
  if(this.cases.some(c=>c.detective===member.personId&&['Filed','Lab review'].includes(c.stage)))return 'Working case';
  return 'On watch';
 }
 assigned(file){
  if(file.stage==='Patrol assigned'||file.stage==='Scene review')return file.patrol;
  if(file.stage==='Lab review')return file.detective;
  return null;
 }
 streetResponseActive(file){
  return file.origin==='street'&&file.kind==='Homicide'&&['Patrol assigned','Scene review','Lab review'].includes(file.stage);
 }
 fieldAssignment(file,personId){
  return this.assigned(file)===personId||this.streetResponseActive(file)&&file.response?.some(r=>r.personId===personId);
 }
 assignStreetResponse(file){
  const roles=['Scene lead','Witness liaison','Incident notes','Scene access','Public assistance'];
  file.response=[{personId:file.patrol,role:roles[0],slot:0,assignedAt:this.clock}];
  for(let slot=1;slot<roles.length;slot++){
   const member=this.available('Patrol');
   if(!member)break;
   file.response.push({personId:member.personId,role:roles[slot],slot,assignedAt:this.clock});
  }
 }
 available(division){
  const candidates=this.staff.filter(s=>s.division===division&&this.duty(s)&&!this.bindings.has(s.personId)&&
   !this.activeFile(s));
  return candidates.find(s=>!this.workstations.has(s.personId))||candidates[0];
 }
 claim(division,assignment){
  const member=this.available(division);
  if(member)this.bindings.set(member.personId,assignment);
  return member;
 }
 release(member){if(member)this.bindings.delete(member.personId);}
 withdraw(member){
  if(!member)return;
  this.release(member);this.unavailable.add(member.personId);this.save();
 }
 radio(from,message,clip,to=null){
  globalThis.asphaltAgentEvent?.('radio',{from,message});
  this.transmissions.unshift({at:this.clock,from,message,clip,to});
  this.transmissions.length=Math.min(30,this.transmissions.length);

 }
 touch(actor,object,at,label){
  if(actor.gloves)return;
  const value=actor.fingerprintId||this.identity(this.identify(actor)).fingerprintId;
  object.contactPrint=value;
  const trace={at:{x:at.x,y:at.y,z:at.z},type:'Print',value,source:label,exhibit:object.exhibit,time:this.clock};
  this.contacts=this.contacts.filter(e=>this.clock-e.time<120&&!(e.value===value&&e.source===label&&e.exhibit===object.exhibit&&e.at.x===at.x&&e.at.z===at.z));
  this.contacts.push(trace);
  if(this.contacts.length>96)this.contacts.shift();
 }
 logCase(file,from,message,to=null){
  (file.timeline||=[]).push({at:this.clock,from,message,to});
  this.radio(from,message+' · file '+file.id,undefined,to);
 }
 receiveCall(file,from,message){
  file.stage='Filed';file.due=this.clock+3;
  this.logCase(file,from,message);this.save();
 }
 file({kind,origin,linkedExhibit,at,victim,victimName,plate,witness,touch,source,contact,trace,reported=true,title,subjectName,exercise=false,scenario,caller}){
  const evidence=[];
  if(victim)evidence.push({type:'DNA',value:this.identity(victim).dnaId,source:'Injured person'});
  if(touch)evidence.push({type:'Print',value:touch,source});
  for(const e of this.contacts){
   if(this.clock-e.time>120||Math.abs((at.y||0)-e.at.y)>1.3||Math.hypot(at.x-e.at.x,at.z-e.at.z)>4)continue;
   if(!evidence.some(row=>row.type==='Print'&&row.value===e.value&&row.source===e.source&&row.exhibit===e.exhibit))evidence.push({type:'Print',value:e.value,source:e.source,exhibit:e.exhibit});
  }
  if(trace)evidence.push({type:'DNA',value:trace,source});
  if(witness)evidence.push({type:'Statement',value:witness,source:'Witness'});
  if(plate)evidence.push({type:'Plate',value:plate,source:'Vehicle sighting'});
  const entry={id:++this.serial,kind,origin,linkedExhibit,victimId:victim,victimName,at:{x:at.x,y:at.y,z:at.z},opened:this.clock,stage:reported?'Filed':'Unreported',
   title,subjectName,exercise,scenario,timeline:[],due:this.clock+3,evidence,contact:contact||null,detective:null,suspect:null,plate:plate||null};
  this.cases.push(entry);
  if(reported)this.receiveCall(entry,caller||'Communications',kind==='Shots reported'?'911 report of gunfire. Patrol requested.':kind+' reported. Patrol requested.');
  this.save();
  return entry;
 }
 process(){
  let changed=false;
  for(const c of this.cases){
   if(this.streetResponseActive(c)&&!c.response){this.assignStreetResponse(c);changed=true;}
   if(this.clock<c.due)continue;
   if(c.stage==='Filed'){
    const patrol=this.available('Patrol');if(!patrol)continue;
    c.patrol=patrol.personId;c.stage='Patrol assigned';c.due=this.clock+6;
    const dispatcher=this.staff.find(s=>s.division==='Communications'&&this.duty(s));
    if(!dispatcher){c.stage='Filed';c.patrol=null;continue;}
    this.logCase(c,dispatcher.name,'Assigned the reported location.',patrol.name);
    this.logCase(c,patrol.name,'Copy. Responding.',dispatcher.name);
    if(this.streetResponseActive(c)){
     this.assignStreetResponse(c);
     for(const responder of c.response.slice(1)){
      const member=this.staff.find(s=>s.personId===responder.personId);
      this.logCase(c,dispatcher.name,responder.role+' requested at the reported scene.',member.name);
     }
    }
   }else if(c.stage==='Patrol assigned'){
    const officer=this.staff.find(s=>s.personId===c.patrol);
    if(!officer||this.unavailable.has(c.patrol)){c.stage='Filed';c.patrol=null;changed=true;continue;}
    if(this.atScene&&!this.atScene(c))continue;
    if(c.kind==='Shots reported'){
     c.stage=c.contact?'Identified':'Open leads';c.suspect=c.contact;
     this.logCase(c,officer.name,c.contact?'Witness identified the shooter.':'Area checked. Shooter identity unconfirmed.');
    }else{
     c.stage='Scene review';c.due=this.clock+2;
     c.custody=c.evidence.filter(e=>e.type==='DNA'||e.type==='Print').map((e,i)=>({
      tag:c.id+'-'+(i+1),type:e.type,source:e.source,holder:officer.name,history:[{at:this.clock,by:officer.name,action:'Collected'}]
     }));
     this.logCase(c,officer.name,'Scene checked. Statements and '+c.custody.length+' exhibits forwarded.','Detectives');
    }
   }else if(c.stage==='Scene review'){
    const detective=this.available('Detectives');
    if(!detective)continue;
    c.detective=detective.personId;c.stage='Lab review';c.due=this.clock+9;
    this.transferExhibits(c,detective.name,'Received from patrol');
    this.logCase(c,detective.name,'Accepted the file and will review the scene.',this.staff.find(s=>s.personId===c.patrol)?.name);
   }else if(c.stage==='Lab review'){
    if(this.unavailable.has(c.detective)){c.detective=null;c.stage='Scene review';changed=true;continue;}
    if(this.atScene&&!this.atScene(c))continue;
    c.stage='Lab queue';c.due=this.clock;
    this.logCase(c,this.staff.find(s=>s.personId===c.detective).name,'Requested comparison and submitted sealed exhibits.','Forensics');
   }else if(c.stage==='Lab queue'){
    if(this.cases.some(f=>f.stage==='Evidence examination'))continue;
    const analyst=this.available('Forensics');
    if(!analyst)continue;
    c.analyst=analyst.personId;c.stage='Evidence examination';c.due=this.clock+5;
    this.transferExhibits(c,analyst.name,'Received for examination');
    this.logCase(c,analyst.name,'Exhibits received. Comparison in progress.',this.staff.find(s=>s.personId===c.detective)?.name);
   }else if(c.stage==='Evidence examination'){
    const analyst=this.staff.find(s=>s.personId===c.analyst);
    if(!analyst||this.unavailable.has(c.analyst)){c.stage='Lab queue';changed=true;continue;}
    let detective=this.staff.find(s=>s.personId===c.detective);
    if(!detective||!this.duty(detective)){
     const relief=this.available('Detectives');
     if(!relief)continue;
     this.logCase(c,detective?.name||'Detectives','File transferred to the incoming watch for review.',relief.name);
     c.detective=relief.personId;detective=relief;
    }
    const profile=c.contact?this.identity(c.contact):null;
    const match=profile&&c.evidence.some(e=>(!c.linkedExhibit||e.exhibit===c.linkedExhibit)&&
     (e.type==='Print'&&e.value===profile.fingerprintId||e.type==='DNA'&&e.source!=='Injured person'&&e.value===profile.dnaId));
    const statement=c.evidence.some(e=>e.type==='Statement');
    let finding='Evidence review complete. No corroborating contact trace.';
    if(match)finding='Contact trace matched the comparison record.';
    else if(c.origin==='street'&&!c.contact)finding='Exhibits retained. No witness identified a shooter for comparison.';
    this.logCase(c,analyst.name,finding);
    c.suspect=c.contact&&statement&&(match||c.plate)?c.contact:null;
    c.stage=c.suspect?(c.kind==='Homicide'?'Command queue':'Identified'):'Open leads';
    c.due=this.clock;
    this.transferExhibits(c,'Evidence storage','Sealed and returned');
    this.logCase(c,detective.name,c.suspect?'Witness account corroborated. '+(c.subjectName||c.suspect)+' identified.':'Evidence is insufficient to identify the offender. File remains open.');
   }else if(c.stage==='Command queue'){
    const chief=this.staff.find(s=>s.division==='Command'&&this.duty(s)&&!this.cases.some(f=>f.stage==='Command review'&&f.supervisor===s.personId));
    if(!chief)continue;
    c.stage='Command review';c.supervisor=chief.personId;c.due=this.clock+4;
    this.logCase(c,this.staff.find(s=>s.personId===c.detective)?.name||'Detectives','Submitted findings for bulletin review.',chief.name);
   }else if(c.stage==='Command review'){
    const chief=this.staff.find(s=>s.personId===c.supervisor);
    if(!chief||this.unavailable.has(c.supervisor)){c.stage='Command queue';changed=true;continue;}
    c.stage='Wanted';this.logCase(c,chief.name,'Reviewed the identification. Circulate the wanted bulletin.','Patrol');
   }else continue;
   changed=true;
  }
  if(changed)this.save();
 }
 transferExhibits(file,holder,action){
  for(const exhibit of file.custody||[]){
   exhibit.holder=holder;exhibit.history.push({at:this.clock,by:holder,action});
  }
 }
 sightVehicle(personId,plate){
  if(!plate)return;
  let updated=false;
  for(const c of this.cases){
   if(c.stage!=='Wanted'||c.suspect!==personId||c.plate===plate)continue;
   c.plate=plate;c.evidence.push({type:'Plate',value:plate,source:'Patrol sighting'});updated=true;
  }
  if(updated){this.radio('Patrol','Vehicle bulletin updated.','sighting');this.save();}
 }
 book(personId){
  let count=0;
  for(const c of this.cases)if(c.stage!=='Booked'&&c.suspect===personId){
   c.suspect=personId;c.stage='Booked';this.logCase(c,'Booking','Suspect booked.');count++;
  }
  if(count){this.radio('Booking',count+' linked file'+(count===1?'':'s')+' updated.','records');this.save();}
 }
}
const PoliceDepartment=new CityPoliceDepartment((()=>{try{return window.sessionStorage;}catch{return null;}})());
window.PoliceDepartment=PoliceDepartment;
