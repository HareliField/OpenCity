/* Walk-in shops with actual rooms, fixtures and low-cost collision shapes. */
const INTERIORS={materials:{},fixtures:[],lights:[],emitters:[],catalog:{},models:new Map(),clock:0};
const _assetSize=new V3();
const _assetCenter=new V3();

function initInteriors(){
 const m=INTERIORS.materials;
 const surface=(color,roughness=.76,metalness=0)=>new THREE.MeshStandardMaterial({color:lin(color),roughness,metalness});
 m.plaster=pbr('plaster',2.3,{color:0xe0c0a2,rough:.96,env:.22,ns:.66});
 m.brick=pbr('brick_tan',2.7,{color:0x9c7964,rough:.91,env:.22,ns:.88});
 m.tile=pbr('tiles_dark',2,{color:0xbbb6a8,rough:.48,env:.61,ns:.61});
 m.wood=pbr('planks',1.8,{color:0x9a7761,rough:.64,env:.46});
 m.wallTile=pbr('tiles_dark',2.1,{color:0x849f94,rough:.58,env:.39});
 m.ceiling=surface(0xa99b8b);
 m.rubber=surface(0x242421);
 m.steel=surface(0xa1a098,.37,.80);
 m.chrome=surface(0xd1d1c9,.22,.91);
 m.ceramic=surface(0xe0cfb4,.3);
 m.darkWood=surface(0x583826,.74);
 m.desk=surface(0xb78474,.67);
 m.cushion=surface(0xcaab9a,.81);
 m.oxblood=surface(0x682b2e,.49);
 m.glass=new THREE.MeshPhysicalMaterial({
  color:lin(0xa0aaac),roughness:.16,metalness:.64,transparent:true,opacity:.14,depthWrite:false
 });
 m.bottle=[0x743b35,0xbaaa7c,0x485a42,0x574157,0xa65e47,0x354b58].map(c=>surface(c,.56,.1));
 m.book=[0x4c503e,0x9b7154,0x3f5861,0x7b3c39,0x5c4e39,0xa3936e].map(c=>surface(c));
 m.cream=surface(0xc7bea4);
 m.pastry=surface(0xb87939,.64);
 m.plant=surface(0x3c5b34);
 m.black=surface(0x181714,.52,.18);
 m.warm=new THREE.MeshBasicMaterial({color:new THREE.Color(2.75,1.72,.94)});
 m.neutral=new THREE.MeshBasicMaterial({color:new THREE.Color(2.35,2.15,1.89)});
 for(let i=0;i<3;i++){
  const light=new THREE.PointLight(0xffc58f,0,10,2);
  INTERIORS.lights.push(light);
  scene.add(light);
 }
 fetch('models/scenery/catalog.json').then(r=>r.ok?r.json():{}).then(catalog=>{
  INTERIORS.catalog=catalog;
  INTERIORS.clock=0;
 }).catch(()=>{});
}

function hasStockRoom(row){return row===RETAIL.books||row===RETAIL.deli||row===RETAIL.barber;}

