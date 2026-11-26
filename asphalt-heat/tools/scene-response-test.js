// Street response through dispatch, visible arrivals, handover and the return to the vehicle pool.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const source=name=>fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8');
function runWatch(noParking,interruptRide=false){
 const ctx=vm.createContext({assert,THREE,window:{},noParking,interruptRide});
 const run=s=>vm.runInContext(s,ctx);
 run(source('department'));
 run(`const V3=THREE.Vector3,unitBox=new THREE.BoxGeometry(),CELL=64,N=16,HALF=8;
 const player={pos:new V3(137,0,162)},streetIncidents={current:null},cars=[];
 const groundY=()=>0,clamp=(v,l,h)=>Math.max(l,Math.min(v,h));
 const nearDriveway=()=>noParking,rayWorld=()=>1,collideWorld=()=>null,caseViewNear=()=>false;
 const sp=(p)=>[Math.round(p.x/CELL),Math.round(p.z/CELL)],nearestNode=sp;
 const dist2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),lerpA=(a,b,t)=>a+(b-a)*t,wrapA=a=>a;
 const makeChar=()=>({root:new THREE.Group(),bones:{},yaw:0}),officerModel=()=>'',fitIssuedEquipment=()=>{},personalizeOfficer=()=>{};
 const removeChar=()=>{},updChar=()=>{},blockedAhead=()=>false,setCarLights=()=>{};
 const spawnCar=(type,x,z,h,driver)=>{const car={type,pos:new V3(x,0,z),h,speed:0,driver};cars.push(car);return car;};
 const removeCar=c=>{PoliceDepartment.release(c.officer);cars.splice(cars.indexOf(c),1);};
 const drive=(c,throttle,steer,brake,dt)=>{c.speed=Math.max(0,c.speed+throttle*7*dt);c.pos.x+=Math.sin(c.h)*c.speed*dt;c.pos.z+=Math.cos(c.h)*c.speed*dt;};`);
 run(source('police-world'));
 run('equipOfficer=()=>{}');
 return run(`(()=>{
  const pd=PoliceDepartment,unavailable=pd.staff[7];pd.withdraw(unavailable);
  const motor=pd.claim('Patrol','Motor patrol');
  const file=pd.file({kind:'Homicide',origin:'street',at:player.pos,victim:'resident-12'});
  const arrivals=new Map(),dt=1/30;let largestCrew=0,simultaneousCars=0,retained=false,stolen=null;
  for(let i=0;i<2400;i++){
   pd.clock+=dt;
   if(i%30===0)pd.process();
   if(interruptRide&&!stolen&&cars.some(c=>c.driver==='scene')){
    stolen=cars.find(c=>c.driver==='scene');stolen.driver='player';
   }
   for(const car of cars){
    if(car.driver==='scene')driveSceneCar(car,dt);
    else if(car.driver==='scene return'){car.pos.x+=Math.sin(car.h)*5*dt;car.pos.z+=Math.cos(car.h)*5*dt;}
   }
   updateFieldDetectives(dt);
   const units=departmentPeople.filter(u=>u.file===file);
   for(const u of units){
    if(!arrivals.has(u.personId))arrivals.set(u.personId,pd.clock);
    assert.notEqual(u.personId,unavailable.personId);assert.notEqual(u.personId,motor.personId);
   }
   assert.equal(new Set(units.map(u=>u.personId)).size,units.length);
   largestCrew=Math.max(largestCrew,units.length);
   simultaneousCars=Math.max(simultaneousCars,cars.filter(c=>c.sceneFileId===file.id).length);
   if(file.stage==='Lab review'&&units.some(u=>u.personId===file.detective)&&units.some(u=>u.personId===file.patrol))retained=true;
  }
  assert.equal(file.stage,'Open leads');
  assert.equal(file.response.length,5);
  assert.equal(largestCrew,6);assert(retained);
  assert(new Set(arrivals.values()).size>=4);
  assert(file.response.every(record=>Number.isFinite(record.onSceneAt)));
  assert.equal(fieldInvestigators.size,0);assert.equal(streetTeams.size,0);assert.equal(departmentPeople.length,0);
  assert.equal(returningSceneCars.size,0);assert.equal(cars.length,interruptRide?1:0);
  if(stolen){assert.equal(stolen.driver,'player');assert.equal(stolen.sceneFileId,undefined);}
  assert.equal(pd.bindings.size,1);assert.equal(pd.bindings.get(motor.personId),'Motor patrol');
  return simultaneousCars;
 })()`);
}
assert.equal(runWatch(false),2);
assert.equal(runWatch(true),0);
assert.equal(runWatch(false,true),1);
console.log('Five named patrol officers, staggered arrivals, two marked cars, detective handover, on-foot fallback and vehicle release passed.');
