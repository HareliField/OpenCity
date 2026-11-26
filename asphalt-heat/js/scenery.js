/* Reviewed GLB scenery shares geometry and textures across its instances. */
const OUTDOOR_MODELS=[];
const _sceneryQuat=new THREE.Quaternion();
const _streetMatrix=new THREE.Matrix4();
const _streetScale=new V3(1,1,1);
const _streetUp=new V3(0,1,0);
let sceneryClock=0;

function modelInstance(template,dims,id){
 const node=template.clone(true);
 const source=template.userData.dimensions;
 const entry=INTERIORS.catalog[id];
 node.scale.set(dims[0]/source[0],dims[1]/source[1]*(entry.heightScale||1),dims[2]/source[2]);
 return node;
}

function placeScenery(id,x,y,z,heading,dims,fallback){
 OUTDOOR_MODELS.push({id,x,y,z,heading,dims,fallback,display:null,started:false});
}

function updateOutdoorModels(dt,x,z){
 if((sceneryClock-=dt)>0)return;
 sceneryClock=.65;
 for(const p of OUTDOOR_MODELS){
  const near=(p.x-x)**2+(p.z-z)**2<68**2;
  if(p.display)p.display.visible=near;
  if(p.fallback)p.fallback(!p.display||!near);
  if(p.started||!near)continue;
  const promise=requestScenery(p.id);
  if(!promise)continue;
  p.started=true;
  promise.then(template=>{
   if(!template)return;
   const node=modelInstance(template,p.dims,p.id);
   node.position.set(p.x,p.y,p.z);
   node.rotation.y=p.heading;
   node.traverse(o=>{if(o.isMesh)o.castShadow=true;});
   p.display=node;
   p.fallback?.(false);
   scene.add(node);
  });
 }
 updatePropModels(x,z);
 const coupe=cars.find(c=>c.heroWanted&&!c.heroLoading&&!c.dead&&Math.hypot(x-c.pos.x,z-c.pos.z)<85);
 if(coupe&&INTERIORS.catalog.coupe)loadHeroCoupe(coupe);
}

function installTreeModels(instances,trunks,leaves,kind,selected){
 if(!trunks||!leaves)return;
 for(let i=0;i<instances.length;i++){
  const [x,z,scale]=instances[i];
  if(!selected(x,z,i))continue;
  const originalTrunk=new THREE.Matrix4(),originalLeaves=new THREE.Matrix4();
  trunks.getMatrixAt(i,originalTrunk);
  leaves.getMatrixAt(i,originalLeaves);
  let visible=true;
  const fallback=show=>{
   if(show===visible)return;
   visible=show;
   _streetMatrix.makeTranslation(0,-1000,0);
   trunks.setMatrixAt(i,show?originalTrunk:_streetMatrix);
   leaves.setMatrixAt(i,show?originalLeaves:_streetMatrix);
   trunks.instanceMatrix.needsUpdate=true;
   leaves.instanceMatrix.needsUpdate=true;
  };
  const dims=kind==='palm-tree'?[4.85*scale,9.15*scale,4.55*scale]:[5.3*scale,6.55*scale,5.08*scale];
  placeScenery(kind,x,groundY(x,z),z,(x+z)*.031,dims,fallback);
 }
}

function updatePropModels(x,z){
 const types={bin:['street-bin',[.66,.992,.66]],fence:['picket-fence',[2.31,.96,.16]],lamp:['street-lamp',[.81,7.20,2.85]]};
 for(const p of PROPS.list){
  const type=types[p.t];
  if(!type)continue;
  const [id,dims]=type;
  const pos=p.renderPosition;
  const near=(pos.x-x)**2+(pos.z-z)**2<(id==='street-lamp'?39:29)**2;
  if(p.display&&p.display.visible!==near){
   p.display.visible=near;
   syncPropMesh(p);
   syncLampGlow(p);
  }
  if(p.artStarted||!near)continue;
  const promise=requestScenery(id);
  if(!promise)continue;
  p.artStarted=true;
  promise.then(template=>{
   if(!template)return;
   const node=modelInstance(template,dims,id);
   node.traverse(o=>{if(o.isMesh)o.castShadow=p.t!=='lamp';});
   p.display=node;
   node.visible=true;
   scene.add(node);
   syncPropMesh(p);
   syncLampGlow(p);
  });
 }
}

