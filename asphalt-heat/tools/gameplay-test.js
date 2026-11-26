// Run with node tools/gameplay-test.js. Exercise the shipped geometry and game rules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const element = {classList:{add(){}}, style:{}};
const context = vm.createContext({window:{}, THREE, assert, $:()=>element});
const run = code => vm.runInContext(code, context);
run(read('lib/cannon.js'));
run(`const CANNON=window.CANNON, CV=CANNON.Vec3, V3=THREE.Vector3, PHYS_GROUP={world:1};
 const CELL=64,N=2,W=N*CELL,HALF=8,LANE=4,STREET={steps:[]},places=[];
 const blocks=Array.from({length:N*N},()=>({bld:[],residual:[]}));
 const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),lerp=(a,b,k)=>a+(b-a)*k;
`);
run(read('js/vehicle-components.js'));
run(read('js/access.js'));
run(read('js/building-construction.js'));run(read('js/suite-interiors.js'));run(read('js/domestic-fittings.js'));
run(read('js/roads.js'));
run(read('js/street-plan.js'));
run(read('js/street-surface.js'));
run(read('js/harbor.js'));
run(read('js/freight.js'));
run(read('js/city-works.js'));
run(read('js/city-services.js'));
run(read('js/city-fixtures.js'));
run(read('js/civic-fittings.js'));
run(read('js/lighthouse.js'));
run(read('js/garden-cottages.js'));
run(read('js/coast.js'));
run(read('js/game.js'));
run(read('js/dispatch.js'));
// The input and renderer bootstraps are driven by the browser. Load the gameplay section here.
run(read('js/main.js').split('function renderShop()')[0]);

