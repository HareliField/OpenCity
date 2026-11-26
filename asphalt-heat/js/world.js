/* ================= world: materials, districts, buildings, streets, props ================= */
const TLD=new THREE.TextureLoader();const TEXC={};
function T(name,kind,rep,srgb){const k=name+kind+(rep||1);let t=TEXC[k];if(!t){t=TLD.load('tex/'+name+'_'+kind+'.webp');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(srgb)t.encoding=THREE.sRGBEncoding;if(rep)t.repeat.set(rep,rep);TEXC[k]=t;}return t;}
function pbr(name,meters,o={}){const r=1/meters;const m=new THREE.MeshStandardMaterial(Object.assign({map:T(name,'d',r,true),normalMap:T(name,'n',r),normalScale:new THREE.Vector2(o.ns||1,o.ns||1),roughness:o.rough==null?.9:o.rough,metalness:o.metal||0,envMapIntensity:o.env==null?.6:o.env},o.extra||{}));if(o.rmap)m.roughnessMap=T(name,'r',r);if(o.color)m.color=lin(o.color);return m;}
/* ---- facade shader: windows with parallax interiors, frames, shop fronts ---- */
const FACV=`attribute vec4 fac;attribute vec2 fac2;varying vec4 vFac;varying vec2 vFac2;varying vec2 vFU;varying vec3 vWP2;varying vec3 vWN;`;
const FACF=`varying vec4 vFac;varying vec2 vFac2;varying vec2 vFU;varying vec3 vWP2;varying vec3 vWN;`+WETCODE;
const FACMAIN=`#include <map_fragment>
 float glass=0.,frame=0.,metalG=0.;
 vec3 emitW=vec3(0.),frameC=vec3(.045,.041,.038),glassC=vec3(.01,.018,.024);
 {
  float seed=floor(vFac.x*117.+.5),sty=floor(vFac.y+.5),fh=vFac.z,bay=vFac.w,topH=vFac2.x,gH=vFac2.y;
  vec2 fu=vFU;
  if(vWN.y<.5){
   vec3 T=normalize(cross(vec3(0.,1.,0.),vWN)),V=normalize(vWP2-cameraPosition);
   vec3 vt=vec3(dot(V,T),V.y,-dot(V,vWN));
   bool shop=gH>.1&&fu.y<gH;
   bool curtain=sty>1.5&&sty<2.5;
   float cw=shop?5.6:bay,ch=shop?gH:fh,y0=shop?0.:gH;
   vec2 cell=floor(vec2(fu.x/cw,(fu.y-y0)/ch)),f=fract(vec2(fu.x/cw,(fu.y-y0)/ch));
   vec4 wr=shop?vec4(.10,.08,.95,.74):sty<.5?vec4(.10,.22,.90,.88):
    sty<1.5?vec4(.24,.25,.76,.82):curtain?vec4(.026,.12,.972,.935):
    sty<3.5?vec4(.11,.61,.89,.84):vec4(.16,.27,.84,.83);
   float h1=hash21(cell+seed*7.31),variant=hash21(cell+seed*119.3+4.7);
   bool valid=fu.y>.35&&fu.y<topH-.61&&(shop||fu.y>gH+.23);
   bool skip=sty>2.5&&sty<3.5&&!shop&&mod(cell.x,3.)>.5;
   frameC=curtain?mix(vec3(.025,.033,.037),vec3(.066,.072,.073),variant):
    (sty>.5&&sty<1.5)||sty>3.5?vec3(.32,.29,.263):vec3(.046,.043,.043);
   if(valid&&!skip&&all(greaterThan(f,wr.xy))&&all(lessThan(f,wr.zw))){
    vec2 dim=(wr.zw-wr.xy)*vec2(cw,ch);
    vec2 uvw=(f-wr.xy)/(wr.zw-wr.xy);
    vec2 edge=min(uvw,1.-uvw)*dim;
    frame=1.-smoothstep(.028,.064,min(edge.x,edge.y));
    if(shop){
     frame=max(frame,1.-smoothstep(.019,.036,abs(fract(uvw.x*3.)-.5)*dim.x/3.));
     frame=max(frame,1.-smoothstep(.022,.042,abs(uvw.y-.78)*dim.y));
    }else{
     frame=max(frame,1.-smoothstep(.017,.039,abs(uvw.x-.5)*dim.x));
     if(!curtain)frame=max(frame,1.-smoothstep(.011,.026,abs(uvw.y-.28)*dim.y));
    }
    glass=1.-frame;
    metalG=curtain?.59:.35;
    glassC=mix(vec3(.010,.015,.023),vec3(.020,.024,.029),variant);
    vec3 rd=vec3(vt.x/dim.x,vt.y/dim.y,max(vt.z,.002)/(shop?5.8:4.8));
    rd.x=(rd.x<0.?-1.:1.)*max(abs(rd.x),1e-4);
    rd.y=(rd.y<0.?-1.:1.)*max(abs(rd.y),1e-4);
    vec3 start=vec3(uvw,0.);
    vec3 hit=vec3((rd.x>0.?1.-uvw.x:-uvw.x)/rd.x,(rd.y>0.?1.-uvw.y:-uvw.y)/rd.y,1./rd.z);
    float d=min(hit.x,min(hit.y,hit.z));
    vec3 p=start+rd*d;
    float ceilingHit=smoothstep(.947,.995,p.y),floorHit=1.-smoothstep(.055,.16,p.y);
    float corner=.46+.54*smoothstep(0.,.46,min(p.x,1.-p.x)+min(p.z,1.-p.z));
    float paint=.62+.31*vnoise(p.xy*vec2(7.,5.)+p.z*5.);
    float lit=shop?step(.10,h1):step(curtain?.61:.79,h1);
    float strip=(1.-smoothstep(.012,.033,abs(fract(p.x*2.15+variant*.28)-.5)))
       *smoothstep(.13,.21,p.z)*(1.-smoothstep(.75,.84,p.z))*ceilingHit;
    vec3 white=mix(vec3(1.,.67,.34),vec3(.68,.82,1.),step(.83,variant));
    vec3 room=white*(.12+.16*paint)*corner*(1.-floorHit*.34);
    if(shop){
     vec2 product=vec2(floor(p.x*23.),floor(p.y*5.));
     float id=hash21(product+cell+seed);
     float plank=1.-smoothstep(.018,.092,abs(fract(p.y*5.)-.15));
     float stocked=step(.26,id)*smoothstep(.16,.24,fract(p.x*23.))*(1.-smoothstep(.72,.88,fract(p.x*23.)));
     vec3 goods=mix(vec3(.28,.098,.041),vec3(.08,.19,.16),hash21(product+13.));
     room=mix(room,goods,stocked*.60*(1.-ceilingHit)*(1.-floorHit));
     room*=1.-plank*.37;
     room+=white*(.31*strip+.07*paint);
    }else{
     float desk=(1.-smoothstep(.022,.070,abs(p.y-.28)))*smoothstep(.22,.28,p.x)*(1.-smoothstep(.66,.74,p.x));
     float chair=smoothstep(.10,.24,p.y)*(1.-smoothstep(.28,.37,p.y))*(1.-smoothstep(.09,.15,abs(p.x-.56)));
     room*=1.-max(desk*.62,chair*.48);
     room+=white*strip*.78;
    }
    float blind=step(.68,variant)*smoothstep(.53,.66,uvw.y)*(.42+.34*step(.42,fract(uvw.y*17.)));
    if(!shop)room=mix(room,white*.16,blind*.75);
    float swing=1.-pow(1.-clamp(vt.z,0.,1.),2.2)*.82;
    emitW=room*(.53+.71*h1)*lit*swing;
   }
   if(!valid&&gH>.1&&fu.y>gH-.08&&fu.y<gH+.26){frame=1.;frameC=vec3(.069,.062,.056);}
   diffuseColor.rgb*=.81+.18*smoothstep(.12,1.5,fu.y)+.055*fbm2(fu*.43);
  }
 }
 diffuseColor.rgb=mix(diffuseColor.rgb,glassC,glass);
 diffuseColor.rgb=mix(diffuseColor.rgb,frameC,frame);`;
function facadeMat(name,meters,o={}){const m=pbr(name,meters,Object.assign({env:.85},o));m.vertexColors=true;
 m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+FACV).replace('#include <fog_vertex>','#include <fog_vertex>\nvFac=fac;vFac2=fac2;vFU=uv;vWP2=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+FACF).replace('#include <map_fragment>',FACMAIN)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.11,glass);roughnessFactor=mix(roughnessFactor,.45,frame);')
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,metalG,glass);metalnessFactor=mix(metalnessFactor,.5,frame);')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,normalize(vNormal),max(glass,frame)));')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 Vv=normalize(cameraPosition-vWP2);float fr=pow(1.-clamp(dot(Vv,vWN),0.,1.),4.);totalEmissiveRadiance+=emitW*(1.-fr*.46)*(1.-metalG*.18);}');};
 m.customProgramCacheKey=()=>'facade';return m;}
/* ---- materials ---- */
const MAT={};
function initMaterials(){
 MAT.asphalt=makeWet(pbr('asphalt',7,{rough:1,rmap:1,ns:1.2,env:.7}),{tint:1});
 MAT.sidewalk=makeWet(pbr('sidewalk',3.2,{rough:.95,env:.76,rmap:1}),{wet:.83});
 MAT.plaza=makeWet(pbr('plaza',3,{rough:.8,env:.6}),{wet:.6});
 MAT.curb=pbr('concrete',2,{color:0xb8b3aa,rough:.85});
 MAT.sand=pbr('sand',4,{rough:1,env:.3});MAT.grass=pbr('grass',4,{rough:1,env:.25});
 MAT.wetsand=makeWet(pbr('sand',4,{rough:.7,env:.6,color:0x9a8670}),{wet:.9});
 MAT.planks=pbr('planks',3,{rough:.85});MAT.roof=pbr('roof_gravel',4,{rough:1,env:.3});MAT.roofClay=pbr('roof_clay',2.2,{rough:.85});
 MAT.trim=pbr('concrete',2.5,{color:0xd6d0c4,rough:.8});MAT.stone=pbr('stone_light',3,{rough:.82,ns:.44,color:0xd8c9b4});MAT.column=pbr('stone_light',3.4,{rough:.84,ns:.22,color:0xc3b6a3});MAT.darkMetal=new THREE.MeshStandardMaterial({color:lin(0x26282b),roughness:.45,metalness:.8});
 MAT.metal=new THREE.MeshStandardMaterial({color:lin(0x9aa0a6),roughness:.35,metalness:.85});MAT.whiteMetal=new THREE.MeshStandardMaterial({color:lin(0xe8e8e6),roughness:.4,metalness:.3});
 MAT.wood=new THREE.MeshStandardMaterial({color:lin(0x6a4a32),roughness:.8});MAT.glassDark=new THREE.MeshStandardMaterial({color:0x080a0c,roughness:.05,metalness:.9});
 MAT.container=pbr('container',2.5,{rough:.6,metal:.4,extra:{vertexColors:true}});MAT.corrugated=pbr('corrugated',2,{rough:.55,metal:.6});MAT.shutter=pbr('shutter',2.5,{rough:.5,metal:.6,color:0x9aa0a6});
 MAT.water=makeWater();
 const F={};MAT.fac=F;
 F.brick_red=facadeMat('brick_red',2.4);F.brick_dark=facadeMat('brick_dark',2.4);F.brick_orange=facadeMat('brick_orange',2.4);F.brick_tan=facadeMat('brick_tan',2.4);F.brick_factory=facadeMat('brick_factory',3);
 F.stucco=facadeMat('stucco',2.5,{rough:.9});F.plaster=facadeMat('plaster',2.5,{rough:.92});F.concrete=facadeMat('concrete',3.5,{rough:.85});F.panels=facadeMat('panels',4,{rough:.8});
 F.tiles=facadeMat('tiles_dark',3,{rough:.6});F.stone_dark=facadeMat('stone_dark',3.5,{rough:.8});F.stone_light=facadeMat('stone_light',3.5,{rough:.8});F.corrugated=facadeMat('corrugated',2.4,{rough:.5,metal:.5});}
