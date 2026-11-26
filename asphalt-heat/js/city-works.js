/* Market Street, its apartments, and the municipal pump house across Studio Boulevard. */
const CITY_WORKS = {
 market: {x0:330,x1:374,z0:334,z1:373},
 station: {x0:335,x1:363,z0:276,z1:300},
 gallery: {x0:343.5,x1:350.3,z0:299.8,z1:334.2},
 shaft: {x0:340.2,x1:343.4,z0:340.3,z1:343.6},
 levels: [-3.91,.17,4.25,8.33],
 floors:[], flights:[], panels:[], lifts:[], walkups:[], lamps:[],
 grid:true, pump:true, valve:true, workLight:false, water:.44, pressure:.9, wastewater:0, fixtures:[],
 lift:{y:.17, target:1, doors:1, cab:null, body:null}
};
const RIVERSIDE_PARKING={x:281.5,z:6*CELL+ROAD_SECTIONS.local.parking};
const MARKET_STAIR = {x0:332.25,x1:335.10,z0:339,z1:347.16};
const FLAT_STAIR = {...MARKET_STAIR,x0:335.64,x1:338.49};
const STATION_STAIR = {x0:355.2,x1:358.05,z0:282,z1:290.16};
const STREET_OPENINGS = [MARKET_STAIR,CITY_WORKS.shaft,STATION_STAIR];
const worksInside=(r,x,z,margin=0)=>x>=r.x0-margin&&x<=r.x1+margin&&z>=r.z0-margin&&z<=r.z1+margin;
const worksRect=(x0,x1,z0,z1)=>({x0,x1,z0,z1});

function subtractCityOpenings(rect,holes){
 let pieces=[rect];
 for(const hole of holes){
  const next=[];
  for(const r of pieces){
   const x0=Math.max(r.x0,hole.x0),x1=Math.min(r.x1,hole.x1);
   const z0=Math.max(r.z0,hole.z0),z1=Math.min(r.z1,hole.z1);
   if(x1<=x0||z1<=z0){next.push(r);continue;}
   if(r.x0<x0)next.push(worksRect(r.x0,x0,r.z0,r.z1));
   if(x1<r.x1)next.push(worksRect(x1,r.x1,r.z0,r.z1));
   if(r.z0<z0)next.push(worksRect(x0,x1,r.z0,z0));
   if(z1<r.z1)next.push(worksRect(x0,x1,z1,r.z1));
  }
  pieces=next;
 }
 return pieces;
}

function worksGroundMesh(r,y,meters,originX=r.x0,originZ=r.z1){
 const geos=subtractCityOpenings(r,STREET_OPENINGS).map(p=>{
  const g=new THREE.PlaneGeometry(p.x1-p.x0,p.z1-p.z0);
  g.rotateX(-Math.PI/2);g.translate((p.x0+p.x1)/2,y,(p.z0+p.z1)/2);
  const uv=g.attributes.uv,pos=g.attributes.position;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)-originX)/meters,(originZ-pos.getZ(i))/meters);
  return g;
 });
 if(geos.length===1)return geos[0];
 const combined=mergeGeos(geos);geos.forEach(g=>g.dispose());return combined;
}

function worksSolid(r,base,top,material,deck=false){
 plainBox(material,r.x0,r.x1,base,top,r.z0,r.z1,{uvm:1.7});
 STATIC.push({...r,y0:base,h:top,walkIgnore:deck});
}
function worksSlab(r,top,material,holes=[]){
 for(const p of subtractCityOpenings(r,holes)){
  worksSolid(p,top-.16,top,material,true);
  CITY_WORKS.floors.push({...p,y:top});
 }
}
function worksBeam(material,a,b,r){
 const start=new V3(...a),end=new V3(...b),axis=end.clone().sub(start);
 const g=new THREE.CylinderGeometry(r,r,axis.length(),8);
 g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),axis.normalize())));
 g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);addGeo(material,g,true);
}
function worksFlight(area,from,to,reverse){
 const n=24,length=area.z1-area.z0;
 const at=f=>reverse?area.z1-length*f:area.z0+length*f;
 CITY_WORKS.flights.push({...area,from,to,reverse,n});
 for(let i=0;i<n;i++){
  const a=at(i/n),b=at((i+1)/n),y=lerp(from,to,(i+1)/n);
  const tread=worksRect(area.x0,area.x1,Math.min(a,b),Math.max(a,b));
  worksSolid(tread,y-.23,y,MAT.stone,true);
  for(const x of [area.x0+.035,area.x1-.035]){
   STATIC.push({x0:x-.027,x1:x+.027,z0:tread.z0,z1:tread.z1,y0:y-.06,h:y+1.09});
  }
  const nose=at(i/n);
  plainBox(MAT.darkMetal,area.x0+.04,area.x1-.04,y+.002,y+.009,nose-.016,nose+.016,{shadow:false});
 }
 for(const x of [area.x0+.055,area.x1-.055]){
  worksBeam(MAT.darkMetal,[x,from+1.08,at(0)],[x,to+1.08,at(1)],.038);
  for(let i=0;i<=6;i++){
   const f=i/6;
   worksBeam(MAT.metal,[x,lerp(from,to,f)+.07,at(f)],[x,lerp(from,to,f)+1.08,at(f)],.026);
  }
 }
}
function worksFlightHeight(f,z){
 const u=clamp((f.reverse?f.z1-z:z-f.z0)/(f.z1-f.z0),0,1);
 return lerp(f.from,f.to,Math.min(f.n,Math.floor(u*f.n)+1)/f.n);
}
function worksFloorAt(x,z,referenceY,street){
 const w=CITY_WORKS;
 if(!worksInside(w.market,x,z)&&!worksInside(w.station,x,z)&&!worksInside(w.gallery,x,z)&&!w.walkups.some(r=>worksInside(r,x,z)))return street;
 const ref=referenceY??street,opening=STREET_OPENINGS.some(r=>worksInside(r,x,z));
 // The surface street and the gallery may occupy the same X/Z. Choose a reachable layer.
 let best=(!opening&&ref>=street-.39)?street:-Infinity;
 for(const r of w.floors)if(r.y<=ref+.39&&worksInside(r,x,z))best=Math.max(best,r.y);
 for(const f of w.flights)if(worksInside(f,x,z)){
  const y=worksFlightHeight(f,z);
  if(y<=ref+.40&&y>=ref-.55)best=Math.max(best,y);
 }
 for(const lift of w.lifts)if(worksInside(lift.shaft,x,z)&&Math.abs(lift.y-ref)<.55)best=Math.max(best,lift.y);
 return Number.isFinite(best)?best:street;
}

