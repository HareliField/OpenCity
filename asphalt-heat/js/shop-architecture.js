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
function rememberShopGlass(M,u0,u1,depth=.035,room=null){
 const center=lpt(M,(u0+u1)/2,depth),normal=new V3(M.elements[8],0,M.elements[10]).normalize();
 SHOP_ELEVATIONS.frontages.push({center,normal,half:(u1-u0)/2,room});
}

const SHOP_REFLECTION={
 cam:new THREE.PerspectiveCamera(),rt:null,last:-Infinity,front:null,
 eye:new V3(),orientation:new THREE.Quaternion(),direction:new V3(),relative:new V3(),clip:new V3(),
 uniforms:{shopMirror:{value:null},shopProject:{value:new THREE.Matrix4()},shopPlane:{value:new THREE.Vector4()},shopMirrorOn:{value:0}}
};
function shopGlazing(silvered=false,coating=null){
 const curtain=coating!==null,tint=coating??(silvered?0xd1d2cb:0xa2b3ba);
 const m=new THREE.MeshStandardMaterial({color:lin(tint),metalness:silvered?.95:curtain?.46:.69,roughness:silvered?.042:curtain?.14:.095,
  envMapIntensity:curtain?1.05:silvered?1.12:.86,transparent:!silvered,opacity:silvered?1:curtain?.47:.24,depthWrite:silvered,
  side:curtain?THREE.FrontSide:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,SHOP_REFLECTION.uniforms);
  sh.vertexShader=sh.vertexShader.replace('#include <common>',
   '#include <common>\nuniform mat4 shopProject;varying vec4 shopUV;varying vec3 shopWorld;')
   .replace('#include <fog_vertex>',
   `#include <fog_vertex>
   vec4 sw=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    sw=instanceMatrix*sw;
   #endif
   sw=modelMatrix*sw;shopWorld=sw.xyz;shopUV=shopProject*sw;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',
   '#include <common>\nuniform sampler2D shopMirror;uniform vec4 shopPlane;uniform float shopMirrorOn;varying vec4 shopUV;varying vec3 shopWorld;')
   .replace('#include <tonemapping_fragment>',`
   float fr=pow(1.-abs(dot(normalize(vViewPosition),normal)),4.);
   vec2 coord=shopUV.xy/max(.001,shopUV.w);
   float rim=1.-smoothstep(.47,.50,max(abs(coord.x-.5),abs(coord.y-.5)));
   float area=1.-smoothstep(.24,.37,abs(dot(shopPlane.xyz,shopWorld)+shopPlane.w));
   vec3 viewN=(viewMatrix*vec4(shopPlane.xyz,0.)).xyz;
   float mirror=shopMirrorOn*step(.96,abs(dot(viewN,normal)))*area*rim*step(0.,shopUV.w);
   if(mirror>.012)gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(shopMirror,coord).rgb*${curtain?'mix(vec3(1.),diffuseColor.rgb,.23)':'vec3(1.)'},.92*mirror);
   gl_FragColor.a=${silvered?'1.':curtain?'mix(.47+.35*fr,.42+.48*fr,mirror)':'mix(.079+.57*fr,.112+.69*fr,mirror)'};
   #include <tonemapping_fragment>`);
 };
 m.customProgramCacheKey=()=>silvered?'silvered-shop-mirror':curtain?'coated-curtain-glass':'shop-planar-glass';
 return m;
}
function updateShopReflection(t){
 const r=SHOP_REFLECTION,u=r.uniforms;
 if(QUALITY.level<2||camera.position.y<-.2){u.shopMirrorOn.value=0;return;}
 camera.getWorldDirection(r.direction);
 let best=null,bestDistance=44;
 const consider=f=>{
  if(f.room&&roomLightAt(f.room,camera.position)===1)return;
  const rel=r.relative.copy(camera.position).sub(f.center),ahead=rel.dot(f.normal);
  if(ahead<.18||ahead>bestDistance)return;
  const along=rel.x*f.normal.z-rel.z*f.normal.x,extra=Math.max(0,Math.abs(along)-f.half);
  const y=clamp(camera.position.y,f.y0??.35,f.h??3.45),d=Math.hypot(ahead,extra,camera.position.y-y);
  if(d>=bestDistance)return;
  rel.copy(f.center);rel.x+=clamp(along,-f.half,f.half)*f.normal.z;rel.z-=clamp(along,-f.half,f.half)*f.normal.x;
  rel.y=y;rel.sub(camera.position);
  if(rel.dot(r.direction)<-1)return;
  best=f;bestDistance=d;
 };
 if(camera.position.y<22)for(const f of SHOP_ELEVATIONS.frontages)consider(f);
 for(const block of CONSTRUCTION.near){
  for(const plane of block.curtainFaces||[])consider(plane);
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

function shopNotice(index,M,x,y,z,w,h,room){
 const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv,across=index%3,up=1-Math.floor(index/3);
 for(let i=0;i<uv.count;i++)uv.setXY(i,(across+.01+uv.getX(i)*.98)/3,(up+.01+uv.getY(i)*.98)/2);
 g.translate(x,y,z);g.applyMatrix4(M);addGeo(roomLightMaterial(SHOP_ELEVATIONS.prints,room),g,false);
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
 if(Math.abs(u)>room.w/2+.18||v<-.21||v>room.d+.16||p.y<room.y-.18||p.y>room.y+room.height+.18)return 1;
 const sky=.18+.58/(1+.23*Math.max(0,v)**1.52);
 return clamp(sky-.085*(1-clamp((room.w/2-Math.abs(u))/.85,0,1)),.12,.82);
}
function shopLightingRoom(M,u0,u1,d,y=.17,height=3.52){
 const pt=lpt(M,(u0+u1)/2,0),room={x:pt.x,z:pt.z,w:u1-u0,d,y,height,n:new V3(M.elements[8],0,M.elements[10]),lamps:[]};
 room.uniforms={
  shopOrigin:{value:new THREE.Vector4(room.x,y,room.z,height)},shopExtent:{value:new THREE.Vector4(room.n.x,room.n.z,room.w,d)},
  shopField:{value:null},shopGrid:{value:new V3(1,1,1)},shopPower:{value:1},
  shopActorLamps:{value:INTERIORS.lights.map(light=>light.position)}
 };
 SHOP_ROOMS.push(room);return room;
}
function shopAt(p){return SHOP_ROOMS.find(room=>roomLightAt(room,p)<1);}
function roomLightMaterial(mat,room){
 if(!room)return mat;
 let variants=ROOM_LIGHT_MATERIALS.get(mat);
 if(!variants){variants=new Map();ROOM_LIGHT_MATERIALS.set(mat,variants);}
 if(variants.has(room))return variants.get(room);
 const shaded=mat.clone(),old=mat.onBeforeCompile,constant=typeof room==='number';
 shaded.onBeforeCompile=sh=>{
  old.call(shaded,sh);
  if(constant){
   sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',
    '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*='+room.toFixed(4)+';reflectedLight.indirectSpecular*='+(.32+.68*room).toFixed(4)+';');
   return;
  }
  Object.assign(sh.uniforms,room.uniforms);
  if(mat.isMeshBasicMaterial){
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float shopPower;')
    .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.034,1.,shopPower);');
   return;
  }
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShopWorld;')
   .replace('#include <project_vertex>',`#include <project_vertex>
    vec4 shopVertex=vec4(transformed,1.);
    #ifdef USE_INSTANCING
     shopVertex=instanceMatrix*shopVertex;
    #endif
    vShopWorld=(modelMatrix*shopVertex).xyz;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vShopWorld;
   uniform vec4 shopOrigin,shopExtent;
   uniform vec3 shopGrid,shopActorLamps[3];
   uniform float shopPower;
   uniform sampler2D shopField;
   vec4 shopSample(vec3 cell,float face){
    vec2 lower=vec2(cell.x+face*shopGrid.x,cell.z+floor(cell.y)*shopGrid.z);
    vec2 texSize=vec2(6.*shopGrid.x,shopGrid.y*shopGrid.z);
    vec4 a=texture2D(shopField,lower/texSize),b=texture2D(shopField,(lower+vec2(0.,shopGrid.z))/texSize);
    return vec4(4.,4.,4.,1.)*mix(a,b,fract(cell.y));
   }`)
   .replace('#include <lights_fragment_begin>',`
    vec3 rel=vShopWorld-shopOrigin.xyz;
    vec2 along=vec2(shopExtent.y,-shopExtent.x);
    vec3 roomPoint=vec3(dot(rel.xz,along),rel.y,-dot(rel.xz,shopExtent.xy));
    float inShop=step(abs(roomPoint.x),shopExtent.z*.5+.19)*step(-.21,roomPoint.y)*step(roomPoint.y,shopOrigin.w+.18)*step(-.21,roomPoint.z)*step(roomPoint.z,shopExtent.w+.18);
    `+THREE.ShaderChunk.lights_fragment_begin.replace('getPointDirectLightIrradiance( pointLight, geometry, directLight );',`
     getPointDirectLightIrradiance( pointLight, geometry, directLight );
     {vec3 lampWorld=cameraPosition+(vec4(pointLight.position,0.)*viewMatrix).xyz;
     float actorLamp=min(distance(lampWorld,shopActorLamps[0]),min(distance(lampWorld,shopActorLamps[1]),distance(lampWorld,shopActorLamps[2])));
     directLight.color*=1.-inShop*(1.-step(.03,actorLamp));}`))
   .replace('#include <aomap_fragment>',`
    vec3 fieldUV=clamp(vec3(roomPoint.x/shopExtent.z+.5,roomPoint.y/shopOrigin.w,roomPoint.z/shopExtent.w),0.,1.);
    vec3 cell=fieldUV*(shopGrid-1.)+vec3(.5,0.,.5);
    cell.y=min(cell.y,shopGrid.y-1.001);
    vec3 n=inverseTransformDirection(normal,viewMatrix);
    vec4 vertical=shopSample(cell,2.+step(0.,n.y));
    vec3 e=shopSample(cell,step(0.,n.x)).rgb*n.x*n.x+vertical.rgb*n.y*n.y+shopSample(cell,4.+step(0.,n.z)).rgb*n.z*n.z;
    float aperture=.18+.58/(1.+.23*pow(max(roomPoint.z,0.),1.52));
    float edge=smoothstep(0.,.82,shopExtent.z*.5-abs(roomPoint.x));
    float ambient=mix(1.,aperture*(.86+.14*edge)*vertical.a,inShop);
    reflectedLight.indirectDiffuse=reflectedLight.indirectDiffuse*ambient+material.diffuseColor*e*(shopPower*inShop);
    reflectedLight.indirectSpecular*=mix(.33,1.,ambient);
    #include <aomap_fragment>`);
 };
 shaded.customProgramCacheKey=()=>mat.customProgramCacheKey()+(constant?'-room-level-'+room:'-shop-luminaires');
 variants.set(room,shaded);return shaded;
}
function shadeFixture(node,x,y,z){
 const room=shopAt({x,y,z});
 if(!room)return;
 node.traverse(mesh=>{
  if(mesh.isMesh&&mesh.material?.isMeshStandardMaterial)mesh.material=roomLightMaterial(mesh.material,room);
 });
}

