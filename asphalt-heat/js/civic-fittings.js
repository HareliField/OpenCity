/* Working domestic cisterns, recirculating park water and the transparent shelter beside the square. */
const CIVIC={cisterns:[],basins:[],stops:[],water:null,spray:null};
function installCistern(B,x,y,z,yaw=0){
 worksModel('ceramic-cistern',x,y,z,[.446,.798,.601],yaw);
 const c={x,y,z,volume:6,emptying:false,discharge:0,total:0};
 CIVIC.cisterns.push(c);
 const p={x:x+.718*Math.sin(yaw),z:z+.718*Math.cos(yaw)};
 worksPanel(p.x,y,p.z,()=>c.volume>=5.9?'FLUSH CISTERN':c.emptying?'FLUSHING':'CISTERN REFILLING',()=>{
  if(c.emptying||c.volume<5.9)return;
  c.emptying=true;toast('Cistern flushed',1000);
 },.72);
}
function advanceCistern(c,dt){
 c.discharge=0;
 if(dt<=0)return;
 if(c.emptying){
  const amount=Math.min(c.volume,dt*2.4);
  c.volume-=amount;c.total+=amount;c.discharge=amount/dt;
  if(c.volume<=.00001){c.volume=0;c.emptying=false;}
 }else if(c.volume<6){
  c.volume=Math.min(6,c.volume+dt*.29*pressureAtFixture(c));
 }
}

function installBusShelter(B,x,z,yaw){
 const y=.16,M=new THREE.Matrix4().makeRotationY(yaw);M.setPosition(x,0,z);
 placeScenery('glazed-bus-shelter',x,y,z,yaw,[3.58,2.203,1.18]);
 // The asset faces local +Z. Only the glass, bench and posts leave solid footprints under the canopy.
 const box=(l,r,b,t,v0,v1)=>addRoomCollider(B,M,l,r,v0,v1,y+t,y+b);
 box(-1.74,1.74,.19,1.91,.443,.479);
 for(const s of [-1,1]){
  box(s*1.71-.026,s*1.71+.026,.18,1.91,-.33,.46);
  box(s*1.71-.033,s*1.71+.033,.0,2.13,.427,.496);
  box(s*1.71-.025,s*1.71+.025,.0,2.13,-.353,-.304);
 }
 box(-1.56,.93,.416,.477,-.13,.21);
 box(-1.56,.93,.634,.81,.165,.218);
 box(-1.79,1.79,2.081,2.203,-.592,.574);
 weatherCeilings.push({...lrect(M,-1.79,1.79,-.592,.574),h:y+2.20});
 const map=worksSign('CITY BUS','#465d51','#ede9db'),p=lpt(M,1.122,.356);
 worksPlacard(map,p.x,y+1.606,p.z,.584,.090,yaw);
 CIVIC.stops.push({x,z,yaw});
}

