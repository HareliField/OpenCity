/* Old Town civic building. Coordinates are metres from the street-facing facade. */
const HQ_FLOORS=['Public services','Investigations','Watch operations','Staff and equipment'];
const HQ_STOREY=3.65;
const hqPanels=new Map();

function hqGraphic(kind){
 if(hqPanels.has(kind))return hqPanels.get(kind);
 const [canvas,g]=cvs(768,384),cream='#eee5ce',gold='#d8b676',ink='#173642';
 g.fillStyle=ink;g.fillRect(0,0,768,384);g.textBaseline='middle';
 const text=(s,x,y,size,color=cream)=>{g.fillStyle=color;g.font='600 '+size+'px Arial';g.fillText(s,x,y);};
 if(kind==='seal'){
  g.strokeStyle=gold;g.lineWidth=5;g.beginPath();g.moveTo(45,65);g.quadraticCurveTo(120,48,172,70);
  g.lineTo(166,158);g.quadraticCurveTo(155,193,110,219);g.quadraticCurveTo(54,190,47,153);g.closePath();g.stroke();
  g.fillStyle=gold;g.beginPath();g.moveTo(73,142);g.lineTo(110,96);g.lineTo(151,142);g.fill();g.fillRect(72,151,78,6);
  text('OLD TOWN',209,112,74);text('POLICE DEPARTMENT',210,180,41,gold);
  g.fillStyle=gold;g.fillRect(45,258,670,3);text('Public reception',48,309,35);
 }else if(kind==='directory'){
  text('BUILDING DIRECTORY',35,46,36,gold);
  HQ_FLOORS.forEach((v,i)=>{const y=118+i*64;text(i?'0'+(i+1):'G',37,y,25,gold);text(v,110,y,32);g.fillStyle='#49616a';g.fillRect(35,y+29,685,2);});
 }else if(kind==='map'){
  g.fillStyle='#d8dacb';g.fillRect(0,0,768,384);
  g.fillStyle='#90b6bd';g.beginPath();g.moveTo(620,0);g.lineTo(768,0);g.lineTo(768,384);g.lineTo(520,384);g.bezierCurveTo(550,260,660,201,620,0);g.fill();
  g.save();g.rotate(-.14);for(let i=0;i<17;i++)for(let j=0;j<10;j++){
   const x=i*40-45,y=j*37+15;if(x>555)continue;
   g.fillStyle=(i+j*7)%11===0?'#89a691':'#b6c3b5';g.fillRect(x,y,31,28);
  }g.restore();g.fillStyle=ink;g.fillRect(0,0,768,52);text('CITY DISTRICTS   /   WATCH MAP',24,27,24);
 }else if(kind==='screen'){
  text('CITY POLICE   /   OPERATIONS',28,37,24,gold);
  for(let i=0;i<7;i++){g.fillStyle=i%2?'#254954':'#30535c';g.fillRect(24,74+i*40,465,29);
   g.fillStyle=i===2?'#deb66f':'#86b7ad';g.fillRect(33,81+i*40,9,12);g.fillRect(60,86+i*40,98+i%3*32,3);}
  for(let i=0;i<10;i++){g.fillStyle='#6d969c';g.fillRect(540+i*17,280-i%4*25,11,36+i%4*25);}
 }else{
  g.fillStyle='#ba9367';g.fillRect(0,0,768,384);
  for(let i=0;i<9;i++){let x=24+(i%5)*145,y=24+Math.floor(i/5)*184;g.save();g.translate(x,y);g.rotate((i%3-1)*.035);
   g.fillStyle=i%3?'#ebe8db':'#cdd9de';g.fillRect(0,0,112,143);g.fillStyle='#56676b';g.fillRect(12,18,70,7);
   for(let j=0;j<6;j++)g.fillRect(12,40+12*j,78-j%3*11,3);g.fillStyle='#883b37';g.fillRect(52,6,6,6);g.restore();}
 }
 const mat=new THREE.MeshBasicMaterial({map:ctex(canvas)});
 hqPanels.set(kind,mat);return mat;
}

