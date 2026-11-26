/* Ida Mercer's shift at the Wash House on the Verve shop row. */
globalThis.WashHouse = (() => {
 const id='AH-R0001',floor=.174,handleSpan=.620;
 const lines=[
  'That machine is free. Leave yourself a chair. A wet load weighs more than you think.',
  'Rafael wore my bank jacket to the ceremony. I keep a few good things behind the till.',
  'Missing a button? Take one from the card. You can sew it right here.'
 ];
 const collisionBones=[
  ['pelvis',.235],['spine_01',.22],['spine_03',.235],['neck_01',.135],['head',.17],
  ...['l','r'].flatMap(s=>[['upperarm',.105],['lowerarm',.09],['hand',.09],['thigh',.14],['calf',.12],['foot',.125]].map(([bone,r])=>[bone+'_'+s,r]))
 ];
 let site,actor,loading=false,retryAt=0,loadingError=null;
 function isShop(room){return room.row===RETAIL.laundry&&room.block.i===3&&room.block.j===5;}
 function shelfStock(room){
  const brands=[
   {name:'SURF',type:'LAUNDRY LIQUID',color:'#235969',paper:'#f4e5c7',ink:'#195468'},
   {name:'SOFT',type:'FABRIC RINSE',color:'#dfc9a6',paper:'#3d645e',ink:'#fff4d8'},
   {name:'FINE',type:'WOOL WASH',color:'#677773',paper:'#ebdcc4',ink:'#46514f'},
   {name:'SODA',type:'WASHING POWDER',color:'#c88158',paper:'#f9e9c9',ink:'#8d4939'}
  ];
  // Four ink panels occupy a single texture. Bottle labels wrap around the moulded face.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<brands.length;i++){
   const b=brands[i],x=i*256;ctx.save();ctx.translate(x,0);
   ctx.fillStyle=b.paper;ctx.fillRect(0,0,256,256);
   ctx.fillStyle=b.ink;ctx.fillRect(0,0,256,15);
   ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText('PIER SOAP WORKS',128,51);
   ctx.font='bold 67px sans-serif';ctx.fillText(b.name,128,128);
   ctx.beginPath();ctx.moveTo(19,157);ctx.bezierCurveTo(67,185,151,126,235,148);
   ctx.lineWidth=8;ctx.strokeStyle=b.ink;ctx.stroke();
   ctx.font='bold 18px sans-serif';ctx.fillText(b.type,128,209);
   ctx.font='15px sans-serif';ctx.fillText(i===3?'NET WT 500 g':'CONCENTRATE · 24 LOADS',128,235);ctx.restore();
  }
  const atlas=new THREE.CanvasTexture(canvas);atlas.encoding=THREE.sRGBEncoding;atlas.anisotropy=4;
  const shells=roomLightMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.53}),.53);
  const print=roomLightMaterial(new THREE.MeshStandardMaterial({map:atlas,roughness:.70}),.53);
  function stock(geometry,material,x,y,z,colour){
   if(colour){
    const c=new THREE.Color(colour).convertSRGBToLinear(),attrs=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<attrs.length;i+=3){attrs[i]=c.r;attrs[i+1]=c.g;attrs[i+2]=c.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(attrs,3));
   }
   geometry.translate(x,y,z);geometry.applyMatrix4(room.M);addGeo(material,geometry,false);
  }
  function label(geo,which,x,y,z){
   const uv=geo.attributes.uv;for(let n=0;n<uv.count;n++)uv.setX(n,(which+.015+uv.getX(n)*.97)/4);
   stock(geo,print,x,y,z);
  }
  function bottle(x,y,z,which,size){
   const b=brands[which],h=size,r=h*(which===0?.34:.285);
   const profile=[[.04,0],[.89,0],[.96,.03],[1,.12],[1,.59],[.95,.69],[.68,.82],[.32,.89],[.32,.92]];
   const body=new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius*r,height*h)),14);
   body.scale(1,1,.74);stock(body,shells,x,y,z,b.color);
   const cap=new THREE.CylinderGeometry(r*.39,r*.42,h*.10,14);cap.scale(1,1,.94);
   stock(cap,shells,x,y+h*.96,z,which===1?'#4d695f':'#e8ddc8');
   const seal=new THREE.CylinderGeometry(r*.38,r*.39,h*.019,14);stock(seal,shells,x,y+h*.908,z,'#dbccb6');
   const band=new THREE.CylinderGeometry(r*1.014,r*1.014,h*.39,10,1,true,-.871,1.742);
   band.scale(1,1,.74);label(band,which,x,y+h*.38,z);
   if(which===0){
    const handle=new THREE.TorusGeometry(r*.43,r*.082,5,14);
    handle.scale(.79,1.18,.85);stock(handle,shells,x+r*.84,y+h*.70,z,'#235969');
   }
  }
  function carton(x,y,z,w,h){
   const d=w*.63;
   stock(new THREE.BoxGeometry(w,h,d),shells,x,y+h*.5,z,brands[3].color);
   label(new THREE.PlaneGeometry(w*.96,h*.89),3,x,y+h*.48,z+d*.5+.0008);
   stock(new THREE.BoxGeometry(w*.90,.002,.003),shells,x,y+h+.001,z,'#8f7054');
  }
  const back=-room.depth+.333;
  const batches=[[0,4],[3,2],[1,3],[2,2],[0,3],[1,2],[3,3],[2,3]];
  for(let row=0;row<2;row++){
   let x=room.u0+.64,batch=0;
   while(x<room.u1-.73){
    const [which,count]=batches[(batch+3*row)%batches.length];
    for(let i=0;i<count&&x<room.u1-.73;i++){
     const y=(row?1.91:1.61)+.027,z=back+Math.sin(i*1.92+batch)*.032;
     const h=(row?.28:.245)*(which===2?.78:1);
     if(which===3)carton(x,y,z,h*.61,h*.91);else bottle(x,y,z,which,h);
     x+=h*.81+.019;
    }
    x+=(batch++%3===1?.48:.19);
   }
  }
 }
 function register(room,lighting){
  if(room.block.i!==3||room.block.j!==5)return;
  const mid=(room.u0+room.u1)/2;
  const point=(u,v)=>{const p=lpt(room.M,u,v);p.y=floor;return p;};
  const home=point(mid-1.25,3.75),washer=point(mid+1.4,4.67),guest=point(mid+.35,2.73);
  site={home,washer,guest,lighting,front:Math.atan2(room.M.elements[8],room.M.elements[10]),yaw:Math.atan2(home.x-guest.x,home.z-guest.z)};
 }
 function destination(){
  return site&&{id:'wash-house',name:'Wash House · Ida Mercer',x:site.guest.x,z:site.guest.z,y:floor,yaw:site.yaw};
 }
 // Short-range occlusion follows the points that actually approach the tile.
 // One transparent draw covers both shoes, knees, palms and the lowered torso.
 function contactShadow(bones){
  const patches=[];
  for(const side of ['l','r']){
   patches.push([bones['foot_'+side],bones['ball_'+side],.105,.075,.115,.19],
    [bones['calf_'+side],bones['thigh_'+side],.09,.08,.115,.13],
    [bones['hand_'+side],bones['middle_01_'+side],.05,.11,.078,.12]);
  }
  patches.push([bones.pelvis,bones.spine_01,.16,.48,.25,.32],[bones.spine_01,bones.spine_03,.14,.22,.24,.32]);
  const positions=new THREE.BufferAttribute(new Float32Array(patches.length*12),3);
  positions.setUsage(THREE.DynamicDrawUsage);
  const strengths=new THREE.BufferAttribute(new Float32Array(patches.length*4),1);
  strengths.setUsage(THREE.DynamicDrawUsage);
  const uv=[],indices=[];
  for(let k=0;k<patches.length;k++){
   uv.push(-1,-1,1,-1,1,1,-1,1);
   const j=k*4;indices.push(j,j+2,j+1,j,j+3,j+2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',positions);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('strength',strengths);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:'attribute float strength; varying float pressure; varying vec2 radial; void main(){pressure=strength;radial=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying float pressure; varying vec2 radial; void main(){float d=max(0.,1.-dot(radial,radial));gl_FragColor=vec4(.045,.038,.033,pressure*d*d);}'});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Ida | Floor contact';mesh.frustumCulled=false;
  scene.add(mesh);
  const from=new THREE.Vector3(),to=new THREE.Vector3();
  return function update(){
   for(let k=0;k<patches.length;k++){
    const [start,end,skin,fade,width,length]=patches[k];
    from.setFromMatrixPosition(start.matrixWorld);to.setFromMatrixPosition(end.matrixWorld);
    const t=k%3===0&&k<6?.55:k%3===2&&k<6?.64:.10;
    const cx=from.x+(to.x-from.x)*t,cz=from.z+(to.z-from.z)*t,cy=from.y+(to.y-from.y)*t;
    const dx=to.x-from.x,dz=to.z-from.z,mag=Math.hypot(dx,dz);
    const fx=mag>.0001?dx/mag:0,fz=mag>.0001?dz/mag:1;
    const gap=Math.max(0,cy-floor-skin),alpha=.57*(1-THREE.MathUtils.smoothstep(gap,0,fade));
    const spread=1+Math.min(.48,gap*1.6);
    for(let j=0;j<4;j++){
     const index=k*4+j,w=uv[index*2]*width*spread,h=uv[index*2+1]*length*spread;
     positions.setXYZ(index,cx+fz*w+fx*h,floor+.0025,cz-fx*w+fz*h);
     strengths.setX(index,alpha);
    }
   }
   positions.needsUpdate=true;strengths.needsUpdate=true;
  };
 }
 function hands(a){
  a.palms[0].getWorldPosition(a.left);a.palms[1].getWorldPosition(a.right);
  return a.midpoint.copy(a.left).lerp(a.right,.5);
 }
 function buildBasket(a){
  const work=a.clips.PickUp||a.clips.Laundry,action=a.mixer.clipAction(work);
  action.play();
  let low=Infinity,gripTime=0;
  for(let i=0;i<=32;i++){
   const t=work.duration*i/(a.clips.PickUp?32:64);
   a.mixer.setTime(t);
   const h=hands(a);
   if(h.y<low){low=h.y;gripTime=t;}
  }
  a.mixer.setTime(gripTime);
  const at=hands(a).clone(),dx=a.left.x-a.right.x,dz=a.left.z-a.right.z;
  const width=handleSpan-.032,depth=width*.66,height=Math.max(.10,at.y-floor-.016);
  const profiles=[],handles=[],wire=new THREE.MeshStandardMaterial({color:0x578782,metalness:.24,roughness:.5});
  const end=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function bar(p,q,r,parts=profiles){
   delta.subVectors(q,p);
   const g=new THREE.CylinderGeometry(r,r,delta.length(),5);
   g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize())));
   end.copy(p).lerp(q,.5);g.translate(end.x,end.y,end.z);parts.push(g);
  }
  function outline(i,t){
   const phase=Math.PI*2*i/24,c=Math.cos(phase),s=Math.sin(phase);
   return new THREE.Vector3(Math.sign(c)*Math.pow(Math.abs(c),.65)*width*.5*(.8+.2*t),-height*(1-t)-.023*t,
    Math.sign(s)*Math.pow(Math.abs(s),.65)*depth*.5*(.8+.2*t));
  }
  for(let i=0;i<24;i++){
   for(let j=0;j<=4;j++)bar(outline(i,j/4),outline(i+1,j/4),j===4?.005:.0035);
   bar(outline(i,0),outline(i,1),.0033);
  }
  const basket=new THREE.Group();a.grips=[];
  for(const sign of [1,-1]){
   const x=sign*handleSpan*.5,marker=new THREE.Object3D();marker.name=sign>0?'Ida basket left grip':'Ida basket right grip';
   marker.position.x=x;basket.add(marker);a.grips.push(marker);
   const fore=new THREE.Vector3(x,0,.065),aft=new THREE.Vector3(x,0,-.065);
   bar(fore,aft,.0105,handles);
   for(const tip of [fore,aft]){
    const mount=new THREE.Vector3(tip.x-sign*.021,-.024,tip.z*1.14);
    bar(tip,mount,.006,handles);
    const cap=new THREE.SphereGeometry(.0105,8,5);cap.translate(tip.x,tip.y,tip.z);handles.push(cap);
   }
  }
  const sleeves=new THREE.Mesh(mergeGeos(handles),new THREE.MeshStandardMaterial({color:0x123f46,roughness:.85}));
  sleeves.name='Ida basket moulded handles';handles.forEach(g=>g.dispose());basket.add(sleeves);sleeves.castShadow=sleeves.receiveShadow=true;
  const mesh=new THREE.Mesh(mergeGeos(profiles),wire);
  profiles.forEach(g=>g.dispose());basket.add(mesh);mesh.castShadow=mesh.receiveShadow=true;
  for(const [layer,color] of [[0,0xd5c8ae],[1,0x7e969b]]){
   const towel=new THREE.Mesh(new THREE.BoxGeometry(width*.65,.037,depth*.66),new THREE.MeshStandardMaterial({color,roughness:.97}));
   towel.position.set(width*(layer?-.024:.024),-height+.021+layer*.038,0);towel.rotation.y=layer?.12:-.07;
   towel.receiveShadow=towel.castShadow=true;basket.add(towel);
  }
  scene.add(basket);basket.position.copy(at);basket.rotation.y=Math.atan2(-dz,dx);
  basket.name='Ida Mercer | Laundry basket';
  const basketBody=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:PH.mat.prop,
   collisionFilterGroup:PHYS_GROUP.prop,collisionFilterMask:PHYS_GROUP.car|PHYS_GROUP.prop|PHYS_GROUP.ragdoll});
  basketBody.addShape(new CANNON.Box(new CANNON.Vec3(handleSpan*.5+.011,height*.5,depth*.5)),new CANNON.Vec3(0,-height*.5,0));
  PH.w.addBody(basketBody);
  a.basket=basket;a.basketBody=basketBody;a.basketSize=new THREE.Vector3(handleSpan+.022,height,depth);
  a.basketRest=at;a.liveYaw=a.basketYaw=basket.rotation.y;a.grip=gripTime;
  a.gripOffset=at.clone().sub(a.root.position).applyAxisAngle(up,-a.root.rotation.y);
  a.basketAt={station:'home',point:site.home.clone(),yaw:site.front};
  a.mixer.stopAllAction();
 }
 function lightResident(model,ambient){
  const materials=new Set();
  model.traverse(node=>{
   if(node.isMesh)for(const mat of Array.isArray(node.material)?node.material:[node.material])materials.add(mat);
  });
  for(const mat of materials){
   if(!mat.isMeshStandardMaterial)continue;
   for(const slot of ['map','normalMap','roughnessMap'])if(mat[slot])mat[slot].anisotropy=4;
   const inherited=mat.onBeforeCompile,programKey=mat.customProgramCacheKey();
   mat.onBeforeCompile=function(shader,renderer){
    inherited.call(this,shader,renderer);
    shader.uniforms.shopAmbient=ambient;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float shopAmbient;')
     .replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=shopAmbient;reflectedLight.indirectSpecular*=mix(.32,1.,shopAmbient);');
   };
   mat.customProgramCacheKey=()=>programKey+'-resident-sky-exposure';
  }
 }
 function install(gltf){
  const clips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,clip]));
  const workClips=['PickUp','Carry','SetDown'];
  if(workClips.some(name=>clips[name])&&!workClips.every(name=>clips[name]))throw Error('Ida needs all three basket clips');
  for(const name of ['Idle','Walk','Talk','Laundry','Recover'])if(!clips[name])throw Error('Ida is missing '+name);
  const root=new THREE.Group(),model=gltf.scene,bones={},ambient={value:1};
  lightResident(model,ambient);
  model.traverse(node=>{
   if(node.isBone)bones[node.name]=node;
   if(node.isMesh){node.receiveShadow=true;node.castShadow=!/Combed.scalp|Loose.temple/i.test(node.name);node.frustumCulled=false;}
  });
  for(const [name] of [...collisionBones,['middle_01_l'],['middle_01_r']])if(!bones[name])throw Error('Ida is missing joint '+name);
  root.add(model);root.name='Ida Mercer | Wash House';root.userData.personId=id;
  root.position.copy(site.home);root.rotation.y=site.front;
  const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:PH.mat.prop,
   collisionFilterGroup:PHYS_GROUP.prop,collisionFilterMask:PHYS_GROUP.car|PHYS_GROUP.prop|PHYS_GROUP.ragdoll});
  model.updateWorldMatrix(true,true);
  const jointPoints=new Map();
  function joint(name){
   if(!jointPoints.has(name))jointPoints.set(name,{bone:bones[name],point:new THREE.Vector3()});
   return jointPoints.get(name).point;
  }
  const volumes=[];
  function volume(name,r,end=name,t=0){
   body.addShape(new CANNON.Sphere(r));
   volumes.push({r,start:joint(name),end:joint(end),t,center:new THREE.Vector3()});
  }
  for(const [name,r] of collisionBones)volume(name,r);
  // Overlapping samples fill the gaps between joint centers as arms and legs flex.
  for(const side of ['l','r']){
   const spans=[['upperarm','lowerarm',.095,2],['lowerarm','hand',.077,2],['hand','middle_01',.065,1],
    ['thigh','calf',.125,3],['calf','foot',.098,3],['foot','ball',.088,2]];
   for(const [from,to,r,steps] of spans)for(let j=1;j<=steps;j++)volume(from+'_'+side,r,to+'_'+side,j/(steps+1));
  }
  const a={root,clips,ambient,mixer:new THREE.AnimationMixer(model),body,volumes,jointPoints,palms:[bones.middle_02_l,bones.middle_02_r],
   arms:['l','r'].map(side=>({upper:bones['upperarm_'+side],lower:bones['lowerarm_'+side],end:bones['hand_'+side],
    jointPose:[new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion()]})),
   left:new THREE.Vector3(),right:new THREE.Vector3(),midpoint:new THREE.Vector3(),mode:null,line:0,remaining:0,station:'home'};
  a.secondary = globalThis.ResidentSecondary?.bind(model, bones);
  a.contactShadow=contactShadow(bones);
  buildBasket(a);
  a.nextStation='washer';a.gait=measureGait(a,model,bones);a.turn=0;
  scene.add(root);PH.w.addBody(body);actor=a;play('Idle',2.8);syncContacts();
  body.addEventListener('collide',e=>{
   if(Math.abs(e.contact.getImpactVelocityAlongNormal())>3.8)fall();
  });
  globalThis.asphaltAgentEvent?.('residentReady',{personId:id,shop:'Wash House'});
 }
 function load(){
  if(loading||actor||!site||performance.now()<retryAt)return;
  loading=true;
  new Promise((resolve,reject)=>new THREE.GLTFLoader().load('assets/residents/ida-mercer.glb',resolve,undefined,reject)).then(install).catch(e=>{
   retryAt=performance.now()+10000;loadingError=String(e);console.warn('Wash House resident',e);
  }).finally(()=>{loading=false;});
 }
 function play(name,seconds){
  const a=actor,previous=a.action,current=a.mixer.clipAction(a.clips[name]);
  current.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
  const loop=name==='Idle'||name==='Walk'||name==='Carry';
  current.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
  current.clampWhenFinished=!loop;
  if(previous&&previous!==current){
   previous.paused=false;
   previous.crossFadeTo(current,.18,false);
  }
  a.action=current;a.mode=name;a.remaining=seconds??a.clips[name].duration;
  globalThis.asphaltAgentEvent?.('residentActivity',{personId:id,activity:name});
 }
 function syncContacts(){
  const a=actor;a.root.updateMatrixWorld(true);a.body.position.copy(a.root.position);
  for(const {bone,point} of a.jointPoints.values())point.setFromMatrixPosition(bone.matrixWorld);
  for(let i=0;i<a.volumes.length;i++){
   const v=a.volumes[i];v.center.copy(v.start).lerp(v.end,v.t);
   a.body.shapeOffsets[i].set(v.center.x-a.root.position.x,v.center.y-a.root.position.y,v.center.z-a.root.position.z);
  }
  a.contactShadow();
  a.body.updateBoundingRadius();a.body.aabbNeedsUpdate=true;
  PH.w.broadphase.dirty=true;
 }
 // Sample the fitted soles once. Drive travel from the supporting shoe over each
 // part of the stride so a shorter step also covers less ground on the tile.
 function measureGait(a,model,bones){
  const shoes=model.getObjectByName('Cloth_shoes'),clip=a.clips.Walk;
  const count=Math.round(clip.duration*24),speed=new Float32Array(count).fill(1);
  const stance=[new Uint8Array(count),new Uint8Array(count)];
  const legs=['l','r'].map(side=>({
   upper:bones['thigh_'+side],lower:bones['calf_'+side],end:bones['foot_'+side],
   anchor:new THREE.Vector3(),jointPose:[new THREE.Quaternion(),new THREE.Quaternion(),new THREE.Quaternion()],indices:[]
  }));
  if(!shoes)return {speed,stance,legs,shoes:null};
  const mesh=shoes.geometry,idx=mesh.attributes.skinIndex,weights=mesh.attributes.skinWeight;
  for(let i=0;i<mesh.attributes.position.count;i+=5){
   const influences=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
   const joint=[idx.getX(i),idx.getY(i),idx.getZ(i),idx.getW(i)][influences.indexOf(Math.max(...influences))];
   legs[shoes.skeleton.bones[joint].name.endsWith('_l')?0:1].indices.push(i);
  }
  const action=a.mixer.clipAction(clip).reset().play();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
  const forward=new THREE.Vector3(Math.sin(a.root.rotation.y),0,Math.cos(a.root.rotation.y));
  let previous;
  for(let k=0;k<=count;k++){
   a.mixer.setTime(k/count*clip.duration);a.root.updateMatrixWorld(true);
   const sample=legs.map(leg=>leg.indices.map(i=>shoes.boneTransform(i,new THREE.Vector3()).applyMatrix4(shoes.matrixWorld)));
   if(previous){
    const rates=[];
    for(let f=0;f<legs.length;f++){
     let support=0;
     for(let j=0;j<sample[f].length;j++){
      const p=sample[f][j],q=previous[f][j];
      if(p.y>floor+.014||q.y>floor+.014)continue;
      const rate=((q.x-p.x)*forward.x+(q.z-p.z)*forward.z)*count/clip.duration;
      if(rate>.22&&rate<2.2){rates.push(rate);support++;}
     }
     stance[f][k-1]=support>0?1:0;
    }
    if(rates.length){rates.sort((u,v)=>u-v);speed[k-1]=rates[Math.floor(rates.length*.5)];}
   }
   previous=sample;
  }
  a.mixer.stopAllAction();
  return {speed,stance,legs,shoes};
 }
 const vScratch=Array.from({length:9},()=>new THREE.Vector3()),qScratch=Array.from({length:3},()=>new THREE.Quaternion());
 function restorePose(chains){
  for(const chain of chains)[chain.upper,chain.lower,chain.end].forEach((b,j)=>b.quaternion.copy(chain.jointPose[j]));
 }
 function savePose(chain){
  [chain.upper,chain.lower,chain.end].forEach((b,j)=>chain.jointPose[j].copy(b.quaternion));
 }
 function restoreLegs(a){
  if(!a.gait.adjusted)return;
  restorePose(a.gait.legs);
  a.gait.adjusted=false;
 }
 function aimBone(bone,from,to){
  const q=qScratch[0].setFromUnitVectors(from.normalize(),to.normalize());
  q.multiply(bone.getWorldQuaternion(qScratch[1]));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(qScratch[2]).invert().multiply(q));
  bone.updateWorldMatrix(false,true);
 }
 function moveEffector(chain,delta){
  const [hip,knee,foot,goal,axis,bend,kneeGoal,u,v]=vScratch;
  chain.upper.getWorldPosition(hip);chain.lower.getWorldPosition(knee);chain.end.getWorldPosition(foot);
  goal.copy(foot).add(delta);
  const original=chain.end.getWorldQuaternion(chain.endAim||(chain.endAim=new THREE.Quaternion()));
  const upper=hip.distanceTo(knee),lower=knee.distanceTo(foot);
  const distance=Math.min(upper+lower-.0001,Math.max(Math.abs(upper-lower)+.0001,hip.distanceTo(goal)));
  axis.subVectors(goal,hip).normalize();
  bend.subVectors(knee,hip);bend.addScaledVector(axis,-bend.dot(axis));
  if(bend.lengthSq()<.000001)return;
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance);
  kneeGoal.copy(hip).addScaledVector(axis,along).addScaledVector(bend.normalize(),Math.sqrt(Math.max(0,upper*upper-along*along)));
  aimBone(chain.upper,u.subVectors(knee,hip),v.subVectors(kneeGoal,hip));
  chain.lower.getWorldPosition(knee);chain.end.getWorldPosition(foot);
  aimBone(chain.lower,u.subVectors(foot,knee),v.subVectors(goal,knee));
  chain.end.quaternion.copy(chain.end.parent.getWorldQuaternion(qScratch[0]).invert().multiply(original));
  chain.end.updateWorldMatrix(false,true);
 }
 function plantFeet(a,dt){
  const {shoes,legs,stance}=a.gait;if(!shoes)return;
  const walking=a.mode==='Walk'||a.mode==='Carry',pivot=Math.abs(a.turn)>.001;
  if(!walking&&!pivot){for(const leg of legs){leg.pin=null;leg.correction?.set(0,0,0);}return;}
  a.root.updateMatrixWorld(true);
  const liftPhase=(a.pivotPhase||0);a.pivotPhase=pivot&&!walking?(liftPhase+dt*2.6)%2:0;
  for(let f=0;f<legs.length;f++){
   const leg=legs[f];savePose(leg);
   const marker=leg.marker||(leg.marker=new THREE.Vector3()),offset=leg.offset||(leg.offset=new THREE.Vector3());
   let low=Infinity,k=-1;
   for(const i of leg.indices){
    shoes.boneTransform(i,marker).applyMatrix4(shoes.matrixWorld);
    if(marker.y<low){low=marker.y;k=i;}
   }
   const lifted=pivot&&!walking&&Math.floor(a.pivotPhase)===f;
   const sample=Math.floor(a.action.time/a.action.getClip().duration*stance[f].length)%stance[f].length;
   const grounded=!walking||stance[f][sample]!==0;
   if(!lifted&&grounded&&low<floor+.024&&leg.pin==null){
    leg.pin=k;shoes.boneTransform(k,leg.anchor).applyMatrix4(shoes.matrixWorld);
   }
   if(lifted||!grounded||low>floor+.038)leg.pin=null;
   offset.set(0,0,0);
   if(leg.pin!=null){
    shoes.boneTransform(leg.pin,marker).applyMatrix4(shoes.matrixWorld);
    offset.subVectors(leg.anchor,marker);offset.y=Math.max(0,floor-low);
    offset.clampLength(0,.135);
   }else if(lifted){
    offset.y=.036*Math.sin(Math.PI*(a.pivotPhase%1));
   }
   const correction=leg.correction||(leg.correction=new THREE.Vector3());
   offset.sub(correction).clampLength(0,dt*.55);correction.add(offset);
   if(correction.lengthSq()>1e-8)moveEffector(leg,correction);
  }
  a.gait.adjusted=true;
 }
 function turnToward(a,yaw,dt){
  const d=wrapA(yaw-a.root.rotation.y);
  a.turn=Math.sign(d)*Math.min(Math.abs(d),1.85*dt,Math.max(.34,Math.abs(d)*6)*dt);
  a.root.rotation.y+=a.turn;
  return Math.abs(d-a.turn)<.025;
 }
 function beginWalk(to,loaded=false){
  const a=actor,start=a.root.position.clone(),end=to.point||site[to];
  if(start.distanceTo(end)<.06){arrive(a,to,loaded);return;}
  const endYaw=to.point?to.yaw:site.front+(to==='washer'?Math.PI:0);
  const reach=Math.min(.71,start.distanceTo(end)*.32),heading=a.root.rotation.y;
  const ahead=start.clone().add(new THREE.Vector3(Math.sin(heading)*reach,0,Math.cos(heading)*reach));
  const behind=end.clone().sub(new THREE.Vector3(Math.sin(endYaw)*reach,0,Math.cos(endYaw)*reach));
  const path=new THREE.CubicBezierCurve3(start,ahead,behind,end.clone());
  a.route={path,to,endYaw,length:path.getLength(),distance:0,age:0};
  a.station=null;play(loaded?'Carry':'Walk',Infinity);
 }
 function arrive(a,to,loaded){
  a.station=to.point?to.station:to;a.route=null;
  if(loaded){play('SetDown');return;}
  if(to.point){a.aim=to.yaw;a.needsPickup=true;}
  play('Idle',to.point ? .3 : 1.5);
 }
 function advanceWalk(a,p,dt){
  const r=a.route,clip=a.action.getClip(),t=a.action.time/clip.duration;
  const speed=a.gait.speed[Math.floor(t*a.gait.speed.length)%a.gait.speed.length];
  const pace=Math.min(1,.58+r.age*1.1,.55+(r.length-r.distance)*1.2)*(a.mode==='Carry'?.90:1);
  const next=Math.min(r.length,r.distance+dt*speed*pace);
  const position=r.path.getPointAt(next/r.length),direction=r.path.getTangentAt(next/r.length);
  const blocked=Math.abs(p.y-floor)<1.6&&Math.hypot(p.x-position.x,p.z-position.z)<.73&&position.distanceToSquared(p)<a.root.position.distanceToSquared(p);
  a.action.paused=blocked;if(blocked)return;
  a.action.setEffectiveTimeScale(pace);r.age+=dt;r.distance=next;a.root.position.copy(position);
  turnToward(a,Math.atan2(direction.x,direction.z),dt);
  if(next===r.length&&Math.abs(wrapA(r.endYaw-a.root.rotation.y))<.025)arrive(a,r.to,a.mode==='Carry');
 }
 function placeBasket(a){
  a.held=false;a.basketRest.copy(a.basket.position);a.basketRest.y=floor+a.basketSize.y+.016;
  a.basketYaw=a.liveYaw;
  a.basketAt={point:a.root.position.clone(),yaw:a.root.rotation.y,station:a.station};
 }
 function fitHandles(a){
  const mid=hands(a),horizontal=a.left.clone().sub(a.right);
  if(horizontal.lengthSq()<.001)return;
  horizontal.normalize();
  const front=new THREE.Vector3(-horizontal.z,0,horizontal.x).normalize();
  const up=new THREE.Vector3().crossVectors(front,horizontal);
  a.basket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(horizontal,up,front));
  a.liveYaw=Math.atan2(-horizontal.z,horizontal.x);
  a.basket.position.copy(mid);
  const bottom=mid.y-a.basketSize.y*up.y-Math.abs(horizontal.y)*a.basketSize.x*.4;
  a.basket.position.y+=Math.max(0,floor+.005-bottom);
  a.basket.updateWorldMatrix(true,true);
  for(let i=0;i<a.arms.length;i++){
   const chain=a.arms[i];savePose(chain);
   const desired=a.grips[i].getWorldPosition(new THREE.Vector3());
   // The closed middle finger hooks around the tube. Its PIP joint sits just inside the span.
   desired.addScaledVector(horizontal,i===0?-.013:.013);
   const finger=a.palms[i].getWorldPosition(new THREE.Vector3());
   moveEffector(chain,desired.sub(finger));
  }
  a.adjustedArms=true;
 }
 function updateBasket(a,dt){
  const t=a.action.time;
  if(a.mode==='PickUp'&&t>=a.grip)a.held=true;
  const legacyLift=a.mode==='Laundry'&&t>=a.grip&&t<=a.clips.Laundry.duration-a.grip;
  if(a.held||legacyLift){
   fitHandles(a);
   if(a.mode==='SetDown'&&t>=a.clips.SetDown.duration-a.grip)placeBasket(a);
  }else if(a.drop){
   a.drop.velocity+=9.81*dt;
   a.basket.position.y=Math.max(a.basketRest.y,a.basket.position.y-a.drop.velocity*dt);
   if(a.basket.position.y===a.basketRest.y)a.drop=null;
  }else{a.basket.position.copy(a.basketRest);a.basket.rotation.set(0,a.basketYaw,0);a.liveYaw=a.basketYaw;}
  a.basketBody.position.copy(a.basket.position);
  a.basketBody.quaternion.copy(a.basket.quaternion);a.basketBody.aabbNeedsUpdate=true;
 }
 function planShift(a){
  if(a.route){beginWalk(a.route.to);return;}
  if(!a.clips.Carry){
   if(a.station==='home'&&!a.emptyReturn){a.emptyReturn=true;play('Laundry');}
   else{a.emptyReturn=false;beginWalk(a.station==='home'?'washer':'home');}
   return;
  }
  if(a.emptyReturn){a.emptyReturn=false;beginWalk('home');return;}
  if(a.root.position.distanceTo(a.basketAt.point)>.06){beginWalk(a.basketAt);return;}
  a.aim=a.basketAt.yaw;a.needsPickup=true;
 }
 function tick(dt){
  if(!site)return;
  const p=player.car?.pos||player.pos;
  if(Math.hypot(p.x-site.home.x,p.z-site.home.z)>48)return;
  if(!actor){load();return;}
  const a=actor;a.turn=0;restoreLegs(a);
  if(a.adjustedArms){restorePose(a.arms);a.adjustedArms=false;}
  if(a.mode==='Walk'||a.mode==='Carry')advanceWalk(a,p,dt);
  else if(a.mode==='Idle'&&a.needsPickup){
   if(turnToward(a,a.aim,dt)){a.needsPickup=false;play('PickUp');}
  }else{
   if(a.mode==='Talk')turnToward(a,Math.atan2(p.x-a.root.position.x,p.z-a.root.position.z),dt);
   if((a.remaining-=dt)<=.00001){
    if(a.mode==='down')play('Recover');
    else if(a.mode==='falling'){a.action.time=a.clips.Fall?a.clips.Fall.duration:0;a.action.paused=true;a.mode='down';a.remaining=7;}
    else if(a.mode==='PickUp'){
     a.held=true;
     if(a.waitingCustomer)play('SetDown');else beginWalk(a.nextStation,true);
    }else if(a.mode==='SetDown'){
     if(a.held)placeBasket(a);
     if(a.station===a.nextStation){a.emptyReturn=a.station==='washer';a.nextStation=a.station==='home'?'washer':'home';}
     if(a.waitingCustomer){a.waitingCustomer=false;if(inReach(p,2.25))talk(p);else play('Idle',1);}
     else play('Idle',2.2);
    }else if(a.mode==='Laundry'&&a.waitingCustomer){a.waitingCustomer=false;if(inReach(p,2.25))talk(p);else planShift(a);}
    else if(a.mode==='Talk'||a.mode==='Recover')play('Idle',.8);
    else planShift(a);
   }
  }
  if(site.lighting)a.ambient.value=roomLightAt(site.lighting,a.root.position);
  a.mixer.update(dt);plantFeet(a,dt);updateBasket(a,dt);syncContacts();a.secondary?.update(dt);
 }
 function pushBasket(a,p,r,y){
  const at=a.basket.position,size=a.basketSize;
  if(y+.08>at.y||y+1.72<at.y-size.y)return null;
  const c=Math.cos(a.liveYaw),s=Math.sin(a.liveYaw);
  const dx=p.x-at.x,dz=p.z-at.z,x=c*dx-s*dz,z=s*dx+c*dz;
  const ex=x-THREE.MathUtils.clamp(x,-size.x*.5,size.x*.5),ez=z-THREE.MathUtils.clamp(z,-size.z*.5,size.z*.5);
  const d=Math.hypot(ex,ez);if(d>=r)return null;
  let nx,nz,depth;
  if(d>.00001){nx=ex/d;nz=ez/d;depth=r-d;}
  else if(size.x*.5-Math.abs(x)<size.z*.5-Math.abs(z)){nx=x<0?-1:1;nz=0;depth=r+size.x*.5-Math.abs(x);}
  else{nx=0;nz=z<0?-1:1;depth=r+size.z*.5-Math.abs(z);}
  const normal=[c*nx+s*nz,-s*nx+c*nz];p.x+=normal[0]*depth;p.z+=normal[1]*depth;return normal;
 }
 function basketRay(a,start,delta,pad){
  if(!delta.lengthSq())return 1;
  const at=a.basket.position,size=a.basketSize,c=Math.cos(a.liveYaw),s=Math.sin(a.liveYaw);
  const dx=start.x-at.x,dz=start.z-at.z;
  const origins=[c*dx-s*dz,start.y-at.y+size.y*.5,s*dx+c*dz],dirs=[c*delta.x-s*delta.z,delta.y,s*delta.x+c*delta.z];
  const half=[size.x*.5+pad,size.y*.5+pad,size.z*.5+pad];let near=0,far=1;
  for(let k=0;k<3;k++){
   if(Math.abs(dirs[k])<1e-9){if(Math.abs(origins[k])>half[k])return 1;continue;}
   const a=(-half[k]-origins[k])/dirs[k],b=(half[k]-origins[k])/dirs[k];
   near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return 1;
  }
  return near;
 }
 function push(p,r,y){
  if(!actor)return null;
  let normal=pushBasket(actor,p,r,y);
  if(Math.abs(p.x-actor.root.position.x)>r+2||Math.abs(p.z-actor.root.position.z)>r+2)return normal;
  for(let pass=0;pass<2;pass++)for(const v of actor.volumes){
   const c=v.center;
   if(y+.08>c.y+v.r||y+1.72<c.y-v.r)continue;
   const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),reach=r+v.r;
   if(d>=reach)continue;
   const nx=d>.00001?dx/d:1,nz=d>.00001?dz/d:0;
   p.x+=nx*(reach-d);p.z+=nz*(reach-d);normal=[nx,nz];
  }
  return normal;
 }
 function bodyRay(start,delta,pad){
  if(!actor)return 1;
  const A=delta.lengthSq();if(!A)return 1;
  const p=actor.root.position,margin=2+pad;
  if(p.x<Math.min(start.x,start.x+delta.x)-margin||p.x>Math.max(start.x,start.x+delta.x)+margin||
     p.z<Math.min(start.z,start.z+delta.z)-margin||p.z>Math.max(start.z,start.z+delta.z)+margin)return 1;
  let best=1;
  for(const v of actor.volumes){
   const dx=start.x-v.center.x,dy=start.y-v.center.y,dz=start.z-v.center.z;
   const B=dx*delta.x+dy*delta.y+dz*delta.z,C=dx*dx+dy*dy+dz*dz-(v.r+pad)**2;
   if(C<=0)return 0;
   const det=B*B-A*C;if(det<0)continue;
   const t=(-B-Math.sqrt(det))/A;
   if(t>=0&&t<best)best=t;
  }
  return best;
 }
 function ray(start,delta,pad){
  if(!actor)return 1;
  return Math.min(bodyRay(start,delta,pad),basketRay(actor,start,delta,pad));
 }
 function inReach(p,range,face=false){
  if(!actor)return false;
  const at=actor.root.position,dx=at.x-p.x,dz=at.z-p.z;
  return Math.hypot(dx,dz)<=range&&Math.abs(at.y-p.y)<1&&(!face||Math.abs(wrapA(Math.atan2(dx,dz)-player.yaw))<1.1)
   &&rayWorld(p.x,p.z,at.x,at.z,p.y+1,at.y+1,0,true,true)>=1;
 }
 function fall(){
  if(!actor||['falling','down','Recover'].includes(actor.mode))return;
  const a=actor;a.waitingCustomer=false;a.needsPickup=false;a.route=null;
  if(a.held){
   placeBasket(a);a.drop={velocity:0};
   a.basketAt.point.copy(a.basketRest).sub(a.gripOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),a.root.rotation.y));
   a.basketAt.point.y=floor;a.basketAt.station=null;
  }
  if(a.clips.Fall){play('Fall');}
  else{play('Recover');a.action.time=a.clips.Recover.duration;a.action.setEffectiveTimeScale(-3.4);a.remaining=a.action.time/3.4;}
  a.mode='falling';
 }
 function injured(handContact){
  if(!actor||actor.mode==='down'||actor.mode==='falling')return false;
  fall();
  registerIncident('Assault',actor.root.position,{victim:{personId:id,pos:actor.root.position},handContact});
  crime(8,actor.root.position.x,actor.root.position.z);return true;
 }
 function hit(){
  return inReach(player.pos,2.1,true)&&injured(true);
 }
 function contactTrace(start,end){
  if(!actor)return;
  const delta=end.clone().sub(start),t=bodyRay(start,delta,.025);
  if(t>=1||basketRay(actor,start,delta,.025)<t)return;
  const wall=rayWorld(start.x,start.z,end.x,end.z,start.y,end.y,0,true,true);
  if(t<=wall)injured(false);
 }
 function interaction(p){
  if(!inReach(p,2.25))return null;
  const a=actor;
  if(a.mode==='down')return {label:'HELP IDA UP',fn(){play('Recover');toast('Ida · “Give me a second. I’ve got it.”',2500);}};
  if(['falling','Recover'].includes(a.mode))return null;
  return {label:'TALK TO IDA',fn(){
   if(['PickUp','Carry','SetDown'].includes(a.mode)){
    a.waitingCustomer=true;
    if(a.mode==='Carry'){a.route=null;play('SetDown');}
    toast('Ida Mercer · “One second, let me set this down.”',1700);
   }else if(a.mode==='Laundry'&&a.action.time>=a.grip&&a.action.time<=a.clips.Laundry.duration-a.grip){
    a.waitingCustomer=true;toast('Ida Mercer · “One second, let me set this down.”',1700);
   }else talk(p);
  }};
 }
 function talk(p){
  const a=actor,at=a.root.position;
  a.needsPickup=false;
  play('Talk',Math.max(a.clips.Talk.duration,3.75));
  const text=cityPowerAt(at.x,at.z)?lines[a.line++%lines.length]:'Stay where I can hear you. I’ll get the caretaker.';
  toast('Ida Mercer · “'+text+'”',3600);globalThis.asphaltAgentEvent?.('dialogue',{personId:id,text});
 }
 function portrait(camera){
  if(!actor||actor.mode!=='Talk'||player.car||state!=='play'||caseCamera.enabled||!inReach(player.pos,2.4))return;
  const a=actor.root.position,d=Math.hypot(player.pos.x-a.x,player.pos.z-a.z);
  if(d<.01)return;
  const nx=(player.pos.x-a.x)/d,nz=(player.pos.z-a.z)/d;
  const ex=a.x+nx*1.5-nz*.34,ez=a.z+nz*1.5+nx*.34,ey=a.y+1.6;
  const t=Math.max(.28,rayWorld(a.x,a.z,ex,ez,ey,ey,0,true,true)-.05);
  camera.position.set(a.x+(ex-a.x)*t,ey,a.z+(ez-a.z)*t);camera.lookAt(a.x,a.y+1.39,a.z);
 }
 function record(){
  if(!actor)return [];
  const {x,y,z}=actor.root.position;
  return [{id,personId:id,name:'Ida Mercer',team:'civilian',kind:'Laundromat operator',position:{x,y,z},
   yaw:actor.root.rotation.y,activity:actor.mode,animationTime:actor.action.time,clip:actor.action.getClip().name,basketHeld:!!actor.held,colliders:actor.volumes.length}];
 }
 return {isShop,shelfStock,register,destination,tick,push,ray,hit,contactTrace,interaction,portrait,record,get error(){return loadingError;}};
})();