function makeWater(){const m=new THREE.MeshStandardMaterial({color:lin(0x0d3a46),roughness:.06,metalness:0,envMapIntensity:1.2,normalMap:T('sand','n',1/40),normalScale:new THREE.Vector2(.3,.3)});
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,REFL.uniforms);sh.uniforms.uT=WATERT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform mat4 reflMat;uniform float uT;').replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 w0=modelMatrix*vec4(transformed,1.);float wv=sin(w0.x*.12+uT*1.3)*.25+sin(w0.z*.09-uT*.9+w0.x*.05)*.18;transformed.z+=wv;')
   .replace('#include <fog_vertex>','#include <fog_vertex>\nvec4 wp4=modelMatrix*vec4(transformed,1.);vWP=wp4.xyz;vRU=reflMat*wp4;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform sampler2D tRefl;uniform float reflOn;uniform float uT;'+WETCODE)
   .replace('#include <normal_fragment_maps>',`vec2 wq=vWP.xz;vec2 sp1=vec2(uT*.35,uT*.2),sp2=vec2(uT*.6,uT*.1);float wa=fbm2(wq*.35+sp1),wb=fbm2(wq*.35+vec2(.6,0.)+sp1),wc=fbm2(wq*.35+vec2(0.,.6)+sp1);
    float wd=fbm2(wq*1.7-sp2),we=fbm2(wq*1.7+vec2(.15,0.)-sp2),wf=fbm2(wq*1.7+vec2(0.,.15)-sp2);
    vec3 wn=normalize(vec3((wa-wb)*1.4+(wd-we)*.5,1.,(wa-wc)*1.4+(wd-wf)*.5));normal=normalize((viewMatrix*vec4(wn,0.)).xyz);`)
   .replace('#include <tonemapping_fragment>',`{vec3 V=normalize(cameraPosition-vWP);float fr=.02+.98*pow(1.-max(V.y,0.),5.);vec3 wn2=normalize((vec4(normal,0.)*viewMatrix).xyz);vec4 ru=vRU;ru.xy+=wn2.xz*.06*ru.w;
    if(reflOn>.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2DProj(tRefl,ru).rgb,clamp(fr*1.1,0.,.95));
    float sw=max(0.,vWP.x-${(W+61).toFixed(1)});
    float wave=sin(vWP.x*1.62-uT*2.3+vnoise(vec2(vWP.z*.095,vWP.x*.055))*.95);
    float foam=step(${(W+61).toFixed(1)},vWP.x)*smoothstep(.76,.96,wave)*exp(-sw*.10)*(.27+.73*fbm2(vWP.xz*1.35+uT*.2));
    vec3 reflected=reflect(-V,wn2);
    float glitter=pow(max(dot(reflected,normalize(vec3(.988,.151,.03))),0.),108.)*(.55+1.3*wd);
    gl_FragColor.rgb+=vec3(.49,.58,.58)*foam+vec3(1.15,.62,.25)*glitter*(.31+.69*smoothstep(6.,52.,sw));}
    #include <tonemapping_fragment>`);};
 m.customProgramCacheKey=()=>'water';return m;}
const WATERT={value:0};
/* ---- geometry helpers ---- */
function setAttrs(g,tint,fac,fac2){const n=g.attributes.position.count;const c=new Float32Array(n*3),a=new Float32Array(n*4),b=new Float32Array(n*2);const col=lin(tint);for(let i=0;i<n;i++){c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;a.set(fac,i*4);b.set(fac2,i*2);}
 g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setAttribute('fac',new THREE.BufferAttribute(a,4));g.setAttribute('fac2',new THREE.BufferAttribute(b,2));return g;}
/* 4 facade walls of a box (with window shader attributes) */
function facadeBox(mat,x0,x1,y0,y1,z0,z1,o){const w=x1-x0,d=z1-z0,h=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2,cz=(z0+z1)/2;
 const fac=[o.seed==null?Math.random():o.seed,o.style||0,o.fh||3.4,o.bay||3],fac2=[o.top||y1,o.gH||0];let u=0;
 const fs=[[w,0,cx,z1,1],[d,Math.PI/2,x1,cz,0],[w,Math.PI,cx,z0,1],[d,-Math.PI/2,x0,cz,0]];
 for(const[fw,ry,px,pz,ax]of fs){const g=new THREE.PlaneGeometry(fw,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,u+uv.getX(i)*fw,y0+uv.getY(i)*h);u+=fw+.37;
  g.rotateY(ry);g.translate(ax?cx:px,cy,ax?pz:cz);if(o.M)g.applyMatrix4(o.M);setAttrs(g,o.tint||0xffffff,fac,fac2);addGeo(mat,g,true);}}
function plainBox(mat,x0,x1,y0,y1,z0,z1,o={}){const w=x1-x0,h=y1-y0,d=z1-z0;const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv,nm=g.attributes.normal;
 if(o.uvm){for(let i=0;i<uv.count;i++){const ax=Math.abs(nm.getX(i))>.5?0:Math.abs(nm.getY(i))>.5?1:2;const fw=ax===0?d:w,fh=ax===1?d:h;uv.setXY(i,uv.getX(i)*fw/o.uvm,uv.getY(i)*fh/o.uvm);}}
 if(o.ry)g.rotateY(o.ry);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);if(o.M)g.applyMatrix4(o.M);if(o.tint)setColor(g,o.tint);addGeo(mat,g,o.shadow!==false,o.layer);return g;}
