/* Hand-built shopfronts, street surfaces and coastal details. */
const STREET={steps:[],materials:{},lights:[],sample:0};
const RETAIL={
 laundry:{label:'WASH HOUSE',kind:'LAUNDROMAT',style:0,background:'#1a355a',letter:'#daeaff',brick:0x7e6d68},
 studio:{label:'VERVE',kind:'NAIL STUDIO',style:1,background:'#572942',letter:'#ffb4e2',brick:0x9b9391},
 books:{label:'PAPER & PINE',kind:'BOOKS · COFFEE',style:2,background:'#2a2520',letter:'#ebd7ad',brick:0x92736a},
 barber:{label:'COASTAL',kind:'BARBER',style:3,background:'#221f1d',letter:'#f6e4c7',brick:0xe4c5c0},
 donuts:{label:'NIGHT SHIFT',kind:'DONUTS',style:2,background:'#773047',letter:'#ffc9d5',brick:0xbe9a8a},
 deli:{label:'FERRIS',kind:'DELI',style:2,background:'#253f30',letter:'#dbedc9',brick:0xaeb0a3},
 tailor:{label:'JUNIPER',kind:'TAILOR',style:1,background:'#242944',letter:'#d5d7f9',brick:0xa59b8e},
 cafe:{label:'MARÉ',kind:'COFFEE',style:2,background:'#1d4143',letter:'#d1eee9',brick:0xbdd2cc}
};

function initStreetMaterials(){
 const m=STREET.materials;
 m.glass=shopGlazing();
 m.pipe=new THREE.MeshStandardMaterial({color:lin(0x3c3a36),metalness:.72,roughness:.7});
 m.brass=new THREE.MeshStandardMaterial({color:lin(0x947957),metalness:.78,roughness:.42});
 m.bulb=new THREE.MeshBasicMaterial({color:new THREE.Color(3.1,2.25,1.42)});
 m.iron=new THREE.MeshStandardMaterial({color:lin(0x3e3b36),roughness:.76,metalness:.72});
 m.rubber=new THREE.MeshStandardMaterial({color:lin(0x252525),roughness:1});
 m.mulch=pbr('grass',1.15,{rough:.99,color:0x736455,ns:.7});
 m.shopStone=pbr('stone_light',.95,{color:0xb6aea1,rough:.84,ns:.28});
 m.wornSlab=pbr('concrete',2.1,{rough:.83,color:0x938a7d});
 m.passage=pbr('brick_red',2.4,{color:0x8e6a60,rough:.87,ns:1.35});
 m.coastSand=beachMaterial();
 m.leaves=[0x54502d,0x9e6336,0x61452e,0xa37c45].map(color=>
  new THREE.MeshStandardMaterial({color:lin(color),roughness:1,side:THREE.DoubleSide}));
 m.shopLight=new THREE.MeshBasicMaterial({
  map:glowTex(),color:new THREE.Color(1.42,.83,.41),transparent:true,
  opacity:.19,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2
 });
 m.cyan=new THREE.MeshBasicMaterial({color:new THREE.Color(.19,1.85,2.55)});
 m.rose=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.61,1.26)});
 m.barberPole=makeBarberPole();

 for(const row of Object.values(RETAIL)){
  row.sign=atlasSlot((ctx,w,h)=>{
   ctx.fillStyle=row.background;
   ctx.fillRect(0,0,w,h);
   ctx.strokeStyle='rgba(240,226,204,.38)';
   ctx.strokeRect(15,12,w-30,h-24);
   ctx.fillStyle=row.letter;
   ctx.textAlign='center';
   ctx.font='600 21px Georgia, serif';
   ctx.fillText(row.label,w/2,44);
   ctx.font='600 52px Inter, Arial, sans-serif';
   ctx.fillText(row.kind,w/2,97);
  });
 }
 ATLAS.mat.map.needsUpdate=true;
}

