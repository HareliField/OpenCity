// Exercise the normal fleet builders and the same hinge, glazing and cargo rules used in play.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('../lib/three.min.js'),game=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(game,name),'utf8');
const context=vm.createContext({THREE,assert,console,window:{}});
const run=source=>vm.runInContext(source,context);
run(read('lib/cannon.js'));
run(`const CANNON=window.CANNON,CV=CANNON.Vec3,V3=THREE.Vector3,QUALITY={level:2};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));const MAT={metal:new THREE.MeshStandardMaterial(),darkMetal:new THREE.MeshStandardMaterial()};
 const unitBox=new THREE.BoxGeometry(1,1,1),player={car:null,pos:new V3(55,0,55)},PH={w:new CANNON.World()};
 const emit=()=>{},toast=()=>{},requestScenery=()=>null;`);
for(const name of ['cargen','fleet','harbor-supply','vehicle-components'])run(read('js/'+name+'.js'));
run(`
 function vehicle(type){
  const base=carGeo(type),mats=Array.from({length:6},()=>new THREE.MeshStandardMaterial());
  const mesh=new THREE.Group(),body3=new THREE.Mesh(base.geo,mats);
  mesh.add(body3);mesh.userData.vehicleCoordinates=true;
  return {type,spec:CARSPEC[type],speed:0,mesh,body3,mats,pos:new V3(),vel:new V3(),h:0,
   body:new CANNON.Body({mass:1450}),plate:type};
 }
 for(const type of Object.keys(CARSPEC)){
  const c=vehicle(type),sections=splitFleetGeometry(type),sum=[...sections.values()].reduce((count,g)=>count+g.index.count,0);
  assert.equal(sum,carGeo(type).geo.index.count,'every original face has exactly one owner on '+type);
  const v=createVehicleAssembly(c);
  assert(v.joints.has('Bonnet'),type+' has a service lid');
  assert(v.panes.has('Windshield'),type+' has a separate windscreen');
  const j=v.joints.get('Bonnet');
  const nose=new V3(0,0,type==='nineeleven'?-c.spec.L/2:c.spec.L/2);
  const op=vehicleServiceAction(c,nose);assert(op,type+' service action');
  op.fn();for(let k=0;k<40;k++)updateVehicleAssembly(c,1/60);
  assert.equal(j.state.phase,1);assert(j.collision&&c.body.shapes.includes(j.collision));
  assert(Math.abs(j.joint.rotation.x)>1 && (type==='nineeleven')===(j.joint.rotation.x>0));
  op.fn();for(let k=0;k<40;k++)updateVehicleAssembly(c,1/60);
  assert.equal(j.state.phase,0);assert.equal(j.collision,null);
  const p=v.panes.get('GlassFrontL');
  if(p&&type!=='miata'){
   assert(impactVehicleGlass(c,p.centre,10));assert.equal(p.node.visible,false);
   streamVehicleComponents(c,false);assert.equal(v.section.visible,true,'broken pane survives streaming');
   repairVehicleComponents(c);assert.equal(p.node.visible,true);
  }
  const screen=v.panes.get('Windshield');
  assert(impactVehicleGlass(c,screen.centre,10));assert.equal(screen.state.damage,1);assert(screen.node.visible);
  assert(!impactVehicleGlass(c,screen.centre,10));repairVehicleComponents(c);
  releaseVehicleComponents(c);assert.equal(c.components,null);
 }
 const truck=vehicle('harborbox'),root=new THREE.Group();truck.mesh.add(root);
 for(let i=0;i<11;i++){
  const n=new THREE.Mesh(unitBox,MAT.metal);n.name='CargoSlat'+String(i).padStart(2,'0');n.position.set(0,1.155+i*.172,-3.239);root.add(n);
 }
 const freight=createVehicleAssembly(truck,root),gate=truck.cargoGate;
 assert(gate&&Math.abs(gate.halfExtents.y-.955)<.001);
 freight.shutter.target=1;for(let i=0;i<70;i++)updateVehicleAssembly(truck,1/30);
 assert.equal(freight.shutter.phase,1);assert(OPEN_FREIGHT_BEDS.has(truck));assert(gate.halfExtents.y<.012);assert.equal(truck.freightSteps.length,5);
 assert(freight.boards.every(b=>b.node.position.y>2.94&&b.node.position.y<3.10),'slats stow under cargo ceiling');
 let y=0;
 for(let z=-4.65;z< -2.6;z+=.026){const next=truckFloorAt(0,z,y,0);assert(Math.abs(y-next)<.221);y=next;}
 assert.equal(y,1.061);assert.equal(truckFloorAt(1.3,-4.3,.25,0),0);
 freight.shutter.target=0;for(let i=0;i<70;i++)updateVehicleAssembly(truck,1/30);
 assert.equal(freight.shutter.phase,0);assert(Math.abs(gate.halfExtents.y-.955)<.001);
 releaseVehicleComponents(truck);assert(!OPEN_FREIGHT_BEDS.has(truck));
`);
for(const name of ['maroon-saloon','silver-city-sedan','graphite-city-saloon','brick-red-crossover','coupe-driveable']){
 const glb=fs.readFileSync(path.join(game,'models','scenery',name+'.glb')),doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
 for(const required of ['WheelPrototype','DoorFrontL','DoorFrontR','Bonnet','Windshield','RearGlass','GlassFrontL','GlassFrontR','GlassRearL','GlassRearR']){
  const n=doc.nodes.find(node=>node.name===required);assert(n&&doc.meshes[n.mesh],name+' / '+required);
  for(const prim of doc.meshes[n.mesh].primitives){
   assert(doc.accessors[prim.indices].count>=3);
   if(/Glass|Windshield/.test(required))assert.equal(doc.materials[prim.material].alphaMode,'BLEND');
  }
 }
}
console.log('All fleet service lids, opening colliders, window fracture and repair, six reference bodies and the cargo shutter passed.');
