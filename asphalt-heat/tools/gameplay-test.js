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
run(read('js/freight.js'));
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
 }`);
console.log('Gameplay regressions passed.');
