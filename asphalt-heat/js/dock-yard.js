/* The receiving yards continue the quay in reference 038 beyond the two public street ends. */
function dockYardPaving(){
 const h=HARBOR.yard,road=newTerrain(false),apron=newTerrain(true);
 const face=(tile,mat,x0,x1,z0,z1,y)=>terrainFace(tile,mat,[[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]]);
 face(road,MAT.asphalt,h.x0,h.x1,h.z0,h.z1,.009);
 const vec=(x,y,z)=>[x,y,z];
 function platform(x0,x1,z0,z1){
  // Aprons rise from the gutter across 1.7 metres so every loading entrance can take a wheeled delivery.
  const lo=.013,hi=.164,lip=1.7;
  const outer=[vec(x0,lo,z0),vec(x0,lo,z1),vec(x1,lo,z1),vec(x1,lo,z0)];
  const inner=[vec(x0+lip,hi,z0+lip),vec(x0+lip,hi,z1-lip),vec(x1-lip,hi,z1-lip),vec(x1-lip,hi,z0+lip)];
  for(let i=0;i<4;i++){
   const n=(i+1)%4;terrainFace(apron,PAVING.gutter,[outer[i],outer[n],inner[n],inner[i]]);
  }
  terrainFace(apron,PAVING.panel,inner);
 }
 const [west,east]=h.streets,[a,b,c]=h.cross;
 for(const [x0,x1] of [[h.x0,west-7.6],[west+7.6,east-7.6]])
  for(const [z0,z1] of [[h.z0,a-7],[a+7,b-7],[b+7,c-7]])platform(x0,x1,z0,z1);
 platform(east+7.5,h.x1,h.z0,h.z1);
 finishTerrain(road);finishTerrain(apron);
 const yellow=new THREE.MeshStandardMaterial({color:lin(0xd7b464),roughness:.85});
 const white=new THREE.MeshStandardMaterial({color:lin(0xd7d6c6),roughness:.86});
 const stripe=(mat,x0,x1,z0,z1)=>topQuad(mat,x0,x1,.016,z0,z1,1,null,false);
 for(const x of h.streets){
  for(let z=h.z0+10.4;z<h.z1-9;z+=8.2){
   if(h.cross.some(at=>z<at+8&&z+4.4>at-8))continue;
   for(const u of [-.13,.13])stripe(yellow,x+u-.047,x+u+.047,z,z+4.4);
  }
  for(const z of [a,b])for(const dz of [-10.4,10.4]){
   for(let u=x-6.6;u<x+6.4;u+=1.12)stripe(white,u,u+.48,z+dz-1.34,z+dz+1.34);
  }
  for(let z=h.z0+22;z<c-7;z+=22){
   if(h.cross.some(at=>Math.abs(z-at)<10))continue;
   const lx=x-8.56;
   LAMPS.push({x:lx,z,ry:Math.PI/2});
   PROPSPOTS.push({type:'hydrant',x:lx-.55,z:z+1.78,ry:Math.PI*.47});
  }
 }
 for(const z of h.cross)for(let x=h.x0+3;x<east-8;x+=8.2){
  if(Math.abs(x-west)<10)continue;
  stripe(yellow,x,x+3.85,z-.073,z+.073);
 }
 for(const [x,z] of [[east-3.5,a-19],[west+3.6,b+19],[west+19,c+2.9],[east-2.8,b-23.4]]){
  const cover=new THREE.CircleGeometry(.34,26);cover.rotateX(-Math.PI/2);cover.translate(x,.023,z);addGeo(PAVING.cover,cover,false);
 }
}

