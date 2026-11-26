/* ================= game systems ================= */
const MINX=-HALF+.6,MINZ=-HALF+.6,MAXZ=W+HALF-.6;
const STREETS_PHYS={region:-1,bodies:new Map()};
/* ---- world queries ---- */
function blockOf(x,z){
 const B=blocks[parcelKey(x,z)];
 return B&&x>B.x0&&x<B.x1&&z>B.z0&&z<B.z1?B:null;
}
function groundY(x,z,referenceY=null){
 let y=blockOf(x,z)?.15:isSand(x,z)?.02:0;
 if(y===0&&CITY_INFILL.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1))y=.15;
 for(const r of STREET.steps)if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)y=Math.max(y,r.y);
 if(referenceY!==null){
  const grade=sampleGrade(x,z,referenceY);
  if(grade)y=Math.max(y,grade.height);
 }
 return y;
}
function pushOut(p,r,R){
 if(R.radius){
  const x=(R.x0+R.x1)*.5,z=(R.z0+R.z1)*.5,dx=p.x-x,dz=p.z-z;
  const edge=R.radius+r,d=Math.hypot(dx,dz);
  if(d>=edge)return null;
  const nx=d>.0001?dx/d:1,nz=d>.0001?dz/d:0;
  p.x=x+nx*edge;p.z=z+nz*edge;
  return [nx,nz];
 }
 const cx=clamp(p.x,R.x0,R.x1),cz=clamp(p.z,R.z0,R.z1);let dx=p.x-cx,dz=p.z-cz;const d2=dx*dx+dz*dz;if(d2>=r*r)return null;
 if(d2<1e-8){const l=p.x-R.x0,rr=R.x1-p.x,t=p.z-R.z0,b=R.z1-p.z,m=Math.min(l,rr,t,b);if(m===l){p.x=R.x0-r;return[-1,0];}if(m===rr){p.x=R.x1+r;return[1,0];}if(m===t){p.z=R.z0-r;return[0,-1];}p.z=R.z1+r;return[0,1];}
 const d=Math.sqrt(d2);dx/=d;dz/=d;p.x=cx+dx*r;p.z=cz+dz*r;return[dx,dz];}
function indexStatic(){
 for(const B of blocks)B.residual=[];
 for(const B of blocks){
  for(const R of B.bld){
   if(R.x0<CITY_X[B.i]||R.x1>CITY_X[B.i+1]||R.z0<CITY_Z[B.j]||R.z1>CITY_Z[B.j+1])STATIC.push(R);
  }
 }
 for(const R of STATIC){
  const imin=Math.floor(parcelKey(R.x0,R.z0)/N),jmin=parcelKey(R.x0,R.z0)%N;
  const imax=Math.floor(parcelKey(R.x1,R.z1)/N),jmax=parcelKey(R.x1,R.z1)%N;
  for(let a=imin;a<=imax;a++)for(let b=jmin;b<=jmax;b++)blocks[a*N+b].residual.push(R);
 }
}
function collideWorld(p,r,motion=null){
 const key=parcelKey(p.x,p.z),i=Math.floor(key/N),j=key%N;
 const y=groundY(p.x,p.z,p.y??null);let hit=null;
 for(let a=Math.max(0,i-1);a<=Math.min(N-1,i+1);a++){
  for(let b=Math.max(0,j-1);b<=Math.min(N-1,j+1);b++){
   const block=blocks[a*N+b];
   for(const list of [block.bld,block.residual]){
    for(const R of list){
     if(R.walkIgnore||(R.y0||0)>y+1.67||(R.h||12)<y+.15)continue;
     const n=pushOut(p,r,R);if(n)hit=n;
    }
   }
  }
 }
 const grade=collideGradeRails(p,r,y);
 if(grade)hit=grade;
 const door=collideDoors(p,r);
 if(door)hit=door;
 const prop=collideProps(p,r,y,motion);
 if(prop)hit=prop;
 const maxX=coastLimit(p.z);
 if(p.x<MINX+r){p.x=MINX+r;hit=[1,0];}
 if(p.x>maxX-r){p.x=maxX-r;hit=[-1,0];}
 if(p.z<MINZ+r){p.z=MINZ+r;hit=[0,1];}
 if(p.z>MAXZ-r){p.z=MAXZ-r;hit=[0,-1];}
 return hit;
}
function segRect(ax,az,dx,dz,R){let t0=0,t1=1;
 if(Math.abs(dx)<1e-9){if(ax<R.x0||ax>R.x1)return-1;}else{let u=(R.x0-ax)/dx,v=(R.x1-ax)/dx;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return-1;}
 if(Math.abs(dz)<1e-9){if(az<R.z0||az>R.z1)return-1;}else{let u=(R.z0-az)/dz,v=(R.z1-az)/dz;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return-1;}return t0;}
function rayWorld(ax,az,bx,bz){
 let best=1;
 const dx=bx-ax,dz=bz-az,first=parcelKey(Math.min(ax,bx),Math.min(az,bz)),last=parcelKey(Math.max(ax,bx),Math.max(az,bz));
 const eye=Math.min(groundY(ax,az),groundY(bx,bz))+1.48;
 for(let a=Math.floor(first/N);a<=Math.floor(last/N);a++){
  for(let b=first%N;b<=last%N;b++){
   const block=blocks[a*N+b];
   for(const list of [block.bld,block.residual])for(const R of list){
    if((R.y0||0)>eye||(R.h||12)<eye)continue;
    const t=segRect(ax,az,dx,dz,R);
    if(t>=0&&t<best)best=t;
   }
  }
 }
 return traceClosedDoors(ax,az,bx,bz,best);
}
const los=(a,b)=>rayWorld(a.x,a.z,b.x,b.z)>=1;
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function physWorld(){
 for(const r of STREET.steps)if(r.y>.005)physBox(r.x0,r.x1,.005,r.y,r.z0,r.z1);
 for(const end of [PIER_Z-4,QUAY_Z]){
  const start=end===QUAY_Z?PIER_Z+4:-HALF;
  for(let z=start;z<end;z+=8){
   const n=Math.min(end,z+8),x=Math.min(shoreline(z),shoreline(n))-3;
   physBox(W+14,x+.4,-.12,.017,z,n,PH.mat.sand);
   physBox(x,x+2,-1,2,z,n+.04);
  }
 }
 physBox(W+14,shoreline(PIER_Z),-.12,.017,PIER_Z-4,PIER_Z+4,PH.mat.sand);
 physBox(W+80,W+82,-1,2,QUAY_Z,W+HALF);
 physBox(-HALF-1,W+80,0,2,-HALF-1.2,-HALF-.2);
 physBox(-HALF-1,W+80,0,2,W+HALF+.2,W+HALF+1.2);
 physBox(-HALF-1.2,-HALF-.2,0,2,-HALF,W+HALF);
 for(const r of CITY_INFILL)physBox(r.x0,r.x1,0,r.h,r.z0,r.z1);
 for(const B of blocks)B.curb={x0:B.x0,x1:B.x1,z0:B.z0,z1:B.z1,h:.15};
}

function refreshPhysicalWorld(x,z){
 syncDoorRegion(x,z);
 const key=parcelKey(x,z);
 if(STREETS_PHYS.region===key)return;
 STREETS_PHYS.region=key;
 const i=Math.floor(key/N),j=key%N,required=new Set();
 for(let a=Math.max(0,i-2);a<=Math.min(N-1,i+2);a++){
  for(let b=Math.max(0,j-2);b<=Math.min(N-1,j+2);b++){
   const block=blocks[a*N+b];
   required.add(block.curb);
   for(const r of block.bld)required.add(r);
   for(const r of block.residual)required.add(r);
  }
 }
 for(const [r,body] of STREETS_PHYS.bodies){
  if(required.has(r))continue;
  physRemove(body);
  STREETS_PHYS.bodies.delete(r);
 }
 for(const r of required){
  if(STREETS_PHYS.bodies.has(r))continue;
  const top=Math.min(r.h||12,157),base=r.y0||0;
  if(top<=base||r.x1<=r.x0||r.z1<=r.z0)continue;
  let body;
  if(r.obb){
   const {p,q,w,h,d}=r.obb;
   body=new CANNON.Body({mass:0,material:PH.mat.concrete,collisionFilterGroup:PHYS_GROUP.world});
   body.addShape(new CANNON.Box(new CV(w/2,h/2,d/2)));
   body.position.set(p.x,p.y,p.z);
   body.quaternion.set(q.x,q.y,q.z,q.w);
   PH.w.addBody(body);
  }else if(r.radius){
   body=new CANNON.Body({mass:0,material:PH.mat.concrete,collisionFilterGroup:PHYS_GROUP.world});
   body.addShape(new CANNON.Cylinder(r.radius,r.radius,top-base,12));
   body.position.set((r.x0+r.x1)/2,(base+top)/2,(r.z0+r.z1)/2);
   PH.w.addBody(body);
  }else body=physBox(r.x0,r.x1,base,top,r.z0,r.z1);
  STREETS_PHYS.bodies.set(r,body);
 }
}
/* ---- particles / tracers ---- */
const parts=[];let pi=0;
function initParts(){for(let i=0;i<220;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),transparent:true,depthWrite:false}));sp.visible=false;scene.add(sp);parts.push({sp,life:0,age:0,v:new V3(),s0:1,s1:1,g:0,add:false});}}
function emit(x,y,z,vx,vy,vz,life,s0,s1,color,add,grav=0){const p=parts[pi=(pi+1)%parts.length];p.sp.visible=true;p.sp.position.set(x,y,z);p.v.set(vx,vy,vz);p.life=life;p.age=0;p.s0=s0;p.s1=s1;p.g=grav;p.add=add;p.sp.material.color.setHex(color);if(add)p.sp.material.color.multiplyScalar(2.5);p.sp.material.blending=add?THREE.AdditiveBlending:THREE.NormalBlending;}
function updParts(dt){for(const p of parts){if(!p.sp.visible)continue;p.age+=dt;if(p.age>=p.life){p.sp.visible=false;continue;}const k=p.age/p.life;p.v.y-=p.g*dt;p.sp.position.addScaledVector(p.v,dt);if(p.sp.position.y<.05&&p.g>0){p.sp.position.y=.05;p.v.multiplyScalar(.3);}p.sp.scale.setScalar(p.s0+(p.s1-p.s0)*k);p.sp.material.opacity=(1-k)*(p.add?1:.55);}}
const tracers=[];let ti=0;
function initTracers(){for(let i=0;i<24;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:new THREE.Color(3,2.4,1.2),transparent:true}));l.visible=false;l.frustumCulled=false;scene.add(l);tracers.push({l,t:0});}}
function tracer(a,b){const T=tracers[ti=(ti+1)%tracers.length];const p=T.l.geometry.attributes.position;p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true;T.l.visible=true;T.t=.05;}
/* skid marks */
const SKID={mesh:null,n:0,max:600};
function initSkids(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SKID.max*12),3));const idx=[];for(let i=0;i<SKID.max;i++){const b=i*4;idx.push(b,b+2,b+1,b+1,b+2,b+3);}g.setIndex(idx);
 SKID.mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x050505,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));SKID.mesh.frustumCulled=false;scene.add(SKID.mesh);}
