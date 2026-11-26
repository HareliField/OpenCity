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
  return{pts,g,yT,bl,wB};};
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
   if(j>=8)m=2;
   else if(g>.6){
    if(j===3){const pillar=Math.abs(zc-zB)<.055||zc<zg0+.22||zc>zg3-.2||(type==='van'||type==='amb'||type==='swat')&&zc<zg2-1.5;if(!pillar)m=1;}
    else if(j<=1&&((zc>zg2+.04&&zc<zg3-.06)||(zc>zg0+.08&&zc<zg1-.04&&s.rg>.3)))m=1;
    else if(j===2&&((zc>zg2+.1&&zc<zg3-.1)||(zc>zg0+.14&&zc<zg1-.1&&s.rg>.3)))m=1;}
   if(k<10)idx[m].push(a,d,b,b,d,c);else idx[m].push(a,d,b,b,d,c);}}
 /* end caps */
 for(const[i,front]of[[N,1],[0,0]]){const base=pos.length/3;const p=secs[i].pts;let cy=0;for(let k=0;k<K;k++)cy+=pos[(i*K+k)*3+1];cy/=K;pos.push(0,cy,zs[i]);uv.push(front?1:0,cy/2.4);
  for(let k=0;k<K;k++){const a=i*K+k,b=i*K+(k+1)%K;idx[2].push(base,a,b,base,b,a);}}
 /* surface patches: lights, grille, plates */
 const quadStrip=(m,pl,y0,y1)=>{const b0=pos.length/3;pl.forEach((p,i)=>{pos.push(p[0],y0,p[1],p[0],y1,p[1]);uv.push(i/(pl.length-1),0,i/(pl.length-1),1);});for(let i=0;i<pl.length-1;i++){const a=b0+i*2;idx[m].push(a,a+2,a+1,a+1,a+2,a+3);}};
 const yN=s.nose,yR=s.tail;
 const flat=(m,x0,x1,y0,y1,z,front)=>{const b0=pos.length/3;pos.push(x0,y0,z,x1,y0,z,x0,y1,z,x1,y1,z);uv.push(0,0,1,0,0,1,1,1);if(front)idx[m].push(b0,b0+1,b0+2,b0+2,b0+1,b0+3);else idx[m].push(b0,b0+2,b0+1,b0+1,b0+2,b0+3);};
 const zf=h*.997+.023,W2=s.W/2,coupe=type==='sport';
 for(const sx of [1,-1]){
  const head=[sx*W2*(coupe?.45:.43),sx*W2*.88];
  const tail=[sx*W2*(coupe?.34:.44),sx*W2*.89];
  const a=Math.min(...head),b=Math.max(...head),c=Math.min(...tail),d=Math.max(...tail);
  flat(2,a-.028,b+.028,yN-.218,yN-.052,zf-.006,1);
  flat(3,a,b,yN-.19,yN-.071,zf+.007,1);
  flat(2,c-.025,d+.025,yR-.23,yR-.07,-zf+.004,0);
  flat(4,c,d,yR-.215,yR-.089,-zf-.008,0);
 }
 flat(2,-W2*.43,W2*.43,yN-.215,yN-.11,zf-.003,1);
 flat(2,-W2*.67,W2*.67,s.gc+.083,s.gc+.165,zf-.010,1);
 flat(2,-W2*.91,W2*.91,yR-.357,yR-.235,-zf-.010,0);
 flat(5,-.25,.25,s.gc+.118,s.gc+.225,zf+.017,1);
 flat(5,-.26,.26,yR-.385,yR-.263,-zf-.023,0);
 /* mirrors + handles */
 const box=(m,cx,cy,cz,sx,sy,sz)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(cx,cy,cz);const b0=pos.length/3,P=g.attributes.position.array,I=g.index.array;for(let i=0;i<P.length;i++)pos.push(P[i]);for(let i=0;i<P.length/3;i++)uv.push(.5,.5);for(let i=0;i<I.length;i++)idx[m].push(I[i]+b0);g.dispose();};
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
 if(livery==='police'){g.fillStyle='#16181c';g.fillRect(X(G.zg0-.3),0,X(G.zg3+.25)-X(G.zg0-.3),512);g.fillStyle='#fff';g.fillRect(X(G.zB-1.02),Y(s.hb-.02),X(G.zB+1.0)-X(G.zB-1.02),Y(.3)-Y(s.hb-.02));
  g.fillStyle='#1c3f94';g.fillRect(0,Y(.62),1024,9);g.fillStyle='#d8b23a';g.fillRect(0,Y(.62)+11,1024,3);g.font='bold 30px Anton, Impact, sans-serif';g.fillStyle='#1c3f94';g.textAlign='center';g.fillText('POLICE',X(G.zB-.5),Y(.72));g.fillText('POLICE',X(G.zB+.55),Y(.72));}
 if(livery==='taxi'){g.fillStyle='#111';for(let k=0;k<40;k++){if(k%2)g.fillRect(X(G.zB-1)+k*10,Y(.66),10,7);else g.fillRect(X(G.zB-1)+k*10,Y(.66)+7,10,7);}g.font='bold 26px Anton, Impact, sans-serif';g.textAlign='center';g.fillText('TAXI',X(G.zB+.5),Y(.42));}
 if(livery==='swat'){g.fillStyle='#16191d';g.fillRect(0,0,1024,512);g.font='bold 54px Anton, Impact, sans-serif';g.fillStyle='#cfd3d8';g.textAlign='center';g.fillText('S.W.A.T',X(-.9),Y(1.35));}
 if(livery==='amb'){g.fillStyle='#d42626';g.fillRect(0,Y(1.0),1024,16);g.fillRect(0,Y(.62),1024,8);g.font='bold 44px Anton, Impact, sans-serif';g.fillStyle='#d42626';g.textAlign='center';g.fillText('AMBULANCE',X(-.9),Y(1.5));g.fillRect(X(-2.2)-9,Y(1.75),18,58);g.fillRect(X(-2.2)-29,Y(1.75)+20,58,18);}
 g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=2.2;const door=(z0,z1)=>{g.beginPath();g.moveTo(X(z0),Y(s.hb));g.lineTo(X(z0),Y(s.gc+.17));g.lineTo(X(z1),Y(s.gc+.17));g.lineTo(X(z1),Y(s.hb));g.stroke();g.fillStyle='rgba(0,0,0,.5)';g.fillRect(X(z0)+6,Y(s.hb-.1),24,5);};
 const van=type==='van'||type==='amb'||type==='swat';
 door(G.zB-.02,G.zg3-.12);if(!van&&type!=='sport')door(Math.max(G.zg0+.25,-s.wb+.4),G.zB-.06);if(van)door(G.zB-1.6,G.zB-.4);
 g.beginPath();g.moveTo(X(G.zg3+.05),Y(pr(G,G.zg3+.05)));g.lineTo(X(G.zg3+.05),Y(s.hb-.2));g.stroke();
 const gr=g.createLinearGradient(0,Y(s.gc+.5),0,Y(s.gc));gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.4)');g.fillStyle=gr;g.fillRect(0,Y(s.gc+.5),1024,300);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return CARTEX[key]=t;}
