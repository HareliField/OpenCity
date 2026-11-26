/* Harbor Supply faces Dock Street. The rear stock yard stays inside the developable lot. */
const HARBOR_SUPPLY={i:15,j:14,roof:7.12,doors:[],truck:null};
// Custom chassis dimensions follow the Blender cab, cargo shell and tyre pivots.
CARSPEC.harborbox={...CARSPEC.van,type:'harborbox',modelName:'Harbor Supply delivery truck',
 L:6.70,W:2.16,r:3.073,wb:1.92,wr:.397,hb:1.26,b:1.26,hood:1.06,tr:.05,ws:.61,rg:.09,
 com:.91,mass:3450,brake:138,F:14400,max:28,hp:185,wheelTile:CARSPEC.van.wheelTile,
 // Dimensions are longitudinal, vertical and lateral in the physics chassis frame. The nose is negative X.
 chassisBoxes:[[-.01,.66,0,6.42,.41,1.78],[1.03,.963,0,4.40,.179,2.13],
  [1.03,2.019,-1.05,4.40,2.06,.035],[1.03,2.019,1.05,4.40,2.06,.035],
  [-1.161,2.019,0,.05,2.06,2.13],[1.03,3.042,0,4.44,.075,2.16],
  [-1.42,1.43,0,.75,1.48,1.74],[-2.02,1.35,0,.50,1.02,1.71],[-2.75,.928,0,1.05,.56,1.72]]};
