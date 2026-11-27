/* Outer shoreline beyond the harbor channel. The terminal and all public streets keep their surveyed bounds. */
function outerCoastRidges(){
 const sectors=164,rows=36,positions=[],uv=[],colors=[],indices=[];
 const head=Math.PI*.502,tail=Math.PI*1.54,centre=W/2;
 const rock=lin(0xa99f89),grass=lin(0xa9ac8a),scrub=lin(0x737e63),sand=lin(0xc3b89e);
 for(let j=0;j<=rows;j++)for(let i=0;i<=sectors;i++){
  const a=lerp(head,tail,i/sectors),v=j/rows;
  const coast=953+42*Math.sin(a*5.8+.7)+31*Math.cos(a*12.1)+14*Math.sin(a*24.8+.6);
  const r=coast+v*691, x=centre+r*Math.cos(a),z=centre+r*Math.sin(a);
  const gully=.46+.32*Math.cos(a*32.1+v*6.4)+.22*Math.sin(a*52.3-v*9.6);
  const ridge=(v0,spread)=>Math.exp(-(((v-v0)/spread)**2));
  const shoulder=(27+10*Math.sin(a*11.6))*ridge(.18+.046*Math.cos(a*11.3),.123);
  const near=(44+15*Math.cos(a*8.31)+11*Math.sin(a*16.5))*ridge(.39+.080*Math.sin(a*8.11+.4),.119);
  const far=(83+24*Math.sin(a*5.13)+11*Math.cos(a*15.7))*ridge(.68+.046*Math.cos(a*6.49),.165);
  const ends=clamp(Math.min(i,sectors-i)/10,0,1),inland=clamp(v*28,0,1);
  const y=-1.22+ends*inland*(2.6+(shoulder+near+far)*(.68+.32*gully)+5.1*Math.sin(a*22.3+v*6.2));
  positions.push(x,y,z);uv.push(x*.022,z*.022);
  const exposed=clamp(.47+.45*Math.sin(a*30.3+v*5.7)+.15*Math.cos(a*45.1-v*19.6),0,1);
  const color=grass.clone().lerp(scrub,clamp(gully*.73+.21*Math.sin(x*.031+z*.015),0,1))
   .lerp(rock,exposed*.78).lerp(sand,clamp(1-y/6,0,1));
  colors.push(color.r,color.g,color.b);
  if(i<sectors&&j<rows){
   const k=j*(sectors+1)+i;indices.push(k,k+1,k+sectors+1,k+1,k+sectors+2,k+sectors+1);
  }
 }
 const terrain=new THREE.BufferGeometry();
 terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 terrain.setIndex(indices);terrain.computeVertexNormals();
 const surface=new THREE.MeshStandardMaterial({map:MAT.grass.map,vertexColors:true,roughness:.97,envMapIntensity:.28});
 addGeo(surface,terrain,false);
}