function setColor(g,hex){const n=g.attributes.position.count,c=new Float32Array(n*3),col=lin(hex);for(let i=0;i<n;i++){c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));}
function topQuad(mat,x0,x1,y,z0,z1,uvm,M,shadow){const g=new THREE.PlaneGeometry(x1-x0,z1-z0);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(x1-x0)/uvm,uv.getY(i)*(z1-z0)/uvm);g.rotateX(-Math.PI/2);g.translate((x0+x1)/2,y,(z0+z1)/2);if(M)g.applyMatrix4(M);addGeo(mat,g,!!shadow);return g;}
function cyl(mat,x,y,z,r0,r1,h,seg=10,o={}){
 const g=new THREE.CylinderGeometry(r0,r1,h,seg,1,!!o.open);
 if(mat.map?.wrapS===THREE.RepeatWrapping){
  const uv=g.attributes.uv,normal=g.attributes.normal;
  for(let i=0;i<uv.count;i++){
   if(Math.abs(normal.getY(i))>.8)uv.setXY(i,uv.getX(i)*(r0+r1),uv.getY(i)*(r0+r1));
   else uv.setXY(i,uv.getX(i)*Math.PI*(r0+r1),uv.getY(i)*h);
  }
 }
 g.translate(x,y+h/2,z);
 if(o.M)g.applyMatrix4(o.M);
 addGeo(mat,g,o.shadow!==false);
}
/* ---- sign atlas (shop names, hotel neon, billboards) ---- */
const ATLAS={c:null,g:null,n:0,cols:4,rows:16,mat:null,neon:null};
function atlasInit(){const[c,g]=cvs(2048,2048);ATLAS.c=c;ATLAS.g=g;g.fillStyle='#000';g.fillRect(0,0,2048,2048);}
function atlasSlot(draw){const i=ATLAS.n++;const cw=512,chh=128,x=(i%ATLAS.cols)*cw,y=Math.floor(i/ATLAS.cols)*chh;const g=ATLAS.g;g.save();g.beginPath();g.rect(x,y,cw,chh);g.clip();g.translate(x,y);draw(g,cw,chh);g.restore();return{u0:x/2048,u1:(x+cw)/2048,v0:1-(y+chh)/2048,v1:1-y/2048};}
function signQuad(slot,cx,cy,cz,w,h,ry,neon){const g=new THREE.PlaneGeometry(w,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,slot.u0+uv.getX(i)*(slot.u1-slot.u0),slot.v0+uv.getY(i)*(slot.v1-slot.v0));g.rotateY(ry);g.translate(cx,cy,cz);addGeo(neon?ATLAS.neon:ATLAS.mat,g,false);}
const SHOPS=[['CAFÉ ROMA','#2a1a12','#f3d9a4'],['PHARMACY','#0e5a3a','#ffffff'],['TACOS EL REY','#b8321a','#ffe08a'],['BARBER','#1a1a1a','#e8e8e8'],['PAWN · GOLD','#3a2a08','#ffd36e'],['DINER 24H','#8a1a1a','#ffffff'],['PIZZA NAPOLI','#1f4d2b','#fff3d0'],['LAUNDROMAT','#1d3d6b','#ffffff'],['BOOKS','#4a1d1d','#f2e2c2'],['ELECTRONICS','#111','#5ad1ff'],['NAIL STUDIO','#5a1d4a','#ffd0ec'],['DONUTS','#d86a9a','#ffffff'],['SUSHI ZEN','#151515','#ff5a4a'],['FLOWERS','#2e5a2a','#f8f0e0'],['SURF SHOP','#0a5a7a','#ffe066'],['GELATO','#e8e0d0','#b8321a'],['DELI','#1a3a2a','#f0e0b0'],['OPTICS','#e8e8e8','#1a3a6a'],['BAKERY','#6a3a1a','#ffe8c0'],['VINYL','#111','#ff9a2a'],['SHOES','#2a2a3a','#fff'],['WINE BAR','#3a0a1a','#f2c2a2'],['TATTOO','#0a0a0a','#e83a3a'],['MARKET','#c03a1a','#fff']];
let shopSlots=[];
function initSigns(){atlasInit();
 shopSlots=SHOPS.map(([n,bg,fg])=>atlasSlot((g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.15)';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);g.font=`${n.length>11?58:70}px Anton, Impact, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;g.shadowColor=fg;g.shadowBlur=8;g.fillText(n,w/2,h/2+4);}));
 const neon=(t,col)=>atlasSlot((g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);g.font=`italic ${t.length>9?66:80}px Anton, Impact, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=24;g.strokeText(t,w/2,h/2+4);g.shadowBlur=8;g.fillStyle='#fff';g.fillText(t,w/2,h/2+4);});
 ATLAS.hotels=[['THE CARLYLE','#ff4fd8'],['SEA BREEZE','#4ff0ff'],['FLAMINGO','#ff5a8a'],['TIDES','#7aff6a'],['CORAL REEF','#ffb04f'],['MOONLIGHT','#a07aff'],['SUNSET INN','#ff7a3a'],['PALM COURT','#5affc0']].map(([t,c])=>neon(t,c));
 ATLAS.ads=[['VELVET COLA','#b8141c','#fff'],['SUNSET FM 104.5','#ff8a00','#1a0a40'],['FLY OCEANAIR','#0a6ab8','#fff'],['LUXE WATCHES','#111','#e8c66a'],['DR. SMILE','#2ab0a0','#fff'],['NOVA PHONE 9','#111','#7af']].map(([t,bg,fg])=>atlasSlot((g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,bg);gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,w,h);g.font='72px Anton, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;g.fillText(t,w/2,h/2+4);}));
 ATLAS.special={};
 for(const[k,t,bg,fg]of[['bank','BANK OF THE COAST','#1a140c','#e8c66a'],['hospital','ST. MARY HOSPITAL','#ffffff','#c0262a'],['police','POLICE DEPARTMENT','#0e2550','#ffffff'],['quik','QUIK MART 24/7','#c0262a','#ffffff'],['liquor','LIQUOR · BEER · WINE','#3a0a4a','#ff8af0'],['jewel','DIAMOND DISTRICT','#0c0c0c','#e8c66a'],['guns','LOCK & LOAD — GUNS','#2a3014','#ffe066'],['chop','PARTS & SALVAGE','#2a1a0a','#ff9a3a'],['spray','FRESH COAT · RESPRAY','#0a2a4a','#9fe8ff'],['er','EMERGENCY','#c0262a','#ffffff'],['docks','PORT OF ASPHALT','#14202a','#e0e6ea']])
  ATLAS.special[k]=atlasSlot((g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.font=`${t.length>16?50:64}px Anton, Impact, sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;g.fillText(t,w/2,h/2+4);});
 const t=ctex(ATLAS.c);t.anisotropy=8;ATLAS.mat=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:new THREE.Color(1.2,1.2,1.2),roughness:.5,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 ATLAS.neon=new THREE.MeshBasicMaterial({map:t,color:new THREE.Color(2.6,2.6,2.6),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});}
/* ---- city layout ---- */
const blocks=[],places=[],LAMPS=[],TREES=[],PALMS=[],PROPSPOTS=[],STATIC=[],PARKED=[];
function districtOf(i,j){
 if(i>=14)return'beach';
 if(i<ORIGINAL_GRID&&j<ORIGINAL_GRID){
  if(i>=6)return'beach';
  if(j===6&&i>=3&&i<=4)return'midtown';
  if(j>=6)return'docks';
  if(i<=2)return j>=3?'suburb':'oldtown';
  return j>=2&&j<=5&&i<=5?'downtown':'midtown';
 }
 if(j>=13)return i>=10?'midtown':'docks';
 if(i>=8&&i<=11&&j>=5&&j<=9)return'downtown';
 if(i>=11&&j<=4)return'suburb';
 if((i<=4&&j>=8)||(i>=10&&j>=10))return'suburb';
 if(i>=8&&j<=4)return'oldtown';
 return'midtown';
}
const SPECIAL={'4,4':{kind:'park'},'4,3':{kind:'bank',side:'S'},'5,1':{kind:'hospital',side:'W'},'2,2':{kind:'police',side:'E'},'1,1':{kind:'store',sign:'quik',side:'S'},'5,6':{kind:'store',sign:'liquor',side:'N'},'4,2':{kind:'jewelry',side:'S'},'3,6':{kind:'gunshop',side:'N'},'1,7':{kind:'chop',side:'N'},'6,2':{kind:'spray',side:'W'},'2,7':{kind:'court'},'0,4':{kind:'park'},'6,5':{kind:'plaza'},'9,7':{kind:'park'},'5,10':{kind:'park'},'13,11':{kind:'park'},'10,8':{kind:'bank',side:'S'},'6,12':{kind:'hospital',side:'E'},'8,14':{kind:'police',side:'N'},'11,6':{kind:'store',sign:'quik',side:'W'},'12,12':{kind:'store',sign:'liquor',side:'S'},'14,9':{kind:'plaza'},'4,14':{kind:'chop',side:'N'},'10,3':{kind:'spray',side:'S'}};
const SIDEANG={S:0,N:Math.PI,E:Math.PI/2,W:-Math.PI/2};
function sideFrame(B,side){const ix0=B.x0+SW,ix1=B.x1-SW,iz0=B.z0+SW,iz1=B.z1-SW,cx=(B.x0+B.x1)/2,cz=(B.z0+B.z1)/2;const p=side==='S'?[cx,iz1]:side==='N'?[cx,iz0]:side==='E'?[ix1,cz]:[ix0,cz];const M=new THREE.Matrix4().makeRotationY(SIDEANG[side]);M.setPosition(p[0],0,p[1]);return M;}
function lrect(M,u0,u1,v0,v1){const a=new V3(u0,0,-v0).applyMatrix4(M),b=new V3(u1,0,-v1).applyMatrix4(M);return{x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)};}
const lpt=(M,u,v)=>new V3(u,0,-v).applyMatrix4(M);
const PASTEL=[0xf6c6c9,0xbfe6d8,0xf7e3a1,0xc7dcf2,0xffffff,0xf3d1b0,0xd8c8f0,0xa8e0e8];
const HOUSEC=[0xe8dcc4,0xd8c0a0,0xc4d4dc,0xf0e8d8,0xb8c8a8,0xc9918c,0xefded0];
/* which walls of a lot face a street (for signs/awnings) */
function streetSides(B,R){const s=[];if(R.z1>B.z1-SW-1.5)s.push('S');if(R.z0<B.z0+SW+1.5)s.push('N');if(R.x1>B.x1-SW-1.5)s.push('E');if(R.x0<B.x0+SW+1.5)s.push('W');return s;}
function shopDressing(B,R,gH,sides){
 const slot=spick(shopSlots);
 for(const side of sides){
  const {matrix:M,width}=lotFace(R,side),p=lpt(M,0,-.09);
  const w=Math.min(5.6,width-.86),ry=SIDEANG[side];
  signQuad(slot,p.x,gH-.37,p.z,w,.71,ry,false);
  if(srnd()<.36){
   const g=new THREE.BoxGeometry(w+.28,.05,1.21);
   g.rotateX(.24);g.translate(0,gH-.99,.59);
   g.applyMatrix4(M);addGeo(spick(AWN),g,true);
  }
 }
}
let AWN=[];
function initAwnings(){AWN=['#9a2a2a','#2a5a3a','#2a3a6a','#b08a20','#e6e0d4','#222'].map(c=>{const[cv,g]=cvs(64,64);for(let i=0;i<8;i++){g.fillStyle=i%2?c:'#efe8da';g.fillRect(i*8,0,8,64);}return new THREE.MeshStandardMaterial({map:ctex(cv,1),roughness:.9});});}
function roofDressing(R,h,kind){const w=R.x1-R.x0,d=R.z1-R.z0;
 plainBox(MAT.trim,R.x0-.15,R.x1+.15,h,h+.75,R.z0-.15,R.z0+.2,{uvm:2});plainBox(MAT.trim,R.x0-.15,R.x1+.15,h,h+.75,R.z1-.2,R.z1+.15,{uvm:2});plainBox(MAT.trim,R.x0-.15,R.x0+.2,h,h+.75,R.z0,R.z1,{uvm:2});plainBox(MAT.trim,R.x1-.2,R.x1+.15,h,h+.75,R.z0,R.z1,{uvm:2});
 topQuad(MAT.roof,R.x0,R.x1,h+.05,R.z0,R.z1,4,null,false);
 for(let k=0,n=rint(1,4);k<n;k++){const sx=srange(1.2,2.6),sz=srange(1.2,2.6);if(w<sx*2+1||d<sz*2+1)continue;const x=srange(R.x0+sx+.5,R.x1-sx-.5),z=srange(R.z0+sz+.5,R.z1-sz-.5);plainBox(MAT.metal,x-sx/2,x+sx/2,h,h+srange(.9,1.6),z-sz/2,z+sz/2);}
 if(kind==='old'&&srnd()<.4&&w>9&&d>9){const x=srange(R.x0+3,R.x1-3),z=srange(R.z0+3,R.z1-3);cyl(MAT.wood,x,h+2.6,z,1.5,1.5,2.8,14);const cg=new THREE.ConeGeometry(1.65,1.1,14);cg.translate(x,h+5.95,z);addGeo(MAT.darkMetal,cg);for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]])plainBox(MAT.darkMetal,x+a*1.05-.07,x+a*1.05+.07,h,h+2.6,z+b*1.05-.07,z+b*1.05+.07);}
 if(kind==='tower'&&srnd()<.5){const x=(R.x0+R.x1)/2,z=(R.z0+R.z1)/2;cyl(MAT.metal,x,h,z,.08,.15,srange(6,16),6);}
 if(srnd()<.12&&h>12&&h<50){const ad=spick(ATLAS.ads);const ax=srnd()<.5;const bx=(R.x0+R.x1)/2,bz=(R.z0+R.z1)/2;plainBox(MAT.darkMetal,bx-.15,bx+.15,h,h+4.55,bz-.15,bz+.15);signQuad(ad,bx+(ax?0:.2),h+6,bz+(ax?.2:0),12,3,ax?0:Math.PI/2,false);signQuad(ad,bx-(ax?0:.2),h+6,bz-(ax?.2:0),12,3,ax?Math.PI:-Math.PI/2,false);}}
function fireEscape(B,R,h,fh){const sd=streetSides(B,R);if(!sd.length)return;const s=sd[0];const along=s==='S'||s==='N';const L=along?R.x1-R.x0:R.z1-R.z0;if(L<8)return;const c=along?(R.x0+R.x1)/2:(R.z0+R.z1)/2;const off=s==='S'?R.z1:s==='N'?R.z0:s==='E'?R.x1:R.x0,sg=s==='S'||s==='E'?1:-1;
 for(let y=4.6+fh;y<h-1;y+=fh){const a=c-2,b=c+2,o0=off,o1=off+sg*1.1;const box=(u0,u1,y0,y1,v0,v1)=>along?plainBox(MAT.darkMetal,Math.min(u0,u1),Math.max(u0,u1),y0,y1,Math.min(v0,v1),Math.max(v0,v1)):plainBox(MAT.darkMetal,Math.min(v0,v1),Math.max(v0,v1),y0,y1,Math.min(u0,u1),Math.max(u0,u1));
  box(a,b,y,y+.06,o0,o1);box(a,b,y+.95,y+1,o1-sg*.04,o1);box(a,a+.05,y,y+1,o0,o1);box(b-.05,b,y,y+1,o0,o1);
  const g=new THREE.BoxGeometry(along?Math.hypot(fh,3.4):.5,.05,along?.5:Math.hypot(fh,3.4));const ang=Math.atan2(fh,3.4);if(along)g.rotateZ(ang);else g.rotateX(-ang);g.translate(along?c:off+sg*.8,y-fh/2,along?off+sg*.8:c);addGeo(MAT.darkMetal,g,true);}}
