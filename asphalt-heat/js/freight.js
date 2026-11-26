/* The container terminal extends south from the existing industrial district. */
const FREIGHT={
 x0:118,x1:642,z0:W+HALF,z1:1252,y:.11,gateHalf:9,
 gates:[{x:192,name:'SERVICE GATE'},{x:384,name:'PORT OF ASPHALT'}],
 yards:[
  {x0:216,x1:351,z0:1086,z1:1190},
  {x0:410,x1:554,z0:1083,z1:1190},
  {x0:574,x1:623,z0:1083,z1:1190}
 ],
 ships:[
  {x:255,z:1271,length:194,beam:29,name:'NORTHWIND',color:0x24485b,cranes:[219,300]},
  {x:492,z:1270,length:146,beam:25,name:'KITE BAY',color:0x495645,cranes:[463,534]}
 ],
 cranes:[],
 solids:[]
};

const FREIGHT_PALETTE=[0x9b4338,0x355e70,0x376864,0xb89147,0xa3947a,0x6e4851,0x9b6b40];

function freightGateAt(x,r=0){
 return FREIGHT.gates.some(g=>Math.abs(x-g.x)<FREIGHT.gateHalf-r);
}

function southWallSpans(){
 const gaps=FREIGHT.gates.flatMap(g=>[g.x-FREIGHT.gateHalf,g.x+FREIGHT.gateHalf]);
 const ends=[-HALF-1,...gaps,W+60];
 return ends.filter((_,i)=>i%2===0).map((a,i)=>[a,ends[i*2+1]]);
}

function inFreightPort(x,z,r=0){
 return z>=FREIGHT.z0&&x>=FREIGHT.x0-r&&x<=FREIGHT.x1+r;
}

// The two gate roads are connected by east-west aisles at the front and back of the yards.
const FREIGHT_AISLES=[1070,1206];
function freightPatrolSpot(origin,min,max){
 for(let i=0;i<48;i++){
  const across=i%2===0,dir=Math.random()<.5?-1:1;
  const x=across?clamp(origin.x+rnd(-max,max),179,FREIGHT.x1-12):pick(FREIGHT.gates).x-dir*3;
  const z=across?pick(FREIGHT_AISLES)+dir*3:clamp(origin.z+rnd(-max,max),FREIGHT.z0+19,FREIGHT.z1-39);
  const range=Math.hypot(origin.x-x,origin.z-z);
  if(range<min||range>max||cars.some(c=>Math.hypot(c.pos.x-x,c.pos.z-z)<10))continue;
  if(rayWorld(x-1,z-2.6,x+1,z+2.6,1,1,.3)<1)continue;
  return {x,z,h:across?dir*Math.PI/2:dir>0?0:Math.PI};
 }
 return null;
}

function freightGateNode(x){
 const gate=FREIGHT.gates.reduce((a,b)=>Math.abs(a.x-x)<=Math.abs(b.x-x)?a:b);
 return {x:gate.x,z:W};
}
function freightWaypoint(from,to){
 const entering=to.z>=FREIGHT.z0;
 const gate=freightGateNode(entering?to.x:from.x);
 if(entering&&from.z<FREIGHT.z0+17){
  if(from.z<W-6||Math.abs(from.x-gate.x)>5)return gate;
  return {x:gate.x,z:FREIGHT.z0+21};
 }
 if(!entering)to=gate;
 const clear=(a,b)=>rayWorld(a.x,a.z,b.x,b.z,1.15,1.15,.8)>=1;
 if(clear(from,to))return to;
 let best=null,cost=Infinity;
 const corners=FREIGHT.gates.flatMap(g=>FREIGHT_AISLES.map(z=>({x:g.x,z})));
 for(const a of corners){
  if(dist2(from,a)<4||!clear(from,a))continue;
  for(const b of corners){
   if(a.x!==b.x&&a.z!==b.z||!clear(b,to))continue;
   const length=dist2(from,a)+dist2(a,b)+dist2(b,to);
   if(length<cost){best=a;cost=length;}
  }
 }
 return best||to;
}

