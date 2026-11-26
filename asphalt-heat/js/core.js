/* ================= core: utils, renderer, sky, fog, post-processing ================= */
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a),rint=(a,b)=>Math.floor(rnd(a,b+1)),pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const lerpA=(a,b,t)=>a+wrapA(b-a)*t;
let SEED=1337;const srnd=()=>{SEED=(SEED*16807)%2147483647;return(SEED-1)/2147483646;};const srange=(a,b)=>a+srnd()*(b-a),spick=a=>a[Math.floor(srnd()*a.length)];
const cityInteger=(min,max)=>Math.floor(srange(min,max+1));
const V3=THREE.Vector3;const unitBox=new THREE.BoxGeometry(1,1,1);
const ORIGINAL_GRID=8,N=16,CELL=64,HALF=8,W=N*CELL,S=W+16,LANE=4,SW=4;
const isMobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad/.test(navigator.userAgent);
const qp=new URLSearchParams(location.search);
const QUALITY={level:qp.has('q')?+qp.get('q'):(isMobile?1:2)};
function applyQuality(){const L=QUALITY.level;QUALITY.physical=L>=2;QUALITY.refl=L>=1;QUALITY.bloom=L>=1;QUALITY.msaa=L>=2?4:(L>=1?2:0);QUALITY.pr=Math.min(devicePixelRatio,L>=2?1.75:L>=1?1.2:.9);QUALITY.shadow=L>=2?2048:1024;QUALITY.reflScale=L>=2?.5:.33;QUALITY.peds=L>=2?26:L>=1?18:12;}
applyQuality();
const LOWSHADOW=QUALITY.level<2;
function cvs(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];}
function ctex(c,rep,srgb=true){const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=8;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function lin(h){return new THREE.Color(h).convertSRGBToLinear();}

/* ---- renderer ---- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});
const GL2=renderer.capabilities.isWebGL2;
const POST=GL2;
renderer.setPixelRatio(QUALITY.pr);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=POST?THREE.LinearEncoding:THREE.sRGBEncoding;renderer.toneMapping=POST?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.physicallyCorrectLights=false;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,1,.12,2600);camera.layers.enable(2);
const muzzleL=new THREE.PointLight(0xffc070,0,14,2);scene.add(muzzleL);
// The occupied car's two low beams illuminate nearby solid surfaces.
const drivingLights=Array.from({length:2},()=>new THREE.SpotLight(0xffedcf,0,40,.36,.82,1));
for(const lamp of drivingLights)scene.add(lamp,lamp.target);
const boomL=new THREE.PointLight(0xff8a30,0,60,2);scene.add(boomL);
/* ---- planar reflection for wet ground ---- */
const REFL={rt:null,cam:new THREE.PerspectiveCamera(),mat:new THREE.Matrix4(),on:false,uniforms:{tRefl:{value:null},reflMat:{value:new THREE.Matrix4()},reflOn:{value:0}}};
function reflResize(w,h){if(!QUALITY.refl){REFL.on=false;REFL.uniforms.reflOn.value=0;return;}const s=QUALITY.reflScale;
 if(REFL.rt)REFL.rt.dispose();REFL.rt=new THREE.WebGLRenderTarget(Math.max(64,w*s|0),Math.max(64,h*s|0),{type:POST?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 REFL.uniforms.tRefl.value=REFL.rt.texture;REFL.on=true;REFL.uniforms.reflOn.value=1;}
const _rtv=new V3(),_rn=new V3(0,1,0),_rl=new V3(),_rq=new THREE.Vector4(),_rp=new THREE.Plane(),_rc=new THREE.Vector4();
const ROAD_MIRROR_POINT=new V3(0,.016,0);
function capturePlanar(rc,target,matrix,normal,point){
 const c=camera;
 rc.copy(c);
 rc.position.copy(c.position).addScaledVector(normal,-2*(normal.dot(c.position)-normal.dot(point)));
 _rl.set(0,0,-1).applyQuaternion(c.quaternion).reflect(normal).add(rc.position);
 _rtv.set(0,1,0).applyQuaternion(c.quaternion).reflect(normal);
 rc.up.copy(_rtv);rc.lookAt(_rl);rc.updateMatrixWorld();rc.projectionMatrix.copy(c.projectionMatrix);
 matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 matrix.multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
 _rp.setFromNormalAndCoplanarPoint(normal,point).applyMatrix4(rc.matrixWorldInverse);
 _rc.set(_rp.normal.x,_rp.normal.y,_rp.normal.z,_rp.constant);
 const pm=rc.projectionMatrix;
 _rq.set((Math.sign(_rc.x)+pm.elements[8])/pm.elements[0],(Math.sign(_rc.y)+pm.elements[9])/pm.elements[5],-1,(1+pm.elements[10])/pm.elements[14]);
 _rc.multiplyScalar(2/_rc.dot(_rq));pm.elements[2]=_rc.x;pm.elements[6]=_rc.y;pm.elements[10]=_rc.z+1;pm.elements[14]=_rc.w;
 rc.layers.mask=c.layers.mask;rc.layers.enable(1);
 const prev=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate,hidden=REFL.hide.filter(o=>o.visible);
 renderer.shadowMap.autoUpdate=false;
 for(const o of hidden)o.visible=false;
 try{renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,rc);}
 finally{renderer.setRenderTarget(prev);for(const o of hidden)o.visible=true;renderer.shadowMap.autoUpdate=shadow;}
}
function renderReflection(){
 if(!REFL.on)return;
 const u=REFL.uniforms,tex=u.tRefl.value;
 u.tRefl.value=null;u.reflOn.value=0;
 try{capturePlanar(REFL.cam,REFL.rt,u.reflMat.value,_rn,ROAD_MIRROR_POINT);}
 finally{u.tRefl.value=tex;u.reflOn.value=1;}
}
REFL.hide=[];
/* inject wet-ground reflections into a MeshStandardMaterial */
const WETCODE=`
// Keep sub-texel entropy at city-scale coordinates in 32-bit shader arithmetic.
float hash21(vec2 p){p=fract(mod(p,vec2(251.,257.))*vec2(.10317,.11369));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){return vnoise(p)*.55+vnoise(p*2.1+7.3)*.3+vnoise(p*4.3+3.1)*.15;}`;
function makeWet(mat,opt){opt=opt||{};mat.userData.wet=opt;
 mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,REFL.uniforms,climateUniforms);sh.uniforms.uWet={value:opt.wet==null?1:opt.wet};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform mat4 reflMat;').replace('#include <fog_vertex>','#include <fog_vertex>\nvec4 wp4=modelMatrix*vec4(transformed,1.);'+(opt.inst?'wp4=modelMatrix*instanceMatrix*vec4(transformed,1.);':'')+'vWP=wp4.xyz;vRU=reflMat*wp4;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform sampler2D tRefl;uniform float reflOn;uniform float uWet,uWetness,uRain,uSnowCover,uSeconds,uLamp;'+COVER_SHADER+WETCODE)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float big=fbm2(vWP.xz*.06);
    vec2 grid=abs(mod(vWP.xz+32.,64.)-32.);
    float gutter=1.-smoothstep(.0,2.2,abs(min(grid.x,grid.y)-7.35));
    vec2 tangent=grid.x<grid.y?vec2(vWP.z,vWP.x):vWP.xz;
    float pool=fbm2(tangent*vec2(.18,.39)+big*2.1)+big*.19+gutter*.15;
    pool+=.026*vnoise(tangent*vec2(1.6,3.4));
    float exposed=step(coverHeight(vWP.xz)-.25,vWP.y);
    float facingUp=smoothstep(.30,.87,inverseTransformDirection(normalize(vNormal),viewMatrix).y);
    float film=uWet*exposed*facingUp*uWetness;
    float pud=smoothstep(.49,.652,pool)*film;
    float damp=film*(.74+.26*big);
    ${opt.road?`float midblock=smoothstep(8.,16.,max(grid.x,grid.y));
    float downhill=smoothstep(2.7,7.5,min(grid.x,grid.y));
    float retention=mix(.42,mix(.16,.92,downhill),midblock);
    pud*=retention;damp*=mix(.65,1.,retention);`:''}
    float grain=vnoise(vWP.xz*34.);
    roughnessFactor=mix(roughnessFactor,.29+grain*.15,damp*.81);roughnessFactor=mix(roughnessFactor,.055,pud);diffuseColor.rgb*=mix(1.,.60,damp)*mix(1.,.44,pud);
    ${opt.tint?'diffuseColor.rgb*=mix(.78,1.13,big);':''}
    float snow=0.;
    if(uSnowCover>.015 && exposed*facingUp>.01){
     float track=min(abs(min(grid.x,grid.y)-2.),abs(min(grid.x,grid.y)-6.));
     float wear=${opt.road?'(1.-smoothstep(.16,.53,abs(track-.75)))*smoothstep(9.,14.,max(grid.x,grid.y))':'0.'};
     float drift=fbm2(vWP.xz*.53+vec2(big,0.));
     snow=smoothstep(.14,.77,uSnowCover*(.66+.68*big)*(1.-wear*(.54+.17*drift))+.32*(drift-.5))*exposed*facingUp;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.83,.90)*(.82+.12*drift+.06*grain),snow);
     roughnessFactor=mix(roughnessFactor,.92,snow);pud*=1.-snow;damp*=1.-snow;
    }
    ${opt.paint?'if(fbm2(vWP.xz*22.)+vnoise(vWP.xz*69.)*.30<.30)discard;':''}`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    normal=normalize(mix(normal,normalize(vNormal),max(pud*.90,snow*.67)));
    if(pud*uRain>.014){
     vec2 tile=vWP.xz*3.5,cell=floor(tile),local=fract(tile)-.5;
     local-=.45*(vec2(hash21(cell+23.),hash21(cell+5.))-.5);
     float phase=fract(uSeconds*(1.65+.65*hash21(cell))+hash21(cell+49.));
     float radius=length(local),ring=(radius-phase*.50)*51.;
     vec2 slope=local/max(radius,.001)*cos(ring)*exp(-abs(ring)*.50)*(1.-phase)*uRain*pud;
     normal=normalize(normal+mat3(viewMatrix)*vec3(slope.x,0.,slope.y)*.11);
    }`)
   .replace('#include <tonemapping_fragment>',`
    {vec3 V=normalize(cameraPosition-vWP);float fr=.13+.87*pow(1.-max(V.y,0.),3.1);float kk=(pud*.93+damp*mix(.22,.30,uLamp)*(1.-pud))*fr*reflOn*(1.-smoothstep(.40,.65,vWP.y));
     if(kk>.002){vec2 dist=normal.xz*mix(.016,.0025,pud)+vec2(grain-.5,big-.5)*.003;vec4 ru=vRU;ru.xy+=dist*ru.w;vec3 rc=texture2DProj(tRefl,ru).rgb;
      if(pud<.6){vec4 r2=ru;r2.x+=.008*ru.w;vec4 r3=ru;r3.y-=.012*ru.w;rc=(rc+texture2DProj(tRefl,r2).rgb+texture2DProj(tRefl,r3).rgb)/3.;}
      vec2 edge=abs(ru.xy/max(.001,ru.w)-.5);
      float valid=1.-smoothstep(.46,.50,max(edge.x,edge.y));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,rc,clamp(kk*valid,0.,1.));}}
    #include <tonemapping_fragment>`);};
 mat.customProgramCacheKey=()=>'wet'+(opt.tint?1:0)+(opt.inst?1:0)+(opt.paint?1:0)+(opt.road?1:0);return mat;}

