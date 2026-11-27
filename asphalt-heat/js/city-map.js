/* The city map shares the radar's north-up geometry and landmark types. */
(() => {
 const opener=$('mapOpen'),map=$('travelMap'),frame=$('mapFrame');
 const markers=$('mapMarkers'),loc=$('mapPlayer'),pin=$('mapPin');
 const confirm=$('mapConfirm'),question=$('mapQuestion'),status=$('mapStatus');
 const timeControl=$('mapTime'),clockLabel=$('mapClock'),weatherChoices=$('mapWeather');
 const legendLabels={store:'Shop',bank:'Bank',gunshop:'Gun shop',hospital:'Hospital',police:'Police',
  chop:'Salvage',spray:'Respray',harbor:'Harbor',port:'Port',lighthouse:'Lighthouse'};
 const icons={...MICON,harbor:['⚓','#abe1df'],port:['▥','#e6c57e'],lighthouse:['✦','#eedda9']};
 const weatherIcons={clear:'☀',clouds:'⛅',overcast:'☁',fog:'≋',drizzle:'☂',rain:'🌧',
  storm:'⛈',mix:'🌨',snow:'❄',blizzard:'❅'};
 let destination=null,returnFocus=null,initialized=false,previewFrame=0;

 function mapPosition(element,x,z){
  element.style.left=100*(x+HALF)*MAP_SCALE/MMB.width+'%';
  element.style.top=100*(z+HALF)*MAP_SCALE/MMB.height+'%';
 }
 function landmark(place){
  const at=place.road||place.door;
  const yaw=SIDEANG[place.side];
  const x=at.x+(place.road?0:Math.sin(yaw)*2.4);
  const z=at.z+(place.road?0:Math.cos(yaw)*2.4);
  return {kind:place.kind,name:place.name,x,z,yaw};
 }
 function setup(){
  map.width=MMB.width;map.height=MMB.height;
  frame.style.setProperty('--map-ratio',String(MMB.width/MMB.height));
  map.getContext('2d').drawImage(MMB,0,0);
  const destinations=places.map(landmark);
  const washHouse=globalThis.WashHouse?.destination();
  if(washHouse)destinations.push({...washHouse,kind:'store'});
  destinations.push({kind:'lighthouse',name:'Lighthouse Cove',x:COVE.x-6,z:COVE.z,yaw:Math.PI/2});
  destinations.push({kind:'harbor',name:HARBOR.name,x:HARBOR.quay.x0+2,z:(HARBOR.approach.z0+HARBOR.approach.z1)/2});
  for(const gate of FREIGHT.gates)destinations.push({kind:'port',name:gate.name,x:gate.x,z:FREIGHT.z0+10});
  for(const target of destinations){
   const [icon,color]=icons[target.kind];
   const button=document.createElement('button');
   button.type='button';button.className='map-marker';button.textContent=icon;
   button.title=target.name;button.setAttribute('aria-label',legendLabels[target.kind]+': '+target.name);
   button.style.setProperty('--marker-color',color);
   mapPosition(button,target.x,target.z);
   button.addEventListener('click',()=>choose(target,button));
   markers.append(button);
  }
  for(const [kind,label] of Object.entries(legendLabels)){
   const span=document.createElement('span'),badge=document.createElement('b');
   badge.textContent=icons[kind][0];badge.style.setProperty('--marker-color',icons[kind][1]);
   badge.setAttribute('aria-hidden','true');span.append(badge,label);$('mapLegend').append(span);
  }
  for(const [key,front] of Object.entries(WEATHER_FRONTS)){
   const button=document.createElement('button');
   button.type='button';button.className='map-weather-choice';button.textContent=weatherIcons[key];
   button.dataset.weather=key;button.title=front.label;button.setAttribute('aria-label',front.label);
   button.addEventListener('click',()=>setConditions(undefined,key));
   weatherChoices.append(button);
  }
  initialized=true;
 }
 function syncClimate(){
  const minutes=Math.min(1439,Math.floor(weather.hour*60+1e-6));
  if(Number(timeControl.value)!==minutes)timeControl.value=String(minutes);
  clockLabel.textContent=weather.clockText;
  timeControl.setAttribute('aria-valuetext',weather.clockText);
  $('mapWeatherName').textContent=WEATHER_FRONTS[weather.kind].label;
  for(const button of weatherChoices.children)button.setAttribute('aria-pressed',String(button.dataset.weather===weather.kind));
 }
 function setConditions(hour,kind){
  setCityEnvironment(hour,kind);
  hud();syncClimate();
  if(!previewFrame)previewFrame=requestAnimationFrame(()=>{
   previewFrame=0;
   if(cityMap.open)renderFrame(time);
  });
 }
 function clearSelection(){
  destination=null;pin.hidden=confirm.hidden=true;status.textContent='';
 }
 function choose(target,source){
  destination=target;returnFocus=source;
  mapPosition(pin,target.x,target.z);
  question.textContent=target.name?'Travel to '+target.name+'?':'Travel to this location?';
  pin.hidden=confirm.hidden=false;status.textContent='';
  $('mapCancel').focus({preventScroll:true});
  confirm.scrollIntoView({block:'nearest'});
 }
 function open(){
  if(state!=='play'||shopOpen||caseCamera.enabled||cityMap.open)return;
  if(!initialized)setup();
  resetGameControls();
  clearSelection();
  returnFocus=null;
  const at=player.car?.pos||player.pos;
  mapPosition(loc,at.x,at.z);
  syncClimate();
  cityMap.showModal();
  cityMap.scrollTop=0;
 }
 function landing(target){
  const car=player.car,radius=car?Math.hypot(car.spec.W,car.spec.L)/2:.36;
  if(target.x<MINX||target.z<MINZ||target.x>W+150||target.z>FREIGHT.z1)return null;
  // Clamp nothing to the shore. A point in the water should stay invalid.
  if(target.z>MAXZ&&!inFreightPort(target.x,target.z)&&!inDockYard(target.x,target.z))return null;
  const coastMax=Math.abs(target.z-W*.42)<3.76&&target.x>W+39?W+149.45:harborWalkingLimit(target.z)??MAXX;
  if(target.x>coastMax&&!inFreightPort(target.x,target.z)&&!inDockYard(target.x,target.z))return null;
  for(let range=0;range<=36;range+=4){
   const samples=range?Math.max(8,Math.ceil(range)):1;
   for(let i=0;i<samples;i++){
    const angle=i*2*Math.PI/samples,x=target.x+Math.cos(angle)*range,z=target.z+Math.sin(angle)*range;
    const at=new V3(x,groundY(x,z),z);
    if(collideWorld(at,radius))continue;
    if(cars.some(other=>other!==car&&bodyInsideCar(other,at,radius)))continue;
    if(peds.some(p=>!p.dead&&Math.abs(p.pos.y-at.y)<1.5&&dist2(p.pos,at)<radius+.7))continue;
    return at;
   }
  }
  return null;
 }
 opener.addEventListener('click',open);
 $('mapClose').addEventListener('click',()=>cityMap.close());
 cityMap.addEventListener('close',()=>{
  clearSelection();clock.getDelta();resetGraphicsSample();
  if(state==='play')opener.focus({preventScroll:true});
 });
 map.addEventListener('click',event=>{
  const rect=map.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*map.width/MAP_SCALE-HALF;
  const z=(event.clientY-rect.top)/rect.height*map.height/MAP_SCALE-HALF;
  choose({x,z},null);
 });
 $('mapCancel').addEventListener('click',()=>{
  clearSelection();
  (returnFocus||$('mapClose')).focus({preventScroll:true});
 });
 $('mapGo').addEventListener('click',()=>{
  if(!destination||state!=='play')return;
  const landed=landing(destination);
  if(!landed){
   status.textContent='No clear landing spot. Choose another location.';
   return;
  }
  relocatePlayer(landed,destination.yaw??player.yaw);
  hud();drawMap();renderFrame(time);
  globalThis.asphaltAgentEvent?.('mapTravel',{destination:destination.name,position:{x:player.pos.x,y:player.pos.y,z:player.pos.z}});
  cityMap.close();
 });
 timeControl.addEventListener('input',()=>setConditions(Number(timeControl.value)/60));
})();