function installWorksPhysics(){
 // Give the street a real underside and leave the three shafts open to rigid bodies.
 PH.w.removeBody(PH.ground);
 for(const r of subtractCityOpenings(worksRect(-4096,4096,-4096,4096),STREET_OPENINGS)){
  physBox(r.x0,r.x1,-.13,0,r.z0,r.z1,PH.mat.ground);
 }
 for(const lift of CITY_WORKS.lifts){
  const shaft=lift.shaft,x=(shaft.x1-shaft.x0)*.5,z=(shaft.z1-shaft.z0)*.5;
  const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:PH.mat.concrete,collisionFilterGroup:PHYS_GROUP.world});
  const box=(w,h,d,px,py,pz)=>body.addShape(new CANNON.Box(new CV(w/2,h/2,d/2)),new CV(px,py+.08,pz));
  box(2*x-.065,.16,2*z-.065,0,-.08,0);
  box(3.08,.08,3.16,0,2.53,0);
  box(3.08,2.5,.08,0,1.25,-1.51);
  for(const side of [-1,1])box(.07,2.5,3.10,side*1.49,1.25,0);
  for(const leaf of lift.cabDoors){
   leaf.shape=body.shapes.length;
   box(leaf.width,2.38,.065,leaf.node.position.x,1.19,z-.14);
  }
  body.position.set((shaft.x0+shaft.x1)/2,lift.y-.08,(shaft.z0+shaft.z1)/2);
  PH.w.addBody(body);lift.body=body;
 }
}
function worksFurniture(block,id,x,y,z,width,height,depth,yaw=0){
 const M=new THREE.Matrix4().makeRotationY(yaw);M.setPosition(x,0,z);
 placeRoomFurniture(block,M,id,0,0,y,[width,height,depth]);
}
function worksModel(id,x,y,z,dims,yaw=0,solid=true){
 placeScenery(id,x,y,z,yaw,dims,detailFallback(id,x,y,z,dims,yaw));
 if(solid){
  const [w,h,d]=dims,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),dx=(c*w+s*d)/2,dz=(s*w+c*d)/2;
  STATIC.push({x0:x-dx,x1:x+dx,z0:z-dz,z1:z+dz,y0:y,h:y+h});
 }
}
function worksSign(text,base,color){
 const slot=atlasSlot((g,w,h)=>{
  g.fillStyle=base;g.fillRect(0,0,w,h);g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';
  g.font='600 46px Georgia, serif';g.fillText(text,w/2,h/2,w*.93);
 });
 return slot;
}
function worksPlacard(slot,x,y,z,width,height,yaw=0){
 signQuad(slot,x,y,z,width,height,yaw,false);
}
function initWorksMaterials(){
 const surface=(hex,rough,metal=0)=>new THREE.MeshStandardMaterial({color:lin(hex),roughness:rough,metalness:metal});
 CITY_WORKS.m={
  brick:pbr('brick_red',1.2,{rough:.87,ns:.45,color:0xd3c9c2}),
  stone:pbr('stone_light',1.0,{rough:.75,ns:.33,color:0xd4cfc4}),
  chamber:pbr('concrete',1.62,{rough:.91,ns:.74,color:0x898b83,env:.24}),
  damp:pbr('concrete',1.34,{rough:.60,ns:.63,color:0x5a655b,env:.31}),
  canvas:[surface(0x355349,.89),surface(0x694642,.89)],
  service:pbr('concrete',1.3,{rough:.9,ns:.41,color:0xb1aea5}),
  floor:pbr('planks',.84,{rough:.72,color:0xc4aea0}),
  pipe:surface(0x588694,.44,.55), iron:surface(0x3d524d,.59,.53), ochre:surface(0xb28345,.6,.46),
  tiled:pbr('tiles_dark',.52,{rough:.38,color:0x79958b}),
  enamel:surface(0xe3e1d5,.54,.13),fabric:surface(0xac987c,.96),
  panel:surface(0x5a6b66,.57,.42),
  lamp:new THREE.MeshStandardMaterial({color:0xe1d8c7,emissive:0xffe2bb,emissiveIntensity:1.1}),
  channel:new THREE.MeshStandardMaterial({color:lin(0x566355),roughness:.23,metalness:.25,transparent:true,opacity:.88})
 };
 CITY_WORKS.m.marketFloor=pbr('market-floor',.76,{rough:.61,ns:.35,env:.27});
 CITY_WORKS.m.soffit=pbr('plaster',2.6,{rough:.93,ns:.29,color:0xcec6b8});
 const ink='#ece3ce';
 CITY_WORKS.signs={market:worksSign('TIDELINE MARKET','#2f493e',ink),baker:worksSign('HARBOUR BAKERY','#643e37',ink),
  apartments:worksSign('MARKET FLATS','#393c3c',ink),station:worksSign('TIDEWATER PUMP HOUSE','#334b55',ink),
  sewer:worksSign('SANITARY SEWER','#473f33',ink),
  tunnel:worksSign('SERVICE GALLERY','#31423d',ink),water:worksSign('WATER MAIN','#445d6c',ink),
  power:worksSign('ELECTRICAL ROOM','#435747',ink),roof:worksSign('ROOF TERRACE','#393c3c',ink)};
}

function worksWall(block,R,side,bottom,top,material,doors=[],windows=true){
 const {matrix:M,width}=lotFace(R,side),span=width/2;
 if(windows&&bottom<1)rememberShopGlass(M,-span,span);
 const box=(mat,l,r,b,t,inner,outer)=>plainBox(mat,l,r,b,t,inner,outer,{M,uvm:1});
 const solid=(l,r,b,t)=>addRoomCollider(block,M,l,r,-.04,.27,t,b);
 const opaque=(l,r,b,t)=>{box(material,l,r,b,t,-.26,.04);solid(l,r,b,t);};
 const breaks=[-span,...doors.flatMap(u=>[u-.86,u+.86]),span];
 for(let i=0;i<breaks.length-1;i++){
  const l=breaks[i],r=breaks[i+1];
  if(i%2){
   opaque(l,r,bottom+2.56,top);registerDoor(M,(l+r)/2,.04,bottom,1.63,2.49,'glass');continue;
  }
  if(!windows||r-l<2.4){opaque(l,r,bottom,top);continue;}
  const count=Math.max(1,Math.round((r-l)/3.3)),bay=(r-l)/count;
  const ground=bottom<1, sill=bottom+(ground?.49:.86),lintel=top-(ground?.68:.59);
  opaque(l,r,bottom,sill);opaque(l,r,lintel,top);
  for(let k=0;k<count;k++){
   const a=l+k*bay+.22,b=l+(k+1)*bay-.22;
   opaque(l+k*bay,a,sill,lintel);opaque(b,l+(k+1)*bay,sill,lintel);
   facadePlane(STREET.materials.glass,M,a,b,sill,lintel,-.16);
   for(const u of [a,(a+b)/2,b])box(MAT.darkMetal,u-.035,u+.035,sill,lintel,-.18,-.08);
   box(MAT.darkMetal,a,b,lintel-.48,lintel-.43,-.18,-.08);
   box(CITY_WORKS.m.stone,a-.08,b+.08,sill-.09,sill+.026,-.17,.16);
   solid(a,b,sill,lintel);
  }
 }
}