function skid(c,i,pos){const L=c.skidLast||(c.skidLast=[null,null,null,null]);const last=L[i];const y=pos.y+.018;if(last&&Math.hypot(pos.x-last.x,pos.z-last.z)<3){const dx=pos.x-last.x,dz=pos.z-last.z,l=Math.hypot(dx,dz)||1,nx=-dz/l*.11,nz=dx/l*.11;const P=SKID.mesh.geometry.attributes.position,k=(SKID.n++%SKID.max)*4;
 P.setXYZ(k,last.x+nx,y,last.z+nz);P.setXYZ(k+1,last.x-nx,y,last.z-nz);P.setXYZ(k+2,pos.x+nx,y,pos.z+nz);P.setXYZ(k+3,pos.x-nx,y,pos.z-nz);P.needsUpdate=true;}L[i]={x:pos.x,z:pos.z};}
/* ---- audio ---- */
let ac=null,master,nbuf,engO,engO2,engG,engF,sirO,sirG,heliG,scrG,scrF;
function initAudio(){try{ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.55;master.connect(ac.destination);
 nbuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 engO=ac.createOscillator();engO.type='sawtooth';engO2=ac.createOscillator();engO2.type='square';engF=ac.createBiquadFilter();engF.type='lowpass';engF.frequency.value=420;engG=ac.createGain();engG.gain.value=0;const g2=ac.createGain();g2.gain.value=.35;engO.connect(engF);engO2.connect(g2).connect(engF);engF.connect(engG).connect(master);engO.start();engO2.start();
 sirO=ac.createOscillator();sirO.type='triangle';sirG=ac.createGain();sirG.gain.value=0;sirO.connect(sirG).connect(master);sirO.start();
 const hs=ac.createBufferSource();hs.buffer=nbuf;hs.loop=true;const bp=ac.createBiquadFilter();bp.type='lowpass';bp.frequency.value=180;const amp=ac.createGain();amp.gain.value=.5;const lfo=ac.createOscillator();lfo.frequency.value=13;const ld=ac.createGain();ld.gain.value=.5;lfo.connect(ld).connect(amp.gain);heliG=ac.createGain();heliG.gain.value=0;hs.connect(bp).connect(amp).connect(heliG).connect(master);hs.start();lfo.start();
 const ss=ac.createBufferSource();ss.buffer=nbuf;ss.loop=true;scrF=ac.createBiquadFilter();scrF.type='bandpass';scrF.frequency.value=1800;scrF.Q.value=6;scrG=ac.createGain();scrG.gain.value=0;ss.connect(scrF).connect(scrG).connect(master);ss.start();}catch(e){ac=null;}}
function noise(dur,freq,vol){if(!ac||vol<.01)return;const s=ac.createBufferSource();s.buffer=nbuf;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;const g=ac.createGain();const t=ac.currentTime;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f).connect(g).connect(master);s.start(t,Math.random()*.5);s.stop(t+dur);}
function beep(f,dur,vol,type='square'){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;const t=ac.currentTime;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(master);o.start(t);o.stop(t+dur);}
let player;const distVol=(x,z,v)=>v*clamp(1-Math.hypot(x-player.pos.x,z-player.pos.z)/110,0,1);
/* ---- roster ---- */
let CAST={},ROLE={};
function pickChar(role){const l=ROLE[role]||ROLE.m;return pick(l);}
function pedRoleFor(B){const d=B?B.dist:'midtown';const r=Math.random();if(d==='beach'&&r<.45&&ROLE.beach)return'beach';if(d==='downtown'&&r<.35)return pick(['m','f'])==='m'?'mb':'fb';if(d==='docks'&&r<.3&&ROLE.work)return'work';if(B&&B.i===5&&B.j<=2&&r<.25&&ROLE.medic)return'medic';return r<.52?'m':'f';}
/* ---- game state ---- */
const peds=[],cops=[],gang=[],guards=[],pickups=[],helis=[],cars=[];let clerk=null;
let heat=0,wanted=0,evadeT=0,state='loading',deadT=0,deadKind='',shake=0,camYaw=0,lookYaw=0,lookPitch=0,time=0,robbing=null,lastShot=-99,shopOpen=false,roadblockT=20,heliT=0,hurtT=0;
const TH=[0,10,40,100,200,1050];
const LV={acc:[0,0,.2,.3,.4,.5],dmg:[0,5,6,8,10,13],evade:[0,12,24,25,40,60],sees:[0,17,29,50,60,70],
 desc:['','LOCAL CHECK|A patrol is checking the report','MISDEMEANOR SEARCH|Patrols are canvassing the area','SHOOT ON SIGHT|Roadblocks · cops fire from cars','SWAT + HELICOPTER|Armored vans · searchlight tracking','MILITARY|Army units · two helicopters']};
const WEAP={fist:{n:'FISTS',rate:.42},pistol:{n:'PISTOL',rate:.27,dmg:34,acc:.85,range:45},smg:{n:'SMG',rate:.085,dmg:17,acc:.7,range:40},shotgun:{n:'SHOTGUN',rate:.9,dmg:30,acc:.9,range:18,pel:6}};
/* ---- HUD helpers ---- */
const toastEl=$('toast');let toastT=0,bannerT=0;
function toast(msg,ms=2000){toastEl.textContent=msg;toastEl.classList.add('on');toastT=ms/1000;}
function banner(L){const[a,b]=LV.desc[L].split('|');const el=$('banner');el.innerHTML='';const bb=document.createElement('b');bb.textContent='★'.repeat(L)+' '+a;el.append(bb,document.createTextNode(b));el.classList.add('on');bannerT=3;}
function hurtFlash(){hurtT=.35;}
function levelOf(h){let L=0;for(let k=1;k<=5;k++)if(h>=TH[k])L=k;return L;}
function crime(amt,x,z,reported=false){fileWitnessReport(amt,x,z,reported);}
function damagePlayer(d){if(state!=='play')return;if(player.armor>0){const a=Math.min(player.armor,d*.7);player.armor-=a;d-=a;}player.hp-=d;hurtFlash();}
/* ================= cars ================= */
function liveryOf(t){return t==='police'?'police':t==='taxi'?'taxi':t==='swat'?'swat':t==='amb'?'amb':'none';}
function spawnCar(type,x,z,h,driver){const s=CARSPEC[type],lv=liveryOf(type);const color=type==='taxi'?0xf2c200:lv!=='none'?0xffffff:pick(carColors);
 const M=makeCarMesh(type,color,lv);scene.add(M.grp);const mats=[M.mats[0],glassMat,darkMat,LENS.headOff,LENS.tailOff,carPlateMat()];M.body.material=mats;
 const c={type,spec:s,mesh:M.grp,body3:M.body,beam:M.beam,rearGlow:M.rearGlow,bar:M.bar,mats,pos:new V3(x,0,z),vel:new V3(),h,speed:0,hp:s.hp,max:s.hp,driver,ai:null,route:null,burn:0,dead:false,wreckT:0,stuck:0,rev:0,wait:0,cd:rnd(1,2),siren:false,block:false,unit:null,phys:false,body:null,veh:null,upY:1,spin:0,steerA:0,lightsOn:!!driver};
 M.grp.position.copy(c.pos);M.grp.rotation.y=h;cars.push(c);return c;}
