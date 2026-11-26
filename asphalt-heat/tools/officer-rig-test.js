// Run with node tools/officer-rig-test.js. The runtime loader, skeletons and animation clips are the game's own.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=path.resolve(__dirname,'..');
const THREE=require(path.join(game,'lib/three.min.js'));
const read=name=>fs.readFileSync(path.join(game,name),'utf8');
const context=vm.createContext({
 THREE,V3:THREE.Vector3,CV:THREE.Vector3,unitBox:new THREE.BoxGeometry(),scene:new THREE.Scene(),
 console,atob,btoa,URL,Blob,TextDecoder,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int16Array,Float32Array,
 setTimeout,window:{URL},self:{URL},LOWSHADOW:false,clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x))
});
const run=source=>vm.runInContext(source,context);
run(read('lib/GLTFLoader.js'));
run(read('lib/SkeletonUtils.js'));
run(read('js/chars.js'));
run(read('js/department.js'));
run(read('js/police-world.js'));

// CPU skinning does not need GPU image uploads. Check every texture URI before letting the loader proceed.
THREE.TextureLoader.prototype.load=function(uri,done){
 assert(fs.existsSync(path.join(game,'models',uri)),uri);
 const texture=new THREE.Texture();
 queueMicrotask(()=>done(texture));
 return texture;
};
function load(name){
 return new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(read('models/'+name+'.json'),'',resolve,reject));
}
async function verify(){
 context.mocap=await load('anim_x');run("addAnimSource('x',mocap,0,null)");
 const uniforms=['Police_Male_01','Police_Male_03','Police_Male_06','Police_Male_07','Police_Male_02'];
 for(const name of [...uniforms,'Female_Adult_03']){
  context.name=name;context.gltf=await load(name);
  run("addTemplate(name,gltf,'cop','x',{idle:'idle',walk:'walk',run:'run',talk:'agree'})");
 }
 for(const name of uniforms){
  context.name=name;
  context.actor=run('makeChar(name)');const actor=context.actor;
  run("fitDepartmentPortrait(actor,'Female_Adult_03');equipOfficer(actor,false,true)");
  const face=[];
  actor.model.traverse(mesh=>{if(mesh.isSkinnedMesh)face.push(mesh);});
  const head=face.find(mesh=>mesh.visible&&mesh.material.name==='f003_head');
  const hair=face.find(mesh=>mesh.visible&&mesh.material.name==='f003_opacity');
  assert(head&&hair,name+' must have its fitted face and hair');
  assert.equal(head.skeleton,hair.skeleton);
  const mount=actor.bones.Spine2.children.at(-1);
  for(const speed of [0,1.4,5]){
   context.speed=speed;
   run('updChar(actor,speed,.22,true);actor.root.updateMatrixWorld(true)');
   const eye=actor.bones.Head.getWorldPosition(new THREE.Vector3());
   const chest=mount.getWorldPosition(new THREE.Vector3());
   assert(eye.y>1.36&&eye.y<1.75,name+' torso must remain upright at speed '+speed);
   assert(chest.distanceTo(eye)<.46&&chest.y<eye.y-.08,name+' camera stays below the neck');
   const vest=actor.bones.Spine2.getObjectByName('Traffic patrol vest'),position=vest.geometry.attributes.position;
   for(let i=0;i<position.count;i++){
    const p=vest.localToWorld(new THREE.Vector3().fromBufferAttribute(position,i));
    assert(p.distanceTo(eye)<.75 && p.y<eye.y-.035,name+' vest stays on the torso');
   }
  }
 }
 console.log('Patrol and investigative uniforms loaded, stayed upright, and retained their fitted portraits and cameras.');
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
