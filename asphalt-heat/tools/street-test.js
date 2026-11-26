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
run(read('js/weather.js'));run(read('js/weather-cover.js'));
run('const weather=new CoastalWeather(70,10),weatherCover=new WeatherCoverMap();');
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
for(const name of ['phys','cargen','fleet','access','roads','street-plan','street-surface','city-works','city-services','city-traffic','lighthouse','garden-cottages','game'])run(read('js/'+name+'.js'));
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
  if(!hasSpeedHump(axis,line,block))continue;
  if(!(axis==='ns' && line===2 && block===4))buildCarriageway(axis,line,block);
  const getPoint=(t,u)=>axis==='ns'?[line*CELL+u,block*CELL+t]:[block*CELL+t,line*CELL+u];
  for(const tile of STREET_TERRAIN.get(cellKey(...getPoint(CELL/2,1))))if(!tiles.has(tile)){tiles.add(tile);terrainBody(tile);}
  for(const sign of [-1,1]){
   const u=sign*ROAD_SECTIONS.local.inner;
   approx(hit(...getPoint(CELL/2,u))-hit(...getPoint(CELL/2+2.1,u)),.076,.001,'hump in each lane');
  }
  for(const points of humpChevrons(axis,ROAD_SECTIONS.local.inner)){
   const [base,tip]=points,sign=Math.sign(base[1]),direction=axis==='ns'?-sign:sign;
   assert((tip[0]-base[0])*direction>0,'chevron faces approaching traffic');
   for(const [t,u] of points)approx(hit(...getPoint(t,u)),segmentHeight(axis,line,block,t,u),.001,'paint touches the graded road');
  }
  humps++;
 }
 assert(humps>5);

 const fleet=Object.keys(CARSPEC).filter(id=>CARSPEC[id].modelName && CARSPEC[id].form);
 assert.equal(fleet.length,12);
 const face=dishedWheelFace(),pos=face.attributes.position,norm=face.attributes.normal;
 for(let i=0;i<pos.count;i++)assert(Math.sign(pos.getX(i))*norm.getX(i)>.5,'wheel faces point outwards');
 const signatures=new Set();
 for(const id of fleet){
  const spec=CARSPEC[id],geo=carGeo(id).geo;
  assert(CITY_FLEET.traffic.includes(id) && CITY_FLEET.parked.includes(id));
  assert(geo.attributes.position.array.every(Number.isFinite));
  assert(geo.groups[3].count>0 && geo.groups[4].count>0);
  assert(spec.wb+spec.wr<spec.L/2 && spec.mass>1000);
  const trim=WHEEL_TRIMS.find(([model])=>model===id);
  assert(trim && trim[1]*.0254/2<spec.wr && trim[5]<spec.W*.16);
  signatures.add(trim.slice(1).join(','));
 }
 assert.equal(signatures.size,fleet.length);
 const f150=carProfile(CARSPEC.f150),mx5=carProfile(CARSPEC.miata);
 assert(f150.sect(-2).open && !f150.sect(0).open,'pickup bed and cab');
 assert(mx5.sect(0).open,'open cockpit');

 function carOn(a,b,exit,lane=0,back=38,physical=false,model='civic'){
  const ai={a,b,lane},m=ai.movement=planMovement(ai,exit),s=CARSPEC[model];
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
 // Test each tyre on all twelve models, in the near and distant traffic solvers.
 let movements=0;
 function insideExtension(tile,x,z){
  if(x<=tile.x0 || x>=tile.x1 || z<=tile.z0 || z>=tile.z1)return false;
  return tile.faces.some(face=>face.every((a,i)=>{
   const b=face[(i+1)%face.length];
   return (b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0])<=.000001;
  }));
 }
 function checkMovement(b,extensions,model,physical,dx,dz,turn){
  const a=[b[0]-dx,b[1]-dz],ex=turn?-dz*turn:dx,ez=turn?dx*turn:dz,e=[b[0]+ex,b[1]+ez];
  reset();const c=carOn(a,b,e,Number(turn>0),33,physical,model),m=c.ai.movement;
  const tyreWidth=WHEEL_TRIMS.find(([id])=>id===model)[5],outerEdge=c.spec.W/2-.14+tyreWidth/2;
  const start=signalGroup(...b)*6+(dx?34:4);
  for(let n=0;n<1800 && c.ai.movement===m;n++){
   time=start+n/90;advance(1/90,c);
   for(const fore of [-c.spec.wb,c.spec.wb])for(const side of [-1,1]){
    const x=c.pos.x+Math.sin(c.h)*fore+Math.cos(c.h)*side*outerEdge;
    const z=c.pos.z+Math.cos(c.h)*fore-Math.sin(c.h)*side*outerEdge;
    const lot=blockOf(x,z);
    const msg='tyre ran across the curb '+b+' '+model+' '+physical+' '+dx+','+dz+' '+turn;
    assert(!lot || sidewalkHeight(lot,x,z)<.003,msg);
    assert(!extensions.some(tile=>insideExtension(tile,x,z)),msg+' on a curb extension');
   }
  }
  assert(c.ai.b[0]===e[0] && c.ai.b[1]===e[1],'car completes turn '+b+' '+model+' '+dx+','+dz+' '+turn);
  const normalOffset=(c.pos.x-b[0]*CELL)*-ez+(c.pos.z-b[1]*CELL)*ex;
  approx(normalOffset,laneCenter(segmentSection(b,e),ex,ez,m.exitLane),1.25,'receiving lane '+b+' '+model+' '+physical+' '+turn);movements++;
 }
 // Two avenues, a collector with curb extensions, Juniper at Bay, a local all-way stop, and the offset waterfront.
 for(const b of [[8,5],[4,5],[2,7],[1,8],[15,7]]){
  const before=new Set([...STREET_TERRAIN.values()].flat());
  for(const [dx,dz] of CARDINAL)if(hasCurbExtension(...b,dx,dz))buildCurbExtension(...b,dx,dz);
  const extensions=[...new Set([...STREET_TERRAIN.values()].flat())].filter(tile=>!before.has(tile));
  for(const model of fleet)for(const physical of [false,true])for(const [dx,dz] of CARDINAL)
   for(const turn of [-1,0,1])checkMovement(b,extensions,model,physical,dx,dz,turn);
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
 for(const reverseOrder of [true,false]){
  reset();time=3;
  const west=carOn([0,8],[1,8],[2,8]),north=carOn([1,7],[1,8],[1,9]);
  if(reverseOrder)cars.reverse();
  for(const c of cars){c.speed=0;c.ai.movement.arrived=2;c.ai.movement.dwell=1;}
  assert(!canEnter(north,north.ai.movement,.4,.02),'simultaneous arrival yields to driver on right');
  assert(canEnter(west,west.ai.movement,.4,.02),'driver on right proceeds independently of spawning order');
 }
 reset();
 for(const [dx,dz] of CARDINAL){
  const c=carOn([1-dx,8-dz],[1,8],[1+dx,8+dz]);c.speed=0;
  c.ai.movement.arrived=2;c.ai.movement.dwell=1;
 }
 while(cars.length){
  const wave=cars.filter(c=>canEnter(c,c.ai.movement,.4,.05));
  assert(wave.length,'four simultaneous arrivals must resolve');
  for(const a of wave)for(const b of wave)if(a!==b)assert(!conflictingPaths(a.ai.movement,b.ai.movement));
  for(const c of wave)cars.splice(cars.indexOf(c),1);
 }
 reset();
 const rolling=carOn([1,7],[1,8],[1,9]);rolling.speed=0;
 assert(!canEnter(rolling,rolling.ai.movement,.4,.5));rolling.speed=.7;
 assert(!canEnter(rolling,rolling.ai.movement,.35,.1));rolling.speed=0;
 assert(!canEnter(rolling,rolling.ai.movement,.30,.5),'partial stops cannot be added together');
 reset();time=signalGroup(4,5)*6+10;
 const north=carOn([4,4],[4,5],[5,5]),south=carOn([4,6],[4,5],[4,4]);
 assert(!canEnter(north,north.ai.movement,.35,.04),'permissive left yields to oncoming traffic');
 const bar=stopLine('signal').outer+CARSPEC.civic.L/2+.57;
 south.pos.z=5*CELL+bar;south.speed=0;north.speed=0;
 assert(!canEnter(north,north.ai.movement,.35,.04),'permissive left yields as oncoming straight traffic starts from rest');
 south.driver='player';south.pos.z+=10;south.speed=10;
 assert(!canEnter(north,north.ai.movement,.35,.04),'oncoming player is visible before reaching the box');
 south.h=0;
 assert(canEnter(north,north.ai.movement,.6,.04),'departing player does not hold an oncoming lane');
 cars.pop();
 const end=north.ai.movement.points.at(-1);
 const truck=carOn([3,5],[4,5],[5,5],0,33,false,'f150');
 truck.driver=null;truck.speed=0;truck.pos.set(end.x+5,0,end.z);
 assert(!canEnter(north,north.ai.movement,.35,.04),'leave room for the entire vehicle beyond the crosswalk');
 truck.pos.z+=3.57;
 assert(canEnter(north,north.ai.movement,.6,.04),'stopped truck in a different lane leaves the exit clear');
 cars.pop();
 const crossing={i:4,j:5,axis:'ns',legX:1,legZ:0,waiting:false};
 peds.push({pos:new V3(269,0,322),cross:crossing,mode:'walk'});
 assert(!canEnter(north,north.ai.movement,.35,.04),'turn yields to walking pedestrian');
 cars.length=0;time=signalGroup(4,5)*6+1;
 assert(pedestrianCanStart(peds[0],crossing));time+=9;assert(!pedestrianCanStart(peds[0],crossing),'clearance prevents starting a crossing');
 reset();
 const sideStreet=carOn([2,6],[2,7],[2,8]);sideStreet.speed=0;sideStreet.ai.movement.dwell=1;
 const playerCar=carOn([1,7],[2,7],[3,7],0,22);playerCar.driver='player';playerCar.speed=11;
 assert(!canEnter(sideStreet,sideStreet.ai.movement,.4,.04),'side street yields to a player approaching on Bay Avenue');
 playerCar.pos.y+=5;
 assert(canEnter(sideStreet,sideStreet.ai.movement,.4,.04),'a vehicle on a different deck does not claim the junction');

 function walker(i,j,legX,legZ,dx,dz,back=0){
  const far=perim(blocks[(i-(dx<0 || legX<0?1:0))*N+j-(dz<0 || legZ<0?1:0)]);
  const route=crossingRoute(i,j,legX,legZ,dx,dz,far);
  const p={pos:new V3(route.waitX-dx*back,0,route.waitZ-dz*back),mode:'walk',spd:1.15,cross:route};
  peds.push(p);return p;
 }
 for(const i of [4,8]){
  reset();const j=5,start=signalGroup(i,j)*6,dt=1/30;
  const east=walker(i,j,0,1,1,0),west=walker(i,j,0,1,-1,0),rear=walker(i,j,0,1,1,0,.85);
  const edge=crossingEdge(east.cross),span=west.pos.x-east.pos.x;
  approx(span,2*(edge+.47),.001,'pedestrians wait behind the actual curb');
  approx(east.pos.z-west.pos.z,.94,.001,'opposite corridors fit the ramp');
  let minGap=Infinity,crossed=false;
  for(let n=0;n<22/dt;n++){
   time=start+27+n*dt;
   for(const p of peds)if(p.cross){
    const old=p.pos.clone();advanceCrossing(p,dt);
    assert(old.distanceTo(p.pos)<=p.spd*dt+.00001,'pedestrian speed is continuous on the crossing');
   }
   if(time<start+30)assert(east.cross.waiting && west.cross.waiting,'wait for WALK');
   if(east.cross && rear.cross)minGap=Math.min(minGap,east.pos.x-rear.pos.x);
   if(east.pos.x>west.pos.x)crossed=true;
  }
  assert(crossed && peds.every(p=>p.cross===null),'all three reach the opposite sidewalk');
  assert(minGap>=.749 && east.pos.x>i*CELL+edge && west.pos.x<i*CELL-edge,'maintain following room from curb to curb');
 }
 const indicators={driver:'player',h:2.96,steerA:0,turnLamps:{left:{},right:{}}};
 togglePlayerSignal(indicators,-1);updateTurnLamps(indicators,10);
 assert(indicators.turnLamps.left.visible && !indicators.turnLamps.right.visible);
 updateTurnLamps(indicators,10.45);assert(!indicators.turnLamps.left.visible,'indicator has an off interval');
 indicators.h=-2.50;indicators.steerA=.2;updateTurnLamps(indicators,10.76);
 assert(indicators.playerSignal.turned && indicators.turnLamps.left.visible,'turn detection crosses the heading wrap');
 indicators.steerA=0;updateTurnLamps(indicators,11);assert(!indicators.playerSignal);
 togglePlayerSignal(indicators,1);updateTurnLamps(indicators,20.47);
 assert(indicators.turnLamps.right.visible,'a new indication starts lit');
 togglePlayerSignal(indicators,1);updateTurnLamps(indicators,20.49);assert(!indicators.turnLamps.right.visible);
 indicators.driver='ai';indicators.indicating=1;updateTurnLamps(indicators,50.5);
 assert(indicators.turnLamps.right.visible);indicators.driver=null;updateTurnLamps(indicators,50.51);
 assert(!indicators.turnLamps.right.visible && !indicators.turnLamps.left.visible);

 // Exercise two complete light cycles with left-turn, opposing and walking traffic in the same junction.
 const cycleRuns=[];
 for(const physical of [false,true])for(const hz of [30,60,120]){
  reset();const base=signalGroup(4,5)*6,dt=1/hz;
  const left=carOn([4,4],[4,5],[5,5],0,bar),through=carOn([4,6],[4,5],[4,4],0,bar);
  const approach=new Map(cars.map(c=>[c,c.ai.movement])),committed=new Map();
  for(const c of cars){c.speed=0;if(physical)physCarOn(c);}
  const walkers=[walker(4,5,1,0,0,1),walker(4,5,1,0,0,-1)];
  for(let n=0;n<120*hz;n++){
   time=base+28+n*dt;
   for(const p of walkers)if(p.cross)advanceCrossing(p,dt);
   for(const c of cars)aiTraffic(c,dt);
   if(physical){physStep(dt);for(const c of cars)physCarRead(c);}
   for(const c of [...cars]){
    const m=approach.get(c);
    if(m.committed && !committed.has(c)){
     committed.set(c,time);
     assert.equal(phaseForGroup(signalGroup(4,5),time).ns.vehicle,'G','entry from rest requires green');
     assert(!crossingOccupied(m),'wait for people to reach the far curb');
    }
    for(const p of walkers)assert(!bodyInsideCar(c,p.pos,.29),'pedestrian stays clear of both vehicles');
    if((c.pos.x-m.x)*m.ex+(c.pos.z-m.z)*m.ez>STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+c.spec.L*.5+1){
     if(c.phys)physCarOff(c);cars.splice(cars.indexOf(c),1);
    }
   }
  }
  assert(!cars.length && walkers.every(p=>p.cross===null),'all traffic discharged from the junction');
  assert(committed.get(through)<committed.get(left),'through traffic precedes the permissive turn');
  cycleRuns.push(hz);
 }
 console.log('Street regressions passed.',controls,{speedHumps:humps,fleet:fleet.length,movements,stopBarGaps:gaps,cycleRuns});
`);