function paintCar(c,color){c.heroWanted=false;removeHeroCoupe(c);const m=carPaint(c.type,color,liveryOf(c.type));c.mats[0]=m;c.body3.material=c.mats.slice();}
function removeCar(c){removeHeroCoupe(c);physCarOff(c);scene.remove(c.mesh);if(c.ownGeo)c.body3.geometry.dispose();const i=cars.indexOf(c);if(i>=0)cars.splice(i,1);}
function setCarLights(c,brake){const on=!!(c.driver||c===player.car)&&!c.dead;const head=on?LENS.headOn:LENS.headOff,tail=on?(brake?LENS.tailBrake:LENS.tailOn):(brake?LENS.tailBrake:LENS.tailOff);
 if(c.mats[3]!==head||c.mats[4]!==tail){c.mats[3]=head;c.mats[4]=tail;c.body3.material=c.mats.slice();}c.beam.visible=on;c.rearGlow.visible=on;updateHeroLights(c);}
const _cqc=new THREE.Quaternion(),_cv3=new V3(),_cq90=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),-Math.PI/2);
function syncCarMesh(c){if(c.phys){const b=c.body;_cqc.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w).multiply(_cq90);c.mesh.quaternion.copy(_cqc);_cv3.set(0,-c.spec.com,0).applyQuaternion(_cqc);c.mesh.position.set(b.position.x+_cv3.x,b.position.y+_cv3.y,b.position.z+_cv3.z);}
 else{c.mesh.position.set(c.pos.x,c.pos.y,c.pos.z);c.mesh.rotation.set(0,c.h,0);}}
function pushWheels(c,dt){
 if(!c.mesh.visible){
  for(const w of c.hero?.wheels||[])w.visible=false;
  return;
 }
 const s=c.spec;
 if(c.phys){
  const speed=Math.hypot(c.vel.x,c.vel.z),moving=c.body.sleepState!==CANNON.Body.SLEEPING;
  for(let i=0;i<4;i++){
   const w=c.veh.wheelInfos[i],road=w.raycastResult.body,contact=w.raycastResult.hitPointWorld;
   c.veh.updateWheelTransform(i);
   const t=w.worldTransform;
   if(c.hero)heroWheel(c,i,t.position,t.quaternion,true);
   else wheelPushQ(t.position,t.quaternion,s.wr/.335);
   if(c!==player.car)continue;
   if(moving&&road&&speed>4&&(w.skidInfo<.91||(i>=2&&c.hb))){
    skid(c,i,contact);
    c.sliding=true;
   }else if(c.skidLast)c.skidLast[i]=null;
   if(moving&&road&&i>=2&&speed>7&&Math.random()<dt*(speed-6)*1.55){
    const sand=road.material===PH.mat.sand;
    emit(contact.x,contact.y+.07,contact.z,c.vel.x*.30+rnd(-.8,.8),rnd(.44,1.25),
     c.vel.z*.30+rnd(-.8,.8),sand?.48:.29,.19,sand?.88:.54,sand?0xa28f72:0xa8bbcb,false,2);
   }
  }
  }else{
  c.spin+=c.speed*dt/s.wr;
  let i=0;
  for(const [sx,sz] of [[1,1],[-1,1],[1,-1],[-1,-1]]){
   _cv3.set(sx*(s.W/2-.14),s.wr,sz*s.wb).applyQuaternion(c.mesh.quaternion).add(c.mesh.position);
   if(c.hero)heroWheel(c,i,_cv3,c.mesh.quaternion,false);
   else wheelPush(_cv3.x,_cv3.y,_cv3.z,c.mesh.quaternion,0,c.spin,s.wr/.335);
   i++;
  }
 }
}
function damageCar(c,amt){if(c.dead)return;c.hp-=amt;if(c.hp<=0){c.hp=0;c.dead=true;c.burn=4;const lx=Math.cos(c.h)*2.3,lz=-Math.sin(c.h)*2.3;
 if(c.driver==='ai'){c.driver=null;ejectPed(c.pos.x+lx,c.pos.z+lz,c.pos.x,c.pos.z);}
 if(c.driver==='police'){c.driver=null;spawnUnit(c.unit||'cop',c.pos.x+lx,c.pos.z+lz,'law',!!c.dispatched);}
 setCarLights(c,false);if(c===player.car)toast("GET OUT! IT'S GONNA BLOW",1800);}}
const _inv=new THREE.Matrix4(),_lp=new V3();
function applyCarHits(){
 const impacts=new Map();
 for(const hit of PH.hits){
  const key=hit.car.body.id+':'+hit.other.id;
  if((impacts.get(key)?.iv||0)<hit.iv)impacts.set(key,hit);
 }
 PH.hits.length=0;
 for(const impact of impacts.values())onCarHit(impact);
}
function onCarHit(h){const c=h.car,o=h.other;if(!cars.includes(c))return;const oc=o?.car,iv=h.iv;if(iv<3)return;
 const previous=c.lastHit||(c.lastHit=new Map());
 const old=previous.get(o.id);
 if(old&&time-old.time<.24&&iv<old.speed*1.32)return;
 if(previous.size>35)previous.clear();
 previous.set(o.id,{time,speed:iv});
 const massShare=o.mass>0?o.mass/(c.spec.mass+o.mass):1;
 const closing=iv*massShare;
 const dmg=Math.max(0,closing-2.05)*.99+Math.max(0,closing-7)**2*.082;
 if(dmg>0)damageCar(c,dmg);
 if(iv>4.5&&c.mesh.visible){c.mesh.updateMatrixWorld();_inv.copy(c.mesh.matrixWorld).invert();_lp.set(h.px,h.py,h.pz).applyMatrix4(_inv);_lp.y=clamp(_lp.y,c.spec.gc+.2,c.spec.r-.1);carDent(c,_lp.x*1.05,_lp.y,_lp.z*1.02,Math.min(.28,Math.max(0,(closing-1.2)*.018)));
  if(iv>7)for(let k=0;k<6;k++)emit(h.px,h.py+.3,h.pz,rnd(-3,3),rnd(1,4),rnd(-3,3),.4,.06,.05,0xffd29a,true,9);}
 if(iv>5){noise(.25+Math.min(iv,25)*.015,700+iv*30,distVol(h.px,h.pz,Math.min(1,iv/16)));if(c===player.car||oc===player.car){shake=Math.max(shake,Math.min(1,iv/20));if(c===player.car&&iv>16)damagePlayer((iv-16)*.9);}}
 if(oc&&(c===player.car||oc===player.car)){const other=c===player.car?oc:c;if(other.driver==='police'&&iv>7&&wanted<2)crime(12,other.pos.x,other.pos.z,true);if(other.driver==='ai'&&iv>6)other.angry=4;}}
function onPropHit(p,iv,c){
 if(c===player.car&&iv>2.4)fileWitnessReport(iv>7?24:16,p.renderPosition.x,p.renderPosition.z,false,true);
 noise(.2,p.t==='lamp'||p.t==='hydrant'?500:1200,distVol(p.x,p.z,Math.min(.7,iv/14)));
}
function explode(c){c.burn=0;c.wreckT=0;c.mats[0]=burntMat;c.mats[1]=burntMat;c.body3.material=c.mats.slice();if(c.bar){c.bar.r.material=SIREN.offR;c.bar.b.material=SIREN.offB;}c.beam.visible=c.rearGlow.visible=false;
 if(c.hero)c.hero.shell.traverse(o=>{if(o.isMesh)o.material=burntMat;});
 updateHeroLights(c);
 if(c===player.car)player.hp=0;explodeAt(c.pos.x,c.pos.z,9,c);if(c.phys){c.body.wakeUp();c.body.applyImpulse(new CV(rnd(-1,1)*c.spec.mass*1.2,c.spec.mass*4.5,rnd(-1,1)*c.spec.mass*1.2),new CV(rnd(-1,1),.5,rnd(-1,1)));}}
function explodeAt(x,z,r,src){for(let k=0;k<34;k++)emit(x,1,z,rnd(-8,8),rnd(3,12),rnd(-8,8),rnd(.5,1.1),2,6,pick([0xffa030,0xff6020,0xffd060]),true,6);
 for(let k=0;k<18;k++)emit(x+rnd(-1,1),1.5,z+rnd(-1,1),rnd(-2,2),rnd(2,5),rnd(-2,2),rnd(1.8,3.2),3,11,0x2a2624,false);
 boomL.position.set(x,3,z);boomL.intensity=30;noise(1.6,480,distVol(x,z,1));const dP=Math.hypot(x-player.pos.x,z-player.pos.z);shake=Math.max(shake,clamp(1-dP/60,0,1));
 if(!player.car&&dP<r){damagePlayer(80*(1-dP/r));knockPlayer((player.pos.x-x)/(dP||1)*8,6,(player.pos.z-z)/(dP||1)*8);}
 for(const o of cars){if(o===src)continue;const d=Math.hypot(o.pos.x-x,o.pos.z-z);if(d<r){damageCar(o,70*(1-d/r)+10);if(!o.phys)physCarOn(o);}}
 physImpulseRadial(x,.5,z,r*1.5,12000,src&&src.body);
 for(const p of peds)if(!p.dead&&Math.hypot(p.pos.x-x,p.pos.z-z)<r)killPed(p,(p.pos.x-x)*2,6,(p.pos.z-z)*2,false);
 for(const arr of[cops,gang,guards])for(const u of arr)if(!u.dead&&Math.hypot(u.pos.x-x,u.pos.z-z)<r)hitUnit(u,999,u.pos.x-x,u.pos.z-z,false,true);
 scare(x,z,45);}