function worksPanel(x,y,z,label,use,radius=1.48){
 CITY_WORKS.panels.push({x,y,z,label,use,radius});
}
function buildLift(r=CITY_WORKS.shaft,levels=CITY_WORKS.levels,labels=['SERVICE GALLERY','MARKET','APARTMENTS','ROOF TERRACE']){
 const w=CITY_WORKS,m=w.m;
 const municipal=r===w.shaft;
 const lift=municipal?w.lift:{y:levels[0],target:0,doors:1,cab:null,body:null};
 Object.assign(lift,{shaft:r,levels,labels,gates:[],cabDoors:[],municipal});
 w.lifts.push(lift);
 const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2,bottom=levels[0],top=levels[levels.length-1]+2.9;
 for(const u of [r.x0-.14,r.x1])worksSolid(worksRect(u,u+.14,r.z0-.18,r.z1),bottom,top,m.service);
 worksSolid(worksRect(r.x0,r.x1,r.z0-.17,r.z0),bottom,top,m.service);
 for(const [level,y] of levels.entries()){
  const u0=r.x0+.48,u1=r.x1-.48;
  for(const [a,b] of [[r.x0,u0],[u1,r.x1]])worksSolid(worksRect(a,b,r.z1-.09,r.z1+.09),y,y+2.44,m.panel);
  worksSolid(worksRect(r.x0,r.x1,r.z1-.09,r.z1+.09),y+2.45,Math.min(y+3.9,levels[level+1]??top),m.service);
  plainBox(m.ochre,u1+.15,u1+.32,y+.97,y+1.30,r.z1+.092,r.z1+.14);
  worksPanel(u1+.15,y,r.z1+.47,()=>lift.target===level&&Math.abs(lift.y-y)<.06?'LIFT AT THIS FLOOR':'CALL LIFT',()=>{
   if(!liftPowered(lift)){toast('Lift power is off · stairs are open',1700);return;}
   if(Math.abs(lift.y-lift.levels[lift.target])>.06)return toast('Lift in transit',1300);
   lift.target=level;
  },1.18);
  for(const sign of [-1,1]){
   const width=(u1-u0)/2,center=x+sign*width/2;
   const node=new THREE.Mesh(unitBox,MAT.metal);node.scale.set(width,2.41,.072);node.castShadow=true;scene.add(node);
   const box={x0:center-width/2,x1:center+width/2,z0:r.z1-.04,z1:r.z1+.04,y0:y,h:y+2.41};
   STATIC.push(box);lift.gates.push({box,node,y,sign,x,width,level});
  }
 }
 const cab=new THREE.Group();
 for(const [xoff,yoff,zoff,width,height,depth,mat] of [
  [0,-.08,0,r.x1-r.x0-.065,.16,r.z1-r.z0-.065,MAT.stone],
  [0,1.25,-1.51,3.08,2.5,.08,m.panel],
  [0,2.53,0,3.08,.08,3.16,m.enamel],
  [0,2.46,0,1.28,.035,.27,m.lamp],
  [0,.98,-1.40,2.52,.045,.045,MAT.metal],
  [-1.49,1.25,0,.07,2.50,3.10,m.panel],[1.49,1.25,0,.07,2.50,3.10,m.panel]
 ]){
  const part=new THREE.Mesh(unitBox,mat===m.lamp?mat.clone():mat);
  if(mat===m.lamp)lift.light=part.material;
  part.scale.set(width,height,depth);part.position.set(xoff,yoff,zoff);part.receiveShadow=true;cab.add(part);
 }
 const width=(r.x1-r.x0-.96)/2;
 for(const sign of [-1,1]){
  const node=new THREE.Mesh(unitBox,m.panel);
  node.scale.set(width,2.38,.065);node.position.set(sign*width*(.5+lift.doors),1.19,(r.z1-r.z0)/2-.14);cab.add(node);
  lift.cabDoors.push({node,sign,width,shape:null});
 }
 cab.position.set(x,lift.y,z);scene.add(cab);lift.cab=cab;
 syncWorksGates(lift);
 return lift;
}

