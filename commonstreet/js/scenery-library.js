/* Artwork lookup and shared GLB templates, independent of the scene and simulation. */
const SCENERY_ROOT='models/scenery/';
const sceneryCatalog=Object.create(null);
const sceneryModels=new Map(),sceneryRetries=new Map();
let sceneryCatalogReady;

function sceneryId(id){
 return typeof id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

function validateLibraryModel(record){
 if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Expected a model record');
 const fields=['title','source','credit','redistribution','yaw','anchor','heightScale'];
 for(const key of Object.keys(record))if(!fields.includes(key))throw Error('Unknown model field: '+key);
 for(const key of fields.slice(0,4)){
  if(typeof record[key]!=='string'||!record[key].trim())throw Error('Required model field: '+key);
 }
 if(record.yaw!==undefined&&!Number.isFinite(record.yaw))throw Error('Yaw must be finite');
 if(record.anchor!==undefined&&(!Array.isArray(record.anchor)||record.anchor.length!==2||
   !record.anchor.every(Number.isFinite)))throw Error('Anchor must contain two finite values');
 if(record.heightScale!==undefined&&(!Number.isFinite(record.heightScale)||record.heightScale<=0)){
  throw Error('Height scale must be positive and finite');
 }
 return record;
}

function loadSceneryCatalog(){
 sceneryCatalogReady??=fetch(SCENERY_ROOT+'catalog.json').then(response=>{
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
 }).then(catalog=>Object.assign(sceneryCatalog,catalog)).catch(error=>console.warn('Scenery catalog',error));
 return sceneryCatalogReady;
}

function legacySceneryURL(id){
 const file=sceneryCatalog[id]?.file;
 return file?SCENERY_ROOT+file:null;
}

async function readSceneryRecord(id){
 await loadSceneryCatalog();
 const url=legacySceneryURL(id);
 if(url)return {...sceneryCatalog[id],url};
 const response=await fetch(SCENERY_ROOT+'library/'+id+'.json');
 if(response.status===404)return null;
 if(!response.ok)throw Error('HTTP '+response.status);
 return {...validateLibraryModel(await response.json()),url:SCENERY_ROOT+id+'.glb'};
}

function requestScenery(id){
 if(!sceneryId(id)||sceneryRetries.get(id)>performance.now())return null;
 if(!sceneryModels.has(id)){
  const model=readSceneryRecord(id).then(async record=>{
   if(!record)return null;
   const gltf=await new THREE.GLTFLoader().loadAsync(record.url);
   const model=gltf.scene;
   model.rotation.y=record.yaw||0;
   model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model);
   const center=bounds.getCenter(new THREE.Vector3());
   const size=bounds.getSize(new THREE.Vector3()).toArray();
   if(!size.every(value=>Number.isFinite(value)&&value>.001))throw Error('Model has invalid dimensions');
   const root=new THREE.Group();
   root.add(model);
   const [ax,az]=record.anchor||[0,0];
   model.position.set(-center.x+ax*size[0],-bounds.min.y,-center.z+az*size[2]);
   model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.receiveShadow=true;
    const materials=[mesh.material].flat();
    mesh.castShadow=materials.some(material=>!material.transparent);
    for(const material of materials)material.envMapIntensity=.76;
   });
   root.userData.dimensions=size;
   root.userData.heightScale=record.heightScale||1;
   return root;
  }).catch(error=>{
   sceneryModels.delete(id);
   sceneryRetries.set(id,performance.now()+10000);
   console.warn('Scenery '+id,error);
   return null;
  });
  sceneryModels.set(id,model);
 }
 return sceneryModels.get(id);
}

function modelInstance(template,dims){
 const node=template.clone(true);
 const size=template.userData.dimensions;
 node.scale.set(dims[0]/size[0],dims[1]/size[1]*template.userData.heightScale,dims[2]/size[2]);
 return node;
}