/* ---- driving ---- */
function kinematicDrive(c,thr,steer,dt){const s=c.spec;const tgt=thr*s.max;c.speed+=(clamp(tgt-c.speed,-12*dt,6*dt));c.h+=steer*clamp(c.speed/7,-1,1)*1.6*dt;c.pos.x+=Math.sin(c.h)*c.speed*dt;c.pos.z+=Math.cos(c.h)*c.speed*dt;c.vel.set(Math.sin(c.h)*c.speed,0,Math.cos(c.h)*c.speed);}
function drive(c,thr,steer,hb,dt){c.hb=hb;if(c.phys)physCarControl(c,thr,steer,hb,dt);else kinematicDrive(c,Math.max(0,thr),steer,dt);if(c.driver)setCarLights(c,c.braking||thr<0&&c.speed>1);}
function blockedAhead(c){
 const fx=Math.sin(c.h),fz=Math.cos(c.h);
 const inLane=(p,w)=>{
  if(Math.abs(p.y-c.pos.y)>2.4)return false;
  const dx=p.x-c.pos.x,dz=p.z-c.pos.z,f=dx*fx+dz*fz;
  return f>=1.5&&f<=10&&Math.abs(dx*fz-dz*fx)<w;
 };
 return cars.some(o=>o!==c&&inLane(o.pos,2.3))||
  !player.car&&inLane(player.pos,1.8)||
  peds.some(p=>!p.dead&&(p.mode==='flee'||p.cross)&&inLane(p.pos,1.8));
}
function expressLane(route,i,dir,lane){
 const {points}=route;
 const at=points[i],from=points[Math.max(0,i-1)],to=points[Math.min(points.length-1,i+1)];
 const dx=to.x-from.x,dz=to.z-from.z,offset=dir*lane/Math.hypot(dx,dz);
 return {x:at.x-dz*offset,z:at.z+dx*offset,y:at.y,h:Math.atan2(dir*dx,dir*dz)};
}
function driveExpressway(c,dt){
 const ai=c.express, {route,dir,lane}=ai,max=route.points.length-1;
 while(ai.i>0&&ai.i<max){
  const p=expressLane(route,ai.i,dir,lane);
  const ahead=(p.x-c.pos.x)*Math.sin(p.h)+(p.z-c.pos.z)*Math.cos(p.h);
  if(ahead>1.2)break;
  ai.i+=dir;
 }
 const target=expressLane(route,clamp(ai.i+dir*3,0,max),dir,lane);
 if((ai.i===0||ai.i===max)&&dist2(c.pos,target)<4.8){
  c.express=null;
  c.ai=dir>0?{a:[15,11],b:[16,11]}:{a:[2,11],b:[1,11]};
  return;
 }
 const diff=wrapA(Math.atan2(target.x-c.pos.x,target.z-c.pos.z)-c.h);
 const pace=blockedAhead(c)?0:ai.i<10||ai.i>max-10?11.5:Math.abs(diff)>.3?12:21;
 drive(c,clamp((pace-c.speed)*.42,-1,1),clamp(diff*2.1,-1,1),pace===0&&c.speed<.85,dt);
 if(!c.phys){
  const deck=sampleGrade(c.pos.x,c.pos.z,null,.8);
  if(deck)c.pos.y=deck.height;
 }
}
function spawnExpressTraffic(){
 const route=GRADE_ROADS.routes.find(r=>r.expressway),at=player.car?.pos||player.pos;
 let nearest=0,distance=Infinity;
 for(const [i,p] of route.points.entries()){
  const d=dist2(p,at);
  if(d<distance){nearest=i;distance=d;}
 }
 if(distance>125)return;
 for(let t=0;t<12;t++){
  const dir=pick([-1,1]),lane=pick([2.06,5.92]);
  const i=clamp(nearest+pick([-1,1])*rint(14,42),2,route.points.length-3);
  const pos=expressLane(route,i,dir,lane),d=dist2(at,pos);
  if(d<46||d>167||cars.some(c=>dist2(c.pos,pos)<18&&Math.abs(c.pos.y-pos.y)<2.4))continue;
  const c=spawnCar(pick(['sedan','hatch','van','suv']),pos.x,pos.z,pos.h,'ai');
  c.pos.y=pos.y;
  c.speed=13;
  c.express={route,i:i+dir,dir,lane};
  return;
 }
}
function aiTraffic(c,dt){
 if(c.express){driveExpressway(c,dt);return;}
 if(!c.ai){
  const a=nearestTrafficNode(c.pos);
  c.ai={a,b:pick(neighbors(a))};
 }
 const A=c.ai.a,B=c.ai.b,{dx,dz,half}=streetFrame(A,B),p=lanePosition(A,B,1);
 const tx=p.x,tz=p.z,along=(tx-c.pos.x)*dx+(tz-c.pos.z)*dz;
 if(along<4.5){
  const connected=neighbors(B),opts=connected.filter(n=>n[0]!==A[0]||n[1]!==A[1]);
  let nb=opts.find(n=>n[0]-B[0]===dx&&n[1]-B[1]===dz);
  if(!nb||Math.random()<.4)nb=pick(opts.length?opts:connected);
  c.ai={a:B,b:nb};
 }
 const look=c.phys?Math.max(7,Math.abs(c.speed)*.9):8;const k=along-Math.min(Math.max(along,0),look),gx=tx-dx*k,gz=tz-dz*k;const diff=wrapA(Math.atan2(gx-c.pos.x,gz-c.pos.z)-c.h);
 let target=Math.abs(diff)>.3?6.5:half<6?8.5:(c.type==='police'?13:11.5);
 const light=dz?tlPhase.ns:tlPhase.ew;const stop=(dx?NORTH_SOUTH[B[0]]:EAST_WEST[B[1]])+4.1;
 if(streetSignal(...B)&&light!=='G'&&along>stop-1&&along<stop+15&&!c.siren)target=Math.min(target,Math.max(0,(along-stop)*.85));
 if(blockedAhead(c)){c.wait+=dt;if(c.wait<5)target=0;else if(c.wait>6.5)c.wait=0;}else c.wait=0;
 if(c.phys&&c.upY<.4){c.flipT=(c.flipT||0)+dt;if(c.flipT>3&&c.driver==='ai'){c.driver=null;ejectPed(c.pos.x+2,c.pos.z,c.pos.x,c.pos.z);}}
 const thr=clamp((target-c.speed)*.35,-1,1);drive(c,target<.5&&c.speed<.85?0:thr,clamp(diff*2.2,-1,1),target<.5&&c.speed<.85,dt);}
function aiPolice(c,dt){
 if(!c.dispatched){c.siren=false;aiTraffic(c,dt);return;}
 const playerTarget=player.car?player.car.pos:player.pos,L=wanted;
 const see=policeCanSee(c.pos,playerTarget,c.h,LV.sees[L]*1.22,L);
 const realDistance=dist2(c.pos,playerTarget);
 if(see)confirmContact(playerTarget);
 const target=see?playerTarget:searchGoal(c.pos.x,c.pos.z,c.body?.id||c.searchIndex||0,1.4);
 const distance=dist2(c.pos,target);
 let gx=target.x,gz=target.z;
 if(!see||realDistance>36){
  if(!c.route)c.route={node:c.ai?.b||nearestTrafficNode(c.pos)};
  const node=c.route.node,at=streetNode(node);
  if(dist2(at,c.pos)<10){
   const goal=nearestTrafficNode(target);
   c.route.node=nextStreetNode(node,goal);
  }
  if(distance>38||rayWorld(c.pos.x,c.pos.z,gx,gz)<.98){
   const waypoint=streetNode(c.route.node);
   gx=waypoint.x;gz=waypoint.z;
  }
 }else c.route=null;
 const diff=wrapA(Math.atan2(gx-c.pos.x,gz-c.pos.z)-c.h);
 if(c.rev>0){c.rev-=dt;drive(c,-.72,diff>0?-1:1,false,dt);return;}
 c.stuck=Math.abs(c.speed)<1.2&&distance>10?c.stuck+dt:0;
 if(c.stuck>2){c.stuck=0;c.rev=1.05;}
 if(c.phys&&c.upY<.4){disembarkPolice(c);return;}
 const deploy=see&&!player.car&&L>=2&&realDistance<12||
  !see&&L>=2&&distance<15&&Math.abs(c.speed)<3&&sceneSearchAllowed(c.pos,target);
 if(deploy&&state==='play'){
  drive(c,-1,0,true,dt);
  if(Math.abs(c.speed)<2.2)disembarkPolice(c);
  return;
 }
 const top=[0,7,10,21,27,31][L];
 const pace=Math.abs(diff)>.75?Math.min(top,8):see?top:Math.min(top,12);
 const targetSpeed=distance<4&&!see?0:pace;
 drive(c,clamp((targetSpeed-c.speed)*.48,-1,1),clamp(diff*2.05,-1,1),targetSpeed===0&&Math.abs(c.speed)<.55,dt);
 if(L>=3&&see&&realDistance<28&&state==='play'){
  c.cd-=dt;
  if(c.cd<=0){c.cd=rnd(.9,1.4)/(L-2);unitShootFrom(c.pos.x,1.3,c.pos.z,LV.acc[L]*.8,LV.dmg[L]);}
 }
}
function sceneSearchAllowed(source,target){
 return Math.hypot(source.x-target.x,source.z-target.z)<16&&state==='play';
}
function disembarkPolice(c){
 c.driver=null;c.ai=null;c.siren=false;
 setCarLights(c,false);
 const x=Math.cos(c.h)*2.1,z=-Math.sin(c.h)*2.1;
 spawnUnit(c.unit||'cop',c.pos.x+x,c.pos.z+z,'law',true);
}
/* ================= people ================= */
function perim(B){return{x0:B.x0+1.7,x1:B.x1-1.7,z0:B.z0+1.7,z1:B.z1-1.7};}
function perimPos(R,t){const w=R.x1-R.x0,h=R.z1-R.z0,L=2*(w+h);t=((t%L)+L)%L;if(t<w)return[R.x0+t,R.z0];t-=w;if(t<h)return[R.x1,R.z0+t];t-=h;if(t<w)return[R.x1-t,R.z1];t-=w;return[R.x0,R.z1-t];}
function perimT(R,x,z){const w=R.x1-R.x0,h=R.z1-R.z0,cx=clamp(x,R.x0,R.x1),cz=clamp(z,R.z0,R.z1);const dT=cz-R.z0,dR=R.x1-cx,dB=R.z1-cz,dL=cx-R.x0,m=Math.min(dT,dR,dB,dL);
 if(m===dT)return cx-R.x0;if(m===dR)return w+(cz-R.z0);if(m===dB)return w+h+(R.x1-cx);return 2*w+h+(R.z1-cz);}
