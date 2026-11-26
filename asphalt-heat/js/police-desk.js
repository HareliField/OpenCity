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
   rows.push(['File '+String(c.id).padStart(4,'0')+' · '+c.kind,c.stage+' · '+(detective?.name||'Awaiting assignment'),
    c.evidence.map(e=>e.type+' · '+e.source+' · '+e.value).join('\n')||'No evidence filed']);
  }
  if(!rows.length)rows.push(['No cases filed','']);
 }else if(deskTab==='Fugitives'){
  for(const c of pd.cases)if(c.stage==='Wanted')rows.push(['Homicide · file '+c.id,c.suspect+' · '+(c.plate||'No vehicle identified')]);
  if(!rows.length)rows.push(['No outstanding bulletins','']);
 }else if(deskTab==='Watch'){
  for(const s of pd.staff)rows.push([s.name+' · '+s.badge,s.division+' · Watch '+(s.watch+1),pd.status(s)]);
 }else{
  for(const t of pd.transmissions)rows.push([t.from,t.message]);
  if(!rows.length)rows.push(['Channel clear','']);
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

const policeAudio=new Map();
let policeVoice=null,radioSequence=0;
PoliceDepartment.onRadio=async function(transmission){
 const line=document.getElementById('policeRadio');
 line.textContent=transmission.from+'  ·  '+transmission.message;
 line.hidden=false;line.dataset.until=String(time+5);
 if(!ac||master.gain.value<=0||!transmission.clip)return;
 const sequence=++radioSequence;
 try{
  const clip=transmission.clip;
  if(!policeAudio.has(clip)){
   policeAudio.set(clip,fetch('audio/police/'+clip+'.m4a').then(r=>r.arrayBuffer()).then(b=>ac.decodeAudioData(b)).catch(e=>{policeAudio.delete(clip);throw e;}));
  }
  const buffer=await policeAudio.get(clip);
  if(sequence!==radioSequence||master.gain.value<=0)return;
  if(policeVoice)policeVoice.stop();
  const voice=ac.createBufferSource(),band=ac.createBiquadFilter(),gain=ac.createGain();
  band.type='bandpass';band.frequency.value=1500;band.Q.value=.72;gain.gain.value=.55;
  voice.buffer=buffer;voice.connect(band).connect(gain).connect(master);policeVoice=voice;
  voice.onended=()=>{if(policeVoice===voice)policeVoice=null;voice.disconnect();band.disconnect();gain.disconnect();};
  voice.start();
 }catch{}
};
