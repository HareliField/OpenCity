/* Reviewed GLB scenery shares geometry and textures across its instances. */
const OUTDOOR_MODELS=[];
const _sceneryQuat=new THREE.Quaternion();
const _streetMatrix=new THREE.Matrix4();
const _streetScale=new V3(1,1,1);
const _streetUp=new V3(0,1,0);
let sceneryClock=0;

function placeScenery(id,x,y,z,heading,dims,fallback){
 const device=placeCityMachine(id,x,y,z,heading,dims);
 registerOutdoorModel(id,x,y,z,heading,dims,fallback,device);
}

function registerOutdoorModel(id,x,y,z,heading,dims,fallback,device=null){
 OUTDOOR_MODELS.push({id,x,y,z,heading,dims,fallback,device,display:null,started:false});
}

function outdoorModelInView(p){
 const view=caseCamera.focus||player.pos;
 return (p.x-view.x)**2+(p.z-view.z)**2+(p.y-view.y)**2<(QUALITY.level===0?43:68)**2;
}

function updateOutdoorModels(dt,x,z){
 if((sceneryClock-=dt)>0)return;
 sceneryClock=.65;
 for(const p of OUTDOOR_MODELS){
  const near=outdoorModelInView(p);
  if(p.display)p.display.visible=near;
  if(p.fallback)p.fallback(!p.display||!near);
  if(p.started||!near)continue;
  const promise=requestScenery(p.id);
  if(!promise)continue;
  p.started=true;
  promise.then(template=>{
   if(!template){p.started=false;return;}
   const node=modelInstance(template,p.dims);
   node.position.set(p.x,p.y,p.z);
   node.rotation.y=p.heading;
   node.traverse(o=>{if(o.isMesh)o.castShadow=true;});
   shadeFixture(node,p.x,p.y,p.z);
   p.display=node;
   if(p.device)bindCityMachine(p.device,node);
   node.visible=outdoorModelInView(p);
   p.fallback?.(!node.visible);
   scene.add(node);
  });
 }
 updateDoorModels();
 updatePropModels(x,z);
 for(const c of cars)streamVehicleComponents(c,Math.hypot(x-c.pos.x,z-c.pos.z)<48);
 const featured=cars.find(c=>c.heroWanted&&!c.heroLoading&&!c.dead&&!(c.retryAfter>performance.now())&&Math.hypot(x-c.pos.x,z-c.pos.z)<85);
 if(featured){
  const url=legacySceneryURL(featured.heroAsset||'coupe');
  if(url)loadHeroCar(featured,url);
 }
}

function updatePropModels(x,z){
 const types={meter:['coin-parking-meter',[.225,1.48,.17]],hydrant:['cast-hydrant',[.51,.83,.43]],bench:['promenade-bench',[2,.91,.57]],postbox:['post-box',[.59,1.30,.64]],lantern:['cast-lantern',[.56,4.84,.55]],bin:['avenue-bin',[.63,.96,.63]],fence:['picket-fence',[2.31,.96,.16]],lamp:['street-lamp',[.81,7.20,2.85]]};
 for(const p of PROPS.list){
  const dockLamp=p.t==='lamp'&&p.x>=15*CELL&&p.x<W+HALF&&p.z>=13*CELL;
  const gardenLamp=p.t==='lamp'&&p.x>=11*CELL&&p.x<=13*CELL&&p.z>=2*CELL&&p.z<=4*CELL;
  const palmLamp=p.t==='lamp'&&p.x>=9*CELL&&p.x<=11*CELL&&p.z>=7*CELL&&p.z<=11*CELL;
  const type=dockLamp||gardenLamp||palmLamp?['dock-street-lamp',[.38,7.20,2.49]]:p.riverside?['riverside-lamp',[.56,4.93,1.08]]:types[p.t];
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
   const node=modelInstance(template,dims);
   node.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=!p.P.glow;
    if(p.t==='lantern'&&(!p.riverside||o.material.name==='Opal lamp lens'))bindLanternLens(p,o);
   });
   node.userData.roadwayLens=id==='dock-street-lamp';
   p.display=node;
   node.visible=true;
   scene.add(node);
   syncPropMesh(p);
   syncLampGlow(p);
  });
 }
}

