// Original mesh studies of familiar street cars. Dimensions and tuning approximate representative trims.
const CITY_FLEET={traffic:['taxi','taxi','van','sedan','suv','hatch','sport'],parked:['sedan','hatch','suv','van','sport']};
function registerStreetCar(id,base,modelName,form,dimensions,body,tuning,weight=1){
 const [L,W,r,wheelbase,wr,mass]=dimensions,[hood,tr,ws,rg,hb,nose,tail,tum]=body;
 const spec={...CARSPEC[base],...tuning,type:id,modelName,form,L,W,r,wb:wheelbase/2,wr,mass,
  hood,tr,ws,rg,hb,nose,tail,tum,b:hb};
 spec.com=spec.gc+.30+(r-1.4)*.12;spec.brake=mass*.04;
 CARSPEC[id]=spec;
 for(let n=0;n<weight;n++)CITY_FLEET.traffic.push(id);
 CITY_FLEET.parked.push(id);
}
registerStreetCar('civic','sedan','Honda Civic','sedan',
 [4.67,1.80,1.42,2.74,.325,1350],[1.05,.62,.87,.90,.90,.67,.87,.75],{fwd:1,F:8400},3);
registerStreetCar('corolla','sedan','Toyota Corolla','sedan',
 [4.63,1.78,1.44,2.70,.315,1330],[1.10,.72,.79,.73,.91,.69,.88,.78],{fwd:1,F:7900},3);
registerStreetCar('prius','hatch','Toyota Prius','liftback',
 [4.54,1.76,1.47,2.70,.32,1410],[.78,.17,1.12,1.17,.95,.68,1.02,.75],{F:7100},2);
registerStreetCar('golf','hatch','Volkswagen Golf GTI','hatch',
 [4.29,1.79,1.45,2.63,.323,1370],[1.04,.13,.63,.38,.94,.74,.96,.82],{F:10500,k:31},2);
registerStreetCar('mini','hatch','MINI Cooper','hatch',
 [3.82,1.73,1.42,2.50,.302,1200],[.90,.10,.44,.28,.91,.74,.95,.82],{F:7800,doors:2});
registerStreetCar('mustang','sport','Ford Mustang GT','coupe',
 [4.79,1.92,1.38,2.72,.35,1680],[1.48,.61,.73,1.02,.89,.70,.91,.72],{F:15700,doors:2});
registerStreetCar('miata','sport','Mazda MX-5','roadster',
 [3.92,1.74,1.23,2.31,.303,1070],[1.28,.83,.54,.32,.78,.57,.81,.76],{F:9600,k:31,doors:2});
registerStreetCar('nineeleven','sport','Porsche 911 Carrera','coupe',
 [4.52,1.85,1.30,2.45,.346,1530],[1.06,.35,.90,1.23,.84,.63,.88,.70],{F:17100,k:36,doors:2});
registerStreetCar('volvo240','sedan','Volvo 240 Estate','wagon',
 [4.79,1.71,1.46,2.64,.316,1390],[1.31,.11,.49,.19,.94,.79,.96,.87],{F:7300,roofRails:1});
registerStreetCar('rav4','suv','Toyota RAV4','crossover',
 [4.60,1.85,1.68,2.69,.356,1630],[1.06,.12,.74,.52,1.00,.85,1.03,.82],{F:9800,roofRails:1},2);
registerStreetCar('wrangler','suv','Jeep Wrangler','offroad',
 [4.54,1.88,1.84,3.01,.402,1950],[1.22,.15,.34,.12,1.12,.99,1.13,.87],{F:11000,gc:.26,k:23});
registerStreetCar('f150','suv','Ford F-150','pickup',
 [5.89,2.03,1.94,3.69,.405,2220],[1.35,1.65,.63,.18,1.16,1.04,1.14,.86],{F:12900,gc:.25,k:25},2);
const STOCK_NAMES={sedan:'City Sedan',hatch:'City Hatchback',sport:'Coastal Coupe',suv:'Utility SUV',
 van:'Panel Van',taxi:'City Cab',police:'Police Interceptor',amb:'Ambulance',swat:'Armored Van'};
