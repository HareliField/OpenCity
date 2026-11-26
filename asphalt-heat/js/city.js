/* Breakwater Bay's street plan. Coordinates are in world metres, north is -Z. */
const CITY_X=[0,48,119,185,250,320,382,432,488,560,648,703,758,834,902,955,W];
const CITY_Z=[0,54,126,192,257,320,384,442,503,562,633,701,774,832,904,968,W];
const NORTH_SOUTH=[8,5.3,6,5.8,8.6,5.5,6.1,5.7,6.6,9.7,6.8,6.1,5.7,8.7,5.9,6.4,8];
const EAST_WEST=[8,5.7,5.4,7.3,6,8.5,6.1,5.9,8.4,5.8,6.2,10.9,7.9,6,6.8,5.5,8];
const PIER_Z=W*.42;
const QUAY_Z=CITY_Z[12];
const DISTRICTS={
 suburb:{name:'Juniper Heights',color:'#35463a',label:[165,191]},
 oldtown:{name:'Market Ward',color:'#503c34',label:[333,303]},
 downtown:{name:'Glasspoint',color:'#333e52',label:[630,414]},
 midtown:{name:'Westhaven',color:'#41464a',label:[207,559]},
 docks:{name:'South Basin',color:'#4c4738',label:[788,878]},
 beach:{name:'Dune Strand',color:'#4a3c49',label:[940,376]}
};

const PUBLIC_GREEN=new Set([
 '0,0','0,1','1,0','1,1','2,1','3,1',
 '0,5','0,6','1,5','1,6','0,8','1,8','1,9',
 '0,14','1,14','2,13','2,14','8,1','9,1','10,1','12,2',
 '14,0','15,0','14,1','15,1','15,2','15,3','15,4','15,6',
 '14,8','15,8'
]);

function districtOf(i,j){
 if(j>=11&&i>=7)return 'docks';
 if(i>=13)return 'beach';
 if(i>=7&&i<=11&&j>=3&&j<=8)return 'downtown';
 if((i<=3&&j<=3)||(i<=3&&j>=10)||(i>=8&&j<=2))return 'suburb';
 if(i>=2&&i<=6&&j>=2&&j<=7)return 'oldtown';
 return 'midtown';
}

function parcelBounds(i,j){
 return {
  x0:CITY_X[i]+NORTH_SOUTH[i],x1:CITY_X[i+1]-NORTH_SOUTH[i+1],
  z0:CITY_Z[j]+EAST_WEST[j],z1:CITY_Z[j+1]-EAST_WEST[j+1]
 };
}

function parcelAxis(axis,value){
 let low=0,high=axis.length-1;
 while(low+1<high){
  const mid=(low+high)>>1;
  if(value<axis[mid])high=mid;
  else low=mid;
 }
 return low;
}

function parcelKey(x,z){
 return parcelAxis(CITY_X,x)*N+parcelAxis(CITY_Z,z);
}

function nearestAxis(axis,value){
 const i=parcelAxis(axis,value);
 return value-axis[i]<=axis[i+1]-value?i:i+1;
}

function streetNode([i,j]){
 return {x:CITY_X[i],z:CITY_Z[j]};
}

function nearestNode(p){
 return [nearestAxis(CITY_X,p.x),nearestAxis(CITY_Z,p.z)];
}

function streetHalf(a,b){
 return a[0]===b[0]?NORTH_SOUTH[a[0]]:EAST_WEST[a[1]];
}

function streetFrame(a,b){
 const from=streetNode(a),to=streetNode(b);
 return {from,to,dx:Math.sign(to.x-from.x),dz:Math.sign(to.z-from.z),half:streetHalf(a,b)};
}

function lanePosition(a,b,f,offset){
 const {from,to,dx,dz,half}=streetFrame(a,b),lane=offset??(half>7.5?3.85:2.7);
 return {x:lerp(from.x,to.x,f)-dz*lane,z:lerp(from.z,to.z,f)+dx*lane,h:Math.atan2(dx,dz)};
}

// Parks and rail yards grew over several street rights-of-way. Each coordinate
// identifies the western or northern end of the street that was removed.
const CLOSED_STREETS={
 east:[
  [0,1,3],[0,2,2],[1,3,3],[2,4,1],
  [0,6,2],[0,7,2],[0,9,3],[1,10,2],[1,12,2],[1,13,2],[0,15,3],
  [6,1,3],[7,2,3],[10,1,3],[11,2,2],[12,3,1],
  [5,7,2],[5,8,2],[10,9,2],[12,9,2],
  [14,1,2],[14,2,2],[15,3,1],[15,4,1],[15,6,1],[14,8,2],
  [8,12,2],[8,13,2],[6,14,2],[9,14,2],[11,13,2],[11,15,2],
  [13,12,2],[13,14,2],[13,15,2]
 ],
 south:[
  [1,0,2],[2,1,2],[3,2,2],[1,5,2],[2,6,1],[1,8,2],
  [2,9,2],[2,12,2],[3,12,3],[4,12,2],
  [6,0,2],[8,1,2],[10,0,2],[12,2,2],[14,1,2],
  [6,6,1],[7,7,1],[12,8,2],[14,8,2],
  [15,1,3],[15,6,2],[16,1,3],[16,6,1],
  [7,13,1],[8,13,1],[9,12,2],[10,13,2],[11,12,2],[13,13,2],[14,12,1],[15,13,2]
 ]
};
const closedStreetKey=(axis,i,j)=>`${axis},${i},${j}`;
const closedStreetKeys=new Set(Object.entries(CLOSED_STREETS).flatMap(([axis,rows])=>
 rows.flatMap(([i,j,count])=>Array.from({length:count},(_,k)=>
  closedStreetKey(axis,i+(axis==='east'?k:0),j+(axis==='south'?k:0))
 ))
));

