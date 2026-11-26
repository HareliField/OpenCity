// Exercise the exported Ida rig with the GLTF loader, animation mixer and physics library shipped with the game.
// From asphalt-heat, run node tools/resident-test.js [path-to-candidate.glb].
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');

const game = path.join(__dirname, '..');
const text = file => fs.readFileSync(path.join(game, file), 'utf8');

function rigWithUntexturedMaterials() {
 const glb = fs.readFileSync(process.argv[2] || path.join(game, 'assets/residents/ida-mercer.glb'));
 const originalLength = glb.readUInt32LE(12);
 const source = JSON.parse(glb.subarray(20, 20 + originalLength));
 // Node has no browser image decoder. Keep the production vertices, joints, weights and animation buffers.
 for (const material of source.materials) {
  for (const properties of [material, material.pbrMetallicRoughness || {}]) {
   for (const key of Object.keys(properties)) if (key.endsWith('Texture')) delete properties[key];
  }
 }
 delete source.images;
 delete source.textures;
 const json = Buffer.from(JSON.stringify(source));
 const padding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
 const header = Buffer.from(glb.subarray(0, 20));
 header.writeUInt32LE(json.length + padding.length, 12);
 const binary = Buffer.concat([header, json, padding, glb.subarray(20 + originalLength)]);
 binary.writeUInt32LE(binary.length, 8);
 return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
}