for(const [type,name] of Object.entries(STOCK_NAMES))CARSPEC[type].modelName=name;

function fleetSection(s,z,points,width){
 const rear=-s.L/2,front=s.L/2;
 const bed=s.form==='pickup' && z>rear+.13 && z<rear+s.tr-.06;
 const tub=s.form==='roadster' && z>rear+s.tr+.03 && z<front-s.hood-.05;
 if(!bed && !tub)return false;
 const floor=bed?s.gc+.48:s.gc+.095,edge=bed?s.hb+.015:s.hb+.035;
 points[0]=[0,floor];points[1]=[width*.77,floor];points[2]=[width*.80,edge];
 points[3]=[width*.97,edge];points[4]=[width*.986,edge-.038];points[5]=[width,edge-.085];
 return true;
}
function fleetTrim(s,pr,zf,flat,box,pos,uv,idx){
 const W=s.W/2,h=s.L/2,id=s.type;
 function polygon(mat,points){
  for(const side of [points,[...points].reverse()]){
   const k=pos.length/3;
   for(const [x,y,z] of side){pos.push(x,y,z);uv.push(.5+x/s.W,y/s.r);}
   for(let n=1;n<side.length-1;n++)idx[mat].push(k,k+n,k+n+1);
  }
 }
 function face(mat,xy,z){polygon(mat,xy.map(([x,y])=>[x,y,z]));}
 function oval(mat,x,y,w,t,z){
  const points=[];
  for(let n=0;n<16;n++){const angle=n*Math.PI/8;points.push([x+w*.5*Math.cos(angle),y+t*.5*Math.sin(angle)]);}
  face(mat,points,z);
 }
 function lens(side,front,shape){
  const base=front?s.nose:s.tail,z=front?zf+.009:-zf-.014,mat=front?3:4;
  const panel=(verts)=>face(mat,verts.map(([x,y])=>[side*x*W,base+y]),z);
  if(shape==='round'){
   oval(2,side*W*.67,base-.135,.32,.27,z);oval(mat,side*W*.67,base-.135,.266,.217,z+(front?.005:-.005));
  }else if(shape==='roadster'){
   const z=-zf-.022,x=side*W*.54,y=base-.14;
   oval(2,x,y,.235,.205,z);
   panel([[.51,-.16],[.60,-.18],[.89,-.11],[.90,-.06],[.58,-.08]]);
   oval(4,x,y,.204,.174,z-.005);oval(2,x,y,.125,.109,z-.011);
  }else if(shape==='triple'){
   for(let i=0;i<3;i++)panel([[.39+i*.16,-.245],[.49+i*.16,-.23],[.53+i*.16,-.055],[.43+i*.16,-.07]]);
  }else if(shape==='vertical'){
   panel([[.72,-.32],[.89,-.29],[.89,.00],[.74,-.015]]);
  }else if(shape==='swept'){
   panel([[.34,-.16],[.46,-.18],[.85,-.095],[.87,-.025],[.64,-.06]]);
  }else if(shape==='bracket'){
   panel([[.46,-.055],[.88,-.055],[.90,-.285],[.76,-.29],[.76,-.115],[.46,-.115]]);
  }else{
   panel([[.44,-.185],[.86,-.185],[.86,-.072],[.44,-.072]]);
  }
 }
 const signature={
  civic:['swept','bracket'],corolla:['swept','swept'],prius:['swept','vertical'],golf:['rect','rect'],
  mini:['round','vertical'],mustang:['swept','triple'],miata:['swept','roadster'],nineeleven:['round','swept'],
  volvo240:['rect','vertical'],rav4:['swept','bracket'],wrangler:['round','rect'],f150:['bracket','vertical']
 }[id];
 for(const side of [-1,1]){lens(side,true,signature[0]);lens(side,false,signature[1]);}
 const y=s.nose;
 if(id==='wrangler'){
  for(let k=-3;k<=3;k++)flat(2,k*.091-.025,k*.091+.025,y-.265,y-.052,zf+.016,true);
 }else if(id==='mini'){
  oval(2,0,y-.20,.73,.19,zf+.016);
  for(let k=0;k<3;k++)flat(0,-.31,.31,y-.26+k*.05,y-.248+k*.05,zf+.023,true);
 }else if(id==='miata' || id==='nineeleven'){
  oval(2,0,s.gc+.14,s.W*.43,.11,zf+.018);
  if(id==='nineeleven')flat(4,-W*.77,W*.77,s.tail-.13,s.tail-.097,-zf-.022,false);
 }else{
  const big=id==='f150'||id==='volvo240',upper=big?y-.07:y-.13,lower=big?y-.33:y-.245;
  const w=id==='mustang'?.51:id==='corolla'?.68:.43;
  face(2,[[-W*w,upper],[W*w,upper],[W*(w-.11),lower],[-W*(w-.11),lower]],zf+.015);
  for(let n=0;n<(big?3:1);n++){
   const a=lower+.045+n*.065;flat(0,-W*(w-.10),W*(w-.10),a,a+.014,zf+.022,true);
  }
  if(id==='volvo240')face(0,[[-.30,lower+.015],[-.25,lower+.015],[.30,upper-.018],[.25,upper-.018]],zf+.028);
 }
 if(s.roofRails){
  for(const side of [-1,1]){
   box(2,side*W*.74,s.r+.065,-.12,.043,.052,s.L*.38);
   for(const z of [-s.L*.19-.08,s.L*.19-.14])box(2,side*W*.74,s.r+.035,z,.09,.08,.10);
  }
 }
 if(id==='mini' || id==='wrangler'){
  const a=-h+s.tr+s.rg+.07,b=h-s.hood-s.ws;
  box(2,0,s.r+.003,(a+b)*.5,W*1.56,.045,b-a);
 }
 if(s.form==='roadster'){
  const baseZ=h-s.hood-.06,topZ=baseZ-.41;
  polygon(1,[[-W*.88,s.hb+.015,baseZ],[W*.88,s.hb+.015,baseZ],[W*.72,s.r-.035,topZ],[-W*.72,s.r-.035,topZ]]);
  box(2,0,s.r-.020,topZ,W*1.47,.035,.044);
  box(2,0,s.hb-.042,.35,W*1.58,.10,.35);
  box(2,W*.44,s.hb+.015,.235,.06,.07,.20);
  for(const vx of [-.52,-.07,.074]){
   oval(2,vx,s.hb-.034,.092,.092,.171);
   oval(0,vx,s.hb-.034,.078,.078,.168);
   for(const y of [-.018,0,.018])box(2,vx,s.hb-.034+y,.164,.059,.011,.009);
  }
  function pad(cx,levels){
   const rings=levels.map(([y,z,w,d])=>[[-.72,-1],[.72,-1],[1,-.64],[1,.64],[.72,1],[-.72,1],[-1,.64],[-1,-.64]]
    .map(([u,v])=>[cx+u*w,y,z+v*d]));
   polygon(2,rings[0]);
   for(let k=1;k<rings.length;k++)for(let n=0;n<8;n++){
    const j=(n+1)%8;polygon(2,[rings[k-1][n],rings[k-1][j],rings[k][j],rings[k][n]]);
   }
   polygon(2,rings[rings.length-1]);
  }
  for(const side of [-1,1]){
   polygon(2,[[side*W*.91,s.hb,baseZ],[side*W*.84,s.hb,baseZ],[side*W*.69,s.r,topZ],[side*W*.76,s.r,topZ]]);
   const cx=side*W*.44;
   pad(cx,[[s.gc+.11,-.25,.226,.27],[s.gc+.168,-.25,.233,.27],[s.gc+.205,-.24,.195,.24]]);
   pad(cx,[[s.gc+.16,-.52,.19,.091],[s.gc+.31,-.55,.228,.094],[s.hb+.015,-.64,.189,.079],
    [s.hb+.16,-.665,.12,.073],[s.hb+.205,-.68,.091,.053]]);
   for(const rail of [-1,1])pad(cx+rail*.183,[[s.gc+.183,-.22,.043,.205],[s.gc+.239,-.24,.034,.17]]);
   polygon(2,[[cx-.24,s.hb+.005,baseZ-.044],[cx+.20,s.hb+.016,baseZ-.058],
    [cx+.19,s.hb+.028,baseZ-.068],[cx-.24,s.hb+.019,baseZ-.054]]);
  }
 }
 if(s.form==='pickup'){
  const rear=-h+.15,front=-h+s.tr-.07;
  for(let k=-5;k<=5;k++)box(2,k*W*.128,s.gc+.496,(rear+front)/2,.052,.026,front-rear);
  box(2,0,s.tail-.17,-zf-.02,.34,.055,.025);
  for(const side of [-1,1])box(2,side*(W+.018),s.gc+.03,.1,.12,.08,2.36);
 }
 if(s.form==='offroad'){
  const spareY=s.hb-.065;
  oval(2,0,spareY,s.wr*1.93,s.wr*1.93,-zf-.13);
  const sides=18,r=s.wr*.965;
  for(let k=0;k<sides;k++){
   const a=k*2*Math.PI/sides,b=(k+1)*2*Math.PI/sides;
   polygon(2,[[r*Math.cos(a),spareY+r*Math.sin(a),-zf+.035],[r*Math.cos(b),spareY+r*Math.sin(b),-zf+.035],
    [r*Math.cos(b),spareY+r*Math.sin(b),-zf-.13],[r*Math.cos(a),spareY+r*Math.sin(a),-zf-.13]]);
  }
  oval(0,0,spareY,s.wr*1.03,s.wr*1.03,-zf-.136);
  for(let k=0;k<5;k++){
   const a=k*Math.PI*.4;oval(2,.136*Math.cos(a),spareY+.136*Math.sin(a),.072,.072,-zf-.143);
  }
  for(const side of [-1,1])box(2,side*(W+.025),s.gc+.04,-.12,.12,.082,1.9);
 }
}
const AMBER_LAMP=new THREE.MeshBasicMaterial({color:new THREE.Color(2.15,.64,.045)});
const INDICATOR_GEOMETRY=new Map();
function makeTurnLamps(s){
 if(!INDICATOR_GEOMETRY.has(s.type)){
  const a=new THREE.BoxGeometry(.10,.049,.04),b=a.clone();
  a.translate(0,s.nose-.175,s.L*.5+.032);b.translate(0,s.tail-.18,-s.L*.5-.033);
  INDICATOR_GEOMETRY.set(s.type,mergeGeos([a,b]));a.dispose();b.dispose();
 }
 function side(sign){const mesh=new THREE.Mesh(INDICATOR_GEOMETRY.get(s.type),AMBER_LAMP);
  mesh.position.x=sign*s.W*.435;mesh.visible=false;return mesh;}
 // For a car pointing +z, its driver's right is the negative local x direction.
 return {right:side(-1),left:side(1)};
}
function togglePlayerSignal(c,direction){
 if(!c || c.driver!=='player' || c.dead)return;
 c.playerSignal=c.playerSignal?.direction===direction?null:{direction,yaw:c.h,turned:false};
 c.indicating=c.playerSignal?.direction||0;
}
function updateTurnLamps(c,t){
 if(c.driver==='player'){
  const signal=c.playerSignal;
  if(signal){
   if(-signal.direction*wrapA(c.h-signal.yaw)>.58)signal.turned=true;
   if(signal.turned && Math.abs(c.steerA)<.065)c.playerSignal=null;
  }
  c.indicating=c.playerSignal?.direction||0;
 }else c.playerSignal=null;
 const direction=c.driver && !c.dead && !c.siren?c.indicating||0:0;
 if(c.lastIndicator!==direction){c.lastIndicator=direction;c.indicatorSince=t;}
 const lit=direction && (t-c.indicatorSince)%.72<.36;
 c.turnLamps.left.visible=!!(lit && direction<0);
 c.turnLamps.right.visible=!!(lit && direction>0);
}