function hqCirculation(M){
 return {
  shaft:lrect(M,4.51,7.69,8.55,11.73),
  stairs:[lrect(M,-16.8,-9.4,4.95,6.53),lrect(M,-16.8,-9.4,6.62,8.20)]
 };
}
function furnishHeadquarters(block,M,side,box,sign,solid,station){
 const m=INTERIORS.materials;
 const paint=color=>new THREE.MeshStandardMaterial({color:lin(color),roughness:.78});
 const blue=paint(0x284959),limestone=paint(0xc8bda5),pale=paint(0xd6d6cb),brass=paint(0xae9362);
 const base=.15,level=i=>base+i*HQ_STOREY;
 const {shaft,stairs}=hqCirculation(M);
 const bounds=lrect(M,-18.95,18.95,4.03,31.96);
 const levels=HQ_FLOORS.map((_,i)=>level(i));
 CITY_WORKS.walkups.push(bounds);
 station.terminals=[];
 station.lift=buildLift(shaft,levels,HQ_FLOORS);
 station.lift.selectFloor=f=>chooseHqFloor(station,f);
 function ceilingPart(mat,u0,u1,y0,y1,v0,v1,holes){
  for(const r of subtractCityOpenings(lrect(M,u0,u1,v0,v1),holes)){
   plainBox(mat,r.x0,r.x1,y0,y1,r.z0,r.z1,{uvm:2.6,shadow:false});
  }
 }
 function panel(kind,x,y,v,w,h){
  const p=lpt(M,x,v),g=new THREE.PlaneGeometry(w,h);g.rotateY(SIDEANG[side]);g.translate(p.x,y,p.z);
  addGeo(hqGraphic(kind),g,false);
 }
 function point(x,v,f){const p=lpt(M,x,v);p.y=level(f);return p;}
 function light(x,v,f,w=1.45){
  const y=level(f)+3.27,p=lpt(M,x,v);
  box(m.steel,x-w/2-.045,x+w/2+.045,y,y+.10,v-.24,v+.24);
  box(m.neutral,x-w/2,x+w/2,y-.016,y,v-.2,v+.2);
  INTERIORS.emitters.push({x:p.x,y:y-.05,z:p.z,cool:f>0,floorY:level(f)});
 }
 function wall(x0,x1,v0,v1,f){
  const y=level(f);solid(pale,x0,x1,y,y+3.38,v0,v1);
  box(blue,x0-.012,x1+.012,y+.05,y+.16,v0-.012,v1+.012);
 }
 function seat(x,v,f){placeRoomFurniture(block,M,'seat',x,v,level(f),[.61,.88,.6]);}
 function desk(x,v,f,w=2.35){
  const y=level(f);
  solid(m.wood,x-w/2,x+w/2,y+.73,y+.80,v-.48,v+.50);
  for(const edge of [-1,1])box(m.steel,x+edge*(w/2-.12)-.04,x+edge*(w/2-.12)+.04,y,y+.74,v-.36,v+.37);
  box(m.steel,x+.36,x+.86,y+.08,y+.69,v-.37,v+.4);
  for(const h of [.26,.45,.63])box(m.black,x+.48,x+.73,y+h,y+h+.018,v-.39,v-.36);
 }
 function monitor(x,v,f,wide=.65){
  const y=level(f)+.81;box(m.black,x-.16,x+.16,y,y+.025,v-.09,v+.12);
  box(m.steel,x-.032,x+.032,y+.02,y+.19,v,v+.055);
  box(m.black,x-wide/2,x+wide/2,y+.11,y+.50,v-.03,v+.045);
  panel('screen',x,y+.31,v-.035,wide-.035,.35);
  box(m.rubber,x-.20,x+.2,y,y+.018,v-.32,v-.2);
 }
 function bank(x,v,f,count,kind){
  const y=level(f);
  for(let i=0;i<count;i++){
   const a=x+i*.86;solid(kind==='lockers'?blue:m.steel,a,a+.83,y,y+2.12,v,v+.64);
   for(let j=0;j<(kind==='lockers'?1:4);j++){const top=y+2.06-j*.49;
    box(m.chrome,a+.29,a+.51,top-.23,top-.21,v-.044,v);
    box(m.cream,a+.32,a+.49,top-.15,top-.09,v-.016,v);
    box(m.black,a+.04,a+.79,top-.47,top-.46,v-.009,v);
   }
   if(kind==='lockers')for(let j=0;j<4;j++)box(m.rubber,a+.19,a+.63,y+1.72+j*.055,y+1.74+j*.055,v-.012,v);
  }
 }
 function post(role,room,x,v,f,activity,walk=1){
  station.posts.push({role,room,point:point(x,v,f),yaw:SIDEANG[side],actor:null,member:null,activity,
   workEnd:point(x+walk,v,f),cameraStand:point(x+2.85,v-2.8,f),floor:f});
 }
 function terminal(label,view,x,v,f){station.terminals.push({label,view,point:point(x,v,f)});}
 function bulletin(kind,x,v,y,w,h){
  box(m.wood,x-w/2-.04,x+w/2+.04,y-h/2-.04,y+h/2+.04,v,v+.10);panel(kind,x,y,v-.012,w,h);
 }
 // A stone canopy, recessed soffit and municipal signage frame the public entrance.
 box(limestone,-6.6,6.6,3.37,3.60,.55,4.05);box(blue,-6.65,6.65,3.52,3.71,.5,4);
 for(const x of [-6.2,6.2]){
  solid(limestone,x-.18,x+.18,.15,3.4,.88,1.24);
  placeRoomFurniture(block,M,'plant',x+(x<0?-1:1),2.25,.15,[.85,1.05,.85]);
 }
 sign('OLD TOWN HEADQUARTERS',0,5.48,3.74,10.8,.98);
 // Upper storeys use independent floor contacts, so pedestrians below them stay on the ground.
 for(let f=0;f<4;f++){
  const y=level(f);
  const openings=f===3?[]:[shaft,stairs[f%2]];
  if(f<3)worksFlight(stairs[f%2],y,level(f+1),f%2===1);
  if(f){
   const floorHoles=[shaft,stairs[(f-1)%2]];
   if(f<3)floorHoles.push(stairs[f%2]);
   worksSlab(bounds,y,m.tile,floorHoles);
   for(const x of [-18.85,18.85])wall(x-.08,x+.08,4.1,31.85,f);
   for(const v of [4.16,31.82])wall(-18.85,18.85,v,v+.14,f);
   ceilingPart(m.ceiling,-18.85,18.85,y+3.39,y+3.46,4.22,31.76,openings);
  }
  // Suspended ceiling runners, room skirting and acoustic tile joints.
  for(let x=-18;x<=18;x+=2.4)ceilingPart(m.steel,x,x+.018,y+3.375,y+3.395,4.22,31.70,openings);
  for(let v=5;v<32;v+=1.2)ceilingPart(m.steel,-18.72,18.72,y+3.377,y+3.397,v,v+.016,openings);
  for(const x of [-12,0,12])for(const v of [7,15.3,24.5,29])if(x!==-12||v!==7)light(x,v,f);
  sign('LIFT   '+(f+1),6.1,y+2.83,8.48,1.4,.32);
  sign('STAIRS',-8.35,y+2.48,8.48,1.1,.3);
  // Front-to-back circulation through a transverse gallery, with wide side-room entrances.
  for(const [a,b] of [[-18.8,-13.5],[-10.9,-1.2],[1.2,9.8],[12.4,18.8]])wall(a,b,16,16.17,f);
  for(const x of [-5,5])wall(x-.08,x+.08,17.9,31.75,f);
  for(const x of [-12,12])light(x,20.5,f);
 }
 // Public lobby with a ribbed backdrop, civic seal, accessible counter and waiting area.
 solid(blue,-4.4,4.4,.15,2.98,13.05,13.26);
 for(let i=0;i<32;i++){const x=-4.30+i*.27;box(m.wood,x,x+.065,.22,2.9,12.99,13.06);}
 panel('seal',0,1.97,12.96,4.35,1.72);
 solid(limestone,-2.96,2.96,.15,1.08,10,10.92);box(m.darkWood,-3.02,3.02,1.08,1.15,9.96,10.96);
 box(brass,-2.93,2.93,.25,.29,9.98,10.0);sign('PUBLIC RECORDS',0,.75,9.97,2.1,.28);
 desk(-4.25,10.5,0,2.36);monitor(-4.6,10.6,0);
 for(const x of [-15,-13.9,-12.8,-11.7,-10.6])seat(x,9.2,0);
 for(const x of [-15,-13.9,-12.8,-11.7,-10.6])seat(x,12,0);
 bulletin('directory',-8,12.9,1.72,2.65,1.32);bulletin('notice',13,12.9,1.62,3.2,1.5);
 post('Patrol','Public records',-1.5,11.8,0,'taking a statement',2.1);
 // Booking, short-stay holding and private interview.
 desk(-12,21,0);monitor(-12.35,21,0);bank(-16,29.3,0,5,'files');sign('BOOKING',-12,2.61,20.95,2.5,.4);
 terminal('BOOKING LOG','Booking',-12,19.9,0);post('Patrol','Booking',-12,22.2,0,'checking custody records',1.4);
 solid(pale,6,18.7,.15,.67,24.4,24.56);solid(pale,6,18.7,2.68,3.51,24.4,24.56);
 solid(m.glass,6.1,18.6,.68,2.67,24.45,24.49);
 solid(m.steel,11.3,17.9,.16,.63,29.6,30.2);
 for(let i=0;i<28;i++){const x=6.5+i*.42;box(m.steel,x,x+.043,.19,2.73,24.57,24.64);}
 sign('CUSTODY',12,2.64,24.36,2.4,.38);
 desk(0,26,0,2.25);seat(-.55,24.8,0);seat(.55,27.25,0);sign('INTERVIEW',0,2.65,25.92,2.3,.35);
 // Investigations, exhibit storage and instrument bench.
 for(const x of [-12,-8,9,13]){desk(x,11.2,1);monitor(x-.28,11.2,1);seat(x,12.4,1);}
 bulletin('notice',-12,14.5,level(1)+1.8,3.4,1.55);
 post('Detectives','Detective bureau',-13.1,12.5,1,'reviewing witness statements',.85);
 terminal('CASE FILES','Cases',-12,10.2,1);
 for(const x of [8,11.3,14.6]){desk(x,23.5,1,3.23);monitor(x-.78,23.5,1);
  const y=level(1)+.81;box(m.ceramic,x+.15,x+.79,y,y+.09,23.15,23.76);
  box(m.steel,x+.35,x+.46,y+.09,y+.43,23.56,23.66);
  box(m.black,x+.20,x+.54,y+.41,y+.51,23.28,23.64);}
 bank(7.3,29.6,1,11,'files');sign('FORENSIC SERVICES',12,level(1)+2.50,23.35,3.7,.42);
 station.exhibitBench=point(10.65,23.32,1);station.exhibitBench.y+=1.14;
 post('Forensics','Evidence laboratory',10,24.85,1,'examining an exhibit',2.0);
 terminal('EVIDENCE REGISTER','Evidence',11.3,22.45,1);
 bank(-16.8,28.8,1,11,'files');desk(-12,22.5,1);monitor(-12,22.5,1);sign('EXHIBIT INTAKE',-12,level(1)+2.5,22.3,3.1,.42);
 // Watch floor. Each console has its own displays; the briefing gallery faces the city map.
 for(const x of [-12,-8.7]){desk(x,22.5,2,3.18);monitor(x-.67,22.5,2);monitor(x+.13,22.5,2);}
 bulletin('map',-11,28,level(2)+1.97,5.4,2.18);
 const consoleSeat=point(-12,21.52,2),chairFrame=new THREE.Matrix4().makeRotationY(SIDEANG[side]+Math.PI);
 chairFrame.setPosition(consoleSeat.x,0,consoleSeat.z);placeRoomFurniture(block,chairFrame,'seat',0,0,level(2),[.66,.91,.61]);
 post('Communications','Dispatch',-12,21.52,2,'monitoring calls',0);
 station.posts[station.posts.length-1].seated=true;station.posts[station.posts.length-1].yaw+=Math.PI;terminal('CALL LOG','Radio',-10.85,21.44,2);
 desk(11,22.3,2);monitor(10.7,22.3,2);bulletin('notice',12,29,level(2)+1.9,3.6,1.7);
 post('Command','Watch command',10.4,23.55,2,'reviewing assignments',2.15);
 terminal('WATCH BOARD','Watch',11,21.2,2);
 for(const v of [8.7,11,13.25])for(const x of [-15,-13.5,-12,-10.5,-9])seat(x,v,2);
 bulletin('map',-12,14.65,level(2)+1.82,4.7,1.9);sign('ROLL CALL',-12,level(2)+2.97,14.58,2.2,.33);
 // Support floor: equipment issue, air-support planning, lockers and a staff mess.
 bank(-17,29,3,12,'lockers');bank(-16.8,14,3,7,'lockers');
 desk(-12,22.4,3,3.4);monitor(-12.8,22.4,3);
 for(const x of [-12,-11.7,-11.4])box(m.black,x,x+.14,level(3)+.81,level(3)+1.06,22.17,22.30);
 sign('EQUIPMENT ISSUE',-12,level(3)+2.52,22.3,3,.37);
 post('Metro SWAT','Equipment issue',-12.5,23.65,3,'checking issued equipment',1.3);
 terminal('ISSUE LEDGER','Equipment',-12,21.25,3);
 desk(11.3,22.4,3);monitor(11,22.4,3);bulletin('map',12,28.7,level(3)+1.8,4,1.65);
 post('Air Support','Flight desk',11,23.6,3,'reviewing the flight board',1.25);
 for(const x of [10,14]){placeRoomFurniture(block,M,'reading-table',x,12,level(3),[1.35,.74,1.35]);seat(x,10.9,3);seat(x,13.1,3);}
 for(let f=1;f<4;f++)sign(HQ_FLOORS[f].toUpperCase(),0,level(f)+2.6,15.90,4.3,.48);
}