async function exercise() {
 const canvasContext = {createRadialGradient(){ return {addColorStop(){}}; },fillRect(){}};
 const context = vm.createContext({
  THREE, TextDecoder, URL, Blob, console, assert, performance, window:{},
  navigator:{userAgent:'node'},document:{createElement(){ return {getContext(){ return canvasContext; }}; }},
  binary:rigWithUntexturedMaterials()
 });
 context.self = context;
 const run = code => vm.runInContext(code, context);
 run(text('lib/GLTFLoader.js'));
 run(text('lib/cannon.js'));
 const core = text('js/core.js');
 const merge = core.slice(core.indexOf('function mergeGeos('));
 run(merge.slice(0, merge.indexOf('\nfunction ', 20)));
 run(`
  const CANNON=window.CANNON,V3=THREE.Vector3,scene=new THREE.Scene();
  const PH={w:new CANNON.World(),mat:{prop:new CANNON.Material()}},PHYS_GROUP={prop:4,car:2,ragdoll:8};
  const lpt=(m,u,v)=>new V3(u,0,-v).applyMatrix4(m),lerpA=(a,b,t)=>a+(b-a)*t;
  const player={pos:new V3()},wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const cityPowerAt=()=>true,toast=()=>{},rayWorld=()=>1,crime=()=>{},registerIncident=()=>{};
 `);
 run(text('js/resident-secondary.js'));
 run(text('js/wash-house.js'));
 context.asset = await run("new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(binary,'',resolve,reject))");
 run(`
  THREE.GLTFLoader.prototype.load=(url,receive)=>receive(asset);
  WashHouse.register({block:{i:3,j:5},u0:-21.5,u1:-9.1,M:new THREE.Matrix4()});
  const dest=WashHouse.destination();player.pos.set(dest.x,dest.y,dest.z);player.yaw=dest.yaw;
  WashHouse.tick(1/30);
 `);
 await new Promise(resolve => setImmediate(resolve));
 run(`
  assert.equal(WashHouse.error,null);
  assert.equal(WashHouse.record()[0].personId,'AH-R0001');
  assert.equal(WashHouse.record()[0].colliders,43);
  assert.equal(WashHouse.interaction(player.pos).label,'TALK TO IDA');
  const root=scene.getObjectByName('Ida Mercer | Wash House'),basket=scene.getObjectByName('Ida Mercer | Laundry basket');
  const hasCarry=asset.animations.some(clip=>clip.name==='Carry');
  const shoe=root.getObjectByName('Cloth_shoes'),sample=new V3(),seen=new Set(),slip=[];
  const fingers=['l','r'].map(side=>root.getObjectByName('middle_02_'+side));
  const grips=['left','right'].map(side=>basket.getObjectByName('Ida basket '+side+' grip'));
  const handMesh=root.getObjectByName('Body'),handVertices=[[],[]];
  const indices=handMesh.geometry.attributes.skinIndex,weights=handMesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){
   const influences=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
   const joint=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)][influences.indexOf(Math.max(...influences))];
   const name=handMesh.skeleton.bones[joint].name;
   if(/^(thumb|index|middle|ring|pinky|hand)_/.test(name))handVertices[name.endsWith('_l')?0:1].push(i);
  }
  const firstRest=basket.position.clone();
  let lastYaw=root.rotation.y,lastActivity,previousSoles=null,dropped=false,carried=false;
  player.pos.set(4,.174,0);
  for(let tick=0;tick<30*29;tick++){
   WashHouse.tick(1/30);const row=WashHouse.record()[0];seen.add(row.activity);
   assert(Math.abs(wrapA(root.rotation.y-lastYaw))<.064,'resident must step through turns');
   lastYaw=root.rotation.y;
   const walking=row.activity==='Walk'||row.activity==='Carry';
   if(walking&&hasCarry){
    const points=[];
    for(let i=0;i<shoe.geometry.attributes.position.count;i+=4){
     shoe.localToWorld(shoe.boneTransform(i,sample));points.push(sample.clone());
    }
    if(previousSoles&&lastActivity===row.activity){
     const support=[];
     for(let j=0;j<points.length;j++){
      const old=previousSoles[j],p=points[j];
      if(p.y<.183&&old.y<.183)support.push(Math.hypot(p.x-old.x,p.z-old.z));
     }
     if(support.length){support.sort((a,b)=>a-b);slip.push(support[Math.floor(support.length*.5)]);}
    }
    previousSoles=points;
   }else previousSoles=null;
   if(row.basketHeld){
    assert(Math.abs(grips[0].position.distanceTo(grips[1].position)-.620)<1e-6);
    for(let side=0;side<2;side++){
     const finger=basket.worldToLocal(fingers[side].getWorldPosition(new V3()));
     const handle=grips[side].position,sign=side===0?1:-1;
     assert(Math.abs((finger.x-handle.x)*sign+.013)<.003,'each finger pad must reach its own rubber grip across the basket');
     assert(Math.hypot(finger.y-handle.y,finger.z-handle.z)<.005,'the finger must stay alongside its handle');
     if(row.activity!=='Carry')continue;
     let gap=Infinity,surface=Infinity;
     for(const k of handVertices[side]){
      handMesh.boneTransform(k,sample).applyMatrix4(handMesh.matrixWorld);basket.worldToLocal(sample);
      const end=Math.max(0,Math.abs(sample.z-handle.z)-.065);
      const distance=Math.hypot(sample.x-handle.x,sample.y-handle.y,end)-.0105;
      gap=Math.min(gap,distance);surface=Math.min(surface,Math.abs(distance));
     }
     assert(gap<.003&&surface<.005,'deformed finger skin must stay in contact with the actual rubber surface');
    }
    if(basket.position.distanceTo(firstRest)>2)carried=true;
   }else if(row.activity==='Walk'&&basket.position.distanceTo(firstRest)>2){
    dropped=true;
    const start=basket.position.clone().add(new V3(0,.24,0));
    assert(WashHouse.ray(start,new V3(0,-.5,0),0)<1,'stationary basket must occlude a trace');
    const overlap=basket.position.clone();assert(WashHouse.push(overlap,.36,.174),'basket must block the player capsule');
   }
   lastActivity=row.activity;
  }
  if(hasCarry){
   assert.deepEqual([...seen],['Idle','PickUp','Carry','SetDown','Walk']);assert(carried&&dropped);
   slip.sort((a,b)=>a-b);assert(slip.length>150);assert(slip[Math.floor(slip.length*.95)]<.065,'standing soles must stay planted through most of the walk');
  }else assert.deepEqual([...seen],['Idle','Laundry','Walk']);
  const at=new V3().copy(WashHouse.record()[0].position),overlap=at.clone();
  assert(WashHouse.push(overlap,.36,.174));
  assert(Math.hypot(overlap.x-at.x,overlap.z-at.z)>.38);
  assert(WashHouse.ray(new V3(at.x,at.y+1.2,at.z-2),new V3(0,0,4),0)<1);
  player.pos.copy(at).add(new V3(0,0,1.7));player.yaw=Math.PI;
  const interrupted=WashHouse.record()[0].activity;
  WashHouse.interaction(player.pos).fn();
  if(interrupted==='Carry')assert.equal(WashHouse.record()[0].activity,'SetDown');
  for(let i=0;i<70&&WashHouse.record()[0].activity!=='Talk';i++)WashHouse.tick(1/30);
  assert.equal(WashHouse.record()[0].activity,'Talk');assert(!WashHouse.record()[0].basketHeld);
  for(let tick=0;tick<55;tick++){
   const yawBefore=root.rotation.y;WashHouse.tick(1/30);assert(Math.abs(wrapA(root.rotation.y-yawBefore))<.064);
  }
  assert(WashHouse.hit());
  if(asset.animations.some(c=>c.name==='Fall'))assert.equal(WashHouse.record()[0].clip,'Fall');
  for(let tick=0;tick<100&&WashHouse.record()[0].activity!=='down';tick++)WashHouse.tick(1/30);
  assert.equal(WashHouse.interaction(player.pos).label,'HELP IDA UP');
  WashHouse.interaction(player.pos).fn();assert.equal(WashHouse.record()[0].activity,'Recover');
 `);
 console.log('Ida’s gait, basket exchange, dialogue, colliders and recovery passed in the shipped runtime libraries.');
}

exercise().catch(error => { console.error(error);process.exitCode=1; });
