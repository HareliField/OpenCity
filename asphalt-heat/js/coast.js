/* A continuous beach, moving swash and a progressively coarser open-water mesh. */
const COAST_EDGE=(W+61.4).toFixed(2);
const COAST_SAND={x0:W+HALF,z0:-HALF,spacing:2,nx:28,nz:(W+2*HALF)/2,samples:null};
function sampleBeachRelief(){
 const s=COAST_SAND,heights=new Float32Array((s.nx+1)*(s.nz+1));
 for(let j=0;j<=s.nz;j++)for(let i=0;i<=s.nx;i++){
  const x=s.x0+i*s.spacing,z=s.z0+j*s.spacing,u=x-W;
  if(z>=HARBOR.basin.z0&&x>HARBOR.basin.x0){
   heights[j*(s.nx+1)+i]=HARBOR.basin.bed+.08*(1+Math.sin(z*.09+x*.14))*clamp((W+64-x)/8,0,1);continue;
  }
  const inlet=3.8*Math.exp(-Math.pow((z-W*.42)/43,2));
  const margin=clamp((u-16.5)/7,0,1)*clamp((59.4-inlet-u)/9.4,0,1);
  const cove=clamp((Math.abs(z-COVE.z)-19)/13,0,1);
  const jetty=clamp((Math.abs(z-W*.42)-4)/7,0,1),harbor=clamp((Math.abs(z-971)-9)/11,0,1);
  const scallop=.056*Math.sin(z*.092+x*.35)+.031*Math.sin(z*.37-x*.57)+.020*Math.cos(x*.76+z*.19);
  heights[j*(s.nx+1)+i]=.02+margin*cove*jetty*harbor*(.119+scallop);
 }
 s.samples=heights;
}
function coastalSandHeight(x,z){
 const s=COAST_SAND;
 if(!s.samples||x<s.x0||x>s.x0+s.nx*s.spacing||z<s.z0||z>s.z0+s.nz*s.spacing)
  return z>=HARBOR.basin.z0&&x>HARBOR.basin.x0?HARBOR.basin.bed:.02;
 const a=(x-s.x0)/s.spacing,b=(z-s.z0)/s.spacing,i=Math.min(Math.floor(a),s.nx-1),j=Math.min(Math.floor(b),s.nz-1);
 const dx=a-i,dz=b-j,stride=s.nx+1,k=j*stride+i,h=s.samples;
 return dx<=dz?h[k]+dx*(h[k+stride+1]-h[k+stride])+dz*(h[k+stride]-h[k]):
  h[k]+dx*(h[k+1]-h[k])+dz*(h[k+stride+1]-h[k+1]);
}
function buildSandTiles(material){
 const s=COAST_SAND;
 if(!s.samples)sampleBeachRelief();
 for(let begin=0;begin<s.nz;begin+=16){
  const end=Math.min(s.nz,begin+16),p=[],uv=[],idx=[],stride=s.nx+1;
  for(let j=begin;j<=end;j++)for(let i=0;i<=s.nx;i++){
   const x=s.x0+i*s.spacing,z=s.z0+j*s.spacing,k=(j-begin)*stride+i;
   p.push(x,s.samples[j*stride+i],z);uv.push((x-s.x0)/2.4,(s.z0-z)/2.4);
   if(j<end&&i<s.nx)idx.push(k,k+stride,k+stride+1,k,k+stride+1,k+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();addGeo(material,g,false);
  const terrain={sandTerrain:true,begin,end},j0=cellKey(s.x0,s.z0+begin*s.spacing),j1=cellKey(s.x0,s.z0+end*s.spacing);
  for(let key=j0;key<=j1;key++){
   if(!STREET_TERRAIN.has(key))STREET_TERRAIN.set(key,[]);
   STREET_TERRAIN.get(key).push(terrain);
  }
 }
}
function sandTerrainBody(tile){
 const s=COAST_SAND,data=[];
 for(let i=0;i<=s.nx;i++){
  const strip=[];for(let j=tile.end;j>=tile.begin;j--)strip.push(s.samples[j*(s.nx+1)+i]);
  data.push(strip);
 }
 const shape=new CANNON.Heightfield(data,{elementSize:s.spacing});
 const body=new CANNON.Body({mass:0,material:PH.mat.sand,collisionFilterGroup:PHYS_GROUP.world});
 body.addShape(shape);body.position.set(s.x0,0,s.z0+tile.end*s.spacing);
 body.quaternion.setFromEuler(-Math.PI/2,0,0);PH.w.addBody(body);return body;
}
function shadeStructure(x,y,z,yaw,radius,height){
 const top=y+height*.975,edge=y+height*.777;
 weatherCeilings.push({x0:x-radius,x1:x+radius,z0:z-radius,z1:z+radius,h:top,radius});
 STATIC.push({x0:x-.024,x1:x+.024,z0:z-.024,z1:z+.024,y0:y,h:top,radius:.024});
 const tip=a=>new V3(x+radius*Math.cos(a),edge,z+radius*Math.sin(a));
 for(let i=0;i<8;i++){
  const a=tip(yaw+i*Math.PI/4),b=tip(yaw+(i+1)*Math.PI/4);
  const upper=[new V3(x,top,z),a,b],verts=[...upper,...upper.map(v=>new V3(v.x,v.y-.035,v.z))];
  const hull=[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
  const center=verts.reduce((sum,p)=>sum.add(p),new V3()).divideScalar(6);
  const planes=hull.map(face=>{
   const plane=new THREE.Plane().setFromCoplanarPoints(verts[face[0]],verts[face[1]],verts[face[2]]);
   if(plane.distanceToPoint(center)>0){face.reverse();plane.negate();}return plane;
  });
  STATIC.push({x0:Math.min(x,a.x,b.x),x1:Math.max(x,a.x,b.x),z0:Math.min(z,a.z,b.z),z1:Math.max(z,a.z,b.z),
   y0:edge-.035,h:top,walkIgnore:true,convex:{verts,hull,planes,center}});
 }
}
function beachUmbrella(x,z,color){
 const y=coastalSandHeight(x,z),yaw=Math.sin(x+z)*.39,r=1.34,h=2.306;
 shadeStructure(x,y,z,yaw,r,h);
 const vertices=[],colors=[];
 for(let i=0;i<8;i++){
  const theta=yaw+i*Math.PI/4,theta2=theta+Math.PI/4;
  const a=[r*Math.cos(theta),1.80,r*Math.sin(theta)],b=[r*Math.cos(theta2),1.80,r*Math.sin(theta2)];
  const tint=lin(i%2?color:0xd9cdb0);
  const triangle=(p,q,t)=>{vertices.push(...p,...q,...t);for(let k=0;k<3;k++)colors.push(tint.r,tint.g,tint.b);};
  const lowA=[a[0],1.72,a[2]],lowB=[b[0],1.72,b[2]];
  triangle([0,2.25,0],b,a);triangle(a,b,lowA);triangle(lowA,b,lowB);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 const material=COAST_SAND.canvas||(COAST_SAND.canvas=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,side:THREE.DoubleSide}));
 const farModel=new THREE.Mesh(g,material);farModel.position.set(x,y,z);farModel.castShadow=farModel.receiveShadow=true;scene.add(farModel);
 cyl(MAT.whiteMetal,x,y,z,.014,.014,2.25,6);
 registerStreetFitting('canvas-beach-parasol',x,y,z,[2*r,h,2*r],-yaw,{farModel,tint:color,tintMaterial:'Tinted sailcloth',reach:54});
}
function beachChair(x,z,color,yaw){
 const y=coastalSandHeight(x,z),sign=Math.cos(yaw);
 registerStreetFitting('canvas-deckchair',x,y,z,[.66,1.057,.84],yaw,{tint:color,tintMaterial:'Tinted sailcloth'});
 const support=(x0,x1,z0,z1,b,t)=>{
  const a=z+sign*z0,c=z+sign*z1;STATIC.push({x0:x+x0,x1:x+x1,z0:Math.min(a,c),z1:Math.max(a,c),y0:y+b,h:y+t});
 };
 for(const u of [-.296,.296]){
  for(const v of [-.39,.40])support(u-.025,u+.025,v-.024,v+.024,0,.10);
  support(u-.026,u+.026,-.14,.28,.55,.62);
 }
 support(-.267,.267,-.117,.25,.344,.447);
 for(let k=0;k<6;k++)support(-.267,.267,-.32+.20*k/6,-.32+.20*(k+1)/6,.359+.665*(5-k)/6,.403+.665*(6-k)/6);
}
function beachTowel(x,z,tint){
 const g=new THREE.PlaneGeometry(.9,1.86,6,20);g.rotateX(-Math.PI/2);
 const pos=g.attributes.position,colors=[],base=lin(tint),hem=lin(0xd6c9ab);
 for(let i=0;i<pos.count;i++){
  const u=pos.getX(i),v=pos.getZ(i),xx=x+u+.028*Math.sin(3*v+.5),zz=z+v+.015*Math.cos(7*u);
  const raised=.004+.014*(1+Math.sin(v*6+u*19))*Math.exp(-Math.pow((v+.29)*4.6,2));
  pos.setXYZ(i,xx,coastalSandHeight(xx,zz)+raised,zz);
  const ink=Math.abs(Math.abs(v)-.74)<.05?hem:base;colors.push(ink.r,ink.g,ink.b);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 addGeo(COAST_SAND.canvas,g,false);
}
const shoreGLSL=`
uniform float uWindSpeed;
uniform vec2 uWind;
float seaState(){return clamp(.43+.084*uWindSpeed,.43,2.20);}
float dockBasin(float z){return step(${(HARBOR.basin.z0-.001).toFixed(3)},z);}
float harborShelter(vec2 p){
 float entrance=smoothstep(${HARBOR.basin.z0-13}.,${HARBOR.basin.z0+17}.,p.y);
 return entrance*(1.-smoothstep(${W+72}.,${W+143}.,p.x));
}
float intertidalEdge(float z){
 float offset=(z-${(W*.42).toFixed(2)})/43.;
 return ${COAST_EDGE}-3.8*exp(-offset*offset);
}
float shoreLine(float z,float t){
 if(dockBasin(z)>.5)return ${HARBOR.basin.x0.toFixed(2)};
 return intertidalEdge(z)+sin(z*.044)*.96+sin(z*.092+.4)*.48+seaState()*(sin(t*.61+z*.023)*1.05+sin(t*.91-z*.051)*.29);
}
float breaker(vec2 p,float d,float t){
 float bend=1.14*sin(p.y*.093+t*.16)+.62*cos(p.y*.197-t*.12);
 float phase=d*.64+t*1.23+bend+.31*sin(d*.30+p.y*.19-t*.29);
 float set=.55+.26*cos(p.y*.081+d*.22+t*.32)+.19*sin(p.y*.197-d*.31+t*.18);
 return pow(max(0.,.5+.5*cos(phase)),7.)*smoothstep(.11,.81,set)
       *smoothstep(.38,2.4,d)*(1.-smoothstep(8.,23.+7.*set,d));
}
float swell(vec2 p,float t){
 float windWave=sin(dot(p,normalize(uWind+vec2(.001)))*.34-t*1.03);
 return seaState()*(sin(p.x*.76+t*1.63+sin(p.y*.082+p.x*.033)*.86)*.13+
        sin(p.x*.38+p.y*.14+t*1.14)*.094+sin(p.x*.24-p.y*.17+t*.83)*.063+windWave*.046);
}`;
function beachMaterial(){
 const m=pbr('pier-sand',1,{rough:.96,ns:.79,env:.41});
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,climateUniforms,{uTime:WATERT});
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShore;')
   .replace('#include <fog_vertex>','#include <fog_vertex>\nvShore=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vShore;uniform float uTime,uWetness,uSnowCover;'+shoreGLSL+COVER_SHADER+WETCODE)
   .replace('#include <map_fragment>',`#ifdef USE_MAP
    vec2 baseUV=vUv+vec2(.23*vnoise(vShore.xz*.23),.24*vnoise(vShore.zx*.19));
    vec4 sampleA=mapTexelToLinear(texture2D(map,baseUV));
    vec2 crossed=mat2(.82,.57,-.57,.82)*baseUV*.71+vec2(.36,.71);
    vec4 sampleB=mapTexelToLinear(texture2D(map,crossed));
    diffuseColor*=mix(sampleA,sampleB,smoothstep(.22,.77,fbm2(vShore.xz*.42)));
    #endif`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec2 shoreP=vShore.xz;float irregular=fbm2(shoreP*vec2(.34,.16));
    float tide=smoothstep(-4.9,-.22,shoreP.x-shoreLine(shoreP.y,uTime*.17)+irregular*1.2);
    float exposed=step(coverHeight(shoreP)-.25,vShore.y);
    float wet=max(tide,exposed*uWetness*(.49+.23*irregular));
    float wrack=1.-smoothstep(.16,.87,abs(shoreP.x-(intertidalEdge(shoreP.y)-4.75+sin(shoreP.y*.068)*.94+irregular*2.35)));
    float wash=fbm2(shoreP*vec2(.63,.12)+irregular*1.4);
    float grit=smoothstep(.49,.78,fbm2(shoreP*vec2(13.,8.))+irregular*.12);
    diffuseColor.rgb*=mix(.82,1.13,irregular)*mix(vec3(1.05,1.01,.94),vec3(.53,.52,.48),wet);
    vec2 deckDistance=max(max(vec2(${(W+40).toFixed(2)},${(W*.42-4).toFixed(2)})-shoreP,shoreP-vec2(${(W+150).toFixed(2)},${(W*.42+4).toFixed(2)})),0.);
    diffuseColor.rgb*=1.-.29*exp(-dot(deckDistance,deckDistance)*.58);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.086,.066,.043),wrack*grit*smoothstep(.37,.60,wash)*.82);
    float snow=smoothstep(.16,.79,uSnowCover+irregular*.27-.14)*exposed*(1.-tide);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.83,.90)*(.86+.13*irregular),snow);
    roughnessFactor=mix(mix(.92,.35,wet),.92,snow);`);
 };m.customProgramCacheKey=()=>'graded-shore-sand';return m;
}
function pierPileMaterial(){
 const mat=pbr('concrete',1.25,{color:0xc5b69c,rough:.85,ns:.49,env:.38});
 mat.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 pilePoint;')
   .replace('#include <fog_vertex>','#include <fog_vertex>\npilePoint=(modelMatrix*vec4(transformed,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 pilePoint;'+WETCODE)
   .replace('#include <map_fragment>',`#include <map_fragment>
    float aggregate=fbm2(pilePoint.xz*5.7+pilePoint.y*vec2(2.35,-1.87));
    float reachesTide=max(smoothstep(${(W+54).toFixed(2)},${(W+64).toFixed(2)},pilePoint.x),step(${HARBOR.basin.z0.toFixed(2)},pilePoint.z));
    float waterMark=(1.-smoothstep(.11,.53,pilePoint.y-aggregate*.22))*reachesTide;
    diffuseColor.rgb*=mix(.71,1.10,aggregate)*mix(vec3(1.),vec3(.39,.43,.33),waterMark);`);
 };
 mat.customProgramCacheKey=()=>'tidal-pier-piling';return mat;
}
function buildCoastalWater(){
 buildSandTiles(STREET.materials.coastSand);
 northBeachSpit();
 const foam=TLD.load('tex/cove-foam.webp');foam.wrapS=foam.wrapT=THREE.RepeatWrapping;foam.anisotropy=4;
 const m=new THREE.MeshStandardMaterial({color:lin(0x34535e),roughness:.17,metalness:0,envMapIntensity:.78,transparent:true});
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,REFL.uniforms,climateUniforms,{uTime:WATERT,foamMap:{value:foam}});
  const varying='varying vec3 vSea;varying float vCrossShore;varying vec4 vMirror;';
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+varying+'uniform float uTime;uniform mat4 reflMat;'+shoreGLSL)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    float dock=dockBasin(position.z);
    vCrossShore=position.x-mix(${COAST_EDGE},${HARBOR.basin.x0.toFixed(2)},dock);
    transformed.x+=(1.-dock)*(shoreLine(position.z,uTime)-${COAST_EDGE})*exp(-max(vCrossShore,0.)*.16);
    float offshore=smoothstep(7.,18.,vCrossShore),rise=swell(transformed.xz,uTime);
    transformed.y=.057+min(.095,max(0.,rise))*(1.-offshore)+offshore*(-.30+rise)
      +(.16+.12*seaState())*breaker(transformed.xz,vCrossShore,uTime);
    transformed.y=mix(transformed.y,-.34+.30*rise,harborShelter(transformed.xz));
    vSea=transformed;vMirror=reflMat*vec4(vSea,1.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+varying+'uniform float uTime,uDay,uFlash,uMist,reflOn;uniform sampler2D foamMap,tRefl;uniform vec3 uSun,uSunlight;uniform vec2 uDrift;'+shoreGLSL+WETCODE)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec2 p=vSea.xz;float d=max(vCrossShore,0.);float distanceToEye=length(cameraPosition-vSea);
    float detail=1.-smoothstep(90.,270.,distanceToEye);
    float broken=vnoise(vec2(p.y*.48+uTime*.15,p.x*.38))+vnoise(p*1.47)*.29;
    float swash=exp(-d*.50)*(.51+.49*smoothstep(.13,.61,broken));
    float breaking=breaker(p,d,uTime);
    float surge=smoothstep(.16,.82,breaking)*(.32+.68*smoothstep(.09,.73,broken));
    float wash=breaker(p,d+1.35,uTime)*smoothstep(.18,.71,broken)*.47;
    vec2 fuv=vec2(p.y*.15+sin(p.x*.63+uTime*.58)*.069,d*.34+uTime*.09);
    float lace=texture2D(foamMap,fuv).r;
    float whitecaps=smoothstep(8.,16.,uWindSpeed)*smoothstep(4.,11.,d)*smoothstep(.16,.31,swell(p,uTime)/seaState())*smoothstep(.3,.76,broken);
    float dock=harborShelter(p);
    float laceDensity=smoothstep(.19,.81,lace*.71+broken*.42);
    float bubbles=(1.-dock)*clamp(max(whitecaps,max(swash,max(surge,wash)*(.74+.33*seaState())))*(.16+.84*laceDensity),0.,1.);
    float shallows=(1.-smoothstep(3.,34.,d))*(1.-dock);
    float sandBed=.72+.28*fbm2(p*vec2(.22,.12));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.083,.148,.128)*sandBed,shallows);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.049,.082,.096),dock*.85);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.33,.34,.30),vec3(.75,.81,.8),lace),bubbles*.88);
    roughnessFactor=mix(.235,.61,bubbles);`)
   .replace('#include <normal_fragment_maps>',`
    float amp=mix(smoothstep(.6,5.5,d),.30,dock);
    vec2 drift=-uDrift*.06;
    float wind=vnoise(p*vec2(1.65,.87)+drift)+detail*.28*vnoise(p*vec2(5.3,2.4)-drift*.8);
    float wx=vnoise((p+vec2(.10,0.))*vec2(1.65,.87)+drift)+detail*.28*vnoise((p+vec2(.10,0.))*vec2(5.3,2.4)-drift*.8);
    float wz=vnoise((p+vec2(0.,.10))*vec2(1.65,.87)+drift)+detail*.28*vnoise((p+vec2(0.,.10))*vec2(5.3,2.4)-drift*.8);
    float sx=(swell(p+vec2(.15,0.),uTime)-swell(p,uTime)+(.16+.12*seaState())*(breaker(p+vec2(.15,0.),d+.15,uTime)-breaking))/.15;
    float sz=(swell(p+vec2(0.,.15),uTime)-swell(p,uTime))/.15;
    vec3 seaNormal=normalize(vec3(-sx*amp+(wind-wx)*seaState()*.91,1.,-sz*amp+(wind-wz)*seaState()*.74));
    normal=normalize((viewMatrix*vec4(seaNormal,0.)).xyz);`)
   .replace('#include <tonemapping_fragment>',`{
    vec3 eye=normalize(cameraPosition-vSea);float fres=.035+.93*pow(1.-max(dot(eye,seaNormal),0.),4.2);
    gl_FragColor.rgb*=mix(vec3(.47,.54,.58),vec3(.83,.86,.85),fres);
    vec4 uv=vMirror;uv.xy+=seaNormal.xz*.037*uv.w;
    if(reflOn>.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2DProj(tRefl,uv).rgb,fres*.89*(1.-bubbles));
    vec3 foamLight=vec3(.87,.91,.90)*(.032+.98*uDay+.58*uFlash);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,foamLight,bubbles*.96);
    float sunTrail=pow(max(dot(reflect(-eye,seaNormal),uSun),0.),180.);
    gl_FragColor.rgb+=sunTrail*uSunlight*1.85*(1.-bubbles);
    float finger=.32+fbm2(p*vec2(1.8,.93))*.85+sin(p.y*2.9+uTime*.41)*.09;
    float shallow=smoothstep(finger*.44,3.45+finger,d);
    float waterFilm=mix(.07,.93,shallow)+.20*lace*smoothstep(.13,.72,d)*(1.-shallow);
    gl_FragColor.a=mix(min(1.,waterFilm+.15*bubbles*shallow),1.,max(dockBasin(p.y),max(smoothstep(3.8,6.4,d),smoothstep(${(W+62.7).toFixed(2)},${(W+63.75).toFixed(2)},p.x))));
   }
   #include <tonemapping_fragment>`)
   .replace('#include <fog_fragment>',THREE.ShaderChunk.fog_fragment.replace('fogColor, fogFactor','fogColor, fogFactor*mix(.76,1.,uMist)'));
 };
 m.customProgramCacheKey=()=>'cove-moving-swash';
 const xs=[];for(let d=0;d<42;d+=QUALITY.level===0?1.75:.95)xs.push(W+61.4+d);
 for(let d=45;d<3000;d=d*1.24+1.8)xs.push(W+61.4+d);
 xs.push(W+3064);
 const zs=[W/2-1800,HARBOR.basin.z0-.015,HARBOR.basin.z0];
 for(let z=-180;z<=W+200;z+=QUALITY.level===0?8:4)if(z!==HARBOR.basin.z0)zs.push(z);
 zs.push(W/2+1800);zs.sort((a,b)=>a-b);
 const pos=[],ind=[];
 for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){
  const inset=zs[j]>=HARBOR.basin.z0?(W+61.4-HARBOR.basin.x0)*Math.exp(-(xs[i]-W-61.4)*.022):0;
  pos.push(xs[i]-inset,0,zs[j]);
  if(i&&j){const k=j*xs.length+i,a=k-xs.length-1;ind.push(a,k-1,k,a,k,a+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(ind);geo.computeVertexNormals();
 const ocean=new THREE.Mesh(geo,m);ocean.receiveShadow=true;scene.add(ocean);REFL.hide.push(ocean);
 return ocean;
}
