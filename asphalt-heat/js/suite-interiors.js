/* Street-front flats, offices and their fittings share a metre-scale plan with the structural frame. */
const BUILDING_FITTINGS={templates:new Map(),pending:new Set(),batches:[],key:'',activeTaps:new Set(),drawnLeaves:new Set(),activeCisterns:new Set(),movingLeaves:new Set(),outdoor:new Map(),hiddenProxies:[],lamps:[],retryAt:0};
function suitePoint(core,u,v){
 return core.alongX?{x:v,z:u}:{x:u,z:v};
}
function planUpperRooms(block){
 for(const s of block.structures||[]){
  const c=s.core;
  if(!c||s.warehouse)continue;
  for(const l of s.levels){
   if(l.ground||l.h-l.y0<2.34)continue;
   const r=l.rect,mins=c.alongX?[r.z0,r.x0]:[r.x0,r.z0],maxs=c.alongX?[r.z1,r.x1]:[r.x1,r.z1];
   l.rooms=[];l.fittings=[];
   for(const sign of [-1,1]){
    const edge=sign<0?mins[0]+.23:maxs[0]-.23;
    const partition=c.uc+sign*(1.10+(c.u1-c.u0)/2),breadth=(edge-partition)*sign;
    if(breadth<2.52||maxs[1]-mins[1]<5.70)continue;
    const v0=mins[1]+.19,v1=maxs[1]-.19;
    const doorV=clamp(c.v0-.83,v0+1.14,v1-1.14),doorAt=suitePoint(c,partition,doorV);
    const face=c.alongX?(sign>0?'N':'S'):(sign>0?'W':'E'),M=new THREE.Matrix4().makeRotationY(SIDEANG[face]);
    M.setPosition(doorAt.x,0,doorAt.z);
    const office=s.block.dist==='downtown'||s.block.dist==='docks';
    const bathSide=office?0:bathroomDirection(breadth,doorV,v0,v1);
    const bathDistance=(bathSide>0?v0+BATH_DEPTH:v1-BATH_DEPTH)-doorV;
    const hingeRight=bathSide!==0&&Math.abs(bathDistance)<2.15&&bathDistance*M.elements[c.alongX?0:2]<0;
    const door=registerDoor(M,0,0,l.y0,1.145,2.12,'wood',false,hingeRight);
    door.suiteBlock=block;
    const room={sign,partition,edge,v0,v1,doorV,door,breadth,office};
    l.rooms.push(room);
    const furnishing=(id,u,v,yaw,dims,solidHeight,offset=0)=>{
     const at=suitePoint(c,u,v),turned=Math.abs(Math.sin(yaw))>.5;
     const w=turned?dims[2]:dims[0],d=turned?dims[0]:dims[2],y=l.y0+.004+offset;
     const f={...at,y,yaw,id,dims,solidHeight,x0:at.x-w/2,x1:at.x+w/2,z0:at.z-d/2,z1:at.z+d/2};
     l.fittings.push(f);return f;
    };
    const yaw=c.alongX?(sign>0?Math.PI:0):(sign>0?-Math.PI/2:Math.PI/2);
    const centreU=edge-sign*Math.min(breadth*.44,1.38);
    if(room.office){
     const desk=furnishing('studio-drafting-desk',edge-sign*.58,v1-1.30,yaw,[1.34,1.133,.71],.76);
     desk.light={x:desk.x,y:l.y0+1.05,z:desk.z,floorY:l.y0,colour:0xffe4b9,reach:5.3,intensity:1.03};
     furnishing('seat',edge-sign*1.33,v1-1.32,yaw+Math.PI,[.46,.87,.51],.48);
     if(v1-v0>8.4)furnishing('bookcase',edge-sign*.28,v0+1.73,yaw,[1.30,1.83,.40],1.83);
    }else{
     furnishing('apartment-bed',centreU,v1-1.50,c.alongX?Math.PI/2:0,[1.38,.844,1.98],.53);
     const g=furnishing('apartment-galley',edge-sign*.36,v0+1.30,yaw,[1.60,1.285,.62],.94);
     const cs=Math.cos(yaw),sn=Math.sin(yaw);
     g.tap={x:g.x-.379*cs+.075*sn,y:l.y0,z:g.z+.379*sn+.075*cs,
       reachX:g.x-.379*cs+.57*sn,reachZ:g.z+.379*sn+.57*cs,riserZone:Math.floor(l.y0/22),time:0};
     addDomesticFittings(c,l,room,yaw,furnishing);
    }
   }
  }
 }
}
function suiteParts(l,add){
 if(!l.rooms?.length)return;
 const c=l.owner.core,m=INTERIORS.materials;
 for(const room of l.rooms){
  const finish=constructionFinish(room.office?m.tile:m.wood);
  const floor=orientedRect(c.alongX,Math.min(room.partition,room.edge),Math.max(room.partition,room.edge),room.v0,room.v1);
  add(partBox(floor,l.y0-.003,l.y0+.003,'trim',finish));
  const u=room.partition,D=room.doorV,head=l.y0+2.17;
  const W=(a,b,depth=.064)=>orientedRect(c.alongX,u-depth,u+depth,a,b);
  const plaster=l.tier.style===2?m.ceiling:m.plaster;
  for(const [a,b] of [[room.v0,D-.606],[D+.606,room.v1]]){
   if(b<=a)continue;
   add(partBox(W(a,b),l.y0,l.h-.135,'wall',plaster));
   add(partBox(W(a,b,.075),l.y0,l.y0+.115,'trim',m.darkWood));
  }
  add(partBox(W(D-.606,D+.606),head,l.h-.135,'wall',plaster));
  for(const v of [D-.604,D+.604])add(partBox(W(v-.026,v+.026,.082),l.y0,head,'frame',m.darkWood));
  add(partBox(W(D-.635,D+.635,.081),head,head+.047,'trim',m.darkWood));
  // Hot and cold supply, sanitary riser and electrical conduit stay on the utility side of the partition.
  for(const [off,diam,mat] of [[.18,.045,MAT.metal],[.29,.045,MAT.metal],[.46,.094,MAT.darkMetal],[.64,.034,MAT.metal]]){
   const at=suitePoint(c,u-room.sign*.137,room.v0+off);
   add({...partBox({x0:at.x-diam/2,x1:at.x+diam/2,z0:at.z-diam/2,z1:at.z+diam/2},l.y0,l.h,'trim',mat),round:true});
   for(const y of [l.y0+.45,l.h-.61]){
    add({...partBox({x0:at.x-diam*.63,x1:at.x+diam*.63,z0:at.z-diam*.63,z1:at.z+diam*.63},y,y+.034,'trim',MAT.metal),round:true});
   }
  }
  if(room.bath)addBathroomParts(c,l,room,add);
 }
 for(const f of l.fittings){
  if(f.leaf)addRefrigeratorParts(l,f,add);
  else if(f.solidHeight>.01)add(partBox(f,f.y,f.y+f.solidHeight,'furniture',null));
 }
}
function registerStreetFitting(id,x,y,z,dims,yaw=0,extra={}){
 const key=Math.floor(x/CELL)+','+Math.floor(z/CELL);
 if(!BUILDING_FITTINGS.outdoor.has(key))BUILDING_FITTINGS.outdoor.set(key,[]);
 const f={id,x,y,z,dims,yaw,...extra};BUILDING_FITTINGS.outdoor.get(key).push(f);return f;
}
function registerPavementField(block,x0,x1,z0,z1,y,axis){
 (block.pavementFields||(block.pavementFields=[])).push({x0,x1,z0,z1,y,axis});
}
function pavementTemplate(){
 const positions=[],uv=[],colors=[],indices=[];
 for(const [inset,y,tone] of [[0,.76,.50],[.0028,.963,.85],[.0044,1,1]]){
  const half=.5-inset;
  for(const [x,z] of [[-half,-half],[-half,half],[half,half],[half,-half]]){
   positions.push(x,y,z);uv.push(x,z);colors.push(tone,tone,tone);
  }
 }
 for(let j=0;j<8;j++){
  const k=Math.floor(j/4)*4+(j+1)%4;indices.push(j,k,k+4,j,k+4,j+4);
 }
 indices.push(8,9,10,8,10,11);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const mat=constructionFinish(PAVING.panel);mat.vertexColors=true;
 return {dimensions:[1,1,1],primitives:[{geo,mat,local:new THREE.Matrix4()}]};
}
function collectPaving(pos,select){
 const palette=[0xfdfaf5,0xf4f3f0,0xe8e6df,0xf5f2ed,0xefede8],reach=40;
 for(let i=Math.max(0,Math.floor((pos.x-reach)/CELL));i<=Math.min(N-1,Math.floor((pos.x+reach)/CELL));i++)
 for(let j=Math.max(0,Math.floor((pos.z-reach)/CELL));j<=Math.min(N-1,Math.floor((pos.z+reach)/CELL));j++){
  for(const r of blocks[i*N+j].pavementFields||[]){
   if(rectDistance(r,pos.x,pos.z)>reach||Math.abs(r.y-pos.y)>12)continue;
   const sx=r.axis==='ns'?1.76:1.68,sz=r.axis==='ns'?1.68:1.76;
   const nx=Math.max(1,Math.round((r.x1-r.x0)/sx)),nz=Math.max(1,Math.round((r.z1-r.z0)/sz));
   const w=(r.x1-r.x0)/nx,d=(r.z1-r.z0)/nz;
   for(let a=0;a<nx;a++)for(let b=0;b<nz;b++){
    const x=r.x0+(a+.5)*w,z=r.z0+(b+.5)*d;
    if(w>.035&&d>.035&&Math.hypot(x-pos.x,z-pos.z)<reach)
     select({id:'concrete-panel',x,y:r.y-.045,z,dims:[w-.008,.045,d-.008],tint:palette[Math.abs((a*13+b*17+i*3+j*7)%5)]});
   }
  }
 }
}
function registerDeckBoards(rect,acrossX){
 if(rect.soffit!==undefined)STATIC.push({x0:rect.x0,x1:rect.x1,z0:rect.z0,z1:rect.z1,y0:rect.soffit,h:rect.y});
 const from=acrossX?rect.z0:rect.x0,to=acrossX?rect.z1:rect.x1;
 const lo=acrossX?rect.x0:rect.z0,hi=acrossX?rect.x1:rect.z1;
 const rows=Math.ceil((to-from)/.158),width=(to-from)/rows;
 const bays=Math.max(1,Math.round((hi-lo)/2.64)),span=(hi-lo)/bays;
 const tints=[0xf7efe3,0xddd4c8,0xf8f5ed,0xe3dacf,0xf1e6d3,0xecebe5];
 for(let row=0;row<rows;row++){
  const t=from+(row+.5)*width,offset=row%2?span/2:0;
  for(let k=offset?-1:0;k<bays;k++){
   const a=Math.max(lo,lo+offset+k*span),b=Math.min(hi,lo+offset+(k+1)*span);
   if(b-a<.08)continue;
   const u=(a+b)/2,idx=Math.abs((row+17*k+rows)%6);
   registerStreetFitting('pier-board',acrossX?u:t,rect.y-.073,acrossX?t:u,[b-a-.004,.073,width-.006],
    acrossX?0:Math.PI/2,{reach:24,highReach:12,tint:tints[idx]});
  }
 }
}
function fittingTemplate(id){
 const a=BUILDING_FITTINGS,cached=a.templates.get(id);
 if(cached)return cached;
 if(id==='concrete-panel'){const t=pavementTemplate();a.templates.set(id,t);return t;}
 if(id==='mission-pantile-low'){
  // Keep the visible pan, cap and lapped nose on the street-facing roof.
  const p=[],indices=[],uv=[],profile=[[-.50,.24],[-.27,.13],[-.035,.31],[.084,.75],[.246,.99],[.37,.83],[.50,.31]];
  for(const [z,h,taper] of [[.50,-.125,1],[.50,0,1],[-.50,.046,.935]])for(const [x,rise] of profile){
   p.push(x*taper,rise+h,z);uv.push(x+.5,z+.5);
  }
  const n=profile.length;
  for(let row=0;row<2;row++)for(let k=0;k<n-1;k++){
   const i=row*n+k;indices.push(i,i+1,i+n,i+1,i+n+1,i+n);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  const t={dimensions:[1,1,1],primitives:[{geo:g,mat:new THREE.MeshStandardMaterial({color:lin(0xad694d),roughness:.90}),local:new THREE.Matrix4()}]};
  a.templates.set(id,t);return t;
 }
 if(a.pending.has(id))return null;
 const request=requestScenery(id);if(!request)return null;
 a.pending.add(id);
 request.then(root=>{
  a.pending.delete(id);
  if(!root){a.retryAt=performance.now()+10000;return;}
  root.updateWorldMatrix(true,true);const primitives=[];
  root.traverse(node=>{
   if(!node.isMesh)return;
   let p=node;
   while(p&&p.name!=='ColdDoor')p=p.parent;
   primitives.push({geo:node.geometry,mat:node.material,local:node.matrixWorld.clone(),hinge:p?.matrixWorld.clone()});
  });
  a.templates.set(id,{dimensions:root.userData.dimensions,primitives});a.key='';
 });
 return null;
}
function fitMatrix(f,template){
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(f.pitch||0,f.yaw||0,f.roll||0,'YXZ'));
 const scale=new V3(...f.dims).divide(new V3(...template.dimensions));
 return new THREE.Matrix4().compose(new V3(f.x,f.y,f.z),q,scale);
}
function streamBuildingFittings(pos){
 const a=BUILDING_FITTINGS;
 const key=[Math.floor(pos.x/5),Math.floor(pos.y/3.1),Math.floor(pos.z/5)].join(',');
 if(a.retryAt&&performance.now()>a.retryAt){a.key='';a.retryAt=0;}
 if(key===a.key)return;a.key=key;
 a.lamps=[];
 const items=new Map(),select=f=>{
  if(f.light)a.lamps.push(f.light);
  if(!items.has(f.id))items.set(f.id,[]);items.get(f.id).push(f);
 };
 for(const b of CONSTRUCTION.near)for(const s of b.structures||[]){
  if(rectDistance(s,pos.x,pos.z)>37)continue;
  for(const l of s.levels){
   if(l.y0>pos.y+9)break;
   if(l.h<pos.y-4.6)continue;
   for(const f of l.fittings||[]){
    const reach=Math.max(...f.dims)>1.7?28:Math.max(...f.dims)>.8?22:15;
    if(Math.hypot(pos.x-f.x,pos.z-f.z)<reach)select(f);
   }
  }
 }
 const limit=65;
 for(let i=Math.floor((pos.x-limit)/CELL);i<=Math.floor((pos.x+limit)/CELL);i++)for(let j=Math.floor((pos.z-limit)/CELL);j<=Math.floor((pos.z+limit)/CELL);j++){
  for(const f of a.outdoor.get(i+','+j)||[]){
   const distance=Math.hypot(f.x-pos.x,f.z-pos.z),dy=Math.abs(f.y-pos.y);
   if(distance>=(f.reach||45)||dy>=(f.highReach||24))continue;
   select(f.id==='mission-pantile'&&(distance>13.5||dy>5.6)?{...f,id:'mission-pantile-low'}:f);
  }
 }
 collectNearBrickwork(pos,select);collectPaving(pos,select);
 for(const d of a.drawnLeaves)d.draw=null;
 for(const proxy of a.hiddenProxies)proxy.visible=true;
 a.hiddenProxies.length=0;
 a.drawnLeaves.clear();disposePartBatches(a.batches);a.batches=[];
 for(const [id,rows] of items){
  const template=fittingTemplate(id);if(!template)continue;
  for(const f of rows)if(f.farModel){f.farModel.visible=false;a.hiddenProxies.push(f.farModel);}
  const matrices=rows.map(f=>fitMatrix(f,template));
  for(const p of template.primitives){
   const hingeInverse=p.hinge?.clone().invert();
   const hasTint=f=>f.tint&&(!f.tintMaterial||p.mat.name===f.tintMaterial);
   const colored=rows.some(hasTint);
   const batch=new THREE.InstancedMesh(p.geo,colored?instancedTintMaterial(p.mat):p.mat,rows.length);
   batch.castShadow=id!=='concrete-panel'&&id!=='municipal-cover'&&id!=='pier-board'&&!p.mat.transparent;
   batch.receiveShadow=true;batch.frustumCulled=false;
   for(let i=0;i<rows.length;i++){
    const f=rows[i],base=new THREE.Matrix4().multiplyMatrices(matrices[i],p.local);
    if(p.hinge&&f.leaf){
     a.drawnLeaves.add(f.leaf);const parts=f.leaf.draw||(f.leaf.draw=[]);
     const entry={batch,i,base:matrices[i].clone().multiply(p.hinge),offset:hingeInverse.clone().multiply(p.local)};
     parts.push(entry);moveRefrigeratorDraw(entry,f.leaf.phase);
    }else batch.setMatrixAt(i,base);
    if(colored)batch.setColorAt(i,lin(hasTint(f)?f.tint:0xffffff));
   }
   scene.add(batch);a.batches.push(batch);
  }
 }
}
function suiteFixtureAction(pos){
 const b=blockOf(pos.x,pos.z);
 if(!b?.structures)return null;
 let nearest=null,distance=1.08;
 for(const s of b.structures){
  if(!withinRect(s,pos.x,pos.z))continue;
  for(const l of s.levels){
   if(l.y0>pos.y+.44)break;
   if(l.y0<pos.y-.44)continue;
   for(const f of l.fittings||[]){
    const device=f.tap||f.leaf||f.cistern;if(!device)continue;
    const x=device.reachX??device.opX,z=device.reachZ??device.opZ,d=Math.hypot(x-pos.x,z-pos.z);
    if(d>=distance||rayWorld(pos.x,pos.z,x,z,pos.y+1.32,l.y0+1.32,.027)<.98)continue;
    nearest=f;distance=d;
   }
  }
 }return nearest&&residentialFixtureAction(nearest);
}
function retireSuiteTaps(){
 for(const c of BUILDING_FITTINGS.activeCisterns)if(!c.emptying&&c.volume>=5.999){
  const i=CIVIC.cisterns.indexOf(c);if(i>=0)CIVIC.cisterns.splice(i,1);
  BUILDING_FITTINGS.activeCisterns.delete(c);
 }
 for(const tap of BUILDING_FITTINGS.activeTaps)if(tap.time<=0){
  scene.remove(tap.stream);tap.stream.geometry.dispose();tap.stream=null;
  const i=CITY_WORKS.fixtures.indexOf(tap);if(i>=0)CITY_WORKS.fixtures.splice(i,1);
  BUILDING_FITTINGS.activeTaps.delete(tap);
 }
}
function collectNearBrickwork(pos,select){
 const length=.215,height=.073;
 function lay(p){
  if(rectDistance(p,pos.x,pos.z)>7||p.h<pos.y-.28||p.y0>pos.y+4.7)return;
  const flat=p.side==='S'||p.side==='N',axis=flat?'x':'z';
  const min=Math.max(p[axis+'0'],pos[axis]-5.5),max=Math.min(p[axis+'1'],pos[axis]+5.5);
  const face=p.side==='S'?p.z1:p.side==='N'?p.z0:p.side==='E'?p.x1:p.x0;
  const sign=p.side==='S'||p.side==='E'?1:-1;
  if((pos[flat?'z':'x']-face)*sign<-.28)return;
  for(let row=Math.floor(Math.max(p.y0,pos.y-.28)/height);row*height<Math.min(p.h,pos.y+4.7);row++){
   const y=Math.max(p.y0,row*height+.004),top=Math.min(p.h,(row+1)*height-.004);
   if(top-y<.011)continue;
   const off=(row%2)*length/2;
   for(let col=Math.floor((min-off)/length);col*length+off<max;col++){
    const a=Math.max(p[axis+'0'],col*length+off+.0045),b=Math.min(p[axis+'1'],(col+1)*length+off-.0045);
    if(b-a<.025)continue;
    const tone=Math.abs((row*83+col*2341)%7);
    const palette=p.masonryTint||[0xb6a191,0xa58b7f,0xb59e8d,0xa89484,0xbaa898,0xb2a39a,0xb6a497];
    const x=flat?(a+b)/2:face-sign*.030,z=flat?face-sign*.030:(a+b)/2;
    select({id:'bond-brick',x,y,z,yaw:flat?0:Math.PI/2,dims:[b-a,top-y,.078],tint:palette[tone]});
   }
  }
 }
 for(const b of CONSTRUCTION.near){
  for(const p of b.bondWalls||[])lay(p);
  for(const s of b.structures||[])if(rectDistance(s,pos.x,pos.z)<7.2){
   for(const l of s.levels)if(l.parts&&l.h>pos.y-.3&&l.y0<pos.y+4.8)for(const p of l.parts)if(p.brick)lay(p);
  }
 }
}
