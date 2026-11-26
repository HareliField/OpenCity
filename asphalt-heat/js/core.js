/* ================= core: utils, renderer, sky, fog, post-processing ================= */
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a),rint=(a,b)=>Math.floor(rnd(a,b+1)),pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const lerpA=(a,b,t)=>a+wrapA(b-a)*t;
let SEED=1337;const srnd=()=>{SEED=(SEED*16807)%2147483647;return(SEED-1)/2147483646;};const srange=(a,b)=>a+srnd()*(b-a),spick=a=>a[Math.floor(srnd()*a.length)];
const V3=THREE.Vector3;const unitBox=new THREE.BoxGeometry(1,1,1);
const ORIGINAL_GRID=8,N=16,CELL=64,HALF=8,W=N*CELL,S=W+16,LANE=4,SW=4;
const isMobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad/.test(navigator.userAgent);
const qp=new URLSearchParams(location.search);
const DAYLIGHT=qp.get('light')!=='sunset';
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
/* sun (matches the sky panorama: sun azimuth +X, low) */
const SUNDIR=(DAYLIGHT?new V3(.6394,.743,.1978):new V3(.988,.151,.03)).normalize();
const SKYSUN=DAYLIGHT?SUNDIR:new V3(.991,.136,0);
/* ---- fog: colour follows the sky in the view direction ---- */
{const sx=SKYSUN.x.toFixed(3),sz=SKYSUN.z.toFixed(3),sy=SKYSUN.y.toFixed(3);
 THREE.ShaderChunk.fog_pars_vertex='#ifdef USE_FOG\nvarying vec3 vFogPos;\n#endif';
 THREE.ShaderChunk.fog_vertex='#ifdef USE_FOG\nvFogPos=mvPosition.xyz;\n#endif';
 THREE.ShaderChunk.fog_pars_fragment='#ifdef USE_FOG\nuniform vec3 fogColor;varying vec3 vFogPos;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;uniform float fogFar;\n#endif\n#endif';
 THREE.ShaderChunk.fog_fragment=`#ifdef USE_FOG
 float fogD=length(vFogPos);vec3 fw=normalize(vec3(dot(viewMatrix[0].xyz,vFogPos),dot(viewMatrix[1].xyz,vFogPos),dot(viewMatrix[2].xyz,vFogPos)));
 vec2 fxz=normalize(fw.xz+1e-5);float fsd=max(dot(fxz,normalize(vec2(${sx},${sz}))),0.);
 vec3 fcol=${DAYLIGHT?'mix(vec3(.51,.60,.72),vec3(.80,.82,.82),pow(fsd,2.))':'mix(vec3(.225,.235,.295),vec3(.86,.39,.19),pow(fsd,4.))'}+
  ${DAYLIGHT?'vec3(.32,.29,.24)':'vec3(2.2,.75,.12)'}*pow(max(dot(fw,normalize(vec3(${sx},${sy},${sz}))),0.),28.);
 #ifdef FOG_EXP2
 float fogFactor=1.-exp(-fogDensity*fogDensity*fogD*fogD);
 #else
 float fogFactor=smoothstep(fogNear,fogFar,fogD);
 #endif
 fogFactor*=clamp(1.15-fw.y*2.2,.0,1.);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fcol*fogColor,fogFactor);
 #endif`;}
