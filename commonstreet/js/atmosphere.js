// Sky and city lights use the same solar elevation, cloud cover and visibility.
const todaysDate=new Date();
const firstDay=1+Math.floor((Date.UTC(todaysDate.getFullYear(),todaysDate.getMonth(),todaysDate.getDate())-
                            Date.UTC(todaysDate.getFullYear(),0,1))/86400000);
const requestedHour=qp.get('hour');
const hasCustomHour=requestedHour!==null && requestedHour.trim()!=='' && Number(requestedHour)>=0 && Number(requestedHour)<24;
const launchHour=hasCustomHour?Number(requestedHour) : startingHour(qp.get('light'),firstDay);
const launchFront=Object.hasOwn(WEATHER_FRONTS,qp.get('weather'))?qp.get('weather'):'clouds';
const weather=new CoastalWeather(firstDay,launchHour,launchFront);
const reducedFlashes=matchMedia('(prefers-reduced-motion: reduce)');

const climateUniforms={
 uSun:{value:new V3()},uMoon:{value:new V3()},uSunlight:{value:new THREE.Color()},
 uHorizon:{value:new THREE.Color()},uZenith:{value:new THREE.Color()},uCloudLight:{value:new THREE.Color()},
 uDay:{value:1},uDusk:{value:0},uCloud:{value:0},uMist:{value:0},uFlash:{value:0},
 uStrikeAngle:{value:0},uStarAngle:{value:0},uMoonLight:{value:0},uLamp:{value:0},
 uWind:{value:new THREE.Vector2()},uDrift:{value:new THREE.Vector2()},uSeconds:{value:0},
 uWetness:{value:0},uSnowCover:{value:0},uRain:{value:0},uWindSpeed:{value:0},uCover:{value:null}
};
const COVER_SHADER=`
 uniform sampler2D uCover;
 float coverHeight(vec2 worldXZ){
  vec2 uv=(worldXZ-vec2(${WEATHER_ORIGIN.toFixed(1)}))/${(WEATHER_MAP_SIZE*WEATHER_CELL).toFixed(1)};
  vec2 h=texture2D(uCover,clamp(uv,0.,1.)).rg;
  return dot(h,vec2(4080.,15.9375));
 }`;
let weatherCover=null;
function initWeatherCover() {
 weatherCover=buildWeatherCover();
 const t=new THREE.DataTexture(weatherCover.pixels,WEATHER_MAP_SIZE,WEATHER_MAP_SIZE,THREE.RGBAFormat);
 t.minFilter=t.magFilter=THREE.NearestFilter;
 t.generateMipmaps=false; t.needsUpdate=true;
 climateUniforms.uCover.value=t;
}

scene.fog=new THREE.FogExp2(0xffffff,weather.extinction);
THREE.ShaderChunk.fog_vertex='#ifdef USE_FOG\n fogDepth=length(mvPosition.xyz);\n#endif';
// The daylight reflection probe is filtered once. Its radiance follows the hemisphere
// light, including on newly streamed or instanced paint and glass materials.
THREE.ShaderChunk.lights_fragment_maps+=`
 #if defined(USE_ENVMAP) && defined(STANDARD) && NUM_HEMI_LIGHTS > 0
  vec3 skyRadiance=hemisphereLights[0].skyColor*1.18;
  #ifdef RE_IndirectDiffuse
   iblIrradiance*=skyRadiance;
  #endif
  #ifdef RE_IndirectSpecular
   radiance*=skyRadiance;clearcoatRadiance*=skyRadiance;
  #endif
 #endif`;

const hemi=new THREE.HemisphereLight(0xffffff,0xffffff,1);
const sun=new THREE.DirectionalLight(0xffffff,1),keyDirection=new V3();
sun.castShadow=true; sun.shadow.mapSize.setScalar(QUALITY.shadow);
Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:500});
sun.shadow.bias=-.00019; sun.shadow.normalBias=.023;
scene.add(hemi,sun,sun.target);

