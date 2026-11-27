/* Walkable building shells and physically solid doors. All dimensions are in metres. */
const ACCESS={doors:[],grid:new Map(),byFloor:new Map(),active:[],batches:{},nearCell:'',furniture:new Map()};
const _entryMatrix=new THREE.Matrix4(),_entryPos=new V3(),_entrySize=new V3();
const _entryRotation=new THREE.Quaternion(),_entryUp=new V3(0,1,0);

function cellKey(x,z){
 return clamp(Math.floor(x/CELL),0,N-1)*N+clamp(Math.floor(z/CELL),0,N-1);
}

function lotFace(R,side){
 const across=side==='S'||side==='N';
 const centerX=(R.x0+R.x1)/2,centerZ=(R.z0+R.z1)/2;
 const x=side==='E'?R.x1:side==='W'?R.x0:centerX;
 const z=side==='S'?R.z1:side==='N'?R.z0:centerZ;
 const matrix=new THREE.Matrix4().makeRotationY(SIDEANG[side]);
 matrix.setPosition(x,0,z);
 return {matrix,width:across?R.x1-R.x0:R.z1-R.z0,depth:across?R.z1-R.z0:R.x1-R.x0};
}

function registerDoor(M,u,v,base,width,height,kind='glass',open=false,hingeRight=false){
 const yaw=Math.atan2(M.elements[8],M.elements[10]);
 const hand=hingeRight?-1:1,origin=lpt(M,kind==='shutter'?u:u-hand*width/2,v);
 const center=lpt(M,u,v);
 const door={kind,x:origin.x,z:origin.z,ox:center.x,oz:center.z,yaw,hand,base,w:width,h:height,
  thickness:kind==='shutter'?.10:.058,phase:open?1:0,target:open?1:0,body:null,dirty:true};
 ACCESS.doors.push(door);
 const key=cellKey(center.x,center.z);
 if(!ACCESS.grid.has(key))ACCESS.grid.set(key,[]);
 ACCESS.grid.get(key).push(door);
 if(!ACCESS.byFloor.has(key))ACCESS.byFloor.set(key,new Map());
 const levels=ACCESS.byFloor.get(key),level=Math.floor(base/3);
 if(!levels.has(level))levels.set(level,[]);
 levels.get(level).push(door);
 return door;
}

function doorwayPose(d,phase){
 const swing=d.kind!=='shutter';
 const hand=d.hand||1;
 const yaw=d.yaw+(swing?hand*(d.opensOut?-1:1)*phase*Math.PI*.54:0);
 const half=swing?hand*d.w/2:0;
 return {
  x:d.x+Math.cos(yaw)*half,z:d.z-Math.sin(yaw)*half,
  y:d.base+d.h/2+(swing?0:phase*(d.h+.13)),yaw
 };
}

