/* ================= characters: Rocketbox avatars (MIT) + retargeted mocap ================= */
const TPL={},ANIM={},CLIPCACHE={};
const BMAP={Hips:'Bip01_Pelvis',Spine:'Bip01_Spine',Spine1:'Bip01_Spine1',Spine2:'Bip01_Spine2',Neck:'Bip01_Neck',Head:'Bip01_Head',
 LeftShoulder:'Bip01_L_Clavicle',LeftArm:'Bip01_L_UpperArm',LeftForeArm:'Bip01_L_Forearm',LeftHand:'Bip01_L_Hand',
 RightShoulder:'Bip01_R_Clavicle',RightArm:'Bip01_R_UpperArm',RightForeArm:'Bip01_R_Forearm',RightHand:'Bip01_R_Hand',
 LeftUpLeg:'Bip01_L_Thigh',LeftLeg:'Bip01_L_Calf',LeftFoot:'Bip01_L_Foot',LeftToeBase:'Bip01_L_Toe0',
 RightUpLeg:'Bip01_R_Thigh',RightLeg:'Bip01_R_Calf',RightFoot:'Bip01_R_Foot',RightToeBase:'Bip01_R_Toe0'};
const BCHILD={Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',
 LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
const BORDER=Object.keys(BMAP);
const _cq=new THREE.Quaternion(),_cq2=new THREE.Quaternion(),_cv=new THREE.Vector3(),_cv2=new THREE.Vector3();
function nodeMap(root){const m={};root.traverse(o=>{m[o.name]=o;});return m;}
/* register an animation source (mixamo-named skeleton). faceYaw rotates it to face +Z */
function addAnimSource(key,gltf,faceYaw,restClip){const root=gltf.scene;root.rotation.y=faceYaw||0;const nm=nodeMap(root);const pre=Object.keys(nm).find(n=>/Hips$/.test(n)).replace(/Hips$/,'');
 if(restClip){const cl=gltf.animations.find(a=>a.name===restClip);if(cl)for(const t of cl.tracks){const[n,p]=t.name.split('.');if(p==='quaternion'&&nm[n])nm[n].quaternion.fromArray(t.values,0);}}
 root.updateMatrixWorld(true);const rest={},dir={};
 for(const b of BORDER){const o=nm[pre+b];if(!o)continue;rest[b]=o.getWorldQuaternion(new THREE.Quaternion());}
 for(const b in BCHILD){const o=nm[pre+b],c=nm[pre+BCHILD[b]];if(o&&c)dir[b]=c.getWorldPosition(new THREE.Vector3()).sub(o.getWorldPosition(new THREE.Vector3())).normalize();}
 const hips=nm[pre+'Hips'];const hipY=hips.getWorldPosition(new THREE.Vector3()).y;
 const clips={};for(const a of gltf.animations)clips[a.name.toLowerCase()]=a;
 ANIM[key]={root,nm,pre,rest,dir,hipY,clips,mixer:new THREE.AnimationMixer(root)};}
/* pose target rest so limb directions match the source rest, then record rest world quats */
function alignRest(tnm,src){const out={q:{},local:{}};
 for(const b of BORDER){const o=tnm[BMAP[b]];if(!o)continue;const cb=BCHILD[b];
  if(cb&&src.dir[b]&&tnm[BMAP[cb]]){const c=tnm[BMAP[cb]];o.updateWorldMatrix(true,true);
   _cv.setFromMatrixPosition(c.matrixWorld).sub(_cv2.setFromMatrixPosition(o.matrixWorld)).normalize();
   _cq.setFromUnitVectors(_cv,src.dir[b]);const w=o.getWorldQuaternion(new THREE.Quaternion());w.premultiply(_cq);
   o.parent.getWorldQuaternion(_cq2).invert();o.quaternion.copy(_cq2.multiply(w));o.updateWorldMatrix(false,true);}}
 for(const b of BORDER){const o=tnm[BMAP[b]];if(!o)continue;o.updateWorldMatrix(true,false);out.q[b]=o.getWorldQuaternion(new THREE.Quaternion());}
 return out;}
function bakeClip(src,clipName,troot,tnm,trest,fps){const clip=src.clips[clipName];if(!clip)return null;
 const mixer=src.mixer;mixer.stopAllAction();const act=mixer.clipAction(clip);act.reset().play();
 const dur=clip.duration,n=Math.max(2,Math.round(dur*(fps||24)));const times=[];const bones=BORDER.filter(b=>tnm[BMAP[b]]&&src.rest[b]);
 const vals={};for(const b of bones)vals[b]=new Float32Array((n+1)*4);const hip=new Float32Array((n+1)*3);
 const tb=tnm.Bip01,tbRest=tb.position.clone();const hipH=tnm[BMAP.Hips].getWorldPosition(new THREE.Vector3()).y,ratio=hipH/src.hipY;
 const srcInv={};for(const b of bones)srcInv[b]=src.rest[b].clone().invert();
 const W=new Map();const worldOf=o=>{if(W.has(o))return W.get(o);let q;if(!o.parent||!o.parent.isObject3D||o===troot)q=o.getWorldQuaternion(new THREE.Quaternion());else q=worldOf(o.parent).clone().multiply(o.quaternion);W.set(o,q);return q;};
 const sh=src.nm[src.pre+'Hips'];
 for(let k=0;k<=n;k++){const t=Math.min(dur*k/n,dur-1e-4);times.push(dur*k/n);mixer.setTime(t);src.root.updateMatrixWorld(true);W.clear();
  for(const b of bones){const so=src.nm[src.pre+b],to=tnm[BMAP[b]];so.getWorldQuaternion(_cq).multiply(srcInv[b]);const want=_cq.multiply(trest.q[b]).clone();
   const pw=worldOf(to.parent);_cq2.copy(pw).invert().multiply(want);_cq2.toArray(vals[b],k*4);W.set(to,want);}
  const dy=(sh.getWorldPosition(_cv).y-src.hipY)*ratio;hip[k*3]=tbRest.x;hip[k*3+1]=tbRest.y+dy;hip[k*3+2]=tbRest.z;}
 mixer.stopAllAction();
 const tracks=bones.map(b=>new THREE.QuaternionKeyframeTrack(BMAP[b]+'.quaternion',times,Array.from(vals[b])));
 tracks.push(new THREE.VectorKeyframeTrack('Bip01.position',times,Array.from(hip)));
 return new THREE.AnimationClip(clipName,dur,tracks);}
/* build a template from a loaded Rocketbox gltf */
function addTemplate(name,gltf,role,animKey,clipNames){const scene=gltf.scene;const tnm=nodeMap(scene);const src=ANIM[animKey];
 scene.updateMatrixWorld(true);const trest=alignRest(tnm,src);
 const sig=animKey+BORDER.map(b=>trest.q[b]?trest.q[b].toArray().map(v=>v.toFixed(2)).join(','):'').join('|');
 let clips=CLIPCACHE[sig];if(!clips){clips={};for(const k in clipNames){const c=bakeClip(src,clipNames[k],scene,tnm,trest);if(c)clips[k]=c;}CLIPCACHE[sig]=clips;}
 scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){m.envMapIntensity=.5;if(m.map)m.map.anisotropy=4;}}});
 const bb=new THREE.Box3().setFromObject(scene);
 TPL[name]={scene,clips,role,height:bb.max.y};}
