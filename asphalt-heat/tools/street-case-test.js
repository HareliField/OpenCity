// Drive the street encounter and the real department together without opening the observer or the case desk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const THREE=require('../lib/three.min.js');
const source=id=>fs.readFileSync(path.join(__dirname,'../js',id+'.js'),'utf8');

function scenario({recognized=true,gloves=false,interrupt=false,cancelCall=false,district='oldtown',callerDistance=9,arriveLater=false,recycleListener=false,fleeFirst=false}={}){
 const ctx=vm.createContext({THREE,V3:THREE.Vector3,unitBox:new THREE.BoxGeometry(),window:{},assert,district,callerDistance,arriveLater,recycleListener,fleeFirst});
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
   const pos=new V3([10,13,10+callerDistance][i],0,10),root=new THREE.Group();root.position.copy(pos);scene.add(root);
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
  let dialAt=null,reportedAt=null,intake=null,sceneReview=null;const markers=new Set();
  for(let i=0;i<2700;i++){
   time+=1/30;PoliceDepartment.clock=time;
   const a=streetIncidents.current;
   if(interrupt&&a?.phase==='Dispute'){peds[1].mode='flee';break;}
   if(cancelCall&&a?.phase==='Calling 911'){peds[2].dead=true;}
   if(a?.phase==='Draw'&&fleeFirst)peds[2].mode='flee';
   if(a?.phase==='Aftermath'&&fleeFirst&&time-a.since>4){
    peds[2].pos.x=a.at.x+48;peds[2].mode='walk';
   }
   if(a?.phase==='Aftermath'&&recycleListener)peds[2].personId='another-resident';
   if(a?.phase==='Aftermath'&&arriveLater&&time-a.since>8){
    peds[2].pos.x=a.at.x+6;peds[2].c.yaw=-Math.PI/2;
   }
   updateStreetEncounter(1/30);
   const marker=streetIncidents.current?.evidenceMarker;if(marker)markers.add(marker);
   if(streetIncidents.current?.phase==='Calling 911')dialAt??=time;
   if(streetIncidents.current?.phase==='Reported')reportedAt??=time;
   PoliceDepartment.process();
   const file=PoliceDepartment.cases[0];
   if(file?.stage==='Filed'&&!intake)intake=JSON.parse(JSON.stringify(file));
   if(file?.stage==='Scene review'&&!sceneReview)sceneReview=JSON.parse(JSON.stringify(file));
  }
  if(interrupt)updateStreetEncounter(1/30);
 `);
 return {file:run('PoliceDepartment.cases[0]'),delay:run('reportedAt-dialAt'),intake:run('intake'),sceneReview:run('sceneReview'),scene:run('streetIncidents.current'),markers:run('Array.from(markers)')};
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
const hearing=scenario({callerDistance:29});
assert.equal(hearing.intake.kind,'Gunfire report');
assert.equal(hearing.intake.caller.observation,'heard');
assert.equal(hearing.intake.contact,null);assert.equal(hearing.intake.victimName,null);
assert.equal(hearing.intake.evidence.length,1);
assert.match(hearing.intake.evidence[0].value,/I heard a shot.*Old Town/);
assert.doesNotMatch(hearing.intake.evidence[0].value,/carrier|stranger|injur|someone down/);
assert(hearing.delay>=3.59);
assert.equal(hearing.sceneReview.kind,'Homicide');assert.equal(hearing.sceneReview.victimName,null);
assert(hearing.sceneReview.custody.length>0);
assert(hearing.sceneReview.timeline.some(e=>e.message.includes('Located a fallen resident')));
assert.equal(hearing.file.stage,'Open leads');assert.equal(hearing.file.suspect,null);
assert.equal(hearing.file.victimName,'carrier');
assert(hearing.file.timeline.some(e=>e.message.includes('victim specimen matches the resident record')));
const resumedContext=vm.createContext({window:{},intake:JSON.parse(JSON.stringify(hearing.intake))});
vm.runInContext(source('department'),resumedContext);
vm.runInContext(`const save={version:1,cases:[intake],serial:1,clock:intake.opened,unavailable:[],personSerial:0,plateSerial:2817};
 const resumed=new CityPoliceDepartment({getItem:()=>JSON.stringify(save)});
 for(let i=0;i<80;i++){resumed.clock++;resumed.process();}`,resumedContext);
assert.equal(vm.runInContext('resumed.cases[0].stage',resumedContext),'Open leads');
assert.equal(vm.runInContext('resumed.cases[0].victimName',resumedContext),'carrier');
const fromSafety=scenario({callerDistance:29,fleeFirst:true});
assert.equal(fromSafety.intake.caller.observation,'heard');
assert.equal(fromSafety.file.suspect,null);
assert.equal(scenario({callerDistance:29,cancelCall:true}).file.stage,'Unreported');
assert.equal(scenario({callerDistance:29,recycleListener:true}).file.stage,'Unreported');
assert.equal(scenario({callerDistance:70}).file.stage,'Unreported');
const late=scenario({callerDistance:70,arriveLater:true});
assert.equal(late.intake.caller.observation,'discovery');
assert.match(late.intake.evidence.find(e=>e.type==='Statement').value,/found someone down/);
assert.equal(late.file.suspect,null);
const interrupted=scenario({interrupt:true});
assert.equal(interrupted.file,undefined);
assert.equal(interrupted.scene,null);
console.log('Ambient homicide, eyewitness and hearing-only 911, patrol discovery, laboratory identification, interruptions and open leads passed.');
