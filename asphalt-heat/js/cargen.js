/* ================= procedural car bodies (lofted surfaces) ================= */
const CARSPEC={
 sedan:{L:4.7,W:1.84,hb:.93,r:1.43,hood:1.25,tr:.85,ws:.8,rg:.75,nose:.68,tail:.9,gc:.2,wr:.335,tum:.76,mass:1450,F:9000,max:38,val:500,hp:100,k:26,gripF:1.3,gripR:1.45},
 sport:{L:4.52,W:1.88,hb:.84,r:1.25,hood:1.39,tr:.54,ws:.82,rg:.98,nose:.63,tail:.85,gc:.17,wr:.345,tum:.74,mass:1350,F:15500,max:54,val:1400,hp:90,k:34,gripF:1.55,gripR:1.65},
 hatch:{L:4.1,W:1.78,hb:.93,r:1.47,hood:1.0,tr:.14,ws:.72,rg:.55,nose:.7,tail:.95,gc:.19,wr:.32,tum:.78,mass:1200,F:7200,max:34,val:350,hp:85,k:26,gripF:1.3,gripR:1.4,fwd:1},
 suv:{L:4.85,W:1.96,hb:1.1,r:1.78,hood:1.2,tr:.06,ws:.7,rg:.4,nose:.92,tail:1.08,gc:.27,wr:.385,tum:.8,mass:2100,F:11500,max:36,val:800,hp:150,k:24,gripF:1.25,gripR:1.35,awd:1},
 van:{L:5.6,W:2.06,hb:1.22,r:2.32,hood:.75,tr:.02,ws:.6,rg:.1,nose:1.0,tail:1.2,gc:.24,wr:.38,tum:.9,mass:2800,F:11000,max:32,val:900,hp:170,k:26,gripF:1.2,gripR:1.3}};
CARSPEC.taxi=Object.assign({},CARSPEC.sedan,{val:400});
CARSPEC.police=Object.assign({},CARSPEC.sedan,{F:13500,max:48,val:1600,hp:140,mass:1650,gripF:1.5,gripR:1.6});
CARSPEC.amb=Object.assign({},CARSPEC.van,{val:1000});
CARSPEC.swat=Object.assign({},CARSPEC.van,{mass:4200,F:19000,max:34,val:2600,hp:360,r:2.2});
for(const k in CARSPEC){const s=CARSPEC[k];s.type=k;s.b=s.hb;s.com=s.gc+.3+(s.r-1.4)*.12;s.rest=.34;s.roll=.55;s.brake=s.mass*.04;s.wb=s.L*.31;}
const CARGEO={};
function carProfile(s){const h=s.L/2;const P=[[-h,s.tail-.3],[-h+.04,s.tail-.03],[-h+Math.max(s.tr,.1),s.hb+.03],[-h+Math.max(s.tr,.1)+s.rg,s.r-.02],[(-h+s.tr+s.rg+h-s.hood-s.ws)/2,s.r],[h-s.hood-s.ws,s.r-.03],[h-s.hood,s.hb+.01],[h-.2,s.nose],[h-.03,s.nose-.07],[h,s.nose-.3]];
 const lin=z=>{if(z<=P[0][0])return P[0][1];for(let i=1;i<P.length;i++)if(z<=P[i][0]){const a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*(z-a[0])/(b[0]-a[0]||1e-6);}return P[P.length-1][1];};
 const top=z=>(lin(z-.1)+2*lin(z-.05)+3*lin(z)+2*lin(z+.05)+lin(z+.1))/9;
 const beltLine=z=>s.hb-.035*z/h;
 const plan=z=>{const f=Math.min(Math.abs(z)/h,.987),n=s.type==='sport'?30:z>0?16:13;return Math.pow(1-Math.pow(f,n),1/n);};
 const bot=z=>{const a=Math.abs(z),t=clamp((a-s.wb-.42)/(h-s.wb-.42),0,1);return s.gc+.13*t*t;};
 const arch=z=>{let y=0;for(const zc of[s.wb,-s.wb]){const d=z-zc,R=s.wr+.075;if(Math.abs(d)<R)y=Math.max(y,s.wr+Math.sqrt(R*R-d*d));}return y;};
 /* half cross-section: 11 points [x,y] from roof centre to underside centre */
 const sect=z=>{const yT=top(z),bl=Math.min(beltLine(z),yT-.07),g=clamp((yT-bl-.07)/.22,0,1),wB=s.W/2*plan(z),wT=wB*(.91+(s.tum-.91)*g),yb=Math.min(bot(z),bl-.3),mid=yb+(bl-yb)*.5;
  const pts=[[0,yT+.018*g+.008],[wT*.5,yT+.012*g+.004],[wT*.86,yT-.012],[wT,yT-.045],[wB*.985,bl+.012],[wB,bl-.05],[wB,mid],[wB*.985,yb+.15],[wB*.93,yb+.03],[wB*.5,yb],[0,yb]];
  const ay=arch(z);if(ay>0){const lim=Math.max(bl-.1,yb+.2);for(let i=5;i<11;i++)pts[i][1]=Math.max(pts[i][1],Math.min(ay,lim));}
  const open=s.form && fleetSection(s,z,pts,wB);
  return{pts,g:open?0:g,yT,bl,wB,open};};
 return{sect,top,plan,beltLine,h};}