function nearBlock(min,max){const c=blocks.filter(B=>{const d=Math.hypot((B.x0+B.x1)/2-player.pos.x,(B.z0+B.z1)/2-player.pos.z);return d>min&&d<max;});return c.length?pick(c):pick(blocks);}
function attachPed(p){const B=blocks[parcelKey(p.pos.x,p.pos.z)];p.R=perim(B);p.t=perimT(p.R,p.pos.x,p.pos.z);p.mode='walk';}
function newPedChar(p,B){if(p.c)removeChar(p.c);let role=pedRoleFor(B);if(role==='mb')role=ROLE.mb?'mb':'m';if(role==='fb')role=ROLE.fb?'fb':'f';const name=pickChar(role);p.c=makeChar(name,{});p.c.root.visible=false;p.tough=CAST[name]==='m'&&Math.random()<.3||CAST[name]==='gang';p.fem=/Female/.test(name);}
function placePed(p,B,stand){newPedChar(p,B);p.R=perim(B);p.t=rnd(0,200);const q=perimPos(p.R,p.t);p.pos.set(q[0],0,q[1]);p.mode='walk';p.dead=false;p.hp=60;p.dir=Math.random()<.5?1:-1;p.spd=rnd(1.15,1.55)*(p.fem?.95:1);p.cash=rint(5,80);p.fleeT=0;p.downT=0;p.c.talk=0;
 if(stand){p.mode='stand';p.standT=rnd(8,25);p.c.talk=Math.random()<.7?1:0;p.c.yaw=rnd(0,6);}}
function scare(x,z,r){for(const p of peds){if(p.dead||p.mode==='fight')continue;const dx=p.pos.x-x,dz=p.pos.z-z,d=Math.hypot(dx,dz);if(d<r){p.mode='flee';p.c.talk=0;p.fleeT=rnd(5,8);const a=Math.atan2(dx,dz)+rnd(-.6,.6);p.fv.set(Math.sin(a),0,Math.cos(a));}}}
function killPed(p,vx,vy,vz,crimeIt){if(p.dead)return;p.dead=true;p.mode='down';p.downT=0;p.c.hands=0;p.c.talk=0;ragdoll(p.c,vx,vy,vz);dropCash(p.pos.x,p.pos.z,p.cash);p.cash=0;if(crimeIt)crime(15,p.pos.x,p.pos.z);}
function hitPed(p,dmg,dx,dz,melee){if(p.dead)return;p.hp-=dmg;const l=Math.hypot(dx,dz)||1;
 if(p.hp<=0){killPed(p,dx/l*(melee?3:4),melee?2:1.5,dz/l*(melee?3:4),false);crime(melee?8:15,p.pos.x,p.pos.z);return;}
 crime(melee?3:10,p.pos.x,p.pos.z);
 if(melee&&p.tough){p.mode='fight';p.fightCd=.6;}else{p.mode='flee';p.fleeT=rnd(5,8);const a=Math.atan2(p.pos.x-player.pos.x,p.pos.z-player.pos.z);p.fv.set(Math.sin(a),0,Math.cos(a));}p.pos.x+=dx/l*.25;p.pos.z+=dz/l*.25;}
function ejectPed(x,z,fromX,fromZ){let best=null,bd=-1;for(const p of peds){const d=dist2(p.pos,player.pos)+(p.dead?500:0);if(d>bd){bd=d;best=p;}}if(!best)return;
 if(best.c)removeChar(best.c);best.c=makeChar(pickChar(Math.random()<.5?'m':'f'),{});best.dead=false;best.hp=60;best.pos.set(x,0,z);best.mode='flee';best.fleeT=6;const a=Math.atan2(x-fromX,z-fromZ);best.fv.set(Math.sin(a),0,Math.cos(a));best.cash=rint(10,60);}
function carHitsBody(pos,r){for(const k of cars){const rv=Math.abs(k.speed);if(rv<4||Math.abs(k.pos.y-pos.y)>2.3)continue;const dx=pos.x-k.pos.x,dz=pos.z-k.pos.z;const fx=Math.sin(k.h),fz=Math.cos(k.h);const f=dx*fx+dz*fz,l=dx*fz-dz*fx;if(Math.abs(f)<k.spec.L/2+r&&Math.abs(l)<k.spec.W/2+r)return k;}return null;}
function updPeds(dt){const pp=player.car?player.car.pos:player.pos;
 for(const p of peds){const c=p.c;const dP=dist2(p.pos,pp);
  if(p.dead){p.downT+=dt;if(c.body){p.pos.set(c.body.position.x,0,c.body.position.z);}updChar(c,0,dt,dP<95);if(p.downT>30&&dP>50)placePed(p,nearBlock(50,130));continue;}
  if(dP>165){placePed(p,nearBlock(50,125),Math.random()<.22);continue;}
  const ox=p.pos.x,oz=p.pos.z;
  if(p.mode==='flee'){p.fleeT-=dt;p.pos.addScaledVector(p.fv,(p.fem?4.6:5.4)*dt);c.hands=0;const n=collideWorld(p.pos,.3);if(n){const a=Math.atan2(p.fv.x,p.fv.z)+(Math.random()<.5?1.5:-1.5);p.fv.set(Math.sin(a),0,Math.cos(a));}if(p.fleeT<=0)attachPed(p);}
  else if(p.mode==='fight'){const dx=player.pos.x-p.pos.x,dz=player.pos.z-p.pos.z,d=Math.hypot(dx,dz);c.guard=1;
   if(player.car||d>25||state!=='play'){p.mode='flee';p.fleeT=4;c.guard=0;}
   else if(d>1.25){p.pos.x+=dx/d*4.5*dt;p.pos.z+=dz/d*4.5*dt;collideWorld(p.pos,.3);}
   else{p.fightCd-=dt;if(p.fightCd<=0){p.fightCd=rnd(.7,1.1);c.punch=0;if(Math.random()<.6){damagePlayer(7);noise(.12,280,.45);}}}
   c.yaw=lerpA(c.yaw,Math.atan2(dx,dz),1-Math.exp(-12*dt));}
  else if(p.mode==='cower'){c.hands=1;p.cowerT-=dt;if(p.cowerT<=0){c.hands=0;p.mode='flee';p.fleeT=6;const a=Math.atan2(p.pos.x-player.pos.x,p.pos.z-player.pos.z);p.fv.set(Math.sin(a),0,Math.cos(a));}}
  else if(p.mode==='stand'){p.standT-=dt;if(p.standT<=0){p.mode='walk';c.talk=0;attachPed(p);}}
  else{p.t+=p.dir*p.spd*dt;const q=perimPos(p.R,p.t);const dx=q[0]-p.pos.x,dz=q[1]-p.pos.z,d=Math.hypot(dx,dz);if(d>.01){const st=Math.min(d,p.spd*1.8*dt);p.pos.x+=dx/d*st;p.pos.z+=dz/d*st;}if(d>3)p.t-=p.dir*p.spd*dt;}
  const mx=p.pos.x-ox,mz=p.pos.z-oz,spd=Math.hypot(mx,mz)/Math.max(dt,1e-4);if(spd>.2&&p.mode!=='fight')c.yaw=lerpA(c.yaw,Math.atan2(mx,mz),1-Math.exp(-9*dt));
  const hit=carHitsBody(p.pos,.3);if(hit){const s=Math.abs(hit.speed);killPed(p,hit.vel.x*1.1,2+s*.25,hit.vel.z*1.1,false);if(hit===player.car){scare(p.pos.x,p.pos.z,18);crime(10,p.pos.x,p.pos.z);shake=Math.max(shake,.3);}noise(.2,400,distVol(p.pos.x,p.pos.z,.6));continue;}
  if(!player.car&&dP<.7){const dx=p.pos.x-player.pos.x,dz=p.pos.z-player.pos.z,d=dP||1;p.pos.x=player.pos.x+dx/d*.7;p.pos.z=player.pos.z+dz/d*.7;}
  const vis=dP<85;c.root.visible=vis;const gy=groundY(p.pos.x,p.pos.z);c.root.position.set(p.pos.x,c.root.position.y+(gy-c.root.position.y)*Math.min(1,dt*12),p.pos.z);updChar(c,spd,dt,vis);}}