function initializeDoorMeshes(){
 const box=(x,y,z,w,h,d)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
 for(const kind of ['glass','wood','shutter','cargo','egress']){
  const doors=ACCESS.doors.filter(d=>d.kind===kind);
  if(!doors.length)continue;
  const metal=MAT.darkMetal,m=INTERIORS.materials;
  const layers=[];
  if(kind==='glass'){
   layers.push([m.glass,box(0,.041,0,.904,.892,.28),false]);
   layers.push([metal,mergeGeos([
    box(-.476,0,0,.048,1,1),box(.476,0,0,.048,1,1),
    box(0,-.464,0,.906,.072,1),box(0,.476,0,.906,.048,1),
    box(.399,-.012,.62,.021,.194,.36),box(.399,-.012,-.62,.021,.194,.36)
   ]),true]);
  }else if(kind==='egress'){
   layers.push([metal,mergeGeos([box(0,0,0,1,1,.86),box(0,-.372,.453,.93,.19,.10)]),true]);
   layers.push([m.steel,mergeGeos([box(0,-.028,-.70,.78,.018,.24),
    box(.36,-.037,.68,.14,.024,.24),box(-.32,-.027,-.54,.044,.054,.32),box(.32,-.027,-.54,.044,.054,.32)]),false]);
  }else if(kind==='wood'){
   layers.push([m.darkWood,mergeGeos([
    box(0,0,0,1,1,.83),box(0,.158,.41,.81,.413,.18),box(0,-.267,.41,.81,.282,.18)
   ]),true]);
   layers.push([m.chrome,mergeGeos([box(.389,-.01,.60,.087,.019,.31),box(.389,-.01,-.60,.087,.019,.31)]),false]);
  }else if(kind==='cargo'){
   const paint=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.52,roughness:.64});
   const skin=[box(0,0,-.18,1,1,.55)];
   for(let i=-2;i<=2;i++)skin.push(box(i*.18,0,.10,.087,.92,.43));
   for(const y of [-.459,.459])skin.push(box(0,y,.2,.996,.055,.69));
   layers.push([paint,mergeGeos(skin),true]);
   const hardware=[];
   for(const x of [-.305,.305]){
    hardware.push(box(x,0,.58,.027,.955,.42),box(x+.045,-.158,.74,.117,.025,.24));
    for(const y of [-.43,-.22,.21,.43])hardware.push(box(x,y,.61,.065,.034,.55));
   }
   layers.push([m.steel,mergeGeos(hardware),true]);
  }else{
   layers.push([MAT.shutter,box(0,0,0,1,1,.90),true]);
   layers.push([metal,box(0,-.444,.47,1,.05,.22),true]);
  }
  const sets=new Map();ACCESS.batches[kind]=[];
  for(const d of doors){
   const key=d.suiteBlock||Math.floor(d.ox/192)+','+Math.floor(d.oz/192);
   if(!sets.has(key))sets.set(key,[]);
   sets.get(key).push(d);
  }
  for(const group of sets.values()){
   const owner=group[0].suiteBlock,bounds=new THREE.Box3();
   for(const d of group){
    const reach=d.w+d.thickness+.12,top=d.base+d.h+(d.kind==='shutter'?d.h+.13:0);
    bounds.expandByPoint(new V3(d.x-reach,d.base-.05,d.z-reach));
    bounds.expandByPoint(new V3(d.x+reach,top+.05,d.z+reach));
   }
   const sphere=bounds.getBoundingSphere(new THREE.Sphere());
   const batches=layers.map(([geometryMaterial,geometry,shadow])=>{
    const batch=new THREE.InstancedMesh(geometryWithBounds(geometry,sphere),geometryMaterial,group.length);
    batch.castShadow=shadow;batch.receiveShadow=true;batch.frustumCulled=true;batch.visible=!owner;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(batch);return batch;
   });
   if(owner)(owner.suiteDoorBatches||(owner.suiteDoorBatches=[])).push(...batches);
   else ACCESS.batches[kind].push(...batches);
   group.forEach((d,i)=>{
    d.index=i;d.batches=batches;
    if(d.tint)batches[0].setColorAt(i,lin(d.tint));
    syncDoorMesh(d);
   });
  }
 }
}

function syncDoorMesh(d){
 const p=doorwayPose(d,d.phase);
 _entryPos.set(p.x,p.y,p.z);
 _entryRotation.setFromAxisAngle(_entryUp,p.yaw);
 if(d.model){
  d.model.position.set(p.x,p.y-d.h/2,p.z);
  d.model.quaternion.copy(_entryRotation);
  _entryPos.y=-1000;
 }
 _entrySize.set(d.w,d.h,d.thickness);
 _entryMatrix.compose(_entryPos,_entryRotation,_entrySize);
 for(const b of d.batches||[]){
  b.setMatrixAt(d.index,_entryMatrix);
  b.instanceMatrix.needsUpdate=true;
 }
 d.dirty=false;
}

function forDoorsNear(x,z,fn,height=null){
 const i=clamp(Math.floor(x/CELL),0,N-1),j=clamp(Math.floor(z/CELL),0,N-1);
 for(let a=Math.max(0,i-1);a<=Math.min(N-1,i+1);a++)for(let b=Math.max(0,j-1);b<=Math.min(N-1,j+1);b++){
  const k=a*N+b,levels=ACCESS.byFloor.get(k);
  if(levels&&height!==null){
   for(let f=Math.floor((height-6.6)/3);f<=Math.floor((height+1.66)/3);f++)for(const d of levels.get(f)||[])fn(d);
  }else for(const d of ACCESS.grid.get(k)||[])fn(d);
 }
}