function patrolWaypoint(c,target){
 if(!c.portAim||time>=c.portAimUntil||dist2(c.pos,c.portAim)<4){
  c.portAim=freightWaypoint(c.pos,target);
  c.portAimUntil=time+.65;
 }
 return c.portAim;
}
function driveToFreightExit(c,dt){
 const next=patrolWaypoint(c,freightGateNode(c.pos.x));
 const diff=wrapA(Math.atan2(next.x-c.pos.x,next.z-c.pos.z)-c.h);
 const target=blockedAhead(c)?0:Math.abs(diff)>.65?5:10;
 drive(c,clamp((target-c.speed)*.4,-1,1),clamp(diff*2,-1,1),!target,dt);
 c.ai=null;c.siren=false;c.route=null;c.dispatched=false;
}

function freightSolid(x0,x1,z0,z1,h,y0=0){
 const r={x0,x1,z0,z1,h,y0};
 FREIGHT.solids.push(r);
 STATIC.push(r);
 return r;
}

function freightBeam(mat,a,b,w,d=w){
 const start=new V3(...a),end=new V3(...b),slope=end.clone().sub(start);
 const height=slope.length();
 const geo=new THREE.BoxGeometry(w,height,d);
 const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),slope.normalize());
 const matrix=new THREE.Matrix4().makeRotationFromQuaternion(q);
 const center=start.lerp(end,.5);
 matrix.setPosition(center.x,center.y,center.z);
 geo.applyMatrix4(matrix);
 geo.computeBoundingBox();
 const {min,max}=geo.boundingBox;
 const solid=freightSolid(min.x,max.x,min.z,max.z,max.y,min.y);
 solid.obb={p:center,q,w,h:height,d};
 solid.walkIgnore=true; // The feet below the sloping legs supply pedestrian collision.
 addGeo(mat,geo,true);
}

function freightContainer(x,z,y,length,color){
 plainBox(MAT.container,x,x+length,y,y+2.57,z,z+2.44,{uvm:2.5,tint:color});
}

