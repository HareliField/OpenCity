/* Reference scenery and low-detail silhouettes share placement and bounds. */
const CITY_DETAIL={fallbacks:new Map(),prototypes:new Map()};

function detailPrototype(id){
 if(CITY_DETAIL.prototypes.has(id))return CITY_DETAIL.prototypes.get(id);
 const parts=[];
 const part=(geo,color,x,y,z)=>{
  geo.translate(x,y,z);setColor(geo,color);parts.push(geo);
 };
 const box=(color,x,y,z,w,h,d)=>part(new THREE.BoxGeometry(w,h,d),color,x,y,z);
 const drum=(color,x,y,z,top,foot,h)=>part(new THREE.CylinderGeometry(top,foot,h,12),color,x,y,z);
 if(id==='roof-cistern'){
  drum(0x836449,0,.39,0,.49,.49,.77);drum(0x494846,0,.875,0,.025,.53,.25);
  for(const y of [.12,.41,.72])drum(0x444342,0,y,0,.503,.503,.021);
 }else if(id==='roof-condenser'){
  box(0x9b9c99,0,.45,0,.98,.85,.94);
  for(const x of [-.24,.24])drum(0x3d4040,x,.90,0,.19,.19,.052);
 }else if(id==='rescue-hut'){
  box(0xe6dac8,-.11,.65,0,.50,.38,.72);box(0x576b73,-.11,.70,.366,.33,.16,.018);
  for(const x of [-.31,.10])for(const z of [-.30,.30])box(0x796654,x,.24,z,.035,.48,.034);
  part(new THREE.ConeGeometry(.48,.18,4).rotateY(Math.PI/4),0x965747,-.11,.91,0);
  for(let k=0;k<9;k++)box(0x887664,.12+k*.044,.46-k*.052,.07,.06,.036,.36);
 }else if(id==='enamel-pendant'){
  drum(0x282726,0,.40,0,.14,.50,.69);drum(0x383530,0,.82,0,.13,.13,.30);drum(0xe2d6b8,0,.06,0,.47,.47,.045);
 }else if(id==='bakery-counter'){
  box(0x72533d,0,.30,0,.98,.57,.96);box(0xb4af99,0,.73,-.18,.94,.43,.52);
  for(const y of [.54,.73,.91])box(0xb9a17d,0,y,.09,.93,.042,.74);
  for(const x of [-.47,.47])box(0x605848,x,.72,.34,.035,.49,.035);
 }else if(id==='pantry-shelf'){
  box(0x49392e,0,.49,-.45,.98,.97,.11);
  for(const x of [-.47,.47])box(0x604b38,x,.5,0,.055,.98,.95);
  for(let i=0;i<5;i++){
   const y=.10+i*.20;box(0x76573c,0,y,.01,.98,.034,.96);
   for(let j=0;j<6;j++)box([0x87705a,0x9c8263,0x67765e][(i+j)%3],-.37+j*.15,y+.075,.16,.10,.10,.41);
  }
 }else if(id==='salon-plant'){
  drum(0xb1a79a,0,.15,0,.25,.18,.30);
  for(const [x,y,z,r] of [[0,.72,0,.24],[-.17,.63,.12,.23],[.18,.61,-.06,.25],[.05,.87,.05,.15]])
   part(new THREE.IcosahedronGeometry(r,1),0x536a45,x,y,z);
 }else if(id==='promenade-bench'){
  for(let i=0;i<4;i++)box(0x876a4e,0,.49,-.34+i*.20,.99,.05,.16);
  for(const y of [.67,.80,.94])box(0x907151,0,y,-.34,.99,.10,.075);
  for(const x of [-.38,.38])for(const z of [-.31,.31])box(0x424242,x,.24,z,.048,.47,.05);
 }else if(id==='post-box'){
  box(0x365779,0,.55,0,.93,.62,.93);drum(0x365779,0,.84,0,.39,.45,.20);
  for(const x of [-.35,.35])for(const z of [-.30,.30])box(0x34383b,x,.13,z,.075,.26,.065);
 }else if(id==='pavement-menu'){
  for(const z of [-.28,.28])box(0x74604b,0,.51,z,.93,.94,.07);
  box(0x393c38,0,.54,.325,.78,.73,.016);
 }else if(id==='shop-register'){
  box(0x4f514d,0,.10,0,.77,.16,.88);box(0x373c3b,0,.47,0,.20,.67,.28);
  box(0x464b48,0,.70,0,.97,.55,.09);
 }else if(id==='produce-crate'){
  box(0x826347,0,.39,0,.98,.73,.95);
  for(const x of [-.29,0,.29])for(const z of [-.25,.12])part(new THREE.IcosahedronGeometry(.16,0),0xc89238,x,.79,z);
 }else if(id==='laundry-basket'||id==='leather-holdall'){
  box(id==='laundry-basket'?0xdbd8cc:0x806345,0,.47,0,.92,.82,.84);
 }else{return null;}
 const g=mergeGeos(parts);parts.forEach(p=>p.dispose());CITY_DETAIL.prototypes.set(id,g);return g;
}

