/* One fictional city department. Records use game identities and simulation time. */
class CityPoliceDepartment {
 constructor(storage) {
  this.storage=storage;
  this.key='asphalt-heat.police.v1';
  this.staff=[];
  this.bindings=new Map();
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
   this.staff.push({personId,badge,name,division,watch,callSign:division.split(' ')[0]+' '+badge,
    home:['Old Town','Coast Ridge','Midtown','Eastside'][badge%4],...this.identity(personId)});
  }
  try{
   const save=JSON.parse(storage?.getItem(this.key)||'null');
   if(save?.version===1&&Array.isArray(save.cases)){
    this.cases=save.cases;this.serial=save.serial;this.clock=save.clock;
    this.unavailable=new Set(save.unavailable);this.personSerial=save.personSerial;this.plateSerial=save.plateSerial;
   }
  }catch{}
 }
 save(){
  try{this.storage?.setItem(this.key,JSON.stringify({version:1,cases:this.cases,serial:this.serial,clock:this.clock,
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
 status(member){
  if(this.unavailable.has(member.personId))return 'Out of service';
  if(this.bindings.has(member.personId))return this.bindings.get(member.personId);
  if(!this.duty(member))return 'Off duty · '+member.home;
  if(this.cases.some(c=>c.detective===member.personId&&['Filed','Lab review'].includes(c.stage)))return 'Working case';
  return 'On watch';
 }
 available(division){
  return this.staff.find(s=>s.division===division&&this.duty(s)&&!this.bindings.has(s.personId)&&
   (division!=='Detectives'||!this.cases.some(c=>c.detective===s.personId&&c.stage==='Lab review')));
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
 radio(from,message,clip){
  this.transmissions.unshift({at:this.clock,from,message,clip});
  this.transmissions.length=Math.min(30,this.transmissions.length);
  this.onRadio?.(this.transmissions[0]);
 }
 touch(actor,object,at,label){
  if(actor.gloves)return;
  const value=actor.fingerprintId||this.identity(this.identify(actor)).fingerprintId;
  object.contactPrint=value;
  const trace={at:{x:at.x,y:at.y,z:at.z},type:'Print',value,source:label,time:this.clock};
  this.contacts=this.contacts.filter(e=>this.clock-e.time<120&&!(e.value===value&&e.source===label&&e.at.x===at.x&&e.at.z===at.z));
  this.contacts.push(trace);
  if(this.contacts.length>96)this.contacts.shift();
 }
 file({kind,at,victim,plate,witness,touch,source,contact,trace,reported=true}){
  const evidence=[];
  if(victim)evidence.push({type:'DNA',value:this.identity(victim).dnaId,source:'Injured person'});
  if(touch)evidence.push({type:'Print',value:touch,source});
  for(const e of this.contacts){
   if(this.clock-e.time>120||Math.abs((at.y||0)-e.at.y)>1.3||Math.hypot(at.x-e.at.x,at.z-e.at.z)>4)continue;
   if(!evidence.some(row=>row.type==='Print'&&row.value===e.value&&row.source===e.source))evidence.push({type:'Print',value:e.value,source:e.source});
  }
  if(trace)evidence.push({type:'DNA',value:trace,source});
  if(witness)evidence.push({type:'Statement',value:witness,source:'Witness'});
  if(plate)evidence.push({type:'Plate',value:plate,source:'Vehicle sighting'});
  const entry={id:++this.serial,kind,at:{x:at.x,y:at.y,z:at.z},opened:this.clock,stage:reported?'Filed':'Unreported',
   due:this.clock+4,evidence,contact:contact||null,detective:null,suspect:null,plate:plate||null};
  this.cases.push(entry);
  if(reported)this.radio('Dispatch',kind+' report · file '+entry.id,'report');
  this.save();
  return entry;
 }
 process(){
  let changed=false;
  for(const c of this.cases){
   if(this.clock<c.due||!['Filed','Lab review'].includes(c.stage))continue;
   if(c.stage==='Filed'){
    const detectives=this.staff.filter(s=>s.division==='Detectives'&&this.duty(s)&&!this.cases.some(f=>f.detective===s.personId&&f.stage==='Lab review'));
    if(!detectives.length)continue;
    c.detective=detectives[0].personId;c.stage='Lab review';c.due=this.clock+9;
    this.radio(detectives[0].callSign,'Taking file '+c.id+' to the evidence desk.','assigned');
   }else{
    if(this.unavailable.has(c.detective)){
     c.detective=null;c.stage='Filed';c.due=this.clock+1;changed=true;continue;
    }
    const analyst=this.staff.find(s=>s.division==='Forensics'&&this.duty(s));
    if(!analyst)continue;
    c.analyst=analyst.personId;
    // Victim specimens identify the victim. Other matches are leads until corroborated.
    const playerProfile=this.identity('ah-player');
    const traceMatch=c.evidence.some(e=>e.type==='Print'&&e.value===playerProfile.fingerprintId||e.type==='DNA'&&e.source!=='Injured person'&&e.value===playerProfile.dnaId);
    c.suspect=c.contact==='ah-player'||traceMatch&&c.evidence.some(e=>e.type==='Plate')?'ah-player':null;
    c.stage=c.kind==='Homicide'&&c.suspect?'Wanted':c.suspect?'Identified':'Open leads';
    this.radio('Records','File '+c.id+' · '+c.stage.toLowerCase()+'.','records');
   }
   changed=true;
  }
  if(changed)this.save();
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
  for(const c of this.cases)if(c.stage!=='Booked'&&(c.suspect===personId||c.contact===personId)){
   c.suspect=personId;c.stage='Booked';count++;
  }
  if(count){this.radio('Booking',count+' linked file'+(count===1?'':'s')+' updated.','records');this.save();}
 }
}
const PoliceDepartment=new CityPoliceDepartment((()=>{try{return window.sessionStorage;}catch{return null;}})());
window.PoliceDepartment=PoliceDepartment;
