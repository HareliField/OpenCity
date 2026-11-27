// The volume wraps in world space so drops stay in place when the camera moves.
// Rain and snow have different fall speeds, shapes and responses to the same wind.
const precipLights={
 uEye:{value:new V3()},uPixelHeight:{value:800},uCarLight:{value:new V3()},
 uCarDir:{value:new V3()},uCarRange:{value:0},
 uStreetPos:{value:Array.from({length:4},()=>new V3())},
 uStreetPower:{value:new Float32Array(4)}
};
const precipVertex=`
 uniform vec3 uEye;
 uniform vec2 uWind,uDrift;
 uniform float uSeconds,uPixelHeight;
 attribute float trail;
 varying vec3 vDrop;
 varying float vFade;
 void main(){
  float id=position.x+position.z*.37;
  vec3 volume=vec3(48.,29.,48.);
  vec3 origin=uEye-vec3(24.,8.,24.);
  vec3 drift;
  #ifdef FLAKE
   drift=vec3(uDrift.x*.49,-uSeconds*(.84+id*.84),uDrift.y*.49);
   drift.xz+=vec2(sin(uSeconds*1.4+id*43.),cos(uSeconds*.94+id*85.))*(.34+id*.41);
  #else
   drift=vec3(uDrift.x*.54,-uSeconds*(13.+id*7.),uDrift.y*.54);
  #endif
  vec3 local=mod(position*volume+drift-origin,volume);
  vDrop=origin+local;
  #ifndef FLAKE
   vDrop+=trail*vec3(-uWind.x*.54,13.+id*7.,-uWind.y*.54)*(.017+id*.010);
  #endif
  vec4 mv=viewMatrix*vec4(vDrop,1.);
  gl_Position=projectionMatrix*mv;
  vec3 margins=min(local,volume-local);
  vFade=smoothstep(0.,2.,min(margins.x,min(margins.y,margins.z)))*smoothstep(.40,1.6,-mv.z);
  #ifdef FLAKE
   gl_PointSize=clamp((.020+id*.030)*uPixelHeight*projectionMatrix[1][1]/max(.7,-mv.z),1.15,7.5);
  #endif
 }`;
const precipFragment=`
 uniform float uDay,uFlash,uCarRange,uLamp;
 uniform vec3 uCarLight,uCarDir,uStreetPos[4];
 uniform float uStreetPower[4];
 varying vec3 vDrop;
 varying float vFade;
 ${COVER_SHADER}
 void main(){
  if(vFade<.01 || vDrop.y<coverHeight(vDrop.xz)+.04)discard;
  vec3 toDrop=vDrop-uCarLight;
  float range=length(toDrop);
  float lit=smoothstep(.87,.95,dot(toDrop/max(range,.01),uCarDir))*(1.-smoothstep(uCarRange*.48,max(.1,uCarRange),range))*step(.1,uCarRange);
  for(int i=0;i<4;i++){
   vec3 delta=vDrop-uStreetPos[i];
   lit=max(lit,uStreetPower[i]*(1.-smoothstep(1.,11.,length(delta)))*(1.-smoothstep(-.3,1.4,delta.y)));
  }
  vec3 color=mix(vec3(.11,.17,.29),vec3(.70,.79,.91),uDay);
  color=mix(color,vec3(1.21,1.02,.72),lit)+uFlash*.35;
  #ifdef FLAKE
   vec2 p=gl_PointCoord*2.-1.;
   float alpha=1.-smoothstep(.32,1.,dot(p,p));
   color+=vec3(.15,.16,.17);
   gl_FragColor=vec4(color,alpha*vFade*.86);
  #else
   gl_FragColor=vec4(color,vFade*(.22+.15*uDay+.27*lit));
  #endif
  #include <tonemapping_fragment>
  #include <encodings_fragment>
 }`;

function makePrecipitation(flakes,capacity) {
 const vertices=flakes?1:2, positions=new Float32Array(3*capacity*vertices), trail=new Float32Array(capacity*vertices);
 for(let i=0;i<capacity;i++){
  const x=Math.random(),y=Math.random(),z=Math.random();
  for(let j=0;j<vertices;j++){
   const idx=i*vertices+j;
   positions[idx*3]=x;positions[idx*3+1]=y;positions[idx*3+2]=z;trail[idx]=j;
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('trail',new THREE.BufferAttribute(trail,1));
 const material=new THREE.ShaderMaterial({uniforms:{...climateUniforms,...precipLights},
  defines:flakes?{FLAKE:1}:{},vertexShader:precipVertex,fragmentShader:precipFragment,transparent:true,depthWrite:false});
 const object=flakes?new THREE.Points(geometry,material):new THREE.LineSegments(geometry,material);
 object.frustumCulled=false; object.visible=false; object.renderOrder=4;
 scene.add(object); REFL.hide.push(object);
 return object;
}
const fallingRain=makePrecipitation(false,6200),fallingSnow=makePrecipitation(true,5400);
function preparePrecipitation() {
 const w=weather,scale=[.38,.66,1][QUALITY.level]||.38;
 const rainCount=Math.round(6200*scale*w.rain),snowCount=Math.round(5400*scale*w.snow);
 fallingRain.visible=rainCount>6; fallingSnow.visible=snowCount>6;
 if(!fallingRain.visible&&!fallingSnow.visible)return;
 fallingRain.geometry.setDrawRange(0,rainCount*2); fallingSnow.geometry.setDrawRange(0,snowCount);
 const u=precipLights;
 u.uEye.value.copy(camera.position); u.uPixelHeight.value=renderer.domElement.height*.5;
 const [left,right]=drivingLights;
 u.uCarLight.value.copy(left.position).lerp(right.position,.5);
 u.uCarDir.value.copy(left.target.position).lerp(right.target.position,.5).sub(u.uCarLight.value).normalize();
 u.uCarRange.value=left.intensity>.1?left.distance:0;
 for(let i=0;i<STREET.lights.length;i++){
  const l=STREET.lights[i];
  u.uStreetPos.value[i].copy(l.position); u.uStreetPower.value[i]=l.intensity>0?w.lamps:0;
 }
}

// All weather audio is downstream of the existing Sound button and master gain.
let weatherSound=null;
function initWeatherSound() {
 const bed=(type,frequency)=>{
  const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
  source.buffer=nbuf;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.55;
  gain.gain.value=0; source.connect(filter).connect(gain).connect(master); source.start();
  return {filter,gain:gain.gain};
 };
 weatherSound={rain:bed('highpass',1200),wind:bed('lowpass',320)};
}
function updateWeatherSound() {
 if(!weatherSound||!ac||master.gain.value===0) return;
 const p=camera.position,t=ac.currentTime;
 const covered=weatherCover && p.y<weatherCover.heightAt(p.x,p.z)-.22;
 const shelter=covered?.18:1;
 weatherSound.rain.gain.setTargetAtTime(weather.rain*.23*shelter,t,.35);
 weatherSound.wind.gain.setTargetAtTime(weather.gust*.009*shelter,t,.65);
 weatherSound.wind.filter.frequency.setTargetAtTime(110+weather.gust*25,t,.65);
 if(weather.thunderDue){
  const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
  const distance=weather.strikeMetres, duration=1.65+distance/1050;
  source.buffer=nbuf;source.loop=true;filter.type='lowpass';
  filter.frequency.setValueAtTime(420-distance*.09,t);filter.frequency.exponentialRampToValueAtTime(64,t+duration);
  gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime((.48-distance*.0001)*shelter,t+.09);
  gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  source.connect(filter).connect(gain).connect(master);source.start(t);source.stop(t+duration);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
}