function building(B,R,h,o){
 const floors=streetSides(B,R);
 const shops=o.shops&&floors.length&&R.x1-R.x0>3.0&&R.z1-R.z0>3.0;
 const gH=shops?4.4:0;
 facadeBox(o.mat,R.x0,R.x1,shops?gH:.15,h,R.z0,R.z1,{
  style:o.style,fh:o.fh||3.4,bay:o.bay||3,gH,tint:o.tint||0xffffff,top:h,seed:srnd()
 });
 if(shops){
  buildAccessibleShell(B,R,{ceiling:gH-.10,height:h,wall:MAT.trim,selected:floors});
  shopDressing(B,R,gH,floors);
  plainBox(MAT.trim,R.x0-.12,R.x1+.12,gH,gH+.32,R.z0-.12,R.z1+.12,{uvm:2});
 }else B.bld.push({...R,h});
 if(o.cornice)plainBox(MAT.trim,R.x0-.35,R.x1+.35,h-.9,h-.55,R.z0-.35,R.z1+.35,{uvm:2});
 roofDressing(R,h,o.kind);
}
function splitLots(R,minW){const w=R.x1-R.x0,d=R.z1-R.z0;let lots=[[R.x0,R.x1,R.z0,R.z1]];
 const cut=(arr,ax)=>{const out=[];for(const L of arr){const len=ax?L[1]-L[0]:L[3]-L[2];if(len<minW*2+1){out.push(L);continue;}const m=(ax?L[0]:L[2])+len*srange(.38,.62);if(ax)out.push([L[0],m-.4,L[2],L[3]],[m+.4,L[1],L[2],L[3]]);else out.push([L[0],L[1],L[2],m-.4],[L[0],L[1],m+.4,L[3]]);}return out;};
 lots=cut(lots,1);lots=cut(lots,0);if(srnd()<.5)lots=cut(lots,1);return lots.map(L=>({x0:L[0],x1:L[1],z0:L[2],z1:L[3]}));}
const FACLIST={oldtown:['brick_red','brick_dark','brick_orange','brick_tan','brick_red'],midtown:['concrete','plaster','brick_tan','stucco','panels','stone_light'],downtown:['tiles','stone_dark','panels','concrete','stone_light'],docks:['brick_factory','corrugated','concrete'],beach:['stucco','stucco','plaster']};
function fillDistrict(B,R,dist){
 R={x0:Math.max(R.x0,B.x0+SW),x1:Math.min(R.x1,B.x1-SW),z0:Math.max(R.z0,B.z0+SW),z1:Math.min(R.z1,B.z1-SW)};
 if(R.x1-R.x0<4||R.z1-R.z0<4)return;
 const cx=(B.x0+B.x1)/2,cz=(B.z0+B.z1)/2,dc=Math.min(Math.hypot(cx-281,cz-230),Math.hypot(cx-605,cz-463));
 if(dist==='suburb'){if(R.x1-R.x0>=21&&R.z1-R.z0>=29)houses(B,R);return;}
 if(dist==='docks'){warehouses(B,R);return;}
 const lots=splitLots(R,dist==='downtown'?14:dist==='beach'?10:9);
 for(const L0 of lots){const L={x0:L0.x0+srange(0,.6),x1:L0.x1-srange(0,.6),z0:L0.z0+srange(0,.6),z1:L0.z1-srange(0,.6)};
  if(dist==='oldtown'){const fh=3.3,fl=rint(4,7);building(B,L,4.4+fl*fh,{mat:MAT.fac[spick(FACLIST.oldtown)],style:1,fh,bay:2.6,shops:true,cornice:true,kind:'old'});if(srnd()<.6)fireEscape(B,L,4.4+fl*fh,fh);}
  else if(dist==='beach'){const fh=3.2,fl=rint(2,5),h=4.4+fl*fh,tint=spick(PASTEL);building(B,L,h,{mat:MAT.fac.stucco,style:4,fh,bay:3.2,shops:true,tint,kind:'deco'});
   for(let y=4.4+fh;y<h-.5;y+=fh)plainBox(MAT.whiteMetal,L.x0-.18,L.x1+.18,y-.12,y,L.z0-.18,L.z1+.18);
   const sd=streetSides(B,L);if(sd.length&&srnd()<.85){const s=sd[0],hs=spick(ATLAS.hotels),y=h*.62;const fx=s==='E'?L.x1+.6:s==='W'?L.x0-.6:(L.x0+L.x1)/2,fz=s==='S'?L.z1+.6:s==='N'?L.z0-.6:(L.z0+L.z1)/2;
    const ry=s==='S'||s==='N'?Math.PI/2:0;plainBox(MAT.whiteMetal,fx-(ry?1.1:.18),fx+(ry?1.1:.18),4.6,h+1.2,fz-(ry?.18:1.1),fz+(ry?.18:1.1),{ry:0});
    const L2=Math.min(h-5.5,9);for(const sg of[1,-1]){const g=new THREE.PlaneGeometry(L2,L2/4);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,hs.u0+uv.getX(i)*(hs.u1-hs.u0),hs.v0+uv.getY(i)*(hs.v1-hs.v0));g.rotateZ(Math.PI/2);g.rotateY((s==='S'||s==='N')?(sg>0?0:Math.PI):(sg>0?Math.PI/2:-Math.PI/2));
     g.translate(fx+((s==='E'||s==='W')?sg*.19:0),4.6+(h-3.4)/2,fz+((s==='S'||s==='N')?sg*.19:0));addGeo(ATLAS.neon,g,false);}}}
  else if(dist==='downtown'){const tall=dc<170?srange(.6,1):srange(.3,.7);const podium=7.7,fh=3.8,h=Math.round(podium+tall*srange(76,162)/fh)*fh;
   building(B,L,podium,{mat:MAT.fac.stone_dark,style:0,fh:4.4,bay:4,shops:true,kind:'tower'});
   const ix=(L.x1-L.x0)*srange(.016,.075),iz=(L.z1-L.z0)*srange(.016,.075),T2={x0:L.x0+ix,x1:L.x1-ix,z0:L.z0+iz,z1:L.z1-iz};const mat=MAT.fac[spick(FACLIST.downtown)];
   facadeBox(mat,T2.x0,T2.x1,podium,h,T2.z0,T2.z1,{style:srnd()<.86?2:0,fh,bay:srnd()<.56?1.8:3.2,top:h,tint:spick([0xffffff,0xdfe6ee,0xf2e8dc]),seed:srnd()});roofDressing(T2,h,'tower');
   if(h>70&&srnd()<.6){const k=.18;const T3={x0:T2.x0+(T2.x1-T2.x0)*k,x1:T2.x1-(T2.x1-T2.x0)*k,z0:T2.z0+(T2.z1-T2.z0)*k,z1:T2.z1-(T2.z1-T2.z0)*k},h3=h+srange(10,26);facadeBox(mat,T3.x0,T3.x1,h+.75,h3,T3.z0,T3.z1,{style:2,fh,bay:1.6,top:h3,seed:srnd()});roofDressing(T3,h3,'tower');}
   B.bld.push({...T2,y0:podium,h});}
  else{const fh=3.4,fl=rint(3,12),h=4.4+fl*fh;building(B,L,h,{mat:MAT.fac[spick(FACLIST.midtown)],style:srnd()<.5?0:1,fh,bay:srnd()<.5?3:2.7,shops:true,cornice:srnd()<.4,tint:spick([0xffffff,0xf0e6d8,0xe0e4e8,0xe8d8c8]),kind:'mid'});}}}
const HOUSE_WALLS=new Map();
function houseWall(tint){
 if(!HOUSE_WALLS.has(tint))HOUSE_WALLS.set(tint,pbr('plaster',2.3,{color:tint,rough:.89,ns:.68}));
 return HOUSE_WALLS.get(tint);
}
function houses(B,R){const lots=[];const per=3;for(const side of['N','S']){for(let k=0;k<per;k++){const w=(R.x1-R.x0)/per;const x0=R.x0+k*w+1.2,x1=x0+w-2.4;const z0=side==='N'?R.z0+5:R.z1-14,z1=z0+9;lots.push({x0,x1,z0,z1,side});}}
 topQuad(MAT.grass,R.x0,R.x1,.16,R.z0,R.z1,4,null,false);
 for(const L of lots){const tint=spick(HOUSEC),h=srnd()<.5?6.4:3.4;const wall=houseWall(tint);
  if(h>3.4)facadeBox(MAT.fac.plaster,L.x0,L.x1,3.08,h,L.z0,L.z1,{style:1,fh:3.2,bay:2.8,tint,top:h+.6,seed:srnd()});
  buildAccessibleShell(B,L,{height:h,ceiling:h>3.4?3.08:h,kind:'home',selected:[L.side],wall});
  if(B.i===2&&B.j===4&&L.side==='S')frontPorch(L);
  const w=L.x1-L.x0,d=L.z1-L.z0,rh=d*.30;const sh=new THREE.Shape();sh.moveTo(-d/2-.5,0);sh.lineTo(d/2+.5,0);sh.lineTo(0,rh);sh.lineTo(-d/2-.5,0);const g=new THREE.ExtrudeGeometry(sh,{depth:w+.8,bevelEnabled:false});
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/2.2,uv.getY(i)/2.2);g.rotateY(Math.PI/2);g.translate(L.x0-.4,h,(L.z0+L.z1)/2);addGeo(MAT.roofClay,g,true);
  const fz=L.side==='N'?L.z0-.05:L.z1+.05;
  const hz0=L.side==='N'?R.z0+.2:R.z1-.5,mid=(L.x0+L.x1)/2;
  for(const [a,b] of [[L.x0,mid-1.35],[mid+1.35,L.x1]]){
   for(let x=a+1.18;x<b-1;x+=2.32)PROPSPOTS.push({type:'fence',x,z:hz0,ry:0});
  }
  const path0=Math.min(hz0,fz),path1=Math.max(hz0,fz);
  topQuad(MAT.sidewalk,mid-.64,mid+.64,.175,path0,path1,2.25,null,false);
  for(const x of [L.x0+.4,L.x1-.4]){
   plainBox(MAT.trim,x-.33,x+.33,.16,.28,fz-.25,fz+.25,{uvm:1});
  }

  TREES.push([L.x0-1.5,L.side==='N'?R.z0+2.5:R.z1-2.5,srange(.8,1.1)]);}}
function frontPorch(lot){
 const {matrix:M}=lotFace(lot,lot.side);
 const box=(mat,x0,x1,y0,y1,z0,z1)=>plainBox(mat,x0,x1,y0,y1,z0,z1,{M,uvm:2});
 for(const [half,z0,z1,top] of [[3.15,0,2.6,.35],[1.12,2.6,3.06,.24]]){
  box(MAT.planks,-half,half,.16,top,z0,z1);
  STREET.steps.push({...lrect(M,-half,half,-z1,-z0),y:top});
 }
 for(const side of [-1,1]){
  const x=side*2.93;
  box(MAT.trim,x-.085,x+.085,.35,2.8,2.33,2.5);
  STATIC.push({...lrect(M,x-.085,x+.085,-2.5,-2.33),y0:.35,h:2.8});
  const a=Math.min(x,side*1.15),b=Math.max(x,side*1.15);
  for(let u=a+.12;u<b;u+=.29)box(MAT.whiteMetal,u-.018,u+.018,.35,1.03,2.38,2.43);
  box(MAT.trim,a,b,1,1.1,2.34,2.48);
  STATIC.push({...lrect(M,a,b,-2.48,-2.34),y0:.35,h:1.1});
 }
 const roof=new THREE.BoxGeometry(6.68,.15,2.9);
 roof.rotateX(.115);
 roof.translate(0,2.92,1.39);
 roof.applyMatrix4(M);
 addGeo(MAT.roofClay,roof,true);
}

