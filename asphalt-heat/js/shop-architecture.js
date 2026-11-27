/* Street elevations measured from the Natural Photos. Local +Z faces the pavement. */
const SHOP_ELEVATIONS={brick:null,stucco:null,sash:null,sill:null,panes:null,caps:null,fascias:null,awning:null,frontages:[]};
const RIVERSIDE_SHOPS={
 donuts:{name:'Riverside Donuts',line:'BAKED DAILY',color:'#4e3136'},
 books:{name:'Harbor Books & Café',address:'248',color:'#282b29'},
 studio:{name:'Coastal Nails',address:'252',line:'NAILS · PEDICURE · WAXING',color:'#633b43'}
};

function initShopArchitecture(){
 const a=SHOP_ELEVATIONS;
 a.brick=pbr('riverside-brick',1,{ns:.55,rough:.87,env:.38});
 a.stucco=pbr('plaster',1.8,{rough:.91,ns:.44,color:0xddd5c6});
 const prints=TLD.load('tex/shop-prints.jpg');prints.encoding=THREE.sRGBEncoding;prints.anisotropy=8;
 a.prints=new THREE.MeshStandardMaterial({map:prints,roughness:.79});
 a.sash=new THREE.MeshStandardMaterial({color:lin(0x37332e),roughness:.48,metalness:.37});
 a.sill=pbr('concrete',1.15,{rough:.83,ns:.40,color:0xb2a79a});
 const tex=TLD.load('tex/shop-sash-panes.jpg');tex.encoding=THREE.sRGBEncoding;tex.anisotropy=8;
 a.panes=new THREE.MeshStandardMaterial({map:tex,color:lin(0xbec4c4),roughness:.13,metalness:.38,envMapIntensity:.57});
 a.awning=Object.values(RIVERSIDE_SHOPS).map(s=>new THREE.MeshStandardMaterial({color:lin(parseInt(s.color.slice(1),16)),roughness:.93,metalness:0}));
 const [im,g]=cvs(2048,768);
 Object.values(RIVERSIDE_SHOPS).forEach((s,i)=>{
  const y=i*256;
  g.fillStyle=s.color;g.fillRect(0,y,2048,256);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ebe2d2';
  const font=i===0?'italic 145px Georgia, serif':'139px Georgia, serif';
  g.save();g.translate(0,y+126);g.scale(.79,1);g.font=font;
  const x=i===2?790:1020;g.fillText(s.name,x/.79,0,i===2?1430:1800);g.restore();g.font=font;
  if(i===2){g.font='32px Georgia, serif';g.fillText(s.line,1696,y+158,540);}
  if(i===1){
   const left=1020-Math.min(1780,g.measureText(s.name).width)/2-101;
   for(const sign of [-1,1]){
    g.beginPath();g.moveTo(left,y+138);g.quadraticCurveTo(left+sign*17,y+119,left+sign*43,y+123);
    g.lineTo(left+sign*43,y+79);g.quadraticCurveTo(left+sign*16,y+76,left,y+92);g.fill();
   }
  }
 });
 a.fascias=new THREE.MeshStandardMaterial({map:ctex(im),roughness:.87,metalness:.025});
}

function frontageMasonry(mat,M,x0,x1,y0,y1,outer,coastal){
 if(x1<=x0||y1<=y0)return;
 const thick=.31,g=new THREE.BoxGeometry(x1-x0,y1-y0,thick);
 g.translate((x0+x1)/2,(y0+y1)/2,outer-thick/2);
 const pos=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<uv.count;i++){
  // Continue the mortar through the piers and spandrels at one measured scale.
  const u=Math.abs(n.getX(i))>.5?pos.getZ(i):pos.getX(i);
  const v=Math.abs(n.getY(i))>.5?pos.getZ(i):pos.getY(i);
  uv.setXY(i,u/(coastal?1:3.16),v/(coastal?1:1.58));
 }
 g.applyMatrix4(M);addGeo(mat,g,true);
}

