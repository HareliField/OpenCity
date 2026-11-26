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
 // Clips store local rotations, so rigs with different pelvis-parent axes cannot share a bake.
 const pelvisParent=tnm[BMAP.Hips].parent.getWorldQuaternion(new THREE.Quaternion());
 const sig=animKey+pelvisParent.toArray().map(v=>v.toFixed(3)).join(',')+'|'+BORDER.map(b=>trest.q[b]?trest.q[b].toArray().map(v=>v.toFixed(2)).join(','):'').join('|');
 let clips=CLIPCACHE[sig];if(!clips){clips={};for(const k in clipNames){const c=bakeClip(src,clipNames[k],scene,tnm,trest);if(c)clips[k]=c;}CLIPCACHE[sig]=clips;}
 scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){m.envMapIntensity=.5;if(m.map)m.map.anisotropy=4;}}});
 const bb=new THREE.Box3().setFromObject(scene);
 TPL[name]={scene,clips,role,height:bb.max.y};}
const gunMat=new THREE.MeshStandardMaterial({color:0x161616,roughness:.35,metalness:.7});

function makeGun(){const g=new THREE.Group();const a=new THREE.Mesh(unitBox,gunMat);a.scale.set(.045,.07,.26);a.position.z=.1;const b=new THREE.Mesh(unitBox,gunMat);b.scale.set(.04,.13,.055);b.position.set(0,-.07,0);g.add(a,b);g.visible=false;scene.add(g);return g;}
const blobG=new THREE.CircleGeometry(.5,14),blobM=new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.42,depthWrite:false});
const CB={LeftToe:'Bip01_L_Toe0',RightToe:'Bip01_R_Toe0',LeftKnuckle:'Bip01_L_Finger2',RightKnuckle:'Bip01_R_Finger2',LeftThigh:'Bip01_L_Thigh',LeftCalf:'Bip01_L_Calf',LeftFoot:'Bip01_L_Foot',RightThigh:'Bip01_R_Thigh',RightCalf:'Bip01_R_Calf',RightFoot:'Bip01_R_Foot',RightArm:'Bip01_R_UpperArm',RightForeArm:'Bip01_R_Forearm',RightHand:'Bip01_R_Hand',LeftArm:'Bip01_L_UpperArm',LeftForeArm:'Bip01_L_Forearm',LeftHand:'Bip01_L_Hand',Head:'Bip01_Head',Spine2:'Bip01_Spine2',Root:'Bip01'};
function makeChar(name,look={}){const T=TPL[name];const model=THREE.SkeletonUtils.clone(T.scene);const root=new THREE.Group();root.rotation.order='YXZ';root.add(model);
 const bones={};const inv={};for(const k in CB)inv[CB[k]]=k;
 model.traverse(o=>{if(inv[o.name])bones[inv[o.name]]=o;if(o.isMesh){o.castShadow=!!look.shadow||!LOWSHADOW;o.receiveShadow=false;o.frustumCulled=false;if(LOWSHADOW&&!look.shadow)o.layers.set(2);}});
 if(LOWSHADOW&&!look.shadow){const bl=new THREE.Mesh(blobG,blobM);bl.rotation.x=-Math.PI/2;bl.position.y=.03;bl.layers.set(2);root.add(bl);}
 const mixer=new THREE.AnimationMixer(model);const acts={};for(const k in T.clips){const a=mixer.clipAction(T.clips[k]);a.play();a.setEffectiveWeight(k==='idle'?1:0);acts[k]=a;}
 mixer.update(Math.random()*2);scene.add(root);
 return{name,root,model,mixer,acts,bones,yaw:0,aim:0,punch:-1,hands:0,guard:0,down:0,gun:look.gun?makeGun():null,spd:0,talk:0};}
/* Fit interchangeable photographic portraits to the uniform's bind pose.
   Some of the source rigs express bone translations in centimetres. */
