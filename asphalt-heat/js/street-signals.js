// Fixed heads and pedestrian displays use the same controller as the road users.
const CITY_SIGNALS={groups:[],signs:new Map()};
function makeStreetSigns(){
 const [c,g]=cvs(2048,1024),cols=8,rows=8,cw=c.width/cols,ch=c.height/rows;
 const names=[...new Set([...STREET_NAMES.ns,...STREET_NAMES.ew])];
 const labels=['STOP','ALL WAY','SPEED HUMP','20','25','30',...names];
 labels.forEach((label,index)=>{
  const col=index%cols,row=Math.floor(index/cols);
  CITY_SIGNALS.signs.set(label,{u:col/cols,v:1-(row+1)/rows});
  g.save();g.translate(col*cw,row*ch);g.scale(cw/128,ch/128);
  g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
  if(label==='STOP'){
   g.beginPath();
   for(let k=0;k<8;k++){
    const a=(k+.5)*Math.PI/4,x=64+65*Math.cos(a),y=64+65*Math.sin(a);
    if(k)g.lineTo(x,y);else g.moveTo(x,y);
   }
   g.closePath();g.fillStyle='#a72922';g.fill();g.strokeStyle='#faf3da';g.lineWidth=4;g.stroke();
   g.fillStyle='#fff7e5';g.font='bold 35px Arial';g.fillText('STOP',64,66);
  }else if(label==='SPEED HUMP'){
   g.beginPath();g.moveTo(64,2);g.lineTo(126,64);g.lineTo(64,126);g.lineTo(2,64);g.closePath();
   g.fillStyle='#e9b237';g.fill();g.strokeStyle='#302d23';g.lineWidth=3;g.stroke();
   g.fillStyle='#26241c';g.font='bold 19px Arial';g.fillText('SPEED',64,53);g.fillText('HUMP',64,74);
  }else if(['20','25','30'].includes(label)){
   g.fillStyle='#e7e4d8';g.fillRect(4,2,120,124);g.strokeStyle='#373831';g.lineWidth=3;g.strokeRect(8,6,112,116);
   g.fillStyle='#252620';g.font='bold 21px Arial';g.fillText('SPEED',64,25);g.fillText('LIMIT',64,49);
   g.font='bold 56px Arial';g.fillText(label,64,89);
  }else{
   g.fillStyle=label==='ALL WAY'?'#a33025':'#28554b';g.fillRect(1,2,126,124);
   g.strokeStyle='#d9dece';g.lineWidth=2;g.strokeRect(3,5,122,118);
   g.fillStyle='#fbf5dc';g.scale(1,3.3);g.font='bold 16px Arial';
   g.fillText(label.toUpperCase(),64,20,114);
  }
  g.restore();
 });
 return new THREE.MeshStandardMaterial({map:ctex(c),roughness:.57,alphaTest:.45,metalness:.13,side:THREE.DoubleSide});
}
function signFace(label,x,y,z,w,h,angle){
 const slot=CITY_SIGNALS.signs.get(label),g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,slot.u+(uv.getX(i)*.994+.003)/8,slot.v+(uv.getY(i)*.988+.006)/8);
 g.rotateY(angle);g.translate(x,y,z);addGeo(CITY_SIGNALS.material,g,false);
}
function signPole(x,z,height,radius){
 cyl(MAT.metal,x,.03,z,radius*.86,radius,height,10);
 STATIC.push({x0:x-radius,x1:x+radius,z0:z-radius,z1:z+radius,h:height,radius});
}
function pedestrianAtlas(){
 // Each tile contains a complete display so only a UV offset changes with the clock.
 const [c,g]=cvs(1024,512);
 for(let slot=0;slot<34;slot++){
  const x=(slot%8)*128,y=Math.floor(slot/8)*96;
  g.save();g.translate(x,y);g.fillStyle='#151a18';g.fillRect(0,0,128,96);
  g.lineWidth=6;g.lineCap='round';g.lineJoin='round';
  function line(points){g.beginPath();g.moveTo(...points[0]);for(const p of points.slice(1))g.lineTo(...p);g.stroke();}
  if(slot===0){
   g.fillStyle=g.strokeStyle='#f4f6e5';g.beginPath();g.arc(66,21,7,0,Math.PI*2);g.fill();
   line([[61,33],[54,51],[46,58]]);line([[61,32],[72,45],[80,47]]);
   line([[60,34],[60,55],[46,79]]);line([[60,55],[71,65],[79,79]]);
  }else{
   const count=slot>1,blinkOff=slot>=18,shift=count?0:31;
   if(!blinkOff){
    g.fillStyle=g.strokeStyle='#ff8f42';g.fillRect(shift+21,39,31,22);
    g.beginPath();g.ellipse(shift+36.5,58,15.5,12,0,0,Math.PI*2);g.fill();
    for(const [u,v] of [[24,27],[32,20],[40,18],[48,24]])line([[shift+u,47],[shift+u,v]]);
    line([[shift+24,55],[shift+13,41]]);
   }
   if(count){
    g.fillStyle='#ff9c4e';g.font='bold 49px Arial';g.textAlign='center';g.textBaseline='middle';
    g.fillText(String((slot-2)%16+1),88,48);
   }
  }
  g.restore();
 }
 return ctex(c);
}
function buildTrafficLights(){
 CITY_SIGNALS.material=makeStreetSigns();
 const housing=new THREE.MeshStandardMaterial({color:lin(0x333735),roughness:.67,metalness:.36});
 const buckets=new Map(),lens=new THREE.CircleGeometry(.15,16),pedFace=new THREE.PlaneGeometry(.53,.40);
 const pedTexture=pedestrianAtlas();
 function instance(key,x,y,z,angle){
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(new THREE.Matrix4().makeRotationY(angle).setPosition(x,y,z));
 }
 function hardware(g,mat,x,y,z,yaw=0){g.rotateY(yaw);g.translate(x,y,z);addGeo(mat,g,true);}
 function trafficHead(group,axis,x,z,angle){
  const fx=Math.sin(angle),fz=Math.cos(angle);
  hardware(new THREE.BoxGeometry(.56,1.26,.14),housing,x,5.29,z,angle);
  hardware(new THREE.BoxGeometry(.40,1.14,.26),housing,x+fx*.11,5.29,z+fz*.11,angle);
  for(const [index,letter] of [...'RYG'].entries()){
   const y=5.64-index*.35;
   const visor=new THREE.CylinderGeometry(.172,.172,.20,14,1,true,Math.PI/2,Math.PI);
   visor.rotateX(Math.PI/2);
   hardware(visor,housing,x+fx*.32,y,z+fz*.32,angle);
   instance(group+'|'+axis+'|'+letter,x+fx*.248,y,z+fz*.248,angle);
  }
 }
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
  const control=junctionControl(i,j),group=signalGroup(i,j),x=i*CELL,z=j*CELL;
  if(control==='signal'){
   // Cabinet doors open onto the furnishing strip, beyond the ramp landing.
   const bx=x+HALF+.64,bz=z+18.7;
   plainBox(MAT.curb,bx-.38,bx+.38,.15,.31,bz-.56,bz+.56);
   plainBox(MAT.metal,bx-.31,bx+.31,.31,1.48,bz-.48,bz+.48);
   plainBox(housing,bx-.316,bx-.31,.45,1.35,bz-.39,bz+.39,{shadow:false});
   plainBox(MAT.metal,bx-.325,bx-.317,.47,1.33,bz-.37,bz+.37,{shadow:false});
   for(let k=0;k<4;k++)plainBox(housing,bx-.330,bx-.325,1.12+k*.04,1.136+k*.04,bz-.22,bz+.22,{shadow:false});
   STATIC.push({x0:bx-.38,x1:bx+.38,z0:bz-.56,z1:bz+.56,y0:.15,h:1.48});
  }
  for(const [dx,dz] of CARDINAL){
   if(!hasApproach(i,j,dx,dz))continue;
   const axis=dx?'ew':'ns',rightX=-dz,rightZ=dx,angle=Math.atan2(-dx,-dz);
   const at=(along,right)=>[x+dx*along+rightX*right,z+dz*along+rightZ*right];
   const section=segmentSection([i-dx,j-dz],[i,j]);
   if(control==='signal'){
    const far=HALF+2.13,side=HALF+2.14,[px,pz]=at(far,side);
    signPole(px,pz,6.18,.135);
    plainBox(MAT.metal,px-.22,px+.22,.15,.195,pz-.22,pz+.22,{shadow:false});
    for(const offset of [-.145,.145])for(const bolt of [-.145,.145])
     cyl(MAT.darkMetal,px+offset,.195,pz+bolt,.031,.031,.045,6,{shadow:false});
    const nearLane=laneCenter(section,dx,dz,section.outer?1:0);
    const otherLane=section.outer?laneCenter(section,dx,dz):nearLane-2.75;
    const tip=Math.min(nearLane,otherLane)-.30,armLength=side-tip,[mx,mz]=at(far,(side+tip)/2);
    const arm=new THREE.CylinderGeometry(.064,.093,armLength,10);arm.rotateZ(Math.PI/2);
    hardware(arm,MAT.metal,mx,5.95,mz,dx?Math.PI/2:0);
    for(const u of [nearLane,otherLane]){
     const [hx,hz]=at(far,u);
     trafficHead(group,axis,hx,hz,angle);
    }
    const [bx,bz]=at(far-.15,side-1.35),blade=STREET_NAMES[dx?'ns':'ew'][dx?i:j];
    signFace(blade,bx,5.92,bz,2.32,.45,angle);
    if(hasCrossing(i,j,dx,dz)){
     // Both displays face along the crossing, towards the opposite landing.
     for(const sign of [-1,1]){
      const [qx,qz]=at(-STREET_DESIGN.crossing-1.73,sign*(HALF+.92));
      const yaw=Math.atan2(-sign*rightX,-sign*rightZ);
      signPole(qx,qz,2.51,.057);
      hardware(new THREE.BoxGeometry(.59,.47,.20),housing,qx,2.32,qz,yaw);
      instance(group+'|'+(dx?'ns':'ew')+'|ped',qx+Math.sin(yaw)*.106,2.32,qz+Math.cos(yaw)*.106,yaw);
     }
    }
   }else if(mustStop(control,axis)){
    const near=-(STREET_DESIGN.crossing-2.18);
    let [px,pz]=at(near,HALF+1.2);
    if(px< -HALF || px>W+HALF || pz< -HALF || pz>W+HALF)[px,pz]=at(near,-HALF-1.2);
    signPole(px,pz,3.21,.048);
    signFace('STOP',px-dx*.062,2.35,pz-dz*.062,.78,.78,angle);
    if(control==='all-stop')signFace('ALL WAY',px-dx*.064,1.83,pz-dz*.064,.54,.16,angle);
    const blade=STREET_NAMES[dx?'ns':'ew'][dx?i:j];
    signFace(blade,px-dx*.059,3.01,pz-dz*.059,1.48,.23,angle);
   }
  }
 }
 for(let line=1;line<N;line++)for(let block=0;block<N;block++)for(const axis of ['ns','ew']){
  const hump=hasSpeedHump(axis,line,block),section=streetSection(axis,line,block);
  if(!hump && (line+block)%5!==0)continue;
  for(const sign of [-1,1]){
   const dx=axis==='ew'?sign:0,dz=axis==='ns'?sign:0,along=block*CELL+(sign>0?19:45);
   const x=(dx?along:line*CELL)-dz*(HALF+.73),z=(dz?along:line*CELL)+dx*(HALF+.73);
   const angle=Math.atan2(-dx,-dz);signPole(x,z,2.79,.042);
   signFace(hump?'SPEED HUMP':section.rank===2?'30':section.rank===1?'25':'20',
    x-dx*.05,2.37,z-dz*.05,hump?.73:.5,hump?.73:.68,angle);
  }
 }
 const lit={R:[2.5,.065,.025],Y:[2.8,1.05,.025],G:[.075,2.15,.49]};
 for(const [key,matrices] of buckets){
  const [number,axis,letter]=key.split('|'),group=Number(number);
  const texture=letter==='ped'?pedTexture.clone():null;
  if(texture){texture.repeat.set(128/1024,96/512);texture.needsUpdate=true;}
  const mat=new THREE.MeshBasicMaterial(texture?{map:texture}:{color:0x2e302b});
  const mesh=new THREE.InstancedMesh(texture?pedFace:lens,mat,matrices.length);
  matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));scene.add(mesh);
  CITY_SIGNALS.groups.push({group,axis,letter,mat,texture,on:lit[letter],last:null});
 }
 updLights(0);
}
function updLights(time){
 const phases=Array.from({length:SIGNAL_GROUPS},(_,g)=>phaseForGroup(g,time));
 for(const item of CITY_SIGNALS.groups){
  const phase=phases[item.group][item.axis];
  if(item.texture){
   const slot=phase.ped==='walk'?0:phase.ped==='wait'?1:
    1+phase.remaining+((Math.floor(time*2)%2)?16:0);
   if(slot===item.last)continue;
   item.last=slot;item.texture.offset.set(slot%8/8,1-(Math.floor(slot/8)+1)*96/512);
  }else{
   const on=item.letter===phase.vehicle;
   if(on===item.last)continue;
   item.last=on;
   if(on)item.mat.color.setRGB(...item.on);else item.mat.color.setRGB(.030,.034,.031);
  }
 }
}
