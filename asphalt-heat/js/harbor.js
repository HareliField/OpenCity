/* A small boat harbor at the southern end of the boardwalk. */
const HARBOR={
 name:'South Shore Harbor',
 approach:{x0:W+HALF+6,x1:W+53,z0:965,z1:977,y:.25},
 quay:{x0:W+53,x1:W+63,z0:945,z1:998,y:.25},
 docks:[
  {x0:W+63,x1:W+92,z0:951,z1:955,y:.25},
  {x0:W+63,x1:W+99,z0:969,z1:973,y:.25},
  {x0:W+63,x1:W+88,z0:986,z1:990,y:.25}
 ],
 breakwater:[[W+59,999],[W+96,999],[W+115,993]],
 boats:[
  {dock:0,side:1,x:W+77,length:12.6,beam:3.45,type:'fishing',color:0x1e465f},
  {dock:1,side:-1,x:W+87,length:8.2,beam:2.64,type:'launch',color:0xcc963e},
  {dock:1,side:1,x:W+86,length:10.5,beam:2.9,type:'sail',color:0x305f64},
  {dock:2,side:-1,x:W+76,length:10.1,beam:3.05,type:'work',color:0x9a4234}
 ]
};

function harborWalkingLimit(z){
 const {quay,docks}=HARBOR;
 if(z<quay.z0||z>quay.z1)return null;
 return docks.find(d=>z>=d.z0&&z<=d.z1)?.x1??quay.x1;
}

function buildHarbor(){
 const {approach,quay,docks,boats}=HARBOR;
 for(const [i,d] of [approach,quay,...docks].entries()){
  STREET.steps.push(d);
  plainBox(i===0?MAT.stone:MAT.planks,d.x0,d.x1,.03,d.y,d.z0,d.z1,{uvm:1.45,shadow:false});
 }
 plainBox(MAT.column,quay.x1-.86,quay.x1,-1.25,quay.y-.045,quay.z0,quay.z1,{uvm:1.9});

 // Narrow timber edging reads as a toe rail and keeps the playable deck clear of the water.
 function edge(x0,x1,z0,z1){
  plainBox(MAT.wood,x0,x1,quay.y,.46,z0,z1,{uvm:1.2});
  STATIC.push({x0,x1,z0,z1,y0:quay.y,h:.46});
 }
 const ends=[quay.z0,...docks.flatMap(d=>[d.z0,d.z1]),quay.z1];
 for(let i=0;i<ends.length;i+=2)edge(quay.x1-.12,quay.x1,ends[i],ends[i+1]);
 for(const z of [quay.z0,quay.z1-.12])edge(quay.x0,quay.x1,z,z+.12);

 for(const [i,dock] of docks.entries()){
  const {x0,x1,z0,z1}=dock;
  edge(x0,x1,z0,z0+.12);
  edge(x0,x1,z1-.12,z1);
  edge(x1-.12,x1,z0,z1);
  for(let x=x0+2;x<x1;x+=6.5)for(const z of [z0+.14,z1-.14]){
   cyl(MAT.wood,x,-1.05,z,.13,.16,1.74,8);
  }
  const stripe=i%2===0?MAT.whiteMetal:MAT.trim;
  for(const z of [z0+.36,z1-.36]){
   STATIC.push({x0:x1-.49,x1:x1-.27,z0:z-.11,z1:z+.11,y0:dock.y,h:dock.y+.52,radius:.11});
   cyl(MAT.darkMetal,x1-.38,dock.y,z,.065,.11,.52,8);
   cyl(stripe,x1-.38,dock.y+.43,z,.069,.07,.08,8);
  }
 }

 for(const z of [949,963,981,994]){
  STATIC.push({x0:quay.x1-.91,x1:quay.x1-.65,z0:z-.13,z1:z+.13,y0:.25,h:3.22,radius:.13});
  cyl(MAT.darkMetal,quay.x1-.78,.25,z,.075,.13,2.92,8);
  cyl(MAT.trim,quay.x1-.78,3.09,z,.16,.11,.13,8);
 }
 for(const z of [approach.z0+.95,approach.z1-.95]){
  for(const x of [approach.x0+1.4,approach.x0+4.3]){
   cyl(MAT.darkMetal,x,.25,z,.067,.095,.83,8);
   STATIC.push({x0:x-.095,x1:x+.095,z0:z-.095,z1:z+.095,h:1.08,radius:.09});
  }
 }
 const sign=atlasSlot((g,w,h)=>{
  g.fillStyle='#244d50';
  g.fillRect(0,0,w,h);
  g.strokeStyle='#c7d2bc';
  g.lineWidth=3;
  g.strokeRect(10,10,w-20,h-20);
  g.fillStyle='#f7efd5';
  g.font='700 38px Inter, Arial, sans-serif';
  g.textAlign='center';
  g.textBaseline='middle';
  g.fillText(HARBOR.name.toUpperCase(),w/2,48,w-38);
  g.font='600 25px Inter, Arial, sans-serif';
  g.fillText('PRIVATE MOORAGE',w/2,89);
 });
 const sx=approach.x0+1.45,sz=approach.z0+1.75;
 for(const z of [sz-1.04,sz+1.04]){
  cyl(MAT.wood,sx,.25,z,.065,.08,2.08,8);
  STATIC.push({x0:sx-.08,x1:sx+.08,z0:z-.08,z1:z+.08,h:2.33,radius:.08});
 }
 signQuad(sign,sx-.082,2.03,sz,2.65,.65,-Math.PI/2,false);

 buildHarborBreakwater();
 for(const boat of boats)buildMooredBoat(boat,docks[boat.dock]);
}