const rampStreetKeys=new Set(['east,1,11','east,15,11']);
function streetOpen(a,b){
 const axis=a[0]===b[0]?'south':'east';
 const key=closedStreetKey(axis,Math.min(a[0],b[0]),Math.min(a[1],b[1]));
 return !closedStreetKeys.has(key)&&!rampStreetKeys.has(key);
}

function neighbors([i,j]){
 const out=[];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const a=i+dx,b=j+dz;
  if(a>=0&&a<=N&&b>=0&&b<=N&&streetOpen([i,j],[a,b]))out.push([a,b]);
 }
 return out;
}

function nearestTrafficNode(p){
 const [i,j]=nearestNode(p);
 if(neighbors([i,j]).length)return [i,j];
 let best=null,distance=Infinity;
 for(let x=Math.max(0,i-2);x<=Math.min(N,i+2);x++){
  for(let z=Math.max(0,j-2);z<=Math.min(N,j+2);z++){
   const d=Math.hypot(CITY_X[x]-p.x,CITY_Z[z]-p.z);
   if(d<distance&&neighbors([x,z]).length){
    best=[x,z];distance=d;
   }
  }
 }
 return best;
}

function nextStreetNode(from,goal){
 const key=([i,j])=>i*(N+1)+j;
 const end=key(goal),visited=new Set([key(from)]),queue=[];
 for(const b of neighbors(from))queue.push({node:b,first:b});
 for(const {node,first} of queue){
  const id=key(node);
  if(id===end)return first;
  if(visited.has(id))continue;
  visited.add(id);
  for(const b of neighbors(node))if(!visited.has(key(b)))queue.push({node:b,first});
 }
 return neighbors(from)[0]||from;
}

function streetSignal(i,j){
 return (NORTH_SOUTH[i]>=8.6||EAST_WEST[j]>=8.4)&&neighbors([i,j]).length===4&&
  i>0&&i<N&&j>0&&j<N;
}

function shoreline(z){
 return W+57+12*Math.sin(z*.008+.55)+5*Math.sin(z*.019-.8);
}

function coastLimit(z){
 if(z>=QUAY_Z)return W+80;
 if(Math.abs(z-PIER_Z)<3.76)return W+149.45;
 return shoreline(z)-3;
}

function isSand(x,z){
 return z<QUAY_Z&&x>W+14&&x<shoreline(z);
}

const CITY_INFILL=[];

function prepareStreetInfill(){
 for(const key of closedStreetKeys){
  const [axis,i,j]=key.split(','),a=[+i,+j],east=axis==='east';
  const b=[a[0]+Number(east),a[1]+Number(!east)];
  const {from,to,half}=streetFrame(a,b);
  const start=(east?NORTH_SOUTH[a[0]]:EAST_WEST[a[1]])+1.1;
  const end=(east?NORTH_SOUTH[b[0]]:EAST_WEST[b[1]])+1.1;
  const bounds=east?
   {x0:from.x+start,x1:to.x-end,z0:from.z-half-.02,z1:from.z+half+.02}:
   {x0:from.x-half-.02,x1:from.x+half+.02,z0:from.z+start,z1:to.z-end};
  const green=a[1]<11;
  CITY_INFILL.push({...bounds,green,h:.15});
 }
 // Four closed approaches become continuous parks and yards at the junction.
 for(let i=1;i<N;i++)for(let j=1;j<N;j++){
  if(neighbors([i,j]).length)continue;
  const x=CITY_X[i],z=CITY_Z[j],u=NORTH_SOUTH[i]+1.11,v=EAST_WEST[j]+1.11;
  CITY_INFILL.push({x0:x-u,x1:x+u,z0:z-v,z1:z+v,green:j<11,h:.151});
 }
}

function buildStreetInfill(){
 for(const R of CITY_INFILL){
  const {x0,x1,z0,z1,green,h}=R;
  topQuad(green?MAT.grass:MAT.plaza,x0,x1,h,z0,z1,3.2,null,false);
  const alongX=x1-x0>z1-z0;
  const x=(x0+x1)/2,z=(z0+z1)/2;
  for(const sign of [-1,1]){
   const px=alongX?(sign<0?x0+.9:x1-.9):x;
   const pz=alongX?z:(sign<0?z0+.9:z1-.9);
   if(sampleGrade(px,pz,null,1.5))continue;
   const w=alongX?.46:2.4,d=alongX?2.4:.46;
   plainBox(MAT.trim,px-w,px+w,.15,.78,pz-d,pz+d,{uvm:2.2});
   STATIC.push({x0:px-w,x1:px+w,z0:pz-d,z1:pz+d,h:.78});
  }
  if(green&&!sampleGrade(x,z,null,2.5))TREES.push([x,z,1.14]);
 }
}