function doorInteraction(pos,radius,kinds=null){
 let candidate=null,dist=radius;const floor=groundY(pos.x,pos.z,pos.y??null);
 forDoorsNear(pos.x,pos.z,d=>{
  if(kinds&&d.kind!==kinds)return;
  if(Math.abs(floor-d.base)>.7)return;
  const r=Math.hypot(d.ox-pos.x,d.oz-pos.z);
  if(r<dist){dist=r;candidate=d;}
 },floor);
 if(!candidate)return null;
 return {label:candidate.target?'CLOSE DOOR':'OPEN DOOR',hot:true,fn:()=>{
  if(!player.car)PoliceDepartment.touch(player,candidate,{x:candidate.ox,y:candidate.base,z:candidate.oz},'Door handle');
  candidate.target=candidate.target?0:1;
  noise(.18,candidate.kind==='shutter'?420:730,.11);
 }};
}

function syncDoorRegion(x,z){
 const key=cellKey(x,z);
 const height=player?.pos?.y||0,anchor=key+'/'+Math.floor(height/2);
 if(anchor===ACCESS.nearCell)return;
 ACCESS.nearCell=anchor;
 const selected=new Set();
 // Vehicles can use doors throughout the same region as the nearby static collision bodies.
 const i=Math.floor(key/N),j=key%N;
 for(let a=Math.max(0,i-2);a<=Math.min(N-1,i+2);a++)for(let b=Math.max(0,j-2);b<=Math.min(N-1,j+2);b++){
  for(const d of ACCESS.grid.get(a*N+b)||[])if(!d.suiteBlock||Math.abs(d.base-height)<6||d.base<5.0)selected.add(d);
 }
 for(const d of ACCESS.active){
  if(selected.has(d))continue;
  physRemove(d.body);
  d.body=null;
  if(d.dirty)syncDoorMesh(d);
 }
 ACCESS.active=[...selected];
 for(const d of ACCESS.active){
  if(d.body)continue;
  const p=doorwayPose(d,d.phase);
  const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:PH.mat.concrete,
   collisionFilterGroup:PHYS_GROUP.world,allowSleep:false});
  body.addShape(new CANNON.Box(new CV(d.w/2,d.h/2,d.thickness/2)));
  body.position.set(p.x,p.y,p.z);
  body.quaternion.setFromEuler(0,p.yaw,0);
  PH.w.addBody(body);
  d.body=body;

 }
}

function updateDoorModels(){
 for(const d of ACCESS.active){
  if(!d.modelId||d.model||d.modelPending)continue;
  const request=requestScenery(d.modelId);
  if(!request)continue;
  d.modelPending=true;
  request.then(template=>{
   d.modelPending=false;
   if(!template)return;
   d.model=modelInstance(template,[d.w,d.h,.107],d.modelId);
   scene.add(d.model);
   d.dirty=true;
   syncDoorMesh(d);
  });
 }
}

function doorOverlap(d,phase,pos,r,eyeHeight=1.62){
 const pose=doorwayPose(d,phase);
 const floor=groundY(pos.x,pos.z,pos.y??null);
 if(pose.y-d.h*.5>floor+eyeHeight||pose.y+d.h*.5<floor+.13)return null;
 const a=Math.cos(pose.yaw),b=Math.sin(pose.yaw),dx=pos.x-pose.x,dz=pos.z-pose.z;
 const local={x:dx*a-dz*b,z:dx*b+dz*a};
 const result=pushOut(local,r,{x0:-d.w*.5,x1:d.w*.5,z0:-d.thickness*.5,z1:d.thickness*.5});
 if(!result)return null;
 return {x:pose.x+local.x*a+local.z*b,z:pose.z-local.x*b+local.z*a,
  normal:[result[0]*a+result[1]*b,-result[0]*b+result[1]*a]};
}

function collideDoors(pos,r){
 let normal=null;
 forDoorsNear(pos.x,pos.z,d=>{
  if((d.ox-pos.x)**2+(d.oz-pos.z)**2>(d.w+r)**2)return;
  const overlap=doorOverlap(d,d.phase,pos,r);
  if(overlap){pos.x=overlap.x;pos.z=overlap.z;normal=overlap.normal;}
 },pos.y??null);
 return normal;
}

