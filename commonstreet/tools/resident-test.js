// Exercise the exported Ida rig with the GLTF loader, animation mixer and physics library shipped with the game.
// From commonstreet, run node tools/resident-test.js [path-to-candidate.glb].
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
  assert.equal(WashHouse.record()[0].colliders,67);
  assert.equal(WashHouse.interaction(player.pos).label,'TALK TO IDA');
  const root=scene.getObjectByName('Ida Mercer | Wash House'),basket=scene.getObjectByName('Ida Mercer | Laundry basket');
  root.traverse(node=>{
   if(!node.isMesh||!/Captured.bun|Loose.temple.*fringe/i.test(node.name))return;
   assert.equal(node.castShadow,false,'fractional hair alpha must not cast an opaque shell on the face');
   const mats=Array.isArray(node.material)?node.material:[node.material];
   for(const m of mats){
    if(m.name==='captured-hair')assert(!m.transparent&&m.depthWrite&&m.alphaTest===.28,'posterior hair must occlude the front overlay through depth');
    if(m.name==='frontal-locks'){
     assert(m.transparent&&!m.depthWrite&&node.renderOrder===2,'keep the photographed fringe translucent over the facial overlay');
     const coverage=node.geometry.attributes.templeCoverage;
     assert.equal(coverage.count,node.geometry.attributes.position.count);
     assert(coverage.array.some(v=>v===0)&&coverage.array.some(v=>v>.99),'angle fading must distinguish central fringe from the temples');
     assert.equal(node.parent.name,'head','the projection axis must follow the moving head');
     const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
     m.onBeforeCompile(shader);
     assert(shader.vertexShader.includes('vTemple=templeCoverage')&&shader.fragmentShader.includes('diffuseColor.a*=mix(1.,.12'));
    }
   }
  });
  const jawKeys=[],otherKeys=[];
  root.traverse(node=>{
   if(!node.isMesh)return;
   for(const mat of Array.isArray(node.material)?node.material:[node.material]){
    if(mat.name==='Photographic facial skin')assert(mat.transparent&&mat.depthWrite&&mat.alphaTest===.055&&node.renderOrder===1,
     'the visible bridge must occlude farther facial triangles while the feathered edge stays translucent');
    if(!mat.isMeshStandardMaterial||!mat.customProgramCacheKey().includes('resident-sky-exposure'))continue;
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    mat.onBeforeCompile(shader);
    const hasFloor=shader.fragmentShader.includes('inverseTransformDirection(normal,viewMatrix).y');
    assert.equal(hasFloor,mat.name==='Photographed jaw and neckline','floor return must be exclusive to the downward-facing jaw material');
    (hasFloor?jawKeys:otherKeys).push(mat.customProgramCacheKey());
   }
  });
  assert(jawKeys.every(k=>!otherKeys.includes(k)),'jaw fill needs its own GLSL program');
  const bodyMesh=root.getObjectByName('Body');
  if(bodyMesh.material.name==='Body PBR'){
   const shades=bodyMesh.geometry.attributes.color;
   assert(bodyMesh.material.vertexColors&&shades.count===bodyMesh.geometry.attributes.position.count);
   assert(shades.array.some(v=>v===1)&&shades.array.some(v=>v<.6),'hand correction must blend independently of torso color');
  }
  const wrists=['hand_l','hand_r'].map(name=>root.getObjectByName(name));
  const firstPose=wrists.map(wrist=>wrist.getWorldPosition(new V3()));
  WashHouse.tick(0);
  for(let i=0;i<wrists.length;i++)assert(firstPose[i].distanceTo(wrists[i].getWorldPosition(new V3()))<.001,'first streamed pose must already be the performed Idle');
  WashHouse.tick(1/30);
  for(const joint of ['head','neck_01','spine_03','pelvis',...['l','r'].flatMap(s=>['upperarm','lowerarm','hand','thumb_03','index_03','middle_03','ring_03','pinky_03','thigh','calf','foot','ball'].map(b=>b+'_'+s))]){
   const center=root.getObjectByName(joint).getWorldPosition(new V3());
   for(const direction of [new V3(0,0,1),new V3(1,0,0)]){
    const start=center.clone().addScaledVector(direction,-1.35);
    const t=WashHouse.ray(start,direction.clone().multiplyScalar(2.7),0);
    assert(t>0&&t<=.5,'standing front and side collision at '+joint+' ('+t+')');
   }
  }
  const hips=root.getObjectByName('pelvis').getWorldPosition(new V3());
  for(const d of [new V3(1,0,0),new V3(-1,0,0),new V3(0,0,-1),new V3(0,0,1)]){
   const start=hips.clone().addScaledVector(d,-1.5),end=start.clone().addScaledVector(d,3.45);
   const before=new V3(end.x,.174,end.z);
   assert(WashHouse.push(before,.36,.174,{startX:start.x,startZ:start.z,dx:d.x*3.45,dz:d.z*3.45,dt:.5}));
   assert(before.clone().sub(hips).dot(d)<0,'a direct sprint across the body must stop at the entry side');
   assert(WashHouse.movementClearance(start,end,.36,.174).distance<-.5,'sweep input must actually cross the body');
   assert(WashHouse.movementClearance(start,before,.36,.174).distance>=-.004,'the resolved path must clear the live capsule volumes');
  }
  const hasCarry=asset.animations.some(clip=>clip.name==='Carry');
  const shoe=root.getObjectByName('Cloth_shoes'),sample=new V3(),seen=new Set(),slip=[];
  const fingers=['l','r'].map(side=>root.getObjectByName('middle_02_'+side));
  const grips=['left','right'].map(side=>basket.getObjectByName('Ida basket '+side+' grip'));
  const handMesh=root.getObjectByName('Body'),handVertices=[[],[]];
  const palmPads=[[],[]];
  const indices=handMesh.geometry.attributes.skinIndex,weights=handMesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++){
   const influences=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
   const joint=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)][influences.indexOf(Math.max(...influences))];
   const name=handMesh.skeleton.bones[joint].name;
   const side=name.endsWith('_l')?0:1;
   if(/^(thumb|index|middle|ring|pinky|hand)_/.test(name))handVertices[side].push(i);
   if((name==='hand_l'||name==='hand_r')&&Math.max(...influences)>.78)palmPads[side].push(i);
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
  // Frames 21–32 transfer weight from both palms to the planted knee and leading boot.
  // Measure actual skinned palm pads after the full dialogue/fall/recovery mixer transition.
  const firstPad=[null,null],floorY=root.position.y;
  assert(palmPads.every(pad=>pad.length>0),'both palms must have load-bearing skin vertices');
  for(let frame=1;frame<=32;frame++){
   WashHouse.tick(1/24);
   if(frame<21)continue;
   for(let side=0;side<palmPads.length;side++){
    const center=new V3();let lowest=Infinity;
    for(const vertex of palmPads[side]){
     handMesh.boneTransform(vertex,sample).applyMatrix4(handMesh.matrixWorld);
     lowest=Math.min(lowest,sample.y);center.add(sample);
    }
    center.multiplyScalar(1/palmPads[side].length);
    const clearance=lowest-floorY;
    assert(clearance>=-.0005&&clearance<=.003,'planted palm must meet the tile at Recover frame '+frame);
    if(!firstPad[side])firstPad[side]=center;
    const drift=Math.hypot(center.x-firstPad[side].x,center.z-firstPad[side].z);
    assert(drift<=.0005,'planted palm must stay in place at Recover frame '+frame);
   }
  }
 `);
 console.log('Ida’s gait, basket exchange, dialogue, colliders and recovery passed in the shipped runtime libraries.');
}

exercise().catch(error => { console.error(error);process.exitCode=1; });