function detailFallback(id,x,y,z,dims,angle){
 const geo=detailPrototype(id);if(!geo)return null;
 const key=id+':'+Math.floor(x/128)+':'+Math.floor(z/128);
 let batch=CITY_DETAIL.fallbacks.get(key);
 if(!batch){batch={geo,items:[],mesh:null};CITY_DETAIL.fallbacks.set(key,batch);}
 const M=new THREE.Matrix4().makeRotationY(angle);M.scale(new V3(...dims));M.setPosition(x,y,z);
 const index=batch.items.length;batch.items.push(M);
 let displayed=true;
 return visible=>{
  if(displayed===visible||!batch.mesh)return;
  displayed=visible;
  batch.mesh.setMatrixAt(index,visible?M:CITY_DETAIL.hidden);
  batch.mesh.instanceMatrix.needsUpdate=true;
 };
}
function finishCityDetail(){
 CITY_DETAIL.hidden=new THREE.Matrix4().makeScale(0,0,0);
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.71,metalness:.10});
 for(const batch of CITY_DETAIL.fallbacks.values()){
  const mesh=new THREE.InstancedMesh(batch.geo,material,batch.items.length);
  const bounds=new THREE.Box3();
  batch.geo.computeBoundingBox();
  batch.items.forEach((M,i)=>{mesh.setMatrixAt(i,M);bounds.union(batch.geo.boundingBox.clone().applyMatrix4(M));});
  // This version of three uses the geometry bound for frustum tests on instanced meshes.
  mesh.geometry=batch.geo.clone();mesh.geometry.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
  mesh.receiveShadow=true;mesh.castShadow=true;mesh.frustumCulled=true;batch.mesh=mesh;scene.add(mesh);
 }
}
function retailPhoto(index,M,x,y,z,w,h){
 const geo=new THREE.PlaneGeometry(w,h),uv=geo.attributes.uv;
 const u=index%4,v=3-Math.floor(index/4);
 for(let i=0;i<uv.count;i++)uv.setXY(i,(u+.008+uv.getX(i)*.984)/4,(v+.008+uv.getY(i)*.984)/4);
 geo.translate(x,y,z);if(M)geo.applyMatrix4(M);addGeo(CITY_DETAIL.shopFinish,geo,false);
}
function framedShopPrint(index,M,x,y,z,w,h){
 plainBox(INTERIORS.materials.darkWood,x-w/2-.030,x+w/2+.030,y-h/2-.030,y+h/2+.030,z-.055,z,{M});
 retailPhoto(index,M,x,y,z+.003,w,h);
}
function stockCooler(x,y,z){
 const m=INTERIORS.materials,width=1.80,h=2.13,depth=.86;
 worksSolid(worksRect(x-width/2,x+width/2,z-depth/2,z+depth/2),y,y+h,m.steel);
 plainBox(m.rubber,x-.87,x+.87,y+.14,y+1.99,z+.430,z+.456);
 for(const side of [-1,1]){
  const cx=x+side*.425;
  retailPhoto(5,null,cx,y+1.13,z+.46,.755,1.55);
  for(let k=0;k<5;k++)plainBox(m.steel,cx-.377,cx+.377,y+.42+k*.31,y+.432+k*.31,z+.462,z+.47);
  plainBox(m.chrome,cx-side*.34-.012,cx-side*.34+.012,y+.75,y+1.43,z+.477,z+.522);
 }
 for(let k=0;k<6;k++)plainBox(m.rubber,x-.79,x+.79,y+.052+k*.022,y+.06+k*.022,z+.433,z+.444);
}
function basketOnShelf(x,y,z){
 const m=INTERIORS.materials,geo=new THREE.CylinderGeometry(.235,.18,.18,24,1,true);
 const uv=geo.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(3.015+uv.getX(i)*.97)/4,(2.015+uv.getY(i)*.97)/4);
 geo.scale(1,1,.77);geo.translate(x,y+.09,z);addGeo(CITY_DETAIL.shopFinish,geo,true);
 cyl(m.darkWood,x,y+.01,z,.17,.17,.016,18);
 const handle=new THREE.TorusGeometry(.19,.014,6,20,Math.PI);
 handle.scale(1,1.23,1);handle.translate(x,y+.18,z);addGeo(m.darkWood,handle,true);
}
function dressMarketWindows(){
 const w=CITY_WORKS,m=w.m,store=INTERIORS.materials,y=w.levels[1],frontZ=w.market.z1;
 // Window islands and bread tables line the display glass while both entrances retain straight approaches.
 for(const [x,produce] of [[334.1,true],[346.6,true],[352.0,false],[367.5,false]]){
  const z=frontZ-2.38;
  worksSolid(worksRect(x-1.43,x+1.43,z-.53,z+.53),y,y+.73,store.darkWood);
  retailPhoto(8,null,x,y+.40,z+.533,2.77,.56);
  plainBox(store.cream,x-1.48,x+1.48,y+.73,y+.79,z-.56,z+.56);
  if(produce)for(const dx of [-.77,.27])worksModel('produce-crate',x+dx,y+.79,z,[.86,.46,.62],0,false);
  else worksModel('bakery-counter',x,y+.79,z,[2.34,.87,.67],0,false);
 }
 for(const x of [338.7,340.6,342.5])stockCooler(x,y,350.96);
 for(const x of [347.2,357.0]){
  // Keep a basket high enough to remain supported by the actual shelf.
  worksModel('pantry-shelf',x,y,366.1,[1.80,1.56,.48],Math.PI/2);
  basketOnShelf(x,y+1.56,366.1);
 }
 for(const x of [336.3,361.4])framedShopPrint(1,null,x,2.69,353.74,.83,.96);
 // Three fittings on the inside face of the south glazing, visible from the pavement.
 retailPhoto(3,null,340.93,1.85,frontZ-.13,.40,.24);
 retailPhoto(3,null,360.87,1.85,frontZ-.13,.40,.24);
 for(const x of [333.3,345.7,354.8,366.5]){
  plainBox(store.darkWood,x-.40,x+.40,2.02,2.046,frontZ-.52,frontZ-.21);
  for(const dx of [-.29,.29])worksBeam(m.iron,[x+dx,2.046,frontZ-.38],[x+dx,2.42,frontZ-.38],.010);
  retailPhoto(4,null,x,2.22,frontZ-.375,.62,.31);
 }
}
function dressReferenceShop(block,row,M,u0,u1,height,roomDepth){
 const w=u1-u0,center=(u0+u1)/2,angle=Math.atan2(M.elements[8],M.elements[10]),m=CITY_WORKS.m;
 const model=(id,u,y,v,dims,turn=0,solid=false)=>{
  const p=lpt(M,u,v);worksModel(id,p.x,y,p.z,dims,angle+turn,solid);
 };
 const line=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M,uvm:1.0});
 // A shallow cornice, drip mould, stone fascia and sill shadows carry across adjoining shops.
 for(const y of [4.07,height-.42])line(m.stone,u0-.04,u1+.04,y,y+.10,-.17,.18);
 const bays=Math.max(2,Math.round(w/2.9));
 for(let level=0;4.1+(level+1)*3.45<height;level++){
  const y=4.1+level*3.45+.65;
  for(let k=0;k<bays;k++){
   const x=u0+(k+.5)*w/bays;
   if((k+level+block.i)%6===1){
    line(m.enamel,x-.32,x+.32,y+.03,y+.35,.045,.38);
    for(const h of [.10,.17,.24])line(MAT.darkMetal,x-.25,x+.25,y+h,y+h+.018,.381,.387);
   }
  }
 }
 for(const x of [u0+.43,u1-.43]){
  line(MAT.metal,x-.030,x+.030,.28,height-.55,.025,.091);
  for(const y of [2.1,5.8,9.3])if(y<height)line(m.iron,x-.065,x+.065,y,y+.055,.015,.113);
 }
 const back=-roomDepth;
 if(row===RETAIL.cafe||row===RETAIL.donuts)framedShopPrint(1,M,center,2.76,back+.27,.72,.91);
 if(row===RETAIL.barber)framedShopPrint(2,M,center,2.91,back+.27,1.77,.58);
 if(row===RETAIL.studio||row===RETAIL.books)framedShopPrint(0,M,u1-.87,2.37,back+.32,.58,.75);
 retailPhoto(3,M,center+1.35,1.87,-.069,.36,.21);
 if(row===RETAIL.tailor){
  for(const x of [u0+1.02,u0+2.94]){
   line(MAT.wood,x-.68,x+.68,2.29,2.35,back+.11,back+.79);
   line(m.fabric,x-.53,x+.53,2.35,2.57,back+.18,back+.69);
   retailPhoto(6,M,x,2.46,back+.692,1.04,.21);
  }
 }
 if(row===RETAIL.books||row===RETAIL.cafe)model('pavement-menu',u0+.94,.17,-.68,[.58,1.04,.42],.10,true);
 if(row===RETAIL.deli)for(const x of [u0+1.0,u0+2.1])model('produce-crate',x,.17,-.58,[.87,.59,.65],0,true);
 if(row===RETAIL.laundry)model('laundry-basket',u0+2.1,1.106,3.43,[.53,.30,.43]);
 if(row===RETAIL.tailor)model('leather-holdall',u0+.98,2.36,6.12,[.53,.30,.25]);
 if(row===RETAIL.cafe)model('shop-register',center+w*.13,1.35,3.72,[.44,.39,.29],Math.PI);
}
function dressReferenceHouse(B,L,height){
 const f=lotFace(L,L.side),M=f.matrix,edge=f.width/2;
 plainBox(CITY_WORKS.m.enamel,-edge-.18,edge+.18,height-.06,height+.07,.08,.22,{M});
 plainBox(MAT.metal,edge-.24,edge-.17,.19,height,.11,.18,{M});
 if((B.i+B.j+Math.round(L.x0))%3===0){
  const u=-edge+.74,p=lpt(M,u,-.13);
  plainBox(CITY_WORKS.m.panel,u-.22,u+.22,.75,1.19,-.01,.19,{M});
  cyl(MAT.metal,p.x,.20,p.z,.024,.024,.60,7);
 }
 if((B.i+B.j+Math.round(L.x1))%4===0){
  const p=lpt(M,edge*.48,Math.min(f.depth*.42,3.4));
  plainBox(CITY_WORKS.m.brick,p.x-.37,p.x+.37,height+.15,height+2.45,p.z-.30,p.z+.30,{uvm:.8});
  plainBox(CITY_WORKS.m.stone,p.x-.43,p.x+.43,height+2.43,height+2.56,p.z-.36,p.z+.36,{uvm:1});
 }
}
function buildCityDetail(){
 for(const B of blocks){
  if(B.dist==='suburb'||B.dist==='docks'||B.park||(B.i*5+B.j*3)%11!==0)continue;
  const x=B.x0+1.12,z=B.z1-8.2;
  // Photo 092 places three cycle stands together in the furnishing strip.
  if(TREES.some(p=>Math.abs(p[0]-x)<1.6&&Math.abs(p[1]-z)<3.25))continue;
  if(PROPSPOTS.some(p=>Math.abs(p.x-x)<1.5&&Math.abs(p.z-z)<3.25))continue;
  PROPSPOTS.push({type:'postbox',x:x+.04,z:z+2.64,ry:-Math.PI/2});
  for(const offset of [-1.15,0,1.15]){
   const cz=z+offset,radius=.30,up=.65;
   for(const dx of [-radius,radius])worksBeam(MAT.metal,[x+dx,.15,cz],[x+dx,up,cz],.032);
   const arch=new THREE.TorusGeometry(radius,.032,6,12,Math.PI);
   arch.translate(x,up,cz);addGeo(MAT.metal,arch,true);
   STATIC.push({x0:x-radius-.032,x1:x+radius+.032,z0:cz-.033,z1:cz+.033,y0:.15,h:up+radius});
  }
 }
 for(const [x,z,yaw] of [[W+33,120,0],[W+42,630,Math.PI]])buildBeachLookout(x,z,yaw);
 finishCityDetail();
}