function stationReach(pos,at,r){
 return Math.abs(pos.y-at.y)<.85&&dist2(pos,at)<r&&rayWorld(pos.x,pos.z,at.x,at.z,pos.y+1.25,at.y+1.25)>=1;
}
function hqInteraction(pos){
 for(const station of PoliceDepartment.stations){
  if(!station.lift)continue;
  const f=Math.round((pos.y-.15)/HQ_STOREY);
  if(f<0||f>3)continue;
  const terminal=station.terminals.find(t=>stationReach(pos,t.point,1.85));
  if(terminal)return {label:terminal.label,hot:true,fn:()=>openPoliceDesk(station,terminal.view)};
 }
 return null;
}
function chooseHqFloor(station,current){
 const dialog=document.createElement('dialog');dialog.className='hqLift';dialog.setAttribute('aria-label','Headquarters lift');
 const title=document.createElement('h2');title.textContent='Headquarters lift';dialog.append(title);
 for(const [f,name] of HQ_FLOORS.entries()){
  const b=document.createElement('button');b.type='button';b.textContent=(f+1)+'   '+name;b.disabled=f===current;
  b.onclick=()=>{
   if(liftPowered(station.lift))station.lift.target=f;
   else toast('Lift power is off · stairs are open',1700);
   dialog.close();
  };dialog.append(b);
 }
 const close=document.createElement('button');close.textContent='Cancel';close.onclick=()=>dialog.close();dialog.append(close);
 dialog.addEventListener('close',()=>{shopOpen=false;dialog.remove();},{once:true});
 document.body.append(dialog);shopOpen=true;dialog.showModal();
}