function buildFreightTerminal(){
 const p=FREIGHT,{x0,x1,z0,z1,y}=p;
 const seaWidth=2500+W+62,seaDepth=1750;
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(seaWidth,seaDepth,108,59),MAT.water);
 sea.rotation.x=-Math.PI/2;
 sea.position.set(W+62-seaWidth/2,-.35,z0+seaDepth/2);
 scene.add(sea);
 REFL.hide.push(sea);

 const apron=pbr('asphalt',6.7,{color:0x9b9d9e,rough:.87,ns:.55});
 const hardstand=pbr('concrete',4.8,{color:0xa0a19a,rough:.89,ns:.55});
 const steel=pbr('panels',3.6,{color:0x568890,rough:.67,metal:.35,ns:.53});
 const yellow=new THREE.MeshStandardMaterial({color:lin(0xd7a344),roughness:.74});
 const lanePaint=new THREE.MeshStandardMaterial({color:lin(0xdfbf66),roughness:.8,
  polygonOffset:true,polygonOffsetFactor:-1});
 const whitePaint=new THREE.MeshStandardMaterial({color:lin(0xc9c9bf),roughness:.9,
  polygonOffset:true,polygonOffsetFactor:-1});
 const navy=new THREE.MeshStandardMaterial({color:lin(0x2b4e5c),roughness:.62});

 STREET.steps.push({x0,x1,z0,z1,y});
 topQuad(apron,x0,x1,y,z0,z1,1,null,false);
 topQuad(hardstand,x0,x1,y+.006,z1-38,z1,1,null,false);
 for(const x of [x0,x1-.9]){
  plainBox(MAT.column,x,x+.9,-3,.89,z0,z1,{uvm:2.4,shadow:false});
  freightSolid(x,x+.9,z0,z1,1.14);
 }
 plainBox(MAT.column,x0,x1,-3,y-.04,z1-1.45,z1,{uvm:2.8,shadow:false});
 for(let x=x0+6;x<x1-4;x+=9){
  plainBox(MAT.darkMetal,x-.62,x+.62,-1.8,.05,z1-.22,z1+.54,{uvm:1.3});
  if((x-x0-6)%18===0){
   cyl(MAT.darkMetal,x,y,z1-1.32,.23,.42,.52,10);
   cyl(yellow,x,y+.44,z1-1.32,.26,.25,.105,10);
   freightSolid(x-.26,x+.26,z1-1.58,z1-1.06,y+.545,y).radius=.26;
  }
 }
 plainBox(yellow,x0+2,x1-2,y+.004,y+.019,z1-1.03,z1-.84,{shadow:false});
 // The marked circulation lanes connect both city streets and the quay.
 for(const {x} of p.gates){
  for(const d of [-7.8,7.8])topQuad(whitePaint,x+d-.11,x+d+.11,y+.014,z0+1,z1-38,1);
  for(let z=z0+6;z<z1-42;z+=12)topQuad(lanePaint,x-.085,x+.085,y+.014,z,z+5,1);
 }
 for(const z of FREIGHT_AISLES){
  const startX=z===1070?179:x0+8;
  for(const d of [-7.1,7.1])topQuad(whitePaint,startX,x1-9,y+.014,z+d-.09,z+d+.09,1);
  for(let x=startX+4;x<x1-10;x+=12)topQuad(lanePaint,x,x+5.4,y+.014,z-.09,z+.09,1);
 }
 for(const [i,gate] of p.gates.entries())buildFreightGate(gate,i===1,steel,yellow);

 for(const [i,yard] of p.yards.entries()){
  topQuad(hardstand,yard.x0,yard.x1,y+.006,yard.z0,yard.z1,1,null,false);
  for(let z=yard.z0+3,row=0;z<yard.z1-4;z+=9.8,row++){
   topQuad(whitePaint,yard.x0+1,yard.x1-1,y+.014,z-.95,z-.86,1);
   for(let x=yard.x0+4,n=0;x<yard.x1-13.6;x+=14.15,n++){
    const seed=i*13+row*7+n*11;
    if(seed%13===0)continue;
    const levels=1+(seed%3);
    for(let level=0;level<levels;level++){
     freightContainer(x,z,y+2.6*level,12.16,FREIGHT_PALETTE[(seed+level*2)%FREIGHT_PALETTE.length]);
    }
    freightSolid(x,x+12.16,z,z+2.44,y+2.6*levels);
   }
  }
 }
 buildFreightYardGantry(252,1128,yellow);
 buildFreightYardGantry(501,1155,yellow);
 buildFreightShed();
 buildFreightRail(navy);
 buildFreightTruck(158,1170,0,0xb78a52);
 buildFreightTruck(564,1171,Math.PI,0x547c8c);
 buildFreightTruck(621,1056,Math.PI/2,0x8b4f41);
 for(const x of [137,199,350,413,557,631])for(const z of [1083,1201]){
  cyl(MAT.darkMetal,x,y,z,.075,.28,14.3,9);
  plainBox(MAT.darkMetal,x-1.55,x+1.55,14.25,14.4,z-.09,z+.09);
  plainBox(STREET.materials.bulb,x-1.52,x-1.15,14.08,14.29,z-.2,z+.2,{shadow:false});
  plainBox(STREET.materials.bulb,x+1.15,x+1.52,14.08,14.29,z-.2,z+.2,{shadow:false});
  freightSolid(x-.23,x+.23,z-.23,z+.23,14.4);
 }
 for(const z of [z1-25,z1-6]){
  plainBox(MAT.darkMetal,x0+7,x1-5,y+.01,y+.042,z-.11,z+.11,{shadow:false});
 }
 for(const [i,ship] of p.ships.entries()){
  buildFreightShip(ship,i);
  for(const x of ship.cranes)buildQuayCrane(x,ship,steel,yellow,p.cranes.length);
 }
 updateFreightCranes(0,0);
}