function buildBeachLookout(x,z,yaw){
 const ground=.022,M=new THREE.Matrix4().makeRotationY(yaw);M.setPosition(x,0,z);
 const center=lpt(M,.26025,0);
 worksModel('rescue-hut',center.x,ground,center.z,[5.0205,4.6944,2.84],yaw,false);
 const box=(x0,x1,z0,z1,base,top,deck=false)=>{
  const r=lrect(M,x0,x1,-z1,-z0);
  STATIC.push({...r,y0:ground+base,h:ground+top,walkIgnore:deck});
  if(deck)STREET.steps.push({...r,y:ground+top,elevated:true});
 };
 box(-2.03,.45,-1.265,1.265,1.83,1.98,true);
 for(let j=0;j<10;j++){
  const cx=.56+j*.232,top=1.95-j*.194;
  box(cx-.1225,cx+.1225,-.37,.63,top-.08,top,true);
  for(const rz of [-.37,.63])box(cx-.116,cx+.116,rz-.026,rz+.026,top,top+.91);
 }
 for(const u of [-1.83,.25])for(const v of [-1.02,1.02])box(u-.08,u+.08,v-.08,v+.08,0,1.98);
 for(const v of [-.91,.91])box(-1.86,.28,v-.055,v+.055,1.98,3.90);
 box(-1.88,-1.77,-.92,.92,1.98,3.90);
 for(const v of [-.715,.715])box(.18,.295,v-.21,v+.21,1.98,3.90);
 box(-2.25,.67,-1.42,1.42,3.887,3.984);
}