function syncWorksGates(lift){
 for(const leaf of lift.cabDoors||[]){
  const x=leaf.sign*leaf.width*(.5+lift.doors);
  if(leaf.node.position.x===x)continue;
  leaf.node.position.x=x;
  if(leaf.shape!==null){lift.body.shapeOffsets[leaf.shape].x=x;lift.body.aabbNeedsUpdate=true;}
 }
 for(const g of lift.gates){
  const open=Math.abs(lift.y-g.y)<.055?lift.doors:0;
  const x=g.x+g.sign*g.width*(.5+open);
  if(g.node.position.x===x)continue;
  g.node.position.set(x,g.y+1.205,lift.shaft.z1);
  g.box.x0=x-g.width/2;g.box.x1=x+g.width/2;
  const body=STREETS_PHYS.bodies.get(g.box);
  if(body){body.position.x=x;body.aabbNeedsUpdate=true;}
 }
}
function buildMarket(block){
 const w=CITY_WORKS,m=w.m,r=w.market,[basement,ground,flats,roof]=w.levels;
 const outer=[MARKET_STAIR,w.shaft];
 topQuad(m.service,365.2,374.5,.158,329.66,332.76,1.7,null,false);
 for(const z of [329.80,332.64])topQuad(MAT.whiteMetal,365.48,374.45,.164,z,z+.08,1,null,false);
 worksSolid(worksRect(365.55,365.75,330.31,332.04),.16,.25,m.stone);
 worksSlab(r,ground,m.marketFloor,outer);
 worksSlab(r,flats,m.floor,[FLAT_STAIR,MARKET_STAIR,w.shaft]);
 worksSlab(r,roof,MAT.roof,[MARKET_STAIR,w.shaft]);
 for(const p of subtractCityOpenings(r,[FLAT_STAIR,MARKET_STAIR,w.shaft])){
  const g=new THREE.PlaneGeometry(p.x1-p.x0,p.z1-p.z0),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(p.x1-p.x0),uv.getY(i)*(p.z1-p.z0));
  g.rotateX(Math.PI/2);g.translate((p.x0+p.x1)/2,flats-.163,(p.z0+p.z1)/2);addGeo(m.soffit,g,false);
 }
 // Each landing spans both flights. From the flats the return run reaches the terrace.
 worksFlight(MARKET_STAIR,basement,ground,false);
 worksFlight(FLAT_STAIR,ground,flats,true);
 worksFlight(MARKET_STAIR,flats,roof,false);
 for(const side of ['S','N','E','W']){
  const doors=side==='S'?[-12,8]:side==='W'?[7]:[];
  worksWall(block,r,side,ground,flats-.16,m.stone,doors,side!=='N');
  worksWall(block,r,side,flats,roof-.16,m.brick,[],true);
  const face=lotFace(r,side),width=face.width;
  plainBox(m.stone,-width/2-.13,width/2+.13,flats-.30,flats-.06,-.24,.23,{M:face.matrix,uvm:1.3});
  worksSolid(lrect(face.matrix,-width/2,width/2,-.04,.17),roof,roof+.92,m.stone);
 }
 const front=lotFace(r,'S').matrix;
 shopLightingRoom(front,-(r.x1-r.x0)/2,(r.x1-r.x0)/2,r.z1-r.z0);
 for(const [u,slot] of [[-12,w.signs.market],[8,w.signs.baker]]){
  const at=lpt(front,u,-.11);worksPlacard(slot,at.x,3.20,at.z,8,.77);
  const canopy=new THREE.BoxGeometry(8.1,.08,1.33);
  const cloth=m.canvas[u<0?0:1];
  canopy.rotateX(.16);canopy.translate(u,2.91,.63);canopy.applyMatrix4(front);addGeo(cloth,canopy,true);
  plainBox(cloth,u-4.05,u+4.05,2.66,2.84,1.233,1.275,{M:front});
  for(const a of [u-3.8,u+3.8]){
   const near=lpt(front,a,-.12),far=lpt(front,a,-1.22);
   worksBeam(m.iron,[near.x,2.19,near.z],[far.x,2.79,far.z],.019);
  }
 }
 worksPlacard(w.signs.apartments,r.x0-.07,3.16,360.5,5.25,.62,-Math.PI/2);
 // Pantry and bakery open onto the same trading floor, with unobstructed counter approaches.
 for(const x of [336.8,340,343.2,360.1,363.4,366.8]){
  worksModel('pantry-shelf',x,ground,354,[2.45,2.35,.46],0);
 }
 for(const x of [335.5,337.1,339.1,341.0]){
  worksModel('produce-crate',x,ground,363.6,[1.2,.71,.82],0);
 }
 for(const x of [360.3,363.0,365.7])worksModel('patisserie-case',x,ground,361,[2.45,1.38,.89],0);
 for(const x of [342.8,369.0]){
  worksFurniture(block,'counter',x,ground,361.25,2.55,.98,.78);
  worksModel('shop-register',x,ground+.99,361.22,[.42,.39,.30],Math.PI,false);
 }
 worksPanel(342.8,ground,362.1,()=>'BUY FRUIT · $3',()=>buyMarketItem(3,5,'Fresh fruit'));
 worksPanel(364,ground,361.98,()=>'BUY BREAD · $5',()=>buyMarketItem(5,8,'Bakery loaf'));
 for(const x of [334.5,344,356,367.5])for(const z of [355.8,366.4]){
  INTERIORS.emitters.push({x,y:2.82,z,cool:false,floorY:ground,municipal:true});
  worksBeam(MAT.darkMetal,[x,flats-.15,z],[x,3.36,z],.014);
  worksModel('enamel-pendant',x,3.05,z,[.51,.32,.51],0,false);
  cyl(m.lamp,x,3.052,z,.20,.20,.012,12,{shadow:false});
 }
 dressMarketWindows();
 buildFlats(block,flats);
 buildLift();
 const cellar=worksRect(r.x0,r.x1,r.z0,351.5);
 worksSlab(cellar,basement,m.service);
 for(const [x0,x1] of [[r.x0,w.gallery.x0],[w.gallery.x1,r.x1]])
  worksSolid(worksRect(x0,x1,r.z0-.19,r.z0),basement,ground-.16,m.service);
 for(const x of [r.x0-.16,r.x1])worksSolid(worksRect(x,x+.16,r.z0,351.5),basement,ground-.16,m.service);
 worksSolid(worksRect(r.x0,r.x1,351.48,351.67),basement,ground-.16,m.service);
 worksPlacard(w.signs.tunnel,348.3,-1.2,334.23,3.2,.48);
 // Roof tank frame, rain stacks and a shaded communal table.
 worksRoofTank(360.1,roof,343.5);
 worksModel('condenser-bank',367,roof,339.2,[2.15,1.04,1.24],0);
 worksModel('promenade-bench',363.4,roof,367.8,[1.86,.92,.62],Math.PI);
 worksFurniture(block,'reading-table',357.2,roof,365.8,1.45,.77,1.05);
 worksPlacard(w.signs.roof,341.8,roof+2.65,w.shaft.z1+.13,2.5,.42);
}

function buildFlats(block,y){
 const m=CITY_WORKS.m;
 // The west landing opens into a shared hallway. Place a door in each partition opening.
 for(const [z,doorX] of [[349.9,347.4],[360.2,347.4]]){
  for(const [a,b] of [[344.9,doorX-.70],[doorX+.70,373.8]])worksSolid(worksRect(a,b,z,z+.16),y,y+3.90,m.enamel);
  const M=new THREE.Matrix4().makeTranslation(doorX,0,z+.17);
  registerDoor(M,0,.025,y,1.30,2.20,'wood');
 }
 for(const z of [344.1,355.2,365.3]){
  worksFurniture(block,'bookcase',370.6,y,z-2.4,2.62,2.0,.40);
  worksFurniture(block,'reading-table',356.1,y,z,1.42,.76,.88);
  worksFurniture(block,'seat',356.1,y,z+1.03,.52,.85,.56);
  worksSolid(worksRect(364.9,366.5,z-.9,z+1.25),y,y+.43,MAT.wood);
  plainBox(m.fabric,364.88,366.52,y+.43,y+.63,z-.88,z+1.24);
  plainBox(m.enamel,365.07,366.3,y+.63,y+.77,z+.65,z+1.11);
  worksSolid(worksRect(349.3,352.4,z-1.98,z-1.33),y,y+.88,m.panel);
  plainBox(m.stone,349.26,352.46,y+.88,y+.95,z-2.01,z-1.30,{uvm:1});
  worksModel('salon-plant',352.8,y,z+1.32,[.54,1.08,.54],0);
  buildBasin(350.29,y,z-1.65);
 }
}

