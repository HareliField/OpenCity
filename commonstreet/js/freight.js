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
 solids:[],cargoDecks:new Map(),containerPaint:new Map()
};

const FREIGHT_PALETTE=[0x9b4338,0x355e70,0x376864,0xb89147,0xa3947a,0x6e4851,0x9b6b40];
const FREIGHT_MARKS={ink:null,serial:17238};

function freightStencilInk(){
 if(FREIGHT_MARKS.ink)return FREIGHT_MARKS.ink;
 const [canvas,g]=cvs(1024,1024);
 const names=[['NORTHWIND','NWLU'],['TIDELINE','TLCU'],['KITE BAY','KBCU'],['FOUNDRY','FDRU'],
  ['SEABRIGHT','SBTU'],['CAPE LINE','CPLU'],['FERRY FREIGHT','FRYU'],['COASTAL','CSLU']];
 g.fillStyle='#e5e1d4';g.textBaseline='middle';
 for(const [i,[name,code]] of names.entries()){
  const x=(i%2)*512,y=Math.floor(i/2)*128;
  g.font='bold 63px Arial, sans-serif';g.fillText(name,x+8,y+48,490);
  g.font='bold 30px Arial, sans-serif';g.fillText('INTERMODAL',x+11,y+98);
  g.font='bold 68px Courier New, monospace';g.fillText(code,x+10,512+Math.floor(i/2)*68+33,209);
 }
 g.textAlign='center';g.font='bold 66px Courier New, monospace';
 for(let n=0;n<10;n++)g.fillText(String(n),n*64+32,844);
 // Small losses of paint reveal the ribbed steel through every marking.
 g.globalCompositeOperation='destination-out';
 for(let k=0;k<4600;k++)g.fillRect((k*223+Math.floor(k/7)*37)%1024,(k*149+Math.floor(k/19)*79)%876,1+k%4,1+(k%13===0?2:0));
 const map=ctex(canvas);FREIGHT_MARKS.ink=new THREE.MeshStandardMaterial({map,alphaTest:.27,roughness:.90,vertexColors:true,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 return FREIGHT_MARKS.ink;
}

function freightMarkings(x,z,y,length,tint,pressed=false){
 const ink=freightStencilInk(),serial=String(FREIGHT_MARKS.serial++).padStart(6,'0');
 const brand=(Math.round(x*3+z*7+y*19)>>>0)%8,col=lin(tint);
 const shade=col.g>.49?lin(0x584f43):lin(0xf2eee3),ribWidth=(length-.152)/Math.round((length-.152)/.249);
 for(const side of [-1,1]){
  const outer=side<0?z:z+2.44,pos=[],norm=[],uv=[],colors=[],tri=[];
  function panel(mid,height,width,tall,px,py,pw,ph){
   const lo=mid-width/2,hi=mid+width/2,stations=[lo];
   if(pressed){
    const first=Math.floor((lo-x-.076)/ribWidth),last=Math.floor((hi-x-.076)/ribWidth);
    for(let k=first;k<=last;k++)for(const u of [0,.17,.32,.65,.80]){
     const at=x+.076+(k+u)*ribWidth;if(at>lo&&at<hi)stations.push(at);
    }
   }
   stations.push(hi);
   for(let i=0;i<stations.length;i++){
    const at=stations[i],ratio=(at-lo)/width,u=(px+(side>0?ratio:1-ratio)*pw)/1024;
    const f=((at-x-.076)/ribWidth)%1;
    const relief=pressed?(f<.17?.065:f<.32?lerp(.065,.018,(f-.17)/.15):f<.65?.018:f<.8?lerp(.018,.065,(f-.65)/.15):.065):0;
    const face=outer+side*(.004-relief),k=pos.length/3;
    pos.push(at,height-tall/2,face,at,height+tall/2,face);
    norm.push(0,0,side,0,0,side);uv.push(u,1-(py+ph)/1024,u,1-py/1024);
    colors.push(shade.r,shade.g,shade.b,shade.r,shade.g,shade.b);
    if(i){if(side>0)tri.push(k-2,k,k-1,k,k+1,k-1);else tri.push(k-2,k-1,k,k,k-1,k+1);}
   }
  }
  const brandX=(brand%2)*512,brandY=Math.floor(brand/2)*128;
  if(Number(serial)%9<6){
   const off=.42+(Number(serial)%5)*.038,width=Math.min(length*.47,3.2+brand*.185);
   panel(x+length*off,y+1.55+brand*.042,width,width*.197,brandX+1,brandY+1,509,125);
  }
  const end=x+(side>0?length-.91:.91);
  panel(end,y+2.13,.52,.16,brandX+1,512+Math.floor(brand/2)*68+1,220,66);
  for(let i=0;i<serial.length;i++)panel(end+side*(i-2.5)*.095,y+1.94,.094,.16,Number(serial[i])*64+1,810,62,68);
  const geo=new THREE.BufferGeometry();
  for(const [key,data,n] of [['position',pos,3],['normal',norm,3],['uv',uv,2],['color',colors,3]])
   geo.setAttribute(key,new THREE.Float32BufferAttribute(data,n));
  geo.setIndex(tri);addGeo(ink,geo,false);
 }
}

function freightGateAt(x,r=0){
 return FREIGHT.gates.some(g=>Math.abs(x-g.x)<FREIGHT.gateHalf-r);
}

function southWallSpans(){
 const gaps=FREIGHT.gates.map(g=>[g.x-FREIGHT.gateHalf,g.x+FREIGHT.gateHalf])
  .concat(HARBOR.yard.streets.map(x=>[x-10.52,x+10.52])).sort((a,b)=>a[0]-b[0]);
 const ends=[-HALF-1,...gaps.flat(),HARBOR.basin.x0];
 return ends.filter((_,i)=>i%2===0).map((a,i)=>[a,ends[i*2+1]]);
}

function inFreightPort(x,z,r=0){
 return z>=FREIGHT.z0&&x>=FREIGHT.x0-r&&x<=FREIGHT.x1+r;
}

// The two gate roads are connected by east-west aisles at the front and back of the yards.
const FREIGHT_AISLES=[1070,1206];
function workingPortAt(p){
 if(inDockYard(p.x,p.z))return HARBOR.yard;
 return inFreightPort(p.x,p.z)?FREIGHT:null;
}
function freightPatrolSpot(origin,min,max){
 const area=workingPortAt(origin)||FREIGHT,gates=area.streets||area.gates.map(g=>g.x),aisles=area.cross||FREIGHT_AISLES;
 for(let i=0;i<48;i++){
  const across=i%2===0,dir=Math.random()<.5?-1:1;
  const x=across?clamp(origin.x+rnd(-max,max),area===FREIGHT?179:area.x0+5,area.x1-12):pick(gates)-dir*3;
  const z=across?pick(aisles)+dir*3:clamp(origin.z+rnd(-max,max),area.z0+19,area.z1-(area===FREIGHT?39:10));
  const range=Math.hypot(origin.x-x,origin.z-z);
  if(range<min||range>max||cars.some(c=>Math.hypot(c.pos.x-x,c.pos.z-z)<10))continue;
  if(rayWorld(x-1,z-2.6,x+1,z+2.6,1,1,.3)<1)continue;
  return {x,z,h:across?dir*Math.PI/2:dir>0?0:Math.PI};
 }
 return null;
}

function freightGateNode(x,area=FREIGHT){
 const gates=area.streets||area.gates.map(g=>g.x);
 return {x:gates.reduce((a,b)=>Math.abs(a-x)<=Math.abs(b-x)?a:b),z:W};
}
function freightWaypoint(from,to){
 const area=workingPortAt(from)||workingPortAt(to)||FREIGHT,entering=workingPortAt(to)===area;
 const gate=freightGateNode(entering?to.x:from.x,area);
 if(entering&&from.z<area.z0+17){
  if(from.z<W-6||Math.abs(from.x-gate.x)>5)return gate;
  return {x:gate.x,z:area.z0+21};
 }
 if(!entering)to=gate;
 const clear=(a,b)=>rayWorld(a.x,a.z,b.x,b.z,1.15,1.15,.8)>=1;
 if(clear(from,to))return to;
 let best=null,cost=Infinity;
 const gates=area.streets||area.gates.map(g=>g.x),aisles=area.cross||FREIGHT_AISLES;
 const corners=gates.flatMap(x=>aisles.map(z=>({x,z})));
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
 const next=patrolWaypoint(c,freightGateNode(c.pos.x,workingPortAt(c.pos)||FREIGHT));
 const diff=wrapA(Math.atan2(next.x-c.pos.x,next.z-c.pos.z)-c.h);
 const target=blockedAhead(c)?0:(Math.abs(diff)>.65?5:10)*weather.trafficPace;
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

function freightDecksAt(x,z){return FREIGHT.cargoDecks.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[];}
function registerFreightDeck(r){
 for(let i=Math.floor(r.x0/CELL);i<=Math.floor(r.x1/CELL);i++)for(let j=Math.floor(r.z0/CELL);j<=Math.floor(r.z1/CELL);j++){
  const key=i+','+j;
  if(!FREIGHT.cargoDecks.has(key))FREIGHT.cargoDecks.set(key,[]);
  FREIGHT.cargoDecks.get(key).push(r);
 }
}
function freightEnamel(color){
 let paint=FREIGHT.containerPaint.get(color);
 if(!paint){paint=new THREE.MeshStandardMaterial({color:lin(color),vertexColors:true,roughness:.72,metalness:.26});FREIGHT.containerPaint.set(color,paint);}
 return paint;
}
function freightContainer(x,z,y,length,color,collision=false){
 const dims=[length,2.60,2.44],cx=x+length/2,cz=z+1.22,id='intermodal-container';
 freightMarkings(x,z,y,length,color);
 const display=detailFallback(id,cx,y,cz,dims,0,freightEnamel(color));
 registerStreetFitting(id,cx,y,cz,dims,0,{reach:55,tint:color,tintMaterial:'Container enamel',farModel:{set visible(shown){display(shown);}}});
 if(!collision)return;
 const end=x+length,back=z+2.44,top=y+2.60;
 freightSolid(x,end,z,back,y+.134,y+.035);
 freightSolid(x,end,z,back,top,top-.075);
 for(const xx of [x,end-.075])freightSolid(xx,xx+.075,z,back,top-.075,y+.134);
 for(const zz of [z,back-.07])freightSolid(x+.075,end-.075,zz,zz+.07,top-.075,y+.134);
 for(const h of [y+.134,top])registerFreightDeck({x0:x,x1:end,z0:z,z1:back,y:h});
}

function buildFreightTerminal(){
 const p=FREIGHT,{x0,x1,z0,z1,y}=p;
 const seaWidth=2500+HARBOR.basin.x0,seaDepth=1750;
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(seaWidth,seaDepth,108,59),MAT.water);
 sea.rotation.x=-Math.PI/2;
 sea.position.set(HARBOR.basin.x0-seaWidth/2,-.35,z0+seaDepth/2);
 scene.add(sea);
 REFL.hide.push(sea);
 REFL.waterBounds.push(new THREE.Box3().setFromObject(sea).expandByScalar(2));

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
    const shell={bld:[],cargoDecks:[]};
    buildCargoContainer(shell,x,z,y,FREIGHT_PALETTE[seed%FREIGHT_PALETTE.length],'E',true,12.16);
    STATIC.push(...shell.bld);
    for(const floor of shell.cargoDecks)registerFreightDeck(floor);
    for(let level=1;level<levels;level++)
     freightContainer(x,z,y+2.6*level,12.16,FREIGHT_PALETTE[(seed+level*2)%FREIGHT_PALETTE.length],true);
   }
  }
 }
 buildFreightYardGantry(252,1128,yellow);
 buildFreightYardGantry(501,1155,yellow);
 buildFreightShed(yellow);
 buildFreightRail(navy);
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