function syncLampGlow(p){
 if(p.t!=='lamp'||p.moved)return;
 const height=p.display?.visible?5.69:6.9;
 const x=p.x+Math.sin(p.ry)*1.85,z=p.z+Math.cos(p.ry)*1.85;
 const points=PROPS.glow.geometry.attributes.position;
 points.setXYZ(p.gi,x,p.y+height,z);
 points.needsUpdate=true;
 _streetMatrix.makeRotationY(p.ry);
 _streetMatrix.setPosition(x,p.y+height-.12,z);
 PROPS.heads.setMatrixAt(p.gi,_streetMatrix);
 PROPS.heads.instanceMatrix.needsUpdate=true;
}

function syncPropMesh(p){
 if(p.node){
  p.node.position.copy(p.renderPosition);
  p.node.quaternion.copy(p.renderQuaternion);
  return;
 }
 if(p.display){
  p.display.position.copy(p.renderPosition);
  p.display.quaternion.copy(p.renderQuaternion);
 }
 if(p.display?.visible){
  _streetMatrix.makeTranslation(0,-1000,0);
 }else{
  _streetMatrix.compose(p.renderPosition,p.renderQuaternion,_streetScale);
 }
 p.P.mesh.setMatrixAt(p.idx,_streetMatrix);
 p.P.mesh.instanceMatrix.needsUpdate=true;
}

let coupeModel=null;
const COUPE_WHEEL_Y=new THREE.Quaternion().setFromAxisAngle(_streetUp,-Math.PI/2);
const COUPE_WHEEL_FLIP=new THREE.Quaternion().setFromAxisAngle(_streetUp,Math.PI);
const COUPE_WHEEL_SPIN=new THREE.Quaternion();
const COUPE_WHEEL_X=new V3(1,0,0);

function loadHeroCoupe(car){
 car.heroLoading=true;
 if(!coupeModel){
  const path='models/scenery/'+INTERIORS.catalog.coupe.file;
  coupeModel=new Promise((resolve,reject)=>new THREE.GLTFLoader().load(path,resolve,undefined,reject))
   .then(gltf=>{
    const shell=gltf.scene.getObjectByName('CoupeShell');
    const wheel=gltf.scene.getObjectByName('WheelPrototype');
    if(!shell||!wheel?.isMesh)return null;
    shell.traverse(o=>{
     if(o.isMesh){
      o.castShadow=true;
      o.receiveShadow=true;
      o.material.envMapIntensity=1.08;
     }
    });
    return {shell,wheel};
   }).catch(()=>null);
 }
 coupeModel.then(template=>{
  if(!template||!cars.includes(car)||!car.heroWanted||car.dead)return;
  const shell=template.shell.clone(true),wheels=[];
  car.mesh.add(shell);
  car.body3.visible=false;
  for(let i=0;i<4;i++){
   const wheel=template.wheel.clone();
   wheel.castShadow=true;
   wheel.receiveShadow=true;
   wheels.push(wheel);
   scene.add(wheel);
  }
  const lenses=[];
  for(const z of [-2.219,2.224])for(const side of [-1,1]){
   const lens=new THREE.Mesh(unitBox,z<0?LENS.tailOff:LENS.headOff);
   lens.position.set(side*(z<0?.673:.658),z<0?.685:.427,z);
   lens.scale.set(z<0?.26:.19,.066,.016);
   lens.visible=false;
   car.mesh.add(lens);
   lenses.push(lens);
  }
  car.hero={shell,wheels,lenses,deformed:false};
  updateHeroLights(car);
 });
}

function heroWheel(car,i,position,quaternion,physics){
 const w=car.hero.wheels[i];
 w.visible=car.mesh.visible;
 w.position.copy(position);
 _sceneryQuat.copy(quaternion);
 if(physics)_sceneryQuat.multiply(COUPE_WHEEL_Y);
 else _sceneryQuat.multiply(COUPE_WHEEL_SPIN.setFromAxisAngle(COUPE_WHEEL_X,car.spin));
 if(i%2)_sceneryQuat.multiply(COUPE_WHEEL_FLIP);
 w.quaternion.copy(_sceneryQuat);
}

function updateHeroLights(car){
 if(!car.hero)return;
 for(let i=0;i<4;i++){
  const lens=car.hero.lenses[i];
  lens.visible=car.beam.visible;
  lens.material=car.mats[i<2?4:3];
 }
}

function removeHeroCoupe(car){
 if(!car.hero)return;
 const {shell,wheels,lenses,deformed}=car.hero;
 car.mesh.remove(shell,...lenses);
 scene.remove(...wheels);
 if(deformed)shell.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
 car.hero=null;
 car.body3.visible=true;
}