function warehouses(B,R){
 for(const lot of splitLots(R,16)){
  const h=srange(8,14);
  const mat=srnd()<.5?MAT.fac.corrugated:MAT.fac.brick_factory;
  const sides=streetSides(B,lot);
  facadeBox(mat,lot.x0,lot.x1,3.46,h,lot.z0,lot.z1,{style:3,fh:h,bay:4,top:h,seed:srnd()});
  buildAccessibleShell(B,lot,{height:h,ceiling:3.48,kind:'garage',selected:[sides[0]||'S'],wall:MAT.corrugated});
  roofDressing(lot,h,'ware');
 }
}
function containers(x0,x1,z0,z1){
 const colors=[0xb03a2a,0x2a5a9a,0x2a7a4a,0xd8a02a,0x7a7a7a,0xe8e8e8,0x6a2a6a,0xd86a2a];
 for(let x=x0;x<x1-6.2;x+=6.5)for(let z=z0;z<z1-2.5;z+=2.7){
  const layers=srnd()<.15?0:rint(1,3);
  for(let k=0;k<layers;k++)plainBox(MAT.container,x,x+6.06,k*2.6,k*2.6+2.6,z,z+2.44,{uvm:2.5,tint:spick(colors)});
  if(layers)STATIC.push({x0:x,x1:x+6.06,z0:z,z1:z+2.44,h:layers*2.6});
 }
}
/* ---- landmarks ---- */
function special(B,sp){const side=sp.side||'S',M=sideFrame(B,side);const door=lpt(M,0,-1.8);let pl=null;const ang=SIDEANG[side];
 const sign=(slot,u,y,v,w,h)=>{const p=lpt(M,u,v);signQuad(slot,p.x,y,p.z,w,h,ang,false);};
 const fillRest=(u0,u1,v0)=>{fillDistrict(B,lrect(M,-23.8,u0-1,0,v0),districtOf(B.i,B.j));fillDistrict(B,lrect(M,u1+1,23.8,0,v0),districtOf(B.i,B.j));fillDistrict(B,lrect(M,-23.8,23.8,v0+1,48),districtOf(B.i,B.j));};
 const fb=(mat,u0,u1,y0,y1,v0,v1,o)=>{const R=lrect(M,u0,u1,v0,v1);facadeBox(mat,R.x0,R.x1,y0,y1,R.z0,R.z1,Object.assign({top:y1,seed:srnd()},o));return R;};
 const pb=(mat,u0,u1,y0,y1,v0,v1,o)=>{const R=lrect(M,u0,u1,v0,v1);plainBox(mat,R.x0,R.x1,y0,y1,R.z0,R.z1,o||{uvm:3});return R;};
 if(sp.kind==='bank'){
  for(let i=0;i<7;i++){
   const front=-1.25+i*.56,top=.15+(i+1)*.235,half=19-i*.10;
   const r=pb(MAT.stone,-half,half,.15+i*.235,top,front,7.1);
   STREET.steps.push({...r,y:top});
   pb(MAT.trim,-half-.025,half+.025,top-.048,top+.004,front-.062,front+.19,{uvm:1.5});
  }
  pb(MAT.plaza,-18.6,18.6,1.793,1.798,2.12,7.1,{uvm:2.6,shadow:false});
  const R=fb(MAT.fac.stone_light,-19,19,5.12,16,7,34,{style:0,fh:5,bay:4.2});
  buildAccessibleShell(B,R,{base:1.795,ceiling:5.14,height:16,kind:'lobby',selected:[side],wall:MAT.stone});
  roofDressing(R,16,'mid');
  for(let k=0;k<6;k++){
   const p=lpt(M,-13.5+k*5.4,4);
   cyl(MAT.column,p.x,1.795,p.z,1.03,1.07,.32,24);
   cyl(MAT.column,p.x,2.1,p.z,.82,1.03,.35,24);
   cyl(MAT.column,p.x,2.40,p.z,.77,.84,10.7,24);
   plainBox(MAT.stone,p.x-1.04,p.x+1.04,13.1,13.6,p.z-1.04,p.z+1.04,{uvm:1.7});
   B.bld.push({x0:p.x-.73,x1:p.x+.73,z0:p.z-.73,z1:p.z+.73,h:13.6});
  }
  pb(MAT.stone,-18.5,18.5,13.6,15.4,1.6,7.4);const sh=new THREE.Shape();sh.moveTo(-18.5,0);sh.lineTo(18.5,0);sh.lineTo(0,4);sh.lineTo(-18.5,0);const g=new THREE.ExtrudeGeometry(sh,{depth:5.8,bevelEnabled:false});const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);g.translate(0,15.4,-7.4);g.applyMatrix4(M);addGeo(MAT.stone,g,true);
  sign(ATLAS.special.bank,0,14.5,1.55,24,2.2);
  const T2=fb(MAT.fac.tiles,-15,15,.15,92,33.98,40,{style:2,fh:3.8,bay:1.6});roofDressing(T2,92,'tower');
  B.bld.push({...T2,h:92});const barrel=lpt(M,12,-3.1);PROPSPOTS.push({type:'bin',x:barrel.x,z:barrel.z,ry:ang});
  pl={kind:'bank',name:'BANK OF THE COAST',time:16,cash:[5000,9000],heat:110,heat2:120};}
 else if(sp.kind==='hospital'){const R=fb(MAT.fac.stucco,-21,21,4.02,22,5,40,{style:0,fh:4,bay:3.6,gH:0,tint:0xf4f4f2});roofDressing(R,22,'mid');const T2=fb(MAT.fac.panels,-12,12,22.6,46,14,36,{style:2,fh:4,bay:1.6,tint:0xe8eef2});roofDressing(T2,46,'tower');
  const hp=lpt(M,0,25);cyl(new THREE.MeshStandardMaterial({color:lin(0x2a6a3a),roughness:.8}),hp.x,46.7,hp.z,7,7,.15,32);
  pb(MAT.whiteMetal,-8,8,4,4.4,-.5,5);for(const u of[-7.5,7.5]){const p=lpt(M,u,0);cyl(MAT.metal,p.x,0,p.z,.12,.12,4,8);}
  sign(ATLAS.special.hospital,0,8.5,4.95,18,2.2);sign(ATLAS.special.er,0,4.7,-.52,7,1.1);
  buildAccessibleShell(B,R,{ceiling:4.04,height:22,kind:'lobby',selected:[side],wall:MAT.trim});fillDistrict(B,lrect(M,-23.8,23.8,41,48),'midtown');pl={kind:'hospital',name:'HOSPITAL'};}
 else if(sp.kind==='police'){const R=fb(MAT.fac.brick_dark,-19,19,3.52,15,4,32,{style:0,fh:3.6,bay:3.4,gH:0});roofDressing(R,15,'mid');pb(new THREE.MeshStandardMaterial({color:lin(0x1c3f94),roughness:.6}),-19.2,19.2,4,4.6,3.8,32.2);
  sign(ATLAS.special.police,0,7,3.75,16,2);const fp=lpt(M,14,1);cyl(MAT.metal,fp.x,0,fp.z,.08,.1,13,8);
  buildAccessibleShell(B,R,{ceiling:3.56,height:15,kind:'lobby',selected:[side],rooms:false,wall:MAT.stone});fillDistrict(B,lrect(M,-23.8,23.8,33,48),'oldtown');const office=buildPoliceOffice(B,M,side,pb);pl={kind:'police',name:office.name,office};}
 else if(sp.kind==='store'||sp.kind==='jewelry'||sp.kind==='gunshop'){const key=sp.kind==='jewelry'?'jewel':sp.kind==='gunshop'?'guns':sp.sign;
  const R=fb(sp.kind==='jewelry'?MAT.fac.stone_dark:MAT.fac.brick_tan,-9,9,4.08,5.4,0,14,{style:0,fh:5,bay:4,gH:4.4});roofDressing(R,5.4,'mid');sign(ATLAS.special[key],0,4.9,-.06,14,1.4);
  buildAccessibleShell(B,R,{ceiling:4.11,height:5.4,selected:[side],wall:MAT.trim});fillRest(-9,9,15);
  pl=sp.kind==='gunshop'?{kind:'gunshop',name:'LOCK & LOAD'}:{kind:'store',name:sp.kind==='jewelry'?'DIAMOND DISTRICT':(key==='quik'?'QUIK MART':'LIQUOR'),time:sp.kind==='jewelry'?10:7,cash:sp.kind==='jewelry'?[1500,2600]:[300,750],heat:sp.kind==='jewelry'?75:45};}
 else if(sp.kind==='chop'||sp.kind==='spray'){const R=fb(sp.kind==='chop'?MAT.fac.corrugated:MAT.fac.plaster,-11,11,3.66,8,0,18,{style:3,fh:8,bay:5,tint:sp.kind==='chop'?0x8a6a50:0xdde6ee});roofDressing(R,8,'ware');
  sign(ATLAS.special[sp.kind],0,6.8,-.08,15,1.5);
  buildAccessibleShell(B,R,{ceiling:3.68,height:8,kind:'garage',selected:[side],wall:MAT.corrugated});
  fillRest(-11,11,19);const rp=lpt(M,0,7.5);pl={kind:sp.kind,name:sp.kind==='chop'?'PARTS & SALVAGE':'FRESH COAT',road:{x:rp.x,z:rp.z}};}
 else if(sp.kind==='court'){const ix0=B.x0+SW,ix1=B.x1-SW,iz0=B.z0+SW,iz1=B.z1-SW;const cx=(ix0+ix1)/2,cz=(iz0+iz1)/2;
  const[c,g]=cvs(512,512);g.fillStyle='#3a5a6a';g.fillRect(0,0,512,512);g.fillStyle='#a8522a';g.fillRect(40,90,432,332);g.strokeStyle='#eee';g.lineWidth=5;g.strokeRect(40,90,432,332);g.beginPath();g.moveTo(256,90);g.lineTo(256,422);g.stroke();g.beginPath();g.arc(256,256,50,0,7);g.stroke();g.strokeRect(40,196,90,120);g.strokeRect(382,196,90,120);
  for(let i=0;i<3000;i++){g.fillStyle=`rgba(0,0,0,${Math.random()*.08})`;g.fillRect(Math.random()*512,Math.random()*512,3,3);}g.font='bold 60px Anton, Impact';g.fillStyle='rgba(30,140,60,.85)';g.fillText('EASTSIDE',150,70);
  topQuad(makeWet(new THREE.MeshStandardMaterial({map:ctex(c),roughness:.7}),{wet:.6}),ix0,ix1,.17,iz0,iz1,ix1-ix0,null,false);
  for(const s of[-1,1]){const hx=cx+s*17.5;cyl(MAT.metal,hx,0,cz,.1,.1,3.9,8);plainBox(MAT.whiteMetal,hx-s*.35-.05,hx-s*.35+.05,3.1,4.2,cz-.9,cz+.9);}
  for(const[a,b,c2,d]of[[ix0,cx-1.5,iz0,iz0],[cx+1.5,ix1,iz0,iz0],[ix0,ix1,iz1,iz1],[ix0,ix0,iz0,iz1],[ix1,ix1,iz0,iz1]]){
   const r={x0:Math.min(a,b)-.04,x1:Math.max(a,b)+.04,z0:Math.min(c2,d)-.04,z1:Math.max(c2,d)+.04,h:3};
   plainBox(MAT.darkMetal,r.x0,r.x1,0,r.h,r.z0,r.z1,{shadow:false});STATIC.push(r);
  }
  containers(ix0+1,ix1-1,iz1-8,iz1-1);B.gang={x:cx,z:cz-4};}
 else if(sp.kind==='plaza'){topQuad(MAT.plaza,B.x0+SW,B.x1-SW,.17,B.z0+SW,B.z1-SW,3,null,false);const cx=(B.x0+B.x1)/2,cz=(B.z0+B.z1)/2;STATIC.push({x0:cx-5.22,x1:cx+5.22,z0:cz-5.22,z1:cz+5.22,h:.85,radius:5.22});cyl(MAT.stone,cx,.15,cz,5,5.3,.7,32);cyl(MAT.water,cx,.84,cz,4.6,4.6,.022,32,{shadow:false});cyl(MAT.stone,cx,.15,cz,.6,.8,3,12);
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;PALMS.push([cx+Math.cos(a)*14,cz+Math.sin(a)*14,srange(.9,1.2)]);}}
 if(pl){
  pl.door={x:door.x,z:door.z};
  const accessAt=sp.kind==='bank'?9.15:sp.kind==='hospital'?7.7:sp.kind==='police'?6.4:3.0;
  pl.interact=pl.office?.desk||lpt(M,0,accessAt);
  pl.cd=0;pl.side=side;places.push(pl);
 }
}
function park(B){const ix0=B.x0+SW,ix1=B.x1-SW,iz0=B.z0+SW,iz1=B.z1-SW,cx=(ix0+ix1)/2,cz=(iz0+iz1)/2;topQuad(MAT.grass,ix0,ix1,.17,iz0,iz1,4,null,false);
 const civicSquare=B.i===4&&B.j===4;
 if(civicSquare)parkCornerPaths(B,cx,cz,ix1-cx);
 else for(const ax of[0,1]){const g=new THREE.PlaneGeometry(ax?3:ix1-ix0,ax?iz1-iz0:3);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(ax?3:ix1-ix0)/3,uv.getY(i)*(ax?iz1-iz0:3)/3);g.rotateX(-Math.PI/2);g.translate(cx,.19,cz);addGeo(MAT.plaza,g,false);}
 STATIC.push({x0:cx-4.48,x1:cx+4.48,z0:cz-4.48,z1:cz+4.48,h:.8,radius:4.47});cyl(MAT.stone,cx,.15,cz,4.3,4.6,.65,28);cyl(MAT.water,cx,.79,cz,3.9,3.9,.022,28,{shadow:false});cyl(MAT.stone,cx,.15,cz,.5,.7,2.4,10);cyl(MAT.stone,cx,2.5,cz,1.5,.4,.4,14);
 for(let k=0;k<22;k++){
  const tx=srange(ix0+2,ix1-2),tz=srange(iz0+2,iz1-2),dx=Math.abs(tx-cx),dz=Math.abs(tz-cz);
  if(dx<3.5||dz<3.5)continue;
  const size=srange(.9,1.4);
  if(civicSquare&&(Math.abs(dx-dz)<2.2||Math.hypot(dx,dz)<9.5))continue;
  TREES.push([tx,tz,size]);
 }
 const seat=civicSquare?10:7;
 for(const[a,b,r]of[[cx-seat,cz+2.2,0],[cx+seat,cz-2.2,Math.PI],[cx+2.2,cz+seat,Math.PI/2],[cx-2.2,cz-seat,-Math.PI/2]])PROPSPOTS.push({type:'bench',x:a,z:b,ry:r});}