const gunMat=new THREE.MeshStandardMaterial({color:0x161616,roughness:.35,metalness:.7});

function makeGun(){const g=new THREE.Group();const a=new THREE.Mesh(unitBox,gunMat);a.scale.set(.045,.07,.26);a.position.z=.1;const b=new THREE.Mesh(unitBox,gunMat);b.scale.set(.04,.13,.055);b.position.set(0,-.07,0);g.add(a,b);g.visible=false;scene.add(g);return g;}
const blobG=new THREE.CircleGeometry(.5,14),blobM=new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.42,depthWrite:false});
const CB={RightArm:'Bip01_R_UpperArm',RightForeArm:'Bip01_R_Forearm',RightHand:'Bip01_R_Hand',LeftArm:'Bip01_L_UpperArm',LeftForeArm:'Bip01_L_Forearm',LeftHand:'Bip01_L_Hand',Head:'Bip01_Head',Spine2:'Bip01_Spine2',Root:'Bip01'};
function makeChar(name,look={}){const T=TPL[name];const model=THREE.SkeletonUtils.clone(T.scene);const root=new THREE.Group();root.rotation.order='YXZ';root.add(model);
 const bones={};const inv={};for(const k in CB)inv[CB[k]]=k;
 model.traverse(o=>{if(inv[o.name])bones[inv[o.name]]=o;if(o.isMesh){o.castShadow=!!look.shadow||!LOWSHADOW;o.receiveShadow=false;o.frustumCulled=false;if(LOWSHADOW&&!look.shadow)o.layers.set(2);}});
 if(LOWSHADOW&&!look.shadow){const bl=new THREE.Mesh(blobG,blobM);bl.rotation.x=-Math.PI/2;bl.position.y=.03;bl.layers.set(2);root.add(bl);}
 const mixer=new THREE.AnimationMixer(model);const acts={};for(const k in T.clips){const a=mixer.clipAction(T.clips[k]);a.play();a.setEffectiveWeight(k==='idle'?1:0);acts[k]=a;}
 mixer.update(Math.random()*2);scene.add(root);
 return{name,root,model,mixer,acts,bones,yaw:0,aim:0,punch:-1,hands:0,guard:0,down:0,gun:look.gun?makeGun():null,spd:0,talk:0};}