function buildBasin(cx,y,cz){
 const m=CITY_WORKS.m;
 plainBox(m.iron,cx-.30,cx+.30,y+.953,y+.969,cz-.17,cz+.16);
  plainBox(m.enamel,cx-.26,cx+.26,y+.969,y+.971,cz-.13,cz+.12);
  cyl(MAT.metal,cx,y+.971,cz+.04,.030,.030,.010,12);
  worksBeam(MAT.metal,[cx,y+.96,cz-.23],[cx,y+1.20,cz-.23],.023);
  worksBeam(MAT.metal,[cx,y+1.20,cz-.23],[cx,y+1.20,cz],.023);
  const stream=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.225,8),m.channel);
  stream.position.set(cx,y+1.083,cz);stream.visible=false;scene.add(stream);
  const fixture={x:cx,y,z:cz,time:0,stream};CITY_WORKS.fixtures.push(fixture);
  worksPanel(cx,y,cz+.68,()=>'RUN BASIN TAP',()=>{
   if(pressureAtFixture(fixture)<.12)return toast('No water pressure',1200);
   fixture.time=3.5;toast('Basin tap open',1100);
  });
}

function worksRoofTank(x,y,z){
 const m=CITY_WORKS.m;
 for(const dx of [-1.17,1.17])for(const dz of [-1.17,1.17]){
  worksBeam(m.iron,[x+dx,y,z+dz],[x+dx*.89,y+2.12,z+dz*.89],.069);
  worksBeam(m.iron,[x+dx,y+.2,z+dz],[x-dx*.89,y+2.07,z+dz*.89],.030);
  worksBeam(m.iron,[x+dx,y+.2,z+dz],[x+dx*.89,y+2.07,z-dz*.89],.030);
 }
 cyl(m.iron,x,y+2.06,z,1.62,1.62,.13,18);
 worksModel('roof-cistern',x,y+2.18,z,[3.18,3.44,3.18],0);
 worksBeam(m.pipe,[x+.92,y,z+.92],[x+.92,y+2.16,z+.92],.10);
}
function buyMarketItem(cost,health,name){
 if(!CITY_WORKS.grid||!cityPowerAt(CITY_WORKS.market.x0,CITY_WORKS.market.z0))return toast('Register offline · restore market power',1800);
 if(player.cash<cost)return toast('Insufficient cash',1400);
 player.cash-=cost;player.hp=Math.min(100,player.hp+health);toast(name+' · $'+cost,1500);
}