function dockCarton(x,y,z,dims,yaw,mass){
 const id='receiving-carton',node=new THREE.Group();
 FREIGHT.kraft??=new THREE.MeshStandardMaterial({color:lin(0xb68c5c),roughness:.94});
 const fallback=new THREE.Mesh(new THREE.BoxGeometry(...dims),FREIGHT.kraft);
 fallback.geometry.translate(0,dims[1]/2,0);fallback.castShadow=true;fallback.receiveShadow=true;
 node.position.set(x,y,z);node.rotation.y=yaw;node.add(fallback);scene.add(node);
 INTERIORS.fixtures.push({id,node,fallback,dims,x,z});
 registerLooseFixture(node,id,x,y,z,yaw,dims,mass);
}
function dockPalletLoad(x,base,z,layers,variant){
 worksModel('cargo-pallet',x,base,z,[1.2,.146,.80],0,true);
 const height=.288+.024*(variant%4),dims=[.466,height,.337];
 for(let level=0;level<layers;level++)for(let i=0;i<4;i++){
  if(level&&i===variant%4)continue;
  const u=x+((i%2)-.5)*.508,v=z+(Math.floor(i/2)-.5)*.365;
  const y=base+.146+level*height,yaw=(i+variant)%3===0?Math.PI:0;
  dockCarton(u,y,v,dims,yaw,3.2+(i+variant)%6);
 }
}