function carGeo(type){if(CARGEO[type])return CARGEO[type];const s=CARSPEC[type],pr=carProfile(s),h=pr.h;
 const pos=[],uv=[],idx=[[],[],[],[],[],[]];/* 0 paint 1 glass 2 dark 3 head 4 tail 5 plate */
 const dz=QUALITY.level>=2?.065:.1,N=Math.round(s.L*.997/dz),K=20;const zs=[];for(let i=0;i<=N;i++)zs.push(-h*.997+i*(s.L*.997)/N);
 const secs=zs.map(z=>pr.sect(z));
 for(let i=0;i<=N;i++){const p=secs[i].pts;for(let k=0;k<K;k++){const j=k<=10?k:20-k,sg=k<=10?1:-1;pos.push(sg*p[j][0],p[j][1],zs[i]);uv.push((zs[i]+h)/s.L,p[j][1]/2.4);}}
 const zg0=-h+Math.max(s.tr,.1),zg1=zg0+s.rg,zg3=h-s.hood,zg2=zg3-s.ws,zB=(zg1+zg2)/2+.08;
 for(let i=0;i<N;i++){const zc=(zs[i]+zs[i+1])/2,g=(secs[i].g+secs[i+1].g)/2;
  for(let k=0;k<K;k++){const k2=(k+1)%K,a=i*K+k,b=i*K+k2,c=(i+1)*K+k2,d=(i+1)*K+k;const j=k<10?k:19-k;/* j: segment index 0..9 on half ring */
   let m=0;
   if(j>=8 || secs[i].open && j<2)m=2;
   else if(g>.6){
    if(j===3){const pillar=Math.abs(zc-zB)<.055||zc<zg0+.22||zc>zg3-.2||(type==='van'||type==='amb'||type==='swat')&&zc<zg2-1.5;if(!pillar)m=1;}
    else if(j<=1&&((zc>zg2+.04&&zc<zg3-.06)||(zc>zg0+.08&&zc<zg1-.04&&s.rg>.3)))m=1;
    else if(j===2&&((zc>zg2+.1&&zc<zg3-.1)||(zc>zg0+.14&&zc<zg1-.1&&s.rg>.3)))m=1;}
   if(k<10)idx[m].push(a,d,b,b,d,c);else idx[m].push(a,d,b,b,d,c);}}
 /* end caps */
 for(const[i,front]of[[N,1],[0,0]]){const base=pos.length/3;const p=secs[i].pts;let cy=0;for(let k=0;k<K;k++)cy+=pos[(i*K+k)*3+1];cy/=K;pos.push(0,cy,zs[i]);uv.push(front?1:0,cy/2.4);
  for(let k=0;k<K;k++){const a=i*K+k,b=i*K+(k+1)%K;if(s.form)idx[0].push(base,front?b:a,front?a:b);else idx[2].push(base,a,b,base,b,a);}}
 /* surface patches: lights, grille, plates */
 const quadStrip=(m,pl,y0,y1)=>{const b0=pos.length/3;pl.forEach((p,i)=>{pos.push(p[0],y0,p[1],p[0],y1,p[1]);uv.push(i/(pl.length-1),0,i/(pl.length-1),1);});for(let i=0;i<pl.length-1;i++){const a=b0+i*2;idx[m].push(a,a+2,a+1,a+1,a+2,a+3);}};
 const yN=s.nose,yR=s.tail;
 const flat=(m,x0,x1,y0,y1,z,front)=>{const b0=pos.length/3;pos.push(x0,y0,z,x1,y0,z,x0,y1,z,x1,y1,z);if(m===5&&!front)uv.push(1,0,0,0,1,1,0,1);else uv.push(0,0,1,0,0,1,1,1);if(front)idx[m].push(b0,b0+1,b0+2,b0+2,b0+1,b0+3);else idx[m].push(b0,b0+2,b0+1,b0+1,b0+2,b0+3);};
 const zf=h*.997+.023,W2=s.W/2,coupe=type==='sport';
 if(!s.form)for(const sx of [1,-1]){
  const head=[sx*W2*(coupe?.45:.43),sx*W2*.88];
  const tail=[sx*W2*(coupe?.34:.44),sx*W2*.89];
  const a=Math.min(...head),b=Math.max(...head),c=Math.min(...tail),d=Math.max(...tail);
  flat(2,a-.028,b+.028,yN-.218,yN-.052,zf-.006,1);
  flat(3,a,b,yN-.19,yN-.071,zf+.007,1);
  flat(2,c-.025,d+.025,yR-.23,yR-.07,-zf+.004,0);
  flat(4,c,d,yR-.215,yR-.089,-zf-.008,0);
 }
 if(!s.form)flat(2,-W2*.43,W2*.43,yN-.215,yN-.11,zf-.003,1);
 flat(2,-W2*.67,W2*.67,s.gc+.083,s.gc+.165,zf-.010,1);
 flat(2,-W2*.91,W2*.91,yR-.357,yR-.235,-zf-.010,0);
 flat(5,-.25,.25,s.gc+.118,s.gc+.225,zf+.017,1);
 flat(5,-.26,.26,yR-.385,yR-.263,-zf-.023,0);
 /* mirrors + handles */
 const box=(m,cx,cy,cz,sx,sy,sz)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(cx,cy,cz);const b0=pos.length/3,P=g.attributes.position.array,I=g.index.array;for(let i=0;i<P.length;i++)pos.push(P[i]);for(let i=0;i<P.length/3;i++)uv.push(.5,.5);for(let i=0;i<I.length;i++)idx[m].push(I[i]+b0);g.dispose();};
 if(s.form)fleetTrim(s,pr,zf,flat,box,pos,uv,idx);
 const zm=zg3-.18,sm=pr.sect(zm);
 for(const sx of [1,-1]){
  box(2,sx*(sm.wB+.06),sm.bl+.065,zm,.14,.083,.17);
  box(1,sx*(sm.wB+.06),sm.bl+.068,zm-.084,.112,.055,.011);
  box(2,sx*s.W*.476,s.hb-.17,zB-.19,.022,.025,.16);
 }
 box(2,0,s.gc+.041,zf-.071,s.W*.88,.061,.20);
 box(2,0,s.gc+.11,-zf+.09,s.W*.89,.115,.20);
 if(coupe){
  box(2,0,yR-.023,-h+.293,s.W*.83,.034,.215);
  for(const sx of [-1,1]){
   box(2,sx*s.W*.417,s.gc+.098,-zf-.024,.13,.06,.092);
   box(2,sx*s.W*.426,s.gc+.242,zf-.02,.167,.04,.058);
  }
 }

 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 const all=[];let st=0;for(let m=0;m<6;m++){geo.addGroup(st,idx[m].length,m);for(const v of idx[m])all.push(v);st+=idx[m].length;}
 geo.setIndex(all);geo.computeVertexNormals();geo.computeBoundingSphere();
 /* per-type livery/seam texture key data */
 return CARGEO[type]={geo,s,zg0,zg1,zg2,zg3,zB,pr};}