const skyMat=new THREE.ShaderMaterial({
 side:THREE.BackSide,depthWrite:false,fog:false,
 uniforms:{...climateUniforms,tSky:{value:null},tEvening:{value:null},tCoastalClouds:{value:null},eveningReady:{value:0},coastalCloudsReady:{value:0}},
 vertexShader:`varying vec3 vD;
  void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
 fragmentShader:`
  uniform sampler2D tSky,tEvening,tCoastalClouds;
  uniform float eveningReady,coastalCloudsReady;
  uniform vec3 uSun,uMoon,uHorizon,uZenith,uCloudLight,uSunlight;
  uniform vec2 uDrift;
  uniform float uDay,uDusk,uCloud,uMist,uFlash,uStrikeAngle,uStarAngle,uMoonLight;
  varying vec3 vD;
  ${WETCODE}
  void main(){
   vec3 d=normalize(vD);
   float el=max(d.y,0.),height=smoothstep(-.015,.68,el);
   vec3 col=mix(uHorizon,uZenith,pow(height,.52));
   float facing=max(dot(normalize(d.xz+1e-5),normalize(uSun.xz+1e-5)),0.);
   float sd=max(0.,dot(d,uSun));
   col+=vec3(1.16,.34,.075)*uDusk*pow(facing,3.5)*exp(-el*4.);
   // Rotate the photographed cove horizon to the moving sun. The source disc
   // was at azimuth -.423 and elevation .051 radians; the live disc follows below.
   float golden=eveningReady*smoothstep(-.06,.025,uSun.y)*(1.-smoothstep(.09,.27,uSun.y))*(1.-smoothstep(.30,.79,uCloud));
   if(golden>.002){
    vec2 uv=vec2(fract(.5+(atan(d.z,d.x)-atan(uSun.z,uSun.x)-.423)*.159155),
                 .5+(asin(clamp(d.y,-1.,1.))-asin(clamp(uSun.y,-1.,1.))+.051)*.31831);
    vec3 sampleColor=texture2D(tEvening,uv).rgb;
    float discDistance=length((uv-vec2(.43268,.51623))*vec2(2.,1.));
    if(discDistance<.012)sampleColor=mix(texture2D(tEvening,uv+vec2(.010,0.)).rgb,sampleColor,smoothstep(.003,.012,discDistance));
    col=mix(col,4.*pow(sampleColor,vec3(2.2)),golden*.88);
   }
   col+=uSunlight*(.17*pow(sd,11.)+.48*pow(sd,140.)+1.1*pow(sd,1750.));
   float sunDisc=(1.-smoothstep(.0041,.0055,length(d-uSun)))*(1.-smoothstep(.75,.98,uCloud));
   col+=vec3(8.2,7.4,5.8)*sunDisc*smoothstep(-.012,.004,uSun.y);

   float lon=atan(d.z,d.x)/6.2831853+.5,lat=asin(clamp(d.y,-1.,1.))*.318309886;
   // The star field turns with the sky and keeps a fixed pattern as the observer moves.
   vec3 pole=vec3(0.,.643,-.766);
   vec3 starsDir=d*cos(uStarAngle)+cross(pole,d)*sin(uStarAngle)+pole*dot(pole,d)*(1.-cos(uStarAngle));
   vec2 starUV=vec2(atan(starsDir.z,starsDir.x)*.159155+.5,asin(clamp(starsDir.y,-1.,1.))*.31831+.5)*vec2(760.,380.);
   vec2 starCell=floor(starUV);
   float rarity=hash21(starCell),star=1.-smoothstep(.045,.21,length(fract(starUV)-.5));
   float starlight=(1.-smoothstep(-.21,-.055,uSun.y))*(1.-uMoonLight*.45);
   col+=vec3(.52,.65,.90)*starlight*smoothstep(.974,.997,rarity)*star*smoothstep(.045,.28,el);
   vec3 moonOffset=d-uMoon*dot(d,uMoon);
   float mr=length(moonOffset)/.0051;
   if(dot(d,uMoon)>0. && mr<1.15){
    vec3 normal=normalize(moonOffset/.0051-uMoon*sqrt(max(0.,1.-mr*mr)));
    float lit=smoothstep(-.06,.12,dot(normal,uSun));
    col+=vec3(.86,.95,1.15)*(.035+lit*1.6)*(1.-smoothstep(.84,1.15,mr));
   }
   col+=vec3(.08,.12,.20)*uMoonLight*pow(max(0.,dot(d,uMoon)),250.);

   // Retain the local panorama's fine cloud texture. Mask its baked sun before
   // lighting the cloud bank from the simulated sun and adding a lower, drifting deck.
   vec2 uv=vec2(fract(lon+uDrift.x*.000017),lat+.5+sin(uDrift.y*.00012)*.012);
   vec3 photo=texture2D(tSky,uv).rgb;
   vec2 offset=vec2(fract(uv.x-.55+.5)-.5,uv.y-.77);
   photo=mix(texture2D(tSky,vec2(fract(uv.x+.33),uv.y)).rgb,photo,smoothstep(.025,.12,length(offset)));
   float fine=smoothstep(.53,.91,photo.r/max(.12,photo.b))*smoothstep(.28,.73,photo.r);
   vec2 plane=d.xz/max(.095,el+.075);
   vec2 field=plane*1.45-uDrift*.00072;
   float lower=.72*fbm2(field)+.28*fbm2(field*2.47+1.9);
   float broken=smoothstep(.97-uCloud*.83,1.14-uCloud*.81,lower*.65+fine*.51);
   float bank=fine*smoothstep(.055,.45,uCloud);
   float deck=smoothstep(.58,.96,uCloud)*(.94+.06*lower);
   float cover=clamp(max(deck,max(bank,broken))*smoothstep(-.07,.065,d.y),0.,.995);
   float relief=.42+.60*dot(photo,vec3(.25,.60,.15))+.36*(lower-.42);
   vec3 cloud=uCloudLight*relief+vec3(.65,.25,.085)*uDusk*pow(facing,2.5)*(1.-deck);
   cloud+=uSunlight*.22*pow(sd,9.)*(.4+fine)*(1.-deck);
   col=mix(col,cloud,cover);
   float coastalBlend=coastalCloudsReady*uDay*smoothstep(.08,.28,uSun.y)*smoothstep(.09,.35,uCloud);
   coastalBlend*=(1.-smoothstep(.57,.91,uCloud))*smoothstep(-.012,.045,d.y);
   if(coastalBlend>.003){
    vec2 fieldUV=vec2(fract(lon+uDrift.x*.000013),clamp(lat*2.+uDrift.y*.000001,0.,1.));
    vec3 fieldColor=texture2D(tCoastalClouds,fieldUV).rgb;
    vec3 daylight=pow(fieldColor,vec3(2.2))*1.38;
    daylight+=uSunlight*(.19*pow(sd,11.)+.38*pow(sd,140.))+vec3(8.2,7.4,5.8)*sunDisc;
    col=mix(col,daylight,.91*coastalBlend);
   }
   col=mix(col,uHorizon,uMist*(.75-.5*height));

   vec2 boltDir=vec2(cos(uStrikeAngle),sin(uStrikeAngle));
   float nearBolt=max(0.,dot(normalize(d.xz+1e-5),boltDir));
   float lateral=dot(d.xz,vec2(-boltDir.y,boltDir.x));
   float bend=.034*sin(el*26.+uStrikeAngle)+.012*sin(el*126.)+.006*sin(el*305.);
   float bolt=(1.-smoothstep(.0006,.0028,abs(lateral-bend)))*smoothstep(.018,.07,el)*(1.-smoothstep(.24,.30,el))*step(.9,nearBolt);
   col+=vec3(.58,.70,1.)*uFlash*(.13+1.45*pow(nearBolt,12.)*cover+4.3*bolt);
   col=mix(col,uHorizon,1.-smoothstep(-.10,.018,d.y));
   gl_FragColor=vec4(col,1.);
   #include <tonemapping_fragment>
   #include <encodings_fragment>
  }`
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,48,24),skyMat);
sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky);

async function loadSky() {
 const loader=new THREE.TextureLoader(),imageLoader=new THREE.ImageLoader();
 const loadPanorama=(file,uniform)=>loader.loadAsync(file).then(t=>{
  t.minFilter=THREE.LinearFilter; t.generateMipmaps=false; t.wrapS=THREE.RepeatWrapping;
  uniform.value=t;
 });
 const panorama=loadPanorama('tex/sky-daylight.jpg',skyMat.uniforms.tSky);
 const clouds=loadPanorama('tex/coastal-clouds.webp',skyMat.uniforms.tCoastalClouds).then(()=>{skyMat.uniforms.coastalCloudsReady.value=1;});
 const evening=loadPanorama('tex/sky-coastal-evening.jpg',skyMat.uniforms.tEvening).then(()=>{skyMat.uniforms.eveningReady.value=1;});
 const probe=imageLoader.loadAsync('tex/env-daylight.jpg').then(im=>{
  const [c,g]=cvs(im.width,im.height); g.drawImage(im,0,0);
  const bytes=g.getImageData(0,0,c.width,c.height).data,linear=new Float32Array(bytes.length);
  for(let i=0;i<bytes.length;i+=4){
   for(let k=0;k<3;k++) linear[i+k]=Math.min(1.8,Math.pow(bytes[i+k]/255,2.2)*2.65);
   linear[i+3]=1;
  }
  const t=new THREE.DataTexture(linear,c.width,c.height,THREE.RGBAFormat,THREE.FloatType);
  t.mapping=THREE.EquirectangularReflectionMapping; t.flipY=true; t.needsUpdate=true;
  t.magFilter=t.minFilter=THREE.LinearFilter;
  const pm=new THREE.PMREMGenerator(renderer);
  try {scene.environment=pm.fromEquirectangular(t).texture;}
  finally {pm.dispose();t.dispose();}
 });
 for(const result of await Promise.allSettled([panorama,clouds,evening,probe])) if(result.status==='rejected') console.warn(result.reason);
}

const skyPalette={
 nightHorizon:new THREE.Color(.022,.032,.052),dayHorizon:new THREE.Color(.68,.83,1.05),
 nightZenith:new THREE.Color(.003,.008,.021),dayZenith:new THREE.Color(.10,.25,.53),
 twilightHorizon:new THREE.Color(.47,.23,.18),twilightZenith:new THREE.Color(.046,.065,.16),
 nightCloud:new THREE.Color(.025,.034,.054),dayCloud:new THREE.Color(1.32,1.42,1.56),
 stormCloud:new THREE.Color(.25,.30,.365),warmSun:new THREE.Color(1,.38,.14),
 noonSun:new THREE.Color(1,.91,.78),moon:new THREE.Color(.43,.58,.88)
};
const cloudShade=new THREE.Color();
function applyWeatherLight() {
 const w=weather,u=climateUniforms,p=skyPalette;
 u.uSun.value.copy(w.sun); u.uMoon.value.copy(w.moon);
 u.uDay.value=w.daylight; u.uDusk.value=w.twilight; u.uLamp.value=w.lamps;
 u.uCloud.value=w.cloud; u.uMist.value=1-weatherRamp(95,520,1.73/w.extinction);
 u.uFlash.value=reducedFlashes.matches?0:w.flash; u.uStrikeAngle.value=w.strikeAngle||0;
 u.uStarAngle.value=(w.hour/24+w.day/365)*WEATHER_TAU;
 const moonlight=w.moonFraction*weatherRamp(-.02,.22,w.moon.y)*(1-.83*w.cloud);
 u.uMoonLight.value=moonlight;
 const stormShade=weatherRamp(.52,.99,w.cloud);
 cloudShade.lerpColors(p.dayCloud,p.stormCloud,stormShade);
 u.uCloudLight.value.lerpColors(p.nightCloud,cloudShade,w.daylight).lerp(p.twilightHorizon,w.twilight*.41);
 u.uHorizon.value.lerpColors(p.nightHorizon,p.dayHorizon,w.daylight).lerp(p.twilightHorizon,w.twilight*.75);
 u.uHorizon.value.lerp(u.uCloudLight.value,stormShade*.85);
 u.uZenith.value.lerpColors(p.nightZenith,p.dayZenith,w.daylight).lerp(p.twilightZenith,w.twilight*.75);
 u.uSunlight.value.lerpColors(p.warmSun,p.noonSun,weatherRamp(.05,.51,w.sun.y)).multiplyScalar(w.direct);
 u.uWind.value.set(w.windX,w.windZ); u.uWindSpeed.value=w.gust;
 u.uDrift.value.set(w.travelX,w.travelZ); u.uSeconds.value=w.elapsed;
 u.uWetness.value=w.wetness; u.uRain.value=w.rain; u.uSnowCover.value=w.snowCover;
 scene.fog.density=w.extinction;
 scene.fog.color.copy(u.uHorizon.value).addScalar(u.uFlash.value*.12);
 if (!POST) scene.fog.color.convertLinearToSRGB();
 hemi.color.setRGB(.43+.33*w.daylight,.57+.25*w.daylight,.85+.06*w.daylight);
 hemi.color.lerp(p.noonSun,.24*w.twilight*(1-stormShade));
 hemi.groundColor.setRGB(.16+.22*w.daylight,.15+.17*w.daylight,.19+.08*w.daylight);
 hemi.intensity=.095+.075*moonlight+w.daylight*(1.06-.38*stormShade)+u.uFlash.value*.65;
 if (w.sun.y>-.018) {
  keyDirection.copy(w.sun); sun.color.lerpColors(p.warmSun,p.noonSun,weatherRamp(.05,.51,w.sun.y));
  sun.intensity=2.03*w.direct;
 } else {
  keyDirection.copy(w.moon); sun.color.copy(p.moon); sun.intensity=.20*moonlight;
 }
 if(ATLAS.mat) {
  ATLAS.mat.emissiveIntensity=.13+.77*w.lamps;
  ATLAS.neon.color.setScalar(.84+1.65*w.lamps);
 }
 if(beamMat) beamMat.opacity=.085+.14*w.headlights;
}

function setCityEnvironment(hour,kind,opening=false) {
 if(hour!==undefined && (!Number.isFinite(hour)||hour<0||hour>=24)) throw new Error('hour must be from 0 to less than 24');
 if(kind!==undefined && !Object.hasOwn(WEATHER_FRONTS,kind)) throw new Error('Choose a listed weather type');
 if(hour!==undefined) weather.hour=hour;
 if(kind!==undefined) {
  weather.setFront(kind,true);
  if(opening) weather.settleGround();
 }
 weather.updateLight(); applyWeatherLight();
 if(player) {
  updateCoveBeacon(0);
  updateStreetLighting(1,player.pos.x,player.pos.z);
  for(const c of cars){
   if(opening)updateVehicleSnow(c,0,true);
   setCarLights(c,!!c.braking);
   if(dist2(c.pos,player.pos)<70)updateHeadlights(c,1);
  }
  updateDrivingLight();
  const target=caseCamera.focus||player.pos;
  sun.target.position.copy(target); sun.position.copy(target).addScaledVector(keyDirection,250);
 }
}