function pr(G,z){return G.pr.top(z);}
const CARMATS={},carColors=[0x8f1420,0x16306b,0xdfe3e6,0x15171a,0x5c6268,0x0d4a30,0xb78b1f,0x41185a,0xb5480c,0x6f8191,0x6e1730,0xf4f4f2,0x0b0b0c,0x1f5a78,0x9aa3ab,0x7a2f17];
const glassMat=new THREE.MeshStandardMaterial({color:0x05080b,roughness:.04,metalness:.95,envMapIntensity:1.5});
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
let plateMat=null;
function carPlateMat(){if(plateMat)return plateMat;const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='#f3f1e4';g.fillRect(0,0,256,64);g.strokeStyle='#223';g.lineWidth=4;g.strokeRect(3,3,250,58);g.fillStyle='#1a2a55';g.font='bold 44px Anton, Impact, monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('AH 2817',128,37);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return plateMat=new THREE.MeshStandardMaterial({map:t,roughness:.5,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});}
function carPaint(type,color,livery){const k=type+color+livery;if(CARMATS[k])return CARMATS[k];const M=QUALITY.physical?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
 const m=new M({color:new THREE.Color(livery==='none'||livery==='taxi'?color:0xf2f2f2).convertSRGBToLinear(),map:carSeamTex(type,livery),roughness:livery==='swat'?.6:.26,metalness:livery==='swat'?.2:.55,envMapIntensity:1.25});
 if(QUALITY.physical){m.clearcoat=livery==='swat'?0:1;m.clearcoatRoughness=.13;}return CARMATS[k]=m;}
const burntMat=new THREE.MeshStandardMaterial({color:0x100e0d,roughness:1});
/* wheels: two shared instanced meshes for every car in the world */
let wheelTire=null,wheelRim=null;const _wm=new THREE.Matrix4(),_wq=new THREE.Quaternion(),_wq2=new THREE.Quaternion(),_wp=new THREE.Vector3(),_ws=new THREE.Vector3(),_we=new THREE.Euler();
function initWheels(max){const pts=[[.225,-.118],[.31,-.118],[.332,-.095],[.335,0],[.332,.095],[.31,.118],[.225,.118]].map(p=>new THREE.Vector2(p[0],p[1]));
 const tg=new THREE.LatheGeometry(pts,22);tg.rotateZ(Math.PI/2);tg.computeVertexNormals();
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#08080a';g.fillRect(0,0,256,256);
 const gr=g.createRadialGradient(128,128,10,128,128,124);gr.addColorStop(0,'#f2f3f4');gr.addColorStop(.75,'#9ea3a8');gr.addColorStop(1,'#70757a');g.fillStyle='#17181a';g.beginPath();g.arc(128,128,124,0,7);g.fill();
 g.strokeStyle=gr;g.lineCap='round';for(let k=0;k<5;k++){const a=k/5*Math.PI*2;for(const o of[-.16,.16]){g.lineWidth=17;g.beginPath();g.moveTo(128+Math.cos(a)*22,128+Math.sin(a)*22);g.lineTo(128+Math.cos(a+o)*112,128+Math.sin(a+o)*112);g.stroke();}}
 g.lineWidth=12;g.beginPath();g.arc(128,128,117,0,7);g.stroke();g.fillStyle=gr;g.beginPath();g.arc(128,128,30,0,7);g.fill();g.fillStyle='#2a2c2f';g.beginPath();g.arc(128,128,10,0,7);g.fill();
 const rt=new THREE.CanvasTexture(c);rt.encoding=THREE.sRGBEncoding;rt.anisotropy=4;
 const d1=new THREE.CircleGeometry(.228,24);d1.rotateY(Math.PI/2);d1.translate(.092,0,0);const d2=new THREE.CircleGeometry(.228,24);d2.rotateY(-Math.PI/2);d2.translate(-.092,0,0);
 const rg=mergeGeos([d1,d2]);
 wheelTire=new THREE.InstancedMesh(tg,new THREE.MeshStandardMaterial({color:0x0b0b0c,roughness:.82}),max);wheelRim=new THREE.InstancedMesh(rg,new THREE.MeshStandardMaterial({map:rt,roughness:.3,metalness:.75,envMapIntensity:1.1}),max);
 for(const m of[wheelTire,wheelRim]){m.frustumCulled=false;m.count=0;m.castShadow=m===wheelTire;scene.add(m);}}
let wheelN=0;
function wheelBegin(){wheelN=0;}
function wheelPush(px,py,pz,q,steer,spin,scale){_we.set(spin,steer,0,'YXZ');_wq2.setFromEuler(_we);_wq.copy(q).multiply(_wq2);_wp.set(px,py,pz);_ws.set(scale,scale,scale);_wm.compose(_wp,_wq,_ws);wheelTire.setMatrixAt(wheelN,_wm);wheelRim.setMatrixAt(wheelN,_wm);wheelN++;}
const _wqc=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
function wheelPushQ(p,q,scale){_wq.set(q.x,q.y,q.z,q.w).multiply(_wqc);_wp.set(p.x,p.y,p.z);_ws.set(scale,scale,scale);_wm.compose(_wp,_wq,_ws);wheelTire.setMatrixAt(wheelN,_wm);wheelRim.setMatrixAt(wheelN,_wm);wheelN++;}
function wheelEnd(){wheelTire.count=wheelRim.count=wheelN;wheelTire.instanceMatrix.needsUpdate=true;wheelRim.instanceMatrix.needsUpdate=true;}
let beamTex=null;
function carBeamTex(){if(beamTex)return beamTex;const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,128,256);for(const x of[44,84]){const gr=g.createRadialGradient(x,236,2,x,150,150);gr.addColorStop(0,'rgba(255,240,200,.9)');gr.addColorStop(.35,'rgba(255,230,180,.35)');gr.addColorStop(1,'rgba(255,220,160,0)');g.globalCompositeOperation='lighter';g.fillStyle=gr;g.fillRect(0,0,128,256);}return beamTex=new THREE.CanvasTexture(c);}
let beamMat=null,beamGeo=null;
function makeCarMesh(type,color,livery){const G=carGeo(type),s=G.s;const grp=new THREE.Group();
 const mats=[carPaint(type,color,livery),glassMat,darkMat,LENS.headOff,LENS.tailOff,carPlateMat()];const body=new THREE.Mesh(G.geo,mats);body.castShadow=true;body.receiveShadow=false;grp.add(body);
 if(!beamMat){beamMat=new THREE.MeshBasicMaterial({map:carBeamTex(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.09,fog:false});beamGeo=new THREE.PlaneGeometry(7,13);beamGeo.rotateX(-Math.PI/2);beamGeo.rotateY(Math.PI);}
 const beam=new THREE.Mesh(beamGeo,beamMat);beam.position.set(0,.06,s.L/2+6.2);beam.visible=false;beam.renderOrder=3;grp.add(beam);
 const rearGlow=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({
  map:carBeamTex(),color:new THREE.Color(2,.20,.14),transparent:true,blending:THREE.AdditiveBlending,
  depthWrite:false,opacity:.095
 }));
 rearGlow.rotateY(Math.PI);
 rearGlow.scale.set(.59,.28,.29);
 rearGlow.position.set(0,.037,-s.L/2-1.6);
 rearGlow.visible=false;
 grp.add(rearGlow);
 let bar=null;
 if(livery==='police'||livery==='swat'||livery==='amb'){bar={r:new THREE.Mesh(unitBox,SIREN.offR),b:new THREE.Mesh(unitBox,SIREN.offB)};const y=s.r+.07,z=(G.zg1+G.zg2)/2+(livery==='police'?.1:1.4);for(const[m,sx]of[[bar.r,-1],[bar.b,1]]){m.scale.set(.52,.11,.2);m.position.set(sx*.29,y,z);grp.add(m);}const base=new THREE.Mesh(unitBox,darkMat);base.scale.set(1.2,.04,.26);base.position.set(0,y-.06,z);grp.add(base);}
 if(livery==='taxi'){const t=new THREE.Mesh(unitBox,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.3,.5)}));t.scale.set(.5,.16,.2);t.position.set(0,s.r+.09,(G.zg1+G.zg2)/2);grp.add(t);}
 return{grp,body,beam,rearGlow,bar,mats};}
const SIREN={onR:new THREE.MeshBasicMaterial({color:new THREE.Color(3,.15,.1)}),onB:new THREE.MeshBasicMaterial({color:new THREE.Color(.15,.5,3)}),offR:new THREE.MeshStandardMaterial({color:0x4a0505,roughness:.2}),offB:new THREE.MeshStandardMaterial({color:0x05054a,roughness:.2})};
/* crumple: push vertices near a local-space impact point toward the car centre */
function carDent(c,lx,ly,lz,amount){
 const meshes=[];
 if(c.hero){
  c.hero.shell.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(!c.hero.deformed){
   for(const mesh of meshes)mesh.geometry=mesh.geometry.clone();
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
