/* ================= knockable street furniture (instanced + streamed rigid bodies) ================= */
const PROPS={types:{},list:[],active:new Set(),glow:null};
function propGeo(parts){return mergeGeos(parts.map(([g,x,y,z,rx,ry,rz])=>{g=g.clone();if(rx)g.rotateX(rx);if(ry)g.rotateY(ry);if(rz)g.rotateZ(rz);g.translate(x||0,y||0,z||0);return g;}));}
function initProps(){const C=(r0,r1,h,s=10)=>new THREE.CylinderGeometry(r0,r1,h,s),B=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
 const red=new THREE.MeshStandardMaterial({color:lin(0xb82a1e),roughness:.45,metalness:.3}),green=new THREE.MeshStandardMaterial({color:lin(0x2c4a30),roughness:.55,metalness:.3}),blue=new THREE.MeshStandardMaterial({color:lin(0x24448a),roughness:.45,metalness:.3}),orange=new THREE.MeshStandardMaterial({color:lin(0xff5a10),roughness:.6}),yellowM=new THREE.MeshStandardMaterial({color:lin(0xd8a020),roughness:.5,metalness:.2});
 const T=PROPS.types;
 T.lamp={geo:propGeo([[C(.07,.12,7.2,8),0,3.6,0],[B(.09,.09,2),0,7.1,.95],[B(.42,.14,.75),0,7.0,1.85]]),mat:MAT.darkMetal,shape:()=>new CANNON.Box(new CV(.12,3.6,.12)),off:new CV(0,3.6,0),mass:220,glow:1};
 T.hydrant={geo:propGeo([[C(.17,.2,.62,10),0,.31,0],[C(.21,.21,.08,10),0,.64,0],[C(.12,.15,.16,10),0,.75,0],[C(.07,.07,.42,8),0,.42,0,0,0,Math.PI/2]]),mat:red,shape:()=>new CANNON.Cylinder(.2,.2,.8,8),off:new CV(0,.4,0),mass:90,spray:1};
 T.bin={geo:propGeo([[C(.3,.27,.95,12),0,.47,0],[C(.33,.33,.06,12),0,.97,0]]),mat:green,shape:()=>new CANNON.Cylinder(.31,.31,1,10),off:new CV(0,.5,0),mass:22};
 T.news={geo:propGeo([[B(.5,.95,.45),0,.6,0],[B(.46,.12,.04),0,.82,.24]]),mat:blue,shape:()=>new CANNON.Box(new CV(.25,.55,.23)),off:new CV(0,.55,0),mass:28};
 T.meter={geo:propGeo([[C(.04,.04,1.2,6),0,.6,0],[B(.2,.32,.16),0,1.32,0]]),mat:MAT.metal,shape:()=>new CANNON.Box(new CV(.1,.75,.1)),off:new CV(0,.75,0),mass:14};
 T.bench={geo:propGeo([[B(2,.07,.48),0,.47,0],[B(2,.42,.06),0,.78,-.22,-.2],[B(.07,.47,.46),-.9,.23,0],[B(.07,.47,.46),.9,.23,0]]),mat:MAT.wood,shape:()=>new CANNON.Box(new CV(1,.45,.27)),off:new CV(0,.45,0),mass:45};
 T.bollard={geo:propGeo([[C(.11,.13,.9,10),0,.45,0],[C(.12,.12,.06,10),0,.92,0]]),mat:MAT.darkMetal,shape:()=>new CANNON.Cylinder(.13,.13,.95,8),off:new CV(0,.47,0),mass:70};
 T.cone={geo:propGeo([[new THREE.ConeGeometry(.17,.68,12),0,.38,0],[B(.36,.04,.36),0,.02,0]]),mat:orange,shape:()=>new CANNON.Box(new CV(.16,.35,.16)),off:new CV(0,.35,0),mass:3};
 T.barrel={geo:propGeo([[C(.29,.29,.88,14),0,.44,0]]),mat:yellowM,shape:()=>new CANNON.Cylinder(.3,.3,.9,10),off:new CV(0,.45,0),mass:35};
 T.fence={geo:propGeo([
  [B(2.27,.085,.08),0,.34,0],[B(2.27,.085,.08),0,.76,0],
  ...[-1.1,-.64,-.2,.25,.68,1.1].map(x=>[B(.081,.96,.095),x,.49,0])
 ]),mat:MAT.whiteMetal,shape:()=>new CANNON.Box(new CV(1.18,.49,.055)),off:new CV(0,.49,0),mass:32};
 T.mailbox={geo:propGeo([[C(.04,.04,1,6),0,.5,0],[B(.24,.26,.46),0,1.1,0]]),mat:MAT.darkMetal,shape:()=>new CANNON.Box(new CV(.13,.65,.24)),off:new CV(0,.65,0),mass:12};
 T.lantern={geo:propGeo([[C(.14,.25,.40,12),0,.20,0],[C(.065,.12,3.80,10),0,2.22,0],
  [C(.23,.09,.28,10),0,4.21,0],[C(.10,.10,.28,10),0,4.48,0],
  ...[0,Math.PI*.5,Math.PI,Math.PI*1.5].map(a=>[B(.025,.28,.025),.19*Math.cos(a),4.48,.19*Math.sin(a)]),
  [new THREE.ConeGeometry(.27,.22,10),0,4.73,0]]),
  mat:MAT.darkMetal,shape:()=>new CANNON.Box(new CV(.14,2.42,.14)),off:new CV(0,2.42,0),mass:155,glow:1};
 T.postbox={geo:propGeo([[B(.58,.82,.53),0,.80,0],[B(.055,.44,.06),-.22,.22,.17],[B(.055,.44,.06),.22,.22,-.17]]),
  mat:blue,shape:()=>new CANNON.Box(new CV(.30,.65,.32)),off:new CV(0,.65,0),mass:60};
 const spots=[...PROPSPOTS];
 for(const L of LAMPS){
  // Keep one crook over Harbor Books. A corner and midblock candidate are only 5.6 metres apart here.
  if(Math.abs(L.x-274.4)<.05&&Math.abs(L.z-392.76)<.05)continue;
  const B=blockOf(L.x,L.z),historic=B&&(B.park||B.dist==='oldtown'||(B.i===3||B.i===4)&&B.j===5||B.i===4&&B.j===6);
  spots.push({type:historic?'lantern':'lamp',x:L.x,z:L.z,ry:L.ry});
 }
 const byType={};for(const s of spots){(byType[s.type]=byType[s.type]||[]).push(s);}
 const o=new THREE.Object3D();
 for(const [t,arr] of Object.entries(byType)){
  const P=T[t],sectors=new Map(),location=s=>Math.floor(s.x/192)+','+Math.floor(s.z/192);
  const surveyed=arr.map(s=>({...s,y:blockY(s.x,s.z)}));
  P.geo.computeBoundingSphere();
  const reach=P.geo.boundingSphere.center.length()+P.geo.boundingSphere.radius;
  for(const s of surveyed){
   const key=location(s);
   if(!sectors.has(key))sectors.set(key,{count:0,next:0,bounds:new THREE.Box3()});
   const group=sectors.get(key);group.count++;
   group.bounds.expandByPoint(new V3(s.x,s.y,s.z));
  }
  for(const group of sectors.values()){
   const sphere=group.bounds.expandByScalar(reach).getBoundingSphere(new THREE.Sphere());
   const mesh=new THREE.InstancedMesh(geometryWithBounds(P.geo,sphere),P.mat,group.count);
   mesh.castShadow=mesh.receiveShadow=mesh.frustumCulled=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   if(LOWSHADOW)mesh.layers.set(2);
   group.mesh=mesh;scene.add(mesh);
  }
  for(const s of surveyed){
   const group=sectors.get(location(s)),y=s.y,idx=group.next++;
   o.position.set(s.x,y,s.z);o.rotation.set(0,s.ry||0,0);o.updateMatrix();group.mesh.setMatrixAt(idx,o.matrix);
   PROPS.list.push({t,P,mesh:group.mesh,x:s.x,y,z:s.z,ry:s.ry||0,idx,
    riverside:t==='lantern'&&s.z>382&&s.z<449&&s.x>=255&&s.x<322,body:null,moved:false,broken:false,spray:0,
    renderPosition:o.position.clone(),renderQuaternion:o.quaternion.clone()});
  }
 }
 /* lamp glows */
 const lamps=PROPS.list.filter(p=>p.P.glow);const gp=new Float32Array(lamps.length*3),gc=new Float32Array(lamps.length*3);
 lamps.forEach((p,k)=>{p.gi=k;const at=lampEmitter(p);gp[k*3]=at.x;gp[k*3+1]=at.y;gp[k*3+2]=at.z;gc[k*3]=1;gc[k*3+1]=.72;gc[k*3+2]=.42;});
 const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(gp,3));gg.setAttribute('color',new THREE.BufferAttribute(gc,3));
 PROPS.glow=new THREE.Points(gg,new THREE.PointsMaterial({map:glowTex(),size:1.32,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.68}));PROPS.glow.visible=false;PROPS.glow.frustumCulled=false;scene.add(PROPS.glow);
 const head=new THREE.InstancedMesh(unitBox,new THREE.MeshBasicMaterial({color:new THREE.Color(3,2.3,1.5)}),lamps.length);
 head.visible=false;PROPS.heads=head;scene.add(head);
 for(const lamp of lamps)syncLampGlow(lamp);
}
let _glowT=null;function glowTex(){if(_glowT)return _glowT;const[c,g]=cvs(64,64);const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.2,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return _glowT=new THREE.CanvasTexture(c);}
function blockY(x,z){return groundY(x,z);}
const _po=new THREE.Object3D();let propT=0;
function registerLooseFixture(node,id,x,y,z,yaw,dims,mass){
 const [w,h,d]=dims,off=new CV(0,h/2,0);
 PROPS.list.push({t:id,P:{mass,off,shape:()=>new CANNON.Box(new CV(w/2,h/2,d/2))},
  node,x,y,z,ry:yaw,body:null,moved:false,spray:0,
  renderPosition:node.position.clone(),renderQuaternion:node.quaternion.clone()});
}