// Ground-floor units share a texture of surveyed bounds, lamp positions and glazed sides.
// A room index on the vertices lets many different units stay in one ordinary street draw call.
const GROUND_LIGHTS={rows:[],materials:new WeakMap(),uniforms:{
 groundSurvey:{value:null},surveyRows:{value:1},districtFeed:{value:new THREE.Vector4(1,1,1,1)}
}};
function registerGroundLight(r,base,ceiling,sides,p){
 if(!renderer.capabilities.floatVertexTextures)return null;
 const front=(side,span)=>sides.includes(side)?(span>=5.4?1:.22):0;
 const width=r.x1-r.x0,depth=r.z1-r.z0,index=GROUND_LIGHTS.rows.length;
 GROUND_LIGHTS.rows.push([r.x0,r.x1,r.z0,r.z1,p.x,ceiling-.25,p.z,base,
  front('W',depth),front('E',depth),front('N',width),front('S',width)]);
 return index;
}
function finishGroundLights(){
 const rows=GROUND_LIGHTS.rows;if(!rows.length)return;
 const texture=new THREE.DataTexture(new Float32Array(rows.flat()),3,rows.length,THREE.RGBAFormat,THREE.FloatType);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
 GROUND_LIGHTS.uniforms.groundSurvey.value=texture;GROUND_LIGHTS.uniforms.surveyRows.value=rows.length;
 GROUND_LIGHTS.uniforms.retailActorLamps={value:INTERIORS.lights.map(l=>l.position)};
}
function markGroundLight(geometry,index){
 if(index!=null)geometry.setAttribute('retailRoom',new THREE.Float32BufferAttribute(
  new Float32Array(geometry.attributes.position.count).fill(index),1));
 return geometry;
}
function groundLightMaterial(source,index){
 if(index==null)return source;
 const known=GROUND_LIGHTS.materials.get(source);if(known)return known;
 const mat=source.clone(),compile=source.onBeforeCompile;
 mat.onBeforeCompile=sh=>{
  compile.call(mat,sh);Object.assign(sh.uniforms,GROUND_LIGHTS.uniforms);
  const vary='varying vec4 unitRect,unitLamp,unitFront;varying vec3 unitPoint;';
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+vary+
   'uniform sampler2D groundSurvey;uniform float surveyRows;attribute float retailRoom;')
   .replace('#include <project_vertex>',`#include <project_vertex>
    float row=(retailRoom+.5)/surveyRows;
    unitRect=texture2D(groundSurvey,vec2(1./6.,row));unitLamp=texture2D(groundSurvey,vec2(.5,row));
    unitFront=texture2D(groundSurvey,vec2(5./6.,row));unitPoint=(modelMatrix*vec4(transformed,1.)).xyz;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+vary+
   `uniform vec4 districtFeed;uniform vec3 retailActorLamps[3];
    float retailPower(){vec2 eastSouth=step(vec2(${W/2}.),unitLamp.xz);
     return mix(mix(districtFeed.x,districtFeed.y,eastSouth.x),mix(districtFeed.z,districtFeed.w,eastSouth.x),eastSouth.y);}`);
  if(mat.isMeshBasicMaterial){
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.032,1.,retailPower());');
   return;
  }
  const lit=THREE.ShaderChunk.lights_fragment_begin.replace(
   'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',`
    getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
    if(insideUnit>.5){
     vec3 ray=inverseTransformDirection(directLight.direction,viewMatrix);
     vec2 sideT=mix(edgeDist.xz,edgeDist.yw,step(vec2(0.),ray.xz))/max(abs(ray.xz),vec2(.00001));
     float xFirst=step(sideT.x,sideT.y),dist=min(sideT.x,sideT.y);
     float open=mix(mix(unitFront.z,unitFront.w,step(0.,ray.z)),mix(unitFront.x,unitFront.y,step(0.,ray.x)),xFirst);
     vec3 hit=unitPoint+ray*dist;
     float gap=abs(mix(hit.x-(unitRect.x+unitRect.y)*.5,hit.z-(unitRect.z+unitRect.w)*.5,xFirst));
     float door=1.-smoothstep(.54,.65,gap);
     float head=mix(unitLamp.y-.29,unitLamp.w+2.16,door),sill=mix(unitLamp.w+.36,unitLamp.w,door);
     float aperture=smoothstep(sill-.045,sill+.045,hit.y)*(1.-smoothstep(head-.045,head+.045,hit.y));
     directLight.color*=open*aperture;
    }`).replace('getPointDirectLightIrradiance( pointLight, geometry, directLight );',`
     getPointDirectLightIrradiance( pointLight, geometry, directLight );
     {vec3 lampAt=cameraPosition+(vec4(pointLight.position,0.)*viewMatrix).xyz;
     float actorDistance=min(distance(lampAt,retailActorLamps[0]),min(distance(lampAt,retailActorLamps[1]),distance(lampAt,retailActorLamps[2])));
     directLight.color*=1.-insideUnit*(1.-step(.03,actorDistance));}`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <lights_fragment_begin>',`
    vec4 edgeDist=vec4(unitPoint.x-unitRect.x,unitRect.y-unitPoint.x,unitPoint.z-unitRect.z,unitRect.w-unitPoint.z);
    float insideUnit=step(.002,min(min(edgeDist.x,edgeDist.y),min(edgeDist.z,edgeDist.w)))*
                     step(unitLamp.w-.012,unitPoint.y)*step(unitPoint.y,unitLamp.y+.20);
    `+lit);
  sh.fragmentShader=sh.fragmentShader.replace('#include <aomap_fragment>',`
    vec4 daylight=unitFront/(1.+.28*pow(max(vec4(0.),edgeDist),vec4(1.58)));
    float sky=.13+.67*max(max(daylight.x,daylight.y),max(daylight.z,daylight.w));
    vec3 toLamp=unitLamp.xyz-unitPoint;
    float d2=dot(toLamp,toLamp),surface=max(0.,dot(inverseTransformDirection(normal,viewMatrix),normalize(toLamp+vec3(.0001))));
    float lux=(.17+.83*surface)*smoothstep(-.14,.48,toLamp.y)*2.58/(1.+d2*.48);
    reflectedLight.indirectDiffuse*=mix(1.,sky,insideUnit);reflectedLight.indirectSpecular*=mix(1.,.29+.71*sky,insideUnit);
    reflectedLight.indirectDiffuse+=material.diffuseColor*vec3(1.,.846,.65)*lux*retailPower()*insideUnit;
    #include <aomap_fragment>`);
 };
 mat.customProgramCacheKey=()=>source.customProgramCacheKey()+'-ordinary-retail';
 GROUND_LIGHTS.materials.set(source,mat);return mat;
}

