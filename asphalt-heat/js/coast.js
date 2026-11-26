/* A continuous beach, moving swash and a progressively coarser open-water mesh. */
const COAST_EDGE=(W+61.4).toFixed(2);
const shoreGLSL=`
float shoreLine(float z,float t){
 return ${COAST_EDGE}+sin(z*.044)*.96+sin(z*.092+.4)*.48+sin(t*.61+z*.023)*1.05+sin(t*.91-z*.051)*.29;
}
float swell(vec2 p,float t){
 return sin(p.x*.76+t*1.63+sin(p.y*.082)*.59)*.13+
        sin(p.x*.38+p.y*.14+t*1.14)*.094+sin(p.x*.24-p.y*.17+t*.83)*.063;
}`;
function beachMaterial(){
 const m=pbr('cove-sand',1,{rough:.95,ns:.49,env:.55});
 m.onBeforeCompile=sh=>{
  sh.uniforms.uTime=WATERT;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShore;')
   .replace('#include <fog_vertex>','#include <fog_vertex>\nvShore=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vShore;uniform float uTime;'+shoreGLSL+WETCODE)
   .replace('#include <map_fragment>',`#ifdef USE_MAP
    vec2 baseUV=vUv+vec2(.56*vnoise(vShore.xz*.23),.48*vnoise(vShore.zx*.19));
    vec4 sampleA=mapTexelToLinear(texture2D(map,baseUV));
    vec2 crossed=mat2(.82,.57,-.57,.82)*baseUV*.71+vec2(.36,.71);
    vec4 sampleB=mapTexelToLinear(texture2D(map,crossed));
    diffuseColor*=mix(sampleA,sampleB,smoothstep(.22,.77,fbm2(vShore.xz*.42)));
    #endif`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec2 shoreP=vShore.xz;float irregular=fbm2(shoreP*vec2(.34,.16));
    float wet=smoothstep(-4.9,-.22,shoreP.x-shoreLine(shoreP.y,uTime*.17)+irregular*1.2);
    float wrack=1.-smoothstep(.16,.87,abs(shoreP.x-(${COAST_EDGE}-4.75+sin(shoreP.y*.068)*.94+irregular*2.35)));
    float wash=fbm2(shoreP*vec2(.63,.12)+irregular*1.4);
    float grit=smoothstep(.49,.78,fbm2(shoreP*vec2(13.,8.))+irregular*.12);
    diffuseColor.rgb*=mix(.84,1.07,irregular)*mix(vec3(1.),vec3(.49,.50,.53),wet);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.086,.066,.043),wrack*grit*smoothstep(.37,.60,wash)*.82);
    roughnessFactor=mix(.92,.35,wet);`);
 };m.customProgramCacheKey=()=>'graded-shore-sand';return m;
}
function buildCoastalWater(){
 topQuad(STREET.materials.coastSand,W+HALF,W+64.1,.02,-HALF-200,W+HALF+200,2.7,null,false);
 const foam=TLD.load('tex/cove-foam.webp');foam.wrapS=foam.wrapT=THREE.RepeatWrapping;foam.anisotropy=4;
 const m=new THREE.MeshStandardMaterial({color:lin(DAYLIGHT?0x34535e:0x48565c),roughness:.17,metalness:0,envMapIntensity:.78});
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,REFL.uniforms,{uTime:WATERT,foamMap:{value:foam},coastSun:{value:SUNDIR}});
  const varying='varying vec3 vSea;varying float vCrossShore;varying vec4 vMirror;';
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+varying+'uniform float uTime;uniform mat4 reflMat;'+shoreGLSL)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vCrossShore=position.x-${COAST_EDGE};
    transformed.x+=(shoreLine(position.z,uTime)-${COAST_EDGE})*exp(-max(vCrossShore,0.)*.16);
    float offshore=smoothstep(3.,15.,vCrossShore),rise=swell(transformed.xz,uTime);
    transformed.y=.052+min(.13,max(0.,rise))*(1.-offshore)+offshore*(-.30+rise);
    vSea=transformed;vMirror=reflMat*vec4(vSea,1.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+varying+'uniform float uTime;uniform sampler2D foamMap;uniform sampler2D tRefl;uniform float reflOn;uniform vec3 coastSun;'+shoreGLSL+WETCODE)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec2 p=vSea.xz;float d=max(vCrossShore,0.);float distanceToEye=length(cameraPosition-vSea);
    float detail=1.-smoothstep(90.,270.,distanceToEye);
    float broken=vnoise(vec2(p.y*.48+uTime*.15,p.x*.38))+vnoise(p*1.47)*.29;
    float curled=sin(d*.77+sin(p.y*.15+uTime*.28)*.63+uTime*1.62);
    float swash=exp(-d*.58)*smoothstep(.07,.55,broken);
    float crest=smoothstep(.45,.92,curled)*exp(-abs(d-2.75)*.30)*smoothstep(.10,.52,broken);
    vec2 fuv=vec2(p.y*.15+sin(p.x*.63+uTime*.58)*.069,d*.34+uTime*.09);
    float lace=texture2D(foamMap,fuv).r;
    float bubbles=clamp(max(swash,crest)*(.15+.85*smoothstep(.07,.60,lace*.86+broken*.36)),0.,1.);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.33,.34,.30),vec3(.75,.81,.8),lace),bubbles*.88);
    roughnessFactor=mix(.235,.61,bubbles);`)
   .replace('#include <normal_fragment_maps>',`
    float amp=smoothstep(.6,5.5,d);
    vec2 drift=vec2(.38,.12)*uTime;
    float wind=vnoise(p*vec2(1.65,.87)+drift)+detail*.28*vnoise(p*vec2(5.3,2.4)-drift*.8);
    float wx=vnoise((p+vec2(.10,0.))*vec2(1.65,.87)+drift)+detail*.28*vnoise((p+vec2(.10,0.))*vec2(5.3,2.4)-drift*.8);
    float wz=vnoise((p+vec2(0.,.10))*vec2(1.65,.87)+drift)+detail*.28*vnoise((p+vec2(0.,.10))*vec2(5.3,2.4)-drift*.8);
    float sx=(swell(p+vec2(.15,0.),uTime)-swell(p,uTime))/.15;
    float sz=(swell(p+vec2(0.,.15),uTime)-swell(p,uTime))/.15;
    vec3 seaNormal=normalize(vec3(-sx*amp+(wind-wx)*.91,1.,-sz*amp+(wind-wz)*.74));
    normal=normalize((viewMatrix*vec4(seaNormal,0.)).xyz);`)
   .replace('#include <tonemapping_fragment>',`{
    vec3 eye=normalize(cameraPosition-vSea);float fres=.035+.93*pow(1.-max(dot(eye,seaNormal),0.),4.2);
    gl_FragColor.rgb*=mix(vec3(.47,.54,.58),vec3(.83,.86,.85),fres);
    vec4 uv=vMirror;uv.xy+=seaNormal.xz*.037*uv.w;
    if(reflOn>.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2DProj(tRefl,uv).rgb,fres*.89*(1.-bubbles));
    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.70,.75,.76),bubbles*.88);
    float sunTrail=pow(max(dot(reflect(-eye,seaNormal),coastSun),0.),180.);
    gl_FragColor.rgb+=sunTrail*vec3(${DAYLIGHT?'1.35,1.26,1.08':'3.8,2.30,1.12'})*(1.-bubbles);
   }
   #include <tonemapping_fragment>`);
 };
 m.customProgramCacheKey=()=>'cove-moving-swash';
 const xs=[];for(let d=0;d<42;d+=QUALITY.level===0?1.75:.95)xs.push(W+61.4+d);
 for(let d=45;d<3000;d=d*1.24+1.8)xs.push(W+61.4+d);
 xs.push(W+3064);
 const zs=[W/2-1800];for(let z=-180;z<=W+200;z+=QUALITY.level===0?8:4)zs.push(z);zs.push(W/2+1800);
 const pos=[],ind=[];
 for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){
  pos.push(xs[i],0,zs[j]);
  if(i&&j){const k=j*xs.length+i,a=k-xs.length-1;ind.push(a,k-1,k,a,k,a+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(ind);geo.computeVertexNormals();
 const ocean=new THREE.Mesh(geo,m);ocean.receiveShadow=true;scene.add(ocean);REFL.hide.push(ocean);
 return ocean;
}