function makeBarberPole(){
 const [canvas,ctx]=cvs(64,128);
 ctx.fillStyle='#e8ddd1';
 ctx.fillRect(0,0,64,128);
 for(let i=-1;i<5;i++){
  ctx.fillStyle=i%2?'#ac2d37':'#35608c';
  ctx.beginPath();
  ctx.moveTo(0,i*38);
  ctx.lineTo(64,i*38+40);
  ctx.lineTo(64,i*38+53);
  ctx.lineTo(0,i*38+13);
  ctx.fill();
 }
 const texture=ctex(canvas);
 return new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:new THREE.Color(.47,.43,.41),roughness:.4});
}



function facadePlane(mat,M,x0,x1,y0,y1,z){
 const g=new THREE.PlaneGeometry(x1-x0,y1-y0);
 g.translate((x0+x1)/2,(y0+y1)/2,z);
 g.applyMatrix4(M);
 addGeo(mat,g,false);
}

function shopFacade(block,row,M,u0,u1,storey,coastal,riverside=false){
 const m=STREET.materials,width=u1-u0,center=(u0+u1)/2,yHead=3.53;
 const material=coastal?MAT.fac.stucco:MAT.fac.brick_tan;
 const texMat=coastal?MAT.trim:m.shopStone;
 const depth=coastal?16:17.5,roomDepth=6.65;
 const main=lrect(M,u0,u1,0,depth);
 const buildingArgs={style:coastal?4:1,fh:3.45,bay:coastal?3.15:2.82,tint:row.brick,top:storey,gH:4.1,seed:(Math.abs(u0)+.31)/30};
 facadeBox(material,main.x0,main.x1,4.1,storey,main.z0,main.z1,{...buildingArgs,frontYaw:Math.atan2(M.elements[8],M.elements[10])});
 buildUpperShopFront(block,M,u0,u1,storey,coastal);
 rememberShopGlass(M,u0,u1);
 const back=lrect(M,u0,u1,roomDepth+(hasStockRoom(row)?2.25:0),depth);
 facadeBox(material,back.x0,back.x1,.15,4.1,back.z0,back.z1,{...buildingArgs,style:3,fh:6});
 roofDressing(main,storey,coastal?'deco':'old');
 const box=(mat,x0,x1,a,b,z0,z1,opts={})=>plainBox(mat,x0,x1,a,b,z0,z1,{M,uvm:2.1,...opts});
 for(const x of [u0,u1-.32])box(texMat,x,x+.32,.15,4.2,-1.1,.17);
 box(texMat,u0,u1,3.94,4.23,-1.15,.19);
 const door0=center-.68,door1=center+.68;
 for(const [a,b] of [[u0,door0],[door1,u1]])box(texMat,a,b,.15,.43,-.31,.06,{shadow:false});
 box(MAT.darkMetal,u0+.22,u1-.22,3.29,3.98,-.09,.075);
 box(coastal?MAT.whiteMetal:texMat,u0-.06,u1+.06,storey-.55,storey-.30,-.21,.28);

 for(const [a,b] of [[u0+.34,door0],[door1,u1-.34]]){
  facadePlane(m.glass,M,a,b,.42,3.32,-.035);
  const panels=Math.max(2,Math.round((b-a)/1.7));
  for(let k=0;k<=panels;k++){
   const x=lerp(a,b,k/panels);
   box(MAT.darkMetal,x-.029,x+.029,.42,yHead,-.081,.019,{shadow:false});
  }
  box(MAT.darkMetal,a,b,2.68,2.74,-.087,.04,{shadow:false});
  box(MAT.darkMetal,a,b,3.28,3.34,-.087,.04,{shadow:false});
 }
 for(const x of [door0,door1])box(MAT.darkMetal,x-.035,x+.035,.22,3.31,-.083,.093,{shadow:false});
 box(MAT.darkMetal,door0-.03,door1+.03,2.81,2.88,-.083,.13,{shadow:false});
 facadePlane(m.glass,M,door0,door1,2.88,3.28,-.035);
 box(m.brass,door0-.027,door1+.027,.166,.19,-.12,.14,{shadow:false});
 registerDoor(M,center,.027,.175,door1-door0-.071,2.60,'glass');
 if(riverside)riversideFascia(row,M,u0,u1);
 else referenceFascia(row,M,u0,u1,3.65);
 topQuad(m.shopLight,u0-.15,u1+.15,.172,.15,4.35,4.2,M,false);
 for(const k of [-.29,.29]){
  const x=center+width*k;
  box(m.bulb,x-.58,x+.58,3.2,3.24,-.55,-.29,{shadow:false});
 }
 if(coastal){
  const stripe=row===RETAIL.barber?m.rose:m.cyan;
  box(stripe,u0+.12,u1-.12,4.25,4.30,-.02,.13,{shadow:false});
  box(MAT.trim,u0-.12,u1+.12,7.2,7.35,-.12,.27);
 }
 if(row===RETAIL.barber){
  for(const x of [u0+.63,u1-.63]){
   const p=lpt(M,x,-.186),yaw=Math.atan2(M.elements[8],M.elements[10]);
   worksModel('barber-pole',p.x,1.58,p.z,[.258,.91,.306],yaw,false);
  }
 }
 buildInterior({block,M,u0,u1,door0,door1,row,depth:roomDepth});
 dressReferenceShop(block,row,M,u0,u1,storey,roomDepth);
 block.bld.push({...back,h:4.1},{...main,y0:3.55,h:storey});
 return main;
}