// Bake the six faces of a diffuse irradiance volume in linear light. It is sampled in
// world metres, so a moved chair or a turning cabinet door sees the same pool as the floor.
function prepareShopFields(){
 finishGroundLights();
 const furniture=[...INTERIORS.fixtures,...OUTDOOR_MODELS].filter(f=>
  /bookcase|booksellers-table|pantry-shelf|hardware-stock-rack|washer|laundry-machine|counter|cooler|patisserie-case|record-browser|wardrobe|barber-chair|diner-booth|manicure-desk|nail-workstation/.test(f.id));
 for(const room of SHOP_ROOMS){
  const inside=p=>roomLightAt(room,p)<1;
  const lamps=INTERIORS.emitters.filter(inside).map(lamp=>{
   const color=lin(lamp.colour??(lamp.cool?0xf4f1df:0xffce95));
   return {...lamp,color,intensity:lamp.intensity??(lamp.cool?1.15:1.35)};
  });
  room.municipal=lamps.some(l=>l.municipal);room.lamps=lamps;
  const boxes=[];
  for(const f of furniture){
   const y=f.node?.position.y??f.y??room.y;
   if(!inside({x:f.x,y,z:f.z}))continue;
   const angle=f.node?.rotation.y??f.heading??0,cs=Math.abs(Math.cos(angle)),sn=Math.abs(Math.sin(angle));
   const hx=(cs*f.dims[0]+sn*f.dims[2])*.47,hz=(sn*f.dims[0]+cs*f.dims[2])*.47;
   boxes.push([f.x-hx,y+.04,f.z-hz,f.x+hx,y+f.dims[1]*.96,f.z+hz]);
  }
  const nx=Math.min(88,Math.max(5,Math.ceil(room.w/.40)+1)),nz=Math.min(74,Math.max(6,Math.ceil(room.d/.40)+1)),ny=9;
  const data=new Uint8Array(nx*6*ny*nz*4),energy=new Float32Array(18);
  for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
   const u=(ix/(nx-1)-.5)*room.w,v=iz/(nz-1)*room.d;
   const x=room.x+u*room.n.z-v*room.n.x,y=room.y+iy/(ny-1)*room.height,z=room.z-u*room.n.x-v*room.n.z;
   energy.fill(0);
   for(const lamp of lamps){
    const dx=lamp.x-x,dy=lamp.y-y,dz=lamp.z-z,dist2=dx*dx+dy*dy+dz*dz;
    const reach=lamp.reach??(lamp.cool?8.1:7.4);
    if(dist2>=reach*reach)continue;
    const inv=1/Math.sqrt(Math.max(.035,dist2));
    let visibility=1;
    for(const box of boxes){
     const ax=(box[0]-x)/(dx||.00001),bx=(box[3]-x)/(dx||.00001);
     const ay=(box[1]-y)/(dy||.00001),by=(box[4]-y)/(dy||.00001);
     const az=(box[2]-z)/(dz||.00001),bz=(box[5]-z)/(dz||.00001);
     const entry=Math.max(Math.min(ax,bx),Math.min(ay,by),Math.min(az,bz));
     if(entry>.012&&entry<.97&&entry<Math.min(Math.max(ax,bx),Math.max(ay,by),Math.max(az,bz))){visibility=.18;break;}
    }
    const cutoff=(1-dist2/(reach*reach))**2;
    const strength=lamp.intensity*cutoff/(.56+.22*dist2);
    const beam=lamp.cool?.64+.36*clamp(dy*inv,0,1):.25+.75*clamp((dy*inv+.16)/.78,0,1);
    const dirs=[-dx,dx,-dy,dy,-dz,dz];
    for(let face=0;face<6;face++){
     const light=strength*(.12+.88*visibility*beam*Math.max(0,dirs[face]*inv));
     energy[3*face]+=lamp.color.r*light;energy[3*face+1]+=lamp.color.g*light;energy[3*face+2]+=lamp.color.b*light;
    }
   }
   const wallEdge=Math.min(room.w*.5-Math.abs(u),room.d-v);
   let contact=1-.24*Math.exp(-Math.max(0,wallEdge)*4.7)*Math.exp(-(y-room.y)*2.3);
   if(y<room.y+.85)for(const box of boxes){
    const sx=Math.max(box[0]-x,x-box[3],0),sz=Math.max(box[2]-z,z-box[5],0);
    contact=Math.min(contact,1-.43*Math.exp(-4.9*Math.hypot(sx,sz)-3.4*Math.abs(y-box[1])));
   }
   for(let face=0;face<6;face++){
    const offset=4*((iy*nz+iz)*nx*6+face*nx+ix);
    for(let c=0;c<3;c++)data[offset+c]=Math.round(Math.min(4,energy[face*3+c])*63.75);
    data[offset+3]=Math.round(255*contact);
   }
  }
  const field=new THREE.DataTexture(data,nx*6,nz*ny,THREE.RGBAFormat);
  field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
  room.uniforms.shopField.value=field;room.uniforms.shopGrid.value.set(nx,ny,nz);
 }
}