const _q=new THREE.Quaternion(),_pq=new THREE.Quaternion(),_v=new THREE.Vector3(),_a=new THREE.Vector3(),_fw=new THREE.Vector3(),_rt=new THREE.Vector3(),_d1=new THREE.Vector3(),_d2=new THREE.Vector3(),_hp=new THREE.Vector3();
/* rotate bone so that the segment towards `child` points along world dir */
function pointBone(b,child,dir,w){if(!b||!child)return;b.updateWorldMatrix(true,false);_v.setFromMatrixPosition(child.matrixWorld);child.parent===b?0:0;
 _a.setFromMatrixPosition(b.matrixWorld);_v.sub(_a).normalize();_q.setFromUnitVectors(_v,_hp.copy(dir).normalize());
 b.getWorldQuaternion(_pq);_q.multiply(_pq);b.parent.getWorldQuaternion(_pq).invert();_pq.multiply(_q);if(w===undefined||w>=1)b.quaternion.copy(_pq);else b.quaternion.slerp(_pq,w);b.updateWorldMatrix(false,true);}
function dirOf(out,f,r,a,b,c){return out.set(f.x*a+r.x*c,b,f.z*a+r.z*c);}
function updChar(c,spd,dt,vis){const R=c.root;
 if(c.body){poseRagdoll(c);if(c.gun)c.gun.visible=false;return;}
 R.rotation.set(0,c.yaw,0);
 if(!vis){if(c.gun)c.gun.visible=false;return;}
 const A=c.acts;const wI=clamp(1-spd/1.3,0,1),wR=clamp((spd-2.4)/2.6,0,1),wW=Math.max(0,1-wI-wR);
 A.idle.setEffectiveWeight(wI);A.walk.setEffectiveWeight(wW);A.run.setEffectiveWeight(wR);if(A.talk){const wt=c.talk&&spd<.3?1:0;A.talk.setEffectiveWeight(wI*wt);A.idle.setEffectiveWeight(wI*(1-wt));}A.walk.timeScale=clamp(spd/1.5,.6,1.7)*(c.back?-1:1);A.run.timeScale=clamp(spd/5.6,.7,1.35);
 c.mixer.update(dt);
 const yaw=c.yaw;_fw.set(Math.sin(yaw),0,Math.cos(yaw));_rt.set(-Math.cos(yaw),0,Math.sin(yaw));const B=c.bones;
 if(c.punch>=0){c.punch+=dt/.3;if(c.punch>1)c.punch=-1;}
 if(c.aim>0)c.aim-=dt;
 if(c.hands>0){pointBone(B.RightArm,B.RightForeArm,dirOf(_d1,_fw,_rt,.15,.75,.55));pointBone(B.RightForeArm,B.RightHand,dirOf(_d2,_fw,_rt,.1,1,-.05));pointBone(B.LeftArm,B.LeftForeArm,dirOf(_d1,_fw,_rt,.15,.75,-.55));pointBone(B.LeftForeArm,B.LeftHand,dirOf(_d2,_fw,_rt,.1,1,.05));}
 else if(c.aim>0){dirOf(_d1,_fw,_rt,1,-.04,.04);pointBone(B.RightArm,B.RightForeArm,_d1);pointBone(B.RightForeArm,B.RightHand,_d1);}
 else if(c.punch>=0||c.guard>0){const e=c.punch>=0?Math.sin(c.punch*Math.PI):0;
  dirOf(_d1,_fw,_rt,.55+.45*e,-.55+.6*e,.28-.3*e);pointBone(B.RightArm,B.RightForeArm,_d1);dirOf(_d2,_fw,_rt,.6+.4*e,.8-.75*e,-.1);pointBone(B.RightForeArm,B.RightHand,_d2);
  dirOf(_d1,_fw,_rt,.55,-.55,-.3);pointBone(B.LeftArm,B.LeftForeArm,_d1);dirOf(_d2,_fw,_rt,.6,.8,.1);pointBone(B.LeftForeArm,B.LeftHand,_d2);}
 if(c.gun){c.gun.visible=c.aim>0;if(c.gun.visible&&B.RightHand){B.RightHand.getWorldPosition(_hp);c.gun.position.copy(_hp).addScaledVector(_fw,.08);c.gun.rotation.set(0,yaw,0);}}}
function removeChar(c){
 scene.remove(c.root);
 if(c.gun)scene.remove(c.gun);
 if(c.mixer)c.mixer.stopAllAction();
 releaseRagdoll(c);
}

