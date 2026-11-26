/* Movable appliances, washrooms and local water fixtures in the upper flats. */
function appliancePoint(f,x,z){
 const c=Math.cos(f.yaw),s=Math.sin(f.yaw);
 return {x:f.x+c*x+s*z,z:f.z-s*x+c*z};
}
const BATH_DEPTH=2.86;
function bathroomDirection(breadth,doorV,v0,v1){
 if(breadth<4.18||Math.max(doorV-v0,v1-doorV)<BATH_DEPTH+1.25)return 0;
 return doorV-v0>=BATH_DEPTH+1.25?1:-1;
}
function addDomesticFittings(c,l,room,yaw,place){
 const {v0,v1,edge,partition,sign,doorV,breadth}=room;
 const fridge=place('flat-refrigerator',edge-sign*.37,v0+2.58,yaw,[.60,1.65,.64],1.65);
 const hinge=appliancePoint(fridge,-.29,.255),operating=appliancePoint(fridge,.26,1.17);
 fridge.leaf={x:hinge.x,z:hinge.z,ox:fridge.x,oz:fridge.z,opX:operating.x,opZ:operating.z,yaw:fridge.yaw,
  base:fridge.y+.061,w:.596,h:1.59,thickness:.059,opensOut:true,phase:0,target:0,owner:l};
 const stand=place('bedside-lamp',edge-sign*.61,v1-2.91,yaw,[.54,.98,.38],.59);
 stand.light={x:stand.x,y:l.y0+.87,z:stand.z,floorY:l.y0,colour:0xffdb9d,reach:5.9,intensity:1.18};
 if(v1-v0>9.0&&breadth>3.3){
  const u=edge-sign*.97,v=(v0+v1)/2;
  place('reading-table',u,v,yaw,[.94,.74,.86],.74);
  place('breakfast-tray',u,v,yaw,[.50,.244,.319],.244,.74);
  if(breadth>3.62)place('seat',u-sign*.77,v,yaw+Math.PI,[.47,.85,.49],.48);
 }
 const depth=BATH_DEPTH,width=1.90,direction=bathroomDirection(breadth,doorV,v0,v1);
 if(!direction)return;
 const end=direction===1?v0:v1;
 const u=partition+sign*width,doorU=partition+sign*.95,doorAt=suitePoint(c,doorU,end+direction*depth);
 const outward=c.alongX?(direction===1?'E':'W'):(direction===1?'S':'N');
 const M=new THREE.Matrix4().makeRotationY(SIDEANG[outward]);M.setPosition(doorAt.x,0,doorAt.z);
 const d=registerDoor(M,0,0,l.y0,1.01,2.04,'wood');d.suiteBlock=l.owner.block;
 room.bath={u,end,direction,depth,width,doorU,door:d};
 const inwardYaw=SIDEANG[outward],crossYaw=c.alongX?(sign>0?Math.PI:0):(sign>0?-Math.PI/2:Math.PI/2);
 const shower=place('shower-tray',partition+sign*.59,end+direction*.47,inwardYaw,[.85,2.00,.75],.073);
 shower.walkDeck=true;
 const rose=appliancePoint(shower,0,-.124),foot=appliancePoint(shower,0,.15);
 shower.tap={x:rose.x,y:l.y0,z:rose.z,reachX:foot.x,reachZ:foot.z,riserZone:Math.floor(l.y0/22),time:0,
  shower:true,flow:.14,start:'RUN SHOWER',stop:'TURN SHOWER OFF'};
 const wc=place('ceramic-cistern',u-sign*.36,end+direction*.72,crossYaw,[.446,.798,.60],.47);
 const flush=appliancePoint(wc,0,.54);
 wc.cistern={x:wc.x,z:wc.z,y:l.y0,riserZone:Math.floor(l.y0/22),opX:flush.x,opZ:flush.z,volume:6,emptying:false,discharge:0,total:0};
 const wash=place('flat-washstand',u-sign*.245,end+direction*1.49,crossYaw,[.50,1.68,.38],.88);
 const basin=appliancePoint(wash,0,-.028),handle=appliancePoint(wash,0,.50);
 wash.tap={x:basin.x,y:l.y0,z:basin.z,reachX:handle.x,reachZ:handle.z,riserZone:Math.floor(l.y0/22),time:0,
  waterHeight:.881,flow:.105,start:'RUN BASIN TAP',stop:'TURN BASIN TAP OFF'};
}
function addBathroomParts(c,l,room,add){
 const {u,end,direction,depth,doorU}=room.bath,m=INTERIORS.materials;
 const V=end+direction*depth,base=l.y0,top=l.h-.139;
 const bound=(u0,u1,v0,v1)=>orientedRect(c.alongX,Math.min(u0,u1),Math.max(u0,u1),Math.min(v0,v1),Math.max(v0,v1));
 const wall=(u0,u1,v0,v1,b,t)=>add(partBox(bound(u0,u1,v0,v1),b,t,'wall',constructionFinish(m.wallTile)));
 wall(u-.058,u+.058,end,V,base,top);
 const lo=Math.min(u,room.partition),hi=Math.max(u,room.partition);
 wall(lo,doorU-.548,V-.055,V+.055,base,top);wall(doorU+.548,hi,V-.055,V+.055,base,top);
 wall(doorU-.548,doorU+.548,V-.055,V+.055,base+2.095,top);
 for(const edge of [doorU-.548,doorU+.548])
  add(partBox(bound(edge-.025,edge+.025,V-.071,V+.071),base,base+2.095,'frame',m.darkWood));
 add(partBox(bound(room.partition,u,end,V),base+.0031,base+.006,'trim',constructionFinish(m.tile)));
}
function addRefrigeratorParts(l,f,add){
 const side=(x0,x1,z0,z1,b,t)=>{
  const a=appliancePoint(f,x0,z0),b2=appliancePoint(f,x1,z1);
  add(partBox({x0:Math.min(a.x,b2.x),x1:Math.max(a.x,b2.x),z0:Math.min(a.z,b2.z),z1:Math.max(a.z,b2.z)},f.y+b,f.y+t,'furniture',null));
 };
 for(const x of [-.296,.260])side(x,x+.036,-.312,.257,.03,1.644);
 side(-.26,.26,-.312,-.255,.035,1.64);
 for(const y of [.04,1.61])side(-.26,.26,-.27,.26,y,y+.035);
 for(const y of [.29,.65,.98,1.32])side(-.254,.254,-.221,.211,y,y+.018);
 const d=f.leaf,part=partBox(f,d.base,d.base+d.h,'appliance',null);
 part.leaf=d;d.part=part;syncRefrigeratorCollision(d);add(part);
}
function syncRefrigeratorCollision(d){
 const p=d.part,pose=doorwayPose(d,d.phase),c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
 const dx=(Math.abs(c)*d.w+Math.abs(s)*d.thickness)/2,dz=(Math.abs(s)*d.w+Math.abs(c)*d.thickness)/2;
 p.x0=pose.x-dx;p.x1=pose.x+dx;p.z0=pose.z-dz;p.z1=pose.z+dz;
 p.obb={w:d.w,h:d.h,d:d.thickness,p:new V3(pose.x,pose.y,pose.z),q:new THREE.Quaternion().setFromAxisAngle(_entryUp,pose.yaw)};
 const body=d.owner.body;
 if(body&&p.shapeIndex!=null){
  const at=p.obb.p;
  body.shapeOffsets[p.shapeIndex].set(at.x-body.position.x,at.y-body.position.y,at.z-body.position.z);
  body.shapeOrientations[p.shapeIndex].setFromEuler(0,pose.yaw,0);
  body.aabbNeedsUpdate=true;body.updateBoundingRadius();
 }
}
function moveRefrigeratorDraw(entry,phase){
 const rot=new THREE.Matrix4().makeRotationY(-phase*Math.PI*.54);
 entry.batch.setMatrixAt(entry.i,entry.base.clone().multiply(rot).multiply(entry.offset));
 entry.batch.instanceMatrix.needsUpdate=true;
}
function animateRefrigerators(dt,pos){
 for(const d of BUILDING_FITTINGS.movingLeaves){
  const next=d.phase+clamp(d.target-d.phase,-dt*1.72,dt*1.72);
  if(Math.abs(d.base-pos.y)<.5&&Math.hypot(pos.x-d.x,pos.z-d.z)<1.03&&doorOverlap(d,next,pos,.32)){
   d.target=d.phase;BUILDING_FITTINGS.movingLeaves.delete(d);continue;
  }
  d.phase=next;if(d.part)syncRefrigeratorCollision(d);
  for(const p of d.draw||[])moveRefrigeratorDraw(p,next);
  if(d.phase===d.target)BUILDING_FITTINGS.movingLeaves.delete(d);
 }
}
function waterStream(tap){
 if(!tap.shower){
  const g=new THREE.CylinderGeometry(.008,.012,tap.waterHeight ? .18 : .294,8);
  const mesh=new THREE.Mesh(g,CITY_WORKS.m.channel);
  mesh.position.set(tap.x,tap.y+(tap.waterHeight||.910),tap.z);return mesh;
 }
 const geos=[];
 for(let i=0;i<11;i++){
  const a=2*Math.PI*i/11,d=new V3(Math.cos(a)*.12,-1.84,Math.sin(a)*.12);
  const g=new THREE.CylinderGeometry(.003,.005,d.length(),6);
  const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  g.translate(Math.cos(a)*.044+d.x/2,1.929+d.y/2,Math.sin(a)*.044+d.z/2);geos.push(g);
 }
 const mesh=new THREE.Mesh(mergeGeos(geos),CITY_WORKS.m.channel);geos.forEach(g=>g.dispose());
 mesh.position.set(tap.x,tap.y,tap.z);return mesh;
}
function residentialFixtureAction(f){
 if(f.leaf){
  const d=f.leaf;
  return {label:d.target>=.5?'CLOSE REFRIGERATOR':'OPEN REFRIGERATOR',hot:true,fn:()=>{
   d.target=d.target>=.5?0:1;BUILDING_FITTINGS.movingLeaves.add(d);
  }};
 }
 if(f.cistern){
  const c=f.cistern;
  return {label:c.volume>=5.9?'FLUSH CISTERN':c.emptying?'FLUSHING':'CISTERN REFILLING',hot:true,fn:()=>{
   if(c.volume<5.9||c.emptying)return;
   c.emptying=true;BUILDING_FITTINGS.activeCisterns.add(c);
   if(!CIVIC.cisterns.includes(c))CIVIC.cisterns.push(c);
  }};
 }
 const tap=f.tap;
 return {label:tap.time>0?tap.stop||'TURN TAP OFF':tap.start||'RUN KITCHEN TAP',hot:true,fn:()=>{
  if(tap.time>0){tap.time=0;return;}
  if(pressureAtFixture(tap)<.12){toast('No water pressure',1200);return;}
  tap.time=tap.shower?16:3.5;
  if(!tap.stream){tap.stream=waterStream(tap);scene.add(tap.stream);
   CITY_WORKS.fixtures.push(tap);BUILDING_FITTINGS.activeTaps.add(tap);}
 }};
}