function officerModel(member,onDuty=true){
 const roster=onDuty?{
  Patrol:['Police_Male_01'],Command:['Police_Male_01'],'Metro SWAT':['Police_Male_02'],
  Detectives:['Business_Male_01','Business_Female_01','Business_Male_02','Business_Female_02'],
  Forensics:['Medical_Female_01','Medical_Male_01'],
  Communications:['Female_Adult_03','Male_Adult_08','Business_Female_01'],
  'Air Support':['Male_Adult_04','Female_Adult_07','Security_Male_01']
 }[member.division]:['Male_Adult_04','Female_Adult_03','Male_Adult_08','Female_Adult_07','Business_Male_01','Business_Female_01'];
 const names=roster.filter(name=>TPL[name]);
 return names.length?names[(member.badge*7)%names.length]:pickChar('m');
}

function personalizeOfficer(c,member){
 // The uniform and head meshes use the Rocketbox rig. Retain each portrait's own UVs and skin.
 const uniform=['Patrol','Command','Metro SWAT'].includes(member.division)&&c.name.startsWith('Police_');
 if(uniform&&member.division!=='Metro SWAT'){
  const faces=['Male_Adult_04','Male_Adult_08','Male_Adult_01','Business_Male_01','Male_Adult_03','Male_Adult_07'].filter(n=>TPL[n]);
  const donor=faces.length&&TPL[faces[member.badge%faces.length]].scene;
  let original,portrait;
  c.model.traverse(o=>{if(o.isSkinnedMesh&&/_head$/i.test(o.material?.name))original=o;});
  if(donor)donor.traverse(o=>{if(o.isSkinnedMesh&&/_head$/i.test(o.material?.name))portrait=o;});
  if(original&&portrait){
   const byName=new Map(original.skeleton.bones.map(b=>[b.name,b]));
   const bones=portrait.skeleton.bones.map(b=>byName.get(b.name));
   if(bones.every(Boolean)){
    const mesh=new THREE.SkinnedMesh(portrait.geometry,portrait.material);
    mesh.position.copy(original.position);mesh.scale.copy(original.scale);mesh.quaternion.copy(original.quaternion);
    mesh.bind(new THREE.Skeleton(bones,portrait.skeleton.boneInverses),portrait.bindMatrix);
    mesh.layers.mask=original.layers.mask;mesh.frustumCulled=false;mesh.castShadow=original.castShadow;
    original.parent.add(mesh);original.visible=false;c.portraitSkeleton=mesh.skeleton;
   }
  }
 }
 const size=.96+(member.badge%7)*.012;c.root.scale.set(size,(.96+(member.badge%9)*.012),size);
}

