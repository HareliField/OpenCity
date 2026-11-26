/* The graded roads share one sampled spline between meshes, physics and navigation. */
const GRADE_ROADS={routes:[],grid:new Map()};
const GRADE_PROFILES=[
 {name:'Harbor Viaduct',width:8.5,points:[
  [383,.035,704],[401,.10,704],[430,3.55,702.9],[454,5.6,702.25],[490,6.65,701.98],
  [532,7.0,703.4],[594,8.45,705.58],[662,8.75,705.65],[720,8.35,704.0],
  [762,6.78,702.37],[812,6.2,701.78],[845,3.92,702.94],[862,.62,703.8],[868,.09,704],[875,.04,704],[895,.04,704],[921,.043,704]
 ]},
 {name:'Coast Ridge Road',width:7.7,points:[
  [832,.039,561],[832,.055,594],[839,.53,615],[850,1.57,641],[873,3.3,667],
  [880,4.83,696],[874,4.12,727],[886,1.58,744],[893,.22,755],[895,.05,760],[896,.04,773],[896,.042,795]
 ]}
];

function reserveGradeBlock(block){
 if(block.i!==13||block.j<9||block.j>11)return false;
 block.park=true;
 const {x0,x1,z0,z1}=block;
 topQuad(MAT.grass,x0,x1,.16,z0,z1,5.9,null,false);
 for(const z of [z0+4.2,z1-5.1]){
  TREE_RESERVE.push([x0+3.3,z,.9],[x1-3.3,z,1.06]);
 }
 return true;
}
const TREE_RESERVE=[];

function buildGradeRoads(){
 const asphalt=pbr('asphalt',6.3,{rough:.57,rmap:1,ns:1.02,env:.86,color:0x938f89});
 const solidRail=pbr('concrete',2.7,{color:0xb8a99a,rough:.79,env:.6,ns:.54});
 const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57,polygonOffset:true,polygonOffsetFactor:-2});
 const rib=new THREE.MeshStandardMaterial({color:lin(0x706b63),metalness:.48,roughness:.47});
 const reflectors=new THREE.MeshBasicMaterial({color:new THREE.Color(1.15,.54,.12)});
 for(const data of GRADE_PROFILES){
  const curve=new THREE.CatmullRomCurve3(data.points.map(p=>new V3(...p)));
  const route={name:data.name,curve,width:data.width,sections:[]};
  GRADE_ROADS.routes.push(route);
  const pieces=Math.ceil(curve.getLength()/3.7),points=curve.getSpacedPoints(pieces);
  for(const p of points)p.y=Math.max(.025,p.y);
  const rows=points.map((p,i)=>{
   const f=points[Math.min(pieces,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize();
   const side=new V3(f.z,0,-f.x).normalize();
   const up=new V3().crossVectors(f,side).normalize();
   return{p,side,up};
  });
  buildRoadStrips(rows,data.width,asphalt,paint);
  roadsideSign(data,points);
  for(let i=0;i<pieces;i++){
   const a=points[i],b=points[i+1],step=b.clone().sub(a),length=step.length(),forward=step.clone().divideScalar(length);
   const side=new V3(forward.z,0,-forward.x).normalize(),up=new V3().crossVectors(forward,side).normalize();
   const middle=a.clone().lerp(b,.5);
   const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,up,forward));
   const half=data.width/2;
   const hasRails=middle.y>.55;
   const section={a,b,side,up,half,dx:b.x-a.x,dz:b.z-a.z,hasRails};
   route.sections.push(section);
   addGradeSection(section);
   const base=middle.clone().addScaledVector(up,-.23);
   const depth=i===0||i===pieces-1?.43:.46;
   orientedRoadBox(solidRail,base,q,data.width+.24,depth,length+.057,{road:true,visual:true,omitTop:true});
   if(hasRails){
    for(const sign of [-1,1]){
     const center=middle.clone().addScaledVector(side,sign*(half+.10)).addScaledVector(up,.35);
     orientedRoadBox(solidRail,center,q,.28,.72,length+.04,{road:true,visual:true});
     if(i%5===0){
      const stud=center.clone().addScaledVector(side,-sign*.153).addScaledVector(up,.195);
      orientedRoadBox(reflectors,stud,q,.025,.066,.18,{road:false,visual:true});
     }
    }
   }
   const clearBelow=data.name==='Harbor Viaduct'?
    Math.abs(middle.x-Math.round(middle.x/CELL)*CELL)>12:
    Math.abs(middle.z-704)>14;
   if(i%10===7&&middle.y>3.28&&clearBelow){
    const isHarbor=data.name==='Harbor Viaduct';
    const feet=isHarbor?[new V3(middle.x,0,704)]:
     [-1,1].map(direction=>middle.clone().addScaledVector(side,direction*(half-.50)));
    for(const p of feet){
     const h=middle.y-.45,r=isHarbor?.61:.42;
     cyl(MAT.column,p.x,.005,p.z,r*.9,r,h,12);
     STATIC.push({x0:p.x-r,x1:p.x+r,z0:p.z-r,z1:p.z+r,h:h+.01,radius:r});
    }
    orientedRoadBox(rib,middle.clone().addScaledVector(up,-.53),q,data.width+.78,.38,1.37,{road:true,visual:true});
   }
  }
 }
 ATLAS.mat.map.needsUpdate=true;
 for(const [x,z,size] of TREE_RESERVE){
  if(!sampleGrade(x,z,null,2.5))TREES.push([x,z,size]);
 }
 for(const grove of [TREES,PALMS]){
  for(let i=grove.length-1;i>=0;i--)if(sampleGrade(grove[i][0],grove[i][1],null,.28))grove.splice(i,1);
 }
 for(const props of [LAMPS,PROPSPOTS]){
  for(let i=props.length-1;i>=0;i--){
   const p=props[i],deck=sampleGrade(p.x,p.z,null,.21);
   if(deck&&deck.height<(props===LAMPS?7.25:1.6))props.splice(i,1);
  }
 }
}

