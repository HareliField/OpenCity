// Verify physical storeys with the same Three/Cannon code used by the streamed city.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const world=read('js/world.js'),ctx=vm.createContext({THREE,assert,console,window:{},$:()=>({style:{},classList:{}})});
const run=src=>vm.runInContext(src,ctx);
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
const plainBox=()=>{},addGeo=(mat,g)=>g.dispose();
`);
run(world.slice(world.indexOf('function lrect('),world.indexOf('const PASTEL=')));
run(read('js/street-plan.js'));run(read('js/city-works.js'));run(read('js/access.js'));run(read('js/building-construction.js'));run(read('js/suite-interiors.js'));run(read('js/domestic-fittings.js'));
run(read('js/city-services.js'));
run(read('js/civic-fittings.js'));
run(world.slice(world.indexOf('function buildCargoContainer'),world.indexOf('/* ---- landmarks')));
const game=read('js/game.js');run(game.slice(game.indexOf('function traceBox('),game.indexOf('const los=')));
run(`
 const r={x0:16,x1:40,z0:13,z1:28},block=blocks[0],brick={mat:material,rect:r,style:1,bay:2.73,fh:3.4,h:14.6};
 const building=createStoreys(block,r,.15,4.4,[brick]);
 extendStoreys(building,{x0:19,x1:37,z0:15,z1:26},14.6,25.4,material,{style:2,fh:3.6,bay:2.8});
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
 console.log(building.levels.length+' connected storeys, '+stepsWalked+' actual treads, '+count+' construction pieces; feet, rigid bodies, optical rays and sliding windows verified.');
 console.log(rooms.length+' fitted upper rooms with clear doors, a working tap, and two cargo leaves verified.');
`);
