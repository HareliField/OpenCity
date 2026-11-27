// Check the game-ready assets and the independent animation pivots packed by Blender.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const game=path.resolve(__dirname,'..');
const library=['City object library.json','Lighthouse Cove.json','District fittings.json','Garden cottages.json','Palm Street interiors.json','Civic and service fittings.json','Vehicle mechanical assemblies.json','Building and paving components.json','Domestic fittings.json','Beach furniture.json','Intermodal freight.json'].flatMap(file=>
 JSON.parse(fs.readFileSync(path.join(game,'..','Blender Sources',file))));
const catalog=JSON.parse(fs.readFileSync(path.join(game,'models/scenery/catalog.json')));
let triangles=0,bytes=0;
for(const asset of library){
 const bin=fs.readFileSync(path.join(game,'models/scenery',catalog[asset.id].file));
 assert.equal(bin.readUInt32LE(8),bin.length,asset.id);
 assert.equal(bin.length,asset.runtimeBytes,asset.id);
 const doc=JSON.parse(bin.toString('utf8',20,20+bin.readUInt32LE(12)));
 assert.equal(doc.asset.version,'2.0');
 for(const name of ['Frame',...asset.movableParts]){
  const n=doc.nodes.find(n=>n.name===name);
  assert(n&&Number.isInteger(n.mesh),asset.id+' / '+name);
  if(name==='WheelPrototype')assert.deepEqual(n.translation||[0,0,0],[0,0,0],'wheel is centred on the axle');
  else if(name!=='Frame')assert(n.translation?.every(Number.isFinite),name+' needs its local pivot');
 }
 for(const mesh of doc.meshes)for(const prim of mesh.primitives){
  const p=doc.accessors[prim.attributes.POSITION];
  assert([...p.min,...p.max].every(Number.isFinite));
  assert(prim.attributes.NORMAL!==undefined&&prim.attributes.TEXCOORD_0!==undefined,asset.id);
  triangles+=doc.accessors[prim.indices].count/3;
 }
 if(asset.id.includes('sycamore')||asset.id==='palm-distant'){
  assert(doc.materials.some(m=>m.alphaMode==='MASK'&&m.doubleSided),asset.id+' has a cutout canopy');
 }else if(asset.id!=='coastal-date-palm'){
  assert(doc.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined)),asset.id+' retains baked contacts');
 }
 bytes+=bin.length;
}
console.log('Validated',library.length,'Blender exports,',triangles,'triangles and',bytes,'bytes.');
const manifest=JSON.parse(fs.readFileSync(path.join(game,'..','Meshy Sources','Asset Manifest.json')));
for(const asset of Object.values(manifest.assets)){
 const files=[[asset.runtime_file,asset.runtime_sha256],...(asset.variants||[]).map(v=>[v.file,v.runtime_sha256])];
 for(const [file,expected] of files){
  if(!expected)continue;
  const contents=fs.readFileSync(path.join(game,'models','scenery',file));
  assert.equal(createHash('sha256').update(contents).digest('hex'),expected,file+' must match its runtime receipt');
 }
}