function roadsideSign(data,points){
 const slot=atlasSlot((g,w,h)=>{
  g.fillStyle='#29483f';g.fillRect(0,0,w,h);
  g.strokeStyle='#d0c3a8';g.lineWidth=4;g.strokeRect(10,10,w-20,h-20);
  g.textAlign='center';g.fillStyle='#f0ead7';
  g.font='600 35px Arial, sans-serif';g.fillText(data.name.toUpperCase(),w/2,60);
  g.font='600 24px Arial, sans-serif';g.fillText('ON RAMP',w/2,99);
 });
 for(const end of [0,points.length-1]){
  const n=end===0?end+1:end-1,last=points[end],next=points[n];
  const direction=next.clone().sub(last).normalize();
  const x=last.x+direction.z*(data.width/2+.93),z=last.z-direction.x*(data.width/2+.93);
  const yaw=Math.atan2(-direction.x,-direction.z);
  cyl(MAT.darkMetal,x,.03,z,.063,.075,2.69,8);
  STATIC.push({x0:x-.077,x1:x+.077,z0:z-.077,z1:z+.077,h:2.69,radius:.077});
  signQuad(slot,x-Math.sin(yaw)*.035,2.50,z-Math.cos(yaw)*.035,2.87,.72,yaw,false);
 }
}

function buildRoadStrips(rows,width,asphalt,paint){
 const surface=[],surfaceUV=[],surfaceIndex=[],mark=[],markColors=[],markIndex=[];
 function append(vertices,indices,points){
  const k=vertices.length/3;
  for(const p of points)vertices.push(p.x,p.y,p.z);
  indices.push(k,k+2,k+1,k+2,k+3,k+1);
 }
 function edge(row,d,h=0){
  return row.p.clone().addScaledVector(row.side,d).addScaledVector(row.up,h);
 }
 function marking(a,b,u,v,c){
  append(mark,markIndex,[edge(a,u,.022),edge(a,v,.022),edge(b,u,.022),edge(b,v,.022)]);
  for(let i=0;i<4;i++)markColors.push(...c);
 }
 let d=0;
 for(let i=0;i+1<rows.length;i++){
  const a=rows[i],b=rows[i+1],half=width/2,next=d+a.p.distanceTo(b.p);
  const rim=half+.122;
  append(surface,surfaceIndex,[edge(a,-rim,.014),edge(a,rim,.014),edge(b,-rim,.014),edge(b,rim,.014)]);
  surfaceUV.push(0,d,width,d,0,next,width,next);
  if(i>=3&&i<rows.length-4){
   marking(a,b,-.19,-.08,[.61,.38,.065]);
   marking(a,b,.08,.19,[.61,.38,.065]);
   marking(a,b,-half+.24,-half+.34,[.67,.67,.63]);
   marking(a,b,half-.34,half-.24,[.67,.67,.63]);
  }
  d=next;
 }
 function mesh(pos,idx,mat,name,uv,colors){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);
  m.receiveShadow=true;
  m.name=name;
  scene.add(m);
 }
 mesh(surface,surfaceIndex,asphalt,'Elevated road surface',surfaceUV,null);
 mesh(mark,markIndex,paint,'Graded road markings',null,markColors);
}