run(`
 const wall={x0:4,x1:5,z0:0,z1:12,y0:0,h:3};
 blocks[0].bld.push(wall);
 assert(rayWorld(1,2,8,2,1,1)<1,'street-level wall must block');
 assert.equal(rayWorld(1,2,8,2,5,5),1,'high ray clears wall');
 assert(rayWorld(1,2,8,2,7,-3)<1,'descending ray enters the top of the wall');
 const door={kind:'glass',x:15,z:2,ox:16,oz:2,yaw:0,base:0,w:2,h:2.2,thickness:.06,phase:0};
 ACCESS.grid.set(0,[door]);
 assert(rayWorld(16,1,16,3,1,1)<1,'closed glass blocks the camera and access');
 assert.equal(rayWorld(16,1,16,3,1,1,0,false),1,'glass is transparent to sight');
 door.phase=1;assert.equal(rayWorld(16,1,16,3,1,1),1,'open doorway clears the ray');

 const car={pos:new V3(8,0,2),vel:new V3(6,0,0),spec:{r:1.45,W:2,L:4},h:0};
 cars.push(car);
 player={pos:new V3(8,8.76,2),cash:100,down:0,c:{},weapon:'fist'};
 assert.equal(nearestCar(3.6),null,'enter cannot cross levels');
 assert.equal(carHitsBody(player.pos,.3),null,'collision cannot cross levels');
 player.pos.y=0;assert.equal(carHitsBody(player.pos,.3),car,'sideways impact counts');
 player.pos.x=3.5;car.pos.x=5.5;assert.equal(nearestCar(3.6),null,'enter cannot cross walls');
 blocks[0].bld.length=0;assert.equal(nearestCar(3.6),car,'unobstructed car can be used');

 state='play';const store={kind:'store',interact:{x:3.5,z:2},time:2,cash:[100,100]};
 robbing={p:store,t:1.99,beep:1};clerk={hands:1};
 updRob(.05);assert.equal(robbing,null);assert.equal(player.cash,100);assert.equal(clerk.hands,0);
 player.weapon='pistol';player.down=1;robbing={p:store,t:1.99,beep:1};
 updRob(.05);assert.equal(robbing,null);assert.equal(player.cash,100);

 const service={kind:'chop',road:{x:5.5,z:2}};places.push(service);
 player.down=0;player.car=car;car.vel.set(0,0,0);
 assert.equal(actionCtx().label,'SELL CAR');car.dead=true;assert.equal(actionCtx().label,'EXIT');
 car.dead=false;car.vel.x=6;assert.equal(actionCtx().label,'EXIT');
 car.vel.x=0;car.pos.z+=5;assert.equal(actionCtx().label,'EXIT');

 player.car=null;player.pos.set(3.5,8,2);store.door=store.interact;places.push(store);
 assert.equal(nearPlace(),undefined,'shop interaction cannot cross floors');
 player.pos.y=0;assert.equal(nearPlace(),store,'store is usable on its floor');
 blocks[0].bld.push(wall);player.pos.x=5.4;
 assert.equal(nearPlace(),undefined,'shop interaction cannot pass through a wall');
 blocks[0].bld.length=0;

 LAW.known=LAW.seen=true;LAW.anchor.set(384,.11,1220);
 assert.equal(searchGoal(384,1220,0).z,1220,'search stays at the freight quay');
 const gate=freightGateNode(384);
 assert(freightWaypoint(gate,LAW.anchor).z>FREIGHT.z0,'a patrol at the gate must advance into the terminal');
 const yard=HARBOR.yard,quayX=yard.streets[0];
 LAW.anchor.set(quayX,.17,yard.cross[1]);
 assert.equal(workingPortAt(LAW.anchor),yard,'the public quay has its own road system');
 assert.equal(searchGoal(quayX,yard.cross[1],0).z,yard.cross[1]);
 const dockEntry=freightGateNode(quayX,yard);
 assert.equal(dockEntry.x,quayX);assert(freightWaypoint(dockEntry,LAW.anchor).z>yard.z0);

 const route=new THREE.CatmullRomCurve3(GRADE_PROFILES[0].points.map(p=>new V3(...p)));
 for(const x of [448,832]){
  const row=route.getSpacedPoints(1500).reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best);
  assert(row.y-.46>4.5,'cross street must have vehicle clearance');
 }
 for(const [index,axis,crossings] of [[0,'x',[384,896]],[1,'z',[576,768]]]){
  const curve=new THREE.CatmullRomCurve3(GRADE_PROFILES[index].points.map(p=>new V3(...p)));
  const samples=curve.getSpacedPoints(1500);
  for(const crossing of crossings){
   const carriageway=samples.filter(p=>Math.abs(p[axis]-crossing)<=7.5);
   assert(carriageway.every(p=>p.y<.19),'at-grade crossings must clear the sides of the ramp');
  }
 }`);