/* ---- post: HDR target, bloom, filmic tonemap ---- */
const PP={};
function fsq(frag,uniforms){return new THREE.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:frag,depthTest:false,depthWrite:false});}
function postInit(){if(!POST)return;PP.scene=new THREE.Scene();PP.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);PP.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);PP.quad.frustumCulled=false;PP.scene.add(PP.quad);
 PP.bright=fsq(`uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=clamp((l-th)/(l+.0001),0.,1.);gl_FragColor=vec4(min(c*k,vec3(5.)),1.);}`,{t:{value:null},th:{value:1.05}});
 PP.blur=fsq(`uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*.316;c+=(texture2D(t,vUv+d*3.23).rgb+texture2D(t,vUv-d*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}`,{t:{value:null},d:{value:new THREE.Vector2()}});
 PP.ao=fsq(`uniform sampler2D sceneDepth;uniform mat4 inverseProjection;uniform vec2 projScale;
  varying vec2 vUv;
  vec3 positionAt(vec2 uv){vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(sceneDepth,uv).r*2.-1.,1.);return p.xyz/p.w;}
  void main(){
   vec3 p=positionAt(vUv);float z=-p.z;
   if(z>94.){gl_FragColor=vec4(1.,min(z,120.),0.,1.);return;}
   vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(dot(n,p)>0.)n=-n;
   float angle=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)*6.283185;
   float occlusion=0.;
   for(int i=0;i<16;i++){
    float f=(float(i)+.5)/16.,a=angle+float(i)*2.39996;
    vec2 coord=vUv+vec2(cos(a),sin(a))*sqrt(f)*projScale*.96/max(.12,z);
    vec3 v=positionAt(clamp(coord,vec2(.001),vec2(.999)))-p;float lengthV=length(v);
    float horizon=max(0.,dot(n,v)/max(.008,lengthV)-.10);
    occlusion+=horizon*(1.-smoothstep(.12,1.20,lengthV));
   }
   gl_FragColor=vec4(clamp(1.-occlusion*.150,.47,1.),z,0.,1.);
  }`,{sceneDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},projScale:{value:new THREE.Vector2()}});
 PP.final=fsq(`uniform sampler2D t;uniform sampler2D b1;uniform sampler2D b2;uniform sampler2D b3;uniform float bs;uniform float ex;uniform float time;uniform float hurt;uniform sampler2D aoMap;uniform sampler2D depthMap;uniform float aoOn;uniform vec2 aoTexel;uniform vec2 nearFar;varying vec2 vUv;
  vec3 aces(vec3 x){mat3 m1=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);mat3 m2=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);vec3 v=m1*x;vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return clamp(m2*(a/b),0.,1.);}
  float sampleAO(){
   if(aoOn<.5)return 1.;
   float raw=texture2D(depthMap,vUv).r,z=nearFar.x*nearFar.y/(nearFar.y-raw*(nearFar.y-nearFar.x));
   vec2 grid=vUv/aoTexel-.5,base=floor(grid),f=fract(grid);
   float sum=0.,w=0.;
   for(int i=0;i<4;i++){
    vec2 stepUV=vec2(mod(float(i),2.),floor(float(i)*.5));
    vec2 sampleUV=(base+stepUV+.5)*aoTexel;
    vec2 sampleValue=texture2D(aoMap,sampleUV).rg;
    vec2 bilinear=mix(1.-f,f,stepUV);
    float weight=bilinear.x*bilinear.y/(1.+abs(sampleValue.g-z)*34.);
    sum+=weight*sampleValue.r;w+=weight;
   }
   return sum/max(.00001,w);
  }
  void main(){vec3 c=texture2D(t,vUv).rgb*sampleAO();vec3 bl=texture2D(b1,vUv).rgb*.5+texture2D(b2,vUv).rgb*.75+texture2D(b3,vUv).rgb*1.;c+=bl*bs;
   c*=ex;c=aces(c);float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.035);c=pow(c,vec3(1./2.2));
   c=mix(c,c*vec3(.97,1.,1.025)+vec3(.003,.004,.008),1.-smoothstep(.0,.45,l));
   vec2 q=vUv-.5;c*=1.-dot(q,q)*.34;c=mix(c,vec3(.5,0.,0.),hurt*(dot(q,q)*1.6));
   c+=(fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.,1.)))*43758.5453)-.5)*.007;gl_FragColor=vec4(c,1.);}`,{t:{value:null},b1:{value:null},b2:{value:null},b3:{value:null},bs:{value:.42},aoOn:{value:0},aoMap:{value:null},depthMap:{value:null},aoTexel:{value:new THREE.Vector2()},nearFar:{value:new THREE.Vector2()},ex:{value:1.02},time:{value:0},hurt:{value:0}});}
