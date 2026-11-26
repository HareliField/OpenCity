/* Run with node tools/ptest.js. Uses the exact physics library shipped to the browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(read('lib/cannon.js') + '\nconst CANNON=window.CANNON;', context);
vm.runInContext(read('js/weather.js')+'\n'+read('js/weather-cover.js'),context);
vm.runInContext('const weather=new CoastalWeather(70,10),weatherCover=new WeatherCoverMap();',context);
vm.runInContext(read('js/phys.js'), context);
vm.runInContext(read('js/cargen.js').split('const CARGEO=')[0], context);

function vector(x=0,y=0,z=0){
 return {x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}};
}

const simulate = vm.runInContext(`(dt,vector)=>{
 PH.cars.length=0;
 PH.hits.length=0;
 PH.accumulator=0;
 physInit();
 const spec=CARSPEC.sport;
 const c={spec,pos:vector(),vel:vector(),h:0,speed:0,hp:spec.hp,max:spec.hp,driver:'player'};
 physCarOn(c);

 function drive(seconds,throttle,steer=0,handbrake=false){
  for(let t=0;t<seconds-1e-8;t+=dt){
   physCarControl(c,throttle,steer,handbrake);
   physStep(dt);
   physCarRead(c);
  }
 }
 drive(.6,0);
 const grounded=c.veh.numWheelsOnGround;
 let acceleration=0;
 while(c.speed<27.78&&acceleration<12){drive(dt,1);acceleration+=dt;}
 physCarSet(c,0,100,0,27.78);
 c.controls.drivePedal=1;
 const brakingStart=c.pos.z;
 let braking=0;
 while(c.speed>.4&&braking<8){drive(dt,-1);braking+=dt;}
 const brakingDistance=c.pos.z-brakingStart;
 drive(.8,-1);
 const held=c.speed;
 drive(.25,0);
 drive(1.4,-1);
 const reversed=c.speed;

 physCarSet(c,0,0,0,13);
 drive(1.5,.36,1);
 const turn=c.h,inside=c.veh.wheelInfos[0].steering,outside=c.veh.wheelInfos[1].steering;
 const wheelSpin=c.veh.wheelInfos[0].rotation;

 physCarSet(c,10,10,0,20);
 const wall=physBox(7,13,0,4,29,31);
 PH.hits.length=0;
 drive(1.45,0);
 const impact=PH.hits.filter(h=>h.other===wall).reduce((m,h)=>Math.max(m,h.iv),0);
 const beyondWall=c.pos.z>=29-spec.L/2;

 physBox(20,25,0,.15,20,55,PH.mat.concrete);
 physCarSet(c,22,10,0,12);
 drive(1.6,.2);
 const curb={position:c.pos.z,height:c.body.position.y,upright:c.upY,wheels:c.veh.numWheelsOnGround};

 physCarSet(c,0,0,0,0);
 drive(3.2,1);
 const roadSpeed=c.speed;
 physBox(48,52,0,.02,-10,80,PH.mat.sand);
 physCarSet(c,50,0,0,0);
 drive(3.2,1);
 const sandSpeed=c.speed;

 const bin=physDyn(new CANNON.Cylinder(.28,.28,.95,10),20,32,0,0,new CV(0,.475,0));
 const center=bin.position.y;
 bin.applyImpulse(new CV(35,0,0),new CV(0,.37,0));
 drive(.3,0);
 const tipped=Math.hypot(bin.quaternion.x,bin.quaternion.z);

 return {grounded,acceleration,brakingDistance,held,reversed,turn,inside,outside,wheelSpin,
  impact,beyondWall,curb,roadSpeed,sandSpeed,center,tipped};
}`, context);

const regular = simulate(1 / 60, vector);
const mobile = simulate(1 / 30, vector);
vm.runInContext('weather.wetness=0;weather.snowCover=0',context);
const dry=simulate(1 / 60,vector);
vm.runInContext('weather.wetness=1;weather.snowCover=0',context);
const saturated=simulate(1 / 60,vector);
vm.runInContext('weather.wetness=.05;weather.snowCover=.88',context);
const snowy=simulate(1 / 60,vector);
assert(regular.brakingDistance>dry.brakingDistance+1);
assert(saturated.brakingDistance>regular.brakingDistance+1);
assert(snowy.brakingDistance>saturated.brakingDistance+8);
assert.equal(regular.grounded, 4);
assert(regular.acceleration > 5.1 && regular.acceleration < 7.3);
assert(regular.brakingDistance > 29 && regular.brakingDistance < 40);
assert(Math.abs(regular.held) < .25 && regular.reversed < -2);
assert(regular.turn > .65 && regular.inside > regular.outside && regular.wheelSpin > 0);
assert(regular.impact > 15 && !regular.beyondWall);
assert(regular.curb.position > 27 && regular.curb.upright > .95 && regular.curb.wheels === 4);
assert(regular.sandSpeed < regular.roadSpeed - 2);
assert.equal(regular.center, .475);
assert(regular.tipped > .1);
assert(Math.abs(regular.acceleration - mobile.acceleration) < .05);
assert(Math.abs(regular.brakingDistance - mobile.brakingDistance) < .25);

console.log({
 acceleration_0_to_100_seconds: regular.acceleration.toFixed(2),
 stop_from_100_metres: regular.brakingDistance.toFixed(1),
 stopping_metres_by_weather: {dry:dry.brakingDistance.toFixed(1),rain:saturated.brakingDistance.toFixed(1),snow:snowy.brakingDistance.toFixed(1)},
 wet_road_and_sand_kmh_at_3_2_seconds: [regular.roadSpeed, regular.sandSpeed].map(v=>(v*3.6).toFixed(1)),
 curb_wheels_in_contact: regular.curb.wheels,
 wall_impact_mps: regular.impact.toFixed(1),
 physics_tests: 'passed'
});