function buildShopRow(block,side,shops,coastal=false){
 const M=sideFrame(block,side);
 for(const [name,u0,u1,h] of shops)shopFacade(block,RETAIL[name],M,u0,u1,h,coastal);
 if(!coastal){
  // The back lane stays walkable all the way through the lot.
  const rear=lrect(M,-19.9,21,24.8,39.9);
  building(block,rear,block.i===3?32.6:54.1,{
   mat:MAT.fac[block.i===3?'brick_dark':'tiles'],style:block.i===3?1:2,fh:3.75,bay:2.6,shops:false,cornice:true,kind:'mid'
  });
 }
 return M;
}

function buildAuthoredBlock(block){
 const key=block.i+','+block.j;
 if(block.i===HARBOR_SUPPLY.i&&block.j===HARBOR_SUPPLY.j){buildHarborSupply(block);return true;}
 if(block.i===15&&(block.j===13||block.j===15)){buildDockWorkshops(block);return true;}
 if((block.i===11||block.i===12)&&(block.j===2||block.j===3)){buildGardenCottages(block);return true;}
 if(key==='4,6'){
  const M=sideFrame(block,'N');
  shopFacade(block,RETAIL.laundry,M,-19.80,-6.14,12.42,false);
  for(const [id,l,r] of [['donuts',-6.14,2.62],['books',2.62,11.22],['studio',11.22,19.82]]){
   shopFacade(block,RETAIL[id],M,l,r,11.05,false,true);
  }
  const rear=lrect(M,-19.8,19.82,25.9,39.75);
  building(block,rear,10.28,{mat:MAT.fac.brick_red,style:1,fh:3.40,bay:2.78,shops:false,cornice:true,kind:'old'});
  return true;
 }
 if(key==='3,5'){
  const M=buildShopRow(block,'E',[
   ['laundry',-21.5,-9.1,15.0],['donuts',-9.1,.2,15.0],
   ['books',2.95,11.1,18.5],['studio',11.1,21.5,18.5]
  ]);
  buildPassage(M);
  return true;
 }
 if(key==='4,5'){
  buildShopRow(block,'W',[['deli',-21.5,-7.5,18.4],['tailor',-7.5,3.1,18.4],['cafe',3.1,21.5,22.2]]);
  return true;
 }
 if(key==='7,4'||key==='15,4'){
  const M=buildShopRow(block,'W',[['barber',-20.8,-6.9,11.2],['tailor',-6.9,4.1,14.8],['cafe',4.1,21.4,14.8]],true);
  const back=lrect(M,-20,21,22,39.9);
  building(block,back,20.6,{mat:MAT.fac.stucco,style:4,fh:3.5,bay:2.7,shops:false,tint:0xcad7d0,kind:'deco'});
  return true;
 }
 return false;
}