/* ---- materials ---- */
const CARTEX={};
function carSeamTex(type,livery){const key=type+livery;if(CARTEX[key])return CARTEX[key];const G=carGeo(type),s=G.s,h=s.L/2;const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');
 const X=z=>(z+h)/s.L*1024,Y=y=>512-y/2.4*512;g.fillStyle='#fff';g.fillRect(0,0,1024,512);
 const legends=[];
 const legend=(word,x,y)=>legends.push({word,x,y,ink:g.fillStyle,font:g.font});
 if(livery==='police'){g.fillStyle='#16181c';g.fillRect(X(G.zg0-.3),0,X(G.zg3+.25)-X(G.zg0-.3),512);g.fillStyle='#fff';g.fillRect(X(G.zB-1.02),Y(s.hb-.02),X(G.zB+1.0)-X(G.zB-1.02),Y(.3)-Y(s.hb-.02));
  g.fillStyle='#1c3f94';g.fillRect(0,Y(.62),1024,9);g.fillStyle='#d8b23a';g.fillRect(0,Y(.62)+11,1024,3);g.font='bold 30px Anton, Impact, sans-serif';g.fillStyle='#1c3f94';legend('POLICE',X(G.zB-.5),Y(.72));legend('POLICE',X(G.zB+.55),Y(.72));}
 if(livery==='taxi'){g.fillStyle='#111';for(let k=0;k<40;k++){if(k%2)g.fillRect(X(G.zB-1)+k*10,Y(.66),10,7);else g.fillRect(X(G.zB-1)+k*10,Y(.66)+7,10,7);}g.font='bold 26px Anton, Impact, sans-serif';legend('TAXI',X(G.zB+.5),Y(.42));}
 if(livery==='swat'){g.fillStyle='#16191d';g.fillRect(0,0,1024,512);g.font='bold 54px Anton, Impact, sans-serif';g.fillStyle='#cfd3d8';legend('S.W.A.T',X(-.9),Y(1.35));}
 if(livery==='amb'){g.fillStyle='#d42626';g.fillRect(0,Y(1.0),1024,16);g.fillRect(0,Y(.62),1024,8);g.font='bold 44px Anton, Impact, sans-serif';g.fillStyle='#d42626';legend('AMBULANCE',X(-.9),Y(1.5));g.fillRect(X(-2.2)-9,Y(1.75),18,58);g.fillRect(X(-2.2)-29,Y(1.75)+20,58,18);}
 g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=2.2;const door=(z0,z1)=>{g.beginPath();g.moveTo(X(z0),Y(s.hb));g.lineTo(X(z0),Y(s.gc+.17));g.lineTo(X(z1),Y(s.gc+.17));g.lineTo(X(z1),Y(s.hb));g.stroke();g.fillStyle='rgba(0,0,0,.5)';g.fillRect(X(z0)+6,Y(s.hb-.1),24,5);};
 const van=type==='van'||type==='amb'||type==='swat';
 door(G.zB-.02,G.zg3-.12);if(!van&&type!=='sport'&&s.doors!==2)door(Math.max(G.zg0+.25,-s.wb+.4),G.zB-.06);if(van)door(G.zB-1.6,G.zB-.4);
 g.beginPath();g.moveTo(X(G.zg3+.05),Y(pr(G,G.zg3+.05)));g.lineTo(X(G.zg3+.05),Y(s.hb-.2));g.stroke();
 const gr=g.createLinearGradient(0,Y(s.gc+.5),0,Y(s.gc));gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.4)');g.fillStyle=gr;g.fillRect(0,Y(s.gc+.5),1024,300);
 let image=c;
 if(legends.length){
  // The same longitudinal coordinate reads in opposite directions from the two pavements.
  const [atlas,flank]=cvs(c.width,c.height*2);
  for(const offset of [0,c.height]){
   flank.drawImage(c,0,offset);
   for(const {word,x,y,ink,font} of legends){
    flank.save();flank.translate(x,y+offset);flank.scale(offset===0?-1:1,1);
    flank.font=font;flank.fillStyle=ink;flank.textAlign='center';flank.fillText(word,0,0);flank.restore();
   }
  }
  image=atlas;
 }
 const t=new THREE.CanvasTexture(image);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return CARTEX[key]=t;}
