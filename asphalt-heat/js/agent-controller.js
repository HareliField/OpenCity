// One controller per opt-in game tab. Commands and observations are JSON.
(() => {
 if (qp.get('agent') !== '1') return;

 let paused = true;
 let sequence = 0;
 const history = [];
 const ids = new WeakMap();
 let serial = 0;
 const id = object => {
  if (!ids.has(object)) ids.set(object, ++serial);
  return ids.get(object);
 };
 const point = ({x,y,z}) => ({x,y:y ?? groundY(x,z),z});
 function record(type, data) {
  history.push({sequence:++sequence,time,type,...data});
  if (history.length > 512) history.shift();
 }
 globalThis.asphaltAgentEvent = record;
 window.addEventListener('error', e => record('error',{message:e.message || 'Resource failed',source:e.filename || e.target?.src}), true);
 window.addEventListener('unhandledrejection', e => record('error',{message:String(e.reason)}));

 const groups = ['vehicles','people','helicopters','pickups','doors','props','junctions','blocks'];
 const help = {
  residents:{op:'residents',query:'tailor',limit:10},meet:{op:'meet',personId:'AH-R0002'},observe:{op:'observe'}, places:{op:'places'}, jump:{op:'jump',to:'start'},
  coordinates:{op:'jump',x:256,z:320,yaw:0}, world:{op:'world',group:'vehicles',radius:60,offset:0,limit:20},
  step:{op:'step',ticks:15,forward:1,turn:0,sprint:false,fire:false},
  look:{op:'step',ticks:1,lookYaw:0.5,lookPitch:0.1},
  act:{op:'act',action:'interact'}, events:{op:'events',after:0}, police:{op:'police'},
  clock:{op:'clock',paused:true}, stats:{op:'stats',cash:1600,armor:100,wanted:0}, spawn:{op:'spawn',model:'sport'},
  environment:{op:'environment',hour:19,weather:'rain'}, weatherTypes:Object.keys(WEATHER_FRONTS),
  models:{op:'models'}, groups
 };
 function number(value, name, min, max, integer=false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
   throw new Error(name+' must be '+(integer?'an integer':'a number')+' between '+min+' and '+max);
  return value;
 }
 function flag(value, name) {
  if (typeof value !== 'boolean') throw new Error(name+' must be true or false');
  return value;
 }
 function playing() {
  if (state !== 'play' || shopOpen || cityMap.open) throw new Error('Close any open menu and enter play first');
 }
 function draw() {
  if (state === 'play' || state === 'dead') { hud(); drawMap(); renderFrame(time); }
 }
 function destinations() {
  return [
   {id:'start',name:'Verve Nail Studio',x:CELL*4-HALF-.88,z:CELL*5+HALF+10},
   ...(globalThis.WashHouse?.destination()?[WashHouse.destination()]:[]),
   ...places.map((p,i)=>({id:'place-'+i,name:p.name,kind:p.kind,...point(p.road||p.interact||p.door)})),
   ...GRADE_ROADS.routes.map((r,i)=>({id:'road-'+i,name:r.name,...point(r.curve.getPointAt(.5))})),
   ...TRAFFIC_PATROL.posts.map((p,i)=>({id:'traffic-'+i,name:p.room,...point(p.point)})),
   {id:'harbor',name:HARBOR.name,x:HARBOR.quay.x0+2,z:(HARBOR.approach.z0+HARBOR.approach.z1)/2},
   ...FREIGHT.gates.map((g,i)=>({id:'gate-'+i,name:g.name,x:g.x,z:FREIGHT.z0+10}))
  ];
 }

 function entities(group) {
  switch (group) {
   case 'vehicles': return cars.map(c=>({id:id(c),position:point(c.pos),type:c.type,model:c.spec.modelName,
    plate:c.plate,driver:c.driver,officer:c.officer?.name,yaw:c.h,speed:c.speed,velocity:point(c.vel),
    health:c.hp,maxHealth:c.max,dead:c.dead,siren:c.siren,turnSignal:c.indicating||0,route:c.ai && {from:c.ai.a?.slice(),to:c.ai.b?.slice(),lane:c.ai.lane}}));
   case 'people': return [...peds,...cops,...gang,...guards,...departmentPeople].map(p=>({
    id:id(p),personId:p.personId,name:p.officer?.name||p.c?.resident?.name||p.residentName,appearance:ResidentCast.status(p.c),position:point(p.pos),team:p.team||'civilian',kind:p.kind,
    yaw:p.c?.yaw,activity:p.mode||p.officer&&PoliceDepartment.status(p.officer),health:p.hp,dead:p.dead,hostile:p.hostile})).concat(globalThis.WashHouse?.record()||[]);
   case 'helicopters': return helis.map(h=>({id:id(h),position:point(h.pos),health:h.hp,dead:h.dead,spotted:h.spotted,searchlight:point(h.sp)}));
   case 'pickups': return pickups.map(p=>({id:id(p),position:point(p),kind:p.type,amount:p.amount,available:!(p.cool>0)}));
   case 'doors': return ACCESS.doors.map(d=>({id:id(d),position:{x:d.ox,y:d.base,z:d.oz},kind:d.kind,openFraction:d.phase,target:d.target}));
   case 'props': return PROPS.list.map(p=>({id:id(p),position:point(p.renderPosition),kind:p.t,broken:p.broken,moved:p.moved}));
   case 'blocks': return blocks.map(b=>({id:id(b),position:{x:(b.x0+b.x1)/2,y:0,z:(b.z0+b.z1)/2},
    i:b.i,j:b.j,district:b.dist,park:b.park,buildingBounds:b.bld.map(r=>({x0:r.x0,z0:r.z0,x1:r.x1,z1:r.z1,height:r.h,base:r.y0||0}))}));
   case 'junctions': {
    const rows=[];
    for(let i=0;i<=N;i++) for(let j=0;j<=N;j++) {
     const control=junctionControl(i,j);
     rows.push({id:i+','+j,position:{x:i*CELL,y:0,z:j*CELL},streets:[STREET_NAMES.ns[i],STREET_NAMES.ew[j]],
      control,signal:control==='signal'?phaseForGroup(signalGroup(i,j),time):null});
    }
    return rows;
   }
   default: throw new Error('group must be one of '+groups.join(', '));
  }
 }
 function world(c) {
  const radius=number(c.radius??2000,'radius',0,10000);
  const limit=number(c.limit??20,'limit',1,500,true);
  const offset=number(c.offset??0,'offset',0,1e7,true);
  const rows=entities(c.group).map(row=>({...row,distance:Math.hypot(row.position.x-player.pos.x,row.position.z-player.pos.z)}))
   .filter(row=>row.distance<=radius).sort((a,b)=>a.distance-b.distance);
  return {time,total:rows.length,offset,nextOffset:offset+limit<rows.length?offset+limit:null,rows:rows.slice(offset,offset+limit)};
 }

 function actions() {
  if (state==='title') return $('play').disabled?[]:['play'];
  if (state!=='play' || cityMap.open) return [];
  if (deskStation&&!policeDesk.open) return [];
  if (policeDesk.open) {
   const buttons=[...policeDesk.querySelectorAll('button')].filter(b=>(b.id||b.dataset.view)&&!b.disabled&&!b.closest('[hidden]'));
   return buttons.map(b=>b.dataset.view?'desk:'+b.dataset.view:b.id);
  }
  const residentMenu=globalThis.ResidentCast?.conversation();if(residentMenu)return residentMenu.choices.map((_,i)=>'answer:'+i);
  if(globalThis.ResidentDirectory?.isOpen())return ['closeResidents'];
  if (shopOpen && !deskStation) return ['shopX',...[...$('items').querySelectorAll('button:enabled')].map(b=>'buy:'+b.dataset.item)];
  if(caseCamera.enabled)return ['followStreetCase'];
  const result=['camera','hud','gloves','weapon','sound','residents'];
  if(!$('followStreetCase').hidden)result.push('followStreetCase');
  if(actionCtx()) result.push('interact');
  if(player.car) result.push('exit','signalLeft','signalRight');
  return result;
 }
 function environment() {
  const result=weather.snapshot();
  if(player && weatherCover) result.sheltered=player.pos.y+1.35<weatherCover.heightAt(player.pos.x,player.pos.z);
  return result;
 }
 function observe() {
  const base={state,time,paused,environment:environment(),sound:$('sound').textContent,actions:actions(),cursor:sequence};
  if(!player) return {...base,loading:$('load').textContent};
  const p=player;
  return {...base,player:{position:point(p.car?.pos||p.pos),yaw:p.car?.h??p.yaw,health:p.hp,armor:p.armor,cash:p.cash,
   weapon:p.weapon,owned:{...p.own},ammo:{...p.ammo},gloves:p.gloves,down:p.down,vehicle:p.car?id(p.car):null,speed:p.car?.speed??p.pace??0},
   camera:{mode:caseCamera.enabled?'case':['follow','low','aerial','cockpit'][cameraMode],position:point(camera.position),yaw:camYaw+lookYaw,pitch:lookPitch},
   hudVisible:!$('ui').classList.contains('cleanView'),objective:$('obj').textContent,interaction:actionCtx()?.label??null,
   law:{wanted,heat,seen:LAW.seen,evadeSeconds:evadeT,lastKnown:LAW.known?point(LAW.anchor):null,
    limitKmh:TRAFFIC_PATROL.limit,outstandingTickets:PoliceDepartment.tickets.filter(t=>t.driver===p.personId && t.paid===null).length},
   robbery:robbing?{place:robbing.p.name,seconds:robbing.t,total:robbing.p.time}:null,
   outcome:state==='dead'?{kind:deadKind,respawnIn:deadT}:null,
   menu:policeDesk.open?{name:'police',tab:deskTab,station:deskStation?.name,rows:[...$('deskRows').children].map(r=>r.innerText)}:
    globalThis.ResidentCast?.conversation()|| (globalThis.ResidentDirectory?.isOpen()?{name:'residents'}:null)|| (shopOpen&&!deskStation?{name:'shop',items:[...$('items').children].map(r=>({item:r.querySelector('button').dataset.item,text:r.innerText,enabled:!r.querySelector('button').disabled}))}:null)};
 }
 function act(name) {
  if(!actions().includes(name)) throw new Error('Action unavailable. Read observe.actions');
  if(name==='interact') actionCtx().fn();
  else if(name==='weapon') cycleWeapon();
  else if(name==='gloves') toggleGloves();
  else if(name.startsWith('answer:'))ResidentCast.answer(Number(name.slice(7)));
  else if(name==='residents')ResidentDirectory.open();
  else if(name==='closeResidents')ResidentDirectory.close();
  else {
   const buttons={camera:'viewMode',hud:'hudMode',exit:'leaveCar'};
   const el=name.startsWith('desk:')?[...policeDesk.querySelectorAll('[data-view]')].find(b=>b.dataset.view===name.slice(5)):
    name.startsWith('buy:')?[...$('items').querySelectorAll('button')].find(b=>b.dataset.item===name.slice(4)):$(buttons[name]||name);
   el.click();
  }
  record('action',{action:name});
 }

 function advance(c) {
  if(!paused || cityMap.open || !['play','dead'].includes(state)) throw new Error('Step requires a paused game after Play');
  const ticks=number(c.ticks??1,'ticks',1,120,true);
  const input={forward:number(c.forward??0,'forward',-1,1),turn:number(c.turn??0,'turn',-1,1),
   fire:flag(c.fire??false,'fire'),sprint:flag(c.sprint??false,'sprint'),looking:c.lookYaw!==undefined||c.lookPitch!==undefined};
  const yaw=number(c.lookYaw??lookYaw,'lookYaw',-Math.PI,Math.PI),pitch=number(c.lookPitch??lookPitch,'lookPitch',-.35,.6);
  lookYaw=yaw;lookPitch=pitch;
  for(let i=0;i<ticks;i++) step(1/30,input);
 }
 function jump(c) {
  playing();
  const target=c.to===undefined?c:destinations().find(p=>p.id===c.to);
  if(!target) throw new Error('Unknown destination. Use places to list IDs');
  const x=number(target.x,'x',MINX,W+150),z=number(target.z,'z',MINZ,FREIGHT.z1);
  const y=groundY(x,z,target.y===undefined?null:number(target.y,'y',-100,200));
  const yaw=number(c.yaw??target.yaw??player.yaw,'yaw',-1e6,1e6);
  const at=new V3(x,y,z),car=player.car;
  collideWorld(at,car?Math.hypot(car.spec.W,car.spec.L)/2:.36);
  if(car && cars.some(other=>other!==car && Math.abs(other.pos.y-y)<2 && dist2(other.pos,at)<(car.spec.L+other.spec.L)/2))
   throw new Error('Another vehicle occupies the landing area');
  at.y=groundY(at.x,at.z,y);
  relocatePlayer(at,yaw);
  record('jump',{to:c.to,position:point(player.pos)});
 }
 function stats(c) {
  playing();
  const caps={health:100,armor:100,cash:100000000,wanted:5};
  const changes=Object.keys(c).filter(k=>k!=='op');
  if(!changes.length) throw new Error('Specify health, armor, cash or wanted');
  for(const k of changes) {
   if(!Object.hasOwn(caps,k)) throw new Error('Unknown stat '+k);
   number(c[k],k,0,caps[k],true);
  }
  for(const k of changes) {
   if(k==='wanted') {
    resetDispatch();wanted=c.wanted;heat=TH[wanted];evadeT=0;LAW.lastLevel=wanted;
    if(wanted) {LAW.known=true;LAW.anchor.copy(player.pos);LAW.dispatchAt=time;}
   } else player[k==='health'?'hp':k]=c[k];
  }
  record('stats',{changes:Object.fromEntries(changes.map(k=>[k,c[k]]))});
 }
 function spawn(model) {
  playing();
  if(!Object.hasOwn(CARSPEC,model)) throw new Error('Unknown model. Use models');
  const spot=laneSpot(6,45);
  if(!spot) throw new Error('No clear street nearby');
  const car=spawnCar(model,spot.x,spot.z,spot.h,null);
  record('spawn',{id:id(car),model,position:point(car.pos)});
 }
 function run(c) {
  if(!c || typeof c!=='object' || Array.isArray(c)) throw new Error('Enter a JSON command object');
  switch(c.op) {
   case 'help': return structuredClone(help);
   case 'observe': return observe();
   case 'residents':{const all=ResidentCast.search(c.query||'');return {total:all.length,rows:all.slice(0,number(c.limit??12,'limit',1,100,true)).map(r=>({personId:r.personId,residentId:r.residentId,name:r.name,age:r.age,occupation:r.occupation,home:r.home}))};}
   case 'meet':playing();ResidentDirectory.meet(c.personId);break;
   case 'events': {
    const after=number(c.after??0,'after',0,sequence,true),oldest=history[0]?.sequence??1;
    return {cursor:sequence,missed:Math.max(0,oldest-after-1),events:history.filter(e=>e.sequence>after).map(e=>structuredClone(e))};
   }
   case 'environment':
    if(c.hour===undefined&&c.weather===undefined)return environment();
    playing();setCityEnvironment(c.hour,c.weather);break;
   case 'clock': paused=flag(c.paused,'paused');clock.getDelta();break;
   case 'act': act(c.action);break;
   case 'places': case 'world': case 'police': case 'models':
    if(!player || state==='building') throw new Error('Wait for the city to finish loading');
    if(c.op==='places') return destinations();
    if(c.op==='world') return world(c);
    if(c.op==='models') return Object.keys(CARSPEC);
    return structuredClone({cases:PoliceDepartment.cases,tickets:PoliceDepartment.tickets,radio:PoliceDepartment.transmissions,contacts:PoliceDepartment.contacts,
     staff:PoliceDepartment.staff.map(s=>({...s,status:PoliceDepartment.status(s)}))});
   case 'step': advance(c);break;
   case 'jump': jump(c);break;
   case 'stats': stats(c);break;
   case 'spawn': spawn(c.model);break;
   default: throw new Error('Unknown operation. Use help');
  }
  record('command',{command:structuredClone(c)});
  draw();
  return observe();
 }
 window.asphaltAgent=Object.freeze({get paused(){return paused;},run});

 const panel=document.createElement('details');
 panel.id='agent-controller';
 panel.innerHTML='<summary>Agent controller</summary><form><label>JSON command<textarea rows="2" spellcheck="false">{"op":"observe"}</textarea></label><button type="submit">Run command</button></form><pre aria-label="Command result" tabindex="0"></pre>';
 const style=document.createElement('style');
 style.textContent='#agent-controller{position:fixed;z-index:1000;top:8px;left:50%;transform:translateX(-50%);width:min(26rem,90vw);background:#17202a;color:#f4f6f8;border:1px solid #607080;border-radius:6px;padding:6px 10px;font:14px system-ui;text-align:left;pointer-events:auto}#agent-controller summary{cursor:pointer}#agent-controller form{display:grid;gap:6px;margin-top:6px}#agent-controller textarea{display:block;width:100%;box-sizing:border-box;font:13px monospace}#agent-controller pre{max-height:30vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;font:12px monospace;margin:6px 0}';
 document.head.append(style);document.body.append(panel);
 const output=panel.querySelector('pre');
 const show=value=>{output.textContent=JSON.stringify(value,null,2);};
 for(const type of ['keydown','keyup']) panel.addEventListener(type,e=>e.stopPropagation());
 panel.querySelector('form').onsubmit=e=>{
  e.preventDefault();
  try{show(run(JSON.parse(panel.querySelector('textarea').value)));}
  catch(error){show({error:error.message});}
 };
 panel.addEventListener('toggle',()=>{if(panel.open&&!output.textContent) show(help);});
 // A modal dialog makes the rest of the page inert. Keep the controller inside its active surface.
 new MutationObserver(()=>{(policeDesk.open?policeDesk:document.body).append(panel);}).observe(policeDesk,{attributes:true,attributeFilter:['open']});
 const modelContext=document.modelContext||navigator.modelContext;
 if(modelContext?.registerTool) {
  const tool={
   name:'asphalt_heat',description:'Play and inspect this Asphalt Heat tab. Send {"op":"help"} for commands and examples.',
   inputSchema:{type:'object',properties:{command:{type:'object',properties:{op:{type:'string'}},required:['op']}},required:['command']},
   execute:({command})=>{
    try{return {content:[{type:'text',text:JSON.stringify(run(command))}]};}
    catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
   }
  };
  try {Promise.resolve(modelContext.registerTool(tool)).catch(e=>record('error',{message:String(e)}));}
  catch(e){record('error',{message:String(e)});}
 }
 $('play').addEventListener('click',()=>{if(paused&&state==='play') {step(1/30,{forward:0,turn:0});draw();}});
})();
