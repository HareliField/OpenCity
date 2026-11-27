// Check the game-ready assets and the independent animation pivots packed by Blender.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const game=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(game,file),'utf8');
const json=file=>JSON.parse(read(file));
const contracts=vm.createContext({});
for(const script of ['js/scenery-library.js','js/city-decorations.js'])vm.runInContext(read(script),contracts);
const {sceneryId,validateLibraryModel,validateDecorationIndex,validateDecorations}=contracts;
const scenery='models/scenery/';
const library=['City object library.json','Lighthouse Cove.json','District fittings.json','Garden cottages.json','Palm Street interiors.json','Civic and service fittings.json','Vehicle mechanical assemblies.json','Building and paving components.json','Domestic fittings.json','Beach furniture.json','Intermodal freight.json'].flatMap(file=>
 JSON.parse(fs.readFileSync(path.join(game,'..','Blender Sources',file))));
const catalog=json(scenery+'catalog.json');
const standalone=new Set();
for(const file of fs.readdirSync(path.join(game,scenery,'library')).filter(file=>file.endsWith('.json')).sort()){
 const id=path.basename(file,'.json');
 assert(sceneryId(id),'Invalid library model ID: '+id);
 assert(!Object.hasOwn(catalog,id),'Duplicate library and catalog model ID: '+id);
 try{
  validateLibraryModel(json(scenery+'library/'+file));
 }catch(error){
  throw Error(file+': '+error.message);
 }
 const bin=fs.readFileSync(path.join(game,scenery,id+'.glb'));
 assert(bin.length>=20&&bin.toString('ascii',0,4)==='glTF'&&bin.readUInt32LE(4)===2,id+' must be a GLB 2.0 export');
 assert.equal(bin.readUInt32LE(8),bin.length,id+' GLB length');
 const jsonEnd=20+bin.readUInt32LE(12);
 assert(jsonEnd<=bin.length&&bin.toString('ascii',16,20)==='JSON',id+' GLB JSON chunk');
 const doc=JSON.parse(bin.toString('utf8',20,jsonEnd));
 assert.equal(doc.asset?.version,'2.0',id+' glTF version');
 assert(doc.scenes?.[doc.scene??0]?.nodes?.length&&doc.meshes?.length,id+' needs a scene with geometry');
 assert(!doc.nodes?.some(node=>node.skin!==undefined),id+' needs a static mesh without a skin');
 for(const resource of [...(doc.buffers||[]),...(doc.images||[])]){
  assert(!resource.uri,id+' must embed buffers and images in the GLB');
 }
 const decoders=['KHR_draco_mesh_compression','KHR_texture_basisu','EXT_meshopt_compression'];
 assert(!doc.extensionsRequired?.some(ext=>decoders.includes(ext)),id+' needs an export that loads without additional decoders');
 standalone.add(id);
}

const decorationRoot='world/decorations/';
const sites=validateDecorationIndex(json(decorationRoot+'index.json'));
const siteFiles=fs.readdirSync(path.join(game,decorationRoot)).filter(file=>file.endsWith('.json')&&file!=='index.json');
assert.deepEqual(siteFiles.sort(),sites.map(site=>site+'.json').sort(),'Every decoration file needs an index entry');
let decorationCount=0;
for(const site of sites){
 try{
  for(const row of validateDecorations(json(decorationRoot+site+'.json'))){
   assert(standalone.has(row.model)||Object.hasOwn(catalog,row.model),row.id+' refers to unknown model '+row.model);
   decorationCount++;
  }
 }catch(error){
  throw Error(site+'.json: '+error.message);
 }
}
console.log('Validated',standalone.size,'standalone models and',decorationCount,'placements across',sites.length,'sites.');

let triangles=0,bytes=0;
for(const asset of library){
 const file=standalone.has(asset.id)?asset.id+'.glb':catalog[asset.id].file;
 const bin=fs.readFileSync(path.join(game,scenery,file));
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