const officerProps=new Map();
function officerAccessory(kind){
 if(officerProps.has(kind))return officerProps.get(kind).clone();
 const group=new THREE.Group(),coal=policeGearMaterial,metal=gunMat;
 const piece=(mat,geom,x,y,z)=>{const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);group.add(m);return m;};
 const box=(mat,x,y,z,w,h,d)=>piece(mat,new THREE.BoxGeometry(w,h,d),x,y,z);
 if(kind==='headset'){
  const band=new THREE.TorusGeometry(.109,.007,7,20,Math.PI);piece(coal,band,0,.013,0);
  for(const x of [-.105,.105])piece(coal,new THREE.SphereGeometry(.032,10,7).scale(.52,1.3,.87),x,.018,0);
  box(metal,-.091,-.006,.052,.009,.010,.10);box(coal,-.084,-.006,.105,.016,.014,.025);
 }else if(kind==='carbine'){
  box(coal,0,.012,.05,.056,.095,.25);box(coal,0,.01,.24,.052,.065,.21);
  box(metal,0,.022,.37,.027,.027,.11);box(coal,0,-.07,.073,.041,.10,.058).rotation.x=.14;
  box(coal,0,-.059,-.034,.032,.084,.044).rotation.x=-.21;
  box(coal,0,-.004,-.145,.049,.075,.145);box(metal,0,.067,.02,.032,.031,.049);
 }else{
  box(metal,0,.018,.061,.034,.04,.175);box(coal,0,-.014,.054,.037,.033,.142);
  box(coal,0,-.064,-.009,.033,.093,.049).rotation.x=-.18;
 }
 officerProps.set(kind,group);return group.clone();
}
function fitIssuedEquipment(c,member){
 const kit=member.kit;
 if(!kit)return;
 if(kit.some(k=>k.includes('headset'))&&c.bones.Head){
  const headset=officerAccessory('headset'),at=c.bones.Head.getWorldPosition(new V3());
  headset.position.copy(at);headset.position.y+=.075;c.root.add(headset);c.root.updateMatrixWorld(true);c.bones.Head.attach(headset);
 }
 const armed=kit.some(k=>k.includes('sidearm'));
 if(!armed)return;
 const metro=member.division==='Metro SWAT',prop=officerAccessory(metro?'carbine':'sidearm');
 if(c.gun){c.gun.clear();c.gun.add(prop);}
 if(metro){
  const slung=officerAccessory('carbine');slung.position.set(.02,1.18,.18);slung.rotation.set(.06,.03,-.84);slung.rotateY(Math.PI*.5);
  c.root.add(slung);c.root.updateMatrixWorld(true);c.bones.Spine2?.attach(slung);c.slung=slung;
 }
}