function buildFreightGate({x,name},primary,steel,yellow){
 const z=FREIGHT.z0+12;
 for(const d of [-1,1]){
  const gx=x+d*8;
  plainBox(MAT.column,gx-.36,gx+.36,.11,5.6,z-.39,z+.39,{uvm:1.6});
  plainBox(yellow,gx-.46,gx+.46,.11,.83,z-.51,z+.51);
  freightSolid(gx-.42,gx+.42,z-.43,z+.43,5.6);
 }
 plainBox(steel,x-8.7,x+8.7,5.47,6.13,z-2.35,z+2.42,{uvm:2.4});
 freightSolid(x-8.7,x+8.7,z-2.35,z+2.42,6.13,5.47);
 const slot=atlasSlot((g,w,h)=>{
  g.fillStyle='#23373f';g.fillRect(0,0,w,h);
  g.strokeStyle='#a3bdbb';g.lineWidth=3;g.strokeRect(9,9,w-18,h-18);
  g.fillStyle='#f6e5be';g.textAlign='center';g.textBaseline='middle';
  g.font='bold 54px Inter, Arial, sans-serif';g.fillText(name,w/2,primary?52:65,w-40);
  if(primary){g.font='600 25px Inter, Arial, sans-serif';g.fillText('CONTAINER TERMINAL',w/2,96);}
 });
 signQuad(slot,x,5.75,z-2.38,10.7,1.08,Math.PI,false);
 for(const d of [-1,1]){
  const bx=x+d*6.72,bz=z-3.5;
  cyl(yellow,bx,.11,bz,.15,.18,.85,8);
  freightSolid(bx-.18,bx+.18,bz-.18,bz+.18,.96,.11).radius=.18;
 }
}

function buildFreightYardGantry(x,z,yellow){
 const y=FREIGHT.y,t=16.8,w=13.5,d=4.7;
 for(const s of [-1,1])for(const side of [-1,1]){
  const px=x+s*w,pz=z+side*d;
  freightBeam(yellow,[px,y+1.1,pz],[x+s*(w-1.16),t,pz],.83,1.05);
  plainBox(MAT.darkMetal,px-.64,px+.64,y,y+1.24,pz-1.37,pz+1.37,{uvm:1.5});
  freightSolid(px-.64,px+.64,pz-1.37,pz+1.37,y+1.24,y);
 }
 for(const side of [-1,1]){
  freightBeam(yellow,[x-w,t,z+side*d],[x+w,t,z+side*d],1.2,1.4);
 }
 plainBox(yellow,x-1.43,x+1.43,t-1.26,t+.16,z-5.3,z+5.3);
 for(const s of [-1,1]){
  cyl(MAT.darkMetal,x+s*.61,t-5.15,z,.032,.032,4.4,6);
 }
 plainBox(yellow,x-3.1,x+3.1,t-5.42,t-5.1,z-.74,z+.74);
}

function buildFreightShed(){
 const x0=129,x1=177,z0=1063,z1=1125,y=FREIGHT.y;
 plainBox(MAT.corrugated,x0,x1,y,8.5,z0,z1,{uvm:3.2});
 freightSolid(x0,x1,z0,z1,8.5);
 plainBox(MAT.roof,x0-.34,x1+.34,8.5,8.9,z0-.42,z1+.42,{uvm:3.2});
 for(let z=z0+5;z+9<z1;z+=12){
  plainBox(MAT.darkMetal,x1,x1+.09,y,4.8,z,z+7.1);
  plainBox(MAT.shutter,x1+.091,x1+.15,y+.14,4.53,z+.19,z+6.91,{uvm:2.6});
  plainBox(MAT.trim,x1,x1+2.1,4.73,5.02,z-.4,z+7.5,{uvm:2.5});
  plainBox(MAT.column,x1,x1+.84,y,y+.98,z-.14,z+7.29,{uvm:1.7});
  freightSolid(x1,x1+.84,z-.14,z+7.29,1.0);
 }
}