scene.fog=new THREE.FogExp2(0xffffff,DAYLIGHT?.00175:.00315);
/* ---- lights ---- */
const hemi=new THREE.HemisphereLight(lin(DAYLIGHT?0xd8e2ed:0xc1cee8),lin(DAYLIGHT?0x9b9389:0x66584d),DAYLIGHT?1.50:1.06);scene.add(hemi);
const sun=new THREE.DirectionalLight(lin(DAYLIGHT?0xfff1de:0xffaa72),DAYLIGHT?2.12:2.35);sun.castShadow=true;
sun.shadow.mapSize.set(QUALITY.shadow,QUALITY.shadow);{const sc=sun.shadow.camera;sc.left=-48;sc.right=48;sc.top=48;sc.bottom=-48;sc.near=1;sc.far=500;}
sun.shadow.bias=-.00019;sun.shadow.normalBias=.023;scene.add(sun,sun.target);
const muzzleL=new THREE.PointLight(0xffc070,0,14,2);scene.add(muzzleL);
// A shared headlamp illuminates the road, nearby walls and traffic for the occupied car.
const drivingLight=new THREE.SpotLight(0xffedcf,0,22,.43,.55,1);
scene.add(drivingLight,drivingLight.target);
const boomL=new THREE.PointLight(0xff8a30,0,60,2);scene.add(boomL);
/* ---- sky dome ---- */
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{tSky:{value:null},uExp:{value:1}},
 vertexShader:'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
 fragmentShader:`uniform sampler2D tSky;uniform float uExp;varying vec3 vD;
 void main(){vec3 d=normalize(vD);vec2 uv=vec2(atan(d.z,d.x)*.1591549+.5,asin(clamp(d.y,-1.,1.))*.3183099+.5);vec3 c=pow(texture2D(tSky,uv).rgb,vec3(2.2))*4.*uExp;
 ${POST?'':'c=c/(c+.6);c=pow(c,vec3(1./2.2));'}gl_FragColor=vec4(c,1.);}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,48,24),skyMat);sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
function loadSky(done){const ld=new THREE.TextureLoader();let n=2;const fin=()=>{if(--n===0)done();};
 ld.load(DAYLIGHT?'tex/sky-daylight.jpg':'tex/sky.jpg',t=>{t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;skyMat.uniforms.tSky.value=t;fin();},undefined,fin);
 const im=new Image();im.onload=()=>{const[c,g]=cvs(im.width,im.height);g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;const f=new Float32Array(c.width*c.height*4);
  for(let i=0;i<d.length;i+=4){for(let k=0;k<3;k++)f[i+k]=Math.min(Math.pow(d[i+k]/255,2.2)*4,30);f[i+3]=1;}
  const dt=new THREE.DataTexture(f,c.width,c.height,THREE.RGBAFormat,THREE.FloatType);dt.mapping=THREE.EquirectangularReflectionMapping;dt.flipY=true;dt.needsUpdate=true;dt.magFilter=dt.minFilter=THREE.LinearFilter;
  try{const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(dt).texture;pm.dispose();}catch(e){console.warn(e);}fin();};im.onerror=fin;im.src=DAYLIGHT?'tex/env-daylight.jpg':'tex/env.jpg';}

/* ---- planar reflection for wet ground ---- */
const REFL={rt:null,cam:new THREE.PerspectiveCamera(),mat:new THREE.Matrix4(),on:false,uniforms:{tRefl:{value:null},reflMat:{value:new THREE.Matrix4()},reflOn:{value:0}}};
function reflResize(w,h){if(!QUALITY.refl){REFL.on=false;REFL.uniforms.reflOn.value=0;return;}const s=QUALITY.reflScale;
 if(REFL.rt)REFL.rt.dispose();REFL.rt=new THREE.WebGLRenderTarget(Math.max(64,w*s|0),Math.max(64,h*s|0),{type:POST?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 REFL.uniforms.tRefl.value=REFL.rt.texture;REFL.on=true;REFL.uniforms.reflOn.value=1;}
const _rv=new V3(),_rtv=new V3(),_rn=new V3(0,1,0),_rl=new V3(),_rq=new THREE.Vector4(),_rp=new THREE.Plane(),_rc=new THREE.Vector4();
function renderReflection(){if(!REFL.on)return;const rc=REFL.cam,c=camera;
 rc.copy(c);rc.position.set(c.position.x,-c.position.y,c.position.z);
 _rl.set(0,0,-1).applyQuaternion(c.quaternion).add(c.position);_rl.y=-_rl.y;_rtv.set(0,1,0).applyQuaternion(c.quaternion);_rtv.y=-_rtv.y;rc.up.copy(_rtv);rc.lookAt(_rl);rc.updateMatrixWorld();rc.projectionMatrix.copy(c.projectionMatrix);
 REFL.mat.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);REFL.mat.multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);REFL.uniforms.reflMat.value.copy(REFL.mat);
 _rp.setFromNormalAndCoplanarPoint(_rn,new V3(0,.02,0));_rp.applyMatrix4(rc.matrixWorldInverse);_rc.set(_rp.normal.x,_rp.normal.y,_rp.normal.z,_rp.constant);
 const pm=rc.projectionMatrix;_rq.x=(Math.sign(_rc.x)+pm.elements[8])/pm.elements[0];_rq.y=(Math.sign(_rc.y)+pm.elements[9])/pm.elements[5];_rq.z=-1;_rq.w=(1+pm.elements[10])/pm.elements[14];
 _rc.multiplyScalar(2/_rc.dot(_rq));pm.elements[2]=_rc.x;pm.elements[6]=_rc.y;pm.elements[10]=_rc.z+1;pm.elements[14]=_rc.w;
 rc.layers.mask=camera.layers.mask;rc.layers.enable(1);
 const sh=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;const hidden=REFL.hide.filter(o=>o.visible);for(const o of hidden)o.visible=false;
 const tv=REFL.uniforms.tRefl.value;REFL.uniforms.tRefl.value=null;REFL.uniforms.reflOn.value=0;renderer.setRenderTarget(REFL.rt);renderer.clear();renderer.render(scene,rc);REFL.uniforms.tRefl.value=tv;REFL.uniforms.reflOn.value=1;for(const o of hidden)o.visible=true;renderer.shadowMap.autoUpdate=sh;}
REFL.hide=[];
/* inject wet-ground reflections into a MeshStandardMaterial */
const WETCODE=`
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){return vnoise(p)*.55+vnoise(p*2.1+7.3)*.3+vnoise(p*4.3+3.1)*.15;}`;
function makeWet(mat,opt){opt=opt||{};mat.userData.wet=opt;
 mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,REFL.uniforms);sh.uniforms.uWet={value:opt.wet==null?1:opt.wet};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform mat4 reflMat;').replace('#include <fog_vertex>','#include <fog_vertex>\nvec4 wp4=modelMatrix*vec4(transformed,1.);'+(opt.inst?'wp4=modelMatrix*instanceMatrix*vec4(transformed,1.);':'')+'vWP=wp4.xyz;vRU=reflMat*wp4;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec4 vRU;uniform sampler2D tRefl;uniform float reflOn;uniform float uWet;'+WETCODE)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float big=fbm2(vWP.xz*.06);
    vec2 grid=abs(mod(vWP.xz+32.,64.)-32.);
    float gutter=1.-smoothstep(.0,2.2,abs(min(grid.x,grid.y)-7.35));
    float pool=fbm2(vWP.xz*vec2(.23,.33)+big*2.1)+big*.17+gutter*.135;
    float pud=smoothstep(.51,.675,pool)*uWet;
    float damp=uWet*(.74+.26*big);
    float grain=vnoise(vWP.xz*34.);
    roughnessFactor=mix(roughnessFactor,.29+grain*.15,damp*.81);roughnessFactor=mix(roughnessFactor,.055,pud);diffuseColor.rgb*=mix(1.,.64,damp)*mix(1.,.51,pud);
    ${opt.tint?'diffuseColor.rgb*=mix(.78,1.13,big);':''}
    ${opt.paint?'if(fbm2(vWP.xz*22.)+vnoise(vWP.xz*69.)*.30<.30)discard;':''}`)
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,normalize(vNormal),pud*.9));')
   .replace('#include <tonemapping_fragment>',`
    {vec3 V=normalize(cameraPosition-vWP);float fr=.13+.87*pow(1.-max(V.y,0.),3.1);float kk=(pud*${DAYLIGHT?'.66':'.88'}+damp*${DAYLIGHT?'.14':'.30'}*(1.-pud))*fr*reflOn;
     if(kk>.002){vec2 dist=normal.xz*mix(.016,.0025,pud)+vec2(grain-.5,big-.5)*.003;vec4 ru=vRU;ru.xy+=dist*ru.w;vec3 rc=texture2DProj(tRefl,ru).rgb;
      if(pud<.6){vec4 r2=ru;r2.x+=.008*ru.w;vec4 r3=ru;r3.y-=.012*ru.w;rc=(rc+texture2DProj(tRefl,r2).rgb+texture2DProj(tRefl,r3).rgb)/3.;}
      vec2 edge=abs(ru.xy/max(.001,ru.w)-.5);
      float valid=1.-smoothstep(.46,.50,max(edge.x,edge.y));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,rc,clamp(kk*valid,0.,1.));}}
    #include <tonemapping_fragment>`);};
 mat.customProgramCacheKey=()=>'wet'+(opt.tint?1:0)+(opt.inst?1:0)+(opt.paint?1:0);return mat;}

