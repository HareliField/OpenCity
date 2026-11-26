/* The stair, wall tapers and headroom use the same metric loops exported by Blender. */
const COVE={x:W+35,z:838.8,layout:null,solids:[],floor:[],display:null,optic:null,lit:[],running:true,phase:0};
function prepareCove(layout){
 COVE.layout=layout;
 COVE.solids=layout.solids.map(row=>{
  const lo=row.footprint,hi=row.upper||lo,n=lo.length;
  const verts=[...hi.map(p=>new V3(p[0],row.top,p[1])),...lo.map(p=>new V3(p[0],row.bottom,p[1]))];
  const top=hi.map((_,i)=>i);
  const faces=[top,top.map(i=>i+n).reverse()];
  for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([j,i,i+n,j+n]);}
  const bounds=new THREE.Box3().setFromPoints(verts),center=bounds.getCenter(new V3());
  const planes=faces.map(face=>{
   const plane=new THREE.Plane().setFromCoplanarPoints(verts[face[0]],verts[face[1]],verts[face[2]]);
   if(plane.distanceToPoint(center)>0)plane.negate();
   return plane;
  });
  return {kind:row.kind,lo,hi,n,verts,faces,bounds,planes,center,bottom:row.bottom,top:row.top};
 });
 COVE.floor=COVE.solids.filter(s=>s.kind==='floor');
}
function coveFloorAt(x,z,referenceY,terrain){
 x-=COVE.x;z-=COVE.z;
 if(x< -5.19||x>3.53||Math.abs(z)>3.96)return terrain;
 const limit=(referenceY??terrain)+.38;
 for(const s of COVE.floor){
  if(s.top<=terrain||s.top>limit||x<s.bounds.min.x||x>s.bounds.max.x||z<s.bounds.min.z||z>s.bounds.max.z)continue;
  let inside=true;
  for(let i=0;i<s.n;i++){
   const a=s.hi[i],b=s.hi[(i+1)%s.n];
   if((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>.000013){inside=false;break;}
  }
  if(inside)terrain=s.top;
 }
 return terrain;
}
function collideCove(p,r,y){
 let x=p.x-COVE.x,z=p.z-COVE.z,hit=null;
 if(x< -5.3-r||x>3.6+r||Math.abs(z)>4+r)return null;
 for(const s of COVE.solids){
  if((s.kind==='floor'?s.top<=y+.38:s.top<=y+.14)||s.bottom>=y+1.67)continue;
  if(x<s.bounds.min.x-r||x>s.bounds.max.x+r||z<s.bounds.min.z-r||z>s.bounds.max.z+r)continue;
  const t=clamp((y+.71-s.bottom)/(s.top-s.bottom),0,1);
  let closest=Infinity,cx=0,cz=0,edge=-Infinity,nx=0,nz=0;
  for(let i=0;i<s.n;i++){
   const j=(i+1)%s.n,ax=lerp(s.lo[i][0],s.hi[i][0],t),az=lerp(s.lo[i][1],s.hi[i][1],t);
   const ex=lerp(s.lo[j][0],s.hi[j][0],t)-ax,ez=lerp(s.lo[j][1],s.hi[j][1],t)-az;
   const l2=ex*ex+ez*ez,l=Math.sqrt(l2),along=clamp(((x-ax)*ex+(z-az)*ez)/l2,0,1);
   const dx=x-ax-along*ex,dz=z-az-along*ez,d2=dx*dx+dz*dz;
   if(d2<closest){cx=dx;cz=dz;closest=d2;}
   const distance=(-(x-ax)*ez+(z-az)*ex)/l;
   if(distance>edge){edge=distance;nx=-ez/l;nz=ex/l;}
  }
  if(edge>0){
   if(closest>=r*r)continue;
   edge=Math.sqrt(closest);
   if(edge>1e-7){nx=cx/edge;nz=cz/edge;}
  }
  x+=nx*(r-edge);z+=nz*(r-edge);hit=[nx,nz];
 }
 if(hit){p.x=COVE.x+x;p.z=COVE.z+z;}
 return hit;
}
function traceCove(start,delta,padding,glass){
 const x=start.x-COVE.x,z=start.z-COVE.z;
 if(Math.min(x,x+delta.x)>3.53+padding||Math.max(x,x+delta.x)<-5.19-padding||
    Math.min(z,z+delta.z)>3.96+padding||Math.max(z,z+delta.z)<-3.96-padding)return 1;
 const local=new V3(x,start.y,z);
 let best=1;
 for(const s of COVE.solids){
  if(!glass&&s.kind==='glass'||s.kind==='guard'&&!padding)continue;
  if(traceBox(local,delta,s.bounds.min,s.bounds.max,padding)>=best)continue;
  let enter=0,leave=best;
  for(const plane of s.planes){
   const distance=plane.distanceToPoint(local)-padding,speed=plane.normal.dot(delta);
   if(Math.abs(speed)<1e-9){if(distance>0){enter=1;break;}continue;}
   const t=-distance/speed;
   if(speed<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
   if(enter>leave)break;
  }
  if(enter<=leave)best=Math.min(best,enter);
 }
 return best;
}
function coveBody(){
 const body=new CANNON.Body({mass:0,material:PH.mat.concrete,collisionFilterGroup:PHYS_GROUP.world});
 body.position.set(COVE.x,0,COVE.z);
 for(const s of COVE.solids){
  const c=s.center,vertices=s.verts.map(p=>new CV(p.x-c.x,p.y-c.y,p.z-c.z));
  body.addShape(new CANNON.ConvexPolyhedron({vertices,faces:s.faces}),new CV(c.x,c.y,c.z));
 }
 PH.w.addBody(body);
 return body;
}
async function loadCoveLayout(){
 const response=await fetch('models/scenery/cove-layout.json');
 if(!response.ok)throw Error('Lighthouse surface data '+response.status);
 prepareCove(await response.json());
}
function covePreview(){
 const vertices=[],colors=[],palette={floor:0x77716a,wall:0xad9b83,guard:0x403f38,glass:0x718785};
 for(const s of COVE.solids){
  const c=lin(palette[s.kind]);
  for(const poly of s.faces)for(let i=1;i+1<poly.length;i++)for(const k of [poly[0],poly[i],poly[i+1]]){
   const p=s.verts[k];vertices.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86}));
 mesh.position.set(COVE.x,0,COVE.z);mesh.castShadow=mesh.receiveShadow=true;
 scene.add(mesh);return mesh;
}
function lighthouse(){
 const {x,z,layout}=COVE;
 const door=layout.door,M=new THREE.Matrix4().makeRotationY(-Math.PI/2);M.setPosition(x+door.x,0,z);
 COVE.door=registerDoor(M,0,0,door.floor,door.width,door.height,'wood');
 const path={x0:W+HALF+7.48,x1:x-5.18,z0:z-1.48,z1:z+1.48,y:.15};
 topQuad(STREET.materials.wornSlab,path.x0,path.x1,path.y,path.z0,path.z1,1.8,null,false);
 STREET.steps.push(path);
 const key=cellKey(x,z);
 if(!STREET_TERRAIN.has(key))STREET_TERRAIN.set(key,[]);
 STREET_TERRAIN.get(key).push({cove:true});
 // The foyer switch is within reach of the photographed vented keeper wall's service shelf.
 worksPanel(x+2.23,door.floor,z+.52,()=>COVE.running?'SWITCH BEACON OFF':'SWITCH BEACON ON',()=>{
  COVE.running=!COVE.running;updateCoveBeacon(0);toast(COVE.running?'Lighthouse beacon enabled':'Lighthouse beacon stopped',1300);
 },1.08);
 const preview=covePreview();
 new THREE.GLTFLoader().load('models/scenery/cove-lighthouse.glb',gltf=>{
  COVE.display=gltf.scene;COVE.display.position.set(x,0,z);
  COVE.display.traverse(mesh=>{
   if(!mesh.isMesh)return;
   mesh.castShadow=!mesh.material.transparent;mesh.receiveShadow=true;
   if(mesh.material.name==='Beacon filament'||mesh.material.name==='Pressed lamp prisms')COVE.lit.push(mesh.material);
  });
  COVE.optic=COVE.display.getObjectByName('LampOptic');
  scene.add(COVE.display);scene.remove(preview);preview.geometry.dispose();preview.material.dispose();
  updateCoveBeacon(0);
 },undefined,e=>console.warn('Lighthouse detail',e));
}
function updateCoveBeacon(dt){
 if(!COVE.optic)return;
 const on=COVE.running&&cityPowerAt(COVE.x,COVE.z);
 if(on){COVE.phase=(COVE.phase+dt*.51)%(Math.PI*2);COVE.optic.rotation.y=COVE.phase;}
 for(const m of COVE.lit){
  m.emissive.setHex(0xffdf9a);
  m.emissiveIntensity=on?(m.name==='Beacon filament'?(DAYLIGHT?.68:4.1):(DAYLIGHT?.035:.28)):0;
 }
}