function dockWorksBuilding(r,front,name,cladding,roof,options={}){
 const base=.17,site={roof,cladding},shell={bld:[]},mx=(r.x0+r.x1)/2,mz=(r.z0+r.z1)/2;
 const hole=(left,right,base,top,kind='window')=>({left,right,base,top,kind});
 for(const side of ['N','S','W','E']){
  const {width,matrix:M}=lotFace(r,side),edge=width/2,open=[];
  if(side===front){
   if(options.market){
    open.push(hole(-6.18,-2.84,.46,3.11),hole(-2.81,-1.54,base,2.54,'glass'),hole(-1.48,2.67,.46,3.11));
   }else{
    open.push(hole(-edge+1.49,-edge+2.83,base,2.39,'egress'),hole(-2.16,2.16,base,3.79,'shutter'));
   }
  }else if(side===(front==='N'?'S':front==='S'?'N':front==='E'?'W':'E')){
   open.push(hole(1.16,2.57,base,2.39,'egress'));
  }
  for(let u=-edge+3.4;u<edge-1.7;u+=6.32){
   const left=u-1.26,right=u+1.26;
   if(open.some(o=>left<o.right+.075&&right>o.left-.075&&roof-1.76<o.top+.08))continue;
   open.push(hole(left,right,roof-1.76,roof-.66));
  }
  supplyWall(shell,side,r,open,site);
  plainBox(MAT.trim,-edge-.044,edge+.044,roof+.077,roof+.37,-.19,.036,{M,uvm:1.57});
  plainBox(MAT.metal,-edge-.060,edge+.060,roof+.35,roof+.39,-.201,.048,{M});
 }
 topQuad(STREET.materials.wornSlab,r.x0,r.x1,base,r.z0,r.z1,2.57,null,false);
 registerFreightDeck({...r,y:base});
 shell.bld.push({...r,y0:.047,h:base,walkIgnore:true});
 const roofHoles=options.stair?[supplyRoofStair(shell,r,base,roof)]:[];
 const roofing=pbr('quay-roof',1.42,{rough:.9,ns:.55});
 for(const panel of subtractCityOpenings(r,roofHoles)){
  plainBox(roofing,panel.x0,panel.x1,roof,roof+.18,panel.z0,panel.z1,{uvm:2.86});
  registerFreightDeck({...panel,y:roof+.18});shell.bld.push({...panel,y0:roof,h:roof+.18,walkIgnore:true});
 }
 const M=lotFace(r,front).matrix,sign=worksSign(name,options.market?'#374357':'#526665','#eee9db');
 const local=lpt(M,options.market?-1.46:0,-.065);
 const signY=options.market?3.79:4.20;
 worksPlacard(sign,local.x,signY,local.z,options.market?7.2:5.3,options.market?.74:.57,SIDEANG[front]);
 if(options.market){
  const g=new THREE.BufferGeometry(),l=-6.40,u=2.86;
  g.setAttribute('position',new THREE.Float32BufferAttribute([l,3.39,.08,u,3.39,.08,u,2.97,1.33,l,2.97,1.33],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,2,1,2,0,0,0],2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();g.applyMatrix4(M);addGeo(AWN[2],g,true);
  plainBox(AWN[2],l,u,2.80,2.99,1.30,1.33,{M});
  for(const v of [l+.12,u-.12]){
   const a=lpt(M,v,-.081),b=lpt(M,v,-1.29);worksBeam(MAT.metal,[a.x,2.62,a.z],[b.x,2.98,b.z],.019);
  }
 }
 for(const x of [r.x0+3.28,mx+.28]){
  worksModel('condenser-bank',x,roof+.18,mz+1.84,[1.88,.85,1.02],0,true);
  worksModel('galvanized-roof-vent',x+.68,roof+.18,mz-3.87,[.62,.49,.62],0,true);
  for(const u of [-.19,.02])worksBeam(MAT.metal,[x+u,roof+.263,mz+.89],[x+u,roof+.263,mz-3.40],.023);
 }
 for(const x of [r.x0+3.26,mx+1.67])for(const z of [r.z0+5.28,r.z1-5.48]){
  if(options.market){
   worksModel(z<mz?'grocery-cooler':'pantry-shelf',x,base,z,z<mz?[2.24,1.94,.84]:[1.60,1.81,.58]);
  }else worksModel('hardware-stock-rack',x,base,z,[2.64,2.15,.77]);
  worksBeam(MAT.metal,[x,roof-.11,z],[x,roof-1.01,z],.014);
  plainBox(INTERIORS.materials.neutral,x-.78,x+.78,roof-1.09,roof-1.025,z-.083,z+.083);
  INTERIORS.emitters.push({x,y:roof-1.11,z,floorY:base,cool:true,reach:9});
 }
 if(options.market){
  const x=r.x1-3.83,z=mz+2.12;
  worksFurniture(shell,'counter',x,base,z,3.31,.93,.77);
  worksModel('shop-register',x,base+.931,z,[.41,.36,.28],0,false);
  cornerCounterSale(x,base,z-.87,'FRESH PRODUCE','Coastal Market produce',4,6);
 }
 STATIC.push(...shell.bld);HARBOR.yard.buildings.push(r);
}

function buildDockYard(){
 const h=HARBOR.yard;dockYardPaving();
 const wall=pierPileMaterial(),cap=STREET.materials.wornSlab;
 for(const [[x0,z0],[x1,z1]] of [
  [[h.x1,h.z0],[h.x1,h.z1]],[[h.x0,h.z0],[h.x0,h.z1]],[[h.x0,h.z1],[h.x1,h.z1]]
 ]){
  const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/3.72),east=x0===h.x1;
  for(let k=0;k<n;k++){
   const x=lerp(x0,x1,k/n),z=lerp(z0,z1,k/n),u=lerp(x0,x1,(k+1)/n),v=lerp(z0,z1,(k+1)/n);
   const r={x0:x-.108,x1:u+.108,z0:z+.006-.102,z1:v-.006+.102};
   plainBox(wall,r.x0,r.x1,-2.40,.145,r.z0,r.z1,{uvm:1.84});
   plainBox(cap,r.x0-.032,r.x1+.032,.145,.205,r.z0,r.z1,{uvm:1.69});
   for(const y of [.55,1.10])worksBeam(MAT.metal,[x,y,z],[u,y,v],.022);
   cyl(MAT.metal,x,.16,z,.036,.041,.98,8);
   plainBox(MAT.darkMetal,x-.083,x+.083,.206,.226,z-.085,z+.085);
   for(const y of [.55,1.10])STATIC.push({...r,y0:y-.025,h:y+.025});
   STATIC.push({x0:x-.041,x1:x+.041,z0:z-.041,z1:z+.041,y0:.164,h:1.14,radius:.041});
   if(east&&k%2===0){
    plainBox(MAT.darkMetal,x+.06,x+.23,-1.14,-.081,z+.35,z+.65,{uvm:1.26});
   }
  }
  // The foot, wheel and minimap boundaries all follow the same retained apron.
  STATIC.push({x0:x0-.102,x1:x1+.102,z0:z0-.102,z1:z1+.102,y0:-2.42,h:.206});
 }
 const plaster=pbr('plaster',1.16,{color:0xe1dac9,rough:.89,ns:.45});
 const red=pbr('brick_factory',1.25,{color:0xbba795,rough:.87,ns:.59});
 const green=pbr('corrugated',1.48,{color:0xb0b7a8,rough:.80,metal:.27,ns:.48});
 const tan=pbr('concrete',1.47,{color:0xc3b8a7,rough:.93,ns:.44});
 const sites=[
  [911,944,1041,1064,'E','Foundry Machine Shop',red,6.47],
  [977,1009,1038,1062,'N','Marina Cold Storage',plaster,5.28,{stair:true}],
  [974,994,1065,1077,'E','Dock Office',tan,4.56],
  [908,945,1101,1134,'E','Northwind Transit',green,6.01],
  [973,1000,1101,1128,'N','Coastal Market',plaster,5.46,{market:true}],
  [980,1012,1164,1189,'S','Ferry Distribution',tan,5.85],
  [915,944,1164,1186,'E','Shipwright Stores',red,6.58]
 ];
 for(const [x0,x1,z0,z1,front,name,skin,roof,options] of sites)dockWorksBuilding({x0,x1,z0,z1},front,name,skin,roof,options);
 const shell={bld:[],cargoDecks:[]};
 for(const [x,z,n,tint] of [[1004.6,1131.1,2,0x9a573d],[1004.6,1134,2,0x3e655f],
  [908.8,1070.2,2,0x655f54],[916.1,1070.2,1,0xad7550],[973.7,1170.2,2,0x42576b]]){
  for(let k=0;k<n;k++)buildCargoContainer(shell,x,z,.164+k*2.60,tint,z>1160?'W':'E',k===0);
 }
 STATIC.push(...shell.bld);for(const deck of shell.cargoDecks)registerFreightDeck(deck);
 for(const [x,z,layers] of [[920.3,1074.9,2],[921.76,1074.9,1],[1005.4,1124.7,2],[936.2,1138.8,2]])
  dockPalletLoad(x,.164,z,layers,Math.round(x)%7);
}

function drawDockYardMap(g,k){
 const h=HARBOR.yard;
 const fill=(r,c)=>{g.fillStyle=c;g.fillRect((r.x0+HALF)*k,(r.z0+HALF)*k,(r.x1-r.x0)*k,(r.z1-r.z0)*k);};
 fill(h,'#a49e90');
 for(const x of h.streets)fill({x0:x-7.6,x1:x+7.6,z0:h.z0,z1:h.z1-3},'#777b7d');
 for(const z of h.cross)fill({x0:h.x0,x1:h.x1-6.5,z0:z-7,z1:z+7},'#777b7d');
 for(const r of h.buildings)fill(r,'#606769');
}