function parkCornerPaths(block,x,z,half){
 const length=(half+.7)*Math.SQRT2;
 block.diagonalPaths={x,z,half:half+.7};
 for(const angle of [-Math.PI/4,Math.PI/4]){
  const frame=new THREE.Matrix4().makeRotationY(angle).setPosition(x,0,z);
  topQuad(MAT.stone,-1.3,1.3,.205,-length,length,2.2,frame,false);
 }
 const ring=new THREE.RingGeometry(4.56,8.5,48);
 ring.rotateX(-Math.PI/2);
 const uv=ring.attributes.uv,positions=ring.attributes.position;
 for(let i=0;i<uv.count;i++)uv.setXY(i,positions.getX(i)/3,positions.getZ(i)/3);
 ring.translate(x,.212,z);
 addGeo(MAT.stone,ring,false);
}
/* ---- street furniture placement ---- */
function streetProps(B){const{x0,x1,z0,z1}=B;const dist=districtOf(B.i,B.j);
 for(const[sx,sz]of[[-1,-1],[1,-1],[1,1],[-1,1]])LAMPS.push({x:sx<0?x0+.6:x1-.6,z:sz<0?z0+.6:z1-.6,ry:Math.atan2(-sx,-sz)});
 for(const e of[0,1,2,3]){const len=48;for(let t=16;t<len-12;t+=16){const p=e===0?[x0+t,z0+.6,Math.PI]:e===1?[x1-.6,z0+t,Math.PI/2]:e===2?[x0+t,z1-.6,0]:[x0+.6,z0+t,-Math.PI/2];if(srnd()<.55)LAMPS.push({x:p[0],z:p[1],ry:p[2]+Math.PI,mid:1});}}
 const sideP=(e,t,o)=>e===0?[x0+t,z0+o]:e===1?[x1-o,z0+t]:e===2?[x0+t,z1-o]:[x0+o,z0+t];
 const kinds=dist==='docks'?['barrel','barrel','cone','bin','hydrant']:dist==='suburb'?['bin','hydrant','mailbox']:['hydrant','bin','news','meter','meter','bench','bollard','bin'];
 for(let k=0;k<(dist==='suburb'?3:9);k++){const e=rint(0,3),t=srange(7,41),[px,pz]=sideP(e,t,srange(.5,.9));PROPSPOTS.push({type:spick(kinds),x:px,z:pz,ry:[Math.PI,Math.PI/2,0,-Math.PI/2][e]});}
 if(dist==='beach')for(let t=8;t<44;t+=11){PALMS.push([x1-1.3,z0+t,srange(.85,1.2)]);PALMS.push([x0+1.3,z0+t,srange(.85,1.2)]);}
 else if(dist!=='docks'&&dist!=='suburb')for(const e of[0,1,2,3])for(let t=9;t<44;t+=13)if(srnd()<.61){const[px,pz]=sideP(e,t,1.5);TREES.push([px,pz,srange(.83,1.17)]);}}
function beach(){const x0=W+HALF;topQuad(STREET.materials.coastSand,x0,W+60,.02,-HALF-200,W+HALF+200,3.3,null,false);topQuad(STREET.materials.sandMarks,W+19,W+55,.023,-HALF,W+HALF,6.8,null,false);const wg=new THREE.PlaneGeometry(8,S+400);wg.rotateX(-Math.PI/2);wg.translate(W+60,.03,W/2);addGeo(MAT.wetsand,wg,false);
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000,60,60),MAT.water);ocean.rotation.x=-Math.PI/2;ocean.position.set(W+62+1500,-.35,W/2);ocean.receiveShadow=false;scene.add(ocean);REFL.hide.push(ocean);
 /* boardwalk + pier */
 topQuad(MAT.planks,x0+.5,x0+6,.25,-HALF,W+HALF,3,null,false);
 STREET.steps.push({x0:x0+.5,x1:x0+6,z0:-HALF,z1:W+HALF,y:.25});
 const beachOpenings=[[80,91],[205,222],[365,377],[418,434],[575,587],[832,846]];
 const railEnds=[-HALF,...beachOpenings.flat(),HARBOR.approach.z0,HARBOR.approach.z1,W+HALF];
 for(let i=0;i<railEnds.length;i+=2){
  const [a,b]=[railEnds[i],railEnds[i+1]];
  STATIC.push({x0:x0+5.99,x1:x0+6.09,z0:a,z1:b,y0:.24,h:1.18});
  for(let z=a;z<b;z+=2.5)plainBox(MAT.darkMetal,x0+6,x0+6.06,.25,1.2,z,z+.06,{shadow:false});
  plainBox(MAT.darkMetal,x0+6,x0+6.06,1.1,1.18,a,b,{shadow:false});
 }
 for(const [a,b] of beachOpenings){
  for(let i=0;i<4;i++){
   const x=x0+6+i*.37,y=.25-(i+1)*.049;
   topQuad(MAT.planks,x,x+.371,y,a,b,2.6,null,false);
   STREET.steps.push({x0:x,x1:x+.371,z0:a,z1:b,y});
  }
 }
 const pz=W*.42;
 for(let i=0;i<7;i++){
  const x=W+37+i*.44,top=.19+(i+1)*.202;
  topQuad(MAT.planks,x,x+.44,top,pz-2.3,pz+2.3,2.7,null,false);
  STREET.steps.push({x0:x,x1:x+.44,z0:pz-2.3,z1:pz+2.3,y:top});
 }
 STREET.steps.push({x0:W+40,x1:W+150,z0:pz-4,z1:pz+4,y:1.6});
 for(const sign of [-1,1])STATIC.push({x0:W+40,x1:W+150,z0:pz+sign*3.91-.06,z1:pz+sign*3.91+.06,y0:1.6,h:2.7});
 STATIC.push({x0:W+149.9,x1:W+150.08,z0:pz-4,z1:pz+4,y0:1.6,h:2.7});
 plainBox(MAT.wood,W+149.9,W+150.08,2.58,2.7,pz-4,pz+4);
 for(let z=pz-31;z<pz-9;z+=2.2)cyl(MAT.wood,W+59+srange(-2,1),-.22,z,.13,.17,srange(.47,1.03),9);topQuad(MAT.planks,W+40,W+150,1.6,pz-4,pz+4,3,null,true);for(let x=W+40;x<W+150;x+=6)for(const s of[-1,1])cyl(MAT.wood,x,-2,pz+s*3.6,.22,.22,3.6,8);
 for(const s of[-1,1]){
  const z=pz+s*3.9;plainBox(MAT.wood,W+40,W+150,2.6,2.7,z-.05,z+.05,{shadow:false});
  for(let x=W+40;x<=W+150;x+=2.5)plainBox(MAT.wood,x-.055,x+.055,1.6,2.62,z-.055,z+.055);
 }
 /* lifeguard towers, umbrellas */
 for(const z of[W*.18,W*.38,W*.68,W*.89]){const x=W+44;for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]])plainBox(MAT.wood,x+a*1.2-.08,x+a*1.2+.08,0,2.2,z+b*1.2-.08,z+b*1.2+.08);plainBox(MAT.planks,x-1.6,x+1.6,2.2,2.35,z-1.6,z+1.6,{uvm:2});
  facadeBox(MAT.fac.plaster,x-1.3,x+1.3,2.35,4.5,z-1.3,z+1.3,{style:4,fh:2.2,bay:2.6,tint:0xf2c94a,top:4.4});const g=new THREE.ConeGeometry(2.2,1,4);g.rotateY(Math.PI/4);g.translate(x,5,z);addGeo(new THREE.MeshStandardMaterial({color:lin(0xd8362a),roughness:.8}),g,true);
  for(const a of [-1,1])for(const b of [-1,1])STATIC.push({x0:x+a*1.2-.08,x1:x+a*1.2+.08,z0:z+b*1.2-.08,z1:z+b*1.2+.08,h:2.2});
  const platform={x0:x-1.6,x1:x+1.6,z0:z-1.6,z1:z+1.6,y:2.35};
  STREET.steps.push({...platform,elevated:true});STATIC.push({...platform,y0:2.2,h:2.35});
  STATIC.push({x0:x-1.3,x1:x+1.3,z0:z-1.3,z1:z+1.3,y0:2.35,h:4.5});
  for(let i=0;i<12;i++){
   const front=z+1.6+(11-i)*.33,y=.02+(i+1)*(2.33/12);
   const tread={x0:x-.85,x1:x+.05,z0:front,z1:front+.33,y};
   plainBox(MAT.planks,tread.x0,tread.x1,y-.09,y,tread.z0,tread.z1);STREET.steps.push(tread);
  }}
 placeScenery('beach-parasol',W+44,.02,222,.44,[3.17,2.44,2.99]);
 STATIC.push({x0:W+43.94,x1:W+44.06,z0:221.94,z1:222.06,h:2.44,radius:.057});
 const umbrellaZ=W*.42+11.7;
 placeScenery('beach-parasol',W+42.2,.02,umbrellaZ,.18,[3.03,2.35,2.94]);
 STATIC.push({x0:W+42.15,x1:W+42.25,z0:umbrellaZ-.06,z1:umbrellaZ+.06,h:2.35,radius:.055});
 lighthouse();
 const UMB=[0xe8463a,0x2a8ad8,0xf2c200,0xffffff,0x2ab070];for(let k=0;k<26;k++){
  const z=srange(0,W),x=srange(W+20,W+52),umbrella=spick(UMB),towel=spick([0xff7a7a,0x7ab8ff,0xffe07a,0x9affc0]);
  if(z>=HARBOR.approach.z0-2&&z<=HARBOR.approach.z1+2)continue;
  beachUmbrella(x,z,umbrella);
  const tw=new THREE.PlaneGeometry(.9,1.9);tw.rotateX(-Math.PI/2);tw.translate(x+1.3,.04,z+.2);addGeo(new THREE.MeshStandardMaterial({color:lin(towel),roughness:1}),tw,false);}
 beachAreas(pz);
 buildHarbor();
 for(let z=-40;z<W+60;z+=12){
  const palm=[W+HALF+8+srange(-.5,.5),z+srange(-3,3),srange(.9,1.25)];
  if(palm[1]<HARBOR.approach.z0-1||palm[1]>HARBOR.approach.z1+1)PALMS.push(palm);
 }
 /* yacht on the horizon */
 const yx=W+380,yz=W*.55;plainBox(MAT.whiteMetal,yx-14,yx+14,0,3,yz-3,yz+3);plainBox(MAT.whiteMetal,yx-8,yx+6,3,5.2,yz-2.4,yz+2.4);plainBox(MAT.glassDark,yx-8.05,yx+6.05,3.8,4.6,yz-2.45,yz+2.45);plainBox(MAT.whiteMetal,yx-5,yx+2,5.2,6.8,yz-1.8,yz+1.8);}
