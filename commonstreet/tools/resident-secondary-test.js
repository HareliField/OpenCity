// Check deformation while the resident turns, bends her elbows and stands still.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const THREE = require('../lib/three.min.js');
const game = path.resolve(__dirname,'..');
const context = vm.createContext({THREE});
vm.runInContext(fs.readFileSync(path.join(game,'js/resident-secondary.js'),'utf8'),context);

const model = new THREE.Group();
const bones = {};
function joint(name, parent, x, y, z) {
 const bone = new THREE.Bone();
 bone.position.set(x,y,z); parent.add(bone); bones[name]=bone;
 return bone;
}
const pelvis = joint('pelvis',model,0,.95,0);
const spine = joint('spine_03',pelvis,0,.4,0);
const head = joint('head',spine,0,.33,0);
for (const [side,sign] of [['l',1],['r',-1]]) {
 const upper = joint('upperarm_'+side,spine,sign*.19,.12,0);
 const lower = joint('lowerarm_'+side,upper,sign*.24,0,0);
 joint('hand_'+side,lower,sign*.23,0,0);
}
function surface(names) {
 const obj = new THREE.Object3D();
 obj.morphTargetDictionary=Object.fromEntries(names.map((n,i)=>[n,i]));
 obj.morphTargetInfluences=names.map(()=>0); model.add(obj);
 return obj.morphTargetInfluences;
}
const groom=surface(['Groom side','Groom drag']);
const hood=surface(['Hood side','Hood drag']);
const jacket=surface(['Hem side','Hem drag','Sleeve fold l','Sleeve fold r']);
model.updateMatrixWorld(true);
const motion=context.ResidentSecondary.bind(model,bones);
function tick(n) { for(let i=0;i<n;i++){model.updateMatrixWorld(true);motion.update(1/60);} }
tick(30);
assert([...groom,...hood,...jacket].every(w=>Math.abs(w)<.000001),'neutral bind must stay still');
head.rotation.y=.22;tick(1);
assert(Math.abs(groom[0])>.3,'loose hair trails head turns');
assert(hood.every(w=>w===0),'head turn does not move the jacket hood');
bones.lowerarm_l.rotation.z=1.25;tick(1);
assert(jacket[2]>.55 && jacket[3]===0,'sleeve folds on the bending elbow');
model.position.z+=.025;tick(1);
assert(Math.abs(hood[1])>.3 && Math.abs(jacket[1])>.3,'hood and hem respond to torso acceleration');
tick(120);
assert([...groom,...hood,...jacket.slice(0,2)].every(w=>Math.abs(w)<.0001),'all springs settle at rest');
model.position.x+=6;tick(1);
assert([...groom,...hood,...jacket.slice(0,2)].every(w=>Math.abs(w)<.0001),'teleport resets the follower');
console.log('Hair, hood and hem follow their anchors, elbows crease independently, and all spring offsets settle.');
