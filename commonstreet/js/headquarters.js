/* Old Town civic building. Coordinates are metres from the street-facing facade. */
const HQ_FLOORS=['Public services','Investigations','Watch operations','Staff and equipment'];
const HQ_STOREY=3.65;
const hqPanels=new Map();
function drawHeadquartersMap(g,file){
 const colors={oldtown:'#c2a995',midtown:'#c7bb9e',downtown:'#a1abb8',docks:'#a8aea5',suburb:'#a6bd98',beach:'#e0cca5'};
 const dx=22,dy=17.5,x0=26,y0=66;
 g.fillStyle='#e6e4d7';g.fillRect(0,0,768,384);
 g.fillStyle='#83acb7';g.fillRect(x0+N*dx,y0,48,N*dy);
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const x=x0+i*dx,y=y0+j*dy,site=SPECIAL[i+','+j];
  g.fillStyle=site?.kind==='park'?'#739379':colors[districtOf(i,j)];
  g.fillRect(x+1.1,y+1.1,dx-2.2,dy-2.2);
  if(site?.kind==='police'){
   g.fillStyle='#193d51';g.fillRect(x+4,y+2,14,14);g.fillStyle='#fff';g.font='bold 13px Arial';g.fillText('P',x+7,y+10);
  }
 }
 g.fillStyle='#173642';g.fillRect(0,0,768,46);g.font='bold 23px Arial';g.fillStyle='#f0e9d4';g.fillText('CITY DISTRICTS   /   WATCH MAP',22,25);
 const labels={oldtown:'Old Town',downtown:'Downtown',midtown:'Midtown',suburb:'Eastside',docks:'Docks',beach:'Coast Ridge'};
 Object.entries(labels).forEach(([id,label],i)=>{
  const x=452+i%2*151,y=81+Math.floor(i/2)*34;
  g.fillStyle=colors[id];g.fillRect(x,y-9,19,18);g.fillStyle='#243c43';g.font='bold 17px Arial';g.fillText(label,x+26,y);
 });
 g.fillStyle='#697b79';g.fillRect(451,180,288,2);
 g.font='bold 16px Arial';g.fillText('INCIDENT LOCATION',452,209);
 g.font='bold 23px Arial';g.fillStyle='#18333e';
 if(file){
  const x=x0+file.at.x/CELL*dx,y=y0+file.at.z/CELL*dy;
  g.fillText('FILE '+String(file.id).padStart(4,'0'),452,248);
  g.font='18px Arial';g.fillText(streetAddress(file.at),452,280,284);
  g.beginPath();g.arc(x,y,10,0,Math.PI*2);g.fillStyle='#b34e35';g.fill();
  g.lineWidth=3;g.strokeStyle='#fff7df';g.stroke();
 }else g.fillText('Awaiting a call',452,248);
 g.font='15px Arial';g.fillStyle='#4c666a';g.fillText('P   Department building',452,337);
}