function streamProp(p){
 const at=p.renderPosition,q=p.renderQuaternion;
 const b=physDyn(p.P.shape(),p.P.mass,at.x,at.y,at.z);
 b.quaternion.set(q.x,q.y,q.z,q.w);
 b.quaternion.vmult(p.P.off, _propCenter);
 b.position.vadd(_propCenter,b.position);
 b.aabbNeedsUpdate=true;
 b.sleep();
 b.prop=p;
 p.body=b;
 PROPS.active.add(p);
 b.addEventListener('collide',e=>{
  const impact=e.contact.getImpactVelocityAlongNormal();
  if(impact<=1||!e.body.car)return;
  const first=!p.moved;
  p.moved=true;
  if(p.P.spray&&!p.spray)p.spray=9;
  if(first&&p.P.glow)syncLampGlow(p);
  onPropHit(p,impact,e.body.car);
 });
}

const _propCenter=new CV();
const _propUp=new CV(0,1,0);
const _propRight=new CV(1,0,0),_propAxis=new CV(),_propVertical=new CV();
function updProps(dt,px,pz){
 propT-=dt;
 if(propT<=0){
  propT=.32;
  for(const p of PROPS.list){
   const at=p.renderPosition,d2=(at.x-px)**2+(at.z-pz)**2;
   if(!p.body&&d2<62**2)streamProp(p);
   else if(p.body&&d2>83**2&&(!p.moved||p.body.sleepState===CANNON.Body.SLEEPING)){
    physRemove(p.body);
    p.body=null;
    PROPS.active.delete(p);
   }
  }
 }
 for(const p of PROPS.active){
  const b=p.body;
  const awake=b.sleepState!==CANNON.Body.SLEEPING;
  if(awake||p.wasAwake){
   _po.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
   _v.copy(p.P.off).applyQuaternion(_po.quaternion);
   p.renderPosition.set(b.position.x-_v.x,b.position.y-_v.y,b.position.z-_v.z);
   p.renderQuaternion.copy(_po.quaternion);
   if(!p.moved&&Math.hypot(p.renderPosition.x-p.x,p.renderPosition.z-p.z)>.11){
    p.moved=true;if(p.P.glow)syncLampGlow(p);
   }
   syncPropMesh(p);
  }
  p.wasAwake=awake;
  if(p.spray>0){
   p.spray-=dt;
   if(Math.random()<dt*30)emit(p.x+rnd(-.1,.1),.6,p.z+rnd(-.1,.1),rnd(-1.2,1.2),rnd(9,13),rnd(-1.2,1.2),1.1,.35,1.4,0xd8e8f2,false,9.8);
  }
 }
}