function lampEmitter(p){
 const lantern=p.t==='lantern',loaded=p.display?.visible;
 const roadway=loaded&&p.display.userData.roadwayLens;
 const arm=roadway?2.11:p.riverside&&loaded?.57:lantern?0:1.85;
 const height=roadway?7.005:p.riverside&&loaded?4.21:lantern?4.45:loaded?5.69:6.9;
 return {x:p.x+Math.sin(p.ry)*arm,y:p.y+height,z:p.z+Math.cos(p.ry)*arm};
}
const illuminatedLanternGlass=new WeakMap();
function bindLanternLens(p,mesh){
 const off=mesh.material;
 let on=illuminatedLanternGlass.get(off);
 if(!on){
  on=off.clone();
  // The cast lantern bakes its iron and frosted glass into one atlas.
  const mask=p.riverside?'1.':
   'smoothstep(4.15,4.25,vLensY)*(1.-smoothstep(4.49,4.53,vLensY))*smoothstep(.025,.20,max(diffuseColor.r,diffuseColor.g))';
  on.onBeforeCompile=sh=>{
   sh.uniforms.uLamp=climateUniforms.uLamp;
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vLensY;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvLensY=position.y;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLensY; uniform float uLamp;')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(2.5,1.65,.81)*uLamp*('+mask+');');
  };
  on.customProgramCacheKey=()=>mask;
  illuminatedLanternGlass.set(off,on);
 }
 p.lens={mesh,off,on};
}
const lampLensSize=new V3(.32,.048,.50),lanternLensSize=new V3(.245,.24,.245);
function syncLampGlow(p){
 if(!p.P.glow)return;
 const powered=!p.moved&&cityPowerAt(p.x,p.z);
 if(p.lens)p.lens.mesh.material=powered?p.lens.on:p.lens.off;
 const {x,y,z}=lampEmitter(p);
 const {position:points,color:colors}=PROPS.glow.geometry.attributes;
 points.setXYZ(p.gi,x,y,z);
 points.needsUpdate=true;
 colors.setXYZ(p.gi,powered?1:0,powered?.72:0,powered?.42:0);
 colors.needsUpdate=true;
 _streetMatrix.makeRotationY(p.ry).scale(p.t==='lantern'?lanternLensSize:lampLensSize);
 const showBulb=powered&&!(p.lens&&p.display?.visible);
 _streetMatrix.setPosition(x,showBulb?y+(p.t==='lantern'?.03:-.12):-1000,z);
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
 if(p.moved){
  const bound=p.mesh.geometry.boundingSphere,shape=p.P.geo.boundingSphere;
  bound.radius=Math.max(bound.radius,bound.center.distanceTo(p.renderPosition)+shape.center.length()+shape.radius);
 }
 p.mesh.setMatrixAt(p.idx,_streetMatrix);
 p.mesh.instanceMatrix.needsUpdate=true;
}

const heroModels=new Map();
const REFERENCE_LAMPS={
 coupe:[[-2.219,.673,.685,.26],[2.224,.658,.427,.19]],
 'maroon-saloon':[[-2.29,.60,.76,.33],[2.261,.58,.669,.29]],
 'graphite-city-saloon':[[-2.29,.60,.76,.33],[2.261,.58,.669,.29]],
 'silver-city-sedan':[[-2.283,.58,.834,.34],[2.282,.621,.677,.30]],
 'brick-red-crossover':[[-2.23,.621,1.007,.285],[2.232,.658,.816,.283]],
 'harbor-box-truck':[[-3.334,.795,.922,.226],[3.353,.647,.998,.255]]
};
const COUPE_WHEEL_Y=new THREE.Quaternion().setFromAxisAngle(_streetUp,-Math.PI/2);
const COUPE_WHEEL_FLIP=new THREE.Quaternion().setFromAxisAngle(_streetUp,Math.PI);
const COUPE_WHEEL_SPIN=new THREE.Quaternion();
const COUPE_WHEEL_X=new V3(1,0,0);

function loadHeroCar(car,url){
 const id=car.heroAsset||'coupe';
 car.heroLoading=true;
 if(!heroModels.has(id)){
  const model=new Promise((resolve,reject)=>new THREE.GLTFLoader().load(url,resolve,undefined,reject))
   .then(gltf=>{
    let shell=gltf.scene.getObjectByName('VehicleShell')||gltf.scene.getObjectByName('CoupeShell');
    if(!shell&&gltf.scene.getObjectByName('Frame')){
     shell=new THREE.Group();shell.name='VehicleShell';
     for(const part of [...gltf.scene.children])if(part.name!=='WheelPrototype')shell.add(part);
    }
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
  shell.traverse(o=>{
   if(!o.isMesh)return;
   o.material=o.material.transparent?o.material.clone():coatVehicle(o.material,car.snowDepth);
   const finish=o.material.name||'';
   if(finish==='Laminated and tempered automotive glass'){
    o.material.color.copy(lin(0x3f5259));o.material.opacity=.47;o.material.metalness=.34;o.material.envMapIntensity=.76;
   }
   o.userData.lacquer=!o.material.transparent&&(id==='harbor-box-truck'?/enamel/i.test(finish):!/reference finishes|alloy|glass|tyre|inner body|acoustic lining|compartment seal/i.test(finish));
   if(car.repainted&&o.userData.lacquer)o.material.color.copy(lin(car.paintColor));
  });
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
  createVehicleAssembly(car,shell);streamVehicleComponents(car,true);
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
 shell.traverse(o=>{if(o.isMesh){if(o.userData.undented)o.geometry.dispose();if(o.material!==burntMat)o.material.dispose();}});
 car.hero=null;
 car.body3.visible=true;
}
