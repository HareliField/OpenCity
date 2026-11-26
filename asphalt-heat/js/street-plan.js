// Ground-level right-of-way. One unit is a metre. +x is east and +z is south.
const STREET_DESIGN = {
 crossing: HALF + 4.55, crossWidth: 3.05, stopGap: 1.22,
 curb: .15, radius: 2.4, rampDepth: 1.85, rampHalf: 1, flare: 1.15,
 crown: .02, gutter: .45, humpLength: 3.66, humpHeight: .076
};
const ROAD_SECTIONS = {
 local: {rank:0, inner:2.65, parking:6.6, speed:8.4, limitMph:20, motorEdge:5.35},
 collector: {rank:1, inner:2.5, parking:6.6, speed:10.5, limitMph:25, motorEdge:5.35},
 avenue: {rank:2, inner:1.85, outer:5.42, speed:12.2, limitMph:30, motorEdge:7.25},
 waterfront: {rank:1, median:-2.05, speed:9.8, limitMph:25},
 viaduct: {rank:1, inner:5.98, speed:9.8, limitMph:25, motorEdge:7.55}
};
const STREET_NAMES = {
 ns:['Boundary Rd','Alder St','Juniper St','Union Ave','Verve St','Market St','Port Ave','Cypress St','Central Ave','King St','Palm St','Maple St','Grand Ave','Ridge Rd','Coastal Ave','Breakwater Way','Ocean Dr'],
 ew:['North Shore Rd','Cedar St','Ferry St','Broadway','Park St','Studio Blvd','Foundry St','Bay Ave','Ash St','Commerce St','Marina St','Harbor Way','Elm St','Terminal Ave','Dock St','Wharf St','Quay Rd']
};
const CARDINAL = [[0,1],[-1,0],[0,-1],[1,0]];
function streetSection(axis,line,block){
 if(axis==='ns' && line===15)return ROAD_SECTIONS.waterfront;
 if(axis==='ew' && line===11 && block>=6 && block<14)return ROAD_SECTIONS.viaduct;
 const avenues=axis==='ns'?[3,6,8,12,14]:[3,5,7,13];
 const collectors=axis==='ns'?[0,4,5,10,16]:[0,2,4,9,11,16];
 return avenues.includes(line)?ROAD_SECTIONS.avenue:
  collectors.includes(line)?ROAD_SECTIONS.collector:ROAD_SECTIONS.local;
}
function segmentSection(a,b){
 const horizontal=a[0]!==b[0];
 return horizontal?streetSection('ew',a[1],Math.min(a[0],b[0])):
  streetSection('ns',a[0],Math.min(a[1],b[1]));
}
function laneCenter(section,dx,dz,lane=0){
 // Signed distance to the driver's right. The waterfront centreline is offset.
 if(section===ROAD_SECTIONS.waterfront)return dz>0?3.75:-.35;
 return lane && section.outer ? section.outer : section.inner;
}
function parkingCenter(section,dz){
 if(section===ROAD_SECTIONS.waterfront)return dz>0?6.65:2.65;
 return section.parking;
}
function approachWidth(section,dz){
 if(section===ROAD_SECTIONS.waterfront)return dz>0?[2.05,5.45]:[-2.05,1.4];
 if(section===ROAD_SECTIONS.viaduct)return [4.4,section.motorEdge];
 return [0,section.motorEdge];
}
function hasApproach(i,j,dx,dz){
 const a=i-dx,b=j-dz;
 return a>=0 && a<=N && b>=0 && b<=N ||
  j===N && dz===-1 && typeof freightGateAt==='function' && freightGateAt(i*CELL);
}
function hasCrossing(i,j,dx,dz){
 return hasApproach(i,j,dx,dz) && (dx ? j>0 && j<N : i>0 && i<N);
}
function junctionControl(i,j){
 const ns=streetSection('ns',i,j===N?j-1:j);
 const ew=streetSection('ew',j,i===N?i-1:i);
 if((i===0 || i===N) && (j===0 || j===N))return 'bend';
 if(i===0 || i===N)return 'stop-ew';
 if(j===0 || j===N)return 'stop-ns';
 // The Palm Street diner corner has a protected crossing in the avenue reference.
 if(i===10&&j===10)return 'signal';
 if(ns.rank && ew.rank && !(j===11 && i>=6 && i<=14))return 'signal';
 if(ns.rank!==ew.rank)return ns.rank>ew.rank?'stop-ew':'stop-ns';
 if((i+j)%3===0)return 'all-stop';
 return (i+j)%2?'stop-ns':'stop-ew';
}
function mustStop(control,axis){return control==='all-stop' || control==='stop-'+axis;}
function stopLine(control){
 const width=control==='signal'?.61:.41;
 const inner=STREET_DESIGN.crossing+STREET_DESIGN.crossWidth/2+STREET_DESIGN.stopGap;
 return {inner,outer:inner+width};
}
// A 60-second two-phase controller. Each WALK leads the parallel green by 3 s.
// Clearance is 16 s, followed by a steady hand before the conflicting release.
const SIGNAL_GROUPS=8;
const signalGroup=(i,j)=>(i+2*j)%SIGNAL_GROUPS;
function phaseForGroup(group,time){
 const cycle=((time-group*6)%60+60)%60;
 function phase(t){
  return {vehicle:t<3?'R':t<25?'G':t<28?'Y':'R',
   ped:t<8?'walk':t<24?'clear':'wait',remaining:t>=8&&t<24?Math.ceil(24-t):0};
 }
 return {ns:phase(cycle),ew:phase((cycle+30)%60)};
}
function hasSpeedHump(axis,line,block){
 if(streetSection(axis,line,block)!==ROAD_SECTIONS.local)return false;
 const i=axis==='ns'?line:block,j=axis==='ns'?block:line;
 if(i<=0 || j<=0 || i>=N || j>=N)return false;
 if((i===13 || i===14) && j>=8 && j<=12)return false;
 return districtOf(i,j)==='suburb' && ((line+block)%3===0 || axis==='ns' && line===2 && block===4);
}
function segmentHeight(axis,line,block,along,lateral){
 if(along<HALF || along>CELL-HALF || Math.abs(lateral)>=HALF)return 0;
 if(axis==='ew' && line===11 && block>=5 && block<=14 ||
    axis==='ns' && (line===13 || line===14) && block>=8 && block<=12)return 0;
 const fade=clamp((Math.min(along,CELL-along)-16)/6,0,1);
 const across=Math.max(0,HALF-STREET_DESIGN.gutter-Math.abs(lateral));
 let y=across*STREET_DESIGN.crown*fade;
 const cut=utilityCut(line,block);
 if(cut)y+=.016*clamp((.65-Math.abs(along-cut))/.18,0,1)*clamp(across/.65,0,1);
 const half=STREET_DESIGN.humpLength/2,offset=(along-CELL/2)/half;
 if(Math.abs(offset)<1 && hasSpeedHump(axis,line,block)){
  // Sample the same eight parabolic chords that the road mesh and tyre physics use.
  const u=(offset+1)*4,k=Math.floor(u),a=(k-4)/4,b=a+.25;
  const rise=lerp(1-a*a,1-b*b,u-k);
  y+=STREET_DESIGN.humpHeight*rise*clamp((HALF-.5-Math.abs(lateral))/.65,0,1);
 }
 return y;
}
function sidewalkHeight(block,x,z){
 const u=Math.min(x-block.x0,block.x1-x),v=Math.min(z-block.z0,block.z1-z);
 const r=STREET_DESIGN.radius;
 if(u<r && v<r && Math.hypot(r-u,r-v)>r)return 0;
 const i=block.i+(x>(block.x0+block.x1)/2?1:0),j=block.j+(z>(block.z0+block.z1)/2?1:0);
 const dx=i===block.i?-1:1,dz=j===block.j?-1:1;
 function ramp(perp,along){
  return STREET_DESIGN.curb*clamp(perp/STREET_DESIGN.rampDepth+
   Math.max(0,Math.abs(along-(STREET_DESIGN.crossing-HALF))-STREET_DESIGN.rampHalf)/STREET_DESIGN.flare,0,1);
 }
 return Math.min(hasCrossing(i,j,0,dz) && !hasCurbExtension(i,j,0,dz)?ramp(u,v):STREET_DESIGN.curb,
  hasCrossing(i,j,dx,0) && !hasCurbExtension(i,j,dx,0)?ramp(v,u):STREET_DESIGN.curb);
}
function pavementHeight(x,z){
 if(x< -HALF || x>W+HALF || z< -HALF || z>W+HALF)return 0;
 const i=Math.round(x/CELL),j=Math.round(z/CELL),u=x-i*CELL,v=z-j*CELL;
 if(Math.abs(u)<=HALF && Math.abs(v)>HALF){
  const block=Math.floor(z/CELL);return segmentHeight('ns',i,block,z-block*CELL,u);
 }
 if(Math.abs(v)<=HALF && Math.abs(u)>HALF){
  const block=Math.floor(x/CELL);return segmentHeight('ew',j,block,x-block*CELL,v);
 }
 return 0;
}
function utilityCut(line,block){
 return (line*7+block*3)%5===1 ? 24+(block%3)*2 : 0;
}
// Corner extensions occupy the parking strip on selected retail and neighborhood approaches.
function hasCurbExtension(i,j,dx,dz){
 if(!hasCrossing(i,j,dx,dz) || i<1 || j<1 || i>=N || j>=N || j===11)return false;
 if(i>=13 && j>=8 && j<=12)return false;
 const section=segmentSection([i-dx,j-dz],[i,j]);
 if(!section.parking)return false;
 return i===4 && (j===4 || j===5) || districtOf(i,j)==='suburb' && (i+2*j)%3===0;
}
const EXTENSION_WIDTH=1.95;
