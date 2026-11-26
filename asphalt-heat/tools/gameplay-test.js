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
run(read('js/access.js'));
run(read('js/roads.js'));
run(read('js/street-plan.js'));
run(read('js/street-surface.js'));
run(read('js/freight.js'));
run(read('js/city-works.js'));
run(read('js/city-services.js'));
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
console.log('Gameplay regressions passed.');