function beachUmbrella(x,z,color){
 cyl(MAT.whiteMetal,x,0,z,.04,.04,2.4,5);
 STATIC.push({x0:x-.055,x1:x+.055,z0:z-.055,z1:z+.055,h:2.4,radius:.052});
 const canopy=new THREE.ConeGeometry(1.5,.5,10,1,true);
 canopy.translate(x,2.45,z);
 addGeo(new THREE.MeshStandardMaterial({color:lin(color),roughness:.8,side:THREE.DoubleSide}),canopy,true);
}

function beachAreas(pierZ){
 const signX=W+HALF+1.75;
 for(const [label,z] of [['PIER BEACH',pierZ-13],['LIGHTHOUSE COVE',829]]){
  const slot=atlasSlot((g,w,h)=>{
   g.fillStyle='#234547';
   g.fillRect(0,0,w,h);
   g.strokeStyle='#a9c0b2';
   g.lineWidth=3;
   g.strokeRect(9,9,w-18,h-18);
   g.fillStyle='#fff1d4';
   g.font='bold 46px Inter, Arial, sans-serif';
   g.textAlign='center';
   g.textBaseline='middle';
   g.fillText(label,w/2,h/2,w-42);
  });
  for(const x of [signX-1.08,signX+1.08]){
   plainBox(MAT.wood,x-.055,x+.055,.25,2.24,z-.055,z+.055,{uvm:1});
   STATIC.push({x0:x-.055,x1:x+.055,z0:z-.055,z1:z+.055,h:2.24});
  }
  signQuad(slot,signX,1.98,z+.058,2.65,.66,0,false);
  signQuad(slot,signX,1.98,z-.058,2.65,.66,Math.PI,false);
 }
 for(const [dx,dz,color] of [[30,-8,0x2a8ad8],[40,-14,0xf2c200],[34,8,0xe8463a]]){
  beachUmbrella(W+dx,pierZ+dz,color);
 }
 for(const z of [825,854])PROPSPOTS.push({type:'bench',x:W+24,z,ry:Math.PI/2});
 for(const [dx,z,rise,width] of [[48,809,.76,2],[52,811,.94,2.6],[50,815,.56,1.85],
  [49,861,.55,1.5],[52,865,1.08,2.7],[51,870,.65,2.2]]){
  const x=W+dx,y=.02+rise/2,r=width*.5;
  const rock=new THREE.IcosahedronGeometry(1,1);
  rock.scale(r,rise*.65,r*.78);
  rock.rotateY(z*.4);
  rock.translate(x,y,z);
  addGeo(MAT.stone,rock,true);
  STATIC.push({x0:x-r,x1:x+r,z0:z-r,z1:z+r,h:y+rise*.65,radius:r*.76});
 }
}

function skyline(){for(let k=0;k<130;k++){
  const a=srange(Math.PI*.6,Math.PI*1.9),r=srange(S*.62+30,S*.62+260);
  const x=W/2+Math.cos(a)*r,z=W/2+Math.sin(a)*r;
  if(x>W+40)continue;
  const w=srange(16,38),d=srange(16,38),h=Math.round(srange(14,110)/4)*4;
  const mat=spick([MAT.fac.concrete,MAT.fac.tiles,MAT.fac.panels,MAT.fac.brick_red]),style=spick([0,1,2]);
  if(z+d/2>FREIGHT.z0||x+w/2>-HALF-6&&x-w/2<W+150&&z+d/2>-HALF-6&&z-d/2<W+HALF+6)continue;
  facadeBox(mat,x-w/2,x+w/2,0,h,z-d/2,z+d/2,{style,fh:3.6,bay:3,top:h});
  topQuad(MAT.roof,x-w/2,x+w/2,h,z-d/2,z+d/2,4,null,false);
 }
 for(const[x,z,sx,sz]of[[W/2,-HALF-.4,S+2,.8],[-HALF-.4,W/2,.8,S+2]])plainBox(MAT.trim,x-sx/2,x+sx/2,0,1.1,z-sz/2,z+sz/2,{uvm:2});
 for(const [a,b] of southWallSpans())plainBox(MAT.trim,a,b,0,1.1,FREIGHT.z0,FREIGHT.z0+.8,{uvm:2});
 for(let k=0;k<16;k++){const a=srange(Math.PI*.6,Math.PI*1.9),r=srange(900,1200);if(Math.cos(a)>0)continue;
  const g=new THREE.ConeGeometry(srange(165,300),srange(66,130),16);g.translate(W/2+Math.cos(a)*r,11,W/2+Math.sin(a)*r);
  addGeo(new THREE.MeshStandardMaterial({color:lin(0x5a5048),roughness:1}),g,false);}}
function roadMarkings(){const pos=[],col=[],idx=[];const Y=.012;const quad=(x0,z0,x1,z1,c)=>{const b=pos.length/3;pos.push(x0,Y,z0,x1,Y,z0,x0,Y,z1,x1,Y,z1);for(let i=0;i<4;i++)col.push(c[0],c[1],c[2]);idx.push(b,b+2,b+1,b+1,b+2,b+3);};
 const YEL=[.75,.52,.06],WHT=[.82,.82,.8];
 // Leave the side streets around the porch block unstriped between crossings.
 for(let k=0;k<=N;k++)for(let s=0;s<N;s++){
  const c=k*CELL,a=s*CELL+HALF+3.6,b=(s+1)*CELL-HALF-3.6;
  if(k!==2||s<4||s>5){
   quad(c-.22,a,c-.1,b,YEL);quad(c+.1,a,c+.22,b,YEL);
   quad(c-HALF+.35,a,c-HALF+.5,b,WHT);quad(c+HALF-.5,a,c+HALF-.35,b,WHT);
  }
  if(k!==5||s<1||s>2){
   quad(a,c-.22,b,c-.1,YEL);quad(a,c+.1,b,c+.22,YEL);
   quad(a,c-HALF+.35,b,c-HALF+.5,WHT);quad(a,c+HALF-.5,b,c+HALF-.35,WHT);
  }
 }
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const x=i*CELL,z=j*CELL;for(let s=-6.6;s<=6.6;s+=1.1){if(j>0)quad(x+s-.25,z-HALF-3,x+s+.25,z-HALF-.6,WHT);if(j<N)quad(x+s-.25,z+HALF+.6,x+s+.25,z+HALF+3,WHT);if(i>0)quad(x-HALF-3,z+s-.25,x-HALF-.6,z+s+.25,WHT);if(i<N)quad(x+HALF+.6,z+s-.25,x+HALF+3,z+s+.25,WHT);}
  if(j>0)quad(x-HALF+.3,z-HALF-3.6,x-.1,z-HALF-3.2,WHT);if(j<N)quad(x+.1,z+HALF+3.2,x+HALF-.3,z+HALF+3.6,WHT);if(i>0)quad(x-HALF-3.6,z+.1,x-HALF-3.2,z+HALF-.3,WHT);if(i<N)quad(x+HALF+3.2,z-HALF+.3,x+HALF+3.6,z-.1,WHT);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));const n=new Float32Array(pos.length);for(let i=1;i<n.length;i+=3)n[i]=1;g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setIndex(idx);
 const m=new THREE.Mesh(g,makeWet(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),{wet:.8,paint:true}));m.receiveShadow=true;scene.add(m);}
/* ---- trees, palms, lamps, traffic lights (instanced) ---- */
function leafTex(palm){const[c,g]=cvs(256,256);g.clearRect(0,0,256,256);
 if(palm){g.translate(128,250);for(let i=0;i<60;i++){const t=i/60,y=-t*240,len=(1-Math.abs(t-.45)*1.6)*95+12;for(const s of[-1,1]){g.save();g.translate(0,y);g.rotate(s*(1.05-t*.4));g.fillStyle=`hsl(${rnd(85,105)},${rnd(35,50)}%,${rnd(22,34)}%)`;g.beginPath();g.ellipse(0,-len/2,4.5,len/2,0,0,7);g.fill();g.restore();}}g.fillStyle='#5a4a2a';g.fillRect(-2,-240,4,240);}
 else{for(let i=0;i<420;i++){const x=rnd(10,246),y=rnd(10,246);if(Math.hypot(x-128,y-128)>118)continue;g.save();g.translate(x,y);g.rotate(rnd(0,6.3));g.fillStyle=`hsl(${rnd(70,110)},${rnd(30,55)}%,${rnd(18,38)}%)`;g.beginPath();g.ellipse(0,0,rnd(5,9),rnd(9,15),0,0,7);g.fill();g.restore();}}
 const t=ctex(c);t.premultiplyAlpha=false;return t;}