function buildUpperShopFront(B,M,u0,u1,top,coastal){
 const a=SHOP_ELEVATIONS,wall=coastal?a.stucco:a.brick,w=u1-u0;
 const floors=Math.max(1,Math.round((top-4.1)/3.43)),h=(top-4.1)/floors;
 const n=Math.max(2,Math.round(w/(coastal?3.0:2.73))),pitch=w/n;
 const yaw=Math.atan2(M.elements[8],M.elements[10]);
 const side=Math.abs(Math.sin(yaw))>.5?(Math.sin(yaw)>0?'E':'W'):(Math.cos(yaw)>0?'S':'N');
 const strip=(l,r,b,t)=>{
  frontageMasonry(wall,M,l,r,b,t,.022,coastal);
  addRoomCollider(B,M,l,r,-.022,.288,t,b);
  if(!coastal)(B.bondWalls||(B.bondWalls=[])).push({...lrect(M,l,r,-.022,.288),y0:b,h:t,side});
 };
 const box=(mat,l,r,b,t,back,front)=>plainBox(mat,l,r,b,t,back,front,{M,uvm:1});
 for(let j=0;j<floors;j++){
  const base=4.1+j*h,sill=base+.37*h,head=base+.908*h;
  strip(u0,u1,base,sill);strip(u0,u1,head,base+h);
  for(let k=0;k<n;k++){
   const center=u0+(k+.5)*pitch,half=Math.min(pitch*.277,coastal?.85:.70);
   const l=center-half,r=center+half;
   strip(u0+k*pitch,l,sill,head);strip(r,u0+(k+1)*pitch,sill,head);
   box(a.sill,l-.11,r+.11,sill-.105,sill+.028,-.11,.148);
   box(coastal?a.sill:wall,l-.052,r+.052,head-.012,head+.104,-.137,.060);
   for(const x of [l+.038,r-.038])box(a.sash,x-.038,x+.038,sill+.030,head,-.218,-.124);
   for(const y of [sill+.072,lerp(sill,head,.48),head-.037]){
    box(a.sash,l+.065,r-.065,y-.027,y+.027,-.217,-.126);
   }
   if(coastal)box(a.sash,center-.018,center+.018,sill+.048,head,-.204,-.147);
   const g=new THREE.PlaneGeometry(r-l-.061,head-sill-.04),uv=g.attributes.uv;
   const tile=(B.i+k+(j%3===1?1:0))%4,row=coastal?0:1;
   for(let i=0;i<uv.count;i++)uv.setXY(i,(tile+.013+.974*uv.getX(i))/4,(row+.01+.98*uv.getY(i))/2);
   g.translate(center,(sill+head)/2,-.240);g.applyMatrix4(M);collectBuildingProxy(B,a.panes,g);
   const reveal=M.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-.112));
   groundGlazing(B,reveal,l+.077,r-.077,sill+.063,head-.048);
   for(const x of [l+.038,r-.038])addRoomCollider(B,M,x-.038,x+.038,.124,.218,head,sill+.03);
   if(!coastal&&(k+2*j+B.j)%5===2){
    const at=lpt(M,center,-.146);
    worksModel('window-ac',at.x,sill+.028,at.z,[.68,.34,.47],yaw,false);
   }
  }
 }
}

function riversideFascia(row,M,u0,u1){
 const index=row===RETAIL.donuts?0:row===RETAIL.books?1:2,a=SHOP_ELEVATIONS;
 const center=(u0+u1)/2,width=u1-u0-.41,angle=Math.atan2(.42,.85);
 const canvas=new THREE.PlaneGeometry(width,Math.hypot(.85,.42));
 // Canvas slopes down from the wall to the valance, leaving the transom visible below it.
 canvas.rotateX(-Math.PI/2+angle);canvas.translate(center,3.94,.48);canvas.applyMatrix4(M);
 addGeo(a.awning[index],canvas,true);
 const lip=new THREE.PlaneGeometry(width,.61),uv=lip.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i),(2-index+uv.getY(i))/3);
 lip.translate(center,3.438,.899);lip.applyMatrix4(M);addGeo(a.fascias,lip,true);
 for(const x of [u0+.28,u1-.28]){
  const wall=lpt(M,x,.02),out=lpt(M,x,-.879);
  worksBeam(MAT.darkMetal,[wall.x,3.28,wall.z],[out.x,3.716,out.z],.021);
 }
 const address=Object.values(RIVERSIDE_SHOPS)[index].address;
 if(address){
  const placard=worksSign(address,'#232522','#e6ddc8'),p=lpt(M,center,-.058);
  worksPlacard(placard,p.x,3.07,p.z,1.27,.34,Math.atan2(M.elements[8],M.elements[10]));
 }
}

// The mirror plane is shared by coplanar adjoining storefronts. The actual street across the
// glass appears through a separate clipped camera. The shop interior still draws through it.
function rememberShopGlass(M,u0,u1){
 const center=lpt(M,(u0+u1)/2,.035),normal=new V3(M.elements[8],0,M.elements[10]).normalize();
 SHOP_ELEVATIONS.frontages.push({center,normal,half:(u1-u0)/2});
}

