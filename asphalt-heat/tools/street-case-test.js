// Drive the street encounter and the real department together without opening the observer or the case desk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const THREE=require('../lib/three.min.js');
const source=id=>fs.readFileSync(path.join(__dirname,'../js',id+'.js'),'utf8');

function scenario({recognized=true,gloves=false,interrupt=false,cancelCall=false,district='oldtown'}={}){
 const ctx=vm.createContext({THREE,V3:THREE.Vector3,unitBox:new THREE.BoxGeometry(),window:{},assert,district});
 const run=s=>vm.runInContext(s,ctx);
 run(source('department'));
 run(`const fieldInvestigators=new Map(),scene=new THREE.Scene(),wanted=0,player={pos:new V3(11,0,10)};
  let time=0;
  const dist2=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z),los=()=>true,collideWorld=()=>{},groundY=()=>0;
  const blockOf=()=>({i:2,j:2,dist:district}),stopCaseCamera=()=>{};
  const sceneStreetFrame=()=>({tx:1,tz:0,nx:0,nz:1});
  const cvs=()=>[{}, {fillRect(){},fillText(){}}],ctex=()=>new THREE.Texture();
  const tracer=()=>{},emit=()=>{},noise=()=>{},distVol=()=>0,makeGun=()=>new THREE.Group();
  const attachPed=p=>{p.mode='walk';},killPed=p=>{p.dead=true;p.mode='down';};
  const people=['carrier','stranger','caller'];
  const peds=people.map((name,i)=>{
   const pos=new V3([10,13,19][i],0,10),root=new THREE.Group();root.position.copy(pos);scene.add(root);
   return {personId:name,residentName:name,neighborhood:'counter',mode:'walk',pos,c:{root,bones:{},yaw:0},hp:60,fv:new V3()};
  });
  const bag=new THREE.Group();peds[0].bag=bag;peds[0].c.root.add(bag);
  for(const p of peds)PoliceDepartment.identify(p);`);
 run(source('street-incidents'));
 ctx.recognized=recognized;ctx.withGloves=gloves;ctx.interrupt=interrupt;ctx.cancelCall=cancelCall;
 run(`if(!recognized)peds[2].neighborhood='elsewhere';
  // A print on a different bag at the same coordinates is an incidental contact.
  PoliceDepartment.touch(peds[1],{exhibit:'unrelated-bag'},peds[0].pos,'Dropped leather holdall');
  peds[1].gloves=withGloves;
  let dialAt=null,reportedAt=null;const markers=new Set();
  for(let i=0;i<2700;i++){
   time+=1/30;PoliceDepartment.clock=time;
   const a=streetIncidents.current;
   if(interrupt&&a?.phase==='Dispute'){peds[1].mode='flee';break;}
   if(cancelCall&&a?.phase==='Calling 911'){peds[2].dead=true;}
   updateStreetEncounter(1/30);
   const marker=streetIncidents.current?.evidenceMarker;if(marker)markers.add(marker);
   if(streetIncidents.current?.phase==='Calling 911')dialAt??=time;
   if(streetIncidents.current?.phase==='Reported')reportedAt??=time;
   PoliceDepartment.process();
  }
  if(interrupt)updateStreetEncounter(1/30);
 `);
 return {file:run('PoliceDepartment.cases[0]'),delay:run('reportedAt-dialAt'),scene:run('streetIncidents.current'),markers:run('Array.from(markers)')};
}
const solved=scenario({district:'downtown'});
assert.equal(solved.file.origin,'street');
assert.equal(solved.file.exercise,false);
assert.equal(solved.file.stage,'Wanted');
assert.equal(solved.file.title,'Homicide · Downtown · block 3 / 3');
assert.equal(solved.file.suspect,'stranger');
assert.equal(solved.file.caller.id,'caller');
assert(solved.delay>=3.59);
assert(solved.file.custody.every(exhibit=>exhibit.history.length===4));
assert.equal(solved.markers.length,1);
const traces=solved.file.evidence.filter(e=>e.type==='DNA'||e.type==='Print');
const bagIndex=traces.findIndex(e=>e.exhibit===solved.file.linkedExhibit);
assert.equal(solved.markers[0].userData.custodyTag,solved.file.custody[bagIndex].tag);
assert.equal(solved.markers[0].parent,null,'marker leaves the pavement before the exhibits reach the lab');
const unresolved=scenario({recognized:false,district:'docks'}).file;
assert.equal(unresolved.stage,'Open leads');
assert.equal(unresolved.title,'Homicide · Docks · block 3 / 3');
assert(unresolved.timeline.some(entry=>entry.message.includes('No witness identified a shooter')));
assert.equal(scenario({gloves:true}).file.stage,'Open leads');
assert.equal(scenario({cancelCall:true}).file.stage,'Unreported');
const interrupted=scenario({interrupt:true});
assert.equal(interrupted.file,undefined);
assert.equal(interrupted.scene,null);
console.log('Ambient homicide, interrupted encounter, delayed 911, corroboration, and open leads passed.');