function initRetailFascias(){
 const shopTexture=TLD.load('tex/reference-shop-fittings.jpg');shopTexture.encoding=THREE.sRGBEncoding;shopTexture.anisotropy=8;
 CITY_DETAIL.shopFinish=new THREE.MeshStandardMaterial({map:shopTexture,roughness:.62,metalness:.06});
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 const shops=[
  [RETAIL.laundry,'Wash House Laundromat','WASH · DRY · FOLD','#374c69'],
  [RETAIL.donuts,'Night Shift Donuts','BAKERY & COFFEE','#723e48'],
  [RETAIL.books,'Paper & Pine Books','BOOKS · COFFEE','#434b45'],
  [RETAIL.studio,'Verve Nail Studio','NAILS & BEAUTY','#794e5c'],
  [RETAIL.deli,'Ferris Market','GROCERIES · PRODUCE','#385647'],
  [RETAIL.tailor,'Juniper Tailor','ALTERATIONS','#303e53'],
  [RETAIL.cafe,'Maré Coffee Co.','COFFEE · PASTRIES','#38514d'],
  [RETAIL.barber,'Coastal Barber','CUTS & SHAVES','#34363a']
 ];
 for(let i=0;i<shops.length;i++){
  const [row,title,sub,color]=shops[i],y=i*128;
  ctx.fillStyle=color;ctx.fillRect(0,y,1024,128);
  ctx.fillStyle='rgba(255,249,225,.34)';ctx.fillRect(10,y+12,1004,1);ctx.fillRect(10,y+114,1004,1);
  ctx.fillStyle='#f2e7ce';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=(row===RETAIL.donuts?'italic ':'')+'56px Georgia, serif';ctx.fillText(title,463,y+64,665);
  ctx.font='14px Arial, sans-serif';ctx.fillText(sub,877,y+65,188);
  row.fasciaV=[1-(y+126)/1024,1-(y+2)/1024];row.fasciaColor=color;
 }
 CITY_DETAIL.fasciaMaterial=new THREE.MeshStandardMaterial({map:ctex(canvas),roughness:.68,metalness:.12});
}
function referenceFascia(row,M,u0,u1,y){
 const width=u1-u0-.46,height=.72;
 const geo=new THREE.PlaneGeometry(width,height);
 const uv=geo.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i),lerp(row.fasciaV[0],row.fasciaV[1],uv.getY(i)));
 geo.translate((u0+u1)/2,y,.113);geo.applyMatrix4(M);addGeo(CITY_DETAIL.fasciaMaterial,geo,false);
}
