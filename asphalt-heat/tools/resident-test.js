// Exercise the exported Ida rig with the GLTF loader, animation mixer and physics library shipped with the game.
// Run from any directory with node tools/resident-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');

const game = path.join(__dirname, '..');
const text = file => fs.readFileSync(path.join(game, file), 'utf8');

function rigWithUntexturedMaterials() {
 const glb = fs.readFileSync(path.join(game, 'assets/residents/ida-mercer.glb'));
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
  const seen=new Set();
  for(let tick=0;tick<570;tick++){
   WashHouse.tick(1/30);seen.add(WashHouse.record()[0].activity);
  }
  assert.deepEqual([...seen],['Idle','Laundry','Walk']);
  const at=new V3().copy(WashHouse.record()[0].position),overlap=at.clone();
  assert(WashHouse.push(overlap,.36,.174));
  assert(Math.hypot(overlap.x-at.x,overlap.z-at.z)>.38);
  assert(WashHouse.ray(new V3(at.x,at.y+1.2,at.z-2),new V3(0,0,4),0)<1);
  player.pos.copy(at).add(new V3(0,0,1.7));player.yaw=Math.PI;
  WashHouse.interaction(player.pos).fn();assert.equal(WashHouse.record()[0].activity,'Talk');
  assert(WashHouse.hit());
  for(let tick=0;tick<100&&WashHouse.record()[0].activity!=='down';tick++)WashHouse.tick(1/30);
  assert.equal(WashHouse.interaction(player.pos).label,'HELP IDA UP');
  WashHouse.interaction(player.pos).fn();assert.equal(WashHouse.record()[0].activity,'Recover');
 `);
 console.log('Ida loads, works, speaks, blocks contact and stands up in the shipped runtime.');
}

exercise().catch(error => { console.error(error);process.exitCode=1; });
