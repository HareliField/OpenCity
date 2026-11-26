/* Sectioned car bodies. Window openings and panel hinges use the actual model's local coordinates. */
const FLEET_SECTIONS=new Map();
const OPEN_FREIGHT_BEDS=new Set();
const autoGlass=new THREE.MeshStandardMaterial({color:0xa1b5b9,roughness:.10,metalness:.19,
 transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:1.12});
const glassCrackMaterial=new THREE.LineBasicMaterial({color:0xc7d4cf,transparent:true,opacity:.70,depthWrite:false});
const VEHICLE_GLASS=['Windshield','RearGlass','GlassFrontL','GlassFrontR','GlassRearL','GlassRearR'];
const VEHICLE_DOORS=['DoorFrontL','DoorFrontR','DoorRearL','DoorRearR'];

function splitFleetGeometry(type){
 if(FLEET_SECTIONS.has(type))return FLEET_SECTIONS.get(type);
 const G=carGeo(type),{geo,s,pr,zg0,zg1,zg2,zg3,zB}=G,P=geo.attributes.position,I=geo.index.array;
 const groups=new Map(),rearEngine=type==='nineeleven',roadster=s.form==='roadster',width=s.W/2,h=s.L/2;
 function part(m,x,y,z){
  const side=x<0?'L':'R',forward=z>zB;
  if(m===1&&Math.abs(x)<width*1.017){
   if(roadster)return 'Windshield';
   if(z>zg2+.013&&Math.abs(x)<pr.sect(z).pts[3][0]*.983)return 'Windshield';
   if(z<zg1-.025&&Math.abs(x)<pr.sect(z).pts[3][0]*.981)return 'RearGlass';
   return 'Glass'+(forward?'Front':'Rear')+side;
  }
  if(m===0&&Math.abs(x)<width*.84&&y>pr.top(z)-.074){
   if(rearEngine?z<zg0-.012&&z>-h+.19:z>zg3+.025&&z<h-.14)return 'Bonnet';
  }
  if((m===0||m===2)&&Math.abs(x)>width*.709&&y>s.gc+.15&&y<s.r-.047){
   const lower=y<s.hb+.06,back=zg0+.13,front=zg3-.12;
   if(z>back&&z<front&&(lower||Math.abs(x)>pr.sect(z).pts[3][0]*.992)){
    if(roadster||s.doors===2||type==='sport')return z>Math.max(back,front-1.41)?'DoorFront'+side:'Frame';
    if(z>zB+.025)return 'DoorFront'+side;
    if(z<zB-.025&&s.form!=='pickup'&&s.form!=='offroad'&&s.L-s.hood-s.tr>1.80)return 'DoorRear'+side;
   }
  }
  return 'Frame';
 }
 const bounds=new Map();
 for(const original of geo.groups){
  const m=original.materialIndex;
  for(let k=original.start;k<original.start+original.count;k+=3){
   const ids=[I[k],I[k+1],I[k+2]],cx=ids.reduce((v,i)=>v+P.getX(i),0)/3,
    cy=ids.reduce((v,i)=>v+P.getY(i),0)/3,cz=ids.reduce((v,i)=>v+P.getZ(i),0)/3,key=part(m,cx,cy,cz);
   if(!groups.has(key)){groups.set(key,Array.from({length:6},()=>[]));bounds.set(key,new THREE.Box3());}
   groups.get(key)[m].push(...ids);
   for(const i of ids)bounds.get(key).expandByPoint(new V3().fromBufferAttribute(P,i));
  }
 }
 const sections=new Map();
 for(const [name,faces] of groups){
  const g=new THREE.BufferGeometry();for(const [key,a] of Object.entries(geo.attributes))g.setAttribute(key,a);
  const all=[];faces.forEach((ids,mi)=>{if(ids.length)g.addGroup(all.length,ids.length,mi);for(const i of ids)all.push(i);});
  g.setIndex(all);g.boundingBox=bounds.get(name);g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
  sections.set(name,g);
 }
 FLEET_SECTIONS.set(type,sections);return sections;
}
function boundsInCar(car,node){
 car.mesh.updateWorldMatrix(true,true);
 const inverse=car.mesh.matrixWorld.clone().invert(),bounds=new THREE.Box3(),matrix=new THREE.Matrix4();
 node.traverse(o=>{
  if(!o.isMesh)return;
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  matrix.multiplyMatrices(inverse,o.matrixWorld);
  bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix));
 });
 return bounds;
}
function panelState(c,name){
 c.serviceState||={};
 return c.serviceState[name]||=( {phase:0,target:0,damage:0} );
}
function vehicleEngineKind(c){
 if(c.type==='nineeleven')return 'engine-boxer';
 if(c.type==='harborbox'||c.type==='van'||c.type==='swat'||c.type==='amb')return 'engine-diesel';
 if(['mustang','f150','police','sport','wrangler'].includes(c.type))return 'engine-v-bank';
 return 'engine-transverse';
}
function createVehicleAssembly(c,heroRoot=null){
 if(c.components)releaseVehicleComponents(c);
 c.serviceState||={};
 const section=new THREE.Group();c.mesh.add(section);
 const v={section,panes:new Map(),joints:new Map(),boards:[],near:true,hero:!!heroRoot,engine:null,cabin:null};
 c.components=v;
 let find;
 if(heroRoot)find=name=>heroRoot.getObjectByName(name);
 else{
  const sections=splitFleetGeometry(c.type);
  if(c.ownGeo){
   const damaged=c.body3.geometry,frame=sections.get('Frame').clone();
   frame.setAttribute('position',damaged.attributes.position.clone());
   frame.setAttribute('normal',damaged.attributes.normal.clone());damaged.dispose();c.body3.geometry=frame;
  }else c.body3.geometry=sections.get('Frame');
  for(const [name,g] of sections){
   if(name==='Frame')continue;
   const mesh=new THREE.Mesh(g,VEHICLE_GLASS.includes(name)?autoGlass:c.mats);
   mesh.name=name;mesh.castShadow=!VEHICLE_GLASS.includes(name);mesh.receiveShadow=true;section.add(mesh);
  }
  find=name=>section.getObjectByName(name);
 }
 // Collect all panes before reparenting the moving sheet metal. The hinge transform stays inside the chassis.
 const panes=VEHICLE_GLASS.map(name=>[name,find(name)]).filter(([,n])=>n);
 for(const name of ['Bonnet',...VEHICLE_DOORS]){
  const part=find(name);if(!part)continue;
  const bounds=boundsInCar(c,part),centre=bounds.getCenter(new V3()),rear=c.type==='nineeleven'&&name==='Bonnet';
  const pivot=name==='Bonnet'?new V3(centre.x,bounds.max.y,rear?bounds.max.z:bounds.min.z):
     new V3(name.endsWith('R')?bounds.max.x:bounds.min.x,centre.y,bounds.max.z-.012);
  const joint=new THREE.Group();section.add(joint);joint.position.copy(pivot);joint.updateWorldMatrix(true,true);joint.attach(part);
  const state=panelState(c,name),j={joint,part,pivot,bounds,centre,state,name,rear,angle:0,collision:null};
  part.traverse(o=>{if(o.isMesh)o.userData.servicePanel=true;});
  if(name.startsWith('Door')){
   const size=bounds.getSize(new V3()),trim=new THREE.Mesh(unitBox,darkMat),right=name.endsWith('R')?1:-1;
   trim.scale.set(.037,Math.min(.38,size.y*.57),size.z*.74);
   trim.position.set(centre.x-right*.034,bounds.min.y+trim.scale.y*.62,centre.z).sub(pivot);joint.add(trim);
  }
  v.joints.set(name,j);
 }
 for(const [name,node] of panes){
  const bounds=boundsInCar(c,node),owner=v.joints.get(name.replace('Glass','Door'));
  if(owner)owner.joint.attach(node);
  node.traverse(o=>{if(o.isMesh){o.userData.serviceGlass=true;o.castShadow=false;o.receiveShadow=false;
   if(heroRoot){o.material.transparent=true;o.material.depthWrite=false;o.material.side=THREE.DoubleSide;}}});
  const pane={node,bounds,centre:bounds.getCenter(new V3()),state:panelState(c,name),name,cracks:null};
  v.panes.set(name,pane);applyVehicleGlass(pane);
 }
 if(c.type==='harborbox'&&heroRoot){
  for(let i=0;i<11;i++){
   const node=find('CargoSlat'+String(i).padStart(2,'0'));if(!node)continue;
   v.boards.push({node,y:node.position.y,z:node.position.z});
  }
  v.shutter=panelState(c,'CargoShutter');
  v.stairs=new THREE.Group();v.section.add(v.stairs);
  for(let k=0;k<5;k++){
   const y=.211+k*.170,z=-4.52+k*.269,step=new THREE.Mesh(unitBox,MAT.metal);
   step.scale.set(.81,.043,.285);step.position.set(0,y-.021,z);v.stairs.add(step);
   for(const side of [-1,1]){
    const link=new THREE.Mesh(unitBox,MAT.darkMetal);link.scale.set(.032,.046,.33);
    link.rotation.x=-.56;link.position.set(side*.37,y-.096,z-.036);v.stairs.add(link);
   }
  }
 }
 updateVehicleAssembly(c,0);return v;
}
function loadMechanicalAssembly(c,v,key,id,at,dims){
 if(v[key]||v[key+'Loading'])return;
 const promise=requestScenery(id);if(!promise)return;
 v[key+'Loading']=true;
 promise.then(template=>{
  v[key+'Loading']=false;
  if(!template||c.components!==v)return;
  const node=modelInstance(template,dims,id);node.position.copy(at);v.section.add(node);v[key]=node;
  if(key==='engine'){v.fan=node.getObjectByName('CoolingFan');node.visible=(v.joints.get('Bonnet')?.state.phase||0)>.025;}
  else node.visible=v.near;
 });
}
function streamVehicleComponents(c,near){
 if(c.dead)return;
 if(!c.components&&near&&!c.heroWanted)createVehicleAssembly(c);
 const v=c.components;if(!v)return;v.near=near;
 if(!v.hero){
  const detailed=near||Object.values(c.serviceState).some(s=>s.phase>.001||s.damage);
  v.section.visible=detailed;
  if(!c.ownGeo)c.body3.geometry=detailed?splitFleetGeometry(c.type).get('Frame'):carGeo(c.type).geo;
 }
 if(v.cabin)v.cabin.visible=near;
 if(near&&c.spec.form!=='roadster'&&(c.type!=='harborbox'||!v.hero)){
  const s=c.spec,back=v.panes.get('RearGlass')?.centre.z??(-s.L/2+s.tr+.29),
   front=v.panes.get('Windshield')?.centre.z??(s.L/2-s.hood-.28),base=Math.max(s.gc+.023,.236);
  if(front>back+.55)loadMechanicalAssembly(c,v,'cabin','passenger-cabin',new V3(0,base,(front+back)*.5),
   [s.W*.855,s.r-base-.102,Math.min(s.L*.64,front-back+.40)]);
 }
 const hood=v.joints.get('Bonnet');
 if(hood&&near&&hood.state.target){
  const b=hood.bounds,span=b.getSize(new V3()),h=Math.min(.57,Math.max(.25,b.min.y-c.spec.gc-.085));
  loadMechanicalAssembly(c,v,'engine',vehicleEngineKind(c),new V3(hood.centre.x,b.min.y-.047-h,hood.centre.z),
   [Math.max(.56,span.x*.96),h,Math.max(.38,span.z*.97)]);
 }
}
function applyVehicleGlass(p){
 p.node.visible=p.state.damage<2;
 if(p.cracks)p.cracks.visible=p.state.damage===1;
}
function laminatedCracks(p,point){
 if(p.cracks)return;
 // Project fine branching fractures onto the curved windscreen so the laminated pane stays in its gasket.
 const source=[];p.node.traverse(o=>{if(o.isMesh)source.push(o);});if(!source.length)return;
 const b=p.bounds,span=b.getSize(new V3()),origin=p.centre.clone();
 origin.x=clamp(point.x,b.min.x+span.x*.14,b.max.x-span.x*.14);
 const ray=new THREE.Raycaster(),car=p.node;
 let root=car;while(root.parent&&!root.userData.vehicleCoordinates)root=root.parent;
 const transform=root.matrixWorld,inverse=p.node.matrixWorld.clone().invert();
 function project(x,z){
  const a=new V3(x,b.max.y+.35,z).applyMatrix4(transform),d=new V3(0,-1,0).transformDirection(transform);
  ray.set(a,d);const hit=ray.intersectObjects(source,false)[0];
  if(!hit)return null;
  return hit.point.clone().addScaledVector(d,-.003).applyMatrix4(inverse);
 }
 const verts=[];
 for(let i=0;i<14;i++){
  const angle=i*2.39996,rad=.12+.32*(.5+.5*Math.sin(i*5.12));
  let prev=project(origin.x,origin.z);
  for(let k=1;k<=7;k++){
   const t=k/7,x=origin.x+rad*t*Math.cos(angle)+.008*Math.sin(k*13+i),
    z=origin.z+rad*t*Math.sin(angle)*.71,next=project(x,z);
   if(prev&&next){verts.push(...prev.toArray(),...next.toArray());
    if(k===3||k===5){const branch=project(x+.066*Math.cos(angle+.71),z+.047*Math.sin(angle+.71));
     if(branch)verts.push(...next.toArray(),...branch.toArray());}}
   prev=next;
  }
 }
 if(!verts.length)return;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 p.cracks=new THREE.LineSegments(g,glassCrackMaterial);p.cracks.renderOrder=5;p.node.add(p.cracks);
}
function impactVehicleGlass(c,point,speed){
 const v=c.components;if(!v||speed<5.2)return false;
 let hit=null,dist=Infinity;
 for(const p of v.panes.values()){
  if(p.state.damage>=2)continue;
  const d=p.bounds.distanceToPoint(point);
  if(d<dist){dist=d;hit=p;}
 }
 const broadFront=speed>15&&Math.abs(point.x)<c.spec.W*.48&&point.z>c.spec.L*.34;
 if(broadFront){hit=v.panes.get('Windshield');if(!hit)return false;}
 else if(!hit||dist>.24+Math.min(speed*.013,.19))return false;
 const laminated=hit.name==='Windshield';
 if(laminated&&hit.state.damage===1)return false;
 hit.state.damage=laminated?1:2;
 if(laminated)laminatedCracks(hit,point);
 else{
  const at=hit.centre.clone().applyMatrix4(c.mesh.matrixWorld);
  for(let i=0;i<10;i++)emit(at.x,at.y,at.z,c.vel.x*.36+Math.sin(i*4.67)*1.3,
   .35+(i%3)*.37,c.vel.z*.36+Math.cos(i*3.76)*1.2,.5,.024,.25,0xadbdb9,false,2);
 }
 applyVehicleGlass(hit);
 globalThis.asphaltAgentEvent?.('vehicle-glass',{vehicle:c.plate,pane:hit.name,condition:laminated?'cracked':'shattered'});
 return true;
}
function panelCollider(c,j,centre,size,rot,enabled){
 if(!c.body)return;
 const b=c.body;
 if(!enabled){if(j.collision){b.removeShape(j.collision);j.collision=null;}return;}
 if(!j.collision){j.collision=new CANNON.Box(new CV(size.x/2,size.y/2,size.z/2));b.addShape(j.collision);}
 const i=b.shapes.indexOf(j.collision),offset=b.shapeOffsets[i],q=b.shapeOrientations[i];
 // Render +Z maps to physic -X. Chassis COM is above the model origin.
 offset.set(-centre.z,centre.y-c.spec.com,centre.x);
 const orient=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),-Math.PI/2).multiply(rot);
 q.set(orient.x,orient.y,orient.z,orient.w);b.aabbNeedsUpdate=true;b.updateBoundingRadius();
}
function updateVehicleAssembly(c,dt){
 const v=c.components;if(!v)return;
 for(const j of v.joints.values()){
  const s=j.state;if(Math.abs(c.speed)>1.45)s.target=0;
  const old=s.phase;s.phase+=clamp(s.target-s.phase,-dt*2.4,dt*2.4);
  if(old===s.phase&&j.synced&&(!s.phase||!c.body||j.collision))continue;
  j.synced=true;const travel=s.phase*s.phase*(3-2*s.phase);
  if(j.name==='Bonnet')j.joint.rotation.x=travel*(j.rear?1.13:-1.13);
  else j.joint.rotation.y=travel*(j.name.endsWith('R')?-1.04:1.04);
  const size=j.bounds.getSize(new V3());
  if(j.name==='Bonnet')size.y=.038;else size.x=.073;
  const centre=j.centre.clone().sub(j.pivot).applyQuaternion(j.joint.quaternion).add(j.pivot);
  panelCollider(c,j,centre,size,j.joint.quaternion,s.phase>.024);
 }
 if(v.shutter){
  const s=v.shutter;if(Math.abs(c.speed)>1.45)s.target=0;
  const old=s.phase,occupied=s.phase>.45&&!s.target&&truckThresholdOccupied(c,s.phase);
  if(!occupied)s.phase+=clamp(s.target-s.phase,-dt*.72,dt*.72);
  if(s.phase>.98){v.stairs.visible=true;OPEN_FREIGHT_BEDS.add(c);}else{v.stairs.visible=false;OPEN_FREIGHT_BEDS.delete(c);}
  if(old!==s.phase||c.body&&!v.gateSynced){updateCargoGate(c,s.phase);v.gateSynced=!!c.body;}
  const ceiling=2.955,corner=.138,arc=corner*Math.PI/2;
  for(const slat of v.boards){
   const dist=slat.y+s.phase*1.98-ceiling;
   if(dist<=0){slat.node.position.y=slat.y+s.phase*1.98;slat.node.position.z=slat.z;slat.node.rotation.x=0;}
   else{const a=Math.min(Math.PI/2,dist/corner);
    slat.node.position.y=ceiling+corner*Math.sin(a);slat.node.position.z=slat.z+corner*(1-Math.cos(a))+Math.max(0,dist-arc);
    slat.node.rotation.x=a;}
  }
 }
 if(v.engine){v.engine.visible=!!v.near&&(v.joints.get('Bonnet')?.state.phase||0)>.025;
  if(v.fan&&v.engine.visible&&c.driver&&!c.dead)v.fan.rotation.z+=dt*18;}
}
function vehicleServiceAction(c,pos){
 const v=c.components;if(!v||c.driver||c.dead||Math.abs(c.speed)>.45)return null;
 c.mesh.updateWorldMatrix(true,false);const local=c.mesh.worldToLocal(pos.clone());
 const hood=v.joints.get('Bonnet'),front=c.spec.L/2,side=Math.abs(local.x);
 if(hood&&side<c.spec.W*.47&&Math.abs(local.z-(hood.rear?-front:front))<1.20){
  const s=hood.state,lid=hood.rear?'ENGINE LID':'BONNET';
  return {label:(s.target?'CLOSE ':'OPEN ')+lid,hot:true,fn:()=>{
   s.target=1-s.target;streamVehicleComponents(c,true);toast(s.target?'Engine bay open':'Engine bay latched',1000);
  }};
 }
 if(v.shutter&&side<c.spec.W*.50&&Math.abs(local.z+front)<1.18){
  return {label:(v.shutter.target?'CLOSE ':'OPEN ')+'CARGO SHUTTER',hot:true,fn:()=>{v.shutter.target=1-v.shutter.target;}};
 }
 // Keep the driver's approach and the middle of both flanks available to the normal entry action.
 if(side<c.spec.W*.46||side>c.spec.W*.5+1.37)return null;
 for(const [name,j] of v.joints){
  if(!name.startsWith('Door')||name==='DoorFrontL'||(local.x>0)!==name.endsWith('R'))continue;
  const reach=j.bounds.min.z+.17;
  if(Math.abs(local.z-reach)>.28||Math.abs(local.z)<.44)continue;
  const label=name.includes('Rear')?'REAR DOOR':'PASSENGER DOOR';
  return {label:(j.state.target?'CLOSE ':'OPEN ')+label,hot:true,fn:()=>{j.state.target=1-j.state.target;}};
 }
 return null;
}
function repairVehicleComponents(c){
 if(!c.serviceState)return;
 for(const s of Object.values(c.serviceState)){s.target=0;s.damage=0;}
 if(c.components)for(const p of c.components.panes.values())applyVehicleGlass(p);
}
function releaseVehicleComponents(c){
 const v=c.components;if(!v)return;OPEN_FREIGHT_BEDS.delete(c);
 for(const j of v.joints.values())if(j.collision&&c.body){c.body.removeShape(j.collision);j.collision=null;}
 for(const p of v.panes.values())if(p.cracks)p.cracks.geometry.dispose();
 // Imported sections stay in their source hierarchy for the vehicle's existing material cleanup.
 if(v.hero&&c.hero){
  for(const p of v.panes.values())c.hero.shell.attach(p.node);
  for(const j of v.joints.values())c.hero.shell.attach(j.part);
 }
 c.mesh.remove(v.section);c.components=null;
}