run(`
 const w=CITY_WORKS,area=r=>(r.x1-r.x0)*(r.z1-r.z0),site=worksRect(325,375,270,375);
 const terrain=subtractCityOpenings(site,STREET_OPENINGS);
 assert(Math.abs(terrain.reduce((total,r)=>total+area(r),0)+STREET_OPENINGS.reduce((total,r)=>total+area(r),0)-area(site))<1e-7);
 for(const gap of STREET_OPENINGS)assert(!terrain.some(r=>worksInside(r,(gap.x0+gap.x1)/2,(gap.z0+gap.z1)/2)));
 w.floors.push({...w.gallery,y:w.levels[0]});
 assert.equal(worksFloorAt(346,320,-3.91,0),-3.91);
 assert.equal(worksFloorAt(346,320,0,0),0);
 const flight={...MARKET_STAIR,n:24,from:w.levels[0],to:w.levels[1],reverse:false};
 w.flights.push(flight);
 for(const backwards of [false,true]){
  let y=backwards?flight.to:flight.from;
  for(let i=0;i<=96;i++){
   const fraction=(backwards?96-i:i)/96,z=lerp(flight.z0,flight.z1,fraction);
   const height=worksFloorAt((flight.x0+flight.x1)/2,z,y,0);
   assert(Math.abs(y-height)<.19,'each stair tread remains reachable in both directions');y=height;
  }
 }
 Object.assign(w.lift,{shaft:w.shaft,levels:w.levels,labels:['CELLAR','MARKET','FLATS','ROOF'],
  gates:[],municipal:true,cab:new THREE.Group(),body:new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC})});
 w.lifts.push(w.lift);
 const rider=new V3((w.shaft.x0+w.shaft.x1)/2,.17,w.shaft.z1);
 player.car=null;w.lift.target=2;
 for(let i=0;i<90;i++)updateWorksLift(w.lift,1/60,rider);
 assert.equal(w.lift.y,.17,'a rider in the door prevents departure');
 rider.z-=1;w.grid=false;
 for(let i=0;i<90;i++)updateWorksLift(w.lift,1/60,rider);
 assert.equal(w.lift.y,.17,'power loss stops the municipal lift');
 w.grid=true;
 for(let i=0;i<420;i++)updateWorksLift(w.lift,1/60,rider);
 assert.equal(rider.y,4.25);assert.equal(w.lift.y,4.25);assert.equal(w.lift.doors,1);
 assert(Math.abs(w.lift.body.position.y+.08-rider.y)<1e-8,'collision deck and passenger arrive together');
 const frame=()=>new THREE.Object3D();Object.assign(w,{drain:frame(),tap:frame(),gauge:frame(),handwheel:frame(),breaker:frame(),sewerSight:frame(),m:{lamp:{}}});
 const tap={time:3.5,stream:frame()};w.fixtures.push(tap);w.water=.35;w.valve=true;w.pump=false;
 for(let i=0;i<120;i++)updateCityWorks(1/60,rider);
 assert(w.water>.35&&w.wastewater>.12&&tap.stream.visible,'basin discharge and storm sump respond independently');
 w.pump=true;w.valve=false;
 for(let i=0;i<330;i++)updateCityWorks(1/60,rider);
 assert(w.water<.35&&!w.tap.visible&&!tap.stream.visible,'water valve shuts the taps and the drain pump lowers the sump');
`);
run(`
 for(let k=0;k<blocks.length;k++)Object.assign(blocks[k],{i:Math.floor(k/N),j:k%N});
 buildServiceGraph();
 assert.equal(CITY_SERVICES.lots.length,N*N);
 for(const lot of CITY_SERVICES.lots){
  const seen=new Set();let n=lot;
  while(n.parent){assert(!seen.has(n),'city mains must drain toward the plant');seen.add(n);n=n.parent;}
  assert.equal(n,CITY_SERVICES.root);
 }
 w.pressure=1;w.fixtures.length=0;w.fixtures.push({x:12,z:9,y:4,time:2,stream:frame()});
 updateServiceGraph(1);assert(CITY_SERVICES.root.discharge>0);
 const isolated=serviceSector(12,9);isolated.power=false;
 assert(!cityPowerAt(12,9));assert(cityPowerAt(W-.5,W-.5));
 updateServiceGraph(1);assert.equal(supplyAt(12,9).volts,0);
 assert(supplyAt(W-.5,W-.5).volts>220);isolated.power=true;
 w.pressure=.04;updateServiceGraph(1);assert.equal(pressureAtFixture(w.fixtures[0]),0);
`);
// Run the same on-foot collision resolver through the descending and ascending cabin stairs.
const worldSource=read('js/world.js');
run(worldSource.slice(worldSource.indexOf('function lrect('),worldSource.indexOf('const PASTEL=')));
run(read('js/props.js'));
run(read('js/city-detail.js'));
run(`
 const STATIC=[];
 function placeScenery(){}
 detailFallback=()=>null;
 for(const [z,angle] of [[30,0],[83,Math.PI]])buildBeachLookout(W+33,z,angle);
 indexStatic();
 for(const [z,angle] of [[30,0],[83,Math.PI]]){
  const matrix=new THREE.Matrix4().makeRotationY(angle);matrix.setPosition(W+33,0,z);
  const point=u=>new V3(u,0,.11).applyMatrix4(matrix);
  let height=.02;
  for(const desc of [false,true])for(let k=0;k<=78;k++){
   const f=(desc?78-k:k)/78,p=point(lerp(2.84,-.78,f));
   p.y=groundY(p.x,p.z,height);
   assert(Math.abs(p.y-height)<.21,'coastal cabin tread at '+p.x+','+p.z+' changes height '+height+' to '+p.y);
   assert.equal(collideWorld(p,.36),null,'coastal cabin rails, door and eaves must clear the player');
   height=p.y;
   if(!desc&&k===78)assert(Math.abs(height-2.002)<.001,'the stair lands inside the cabin');
  }
  assert(Math.abs(height-.02)<.002,'the return trip reaches the beach');
 }
`);
// Put a dynamic load in the municipal car and drive it with the shipped 90 Hz physics loop.
const physicsSource=read('js/phys.js');
run(physicsSource.slice(physicsSource.indexOf('function physBox('),physicsSource.indexOf('class StreetVehicle')));
run(`
 const PHYS_DT=1/90,PH={w:new CANNON.World(),accumulator:0,mat:{ground:new CANNON.Material('ground'),concrete:new CANNON.Material('concrete')}};
 PH.w.gravity.set(0,-9.81,0);PH.ground=new CANNON.Body({mass:0});PH.w.addBody(PH.ground);
 const carLift=w.lift,shaft=carLift.shaft,cx=(shaft.x0+shaft.x1)/2,cz=(shaft.z0+shaft.z1)/2;
 carLift.y=.17;carLift.target=1;carLift.doors=1;
 carLift.cabDoors=[-1,1].map(sign=>({sign,width:1.12,node:frame(),shape:null}));
 installWorksPhysics();player.pos.set(cx,.17,cz);
 const cargo=new CANNON.Body({mass:12,shape:new CANNON.Box(new CV(.23,.22,.23))});
 cargo.position.set(cx,.40,cz);PH.w.addBody(cargo);
 for(let k=0;k<20;k++)physStep(1/30);
 cargo.position.z=shaft.z1-.13;cargo.aabbNeedsUpdate=true;
 for(let k=0;k<5;k++)physStep(1/30);
 assert(liftDoorOccupied(carLift,player.pos),'a load crossing the threshold is detected');
 carLift.target=2;for(let k=0;k<40;k++)physStep(1/30);
 assert.equal(carLift.y,.17,'cargo projecting into the open door keeps the cab at the landing');
 cargo.position.z=cz;cargo.aabbNeedsUpdate=true;
 for(const level of [2,0,1]){
  carLift.target=level;
  for(let k=0;k<330;k++)physStep(1/30);
  assert.equal(carLift.y,carLift.levels[level]);assert.equal(carLift.doors,1);
  assert(Math.abs(cargo.position.y-.22-carLift.y)<.055,'an independent rigid body must ride the cabin in both directions');
  assert(Math.abs(carLift.body.position.y+.08-carLift.y)<.002,'kinematic deck must stop at the visible landing');
 }
`);