function buildStation(block){
 const w=CITY_WORKS,r=w.station,m=w.m,[base,ground]=w.levels;
 buildDistrictPanel();
 worksSlab(r,base,m.service);
 worksSlab(r,ground,m.service,[STATION_STAIR]);
 worksSlab(r,4.42,MAT.roof);
 worksFlight(STATION_STAIR,base,ground,false);
 for(const side of ['N','S','E','W']){
  worksWall(block,r,side,ground,4.26,side==='E'?m.brick:MAT.corrugated,side==='N'?[0]:side==='E'?[-4]:[],side==='N'||side==='W');
 }
 for(const x of [r.x0-.18,r.x1])worksSolid(worksRect(x,x+.18,r.z0,r.z1),base,ground-.16,m.service);
 worksSolid(worksRect(r.x0,r.x1,r.z0-.16,r.z0),base,ground-.16,m.service);
 for(const [l,h] of [[r.x0,w.gallery.x0],[w.gallery.x1,r.x1]])
  worksSolid(worksRect(l,h,r.z1-.16,r.z1),base,ground-.16,m.service);
 worksPlacard(w.signs.station,349,3.35,r.z0-.075,10,.74,Math.PI);
 worksPlacard(w.signs.power,339.5,2.19,298.02,3.4,.49);
 // Feeder cabinet, pump motor with cast flanges, and the blue municipal water main.
 worksSolid(worksRect(337.4,341.6,298.03,299.13),ground,2.48,m.panel);
 for(const x of [338.2,339.5,340.8]){
  plainBox(m.iron,x-.51,x+.51,.42,2.23,297.98,298.02);
  for(let n=0;n<6;n++)plainBox(MAT.metal,x-.28,x+.28,1.61+n*.07,1.63+n*.07,297.95,298.005);
 }
 w.breaker=new THREE.Mesh(unitBox,m.ochre);w.breaker.scale.set(.11,.36,.10);w.breaker.position.set(339.5,1.19,297.87);scene.add(w.breaker);
 worksPanel(339.5,ground,297.55,()=>w.grid?'SWITCH POWER OFF':'RESTORE POWER',()=>{
  w.grid=!w.grid;toast(w.grid?'Market circuit energized':'Market circuit isolated · emergency lighting on',1750);
 });
 for(const x of [339.4,343.4]){
  worksSolid(worksRect(x-1.14,x+1.14,279.3,281.43),ground,.48,m.service);
  worksModel('municipal-pump',x,.48,280.4,[1.90,.94,.78]);
  worksBeam(m.pipe,[x+.42,1.40,280.60],[x+.42,1.56,280.60],.112);
  worksBeam(m.pipe,[x+.42,1.56,280.60],[x+.42,1.56,282.4],.112);
  worksBeam(m.pipe,[x+.42,1.56,282.4],[x+.42,1.15,282.4],.112);
 }
 worksBeam(m.pipe,[339.4,1.15,282.4],[348.1,1.15,282.4],.24);
 worksBeam(m.pipe,[348.1,base+.37,282.4],[348.1,1.15,282.4],.23);
 for(const x of [342.3,345.2,347.3])worksBeam(m.ochre,[x,1.15,282.4],[x+.09,1.15,282.4],.31);
 w.handwheel=new THREE.Mesh(new THREE.TorusGeometry(.30,.035,8,20),m.ochre);
 w.handwheel.position.set(345.2,1.28,282.71);scene.add(w.handwheel);
 for(let k=0;k<3;k++){const spoke=new THREE.Mesh(unitBox,m.ochre);spoke.scale.set(.55,.035,.035);spoke.rotation.z=k*Math.PI/3;w.handwheel.add(spoke);}
 worksPlacard(w.signs.water,345.2,2.22,282.37,2.4,.40);
 worksPanel(345.2,ground,283.2,()=>w.valve?'CLOSE WATER MAIN':'OPEN WATER MAIN',()=>{
  w.valve=!w.valve;toast(w.valve?'Clean water main open':'Clean water main closed',1400);
 });
 worksSolid(worksRect(340.3,341.15,284.3,285.05),ground,1.34,m.panel);
 worksPanel(340.74,ground,285.45,()=>w.pump?'STOP DRAIN PUMP':'START DRAIN PUMP',()=>{
  w.pump=!w.pump;toast(w.pump?'Drain pump enabled':'Drain pump stopped · sump level rising',1700);
 });
 const gauge=new THREE.Mesh(unitBox,m.pipe);gauge.position.set(340.72,.57,285.07);gauge.scale.set(.13,.2,.025);w.gauge=gauge;scene.add(gauge);
 // A tap in the market yard responds to water pressure independently of drainage.
 worksSolid(worksRect(370,372.5,350.9,351.57),.17,1.06,m.tiled);
 worksBeam(m.pipe,[371.1,.9,350.93],[371.1,1.61,350.93],.04);
 worksBeam(m.pipe,[371.1,1.61,350.93],[371.1,1.61,351.26],.045);
 w.tap=new THREE.Mesh(new THREE.CylinderGeometry(.016,.030,.50,8),w.m.channel);
 w.tap.position.set(371.1,1.34,351.26);scene.add(w.tap);
 worksModel('condenser-bank',341.6,4.42,292.5,[2.8,1.23,1.6],Math.PI/2);
 // The substation yard is entirely within this block. There is a service gate at its east end.
 const yard=worksRect(335.1,360.8,302.6,309.7);
 worksSlab(yard,.23,m.service);
 for(const x of [339.5,346.2,352.9]){
  worksSolid(worksRect(x-1.29,x+1.29,304.8,307),.23,2.00,m.iron);
  for(let i=0;i<8;i++)plainBox(m.panel,x-1.23+i*.33,x-1.17+i*.33,.47,1.83,304.58,304.85);
  for(const dx of [-.67,0,.67]){
   cyl(m.enamel,x+dx,2,305.88,.12,.18,.50,10);
   for(const y of [2.13,2.26,2.39])cyl(m.enamel,x+dx,y,305.88,.17,.17,.035,10);
  }
 }
 for(const z of [yard.z0,yard.z1]){
  worksSolid(worksRect(yard.x0,yard.x1,z-.04,z+.04),.23,.42,m.service);
  for(let x=yard.x0;x<=yard.x1;x+=1.65)worksBeam(m.iron,[x,.23,z],[x,1.63,z],.024);
  worksBeam(m.iron,[yard.x0,1.60,z],[yard.x1,1.60,z],.032);
  STATIC.push({...worksRect(yard.x0,yard.x1,z-.04,z+.04),y0:.23,h:1.63});
 }
}
function buildWorksGallery(){
 const w=CITY_WORKS,r=w.gallery,m=w.m,base=w.levels[0];
 worksSlab(r,base,m.chamber);
 worksSolid(r,-.49,-.26,m.chamber,true);
 for(const x of [r.x0-.17,r.x1])worksSolid(worksRect(x,x+.17,r.z0,r.z1),base,-.35,m.chamber);
 for(const x of [r.x0+.014,r.x1-.014]){
  plainBox(m.damp,x-.02,x+.02,base,base+.61,r.z0,r.z1,{uvm:1.66});
  for(let z=r.z0+4.4;z<r.z1;z+=5.7)plainBox(m.iron,x-.023,x+.023,base+.59,-.5,z-.013,z+.013);
 }
 // A separate storm channel runs beside the dry walking ledge from the market to the station.
 for(const x of [347.72,349.72])worksSolid(worksRect(x,x+.16,r.z0+.23,r.z1-.20),base,base+.53,m.service);
 w.drain=new THREE.Mesh(new THREE.PlaneGeometry(1.84,r.z1-r.z0-.45),m.channel);
 w.drain.rotation.x=-Math.PI/2;w.drain.position.set(348.79,base+.22,(r.z0+r.z1)/2);scene.add(w.drain);
 for(const [x,y,radius,mat] of [[343.88,-1.52,.18,m.pipe],[344.08,-.92,.09,m.ochre],[349.94,-1.34,.27,m.iron]]){
  worksBeam(mat,[x,y,r.z0],[x,y,r.z1],radius);
  for(let z=r.z0+2;z<r.z1;z+=4.6){
   worksBeam(MAT.metal,[x,y,z],[x,y,z+.10],radius*1.24);
   worksBeam(MAT.darkMetal,[x,y,z],[x,-.49,z],.025);
  }
 }
 for(let z=r.z0+2;z<r.z1;z+=5.7){
  // Removable galvanized grates bridge the drain for inspection.
  for(let i=0;i<13;i++)plainBox(m.iron,347.77,349.86,base+.53,base+.568,z-.31+i*.05,z-.292+i*.05);
  const grate=worksRect(347.77,349.86,z-.31,z+.31);
  STATIC.push({...grate,y0:base+.53,h:base+.568,walkIgnore:true});
  w.floors.push({...grate,y:base+.568});
  plainBox(m.panel,343.67,344.21,-1.1,-.96,z-.39,z+.39);
  plainBox(m.lamp,343.7,344.18,-1.17,-1.085,z-.29,z+.29);
 }
 // The sanitary branch slopes to a screened sump. Basin discharge reaches this chamber by gravity.
 const sewerX=349.94;
 worksBeam(m.iron,[sewerX,-1.34,r.z0],[sewerX,-2.64,r.z0+.1],.27);
 worksBeam(m.iron,[sewerX,-2.64,r.z0+.1],[sewerX,-2.75,r.z0+1.80],.25);
 worksSolid(worksRect(348.87,350.21,r.z0+.39,r.z0+2.92),base,base+.74,m.service);
 const sight=new THREE.Mesh(unitBox,m.channel);sight.position.set(348.858,base+.29,r.z0+1.61);sight.scale.set(.025,.20,1.23);scene.add(sight);w.sewerSight=sight;
 for(const dz of [-.64,.64])plainBox(MAT.metal,348.831,348.89,base+.09,base+.71,r.z0+1.61+dz-.02,r.z0+1.61+dz+.02);
 worksPlacard(w.signs.sewer,349.96,-1.95,r.z0+2.8,1.72,.33,-Math.PI/2);
 // Connect the gallery's clean-water and soil lines to the market and apartment fixture risers.
 for(const [x,y,z,radius,mat] of [[343.88,-1.52,350.93,.10,m.pipe],[sewerX,-1.34,341.25,.18,m.iron]]){
  worksBeam(mat,[x,y,r.z1],[x,y,z],radius);
  worksBeam(mat,[x,y,z],[x,mat===m.pipe?.90:3.78,z],radius);
 }
 worksBeam(m.pipe,[343.88,-.66,350.93],[371.1,-.66,350.93],.058);
 worksBeam(m.pipe,[371.1,-.66,350.93],[371.1,.9,350.93],.052);
 worksBeam(m.iron,[sewerX,3.78,341.25],[sewerX,3.75,363.76],.075);
 for(const fz of [342.45,353.55,363.65]){
  worksBeam(m.iron,[sewerX,3.76,fz],[350.29,3.78,fz],.050);
  worksBeam(m.iron,[350.29,3.78,fz],[350.29,5.19,fz],.048);
 }
 // These two local lights illuminate the physical gallery and rooms as the player moves.
 for(let i=0;i<2;i++){const light=new THREE.PointLight(0xffdfb7,0,10,2);scene.add(light);w.lamps.push(light);}
}
function worksAction(pos){
 const w=CITY_WORKS;
 for(const lift of w.lifts){
  if(!worksInside(lift.shaft,pos.x,pos.z,-.16)||Math.abs(pos.y-lift.y)>=.36)continue;
  const at=lift.levels.findIndex(y=>Math.abs(y-lift.y)<.055);
  if(at<0||lift.doors<.93)return {label:'LIFT IN TRANSIT',fn:()=>{}};
  if(lift.selectFloor)return {label:'LIFT',hot:true,fn:()=>lift.selectFloor(at)};
  const next=(at+1)%lift.levels.length,labels=lift.labels;
  return {label:'LIFT · '+labels[next],hot:true,fn:()=>{
   if(liftPowered(lift))lift.target=next;else toast('Power off · use the stairs',1500);
  }};
 }
 for(const p of w.panels){
  if(Math.abs(pos.y-p.y)>.56||Math.hypot(pos.x-p.x,pos.z-p.z)>p.radius)continue;
  if(rayWorld(pos.x,pos.z,p.x,p.z,pos.y+1,p.y+1)<.98)continue;
  return {label:p.label(),hot:true,fn:p.use};
 }
 return null;
}
function liftDoorOccupied(lift,pos){
 const r=lift.shaft,y=lift.y;
 if(Math.abs(pos.z-r.z1)<.49&&pos.x>r.x0+.25&&pos.x<r.x1-.25&&Math.abs(pos.y-y)<.36)return true;
 if(!lift.body?.world)return false;
 for(const contact of lift.body.world.contacts){
  const body=contact.bi===lift.body?contact.bj:contact.bj===lift.body?contact.bi:null;
  if(!body||body.type!==CANNON.Body.DYNAMIC)continue;
  body.updateAABB();
  const {lowerBound:a,upperBound:b}=body.aabb;
  if(b.x>r.x0+.48&&a.x<r.x1-.48&&b.z>r.z1-.30&&a.z<r.z1+.16&&b.y>y+.02&&a.y<y+2.38)return true;
 }
 return false;
}
function moveLiftBodies(dt){
 for(const lift of CITY_WORKS.lifts)updateWorksLift(lift,dt,player.pos,true);
}
function updateWorksLift(lift,dt,pos,physicsStep=false){
 const w=CITY_WORKS,r=lift.shaft;
 const old=lift.y,target=lift.levels[lift.target];
 const powered=liftPowered(lift);
 if(lift.light)lift.light.emissiveIntensity=powered?1.10:.10;
 if(powered){
  if(Math.abs(target-old)>.001){
   const doorOccupied=lift.doors>0&&liftDoorOccupied(lift,pos);
   lift.doors=doorOccupied?Math.min(1,lift.doors+dt*1.65):Math.max(0,lift.doors-dt*1.65);
   if(!lift.doors)lift.y+=Math.sign(target-old)*Math.min(Math.abs(target-old),dt*1.12);
  }else lift.doors=Math.min(1,lift.doors+dt*1.65);
 }
 if(lift.y!==old){
  if(!player.car&&worksInside(r,pos.x,pos.z)&&Math.abs(pos.y-old)<.28)pos.y=lift.y;
  lift.cab.position.y=lift.y;
  lift.body.position.y=(physicsStep?old:lift.y)-.08;lift.body.aabbNeedsUpdate=true;
 }
 lift.body.velocity.y=physicsStep?(lift.y-old)/dt:0;
 syncWorksGates(lift);
}