function buildPassage(M){
 const m=STREET.materials,left=.22,right=2.94;
 topQuad(MAT.sidewalk,left,right,.158,-23,.25,2.3,M,false);
 plainBox(m.passage,left-.07,left,.15,5,-17.5,0,{M,uvm:2.4});
 // Interior display windows alternate with exposed, stained masonry.
 const paneM=M.clone().multiply(new THREE.Matrix4().makeTranslation(right,0,0));
 paneM.multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2));
 for(let i=0;i<2;i++){
  const x0=-.10-i*3.24,x1=x0-2.86;
  facadePlane(m.glass,paneM,x1,x0,.47,3.16,.035);
  for(const u of [x0,x1,(x0+x1)*.5]){
   plainBox(MAT.darkMetal,u-.022,u+.022,.44,3.2,.035,.069,{M:paneM});
  }
  for(const y of [.43,2.11,3.17])plainBox(MAT.darkMetal,x1,x0,y,y+.045,.035,.069,{M:paneM});
  plainBox(m.bulb,x1+.15,x1+.64,3.31,3.38,.1,.32,{M:paneM,shadow:false});
  topQuad(m.shopLight,left,right,.172,x1,x0,3,M,false);
  plainBox(m.pipe,left+.043,left+.09,.15,6.2,x1-.09,x1-.043,{M});
 }
}

function streetDetails(block){
 const {x0,x1,z0,z1,dist}=block;
 const m=STREET.materials;
 const edges=[
  [x0,z0,0],[x1,z0,1],[x1,z1,2],[x0,z1,3]
 ];
 for(const [x,z,edge] of edges){
  const rot=edge*Math.PI/2;
  const M=new THREE.Matrix4().makeRotationY(-rot);
  M.setPosition(x,0,z);
  if(dist!=='docks'&&dist!=='beach'){
   for(let i=0;i<12;i++){
    const t=2+srange(0,44),r=.034+srange(0,.061),zLocal=.26+srange(0,2.85);
    topQuad(spick(m.leaves),t-r,t+r,.158,zLocal-r*.65,zLocal+r*.65,1,M,false);
   }
  }
 }

}

function finishStreetDetails(){
 const m=STREET.materials;
 for(const tree of TREES){
  if(Math.abs(tree[0]-246.8)<.9&&Math.abs(tree[1]-337)<1.3)tree[1]+=6.15;
  const [x,z,size]=tree;
  const rTree=.17+size*.06;
  STATIC.push({x0:x-rTree,x1:x+rTree,z0:z-rTree,z1:z+rTree,h:2.65*size});
  const block=blockOf(x,z);
  if(!block||block.park||block.dist==='suburb')continue;
  const r=.66+size*.17;
  topQuad(m.mulch,x-r,x+r,.158,z-r,z+r,1.7,null,false);
  for(const s of [-1,1]){
   plainBox(m.iron,x-r,x+r,.158,.181,z+s*r-.024,z+s*r+.024,{shadow:false});
   plainBox(m.iron,x+s*r-.024,x+s*r+.024,.158,.181,z-r,z+r,{shadow:false});
  }
 }
 for(const [x,z,size] of PALMS){
  const r=.13+size*.05;
  STATIC.push({x0:x-r,x1:x+r,z0:z-r,z1:z+r,h:4.1*size});
 }

 for(let i=0;i<4;i++){
  const light=new THREE.PointLight(0xffbb78,0,17,2);
  STREET.lights.push(light);
  scene.add(light);
 }
}

function updateStreetLighting(dt,x,z){
 const level=weather.lamps;
 PROPS.glow.visible=PROPS.heads.visible=level>.015;
 PROPS.glow.material.opacity=.72*level;
 PROPS.heads.material.color.setRGB(3*level,2.3*level,1.5*level);
 if(level<=.015){
  for(const light of STREET.lights)light.intensity=0;
  STREET.sample=0;return;
 }
 if((STREET.sample-=dt)>0)return;
 STREET.sample=.36;
 const active=PROPS.list.filter(p=>p.P.glow&&!p.moved&&cityPowerAt(p.x,p.z)&&Math.abs(p.x-x)<24&&Math.abs(p.z-z)<24);
 active.sort((a,b)=>(a.x-x)**2+(a.z-z)**2-(b.x-x)**2-(b.z-z)**2);
 for(let i=0;i<STREET.lights.length;i++){
  const light=STREET.lights[i],p=active[i];
  if(p){
   const at=lampEmitter(p);light.position.set(at.x,at.y-.20,at.z);
   light.intensity=3.8*level;
  } else light.intensity=0;
 }
}