run(`
 const washer=placeCityMachine('laundry-machine',4,.17,4,0,[.96,1.12,.90]);
 CITY_WORKS.valve=true;CITY_WORKS.pressure=1;CITY_SERVICES.next=0;updateServiceGraph(0);
 const panel=CITY_WORKS.panels.at(-1);
 panel.use();assert.equal(washer.remaining,40);
 let out=0;
 for(let i=0;i<600;i++){advanceLaundry(washer,1/60);out+=washer.discharge/60;}
 assert(Math.abs(washer.water-12)<.005,'metered fill reaches twelve litres');
 const feeder=serviceSector(4,4);feeder.power=false;
 const at=washer.remaining,phase=washer.phase;advanceLaundry(washer,2);
 assert.equal(washer.phase,phase);assert.equal(washer.remaining,at);
 feeder.power=true;let plantPeak=0;
 for(let i=0;i<2200;i++){
  advanceLaundry(washer,1/60);updateServiceGraph(1/60);out+=washer.discharge/60;
  plantPeak=Math.max(plantPeak,CITY_SERVICES.root.discharge);
 }
 assert.equal(washer.remaining,0);assert(Math.abs(out-12)<.005);assert(plantPeak>=1.6);
`);

// Upper-floor and cottage cisterns share the plant. Stored water still drains when the inlet closes.
run(`
 w.fixtures.length=0;w.pressure=1;CITY_SERVICES.next=0;updateServiceGraph(0);
 for(const hz of [30,60,120]){
  CIVIC.cisterns.length=0;
  const at=(x,z)=>({x,z,y:.17,volume:6,emptying:true,discharge:0,total:0});
  const pair=[at(12,9),at(W-12,W-10)];CIVIC.cisterns.push(...pair);
  w.pressure=0;CITY_SERVICES.next=0;updateServiceGraph(0);
  let litres=0,peak=0;
  for(let i=0;i<hz*5;i++){
   for(const c of pair){advanceCistern(c,1/hz);litres+=c.discharge/hz;}
   updateServiceGraph(1/hz);peak=Math.max(peak,CITY_SERVICES.root.discharge);
  }
  assert(Math.abs(litres-12)<.001);assert(Math.abs(peak-4.8)<.001);
  for(const c of pair){assert.equal(c.volume,0);assert.equal(c.emptying,false);assert(Math.abs(c.total-6)<.001);}
  w.pressure=1;CITY_SERVICES.next=0;updateServiceGraph(0);
  for(let i=0;i<hz*23;i++)for(const c of pair)advanceCistern(c,1/hz);
  assert(pair.every(c=>c.volume===6&&c.discharge===0));
 }
`);

