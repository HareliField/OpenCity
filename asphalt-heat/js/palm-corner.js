/* Four coastal corner buildings measured against the diner, shopfront and aerial photographs. */
const PALM_CORNER={buildings:[],receipts:[],materials:null,signs:new Map()};
function cornerMaterials(){
 if(PALM_CORNER.materials)return PALM_CORNER.materials;
 const finish=(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color:lin(color),roughness,metalness});
 const plaster=pbr('plaster',1,{rough:.89,ns:.36,color:0xe4ddd0,env:.47});
 const ivory=pbr('plaster',1.63,{rough:.88,ns:.28,color:0xdbd9c6,env:.47});
 const shadow=pbr('concrete',1.21,{rough:.90,ns:.4,color:0x928f81});
 return PALM_CORNER.materials={
  plaster,ivory,shadow,sash:finish(0x747e78,.48,.35),brass:finish(0x998d6d,.38,.6),
  green:finish(0x526b63,.64,.24),oxblood:finish(0x784045,.59,.17),dark:finish(0x3d403d,.64,.18),
  blinds:[finish(0xaca79b,.91),finish(0x87918a,.91),finish(0xb6b1a6,.92)],
  walls:[plaster,ivory,pbr('concrete',1.6,{rough:.85,ns:.30,color:0xd2d2bd})],
  linen:finish(0xcec7b1,.95),blanket:[0x7b8580,0x8d7a68,0x7e7779].map(c=>finish(c,.93)),
  ceiling:finish(0xcfc7b1,.93),ceramic:finish(0xd9d8ca,.27),canvas:finish(0x324f46,.89),
  storeFloor:pbr('tiles_dark',.81,{rough:.63,ns:.35,color:0xdddace,env:.37}),
  roof:pbr('concrete',2.8,{rough:.93,ns:.48,color:0x948e80,env:.28})
 };
}