function animateDoorBodies(dt){
 for(const d of ACCESS.active){
  const body=d.body;
  if(d.phase===d.target){
   if(body.velocity.lengthSquared()||body.angularVelocity.lengthSquared()){
    const pose=doorwayPose(d,d.phase);
    body.position.set(pose.x,pose.y,pose.z);
    body.quaternion.setFromEuler(0,pose.yaw,0);
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.aabbNeedsUpdate=true;
   }
   continue;
  }
  const change=clamp(d.target-d.phase,-dt*1.87,dt*1.87);
  const next=d.phase+change;
  if(change<0&&player&&Math.hypot(player.pos.x-d.ox,player.pos.z-d.oz)<d.w+1.2&&
   doorOverlap(d,next,player.pos,player.car?1.1:.36,player.car?1.45:1.66)){
   d.target=1;
   continue;
  }
  const p=doorwayPose(d,d.phase),q=doorwayPose(d,next);
  body.position.set(p.x,p.y,p.z);
  body.quaternion.setFromEuler(0,p.yaw,0);
  body.velocity.set((q.x-p.x)/dt,(q.y-p.y)/dt,(q.z-p.z)/dt);
  body.angularVelocity.set(0,(q.yaw-p.yaw)/dt,0);
  body.aabbNeedsUpdate=true;
  d.phase=next;
  d.dirty=true;
 }
}

function updateDoorMeshes(){
 for(const d of ACCESS.active)if(d.dirty)syncDoorMesh(d);
}