function pr(G,z){return G.pr.top(z);}
const CARMATS={},carColors=[0x8f1420,0x16306b,0xdfe3e6,0x15171a,0x5c6268,0x0d4a30,0xb78b1f,0x41185a,0xb5480c,0x6f8191,0x6e1730,0xf4f4f2,0x0b0b0c,0x1f5a78,0x9aa3ab,0x7a2f17];
const glassMat=new THREE.MeshStandardMaterial({color:0x05080b,roughness:.13,metalness:.56,envMapIntensity:.84});
const roadsterGlass=new THREE.MeshStandardMaterial({color:0xb6c9ce,roughness:.12,metalness:.07,transparent:true,opacity:.13,depthWrite:false});
const darkMat=new THREE.MeshStandardMaterial({color:0x0c0c0d,roughness:.55,metalness:.3,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const LENS={headOn:new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.05,1.7),polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),headOff:new THREE.MeshStandardMaterial({color:0xcfd6dc,roughness:.1,metalness:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 tailOn:new THREE.MeshBasicMaterial({color:new THREE.Color(.75,.03,.02),polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),tailBrake:new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,.12,.06),polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),tailOff:new THREE.MeshStandardMaterial({color:0x3a0606,roughness:.15,metalness:.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})};
function initCarLenses(){
 for(const names of [['headOn','headOff'],['tailOn','tailBrake','tailOff']]){
  const [canvas,g]=cvs(128,48);
  const tail=names.length===3;
  const color=g.createLinearGradient(0,0,0,48);
  color.addColorStop(0,tail?'#58231c':'#626060');
  color.addColorStop(.18,tail?'#ffdfcc':'#dce0e0');
  color.addColorStop(.58,tail?'#fae8df':'#ffffff');
  color.addColorStop(1,tail?'#77706d':'#73706c');
  g.fillStyle='#282829';
  g.fillRect(0,0,128,48);
  g.fillStyle=color;
  g.fillRect(3,3,122,42);
  g.fillStyle='rgba(35,30,26,.27)';
  for(let x=7;x<125;x+=tail?4:6)g.fillRect(x,3,1,42);
  g.fillRect(tail?88:34,3,2,42);
  g.fillRect(3,36,122,2);
  const map=ctex(canvas);
  for(const name of names)LENS[name].map=map;
 }
}

function carPlateMat(){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='#f3f1e4';g.fillRect(0,0,256,64);g.strokeStyle='#223';g.lineWidth=4;g.strokeRect(3,3,250,58);g.fillStyle='#1a2a55';g.font='bold 44px Anton, Impact, monospace';g.textAlign='center';g.textBaseline='middle';const plate='AH '+PoliceDepartment.plateSerial++;g.fillText(plate,128,37);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:t,roughness:.5,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});m.userData.plate=plate;return m;}
function carPaint(type,color,livery){const k=type+color+livery;if(CARMATS[k])return CARMATS[k];const M=QUALITY.physical?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
 const pigment=new THREE.Color(color).convertSRGBToLinear(),white=Math.min(pigment.r,pigment.g,pigment.b)>.69;
 if(white)pigment.multiplyScalar(.77);
 const matte=livery==='swat',map=carSeamTex(type,livery);
 const m=new M({color:pigment,map,roughness:matte?.6:.29,metalness:matte?.2:white?.22:.46,envMapIntensity:1.02});
 m.userData.flankAtlas=map.image.height===1024;
 if(QUALITY.physical){m.clearcoat=matte?0:.90;m.clearcoatRoughness=.16;}return CARMATS[k]=m;}