/* ---- law, gang, guards ---- */
function spawnUnit(kind,x,z,team,transfer=false){
 if((!team||team==='law')&&!transfer&&wanted>0&&!reserveOfficer())return null;
 if((!team||team==='law')&&cops.filter(u=>!u.dead).length>=Math.max(2,LAW.activeLimit[wanted]))return null;
 const role=kind==='swat'?'swat':kind==='army'?'army':kind==='gang'?'gang':kind==='guard'?'guard':'cop';
 const c=makeChar(pickChar(role),{gun:1,shadow:false});const hp={swat:180,army:220,gang:90,guard:120,cop:100}[role];
 const u={c,kind:role,pos:new V3(x,0,z),hp,cd:rnd(.6,1.4),team:team||'law',hostile:team!=='gang',dead:false,downT:0};collideWorld(u.pos,.35);c.root.position.copy(u.pos);(team==='gang'?gang:team==='guard'?guards:cops).push(u);return u;}
function removeUnit(u,arr){removeChar(u.c);const i=arr.indexOf(u);if(i>=0)arr.splice(i,1);}
function unitShootFrom(x,y,z,acc,dmg){const tgt=player.car?player.car.pos:player.pos;const a=new V3(x,y,z);
 const ac2=acc*(player.car?(Math.abs(player.car.speed)>15?.55:.85):(player.spd>5?.7:1));const hit=Math.random()<ac2;
 const b=new V3(tgt.x+(hit?0:rnd(-2.5,2.5)),hit?1.2:rnd(.4,2.4),tgt.z+(hit?0:rnd(-2.5,2.5)));tracer(a,b);emit(a.x,a.y,a.z,0,0,0,.06,.5,.8,0xffd080,true);noise(.15,2200,distVol(a.x,a.z,.35));
 if(hit&&state==='play'){if(player.car)damageCar(player.car,dmg*.6);else damagePlayer(dmg);}}
function unitShoot(u,acc,dmg){u.c.aim=.5;unitShootFrom(u.pos.x,u.c.root.position.y+1.45,u.pos.z,acc,dmg);}
function updUnits(arr,dt){const tgt=player.car?player.car.pos:player.pos;
 for(const u of arr.slice()){const c=u.c;
  if(u.dead){u.downT+=dt;if(c.body)u.pos.set(c.body.position.x,0,c.body.position.z);updChar(c,0,dt,true);if(u.downT>16)removeUnit(u,arr);continue;}
  const dx=tgt.x-u.pos.x,dz=tgt.z-u.pos.z,d=Math.hypot(dx,dz);const see=d<70&&los(u.pos,tgt);let spd=0,shoot=false,acc=.3,dmg=8;
  if(u.team==='law'){
   if(d>153||(wanted===0&&d>40)){removeUnit(u,arr);continue;}
   const L=wanted,confirmed=L>0&&policeCanSee(u.pos,tgt,c.yaw,LV.sees[L],L);
   if(confirmed)confirmContact(tgt);
   if(L===0||state!=='play'){c.aim=0;c.guard=0;}
   else{
    const goal=confirmed?tgt:searchGoal(u.pos.x,u.pos.z,u.searchIndex??(u.searchIndex=rint(0,9)));
    const gx=goal.x-u.pos.x,gz=goal.z-u.pos.z,range=Math.hypot(gx,gz);
    const surrender=L>=3&&confirmed&&!player.car&&player.weapon==='fist'&&player.spd<.65;
    const hold=surrender?1.24:confirmed?(L<=2?4:11):2.8;
    if(range>hold){
     spd=L===1?1.75:L===2?2.65:confirmed?4.6:3.25;
     const scale=spd*dt/Math.max(.001,range);
     u.pos.x+=gx*scale;u.pos.z+=gz*scale;
     const wall=collideWorld(u.pos,.33);
     if(wall){
      const side=Math.sign(gz*wall[0]-gx*wall[1])||1;
      u.pos.x-=wall[1]*side*spd*dt*.82;u.pos.z+=wall[0]*side*spd*dt*.82;
      collideWorld(u.pos,.33);
     }
    }
    if(range>.05)c.yaw=lerpA(c.yaw,Math.atan2(gx,gz),1-Math.exp(-dt*6));
    if(surrender&&d<1.52)player.arrestT+=dt;
    shoot=L>=3&&!surrender&&confirmed&&d<34;
    acc=u.kind==='army'?.55:u.kind==='swat'?.45:LV.acc[L];
    dmg=LV.dmg[L];
   }
  }
  else if(u.team==='gang'){if(d>9999){removeUnit(u,arr);continue;}
   if(!u.hostile&&!player.car&&d<9&&player.weapon!=='fist'&&player.c.aim>0)u.hostile=true;
   if(u.hostile&&state==='play'){acc=.3;dmg=7;if(d>14&&see){spd=4.5;u.pos.x+=dx/d*spd*dt;u.pos.z+=dz/d*spd*dt;collideWorld(u.pos,.35);}shoot=see&&d<30;}else{c.talk=1;}}
  else if(u.team==='guard'){acc=.35;dmg=8;if(d>80){removeUnit(u,arr);continue;}if(state==='play'&&see&&d<30)shoot=true;}
  if(u.team!=='law'&&(shoot||spd>0||(u.hostile&&u.team!=='gang'&&wanted>0)))c.yaw=lerpA(c.yaw,Math.atan2(dx,dz),1-Math.exp(-10*dt));
  if(shoot){u.cd-=dt;c.aim=Math.max(c.aim,.3);if(u.cd<=0){u.cd=u.kind==='army'||u.kind==='swat'?rnd(.35,.6):rnd(.7,1.3);unitShoot(u,acc,dmg);}}
  const hit=carHitsBody(u.pos,.35);if(hit&&(hit===player.car||u.team!=='law')){hitUnit(u,999,hit.vel.x,hit.vel.z,false,true,hit);if(hit===player.car)crime(u.team==='law'?35:5,u.pos.x,u.pos.z,u.team==='law');continue;}
  if(!player.car&&d<.8){u.pos.x=tgt.x-dx/(d||1)*.8;u.pos.z=tgt.z-dz/(d||1)*.8;}
  const vis=d<90;c.root.visible=vis;c.root.position.set(u.pos.x,groundY(u.pos.x,u.pos.z),u.pos.z);updChar(c,spd,dt,vis);}}
function hitUnit(u,dmg,dx,dz,melee,blast,car){if(u.dead)return;u.hp-=dmg;u.attacked=true;if(u.team==='gang')for(const g of gang)g.hostile=true;
 if(u.hp<=0){u.dead=true;u.downT=0;const l=Math.hypot(dx,dz)||1,s=car?Math.abs(car.speed):0;ragdoll(u.c,car?car.vel.x*1.1:dx/l*(blast?8:3),car?2+s*.25:(blast?6:1.5),car?car.vel.z*1.1:dz/l*(blast?8:3));
  if(u.team==='law'){crime(u.kind==='cop'?35:45,u.pos.x,u.pos.z,true);dropPickup(u.kind==='cop'?'ammo':'ammo2',u.pos.x,u.pos.z);}
  else if(u.team==='gang'){dropCash(u.pos.x,u.pos.z,rint(40,160));crime(10,u.pos.x,u.pos.z);}else{crime(30,u.pos.x,u.pos.z,true);dropPickup('ammo',u.pos.x,u.pos.z);}}
 else if(u.team==='law')crime(melee?15:12,u.pos.x,u.pos.z,true);}
