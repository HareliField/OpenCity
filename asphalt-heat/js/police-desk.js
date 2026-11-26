const policeDesk=document.getElementById('policeDesk');
let deskTab='Cases',deskStation=null,deskRevision='';
function openPoliceDesk(station){
 deskStation=station;deskRevision='';shopOpen=true;
 document.getElementById('deskStation').textContent=station.name;
 renderPoliceDesk();policeDesk.showModal();
}
function renderPoliceDesk(){
 const pd=PoliceDepartment;
 const rows=[];
 if(deskTab==='Cases'){
  for(const c of [...pd.cases].reverse())if(c.stage!=='Unreported'){
   const detective=pd.staff.find(p=>p.personId===c.detective);
   const history=(c.timeline||[]).map(event=>{
    const seconds=Math.max(0,Math.floor(event.at-c.opened));
    return '+'+Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s · '+event.from+' — '+event.message;
   });
   rows.push(['File '+String(c.id).padStart(4,'0')+' · '+(c.title||c.kind),(c.suspect&&c.kind==='Homicide'?'Solved · ':'')+c.stage+' · '+(detective?.name||'Awaiting assignment'),
    history.join('\n'),c.evidence.map(e=>e.type+' · '+e.source+' · '+e.value).join('\n')||'No evidence filed']);
  }
  if(!rows.length)rows.push(['No cases filed','']);
 }else if(deskTab==='Fugitives'){
  for(const c of pd.cases)if(c.stage==='Wanted')rows.push(['Homicide · file '+c.id,(c.subjectName||c.suspect)+' · '+(c.plate||'No vehicle identified')]);
  if(!rows.length)rows.push(['No outstanding bulletins','']);
 }else if(deskTab==='Watch'){
  for(const s of pd.staff.filter(s=>pd.duty(s)||pd.cases.some(f=>pd.assigned(f)===s.personId)))rows.push([s.name+' · '+s.badge,s.division+' · Watch '+(s.watch+1),pd.status(s)]);
 }else{
  for(const t of pd.transmissions)rows.push([t.from,t.message]);
  if(!rows.length)rows.push(['Channel clear','']);
 }
 document.getElementById('deskExercise').hidden=deskTab!=='Cases';
 document.getElementById('followCase').textContent=pd.cases.some(c=>c.exercise&&c.stage!=='Wanted'&&c.stage!=='Booked')?'Following training homicide':'Follow a training homicide';
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


document.getElementById('followCase').onclick=()=>{
 const pd=PoliceDepartment;
 if(pd.cases.some(c=>c.exercise&&c.stage!=='Wanted'&&c.stage!=='Booked'))return;
 const site=places.find(p=>p.office===deskStation).door;
 const subject='training-resident-lee';
 pd.file({kind:'Homicide',title:'Training homicide · Old Town',exercise:true,at:{x:site.x,y:groundY(site.x,site.z),z:site.z},
  victim:'training-resident-hall',caller:'911 · shop clerk',witness:'Shop clerk saw Morgan Lee at the scene',
  subjectName:'Morgan Lee',contact:subject,touch:pd.identity(subject).fingerprintId,source:'Recovered exhibit'});
 renderPoliceDesk();
};