function buildFreightRail(navy){
 const y=FREIGHT.y,z=1048;
 for(let x=414;x<630;x+=2.35){
  plainBox(MAT.wood,x-.16,x+.16,y,y+.035,z-1.07,z+1.07,{shadow:false});
 }
 for(const s of [-1,1]){
  plainBox(MAT.darkMetal,414,630,y+.018,y+.073,z+s*.72-.055,z+s*.72+.055,{shadow:false});
 }
 for(const [i,x] of [435,461,489,517,545,575,598].entries()){
  plainBox(navy,x,x+22,y+.37,y+1.04,z-1.48,z+1.48,{uvm:2.2});
  for(const e of [1.68,19.8]){
   plainBox(MAT.darkMetal,x+e-.81,x+e+.81,y+.11,y+.64,z-1.38,z+1.38);
  }
  freightContainer(x+3,z-1.21,y+1.04,12.2,FREIGHT_PALETTE[i]);
  freightSolid(x,x+22,z-1.48,z+1.48,y+3.65);
 }
}

function buildFreightTruck(x,z,yaw,color){
 const frame=new THREE.Matrix4().makeRotationY(yaw).setPosition(x,FREIGHT.y,z);
 const paint=new THREE.MeshStandardMaterial({color:lin(color),roughness:.59});
 const box=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M:frame,uvm:2.3});
 box(MAT.darkMetal,-1.2,1.2,.44,.94,-8.6,2.55);
 box(paint,-1.17,1.17,.81,2.87,1,4.28);
 box(paint,-1.15,1.15,2.87,3.01,1.02,3.85);
 box(MAT.glassDark,-1.02,1.02,1.82,2.57,4.278,4.31);
 for(const sign of [-1,1]){
  const px=sign*1.175;
  box(MAT.glassDark,px-.018,px+.018,1.83,2.57,2.82,4.06);
  box(MAT.trim,sign*1.46-.08,sign*1.46+.08,1.92,2.39,3.61,3.82);
  for(const v of [3.52,1.61,-6.48,-7.55]){
   const geo=new THREE.CylinderGeometry(.55,.55,.34,12);
   geo.rotateZ(Math.PI/2);
   geo.translate(sign*1.01,.55,v);
   geo.applyMatrix4(frame);
   addGeo(MAT.darkMetal,geo,true);
  }
 }
 box(MAT.whiteMetal,-1.14,1.14,.67,.82,4.29,4.44);
 box(MAT.corrugated,-1.21,1.21,.94,3.53,-8.38,.45);
 const a=new V3(-1.5,0,-8.7).applyMatrix4(frame),b=new V3(1.5,0,4.45).applyMatrix4(frame);
 freightSolid(Math.min(a.x,b.x),Math.max(a.x,b.x),Math.min(a.z,b.z),Math.max(a.z,b.z),3.7);
}

const FREIGHT_SHIP_DECK=6.15;