function buildInterior(room){
 const {block,M,u0,u1,door0,door1,row,depth}=room;
 const m=INTERIORS.materials;
 const t=.17,back=-depth,ceiling=3.52;
 weatherCeilings.push({...lrect(M,u0,u1,-.08,depth+(hasStockRoom(row)?2.24:0)),h:ceiling+.15});
 const lighting=shopLightingRoom(M,u0,u1,depth);
 const textured=(mat,x0,x1,y0,y1,z0,z1)=>{
  const geometry=plainBox(roomLightMaterial(mat),x0,x1,y0,y1,z0,z1,{M,uvm:2.1});
  shadeRoomGeometry(lighting,geometry);
 };
 const tile=row===RETAIL.laundry||row===RETAIL.barber||row===RETAIL.donuts;
 textured(tile?m.tile:m.wood,u0,u1,.148,.174,back,.19);
 textured(m.ceiling,u0,u1,ceiling,ceiling+.15,back,.08);
 for(const x of [u0,u1-t]){
  if(row!==RETAIL.books||x!==u0){
   textured(row===RETAIL.books?m.brick:m.plaster,x,x+t,.15,ceiling,back,.14);
   continue;
  }
  for(const a of [[back,-6.20],[-3.34,-2.96],[-.10,.14]])textured(m.brick,x,x+t,.15,ceiling,a[0],a[1]);
  textured(m.brick,x,x+t,.15,.48,-6.20,-.10);
  textured(m.brick,x,x+t,3.16,ceiling,-6.20,-.10);
 }
 const backMat=row===RETAIL.books?m.brick:row===RETAIL.cafe?m.wallTile:m.plaster;
 if(hasStockRoom(row)){
  const center=row===RETAIL.barber?u0+1.09:u1-1.11,half=.575;
  for(const [a,b] of [[u0,center-half],[center+half,u1]]){
   textured(backMat,a,b,.15,ceiling,back,back+t);
   addRoomCollider(block,M,a,b,depth-t,depth,ceiling);
  }
  textured(backMat,center-half,center+half,2.37,ceiling,back,back+t);
  const stock=registerDoor(M,center,depth-.08,.172,1.10,2.19,'wood');
  stock.modelId='store-door';
  const a=depth+2.24;
  textured(backMat,u0,u1,.15,ceiling,-a,-a+t);
  textured(m.wood,u0,u1,.15,.174,-a,back);
  textured(m.ceiling,u0,u1,ceiling,ceiling+.07,-a,back);
  addRoomCollider(block,M,u0,u1,a-t,a,ceiling);
  for(const x of [u0,u1-t]){
   textured(backMat,x,x+t,.15,ceiling,-a,back+.01);
   addRoomCollider(block,M,x,x+t,depth,a,ceiling);
  }
 }else{
  textured(backMat,u0,u1,.15,ceiling,back,back+t);
  addRoomCollider(block,M,u0,u1,depth-t,depth+1.0,4.14);
 }
 textured(m.darkWood,u0+.16,u1-.16,.16,.31,back+.12,back+.22);
 const spans=[[u0,door0],[door1,u1]];
 for(const [a,b] of spans){
  addRoomCollider(block,M,a,b,.015,.14,.43);
  addRoomCollider(block,M,a,b,.035,.063,3.29,.43,true);
  addRoomCollider(block,M,a,b,.014,.13,3.50,3.29);
 }
 addRoomCollider(block,M,u0,u0+t,-.10,depth,3.63);
 addRoomCollider(block,M,u1-t,u1,-.10,depth,3.63);

 const width=u1-u0,center=(u0+u1)/2;
 const cool=row===RETAIL.laundry,idaShop=globalThis.WashHouse?.isShop(room);
 for(const z of [-1.58,back+1.6]){
  for(const x of [u0+width*.27,u1-width*.27]){
   const lamp=lpt(M,x,-z);
   const washLight=idaShop?{colour:z===-1.58?0xffecd6:0xf0f5ff,intensity:z===-1.58?2.90:2.10,reach:9.5}:null;
   INTERIORS.emitters.push({x:lamp.x,y:idaShop?2.98:2.77,z:lamp.z,cool,...washLight});
   if(cool){
    textured(m.steel,x-.68,x+.68,3.27,3.36,z-.12,z+.12);
    textured(m.neutral,x-.62,x+.62,3.23,3.272,z-.09,z+.09);
   }else{
    cyl(m.black,x,3.03,z,.019,.019,.49,7,{M});
    worksModel('enamel-pendant',lamp.x,2.865,lamp.z,[.46,.216,.46],0,false);
    cyl(m.warm,x,2.87,z,.183,.183,.031,14,{M,shadow:false});
   }
  }
 }

 const fixture=(id,x,z,dims,yaw=0,solid=true)=>{
  const angle=Math.atan2(M.elements[8],M.elements[10])+yaw;
  const p=lpt(M,x,-z);
  const node=new THREE.Group();
  node.position.set(p.x,.172,p.z);
  node.rotation.y=angle;
  const fallback=makeFixture(id,dims);
  node.add(fallback);
  scene.add(node);
  const modelId=id==='rack'?'coat-rail':id==='seat'&&row===RETAIL.studio?'linen-salon-chair':id==='plant'&&row===RETAIL.cafe?'strelitzia-planter':id==='washer'?'laundry-machine':id==='manicure-desk'?'nail-workstation':id==='display'?'patisserie-case':id==='plant'?'salon-plant':id==='stock'&&row===RETAIL.deli?'pantry-shelf':id;
  const device=placeCityMachine(modelId,p.x,.172,p.z,angle,dims);
  INTERIORS.fixtures.push({id:modelId,node,fallback,dims,x:p.x,z:p.z,device});
  if(id==='seat'||id==='plant'||id==='reading-table'){
   registerLooseFixture(node,id,p.x,.172,p.z,angle,dims,id==='seat'?8:id==='plant'?13:28);
  }else if(solid){
   const fd=new THREE.Box3().setFromObject(fallback);
   const b=new THREE.Box3().setFromObject(node);
   block.bld.push({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,h:.18+fd.max.y,y0:.15});
  }
 };
 if(row===RETAIL.laundry){
  globalThis.WashHouse?.register(room,lighting);
  for(let x=u0+1;x<u1-.65;x+=1.10)fixture('washer',x,back+.74,[.96,1.12,.90]);
  for(const x of [u0+2.1,u1-2.1])fixture('counter',x,-3.40,[2.08,.93,.64]);
  if(idaShop){
   WashHouse.shelfStock(room);
   // A diffused task strip above the customer side fills the face from the front.
   const x=center-1.12,z=-1.02,lamp=lpt(M,x,-z);
   textured(m.steel,x-.60,x+.60,3.21,3.34,z-.085,z+.085);
   textured(m.neutral,x-.56,x+.56,3.18,3.214,z-.073,z+.073);
   INTERIORS.emitters.push({x:lamp.x,y:2.80,z:lamp.z,cool:true,colour:0xffe5c9,intensity:2.65,reach:8.5});
  }
  for(const y of [1.61,1.91]){
   textured(m.steel,u0+.48,u1-.48,y,y+.027,back+.19,back+.47);
   if(idaShop)continue;
   for(let x=u0+.58,i=0;x<u1-.59;x+=.23){
    const tall=.14+(i%4)*.022;
    if(i++%6!==5)textured(m.bottle[(i*5)%6],x,x+.106,y+.029,y+.029+tall,back+.25,back+.367);
   }
  }
  textured(m.chrome,u0+.35,u1-.35,2.77,2.813,back+.16,back+.21);
  for(const x of [u0+.45,u1-.45])cyl(m.steel,x,.23,back+.22,.027,.027,2.55,7,{M});
 }else if(row===RETAIL.studio){
  for(const x of [u0+1.72,center+1.12,u1-1.72]){
   fixture('manicure-desk',x,-3.1,[1.28,.93,.65]);
   fixture('seat',x,-2.22,[.56,.86,.54],Math.PI);
   fixture('seat',x,-4.03,[.56,.86,.54]);
  }
  for(const x of [u0+1.64,center,u1-1.66]){
   textured(m.steel,x-.55,x+.55,1.07,2.47,back+.18,back+.207);
   textured(m.darkWood,x-.59,x+.59,1.026,1.086,back+.17,back+.255);
  }
  for(const x of [u0+.69,u1-.69]){
   textured(m.desk,x-.45,x+.45,.174,1.01,back+.20,back+.58);
   addRoomCollider(block,M,x-.45,x+.45,depth-.58,depth-.20,1.01,.174);
   for(const y of [1.30,1.64,1.98]){
    textured(m.darkWood,x-.43,x+.43,y,y+.033,back+.19,back+.45);
    for(let i=0;i<8;i++){
     const u=x-.365+i*.103,high=y+.095+(i%3)*.014;
     textured(m.bottle[(i+Math.round(y*5))%6],u,u+.050,y+.034,high,back+.286,back+.34);
     textured(m.steel,u+.013,u+.036,high,high+.022,back+.293,back+.330);
    }
   }
  }
  fixture('plant',u1-.77,-1.1,[.56,1.32,.56]);
 }else if(row===RETAIL.barber){
  for(let x=u0+1.7;x<u1-.8;x+=2.22){
   fixture('barber-chair',x,-3.38,[.73,1.18,.85]);
   textured(m.chrome,x-.53,x+.53,1.08,2.49,back+.18,back+.22);
   textured(m.steel,x-.57,x+.57,1.03,1.09,back+.175,back+.25);
  }
  fixture('counter',center+.82,back+.63,[width-2.67,.91,.81]);
  fixture('seat',u1-.81,-1.22,[.63,.90,.63],-Math.PI/2);
 }else if(row===RETAIL.books){
  for(let x=u0+.91;x<u1-2.1;x+=1.59)fixture('bookcase',x,back+.54,[1.45,2.35,.44]);
  for(const x of [u0+1.53,u1-1.53]){
   fixture('reading-table',x,-2.65,[.95,.78,.95]);
   fixture('seat',x,-3.62,[.49,.81,.50]);
  }
  fixture('plant',u1-.57,-1.06,[.46,1.28,.46]);
 }else if(row===RETAIL.tailor){
  for(let x=u0+.99;x<u1-.8;x+=1.92)fixture('rack',x,back+.55,[1.65,2.19,.48]);
  fixture('counter',u1-2.22,-3.19,[2.35,.99,.67],Math.PI/2);
  fixture('seat',u0+.78,-1.48,[.49,.81,.50]);
 }else{
  const displayWidth=Math.min(2.02,(width-1.5)/3);
  for(const x of [u0+displayWidth*.74,center,...(row===RETAIL.deli?[]:[u1-displayWidth*.74])]){
   fixture('stock',x,back+.43,[displayWidth,2.15,.46]);
  }
  const counterWidth=Math.min(5.4,width*.54);
  if(row===RETAIL.cafe)fixture('counter',center+width*.13,-3.72,[counterWidth,1.17,.85]);
  else{
   const segment=Math.min(2.15,counterWidth*.49);
   for(const x of [center+.17,center+.30+segment])fixture('display',x,-3.72,[segment,1.39,.85]);
  }
  for(const x of [u0+1.32,u1-1.55]){
   fixture('reading-table',x,-1.5,[.76,.77,.76]);
   fixture('seat',x,-2.35,[.48,.83,.48]);
  }
 }
}

