/* Exercise actual shipped glTF geometry, retargeting, captured motion and swept contact. */
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { pathToFileURL, fileURLToPath } = require('node:url');
const dir = path.resolve(__dirname, '..'),
  THREE = require(path.join(dir, 'lib/three.min.js'));
const base = pathToFileURL(dir + path.sep).href;
function url(link, prefix) {
  return new URL(link, prefix || base);
}
function bytes(link) {
  return link.protocol === 'data:'
    ? Buffer.from(link.href.slice(link.href.indexOf(',') + 1), 'base64')
    : fs.readFileSync(fileURLToPath(link));
}
THREE.FileLoader.prototype.load = function (link, onload, progress, onerror) {
  const target = url(link, this.path);
  queueMicrotask(() => {
    try {
      const b = bytes(target);
      onload(
        this.responseType === 'arraybuffer'
          ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
          : b.toString()
      );
    } catch (e) {
      onerror(e);
    }
  });
};
THREE.TextureLoader.prototype.load = function (link, onload, progress, onerror) {
  const texture = new THREE.Texture(),
    target = url(link, this.path);
  queueMicrotask(() => {
    try {
      assert(bytes(target).length);
      onload(texture);
    } catch (e) {
      onerror(e);
    }
  });
  return texture;
};
const ctx = vm.createContext({
  THREE,
  console,
  URL,
  Blob,
  assert,
  TextDecoder,
  window: {},
  navigator: { userAgent: 'node' },
  document: { baseURI: base },
  fetch: async (target) => {
    const b = bytes(url(target));
    return {
      ok: true,
      json: async () => JSON.parse(b.toString()),
      arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    };
  }
});
ctx.self = ctx;
function run(code) {
  return vm.runInContext(code, ctx);
}
function file(name) {
  run(fs.readFileSync(path.join(dir, name), 'utf8'));
}
file('lib/GLTFLoader.js');
file('lib/SkeletonUtils.js');
run(
  'const V3=THREE.Vector3,CV=THREE.Vector3,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),PoliceDepartment={cases:[],identify(){}},peds=[],cops=[],gang=[],guards=[],departmentPeople=[],player={pos:new V3(),car:null}; let time=0;const streetPedReserved=()=>false;'
);
file('js/chars.js');
for (const name of [
  'resident-assets',
  'resident-motion',
  'resident-rig',
  'resident-cast',
  'resident-contact'
])
  file('js/' + name + '.js');
(async () => {
  await run('Promise.all([ResidentCast.load(),ResidentMotion.load()])');
  assert.equal(run("ResidentCast.search('').length"), 1500);
  assert.equal(run("ResidentCast.get('AH-R0031').personId"), 'ah-pd-101');
  assert.equal(run("ResidentCast.get('ah-pd-114').name"), 'Ada Flynn');
  assert.equal(run('ResidentMotion.names().length'), 22);
  ctx.template = await run("ResidentAssets.load(ResidentCast.get('AH-R0002').url)");
  ctx.driver = await run(
    "new THREE.GLTFLoader().loadAsync(new URL('models/Male_Adult_07.json',document.baseURI).href)"
  );
  run(`
 TPL.test={scene:driver.scene};const actor={pos:new V3(),dead:false,mode:'stand'};
 const c={root:new THREE.Group(),name:'test',model:THREE.SkeletonUtils.clone(driver.scene),talk:0,bones:{}};actor.c=c;
 c.root.add(c.model);ResidentCast.bind(c,'AH-R0002');peds.push(actor);
 const installed=ResidentRig.install(c,template,false);
 const anatomy=installed.bones;assert(anatomy.head&&anatomy.thumb_03_l&&anatomy.pinky_03_r);
 const begin=anatomy.lowerarm_l.getWorldQuaternion(new THREE.Quaternion());
 nodeMap(c.model).Bip01_L_Forearm.rotateX(.30);installed.update(.02);
 assert(begin.angleTo(anatomy.lowerarm_l.getWorldQuaternion(new THREE.Quaternion()))>.20);
 assert(ResidentMotion.play(c,'get_up'));
 installed.update(0);const low=anatomy.pelvis.getWorldPosition(new V3()).y;
 c.residentTake.elapsed=ResidentMotion.duration('get_up')-.012;installed.update(0);
 const high=anatomy.pelvis.getWorldPosition(new V3()).y;assert(high>low+.35,'Fitted pelvis rises from floor to standing');
 delete c.residentTake;installed.update(.02);
 for(const [x,z] of [[0,1],[1,0],[0,-1],[-1,0]]){
  const p=new V3(-2*x,0,-2*z);time++;
  const hit=ResidentContact.push(p,.36,0,{startX:2*x,startZ:2*z});
  assert(hit&&p.x*x+p.z*z>=.57,'Standing resident must stop an approach from every side');
 }
 const upstairs=new V3(0,4,-2);
 assert.equal(ResidentContact.push(upstairs,.36,4,{startX:0,startZ:2}),null);
 const assigned=new Set();for(let i=0;i<80;i++){const p={c:{}};const r=ResidentCast.assign(p,'midtown');assert(r&&!assigned.has(r.personId)&&r.personId!=='AH-R0001');assigned.add(r.personId);ResidentCast.unbind(p.c);}
 installed.dispose();ResidentCast.unbind(c);assert(!c.resident);
 `);
  ctx.template.dispose();
  assert.equal(run('ResidentAssets.resourceCount()'), 0);
  console.log(
    '1,500 searchable residents, department identities, 22 motion captures, arm and finger bindings, floor recovery, four-sided collision and resource release passed.'
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