function buildHarborBreakwater(){
 const line=HARBOR.breakwater;
 for(let i=1;i<line.length;i++){
  const [ax,az]=line[i-1],[bx,bz]=line[i];
  const count=Math.ceil(Math.hypot(bx-ax,bz-az)/1.68);
  for(let n=0;n<count;n++)for(const side of [-1,1]){
   const t=(n+.38+.16*side)/count,phase=n*2.41+i*3.27+side;
   const rock=new THREE.IcosahedronGeometry(1,1);
   rock.scale(1.24+.32*Math.sin(phase),.56+.17*Math.cos(phase),1.02+.17*Math.sin(phase*2));
   rock.rotateY(phase);
   rock.translate(lerp(ax,bx,t),.02+.13*Math.sin(phase),lerp(az,bz,t)+side*.87);
   addGeo(n%4===0?MAT.column:MAT.stone,rock,true);
  }
 }
}

function buildMooredBoat(boat,dock){
 const {x,beam,length,type,color,side}=boat;
 const edgeZ=side<0?dock.z0:dock.z1;
 const z=edgeZ+side*(beam*.5+.52);
 const frame=new THREE.Matrix4().makeRotationY(Math.PI/2);
 frame.setPosition(x,0,z);
 const hullMat=new THREE.MeshStandardMaterial({color:lin(color),roughness:.58,side:THREE.DoubleSide});
 const deckMat=new THREE.MeshStandardMaterial({color:lin(0xd1c8b4),roughness:.9,side:THREE.DoubleSide});
 const stripeMat=new THREE.MeshStandardMaterial({color:lin(0xe9e6d9),roughness:.63,side:THREE.DoubleSide});
 const outline=[
  [-.35,-.5],[.35,-.5],[.48,-.35],[.49,.01],[.38,.27],[.17,.44],
  [0,.51],[-.17,.44],[-.38,.27],[-.49,.01],[-.48,-.35]
 ];
 const ring=(width,long,y)=>outline.map(([u,v])=>[u*beam*width,y+.16*Math.max(0,v*2),v*length*long]);
 const keel=ring(.38,.83,-1.02),chine=ring(.8,.95,-.56);
 const sheer=ring(1,1,.36),rim=ring(.985,1,.5);
 const q=outline.length;

 function shell(a,b,mat){
  const verts=[],indices=[];
  for(let i=0;i<q;i++){
   const n=(i+1)%q,index=verts.length/3;
   verts.push(...a[i],...a[n],...b[i],...b[n]);
   indices.push(index,index+1,index+2,index+1,index+3,index+2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.applyMatrix4(frame);
  addGeo(mat,geo,true);
 }
 shell(keel,chine,hullMat);
 shell(chine,sheer,hullMat);
 shell(sheer,rim,stripeMat);
 const deck=new THREE.BufferGeometry(),faces=[];
 for(let i=0;i<q;i++)faces.push(q,(i+1)%q,i);
 deck.setAttribute('position',new THREE.Float32BufferAttribute([...rim.flat(),0,.5,0],3));
 deck.setIndex(faces);
 deck.computeVertexNormals();
 deck.applyMatrix4(frame);
 addGeo(deckMat,deck,true);
 const box=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M:frame,uvm:1.8});

 if(type==='fishing'||type==='work'){
  const w=beam*.33,c0=-length*.08,c1=length*.2,roof=type==='fishing'?2.57:2.23;
  box(MAT.whiteMetal,-w,w,.5,roof,c0,c1);
  box(MAT.glassDark,-w+.12,w-.12,roof-.75,roof-.19,c1-.01,c1+.04);
  for(const s of [-1,1]){
   box(MAT.glassDark,s*w-.025,s*w+.025,roof-.69,roof-.2,c0+.21,c1-.27);
   box(MAT.whiteMetal,s*w-.035,s*w+.035,roof-.69,roof-.2,c0+(c1-c0)*.54,c0+(c1-c0)*.54+.08);
  }
  box(hullMat,-w-.13,w+.13,roof,roof+.12,c0-.22,c1+.19);
  cyl(MAT.darkMetal,0,roof+.12,c0+.34,.026,.046,.74,8,{M:frame});
  box(MAT.wood,-beam*.27,-beam*.03,.51,.81,-length*.35,-length*.24);
 }else if(type==='sail'){
  box(MAT.whiteMetal,-beam*.3,beam*.3,.5,1.02,-length*.12,length*.19);
  box(MAT.glassDark,-.62,.62,.75,.92,length*.19-.025,length*.19+.018);
  cyl(MAT.metal,0,1.02,.56,.03,.061,6.55,8,{M:frame});
  box(MAT.whiteMetal,-.038,.038,2.11,2.19,-length*.32,.63);
 }else{
  box(MAT.whiteMetal,-beam*.3,beam*.3,.52,.94,length*.05,length*.29);
  box(MAT.glassDark,-beam*.28,beam*.28,.93,1.24,length*.07,length*.13);
  box(MAT.whiteMetal,-beam*.29,beam*.29,.52,.78,-length*.28,-length*.21);
  box(MAT.darkMetal,-.29,.29,-.26,.83,-length*.54,-length*.46);
 }

 for(const end of [-1,1]){
  const ropeStart=new V3(x+end*length*.4,.4,edgeZ-side*.16);
  const ropeEnd=new V3(x+end*length*.32,.54,z-side*beam*.42);
  const sag=ropeStart.clone().lerp(ropeEnd,.5);
  sag.y-=.22;
  const rope=new THREE.QuadraticBezierCurve3(ropeStart,sag,ropeEnd);
  addGeo(MAT.wood,new THREE.TubeGeometry(rope,6,.022,5,false),false);
  cyl(MAT.darkMetal,ropeStart.x,.25,ropeStart.z,.075,.085,.16,6);
 }
}

function drawHarborMap(g,k){
 const mapX=x=>(x+HALF)*k;
 for(const [i,r] of [HARBOR.approach,HARBOR.quay,...HARBOR.docks].entries()){
  g.fillStyle=i===0?'#8a8c82':'#c2a27f';
  g.fillRect(mapX(r.x0),mapX(r.z0),(r.x1-r.x0)*k,(r.z1-r.z0)*k);
 }
 g.save();
 g.lineWidth=2.4;
 g.lineJoin='round';
 g.strokeStyle='#ada89b';
 g.beginPath();
 for(const [i,[x,z]] of HARBOR.breakwater.entries()){
  if(i===0)g.moveTo(mapX(x),mapX(z));
  else g.lineTo(mapX(x),mapX(z));
 }
 g.stroke();
 g.restore();
}