function buildFreightShip(ship,i){
 const {x,z,length,beam,color,name,cranes}=ship,deckY=FREIGHT_SHIP_DECK;
 const outline=[
  [-.5,-.33],[-.48,-.46],[-.37,-.5],[.29,-.5],[.43,-.36],[.50,-.08],
  [.50,.08],[.43,.36],[.29,.5],[-.37,.5],[-.48,.46],[-.5,.33]
 ];
 const row=(scale,y)=>outline.map(([u,v])=>[x+u*length,z+v*beam*scale,y]);
 const bottom=row(.61,-4.2),waterline=row(.96,-.44),rim=row(1,deckY);
 const hull=new THREE.MeshStandardMaterial({color:lin(color),roughness:.78,side:THREE.DoubleSide});
 const below=new THREE.MeshStandardMaterial({color:lin(0x71382e),roughness:.9,side:THREE.DoubleSide});
 const deckMat=new THREE.MeshStandardMaterial({color:lin(0x8d7965),roughness:.87,side:THREE.DoubleSide});
 const point=([u,v,h])=>[u,h,v];
 for(const [from,to,mat] of [[bottom,waterline,below],[waterline,rim,hull]]){
  const verts=[],indices=[];
  for(let n=0;n<outline.length;n++){
   const next=(n+1)%outline.length,k=verts.length/3;
   verts.push(...point(from[n]),...point(from[next]),...point(to[n]),...point(to[next]));
   indices.push(k,k+1,k+2,k+1,k+3,k+2);
  }
  addFreightSurface(mat,verts,indices);
 }
 const cap=[];
 for(let n=0;n<outline.length;n++)cap.push(outline.length,(n+1)%outline.length,n);
 addFreightSurface(deckMat,[...rim.flatMap(point),x,deckY,z],cap);
 const [plate,g]=cvs(512,128);
 g.textAlign='center';g.textBaseline='middle';g.font='bold 60px Inter, Arial, sans-serif';g.fillStyle='#e7e3d5';
 g.fillText(name,256,64,470);
 const lettering=new THREE.MeshStandardMaterial({
  map:ctex(plate),alphaTest:.45,roughness:.78,side:THREE.DoubleSide
 });
 for(const side of [-1,1]){
  const face=new THREE.PlaneGeometry(19,3.2);
  if(side<0)face.rotateY(Math.PI);
  face.translate(x+length*.15,deckY-1.63,z+side*(beam*.5+.014));
  addGeo(lettering,face,false);
 }
 for(const sign of [-1,1]){
  const edge=z+sign*beam*.49;
  plainBox(MAT.whiteMetal,x-length*.35,x+length*.27,deckY+.87,deckY+.94,edge-.037,edge+.037);
  for(let u=x-length*.35;u<x+length*.27;u+=3.9)cyl(MAT.whiteMetal,u,deckY,edge,.042,.052,.89,6);
 }
 const aft=x-length*.337,w=beam*.34;
 for(let level=0;level<4;level++){
  const ay=deckY+level*2.62;
  plainBox(MAT.whiteMetal,aft-7.85+level*.22,aft+7.7-level*.2,ay,ay+2.59,z-w,z+w,{uvm:2.8});
  for(const s of [-1,1]){
   plainBox(MAT.glassDark,aft-6.7,aft+6.6,ay+1.44,ay+2.08,z+s*(w+.015)-.018,z+s*(w+.015)+.019);
  }
 }
 const bridge=deckY+10.48;
 plainBox(MAT.whiteMetal,aft-7.8,aft+8.3,bridge,bridge+2.8,z-w-1.07,z+w+1.07);
 plainBox(MAT.glassDark,aft+8.285,aft+8.34,bridge+1.27,bridge+2.51,z-w-.91,z+w+.91);
 plainBox(MAT.trim,aft-7.95,aft+8.42,bridge+2.8,bridge+3.08,z-w-1.21,z+w+1.21);
 plainBox(hull,aft-7.6,aft-3.22,bridge+2.95,bridge+6.45,z-2.38,z+2.38,{uvm:2.4});
 plainBox(MAT.darkMetal,aft-7.77,aft-3.04,bridge+6.45,bridge+6.9,z-2.51,z+2.51);
 cyl(MAT.darkMetal,aft+2.7,bridge+3.05,z,.048,.22,6.33,8);
 plainBox(MAT.whiteMetal,aft+2.54,aft+2.9,bridge+8.53,bridge+8.71,z-2.1,z+2.1);
 const lifeboat=new THREE.SphereGeometry(1,13,8);
 lifeboat.scale(3.66,.95,1.13);
 lifeboat.translate(aft+1.7,deckY+5.75,z+w+.6);
 addGeo(new THREE.MeshStandardMaterial({color:lin(0xb86a2d),roughness:.61}),lifeboat,true);
 for(let u=x-length*.22,bay=0;u+12.2<x+length*.32;u+=12.76,bay++){
  for(let v=z-beam*.36,line=0;v+2.44<z+beam*.38;v+=2.61,line++){
   if(cranes.some(cx=>Math.abs(u+6.08-cx)<12)&&Math.abs(v+1.22-z)<3.5)continue;
   const levels=1+(bay+line*2+i)%3;
   for(let level=0;level<levels;level++){
    freightContainer(u,v,deckY+2.6*level,12.15,FREIGHT_PALETTE[(bay*3+line+level+i)%FREIGHT_PALETTE.length]);
   }
  }
 }
 for(const u of [x-length*.41,x+length*.39]){
  const a=new V3(u,deckY-.28,z-beam*.48),b=new V3(u+3,FREIGHT.y+.45,FREIGHT.z1-1.1);
  const sag=a.clone().lerp(b,.5);sag.y-=1.7;
  const rope=new THREE.QuadraticBezierCurve3(a,sag,b);
  addGeo(MAT.wood,new THREE.TubeGeometry(rope,9,.047,5,false),false);
 }
}

