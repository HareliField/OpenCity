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
const fleet=read('js/fleet.js');
run(fleet.slice(fleet.indexOf('function reachDriverLimb('),fleet.indexOf('function updateDriverSteering(')));
const policeWorld=read('js/police-world.js');
run(policeWorld.slice(policeWorld.indexOf('function poseDispatcher('),policeWorld.indexOf('function updateStationPosts(')));
run(read('js/street-incidents.js'));

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
 for(const name of [...uniforms,'Female_Adult_03','Male_Adult_04','Male_Adult_08','Business_Female_01','Medical_Female_01','Medical_Male_01']){
  context.name=name;context.gltf=await load(name);
  run("addTemplate(name,gltf,'cop','x',{idle:'idle',walk:'walk',run:'run',talk:'agree'})");
 }
 for(const name of uniforms){
  context.name=name;
  context.actor=run('makeChar(name)');const actor=context.actor;
  run("fitDepartmentPortrait(actor,'Female_Adult_03');clipDepartmentCamera(actor)");
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
  }
 }
 for(const name of ['Business_Female_01','Male_Adult_08','Female_Adult_03']){
  context.name=name;context.actor=run('makeChar(name)');
  run('updChar(actor,0,.03,true);poseDispatcher(actor,{yaw:0,point:new V3(),keyboard:new V3(0,.829,.48)},1);actor.root.updateMatrixWorld(true)');
  const ankle=context.actor.bones.RightFoot.getWorldPosition(new THREE.Vector3());
  const finger=context.actor.consoleBones.Bip01_R_Finger22.getWorldPosition(new THREE.Vector3());
  assert(ankle.y>=.10&&ankle.y<=.14,'The dispatcher’s ankles must clear the floor');
  assert(finger.y>=.826&&finger.y<=.85&&Math.abs(finger.z-.48)<.088,'The fingertip must reach the keyboard');
 }
 for(const name of ['Medical_Female_01','Medical_Male_01']){
  context.name=name;context.actor=run('makeChar(name)');
  const contact=run(`updChar(actor,0,.04,true);
   poseExaminer(actor,{yaw:0,exhibit:new V3(0,1.213,.60)},3);
   actor.root.updateMatrixWorld(true);
   ['LeftKnuckle','RightKnuckle'].map(j=>actor.bones[j].getWorldPosition(new V3()));`);
  const targets=[new THREE.Vector3(.113,1.053,.537),new THREE.Vector3(-.113,1.171,.537)];
  assert(contact.every((p,i)=>p.distanceTo(targets[i])<.044),name+' must reach both sides of the exhibit');
 }
 const motion=run(`let time=0;
  const giver={c:makeChar('Male_Adult_04'),bag:new THREE.Group()},receiver={c:makeChar('Business_Female_01'),bag:null};
  giver.c.root.add(giver.bag);receiver.c.root.position.z=.77;receiver.c.yaw=Math.PI;
  const transfer=streetIncidents.current={phase:'Dispute',since:0,victim:giver,offender:receiver};
  function handoverFrame(t){
   time=t;
   for(const p of [giver,receiver]){updChar(p.c,0,1/30,true);poseStreetProps(p);}
   return {gap:giver.c.bones.RightHand.getWorldPosition(new V3()).distanceTo(receiver.c.bones.RightHand.getWorldPosition(new V3())),
    bag:(giver.bag||receiver.bag).getWorldPosition(new V3())};
  }
  const approach=handoverFrame(.5);handoverFrame(1.5);const contact=handoverFrame(2.48);
  receiver.c.root.attach(giver.bag);receiver.bag=giver.bag;giver.bag=null;transfer.phase='Struggle';transfer.since=2.5;
  const received=handoverFrame(2.5),released=handoverFrame(4.35);({approach,contact,received,released})`);
 assert(motion.approach.gap>.6&&motion.contact.gap<.095&&motion.released.gap>.6,'Both hands meet and release the handle');
 assert(motion.contact.bag.distanceTo(motion.received.bag)<.01,'The physical exhibit stays in place as ownership changes');
 console.log('Real actor rigs passed uniform, portrait, body camera, seated dispatch, exhibit examination and holdall handover checks.');

}
verify().catch(error=>{console.error(error);process.exitCode=1;});
