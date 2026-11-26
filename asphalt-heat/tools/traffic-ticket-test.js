// Drive the shipped enforcement rules through moving frames, physical contacts and department storage.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict'),THREE=require('../lib/three.min.js');
const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const context=vm.createContext({assert,console,THREE,storage,window:{sessionStorage:storage},$:()=>({style:{},classList:{add(){}}})});
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const run=s=>vm.runInContext(s,context);
run(read('lib/cannon.js'));
run(read('js/weather.js'));run(read('js/weather-cover.js'));run('const weather=new CoastalWeather(70,10),weatherCover=new WeatherCoverMap();');
run(`const V3=THREE.Vector3,CANNON=window.CANNON,CELL=64,N=16,HALF=8,W=N*CELL;
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),lerp=(a,b,f)=>a+(b-a)*f;
 const base={bld:[],residual:[],x0:1e6,x1:1e6,z0:1e6,z1:1e6};
 const blocks=Array.from({length:N*N},()=>({...base,bld:[],residual:[]}));
 const MAT={},STREET={steps:[]},departmentPeople=[],districtOf=()=>'suburb',worksFloorAt=(x,z,ref,y)=>y;`);
for(const file of ['phys','cargen','fleet','vehicle-components','access','building-construction','suite-interiors','roads','street-plan','street-surface','city-traffic','lighthouse','garden-cottages','civic-fittings','game','department','dispatch','traffic-police'])run(read('js/'+file+'.js'));
run(`
 state='play';
 const car={type:'miata',spec:CARSPEC.miata,pos:new V3(),vel:new V3(),plate:'AH TEST',driver:'player',speed:0,h:0};
 player={personId:'ah-player',car,pos:car.pos,cash:250,yaw:0};
 const officer={team:'law',dead:false,officer:PoliceDepartment.staff[0],pos:new V3(),c:{yaw:0}};
 departmentPeople.push(officer);
 const tickets=PoliceDepartment.tickets,count=code=>tickets.filter(t=>t.code===code).length;
 function start(x,z,h,t){
  time=t;car.pos.set(x,0,z);car.h=h;car.speed=0;car.vel.set(0,0,0);TRAFFIC_PATROL.drive=null;
  officer.pos.set(x+Math.cos(h)-3*Math.sin(h),0,z-Math.sin(h)-3*Math.cos(h));
  officer.c.yaw=h;player.car=car;
 }
 function frames(n,speed,hz=30){
  const dt=1/hz;car.speed=speed;car.vel.set(Math.sin(car.h)*speed,0,Math.cos(car.h)*speed);
  for(let k=0;k<n;k++){time+=dt;PoliceDepartment.clock+=dt;car.pos.addScaledVector(car.vel,dt);updateTrafficPatrol(dt);}
 }
 // Approach the signals from all four directions at Verve / Studio and the Palm Street diner.
 for(const [i,j] of [[4,5],[10,10]])for(const [dx,dz] of CARDINAL){
  const section=segmentSection([i-dx,j-dz],[i,j]),lane=laneCenter(section,dx,dz);
  const x=i*CELL-24*dx-dz*lane,z=j*CELL-24*dz+dx*lane,h=Math.atan2(dx,dz);
  const phase=signalGroup(i,j)*6+(dx?30:0);
  for(const hz of [30,60,120]){
   const red=count('red');
   start(x,z,h,phase+32);frames(hz*2,6,hz);assert.equal(count('red'),red+1,'witnessed red entry');
   assert.equal(tickets.at(-1).street,STREET_NAMES.ns[i]+' / '+STREET_NAMES.ew[j]);
   start(x,z,h,phase+7);frames(hz*2,6,hz);assert.equal(count('red'),red+1,'green entry');
   start(x,z,h,phase+32);frames(hz,0,hz);
   car.pos.x+=13*dx;car.pos.z+=13*dz;frames(1,0,hz);
   assert.equal(count('red'),red+1,'teleporting across the bar');
  }
 }
 const x=4*CELL-2.5,z=5*CELL,offset=signalGroup(4,5)*6;
 // A queued driver stops with the front bumper just short of Juniper's stop bar.
 const jx=2*CELL-2.65,jz=4*CELL,bar=stopLine(junctionControl(2,4)).outer+car.spec.L/2;
 start(jx,jz-bar-2,0,80);frames(10,5);frames(30,0);frames(60,5);
 assert.equal(count('stop'),0,'full stop releases the driver');
 start(jx,jz-bar-2,0,85);frames(30,5);assert.equal(count('stop'),1,'rolling stop');
 // The same car waits on red, drives through green, and traverses the Juniper hump below its limit.
 let lawful=tickets.length;start(x,z-20,0,offset+32);frames(22,2);frames(30*33,0);frames(105,6);
 start(jx,4*CELL+20,0,150);frames(110,6);assert.equal(tickets.length,lawful,'lawful signal and hump drive');
 const pedestrian={personId:'walk-1',pos:new V3(256,0,z-STREET_DESIGN.crossing),mode:'walk',cross:{i:4,j:5,legX:0,legZ:-1}};
 peds.push(pedestrian);start(x,z-20,0,offset+8);frames(40,5);assert.equal(count('yield'),1);
 pedestrian.cross.legZ=1;pedestrian.pos.z=z+STREET_DESIGN.crossing;
 start(x,z+5,0,offset+8);frames(50,5);assert.equal(count('yield'),2,'receiving crosswalk');
 peds.length=0;
 start(jx,4*CELL+19,0,200);frames(43,12);assert.equal(count('speeding'),1);
 frames(3,9);frames(40,12);assert.equal(count('speeding'),1,'one speeding episode across a brief speed fluctuation');
 start(jx,4*CELL+19,0,205);departmentPeople.length=0;frames(50,12);assert.equal(count('speeding'),1,'unobserved drive');
 departmentPeople.push(officer);
 start(2*CELL+2.65,4*CELL+19,0,210);frames(43,4);assert.equal(count('wrongWay'),1);
 start(15*CELL+6.25,5*CELL+19,0,216);frames(43,4);assert.equal(count('restricted'),1,'protected cycle track');
 start(2*CELL-HALF-1,4*CELL+19,0,220);frames(43,4);assert.equal(count('restricted'),2,'sidewalk');
 const post={},impactAt=car.pos.clone();reportTrafficDamage('property',post,impactAt,'Struck a street lamp.');
 reportTrafficDamage('property',post,impactAt,'Repeated contact');reportTrafficDamage('property',{},impactAt,'Adjacent collider');
 assert.equal(count('property'),1);
 departmentPeople.length=0;time+=10;
 const witness={personId:'resident-1',pos:car.pos.clone(),c:{root:{visible:true}}};peds.push(witness);
 reportTrafficDamage('property',{},impactAt,'Struck a bin.');assert.equal(count('property'),1);
 time+=3.2;updateTrafficPatrol(1/30);assert.equal(count('property'),2);assert.match(tickets.at(-1).witness,/911/);
 time+=8;reportTrafficDamage('destruction',{},impactAt,'Destroyed a parked van.');witness.personId='someone-else';
 time+=3.2;updateTrafficPatrol(1/30);assert.equal(count('destruction'),0,'recycled caller cannot complete a report');
 const ticket=tickets.find(t=>t.code==='property');assert(PoliceDepartment.payTicket(ticket.id,player));
 assert.equal(player.cash,50);assert(!PoliceDepartment.payTicket(ticket.id,player));
 assert(!PoliceDepartment.payTicket(tickets[0].id,player));assert.equal(player.cash,50);
 const reload=new CityPoliceDepartment(storage);assert.equal(reload.tickets.length,tickets.length);
 assert.equal(reload.tickets.find(t=>t.id===ticket.id).paid,ticket.paid);
 assert.equal(reload.tickets[0].paid,null);assert.equal(PoliceDepartment.cases.length,0);
 console.log('Traffic tickets passed. Signal phases, stop and crossing rules, lane use, witnesses, duplicate contacts, payment and reload.');
`);
run(`
 peds.length=0;departmentPeople.length=0;departmentPeople.push(officer);
 function testCrash(playerAtFault){
  time+=10;PH.cars.length=0;PH.hits.length=0;PH.accumulator=0;cars.length=0;physInit();
  const x=890.58,z=790;
  function addCar(id,at,speed,isPlayer){
   const spec=CARSPEC[id],c={type:id,spec,pos:new V3(x,0,at),vel:new V3(0,0,speed),speed,h:0,driver:isPlayer?'player':'ai',
    plate:'TEST '+id,mesh:{visible:false},hp:spec.hp,max:spec.hp,upY:1};
   cars.push(c);if(isPlayer){player.car=c;player.pos=c.pos;}physCarOn(c);return c;
  }
  officer.pos.set(x+2,0,z-1);officer.c.yaw=0;
  const pickup=addCar('f150',z,10,playerAtFault),van=addCar('van',z+8,0,!playerAtFault),before=count('collision');
  for(let n=0;n<130;n++){
   time+=1/90;physCarControl(pickup,.4,0,false);physCarControl(van,0,0,true);
   physStep(1/90);physCarRead(pickup);physCarRead(van);applyCarHits();
  }
  assert(van.hp<van.max,'contact must damage the leading vehicle');
  assert.equal(count('collision')-before,Number(playerAtFault),'only the driver who drove into the other vehicle gets cited');
 }
 testCrash(true);testCrash(false);
 console.log('Truck impact attribution passed in both driver positions.');
`);