const burntMat=new THREE.MeshStandardMaterial({color:0x100e0d,roughness:1});
function coatVehicle(material,snowDepth){
 const m=material.clone();
 m.onBeforeCompile=sh=>{
  sh.uniforms.uPanelSnow=snowDepth;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPanel;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvPanel=position;');
  if(material.userData.flankAtlas){
   const uv='vec2(vUv.x,.5*vUv.y+.5*step(0.,vPanel.x))';
   sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace(/\bvUv\b/g,uv));
  }
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPanel;uniform float uPanelSnow;'+WETCODE)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float panelSnow=0.;
    if(uPanelSnow>.005){
     float up=inverseTransformDirection(normal,viewMatrix).y;
     float dust=fbm2(vPanel.xz*3.7+vPanel.y*1.8);
     panelSnow=smoothstep(.075,.78,uPanelSnow*(.51+.64*smoothstep(.38,.90,up))+(dust-.5)*.37)*smoothstep(.24,.83,up);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.83,.91)*(.86+.13*dust),panelSnow);
     roughnessFactor=mix(roughnessFactor,.92,panelSnow);metalnessFactor*=1.-panelSnow;
    }`)
   .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef CLEARCOAT\nmaterial.clearcoat*=1.-panelSnow;\n#endif');
 };
 m.customProgramCacheKey=()=>material.userData.flankAtlas?'snow-on-lettered-bodywork':'snow-on-bodywork';
 return m;
}
/* Wheel faces share one atlas and draw call. Diameters are representative street trims. */
const WHEEL_TRIMS=[
 ['sedan',16,'split',5,5,.205],['civic',17,'split',5,5,.215],['corolla',16,'steel',12,5,.205],
 ['prius',17,'aero',5,5,.205],['golf',18,'blade',5,5,.225],['mini',16,'spoke',8,4,.195],
 ['mustang',19,'split',5,5,.255],['miata',17,'spoke',8,4,.205],['nineeleven',20,'split',10,5,.255],
 ['volvo240',15,'steel',15,5,.195],['rav4',17,'blade',5,5,.225],['wrangler',17,'spoke',5,5,.265],
 ['f150',18,'split',6,6,.265],['police',17,'steel',10,5,.225]
];
function wheelAtlas(){
 const tile=192,[canvas,g]=cvs(tile*4,tile*4);
 for(const [index,[model,inches,pattern,count,lugs,width]] of WHEEL_TRIMS.entries()){
  const s=CARSPEC[model];s.wheelTile=index;s.tyreWidth=width;
  const r=clamp((inches*.0254/2)/(s.wr*.307/.335)*96,42,85);
  g.save();g.translate(index%4*tile+96,Math.floor(index/4)*tile+96);
  const circle=(radius,fill)=>{g.beginPath();g.arc(0,0,radius,0,2*Math.PI);g.fillStyle=fill;g.fill();};
  g.fillStyle='#292929';g.fillRect(-96,-96,tile,tile);circle(94,'#242424');
  for(let k=0;k<72;k++){
   g.rotate(Math.PI/36);g.fillStyle=k%3?'#303030':'#393939';g.fillRect(-.8,84,1.6,8);
  }
  circle(r+2,'#171818');circle(r,pattern==='steel'?'#646565':'#bec0bc');circle(r-3,'#343538');
  circle(r*.82,'#656663');circle(r*.62,'#515350');circle(r*.45,'#333439');
  const finish=g.createLinearGradient(-r,-r,r,r);
  finish.addColorStop(0,pattern==='steel'?'#a09e94':'#d9d9d3');
  finish.addColorStop(.45,pattern==='steel'?'#77786f':'#91938f');finish.addColorStop(1,'#525454');
  if(pattern==='steel'){
   circle(r-4,finish);
   for(let k=0;k<count;k++){
    g.save();g.rotate(k*2*Math.PI/count);
    g.beginPath();g.ellipse(0,-r*.71,r*.10,r*.18,0,0,2*Math.PI);g.fillStyle='#272a2a';g.fill();g.restore();
   }
  }else{
   for(let k=0;k<count;k++){
    g.save();g.rotate(k*2*Math.PI/count);
    for(const side of pattern==='split'?[-1,1]:[1]){
     const spread=pattern==='split'?r*.15:pattern==='blade'?r*.18:0;
     const broad=pattern==='aero'?.27:pattern==='blade'?.16:pattern==='spoke'?.082:.054;
     g.beginPath();g.moveTo(-r*.095,-r*.15);g.lineTo(side*spread-r*broad,-r*.93);
     g.lineTo(side*spread+r*broad,-r*.93);g.lineTo(r*.095,-r*.15);g.closePath();
     g.fillStyle=finish;g.fill();g.strokeStyle='#454848';g.lineWidth=1.1;g.stroke();
    }
    g.restore();
   }
  }
  circle(r*.30,finish);circle(r*.12,'#464948');
  for(let k=0;k<lugs;k++){
   const a=2*Math.PI*k/lugs,x=r*.205*Math.cos(a),y=r*.205*Math.sin(a);
   g.fillStyle='#282a28';g.beginPath();g.arc(x,y,r*.047,0,2*Math.PI);g.fill();
   g.fillStyle='#b2b2aa';g.fillRect(x-1.2,y-1.3,2.4,2.6);
  }
  g.restore();
 }
 for(const type of ['van','swat','amb','taxi'])CARSPEC[type].wheelTile=CARSPEC.police.wheelTile;
 return ctex(canvas);
}
function dishedWheelFace(){
 const positions=[],uv=[],index=[],rings=[[.001,.090],[.14,.090],[.21,.105],[.254,.119],[.295,.122],[.307,.119]];
 for(const side of [-1,1]){
  const start=positions.length/3;
  for(const [radius,depth] of rings)for(let n=0;n<=32;n++){
   const a=2*Math.PI*n/32,y=radius*Math.cos(a),z=radius*Math.sin(a);
   positions.push(side*depth,y,z);uv.push(.5+side*z/.614,.5+y/.614);
  }
  for(let k=0;k<rings.length-1;k++)for(let n=0;n<32;n++){
   const i=start+k*33+n,j=i+33;
   if(side>0)index.push(i,j,j+1,i,j+1,i+1);else index.push(i,j+1,j,i,i+1,j+1);
  }
 }
 const geo=new THREE.BufferGeometry();geo.setIndex(index);
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();return geo;
}
let wheelTire,wheelRim,wheelTiles,contactShadows,wheelN=0,contactN=0;
const _wm=new THREE.Matrix4(),_wq=new THREE.Quaternion(),_wq2=new THREE.Quaternion(),_wp=new THREE.Vector3(),_ws=new THREE.Vector3(),_we=new THREE.Euler();
const _wqc=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
function initWheels(max){
 const shoulder=[[.302,-.118],[.315,-.115],[.332,-.091],[.335,-.06],[.335,.06],[.332,.091],[.315,.115],[.302,.118]];
 const tyre=new THREE.LatheGeometry(shoulder.map(p=>new THREE.Vector2(...p)),32);tyre.rotateZ(Math.PI/2);
 const disk=dishedWheelFace();
 wheelTiles=new THREE.InstancedBufferAttribute(new Float32Array(max),1).setUsage(THREE.DynamicDrawUsage);
 disk.setAttribute('wheelTile',wheelTiles);
 const rimMaterial=new THREE.MeshStandardMaterial({map:wheelAtlas(),roughness:.39,metalness:.53,envMapIntensity:1.05});
 rimMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float wheelTile;')
   .replace('#include <uv_vertex>','#include <uv_vertex>\nvUv=(vUv*.99+.005+vec2(mod(wheelTile,4.),3.-floor(wheelTile/4.)))/4.;');
 };
 wheelTire=new THREE.InstancedMesh(tyre,new THREE.MeshStandardMaterial({color:0x17181a,roughness:.89}),max);
 wheelRim=new THREE.InstancedMesh(disk,rimMaterial,max);
 const [canvas,g]=cvs(64,64),fade=g.createRadialGradient(32,32,4,32,32,32);
 fade.addColorStop(0,'rgba(17,16,15,.63)');fade.addColorStop(.42,'rgba(23,22,19,.46)');fade.addColorStop(1,'rgba(25,23,22,0)');
 g.fillStyle=fade;g.fillRect(0,0,64,64);
 const patch=new THREE.PlaneGeometry(1,1);patch.rotateX(-Math.PI/2);
 contactShadows=new THREE.InstancedMesh(patch,new THREE.MeshBasicMaterial({map:ctex(canvas),transparent:true,depthWrite:false}),max);
 for(const mesh of [wheelTire,wheelRim,contactShadows]){
  mesh.frustumCulled=false;mesh.count=0;mesh.castShadow=mesh===wheelTire;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
 }
}
function wheelBegin(){wheelN=0;contactN=0;}
function writeWheel(scale,s){
 _ws.set(s.tyreWidth?s.tyreWidth/.236:scale,scale,scale);_wm.compose(_wp,_wq,_ws);
 wheelTiles.setX(wheelN,s.wheelTile||0);wheelTire.setMatrixAt(wheelN,_wm);wheelRim.setMatrixAt(wheelN++,_wm);
}
function wheelPush(px,py,pz,q,steer,spin,scale,s){
 _we.set(spin,steer,0,'YXZ');_wq2.setFromEuler(_we);_wq.copy(q).multiply(_wq2);_wp.set(px,py,pz);writeWheel(scale,s);
}
function wheelPushQ(p,q,scale,s){
 _wq.set(q.x,q.y,q.z,q.w).multiply(_wqc);_wp.set(p.x,p.y,p.z);writeWheel(scale,s);
}
const _contactUp=new THREE.Vector3(),_contactRight=new THREE.Vector3(),_contactForward=new THREE.Vector3();
function wheelContact(hit,heading,s){
 const n=hit.hitNormalWorld,p=hit.hitPointWorld;if(!hit.body || n.y<.4)return;
 _contactUp.set(n.x,n.y,n.z);_contactForward.set(Math.sin(heading),0,Math.cos(heading));
 _contactRight.crossVectors(_contactUp,_contactForward).normalize();_contactForward.crossVectors(_contactRight,_contactUp);
 _wm.makeBasis(_contactRight,_contactUp,_contactForward).scale(_ws.set((s.tyreWidth||.215)*2.8,1,s.wr*1.8));
 _wm.setPosition(p.x+n.x*.007,p.y+n.y*.007,p.z+n.z*.007);contactShadows.setMatrixAt(contactN++,_wm);
}
function wheelEnd(){
 for(const mesh of [wheelTire,wheelRim,contactShadows]){
  mesh.count=mesh===contactShadows?contactN:wheelN;mesh.instanceMatrix.needsUpdate=true;
 }
 wheelTiles.needsUpdate=true;
}
const HEADLIGHT_SPILL_WIDTH=8.4,HEADLIGHT_SPILL_LENGTH=23,HEADLIGHT_RANGE=40;
let beamTex=null;
function carBeamTex(){
 if(beamTex)return beamTex;
 const [canvas,g]=cvs(128,256),pixels=g.createImageData(canvas.width,canvas.height);
 for(let row=0;row<canvas.height;row++){
  const forward=1-row/(canvas.height-1),spread=.26+1.07*forward,center=.61+.19*forward;
  const reach=weatherRamp(0,.095,forward)*(1-weatherRamp(.50,.98,forward));
  for(let col=0;col<canvas.width;col++){
   const lateral=(col/(canvas.width-1)-.5)*HEADLIGHT_SPILL_WIDTH;
   const left=(lateral-center)/spread,right=(lateral+center)/spread;
   const falloff=1-weatherRamp(HEADLIGHT_SPILL_WIDTH*.35,HEADLIGHT_SPILL_WIDTH*.49,Math.abs(lateral));
   const intensity=(Math.exp(-.5*left*left)+Math.exp(-.5*right*right))*reach*falloff;
   const i=(row*canvas.width+col)*4;
   pixels.data[i]=255;pixels.data[i+1]=239;pixels.data[i+2]=211;
   pixels.data[i+3]=Math.round(255*Math.min(1,intensity));
  }
 }
 g.putImageData(pixels,0,0);
 return beamTex=new THREE.CanvasTexture(canvas);
}
let tailSpill=null;
function tailSpillTexture(){
 if(tailSpill)return tailSpill;
 const [canvas,g]=cvs(128,128);
 for(const x of [43,85]){
  const light=g.createRadialGradient(x,64,1,x,64,42);
  light.addColorStop(0,'rgba(255,230,210,.85)');
  light.addColorStop(.38,'rgba(250,170,145,.28)');
  light.addColorStop(1,'rgba(235,145,135,0)');
  g.fillStyle=light;g.fillRect(0,0,128,128);
 }
 return tailSpill=new THREE.CanvasTexture(canvas);
}
let beamMat=null,beamGeo=null;
function makeCarMesh(type,color,livery){const G=carGeo(type),s=G.s;const grp=new THREE.Group();
 const snowDepth={value:0},paint=coatVehicle(carPaint(type,color,livery),snowDepth);
 const mats=[paint,s.form==='roadster'?roadsterGlass:glassMat,darkMat,LENS.headOff,LENS.tailOff,carPlateMat()];const body=new THREE.Mesh(G.geo,mats);body.castShadow=true;body.receiveShadow=false;grp.add(body);
 if(!beamMat){beamMat=new THREE.MeshBasicMaterial({map:carBeamTex(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.09,fog:false});beamGeo=new THREE.PlaneGeometry(HEADLIGHT_SPILL_WIDTH,HEADLIGHT_SPILL_LENGTH);beamGeo.rotateX(-Math.PI/2);beamGeo.rotateY(Math.PI);}
 const beam=new THREE.Mesh(beamGeo,beamMat);beam.position.set(0,.06,s.L/2+.05+HEADLIGHT_SPILL_LENGTH/2);beam.visible=false;beam.renderOrder=3;grp.add(beam);
 const rearGlow=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({
  map:tailSpillTexture(),color:new THREE.Color(2,.20,.14),transparent:true,blending:THREE.AdditiveBlending,
  depthWrite:false,opacity:.17,fog:false
 }));
 rearGlow.rotateY(Math.PI);
 rearGlow.scale.set(4.13/HEADLIGHT_SPILL_WIDTH,1,3.77/HEADLIGHT_SPILL_LENGTH);
 rearGlow.position.set(0,.037,-s.L/2-1.6);
 rearGlow.visible=false;
 grp.add(rearGlow);
 let bar=null;
 if(livery==='police'||livery==='swat'||livery==='amb'){bar={r:new THREE.Mesh(unitBox,SIREN.offR),b:new THREE.Mesh(unitBox,SIREN.offB)};const y=s.r+.07,z=(G.zg1+G.zg2)/2+(livery==='police'?.1:1.4);for(const[m,sx]of[[bar.r,-1],[bar.b,1]]){m.scale.set(.52,.11,.2);m.position.set(sx*.29,y,z);grp.add(m);}const base=new THREE.Mesh(unitBox,darkMat);base.scale.set(1.2,.04,.26);base.position.set(0,y-.06,z);grp.add(base);}
 if(livery==='taxi'){const t=new THREE.Mesh(unitBox,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,.5)}));t.scale.set(.5,.16,.2);t.position.set(0,s.r+.09,(G.zg1+G.zg2)/2);grp.add(t);}
 return{grp,body,beam,rearGlow,bar,mats,snowDepth,paint};}
const SIREN={onR:new THREE.MeshBasicMaterial({color:new THREE.Color(3,.15,.1)}),onB:new THREE.MeshBasicMaterial({color:new THREE.Color(.15,.5,3)}),offR:new THREE.MeshStandardMaterial({color:0x4a0505,roughness:.2}),offB:new THREE.MeshStandardMaterial({color:0x05054a,roughness:.2})};
/* crumple: push vertices near a local-space impact point toward the car centre */
function carDent(c,lx,ly,lz,amount){
 const meshes=[];
 if(c.hero){
  c.hero.shell.traverse(o=>{if(o.isMesh&&!o.userData.servicePanel&&!o.userData.serviceGlass)meshes.push(o);});
  if(!c.hero.deformed){
   for(const mesh of meshes){mesh.userData.undented=mesh.geometry;mesh.geometry=mesh.geometry.clone();}
   c.hero.deformed=true;
  }
 }else{
  const body=c.body3;
  if(!c.ownGeo){body.geometry=body.geometry.clone();c.ownGeo=true;}
  meshes.push(body);
 }
 const R=.83,s=c.spec;
 for(const mesh of meshes){
  const P=mesh.geometry.attributes.position;
  for(let i=0;i<P.count;i++){
   const x=P.getX(i),y=P.getY(i),z=P.getZ(i),dx=x-lx,dy=y-ly,dz=z-lz,d2=dx*dx+dy*dy+dz*dz;
   if(d2>R*R)continue;
   const k=amount*(1-Math.sqrt(d2)/R);
   const cx=-x,cz=-z*.35,length=Math.hypot(cx,cz)||1;
   const bend=.76+.24*Math.sin(x*43+y*336+z*74);
   P.setXYZ(i,x+cx/length*k*bend,y-(y>s.hb?k*.16:0)+k*.08*bend,
    z+cz/length*k+(lz>0?-1:1)*k*.38*(Math.abs(lz)>s.L*.3?1:0));
  }
  P.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
 }
}