function addRoomCollider(block,M,u0,u1,v0,v1,h,y0=0,glass=false){
 const span={...lrect(M,u0,u1,v0,v1),h,y0};if(glass)span.glass=true;block.bld.push(span);
}

function makeFixture(kind,[w,h,d]){
 const m=INTERIORS.materials;
 const geometries=new Map();
 function add(mat,g,x,y,z){
  g.translate(x,y,z);
  if(!geometries.has(mat))geometries.set(mat,[]);
  geometries.get(mat).push(g);
 }
 const box=(mat,x,y,z,a,b,c)=>add(mat,new THREE.BoxGeometry(a,b,c),x,y,z);
 const rod=(mat,x,y,z,r,height,bottom=r)=>add(mat,new THREE.CylinderGeometry(r,bottom,height,12),x,y,z);
 const foot=(mat,x,z,height=.7)=>box(mat,x,height*.5,z,.052,height,.052);
 if(kind==='washer'){
  box(m.steel,0,h/2,0,w,h,d);
  box(m.black,0,h*.87,d*.503,w*.90,h*.185,.024);
  box(m.ceramic,-w*.14,h*.87,d*.523,w*.45,.046,.01);
  const r=w*.288;
  const rim=new THREE.TorusGeometry(r,.038,8,30);
  add(m.chrome,rim,0,h*.48,d*.506);
  add(m.rubber,new THREE.CircleGeometry(r*.92,30),0,h*.48,d*.524);
  add(m.glass,new THREE.SphereGeometry(r*.91,20,12).scale(1,1,.16),0,h*.48,d*.535);
  rod(m.chrome,w*.31,h*.86,d*.536,.03,.069);
 }else if(kind==='barber-chair'){
  rod(m.chrome,0,.043,0,w*.43,.086);
  rod(m.steel,0,h*.21,0,w*.135,h*.31);
  box(m.oxblood,0,h*.48,.03,w*.81,h*.14,d*.63);
  box(m.oxblood,0,h*.75,-d*.258,w*.68,h*.43,d*.143);
  box(m.oxblood,0,h*.97,-d*.31,w*.43,h*.12,d*.114);
  box(m.chrome,0,h*.24,d*.378,w*.65,h*.047,d*.20);
  for(const s of [-1,1]){
   box(m.chrome,s*w*.42,h*.52,0,.037,h*.17,d*.51);
   box(m.oxblood,s*w*.425,h*.64,-.01,.086,.061,d*.56);
  }
 }else if(kind==='bookcase'||kind==='stock'||kind==='rack'){
  for(const s of [-1,1])box(m.darkWood,s*(w*.5-.023),h*.5,0,.046,h,d);
  box(m.darkWood,0,h*.5,-d*.48,w,h,.03);
  for(let i=0;i<5;i++){
   const y=h*(.08+i*.214);
   box(m.darkWood,0,y,0,w,.038,d);
   if(i===4)continue;
   for(let x=-w*.46,j=0;x<w*.45;x+=.066+(j++%4)*.017){
    const productH=.16+(j%5)*.026;
    if(kind==='rack'&&i===1)box(m.book[j%6],x,y+.23,.018,.062,.40,d*.37);
    else if(kind==='bookcase')box(m.book[(j+i)%6],x,y+productH*.5+.02,d*.082,.052+(j%3)*.011,productH,d*.69);
    else if(j%2===0)box(m.bottle[(j+i)%6],x,y+productH*.43+.025,.027,.066,productH*.86,d*.63);
   }
  }
 }else if(kind==='plant'){
  rod(m.ceramic,0,h*.14,0,w*.35,h*.28,w*.28);
  rod(m.darkWood,0,h*.54,0,.023,h*.65);
  for(let i=0;i<14;i++){
   const a=i*2.399,r=w*(.14+(i%5)*.069),y=h*(.43+i*.036);
   const leaf=new THREE.SphereGeometry(.09,7,4).scale(1,.22,1.9).rotateX(.4).rotateY(a);
   add(m.plant,leaf,Math.sin(a)*r,y,Math.cos(a)*r);
  }
 }else if(kind==='seat'){
  for(const x of [-1,1])for(const z of [-1,1])foot(m.steel,x*w*.37,z*d*.39,h*.56);
  box(m.cushion,0,h*.52,0,w,h*.13,d);
  box(m.cushion,0,h*.76,-d*.43,w*.93,h*.42,.11);
 }else if(kind==='reading-table'){
  rod(m.wood,0,h-.034,0,w*.5,.068);
  rod(m.black,0,h*.48,0,.038,h*.92);
  rod(m.black,0,.036,0,w*.29,.072);
  rod(m.ceramic,w*.13,h+.04,d*.12,.05,.088);
 }else{
  const desk=kind==='manicure-desk',display=kind==='display';
  box(desk?m.desk:m.darkWood,0,h-.075,0,w,.10,d);
  if(display){
   box(m.darkWood,0,h*.29,0,w,h*.58,d);
   box(m.glass,0,h*.775,d*.477,w,h*.374,.019);
   for(let x=-w*.43;x<w*.45;x+=.31){
    rod(m.pastry,x,h*.64,0,.085,.092);
    rod(m.pastry,x,h*.64,-d*.27,.078,.078);
   }
  }else{
   for(const s of [-1,1]){
    foot(m.steel,s*w*.42,-d*.36,h*.94);
    foot(m.steel,s*w*.42,d*.36,h*.94);
   }
   box(desk?m.desk:m.darkWood,-w*.31,h*.48,0,w*.27,h*.78,d*.82);
  }
  if(desk){
   box(m.steel,w*.23,h+.19,-d*.24,.025,.38,.025);
   box(m.warm,w*.23,h+.39,-d*.14,.21,.022,.072);
   for(let i=0;i<6;i++)rod(m.bottle[i],w*.31-i*.071,h+.036,-d*.23,.022,.106);
  }
 }
 const group=new THREE.Group();
 for(const [mat,parts] of geometries){
  const mesh=new THREE.Mesh(mergeGeos(parts),mat);
  mesh.receiveShadow=true;
  group.add(mesh);
  for(const geometry of parts)geometry.dispose();
 }
 return group;
}

