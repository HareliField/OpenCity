// Contract checks for the controller with an instrumented simulation tick.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../js/agent-controller.js'),'utf8');
const element = {append(){},addEventListener(){},querySelector(){return element;},
 classList:{contains(){return false;}},textContent:'Sound off'};
const calls=[];
const context=vm.createContext({
 qp:new URLSearchParams('agent=1'),time:0,state:'play',structuredClone,
 window:{addEventListener(){}},document:{body:element,head:element,createElement(){return element;}},
 MutationObserver:class {observe(){}},navigator:{},$:()=>element,policeDesk:{open:false},cityMap:{open:false},
 shopOpen:false,deskStation:null,player:{pos:{x:1,y:0,z:2},yaw:0,own:{},ammo:{},cash:0},
 wanted:0,heat:0,evadeT:0,LAW:{},TRAFFIC_PATROL:{limit:null,posts:[]},PoliceDepartment:{tickets:[]},cameraMode:0,camYaw:0,lookYaw:0,lookPitch:0,
 caseCamera:{enabled:false},canFollowStreetCase:()=>false,camera:{position:{x:0,y:2,z:0}},robbing:null,actionCtx:()=>null,
 step(dt,input){calls.push({...input});context.time+=dt;},drawMap(){},hud(){},renderFrame(){},clock:{getDelta(){}}
});
vm.runInNewContext(source,{qp:new URLSearchParams()}); // Human mode has no controller dependency.
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/weather.js'),'utf8'),context);
vm.runInContext('const weather=new CoastalWeather(30,10),weatherCover=null',context);
vm.runInContext(source,context);
const run=context.window.asphaltAgent.run;
assert.equal(run({op:'observe'}).paused,true);
assert.equal(run({op:'environment'}).clock,'10:00');
assert(run({op:'help'}).weatherTypes.includes('storm'));
assert.throws(()=>run({op:'step',forward:1,ticks:.5}));
assert.throws(()=>run({op:'step',forward:2}));
assert.equal(calls.length,0);
run({op:'step',ticks:3,forward:1,turn:-1,fire:true});
run({op:'step'});
assert.equal(calls.length,4);
assert.equal(calls[2].fire,true);
assert.equal(calls[3].fire,false);
assert.equal(calls[3].forward,0);
assert.throws(()=>run({op:'stats',cash:150,armor:-1}));
assert.equal(context.player.cash,0);
run({op:'clock',paused:false});
assert.throws(()=>run({op:'step'}));
const start=run({op:'observe'}).cursor;
for(let i=0;i<513;i++) context.asphaltAgentEvent('message',{text:'event '+i});
const journal=run({op:'events',after:start});
assert.equal(journal.missed,1);
assert.equal(journal.events.length,512);
journal.events[0].text='modified';
assert.equal(run({op:'events',after:start}).events[0].text,'event 1');
assert.equal(run({op:'events',after:journal.cursor}).events.length,0);
const followCase={op:'act',action:'followStreetCase'};
assert.throws(()=>run(followCase),/Action unavailable/);
context.canFollowStreetCase=()=>true;
context.toggleCaseCamera=()=>{context.caseCamera.enabled=!context.caseCamera.enabled;};
assert.equal(run(followCase).camera.mode,'case');
assert.equal(run(followCase).camera.mode,'follow');
console.log('Agent mode isolation, bounded input, stat validation, event cursors and case camera passed.');
