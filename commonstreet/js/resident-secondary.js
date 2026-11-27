/* Follow animated joints with anchored hair and garment shapes from the resident factory. */
globalThis.ResidentSecondary = (() => {
 class Spring {
  constructor(model, bone, offset, frequency, reach) {
   this.bone = bone;
   this.frequency = frequency;
   this.reach = reach;
   this.marker = offset.clone();
   this.rotation = new THREE.Quaternion();
   this.rest = new THREE.Quaternion();
   const modelRotation = model.getWorldQuaternion(new THREE.Quaternion());
   bone.getWorldQuaternion(this.rest);
   this.marker.applyQuaternion(modelRotation).applyQuaternion(this.rest.clone().invert());
   this.rest.premultiply(modelRotation.invert());
   this.point = new THREE.Vector3();
   this.anchor = new THREE.Vector3();
   this.previous = new THREE.Vector3();
   this.velocity = new THREE.Vector3();
   this.lag = new THREE.Vector3();
   this.reset();
  }
  reset() {
   this.anchor.copy(this.marker);
   this.bone.localToWorld(this.anchor);
   this.previous.copy(this.anchor);
   this.point.copy(this.anchor);
   this.velocity.set(0,0,0);
   this.lag.set(0,0,0);
  }
  step(dt) {
   this.anchor.copy(this.marker);
   this.bone.localToWorld(this.anchor);
   if(dt <= 0 || dt > .12 || this.previous.distanceToSquared(this.anchor) > .16) {
    this.reset();
    return this.lag;
   }
   // Per-axis analytic solution for a critically damped follower under a moving
   // anchor. Partial air drag creates a small trailing offset at walking speed.
   const omega = this.frequency;
   const decay = Math.exp(-omega * dt);
   for(const axis of ['x','y','z']) {
    const speed = (this.anchor[axis] - this.previous[axis]) / dt;
    const equilibrium = -.30 * speed / omega;
    const offset = this.point[axis] - this.previous[axis] - equilibrium;
    const relative = this.velocity[axis] - speed;
    const coefficient = relative + omega * offset;
    this.point[axis] = this.anchor[axis] + equilibrium + (offset + coefficient * dt) * decay;
    this.velocity[axis] = speed + (relative - omega * coefficient * dt) * decay;
   }
   this.previous.copy(this.anchor);
   this.lag.copy(this.point).sub(this.anchor);
   this.lag.clampLength(0,this.reach);
   this.point.copy(this.anchor).add(this.lag);
   this.bone.getWorldQuaternion(this.rotation);
   this.lag.applyQuaternion(this.rotation.invert()).applyQuaternion(this.rest);
   return this.lag.divideScalar(this.reach);
  }
 }

 function bind(model, bones) {
  const groups = {Groom:[], Hood:[], Hem:[]};
  const sleeves = {l:[], r:[]};
  model.traverse(mesh => {
   const keys = mesh.morphTargetDictionary;
   if(!keys) return;
   for(const name of Object.keys(groups)) {
    if(keys[name+' side'] !== undefined && keys[name+' drag'] !== undefined) {
     groups[name].push({weights:mesh.morphTargetInfluences, side:keys[name+' side'], drag:keys[name+' drag']});
    }
   }
   for(const side of ['l','r']) {
    const index = keys['Sleeve fold '+side];
    if(index !== undefined) sleeves[side].push({weights:mesh.morphTargetInfluences,index});
   }
  });
  const followers = [];
  function follow(group, joint, offset, frequency, reach) {
   if(groups[group].length && bones[joint]) {
    followers.push({targets:groups[group], spring:new Spring(model,bones[joint],offset,frequency,reach)});
   }
  }
  follow('Groom','head',new THREE.Vector3(.03,.045,.12),14,.024);
  follow('Hood','spine_03',new THREE.Vector3(0,.18,-.11),17,.017);
  follow('Hem','pelvis',new THREE.Vector3(0,-.075,.09),20,.012);
  const elbow = new THREE.Vector3(), upper = new THREE.Vector3(), lower = new THREE.Vector3();
  return {update(dt) {
   for(const {targets,spring} of followers) {
    const lag = spring.step(dt);
    for(const t of targets) {
     t.weights[t.side] = lag.x;
     t.weights[t.drag] = -lag.z;
    }
   }
   for(const side of ['l','r']) {
    if(!sleeves[side].length) continue;
    bones['lowerarm_'+side].getWorldPosition(elbow);
    bones['upperarm_'+side].getWorldPosition(upper);
    bones['hand_'+side].getWorldPosition(lower);
    upper.subVectors(elbow,upper).normalize();
    lower.sub(elbow).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(upper.dot(lower),-1,1));
    const crease = THREE.MathUtils.smoothstep(angle,.25,1.8);
    for(const t of sleeves[side]) t.weights[t.index] = crease;
   }
  }};
 }
 return {bind};
})();
