// Verify physical storeys with the same Three/Cannon code used by the streamed city.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const world=read('js/world.js'),ctx=vm.createContext({THREE,assert,console,window:{},$:()=>({style:{},classList:{}})});
const run=src=>vm.runInContext(src,ctx);
const core=read('js/core.js');
run(core.slice(core.indexOf('function mergeGeos('),core.indexOf('function flushBuckets(')));
run(read('lib/cannon.js'));
run(`const CANNON=window.CANNON,CV=CANNON.Vec3,V3=THREE.Vector3,PHYS_GROUP={world:1};
const CELL=64,N=2,W=128,HALF=8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const lin=c=>new THREE.Color(c).convertSRGBToLinear(),unitBox=new THREE.BoxGeometry(1,1,1),scene=new THREE.Scene();
const material=new THREE.MeshStandardMaterial(),MAT={fac:{brick_red:material},darkMetal:material,metal:material,trim:material,roof:material,stone:material};
const INTERIORS={materials:{ceiling:material,tile:material,wood:material,wallTile:material,darkWood:material,plaster:material,glass:new THREE.MeshPhysicalMaterial({transparent:true})}};
const PH={w:new CANNON.World({gravity:new CV(0,-9.81,0)}),mat:{concrete:new CANNON.Material()}},physRemove=b=>PH.w.removeBody(b);
const blocks=Array.from({length:N*N},(_,k)=>{const i=Math.floor(k/N),j=k%N;return{i,j,x0:8+CELL*i,x1:56+CELL*i,z0:8+CELL*j,z1:56+CELL*j,bld:[],residual:[]};});
const STREET={steps:[]},FREIGHT={},SIDEANG={N:Math.PI,S:0,E:Math.PI/2,W:-Math.PI/2},noise=()=>{};
const traceCove=()=>1,collideCove=()=>null,collideGradeRails=()=>null,collideProps=()=>null,walkVehicleParts=()=>null;
const groundY=(x,z,y)=>storeyGroundAt(blocks[0],x,z,y,.15),facadeBox=()=>{};
const blockOf=(x,z)=>blocks.find(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);
const plainBox=()=>{},addGeo=(mat,g)=>g.dispose(),freightMarkings=()=>{};
`);
run(world.slice(world.indexOf('function lrect('),world.indexOf('const PASTEL=')));
run(read('js/street-plan.js'));run(read('js/city-works.js'));run(read('js/access.js'));run(read('js/building-construction.js'));run(read('js/suite-interiors.js'));run(read('js/domestic-fittings.js'));
run(read('js/city-services.js'));
run(read('js/shop-architecture.js'));
run(read('js/civic-fittings.js'));run(read('js/fire-escapes.js'));
run("const SW=4;"+world.slice(world.indexOf('function streetSides('),world.indexOf('function shopDressing(')));
run(world.slice(world.indexOf('function buildCargoContainer'),world.indexOf('/* ---- landmarks')));
const game=read('js/game.js');run(game.slice(game.indexOf('function traceBox('),game.indexOf('const los=')));
run(game.slice(game.indexOf('function groupStaticParts('),game.indexOf('function collideWorld(')));
run(`
 const r={x0:16,x1:40,z0:13,z1:28},block=blocks[0],brick={mat:material,rect:r,style:1,bay:2.73,fh:3.4,h:14.6};
 const building=createStoreys(block,r,.15,4.4,[brick]);
 extendStoreys(building,{x0:19,x1:37,z0:15,z1:26},14.6,25.4,material,{style:2,fh:3.6,bay:2.8});
 assert.equal(block.curtainFaces.length,4);
 for(const face of block.curtainFaces){assert.equal(face.y0,14.6);assert.equal(face.h,25.4);}
 let count=0,stepsWalked=0;
 const c=building.core,xy=(u,v)=>c.alongX?[v,u]:[u,v];
 function rayY(x,z,top,range=.29){
  const result=new CANNON.RaycastResult();
  PH.w.raycastClosest(new CV(x,top+.1,z),new CV(x,top-range,z),{skipBackfaces:true},result);
  assert(result.hasHit,'Cannon finds the walking surface');assert(Math.abs(result.hitPointWorld.y-top)<.001);
 }
 for(const l of building.levels){
  const {steps,halfRise,mid}=flightMetrics(l);
  physicalParts(l);let floor=l.y0;
  if(l.tier.style===2){
   const finish=curtainMaterials(l.tier.seed);
   assert(l.parts.some(p=>p.role==='glass'&&p.mat===finish.glass&&p.mat.transparent));
   assert(l.parts.some(p=>p.mat===finish.panel&&p.h===l.h),'back-painted panel conceals the slab edge');
   assert.equal(l.sashes.length,0,'curtain units stay fixed while masonry sash windows can slide');
  }
  for(const second of [false,true]){
   const u=second?(c.uc+c.u1)/2:(c.u0+c.uc)/2;
   for(let k=0;k<steps;k++){
    const v=second?c.v1-c.run*(k+.5)/steps:c.v0+c.run*(k+.5)/steps,[x,z]=xy(u,v);
    const target=(second?mid:l.y0)+(k+1)*halfRise/steps;
    const h=groundY(x,z,floor);assert(Math.abs(h-target)<1e-6,'continuous ascending stairs at '+l.index+' '+k);
    rayY(x,z,h);let sides=0;
    forConstructionParts(building,h+.16,h+1.65,p=>{
     if(p.role!=='floor'&&rectDistance(p,x,z)<.32)sides++;
    });assert.equal(sides,0,'a person and handrails fit without clipping');
    floor=h;stepsWalked++;
   }
   if(!second){
    for(let k=0;k<8;k++){const [x,z]=xy(c.u0+.32+(c.u1-c.u0-.64)*k/7,c.v1+c.landing/2);
     assert.equal(groundY(x,z,floor),mid,'both flights share a level landing');rayY(x,z,mid);}
   }
  }
  const [x,z]=xy(c.uc,c.v0-.47);assert(Math.abs(groundY(x,z,floor)-l.h)<1e-6);rayY(x,z,l.h);
  const dx=building.x0+1,dz=building.z0+1;
  if(withinRect(l.rect,dx,dz))assert.equal(groundY(dx,dz,l.y0),l.y0,'the roof cannot pull a walker through the storey');
  // Longitudinal sight inside a room goes through air, while the floor supports an object.
  assert.equal(rayWorld(l.rect.x0+.65,l.rect.z0+1,l.rect.x0+.65,l.rect.z1-1,l.y0+1.65,l.y0+1.65),1);
  count+=l.parts.length;
 }
 for(const l of building.levels.slice().reverse()){
  const {steps,halfRise,mid}=flightMetrics(l);let y=l.h;
  for(const second of [true,false]){
   const u=second?(c.uc+c.u1)/2:(c.u0+c.uc)/2;
   for(let k=steps-1;k>=0;k--){
    const v=second?c.v1-c.run*(k+.5)/steps:c.v0+c.run*(k+.5)/steps,[x,z]=xy(u,v);
    const next=groundY(x,z,y);assert(Math.abs(next-y)<=.181);y=next;
   }
  }
  assert(Math.abs(y-l.y0)<=.181,'descending reaches the correct floor');
 }
 const M=new THREE.Matrix4().makeTranslation(27,0,37);
 const glazing=groundGlazing(block,M,-2,2,.36,2.97);physicalParts(glazing);
 const sash=glazing.sashes[0],x=(sash.area.x0+sash.area.x1)/2,z=sash.area.z1+.65;
 assert(rayWorld(x,z,x,z-1.5,1.42,1.42)<1,'closed glass is physically present');
 assert.equal(rayWorld(x,z,x,z-1.5,1.42,1.42,0,false),1,'daylight and sight pass through the glass');
 const action=constructionWindowAction({x,y:.15,z});assert.equal(action.label,'SLIDE WINDOW OPEN');action.fn();
 for(let i=0;i<32;i++)advanceSashes(1/60,{x,y:.15,z});
 assert.equal(sash.phase,1);assert.equal(rayWorld(x,z,x,z-1.5,1.42,1.42),1,'open sash clears half the aperture');
 function windowContact(){const out=new CANNON.RaycastResult();PH.w.raycastClosest(new CV(x,1.42,z),new CV(x,1.42,z-1.5),{},out);return out.hasHit;}
 assert.equal(windowContact(),false,'vehicle and rigid-body ray follow the opened sash');
 constructionWindowAction({x,y:.15,z}).fn();for(let i=0;i<32;i++)advanceSashes(1/60,{x,y:.15,z});
 assert.equal(sash.phase,0);assert(windowContact(),'closed glass is restored to Cannon');
 const upper=building.levels[1],window=upper.sashes[0],wx=(window.area.x0+window.area.x1)/2,wz=(window.area.z0+window.area.z1)/2;
 const a=constructionWindowAction({x:wx,y:upper.y0,z:wz-.45});assert.equal(a.label,'SLIDE WINDOW OPEN');a.fn();
 for(let i=0;i<32;i++)advanceSashes(1/60,{x:wx,y:upper.y0,z:wz-.45});
 assert.equal(window.phase,1);
 physRemove(upper.body);upper.body=null;releaseStoreyParts(upper);storeyParts(upper);assert.equal(upper.sashes[0].phase,1,'state survives streaming');
 for(const l of building.levels){if(l.body)physRemove(l.body);l.body=l.parts=l.sashes=null;}
 planUpperRooms(block);
 for(const l of building.levels)storeyParts(l);
 const rooms=building.levels.flatMap(l=>l.rooms||[]),galley=building.levels.flatMap(l=>l.fittings||[]).find(f=>f.tap);
 assert(rooms.length>=4&&galley);
 for(const room of rooms){
  const d=room.door,dx=Math.sin(d.yaw)*.8,dz=Math.cos(d.yaw)*.8,probe=()=>rayWorld(d.ox+dx,d.oz+dz,d.ox-dx,d.oz-dz,d.base+1.42,d.base+1.42,.33);
  assert(probe()<1);d.phase=1;assert.equal(probe(),1,'furniture leaves the open flat entrance clear');d.phase=0;
 }
 // The open entrance leaf must also leave space to turn through an adjoining bathroom door.
 for(const alongX of [false,true]){
  const trial={dist:'oldtown',structures:[]},level={rect:{x0:0,x1:15,z0:0,z1:15},y0:4.4,h:7.7};
  const sample={block:trial,core:{alongX,uc:7.5,u0:6.195,u1:8.805,v0:5.23},levels:[level]};level.owner=sample;
  trial.structures.push(sample);planUpperRooms(trial);assert.equal(level.rooms.length,2);
  for(const room of level.rooms){
   const bath=room.bath.door,entry=room.door,opened=doorwayPose(entry,1),h=entry.base+1.03;
   const offset=new V3(Math.sin(bath.yaw)*.64,0,Math.cos(bath.yaw)*.64);
   const inverse=new THREE.Quaternion().setFromAxisAngle(_entryUp,opened.yaw).invert();
   const start=new V3(bath.ox,h,bath.oz).sub(offset).sub(new V3(opened.x,opened.y,opened.z)).applyQuaternion(inverse);
   const delta=offset.multiplyScalar(2).applyQuaternion(inverse),half=new V3(entry.w/2,entry.h/2,entry.thickness/2);
   assert.equal(traceBox(start,delta,half.clone().negate(),half,.33),1,'adjoining leaves open clear of a 66 cm walking passage');
  }
 }
 const tap=galley.tap,standing={x:tap.reachX,y:tap.y,z:tap.reachZ};
 CITY_SERVICES.lots[0]={pressure:310,sector:{power:true}};CITY_WORKS.m={channel:material};
 const runTap=suiteFixtureAction(standing);assert.equal(runTap.label,'RUN KITCHEN TAP');runTap.fn();
 assert(CITY_WORKS.fixtures.includes(tap)&&tap.stream&&tap.time>0);
 suiteFixtureAction(standing).fn();retireSuiteTaps();assert(!tap.stream&&!CITY_WORKS.fixtures.includes(tap));
 const fridge=building.levels.flatMap(l=>l.fittings||[]).find(f=>f.leaf);
 const leaf=fridge.leaf,outside=appliancePoint(fridge,0,.72),inside=appliancePoint(fridge,0,.140),elevation=fridge.y+1.16;
 const foodRay=()=>rayWorld(outside.x,outside.z,inside.x,inside.z,elevation,elevation);
 const wheelRay=()=>{const hit=new CANNON.RaycastResult();
  PH.w.raycastClosest(new CV(outside.x,elevation,outside.z),new CV(inside.x,elevation,inside.z),{},hit);
  return hit.hasHit;
 };
 physicalParts(leaf.owner);assert(foodRay()<1&&wheelRay(),'closed refrigerator has a real door');
 const op={x:leaf.opX,y:fridge.y-.004,z:leaf.opZ};
 const openFridge=suiteFixtureAction(op);assert.equal(openFridge.label,'OPEN REFRIGERATOR');openFridge.fn();
 for(let i=0;i<42;i++)animateRefrigerators(1/60,standing);
 assert.equal(leaf.phase,1);assert.equal(foodRay(),1);assert.equal(wheelRay(),false);
 const bathroom=building.levels.flatMap(l=>l.fittings||[]).find(f=>f.cistern);
 assert(bathroom,'deep flats include a plumbed washroom');
 const cistern=bathroom.cistern;
 residentialFixtureAction(bathroom).fn();assert(CIVIC.cisterns.includes(cistern));
 for(let i=0;i<2400;i++)advanceCistern(cistern,1/60);
 assert(Math.abs(cistern.total-6)<.00001&&cistern.volume>5.99);retireSuiteTaps();assert(!CIVIC.cisterns.includes(cistern));
 buildCargoContainer(blocks[2],82,33,.15,0x8a5940,'W',true);
 const leaves=ACCESS.doors.filter(d=>d.kind==='cargo');assert.equal(leaves.length,2);
 for(const d of leaves){
  const probe=()=>rayWorld(d.ox-1,d.oz,d.ox+1,d.oz,1.66,1.66,.33);
  assert(probe()<1);d.phase=1;assert.equal(probe(),1);assert(doorwayPose(d,1).x<d.ox-.45,'both handed leaves swing outside');
 }
 assert.equal(rayWorld(82.4,34.22,87.6,34.22,1.58,1.58,.33),1,'container interior is air');
 const stairBlock=blocks[3],oldLot={x0:76,x1:116,z0:76,z1:95},legacy=createStoreys(stairBlock,oldLot,.15,4.4,[{mat:material,rect:oldLot,style:1,bay:2.6,fh:3.3,h:17.6}]);
 legacy.escapeCandidate=true;planUpperRooms(stairBlock);installFireEscapes(stairBlock);
 assert.equal(stairBlock.fireEscapes.length,1);
 groupStaticParts();for(const group of new Set(stairBlock.bld.filter(r=>r.compound).map(r=>r.compound)))staticPartsBody(group);
 const deckProbe=(tread,reference)=>{
  const x=(tread.x0+tread.x1)/2,z=(tread.z0+tread.z1)/2;
  assert.equal(fireEscapeGroundAt(stairBlock,x,z,reference,.15),tread.y);
  rayY(x,z,tread.y);
 };
 let previous=.15;
 for(const t of stairBlock.escapeFloors.filter(t=>(t.x1-t.x0<.4||t.z1-t.z0<.4))){
  deckProbe(t,previous);previous=t.y;
 }
 for(const l of legacy.levels.slice(1)){
  const d=l.fireDoor.door,dx=.79*Math.sin(d.yaw),dz=.79*Math.cos(d.yaw);
  const thru=()=>rayWorld(d.ox+dx,d.oz+dz,d.ox-dx,d.oz-dz,d.base+1.38,d.base+1.38,.33);
  assert(thru()<1);d.phase=1;assert.equal(thru(),1,'open fire exit clears the room and the steel landing');
  assert.equal(fireEscapeGroundAt(stairBlock,d.ox+dx,d.oz+dz,d.base,.15),l.y0);
 }
 const wallPart={...oldLot,y0:.15,h:3,mat:material},dyed=buildPartBatches([{...wallPart,tint:0xceae76},wallPart]),bare=buildPartBatches([wallPart]);
 assert.notEqual(dyed[0].material,bare[0].material,'coloured and bare instance shaders keep separate bindings');
 const white=new THREE.Color();dyed[0].getColorAt(1,white);assert.equal(white.getHex(),0xffffff);
 disposePartBatches(dyed);disposePartBatches(bare);
 const first={i:4,j:4},second={i:5,j:4},finish=new THREE.MeshBasicMaterial();
 collectBuildingProxy(first,finish,new THREE.BoxGeometry(2,4,2));
 finishBuildingProxies(false);
 collectBuildingProxy(second,finish,new THREE.BoxGeometry(3,5,4).translate(12,0,5));
 finishBuildingProxies(true);
 const front=first.proxies[0],rear=second.proxies[0],sector=front.sector,index=sector.mesh.geometry.index;
 assert.equal(sector,rear.sector);
 const original=Array.from(index.array);
 front.hidden=true;updateProxySector(sector);
 assert.equal(sector.mesh.geometry.drawRange.count,rear.end-rear.start);
 assert.deepEqual(Array.from(index.array.slice(0,rear.end-rear.start)),original.slice(rear.start,rear.end));
 rear.hidden=true;updateProxySector(sector);assert.equal(sector.mesh.visible,false);
 front.hidden=false;rear.hidden=false;updateProxySector(sector);
 assert(sector.mesh.visible);assert.deepEqual(Array.from(index.array),original);
 console.log(legacy.levels.length-1+' exterior fire exits, '+stairBlock.escapeFloors.length+' grated decks and treads verified.');
 console.log(building.levels.length+' connected storeys, '+stepsWalked+' actual treads, '+count+' construction pieces; feet, rigid bodies, optical rays and sliding windows verified.');
 console.log(rooms.length+' fitted upper rooms with clear doors, a working tap, and two cargo leaves verified.');
`);
