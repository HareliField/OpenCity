import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,simplify,quantize} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import fs from 'fs';
const [,, name, ratio, out] = process.argv;
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(`/home/claude/rb/out/${name}.glb`);
for(const t of doc.getRoot().listTextures()) t.dispose();
const r=parseFloat(ratio);
const tf=[dedup({propertyTypes:['Accessor','Mesh']}),weld()];
if(r<1)tf.push(simplify({simplifier:MeshoptSimplifier,ratio:r,error:0.004,lockBorder:false}));
tf.push(prune({keepAttributes:true}),quantize({quantizePosition:14,quantizeNormal:8,quantizeTexcoord:12,quantizeWeight:8}));
await doc.transform(...tf);
const j=await io.writeJSON(doc);
const bins=Object.values(j.resources);
if(bins.length!==1)throw new Error('expected 1 buffer');
j.json.buffers[0].uri='data:application/octet-stream;base64,'+Buffer.from(bins[0]).toString('base64');
const info=JSON.parse(fs.readFileSync(`/home/claude/rb/out/${name}.info`));
const J=j.json;J.images=[];J.textures=[];J.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
let tris=0;for(const m of J.meshes)for(const p of m.primitives)tris+=J.accessors[p.indices].count/3;
for(const m of J.materials){const kind=m.name.split('_').pop();const t=info.tex[kind];delete m.normalTexture;m.pbrMetallicRoughness={metallicFactor:0,roughnessFactor:kind==='head'?0.62:0.85};
 if(t){J.images.push({uri:'ctex/'+t+'.webp'});J.textures.push({source:J.images.length-1,sampler:0});m.pbrMetallicRoughness.baseColorTexture={index:J.textures.length-1};}
 if(kind==='opacity'){m.alphaMode='MASK';m.alphaCutoff=0.45;m.doubleSided=true;}else{m.alphaMode='OPAQUE';}}
fs.writeFileSync(out,JSON.stringify(J));
console.log(name,'tris',tris,'bytes',fs.statSync(out).size,'mats',J.materials.map(m=>m.name).join(','));