function parkReferenceVehicles(){
 const photos=[['sedan','silver-city-sedan',1002.1,14*CELL+6.6,Math.PI/2,0xb5b4ae],
  ['sedan','graphite-city-saloon',10*CELL+parkingCenter(streetSection('ns',10,9),-1),9*CELL+30.5,Math.PI,0x28323e],
  ['rav4','brick-red-crossover',293,4*CELL+6.6,Math.PI/2,0x763522]];
 const bay=HARBOR_SUPPLY.truck;
 if(bay)photos.push(['harborbox','harbor-box-truck',bay.x,bay.z,bay.h,0xd9d8ce]);
 for(const [type,asset,x,z,h,colour] of photos){
  const car=spawnCar(type,x,z,h,null);
  paintCar(car,colour);car.keep=true;car.heroWanted=true;car.heroAsset=asset;
 }
 // The curb queue in photograph 001 extends north along Palm. Keep crosswalks and access aprons clear.
 for(const [j,z,pSide,type,colour] of [
  [9,21,1,'civic',0xb6b4a9],[9,39,1,'rav4',0x516359],[9,20,-1,'sedan',0x787f83],
  [8,23,1,'sedan',0xc4bdb0],[8,32,-1,'miata',0x933d36],[8,42,1,'civic',0x58676b],
  [7,30,1,'mustang',0x426270],[7,23,-1,'sedan',0xa9a9a4],[6,36,1,'rav4',0x756452]]){
  const section=streetSection('ns',10,j),offset=parkingCenter(section,pSide);
  if(offset==null)continue;
  const x=10*CELL-pSide*offset,at=j*CELL+z;
  if(nearDriveway(x,at,3)||cars.some(c=>Math.hypot(c.pos.x-x,c.pos.z-at)<6.6))continue;
  const c=spawnCar(type,x,at,pSide>0?0:Math.PI,null);paintCar(c,colour);c.keep=true;
 }

}
function supplyWall(block,side,R,openings,site=HARBOR_SUPPLY){
 const {matrix:M,width}=lotFace(R,side),half=width/2,roof=site.roof,bottom=.17;
 const plate=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M,uvm:1.45});
 const collider=(l,r,b,t,inner=.22,out=.013,glass=false)=>addRoomCollider(block,M,l,r,-out,inner,t,b,glass);
 const xs=[...new Set([-half,half,...openings.flatMap(o=>[o.left,o.right])])].sort((a,b)=>a-b);
 const ys=[...new Set([bottom,roof,...openings.flatMap(o=>[o.base,o.top])])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const l=xs[i-1],r=xs[i],b=ys[j-1],t=ys[j],cx=(l+r)/2,cy=(b+t)/2;
  if(openings.some(o=>cx>o.left&&cx<o.right&&cy>o.base&&cy<o.top))continue;
  plate(site.cladding,l,r,b,t,-.22,.012);collider(l,r,b,t);
  if(side==='N'&&site.face){
   const face=new THREE.PlaneGeometry(r-l,t-b),uv=face.attributes.uv;
   for(let k=0;k<uv.count;k++)uv.setXY(k,(l+half+uv.getX(k)*(r-l))/width,(b-bottom+uv.getY(k)*(t-b))/(roof-bottom));
   face.translate((r+l)*.5,(t+b)*.5,.016);face.applyMatrix4(M);addGeo(site.face,face,true);
  }
 }
 for(const o of openings){
  const l=o.left,r=o.right,b=o.base,t=o.top,centre=(l+r)/2;
  for(const edge of [l,r])plate(MAT.darkMetal,edge-.033,edge+.033,b,t+.035,-.2,.05);
  plate(MAT.darkMetal,l-.039,r+.039,t-.022,t+.045,-.22,.072);
  if(o.kind!=='window'){
   const door=registerDoor(M,centre,.015,b,r-l-.073,t-b-.052,o.kind);
   if(site.doors)site.doors.push(door);
   if(o.kind==='shutter'){
    plate(MAT.shutter,l-.094,r+.094,t+.11,t+.52,-.351,-.077);
    for(const edge of [l,r])plate(MAT.metal,edge-.071,edge+.071,b+.01,t+.24,-.17,-.076);
   }
  }else{
   facadePlane(STREET.materials.glass,M,l,r,b,t,-.122);
   rememberShopGlass(M,l,r);
   collider(l,r,b,t,.135,-.09,true);
   plate(MAT.metal,l-.062,r+.062,b-.048,b+.038,-.18,.094);
   const panes=Math.max(2,Math.round((r-l)/.91));
   for(let j=1;j<panes;j++){const x=lerp(l,r,j/panes);plate(MAT.darkMetal,x-.019,x+.019,b,t,-.135,-.066);}
   for(const y of [lerp(b,t,.52),lerp(b,t,.84)])plate(MAT.darkMetal,l,r,y-.019,y+.019,-.139,-.064);
  }
 }
}
function buildHarborSupply(block){
 const site=HARBOR_SUPPLY,m=CITY_WORKS.m,base=.17;
 const R=worksRect(block.x1-SW-27.8,block.x1-SW-.38,block.z0+SW+1.46,block.z0+SW+21.60);
 site.R=R;site.cladding=pbr('corrugated',1.36,{rough:.75,metal:.36,color:0xd5d1bf,ns:.51,env:.37});
 const mid=(R.x0+R.x1)/2,cz=(R.z0+R.z1)/2;
 const hole=(left,right,base,top,kind='window')=>({left,right,base,top,kind});
 site.face=pbr('harbor-sheet',1,{rough:.78,metal:.14,ns:.46,env:.40});
 supplyWall(block,'N',R,[
  hole(-10.90,-9.53,3.79,5.57),hole(3.93,6.31,3.76,5.56),
  hole(-6.74,-3.92,.29,3.61),hole(-3.90,-2.88,base,2.66,'glass'),hole(-2.86,-1.84,base,2.66,'glass'),
  hole(-3.90,-1.84,2.72,3.61),hole(-1.82,.83,.29,3.61),
  hole(8.71,9.77,.29,3.55),hole(9.79,10.94,base,2.67,'glass'),hole(9.79,10.94,2.72,3.55),hole(10.97,12.04,.29,3.55)]);
 supplyWall(block,'E',R,[hole(-5.26,-3.33,4.51,5.86),hole(2.65,5.05,4.51,5.86)]);
 supplyWall(block,'S',R,[hole(4.33,5.77,base,2.32,'wood'),hole(-7.0,-4.6,4.57,5.86)]);
 supplyWall(block,'W',R,[hole(-4.52,.44,base,3.93,'shutter'),hole(3.44,5.62,4.47,5.79)]);
 topQuad(STREET.materials.wornSlab,R.x0,R.x1,base,R.z0,R.z1,1.7,null,false);
 STREET.steps.push({...R,y:base});
 plainBox(pbr('quay-roof',1.45,{rough:.93,ns:.54,env:.28}),R.x0,R.x1,site.roof,site.roof+.18,R.z0,R.z1,{uvm:2.81});
 block.bld.push({...R,y0:site.roof,h:site.roof+.18});
 for(const [side,span] of [['N',R.x1-R.x0],['S',R.x1-R.x0],['E',R.z1-R.z0],['W',R.z1-R.z0]]){
  const M=lotFace(R,side).matrix;
  plainBox(MAT.trim,-span/2-.055,span/2+.055,site.roof+.14,site.roof+.31,-.135,.058,{M,uvm:1.4});
  plainBox(MAT.metal,-span/2-.073,span/2+.073,site.roof+.30,site.roof+.34,-.146,.072,{M});
 }
 const root=lotFace(R,'N').matrix,front=(mat,u0,u1,b,t,z0,z1)=>plainBox(mat,u0,u1,b,t,z0,z1,{M:root,uvm:1});
 const sign=new THREE.MeshStandardMaterial({map:TLD.load('tex/harbor-fascia.webp'),roughness:.60,metalness:.13});
 sign.map.encoding=THREE.sRGBEncoding;sign.map.anisotropy=8;
 front(m.iron,-6.78,.86,4.15,6.15,.017,.103);facadePlane(sign,root,-6.71,.79,4.20,6.10,.112);
 front(site.cladding,-7.24,1.41,site.roof+.12,site.roof+.47,-.26,.019);
 front(MAT.metal,-7.28,1.45,site.roof+.455,site.roof+.51,-.28,.078);
 for(const u of [-5.4,-3.43,-.86,10.33]){
  const p=lpt(root,u,-.42);
  worksBeam(m.iron,[p.x,site.roof+.13,R.z0-.022],[p.x,site.roof+.19,R.z0-.387],.021);
  worksBeam(m.iron,[p.x,site.roof+.19,R.z0-.387],[p.x,site.roof-.24,R.z0-.416],.019);
  worksModel('enamel-pendant',p.x,site.roof-.40,p.z,[.30,.17,.30],0,false);
 }
 for(const u of [-13.42,1.54,13.43]){
  const p=lpt(root,u,-.13);
  worksBeam(m.iron,[p.x,.22,p.z],[p.x,site.roof+.17,p.z],.055);
  for(const h of [.51,2.71,5.30])front(MAT.metal,u-.091,u+.091,h,h+.042,.087,.181);
 }
 // Samples of stocked shelving sit behind the front glazing and leave each door approach open.
 for(const [u,width] of [[-5.29,2.14],[-.51,2.12],[11.51,.74]]){
  const p=lpt(root,u,1.16);worksModel('hardware-stock-rack',p.x,base,p.z,[width,1.83,.48],Math.PI,true);
 }
 // Rolled steel roof joists slope beside glazed roof lights. Pipes and rain leaders follow the outer walls.
 for(let z=R.z0+2.25;z<R.z1-.75;z+=3.12){
  plainBox(MAT.darkMetal,R.x0+.22,R.x1-.22,6.68,6.75,z-.094,z+.094);
  plainBox(MAT.metal,R.x0+.22,R.x1-.22,6.73,7.01,z-.025,z+.025);
 }
 for(const [x,z] of [[mid-7.2,cz-3.5],[mid+5.25,cz+5.6],[mid-5.30,cz+4.1]]){
  worksModel('factory-skylight',x,site.roof+.184,z,[1.64,.35,1.15],0,false);
 }
 worksModel('condenser-bank',mid+6.80,site.roof+.184,cz-4.20,[2.52,1.21,1.40],0,false);
 for(const [x,z] of [[mid-4.18,cz-4.15],[mid+3.36,cz+3.38]])worksModel('galvanized-roof-vent',x,site.roof+.184,z,[.90,.67,.84],0,false);
 const lampMat=new THREE.MeshStandardMaterial({color:lin(0xe5e3cf),emissive:0xffe7bc,emissiveIntensity:1.3,roughness:.48});
 site.light=lampMat;
 for(const x of [mid-7,mid+1.1,mid+8.4])for(const row of [R.z0+5.3,R.z1-5.0]){
  for(const offset of [-.72,.72])worksBeam(m.iron,[x+offset,6.68,row],[x+offset,4.86,row],.014);
  plainBox(MAT.metal,x-1,x+1,4.83,4.93,row-.128,row+.128);
  plainBox(lampMat,x-.88,x+.88,4.815,4.838,row-.096,row+.096);
  INTERIORS.emitters.push({x,y:4.82,z:row,cool:true,floorY:base});
 }
 // Keep the main street entrance and the two stock-handling door approaches clear over their full depth.
 for(const x of [mid-9.4,mid-5.9,mid+5.9,mid+9.4])for(const z of [R.z0+4.96,R.z0+8.52]){
  worksModel('hardware-stock-rack',x,base,z,[2.39,2.03,.62],0,true);
 }
 for(const x of [mid-8.6,mid-4.7,mid+.5])worksModel('hardware-stock-rack',x,base,R.z1-1.17,[2.39,2.03,.62],Math.PI,true);
 worksFurniture(block,'counter',mid+3.82,base,R.z1-5.70,3.38,1.02,.81);
 worksModel('shop-register',mid+3.75,base+1.02,R.z1-5.70,[.42,.38,.30],Math.PI,false);
 worksPanel(mid+3.82,base,R.z1-4.82,()=>CITY_WORKS.workLight?'WORK LIGHT PURCHASED':'BUY WORK LIGHT · $18',()=>{
  if(CITY_WORKS.workLight)return;
  if(!cityPowerAt(mid,cz))return toast('Register offline',1200);
  if(player.cash<18)return toast('Insufficient cash',1300);
  player.cash-=18;CITY_WORKS.workLight=true;toast('Portable work light · $18',1400);
 });
 plainBox(m.iron,R.x1-3.04,R.x1-1.52,base,base+.95,R.z1-2.05,R.z1-1.26);
 block.bld.push({x0:R.x1-3.04,x1:R.x1-1.52,z0:R.z1-2.05,z1:R.z1-1.26,y0:base,h:base+.95});
 buildBasin(R.x1-2.17,base,R.z1-1.63);
 const yard=worksRect(block.x0+SW+.37,block.x1-SW-.38,R.z1+.62,block.z1-SW-.41);
 topQuad(STREET.materials.wornSlab,yard.x0,yard.x1,.161,yard.z0,yard.z1,3.3,null,false);
 for(const [x,z,n,paint] of [[yard.x0+1.3,yard.z0+2,2,0x944c39],[yard.x0+1.3,yard.z0+5,2,0x3d6060],
  [yard.x0+8,yard.z0+2,1,0x526978],[yard.x0+8,yard.z0+5,2,0xa28344]]){
  for(let k=0;k<n;k++)plainBox(MAT.container,x,x+6.06,.161+k*2.59,.161+(k+1)*2.59,z,z+2.44,{tint:paint,uvm:1.1});
  block.bld.push({x0:x,x1:x+6.06,z0:z,z1:z+2.44,y0:.15,h:.161+n*2.59});
 }
 for(let i=0;i<4;i++){
  worksModel('quay-drum',mid-3.92-i*.67,base,R.z0-.78,[.59,.89,.59],0,true);
  const x=mid+10.52-(i%2)*1.42,z=R.z0-.76;
  worksModel('cargo-pallet',x,base+Math.floor(i/2)*.146,z,[1.20,.146,.80],0,true);
 }
 site.truck={x:block.x0+SW+6.70,z:cz+3.50,h:Math.PI};
 const drive=site.truck.x,half=2.42,key=drivewayKey('ew',block.j,block.i);
 if(!DRIVEWAYS.has(key))DRIVEWAYS.set(key,[]);
 DRIVEWAYS.get(key).push({side:1,center:drive-block.i*CELL,half});
 // At the broad industrial frontage the lamp sits at the east corner outside the signs and approach.
 for(let i=LAMPS.length-1;i>=0;i--){
  const p=LAMPS[i];if(p.x>block.x0&&p.x<block.x1&&Math.abs(p.z-(block.z0+.76))<.05)LAMPS.splice(i,1);
 }
 LAMPS.push({x:block.x1-2.47,z:block.z0+.77,ry:Math.PI});
 // The apron connects the loading yard to Dock Street. Move ornamental fixtures clear of its flared curb.
 for(const list of [LAMPS,PROPSPOTS]){
  for(let i=list.length-1;i>=0;i--){
   const p=list[i];if(p.z>=block.z0&&p.z<block.z0+SW+.10&&Math.abs(p.x-drive)<half+1.0)list.splice(i,1);
  }
 }
}
function updateSupplyLights(){
 const s=HARBOR_SUPPLY;
 if(s.light)s.light.emissiveIntensity=cityPowerAt(s.R.x0,s.R.z0)?1.3:0;
}