function addFreightSurface(mat,verts,indices){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 addGeo(mat,geometry,true);
}

function buildQuayCrane(x,ship,steel,yellow,index){
 const {z1,y}=FREIGHT,boom=37.7,tip=z1+39,back=z1-42,peak=52;
 const rails=[z1-25,z1-6];
 for(const s of [-1,1]){
  const outer=x+s*7.9,inner=x+s*5;
  for(const z of rails){
   plainBox(MAT.darkMetal,outer-1.32,outer+1.32,y,y+.82,z-2.7,z+2.7,{uvm:1.6});
   plainBox(steel,outer-.91,outer+.91,y+.61,y+1.95,z-2.28,z+2.28);
   plainBox(yellow,outer-1.36,outer+1.36,y+.26,y+.55,z+2.7,z+2.79);
   freightSolid(outer-1.27,outer+1.27,z-2.72,z+2.72,2.16);
   freightBeam(steel,[outer,y+1.59,z],[inner,boom,z],1.37,1.24);
  }
  freightBeam(steel,[outer,y+8.3,rails[0]],[outer,y+8.3,rails[1]],1.35);
  freightBeam(steel,[outer,y+8.3,rails[1]],[inner,boom-1.1,rails[0]],.47);
  freightBeam(steel,[inner,boom,rails[0]],[x+s*2.8,peak,rails[1]-1.9],.83);
  freightBeam(steel,[inner,boom,rails[1]],[x+s*2.8,peak,rails[1]-1.9],.85);
  for(const j of [0,1]){
   const xx=x+s*(2.16+j*.42);
   freightBeam(steel,[xx,boom+j*3.5,back],[xx,boom+j*3.5,tip],j?.55:.82);
  }
  for(let q=back;q<tip-3;q+=6.75){
   freightBeam(steel,[x+s*2.16,boom,q],[x+s*2.58,boom+3.5,Math.min(tip,q+6.75)],.27);
  }
  freightBeam(MAT.darkMetal,[x+s*2.8,peak,rails[1]-1.9],[x+s*2.56,boom+3.48,tip-5.5],.105);
  freightBeam(MAT.darkMetal,[x+s*2.8,peak,rails[1]-1.9],[x+s*2.56,boom+3.48,back+3.2],.105);
 }
 for(const z of [...rails,tip-.45,back+.4]){
  freightBeam(steel,[x-5.15,boom,z],[x+5.15,boom,z],1.07);
 }
 freightBeam(steel,[x-2.84,peak,rails[1]-1.9],[x+2.84,peak,rails[1]-1.9],.68);
 plainBox(steel,x-4.88,x+4.88,boom+.21,boom+4.16,back+2.4,back+14.3,{uvm:3.1});
 plainBox(MAT.glassDark,x+2.2,x+4.4,boom-3.06,boom-.53,rails[1]-.83,rails[1]+1.57);
 plainBox(steel,x+2.14,x+4.48,boom-.53,boom-.31,rails[1]-.89,rails[1]+1.64);
 const trolley=new THREE.Group(),load=new THREE.Group();
 trolley.position.x=x;
 load.position.x=x;
 scene.add(trolley,load);
 const carriage=new THREE.Mesh(new THREE.BoxGeometry(5.5,.92,2.52),yellow);
 carriage.position.y=boom-.31;
 carriage.castShadow=true;
 trolley.add(carriage);
 const cables=[];
 for(const dx of [-2.1,2.1])for(const dz of [-.65,.65]){
  const cable=new THREE.Mesh(new THREE.BoxGeometry(.042,1,.042),MAT.darkMetal);
  cable.position.set(dx,0,dz);
  trolley.add(cable);
  cables.push(cable);
 }
 const cargoGeo=new THREE.BoxGeometry(12.15,2.57,2.44);
 const uv=cargoGeo.attributes.uv;
 for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*4,uv.getY(k));
 setColor(cargoGeo,FREIGHT_PALETTE[(index+1)%FREIGHT_PALETTE.length]);
 const cargo=new THREE.Mesh(cargoGeo,MAT.container);
 cargo.position.y=1.285;
 cargo.castShadow=true;cargo.receiveShadow=true;
 const spreader=new THREE.Mesh(new THREE.BoxGeometry(11.6,.29,1.73),yellow);
 spreader.position.y=2.72;
 spreader.castShadow=true;
 load.add(cargo,spreader);
 const solid=freightSolid(x-6.075,x+6.075,ship.z-1.22,ship.z+1.22,2.57);
 solid.moving=true;
 FREIGHT.cranes.push({solid,trolley,load,cables,boom,shipZ:ship.z,landZ:z1-31,offset:index*.226});
}