const departmentFaces=new Map(),departmentMounts=new Map(),departmentCards=new Map();
const portraitGeometry=new WeakMap();
function portraitParts(model){
 const parts=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const geometry=mesh.geometry;
  if(/_head$/i.test(mesh.material.name)){parts.push({mesh,face:geometry});return;}
  if(!/_(opacity|glasses)$/i.test(mesh.material.name))return;
  if(!portraitGeometry.has(geometry)){
   const joints=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
   const facialJoint=mesh.skeleton.bones.map(b=>{
    while(b){if(b.name==='Bip01_Head'||b.name==='Bip01_Neck')return true;b=b.parent;}
    return false;
   });
   const onHead=[];
   for(let i=0;i<joints.count;i++){
    let facial=0,total=0;
    for(const component of ['getX','getY','getZ','getW']){
     const w=weights[component](i);total+=w;if(facialJoint[joints[component](i)])facial+=w;
    }
    onHead.push(total>0&&facial/total>=.5);
   }
   const face=[],rest=[],index=geometry.index;
   for(let i=0;i<(index?index.count:joints.count);i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,d=index?index.getX(i+2):i+2;
    (onHead[a]+onHead[b]+onHead[d]>=2?face:rest).push(a,b,d);
   }
   function subset(indices){
    if(!indices.length)return null;
    if(indices.length===(index?index.count:joints.count))return geometry;
    const part=new THREE.BufferGeometry();
    for(const [name,data] of Object.entries(geometry.attributes))part.setAttribute(name,data);
    return part.setIndex(indices);
   }
   portraitGeometry.set(geometry,{face:subset(face),rest:subset(rest)});
  }
  const split=portraitGeometry.get(geometry);
  if(split.face)parts.push({mesh,...split});
 });
 return parts;
}
function fitDepartmentPortrait(c,portraitName){
 const key=c.name+'/'+portraitName;
 if(!departmentFaces.has(key)){
  const target=TPL[c.name].scene,source=TPL[portraitName].scene;
  const targetBones=nodeMap(target),sourceHead=nodeMap(source).Bip01_Head;
  const pieces=portraitParts(source),reference=pieces.find(p=>/_head$/i.test(p.mesh.material.name))?.mesh;
  if(!reference||!sourceHead||!targetBones.Bip01_Head)return;
  target.updateMatrixWorld(true);source.updateMatrixWorld(true);
  const offset=targetBones.Bip01_Head.getWorldPosition(new V3()).sub(sourceHead.getWorldPosition(new V3()));
  const alignment=new THREE.Matrix4().makeTranslation(offset.x,offset.y,offset.z);
  const skin=reference.skeleton;
  const inverses=skin.bones.map((bone,i)=>{
   const targetBone=targetBones[bone.name]||targetBones.Bip01_Head;
   return targetBone.matrixWorld.clone().invert().multiply(alignment).multiply(bone.matrixWorld).multiply(skin.boneInverses[i]);
  });
  departmentFaces.set(key,{pieces,inverses,names:skin.bones.map(b=>b.name),bind:reference.bindMatrix});
 }
 const face=departmentFaces.get(key),actorBones=nodeMap(c.model),old=portraitParts(c.model);
 const original=old.find(p=>/_head$/i.test(p.mesh.material.name))?.mesh;
 if(!original)return;
 const skeleton=new THREE.Skeleton(face.names.map(n=>actorBones[n]||c.bones.Head),face.inverses);
 for(const part of face.pieces){
  const mesh=new THREE.SkinnedMesh(part.face,part.mesh.material);
  mesh.bind(skeleton,face.bind);mesh.frustumCulled=false;mesh.castShadow=original.castShadow;
  mesh.layers.mask=original.layers.mask;original.parent.add(mesh);
 }
 for(const part of old){
  if(part.rest)part.mesh.geometry=part.rest;
  else part.mesh.visible=false;
 }
 c.portraitSkeleton=skeleton;
}

/* Measure the front of the actual shirt, coat or waistcoat at the clip location.
   Quantized attributes must be normalized before doing CPU skinning in three r128. */