/* ---- post: HDR target, bloom, filmic tonemap ---- */
const PP={};
function fsq(frag,uniforms){return new THREE.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:frag,depthTest:false,depthWrite:false});}
function postInit(){if(!POST)return;PP.scene=new THREE.Scene();PP.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);PP.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);PP.quad.frustumCulled=false;PP.scene.add(PP.quad);
 PP.bright=fsq(`uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=clamp((l-th)/(l+.0001),0.,1.);gl_FragColor=vec4(min(c*k,vec3(5.)),1.);}`,{t:{value:null},th:{value:1.05}});
 PP.blur=fsq(`uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*.316;c+=(texture2D(t,vUv+d*3.23).rgb+texture2D(t,vUv-d*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}`,{t:{value:null},d:{value:new THREE.Vector2()}});
 PP.final=fsq(`uniform sampler2D t;uniform sampler2D b1;uniform sampler2D b2;uniform sampler2D b3;uniform float bs;uniform float ex;uniform float time;uniform float hurt;varying vec2 vUv;
  vec3 aces(vec3 x){mat3 m1=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);mat3 m2=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);vec3 v=m1*x;vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return clamp(m2*(a/b),0.,1.);}
  void main(){vec3 c=texture2D(t,vUv).rgb;vec3 bl=texture2D(b1,vUv).rgb*.5+texture2D(b2,vUv).rgb*.75+texture2D(b3,vUv).rgb*1.;c+=bl*bs;
   c*=ex;c=aces(c);float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.035);c=pow(c,vec3(1./2.2));
   c=mix(c,c*vec3(.97,1.,1.025)+vec3(.003,.004,.008),1.-smoothstep(.0,.45,l));
   vec2 q=vUv-.5;c*=1.-dot(q,q)*.34;c=mix(c,vec3(.5,0.,0.),hurt*(dot(q,q)*1.6));
   c+=(fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.,1.)))*43758.5453)-.5)*.007;gl_FragColor=vec4(c,1.);}`,{t:{value:null},b1:{value:null},b2:{value:null},b3:{value:null},bs:{value:.42},ex:{value:1.02},time:{value:0},hurt:{value:0}});}