function updateFreightCranes(time,dt){
 for(const c of FREIGHT.cranes){
  const phase=(time/36+c.offset)%1;
  const back=phase>=.5,leg=(phase%.5)*2;
  const startZ=back?c.landZ:c.shipZ,endZ=back?c.shipZ:c.landZ;
  const startY=back?FREIGHT.y:FREIGHT_SHIP_DECK,endY=back?FREIGHT_SHIP_DECK:FREIGHT.y;
  const bend=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
  const vertical=26.2;
  const lift=leg<.3?lerp(startY,vertical,bend(leg/.3)):
   leg>.71?lerp(vertical,endY,bend((leg-.71)/.29)):vertical;
  const along=lerp(startZ,endZ,bend((leg-.29)/.43));
  c.trolley.position.z=along;
  c.load.position.set(c.trolley.position.x,lift,along);
  // The entire trolley path stays in the same southern spatial-index cell.
  const solid=c.solid;
  solid.z0=along-1.22;solid.z1=along+1.22;solid.y0=lift;solid.h=lift+2.57;
  const body=STREETS_PHYS.bodies.get(solid);
  if(body&&dt>0)body.velocity.set(0,(lift+1.285-body.position.y)/dt,(along-body.position.z)/dt);
  const bottom=lift+2.85,top=c.boom-.45;
  for(const cable of c.cables){
   cable.scale.y=top-bottom;
   cable.position.y=(top+bottom)*.5;
  }
 }
}

function drawFreightMap(g,k){
 const {x0,x1,z0,z1,gates,yards,ships}=FREIGHT;
 const map=v=>(v+HALF)*k;
 const fill=(r,color)=>{
  g.fillStyle=color;
  g.fillRect(map(r.x0),map(r.z0),(r.x1-r.x0)*k,(r.z1-r.z0)*k);
 };
 g.fillStyle='#1d5866';
 g.fillRect(0,map(z0),map(W+62),g.canvas.height-map(z0));
 fill({x0,x1,z0,z1},'#827f76');
 fill({x0,x1,z0:z1-38,z1},'#b1a592');
 for(const r of yards)fill(r,'#4d5957');
 for(const {x} of gates)fill({x0:x-8,x1:x+8,z0:z0-4,z1:z1-38},'#a19e91');
 for(const s of ships){
  const {x,z,length,beam,color}=s;
  g.fillStyle='#3b484b';
  g.beginPath();
  g.moveTo(map(x-length*.5),map(z-beam*.41));
  g.lineTo(map(x+length*.32),map(z-beam*.5));
  g.lineTo(map(x+length*.5),map(z));
  g.lineTo(map(x+length*.32),map(z+beam*.5));
  g.lineTo(map(x-length*.5),map(z+beam*.41));
  g.closePath();
  g.fill();
  const rgb='#'+color.toString(16).padStart(6,'0');
  fill({x0:x-length*.3,x1:x+length*.25,z0:z-beam*.26,z1:z+beam*.26},rgb);
 }
}