function harborHeadland(){
 const width=60,depth=54,vertices=[],uv=[],colors=[],indices=[];
 const outset=z=>697+18*Math.sin(z*.010)+13*Math.sin(z*.027);
 const shore=z=>1101+27*Math.sin(z*.007+.58)+10*Math.sin(z*.014);
 const front=x=>1098+20*Math.sin(x*.011+.6)+11*Math.cos(x*.029);
 function height(x,z){
  const distance=Math.min(x-outset(z),shore(z)-x,z-front(x),1630-z);
  const dune=1.18+1.03*Math.sin(x*.043+.7)*Math.cos(z*.047)+.33*Math.sin(z*.091-x*.081);
  const roll=3.4+3.4*Math.cos((x-831)*.019)*Math.sin(z*.014);
  const hill=34*Math.exp(-(((x-858)/102)**2+((z-1459)/85)**2))+
             19*Math.exp(-(((x-1008)/88)**2+((z-1387)/81)**2));
  const bank=-.84+clamp(distance/12,0,1)*(1.76+dune)+clamp((distance-7)/36,0,1)*(roll+hill);
  const grade=clamp(Math.max(HARBOR.yard.x0-x-25,z-HARBOR.yard.z1-25)/38,0,1);
  return lerp(-.84,bank,grade);
 }
 const m=new THREE.MeshStandardMaterial({map:MAT.grass.map,vertexColors:true,roughness:.96,envMapIntensity:.26});
 for(let j=0;j<=depth;j++)for(let i=0;i<=width;i++){
  const x=660+i*8.4,z=1058+j*11,h=height(x,z);vertices.push(x,h,z);uv.push(x*.029,z*.029);
  const variation=.5+.5*Math.sin(x*.081+z*.073);
  const c=lin(h<.04?0xd0c1ac:h<2.0?0xc2b49d:h<7?0xb1a98f:0xb4b49a);
  c.multiplyScalar(.87+.21*variation);colors.push(c.r,c.g,c.b);
  if(i<width&&j<depth){const k=j*(width+1)+i;indices.push(k,k+width+1,k+1,k+1,k+width+1,k+width+2);}
 }
 const terrain=new THREE.BufferGeometry();
 terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();addGeo(m,terrain,false);
 // The far bank in photograph 038 is built up to its working shore, with housing behind the sheds.
 const roof=[MAT.roof,MAT.corrugated,MAT.roofClay],tints=[0xd4cfbc,0xb9ab94,0xb8b3a9,0xd8d6c6,0xb5ad99],sites=[];
 for(let row=0;row<12;row++)for(let k=0;k<16;k++){
  const x=715+k*25+Math.sin(row*6.68+k*1.74)*3,z=front(x)+18+row*31+Math.cos(k*1.32+row)*3.6;
  if(x<outset(z)+12||x>shore(z)-14)continue;
  const w=14+7*Math.abs(Math.sin(k*5.71+row)),d=13+7*Math.abs(Math.cos(k*2.71+row));
  const r={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2};
  if(r.x1>HARBOR.yard.x0-32&&r.z0<HARBOR.yard.z1+46)continue;
  sites.push(r);
  const footing=[height(x,z),height(r.x0,r.z0),height(r.x1,r.z0),height(r.x0,r.z1),height(r.x1,r.z1)];
  const y=Math.max(...footing)+.12,code=(row*17+k*13)%31,tone=tints[(row+k)%tints.length];
  plainBox(MAT.stone,r.x0-.20,r.x1+.20,Math.min(...footing)-.45,y,r.z0-.24,r.z1+.24,{uvm:2.1});
  const behindDocks=x<HARBOR.yard.x0-35||z>HARBOR.yard.z1+106;
  const flats=row>=3&&behindDocks&&code%4!==0,floors=flats?2+code%4:1+(code%3===0?1:0),h=y+(flats?3.09:3.35)*floors+.62;
  if(flats){
   const family=code%3===0?MAT.fac.brick_tan:code%3===1?MAT.fac.plaster:MAT.fac.concrete;
   facadeBox(family,r.x0,r.x1,y,h,r.z0,r.z1,{fh:3.09,bay:2.42,top:h,style:code%2,tint:tone,seed:code/31});
  }else{
   plainBox(code%3?MAT.corrugated:MAT.stone,r.x0,r.x1,y,h,r.z0,r.z1,{uvm:2.3,tint:tone});
   for(let bay=r.x0+.97;bay<r.x1-1.6;bay+=2.82){
    plainBox(MAT.darkMetal,bay,bay+1.63,h-2.11,h-.79,r.z0-.086,r.z0-.008);
    plainBox(MAT.metal,bay+.75,bay+.80,h-2.09,h-.82,r.z0-.11,r.z0-.082);
   }
   plainBox(MAT.shutter,x-1.74,x+1.74,y,h-2.24,r.z0-.042,r.z0+.022,{uvm:1.45});
  }
  plainBox(roof[flats?code%3:code%2],r.x0-.16,r.x1+.16,h-.04,h+.18,r.z0-.19,r.z1+.19,{uvm:2.0});
  for(const side of [r.z0,r.z1])plainBox(MAT.trim,r.x0-.06,r.x1+.06,h+.14,h+.46,side-.08,side+.08,{uvm:2.3});
  if(code%3!==0)plainBox(MAT.metal,x-.66,x+.66,h+.18,h+.91,z+.89,z+1.92,{uvm:1});
 }
 const grove=[];
 for(let j=0;j<365;j++){
  const a=j*2.399963,cluster=j%13,x=724+cluster*28+29*Math.sin(a*1.32),z=1130+((j*43)%386)+14*Math.cos(a);
  if(x<outset(z)+10||x>shore(z)-9)continue;
  if(x>HARBOR.yard.x0-32&&z<HARBOR.yard.z1+46)continue;
  if(sites.some(r=>x>r.x0-2&&x<r.x1+2&&z>r.z0-2&&z<r.z1+2))continue;
  grove.push([x,z,.59+.24*(1+Math.sin(a*3.62)),j%7?'mature':'golden',height(x,z)-.1]);
 }
 startForestSpecies(grove,[],false);
}
function northBeachSpit(){
 const mat=STREET.materials.coastSand,west=W+HALF,east=W+64.1;
  const base=-HALF;
  const stations=[[0,west,east,.02],[15,west+.41,east-.15,.04],[34,west+1.81,east-3.66,.12],
   [53,west+3.91,east-8.71,.23],[73,west+7.18,east-14.26,.16],[91,west+10.09,east-20.37,.078],
   [109,west+12.48,east-27.84,-.053],[126,west+15.01,east-34.65,-.21],[139,west+19.16,east-36.70,-.46]];
  const pos=[],uv=[],faces=[];
  for(const [k,[along,x0,x1,y]] of stations.entries()){
   const z=base-along;
   for(const fraction of [0,.35,.69,1]){
    const x=lerp(x0,x1,fraction);
    pos.push(x,y-(along?Math.abs(fraction-.5)*.51:0),z);uv.push((x-west)/2.7,(base-z)/2.7);
   }
   if(!k)continue;
   for(let n=0;n<3;n++){
    const a=(k-1)*4+n;
    faces.push(a,a+1,a+4,a+1,a+5,a+4);
   }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(faces);g.computeVertexNormals();addGeo(mat,g,false);
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