function buildMosaicSquare(B,x,z,plaza){
 const base=.172,outer=3.62,inner=3.279,level=base+.148;
 // Keep the glazed tesserae in the distance model too. The public square is visible from several blocks.
 const grout=new THREE.MeshStandardMaterial({color:lin(0xb6ae97),roughness:.77});
 const rim=new THREE.RingGeometry(inner,outer,72);rim.rotateX(-Math.PI/2);rim.translate(x,base+.279,z);addGeo(grout,rim,true);
 const stage=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial({color:lin(0x608188),roughness:.65});
 const tiled=new THREE.Mesh(new THREE.CircleGeometry(inner,72),mat);
 tiled.rotation.x=-Math.PI/2;tiled.position.set(x,level,z);stage.add(tiled);
 for(const offset of [-2.42,-.74,.93,2.40]){
  const length=2*Math.sqrt(inner*inner-offset*offset)-.086;
  const strip=new THREE.Mesh(new THREE.PlaneGeometry(length,.135),grout);
  strip.rotation.x=-Math.PI/2;strip.position.set(x,level+.002,z+offset);stage.add(strip);
 }
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.395,14,10),grout);
 marker.position.set(x,base+.607,z);marker.castShadow=true;stage.add(marker);scene.add(stage);
 placeScenery('civic-mosaic-basin',x,base+.006,z,0,[7.24,.997,7.24],show=>{stage.visible=show;});
 const stone=new THREE.MeshStandardMaterial({color:lin(0xaea28d),roughness:.83});
 const skirt=new THREE.CylinderGeometry(outer,outer-.014,.25,72,1,true);skirt.translate(x,base+.129,z);addGeo(stone,skirt,true);
 // A compliant step onto the coping leads down to the tile. The sphere keeps its own smaller footprint.
 const quay={x,z,base,outer,inner,water:level+.018};
 for(let i=0;i<40;i++){
  const yaw=2*Math.PI*i/40,nx=Math.sin(yaw),nz=Math.cos(yaw),mid=(outer+inner)/2,
   px=x+mid*nx,pz=z+mid*nz,w=(2*outer)*Math.sin(Math.PI/40)+.01,d=outer-inner,h=.278,
   q=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),yaw);
  const dx=Math.abs(Math.cos(yaw))*w/2+Math.abs(nx)*d/2,dz=Math.abs(nx)*w/2+Math.abs(Math.cos(yaw))*d/2;
  B.bld.push({x0:px-dx,x1:px+dx,z0:pz-dz,z1:pz+dz,y0:base,h:base+h,walkIgnore:true,
   obb:{w,h,d,p:new V3(px,base+h/2,pz),q},normal:new V3(0,1,0)});
 }
 B.bld.push({x0:x-inner,x1:x+inner,z0:z-inner,z1:z+inner,y0:base,h:level,radius:inner,walkIgnore:true});
 B.bld.push({x0:x-.39,x1:x+.39,z0:z-.39,z1:z+.39,y0:level,h:base+1.006,radius:.388});
 if(!CIVIC.water)CIVIC.water=new THREE.MeshStandardMaterial({color:lin(0x84b2b2),transparent:true,opacity:.29,
  depthWrite:false,roughness:.15,metalness:.33,envMapIntensity:.76,side:THREE.DoubleSide});
 if(!CIVIC.spray)CIVIC.spray=new THREE.MeshStandardMaterial({color:lin(0xb9d3cc),transparent:true,opacity:.61,roughness:.15,metalness:.19});
 const surface=new THREE.Mesh(new THREE.CircleGeometry(inner-.012,64),CIVIC.water);
 surface.rotation.x=-Math.PI/2;surface.position.set(x,quay.water,z);scene.add(surface);
 const jets=new THREE.Group();
 for(let i=0;i<4;i++){
  const angle=i*Math.PI/2+.36,tx=1.34*Math.cos(angle),tz=-1.34*Math.sin(angle);
  const line=new THREE.QuadraticBezierCurve3(new V3(tx,0,tz),new V3(tx*.77,.76,tz*.77),new V3(tx*.43,0,tz*.43));
  const jet=new THREE.Mesh(new THREE.TubeGeometry(line,15,.016,6,false),CIVIC.spray);
  jets.add(jet);
 }
 jets.position.set(x,base+.202,z);scene.add(jets);
 Object.assign(quay,{surface,jets});CIVIC.basins.push(quay);
 installBusShelter(B,B.x0+SW+9.1,plaza?B.z0+SW+1.01:B.z1-SW-1.01,plaza?Math.PI:0);
}
function mosaicFloorAt(x,z,h){
 for(const q of CIVIC.basins){
  if(Math.abs(x-q.x)>q.outer||Math.abs(z-q.z)>q.outer)continue;
  const d=Math.hypot(x-q.x,z-q.z);
  if(d<=q.outer)h=Math.max(h,q.base+(d>=q.inner?.279:.148));
 }
 return h;
}
function updateCivicServices(dt){
 for(const c of CIVIC.cisterns)advanceCistern(c,dt);
 for(const basin of CIVIC.basins){
  const power=cityPowerAt(basin.x,basin.z),pressure=pressureAtFixture(basin);
  if(power&&pressure>.12){
   basin.jets.visible=true;
   basin.jets.scale.y=pressure*(.965+.035*Math.sin(time*2.17+basin.x));
  }else basin.jets.visible=false;
 }
}