function orientedRoadBox(mat,p,q,w,h,d,{road,visual,omitTop=false}){
 const transform=new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(p.x,p.y,p.z);
 const g=new THREE.BoxGeometry(w,h,d).applyMatrix4(transform);
 g.computeBoundingBox();
 const {min,max}=g.boundingBox;
 if(road)STATIC.push({
  x0:min.x,x1:max.x,z0:min.z,z1:max.z,y0:min.y,h:max.y,walkIgnore:true,asphalt:omitTop,normal:omitTop?new V3(0,1,0).applyQuaternion(q):null,
  obb:{p:p.clone(),q:q.clone(),w,h,d}
 });
 if(visual){
  if(omitTop){
   const faces=Array.from(g.index.array);
   const top=g.groups[2];
   faces.splice(top.start,top.count);
   g.clearGroups();
   g.setIndex(faces);
  }
  addGeo(mat,g,true);
 }else g.dispose();
}

function addGradeSection(s){
 const margin=s.half+3.5;
 const a=cellKey(Math.min(s.a.x,s.b.x)-margin,Math.min(s.a.z,s.b.z)-margin);
 const b=cellKey(Math.max(s.a.x,s.b.x)+margin,Math.max(s.a.z,s.b.z)+margin);
 s.lengthSq=s.dx*s.dx+s.dz*s.dz;
 for(let x=Math.floor(a/N);x<=Math.floor(b/N);x++)for(let z=a%N;z<=b%N;z++){
  const key=x*N+z;
  if(!GRADE_ROADS.grid.has(key))GRADE_ROADS.grid.set(key,[]);
  GRADE_ROADS.grid.get(key).push(s);
 }
}

function gradeCoordinates(s,x,z){
 const along=((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/s.lengthSq;
 const f=clamp(along,0,1),cx=lerp(s.a.x,s.b.x,f),cz=lerp(s.a.z,s.b.z,f);
 return {along,lateral:(x-cx)*s.side.x+(z-cz)*s.side.z,
  range:Math.hypot(x-cx,z-cz),height:lerp(s.a.y,s.b.y,f),cx,cz};
}

function sampleGrade(x,z,referenceY,margin=0){
 let closest=null,score=Infinity;
 for(const s of GRADE_ROADS.grid.get(cellKey(x,z))||[]){
  const q=gradeCoordinates(s,x,z);
  if(q.along<-.17||q.along>1.17||q.range>s.half+margin)continue;
  if(referenceY!==null&&(q.height-referenceY>.34||q.height-referenceY<-.62))continue;
  const cost=q.range+(referenceY===null?0:.65*Math.abs(q.height-referenceY));
  if(cost>=score)continue;
  closest=q;
  score=cost;
 }
 return closest;
}

function collideGradeRails(p,r,y){
 // Use the locally closest centreline so joints between straight collision sections don't catch the avatar.
 let closest=null,best=Infinity;
 for(const s of GRADE_ROADS.grid.get(cellKey(p.x,p.z))||[]){
  const q=gradeCoordinates(s,p.x,p.z);
  if(!s.hasRails||q.along<-.14||q.along>1.14||Math.abs(q.height-y)>.39||q.range>s.half+r+.34)continue;
  const distance=Math.abs(q.lateral);
  if(distance>best)continue;
  closest={s,q};
  best=distance;
 }
 if(!closest)return null;
 const {s,q}=closest,half=s.half;
 if(Math.abs(q.lateral)<half-r||Math.abs(q.lateral)>half+r+.25)return null;
 const sign=Math.sign(q.lateral)||1;
 const onInside=Math.abs(q.lateral)<half+.12;
 const keep=sign*(onInside?half-r:half+r+.26);
 p.x+=s.side.x*(keep-q.lateral);
 p.z+=s.side.z*(keep-q.lateral);
 return [s.side.x*(onInside?-sign:sign),s.side.z*(onInside?-sign:sign)];
}

function drawGradeRoads(g,k){
 g.lineWidth=Math.max(2,8.9*k);
 g.lineJoin='round';
 g.strokeStyle='#c4a680';
 for(const route of GRADE_ROADS.routes){
  g.beginPath();
  for(const [i,s] of route.sections.entries()){
   if(i===0)g.moveTo((s.a.x+HALF)*k,(s.a.z+HALF)*k);
   g.lineTo((s.b.x+HALF)*k,(s.b.z+HALF)*k);
  }
  g.stroke();
 }
}
