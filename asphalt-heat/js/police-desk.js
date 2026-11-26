const policeDesk=document.getElementById('policeDesk');
let deskTab='Cases',deskStation=null,deskRevision='';
function openPoliceDesk(station,view){
 if(view)deskTab=view;
 deskStation=station;deskRevision='';shopOpen=true;
 document.getElementById('deskStation').textContent=view?station.name+' · '+view:station.name;
 renderPoliceDesk();policeDesk.showModal();
}
function renderPoliceDesk(){
 const pd=PoliceDepartment;
 document.getElementById('deskStation').textContent=deskStation.name+' · '+deskTab;
 const rows=[];
 if(deskTab==='Cases'){
  for(const c of [...pd.cases].reverse())if(c.stage!=='Unreported'){
   const detective=pd.staff.find(p=>p.personId===c.detective);
   const history=(c.timeline||[]).map(event=>{
    const seconds=Math.max(0,Math.floor(event.at-c.opened));
    return '+'+Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s · '+event.from+(event.to?' → '+event.to:'')+' — '+event.message;
   });
   rows.push(['File '+String(c.id).padStart(4,'0')+' · '+(c.title||c.kind),(c.kind==='Homicide'&&['Wanted','Booked'].includes(c.stage)?'Solved · ':'')+c.stage+' · '+(detective?.name||'Awaiting assignment'),
    history.join('\n'),c.evidence.map(e=>e.type+' · '+e.source+' · '+e.value).join('\n')||'No evidence filed']);
  }
  if(!rows.length)rows.push(['No cases filed','']);
 }else if(deskTab==='Evidence'){
  for(const c of pd.cases)for(const e of c.custody||[])rows.push(['Exhibit '+e.tag+' · '+e.type,e.source+' · '+e.holder,e.history.map(h=>h.action+' · '+h.by).join('\n')]);
  if(!rows.length)rows.push(['No exhibits received','']);
 }else if(deskTab==='Booking'){
  for(const c of pd.cases)if(c.stage==='Booked')rows.push(['Booking · file '+c.id,(c.subjectName||c.suspect)+' · '+c.kind]);
  if(!rows.length)rows.push(['No bookings recorded','']);
 }else if(deskTab==='Equipment'){
  for(const s of pd.staff.filter(s=>pd.duty(s)))rows.push([s.name+' · '+s.badge,s.division,s.kit.join(' · ')]);
 }else if(deskTab==='Fugitives'){
  for(const c of pd.cases)if(c.stage==='Wanted')rows.push(['Homicide · file '+c.id,(c.subjectName||c.suspect)+' · '+(c.plate||'No vehicle identified')]);
  if(!rows.length)rows.push(['No outstanding bulletins','']);
 }else if(deskTab==='Watch'){
  for(const s of pd.staff.filter(s=>pd.duty(s)||pd.cases.some(f=>pd.assigned(f)===s.personId)))rows.push([s.name+' · '+s.badge,s.division+' · Watch '+(s.watch+1),pd.status(s)]);
 }else{
  for(const t of pd.transmissions)rows.push([t.from+(t.to?' → '+t.to:''),t.message]);
  if(!rows.length)rows.push(['Channel clear','']);
 }
 document.getElementById('deskExercise').hidden=deskTab!=='Cases';
 for(const [id,scenario] of [['followCase','homicide'],['followCall','heard'],['followPair','paired']]){
  document.getElementById(id).disabled=trainingInProgress(scenario);
 }
 const revision=JSON.stringify([deskTab,rows]);
 if(revision===deskRevision)return;
 deskRevision=revision;
 const list=document.getElementById('deskRows');list.replaceChildren();
 for(const row of rows){
  const li=document.createElement('li');
  for(const [i,label] of row.entries())if(label){
   const el=document.createElement(i===0?'strong':'span');el.textContent=label;li.append(el);
  }
  list.append(li);
 }
 for(const b of policeDesk.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===deskTab));
}
for(const b of policeDesk.querySelectorAll('[data-view]'))b.onclick=()=>{deskTab=b.dataset.view;renderPoliceDesk();};
document.getElementById('deskClose').onclick=()=>policeDesk.close();
policeDesk.addEventListener('close',()=>{shopOpen=false;deskStation=null;});
function toggleGloves(){
 if(state!=='play'||shopOpen)return;
 player.gloves=!player.gloves;dressPlayerHands();
 document.getElementById('gloves').textContent=player.gloves?'Gloves on':'Gloves off';
 document.getElementById('gloves').setAttribute('aria-pressed',String(player.gloves));
}
document.getElementById('gloves').onclick=toggleGloves;


function trainingInProgress(scenario){
 return PoliceDepartment.cases.some(c=>c.exercise&&(c.scenario||'homicide')===scenario&&
  !['Wanted','Booked','Open leads','Identified'].includes(c.stage));
}
function followTraining(scenario){
 if(trainingInProgress(scenario))return;
 const pd=PoliceDepartment,site=places.find(p=>p.office===deskStation).door;
 const at={x:site.x,y:groundY(site.x,site.z),z:site.z};
 const shared={exercise:true,scenario,at};
 if(scenario==='heard'){
  pd.file({...shared,kind:'Shots reported',title:'Training call · upstairs caller',caller:'911 · upstairs resident',
   witness:'Caller heard a noise from the street and had no view of the person responsible.'});
 }else{
  const subject='training-resident-lee-'+(pd.serial+1);
  pd.file({...shared,kind:'Homicide',title:'Training homicide · shop entrance',victim:'training-resident-hall',
   caller:'911 · shop clerk',witness:'Shop clerk identified Morgan Lee in a statement.',subjectName:'Morgan Lee',
   contact:subject,touch:pd.identity(subject).fingerprintId,source:'Recovered exhibit'});
  if(scenario==='paired'){
   pd.file({...shared,kind:'Homicide',title:'Training homicide · second report',victim:'training-resident-nolan',
    caller:'911 · building caretaker',witness:'Caretaker found the victim after closing and saw nobody else.'});
  }
 }
 renderPoliceDesk();
}
document.getElementById('followCase').onclick=()=>followTraining('homicide');
document.getElementById('followCall').onclick=()=>followTraining('heard');
document.getElementById('followPair').onclick=()=>followTraining('paired');
