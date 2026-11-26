// Check the posed mesh, including shoes, against the real MX-5 floor and wheel.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const context=vm.createContext({THREE,console,TextDecoder,self:{URL},CV:THREE.Vector3,V3:THREE.Vector3,
 clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),player:{c:{}},navigator:{userAgent:'node'}});
const run=source=>vm.runInContext(source,context);
for(const name of ['lib/GLTFLoader.js','lib/SkeletonUtils.js','js/chars.js','js/cargen.js','js/fleet.js'])run(read(name));
const core=read('js/core.js');
run(core.slice(core.indexOf('function mergeGeos('),core.indexOf('\nfunction ',core.indexOf('function mergeGeos(')+1)));
async function load(name){
 const data=JSON.parse(read('models/'+name+'.json'));
 if(data.materials)data.materials=data.materials.map(({name})=>({name}));
 return new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(JSON.stringify(data),'',resolve,reject));
}
// WebGL decodes normalized integer attributes when drawing. The r128 CPU skinning helper expects float input.
function unpack(attribute){
 if(!attribute.normalized)return attribute;
 const max={Int16Array:32767,Uint16Array:65535,Uint8Array:255}[attribute.array.constructor.name];
 assert(max,'unsupported normalized attribute '+attribute.array.constructor.name);
 const values=new Float32Array(attribute.count*attribute.itemSize);
 const components=['getX','getY','getZ','getW'];
 for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)values[i*attribute.itemSize+k]=Math.max(-1,attribute[components[k]](i)/max);
 return new THREE.BufferAttribute(values,attribute.itemSize);
}
async function main(){
 context.anim=await load('anim_x');run("addAnimSource('x',anim,0,null)");
 const names=Object.keys(JSON.parse(read('models/cast.json')));
 const spec=run('CARSPEC.miata'),floor=spec.gc+.095;
 let clearance=Infinity;
 for(const name of names){
  context.name=name;context.gltf=await load(name);
  context.player.c.name=name;
  const c=context.c={driver:'player',phys:true,steerA:0,spec,mesh:new THREE.Group()};
  run("addTemplate(name,gltf,'m','x',{});c.steeringWheel=makeRoadsterWheel(c.spec);c.mesh.add(c.steeringWheel);updateSeatedDriver(c)");
  c.mesh.updateMatrixWorld(true);
  const point=new THREE.Vector3();
  c.seatedDriver.model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh || !mesh.visible)return;
   const geo=mesh.geometry;
   for(const key of ['position','skinWeight'])geo.setAttribute(key,unpack(geo.attributes[key]));
   for(let i=0;i<geo.attributes.position.count;i++){
    mesh.boneTransform(i,point).applyMatrix4(mesh.matrixWorld);
    assert(point.y>=floor-.002,name+' clips the footwell at '+point.y.toFixed(3)+' m');
    clearance=Math.min(clearance,point.y-floor);
   }
  });
  for(const [steer,yaw,pitch] of [[-.30,-1.2,.04],[0,0,0],[.30,2.65,-.035]]){
   c.mesh.position.set(128,.09,288);c.mesh.rotation.set(pitch,yaw,.018,'YXZ');
   c.steerA=steer;run('updateDriverSteering(c)');
   for(const [side,sign] of [['Left',1],['Right',-1]]){
    const grip=c.steeringWheel.localToWorld(new THREE.Vector3(sign*.135,.072,-.012));
    const palm=c.seatedDriver.bones['Bip01_'+(sign>0?'L':'R')+'_Finger2'].getWorldPosition(point);
    assert(palm.distanceTo(grip)<.018,name+' misses the '+side+' grip by '+palm.distanceTo(grip).toFixed(3)+' m');
   }
  }
 }
 console.log(names.length+' seated character meshes clear the footwell and reach both grips. Minimum clearance '+(clearance*1000).toFixed(0)+' mm.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