function postResize(w,h){if(!POST)return;const pr=renderer.getPixelRatio(),W2=Math.floor(w*pr),H2=Math.floor(h*pr);for(const k of['main','b0','b1a','b1b','b2a','b2b','b3a','b3b'])if(PP[k])PP[k].dispose();
 const o={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false};
 if(QUALITY.msaa&&THREE.WebGLMultisampleRenderTarget){PP.main=new THREE.WebGLMultisampleRenderTarget(W2,H2,{type:THREE.HalfFloatType});PP.main.samples=QUALITY.msaa;}else PP.main=new THREE.WebGLRenderTarget(W2,H2,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 const mk=s=>new THREE.WebGLRenderTarget(Math.max(8,W2*s|0),Math.max(8,H2*s|0),o);PP.b0=mk(.5);PP.b1a=mk(.25);PP.b1b=mk(.25);PP.b2a=mk(.125);PP.b2b=mk(.125);PP.b3a=mk(.0625);PP.b3b=mk(.0625);}
function pass(mat,target){PP.quad.material=mat;renderer.setRenderTarget(target);renderer.render(PP.scene,PP.cam);}
function blurTo(src,a,b){PP.blur.uniforms.t.value=src.texture;PP.blur.uniforms.d.value.set(1/a.width,0);pass(PP.blur,a);PP.blur.uniforms.t.value=a.texture;PP.blur.uniforms.d.value.set(0,1/a.height);pass(PP.blur,b);}
function renderFrame(t){renderReflection();
 if(!POST){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
 renderer.setRenderTarget(PP.main);renderer.clear();renderer.render(scene,camera);
 const F=PP.final.uniforms;F.t.value=PP.main.texture;F.time.value=t%10;
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