const RAG_AXIS=new V3(0,1,0);
const _ragPoint=new CV(),_ragQ=new THREE.Quaternion(),_ragParent=new THREE.Quaternion(),_ragP=new V3();
function ragdoll(c,vx,vy,vz){
 if(c.body)return;
 c.root.updateMatrixWorld(true);
 const names=nodeMap(c.model),parts=[],joints=[];
 const start=c.root.position.clone();
 const world=(key)=>names[BMAP[key]].getWorldPosition(new V3());

 function make(key,end,parent,radius,mass,angle,twist){
  const bone=names[BMAP[key]];
  if(!bone)return null;
  const point=world(key);
  const direction=end&&names[BMAP[end]]?world(end).sub(point):new V3(0,radius*.72,0);
  const length=direction.length();
  direction.normalize();
  const center=point.clone().addScaledVector(direction,length*.5);
  const rotation=new THREE.Quaternion().setFromUnitVectors(RAG_AXIS,direction);
  const shape=key==='Hips'?
   new CANNON.Box(new CV(.155,.108,.116)):
   key==='Head'?new CANNON.Sphere(radius):
   new CANNON.Cylinder(radius*.88,radius,Math.max(.045,length*.88),8);
  const b=physDyn(shape,mass,center.x,center.y,center.z);
  b.collisionFilterGroup=PHYS_GROUP.ragdoll;
  b.collisionFilterMask=PHYS_GROUP.world|PHYS_GROUP.car|PHYS_GROUP.prop;
  b.quaternion.set(rotation.x,rotation.y,rotation.z,rotation.w);
  b.velocity.set(vx,vy,vz);
  b.angularVelocity.set(vz*.22,.8, -vx*.22);
  b.angularDamping=.44;
  const jointPoint=new CV(point.x,point.y,point.z);
  const localPoint=b.pointToLocalFrame(jointPoint);
  if(parent){
   const dir=new CV(direction.x,direction.y,direction.z);
   const link=new CANNON.ConeTwistConstraint(parent,b,{
    pivotA:parent.pointToLocalFrame(jointPoint),pivotB:localPoint,
    axisA:parent.vectorToLocalFrame(dir),axisB:b.vectorToLocalFrame(dir),
    angle,twistAngle:twist,maxForce:22000
   });
   joints.push(link);
   PH.w.addConstraint(link);
  }
  const offset=rotation.clone().invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  parts.push({bone,b,offset,localPoint,position:bone.position.clone(),rot:bone.quaternion.clone()});
  return b;
 }

 const hips=make('Hips','Spine',null,.14,17);
 const torso=make('Spine2','Neck',hips,.142,20,.57,.31);
 make('Head',null,torso,.104,4.7,.76,.48);
 for(const side of ['Left','Right']){
  const arm=make(side+'Arm',side+'ForeArm',torso,.053,2.4,1.25,.73);
  make(side+'ForeArm',side+'Hand',arm,.044,1.7,.94,.42);
  const leg=make(side+'UpLeg',side+'Leg',hips,.071,6.1,.89,.57);
  make(side+'Leg',side+'Foot',leg,.055,3.8,.94,.19);
 }
 if(!hips)return;
 c.body=hips;
 c.rag={parts,joints,start,hipsOrigin:new V3(hips.position.x,hips.position.y,hips.position.z)};
 if(c.gun)c.gun.visible=false;
}

function poseRagdoll(c){
 const {parts,start,hipsOrigin}=c.rag;
 const p=c.body.position;
 c.root.position.set(start.x+p.x-hipsOrigin.x,start.y+p.y-hipsOrigin.y,start.z+p.z-hipsOrigin.z);
 c.root.updateMatrixWorld(true);
 for(const part of parts){
  const {bone,b,localPoint,offset}=part,q=b.quaternion;
  b.pointToWorldFrame(localPoint,_ragPoint);
  _ragP.set(_ragPoint.x,_ragPoint.y,_ragPoint.z);
  bone.position.copy(bone.parent.worldToLocal(_ragP));
  _ragQ.set(q.x,q.y,q.z,q.w).multiply(offset);
  bone.parent.getWorldQuaternion(_ragParent).invert();
  bone.quaternion.copy(_ragParent.multiply(_ragQ));
  bone.updateWorldMatrix(false,true);
 }
}

function releaseRagdoll(c){
 if(!c.rag)return;
 for(const joint of c.rag.joints)PH.w.removeConstraint(joint);
 for(const part of c.rag.parts){
  physRemove(part.b);
  part.bone.position.copy(part.position);
  part.bone.quaternion.copy(part.rot);
 }
 c.body=null;
 c.rag=null;
}