const DYN={};
function plantTrees(){const o=new THREE.Object3D(),col=new THREE.Color();
 const inst=(geo,mat,arr,fn,shadow=true)=>{if(!arr.length)return null;const m=new THREE.InstancedMesh(geo,mat,arr.length);arr.forEach((p,k)=>{o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);fn(p,k);o.updateMatrix();m.setMatrixAt(k,o.matrix);});m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;};
 const bark=pbr('planks',1,{color:0x978a73,rough:.96,env:.28,ns:.7});
 const trunk=new THREE.CylinderGeometry(.11,.27,3.8,11,5);trunk.translate(0,1.9,0);
 const trunkPosition=trunk.attributes.position;
 for(let i=0;i<trunkPosition.count;i++){
  const y=trunkPosition.getY(i);
  trunkPosition.setX(i,trunkPosition.getX(i)+Math.sin(y*.78)*.105);
  trunkPosition.setZ(i,trunkPosition.getZ(i)+Math.sin(y*.58)*.08);
 }
 trunk.computeVertexNormals();const br=[];for(let k=0;k<4;k++){const b=new THREE.CylinderGeometry(.04,.09,2,5);b.translate(0,1,0);b.rotateZ(.7);b.rotateY(k*1.57+.4);b.translate(0,2.8,0);br.push(b);}
 const treeTrunks=inst(mergeGeos([trunk,...br]),bark,TREES,p=>{o.position.set(p[0],.15,p[1]);o.scale.setScalar(p[2]);o.rotation.y=Math.random()*6;});
 const cards=[];for(let k=0;k<17;k++){const r=rnd(1.5,3.1);const g=new THREE.PlaneGeometry(r,r*.91);g.rotateX(rnd(-1.2,1.2));g.rotateY(rnd(0,3.14));g.translate(rnd(-1.65,1.65),rnd(3.25,5.5),rnd(-1.55,1.55));cards.push(g);}
 const foliage=TLD.load('tex/plane-leaves.webp');foliage.encoding=THREE.sRGBEncoding;foliage.anisotropy=4;
 const lm=new THREE.MeshStandardMaterial({map:foliage,alphaTest:.49,side:THREE.DoubleSide,roughness:.85});
 const leaves=inst(mergeGeos(cards),lm,TREES,p=>{o.position.set(p[0],.15,p[1]);o.scale.set(p[2],p[2]*rnd(.85,1.15),p[2]);o.rotation.y=Math.random()*6;});
 lm.onBeforeCompile=sh=>{
  sh.uniforms.uTreeTime=WATERT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTreeTime;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
       vec3 treeBase=instanceMatrix[3].xyz;
       float breeze=sin(uTreeTime*1.7+treeBase.x*.113+treeBase.z*.091+position.y*.67);
       transformed.x+=breeze*.083+sin(position.x*2.1+uTreeTime*3.2)*.036;
       transformed.z+=breeze*.043;`);
 };
 if(leaves)leaves.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:foliage,alphaTest:.49,side:THREE.DoubleSide});
 if(leaves)TREES.forEach((p,k)=>{col.setHSL(rnd(.07,.13),rnd(.01,.06),rnd(.72,1));leaves.setColorAt(k,col);});
 const pt=new THREE.CylinderGeometry(.14,.24,9,8,10);{const pa=pt.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i)+4.5;pa.setX(i,pa.getX(i)+Math.pow(y/9,2)*1.1);const ring=Math.abs(Math.sin(y*6))*.02;pa.setX(i,pa.getX(i)*(1+ring));pa.setZ(i,pa.getZ(i)*(1+ring));}pt.translate(0,4.5,0);pt.computeVertexNormals();}
 const palmTrunks=inst(pt,new THREE.MeshStandardMaterial({color:lin(0x8a7458),roughness:.95}),PALMS,p=>{o.position.set(p[0],p[0]>W?0:.15,p[1]);o.rotation.y=rnd(0,6);o.scale.setScalar(p[2]);});
 const fr=[];for(let k=0;k<11;k++){const g=new THREE.PlaneGeometry(1.5,3.6,1,6);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i)+1.8;pa.setZ(i,-Math.pow(y/3.6,2)*1.6);pa.setX(i,pa.getX(i)*(1-Math.abs(y/3.6-.5)*.6));}g.translate(0,1.8,0);g.rotateX(-Math.PI/2+.5+rnd(-.15,.2));g.rotateY(k/11*Math.PI*2+rnd(-.2,.2));g.translate(1.1,9,0);fr.push(g);}
 const pm=new THREE.MeshStandardMaterial({map:leafTex(true),alphaTest:.4,side:THREE.DoubleSide,roughness:.8});
 const palmLeaves=inst(mergeGeos(fr),pm,PALMS,p=>{o.position.set(p[0],p[0]>W?0:.15,p[1]);o.rotation.y=rnd(0,6);o.scale.setScalar(p[2]);});
 installTreeModels(TREES,treeTrunks,leaves,'plane-tree',(x,z,i)=>
  i%3===0&&x>239&&x<281&&z>239&&z<378);
 installTreeModels(PALMS,palmTrunks,palmLeaves,'palm-tree',(x,z,i)=>
  i%3===0&&x>428&&z>235&&z<305);
}
/* traffic lights */
const TL={mats:{}};
const signalGroup=(i,j)=>(i+2*j)%4;
function signalPhase(i,j,t){
 const cycle=(t+signalGroup(i,j)*4)%22;
 return {ns:cycle<9?'G':cycle<11?'Y':'R',ew:cycle>=11&&cycle<20?'G':cycle>=20?'Y':'R'};
}
function buildTrafficLights(){const o=new THREE.Object3D();const poles=[],heads=[],lamps={};
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const x=i*CELL,z=j*CELL;for(const[sx,sz]of[[-1,-1],[1,1]]){const px=x+sx*(HALF+.7),pz=z+sz*(HALF+.7);if(px<0||pz<0||px>W||pz>W)continue;poles.push([px,pz,sx,sz]);STATIC.push({x0:px-.13,x1:px+.13,z0:pz-.13,z1:pz+.13,h:5.88,radius:.13});
  for(const ax of['ns','ew']){const ry=ax==='ns'?(sz<0?0:Math.PI):(sx<0?Math.PI/2:-Math.PI/2);const armL=3.2;const hx=px+(ax==='ns'?-sx*armL:0)*0+(ax==='ew'?0:0),hz=pz;
   const ox=ax==='ns'?-sx*0:0;const hx2=ax==='ns'?px-sx*1.6:px,hz2=ax==='ew'?pz-sz*1.6:pz;heads.push([hx2,hz2,ry]);const fx=Math.sin(ry)*.17,fz=Math.cos(ry)*.17;
   (lamps[signalGroup(i,j)+ax+'R']||=[]).push([hx2+fx,5.15,hz2+fz,ry]);(lamps[signalGroup(i,j)+ax+'Y']||=[]).push([hx2+fx,4.82,hz2+fz,ry]);(lamps[signalGroup(i,j)+ax+'G']||=[]).push([hx2+fx,4.49,hz2+fz,ry]);}}}
 const pg=mergeGeos([(()=>{const g=new THREE.CylinderGeometry(.1,.13,5.8,8);g.translate(0,2.9,0);return g;})()]);const pm=new THREE.InstancedMesh(pg,MAT.darkMetal,poles.length);poles.forEach((p,k)=>{o.position.set(p[0],.15,p[1]);o.rotation.set(0,0,0);o.updateMatrix();pm.setMatrixAt(k,o.matrix);});pm.castShadow=true;scene.add(pm);
 const arm=new THREE.BoxGeometry(.08,.08,1.7);arm.translate(0,5.26,.85);const am=new THREE.InstancedMesh(arm,MAT.darkMetal,poles.length*2);let ai=0;poles.forEach(p=>{for(const ry of[Math.atan2(-p[2],0),Math.atan2(0,-p[3])]){o.position.set(p[0],.15,p[1]);o.rotation.set(0,ry,0);o.updateMatrix();am.setMatrixAt(ai++,o.matrix);}});scene.add(am);
 const hg=new THREE.BoxGeometry(.36,1.12,.28);hg.translate(0,4.82,0);const hm=new THREE.InstancedMesh(hg,new THREE.MeshStandardMaterial({color:lin(0x1a1b1d),roughness:.5}),heads.length);heads.forEach((p,k)=>{o.position.set(p[0],0,p[1]);o.rotation.set(0,p[2],0);o.updateMatrix();hm.setMatrixAt(k,o.matrix);});hm.castShadow=true;scene.add(hm);
 const lg=new THREE.CircleGeometry(.12,10);const cols={R:[3,.12,.05],Y:[3,1.4,.1],G:[.15,3,.6]};
 for(const key in lamps){const c=cols[key[3]];const m=new THREE.MeshBasicMaterial({color:new THREE.Color(.06,.06,.06)});m.userData.on=new THREE.Color(c[0],c[1],c[2]);TL.mats[key]=m;const im=new THREE.InstancedMesh(lg,m,lamps[key].length);lamps[key].forEach((p,k)=>{o.position.set(p[0],p[1],p[2]);o.rotation.set(0,p[3],0);o.updateMatrix();im.setMatrixAt(k,o.matrix);});scene.add(im);}}
function updLights(t){
 for(let group=0;group<4;group++){
  const phase=signalPhase(group,0,t);
  for(const ax of ['ns','ew'])for(const lamp of 'RYG'){
   const m=TL.mats[group+ax+lamp];if(phase[ax]===lamp)m.color.copy(m.userData.on);else m.color.setRGB(.05,.05,.05);
  }
 }
}

function lighthouse(){
 const x=W+35,z=838.8,base={x0:x-3.45,x1:x+3.45,z0:z-4.25,z1:z+4.25};
 const B=blocks[cellKey(x,z)];
 buildAccessibleShell(B,base,{base:.15,ceiling:3.42,height:3.54,kind:'lobby',selected:['W'],wall:MAT.trim});
 const y=.152;
 topQuad(MAT.planks,x-5.1,x-3.43,y,z-1.6,z+1.6,2.3,null,false);
 for(let i=0;i<4;i++){
  const top=3.42+i*3.36,r=3.05-i*.31;
  cyl(i%2?MAT.column:MAT.stone,x,top,z,r-.30,r,3.36,24);
 }
 cyl(MAT.darkMetal,x,16.86,z,2.39,2.39,.21,24);
 cyl(MAT.glassDark,x,17.07,z,1.73,1.73,2.47,24);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  cyl(MAT.darkMetal,x+Math.sin(a)*1.76,17.02,z+Math.cos(a)*1.76,.065,.065,2.53,6);
 }
 cyl(STREET.materials.bulb,x,17.93,z,1.41,1.41,.32,24,{shadow:false});
 const cap=new THREE.ConeGeometry(2.17,1.47,24);cap.translate(x,20.14,z);addGeo(MAT.darkMetal,cap,true);
 STATIC.push({x0:x-3.09,x1:x+3.09,z0:z-3.09,z1:z+3.09,y0:3.42,h:20.9,radius:3.09});
}