function postResize(w,h){if(!POST)return;const pr=renderer.getPixelRatio(),W2=Math.floor(w*pr),H2=Math.floor(h*pr);for(const k of['main','occlusion','b0','b1a','b1b','b2a','b2b','b3a','b3b'])if(PP[k])PP[k].dispose();
 const o={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false};
 if(QUALITY.msaa&&THREE.WebGLMultisampleRenderTarget){PP.main=new THREE.WebGLMultisampleRenderTarget(W2,H2,{type:THREE.HalfFloatType});PP.main.samples=QUALITY.msaa;}else PP.main=new THREE.WebGLRenderTarget(W2,H2,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 if(QUALITY.level>=2)PP.main.depthTexture=new THREE.DepthTexture(W2,H2,THREE.UnsignedIntType);
 const mk=s=>new THREE.WebGLRenderTarget(Math.max(8,W2*s|0),Math.max(8,H2*s|0),o);PP.occlusion=QUALITY.level>=2?mk(.50):null;PP.b0=mk(.5);PP.b1a=mk(.25);PP.b1b=mk(.25);PP.b2a=mk(.125);PP.b2b=mk(.125);PP.b3a=mk(.0625);PP.b3b=mk(.0625);}
function pass(mat,target){PP.quad.material=mat;renderer.setRenderTarget(target);renderer.render(PP.scene,PP.cam);}
function blurTo(src,a,b){PP.blur.uniforms.t.value=src.texture;PP.blur.uniforms.d.value.set(1/a.width,0);pass(PP.blur,a);PP.blur.uniforms.t.value=a.texture;PP.blur.uniforms.d.value.set(0,1/a.height);pass(PP.blur,b);}
function renderFrame(t){preparePrecipitation();renderReflection();updateShopReflection(t);
 if(!POST){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
 renderer.setRenderTarget(PP.main);renderer.clear();renderer.render(scene,camera);
 const F=PP.final.uniforms;F.t.value=PP.main.texture;F.time.value=t%10;F.aoOn.value=PP.occlusion?1:0;
 if(PP.occlusion){
  PP.ao.uniforms.sceneDepth.value=PP.main.depthTexture;
  PP.ao.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
  PP.ao.uniforms.projScale.value.set(camera.projectionMatrix.elements[0]/2,camera.projectionMatrix.elements[5]/2);
  pass(PP.ao,PP.occlusion);F.aoTexel.value.set(1/PP.occlusion.width,1/PP.occlusion.height);
  F.aoMap.value=PP.occlusion.texture;F.depthMap.value=PP.main.depthTexture;F.nearFar.value.set(camera.near,camera.far);
 }else{F.aoMap.value=F.depthMap.value=null;}
 if(QUALITY.bloom){PP.bright.uniforms.t.value=PP.main.texture;pass(PP.bright,PP.b0);blurTo(PP.b0,PP.b1a,PP.b1b);blurTo(PP.b1b,PP.b2a,PP.b2b);blurTo(PP.b2b,PP.b3a,PP.b3b);F.b1.value=PP.b1b.texture;F.b2.value=PP.b2b.texture;F.b3.value=PP.b3b.texture;F.bs.value=.24;}
 else{F.b1.value=F.b2.value=F.b3.value=PP.main.texture;F.bs.value=0;}
 pass(PP.final,null);}
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(QUALITY.pr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?72:58;camera.updateProjectionMatrix();postResize(w,h);reflResize(Math.floor(w*QUALITY.pr),Math.floor(h*QUALITY.pr));}
postInit();addEventListener('resize',resize);
/* ---- generic merged-geometry buckets ---- */
const buckets=new Map();
function addGeo(mat,geo,shadow=true,layer){geo.computeBoundingBox();const a=geo.boundingBox;
 const wide=a.max.x-a.min.x>150||a.max.z-a.min.z>150;
 const sector=wide?'wide':Math.floor((a.min.x+a.max.x)/256)+':'+Math.floor((a.min.z+a.max.z)/256);
 const k=mat.uuid+(shadow?'s':'n')+(layer||0)+sector;let b=buckets.get(k);if(!b){b={mat,geos:[],shadow,layer};buckets.set(k,b);}b.geos.push(geo);}
function mergeGeos(geos,attrs){attrs=attrs||['position','normal','uv'];const extra=Object.keys(geos[0].attributes).filter(a=>!attrs.includes(a)&&geos.every(g=>g.attributes[a]));const all=attrs.concat(extra);let nv=0,ni=0;for(const g of geos){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
 const arr={};for(const a of all){const it=a==='uv'?2:(geos[0].attributes[a]?geos[0].attributes[a].itemSize:3);arr[a]={it,d:new Float32Array(nv*it)};}const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let ov=0,oi=0;
 for(const g of geos){const c=g.attributes.position.count;for(const a of all){const A=g.attributes[a];if(A)arr[a].d.set(A.array.length===c*arr[a].it?A.array:A.array.slice(0,c*arr[a].it),ov*arr[a].it);}
  if(g.index){const I=g.index.array;for(let k=0;k<I.length;k++)idx[oi+k]=I[k]+ov;oi+=I.length;}else{for(let k=0;k<c;k++)idx[oi+k]=ov+k;oi+=c;}ov+=c;}
 const m=new THREE.BufferGeometry();for(const a of all)m.setAttribute(a,new THREE.BufferAttribute(arr[a].d,arr[a].it));m.setIndex(new THREE.BufferAttribute(idx,1));m.computeBoundingSphere();return m;}
function flushBuckets(){for(const b of buckets.values()){const m=new THREE.Mesh(mergeGeos(b.geos),b.mat);m.castShadow=b.shadow;m.receiveShadow=true;m.matrixAutoUpdate=false;if(b.layer)m.layers.set(b.layer);scene.add(m);b.geos.forEach(g=>g.dispose());}buckets.clear();}