/* ---- helicopter ---- */
function makeHeli(army){const g=new THREE.Group();const bm=new THREE.MeshStandardMaterial({color:lin(army?0x4a5a3a:0x1a2a4a),roughness:.3,metalness:.5}),wm=new THREE.MeshStandardMaterial({color:lin(0xf2f2f2),roughness:.35,metalness:.3});
 const body=new THREE.Mesh(new THREE.SphereGeometry(1.6,20,14),bm);body.scale.set(1,.9,1.75);g.add(body);const stripe=new THREE.Mesh(new THREE.SphereGeometry(1.62,20,14,0,Math.PI*2,Math.PI*.52,Math.PI*.2),army?bm:wm);stripe.scale.set(1,.9,1.75);g.add(stripe);
 const win=new THREE.Mesh(new THREE.SphereGeometry(1.25,14,10,0,Math.PI*2,0,Math.PI/2),glassMat);win.rotation.x=Math.PI/2.3;win.position.set(0,.15,1.6);g.add(win);
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.18,.42,5.2,10),bm);tail.rotation.x=Math.PI/2;tail.position.set(0,.3,-4.3);g.add(tail);const fin=new THREE.Mesh(unitBox,bm);fin.scale.set(.1,1.3,.8);fin.position.set(0,.9,-6.6);g.add(fin);
 for(const s of[-1,1]){const sk=new THREE.Mesh(unitBox,darkMat);sk.scale.set(.1,.1,3.3);sk.position.set(s*1.1,-1.55,.2);g.add(sk);for(const z of[-.8,1])(()=>{const st=new THREE.Mesh(unitBox,darkMat);st.scale.set(.06,.5,.06);st.position.set(s*1.05,-1.3,z);g.add(st);})();}
 const rotor=new THREE.Group();for(let k=0;k<4;k++){const b=new THREE.Mesh(unitBox,darkMat);b.scale.set(.3,.04,9.5);b.rotation.y=k*Math.PI/4;rotor.add(b);}rotor.position.y=1.7;g.add(rotor);
 const tr=new THREE.Mesh(unitBox,darkMat);tr.scale.set(.05,1.6,.15);tr.position.set(.22,.9,-6.7);g.add(tr);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.20,5.2,1,24,2,true),new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;
   void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vV=-p.xyz;gl_Position=projectionMatrix*p;}`,
  fragmentShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;
   void main(){
    float edge=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.8);
    float fade=smoothstep(0.,.15,vUv.y)*(1.-smoothstep(.91,1.,vUv.y));
    gl_FragColor=vec4(1.,.91,.73,fade*(.007+edge*.027));
   }`
 }));
 const spot=new THREE.Mesh(new THREE.CircleGeometry(5.3,32),new THREE.MeshBasicMaterial({map:glowTex(),color:new THREE.Color(1.54,1.41,1.15),transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false}));
 spot.rotation.x=-Math.PI/2;
 const light=new THREE.SpotLight(0xffebcb,0,75,.19,.32,1.16);
 if(QUALITY.level>=2){
  light.castShadow=true;
  light.shadow.mapSize.set(512,512);
  light.shadow.bias=-.0008;
  light.shadow.normalBias=.045;
  light.shadow.camera.near=2;
  light.shadow.camera.far=70;
 }
 scene.add(light,light.target);
 const nav=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),new THREE.MeshBasicMaterial({color:new THREE.Color(4,.2,.2)}));nav.position.set(0,-.9,1.4);g.add(nav);
 scene.add(g,beam,spot);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});const a=Math.random()*6;
 return{g,rotor,tr,beam,spot,light,nav,pos:new V3(player.pos.x+Math.cos(a)*150,34,player.pos.z+Math.sin(a)*150),vel:new V3(),sp:player.pos.clone(),hp:army?500:380,cd:2,dead:false,army,ang:rnd(0,6)};}
const HELI_UP=new V3(0,1,0),_heliAxis=new V3(),_heliHit=new CANNON.RaycastResult();
const _heliFrom=new CV(),_heliTo=new CV();
const HELI_FILTER={collisionFilterMask:PHYS_GROUP.world,skipBackfaces:true};
function removeHeli(h){
 scene.remove(h.g,h.beam,h.spot,h.light,h.light.target);
 h.beam.geometry.dispose();h.beam.material.dispose();
 h.spot.geometry.dispose();h.spot.material.dispose();
 if(h.light.shadow.map)h.light.shadow.map.dispose();
 helis.splice(helis.indexOf(h),1);
}
function updHelis(dt){const tgt=player.car?player.car.pos:player.pos;
 for(const h of helis.slice()){h.rotor.rotation.y+=dt*28;h.tr.rotation.x+=dt*40;h.nav.visible=(time*2|0)%2===0;
  if(h.dead){h.vel.y-=14*dt;h.pos.addScaledVector(h.vel,dt);h.g.rotation.y+=dt*4;h.beam.visible=h.spot.visible=false;h.light.intensity=0;if(Math.random()<.8)emit(h.pos.x,h.pos.y,h.pos.z,rnd(-1,1),rnd(1,3),rnd(-1,1),1.5,1.5,5,0x2a2624,false);
   if(h.pos.y<=1.2){explodeAt(h.pos.x,h.pos.z,11);removeHeli(h);}else h.g.position.copy(h.pos);continue;}
  const L=wanted;if(L<4){h.pos.y+=dt*8;h.pos.x+=dt*25;if(h.pos.y>95){removeHeli(h);continue;}}
  else{const ls=L===5?15:11,aim=searchGoal(h.sp.x,h.sp.z,3,.60);_v.set(aim.x-h.sp.x,0,aim.z-h.sp.z);const dl=_v.length();if(dl>ls*dt)_v.multiplyScalar(ls*dt/dl);h.sp.add(_v);
   h.ang+=dt*.25;const want=new V3(h.sp.x+Math.cos(h.ang)*22,32+Math.sin(time*.7)*2,h.sp.z+Math.sin(h.ang)*22);_v.subVectors(want,h.pos);const dl2=_v.length();if(dl2>22*dt)_v.multiplyScalar(22*dt/dl2);h.pos.add(_v);}
  h.g.position.copy(h.pos);h.g.rotation.y=lerpA(h.g.rotation.y,Math.atan2(h.sp.x-h.pos.x,h.sp.z-h.pos.z),dt*2);h.g.rotation.x=.1;
  const lightOn=L>=4;
  h.light.intensity=lightOn?6.4:0;
  h.beam.visible=lightOn;
  h.spotted=false;
  if(lightOn){
   const y=groundY(h.sp.x,h.sp.z,LAW.anchor.y),sourceY=h.pos.y-1.13;
   _heliFrom.set(h.pos.x,sourceY,h.pos.z);
   _heliTo.set(h.sp.x,y-.13,h.sp.z);
   _heliHit.reset();
   const blocked=PH.w.raycastClosest(_heliFrom,_heliTo,HELI_FILTER,_heliHit)&&_heliHit.hitPointWorld.y>y+.34;
   const end=blocked?_heliHit.hitPointWorld:_heliTo;
   _heliAxis.set(h.pos.x-end.x,sourceY-end.y,h.pos.z-end.z);
   const length=Math.max(.1,_heliAxis.length());
   h.beam.position.set((h.pos.x+end.x)/2,(sourceY+end.y)/2,(h.pos.z+end.z)/2);
   h.beam.scale.setScalar(Math.min(1,length/28));
   h.beam.scale.y=length;
   h.beam.quaternion.setFromUnitVectors(HELI_UP,_heliAxis.divideScalar(length));
   h.light.position.set(h.pos.x,sourceY,h.pos.z);
   h.light.target.position.set(h.sp.x,y,h.sp.z);
   h.spot.position.set(h.sp.x,y+.053,h.sp.z);
   h.spot.visible=!blocked;
   h.spotted=!blocked&&dist2(h.sp,tgt)<6;
  }else h.spot.visible=false;
  if(L===5&&h.spotted&&state==='play'){h.cd-=dt;if(h.cd<=0){h.cd=rnd(.25,.45);const a=new V3(h.pos.x,h.pos.y-1.5,h.pos.z);const hit=Math.random()<.3;const b=new V3(tgt.x+(hit?0:rnd(-3,3)),hit?1.2:0,tgt.z+(hit?0:rnd(-3,3)));tracer(a,b);noise(.12,2500,distVol(a.x,a.z,.3));if(hit){if(player.car)damageCar(player.car,6);else damagePlayer(9);}}}}}