function updateCargoGate(c,phase){
 if(!c.body)return;
 if(!c.cargoGate){c.cargoGate=new CANNON.Box(new CV(.022,1.0,.975));c.body.addShape(c.cargoGate);}
 const b=c.body,i=b.shapes.indexOf(c.cargoGate),base=1.064+phase*1.90,top=2.974;
 c.cargoGate.halfExtents.y=Math.max(.008,(top-base)/2);c.cargoGate.updateConvexPolyhedronRepresentation();
 c.cargoGate.updateBoundingSphereRadius();b.shapeOffsets[i].set(3.239,(top+base)*.5-c.spec.com,0);
 if(phase>.98&&!c.freightSteps){
  c.freightSteps=[];
  for(let k=0;k<5;k++){
   const step=new CANNON.Box(new CV(.143,.0215,.405));
   b.addShape(step,new CV(4.52-k*.269,.19+k*.170-c.spec.com,0));c.freightSteps.push(step);
  }
 }else if(phase<=.98&&c.freightSteps){for(const step of c.freightSteps)b.removeShape(step);c.freightSteps=null;}
 b.aabbNeedsUpdate=true;b.updateBoundingRadius();
}
function truckThresholdOccupied(c,phase){
 const toLocal=(p)=>new V3(p.x,p.y,p.z).sub(c.mesh.position).applyQuaternion(c.mesh.quaternion.clone().invert());
 if(!player.car){
  const p=toLocal(player.pos);
  if(Math.abs(p.x)<1.22&&Math.abs(p.z+3.24)<.35&&p.y+1.55>1.06+phase*1.90-.18)return true;
 }
 for(const b of PH.w.bodies){
  if(b===c.body||b.mass<=0||b.car||Math.hypot(b.position.x-c.pos.x,b.position.z-c.pos.z)>4.2)continue;
  const p=toLocal(b.position),r=Math.min(.8,b.boundingRadius||.12);
  if(Math.abs(p.x)<.98+r&&Math.abs(p.z+3.24)<r+.045&&Math.abs(p.y-(1.064+phase*1.90))<r+.14)return true;
 }
 return false;
}
function truckFloorAt(x,z,ref,height){
 if(ref==null)return height;
 for(const c of OPEN_FREIGHT_BEDS){
  const dx=x-c.pos.x,dz=z-c.pos.z;if(dx*dx+dz*dz>26)continue;
  const cs=Math.cos(c.h),sn=Math.sin(c.h),u=cs*dx-sn*dz,v=sn*dx+cs*dz,origin=c.mesh.position.y;
  if(Math.abs(u)<.99&&v>=-3.295&&v<=1.118&&ref>origin+.69)height=Math.max(height,origin+1.061);
  else if(Math.abs(u)<.405&&v>=-4.663&&v< -3.295){
   const y=origin+.211+.17*clamp(Math.floor((v+4.663)/.269),0,4);
   if(ref>=y-.33)height=Math.max(height,y);
  }
 }
 return height;
}
function walkVehicleParts(pos,r,y){
 if(r>.73)return null;
 let hit=null;
 for(const c of cars){
  if(!c.components||c===player?.car||!c.mesh.visible||Math.abs(c.speed)>3||
     Math.hypot(pos.x-c.pos.x,pos.z-c.pos.z)>c.spec.L/2+1.79)continue;
  const cos=Math.cos(c.h),sin=Math.sin(c.h),dx=pos.x-c.pos.x,dz=pos.z-c.pos.z;
  const p=new V3(cos*dx-sin*dz,y-c.mesh.position.y,sin*dx+cos*dz);
  if(p.y>c.spec.r+.04||p.y+1.62<c.spec.gc)continue;
  const half=c.spec.W/2-.048,len=c.spec.L/2-.055,localRects=c.type==='harborbox'&&c.components.hero?
    [[-.878,.878,1.055,len],[-1.077,-1.027,-3.255,1.16],[1.027,1.077,-3.255,1.16],
     [-1.05,1.05,1.116,1.186],...(c.components.shutter?.phase>.92?[]:[[-1.042,1.042,-3.270,-3.212]])]:
    [[-half,half,-len+.09,len-.09]];
  if(c.type==='harborbox'&&c.components.hero&&p.y<.75&&p.z> -3.206)localRects.push([-half,half,-3.22,1.10]);
  const beforeX=p.x,beforeZ=p.z;
  for(const [x0,x1,z0,z1] of localRects)pushOut(p,r,{x0,x1,z0,z1});
  for(const j of c.components.joints.values()){
   if(!j.name.startsWith('Door')||j.state.phase<.05||p.y>j.bounds.max.y)continue;
   const local=p.clone().sub(j.pivot).applyQuaternion(j.joint.quaternion.clone().invert()).add(j.pivot);
   const width=.045,q=j.centre,bounds={x0:q.x-width,x1:q.x+width,z0:j.bounds.min.z,z1:j.bounds.max.z};
   if(pushOut(local,r,bounds))p.copy(local.sub(j.pivot).applyQuaternion(j.joint.quaternion).add(j.pivot));
  }
  if(p.x!==beforeX||p.z!==beforeZ){
   const tx=p.x-beforeX,tz=p.z-beforeZ,length=Math.hypot(tx,tz);
   pos.x=c.pos.x+cos*p.x+sin*p.z;pos.z=c.pos.z-sin*p.x+cos*p.z;
   hit=[(cos*tx+sin*tz)/length,(cos*tz-sin*tx)/length];
  }
 }
 return hit;
}