function cornerPanel(text,bg,ink,menu=false){
 const key=[text,bg,ink,menu].join('|'),known=PALM_CORNER.signs.get(key);
 if(known)return known;
 const [c,g]=cvs(menu?384:1024,menu?512:160),w=c.width,h=c.height;
 g.fillStyle=bg;g.fillRect(0,0,w,h);
 g.strokeStyle=menu?'#9b957b':'#b8ae98';g.lineWidth=menu?4:3;g.strokeRect(7,6,w-14,h-12);
 g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
 if(menu){
  g.font='600 47px Georgia, serif';
  text.split('|').forEach((line,i)=>g.fillText(line,w/2,119+i*77,w*.84));
 }else{
  g.font=text==='24-Hour Diner'?'500 112px Arial, sans-serif':'600 '+(text.length>17?'101':'122')+'px Georgia, serif';
  g.fillText(text,w/2,h*.515,w*.91);
 }
 const material=new THREE.MeshStandardMaterial({map:ctex(c),roughness:.69,metalness:.055});
 PALM_CORNER.signs.set(key,material);return material;
}
function cornerWall(B,r,side,base,top,floor,spec){
 const m=cornerMaterials(),{matrix:M,width}=lotFace(r,side),half=width/2;
 const diner=spec.kind==='diner',arcade=spec.kind==='arcade';
 const publicSide=side===spec.front||side===spec.flank;
 const houseWall=arcade?m.plaster:spec.kind==='records'?m.walls[2]:m.ivory;
 const box=(mat,l,h,b,t,back,front)=>plainBox(mat,l,h,b,t,back,front,{M,uvm:1.6});
 const wall=(l,h,b,t)=>{
  if(h<=l||t<=b)return;
  box(houseWall,l,h,b,t,-.29,.022);
  addRoomCollider(B,M,l,h,-.022,.29,t,b);
 };
 const pitches=Math.max(4,Math.round(width/(floor?(arcade?4.8:3.5):5.85))),pitch=width/pitches;
 const frontDoor=new Set();
 if(!floor&&publicSide){
  if(side===spec.front){frontDoor.add(diner?1:pitches-2);frontDoor.add(diner?pitches-2:1);}
  else frontDoor.add(diner?pitches-2:Math.floor(pitches/2));
  rememberShopGlass(M,-half,half);
 }
 const sill=base+(floor?.79:publicSide?.43:1.03),lintel=top-(floor?.52:publicSide?.92:.66);
 for(let k=0;k<pitches;k++){
  const lo=-half+k*pitch,hi=lo+pitch,c=(lo+hi)/2,door=frontDoor.has(k);
  const win=door?.815:floor?(arcade?.742:pitch*.342):publicSide?pitch*.436:pitch*.267;
  const a=c-win,b=c+win;
  wall(lo,a,base,top);wall(b,hi,base,top);
  if(door){
   const head=base+2.51;
   wall(a,b,head,top);registerDoor(M,c,.076,base,1.57,2.45,'glass');
   for(const x of [a,b])box(m.sash,x-.035,x+.035,base,head,-.16,.034);
   box(m.sash,a-.035,b+.035,head-.048,head+.026,-.16,.035);
   continue;
  }
  wall(a,b,base,sill);wall(a,b,lintel,top);
  facadePlane(STREET.materials.glass,M,a+.030,b-.030,sill+.038,lintel-.03,-.196);
  addRoomCollider(B,M,a,b,.162,.211,lintel,sill,true);
  for(const x of [a+.022,b-.022])box(m.sash,x-.030,x+.030,sill,lintel,-.216,-.08);
  for(const h of [sill+.026,lintel-.027])box(m.sash,a,b,h-.031,h+.027,-.216,-.08);
  if(floor){
   for(const x of [c-.26*win,c+.33*win])box(m.sash,x-.023,x+.023,sill+.026,lintel-.027,-.21,-.157);
   box(m.sash,a,b,sill+(lintel-sill)*.56,sill+(lintel-sill)*.56+.028,-.21,-.154);
   const state=(k*19+floor*11+B.i*5+B.j+(side==='S'?2:side==='N'?6:4))%11;
   // Gap below each blind reveals the room. Open bays show the actual furniture through the glass.
   if(state<7){
    const drop=(lintel-sill)*(.16+.104*state),left=state%2?a+.06:c-.18*win,right=state%2?c+.31*win:b-.06;
    for(let h=lintel-.06;h>lintel-drop;h-=.098)box(m.blinds[(floor+k)%3],left,right,h-.075,h,-.382,-.348);
    box(m.shadow,left,right,lintel-drop-.024,lintel-drop+.013,-.396,-.344);
   }
   if(arcade)for(const x of [a-.144,b+.144])box(m.dark,x-.11,x+.11,sill,lintel,.029,.068);
  }else{
   for(let n=1;n<(publicSide?3:2);n++){
    const x=a+(b-a)*n/(publicSide?3:2);
    box(m.sash,x-.035,x+.035,sill,lintel,-.222,-.122);
   }
   box(m.sash,a,b,lintel-.40,lintel-.354,-.217,-.095);
  }
  box(m.shadow,a-.115,b+.115,sill-.099,sill+.030,-.216,.104);
  box(houseWall,a-.085,b+.085,lintel-.010,lintel+.083,-.19,.062);
 }
 if(floor){
  if(diner||!arcade){
   box(houseWall,-half-.035,half+.035,base-.10,base+.035,-.27,.081);
   if(floor===spec.floors-1)box(m.shadow,-half-.075,half+.075,top-.12,top-.034,-.31,.132);
  }
  return;
 }
 if(!publicSide)return;
 const strip=diner?m.green:arcade?m.shadow:spec.kind==='records'?m.dark:m.canvas;
 box(strip,-half-.075,half+.075,top-.916,top-.191,-.27,.34);
 box(m.sash,-half-.094,half+.094,top-.201,top-.132,-.26,.374);
 box(m.dark,-half-.075,half+.075,top-.942,top-.892,-.22,.366);
 const c=side===spec.front?(diner?-half+pitch*1.50:half-pitch*1.86):half-pitch*1.82;
 const signW=Math.min(diner?8.12:7.34,width*.35);
 const sign=cornerPanel(spec.shop,diner?'#813737':arcade?'#54483a':spec.kind==='records'?'#323533':'#385747','#efe6d6');
 box(diner?m.oxblood:m.dark,c-signW/2-.057,c+signW/2+.057,top-.891,top-.212,.338,.397);
 facadePlane(sign,M,c-signW/2,c+signW/2,top-.862,top-.239,.402);
 if(diner&&side===spec.front){
  const x=-half+pitch*2.74,mat=cornerPanel('BREAKFAST|LUNCH|DINNER','#40453e','#e3dac5',true);
  box(m.dark,x-.47,x+.47,.75,2.07,-.157,-.127);
  facadePlane(mat,M,x-.431,x+.431,.797,2.034,-.121);
 }
 if(arcade||spec.kind==='grocer'){
  const l=c-signW*.53,h=c+signW*.53,topY=top-1.00;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([l,topY,.05,h,topY,.05,h,topY-.37,1.17,l,topY-.37,1.17],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();g.applyMatrix4(M);addGeo(m.canvas,g,true);
  box(m.canvas,l,h,topY-.512,topY-.367,1.15,1.185);
  weatherCeilings.push({...lrect(M,l,h,-1.185,-.05),h:topY-.36});
  for(const u of [l+.1,h-.1]){
   const p=lpt(M,u,-1.15),q=lpt(M,u,-.058);
   worksBeam(m.sash,[q.x,topY-.82,q.z],[p.x,topY-.365,p.z],.016);
  }
 }
}

function cornerCounterSale(x,y,z,item,desc,price,heal){
 worksPanel(x,y,z,()=>'BUY '+item+' · $'+price,()=>{
  if(!cityPowerAt(x,z))return toast('Register offline',1500);
  if(player.cash<price)return toast('Insufficient cash',1300);
  player.cash-=price;player.hp=Math.min(100,player.hp+heal);
  PALM_CORNER.receipts.push({shop:item,price,at:time});
  if(PALM_CORNER.receipts.length>16)PALM_CORNER.receipts.shift();
  toast(desc+' · $'+price,1600);
 },1.43);
}

function furnishCornerShop(B,r,y,spec){
 const m=cornerMaterials(),cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2,nearNorth=spec.front==='N';
 const at=distance=>nearNorth?r.z0+distance:r.z1-distance;
 const yaw=nearNorth?Math.PI:0;
 const frontage=lotFace(r,spec.front);
 shopLightingRoom(frontage.matrix,-frontage.width/2,frontage.width/2,Math.min(16,frontage.depth),y);
 // Shop floor and counter stay clear of the front doors, staircase, lift and the public corridor.
 if(spec.kind==='diner'){
  for(const x of [r.x0+4.25,r.x0+9.56,r.x0+15.12,r.x0+20.43]){
   const z=r.z1-5.84;
   for(const s of [-1,1])worksModel('diner-booth',x,y,z+s*.881,[1.565,1.037,.627],s>0?Math.PI:0);
   worksModel('diner-table',x,y,z,[1.125,.914,.768]);
   worksModel('enamel-pendant',x,2.68,z,[.38,.26,.38],0,false);
   INTERIORS.emitters.push({x,y:2.78,z,floorY:y,cool:false});
   const lens=new THREE.SphereGeometry(.118,14,10);lens.scale(1,.94,1);lens.translate(x,2.661,z);
   addGeo(INTERIORS.materials.warm,lens,false);
  }
  const barX=r.x1-6.95,z=r.z1-10.35;
  worksSolid(worksRect(barX-3.86,barX+3.86,z-.425,z+.425),y,y+1.01,m.green);
  plainBox(m.brass,barX-3.89,barX+3.89,y+.995,y+1.03,z-.46,z+.46);
  plainBox(m.linen,barX-3.9,barX+3.9,y+1.03,y+1.065,z-.469,z+.469);
  for(const off of [-2.92,-1.75,-.57,.61])worksModel('diner-stool',barX+off,y,z+1.09,[.445,.719,.445]);
  worksModel('shop-register',barX+2.71,y+1.066,z,[.44,.38,.32],Math.PI,false);
  worksModel('diner-espresso',barX-1.57,y+1.066,z,[.68,.382,.426],0,false);
  cornerCounterSale(barX+2.71,y,z+1.11,'BREAKFAST','Eggs, toast and coffee',8,15);
  worksModel('patisserie-case',r.x1-5.36,y,z-2.56,[2.10,1.324,.85]);
  worksModel('grocery-cooler',r.x1-1.27,y,z-3.11,[1.38,2.21,.83],-Math.PI/2);
  // The public counter faces the booths. A tiled service wall hides the storeroom and apartment lobby.
  const back=r.z1-15.89;
  cornerFlatWall(B,r.x0+.29,r.x1-.29,back,y,r.x0+5.16);
  const face=new THREE.Matrix4().makeTranslation(barX,0,back+.075);
  plainBox(m.green,-4.89,4.54,y+.15,y+1.21,-.003,.041,{M:face});
  const menu=cornerPanel('EGGS|COFFEE|PIE','#4c5149','#e4d6b9',true);
  for(const dx of [-2.04,.18,2.4]){
   plainBox(m.dark,dx-.655,dx+.655,y+1.47,y+2.69,0,.127,{M:face});
   facadePlane(menu,face,dx-.606,dx+.606,y+1.518,y+2.643,.132);
  }
  // Ceramic wall base, suspended pendant cords and a second booth pair at the corner window.
  for(const [x0,x1] of [[r.x0+.31,r.x0+4.82],[r.x0+6.0,r.x1-.31]]){
   plainBox(m.green,x0,x1,y+.06,y+.98,back+.073,back+.115);
   plainBox(m.brass,x0,x1,y+.974,y+.996,back+.106,back+.126);
  }
  for(const x of [r.x0+4.25,r.x0+9.56,r.x0+15.12,r.x0+20.43])
   worksBeam(m.dark,[x,2.92,r.z1-5.84],[x,4.08,r.z1-5.84],.009);
  const ex=r.x0+3.49,ez=r.z1-11.44;
  for(const side of [-1,1])worksModel('diner-booth',ex+side*.897,y,ez,[1.565,1.037,.627],side>0?-Math.PI/2:Math.PI/2);
  worksModel('diner-table',ex,y,ez,[1.125,.914,.768],Math.PI/2);
  // Leave the west entrance into the dining room and the tenant entrance into the stair lobby unobstructed.
  worksFurniture(B,'counter',barX-2.13,y,z-3.34,3.30,.95,.67);
  buildBasin(barX-2.19,y,z-3.34);worksModel('bakery-counter',barX,y,z-4.59,[1.68,1.07,.74],Math.PI,true);
 }else{
  const x0=nearNorth?r.x0+17.7:r.x0+4.68;
  for(let k=0;k<3;k++){
   const x=x0+k*4.02,z=at(5.3);
   if(spec.kind==='records'){
    worksModel('record-browser',x,y,z,[1.0,1.055,.57],yaw);
    worksModel('record-browser',x,y,z+(nearNorth?1.74:-1.74),[1.0,1.055,.57],yaw+Math.PI);
   }else if(spec.kind==='grocer'){
    worksModel('produce-crate',x,y,z,[.69,.44,.46],yaw);
    worksModel('pantry-shelf',x+.33,y,at(7.89),[1.55,1.83,.52],yaw);
   }else{
    worksModel('diner-table',x,y,z,[1.125,.914,.768],yaw);
    for(const s of [-1,1])worksFurniture(B,'seat',x,y,z+s*.84,.50,.87,.49,s<0?0:Math.PI);
   }
   worksModel('enamel-pendant',x,2.73,z,[.32,.22,.32],0,false);
   INTERIORS.emitters.push({x,y:2.80,z,floorY:y,cool:spec.kind==='records'});
  }
  const x=r.x1-3.69,z=at(9.69),sign=nearNorth?-1:1;
  worksFurniture(B,'counter',x,y,z,3.32,.95,.73,yaw);
  worksModel('shop-register',x,y+.955,z,[.43,.37,.29],Math.PI+yaw,false);
  if(spec.kind==='records'){
   worksModel('record-browser',x-.61,y,at(13.02),[1.03,1.06,.56],yaw);
   cornerCounterSale(x,y,z+sign*.99,'LP','Coastal Vinyl LP',14,0);
  }else if(spec.kind==='grocer'){
   worksModel('grocery-cooler',r.x1-1.19,y,at(13.11),[1.40,2.14,.82],-Math.PI/2);
   cornerCounterSale(x,y,z+sign*.99,'FRUIT','Seasonal fruit',5,8);
  }else{
   worksModel('patisserie-case',x-3.39,y,z,[2.10,1.33,.84],yaw);
   cornerCounterSale(x,y,z+sign*.99,'COFFEE','House coffee',4,5);
  }
 }
 const newsX=spec.flank==='E'?r.x1-.84:r.x0+1.12,newsZ=nearNorth?r.z0-.74:r.z1+.74;
 worksModel('corner-news-vendor',newsX,.16,newsZ,[.593,.971,.419],yaw);
 const point=nearNorth?newsZ-.56:newsZ+.56;
 worksPanel(newsX,.16,point,()=>'NEWSPAPER · $1',()=>{
  if(player.cash<1)return toast('Insufficient cash',1200);
  player.cash--;toast('The Coast Chronicle · $1',1500);
 },.94);
 // Palms along the flanking sidewalk are entirely inside the lot, with clear entries on both faces.
 for(const z of [cz-8.47,cz+6.83]){
  const x=spec.flank==='E'?r.x1+1.02:r.x0-1.02;
  if(spec.kind==='arcade')TREES.push([x,z,1.10]);else PALMS.push([x,z,1.01+(z>cz?.07:0)]);
 }
}

function cornerFlatWall(B,x0,x1,z,y,doorX){
 const m=cornerMaterials(),M=new THREE.Matrix4().makeTranslation(0,0,z),gap=.626,head=y+2.17;
 for(const [a,b] of [[x0,doorX-gap],[doorX+gap,x1]]){
  if(b>a)worksSolid(worksRect(a,b,z-.070,z+.070),y,y+3.91,m.plaster);
 }
 worksSolid(worksRect(doorX-gap,doorX+gap,z-.07,z+.07),head,y+3.91,m.plaster);
 registerDoor(M,doorX,0,y,1.195,2.11,'wood');
}
function furnishCornerFlats(B,r,y,floor){
 const m=cornerMaterials(),mx=(r.x0+r.x1)/2,mz=(r.z0+r.z1)/2;
 const rooms=[worksRect(r.x0+.32,mx-.077,mz+1.30,r.z1-.32),
              worksRect(mx+.077,r.x1-.32,mz+1.30,r.z1-.32),
              worksRect(r.x1-15.44,r.x1-.32,r.z0+.32,mz-1.44)];
 worksSolid(worksRect(mx-.077,mx+.077,mz+1.27,r.z1-.26),y,y+3.91,m.plaster);
 worksSolid(worksRect(r.x1-15.58,r.x1-15.44,r.z0+.25,mz-1.44),y,y+3.91,m.plaster);
 for(const [k,unit] of rooms.entries()){
  const south=k<2,face=south?unit.z0:unit.z1,door=unit.x0+3.11;
  cornerFlatWall(B,unit.x0,unit.x1,face,y,door);
  const bedX=unit.x1-2.50,bedZ=south?unit.z1-2.0:unit.z0+2.02;
  worksSolid(worksRect(bedX-.74,bedX+.74,bedZ-.989,bedZ+.989),y,y+.40,MAT.wood);
  plainBox(m.linen,bedX-.746,bedX+.746,y+.40,y+.58,bedZ-.995,bedZ+.995);
  plainBox(m.blanket[(floor+k)%3],bedX-.753,bedX+.753,y+.579,y+.609,bedZ-.997,bedZ+.39);
  for(const s of [-1,1])plainBox(m.linen,bedX+s*.345-.28,bedX+s*.345+.28,y+.58,y+.70,bedZ+.60,bedZ+.902);
  const sinkX=unit.x1-1.43,sinkZ=south?face+1.62:face-1.61;
  worksFurniture(B,'counter',sinkX,y,sinkZ,2.16,.95,.68);buildBasin(sinkX-.34,y,sinkZ);
  worksFurniture(B,'reading-table',unit.x0+4.89,y,bedZ,1.26,.76,.81);
  worksFurniture(B,'seat',unit.x0+4.89,y,bedZ+.95,.49,.89,.53);
  worksFurniture(B,'bookcase',unit.x0+1.2,y,south?unit.z1-.56:unit.z0+.53,1.46,1.72,.41,south?Math.PI:0);
  // A separate bathroom opens off the unit vestibule. The return wall keeps the WC clear of the kitchen and entry.
  const bathX=unit.x1-3.58,bathZ=south?face+4.72:face-4.72,doorZ=bathZ+(south?.84:-.84);
  worksSolid(worksRect(bathX,unit.x1,bathZ-.06,bathZ+.06),y,y+3.91,m.plaster);
  const end=bathZ+(south?2.50:-2.50);
  for(const [a,b] of [[Math.min(bathZ,end),doorZ-.57],[doorZ+.57,Math.max(bathZ,end)]]){
   if(b>a)worksSolid(worksRect(bathX-.06,bathX+.06,a,b),y,y+3.91,m.plaster);
  }
  installCistern(B,unit.x1-.85,y,bathZ+(south?.67:-.67),south?0:Math.PI);
  const x=unit.x0+5.92,z=(unit.z0+unit.z1)/2;
  worksModel('enamel-pendant',x,y+3.22,z,[.32,.21,.32],0,false);
  INTERIORS.emitters.push({x,y:y+3.29,z,floorY:y,cool:false});
 }
}

function finishPalmCorner(r,spec,top){
 const m=cornerMaterials(),diner=spec.kind==='diner';
 for(const side of ['S','N','E','W']){
  const {matrix:M,width}=lotFace(r,side),span=width/2;
  const arc=spec.kind==='arcade';
  const ranges=arc&&(side==='E'||side==='W')?(side==='E'?[[-span,0,.30],[0,span,.90]]:[[-span,0,.90],[0,span,.30]]):
   [[-span,span,arc&&side==='S'?.30:.90]];
  for(const [a,b,cap] of ranges){
   plainBox(m.shadow,a-.042,b+.042,top+cap-.104,top+cap-.005,-.187,.076,{M,uvm:2});
   plainBox(m.ivory,a-.075,b+.075,top+cap-.005,top+cap+.043,-.21,.106,{M,uvm:2});
  }
 }
 if(spec.kind==='arcade'){
  // Hipped tile roof over the southern wing. The north stair landing and lift lead to the open terrace.
  const x0=r.x0-.48,x1=r.x1+.48,z0=r.z0+17.06,z1=r.z1+.52,half=(z1-z0)/2;
  const ridgeZ=(z0+z1)/2,eave=top+.354,rise=3.93;
  const points=[[x0,eave,z0],[x1,eave,z0],[x1,eave,z1],[x0,eave,z1],
   [x0+half,eave+rise,ridgeZ],[x1-half,eave+rise,ridgeZ]];
  const faces=[[0,4,5,1],[1,5,2],[2,5,4,3],[3,4,0]];
  for(const ids of faces){
   const g=new THREE.BufferGeometry(),p=ids.map(i=>points[i]),uv=p.flatMap(([x,h,z])=>[x/9.0,z/8.8+h*.018]);
   g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   g.setIndex(ids.length===3?[0,2,1]:[0,2,1,0,3,2]);g.computeVertexNormals();
   if(g.attributes.normal.getY(0)<0){g.setIndex(ids.length===3?[0,1,2]:[0,1,2,0,2,3]);g.computeVertexNormals();}
   addGeo(gardenMaterials().tile,g,true);
  }
  // Courses on all four slopes have real overhangs and lap joints. Cut hip ends stay under the ridge flashing.
  const pitch=.254,row=.314,slope=Math.atan2(rise,half);
  for(const side of ['N','S','W','E']){
   const alongX=side==='N'||side==='S',positive=side==='N'||side==='W';
   const end=alongX?(positive?z0:z1):(positive?x0:x1);
   const left=alongX?x0:z0,right=alongX?x1:z1;
   for(let distance=.144;distance<half;distance+=row){
    const first=left+distance,last=right-distance,per=Math.max(1,Math.round((last-first)/pitch));
    for(let k=0;k<per;k++){
     const wide=(last-first)/per,at=first+(k+.5)*wide,v=end+(positive?distance:-distance);
     const x=alongX?at:v,z=alongX?v:at,y=eave+rise*distance/half+.006;
     const yaw=alongX?(positive?0:Math.PI):(positive?Math.PI/2:-Math.PI/2);
     const tint=[0xb9a18e,0xbaa094,0xc8b798,0xc7ada1,0xcdbaa9][(k*17+Math.round(distance*100))%5];
     registerStreetFitting('mission-pantile',x,y,z,[wide,.095,.391],yaw,{pitch:-slope,tint,reach:58});
    }
   }
  }
  const lawn=worksRect(r.x0-6.10,r.x0-.42,r.z1-7.02,r.z1+1.30);
  worksSlab(lawn,.42,m.shadow);
  topQuad(MAT.grass,lawn.x0+.12,lawn.x1-.12,.427,lawn.z0+.12,lawn.z1-.12,2.8,null,false);
  TREES.push([lawn.x1-2.62,lawn.z1-2.48,1.59,'mature']);
  const forecourt=worksRect(r.x0+11.79,r.x0+19.03,r.z1+.51,r.z1+3.15);
  worksSolid(forecourt,.15,.61,m.plaster);
  topQuad(MAT.grass,forecourt.x0+.095,forecourt.x1-.095,.617,forecourt.z0+.095,forecourt.z1-.095,2.4,null,false);
  TREES.push([r.x0+16.10,r.z1+1.86,1.51,'golden']);
  const verts=[...points,...points.slice(0,4).map(([x,,z])=>[x,top+.265,z])].map(p=>new V3(...p));
  const hull=[...faces,[6,7,8,9],...[0,1,2,3].map(i=>[i,(i+1)%4,(i+1)%4+6,i+6])];
  const center=new V3((x0+x1)/2,eave+.38,ridgeZ);
  const planes=hull.map(indices=>{
   const plane=new THREE.Plane().setFromCoplanarPoints(...indices.slice(0,3).map(i=>verts[i]));
   if(plane.distanceToPoint(center)>0){indices.reverse();plane.negate();}
   return plane;
  });
  const roof={x0,x1,z0,z1,y0:top+.265,h:eave+rise,walkIgnore:true,convex:{verts,hull,planes,center}};
  STATIC.push(roof);
  CITY_WORKS.pitchedRoofs.push({...roof,eave,rise,run:half});
  // Enclose the raised roof wing below eaves. Reachable terrace ends at this physical wall.
  worksSolid(worksRect(r.x0,r.x1,z0,z0+.20),top,top+1.58,m.plaster);
  for(const [ax,az,bx,bz] of [[x0,z0,x0+half,ridgeZ],[x0,z1,x0+half,ridgeZ],[x1,z1,x1-half,ridgeZ],
                              [x1,z0,x1-half,ridgeZ],[x0+half,ridgeZ,x1-half,ridgeZ]]){
   const high=Math.abs(az-ridgeZ)<.01?eave+rise:eave;
   worksBeam(MAT.trim,[ax,high+.035,az],[bx,eave+rise+.035,bz],.062);
  }
 }
 if(!diner){
  for(const x of [r.x1-9.08,r.x1-6.50])for(const dz of [3.12,4.99])
   worksModel('coastal-solar-array',x,top,r.z0+dz,[1.98,.54,1.58],0,true);
 }
 PALM_CORNER.buildings.push({name:spec.shop,r,levels:spec.floors+1,front:spec.front});
}