/* ---- spawning ---- */
function laneSpot(minD,maxD,origin=player.pos){
 const i0=parcelAxis(CITY_X,origin.x-maxD),i1=parcelAxis(CITY_X,origin.x+maxD)+1;
 const j0=parcelAxis(CITY_Z,origin.z-maxD),j1=parcelAxis(CITY_Z,origin.z+maxD)+1;
 for(let t=0;t<80;t++){
  const a=[rint(i0,i1),rint(j0,j1)],opts=neighbors(a);
  if(!opts.length)continue;
  const b=pick(opts),p=lanePosition(a,b,rnd(.28,.72)),d=dist2(p,origin);
  if(d<minD||d>maxD||cars.some(c=>dist2(c.pos,p)<10))continue;
  return {...p,a,b};
 }
 return null;
}
const TRAFFIC=['sedan','sedan','hatch','suv','sport','taxi','sedan','suv','taxi','hatch','van'];
function spawnTraffic(minD,maxD){const s=laneSpot(minD,maxD);if(!s)return;const c=spawnCar(pick(TRAFFIC),s.x,s.z,s.h,'ai');c.ai={a:s.a,b:s.b};c.speed=9;}
function spawnParked(x,z,h){
 if(x==null){
  for(let t=0;t<35;t++){
   const a=[rint(0,N),rint(0,N)],opts=neighbors(a).filter(b=>streetHalf(a,b)>=7.8);
   if(!opts.length)continue;
   const b=pick(opts),p=lanePosition(a,b,rnd(.28,.72),streetHalf(a,b)-1.22);
   if(cars.some(c=>dist2(c.pos,p)<7))continue;
   ({x,z,h}=p);
   break;
  }
  if(x==null)return null;
 }
 if(cars.some(c=>Math.hypot(c.pos.x-x,c.pos.z-z)<6))return null;
 return spawnCar(pick(['sedan','sport','suv','hatch','sedan','van']),x,z,h,null);
}
function spawnPolice(chase){
 const L=wanted,origin=chase?LAW.anchor:player.pos;
 const spot=laneSpot(chase?29:55,chase?91:183,origin);
 if(!spot)return null;
 const kind=chase&&L>=4&&Math.random()<.30?'swat':'police';
 const c=spawnCar(kind,spot.x,spot.z,spot.h,'police');
 c.unit=kind==='police'?'cop':L===5?'army':'swat';
 c.dispatched=chase;
 c.searchIndex=rint(0,14);
 c.speed=chase?8.5:10;
 c.ai={a:spot.a,b:spot.b};
 return c;
}
function roadblock(){
 const car=player.car;
 if(!car||!LAW.seen||LAW.roadblocks>=2||!lawHasReserve(2)||Math.abs(car.speed)<12)return;
 const dx=Math.sin(car.h),dz=Math.cos(car.h);
 const n=nearestTrafficNode({x:LAW.anchor.x+dx*93,z:LAW.anchor.z+dz*93});
 const opts=neighbors(n);
 const b=opts.sort((a,b)=>{
  const first=streetFrame(n,a),second=streetFrame(n,b);
  return dx*(first.dx-second.dx)+dz*(first.dz-second.dz);
 })[0];
 const {dx:rx,dz:rz,half}=streetFrame(n,b),at=streetNode(n);
 if(dist2(at,car.pos)<54)return;
 LAW.roadblocks++;
 for(const s of [-1,1]){
  const offset=s*Math.min(3.65,half-1.7),px=at.x+rx*15-rz*offset,pz=at.z+rz*15+rx*offset;
  const block=spawnCar('police',px,pz,rx?0:Math.PI/2,null);
  block.block=true;block.siren=true;block.blockT=0;
  reserveOfficer();
  spawnUnit('cop',px-rx*2-rz*s*2,pz-rz*2+rx*s*2,'law',true);
 }
 toast('ROADBLOCK AHEAD',1300);
}
let spawnT=0;
function manage(dt){spawnT-=dt;if(spawnT>0)return;spawnT=1;
 const ai=cars.filter(c=>c.driver==='ai');if(ai.length<(QUALITY.level>=2?22:15))spawnTraffic(70,170);
 if(ai.filter(c=>c.express).length<4)spawnExpressTraffic();
 for(const c of ai)if(dist2(c.pos,player.pos)>215){const s=laneSpot(85,160);if(s){physCarOff(c);c.pos.set(s.x,0,s.z);c.h=s.h;c.ai={a:s.a,b:s.b};c.vel.set(0,0,0);c.speed=9;}}
 serviceDispatch();
 if(!wanted){
  const patrols=cars.filter(c=>c.driver==='police');
  if(patrols.length<2)spawnPolice(false);
  for(const c of patrols)if(dist2(c.pos,player.pos)>215){removeCar(c);break;}
 }
  const L=wanted,wantH=L>=5?2:L>=4?1:0;
 if(helis.filter(h=>!h.dead).length<wantH&&LAW.airSent<wantH){
  heliT-=1;
  if(heliT<=0){
   helis.push(makeHeli(L===5&&LAW.airSent>0));
   LAW.airSent++;
   heliT=L===5?12:25;
   toast('POLICE CHOPPER INCOMING',1400);
  }
 }else heliT=Math.min(heliT,6);
 if(L>=3){roadblockT-=1;if(roadblockT<=0){roadblockT=L>=4?18:28;roadblock();}}
 for(const c of cars.slice())if(c.block){c.blockT+=1;if(c.blockT>70&&dist2(c.pos,player.pos)>60)removeCar(c);}
 const empty=cars.filter(c=>!c.driver&&c!==player.car&&!c.block&&!c.keep);for(const c of empty){const d=dist2(c.pos,player.pos);if((c.dead&&c.wreckT>25&&d>50)||(empty.length>18&&d>150&&!c.dead)){removeCar(c);break;}}
 for(const p of places)if(p.cd>0)p.cd=Math.max(0,p.cd-1);
 const court=blocks.find(B=>B.gang);if(court&&gang.length===0&&Math.hypot(court.gang.x-player.pos.x,court.gang.z-player.pos.z)>110)for(let k=0;k<4;k++)spawnUnit('gang',court.gang.x+rnd(-10,10),court.gang.z+rnd(-6,6),'gang');}
/* physics activation by distance */
function physLOD(){const px=player.pos.x,pz=player.pos.z;for(const c of cars){const d=Math.hypot(c.pos.x-px,c.pos.z-pz);if(!c.phys&&(d<104||c===player.car))physCarOn(c);else if(c.phys&&d>126&&c!==player.car&&(c.driver||c.body.sleepState===2)&&c.upY>.8)physCarOff(c);}}
/* ---- pickups ---- */
const PK={cash:[0x2ecc71,.42,.2,.28],health:[0xff2a3a,.34,.34,.15],armor:[0x2a7aff,.38,.42,.15],ammo:[0x7a8a3a,.45,.28,.28],ammo2:[0x5a6a8a,.45,.28,.28]};
function dropPickup(type,x,z,amount){const[c,sx,sy,sz]=PK[type];const m=new THREE.Mesh(unitBox,new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.8,roughness:.4}));m.scale.set(sx,sy,sz);scene.add(m);const p={type,x:x+rnd(-.5,.5),z:z+rnd(-.5,.5),m,t:0,amount,fixed:false};pickups.push(p);return p;}
function dropCash(x,z,a){if(a>0)dropPickup('cash',x,z,a);}
function updPickups(dt){for(const p of pickups.slice()){p.t+=dt;if(p.cool>0){p.cool-=dt;p.m.visible=p.cool<=0;continue;}p.m.rotation.y+=dt*2.5;p.m.position.set(p.x,groundY(p.x,p.z)+.6+Math.sin(time*3+p.x)*.12,p.z);
 if(!p.fixed&&p.t>45){scene.remove(p.m);pickups.splice(pickups.indexOf(p),1);continue;}
 const pp=player.car?player.car.pos:player.pos;if(state==='play'&&Math.hypot(pp.x-p.x,pp.z-p.z)<(player.car?2.8:1.4)){let ok=true;
  if(p.type==='cash'){player.cash+=p.amount;toast('+$'+p.amount,900);beep(1400,.08,.15,'sine');}else if(p.type==='health'){if(player.hp>=100)ok=false;else{player.hp=Math.min(100,player.hp+40);toast('+HEALTH',900);}}
  else if(p.type==='armor'){player.armor=100;toast('+ARMOR',900);}else if(p.type==='ammo'){player.ammo.pistol+=12;toast('+12 PISTOL AMMO',900);}else if(p.type==='ammo2'){player.ammo.smg+=30;player.own.smg=true;toast('+30 SMG AMMO',900);}
  if(ok){if(p.fixed){p.cool=40;p.m.visible=false;}else{scene.remove(p.m);pickups.splice(pickups.indexOf(p),1);}}}}}
/* ---- markers ---- */
const markerObjs=[];
function labelSprite(text,color){const[c,g]=cvs(512,128);g.font='84px Anton, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=12;g.strokeStyle='rgba(0,0,0,.8)';g.strokeText(text,256,66);g.fillStyle=color;g.fillText(text,256,66);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true,fog:false}));s.scale.set(8,2,1);s.renderOrder=9;return s;}
const MCOL={store:0xffd040,bank:0xffd040,gunshop:0xff8a30,hospital:0xff4060,police:0x4a8aff,chop:0x40ff80,spray:0x40a8ff};
function buildMarkers(){for(const p of places){const col=new THREE.Color(MCOL[p.kind]);const at=p.road||p.door;const r=p.road?4:1.3;const y=groundY(at.x,at.z);
 const ring=new THREE.Mesh(new THREE.RingGeometry(r*.78,r,40),new THREE.MeshBasicMaterial({color:col.clone().multiplyScalar(2),transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide,fog:false}));ring.rotation.x=-Math.PI/2;ring.position.set(at.x,y+.04,at.z);scene.add(ring);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(r,r,p.road?8:3,32,1,true),new THREE.MeshBasicMaterial({color:col.clone().multiplyScalar(1.5),transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.set(at.x,(p.road?4:1.5)+y,at.z);scene.add(beam);REFL.hide.push(beam);
 const lab={store:'ROB $',bank:'ROB BANK',gunshop:'GUNS',hospital:'HEAL',police:'POLICE',chop:'SELL CAR',spray:'RESPRAY'}[p.kind];
 if(p.kind!=='police'){const l=labelSprite(lab,'#'+MCOL[p.kind].toString(16).padStart(6,'0'));l.position.set(at.x,p.road?9:4.6,at.z);l.scale.set(p.road?8:5,p.road?2:1.25,1);scene.add(l);p.label=l;REFL.hide.push(l);}
 markerObjs.push({p,ring,beam});}}