const SHOP_REFLECTION={
 cam:new THREE.PerspectiveCamera(),rt:null,last:-Infinity,front:null,
 eye:new V3(),orientation:new THREE.Quaternion(),direction:new V3(),relative:new V3(),clip:new V3(),
 uniforms:{shopMirror:{value:null},shopProject:{value:new THREE.Matrix4()},shopPlane:{value:new THREE.Vector4()},shopMirrorOn:{value:0}}
};
function shopGlazing(){
 const m=new THREE.MeshStandardMaterial({color:lin(0xa2b3ba),metalness:.69,roughness:.095,
  envMapIntensity:.86,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,SHOP_REFLECTION.uniforms);
  sh.vertexShader=sh.vertexShader.replace('#include <common>',
   '#include <common>\nuniform mat4 shopProject;varying vec4 shopUV;varying vec3 shopWorld;')
   .replace('#include <fog_vertex>',
   '#include <fog_vertex>\nvec4 sw=modelMatrix*vec4(transformed,1.);shopWorld=sw.xyz;shopUV=shopProject*sw;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',
   '#include <common>\nuniform sampler2D shopMirror;uniform vec4 shopPlane;uniform float shopMirrorOn;varying vec4 shopUV;varying vec3 shopWorld;')
   .replace('#include <tonemapping_fragment>',`
   float fr=pow(1.-abs(dot(normalize(vViewPosition),normal)),4.);
   vec2 coord=shopUV.xy/max(.001,shopUV.w);
   float rim=1.-smoothstep(.47,.50,max(abs(coord.x-.5),abs(coord.y-.5)));
   float area=1.-smoothstep(.24,.37,abs(dot(shopPlane.xyz,shopWorld)+shopPlane.w));
   vec3 viewN=(viewMatrix*vec4(shopPlane.xyz,0.)).xyz;
   float mirror=shopMirrorOn*step(.96,abs(dot(viewN,normal)))*area*rim*step(0.,shopUV.w);
   if(mirror>.012)gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(shopMirror,coord).rgb,.92*mirror);
   gl_FragColor.a=mix(.16+.40*fr,.245+.57*fr,mirror);
   #include <tonemapping_fragment>`);
 };
 m.customProgramCacheKey=()=>'shop-planar-glass';
 return m;
}
function updateShopReflection(t){
 const r=SHOP_REFLECTION,u=r.uniforms;
 if(QUALITY.level<2){
  r.rt?.dispose();r.rt=null;r.front=null;
  u.shopMirror.value=null;u.shopMirrorOn.value=0;return;
 }
 if(camera.position.y<-.2||camera.position.y>22){u.shopMirrorOn.value=0;return;}
 camera.getWorldDirection(r.direction);
 let best=null,bestDistance=44;
 for(const f of SHOP_ELEVATIONS.frontages){
  const rel=r.relative.copy(camera.position).sub(f.center),ahead=rel.dot(f.normal);
  if(ahead<.18||ahead>bestDistance)continue;
  const along=rel.x*f.normal.z-rel.z*f.normal.x,extra=Math.max(0,Math.abs(along)-f.half);
  const d=Math.hypot(ahead,extra);
  if(d>=bestDistance)continue;
  rel.copy(f.center);rel.x+=clamp(along,-f.half,f.half)*f.normal.z;rel.z-=clamp(along,-f.half,f.half)*f.normal.x;
  rel.y=2;rel.sub(camera.position);
  if(rel.dot(r.direction)<-1)continue;
  best=f;bestDistance=d;
 }
 if(!best){u.shopMirrorOn.value=0;return;}
 const target=REFL.rt;
 if(!target){u.shopMirrorOn.value=0;return;}
 if(!r.rt||r.rt.width!==target.width||r.rt.height!==target.height){
  r.rt?.dispose();r.rt=new THREE.WebGLRenderTarget(target.width,target.height,{type:target.texture.type,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  r.front=null;
 }
 const moved=r.eye.distanceToSquared(camera.position)>.018||Math.abs(r.orientation.dot(camera.quaternion))<.99990;
 // Moving traffic refreshes in a stationary shop window too.
 if(best!==r.front||moved||t-r.last>.17){
  const n=best.normal;
  u.shopMirror.value=null;u.shopMirrorOn.value=0;r.clip.copy(best.center).addScaledVector(n,.06);
  capturePlanar(r.cam,r.rt,u.shopProject.value,n,r.clip);
  u.shopPlane.value.set(n.x,n.y,n.z,-n.dot(best.center));
  r.eye.copy(camera.position);r.orientation.copy(camera.quaternion);r.front=best;r.last=t;
 }
 u.shopMirror.value=r.rt.texture;u.shopMirrorOn.value=1;
}

function shopNotice(index,M,x,y,z,w,h){
 const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv,across=index%3,up=1-Math.floor(index/3);
 for(let i=0;i<uv.count;i++)uv.setXY(i,(across+.01+uv.getX(i)*.98)/3,(up+.01+uv.getY(i)*.98)/2);
 g.translate(x,y,z);g.applyMatrix4(M);addGeo(SHOP_ELEVATIONS.prints,g,false);
}
function dressShopDisplay(row,M,u0,u1){
 const width=u1-u0,center=(u0+u1)/2,yaw=Math.atan2(M.elements[8],M.elements[10]);
 const fixture=(name,x,y,v,dims,solid)=>{
  const p=lpt(M,x,v);worksModel(name,p.x,y,p.z,dims,yaw,solid);
 };
 if(row===RETAIL.books){
  for(const x of [u0+1.16,u1-1.16]){
   fixture('booksellers-table',x,.174,.74,[1.58,1.08,.58],true);
   for(let k=0;k<3;k++)shopNotice(k+3,M,x-.42+k*.37,1.126,-.59,.15,.20);
  }
 }else if(row===RETAIL.studio){
  for(const x of [u0+.94,u1-.97]){
   // Window prints hang clear of the glass and the open entrance. They are visible on the approach.
   plainBox(INTERIORS.materials.cream,x-.29,x+.29,1.16,1.98,-.389,-.361,{M});
   shopNotice(0,M,x,1.57,-.357,.54,.77);
   for(const offset of [-.20,.20]){
    const p=lpt(M,x+offset,.374);worksBeam(MAT.metal,[p.x,1.98,p.z],[p.x,2.68,p.z],.0045);
   }
  }
 }else if(row===RETAIL.laundry){
  shopNotice(1,M,center+.73,1.86,-.034,.31,.15);
  shopNotice(2,M,center+.73,1.62,-.034,.34,.27);
 }else if(row===RETAIL.cafe){
  fixture('espresso-machine',center+width*.13+.79,1.342,3.70,[.75,.58,.50],false);
 }else if(row===RETAIL.deli){
  fixture('florists-trug',u1-1.22,.17,-.54,[1.04,.78,.51],true);
 }
}

// The amount of sky seen from a room decreases with depth from its glazed front.
// Apply the loss to indirect light, leaving lamps and direct sun to light the furnishings.
const SHOP_ROOMS=[],ROOM_LIGHT_MATERIALS=new WeakMap();
function roomLightAt(room,p){
 const dx=p.x-room.x,dz=p.z-room.z,u=dx*room.n.z-dz*room.n.x,v=-(dx*room.n.x+dz*room.n.z);
 if(Math.abs(u)>room.w/2+.05||v<-.18||v>room.d+.05||p.y<room.y-.1||p.y>room.y+3.54)return 1;
 const depthLoss=clamp(v/(room.d*.90),0,1);
 return clamp(.83-.43*depthLoss-.12*(1-clamp((room.w/2-Math.abs(u))/.85,0,1)),.30,.84);
}
function shopLightingRoom(M,u0,u1,d,y=.17){
 const pt=lpt(M,(u0+u1)/2,0),room={x:pt.x,z:pt.z,w:u1-u0,d,y,n:new V3(M.elements[8],0,M.elements[10])};
 SHOP_ROOMS.push(room);return room;
}
function shopExposure(p){
 let light=1;
 for(const room of SHOP_ROOMS)light=Math.min(light,roomLightAt(room,p));
 return light;
}
function roomLightMaterial(mat,factor=null){
 let variants=ROOM_LIGHT_MATERIALS.get(mat);
 if(!variants){variants=new Map();ROOM_LIGHT_MATERIALS.set(mat,variants);}
 const key=factor===null?'varying':Math.round(factor*12);
 if(variants.has(key))return variants.get(key);
 const shaded=mat.clone(),multiply=factor===null?'vRoomIrradiance':(key/12).toFixed(4);
 const old=mat.onBeforeCompile;
 shaded.onBeforeCompile=sh=>{
  old.call(shaded,sh);
  if(factor===null){
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float roomIrradiance;varying float vRoomIrradiance;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvRoomIrradiance=roomIrradiance;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vRoomIrradiance;');
  }
  sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',
   '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*='+multiply+';reflectedLight.indirectSpecular*=mix(.32,1.,'+multiply+');');
 };
 shaded.customProgramCacheKey=()=>mat.customProgramCacheKey()+'-room-'+key;
 variants.set(key,shaded);return shaded;
}
function shadeRoomGeometry(room,geometry){
 const pos=geometry.attributes.position,p=new V3(),strength=new Float32Array(pos.count);
 for(let i=0;i<pos.count;i++){
  p.fromBufferAttribute(pos,i);p.y=clamp(p.y,room.y,room.y+3.50);
  strength[i]=roomLightAt(room,p);
 }
 geometry.setAttribute('roomIrradiance',new THREE.BufferAttribute(strength,1));
}
function shadeFixture(node,x,y,z){
 const factor=shopExposure({x,y,z});
 if(factor>.95)return;
 node.traverse(mesh=>{
  if(mesh.isMesh&&mesh.material?.isMeshStandardMaterial)mesh.material=roomLightMaterial(mesh.material,factor);
 });
}
