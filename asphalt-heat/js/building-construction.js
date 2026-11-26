/* Storeys, switchback stairs and sliding sashes. Dimensions are in world metres. */
const CONSTRUCTION={near:new Set(),bodies:new Map(),moving:new Set(),coatings:new Map(),paneMaterial:null,
 visualCell:'',physicalCell:'',brickCell:'',brickMesh:null,proxyQueue:new Set()};
const withinRect=(r,x,z)=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
const rectDistance=(r,x,z)=>Math.hypot(x-clamp(x,r.x0,r.x1),z-clamp(z,r.z0,r.z1));
const partBox=(r,y0,h,role,mat)=>({...r,y0,h,role,mat});
function constructionFinish(material){
 if(!CONSTRUCTION.coatings.has(material)){
  const finish=material.clone();
  finish.vertexColors=false;
  // The repeated boxes have different dimensions. Sample the finish in metres across their joints.
  finish.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',[
    '#include <uv_vertex>','#if defined(USE_UV) && defined(USE_INSTANCING) && !defined(UVS_VERTEX_ONLY)',
    'vec3 wallPoint=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;',
    'vec2 wallUV=abs(normal.y)>.5?wallPoint.xz:abs(normal.x)>.5?wallPoint.zy:wallPoint.xy;',
    'vUv=(uvTransform*vec3(wallUV,1.)).xy;','#endif'].join('\n'));
  };
  finish.customProgramCacheKey=()=>'assembled-metric-finish';
  CONSTRUCTION.coatings.set(material,finish);
 }return CONSTRUCTION.coatings.get(material);
}
function architecturalGlass(){
 if(!CONSTRUCTION.paneMaterial){
  const mat=INTERIORS.materials.glass.clone();
  mat.color.copy(lin(0xabc1c1));mat.opacity=.29;mat.roughness=.115;mat.metalness=.42;
  mat.envMapIntensity=1.25;CONSTRUCTION.paneMaterial=mat;
 }return CONSTRUCTION.paneMaterial;
}
function collectBuildingProxy(block,mat,geometry){
 if(!block.proxyGeometries)block.proxyGeometries=new Map();
 if(!block.proxyGeometries.has(mat))block.proxyGeometries.set(mat,[]);
 block.proxyGeometries.get(mat).push(geometry);CONSTRUCTION.proxyQueue.add(block);
}
function finishBuildingProxies(){
 for(const block of CONSTRUCTION.proxyQueue){
  block.proxies=block.proxies||[];
  for(const [mat,geos] of block.proxyGeometries){
   const mesh=new THREE.Mesh(mergeGeos(geos),mat);
   mesh.castShadow=!mat.transparent;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;
   block.proxies.push(mesh);scene.add(mesh);geos.forEach(g=>g.dispose());
  }
  block.proxyGeometries.clear();
 }CONSTRUCTION.proxyQueue.clear();
}
function orientedRect(alongX,u0,u1,v0,v1){
 return alongX?{x0:v0,x1:v1,z0:u0,z1:u1}:{x0:u0,x1:u1,z0:v0,z1:v1};
}
function planStairCore(rect,base,heights){
 const width=rect.x1-rect.x0,depth=rect.z1-rect.z0,alongX=width>depth;
 const across=alongX?depth:width,length=alongX?width:depth;
 if(across<3.05||length<5.2)return null;
 const uc=alongX?(rect.z0+rect.z1)/2:(rect.x0+rect.x1)/2;
 const vc=alongX?(rect.x0+rect.x1)/2:(rect.z0+rect.z1)/2;
 let rise=0,previous=base;
 for(const height of heights){rise=Math.max(rise,height-previous);previous=height;}
 const half=Math.min(1.26,(across-.8)/2),landing=Math.min(1.21,half);
 const run=Math.min(Math.ceil(rise/.36)*.275,length-2*landing-.55);
 const v0=vc-(run+landing)/2,v1=v0+run,u0=uc-half-.045,u1=uc+half+.045;
 return {alongX,u0,u1,uc,v0,v1,landing,run,
  opening:orientedRect(alongX,u0,u1,v0,v1+landing),
  approach:orientedRect(alongX,u0-.22,u1+.22,v0-landing-.23,v1+landing+.23)};
}
function createStoreys(block,footprint,base,first,tiers,options={}){
 const levels=[];let y=base;
 const add=(top,rect,tier,ground=false)=>{
  if(top-y<.05)return;
  levels.push({index:levels.length,y0:y,h:top,rect,tier,ground});y=top;
 };
 add(first,footprint,tiers[0],true);
 for(const tier of tiers){
  const n=Math.max(1,Math.round((tier.h-y)/(tier.fh||3.4))),lo=y;
  for(let i=1;i<=n;i++)add(lo+(tier.h-lo)*i/n,tier.rect,tier);
 }
 const usable=levels.length>1&&levels[1].h-levels[1].y0>=2.05;
 const last=levels[levels.length-1];
 const core=usable?planStairCore(last.rect,base,levels.map(f=>f.h)):null;
 const s={...footprint,y0:base,h:last.h,construction:true,block,levels,core,modified:new Map(),
  pitched:!!options.pitched,warehouse:!!options.warehouse,joined:options.joined||null};
 for(const l of levels)l.owner=s;
 (block.structures||(block.structures=[])).push(s);block.bld.push(s);
 for(const tier of tiers){
  tier.finish=constructionFinish(tier.mat);
  tier.brick=Object.keys(MAT.fac).some(k=>k.startsWith('brick')&&MAT.fac[k]===tier.mat);
 }
 return s;
}
function extendStoreys(s,rect,base,top,mat,style){
 const tier={...style,rect,h:top,mat,finish:constructionFinish(mat),
  brick:Object.keys(MAT.fac).some(k=>k.startsWith('brick')&&MAT.fac[k]===mat)};
 const n=Math.max(1,Math.round((top-base)/(style.fh||3.4)));
 for(let i=0;i<n;i++){
  s.levels.push({index:s.levels.length,owner:s,rect,tier,y0:base+(top-base)*i/n,h:base+(top-base)*(i+1)/n});
 }
 s.h=Math.max(s.h,top);
 facadeBox(mat,rect.x0,rect.x1,base,top,rect.z0,rect.z1,{...style,top,block:s.block});
}
function hasStair(level){
 const s=level.owner;
 return !!s.core&&(!s.pitched||level.index<s.levels.length-1);
}
function flightMetrics(level){
 const c=level.owner.core,halfRise=(level.h-level.y0)/2;
 return {core:c,steps:Math.max(3,Math.ceil(halfRise/.18)),halfRise,mid:level.y0+halfRise};
}
function storeyGroundAt(block,x,z,ref,street){
 if(!block?.structures||ref==null)return street;
 let y=street;
 for(const s of block.structures){
  if(!withinRect(s,x,z)||ref<s.y0-.48)continue;
  for(const l of s.levels){
   if(l.y0>ref+.43)break;
   if(!withinRect(l.rect,x,z))continue;
   const stairs=hasStair(l),open=stairs&&withinRect(s.core.opening,x,z);
   if(!open&&l.h<=ref+.42)y=Math.max(y,l.h);
   if(!open||l.h<ref-.52)continue;
   const {core:c,steps,mid,halfRise}=flightMetrics(l);
   const u=c.alongX?z:x,v=c.alongX?x:z;
   let tread=mid;
   if(v<c.v1){
    const second=u>c.uc,t=clamp((second?c.v1-v:v-c.v0)/c.run,0,1);
    tread=(second?mid:l.y0)+Math.min(steps,Math.floor(t*steps)+1)*halfRise/steps;
   }
   if(tread<=ref+.42&&tread>=ref-.6)y=Math.max(y,tread);
  }
 }return y;
}
function addStairParts(l,add){
 const {core:c,steps,halfRise,mid}=flightMetrics(l),R=(a,b,v,w)=>orientedRect(c.alongX,a,b,v,w);
 const solid=(r,b,t,k,m)=>add(partBox(r,b,t,k,m));
 solid(R(c.u0,c.u1,c.v1,c.v1+c.landing),mid-.14,mid,'floor',MAT.stone);
 for(const second of [false,true]){
  const a=second?c.uc+.057:c.u0,b=second?c.u1:c.uc-.057;
  const at=f=>second?c.v1-c.run*f:c.v0+c.run*f;
  const lo=second?mid:l.y0;
  for(let k=0;k<steps;k++){
   const v=at(k/steps),w=at((k+1)/steps),bottom=lo+k*halfRise/steps,top=lo+(k+1)*halfRise/steps;
   const z0=Math.min(v,w),z1=Math.max(v,w);
   solid(R(a,b,z0,z1),bottom-.075,top,'floor',MAT.stone);
   const nose=second?v-.014:v+.014;
   solid(R(a+.035,b-.035,nose-.012,nose+.012),top,top+.006,'trim',MAT.metal);
   for(const rail of [a+.035,b-.035]){
    const e=R(rail-.025,rail+.025,z0,z1);
    // Each rail span blocks lateral passage across the stairwell; posts and the sloping handrail render separately.
    solid(e,bottom-.035,top+.91,'barrier',null);
    if(k%4===0||k===steps-1)solid(R(rail-.019,rail+.019,(v+w)/2-.019,(v+w)/2+.019),top,top+.90,'trim',MAT.darkMetal);
   }
  }
  for(const rail of [a+.035,b-.035]){
   const axis=c.alongX?'x':'z',coord=(c.v0+c.v1)/2;
   const p=partBox(R(rail-.035,rail+.035,coord-.035,coord+.035),lo+halfRise/2+.88,lo+halfRise/2+.95,'trim',MAT.darkMetal);
   p.beam={axis,length:Math.hypot(c.run,halfRise),slope:Math.atan2((second?-1:1)*halfRise,c.run)};add(p);
  }
 }
 const end=c.v1+c.landing-.035;
 solid(R(c.u0,c.u1,end-.023,end+.023),mid,mid+.91,'barrier',null);
 solid(R(c.u0,c.u1,end-.026,end+.026),mid+.88,mid+.94,'trim',MAT.darkMetal);
 for(const u of [c.u0+.04,c.uc,c.u1-.04])
  solid(R(u-.022,u+.022,end-.022,end+.022),mid,mid+.90,'trim',MAT.darkMetal);
}
function wallRect(rect,side,l,r,inner,outer){
 if(side==='N')return {x0:l,x1:r,z0:rect.z0+inner,z1:rect.z0+outer};
 if(side==='S')return {x0:l,x1:r,z0:rect.z1-outer,z1:rect.z1-inner};
 if(side==='W')return {x0:rect.x0+inner,x1:rect.x0+outer,z0:l,z1:r};
 return {x0:rect.x1-outer,x1:rect.x1-inner,z0:l,z1:r};
}
function addGlazing(holder,rect,side,l,r,base,top,key,operable,add){
 const along=side==='N'||side==='S'?'x':'z',w=(r-l)/2,mid=(r+l)/2;
 const W=(a,b,i,o)=>wallRect(rect,side,a,b,i,o),frame=MAT.darkMetal;
 const sash=operable?{owner:holder,key,axis:along,travel:w-.07,parts:[],phase:holder.modified.get(key)||0,target:holder.modified.get(key)||0,
  y0:base,h:top,area:W(l,mid,.035,.11)}:null;
 if(sash)holder.sashes.push(sash);
 const item=(a,b,lo,hi,inside,outside,role,mat,mobile=false)=>{
  const p=partBox(W(a,b,inside,outside),lo,hi,role,mat);
  if(mobile&&sash){
   p.sash=sash;p.origin=p[along+'0'];p.width=p[along+'1']-p.origin;
   moveSashPart(p,sash.phase);sash.parts.push(p);
  }add(p);
 };
 item(l-.026,r+.026,base-.038,base+.015,-.025,.145,'frame',frame);
 item(l-.026,r+.026,top-.017,top+.038,-.025,.145,'frame',frame);
 for(const [a,b,inset,mobile] of [[l,mid,.052,true],[mid,r,.104,false]]){
  item(a+.028,b-.028,base+.031,top-.033,inset,inset+.012,'glass',architecturalGlass(),mobile);
  for(const x of [a+.017,b-.017])item(x-.017,x+.017,base,top,inset-.014,inset+.027,'frame',frame,mobile);
  item(a+.028,b-.028,base,base+.037,inset-.017,inset+.03,'frame',frame,mobile);
  item(a+.028,b-.028,top-.039,top,inset-.017,inset+.03,'frame',frame,mobile);
 }
 if(sash)item(mid-.095,mid-.060,base+(top-base)*.43,base+(top-base)*.43+.12,.068,.139,'trim',MAT.metal,true);
}
function storeyParts(l){
 if(l.parts)return l.parts;
 const s=l.owner,r=l.rect,t=l.tier,parts=[];
 l.sashes=[];l.modified=s.modified;const add=p=>parts.push(p);
 const holes=hasStair(l)?[s.core.opening]:[];
 for(const p of subtractCityOpenings(r,holes))add(partBox(p,l.h-.14,l.h,'floor',l.index===s.levels.length-1?MAT.roof:INTERIORS.materials.ceiling));
 if(hasStair(l))addStairParts(l,add);
 suiteParts(l,add);
 if(l.ground&&!s.warehouse){l.parts=parts;return parts;}
 const bottom=l.ground?l.tier.wallBase:l.y0,top=l.h-.14;
 if(top-bottom<.14){l.parts=parts;return parts;}
 const lowRoom=top-bottom<2.0;
 for(const side of ['N','S','E','W']){
  if(side===t.authoredSide)continue;
  const horizontal=side==='N'||side==='S',a=horizontal?r.x0:r.z0,b=horizontal?r.x1:r.z1,length=b-a;
  const count=Math.max(1,Math.round(length/(t.bay||3))),bay=length/count;
  const sill=bottom+(top-bottom)*(t.style===2?.13:t.style===3?.62:.28);
  const head=bottom+(top-bottom)*(t.style===3?.86:.85);
  const wall=(a,b,y0,h,inner=0,outer=.2,role='wall',material=t.finish)=>{
   const p=partBox(wallRect(r,side,a,b,inner,outer),y0,h,role,material);
   p.side=side;p.tint=t.tint||0xffffff;p.brick=t.brick&&role==='wall';add(p);
  };
  if(lowRoom){wall(a,b,bottom,top);continue;}
  wall(a,b,bottom,sill);wall(a,b,head,top);
  const margin=Math.min(bay*.31,t.style===2?.13:t.style===1?.46:.34);
  for(let i=0;i<count;i++){
   const start=a+i*bay,end=start+bay,from=start+margin,to=end-margin;
   wall(i===0?a:start-margin,from,sill,head);
   if(i===count-1)wall(to,b,sill,head);
   const id=l.index+side+i;
   if(t.style===3&&i%2===1){wall(from,to,sill,head);continue;}
   addGlazing(l,r,side,from,to,sill,head,id,i===Math.floor(count/2)&&t.style!==2,add);
   if(t.style!==2){
    wall(from-.085,to+.085,sill-.076,sill,-.085,.135,'trim',MAT.trim);
    if(t.style===1)wall(from-.075,to+.075,head,head+.10,-.060,.14,'trim',MAT.trim);
   }
  }
 }
 l.parts=parts;return parts;
}
function groundGlazing(block,M,from,to,sill,top){
 const yaw=Math.atan2(M.elements[8],M.elements[10]),side=Math.abs(Math.sin(yaw))>.5?(Math.sin(yaw)>0?'E':'W'):(Math.cos(yaw)>0?'S':'N');
 const rect=lrect(M,from,to,0,0),horizontal=side==='S'||side==='N',a=horizontal?rect.x0:rect.z0,b=horizontal?rect.x1:rect.z1;
 const bundle={...wallRect(rect,side,a-.029,b+.029,-.03,.15),y0:sill-.04,h:top+.04,glazing:true,
  block,parts:[],modified:new Map(),sashes:[]};
 const divisions=Math.max(1,Math.round((b-a)/3.1));
 for(let i=0;i<divisions;i++)addGlazing(bundle,rect,side,a+(b-a)*i/divisions,a+(b-a)*(i+1)/divisions,sill,top,i,true,p=>bundle.parts.push(p));
 block.bld.push(bundle);(block.lightsGlazing||(block.lightsGlazing=[])).push(bundle);
 // A pane and perimeter bars form the distant view. The fitted sashes replace these at walking distance.
 const pane=new THREE.PlaneGeometry(to-from,top-sill);
 pane.translate((to+from)/2,(top+sill)/2,-.079);pane.applyMatrix4(M);collectBuildingProxy(block,architecturalGlass(),pane);
 for(const p of bundle.parts)if(p.role==='frame'){
  const g=new THREE.BoxGeometry(p.x1-p.x0,p.h-p.y0,p.z1-p.z0);
  g.translate((p.x0+p.x1)/2,(p.y0+p.h)/2,(p.z0+p.z1)/2);collectBuildingProxy(block,p.mat,g);
 }
 return bundle;
}
function moveSashPart(p,phase){
 const key=p.sash.axis,lo=p.origin+p.sash.travel*phase;p[key+'0']=lo;p[key+'1']=lo+p.width;
}
function partMatrix(p){
 const m=new THREE.Matrix4(),x=(p.x0+p.x1)/2,y=(p.y0+p.h)/2,z=(p.z0+p.z1)/2;
 if(p.beam){
  const {axis,length,slope}=p.beam;
  if(axis==='x')m.makeRotationZ(slope).scale(new V3(length,.054,.058));
  else m.makeRotationX(-slope).scale(new V3(.058,.054,length));
 }else m.makeScale(p.x1-p.x0,p.h-p.y0,p.z1-p.z0);
 return m.setPosition(x,y,z);
}
function buildPartBatches(parts){
 const groups=new Map(),result=[];
 for(const p of parts){
  if(!p.mat)continue;
  const key=p.mat.uuid+(p.round?'-tube':'-box');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
 }
 for(const group of groups.values()){
  const mat=group[0].mat,geom=group[0].round?(CONSTRUCTION.riserGeometry||=new THREE.CylinderGeometry(.5,.5,1,8)):unitBox;
  const batch=new THREE.InstancedMesh(geom,mat,group.length);
  batch.castShadow=!mat.transparent;batch.receiveShadow=true;batch.frustumCulled=false;
  let colored=false;
  for(let i=0;i<group.length;i++){
   const p=group[i];batch.setMatrixAt(i,partMatrix(p));
   if(p.tint&&p.tint!==0xffffff){batch.setColorAt(i,lin(p.tint));colored=true;}
   if(p.sash)p.draw={batch,i};
  }
  if(colored)for(let i=0;i<group.length;i++)if(!group[i].tint||group[i].tint===0xffffff)batch.setColorAt(i,new THREE.Color(1,1,1));
  scene.add(batch);result.push(batch);
 }return result;
}
function disposePartBatches(batches){
 for(const b of batches){scene.remove(b);b.dispose();}
}
function nearbyConstruction(x,z,radius,fn){
 const i0=clamp(Math.floor((x-radius)/CELL),0,N-1),i1=clamp(Math.floor((x+radius)/CELL),0,N-1);
 const j0=clamp(Math.floor((z-radius)/CELL),0,N-1),j1=clamp(Math.floor((z+radius)/CELL),0,N-1);
 for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const b=blocks[i*N+j];if(b&&(b.structures||b.lightsGlazing)&&rectDistance(b,x,z)<=radius)fn(b);}
}
function constructionMeshes(x,z){
 const key=Math.floor(x/8)+'/'+Math.floor(z/8);if(key===CONSTRUCTION.visualCell)return;
 CONSTRUCTION.visualCell=key;const next=new Set();
 nearbyConstruction(x,z,24,b=>next.add(b));
 for(const b of CONSTRUCTION.near)if(!next.has(b)){
  disposePartBatches(b.partMeshes);b.partMeshes=null;
  for(const p of b.proxies||[])p.visible=true;
  for(const p of b.suiteDoorBatches||[])p.visible=false;
  for(const g of b.lightsGlazing||[])for(const p of g.parts)p.draw=null;
  for(const s of b.structures||[])for(const l of s.levels){
   if(l.parts)for(const p of l.parts)p.draw=null;
   releaseStoreyParts(l);
  }
 }
 for(const b of next)if(!CONSTRUCTION.near.has(b)){
  const all=[];
  for(const g of b.lightsGlazing||[])all.push(...g.parts);
  for(const s of b.structures||[])for(const l of s.levels)all.push(...storeyParts(l));
  b.partMeshes=buildPartBatches(all);
  for(const p of b.proxies||[])p.visible=false;
  for(const p of b.suiteDoorBatches||[])p.visible=true;
 }
 CONSTRUCTION.near=next;
}
function releaseStoreyParts(l){
 if(l.body||l.owner.block.partMeshes||l.sashes?.some(s=>CONSTRUCTION.moving.has(s)))return;
 l.parts=null;l.sashes=null;
}
function physicalParts(holder){
 const parts=holder.glazing?holder.parts:storeyParts(holder),r=holder.rect||holder;
 const body=new CANNON.Body({mass:0,material:PH.mat.concrete,collisionFilterGroup:PHYS_GROUP.world});
 body.position.set((r.x0+r.x1)/2,(holder.y0+holder.h)/2,(r.z0+r.z1)/2);
 for(const p of parts){
  if(p.role==='trim')continue;
  const offset=new CV((p.x1+p.x0)/2-body.position.x,(p.h+p.y0)/2-body.position.y,(p.z1+p.z0)/2-body.position.z);
  body.addShape(new CANNON.Box(new CV((p.x1-p.x0)/2,(p.h-p.y0)/2,(p.z1-p.z0)/2)),offset);
  if(p.sash)p.shapeOffset=body.shapeOffsets[body.shapeOffsets.length-1];
 }
 PH.w.addBody(body);holder.body=body;return body;
}
function streamConstructionPhysics(x,z,y){
 const key=Math.floor(x/12)+'/'+Math.floor(z/12)+'/'+Math.floor(y/2);
 if(key===CONSTRUCTION.physicalCell)return;CONSTRUCTION.physicalCell=key;
 const next=new Set();
 nearbyConstruction(x,z,141,block=>{
  for(const s of block.structures||[]){
   if(rectDistance(s,x,z)>136)continue;
   const local=rectDistance(s,x,z)<40;
   for(const level of s.levels){
    if(level.y0>Math.max(6.5,local?y+4.4:0))break;
    if(level.y0<6.5||local&&level.h>y-3.0)next.add(level);
   }
  }
 });
 for(const [l,body] of CONSTRUCTION.bodies)if(!next.has(l)){
  physRemove(body);l.body=null;for(const p of l.parts)if(p.sash)p.shapeOffset=null;
  CONSTRUCTION.bodies.delete(l);releaseStoreyParts(l);
 }
 for(const l of next)if(!CONSTRUCTION.bodies.has(l))CONSTRUCTION.bodies.set(l,physicalParts(l));
}
function forConstructionParts(r,bottom,top,fn){
 if(r.glazing){for(const p of r.parts)if(p.role!=='trim'&&p.h>=bottom&&p.y0<=top)fn(p);return;}
 for(const l of r.levels){
  if(l.y0>top+.15)break;
  if(l.h+.96<bottom)continue;
  for(const p of storeyParts(l))if(p.role!=='trim'&&p.h>=bottom&&p.y0<=top)fn(p);
  releaseStoreyParts(l);
 }
}
function constructionWindowAction(pos){
 let choice=null,distance=1.28;
 nearbyConstruction(pos.x,pos.z,2,block=>{
  const consider=sash=>{
   if(sash.y0>pos.y+1.82||sash.h<pos.y+.63)return;
   const d=rectDistance(sash.area,pos.x,pos.z);
   if(d<distance){choice=sash;distance=d;}
  };
  for(const g of block.lightsGlazing||[])if(rectDistance(g,pos.x,pos.z)<1.3)for(const sash of g.sashes)consider(sash);
  for(const s of block.structures||[])if(rectDistance(s,pos.x,pos.z)<1.3){
   for(const l of s.levels)if(l.sashes&&l.y0<=pos.y+.35&&l.h>pos.y+.5)for(const sash of l.sashes)consider(sash);
  }
 });
 if(!choice)return null;
 return {label:choice.target?'CLOSE WINDOW':'SLIDE WINDOW OPEN',hot:true,fn:()=>{
  choice.target=choice.target?0:1;CONSTRUCTION.moving.add(choice);noise(.10,610,.075);
 }};
}
function advanceSashes(dt,pos){
 for(const sash of CONSTRUCTION.moving){
  const next=sash.phase+clamp(sash.target-sash.phase,-dt*2.1,dt*2.1),axis=sash.axis;
  if(next<sash.phase&&sash.y0<pos.y+1.64&&sash.h>pos.y+.14){
   const sliding={...sash.area};sliding[axis+'0']+=next*sash.travel;sliding[axis+'1']+=next*sash.travel;
   if(rectDistance(sliding,pos.x,pos.z)<.35){sash.target=1;continue;}
  }
  sash.phase=next;
  if(next)sash.owner.modified.set(sash.key,next);else sash.owner.modified.delete(sash.key);
  const body=sash.owner.body;
  for(const p of sash.parts){
   moveSashPart(p,next);
   if(p.draw){p.draw.batch.setMatrixAt(p.draw.i,partMatrix(p));p.draw.batch.instanceMatrix.needsUpdate=true;}
   if(body&&p.shapeOffset)p.shapeOffset[axis]=(p[axis+'0']+p[axis+'1'])/2-body.position[axis];
  }
  if(body){body.aabbNeedsUpdate=true;body.updateBoundingRadius();}
  if(next===sash.target)CONSTRUCTION.moving.delete(sash);
 }
}