function requestScenery(id){
 const record=INTERIORS.catalog[id];
 if(record?.retryAfter>performance.now())return null;
 if(!record)return null;
 if(!INTERIORS.models.has(id)){
  const url='models/scenery/'+record.file;
  const result=new Promise((resolve,reject)=>new THREE.GLTFLoader().load(url,resolve,undefined,reject))
   .then(gltf=>{
    const model=gltf.scene;
    model.rotation.y=record.yaw||0;
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    bounds.getCenter(_assetCenter);
    bounds.getSize(_assetSize);
    if(!_assetSize.toArray().every(v=>Number.isFinite(v)&&v>.001))return null;
    const root=new THREE.Group();
    root.add(model);
    const anchor=record.anchor||[0,0];
    model.position.set(-_assetCenter.x+anchor[0]*_assetSize.x,-bounds.min.y,-_assetCenter.z+anchor[1]*_assetSize.z);
    model.traverse(mesh=>{
     if(mesh.isMesh){
      mesh.receiveShadow=true;
      mesh.material.envMapIntensity=.76;
     }
    });
    root.userData.dimensions=_assetSize.toArray();
    return root;
   }).catch(()=>null).then(model=>{
    if(!model){record.retryAfter=performance.now()+10000;INTERIORS.models.delete(id);}
    return model;
   });
  INTERIORS.models.set(id,result);
 }
 return INTERIORS.models.get(id);
}