function removeSeatedDriver(c){
 if(!c.seatedDriver)return;
 const {model}=c.seatedDriver;
 c.mesh.remove(model);
 const skeletons=new Set();
 model.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
 for(const skeleton of skeletons)skeleton.dispose();
 c.seatedDriver=null;
}
let steeringWheelGeometry;
function makeRoadsterWheel(s){
 if(!steeringWheelGeometry){
  const rim=new THREE.TorusGeometry(.153,.012,8,32),hub=new THREE.CylinderGeometry(.046,.046,.033,12);
  hub.rotateX(Math.PI/2);
  const pieces=[rim,hub];
  for(const angle of [Math.PI/12,Math.PI-Math.PI/12,-Math.PI/2]){
   const spoke=new THREE.BoxGeometry(.115,.024,.022);
   spoke.translate(.093,0,0);spoke.rotateZ(angle);pieces.push(spoke);
  }
  steeringWheelGeometry=mergeGeos(pieces);pieces.forEach(p=>p.dispose());
 }
 const wheel=new THREE.Mesh(steeringWheelGeometry,darkMat);
 wheel.position.set(s.W*.22,s.hb+.032,.12);wheel.rotation.x=.396;return wheel;
}
let dialMaterial,dialGeometry,needleGeometry;
const dialNeedleMaterial=new THREE.MeshBasicMaterial({color:0xe45f3b});
function roadsterInstruments(s){
 const width=.334,height=.135;
 if(!dialMaterial){
  const [canvas,g]=cvs(448,180);
  for(const [cx,r,max,increment,label] of [[121,85,8,1,'×1000 r/min'],[324,72,240,20,'km/h']]){
   const cy=92;
   g.fillStyle='#292d31';g.beginPath();g.arc(cx,cy,r,0,2*Math.PI);g.fill();
   g.fillStyle='#101419';g.beginPath();g.arc(cx,cy,r-4,0,2*Math.PI);g.fill();
   for(let n=0;n<=max/increment*4;n++){
    const value=n*increment/4,angle=(140+260*value/max)*Math.PI/180,major=n%4===0;
    const x=Math.cos(angle),y=Math.sin(angle);
    g.lineWidth=major?2.7:1.3;g.strokeStyle=max===8 && value>=7?'#df6b55':'#dadbd7';
    g.beginPath();g.moveTo(cx+x*(r-10),cy+y*(r-10));g.lineTo(cx+x*(r-(major?20:15)),cy+y*(r-(major?20:15)));g.stroke();
    if(major && (max===8 || value%40===0)){
     g.fillStyle=g.strokeStyle;g.font='600 13px sans-serif';g.textAlign='center';g.textBaseline='middle';
     g.fillText(String(value),cx+x*(r-31),cy+y*(r-31));
    }
   }
   g.fillStyle='#aaaead';g.font='11px sans-serif';g.fillText(label,cx,cy+25);
  }
  dialMaterial=new THREE.MeshBasicMaterial({map:ctex(canvas),alphaTest:.4});
  dialGeometry=new THREE.PlaneGeometry(width,height);
  needleGeometry=new THREE.BufferGeometry();
  needleGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.004,-.011,0,.003,-.011,0,.0008,.050,0],3));
 }
 const group=new THREE.Group();
 group.rotation.order='YXZ';group.rotation.set(-.23,Math.PI,0);
 group.position.set(s.W*.22,s.hb+.066,.268);
 group.add(new THREE.Mesh(dialGeometry,dialMaterial));
 const needles=[121,324].map((cx,i)=>{
  const mesh=new THREE.Mesh(needleGeometry,dialNeedleMaterial);
  mesh.position.set((cx/448-.5)*width,(.5-92/180)*height,.0015);
  if(i)mesh.scale.y=.84;group.add(mesh);return mesh;
 });
 return {group,needles};
}
function enginePitch(speed){
 const gear=Math.min(5,Math.floor(speed/9));
 return .25+(speed-gear*9)/9*.75+(gear===0?0:.15);
}
function updateRoadsterDials(c){
 const [tach,speed]=c.instruments.needles,metresPerSecond=Math.abs(c.speed);
 const needleAngle=fraction=>-(230+260*clamp(fraction,0,1))*Math.PI/180;
 tach.rotation.z=needleAngle(c.driver && !c.dead?clamp((enginePitch(metresPerSecond)-.25)*.75+.106,0,.94):0);
 speed.rotation.z=needleAngle(metresPerSecond*3.6/240);
}
function placeDriverHand(bones,side,target,carRotation){
 const arm=bones[BMAP[side+'Arm']],elbow=bones[BMAP[side+'ForeArm']],hand=bones[BMAP[side+'Hand']];
 const shoulder=arm.getWorldPosition(new V3()),joint=elbow.getWorldPosition(new V3()),end=hand.getWorldPosition(new V3());
 const upper=shoulder.distanceTo(joint),lower=joint.distanceTo(end),reach=target.clone().sub(shoulder);
 const length=clamp(reach.length(),Math.abs(upper-lower)+.001,upper+lower-.001);
 reach.normalize();
 const along=(upper*upper-lower*lower+length*length)/(2*length);
 const out=new V3(side==='Left'?.65:-.65,-1,-.10).applyQuaternion(carRotation);
 out.addScaledVector(reach,-out.dot(reach)).normalize();
 const bend=reach.clone().multiplyScalar(along).addScaledVector(out,Math.sqrt(Math.max(0,upper*upper-along*along)));
 pointBone(arm,elbow,bend);pointBone(elbow,hand,target.clone().sub(elbow.getWorldPosition(new V3())));
}
function updateDriverSteering(c){
 const angle=clamp(-c.steerA*5.2,-1.22,1.22),seat=c.seatedDriver;
 if(Math.abs(angle-seat.angle)<.035)return;
 seat.angle=angle;c.steeringWheel.rotation.z=angle;c.mesh.updateWorldMatrix(true,true);
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const grip=c.steeringWheel.localToWorld(new V3(sign*.135,.072,-.012));
  placeDriverHand(seat.bones,side,grip,c.mesh.quaternion);
 }
}

