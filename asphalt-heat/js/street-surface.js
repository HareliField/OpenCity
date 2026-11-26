// Top faces are shared by the rendering and streamed Cannon collision bodies.
const STREET_TERRAIN=new Map();
const PAVING={};
const DRIVEWAYS=new Map();
const drivewayKey=(axis,line,block)=>axis+line+','+block;
function surveyDriveways(){
 for(const door of ACCESS.doors){
  if(door.kind!=='shutter' || door.base>.22)continue;
  const B=blockOf(door.ox,door.oz);if(!B)continue;
  const nx=Math.round(Math.sin(door.yaw)),nz=Math.round(Math.cos(door.yaw));
  const axis=nx?'ns':'ew',line=nx?B.i+Number(nx>0):B.j+Number(nz>0),block=nx?B.j:B.i;
  const center=(nx?door.oz:door.ox)-block*CELL,side=-(nx||nz);
  const setback=Math.abs((nx?door.ox:door.oz)-line*CELL)-HALF;
  if(setback>10 || center<19 || center>CELL-19)continue;
  const key=drivewayKey(axis,line,block);
  if(!DRIVEWAYS.has(key))DRIVEWAYS.set(key,[]);
  DRIVEWAYS.get(key).push({center,half:door.w/2+.45,side});
 }
}
function drivewayAt(axis,line,block,side,along,margin=0){
 return DRIVEWAYS.get(drivewayKey(axis,line,block))?.some(d=>d.side===side && Math.abs(d.center-along)<d.half+margin);
}
function nearDriveway(x,z,margin=0){
 const i=Math.round(x/CELL),j=Math.round(z/CELL),u=x-i*CELL,v=z-j*CELL;
 if(Math.abs(u)<HALF+3.6 && Math.abs(v)>HALF){const b=Math.floor(z/CELL);return drivewayAt('ns',i,b,Math.sign(u),z-b*CELL,margin);}
 if(Math.abs(v)<HALF+3.6 && Math.abs(u)>HALF){const b=Math.floor(x/CELL);return drivewayAt('ew',j,b,Math.sign(v),x-b*CELL,margin);}
 return false;
}
const GROUND_FACES=new Map();
let cityTerrainReady=false;
// Eight-metre bins keep walking and distant tyres on the very same planes as the close-up collision model.
function groundBin(x,z){return (Math.floor(x/8)+2)*160+Math.floor(z/8)+2;}
function indexGroundFace(points){
 const [a,b,c]=points,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
 const ny=uz*vx-ux*vz;if(Math.abs(ny)<1e-9)return;
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
 const face={points,gx:(uz*vy-uy*vz)/ny,gz:(uy*vx-ux*vy)/ny,
  l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...zs),b:Math.max(...zs)};
 for(let i=Math.floor(face.l/8);i<=Math.floor(face.r/8);i++)for(let j=Math.floor(face.t/8);j<=Math.floor(face.b/8);j++){
  const key=groundBin(i*8,j*8);
  if(!GROUND_FACES.has(key))GROUND_FACES.set(key,[]);GROUND_FACES.get(key).push(face);
 }
}
function builtStreetHeight(x,z){
 let height=0;
 for(const f of GROUND_FACES.get(groundBin(x,z))||[]){
  if(x<f.l || x>f.r || z<f.t || z>f.b)continue;
  let inside=true;
  for(let n=0;n<f.points.length;n++){
   const a=f.points[n],b=f.points[(n+1)%f.points.length];
   if((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0])>.00001){inside=false;break;}
  }
  if(inside){const a=f.points[0];height=Math.max(height,a[1]+(x-a[0])*f.gx+(z-a[2])*f.gz);}
 }
 return height;
}
function initPaving(){
 PAVING.gutter=makeWet(pbr('concrete',1,{rough:.9,color:0x938c80,ns:.48}),{wet:1});
 PAVING.repair=makeWet(pbr('asphalt',1,{rough:.86,color:0x747678,ns:.67}),{road:true,wet:.87});
 const [pad,g]=cvs(128,128);
 g.fillStyle='#ac7737';g.fillRect(0,0,128,128);
 for(let y=8;y<128;y+=16)for(let x=8;x<128;x+=16){
  g.fillStyle='#745434';g.beginPath();g.arc(x+.7,y+1,4.5,0,Math.PI*2);g.fill();
  g.fillStyle='#d09b50';g.beginPath();g.arc(x,y,3.7,0,Math.PI*2);g.fill();
  g.fillStyle='#e0ae65';g.fillRect(x-2.2,y-2.5,2.6,1.2);
 }
 PAVING.warning=new THREE.MeshStandardMaterial({map:ctex(pad,1),roughness:.81});
 PAVING.cover=utilityCoverMaterial();
 PAVING.paint=makeWet(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),{paint:true,road:true,wet:.8});
}
function utilityCoverMaterial(){
 const [canvas,g]=cvs(256,256);
 function disc(radius,fill){g.beginPath();g.arc(128,128,radius,0,Math.PI*2);g.fillStyle=fill;g.fill();}
 disc(128,'#77716a');disc(122,'#383a38');disc(114,'#797972');
 g.save();g.beginPath();g.arc(128,128,108,0,Math.PI*2);g.clip();
 for(let y=6;y<250;y+=12)for(let x=6;x<250;x+=18){
  const px=x+(y%24===6?0:9);
  g.strokeStyle='#53554e';g.lineWidth=3;g.beginPath();g.moveTo(px-5,y+2);g.lineTo(px,y-2);g.lineTo(px+5,y+2);g.stroke();
  g.strokeStyle='#98998c';g.lineWidth=1.2;g.stroke();
 }
 g.restore();g.fillStyle='#72726a';g.fillRect(72,113,112,29);
 g.fillStyle='#383b37';g.font='bold 17px Arial';g.textAlign='center';g.fillText('CITY SEWER',128,133);
 for(const x of [44,212]){g.fillStyle='#343733';g.fillRect(x-4,119,8,18);}
 return new THREE.MeshStandardMaterial({map:ctex(canvas),roughness:.76,metalness:.38});
}
function newTerrain(concrete){
 return {concrete,faces:[],byMaterial:new Map(),x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};
}
function terrainFace(tile,material,points,solid=true){
 const [a,b,c]=points;
 if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)points.reverse();
 if(!tile.byMaterial.has(material))tile.byMaterial.set(material,[]);
 tile.byMaterial.get(material).push(points);
 if(!solid || !points.some(p=>p[1]>.0001))return;
 tile.faces.push(points);indexGroundFace(points);
 for(const [x,,z] of points){
  tile.x0=Math.min(tile.x0,x);tile.x1=Math.max(tile.x1,x);
  tile.z0=Math.min(tile.z0,z);tile.z1=Math.max(tile.z1,z);
 }
}
function finishTerrain(tile){
 for(const [material,faces] of tile.byMaterial){
  const pos=[],uv=[],idx=[],scale=material===MAT.asphalt||material===PAVING.repair?7:
   material===PAVING.warning?.42:material===PAVING.gutter?2.7:3.2;
  for(const face of faces){
   const start=pos.length/3;
   for(const p of face){pos.push(...p);uv.push(p[0]/scale,-p[2]/scale);}
   for(let k=1;k<face.length-1;k++)idx.push(start,start+k,start+k+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);geo.computeVertexNormals();addGeo(material,geo,false);
 }
 tile.byMaterial.clear();
 if(!tile.faces.length)return;
 const first=cellKey(tile.x0,tile.z0),last=cellKey(tile.x1,tile.z1);
 for(let i=Math.floor(first/N);i<=Math.floor(last/N);i++)for(let j=first%N;j<=last%N;j++){
  const key=i*N+j;
  if(!STREET_TERRAIN.has(key))STREET_TERRAIN.set(key,[]);
  STREET_TERRAIN.get(key).push(tile);
 }
}
function terrainBody(tile){
 const body=new CANNON.Body({mass:0,material:tile.concrete?PH.mat.concrete:PH.mat.ground,
  collisionFilterGroup:PHYS_GROUP.world});
 body.position.set((tile.x0+tile.x1)/2,0,(tile.z0+tile.z1)/2);
 for(const face of tile.faces){
  const n=face.length,x=face.reduce((sum,p)=>sum+p[0],0)/n,z=face.reduce((sum,p)=>sum+p[2],0)/n;
  const bottom=-.10,top=Math.max(...face.map(p=>p[1])),y=(bottom+top)/2;
  const offset=new CV(x-body.position.x,y,z-body.position.z);
  if(n===4 && face.every(p=>p[1]===top) && face.every((p,k)=>p[0]===face[(k+1)%4][0] || p[2]===face[(k+1)%4][2])){
   const w=Math.max(...face.map(p=>Math.abs(p[0]-x))),d=Math.max(...face.map(p=>Math.abs(p[2]-z)));
   body.addShape(new CANNON.Box(new CV(w,(top-bottom)/2,d)),offset);continue;
  }
  const vertices=face.map(p=>new CV(p[0]-x,p[1]-y,p[2]-z));
  for(const p of face)vertices.push(new CV(p[0]-x,bottom-y,p[2]-z));
  const topFace=face.map((_,i)=>i),sides=[topFace,topFace.map(i=>i+n).reverse()];
  for(let i=0;i<n;i++){const j=(i+1)%n;sides.push([j,i,i+n,j+n]);}
  body.addShape(new CANNON.ConvexPolyhedron({vertices,faces:sides}),offset);
 }
 PH.w.addBody(body);
 return body;
}
function buildSidewalk(B){
 const tile=newTerrain(true),height=STREET_DESIGN.curb,r=STREET_DESIGN.radius,end=7;
 // In the two municipal lots, the stairs and lift extend below street level.
 // Cut the same flat sidewalk faces used for rendering, foot height and wheel collision.
 const holes=STREET_OPENINGS.filter(r=>r.x0<B.x1&&r.x1>B.x0&&r.z0<B.z1&&r.z1>B.z0);
 function pave(material,points,solid=true){
  if(holes.length&&material===MAT.sidewalk&&points.length===4&&points.every(p=>p[1]===height)){
   const xs=new Set(points.map(p=>p[0])),zs=new Set(points.map(p=>p[2]));
   if(xs.size===2&&zs.size===2){
    const r=worksRect(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs));
    for(const p of subtractCityOpenings(r,holes)){
     terrainFace(tile,material,[[p.x0,height,p.z0],[p.x0,height,p.z1],[p.x1,height,p.z1],[p.x1,height,p.z0]],solid);
    }
    return;
   }
  }
  terrainFace(tile,material,points,solid);
 }
 const rect=(x0,x1,z0,z1)=>pave(MAT.sidewalk,[[x0,height,z0],[x0,height,z1],[x1,height,z1],[x1,height,z0]]);
 rect(B.x0+end,B.x1-end,B.z0+end,B.z1-end);
 const wall=(a,b)=>{
  if(a[1]<.0001 && b[1]<.0001)return;
  const g=new THREE.BufferGeometry(),pos=[...a,...b,b[0],0,b[2],a[0],0,a[2]];
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,.15,Math.hypot(b[0]-a[0],b[2]-a[2]),.15,Math.hypot(b[0]-a[0],b[2]-a[2]),0,0,0],2));
  const inward=(b[2]-a[2])*((B.x0+B.x1)/2-a[0])-(b[0]-a[0])*((B.z0+B.z1)/2-a[2]);
  g.setIndex(inward>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);g.computeVertexNormals();addGeo(MAT.curb,g,false);
 };
 for(const [sx,sz] of [[1,1],[-1,1],[-1,-1],[1,-1]]){
  const x=sx>0?B.x0:B.x1,z=sz>0?B.z0:B.z1;
  const point=(u,v,h=height)=>[x+sx*u,h,z+sz*v];
  const nodeI=B.i+(sx<0?1:0),nodeJ=B.j+(sz<0?1:0);
  const flat=(u0,u1,v0,v1)=>pave(MAT.sidewalk,[point(u0,v0),point(u0,v1),point(u1,v1),point(u1,v0)]);
  flat(r,end,r,end);
  const arc=[];
  for(let k=0;k<=6;k++){
   const a=Math.PI+k*Math.PI/12;arc.push(point(r+r*Math.cos(a),r+r*Math.sin(a)));
   if(k)wall(arc[k-1],arc[k]);
  }
  pave(MAT.sidewalk,[point(r,r),...arc]);
  for(const acrossX of [true,false]){
   const P=acrossX?(u,v,h)=>point(v,u,h):point;
   const face=(vertices,mat=MAT.sidewalk,solid=true)=>pave(mat,vertices.map(v=>P(...v)),solid);
   const dx=acrossX?0:-sx,dz=acrossX?-sz:0;
   if(!hasCrossing(nodeI,nodeJ,dx,dz) || hasCurbExtension(nodeI,nodeJ,dx,dz)){
    face([[r,0],[end,0],[end,r],[r,r]]);wall(P(r,0),P(end,0));continue;
   }
   const middle=STREET_DESIGN.crossing-HALF,lo=middle-1,hi=middle+1,depth=STREET_DESIGN.rampDepth;
   const right=hi+STREET_DESIGN.flare;
   face([[r,depth],[end,depth],[end,r],[r,r]]);
   face([[r,0],[lo,0,0],[lo,depth]]);face([[r,0],[lo,depth],[r,depth]]);
   face([[lo,0,0],[hi,0,0],[hi,depth],[lo,depth]]);
   face([[hi,0,0],[right,0],[hi,depth]]);face([[right,0],[right,depth],[hi,depth]]);
   face([[right,0],[end,0],[end,depth],[right,depth]]);
   wall(P(r,0),P(lo,0,0));wall(P(hi,0,0),P(right,0));wall(P(right,0),P(end,0));
   const padY=v=>height*v/depth+.004;
   face([[lo+.03,.04,padY(.04)],[hi-.03,.04,padY(.04)],[hi-.03,.64,padY(.64)],[lo+.03,.64,padY(.64)]],PAVING.warning,false);
  }
 }
 for(const [axis,line,block,side] of [['ns',B.i,B.j,1],['ns',B.i+1,B.j,-1],
   ['ew',B.j,B.i,1],['ew',B.j+1,B.i,-1]]){
  const point=(t,v,h=height)=>axis==='ns'?[line*CELL+side*(HALF+v),h,block*CELL+t]:
   [block*CELL+t,h,line*CELL+side*(HALF+v)];
  const face=(coords,mat=MAT.sidewalk)=>pave(mat,coords.map(p=>point(...p)));
  const start=HALF+end,finish=CELL-start,depth=2.35,flare=.85;
  const spans=[];
  for(const driveway of (DRIVEWAYS.get(drivewayKey(axis,line,block))||[]).filter(d=>d.side===side).sort((a,b)=>a.center-b.center)){
   const a=Math.max(start+flare,driveway.center-driveway.half),b=Math.min(finish-flare,driveway.center+driveway.half);
   if(a>=b)continue;
   if(spans.length && spans[spans.length-1][1]+2*flare>=a)spans[spans.length-1][1]=Math.max(b,spans[spans.length-1][1]);
   else spans.push([a,b]);
  }
  function level(a,b,inner,outer){
   if(b>a)face([[a,inner],[b,inner],[b,outer],[a,outer]]);
  }
  if(!spans.length){
   level(start,finish,0,end);wall(point(start,0),point(finish,0));continue;
  }
  level(start,finish,depth,end);
  let cursor=start;
  for(const [a,b] of spans){
   level(cursor,a-flare,0,depth);wall(point(cursor,0),point(a-flare,0));
   face([[a-flare,0],[a,0,.014],[a,depth]],PAVING.gutter);
   face([[a-flare,0],[a,depth],[a-flare,depth]],PAVING.gutter);
   face([[a,0,.014],[b,0,.014],[b,depth],[a,depth]],PAVING.gutter);
   face([[b,0,.014],[b+flare,0],[b,depth]],PAVING.gutter);
   face([[b+flare,0],[b+flare,depth],[b,depth]],PAVING.gutter);
   wall(point(a-flare,0),point(a,0,.014));wall(point(a,0,.014),point(b,0,.014));wall(point(b,0,.014),point(b+flare,0));
   cursor=b+flare;
  }
  level(cursor,finish,0,depth);wall(point(cursor,0),point(finish,0));
 }
 finishTerrain(tile);
}
function surfacePoint(axis,line,block,t,u,lift=0){
 const y=segmentHeight(axis,line,block,t,u)+lift;
 return axis==='ew'?[block*CELL+t,y,line*CELL+u]:[line*CELL+u,y,block*CELL+t];
}
function buildCarriageway(axis,line,block){
 const tile=newTerrain(false),half=STREET_DESIGN.humpLength/2;
 const times=[HALF,16,22,CELL-22,CELL-16,CELL-HALF];
 const cut=utilityCut(line,block);
 if(cut)times.push(cut-.65,cut-.47,cut+.47,cut+.65);
 if(hasSpeedHump(axis,line,block))for(let k=-4;k<=4;k++)times.push(CELL/2+k*half/4);
 const stations=[...new Set(times)].sort((a,b)=>a-b);
 const widths=[-HALF,-7.55,-7.5,-6.85,0,6.85,7.5,7.55,HALF];
 for(let t=1;t<stations.length;t++)for(let u=1;u<widths.length;u++){
  const a=stations[t-1],b=stations[t],l=widths[u-1],r=widths[u];
  const corners=[[a,l],[a,r],[b,r],[b,l]].map(([t,u])=>surfacePoint(axis,line,block,t,u));
  const gutter=Math.min(Math.abs(l),Math.abs(r))>=HALF-STREET_DESIGN.gutter;
  const mat=gutter?PAVING.gutter:cut && Math.abs((a+b)/2-cut)<.65?PAVING.repair:MAT.asphalt;
  // In transitions both the lateral and longitudinal grades change. Match the two planes at the diagonal.
  if(Math.abs(corners[0][1]+corners[2][1]-corners[1][1]-corners[3][1])>.000001){
   terrainFace(tile,mat,[corners[0],corners[1],corners[2]]);
   terrainFace(tile,mat,[corners[0],corners[2],corners[3]]);
  }else terrainFace(tile,mat,corners);
 }
 finishTerrain(tile);
}
function paintSheet(){
 const pos=[],colors=[],index=[];
 return {
  face(points,color){
   const [a,b,c]=points;
   if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)points.reverse();
   const k=pos.length/3;
   for(const p of points){pos.push(...p);colors.push(...color);}
   for(let j=1;j<points.length-1;j++)index.push(k,k+j,k+j+1);
  },
  finish(){
   if(!pos.length)return;
   const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   g.setIndex(index);g.computeVertexNormals();addGeo(PAVING.paint,g,false);
  }
 };
}
const LINE_WHITE=[.72,.71,.64],LINE_YELLOW=[.84,.51,.055],BIKE_GREEN=[.055,.29,.18];
function stripeSegment(axis,line,block){
 const section=streetSection(axis,line,block),sheet=paintSheet(),cut=utilityCut(line,block);
 const hump=hasSpeedHump(axis,line,block),half=STREET_DESIGN.humpLength/2;
 const breaks=[16,22,CELL-22,CELL-16];
 if(cut)breaks.push(cut-.65,cut-.47,cut+.47,cut+.65);
 if(hump)for(let k=-4;k<=4;k++)breaks.push(CELL/2+k*half/4);
 breaks.sort((a,b)=>a-b);
 const pt=(t,u,lift=.008)=>surfacePoint(axis,line,block,t,u,lift);
 function strip(a,b,l,r,color=LINE_WHITE){
  const stops=[a,...breaks.filter(t=>t>a && t<b),b];
  for(let n=1;n<stops.length;n++)sheet.face([pt(stops[n-1],l),pt(stops[n],l),pt(stops[n],r),pt(stops[n-1],r)],color);
 }
 const start=STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+.08,end=CELL-start;
 const median=section.median||0;
 if(section!==ROAD_SECTIONS.local && section!==ROAD_SECTIONS.viaduct){
  strip(start,end,median-.18,median-.075,LINE_YELLOW);strip(start,end,median+.075,median+.18,LINE_YELLOW);
 }
 if(section.outer){
  for(const sign of [-1,1]){
   for(let t=start+2;t+3<=end;t+=9)strip(t,t+3,3.57*sign-.055,3.57*sign+.055);
   strip(start,end,7.25*sign-.055,7.25*sign+.055);
  }
 }
 if(section.parking || section===ROAD_SECTIONS.waterfront){
  for(const sign of [-1,1]){
   const center=section===ROAD_SECTIONS.waterfront?(sign<0?-6.65:2.65):sign*section.parking;
   const edge=center-sign*1.12;
   for(const t of [21.5,28.5,35.5,42.5]){
    if(drivewayAt(axis,line,block,sign,t,1.1))continue;
    strip(t-.06,t+.06,Math.min(edge,edge+sign*.78),Math.max(edge,edge+sign*.78));
    strip(t-.46,t+.46,edge-.055,edge+.055);
   }
  }
 }
 if(section===ROAD_SECTIONS.waterfront){
  // Breakwater Way follows the waterfront plan: a two-way cycle track behind a parking buffer.
  strip(start,end,4.8,4.91);strip(start,end,3.83,3.94);
  for(let t=start;t<end-1;t+=4)strip(t,t+1.25,6.23,6.31,LINE_YELLOW);
  const divider=newTerrain(true);
  for(const t of [24,32,40]){
   if(drivewayAt(axis,line,block,1,t,3))continue;
   const y=pavementHeight(line*CELL+4.39,block*CELL+t);
   const pts=[[t-2.5,4.14],[t-2.24,4.04],[t+2.24,4.04],[t+2.5,4.14],
    [t+2.5,4.6],[t+2.24,4.72],[t-2.24,4.72],[t-2.5,4.6]]
    .map(([a,u])=>[line*CELL+u,y+.11,block*CELL+a]);
   terrainFace(divider,PAVING.gutter,pts);
   for(let n=0;n<pts.length;n++){
    const a=pts[n],b=pts[(n+1)%pts.length],v=new THREE.BufferGeometry();
    v.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,b[0],y-.005,b[2],a[0],y-.005,a[2]],3));
    v.setIndex([0,2,1,0,3,2]);v.computeVertexNormals();addGeo(PAVING.gutter,v,false);
   }
  }
  finishTerrain(divider);
  for(const [t,u,d] of [[26,5.58,-1],[38,6.99,1]]){
   strip(t-.52,t+.52,u-.065,u+.065);
   sheet.face([pt(t+d*.94,u),pt(t+d*.29,u-.29),pt(t+d*.29,u+.29)],LINE_WHITE);
  }
 }
 if(hump){
  for(const points of humpChevrons(axis,section.inner))sheet.face(points.map(([t,u])=>pt(t,u,.005)),LINE_WHITE);
 }
 if((line+3*block)%4===1 && !hump){
  // Tar-sealed working crack. It meanders across one wheel track, clear of the gutter.
  const at=38+(block%3),dir=(block+line)%2?1:-1;
  const path=[[at,1.3],[at+.24,1.7],[at-.08,2.06],[at+.33,2.58],[at+.21,3.03],[at+.58,3.46]];
  for(let k=1;k<path.length;k++){
   const [a,l]=path[k-1],[b,r]=path[k];
   sheet.face([pt(a-.025,l*dir),pt(b-.025,r*dir),pt(b+.025,r*dir),pt(a+.025,l*dir)],[.064,.061,.058]);
  }
 }
 sheet.finish();
}
function humpChevrons(axis,lane){
 const polygons=[];
 for(const side of [-1,1]){
  const direction=axis==='ns'?-side:side;
  for(const arm of [-1,1]){
   // Split at the same longitudinal stations as the road. The paint follows the convex crest.
   const along=(distance)=>CELL/2-direction*distance;
   const edge=(distance,inner)=>side*lane+arm*Math.max(0,.72*distance/1.25-(inner?.19:0));
   const offsets=[1.25,STREET_DESIGN.humpLength/4,STREET_DESIGN.humpLength/8,.33,0];
   for(let n=1;n<offsets.length;n++){
    const a=offsets[n-1],b=offsets[n];
    const strip=[[along(a),edge(a,false)],[along(b),edge(b,false)]];
    if(b>0)strip.push([along(b),edge(b,true)]);
    strip.push([along(a),edge(a,true)]);polygons.push(strip);
   }
  }
 }
 return polygons;
}
function intersectionMarkings(i,j){
 const sheet=paintSheet(),control=junctionControl(i,j),cross=STREET_DESIGN.crossing,hw=STREET_DESIGN.crossWidth/2;
 const X=i*CELL,Z=j*CELL;
 for(const [dx,dz] of CARDINAL){
  if(!hasApproach(i,j,dx,dz))continue;
  const point=(d,u)=>{
   const x=X-dx*d-dz*u,z=Z-dz*d+dx*u,deck=sampleGrade(x,z,0);
   return [x,deck?deck.height+.034:.011,z];
  };
  const rect=(a,b,l,r,col=LINE_WHITE)=>sheet.face([point(a,l),point(b,l),point(b,r),point(a,r)],col);
  const axis=dx?'ew':'ns',section=segmentSection([i-dx,j-dz],[i,j]);
  if(hasCrossing(i,j,dx,dz)){
   const extended=hasCurbExtension(i,j,dx,dz),edge=HALF-(extended?EXTENSION_WIDTH:0);
   if(extended)buildCurbExtension(i,j,dx,dz);
   if(control==='signal' || section.rank){
    for(let k=-5;k<=5;k++){const u=k*1.524;if(Math.abs(u)+.25<edge)rect(cross-hw,cross+hw,u-.25,u+.25);}
   }else{
    rect(cross-hw,cross-hw+.14,-edge,edge);rect(cross+hw-.14,cross+hw,-edge,edge);
   }
  }
  if(control==='signal' || mustStop(control,axis)){
   const bar=stopLine(control);
   const [l,r]=section===ROAD_SECTIONS.viaduct && (i===6 || i===14)?[0,section.motorEdge]:approachWidth(section,dz);
   for(let u=l+.06;u<r-.07;u+=.8)rect(bar.inner,bar.outer,u,Math.min(u+.8,r-.07));
  }
 }
 if(i===15 && j>0 && j<N){
  for(let t=-10.6;t<10.5;t+=2.5){
   const x=X+4.96,z=Z+t;
   sheet.face([[x,.010,z],[x+2.74,.010,z],[x+2.74,.010,z+1.15],[x,.010,z+1.15]],BIKE_GREEN);
  }
 }
 sheet.finish();
}
function utilityHardware(axis,line,block){
 const p=(t,u)=>surfacePoint(axis,line,block,t,u);
 // Catch basins sit in the gutter, immediately upstream of the flat intersection.
 for(const sign of [-1,1]){
  const horizontal=axis==='ew',end=block+(sign<0?1:0);
  const extended=hasCurbExtension(horizontal?end:line,horizontal?line:end,horizontal?-sign:0,horizontal?0:-sign);
  const drain=extended?20.6:16.4;
  const [x,y,z]=p(sign>0?drain:CELL-drain,sign*7.72);
  const M=new THREE.Matrix4().makeRotationY(horizontal?0:Math.PI/2).setPosition(x,y,z);
  const iron=STREET.materials.iron;
  plainBox(STREET.materials.rubber,-.44,.44,-.006,.001,-.215,.215,{M,shadow:false});
  for(const edge of [-1,1])plainBox(iron,-.44,.44,.001,.004,edge*.195-.02,edge*.195+.02,{M,shadow:false});
  for(let k=0;k<10;k++)plainBox(iron,-.44+k*.093,-.405+k*.093,.001,.004,-.176,.176,{M,shadow:false});
  plainBox(iron,-.44,.44,.001,.0035,-.014,.014,{M,shadow:false});
 }
 if((line+block)%3!==0)return;
 const t=35+(line%3),u=line%2?2.9:-2.9,cover=new THREE.CircleGeometry(.347,32);
 const position=cover.attributes.position;
 for(let k=0;k<position.count;k++){
  const a=position.getX(k),b=position.getY(k);
  const [x,y,z]=axis==='ew'?p(t+a,u-b):p(t-b,u+a);
  position.setXYZ(k,x,y+.002,z);
 }
 cover.computeVertexNormals();addGeo(PAVING.cover,cover,false);
}
function obstructsStreet(x,z,type){
 if(x< -HALF || x>W+HALF || z< -HALF || z>W+HALF)return false;
 if(nearDriveway(x,z,.55))return true;
 const i=Math.round(x/CELL),j=Math.round(z/CELL),u=Math.abs(x-i*CELL),v=Math.abs(z-j*CELL);
 if(Math.min(u,v)>HALF+3.55)return false;
 const horizontal=v<u,along=horizontal?u:v;
 if(along<STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+1.3)return true;
 if(type!=='meter')return false;
 const section=horizontal?streetSection('ew',j,Math.floor(x/CELL)):streetSection('ns',i,Math.floor(z/CELL));
 return parkingCenter(section,horizontal?0:1)==null || along<21;
}
function buildStreetNetwork(){
 surveyDriveways();
 for(const objects of [LAMPS,PROPSPOTS,TREES,PALMS])for(let k=objects.length-1;k>=0;k--){
  const o=objects[k];if(obstructsStreet(o.x??o[0],o.z??o[1],o.type))objects.splice(k,1);
 }
 for(let line=0;line<=N;line++){
  if(line<N)for(let j=0;j<N;j++)buildSidewalk(blocks[line*N+j]);
  for(let block=0;block<N;block++)for(const axis of ['ns','ew']){
   buildCarriageway(axis,line,block);stripeSegment(axis,line,block);utilityHardware(axis,line,block);
  }
  for(let j=0;j<=N;j++)intersectionMarkings(line,j);
  if(line%4===3)flushBuckets();
 }
 cityTerrainReady=true;
}
function buildCurbExtension(i,j,dx,dz){
 const tile=newTerrain(true),d=STREET_DESIGN,cross=d.crossing,lo=cross-d.rampHalf,hi=cross+d.rampHalf;
 for(const side of [-1,1]){
  const point=(t,offset,y=d.curb)=>[i*CELL-dx*t-dz*side*(HALF-offset),y,j*CELL-dz*t+dx*side*(HALF-offset)];
  const face=(coords,mat=MAT.sidewalk,solid=true)=>terrainFace(tile,mat,coords.map(p=>point(...p)),solid);
  function rim(a,b){
   const g=new THREE.BufferGeometry(),q=point(...a),r=point(...b);
   const pos=[...q,...r,r[0],-.005,r[2],q[0],-.005,q[2]];
   g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   g.setAttribute('uv',new THREE.Float32BufferAttribute([0,.15,1,.15,1,0,0,0],2));
   const k=side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3];g.setIndex(k);g.computeVertexNormals();addGeo(MAT.curb,g,false);
  }
  const w=EXTENSION_WIDTH,back=w-d.rampDepth;
  const profile=[[HALF+1.4,0],[HALF+1.68,.62],[lo-d.flare,w],[lo,w,0],
   [hi,w,0],[hi+d.flare,w],[cross+3.4,w],[cross+5.3,1.26],[cross+7.25,0]];
  for(let k=1;k<profile.length;k++){
   const a=profile[k-1],b=profile[k];
   if(k===3 || k===4 || k===5){
    face([[a[0],0],[b[0],0],[b[0],back],[a[0],back]]);
    if(k===3){face([a,b,[b[0],back]]);face([a,[b[0],back],[a[0],back]]);}
    if(k===4)face([a,b,[b[0],back],[a[0],back]]);
    if(k===5){face([a,b,[a[0],back]]);face([b,[b[0],back],[a[0],back]]);}
   }else{
    const verts=[[a[0],0],[b[0],0]];
    if(b[1])verts.push(b);if(a[1])verts.push(a);
    face(verts);
   }
   rim(a,b);
  }
  const padY=v=>d.curb*v/d.rampDepth+.004;
  face([[lo+.03,w-.04,padY(.04)],[hi-.03,w-.04,padY(.04)],
   [hi-.03,w-.64,padY(.64)],[lo+.03,w-.64,padY(.64)]],PAVING.warning,false);
 }
 finishTerrain(tile);
}