function buildAccessibleShell(block,R,settings={}){
 const {base=.15,ceiling=3.32,kind='shop',selected=[],wall=MAT.trim,height=ceiling,rooms=true}=settings;
 const m=INTERIORS.materials,variants=kind==='shop'||kind==='lobby';
 const width=R.x1-R.x0,depth=R.z1-R.z0;
 if(width<2.5||depth<2.5)return false;
 const sides=selected.length?selected:['S'];
 const gap=kind==='garage'?Math.min(4.7,Math.min(width,depth)-.75):kind==='lobby'?1.79:1.23;
 const doorH=kind==='garage'?2.92:2.19;
 if(height>ceiling)block.bld.push({...R,y0:ceiling,h:height});
 topQuad(kind==='home'?m.wood:m.tile,R.x0,R.x1,base+.006,R.z0,R.z1,2.4,null,false);
 if(base>.20)STREET.steps.push({...R,y:base});
 for(const r of settings.openRafters?[]:subtractCityOpenings(R,settings.ceilingOpenings||[])){
  weatherCeilings.push({...r,h:ceiling});
  plainBox(m.ceiling,r.x0,r.x1,ceiling-.10,ceiling,r.z0,r.z1,{uvm:2.6,shadow:false});
 }

 for(const side of ['S','N','E','W']){
  const {matrix:M,width:span}=lotFace(R,side),a=-span/2,b=span/2;
  const box=(mat,x0,x1,y0,y1,z0,z1)=>{
   const geo=plainBox(mat,x0,x1,y0,y1,z0,z1,{M,uvm:2.45,shadow:false});
   if(settings.structure?.levels[0].tier.brick&&mat===wall){
    const r={...lrect(M,x0,x1,-z1,-z0),y0,h:y1,side};
    (block.bondWalls||(block.bondWalls=[])).push(r);
   }return geo;
  };
  const collision=(x0,x1,y0,y1)=>addRoomCollider(block,M,x0,x1,-.025,.195,y1,y0);
  const opening=sides.includes(side);
  const showWindow=variants?opening&&span>=5.4:kind==='home'&&span>=6.4;
  if(!opening&&!showWindow){
   box(wall,a,b,base,ceiling,-.17,.021);
   collision(a,b,base,ceiling);
   continue;
  }
  const stop=opening?gap/2:0;
  for(const [l,r] of [[a,-stop],[stop,b]]){
   if(!showWindow||r-l<1.45){
    box(wall,l,r,base,ceiling,-.17,.021);
    collision(l,r,base,ceiling);
    continue;
   }
   const from=l+.42,to=r-.42,sill=base+(kind==='home'?.81:.36),top=ceiling-.54;
   box(wall,l,from,base,ceiling,-.16,.024);
   box(wall,to,r,base,ceiling,-.16,.024);
   box(wall,from,to,base,sill,-.16,.024);
   box(wall,from,to,top,ceiling,-.16,.024);
   groundGlazing(block,M,from,to,sill,top);
   collision(l,from,base,ceiling);collision(to,r,base,ceiling);
   collision(from,to,base,sill);collision(from,to,top,ceiling);

  }
  if(opening){
   box(wall,-stop,stop,base+doorH,ceiling,-.17,.032);
   for(const u of [-stop,stop])box(MAT.darkMetal,u-.037,u+.037,base,base+doorH,-.14,.034);
   box(MAT.darkMetal,-stop,stop,base+doorH-.045,base+doorH,-.12,.032);
   registerDoor(M,0,.015,base,gap-.062,doorH-.032,kind==='home'?'wood':kind==='garage'?'shutter':'glass');
   collision(-stop,stop,base+doorH,ceiling);
  }
 }

 if(!rooms||kind==='garage')return true;
 const {matrix:M,width:span,depth:run}=lotFace(R,sides[0]);
 // Keep the approach inside every entrance clear, including doors on the side walls.
 const entries=sides.map(side=>lrect(lotFace(R,side).matrix,-gap/2-.36,gap/2+.36,-.4,2.15));
 if(settings.structure?.core)entries.push(settings.structure.core.approach);
 function furnish(kind,u,v,dims){
  const [w,,d]=dims,area=lrect(M,u-w/2,u+w/2,v-d/2,v+d/2);
  if(entries.some(e=>e.x0<area.x1&&e.x1>area.x0&&e.z0<area.z1&&e.z1>area.z0))return;
  placeRoomFurniture(block,M,kind,u,v,base,dims);
 }
 const usable=Math.min(run,15);
 const counterWidth=Math.min(span*.27,3.05);
 const offset=Math.min(span*.29,4.5);
 const key=kind==='home'?'reading-table':kind==='lobby'?'counter':'display';
 const counter=kind==='home'?[1.11,.73,1.11]:[counterWidth,.97,.65];
 if(offset-counter[0]/2<gap/2+.5||usable<4.5)return true;
 furnish(key,offset,usable*.50,counter);
 if(kind==='home'){
  furnish('seat',offset,usable*.50+.94,[.53,.84,.54]);
  furnish('bookcase',-offset,usable*.68,[1.28,1.92,.40]);
 }else{
  furnish('stock',-offset,usable*.63,[Math.min(span*.29,2.96),1.82,.44]);
  furnish('stock',offset,usable*.78,[Math.min(span*.28,2.93),1.82,.44]);
 }
 const lamp=lpt(M,offset*.48,usable*.57);
 INTERIORS.emitters.push({x:lamp.x,y:ceiling-.25,z:lamp.z,cool:kind==='garage'});
 plainBox(m.warm,lamp.x-.38,lamp.x+.38,ceiling-.25,ceiling-.21,lamp.z-.08,lamp.z+.08,{shadow:false});
 return true;
}

function placeRoomFurniture(block,M,kind,u,depth,y,dims){
 const steps=dims.map(n=>Math.max(1,Math.round(n*5)));
 const key=kind+' '+steps.join(' '),built=steps.map(n=>n/5);
 if(!ACCESS.furniture.has(key))ACCESS.furniture.set(key,makeFixture(kind,built));
 const template=ACCESS.furniture.get(key),point=lpt(M,u,depth);
 const transform=M.clone().setPosition(point.x,y+.008,point.z);
 transform.scale(new V3(dims[0]/built[0],dims[1]/built[1],dims[2]/built[2]));
 template.traverse(mesh=>{
  if(mesh.isMesh)addGeo(mesh.material,mesh.geometry.clone().applyMatrix4(transform),false);
 });
 const [w,h,d]=dims;
 addRoomCollider(block,M,u-w/2,u+w/2,depth-d/2,depth+d/2,y+h,y);
}