function updateSeatedDriver(c){
 const role=c.driver && !c.dead && c.phys?c.driver:null;
 if((c.seatedDriver?.role||null)===role){if(role)updateDriverSteering(c);return;}
 removeSeatedDriver(c);
 if(!role)return;
 const name=role==='player'?player.c.name:(c.civilianDriverName ||= pickChar('m'));
 const model=THREE.SkeletonUtils.clone(TPL[name].scene);
 model.updateMatrixWorld(true);
 const bones=nodeMap(model);
 pointBone(bones[BMAP.Spine],bones[BMAP.Spine1],new V3(0,.96,-.28));
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const pose=(joint,end,dir)=>pointBone(bones[BMAP[side+joint]],bones[BMAP[side+end]],dir);
  pose('UpLeg','Leg',new V3(sign*.08,-.17,.96));
  pose('Leg','Foot',new V3(0,-.79,.56));
 }
 const hips=bones[BMAP.Hips].getWorldPosition(new V3());
 const wheelX=c.spec.W*.22;
 model.position.add(new V3(wheelX,c.spec.gc+.264,-.32).sub(hips));model.updateMatrixWorld(true);
 // The standing bind-pose bounds exclude the seated arms close to the cockpit camera.
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
 c.mesh.add(model);
 c.seatedDriver={role,model,bones,angle:NaN};updateDriverSteering(c);
}

function addNeighborhoodCars(){
 // Keep the first shop block populated, with parked vehicles outside the crossing sight lines.
 for(const [id,side,t,color] of [['miata',-1,39,0x315856],['mini',1,25,0xefe4c1]]){
  const x=4*CELL+side*ROAD_SECTIONS.collector.parking,z=5*CELL+t;
  if(!nearDriveway(x,z,2.8))paintCar(spawnCar(id,x,z,side<0?0:Math.PI,null),color);
 }
 for(const [id,from,to,t,color] of [['civic',6,5,.43,0xb7bec1],['golf',5,6,.63,0x23465c]]){
  const a=[4,from],b=[4,to],dz=to-from,section=segmentSection(a,b);
  const c=spawnCar(id,4*CELL-dz*laneCenter(section,0,dz),lerp(from,to,t)*CELL,dz>0?0:Math.PI,'ai');
  c.ai={a,b};c.speed=trafficEntrySpeed(c);paintCar(c,color);
 }
}