function updateHeadquartersDisplays(){
 const pd=PoliceDepartment,files=pd.cases;
 const call=files.findLast(f=>f.stage!=='Unreported');
 const lab=files.findLast(f=>f.custody?.length);
 const command=files.findLast(f=>f.stage==='Command queue'||f.supervisor);
 const officer=id=>pd.staff.find(s=>s.personId===id)?.name;
 const map=hqPanels.get('map');
 if(map&&map.userData.fileId!==(call?.id??0)){
  const g=map.map.image.getContext('2d');drawHeadquartersMap(g,call);
  map.userData.fileId=call?.id??0;map.map.needsUpdate=true;
 }
 const consoles=[
  ['dispatch',call,[call?.caller?.name||'Communications',call&&streetAddress(call.at),officer(call?.patrol)||'Awaiting assignment',call?.stage]],
  ['lab',lab,[lab?.kind,lab?.custody[0]?.holder,lab&&lab.custody.length+' exhibits logged',officer(lab?.analyst)||'Awaiting comparison']],
  ['command',command,[officer(command?.detective),command?.stage,officer(command?.supervisor)||'Pending review',command?.subjectName]]
 ];
 for(const [kind,file,values] of consoles){
  const mat=hqPanels.get(kind);if(!mat||!file)continue;
  const revision=[file.id,...values].join('|');if(mat.userData.revision===revision)continue;
  const g=mat.map.image.getContext('2d');
  g.fillStyle='#325765';g.fillRect(484,0,284,61);g.font='bold 24px Arial';g.fillStyle='#f5dfaa';
  g.fillText('FILE '+String(file.id).padStart(4,'0'),539,34);
  for(let i=0;i<4;i++){
   g.fillStyle=i%2?'#314751':'#374d57';g.fillRect(178,111+i*72,570,27);
   g.fillStyle='#f1d8a8';g.font='18px Arial';g.fillText(values[i]||'Pending',192,127+i*72,538);
  }
  mat.userData.revision=revision;mat.map.needsUpdate=true;
 }
}

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
  drawHeadquartersMap(g,null);
 }else if(['screen','dispatch','lab','command'].includes(kind)){
  const captions={screen:['RECORDS','Case number','Reporting officer','Case history','Supporting exhibits'],
   dispatch:['COMMUNICATIONS','Caller and address','Location details','Assigned units','Call history'],
   lab:['EXHIBIT INTAKE','Item description','Custody record','Comparison request','Examiner notes'],
   command:['WATCH SUPERVISION','Staff assignments','Review queue','Patrol districts','Bulletin register']}[kind];
  g.fillStyle='#203139';g.fillRect(0,0,768,384);
  g.fillStyle='#325765';g.fillRect(0,0,768,61);text(captions[0],23,34,28);
  g.fillStyle='#18262d';g.fillRect(0,62,162,322);
  ['WORKSPACE','Inbox','City map','Directory','Reports'].forEach((s,i)=>text(s,14,90+i*57,i?20:15,i?cream:gold));
  for(let i=0;i<4;i++){
   g.fillStyle=i%2?'#314751':'#374d57';g.fillRect(177,79+i*72,572,60);
   text(captions[i+1],192,100+i*72,22,'#e3eae6');
   g.fillStyle='#64818a';g.fillRect(192,121+i*72,238-i*17,3);
  }
 }else if(kind==='command-board'){
  g.fillStyle='#d4dad3';g.fillRect(0,0,768,384);g.fillStyle=ink;g.fillRect(0,0,768,58);
  text('WATCH OFFICE',20,28,28);text('HANDOVER BOARD',401,28,22,gold);
  ['PATROL','INVESTIGATIONS','SERVICES'].forEach((label,i)=>{
   const x=20+i*251; text(label,x,84,18,ink);
   g.fillStyle='#899c98';g.fillRect(x,102,225,2);
   for(let j=0;j<3;j++){
    const px=x+(j%2)*106,py=121+Math.floor(j/2)*111;
    g.fillStyle=['#efdfb5','#d4e1e6','#e8e5d7'][j];g.fillRect(px,py,96,95);
    g.fillStyle='#385361';g.fillRect(px+8,py+13,60,5);
    for(let k=0;k<4;k++)g.fillRect(px+8,py+30+10*k,67-k%3*8,2);
    g.fillStyle=j===1?'#36828a':'#ae6643';g.fillRect(px+42,py+3,6,6);
   }
  });
 }else if(kind==='keyboard'){
  g.fillStyle='#30373a';g.fillRect(0,0,768,384);
  for(let r=0;r<5;r++)for(let k=0;k<16;k++){
   const px=10+k*47,py=14+r*71;
   g.fillStyle='#151e24';g.fillRect(px,py,42,58);
   g.fillStyle='#495251';g.fillRect(px+2,py+2,38,48);
   const letter=['1234567890-+','QWERTYUIOP','ASDFGHJKL','ZXCVBNM',''][r][k];
   if(letter)text(letter,px+11,py+21,15);
  }
 }else if(kind==='staff-board'){
  g.fillStyle='#a78763';g.fillRect(0,0,768,384);
  for(let i=0;i<1550;i++){g.fillStyle=i%3?'#957855':'#b59671';g.fillRect((i*419)%768,(i*97+Math.floor(i/6)*13)%384,2,2);}
  g.fillStyle=ink;g.fillRect(0,0,768,54);text('STAFF NOTICES',22,27,26);
  const notes=[
   [29,76,205,254,'KITCHEN',['Wash and dry mugs','Return dishes to','the upper shelves.']],
   [259,112,230,217,'DIRECTORY',['Public records   G','Investigations   2','Watch office      3']],
   [516,77,218,241,'SHIFT NOTES',['Watch handover','Staff message slips','Reception desk']]
  ];
  for(const [px,py,w,h,label,lines] of notes){
   g.save();g.translate(px,py);g.rotate(label==='KITCHEN'?-.036:.019);
   g.fillStyle='#5c4938';g.fillRect(3,5,w,h);g.fillStyle=label==='DIRECTORY'?'#d5e1df':'#ede6ce';g.fillRect(0,0,w,h);
   text(label,12,35,20,ink);g.fillStyle='#839495';g.fillRect(12,59,w-24,2);
   lines.forEach((line,j)=>text(line,12,86+j*37,16,'#354a50'));
   g.fillStyle='#a44935';g.beginPath();g.arc(w*.5,10,5,0,Math.PI*2);g.fill();g.restore();
  }
 }else if(kind==='paper'){
  g.fillStyle='#eee9dc';g.fillRect(0,0,768,384);text('OLD TOWN  /  CASE REVIEW',36,49,28,ink);
  g.fillStyle='#527176';g.fillRect(36,77,699,4);
  for(let i=0;i<8;i++){g.fillStyle='#939b94';g.fillRect(43,104+i*32,640-(i%4)*48,3);}
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
 const blue=paint(0x284959),brass=paint(0xae9362);
 const finish=(name,repeat,rough,ns,tint=0xffffff)=>roomLightMaterial(pbr(name,repeat,{color:tint,rough,ns,env:.42}),.68);
 const limestone=finish('stone_light',.45,.74,.46,0xd6cdbc);
 const pale=finish('hq-paint',.76,.83,.48),rail=finish('hq-paint',.76,.63,.33,0x8ba8a4);
 const floorStone=finish('hq-aggregate',.77,.49,.34),carpet=finish('hq-carpet',.61,.96,.55);
 const ceilingTile=finish('hq-acoustic',.48,.97,.40),oak=finish('planks',.64,.63,.31,0x9d8772);
 const laminate=paint(0x925e46),enamel=paint(0x517277),charcoal=paint(0x35444a);
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
 function panel(kind,x,y,v,w,h,turn=0){
  const p=lpt(M,x,v),g=new THREE.PlaneGeometry(w,h);g.rotateY(SIDEANG[side]+turn);g.translate(p.x,y,p.z);
  addGeo(hqGraphic(kind),g,false);
 }
 function horizontalPanel(kind,x,y,v,w,d){
  const p=lpt(M,x,v),g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);
  g.rotateY(SIDEANG[side]);g.translate(p.x,y,p.z);addGeo(hqGraphic(kind),g,false);
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
  box(rail,x0-.009,x1+.009,y+.04,y+.92,v0-.009,v1+.009);
  box(m.steel,x0-.023,x1+.023,y+.91,y+.942,v0-.023,v1+.023);
  box(charcoal,x0-.013,x1+.013,y+.014,y+.112,v0-.013,v1+.013);
 }
 function windowWall(v,f){
  const y=level(f),outer=v+.14;
  let last=-18.85;
  for(const [left,right] of HQ_WINDOW_BAYS){
   wall(last,left,v,outer,f);
   box(pale,left,right,y,y+1.16,v,outer);
   box(rail,left,right,y+.04,y+.92,v-.009,outer+.009);
   box(m.steel,left,right,y+.91,y+.942,v-.023,outer+.023);
   box(charcoal,left,right,y+.014,y+.112,v-.013,outer+.013);
   box(oak,left-.06,right+.06,y+1.11,y+1.16,v-.08,outer+.08);
   box(pale,left,right,y+2.74,y+3.38,v,outer);
   addRoomCollider(block,M,left,right,v,outer,y+3.38,y);
   last=right;
  }
  wall(last,18.85,v,outer,f);
 }
 function seat(x,v,f){placeRoomFurniture(block,M,'seat',x,v,level(f),[.61,.88,.6]);}
 function desk(x,v,f,w=2.35){
  const y=level(f);
  solid(m.wood,x-w/2,x+w/2,y+.73,y+.80,v-.48,v+.50);
  for(const edge of [-1,1])box(m.steel,x+edge*(w/2-.12)-.04,x+edge*(w/2-.12)+.04,y,y+.74,v-.36,v+.37);
  box(m.steel,x+.36,x+.86,y+.08,y+.69,v-.37,v+.4);
  for(const h of [.26,.45,.63])box(m.black,x+.48,x+.73,y+h,y+h+.018,v-.39,v-.36);
 }
 function monitor(x,v,f,wide=.65,kind='screen',reverse=false){
  const y=level(f)+.81;box(m.black,x-.16,x+.16,y,y+.025,v-.09,v+.12);
  box(m.steel,x-.032,x+.032,y+.02,y+.19,v,v+.055);
  box(m.black,x-wide/2,x+wide/2,y+.11,y+.50,v-.03,v+.045);
  panel(kind,x,y+.31,v+(reverse?.05:-.035),wide-.035,.35,reverse?Math.PI:0);
  const k=v+(reverse?.28:-.28);
  box(m.rubber,x-.22,x+.22,y,y+.018,k-.08,k+.08);
  horizontalPanel('keyboard',x,y+.019,k,.42,.148);
  box(m.black,x+.29,x+.355,y,y+.033,k-.05,k+.05);
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
 function chair(x,v,f,angle=0){
  const frame=new THREE.Matrix4().makeRotationY(SIDEANG[side]+angle),p=point(x,v,f);
  frame.setPosition(p);
  const part=(mat,geo)=>addGeo(mat,geo.applyMatrix4(frame),false);
  part(charcoal,new THREE.CylinderGeometry(.065,.066,.34,12).translate(0,.26,0));
  for(let i=0;i<5;i++){
   const a=i*2*Math.PI/5;
   part(m.steel,new THREE.BoxGeometry(.046,.045,.31).translate(0,.115,.15).rotateY(a));
   part(charcoal,new THREE.SphereGeometry(.059,8,5).scale(1,1,.73).translate(0,.064,.28).rotateY(a));
  }
  part(charcoal,new THREE.SphereGeometry(1,18,12).scale(.27,.064,.255).translate(0,.475,0));
  part(charcoal,new THREE.SphereGeometry(1,18,12).scale(.245,.27,.052).rotateX(-.09).translate(0,.72,-.22));
  for(const s of [-1,1]){
   part(m.steel,new THREE.BoxGeometry(.026,.16,.04).translate(s*.253,.50,-.034));
   part(charcoal,new THREE.BoxGeometry(.048,.038,.193).translate(s*.253,.601,.017));
  }
  addRoomCollider(block,M,x-.26,x+.26,v-.26,v+.26,p.y+.94,p.y);
 }
 function waitingBench(x,v,f,count){
  const pitch=.65,width=.545,span=count*pitch,frame=M.clone().setPosition(point(x,v,f));
  const part=(mat,g)=>addGeo(mat,g.applyMatrix4(frame),false);
  const rail=(vertices,r)=>new THREE.TubeGeometry(
   new THREE.CatmullRomCurve3(vertices.map(([u,h,d])=>new V3(u,h,d))),12,r,8,false);
  const vinyl=roomLightMaterial(waitingVinyl,.72);
  // Extrude one continuous bent shell per seat. The lip, lumbar bend and rolled top have real profiles.
  const shell=new THREE.Shape();
  shell.moveTo(.207,.482);shell.quadraticCurveTo(.26,.503,.257,.454);
  shell.quadraticCurveTo(.235,.407,.161,.419);shell.lineTo(-.129,.422);
  shell.quadraticCurveTo(-.219,.413,-.247,.522);shell.lineTo(-.314,.818);
  shell.quadraticCurveTo(-.339,.900,-.278,.907);shell.quadraticCurveTo(-.247,.908,-.249,.858);
  shell.lineTo(-.179,.565);shell.quadraticCurveTo(-.164,.489,-.091,.478);
  shell.quadraticCurveTo(.071,.459,.207,.482);
  const shellMesh=new THREE.ExtrudeGeometry(shell,{depth:width,bevelEnabled:true,bevelThickness:.014,bevelSize:.012,
   bevelSegments:3,curveSegments:7,steps:1}).rotateY(-Math.PI/2);
  part(charcoal,new THREE.BoxGeometry(span-.12,.084,.098).translate(0,.322,-.015));
  for(const sign of [-1,1]){
   const s=sign*(span/2-.48);
   part(m.steel,rail([[s,.359,-.016],[s,.22,-.025],[s,.114,-.02]],.039));
   part(m.steel,rail([[s,.039,-.27],[s,.114,-.074],[s,.112,.085],[s,.040,.256]],.032));
   for(const d of [-.268,.258])part(charcoal,new THREE.CylinderGeometry(.05,.061,.025,12).translate(s,.021,d));
  }
  for(let i=0;i<count;i++){
   const s=(i-(count-1)/2)*pitch;
   part(vinyl,shellMesh.clone().translate(s+width/2,0,0));
   part(m.steel,new THREE.BoxGeometry(.29,.10,.137).translate(s,.384,-.029));
  }
  shellMesh.dispose();
  for(let i=0;i<=count;i++){
   const u=-span/2+i*pitch;
   part(m.steel,rail([[u,.338,-.055],[u,.47,-.16],[u,.651,-.111],[u,.665,.105],[u,.603,.179]],.018));
   part(charcoal,rail([[u,.660,-.085],[u,.672,-.024],[u,.669,.102]],.026));
  }
  addRoomCollider(block,M,x-span/2-.04,x+span/2+.04,v-.31,v+.34,level(f)+.92,level(f));
 }
 function credenza(x,v,f,w){
  const y=level(f);
  solid(oak,x-w/2,x+w/2,y+.085,y+.90,v,v+.54);
  box(charcoal,x-w/2+.095,x+w/2-.095,y,y+.09,v+.06,v+.50);
  box(laminate,x-w/2-.03,x+w/2+.03,y+.90,y+.937,v-.035,v+.56);
  const n=Math.round(w/.6);
  for(let i=0;i<n;i++){
   const a=x-w/2+i*w/n;
   box(oak,a+.014,a+w/n-.014,y+.12,y+.86,v-.022,v);
   box(m.chrome,a+w/n-.083,a+w/n-.061,y+.59,y+.74,v-.052,v-.023);
  }
 }
 function binders(x,v,y,count){
  for(let i=0;i<count;i++){
   const a=x+i*.092,h=.255+(i%3)*.019;
   box(i%5===2?laminate:i%4===0?charcoal:enamel,a,a+.083,y,y+h,v,v+.21);
   box(m.cream,a+.009,a+.073,y+.093,y+.164,v-.003,v);
   box(charcoal,a+.026,a+.051,y+.036,y+.055,v-.004,v);
  }
 }
 function documents(x,v,y){
  box(laminate,x-.23,x+.22,y,y+.023,v-.156,v+.153);
  horizontalPanel('paper',x+.012,y+.025,v,.41,.282);
 }
 function phone(x,v,y){
  box(charcoal,x-.117,x+.117,y,y+.047,v-.089,v+.10);
  box(m.black,x-.112,x-.057,y+.047,y+.075,v-.085,v+.098);
  box(enamel,x-.033,x+.096,y+.047,y+.056,v+.02,v+.082);
  for(let r=0;r<3;r++)for(let i=0;i<3;i++)
   box(m.steel,x-.025+i*.034,x-.004+i*.034,y+.048,y+.054,v-.064+r*.024,v-.05+r*.024);
 }
 // A stone canopy, recessed soffit and municipal signage frame the public entrance.
 box(limestone,-6.6,6.6,3.37,3.60,.55,4.05);box(blue,-6.65,6.65,3.48,4.12,.5,4);
 for(const x of [-4.6,0,4.6])box(m.neutral,x-.36,x+.36,3.35,3.37,2.04,2.25);
 for(const x of [-6.2,6.2]){
  solid(limestone,x-.18,x+.18,.15,3.4,.88,1.24);
  const planter=lpt(M,x+(x<0?-1:1),2.25);
  worksModel('salon-plant',planter.x,.15,planter.z,[.70,1.19,.71],SIDEANG[side]+.33*x);
 }
 sign('OLD TOWN HEADQUARTERS',0,3.80,.48,8.36,.53);
 // Upper storeys use independent floor contacts, so pedestrians below them stay on the ground.
 for(let f=0;f<4;f++){
  const y=level(f);
  const openings=f===3?[]:[shaft,stairs[f%2]];
  if(f<3)worksFlight(stairs[f%2],y,level(f+1),f%2===1);
  if(f){
   const floorHoles=[shaft,stairs[(f-1)%2]];
   if(f<3)floorHoles.push(stairs[f%2]);
   worksSlab(bounds,y,f===2?carpet:floorStone,floorHoles);
   for(const x of [-18.85,18.85])wall(x-.08,x+.08,4.1,31.85,f);
   for(const v of [4.16,31.82])windowWall(v,f);
  }else{
   topQuad(floorStone,bounds.x0,bounds.x1,y+.009,bounds.z0,bounds.z1,1.7,null,false);
  }
  const ceilingY=y+(f===0?3.295:3.39);
  ceilingPart(ceilingTile,-18.85,18.85,ceilingY,ceilingY+.07,4.22,31.76,openings);
  // Suspended ceiling runners, room skirting and acoustic tile joints.
  for(let x=-18;x<=18;x+=2.4)ceilingPart(m.steel,x,x+.018,ceilingY-.015,ceilingY+.005,4.22,31.70,openings);
  for(let v=5;v<32;v+=1.2)ceilingPart(m.steel,-18.72,18.72,ceilingY-.013,ceilingY+.007,v,v+.016,openings);
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
 const waitingVinyl=new THREE.MeshStandardMaterial({color:lin(0x486571),roughness:.56,metalness:.025,
  normalMap:T('hq-paint','n',1.7),normalScale:new THREE.Vector2(.16,.16)});
 for(const v of [9.2,12])waitingBench(-12.8,v,0,5);
 wall(-9.7,-6.4,12.92,13.06,0);bulletin('directory',-8,12.8,1.72,2.65,1.32);
 wall(10.1,16.8,13.91,14.05,0);bulletin('notice',13,13.78,1.95,3.2,1.18);
 credenza(13.4,13.15,0,4.1);documents(12.4,13.30,1.093);phone(14.46,13.38,1.091);
 for(const x of [11.1,15.7])chair(x,11.32,0,Math.PI);
 post('Patrol','Public records',-1.5,11.8,0,'taking a statement',2.1);
 // Booking, short-stay holding and private interview.
 desk(-12,21,0);monitor(-12.35,21,0,.65,'screen',true);bank(-16,29.3,0,5,'files');sign('BOOKING',-15.25,2.16,15.97,2.24,.37);
 terminal('BOOKING LOG','Booking',-12,19.9,0);post('Patrol','Booking',-12,22.2,0,'checking custody records',1.4);
 solid(pale,6,18.7,.15,.67,24.4,24.56);solid(pale,6,18.7,2.68,3.51,24.4,24.56);
 solid(m.glass,6.1,18.6,.68,2.67,24.45,24.49);
 solid(m.steel,11.3,17.9,.16,.63,29.6,30.2);
 for(let i=0;i<28;i++){const x=6.5+i*.42;box(m.steel,x,x+.043,.19,2.73,24.57,24.64);}
 sign('CUSTODY',12,3.04,24.36,2.4,.38);
 desk(0,26,0,2.25);seat(-.55,24.8,0);seat(.55,27.25,0);sign('INTERVIEW',2.73,2.15,15.97,2.3,.35);
 credenza(-1.15,30.97,0,3.18);documents(.35,25.96,.956);phone(-2.30,31.19,1.087);
 // Investigations, exhibit storage and instrument bench.
 for(const x of [-12,-8,9,13]){
  desk(x,11.2,1);monitor(x-.28,11.2,1,.65,'screen',true);
  chair(x+.5,12.26,1);documents(x+.63,11.09,level(1)+.804);
  phone(x-.89,11.18,level(1)+.804);
 }
 // Shared working files sit below the district map, within reach from the bureau desks.
 const fileShelfY=level(1)+.937;
 credenza(-13.35,15.22,1,4.78);binders(-15.47,15.35,fileShelfY,13);
 documents(-12.69,15.46,fileShelfY);
 bulletin('map',-13.37,15.87,level(1)+2.03,3.43,1.67);
 bulletin('notice',-7.5,15.87,level(1)+1.8,3.4,1.55);
 post('Detectives','Detective bureau',-13.1,12.5,1,'reviewing witness statements',.85);
 terminal('CASE FILES','Cases',-12,10.2,1);
 // The examination island has a single clear exhibit mat, a camera column and a separate logging terminal.
 const labFloor=level(1),benchY=labFloor+.88;
 solid(enamel,7.42,13.6,labFloor+.09,benchY-.06,23.04,23.95);
 box(charcoal,7.47,13.55,labFloor,labFloor+.10,23.11,23.87);
 box(charcoal,7.33,13.7,benchY-.06,benchY,22.96,24.03);
 for(let x=7.52;x<13.45;x+=.76){
  box(rail,x,x+.72,labFloor+.115,benchY-.095,23.010,23.04);
  box(m.chrome,x+.21,x+.51,benchY-.22,benchY-.191,22.98,23.015);
 }
 box(m.rubber,10.40,11.58,benchY,benchY+.018,23.09,23.86);
 box(m.cream,10.44,11.54,benchY+.018,benchY+.023,23.10,23.77);
 const column=lpt(M,11.64,23.75);
 cyl(m.steel,column.x,benchY+.035,column.z,.035,.044,.91,14);
 box(charcoal,11.17,11.67,benchY+.83,benchY+.904,23.69,23.80);
 box(m.black,11.10,11.32,benchY+.72,benchY+.85,23.64,23.83);
 const lens=lpt(M,11.21,23.73);cyl(charcoal,lens.x,benchY+.64,lens.z,.065,.06,.08,14);
 desk(15.12,23.52,1,2.35);monitor(14.88,23.49,1,.72,'lab',true);chair(15.2,24.70,1);
 documents(15.82,23.35,labFloor+.805);
 wall(5.12,15.65,28.14,28.29,1);wall(17.35,18.76,28.14,28.29,1);
 sign('EXHIBIT STORAGE',16.50,labFloor+2.82,28.11,1.6,.30);
 bank(6.15,27.43,1,4,'files');bank(7.3,30.85,1,9,'files');
 credenza(12.26,27.43,1,4.95);
 bulletin('lab',11.5,28.012,labFloor+2.01,2.29,1.16);
 for(let shelf=0;shelf<2;shelf++){
  const sy=labFloor+1.37+shelf*.45;
  box(m.steel,13.24,15.36,sy-.035,sy,27.72,28.13);
  for(let j=0;j<3;j++){
   const a=13.33+j*.54;
   box(m.cream,a,a+.465,sy,sy+.281,27.78,28.085);
   box(oak,a-.008,a+.473,sy+.252,sy+.296,27.75,28.09);
   box(charcoal,a+.13,a+.344,sy+.12,sy+.164,27.773,27.779);
  }
 }
 // Side-wall wash-up counter, tiled splashback, basin lip, mixer and glove dispenser.
 solid(enamel,5.11,5.86,labFloor+.09,benchY-.06,23.68,27.42);
 box(m.ceramic,5.08,5.90,benchY-.06,benchY,23.59,27.47);
 box(m.wallTile,5.09,5.13,benchY,benchY+.59,23.59,27.47);
 box(m.steel,5.23,5.79,benchY,benchY+.015,25.26,26.04);
 box(charcoal,5.27,5.75,benchY+.015,benchY+.018,25.30,26.00);
 box(m.chrome,5.19,5.225,benchY,benchY+.36,25.62,25.664);
 box(m.chrome,5.19,5.44,benchY+.327,benchY+.36,25.62,25.664);
 box(m.chrome,5.414,5.44,benchY+.262,benchY+.36,25.62,25.664);
 box(m.cream,5.11,5.24,benchY+.70,benchY+.97,25.04,25.39);
 station.exhibitBench=point(10.97,23.71,1);station.exhibitBench.y+=.88+.023+.31;
 post('Forensics','Evidence laboratory',10.97,24.31,1,'examining an exhibit',1.5);
 const examiner=station.posts[station.posts.length-1];
 examiner.exhibit=station.exhibitBench;examiner.cameraStand=point(8.35,21.60,1);
 terminal('EVIDENCE REGISTER','Evidence',11.3,22.45,1);
 bank(-16.8,28.8,1,11,'files');desk(-12,22.5,1);monitor(-12,22.5,1, .65,'lab');sign('EXHIBIT INTAKE',-15.76,level(1)+2.12,15.97,2.69,.39);
 // A central case conference room shares the rear corridor with the lab and property counter.
 desk(0,25.27,1,3.30);
 for(const x of [-.87,.87]){chair(x,24.24,1,Math.PI);chair(x,26.30,1);}
 documents(.83,25.24,labFloor+.805);
 credenza(0,31.16,1,4.32);binders(-1.85,31.29,labFloor+.937,12);
 // Watch floor. Each console has its own displays; the briefing gallery faces the city map.
 for(const x of [-12,-8.7]){
  desk(x,22.5,2,3.18);monitor(x-.64,22.55,2,.82,'dispatch');monitor(x+.25,22.55,2,.80,'screen');
  phone(x+1.07,22.39,level(2)+.81);
 }
 wall(-15.72,-5.10,25.85,26.02,2);
 for(let i=0;i<52;i++){
  const x=-15.67+i*.202;box(i%3===1?oak:charcoal,x,x+.095,level(2)+.15,level(2)+3.18,25.80,25.855);
 }
 bulletin('map',-12.63,25.66,level(2)+1.97,4.05,1.65);
 bulletin('dispatch',-8.40,25.66,level(2)+1.97,3.36,1.65);
 bank(-15.1,30.92,2,6,'files');
 chair(-11.75,21.79,2,Math.PI);chair(-8.45,21.79,2,Math.PI);
 post('Communications','Dispatch',-11.75,21.79,2,'monitoring calls',0);
 const dispatcher=station.posts[station.posts.length-1];
 dispatcher.seated=true;dispatcher.yaw+=Math.PI;
 dispatcher.keyboard=point(-11.75,22.27,2);dispatcher.keyboard.y+=.829;
 terminal('CALL LOG','Radio',-10.85,21.44,2);
 const watchFloor=level(2);
 wall(5.10,15.72,27.62,27.77,2);wall(17.32,18.77,27.62,27.77,2);
 sign('WATCH OFFICE',16.55,watchFloor+2.65,27.60,1.48,.30);
 credenza(10.56,26.95,2,5.45);binders(8.18,27.12,watchFloor+.937,10);
 bulletin('command-board',10.52,27.49,watchFloor+1.98,3.56,1.52);
 bulletin('map',13.80,27.49,watchFloor+1.98,2.40,1.52);
 desk(7.0,25.81,2,1.61);chair(6.65,24.74,2,Math.PI);
 box(m.cream,6.58,7.33,watchFloor+.81,watchFloor+1.18,25.56,26.02);
 box(charcoal,6.65,7.27,watchFloor+1.18,watchFloor+1.23,25.59,25.98);
 box(m.rubber,6.67,7.23,watchFloor+.91,watchFloor+.98,25.548,25.558);
 desk(11,22.3,2,3.15);monitor(11.90,22.39,2,.72,'command',true);
 documents(10.61,22.26,watchFloor+.805);phone(9.83,22.50,watchFloor+.81);
 for(const x of [14.60,15.65])chair(x,24.83,2,Math.PI*.75);
 bank(6.7,30.85,2,5,'files');desk(12.5,29.65,2,2.65);
 // Shared report writing and charging desks in the central watch room.
 for(const x of [-2.14,1.36]){
  desk(x,24.17,2,2.63);monitor(x-.37,24.1,2,.67,'command');chair(x-.35,23.14,2,Math.PI);
  documents(x+.66,24.23,watchFloor+.805);
 }
 credenza(0,31.15,2,3.93);
 for(let i=0;i<5;i++){
  const x=-1.53+i*.33,y=watchFloor+.937;
  box(charcoal,x,x+.18,y,y+.06,31.33,31.54);
  box(m.black,x+.036,x+.144,y+.06,y+.224,31.38,31.46);
  box(charcoal,x+.056,x+.071,y+.224,y+.286,31.39,31.414);
 }
 post('Command','Watch command',10.4,23.55,2,'reviewing assignments',2.15);
 terminal('WATCH BOARD','Watch',11,21.2,2);
 for(const v of [8.7,11,13.25])waitingBench(-12,v,2,5);
 bulletin('map',-12,14.65,level(2)+1.82,4.7,1.9);sign('ROLL CALL',-12,level(2)+2.97,14.58,2.2,.33);
 // Support floor: equipment issue, air-support planning, lockers and a staff mess.
 bank(-17,29,3,12,'lockers');bank(-16.8,14,3,7,'lockers');
 desk(-12,22.4,3,3.4);monitor(-12.8,22.4,3);
 for(const x of [-12,-11.7,-11.4])box(m.black,x,x+.14,level(3)+.81,level(3)+1.06,22.17,22.30);
 sign('EQUIPMENT ISSUE',-15.76,level(3)+2.12,15.97,2.90,.37);
 post('Metro SWAT','Equipment issue',-12.5,23.65,3,'checking issued equipment',1.3);
 terminal('ISSUE LEDGER','Equipment',-12,21.25,3);
 desk(11.3,22.4,3);monitor(11,22.4,3);bulletin('map',12,28.7,level(3)+1.8,4,1.65);
 post('Air Support','Flight desk',11,23.6,3,'reviewing the flight board',1.25);
 const staffFloor=level(3);
 function mealChair(x,v,angle){
  const frame=new THREE.Matrix4().makeRotationY(SIDEANG[side]+angle).setPosition(point(x,v,3));
  const piece=(material,g)=>addGeo(material,g.applyMatrix4(frame),false);
  const diningSeat=new THREE.Shape();
  diningSeat.moveTo(-.20,-.17);diningSeat.quadraticCurveTo(-.25,-.17,-.24,-.09);
  diningSeat.lineTo(-.205,.176);diningSeat.quadraticCurveTo(-.20,.213,-.135,.213);
  diningSeat.lineTo(.135,.213);diningSeat.quadraticCurveTo(.20,.213,.205,.176);
  diningSeat.lineTo(.24,-.09);diningSeat.quadraticCurveTo(.25,-.17,.20,-.17);diningSeat.closePath();
  const bevel={depth:.019,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:2,curveSegments:6};
  const seatShell=new THREE.ExtrudeGeometry(diningSeat,bevel).rotateX(-Math.PI/2);
  const backShape=new THREE.Shape();backShape.moveTo(-.16,0);
  backShape.quadraticCurveTo(-.196,0,-.204,.075);backShape.lineTo(-.207,.222);
  backShape.quadraticCurveTo(-.223,.296,-.155,.304);backShape.quadraticCurveTo(0,.333,.155,.304);
  backShape.quadraticCurveTo(.223,.296,.207,.222);backShape.lineTo(.204,.075);backShape.quadraticCurveTo(.196,0,.16,0);backShape.closePath();
  const grip=new THREE.Path();grip.absellipse(0,.237,.072,.020,0,Math.PI*2,true);backShape.holes.push(grip);
  const backShell=new THREE.ExtrudeGeometry(backShape,bevel);
  const bp=backShell.attributes.position;
  for(let i=0;i<bp.count;i++)bp.setZ(i,bp.getZ(i)+.035*(bp.getX(i)/.20)**2-.18*bp.getY(i));
  backShell.computeVertexNormals();
  piece(enamel,seatShell.translate(0,.445,0));piece(enamel,backShell.translate(0,.51,-.175));
  for(const s of [-1,1]){
   const pts=[[s*.132,.70,-.202],[s*.157,.44,-.174],[s*.202,.046,-.224],[s*.210,.032,-.119],[s*.202,.034,.163],[s*.179,.092,.205],[s*.152,.428,.139]];
   const path=new THREE.CatmullRomCurve3(pts.map(([a,b,c])=>new V3(a,b,c)));
   piece(m.steel,new THREE.TubeGeometry(path,22,.015,8,false));
   piece(charcoal,new THREE.BoxGeometry(.05,.023,.078).translate(s*.203,.019,.114));
  }
  addRoomCollider(block,M,x-.25,x+.25,v-.25,v+.25,staffFloor+.84,staffFloor);
 }
 for(const x of [10,14]){
  placeRoomFurniture(block,M,'reading-table',x,12,staffFloor,[1.35,.74,1.35]);
  mealChair(x,10.96,Math.PI);mealChair(x,13.04,0);
 }
 // The cabinet is hollow beneath the basin. Its worktop returns on all four sides of the opening.
 const workY=staffFloor+.94;
 solid(enamel,-2.10,3.35,staffFloor+.075,staffFloor+.72,30.87,31.50);
 box(charcoal,-2.04,3.29,staffFloor,staffFloor+.076,30.94,31.45);
 const sx=-.36,dx=.63,v0=31.00,v1=31.42;
 for(const [u0,u1,a,b] of [[-2.14,sx,30.825,31.55],[sx+dx,3.39,30.825,31.55],[sx,sx+dx,30.825,v0],[sx,sx+dx,v1,31.55]])
  box(m.ceramic,u0,u1,workY-.045,workY,a,b);
 for(let j=0;j<8;j++){
  const u=-2.08+j*.677;
  box(oak,u,u+.654,staffFloor+.10,workY-.052,30.842,30.884);
  box(m.chrome,u+.205,u+.438,workY-.182,workY-.155,30.808,30.843);
 }
 box(m.steel,sx,sx+dx,workY-.171,workY-.156,v0,v1);
 for(const edge of [sx,sx+dx]){
  box(m.steel,edge-.009,edge+.009,workY-.16,workY+.004,v0,v1);
  box(m.chrome,edge-.013,edge+.013,workY,workY+.008,v0-.011,v1+.011);
 }
 for(const v of [v0,v1]){
  box(m.steel,sx,sx+dx,workY-.16,workY+.004,v-.010,v+.010);
  box(m.chrome,sx-.012,sx+dx+.012,workY,workY+.008,v-.014,v+.014);
 }
 function tubeInRoom(material,pts,radius){
  const curve=new THREE.CatmullRomCurve3(pts.map(([u,y,v])=>{const p=lpt(M,u,v);p.y=y;return p;}));
  addGeo(material,new THREE.TubeGeometry(curve,16,radius,9,false),false);
 }
 tubeInRoom(m.chrome,[[-.037,workY,31.47],[-.037,workY+.259,31.47],[-.037,workY+.33,31.415],
  [-.037,workY+.33,31.27],[-.037,workY+.254,31.235]],.016);
 box(m.wallTile,-2.12,3.37,workY,workY+.22,31.53,31.57);
 // The inset central pier between the real windows carries the mug shelves.
 function mug(u,v,y,body){
  const p=lpt(M,u,v),rim=.044;
  cyl(body,p.x,y,p.z,rim,.038,.087,16);
  cyl(m.darkWood,p.x,y+.087,p.z,rim-.005,rim-.005,.001,16);
  tubeInRoom(body,[[u+.038,y+.073,v],[u+.068,y+.072,v],[u+.072,y+.036,v],[u+.040,y+.030,v]],.007);
 }
 for(const h of [1.45,1.84]){
  const y=staffFloor+h;
  box(oak,-1.72,.99,y-.034,y,31.31,31.58);
  for(const u of [-1.5,.77])box(charcoal,u-.022,u+.022,y-.158,y-.032,31.45,31.58);
  for(let i=0;i<5;i++)mug(-1.41+i*.245,31.393,y,i%2?m.ceramic:enamel);
 }
 // Refrigerator with separate door seals, projecting pulls and recessed grille.
 solid(charcoal,-3.78,-2.96,staffFloor+.035,staffFloor+1.78,30.78,31.54);
 for(const [bottom,top] of [[.08,.56],[.585,1.77]]){
  box(m.ceramic,-3.759,-2.979,staffFloor+bottom,staffFloor+top,30.73,30.79);
  const grip=staffFloor+top-.13;
  tubeInRoom(m.steel,[[-3.11,grip-.26,30.73],[-3.11,grip-.245,30.67],[-3.11,grip-.018,30.67],[-3.11,grip,30.73]],.016);
 }
 for(const u of [-3.58,-3.48,-3.38,-3.28])box(m.steel,u,u+.053,staffFloor+.045,staffFloor+.063,30.76,30.78);
 // Microwave door, pull, timer and keypad sit above the stone counter.
 box(m.steel,1.73,2.27,workY,workY+.315,31.0,31.39);
 box(charcoal,1.745,2.15,workY+.027,workY+.29,30.986,31.004);
 box(m.black,1.77,2.077,workY+.057,workY+.26,30.981,30.989);
 box(m.chrome,2.092,2.11,workY+.065,workY+.23,30.955,30.987);
 box(enamel,2.17,2.242,workY+.225,workY+.255,30.99,31.001);
 for(let i=0;i<6;i++)box(m.black,2.17+(i%2)*.042,2.186+(i%2)*.042,workY+.105+Math.floor(i/2)*.035,workY+.122+Math.floor(i/2)*.035,30.99,31);
 // Drip coffee maker, glass carafe, insulated handle and warming plate.
 box(charcoal,-1.65,-1.30,workY,workY+.043,30.96,31.39);
 box(m.steel,-1.64,-1.31,workY+.042,workY+.42,31.23,31.385);
 box(charcoal,-1.66,-1.29,workY+.376,workY+.47,30.96,31.41);
 const jug=lpt(M,-1.46,31.09);
 cyl(m.darkWood,jug.x,workY+.056,jug.z,.081,.095,.122,18);
 cyl(m.glass,jug.x,workY+.056,jug.z,.084,.098,.179,18);
 cyl(m.black,jug.x,workY+.235,jug.z,.087,.089,.018,18);
 tubeInRoom(charcoal,[[-1.377,workY+.229,31.09],[-1.337,workY+.215,31.09],[-1.336,workY+.130,31.09],[-1.374,workY+.102,31.09]],.010);
 // The shared noticeboard faces the room from the wall beside the dining tables.
 box(oak,-4.925,-4.817,staffFloor+1.13,staffFloor+2.47,24.68,27.37);
 panel('staff-board',-4.808,staffFloor+1.80,26.025,2.58,1.23,Math.PI/2);
 for(const v of [22.7,26.58]){
  placeRoomFurniture(block,M,'reading-table',0,v,staffFloor,[1.48,.76,1.48]);
  mealChair(-1.01,v,Math.PI/2);mealChair(1.01,v,-Math.PI/2);
 }
 for(let f=1;f<4;f++)sign(HQ_FLOORS[f].toUpperCase(),-5.90,level(f)+2.53,15.90,4.15,.46);
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
  Patrol:['Police_Male_03','Police_Male_01'],Command:['Police_Male_03','Police_Male_01'],'Metro SWAT':['Police_Male_02'],
  Detectives:['Business_Female_01','Police_Male_07','Police_Male_06','Police_Male_07'],
  Forensics:['Medical_Female_01','Medical_Male_01'],
  Communications:['Female_Adult_03','Male_Adult_08','Business_Female_01'],
  'Air Support':['Male_Adult_04','Female_Adult_07','Security_Male_01']
 }[member.division]:['Male_Adult_04','Female_Adult_03','Male_Adult_08','Female_Adult_07','Business_Male_01','Business_Female_01'];
 const names=roster.filter(name=>TPL[name]);
 return names.length?names[(member.badge*7)%names.length]:pickChar('m');
}

function personalizeOfficer(c,member){
 // The same portrait and hair follow a person between civilian clothes and a uniform.
 if(member.division!=='Metro SWAT'||!c.name.startsWith('Police_')){
  const portraits=['Male_Adult_04','Female_Adult_03','Male_Adult_08','Business_Female_01',
   'Business_Male_01','Female_Adult_07','Male_Adult_07','Female_Adult_01','Male_Adult_01','Male_Adult_03'];
  const preferred=portraits[(member.badge*7+Math.floor(member.badge/3))%portraits.length];
  if(TPL[preferred]&&c.name!==preferred)fitDepartmentPortrait(c,preferred);
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
 if(!['Patrol','Metro SWAT'].includes(member.division))clipDepartmentCard(c,member);
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
