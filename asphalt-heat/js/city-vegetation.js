/* Every placement keeps its original trunk collision. Both Blender LODs share the same root and bearings. */
const CITY_FOREST={species:[],sectors:[],next:0};
function forestWind(material,palm){
 material.onBeforeCompile=sh=>{
  sh.uniforms.treeTime=WATERT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float treeTime;').replace(
   '#include <begin_vertex>',`#include <begin_vertex>
    vec3 az=instanceMatrix[3].xyz+modelMatrix[3].xyz;
    float sway=sin(treeTime*1.52+az.x*.071+az.z*.093+position.x*.61);
    float weight=smoothstep(${palm?'6.60,8.70':'2.80,5.85'},position.y);
    transformed.x+=sway*.062*weight;transformed.z+=sin(treeTime*2.48+az.x*.083+position.z*.95)*.035*weight;`);
 };
 material.customProgramCacheKey=()=>palm?'palm-wind':'sycamore-wind';
}
function forestPrototype(root,palm){
 const src=root.children[0],pieces=[],inverse=new THREE.Matrix4();
 src.updateWorldMatrix(true,true);inverse.copy(src.matrixWorld).invert();
 src.traverse(node=>{
  if(!node.isMesh)return;
  // Flatten Blender's hierarchy into the modelling origin, at the centre of the trunk's foot.
  const geo=node.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
  const mat=node.material.clone();
  const foliage=mat.alphaTest>0||mat.name.includes('palm leaf')||mat.name.includes('palm skirt');
  let depth=null;
  if(foliage){
   forestWind(mat,palm);
   depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
   forestWind(depth,palm);
  }
  pieces.push({geo,mat,depth});
 });
 return pieces;
}
function startForestSpecies(points,fallback,palm){
 CITY_FOREST.species.push({points,fallback,palm,ready:false,loading:false,retry:0});
}
function loadForestSpecies(species){
 const {palm,points}=species;
 const ids=palm?['coastal-date-palm','palm-distant']:['avenue-sycamore','sycamore-distant'];
 const requests=ids.map(requestScenery);
 if(requests.some(p=>!p))return;
 species.loading=true;
 Promise.all(requests).then(models=>{
  if(models.some(m=>!m)){species.retry=performance.now()+6000;return;}
  const prototypes=models.map(m=>forestPrototype(m,palm));
  const groups=new Map();
  for(const p of points){
   const sx=Math.floor(p[0]/64),sz=Math.floor(p[1]/64),key=sx+','+sz;
   if(!groups.has(key))groups.set(key,{x:sx*64+32,z:sz*64+32,items:[]});
   groups.get(key).items.push(p);
  }
  const placement=new THREE.Object3D(),shade=new THREE.Color();
  for(const {x,z,items} of groups.values()){
   const matrices=new THREE.InstancedBufferAttribute(new Float32Array(items.length*16),16);
   const colors=new THREE.InstancedBufferAttribute(new Float32Array(items.length*3),3);
   for(let i=0;i<items.length;i++){
    const [px,pz,scale]=items[i],v=Math.sin(px*7.513+pz*3.19);
    placement.position.set(px-x,groundY(px,pz),pz-z);
    placement.rotation.y=(px*.157+pz*.371)%6.283;
    placement.scale.set(scale*(1+.08*v),scale*(1-.065*v),scale*(1+.06*v));
    placement.updateMatrix();placement.matrix.toArray(matrices.array,i*16);
    shade.setRGB(.86+v*.055,.89+v*.052,.81+v*.055).toArray(colors.array,i*3);
   }
   const lods=prototypes.map(parts=>{
    const group=new THREE.Group();group.position.set(x,0,z);group.visible=false;
    for(const {geo,mat,depth} of parts){
     // In three r128 the geometry owns the instanced frustum bound. Share the GPU vertex buffers.
     const bounds=new THREE.BufferGeometry();
     for(const key of Object.keys(geo.attributes))bounds.setAttribute(key,geo.attributes[key]);
     bounds.setIndex(geo.index);bounds.boundingSphere=new THREE.Sphere(new V3(0,5,0),52);
     const mesh=new THREE.InstancedMesh(bounds,mat,items.length);
     mesh.instanceMatrix=matrices;mesh.instanceColor=colors;mesh.frustumCulled=true;
     mesh.receiveShadow=true;mesh.castShadow=true;if(depth)mesh.customDepthMaterial=depth;
     group.add(mesh);
    }
    scene.add(group);return group;
   });
   CITY_FOREST.sectors.push({x,z,lods,palm});
  }
  updateForestLOD(0,true);
  for(const old of species.fallback){if(old){scene.remove(old);old.geometry.dispose();}}
  species.ready=true;
 }).catch(error=>{species.retry=performance.now()+6000;console.warn('Tree scenery',error);}).finally(()=>{species.loading=false;});
}
function updateForestLOD(dt,immediate=false){
 if(!immediate&&(CITY_FOREST.next-=dt)>0)return;
 CITY_FOREST.next=.32;
 for(const sp of CITY_FOREST.species){
  if(!sp.ready&&!sp.loading&&performance.now()>sp.retry)loadForestSpecies(sp);
 }
 const pos=player?.pos||camera.position;
 for(const s of CITY_FOREST.sectors){
  const d=Math.hypot(Math.max(0,Math.abs(s.x-pos.x)-32),Math.max(0,Math.abs(s.z-pos.z)-32));
  const near=d<(QUALITY.level<2?27:48),visible=d<(QUALITY.level<2?350:555);
  s.lods[0].visible=near&&visible;s.lods[1].visible=!near&&visible;
  for(const mesh of s.lods[1].children)mesh.castShadow=d<83;
 }
}
