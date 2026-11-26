/* Six one-storey dwellings flank each shared garden. Openings, roof pitch and floor heights use metres. */
const GARDENS={blocks:new Map(),houses:[],materials:null};
function gardenMaterials(){
 if(GARDENS.materials)return GARDENS.materials;
 const grass=makeWet(pbr('garden-lawn',1,{rough:.98,ns:.42,env:.35}),{wet:.13});
 const wetGrass=grass.onBeforeCompile;
 grass.onBeforeCompile=sh=>{
  wetGrass(sh);
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec2 p=vUv;vec4 first=mapTexelToLinear(texture2D(map,p));
    vec4 second=mapTexelToLinear(texture2D(map,mat2(.83,-.56,.56,.83)*p*.74+vec2(.45,.71)));
    diffuseColor*=mix(first,second,smoothstep(.20,.79,fbm2(p*1.51)));
    #endif`);
 };grass.customProgramCacheKey=()=>'mixed-garden-grass';
 const coat=tint=>pbr('garden-render',1,{rough:.90,ns:.42,color:tint,env:.46});
 return GARDENS.materials={
  walls:[coat(0xf2f0e5),coat(0xe1dccd),coat(0xe6d5be),coat(0xd7d5c1)],
  foundation:coat(0x9a978b),grass,
  tile:makeWet(pbr('garden-tile',1,{rough:.92,ns:.60,env:.40}),{wet:.34}),
  timber:pbr('planks',.71,{rough:.85,ns:.32,color:0x9b8274}),
  linen:new THREE.MeshStandardMaterial({color:lin(0xe2ddcf),roughness:.96}),
  blanket:[0x6d8283,0x999480,0x866e64].map(c=>new THREE.MeshStandardMaterial({color:lin(c),roughness:.96})),
  wire:new THREE.MeshStandardMaterial({color:lin(0x3d3c38),roughness:.69,metalness:.47})
 };
}
function gardenWall(B,R,side,openings,h,wall){
 const {matrix:M,width}=lotFace(R,side),span=width/2,base=.26;
 const solid=(l,r,b,t,mat=wall)=>{
  plainBox(mat,l,r,b,t,-.166,.026,{M,uvm:1.8});
  addRoomCollider(B,M,l,r,-.026,.166,t,b);
 };
 const sorted=openings.sort((a,b)=>a.x-b.x);
 let last=-span;
 for(const o of sorted){
  const l=o.x-o.w/2,r=o.x+o.w/2;
  solid(last,l,base,h);solid(l,r,o.y+o.h,h);
  if(o.door){
   registerDoor(M,o.x,.019,base,o.w-.061,o.h-.035,'wood');
   for(const edge of [l,r])plainBox(MAT.wood,edge-.035,edge+.035,base,base+o.h,-.135,.052,{M});
   plainBox(MAT.wood,l-.047,r+.047,base+o.h-.018,base+o.h+.044,-.124,.058,{M});
   const point=lpt(M,o.x,-.52);
   for(const [depth,size,y] of [[.36,.68,.254],[.83,.29,.205]]){
    const step=lrect(M,l-.11,r+.11,-depth-size/2,-depth+size/2);
    plainBox(MAT.trim,step.x0,step.x1,.15,y,step.z0,step.z1,{uvm:1.46});
    STREET.steps.push({...step,y});
   }
   R.entry={x:point.x,z:point.z};
  }else{
   solid(l,r,base,o.y);addRoomCollider(B,M,l,r,-.05,.11,o.y+o.h,o.y);
   const p=lpt(M,o.x,-.032);
   const proxy=new THREE.Group(),sash=new THREE.Mesh(unitBox,MAT.trim),pane=new THREE.Mesh(unitBox,INTERIORS.materials.glass);
   pane.position.y=o.h*.5;pane.scale.set(o.w-.08,o.h-.086,.016);proxy.add(pane);
   for(const edge of [-1,1]){
    const upright=sash.clone();upright.position.set(edge*o.w*.48,o.h*.5,0);upright.scale.set(.054,o.h,.12);proxy.add(upright);
    const bar=sash.clone();bar.position.set(0,edge<0?.035:o.h-.034,0);bar.scale.set(o.w,.067,.138);proxy.add(bar);
   }
   proxy.position.set(p.x,o.y,p.z);proxy.rotation.y=SIDEANG[side];scene.add(proxy);
   placeScenery('garden-sash',p.x,o.y,p.z,SIDEANG[side],[o.w,o.h,.206],v=>{proxy.visible=v;});
  }
  last=r;
 }
 solid(last,span,base,h);
 for(const [l,r] of [[-span,sorted[0]?.x??0],[sorted.at(-1)?.x??0,span]]){
  if(r-l>.25)plainBox(gardenMaterials().foundation,l,r,.15,.255,-.174,.038,{M,uvm:1.33});
 }
}
function gardenRoof(B,R,eave,rise,wall){
 const m=gardenMaterials(),cx=(R.x0+R.x1)/2,cz=(R.z0+R.z1)/2;
 const run=(R.x1-R.x0)/2+.23,depth=R.z1-R.z0+.42;
 R.eave=eave;R.rise=rise;R.run=run;R.cz=cz;R.cx=cx;R.depth=depth;
 for(const s of [-1,1]){
  const x=cx+s*run,z0=cz-depth/2,z1=cz+depth/2;
  const verts=[cx,eave+rise,z0,x,eave,z0,x,eave,z1,cx,eave+rise,z1];
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([.01,.99,.99,.99,.99,.01,.01,.01],2));
  g.setIndex(s<0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();addGeo(m.tile,g,true);
  const normal=new V3(s*rise/run,1,0).normalize(),tilt=-s*Math.atan2(rise,run),q=new THREE.Quaternion().setFromAxisAngle(new V3(0,0,1),tilt);
  const roofThickness=.136,p=new V3((cx+x)/2,eave+rise/2,cz).addScaledVector(normal,-roofThickness/2);
  B.bld.push({x0:Math.min(x,cx)-.056,x1:Math.max(x,cx)+.056,z0,z1,y0:eave-.14,h:eave+rise+.02,
   normal,walkIgnore:true,obb:{w:Math.hypot(run,rise),h:roofThickness,d:depth,p,q}});
 }
 for(const side of ['N','S']){
  const M=lotFace(R,side).matrix,w=(R.x1-R.x0)/2;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-w,eave,0,w,eave,0,0,eave+rise-.06,0],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,w,0,w*.5,rise*.56],2));g.setIndex([0,1,2]);g.computeVertexNormals();g.applyMatrix4(M);addGeo(wall,g,true);
  plainBox(MAT.darkMetal,-.19,.19,eave+.35,eave+.61,.014,.031,{M});
  for(let k=0;k<4;k++)plainBox(MAT.wood,-.18,.18,eave+.36+k*.057,eave+.377+k*.057,.032,.047,{M});
 }
 placeScenery('garden-roof-edge',cx,eave-.201,cz,0,[run*2+.15,rise+.303,depth+.037]);
}
function gardenRoofHeight(x,z,referenceY,base){
 if(referenceY===null||referenceY<2.65)return base;
 for(const r of GARDENS.blocks.get(cellKey(x,z))||[]){
  const u=Math.abs(x-r.cx);
  if(u>r.run||Math.abs(z-r.cz)>r.depth/2)continue;
  const roof=r.eave+r.rise*(1-u/r.run);
  if(referenceY>=roof-.33)return Math.max(base,roof);
 }
 return base;
}
function furnishCottage(B,R,variant,side){
 const m=gardenMaterials(),x=R.cx,z=R.cz,floor=.262,inner=side==='W'?1:-1,entry=side==='W'?R.x0:R.x1;
 const wallX=x+inner*1.69,zp=z+.91;
 for(const [a,b] of [[R.x0+.17,wallX-.57],[wallX+.57,R.x1-.17]]){
  plainBox(m.walls[0],a,b,floor,R.eave-.12,zp-.061,zp+.061,{uvm:1.4});
  B.bld.push({x0:a,x1:b,z0:zp-.061,z1:zp+.061,y0:floor,h:R.eave-.12});
 }
 plainBox(m.walls[0],wallX-.57,wallX+.57,2.44,R.eave-.12,zp-.061,zp+.061,{uvm:1.4});
 const bx=x-inner*1.55,bz=R.z1-1.59;
 plainBox(m.timber,bx-.74,bx+.74,floor,floor+.31,bz-1.03,bz+1.03,{uvm:.64});
 plainBox(m.linen,bx-.745,bx+.745,floor+.31,floor+.50,bz-1.03,bz+1.03);
 plainBox(m.blanket[variant%3],bx-.75,bx+.75,floor+.488,floor+.521,bz-1.035,bz+.37);
 for(const dx of [-.36,.36])plainBox(m.linen,bx+dx-.286,bx+dx+.286,floor+.50,floor+.61,bz+.63,bz+.95);
 B.bld.push({x0:bx-.75,x1:bx+.75,z0:bz-1.04,z1:bz+1.04,y0:floor,h:floor+.61});
 const sinkX=x+inner*1.11,sinkZ=R.z0+.65;
 worksFurniture(B,'counter',sinkX,floor,sinkZ,2.71,.95,.61);
 buildBasin(sinkX-.137,floor,sinkZ);
 // A walled washroom occupies the back corner opposite the kitchen, with its entrance facing the living room.
 const wcX=x-inner*2.71,wcZ=R.z0+1.04,wallEnd=x-inner*1.68;
 const wallLow=Math.min(wallEnd,x-inner*3.32),wallHigh=Math.max(wallEnd,x-inner*3.32);
 plainBox(m.walls[0],wallLow,wallHigh,floor,R.eave-.11,R.z0+2.26,R.z0+2.35,{uvm:1.31});
 B.bld.push({x0:wallLow,x1:wallHigh,z0:R.z0+2.26,z1:R.z0+2.35,y0:floor,h:R.eave-.11});
 for(const [az,bz] of [[R.z0+.16,R.z0+.79],[R.z0+1.85,R.z0+2.35]]){
  plainBox(m.walls[0],wallEnd-.050,wallEnd+.050,floor,R.eave-.11,az,bz,{uvm:1.26});
  B.bld.push({x0:wallEnd-.05,x1:wallEnd+.05,z0:az,z1:bz,y0:floor,h:R.eave-.11});
 }
 installCistern(B,wcX,floor,wcZ,0);
 worksFurniture(B,'reading-table',x-inner*.82,floor,z-.72,1.15,.76,.72);
 worksFurniture(B,'seat',x-inner*.85,floor,z+.04,.43,.82,.45);
 worksFurniture(B,'bookcase',x+inner*2.5,floor,R.z1-.42,1.15,1.51,.4);
 for(const y of [z-2.2,z+3.1]){
  INTERIORS.emitters.push({x,y:R.eave-.29,z:y,cool:false,floorY:floor});
  worksModel('enamel-pendant',x,R.eave-.39,y,[.31,.21,.31],0,false);
 }
 const angle=side==='W'?-Math.PI/2:Math.PI/2;
 worksModel('service-meter',entry-inner*.117,.42,z+2.03,[.278,.87,.162],angle,false);
}
function buildGardenCottages(B){
 const garden=[],m=gardenMaterials(),R=worksRect(B.x0+SW+.32,B.x1-SW-.32,B.z0+SW+.38,B.z1-SW-.38);
 GARDENS.blocks.set(B.i*N+B.j,garden);
 if(B.i===12&&B.j===2)installBusShelter(B,B.x1-12.3,B.z0+SW-.99,Math.PI);
 topQuad(m.grass,R.x0,R.x1,.161,R.z0,R.z1,4.63,null,false);
 const centre=(R.x0+R.x1)/2,zmid=(R.z0+R.z1)/2;
 topQuad(STREET.materials.wornSlab,centre-.57,centre+.57,.17,R.z0,R.z1,2.32,null,false);
 for(const col of [-1,1])for(let row=0;row<3;row++){
  const variant=(B.i+B.j+row+(col>0?2:0))%4,cx=centre+col*(10.61+variant*.18);
  const halfW=3.61+variant*.118,halfD=5.61+(variant%2)*.24,cz=lerp(R.z0+6.26,R.z1-6.26,row/2);
  const house=worksRect(cx-halfW,cx+halfW,cz-halfD,cz+halfD);
  const eave=3.03+(variant%3)*.138,rise=1.66+.107*(variant%3),front=col<0?'E':'W';
  const win=(x,w=1.29)=>({x,w,y:1.13,h:1.075}),door={x:-1.39,w:1.03,y:.26,h:2.14,door:true};
  for(const side of ['N','S','E','W']){
   const openings=side===front?[win(-3.64,1.16),door,win(2.98,1.38)]:
    side==='N'||side==='S'?[win(-1.66,1.31),win(1.61,1.24)]:[win(-2.65,1.15),win(2.39,1.31)];
   gardenWall(B,house,side,openings,eave,m.walls[variant]);
  }
  plainBox(m.foundation,house.x0,house.x1,.162,.251,house.z0,house.z1,{uvm:1.55});
  topQuad(INTERIORS.materials.wood,house.x0,house.x1,.262,house.z0,house.z1,.96,null,false);
  STREET.steps.push({...house,y:.262});
  plainBox(m.walls[0],house.x0,house.x1,eave-.086,eave-.017,house.z0,house.z1,{uvm:1.47});
  B.bld.push({...house,y0:eave-.086,h:eave-.017});
  gardenRoof(B,house,eave,rise,m.walls[variant]);furnishCottage(B,house,variant,front);
  const entry=house.entry;
  topQuad(STREET.materials.wornSlab,Math.min(entry.x,centre),Math.max(entry.x,centre),.17,entry.z-.48,entry.z+.48,1.88,null,false);
  garden.push(house);GARDENS.houses.push(house);
 }
 // Trees overhang the ends of the rows. Trunk positions leave doors, perimeter gates and carriageways clear.
 const streetTrees=[[R.x0+1.29,R.z0+6.61,.89],[R.x1-1.41,R.z1-5.57,.98],[centre-3.64,R.z1-2.28,.82],
  [centre+3.43,R.z0+3.11,.87],[R.x0+1.83,zmid+1.23,.76],[R.x1-1.76,zmid-4.91,.83]];
 for(const [x,z,size] of streetTrees)TREES.push([x,z,size*(.92+.035*((B.i+B.j)%3))]);
 // Perimeter walls end on either side of each garden gate.
 for(const z of [R.z0+.035,R.z1-.035])for(const [l,r] of [[R.x0,centre-1.38],[centre+1.38,R.x1]]){
  plainBox(m.foundation,l,r,.16,.68,z-.075,z+.075,{uvm:1.38});
  plainBox(MAT.trim,l-.016,r+.016,.675,.718,z-.091,z+.091,{uvm:1.18});
  B.bld.push({x0:l,x1:r,z0:z-.091,z1:z+.091,y0:.15,h:.718});
 }
 const px=R.x0+.51,pz=zmid+6.18;
 worksModel('garden-utility-pole',px,.16,pz,[1.4,7.18,.36],Math.PI/2,false);
 STATIC.push({x0:px-.139,x1:px+.139,z0:pz-.139,z1:pz+.139,y0:.16,h:7.34,radius:.139});
 STATIC.push({x0:px-.084,x1:px+.084,z0:pz-.70,z1:pz+.70,y0:6.80,h:7.045});
 for(const house of garden){
  const end=new V3(house.entry.x,house.eave+.04,house.entry.z+2.95),start=new V3(px,7.05,pz);
  const points=[];for(let j=0;j<=12;j++){const t=j/12,p=start.clone().lerp(end,t);p.y-=.57*Math.sin(t*Math.PI);points.push(p);}
  const span=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.012,5,false);
  addGeo(m.wire,span,false);
 }
}
