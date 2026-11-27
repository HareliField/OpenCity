/* Declared scenery placements use the renderer without creating game entities. */
const DECORATION_ROOT='world/decorations/';

function validateDecorationIndex(sites){
 if(!Array.isArray(sites)||!sites.every(sceneryId)||new Set(sites).size!==sites.length){
  throw Error('Expected a list of unique site IDs');
 }
 return sites;
}

function validateDecorations(placements){
 if(!Array.isArray(placements))throw Error('Expected an array of placements');
 const ids=new Set();
 for(const row of placements){
  if(!row||!sceneryId(row.id)||ids.has(row.id))throw Error('Missing, invalid or duplicate placement ID: '+row?.id);
  ids.add(row.id);
  const fail=message=>{throw Error(row.id+': '+message);};
  for(const key of Object.keys(row)){
   if(!['id','model','position','size','yaw'].includes(key))fail('Unknown placement field: '+key);
  }
  if(!sceneryId(row.model))fail('Invalid model ID');
  if(!Array.isArray(row.position)||row.position.length!==3||!row.position.every(Number.isFinite)){
   fail('Position must contain three finite coordinates');
  }
  if(!Array.isArray(row.size)||row.size.length!==3||!row.size.every(n=>Number.isFinite(n)&&n>0)){
   fail('Size must contain three positive dimensions');
  }
  if(row.yaw!==undefined&&!Number.isFinite(row.yaw))fail('Yaw must be finite');
 }
 return placements;
}

async function loadDecorations(){
 const read=async (name,validate)=>{
  try{
   const response=await fetch(DECORATION_ROOT+name+'.json');
   if(!response.ok)throw Error('HTTP '+response.status);
   return validate(await response.json());
  }catch(error){
   console.warn('Decorations '+name,error);
   return [];
  }
 };
 const sites=await read('index',validateDecorationIndex);
 const placements=await Promise.all(sites.map(site=>read(site,validateDecorations)));
 return placements.flat();
}

function installDecorations(placements){
 for(const {model,position:[x,y,z],size,yaw=0} of placements){
  registerOutdoorModel(model,x,y,z,yaw,size,detailFallback(model,x,y,z,size,yaw));
 }
}
