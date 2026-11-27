// Exercise the shipped Blender layout with the game's foot, camera and rigid-body queries.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('../lib/three.min.js'),read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const layout=JSON.parse(read('models/scenery/cove-layout.json'));
const cx=vm.createContext({window:{},THREE,layout,assert,console});
const run=src=>vm.runInContext(src,cx);
run(read('lib/cannon.js'));
run(read('js/weather.js'));run(read('js/weather-cover.js'));
run(`const CANNON=window.CANNON,CV=CANNON.Vec3,V3=THREE.Vector3,W=1024,HALF=8,CELL=64,N=16,PHYS_GROUP={world:1};
 const weather=new CoastalWeather(172,12,'clear');
 const PH={mat:{concrete:new CANNON.Material()},w:new CANNON.World({gravity:new CV(0,-9.81,0)})};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t;
 const supply={power:true},cityPowerAt=()=>supply.power;`);
run(read('js/lighthouse.js'));
run(read('js/garden-cottages.js'));
const game=read('js/game.js');
run(game.slice(game.indexOf('function traceBox('),game.indexOf('function rayWorld(')));
run(`prepareCove(layout);
 const {x,z}=COVE,tread=(layout.gallery-layout.door.floor)/layout.steps;
 const stairPoint=i=>{const a=Math.PI+2*Math.PI*i/layout.stepsPerTurn;return new V3(x+1.08*Math.cos(a),0,z-1.08*Math.sin(a));};
 for(const backwards of [false,true]){
  let y=backwards?layout.gallery:layout.door.floor;
  for(let j=0;j<layout.steps*6;j++){
   const i=(backwards?layout.steps*6-1-j:j)/6+.04/6,p=stairPoint(i);
   const h=coveFloorAt(p.x,p.z,y,.02);
   assert(Math.abs(h-y)<=tread+.00003,'Each ascending and descending footfall has a reachable surface at '+i+' / '+y+' → '+h);
   assert.equal(collideCove(p,.36,h),null,'Body clears the stair, bottom and roof at '+i);
   y=h;
  }
  assert(Math.abs(y-(backwards?layout.door.floor+tread:layout.gallery))<.001);
 }
 // Starting on sand, pass the foyer head and finish on the external gallery through the glazed cage's opening.
 let y=.02;
 for(let u=-5.17;u<=-1.02;u+=.07){
  const p=new V3(x+u,y,z-.025);
  y=coveFloorAt(p.x,p.z,y,.02);assert.equal(collideCove(p,.36,y),null,'Free approach through keeper door');
 }
 for(let r=1.02;r<2.13;r+=.035){
  const p=new V3(x-r,layout.gallery,z+.04);
  assert.equal(coveFloorAt(p.x,p.z,p.y,.02),layout.gallery);
  assert.equal(collideCove(p,.36,p.y),null,'An adult fits through the lantern cage doorway');
 }
 for(let i=0;i<120;i++){
  const th=i*2*Math.PI/120,p=new V3(x+2.03*Math.cos(th),layout.gallery,z+2.03*Math.sin(th));
  assert.equal(coveFloorAt(p.x,p.z,p.y,.02),layout.gallery);
  assert.equal(collideCove(p,.36,p.y),null,'Visitor fits around external gallery');
 }
 assert(traceCove(new V3(x-2,7,z),new V3(-2,0,0),0,true)<1,'The ashlar shell blocks the camera');
 assert.equal(traceCove(new V3(x-5,1.55,z),new V3(3.8,0,0),0,true),1,'The open west doorway admits a view');
 const body=coveBody();assert.equal(body.shapes.length,layout.solids.length);
 // Drop a small parcel into the middle of the 49th tread. No neighbouring support is vertically reachable.
 const at=stairPoint(48.51),height=layout.door.floor+tread*49;
 const ball=new CANNON.Body({mass:1,shape:new CANNON.Box(new CV(.038,.049,.042)),position:new CV(at.x,height+.48,at.z)});
 PH.w.addBody(ball);
 for(let tick=0;tick<230;tick++)PH.w.step(1/90);
 assert(Math.abs(ball.position.y-height-.049)<.008,'Parcel rests on the visible tread height');
 COVE.optic=new THREE.Group();COVE.lit=[new THREE.MeshStandardMaterial()];COVE.lit[0].name='Beacon filament';
 updateCoveBeacon(1);assert(COVE.phase>0&&COVE.lit[0].emissiveIntensity>0);
 const noonGlow=COVE.lit[0].emissiveIntensity;
 weather.hour=23;weather.updateLight();updateCoveBeacon(0);
 assert(COVE.lit[0].emissiveIntensity>noonGlow*4,'The optic brightens as night falls');
 const cover=new WeatherCoverMap();stampCoveRoof(cover);
 assert(cover.heightAt(x,z)>layout.gallery && cover.heightAt(x+5,z)===0,'The lantern room is sheltered and the adjacent sand is exposed');
 const angle=COVE.optic.rotation.y;supply.power=false;updateCoveBeacon(1);
 assert.equal(COVE.optic.rotation.y,angle);assert.equal(COVE.lit[0].emissiveIntensity,0);
 console.log('Climbed and descended',layout.steps,'treads, cleared the complete gallery, landed a parcel at',height.toFixed(3),'m and isolated the beacon circuit.');
`);
