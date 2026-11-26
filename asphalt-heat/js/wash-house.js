/* Ida Mercer's shift at the Wash House on the Verve shop row. */
globalThis.WashHouse = (() => {
 const id='AH-R0001', floor=.174;
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
 function contactShadow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(35,29,27,.52)');g.addColorStop(.36,'rgba(35,29,27,.25)');g.addColorStop(1,'rgba(35,29,27,0)');
  c.fillStyle=g;c.fillRect(0,0,64,64);
  const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.89,.68),m);shadow.rotation.x=-Math.PI/2;shadow.position.y=.005;return shadow;
 }
 function hands(a){
  a.palms[0].getWorldPosition(a.left);a.palms[1].getWorldPosition(a.right);
  return a.midpoint.copy(a.left).lerp(a.right,.5);
 }
 function buildBasket(a){
  const work=a.clips.Laundry,action=a.mixer.clipAction(work);
  action.play();
  let low=Infinity,gripTime=0;
  for(let i=0;i<=32;i++){
   const t=work.duration*i/64;
   a.mixer.setTime(t);
   const h=hands(a);
   if(h.y<low){low=h.y;gripTime=t;}
  }
  a.mixer.setTime(gripTime);
  const at=hands(a).clone(),dx=a.left.x-a.right.x,dz=a.left.z-a.right.z;
  const width=Math.max(.27,Math.hypot(dx,dz)),depth=width*.64,height=Math.max(.10,at.y-floor-.016);
  const profiles=[],wire=new THREE.MeshStandardMaterial({color:0x578782,metalness:.24,roughness:.5});
  const end=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function bar(p,q,r){
   delta.subVectors(q,p);
   const g=new THREE.CylinderGeometry(r,r,delta.length(),5);
   g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize())));
   end.copy(p).lerp(q,.5);g.translate(end.x,end.y,end.z);profiles.push(g);
  }
  function outline(i,t){
   const phase=Math.PI*2*i/24,c=Math.cos(phase),s=Math.sin(phase);
   return new THREE.Vector3(Math.sign(c)*Math.pow(Math.abs(c),.65)*width*.5*(.8+.2*t),-height*(1-t),
    Math.sign(s)*Math.pow(Math.abs(s),.65)*depth*.5*(.8+.2*t));
  }
  for(let i=0;i<24;i++){
   for(let j=0;j<=4;j++)bar(outline(i,j/4),outline(i+1,j/4),j===4?.005:.0035);
   bar(outline(i,0),outline(i,1),.0033);
  }
  const basket=new THREE.Group(),mesh=new THREE.Mesh(mergeGeos(profiles),wire);
  profiles.forEach(g=>g.dispose());basket.add(mesh);mesh.castShadow=mesh.receiveShadow=true;
  for(const [layer,color] of [[0,0xd5c8ae],[1,0x7e969b]]){
   const towel=new THREE.Mesh(new THREE.BoxGeometry(width*.65,.037,depth*.66),new THREE.MeshStandardMaterial({color,roughness:.97}));
   towel.position.set(width*(layer?-.024:.024),-height+.021+layer*.038,0);towel.rotation.y=layer?.12:-.07;
   towel.receiveShadow=towel.castShadow=true;basket.add(towel);
  }
  scene.add(basket);basket.position.copy(at);basket.rotation.y=Math.atan2(-dz,dx);
  a.basket=basket;a.basketRest=at;a.basketYaw=basket.rotation.y;a.grip=gripTime;
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
  for(const name of ['Idle','Walk','Talk','Laundry','Recover'])if(!clips[name])throw Error('Ida is missing '+name);
  const root=new THREE.Group(),model=gltf.scene,bones={},ambient={value:1};
  lightResident(model,ambient);
  model.traverse(node=>{
   if(node.isBone)bones[node.name]=node;
   if(node.isMesh){node.receiveShadow=true;node.castShadow=!/Combed.scalp|Loose.temple/i.test(node.name);node.frustumCulled=false;}
  });
  for(const [name] of [...collisionBones,['middle_01_l'],['middle_01_r']])if(!bones[name])throw Error('Ida is missing joint '+name);
  root.add(model,contactShadow());root.name='Ida Mercer | Wash House';root.userData.personId=id;
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
  const a={root,clips,ambient,mixer:new THREE.AnimationMixer(model),body,volumes,jointPoints,palms:[bones.middle_01_l,bones.middle_01_r],
   left:new THREE.Vector3(),right:new THREE.Vector3(),midpoint:new THREE.Vector3(),mode:null,line:0,remaining:0,station:'home'};
  buildBasket(a);scene.add(root);PH.w.addBody(body);actor=a;play('Idle',2.8);syncContacts();
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
  const loop=name==='Idle'||name==='Walk';
  current.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
  current.clampWhenFinished=!loop;
  if(previous&&previous!==current)previous.crossFadeTo(current,.18,false);
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
  a.body.updateBoundingRadius();a.body.aabbNeedsUpdate=true;
  PH.w.broadphase.dirty=true;
 }
 function beginWalk(){
  const a=actor;
  a.target=a.station==='home'?site.washer:site.home;
  play('Walk',Infinity);
 }
 function tick(dt){
  if(!site)return;
  const p=player.car?.pos||player.pos;
  if(Math.hypot(p.x-site.home.x,p.z-site.home.z)>48)return;
  if(!actor){load();return;}
  const a=actor,r=a.root;
  if(a.mode==='Walk'){
   const dx=a.target.x-r.position.x,dz=a.target.z-r.position.z,d=Math.hypot(dx,dz);
   if(d<.04){
    r.position.copy(a.target);a.station=a.target===site.home?'home':'washer';r.rotation.y=site.front+(a.station==='washer'?Math.PI:0);
    play(a.station==='home'?'Laundry':'Idle',a.station==='home'?undefined:2.8);
   }else{
    const s=Math.min(d,dt*.86),x=r.position.x+s*dx/d,z=r.position.z+s*dz/d;
    const blocked=Math.abs(p.y-r.position.y)<1.6&&Math.hypot(p.x-x,p.z-z)<.85;
    a.action.paused=blocked;
    if(!blocked){r.position.set(x,floor,z);r.rotation.y=lerpA(r.rotation.y,Math.atan2(dx,dz),1-Math.exp(-dt*9));}
   }
  }else if((a.remaining-=dt)<=0){
   if(a.mode==='down')play('Recover');
   else if(a.mode==='falling'){a.action.paused=true;a.mode='down';a.remaining=7;}
   else if(a.mode==='Laundry'&&a.waitingCustomer){a.waitingCustomer=false;if(inReach(p,2.25))talk(p);else beginWalk();}
   else if(a.mode==='Talk'||a.mode==='Recover')play('Idle',1.3);
   else if(a.mode==='Idle'&&a.station==='home'&&r.position.distanceTo(site.home)<.05){r.rotation.y=site.front;play('Laundry');}
   else beginWalk();
  }
  if(site.lighting)a.ambient.value=roomLightAt(site.lighting,r.position);
  a.mixer.update(dt);syncContacts();
  if(a.mode==='Laundry'&&a.action.time>=a.grip&&a.action.time<=a.clips.Laundry.duration-a.grip){
   a.basket.position.copy(hands(a));a.basket.rotation.y=Math.atan2(a.right.z-a.left.z,a.left.x-a.right.x);
  }else{a.basket.position.copy(a.basketRest);a.basket.rotation.y=a.basketYaw;}
 }
 function push(p,r,y){
  if(!actor||Math.abs(p.x-actor.root.position.x)>r+2||Math.abs(p.z-actor.root.position.z)>r+2)return null;
  let normal=null;
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
 function ray(start,delta,pad){
  if(!actor)return 1;
  const A=delta.lengthSq();if(!A)return 1;
  const p=actor.root.position,margin=2+pad;
  if(p.x<Math.min(start.x,start.x+delta.x)-margin||p.x>Math.max(start.x,start.x+delta.x)+margin||
     p.z<Math.min(start.z,start.z+delta.z)-margin||p.z>Math.max(start.z,start.z+delta.z)+margin)return 1;
  let best=1;
  for(const v of actor.volumes){
   const dx=start.x-v.center.x,dy=start.y-v.center.y,dz=start.z-v.center.z;
   const B=dx*delta.x+dy*delta.y+dz*delta.z,C=dx*dx+dy*dy+dz*dz-(v.r+pad)**2;
   const det=B*B-A*C;if(det<0)continue;
   const t=(-B-Math.sqrt(det))/A;
   if(t>=0&&t<best)best=t;
  }
  return best;
 }
 function inReach(p,range,face=false){
  if(!actor)return false;
  const at=actor.root.position,dx=at.x-p.x,dz=at.z-p.z;
  return Math.hypot(dx,dz)<=range&&Math.abs(at.y-p.y)<1&&(!face||Math.abs(wrapA(Math.atan2(dx,dz)-player.yaw))<1.1)
   &&rayWorld(p.x,p.z,at.x,at.z,p.y+1,at.y+1,0,true,true)>=1;
 }
 function fall(){
  if(!actor||['falling','down','Recover'].includes(actor.mode))return;
  actor.waitingCustomer=false;play('Recover');actor.action.time=actor.clips.Recover.duration;actor.action.setEffectiveTimeScale(-3.4);
  actor.remaining=actor.action.time/3.4;actor.mode='falling';
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
  const delta=end.clone().sub(start),t=ray(start,delta,.025);
  if(t>=1)return;
  const wall=rayWorld(start.x,start.z,end.x,end.z,start.y,end.y,0,true,true);
  if(t<=wall)injured(false);
 }
 function interaction(p){
  if(!inReach(p,2.25))return null;
  const a=actor;
  if(a.mode==='down')return {label:'HELP IDA UP',fn(){play('Recover');toast('Ida · “Give me a second. I’ve got it.”',2500);}};
  if(['falling','Recover'].includes(a.mode))return null;
  return {label:'TALK TO IDA',fn(){
   if(a.mode==='Laundry'&&hands(a).y>a.basketRest.y+.09&&a.action.time>=a.grip&&a.action.time<=a.clips.Laundry.duration-a.grip){
    a.waitingCustomer=true;
    toast('Ida Mercer · “One second, let me set this down.”',1700);
   }else talk(p);
  }};
 }
 function talk(p){
  const a=actor,at=a.root.position;
  a.root.rotation.y=Math.atan2(p.x-at.x,p.z-at.z);
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
   yaw:actor.root.rotation.y,activity:actor.mode,animationTime:actor.action.time,clip:actor.action.getClip().name,colliders:actor.volumes.length}];
 }
 return {isShop,shelfStock,register,destination,tick,push,ray,hit,contactTrace,interaction,portrait,record,get error(){return loadingError;}};
})();