function updateInteriors(dt,x,z,levelY=player.pos.y){
 if((INTERIORS.clock-=dt)>0)return;
 INTERIORS.clock=.30;
 const near=[];
 for(const lamp of [...INTERIORS.emitters,...BUILDING_FITTINGS.lamps]){
  if(lamp.floorY!==undefined&&Math.abs(lamp.floorY-levelY)>1.5)continue;
  const distance=(lamp.x-x)**2+(lamp.z-z)**2;
  if(distance<31**2&&cityPowerAt(lamp.x,lamp.z)&&(!lamp.municipal||CITY_WORKS.grid))near.push({lamp,distance});
 }
 near.sort((a,b)=>a.distance-b.distance);
 for(let i=0;i<INTERIORS.lights.length;i++){
  const light=INTERIORS.lights[i],lamp=near[i]?.lamp;
  if(lamp){
   light.position.set(lamp.x,lamp.y,lamp.z);
   light.color.setHex(lamp.colour??(lamp.floorY!==undefined?0xffefd9:lamp.cool?0xffe6cb:0xffbf87));
   light.distance=lamp.reach??10;
   light.intensity=lamp.intensity??(lamp.cool?1.15:1.27);
  }else light.intensity=0;
 }
 for(const f of INTERIORS.fixtures){
  const distance=(f.x-x)**2+(f.z-z)**2;
  f.node.visible=distance<152**2;
  if(!f.pending&&distance<83**2){
   const asset=requestScenery(f.id);
   if(!asset)continue;
   f.pending=true;
   asset.then(template=>{
    if(!template){f.pending=false;return;}
    const model=modelInstance(template,f.dims,f.id);
    f.node.remove(f.fallback);
    f.fallback.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    shadeFixture(model,f.x,f.node.position.y,f.z);
    f.node.add(model);
    if(f.device)bindCityMachine(f.device,model);
   });
  }
 }
}