function collideProps(pos,r,y,motion){
 let result=null;
 for(const p of PROPS.active){
  const b=p.body;
  if(Math.abs(b.position.x-pos.x)>4.6||Math.abs(b.position.z-pos.z)>4.6)continue;
  if(b.aabbNeedsUpdate)b.updateAABB();
  const lo=b.aabb.lowerBound,hi=b.aabb.upperBound;
  if(lo.y>y+1.61||hi.y<y+.10||pos.x+r<lo.x||pos.x-r>hi.x||pos.z+r<lo.z||pos.z-r>hi.z)continue;
  const shape=b.shapes[0];
  b.quaternion.vmult(_propUp,_propVertical);
  let normal;
  if(_propVertical.y>.91&&shape.halfExtents){
   const {x:ex,z:ez}=shape.halfExtents;
   b.quaternion.vmult(_propRight,_propAxis);
   const len=Math.hypot(_propAxis.x,_propAxis.z)||1,dx=pos.x-b.position.x,dz=pos.z-b.position.z;
   const c=_propAxis.x/len,s=-_propAxis.z/len;
   const local={x:dx*c-dz*s,z:dx*s+dz*c};
   const n=pushOut(local,r,{x0:-ex,x1:ex,z0:-ez,z1:ez});
   if(n){
    pos.x=b.position.x+local.x*c+local.z*s;
    pos.z=b.position.z-local.x*s+local.z*c;
    normal=[n[0]*c+n[1]*s,-n[0]*s+n[1]*c];
   }
  }else{
   const radius=_propVertical.y>.91&&shape.radiusTop?Math.max(shape.radiusTop,shape.radiusBottom):undefined;
   normal=pushOut(pos,r,{x0:lo.x,x1:hi.x,z0:lo.z,z1:hi.z,radius});
  }
  if(!normal)continue;
  result=normal;
  if(motion&&b.mass<74){
   const speedInto=-(motion.dx*normal[0]+motion.dz*normal[1])/Math.max(.001,motion.dt);
   if(speedInto>.10){
    const force=Math.min(29,b.mass*speedInto*5)*motion.dt;
    b.wakeUp();
    b.applyImpulse(new CV(-normal[0]*force,0,-normal[1]*force),new CV(0,Math.min(.26,Math.max(.01,hi.y-b.position.y)),0));
   }
  }
 }
 return result;
}

function propInteraction(pos){
 let best=null,d=1.25;
 for(const p of PROPS.active){
  if(p.body.mass>=74)continue;
  const at=p.body.position,distance=Math.hypot(at.x-pos.x,at.z-pos.z);
  if(distance>=d||at.y<pos.y-.23||at.y>pos.y+1.72)continue;
  if(rayWorld(pos.x,pos.z,at.x,at.z,pos.y+.86,at.y,0,true,true)<.999)continue;
  d=distance;best=p;
 }
 if(!best)return null;
 const carton=best.t==='receiving-carton';
 return {label:carton?'MOVE CARTON':'NUDGE',hot:true,fn:()=>{
  PoliceDepartment.touch(player,best,best.body.position,carton?'Shipping carton':'Street fixture');
  const b=best.body,dx=b.position.x-pos.x,dz=b.position.z-pos.z;
  const scale=Math.min(b.mass*(carton?1.70:.69),24)/(Math.hypot(dx,dz)||1);
  b.wakeUp();b.applyImpulse(new CV(dx*scale,carton?b.mass*1.45:0,dz*scale),new CV(0,carton?.014:.22,0));
 }};
}
