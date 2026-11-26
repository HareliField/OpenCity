// Geometry, road-user rules and driving regressions, using the shipped renderer math and physics.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const context=vm.createContext({window:{},THREE,assert,console,$:()=>({style:{},classList:{add(){}}})});
const run=source=>vm.runInContext(source,context);
run(read('lib/cannon.js'));
run(`const CANNON=window.CANNON,V3=THREE.Vector3,CELL=64,N=16,W=N*CELL,HALF=8,ORIGINAL_GRID=8;
 const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),lerp=(a,b,k)=>a+(b-a)*k;
 const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a)),pick=a=>a[0],rnd=(a,b)=>(a+b)/2;
 const MAT={asphalt:{},sidewalk:{},curb:{}},QUALITY={level:2},places=[],STREET={steps:[]};
 const blocks=Array.from({length:N*N},(_,k)=>{const i=Math.floor(k/N),j=k%N;
  return {i,j,x0:i*CELL+HALF,x1:(i+1)*CELL-HALF,z0:j*CELL+HALF,z1:(j+1)*CELL-HALF,bld:[],residual:[]};});
 const addGeo=(mat,geometry)=>geometry.dispose();
`);
const world=read('js/world.js');
run(world.slice(world.indexOf('function districtOf('),world.indexOf('const SPECIAL=')));
for(const name of ['phys','cargen','fleet','access','roads','street-plan','street-surface','city-works','city-services','city-traffic','game'])run(read('js/'+name+'.js'));
run(`
 player={pos:new V3(800,0,800),car:null};
 setCarLights=()=>{};
 const controls={};
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
  const control=junctionControl(i,j);
  controls[control]=(controls[control]||0)+1;
  if(i===0||j===0||i===N||j===N)assert.notEqual(control,'signal');
 }
 assert(controls.signal>20 && controls.signal<120);
 assert(controls['all-stop']>0 && controls['stop-ns']>0 && controls['stop-ew']>0);
 assert.equal(junctionControl(4,5),'signal');
 for(let g=0;g<SIGNAL_GROUPS;g++)for(let t=0;t<60;t+=.25){
  const {ns,ew}=phaseForGroup(g,t);
  assert(!(ns.vehicle!=='R'&&ew.vehicle!=='R'));
  if(ns.ped!=='wait')assert.equal(ew.vehicle,'R');
  if(ew.ped!=='wait')assert.equal(ns.vehicle,'R');
 }
 assert.equal(phaseForGroup(0,1).ns.ped,'walk');
 assert.equal(phaseForGroup(0,1).ns.vehicle,'R');
 assert.equal(phaseForGroup(0,8).ns.remaining,16);
 assert.equal(phaseForGroup(0,25).ns.vehicle,'Y');
 assert.equal(phaseForGroup(0,29).ew.vehicle,'R');
 assert.equal(phaseForGroup(0,29).ns.vehicle,'R');
 const w=ROAD_SECTIONS.waterfront;
 assert(laneCenter(w,0,-1)>w.median && -laneCenter(w,0,1)<w.median);
 assert(parkingCenter(w,-1)>1.4 && parkingCenter(w,-1)<3.85);
 assert.equal(parkingCenter(ROAD_SECTIONS.avenue,0),undefined);

 function approx(a,b,epsilon,what){assert(Math.abs(a-b)<epsilon,what+' '+a+' vs '+b);}
 physInit();
 const block=blocks[2*N+4];Object.assign(PAVING,{gutter:{},repair:{},warning:{}});
 buildSidewalk(block);buildCarriageway('ns',2,4);
 const tiles=new Set([...STREET_TERRAIN.values()].flat());
 for(const tile of tiles)terrainBody(tile);
 function hit(x,z){
  const result=new CANNON.RaycastResult();
  PH.w.raycastClosest(new CV(x,1.1,z),new CV(x,-.25,z),{skipBackfaces:true},result);
  assert(result.hasHit,'tyre ray misses ground');return result.hitPointWorld.y;
 }
 const rampX=block.x0,rampZ=4*CELL+STREET_DESIGN.crossing;
 for(const d of [.001,.45,1.0,1.84,2.1])approx(hit(rampX+d,rampZ),groundY(rampX+d,rampZ),.001,'ramp height');
 approx(hit(block.x0+.1,block.z0+.1),0,.001,'rounded corner clears the road');
 const x=2*CELL-2.65,z=4.5*CELL;
 assert(hasSpeedHump('ns',2,4));
 for(const d of [-1.83,-1.2,-.60,0,.64,1.15,1.83])approx(hit(x,z+d),groundY(x,z+d),.001,'visible hump matches wheel contact');
 approx(hit(x,z)-hit(x,z+2.1),.076,.001,'hump rise');
 approx(hit(x+1,z+3)-hit(x,z+3),.02,.001,'road crown');
 // The height query also follows the actual triangular planes in transition zones.
 for(const t of [16.8,18.3,20.4,23.2,32.21,44.8])for(const u of [-7.2,-5.9,1.8,5.1])
  approx(hit(2*CELL+u,4*CELL+t),builtStreetHeight(2*CELL+u,4*CELL+t),.001,'pedestrian and wheel surface');
 assert(hasCurbExtension(4,5,0,-1));
 buildCurbExtension(4,5,0,-1);
 const approachZ=5*CELL+STREET_DESIGN.crossing,faceX=4*CELL+HALF-EXTENSION_WIDTH;
 for(const tile of STREET_TERRAIN.get(4*N+5))if(!tiles.has(tile)){tiles.add(tile);terrainBody(tile);}
 approx(hit(faceX+.01,approachZ),.001,.002,'extended ramp meets crosswalk');
 approx(hit(faceX+.93,approachZ),builtStreetHeight(faceX+.93,approachZ),.001,'extension collision matches visual ramp');
 assert(!hasCurbExtension(3,5,0,-1),'four-lane avenue stays clear');
 const garage=blocks[5*N+6],garageZ=(garage.z0+garage.z1)/2;
 ACCESS.doors.push({kind:'shutter',base:.15,w:4.6,yaw:-Math.PI/2,ox:garage.x0+4,oz:garageZ});
 surveyDriveways();buildSidewalk(garage);
 for(const tile of STREET_TERRAIN.get(5*N+6))if(!tiles.has(tile)){tiles.add(tile);terrainBody(tile);}
 assert(nearDriveway(garage.x0-1,garageZ,2));
 approx(hit(garage.x0+.01,garageZ),.0146,.002,'driveway lip');
 approx(hit(garage.x0+1.18,garageZ),builtStreetHeight(garage.x0+1.18,garageZ),.001,'wide vehicle apron');
 let humps=0;
 for(let line=0;line<=N;line++)for(let block=0;block<N;block++)for(const axis of ['ns','ew']){
  if(hasSpeedHump(axis,line,block))humps++;
 }
 assert(humps>5);

 const fleet=Object.keys(CARSPEC).filter(id=>CARSPEC[id].modelName && CARSPEC[id].form);
 assert.equal(fleet.length,12);
 for(const id of fleet){
  const spec=CARSPEC[id],geo=carGeo(id).geo;
  assert(CITY_FLEET.traffic.includes(id) && CITY_FLEET.parked.includes(id));
  assert(geo.attributes.position.array.every(Number.isFinite));
  assert(geo.groups[3].count>0 && geo.groups[4].count>0);
  assert(spec.wb+spec.wr<spec.L/2 && spec.mass>1000);
 }
 const f150=carProfile(CARSPEC.f150),mx5=carProfile(CARSPEC.miata);
 assert(f150.sect(-2).open && !f150.sect(0).open,'pickup bed and cab');
 assert(mx5.sect(0).open,'open cockpit');

 function carOn(a,b,exit,lane=0,back=38,physical=false){
  const ai={a,b,lane},m=ai.movement=planMovement(ai,exit),s=CARSPEC.civic;
  const c={type:s.type,spec:s,ai,h:Math.atan2(m.dx,m.dz),pos:new V3(m.x-m.dx*back-m.dz*m.u,0,m.z-m.dz*back+m.dx*m.u),
   vel:new V3(),speed:8,hp:s.hp,max:s.hp,driver:'ai',upY:1,driverPace:1};
  c.pos.y=groundY(c.pos.x,c.pos.z);cars.push(c);
  if(physical)physCarOn(c);return c;
 }
 function reset(){cars.length=peds.length=PH.cars.length=0;PH.accumulator=0;physInit();}
 function advance(dt,c){aiTraffic(c,dt);if(c.phys){physStep(dt);physCarRead(c);}}
 const gaps=[];
 for(const physical of [false,true]){
  reset();
  const car=carOn([4,4],[4,5],[3,5],0,37,physical),m=car.ai.movement;
  const behind=carOn([4,4],[4,5],[4,6],0,49,physical);
  const start=signalGroup(4,5)*6;
  for(let n=0;n<720;n++){
   time=start+34+n/90;advance(1/90,car);
   // Both physical cars step in the same world.
   aiTraffic(behind,1/90);if(physical)physCarRead(behind);
   assert(approachGap(car,m)>-.12,'front bumper crossed the red stop bar, physical='+physical+' t='+n/90+' gap='+approachGap(car,m)+' speed='+car.speed);
  }
  assert(car.speed<.3 && approachGap(car,m)<1.3,'lead vehicle reaches a full stop at the bar');
  assert(behind.pos.z+behind.spec.L/2<car.pos.z-car.spec.L/2-.4,'queue preserves bumper clearance');
  gaps.push(approachGap(car,m).toFixed(2));cars.splice(cars.indexOf(behind),1);if(physical)physCarOff(behind);
  for(let n=0;n<1500 && car.ai.movement===m;n++){time=start+64+n/90;advance(1/90,car);}
  assert(car.ai.a[0]===4 && car.ai.a[1]===5 && car.ai.b[0]===3,'right turn reaches receiving link');
  approx(car.pos.z,5*CELL-ROAD_SECTIONS.avenue.outer,1.12,'turn finishes in right receiving lane');
 }
 // Exercise every approach and turn on both axes, from the first lane to the receiving lane.
 for(const [dx,dz] of CARDINAL)for(const turn of [-1,0,1]){
  const b=[8,5],a=[b[0]-dx,b[1]-dz],ex=turn?-dz*turn:dx,ez=turn?dx*turn:dz,e=[b[0]+ex,b[1]+ez];
  reset();const c=carOn(a,b,e,Number(turn>0),33),m=c.ai.movement;
  const start=signalGroup(...b)*6+(dx?34:4);
  for(let n=0;n<1200 && c.ai.movement===m;n++){
   time=start+n/90;advance(1/90,c);
   const lot=blockOf(c.pos.x,c.pos.z);
   assert(!lot || sidewalkHeight(lot,c.pos.x,c.pos.z)<.01,'turn cuts through a corner');
  }
  assert(c.ai.b[0]===e[0] && c.ai.b[1]===e[1],'car completes turn '+dx+','+dz+' '+turn);
  const normalOffset=(c.pos.x-b[0]*CELL)*-ez+(c.pos.z-b[1]*CELL)*ex;
  approx(normalOffset,laneCenter(segmentSection(b,e),ex,ez,m.exitLane),1.25,'receiving lane');
 }
 reset();time=0;
 const first=carOn([1,7],[1,8],[1,9]),second=carOn([0,8],[1,8],[2,8]);
 const m1=first.ai.movement,m2=second.ai.movement;
 assert.equal(m1.rule,'all-stop');assert(conflictingPaths(m1,m2));
 first.speed=second.speed=0;
 assert(!canEnter(first,m1,.4,.1));time=.25;assert(!canEnter(second,m2,.4,.1));
 time=1.25;assert(!canEnter(second,m2,.4,1));assert(canEnter(first,m1,.4,1));
 assert(!canEnter(second,m2,.4,1),'crossing traffic holds while first car clears');
 cars.splice(0,1);assert(canEnter(second,m2,.4,1),'next stop-line arrival goes after first');
 reset();time=signalGroup(4,5)*6+10;
 const north=carOn([4,4],[4,5],[5,5]),south=carOn([4,6],[4,5],[4,4]);
 assert(!canEnter(north,north.ai.movement,.35,.04),'permissive left yields to oncoming traffic');
 cars.pop();
 const crossing={i:4,j:5,axis:'ns',legX:1,legZ:0,waiting:false};
 peds.push({pos:new V3(269,0,322),cross:crossing,mode:'walk'});
 assert(!canEnter(north,north.ai.movement,.35,.04),'turn yields to walking pedestrian');
 cars.length=0;time=signalGroup(4,5)*6+1;
 assert(pedestrianCanStart(peds[0],crossing));time+=9;assert(!pedestrianCanStart(peds[0],crossing),'clearance prevents starting a crossing');
 console.log('Street regressions passed.',controls,{speedHumps:humps,fleet:fleet.length,stopBarGaps:gaps});
`);