function uniformMount(name,lateral,belowCollar){
 const key=name+'/'+lateral+'/'+belowCollar;
 if(departmentMounts.has(key))return departmentMounts.get(key);
 const model=TPL[name].scene,bones=nodeMap(model);
 model.updateMatrixWorld(true);
 const neck=bones.Bip01_Neck.getWorldPosition(new V3());
 const ray=new THREE.Ray(new V3(neck.x+lateral,neck.y-belowCollar,neck.z+.8),new V3(0,0,-1));
 const hit=new V3(),surface=new V3(),normal=new V3(0,0,1);let found=false;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!/_body$/i.test(mesh.material.name))return;
  const geometry=mesh.geometry,{position,skinIndex,skinWeight}=geometry.attributes;
  const unit=a=>{const array=a.isInterleavedBufferAttribute?a.data.array:a.array;
   return !a.normalized?1:array instanceof Int16Array?32767:array instanceof Uint16Array?65535:array instanceof Int8Array?127:255;};
  const pointUnit=unit(position),weightUnit=unit(skinWeight),point=new V3(),weighted=new V3();
  const transforms=mesh.skeleton.bones.map((b,i)=>b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i]));
  const verts=[];
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).divideScalar(pointUnit).applyMatrix4(mesh.bindMatrix);
   const v=new V3();
   for(const get of ['getX','getY','getZ','getW']){
    const w=skinWeight[get](i)/weightUnit;
    if(w)v.addScaledVector(weighted.copy(point).applyMatrix4(transforms[skinIndex[get](i)]),w);
   }
   verts.push(v.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld));
  }
  const index=geometry.index;
  for(let i=0;i<(index?index.count:verts.length);i+=3){
   const a=verts[index?index.getX(i):i],b=verts[index?index.getX(i+1):i+1],d=verts[index?index.getX(i+2):i+2];
   if(ray.intersectTriangle(a,b,d,false,hit)&&(!found||hit.z>surface.z)){
    surface.copy(hit);THREE.Triangle.getNormal(a,b,d,normal);if(normal.z<0)normal.negate();found=true;
   }
  }
 });
 if(!found)surface.set(ray.origin.x,ray.origin.y,neck.z+.14);
 // Keep the clip upright on the shirt even when the sampled seam is steep.
 normal.z=Math.max(normal.z,.7);normal.normalize();
 const rotation=new THREE.Quaternion().setFromUnitVectors(new V3(0,0,1),normal);
 const mount=bones.Bip01_Spine2.matrixWorld.clone().invert().multiply(new THREE.Matrix4().compose(surface,rotation,new V3(1,1,1)));
 departmentMounts.set(key,mount);return mount;
}
function attachDepartmentClip(c,clip,x,drop){
 if(!c.bones.Spine2)return;
 clip.applyMatrix4(uniformMount(c.name,x,drop));
 let layer=1;c.model.traverse(m=>{if(m.isSkinnedMesh)layer=m.layers.mask;});
 clip.traverse(m=>{m.layers.mask=layer;});c.bones.Spine2.add(clip);
}
let issuedCamera;
function clipDepartmentCamera(c){
 if(!issuedCamera){
  issuedCamera=new THREE.Group();
  const shell=new THREE.MeshStandardMaterial({color:0x253037,roughness:.58});
  const rim=new THREE.MeshStandardMaterial({color:0x444e54,metalness:.35,roughness:.38});
  const glass=new THREE.MeshStandardMaterial({color:0x183d4d,metalness:.44,roughness:.15});
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.048,.068,.021),shell);housing.position.z=.012;
  const bezel=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.008,14),rim);bezel.rotation.x=Math.PI/2;bezel.position.set(0,.014,.025);
  const lens=new THREE.Mesh(new THREE.SphereGeometry(.011,12,8),glass);lens.scale.z=.35;lens.position.set(0,.014,.030);
  const switchBar=new THREE.Mesh(new THREE.BoxGeometry(.021,.004,.002),rim);switchBar.position.set(0,-.014,.024);
  issuedCamera.add(housing,bezel,lens,switchBar);
 }
 attachDepartmentClip(c,issuedCamera.clone(),-.057,.178);
}
function clipDepartmentCard(c,member){
 if(!departmentCards.has(member.personId)){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=166;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e5e5df';ctx.fillRect(0,0,256,166);ctx.fillStyle='#1b3442';ctx.fillRect(0,0,256,39);
  ctx.font='bold 22px sans-serif';ctx.fillStyle='#f1f1eb';ctx.fillText('OLD TOWN POLICE',11,28);
  ctx.fillStyle='#263b44';ctx.font='bold 35px sans-serif';ctx.fillText(member.name.split(' ').at(-1).toUpperCase(),10,79,237);
  ctx.font='20px sans-serif';ctx.fillText(member.division.toUpperCase(),11,109,230);
  ctx.fillStyle='#667276';ctx.fillRect(11,121,230,2);ctx.font='bold 19px monospace';ctx.fillText(String(member.badge),11,150);
  const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=4;
  const card=new THREE.Mesh(new THREE.PlaneGeometry(.079,.051),new THREE.MeshStandardMaterial({map:texture,roughness:.54}));
  const holder=new THREE.Group(),clip=new THREE.Mesh(new THREE.BoxGeometry(.016,.012,.006),gunMat);
  clip.position.set(0,.028,.008);card.position.z=.006;holder.add(card,clip);departmentCards.set(member.personId,holder);
 }
 attachDepartmentClip(c,departmentCards.get(member.personId).clone(),.090,.172);
}

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
 if(c.slung)c.slung.visible=c.aim<=0;
 if(c.gun){c.gun.visible=c.aim>0;if(c.gun.visible&&B.RightHand){B.RightHand.getWorldPosition(_hp);c.gun.position.copy(_hp).addScaledVector(_fw,.08);c.gun.rotation.set(0,yaw,0);}}}
function removeChar(c){
 scene.remove(c.root);
 if(c.gun)scene.remove(c.gun);
 if(c.portraitSkeleton?.boneTexture)c.portraitSkeleton.boneTexture.dispose();
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