function updateCityWorks(dt,pos){
 const w=CITY_WORKS;
 const stationPower=w.grid&&cityPowerAt(w.station.x0,w.station.z0);
 const draining=stationPower&&w.pump;
 updateServiceGraph(dt);
 w.water=clamp(w.water+dt*(draining ? -.012 : .009),.12,.94);
 let discharge=0;
 for(const fixture of w.fixtures){
  fixture.time=Math.max(0,fixture.time-dt);fixture.stream.visible=fixture.time>0&&pressureAtFixture(fixture)>.10;
  if(fixture.stream.visible)discharge+=.16*pressureAtFixture(fixture);
 }
 w.wastewater=clamp(w.wastewater+dt*(discharge-.040),0,1);
 w.sewerSight.scale.y=.09+w.wastewater*.46;
 w.sewerSight.position.y=w.levels[0]+.15+w.sewerSight.scale.y/2;
 w.pressure=lerp(w.pressure,w.valve&&stationPower?1:0,1-Math.exp(-dt*.60));
 w.drain.position.y=w.levels[0]+.06+w.water*.41;w.tap.visible=w.pressure>.10;w.tap.scale.x=w.tap.scale.z=w.pressure;
 w.gauge.scale.y=.48*w.water;w.gauge.position.y=.63+w.gauge.scale.y/2;
 w.handwheel.rotation.z=lerp(w.handwheel.rotation.z,w.valve?0:Math.PI*.85,Math.min(1,dt*4));
 w.breaker.rotation.x=w.grid?-.26:.72;
 w.m.lamp.emissiveIntensity=stationPower?1.10:.12;
 for(const mesh of CITY_SERVICES.pipes)mesh.visible=pos.y<-1.40;
 const inTunnel=pos.y<-1.05&&(worksInside(w.gallery,pos.x,pos.z)||worksInside(w.market,pos.x,pos.z)||worksInside(w.station,pos.x,pos.z));
 w.lamps.forEach((l,i)=>{
  l.intensity=inTunnel?(stationPower?1.68:w.workLight&&i===0?1.30:.45):0;
  l.position.set(pos.x+(i?1:-1),Math.min(-.65,pos.y+2.4),pos.z+(i?3.4:-2.2));
 });
}
function buildWorksBlock(B){
 const walkup=CITY_WALKUPS[B.i+','+B.j];
 if(walkup){buildCityWalkup(B,walkup);return true;}
 if(B.i!==5)return false;
 if(B.j===5){buildMarket(B);return true;}
 if(B.j===4){buildStation(B);return true;}
 return false;
}