// The low distribution buildings on either side of the hardware shop share its loading street.
function buildDockWorkshops(block){
 const north=block.j===13;
 const left=block.x0+SW+.47,right=block.x1-SW-.48,front=block.z0+SW+.64,back=block.z1-SW-.70;
 const shed=north?worksRect(left+.28,right,front+10.12,back):worksRect(left+.45,right-3.42,front,front+17.92);
 const rear=north?worksRect(right-17.64,right,front,front+6.72):worksRect(left+4.9,right-3.42,front+24.18,back);
 const skin=pbr('plaster',1.19,{rough:.87,ns:.38,color:north?0xc6c1b1:0xbdbaad});
 const brick=pbr('brick_factory',1.13,{rough:.85,ns:.50,color:0xd2b19a});
 const roofing=pbr('quay-roof',1.36,{rough:.94,ns:.61});
 for(const [index,R] of [shed,rear].entries()){
  const h=index?(north?4.19:7.45):(north?6.18:5.82);
  const site={roof:h,cladding:index?brick:skin},mx=(R.x0+R.x1)/2,mz=(R.z0+R.z1)/2;
  for(const side of ['N','E','S','W']){
   const {width}=lotFace(R,side),span=width/2;
   const open=(left,right,base,top,kind='window')=>({left,right,base,top,kind});
   const openings=side===(north?'S':'N')?[open(-span+.96,-span+2.18,.17,2.43,'wood'),
    open(-2.18,2.18,.17,Math.min(3.66,h-.35),'shutter')]:[];
   if(width>13.5){
    for(const u of [-span+4.64,span-3.28])openings.push(open(u-1.08,u+1.08,h-1.96,h-.65));
   }else if(side==='W'||side==='E')openings.push(open(-1.07,1.07,h-2.08,h-.71));
   supplyWall(block,side,R,openings,site);
   const {matrix:M}=lotFace(R,side);
   plainBox(MAT.trim,-span-.045,span+.045,h+.11,h+.41,-.23,.046,{M,uvm:1.88});
   plainBox(MAT.metal,-span-.06,span+.06,h+.389,h+.427,-.245,.063,{M});
  }
  topQuad(STREET.materials.wornSlab,R.x0,R.x1,.17,R.z0,R.z1,2.64,null,false);
  STREET.steps.push({...R,y:.17});
  plainBox(roofing,R.x0,R.x1,h,h+.115,R.z0,R.z1,{uvm:3.25});block.bld.push({...R,y0:h,h:h+.115});
  for(const frac of [.23,.51,.77]){
   const x=lerp(R.x0,R.x1,frac);
   worksModel(frac===.51?'factory-skylight':'galvanized-roof-vent',x,h+.119,mz+(frac-.5)*(R.z1-R.z0),
    frac===.51?[1.68,.38,1.18]:[.89,.67,.84],0,false);
   if(R.z1-R.z0>12)worksModel('condenser-bank',x+.96,h+.119,R.z1-4.32,[2.33,1.12,1.28],Math.PI*.5,false);
  }
  for(const x of [R.x0+3.41,R.x1-3.48]){
   worksModel('hardware-stock-rack',x,.17,mz,[2.42,2.02,.67],0,true);
   INTERIORS.emitters.push({x,y:h-.72,z:mz,cool:true,floorY:.17});
   plainBox(INTERIORS.materials.neutral,x-.64,x+.64,h-.67,h-.626,mz-.088,mz+.088);
  }
  const intake=lotFace(R,north?'N':'S').matrix;
  for(const u of [-2.5,2.5]){
   const q=lpt(intake,u,-.18);worksBeam(MAT.darkMetal,[q.x,.22,q.z],[q.x,h+.34,q.z],.062);
  }
 }
}
