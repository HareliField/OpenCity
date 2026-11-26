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
 const device=placeCityMachine(id,x,y,z,heading,dims);
 OUTDOOR_MODELS.push({id,x,y,z,heading,dims,fallback,device,display:null,started:false});
}

function updateOutdoorModels(dt,x,z){
 if((sceneryClock-=dt)>0)return;
 sceneryClock=.65;
 for(const p of OUTDOOR_MODELS){
  const near=(p.x-x)**2+(p.z-z)**2+(p.y-player.pos.y)**2<(QUALITY.level===0?43:68)**2;
  if(p.display)p.display.visible=near;
  if(p.fallback)p.fallback(!p.display||!near);
  if(p.started||!near)continue;
  const promise=requestScenery(p.id);
  if(!promise)continue;
  p.started=true;
  promise.then(template=>{
   if(!template){p.started=false;return;}
   const node=modelInstance(template,p.dims,p.id);
   node.position.set(p.x,p.y,p.z);
   node.rotation.y=p.heading;
   node.traverse(o=>{if(o.isMesh)o.castShadow=true;});
   shadeFixture(node,p.x,p.y,p.z);
   p.display=node;
   if(p.device)bindCityMachine(p.device,node);
   node.visible=(p.x-player.pos.x)**2+(p.z-player.pos.z)**2+(p.y-player.pos.y)**2<(QUALITY.level===0?43:68)**2;
   p.fallback?.(!node.visible);
   scene.add(node);
  });
 }
 updateDoorModels();
 updatePropModels(x,z);
 const featured=cars.find(c=>c.heroWanted&&!c.heroLoading&&!c.dead&&!(c.retryAfter>performance.now())&&Math.hypot(x-c.pos.x,z-c.pos.z)<85);
 if(featured&&INTERIORS.catalog[featured.heroAsset||'coupe'])loadHeroCar(featured);
}

function updatePropModels(x,z){
 const types={meter:['coin-parking-meter',[.225,1.48,.17]],hydrant:['cast-hydrant',[.51,.83,.43]],bench:['promenade-bench',[2,.91,.57]],postbox:['post-box',[.59,1.30,.64]],lantern:['cast-lantern',[.56,4.84,.55]],bin:['avenue-bin',[.63,.96,.63]],fence:['picket-fence',[2.31,.96,.16]],lamp:['street-lamp',[.81,7.20,2.85]]};
 for(const p of PROPS.list){
  const type=p.riverside?['riverside-lamp',[.56,4.93,1.08]]:types[p.t];
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
   if(!template){p.artStarted=false;return;}
   const node=modelInstance(template,dims,id);
   node.traverse(o=>{if(o.isMesh)o.castShadow=!p.P.glow;});
   p.display=node;
   node.visible=true;
   scene.add(node);
   syncPropMesh(p);
   syncLampGlow(p);
  });
 }
}

function lampEmitter(p){
 const lantern=p.t==='lantern',arm=p.riverside&&p.display?.visible? .57 : lantern?0:1.85;
 return {x:p.x+Math.sin(p.ry)*arm,y:p.y+(p.riverside&&p.display?.visible?4.21:lantern?4.45:p.display?.visible?5.69:6.9),z:p.z+Math.cos(p.ry)*arm};
}
function syncLampGlow(p){
 if(!p.P.glow||p.moved)return;
 const {x,y,z}=lampEmitter(p);
 const points=PROPS.glow.geometry.attributes.position;
 points.setXYZ(p.gi,x,y,z);
 points.needsUpdate=true;
 _streetMatrix.makeRotationY(p.ry);
 _streetMatrix.setPosition(x,cityPowerAt(p.x,p.z)?y-.12:-1000,z);
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

const heroModels=new Map();
const REFERENCE_LAMPS={
 coupe:[[-2.219,.673,.685,.26],[2.224,.658,.427,.19]],
 'maroon-saloon':[[-2.29,.60,.76,.33],[2.261,.58,.669,.29]],
 'silver-city-sedan':[[-2.283,.58,.834,.34],[2.282,.621,.677,.30]],
 'brick-red-crossover':[[-2.23,.621,1.007,.285],[2.232,.658,.816,.283]],
 'harbor-box-truck':[[-3.334,.795,.922,.226],[3.353,.647,.998,.255]]
};
const COUPE_WHEEL_Y=new THREE.Quaternion().setFromAxisAngle(_streetUp,-Math.PI/2);
const COUPE_WHEEL_FLIP=new THREE.Quaternion().setFromAxisAngle(_streetUp,Math.PI);
const COUPE_WHEEL_SPIN=new THREE.Quaternion();
const COUPE_WHEEL_X=new V3(1,0,0);

function loadHeroCar(car){
 const id=car.heroAsset||'coupe';
 car.heroLoading=true;
 if(!heroModels.has(id)){
  const path='models/scenery/'+INTERIORS.catalog[id].file;
  const model=new Promise((resolve,reject)=>new THREE.GLTFLoader().load(path,resolve,undefined,reject))
   .then(gltf=>{
    const shell=gltf.scene.getObjectByName('VehicleShell')||gltf.scene.getObjectByName('CoupeShell')||gltf.scene.getObjectByName('Frame');
    const wheel=gltf.scene.getObjectByName('WheelPrototype');
    if(!shell||!wheel)return null;
    shell.traverse(o=>{
     if(o.isMesh){
      o.castShadow=true;
      o.receiveShadow=true;
      o.material.envMapIntensity=1.08;
     }
    });
    return {shell,wheel};
   }).catch(()=>null);
  heroModels.set(id,model);
 }
 heroModels.get(id).then(template=>{
  if(!template){heroModels.delete(id);car.heroLoading=false;car.retryAfter=performance.now()+10000;return;}
  if(!cars.includes(car)||!car.heroWanted||car.dead)return;
  const shell=template.shell.clone(true),wheels=[];
  shell.traverse(o=>{if(o.isMesh){o.material=o.material.clone();if(car.repainted)o.material.color.copy(lin(car.paintColor));}});
  car.mesh.add(shell);
  car.body3.visible=false;
  for(let i=0;i<4;i++){
   const wheel=template.wheel.clone();
   wheel.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
   wheels.push(wheel);
   scene.add(wheel);
  }
  const lenses=[];
  const lamps=REFERENCE_LAMPS[id]||REFERENCE_LAMPS.coupe;
  for(const [z,x,y,width] of lamps)for(const side of [-1,1]){
   const lens=new THREE.Mesh(unitBox,z<0?LENS.tailOff:LENS.headOff);
   lens.position.set(side*x,y,z);
   lens.scale.set(width,.066,.016);
   lens.visible=false;
   car.mesh.add(lens);
   lenses.push(lens);
  }
  car.hero={shell,wheels,lenses,deformed:false};
  syncCarMesh(car);
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
 shell.traverse(o=>{if(o.isMesh){if(deformed)o.geometry.dispose();if(o.material!==burntMat)o.material.dispose();}});
 car.hero=null;
 car.body3.visible=true;
}
