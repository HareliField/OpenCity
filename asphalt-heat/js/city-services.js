/* Buried water, power and sanitary distribution. Coordinates and pressure drops use metres and kPa. */
const CITY_SERVICES={sectors:['Northwest','Northeast','Southwest','Southeast'].map(name=>({name,power:true})),
 lots:[],downstream:[],pipes:[],switches:[],next:0,root:null};
function serviceSector(x,z){
 return CITY_SERVICES.sectors[(x>=W/2?1:0)+(z>=W/2?2:0)];
}
function cityPowerAt(x,z){return serviceSector(x,z).power;}
function liftPowered(lift){
 return cityPowerAt(lift.shaft.x0,lift.shaft.z0)&&(!lift.municipal||CITY_WORKS.grid);
}
function buildServiceGraph(){
 const s=CITY_SERVICES,ri=Math.min(5,N-1),rj=Math.min(4,N-1);
 s.lots=blocks.map(B=>{
  const x=(B.i+.5)*CELL,z=B.j*CELL+14,distance=(Math.abs(B.i-ri)+Math.abs(B.j-rj))*CELL;
  return {i:B.i,j:B.j,x,z,distance,sector:serviceSector(x,z),parent:null,pressure:0,volts:0,discharge:0};
 });
 s.root=s.lots[ri*N+rj];
 for(const lot of s.lots){
  const i=lot.i,j=lot.j;
  if(i!==ri)lot.parent=s.lots[(i+Math.sign(ri-i))*N+j];
  else if(j!==rj)lot.parent=s.lots[i*N+j+Math.sign(rj-j)];
 }
 s.downstream=s.lots.slice().sort((a,b)=>b.distance-a.distance);
}
function supplyAt(x,z){
 return CITY_SERVICES.lots[cellKey(x,z)];
}
function pressureAtFixture(f){
 const lot=supplyAt(f.x,f.z);
 // The gallery inlet also drives the market faucet. Each upper-storey fixture loses static head.
 return lot?clamp((lot.pressure-9.81*Math.max(0,f.y||0))/260,0,1):CITY_WORKS.pressure;
}
function updateServiceGraph(dt){
 const s=CITY_SERVICES;
 if(!s.root||(s.next-=dt)>0)return;
 s.next=.20;
 for(const lot of s.lots){
  lot.discharge=0;
  lot.volts=lot.sector.power?230-.003*(lot.distance+14):0;
  lot.pressure=CITY_WORKS.pressure*Math.max(0,385-.034*(lot.distance+14));
 }
 for(const f of CITY_WORKS.fixtures){
  if(f.time<=0)continue;
  const lot=supplyAt(f.x,f.z);
  if(lot)lot.discharge+=.16*pressureAtFixture(f);
 }
 for(const lot of s.downstream)if(lot.parent)lot.parent.discharge+=lot.discharge;
}
function drawServiceNetwork(){
 const s=CITY_SERVICES,m=CITY_WORKS.m,up=new V3(0,1,0),matrices=[[],[],[]];
 const root=s.root,streetX=root.i*CELL;
 // The return main falls toward the plant. Cell branches meet their street main at midblock.
 function depth(x,z){return -7.30+.0015*(Math.abs(x-streetX)+Math.abs(z-root.j*CELL));}
 function bank(ax,az,bx,bz){
  const alongX=az===bz;
  for(let k=0;k<3;k++){
   const offset=(k-1)*.48,ox=alongX?0:offset,oz=alongX?offset:0;
   const h=(x,z)=>k===0?-5.53:k===1?-5.05:depth(x,z);
   const a=new V3(ax+ox,h(ax,az),az+oz),b=new V3(bx+ox,h(bx,bz),bz+oz);
   const delta=b.clone().sub(a),length=delta.length();
   if(!length)continue;
   const rot=new THREE.Quaternion().setFromUnitVectors(up,delta.multiplyScalar(1/length));
   const radius=[.16,.084,.24][k];
   matrices[k].push(new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5),rot,new V3(radius,length,radius)));
  }
 }
 for(let j=0;j<N;j++)bank(0,j*CELL,W,j*CELL);
 bank(streetX,0,streetX,(N-1)*CELL);
 for(const lot of s.lots)bank(lot.x,lot.j*CELL,lot.x,lot.z);
 bank(streetX,root.j*CELL,streetX,280.4);bank(streetX,280.4,348.1,280.4);
 bank(349.94,root.j*CELL,349.94,CITY_WORKS.gallery.z0);
 worksBeam(m.pipe,[348.1,-5.53,280.4],[348.1,1.15,280.4],.16);
 worksBeam(m.iron,[349.94,depth(349.94,CITY_WORKS.gallery.z0),CITY_WORKS.gallery.z0],[349.94,-2.64,CITY_WORKS.gallery.z0],.24);
 const geo=new THREE.CylinderGeometry(1,1,1,8);
 for(let k=0;k<3;k++){
  const mesh=new THREE.InstancedMesh(geo,[m.pipe,m.ochre,m.iron][k],matrices[k].length);
  matrices[k].forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
  mesh.visible=false;mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);s.pipes.push(mesh);
 }
}
function setFeederPower(sector,power){
 sector.power=power;
 const colors=PROPS.glow?.geometry.attributes.color;
 if(colors){
  for(const p of PROPS.list){
   if(!p.P.glow||p.moved||serviceSector(p.x,p.z)!==sector)continue;
   colors.setXYZ(p.gi,power?1:0,power ? .72 : 0,power ? .42 : 0);syncLampGlow(p);
  }
  colors.needsUpdate=true;
 }
 for(const control of CITY_SERVICES.switches)control.handle.rotation.x=control.sector.power?-.24:.70;
 CITY_SERVICES.next=0;updateServiceGraph(0);
}
function buildDistrictPanel(){
 const m=CITY_WORKS.m;
 for(let i=0;i<4;i++){
  const sector=CITY_SERVICES.sectors[i],x=345.7+i*3.4,z=298.37;
  const r=worksRect(x-.81,x+.81,z-.24,z+.42);
  worksSolid(r,.17,2.33,m.panel);
  const slot=worksSign(sector.name.toUpperCase()+' FEEDER','#324a47','#ddd9c5');
  worksPlacard(slot,x,1.88,z-.255,1.44,.34,Math.PI);
  const handle=new THREE.Mesh(unitBox,m.ochre);
  handle.position.set(x,1.11,z-.265);handle.scale.set(.14,.41,.13);handle.rotation.x=-.24;scene.add(handle);
  CITY_SERVICES.switches.push({sector,handle});
  worksPanel(x,.17,z-.86,()=> (sector.power?'ISOLATE ':'ENERGIZE ')+sector.name.toUpperCase()+' FEEDER',
   ()=>{setFeederPower(sector,!sector.power);toast(sector.name+' district power '+(sector.power?'on':'off'),1600);},1.0);
 }
}
function installCityServices(){
 buildServiceGraph();drawServiceNetwork();updateServiceGraph(0);
}
