/* Outer shoreline beyond the harbor channel. The terminal and all public streets keep their surveyed bounds. */
function harborHeadland(){
 const width=31,depth=28,vertices=[],uv=[],colors=[],indices=[];
 const outset=z=>697+18*Math.sin(z*.010)+13*Math.sin(z*.027);
 const shore=z=>1101+27*Math.sin(z*.007+.58)+10*Math.sin(z*.014);
 const front=x=>1098+20*Math.sin(x*.011+.6)+11*Math.cos(x*.029);
 function height(x,z){
  const distance=Math.min(x-outset(z),shore(z)-x,z-front(x),1630-z);
  const dune=1.18+1.03*Math.sin(x*.043+.7)*Math.cos(z*.047)+.33*Math.sin(z*.091-x*.081);
  const roll=3.4+3.4*Math.cos((x-831)*.019)*Math.sin(z*.014);
  const hill=34*Math.exp(-(((x-858)/102)**2+((z-1459)/85)**2))+
             19*Math.exp(-(((x-1008)/88)**2+((z-1387)/81)**2));
  return -.84+clamp(distance/12,0,1)*(1.76+dune)+clamp((distance-7)/36,0,1)*(roll+hill);
 }
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,envMapIntensity:.26});
 for(let j=0;j<=depth;j++)for(let i=0;i<=width;i++){
  const x=660+i*16,z=1058+j*21,h=height(x,z);vertices.push(x,h,z);uv.push(x*.029,z*.029);
  const variation=.5+.5*Math.sin(x*.081+z*.073);
  const c=lin(h<.04?0xb5a18a:h<2.0?0xb9ab91:h<7?0x8e8a6e:0x758069);
  c.multiplyScalar(.92+.14*variation);colors.push(c.r,c.g,c.b);
  if(i<width&&j<depth){const k=j*(width+1)+i;indices.push(k,k+width+1,k+1,k+1,k+width+1,k+width+2);}
 }
 const terrain=new THREE.BufferGeometry();
 terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();addGeo(m,terrain,false);
 // Low sheds and white apartments occupy the far bank below the coastal ridge.
 const roof=[MAT.roof,MAT.corrugated,MAT.roofClay],tints=[0xe2d7bd,0xd5c7aa,0xb7bab2,0xd4d7c4,0xb1aa97];
 for(let row=0;row<4;row++)for(let k=0;k<11;k++){
  const x=750+k*30+Math.sin(row*6.68+k*1.74)*5,z=1136+row*42+Math.cos(k*1.32+row)*11;
  if(x>shore(z)-26||z<front(x)+12)continue;
  const y=height(x,z),w=10+5*Math.abs(Math.sin(k*5.71+row)),d=9+6*Math.abs(Math.cos(k*2.71+row));
  const floors=1+(k*5+row*7)%3,h=y+3.09*floors+.6,tone=tints[(row+k)%tints.length];
  const family=row%2===0?MAT.fac.stucco:MAT.fac.concrete;
  facadeBox(family,x-w*.5,x+w*.5,y-.58,h,z-d*.5,z+d*.5,{fh:3.09,bay:2.23,top:h,style:row%2?0:4,tint:tone,seed:((row*17+k*13)%31)/31});
  plainBox(roof[(row+k)%3],x-w*.5-.19,x+w*.5+.19,h-.06,h+.20,z-d*.5-.19,z+d*.5+.19,{uvm:1.74});
  if(k%3!==0)plainBox(MAT.metal,x-.81,x+.81,h+.20,h+.84,z+.78,z+1.74,{uvm:1});
 }
 const canopy=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,envMapIntensity:.32});
 // Small clustered silhouettes follow valley bottoms and the exposed ridge. They stay below the weather horizon.
 for(let j=0;j<195;j++){
  const a=j*2.399963,cluster=j%13,x=724+cluster*28+29*Math.sin(a*1.32),z=1184+((j*43)%322)+14*Math.cos(a);
  if(x<outset(z)+10||x>shore(z)-9)continue;
  const size=2.0+1.8*(.5+.5*Math.sin(a*3.62)),y=height(x,z)+1.7;
  const g=new THREE.IcosahedronGeometry(1,j%3?0:1);g.scale(size*1.25,size*1.04,size);
  g.rotateY(a);g.translate(x,y+size*.49,z);setColor(g,[0x59694f,0x536148,0x768065,0x657455][j%4]);addGeo(canopy,g,false);
 }
}
function beachEndCaps(){
 const mat=STREET.materials.coastSand,west=W+HALF,east=W+64.1;
 for(const side of [-1,1]){
  const base=side>0?W+HALF:-HALF;
  const stations=[[0,west,east,.02],[15,west+.41,east-.15,.04],[34,west+1.81,east-3.66,.12],
   [53,west+3.91,east-8.71,.23],[73,west+7.18,east-14.26,.16],[91,west+10.09,east-20.37,.078],
   [109,west+12.48,east-27.84,-.053],[126,west+15.01,east-34.65,-.21],[139,west+19.16,east-36.70,-.46]];
  const pos=[],uv=[],faces=[];
  for(const [k,[along,x0,x1,y]] of stations.entries()){
   const z=base+side*along;
   for(const fraction of [0,.35,.69,1]){
    const x=lerp(x0,x1,fraction);
    pos.push(x,y-(along?Math.abs(fraction-.5)*.51:0),z);uv.push((x-west)/2.7,(base-z)/2.7);
   }
   if(!k)continue;
   for(let n=0;n<3;n++){
    const a=(k-1)*4+n;
    if(side>0)faces.push(a,a+4,a+1,a+1,a+4,a+5);else faces.push(a,a+1,a+4,a+1,a+5,a+4);
   }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(faces);g.computeVertexNormals();addGeo(mat,g,false);
 }
}

function offshoreCruiser(){
 // Loft the hull in transverse sections. A raised sheer, reverse transom and raked pilothouse read even on the far waterline.
 const x=W+339,z=W*.569,deck=new THREE.MeshStandardMaterial({color:lin(0xbea98d),roughness:.84}),
  shell=new THREE.MeshStandardMaterial({color:lin(0xdedbd0),roughness:.42,metalness:.16,side:THREE.DoubleSide}),
  hull=new THREE.MeshStandardMaterial({color:lin(0x516571),roughness:.49,metalness:.16,side:THREE.DoubleSide}),
  pane=new THREE.MeshStandardMaterial({color:lin(0x34474d),roughness:.18,metalness:.37,side:THREE.DoubleSide});
 const M=new THREE.Matrix4().makeRotationY(1.03);M.setPosition(x,-.26,z);
 const sections=[[-10.65,1.67,.88],[-9.71,2.08,1.15],[-6.74,2.32,1.19],[-1.89,2.49,1.22],
  [2.65,2.42,1.31],[5.84,1.89,1.41],[8.24,1.04,1.57],[9.86,.21,1.70],[10.12,.04,1.72]];
 const geo=(rows,material)=>{
  const p=rows.flat(2),u=[],index=[],stride=rows[0].length;
  for(let k=0;k<rows.length;k++)for(let j=0;j<stride;j++){
   u.push(j/(stride-1),k/(rows.length-1));if(k<rows.length-1&&j<stride-1){
    const i=k*stride+j;index.push(i,i+1,i+stride,i+1,i+stride+1,i+stride);
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(index);g.computeVertexNormals();g.applyMatrix4(M);addGeo(material,g,false);
 };
 for(const side of [-1,1]){
  const row=(z0,width,y)=>[[side*width*.22,-.98,z0*.92],[side*width*.74,-.47,z0*.979],
                          [side*width*.946,.17,z0],[side*width,y-.20,z0]];
  geo(sections.map(([z0,w,y])=>row(z0,w,y)),hull);
  geo(sections.map(([z0,w,y])=>[[side*w,y-.20,z0],[side*w*.999,y-.12,z0],[side*w*.982,y,z0]]),shell);
  for(let j=1;j<sections.length-1;j++){
   const [u,w,y]=sections[j],[v,w2,y2]=sections[j+1],a=new V3(side*w*.962,y+.58,u).applyMatrix4(M),b=new V3(side*w2*.962,y2+.58,v).applyMatrix4(M);
   worksBeam(MAT.metal,a.toArray(),b.toArray(),.022);
   for(const t of [0,.53]){const p=a.clone().lerp(b,t),lo=p.clone();lo.y-=.61;worksBeam(MAT.metal,lo.toArray(),p.toArray(),.023);}
  }
 }
 geo(sections.map(([s,w,y])=>[[w*.982,y,s],[0,y+.035,s],[-w*.982,y,s]]),deck);
 const shellRows=[[-7.20,1.65,1.23,2.67],[-5.0,1.76,1.21,2.91],[.85,1.75,1.34,2.94],[3.35,1.56,1.40,2.59],[4.78,1.14,1.45,1.79]];
 for(const s of [-1,1]){
  geo(shellRows.map(([v,w,y,h])=>[[s*w,y,v],[s*w*.98,y+.29,v],[s*w*.91,h-.46,v]]),shell);
  geo(shellRows.map(([v,w,y,h])=>[[s*w*.91,h-.46,v],[s*w*.85,h-.10,v]]),pane);
  geo(shellRows.map(([v,w,y,h])=>[[s*w*.85,h-.10,v],[s*w*.86,h+.031,v]]),shell);
 }
 geo(shellRows.map(([v,w,y,h])=>[[-w*.86,h+.031,v],[0,h+.12,v],[w*.86,h+.031,v]]),shell);
 for(const [v,w,y,h] of [shellRows[0],shellRows.at(-1)])geo([[[-w,y,v],[w,y,v]],[[-w*.85,h,v],[w*.85,h,v]]],pane);
 const box=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M,uvm:1,shadow:false});
 box(shell,-1.14,1.14,2.88,3.23,-3.51,.64);
 for(const s of [-1,1])box(pane,s*.92-.043,s*.92+.043,3.25,3.57,-2.48,-.29);
 box(shell,-1.10,1.10,3.56,3.66,-2.69,-.18);
 for(const [s,y,h] of [[-1.72,3.68,.78],[-1.36,3.71,.49]])cyl(MAT.metal,0,y,s,.012,.030,h,8,{M});
 box(shell,-.39,.39,3.75,3.91,-1.84,-1.62);
}