run(`
 const packageWorld=new CANNON.World({gravity:new CV(0,-9.81,0)});
 const floorMaterial=new CANNON.Material(),boxMaterial=new CANNON.Material();
 packageWorld.addContactMaterial(new CANNON.ContactMaterial(boxMaterial,floorMaterial,{friction:.65,restitution:.11}));
 const receivingFloor=new CANNON.Body({mass:0,material:floorMaterial,position:new CV(9.1,.125,16.6)});
 receivingFloor.addShape(new CANNON.Box(new CV(24,.045,31)));packageWorld.addBody(receivingFloor);
 const carton=new CANNON.Body({mass:4.2,material:boxMaterial,position:new CV(25,.38,22)});
 carton.addShape(new CANNON.Box(new CV(.2315,.17,.1765)));
 carton.quaternion.setFromEuler(0,.31,0);
 carton.angularDamping=.24;carton.linearDamping=.035;packageWorld.addBody(carton);
 // A box resting under its own weight has four friction contacts before the hand pushes it.
 for(let i=0;i<150;i++)packageWorld.step(1/90);
 const PoliceDepartment={touch(){}};
 PROPS.active.clear();PROPS.active.add({t:'receiving-carton',body:carton});
 const operator={x:24.38,y:.17,z:22};
 assert.equal(propInteraction({...operator,y:3.22}),null,'a floor separates the hand from a carton below');
 const partition={x0:24.62,x1:24.72,z0:21.8,z1:22.2,y0:0,h:2.3};
 blocks[0].bld.push(partition);
 assert.equal(propInteraction(operator),null,'a wall blocks reaching the carton');
 blocks[0].bld.pop();
 const moving=propInteraction(operator);
 assert.equal(moving.label,'MOVE CARTON');moving.fn();
 for(let i=0;i<180;i++)packageWorld.step(1/90);
 carton.updateAABB();
 assert(carton.position.x>25.15,'the hand lifts the edge and shifts the carton');
 assert(Math.abs(carton.aabb.lowerBound.y-.17)<.006,'the displaced carton settles on the receiving floor');
`);
console.log('Gameplay regressions passed.');