function buildFreightShed(yellow){
 const r={x0:129,x1:177,z0:1063,z1:1125},floor=.17,roof=8.50,shell={bld:[]};
 const site={roof,cladding:pbr('corrugated',1.45,{rough:.83,metal:.27,ns:.58,color:0xbabeb5})};
 const bayCenters=[-24,-12,0,12,24];
 for(const side of ['N','S','W','E']){
  const {width}=lotFace(r,side);
  const open=(left,right,base,top,kind='window')=>({left,right,base,top,kind});
  const openings=side==='E'?bayCenters.map(u=>open(u-3.38,u+3.38,floor,4.68,'shutter')):[];
  if(side==='N'||side==='S')openings.push(open(-width/2+3.68,-width/2+4.92,floor,2.30,'egress'));
  for(let u=-width/2+5.8;u<width/2-2;u+=10.5)openings.push(open(u-1.92,u+1.92,5.65,7.18));
  supplyWall(shell,side,r,openings,site);
 }
 // Fork trucks can reach each receiving aisle at grade. Keep the tracks and bollards outside the clear opening.
 plainBox(STREET.materials.wornSlab,r.x0,r.x1,FREIGHT.y-.03,floor,r.z0,r.z1,{uvm:2.84});
 freightSolid(r.x0,r.x1,r.z0,r.z1,floor,FREIGHT.y-.03).walkIgnore=true;
 STREET.steps.push({...r,y:floor,soffit:FREIGHT.y-.03});
 for(const offset of bayCenters){
  const z=(r.z0+r.z1)/2+offset;
  for(const dz of [-3.75,3.75]){
   cyl(MAT.darkMetal,r.x1+.52,FREIGHT.y,z+dz,.093,.112,1.14,10);
   cyl(yellow,r.x1+.52,.85,z+dz,.096,.097,.22,10);
   freightSolid(r.x1+.41,r.x1+.63,z+dz-.11,z+dz+.11,1.25,FREIGHT.y).radius=.11;
  }
  const lintel=freightSolid(r.x1-.04,r.x1+1.39,z-3.81,z+3.81,5.01,4.79);
  plainBox(MAT.trim,lintel.x0,lintel.x1,lintel.y0,lintel.h,lintel.z0,lintel.z1,{uvm:1.52});
 }
 plainBox(MAT.roof,r.x0-.32,r.x1+.32,roof,roof+.16,r.z0-.36,r.z1+.36,{uvm:3.22});
 const cap=freightSolid(r.x0-.32,r.x1+.32,r.z0-.36,r.z1+.36,roof+.16,roof);
 cap.walkIgnore=true;registerFreightDeck({...cap,y:cap.h});
 for(let z=r.z0+.43;z<r.z1;z+=6){
  for(const x of [r.x0+.34,r.x1-.34]){
   if(x>r.x1-1&&bayCenters.some(u=>Math.abs(z-(r.z0+r.z1)/2-u)<3.62))continue;
   plainBox(MAT.darkMetal,x-.085,x+.085,floor,roof,z-.105,z+.105);
   freightSolid(x-.085,x+.085,z-.105,z+.105,roof,floor);
  }
  for(const y of [roof-.73,roof-.10])freightBeam(MAT.darkMetal,[r.x0+.27,y,z],[r.x1-.27,y,z],.083,.142);
  for(let x=r.x0+.34,k=0;x<r.x1-.4;x+=3.42,k++){
   const a=k%2?roof-.73:roof-.10,b=k%2?roof-.10:roof-.73;
   freightBeam(MAT.metal,[x,a,z],[Math.min(x+3.42,r.x1-.34),b,z],.042,.068);
  }
 }
 for(const x of [137.2,146.4,155.6])for(const offset of [-18,-6,6,18]){
  const z=(r.z0+r.z1)/2+offset;
  worksModel('hardware-stock-rack',x,floor,z,[4.56,3.13,1.18]);
  if(offset===-18||offset===6)dockPalletLoad(x+2.87,floor,z,2,Math.round(x+offset)%7);
  else worksModel('cargo-pallet',x+2.87,floor,z,[1.2,.146,.80]);
 }
 for(const x of [139.8,153.6,167.4])for(const z of [1074,1094,1114]){
  worksBeam(MAT.metal,[x,roof-.14,z],[x,5.28,z],.014);
  plainBox(MAT.darkMetal,x-.86,x+.86,5.18,5.30,z-.109,z+.109);
  plainBox(INTERIORS.materials.neutral,x-.79,x+.79,5.15,5.18,z-.090,z+.090);
  INTERIORS.emitters.push({x,y:5.13,z,floorY:floor,cool:true,reach:11,intensity:2.1});
 }
 for(const [x,z,layers] of [[165.2,1075.6,2],[166.6,1075.6,2],[166,1076.65,1],[165.4,1100.1,2]])
  dockPalletLoad(x,floor,z,layers,Math.round(x+z)%7);
 dockCarton(168.9,floor,1099.4,[.463,.34,.353],.31,4.2);
 dockCarton(170.3,floor,1099.6,[.487,.31,.361],-.14,5.4);
 STATIC.push(...shell.bld);
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
  plainBox(navy,x,x+22,y+.68,y+1.04,z-1.48,z+1.48,{uvm:2.2});
  freightSolid(x,x+22,z-1.48,z+1.48,y+1.04,y+.68);
  registerFreightDeck({x0:x,x1:x+22,z0:z-1.48,z1:z+1.48,y:y+1.04});
  for(const e of [1.68,19.8]){
   plainBox(MAT.darkMetal,x+e-.87,x+e+.87,y+.40,y+.71,z-.59,z+.59);
   freightSolid(x+e-.87,x+e+.87,z-.59,z+.59,y+.71,y+.40);
   for(const axle of [-.53,.53])for(const rail of [-.72,.72]){
    const wheel=new THREE.CylinderGeometry(.29,.29,.13,16);
    wheel.rotateX(Math.PI/2);wheel.translate(x+e+axle,y+.363,z+rail);addGeo(MAT.darkMetal,wheel,true);
    freightSolid(x+e+axle-.265,x+e+axle+.265,z+rail-.065,z+rail+.065,y+.65,y+.073);
   }
  }
  freightContainer(x+3,z-1.21,y+1.04,12.2,FREIGHT_PALETTE[i],true);
 }
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
 const color=FREIGHT_PALETTE[(index+1)%FREIGHT_PALETTE.length],dims=new V3(12.15,2.57,2.44);
 const cargo=new THREE.Mesh(detailPrototype('intermodal-container'),freightEnamel(color));
 cargo.scale.copy(dims);
 cargo.castShadow=true;cargo.receiveShadow=true;
 requestScenery('intermodal-container')?.then(template=>{
  if(!template)return;
  const box=template.clone(true);box.scale.copy(dims).divide(new V3(...template.userData.dimensions));
  box.traverse(p=>{
   if(!p.isMesh)return;
   p.castShadow=true;
   if(p.material.name==='Container enamel'){p.material=p.material.clone();p.material.color.copy(lin(color));}
  });
  load.remove(cargo);load.add(box);
 });
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