const CITY_WALKUPS={
 '1,2':{name:'FERRY STREET ROOMS',kind:'brick',floors:3,shop:'SECONDHAND BOOKS'},
 '14,5':{name:'SEABRIGHT COURT',kind:'coast',floors:4,shop:'MARINA COFFEE'},
 '2,13':{name:'FOUNDRY LOFTS',kind:'mill',floors:2,shop:'HARBOUR SUPPLY'}
};
function buildCityWalkup(B,spec){
 const w=CITY_WORKS,m=w.m,coastal=spec.kind==='coast',mill=spec.kind==='mill';
 const r=worksRect(B.x0+4.5,B.x1-5.25,B.z0+6,B.z1-6);
 const levels=Array.from({length:spec.floors+1},(_,i)=>.17+i*4.08);
 const a=worksRect(r.x0+1.25,r.x0+4.10,r.z0+4.35,r.z0+12.51);
 const b={...a,x0:r.x0+4.67,x1:r.x0+7.52};
 const shaft=worksRect(r.x0+10,r.x0+13.2,r.z0+5,r.z0+8.3);
 w.walkups.push(r);
 const front=lotFace(r,'S').matrix,top=levels[levels.length-1];
 const colors=coastal?['#3c5b58','#efe6cf']:mill?['#324653','#dee1da']:['#503f36','#ece1c8'];
 const signs=[spec.name,spec.shop].map(text=>worksSign(text,...colors));
 for(let i=0;i<levels.length;i++){
  const y=levels[i],roof=i===levels.length-1;
  const holes=i===0?[]:[shaft,i%2===1?a:b,...(roof?[]:[i%2===1?b:a])];
  worksSlab(r,y,roof?MAT.roof:i?m.floor:m.stone,holes);
  if(roof)break;
  const next=levels[i+1];
  worksFlight(i%2===0?a:b,y,next,i%2===1);
  for(const side of ['S','N','E','W']){
   const mat=coastal?m.enamel:mill?(side==='S'?m.brick:MAT.corrugated):m.brick;
   worksWall(B,r,side,y,next-.16,mat,!i&&side==='S'?[-9,8]:[],!(mill&&side==='W'));
  }
  if(i===0){
   const stock=mill?'pantry-shelf':coastal?'bakery-counter':'bookcase';
   for(let k=0;k<3;k++){
    const x=r.x0+18+k*4,z=r.z1-9.6;
    if(stock==='bookcase')worksFurniture(B,stock,x,y,z,2.25,2.10,.47);
    else worksModel(stock,x,y,z,[2.4,coastal?1.34:2.10,coastal?.83:.53]);
   }
   worksFurniture(B,'counter',r.x1-3.22,y,r.z1-9.5,2.5,.96,.78);
   worksModel('shop-register',r.x1-3.22,y+.98,r.z1-9.5,[.44,.37,.30],Math.PI,false);
   const counterX=r.x1-3.22,counterZ=r.z1-8.68;
   const item=mill?'WORK LIGHT':coastal?'COFFEE':'BOOK',price=mill?18:coastal?4:8;
   if(mill){
    const lx=counterX+.71,lz=counterZ-.83;
    cyl(m.ochre,lx,y+.96,lz,.085,.11,.22,12);
    cyl(m.enamel,lx,y+1.18,lz,.078,.078,.115,12);
    const handle=new THREE.TorusGeometry(.075,.012,6,16,Math.PI);handle.translate(lx,y+1.29,lz);addGeo(MAT.darkMetal,handle,true);
   }
   worksPanel(counterX,y,counterZ,()=>mill&&w.workLight?'WORK LIGHT PURCHASED':'BUY '+item+' · $'+price,()=>{
    if(mill&&w.workLight)return;
    if(!cityPowerAt(counterX,counterZ))return toast('Register offline',1200);
    if(player.cash<price)return toast('Insufficient cash',1300);
    player.cash-=price;
    if(mill)w.workLight=true;
    if(coastal)player.hp=Math.min(100,player.hp+5);
    toast((mill?'Portable work light':coastal?'House coffee':'Used paperback')+' · $'+price,1400);
   });
  }else{
   const cx=r.x0+18.7,cz=r.z0+12.82;
   worksSolid(worksRect(cx-.73,cx+.73,cz-.35,cz+.34),y,y+.94,m.panel);
   plainBox(m.stone,cx-.74,cx+.74,y+.94,y+.953,cz-.36,cz+.35);
   buildBasin(cx,y,cz);
   for(const [x,z] of [[r.x0+18.7,r.z0+8.6],[r.x1-6.1,r.z1-8.0]]){
    worksFurniture(B,'reading-table',x,y,z,1.55,.74,.94);
    worksFurniture(B,'seat',x,y,z+1.1,.55,.89,.54);
    worksFurniture(B,'bookcase',x+3.25,y,z-2.22,1.6,1.97,.44);
    worksSolid(worksRect(x-3.64,x-2.13,z-1.13,z+1.07),y,y+.42,MAT.wood);
    plainBox(m.fabric,x-3.65,x-2.12,y+.42,y+.63,z-1.13,z+1.07);
    plainBox(m.enamel,x-3.40,x-2.33,y+.63,y+.74,z+.58,z+.96);
   }
   if(coastal){
    plainBox(m.stone,-17.4,17.4,y-.15,y+.018,-.05,1.06,{M:front,uvm:1.4});
    plainBox(MAT.whiteMetal,-17.4,17.4,y+.91,y+.95,.99,1.05,{M:front});
    for(let u=-17.2;u<17.4;u+=1.18)plainBox(MAT.whiteMetal,u-.026,u+.026,y,y+.93,.99,1.05,{M:front});
   }
  }
 }
 for(const side of ['S','N','E','W']){
  const face=lotFace(r,side);worksSolid(lrect(face.matrix,-face.width/2,face.width/2,0,.18),top,top+.90,m.stone);
 }
 buildLift(shaft,levels,levels.map((y,i)=>i===0?'STREET':i===levels.length-1?'ROOF':coastal?'SUITES '+i:'FLOOR '+(i+1)));
 const at=lpt(front,-9,-.13);worksPlacard(signs[1],at.x,3.25,at.z,8.1,.73);
 const door=lpt(front,8,-.13);worksPlacard(signs[0],door.x,3.22,door.z,8.5,.72);
 worksModel('condenser-bank',r.x1-4.8,top,r.z0+7.2,[2.25,1.15,1.37]);
 if(mill||spec.kind==='brick')worksRoofTank(r.x1-6.6,top,r.z1-8.2);
 if(coastal){
  worksModel('promenade-bench',r.x1-8,top,r.z1-3.6,[1.95,.91,.60],Math.PI);
  worksModel('salon-plant',r.x1-4.8,top,r.z1-3.6,[.62,1.4,.62]);
 }
}
