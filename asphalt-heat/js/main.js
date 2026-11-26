/* ================= player, input, HUD, loop, boot ================= */
const SPAWN={hospital:null,police:null};
function makePlayerChar(){return makeChar(ROLE.player?ROLE.player[0]:pickChar('m'),{gun:1,shadow:true});}
function nearestCar(r){let best=null,bd=r;for(const c of cars){if(c.dead||Math.abs(c.pos.y-player.pos.y)>1.05)continue;const d=dist2(c.pos,player.pos);if(d<bd&&rayWorld(player.pos.x,player.pos.z,c.pos.x,c.pos.z,player.pos.y+1,c.pos.y+1)>=1){bd=d;best=c;}}return best;}
function canReachPlace(pos,at,radius){
 if(dist2(pos,at)>=radius)return false;
 const y=groundY(at.x,at.z);
 return Math.abs(pos.y-y)<1.05&&rayWorld(pos.x,pos.z,at.x,at.z,pos.y+1,y+1)>=1;
}
function nearPlace(){return places.find(p=>p.door&&!p.road&&canReachPlace(player.pos,p.interact||p.door,2.4));}
function actionCtx(){if(state!=='play'||shopOpen||player.down>0)return null;if(player.car){
  const car=player.car;
  if(!car.dead&&Math.hypot(car.vel.x,car.vel.z)<.8){
   const service=places.find(p=>p.road&&canReachPlace(car.pos,p.road,3));
   if(service&&(service.kind==='chop'&&!wanted||service.kind==='spray'&&wanted>0&&wanted<=3&&player.cash>=250*wanted))
    return {label:service.kind==='chop'?'SELL CAR':'RESPRAY',hot:true,fn:()=>serviceCar(service,car)};
   const shutter=doorInteraction(car.pos,4.1,'shutter');
   if(shutter?.label==='OPEN DOOR')return shutter;
  }
  return {label:'EXIT',fn:toggleCar};
 }if(robbing)return{label:'ROB…',fn:()=>{}};
 const residentAction=globalThis.WashHouse?.interaction(player.pos);if(residentAction)return residentAction;
 const serviceAction=worksAction(player.pos);if(serviceAction)return serviceAction;
 const doorway=doorInteraction(player.pos,1.83);if(doorway)return doorway;
 const unitTap=suiteTapAction(player.pos);if(unitTap)return unitTap;
 const windowAction=constructionWindowAction(player.pos);if(windowAction)return windowAction;
 const p=nearPlace();if(p){if(p.kind==='police')return {label:'CASE DESK',hot:1,fn:()=>openPoliceDesk(p.office)};if(p.kind==='store'||p.kind==='bank')return p.cd>0?{label:'CLOSED',fn:()=>toast('ALREADY HIT — COME BACK LATER',1500)}:{label:'ROB',fn:()=>startRob(p),hot:1};
  if(p.kind==='gunshop')return{label:'SHOP',fn:openShop,hot:1};if(p.kind==='hospital')return{label:'HEAL',fn:()=>{if(player.hp>=100)toast('YOU ARE FINE',1000);else if(player.cash<100)toast('NEED $100',1000);else{player.cash-=100;player.hp=100;toast('PATCHED UP −$100',1400);}},hot:1};}
 const ticketDesk=roadsideTicketAction(player.pos);if(ticketDesk)return ticketDesk;
 const c=nearestCar(4.5);
 if(c){const fitting=c.components&&vehicleServiceAction(c,player.pos);if(fitting)return fitting;
  if(dist2(c.pos,player.pos)<3.6)return{label:c.driver?'JACK':'ENTER',fn:toggleCar,hot:1};}
 return hqInteraction(player.pos)||meetDepartmentPerson()||propInteraction(player.pos)||{label:'ACTION',fn:()=>{}};}
function carDoorSpot(c){
 const base=c.pos.y;
 for(const side of [1,-1]){
  const distance=c.spec.W/2+.65;
  const x=c.pos.x+side*distance*Math.cos(c.h),z=c.pos.z-side*distance*Math.sin(c.h);
  const y=groundY(x,z,base),at=new V3(x,y,z);
  if(Math.abs(y-base)>.85||rayWorld(c.pos.x,c.pos.z,x,z,base+1,y+1,.18)<1)continue;
  collideWorld(at,.36);
  if(Math.hypot(at.x-x,at.z-z)<.32&&cars.every(o=>o===c||!bodyInsideCar(o,at,.28)))return at;
 }
 return null;
}
function serviceCar(place,c){
 if(c!==player.car||c.dead)return;
 if(place.kind==='chop'){
  const pay=Math.round(c.spec.val*(.35+.65*c.hp/c.max)/10)*10;
  player.cash+=pay;player.pos.copy(c.pos);player.c.root.position.copy(c.pos);player.c.root.visible=true;player.car=null;
  removeCar(c);toast(`+$${pay} SOLD FOR PARTS`,2200);beep(1400,.1,.15,'sine');
 }else{
  const price=250*wanted;
  player.cash-=price;heat=wanted=evadeT=0;resetDispatch();repairCar(c,pick(carColors));
  toast(`FRESH PAINT −$${price} · COPS LOST`,2000);
 }
}
function toggleCar(){
 if(player.car){
  const c=player.car,at=carDoorSpot(c);
  if(!at){toast('DOOR BLOCKED',1000);return;}
  c.driver=null;c.ai=null;player.car=null;player.pace=player.turn=0;setCarLights(c,false);
  player.pos.copy(at);player.yaw=camYaw=c.h;player.c.root.position.copy(at);player.c.root.rotation.y=c.h;player.c.root.visible=true;
  const speed=Math.hypot(c.vel.x,c.vel.z);
  if(speed>9){damagePlayer(speed*.6);knockPlayer(c.vel.x*.8,1.5,c.vel.z*.8);}return;
 }
 const c=nearestCar(3.6);if(!c)return;
 const at=carDoorSpot(c);if(!at){toast('DOOR BLOCKED',1000);return;}
 PoliceDepartment.touch(player,c,c.pos,'Vehicle contact');
 if(c.driver==='ai'){const driver=ejectPed(at.x,at.z,c.pos.x,c.pos.z,at.y);
  registerIncident('Vehicle theft',c.pos,{vehicle:c,eyewitness:driver});crime(12,c.pos.x,c.pos.z);toast('CARJACKED!',1300);scare(c.pos.x,c.pos.z,15);}
 else if(c.driver==='police'){const observer=c.officer;leavePoliceVehicle(c,at);registerIncident('Vehicle theft',c.pos,{vehicle:c,eyewitness:observer});crime(30,c.pos.x,c.pos.z,true);toast('STOLE A COP CAR!',1300);}
 else if(c.type==='police'||c.type==='swat'){crime(25,c.pos.x,c.pos.z);toast('STOLE A COP CAR!',1300);}
 else{toast(c.type==='sport'?'NICE RIDE':'HOTWIRED',900);if(Math.random()<.35){beep(900,.2,.12);beep(700,.2,.12);crime(4,c.pos.x,c.pos.z);}}
 c.driver='player';c.ai=null;c.route=null;c.block=false;c.keep=false;player.car=c;player.c.root.visible=false;player.c.aim=0;if(player.c.gun)player.c.gun.visible=false;camYaw=c.h;if(!c.phys)physCarOn(c);c.body.wakeUp();setCarLights(c,false);}
function knockPlayer(vx,vy,vz){if(player.car||player.down>0)return;player.down=2.6;ragdoll(player.c,vx,vy,vz);}
function cycleWeapon(){const order=['fist','pistol','smg','shotgun'];let i=order.indexOf(player.weapon);for(let k=1;k<=4;k++){const w=order[(i+k)%4];if(w==='fist'||(player.own[w]&&player.ammo[w]>0)){player.weapon=w;break;}}}
function playerAttack(){if(player.fireCd>0||shopOpen||player.down>0)return;const w=player.weapon,car=player.car;
 if(w==='fist'&&!car){player.fireCd=WEAP.fist.rate;player.c.punch=0;player.c.guard=1;player.guardT=1.5;let best=null,bd=2.1;const yaw=player.yaw;const cand=[];
  for(const p of peds)if(!p.dead)cand.push([p,'ped']);for(const arr of[cops,gang,guards,departmentPeople])for(const u of arr)if(!u.dead)cand.push([u,'unit']);
  for(const[o,k]of cand){const dx=o.pos.x-player.pos.x,dz=o.pos.z-player.pos.z,d=Math.hypot(dx,dz);if(d<bd&&Math.abs(o.pos.y-player.pos.y)<1.4&&rayWorld(player.pos.x,player.pos.z,o.pos.x,o.pos.z,player.pos.y+1.4,o.pos.y+1.4)>=1&&Math.abs(wrapA(Math.atan2(dx,dz)-yaw))<1.1){bd=d;best=[o,k,dx,dz];}}
  if(best){const[o,k,dx,dz]=best;player.yaw=Math.atan2(dx,dz);player.pendingPunch={at:time+.12,land:()=>{if(o.dead||state!=='play'||player.down>0||player.car||shopOpen||player.weapon!=='fist'||o.pos.distanceTo(player.pos)>2.1||rayWorld(player.pos.x,player.pos.z,o.pos.x,o.pos.z,player.pos.y+1.4,o.pos.y+1.4)<1)return;noise(.12,240,.6);emit(o.pos.x,o.pos.y+1.55,o.pos.z,0,1,0,.15,.15,.4,0xffffff,true);if(k==='ped')hitPed(o,20,dx,dz,true);else hitUnit(o,20,dx,dz,true);}};}else if(globalThis.WashHouse?.hit())noise(.12,240,.6);else noise(.08,600,.15);return;}
 const W2=WEAP[w==='fist'?'pistol':w];if(w!=='fist'&&player.ammo[w]<=0){toast('OUT OF AMMO',900);player.weapon='fist';return;}
 if(w==='fist'&&car){toast('SWITCH TO A GUN TO DRIVE-BY',1000);player.fireCd=.5;return;}
 player.fireCd=W2.rate;player.ammo[w]--;lastShot=time;const yaw=car?car.h:player.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
 const o=car?new V3(car.pos.x+fx*(car.spec.L/2+.4),car.pos.y+1.2,car.pos.z+fz*(car.spec.L/2+.4)):new V3(player.pos.x+fx*.7-Math.cos(yaw)*.25,player.c.root.position.y+1.42,player.pos.z+fz*.7+Math.sin(yaw)*.25);
 let best=null,bs=1e9;const cone=car?.3:.55;
 const cons=(x,z,y,obj,kind)=>{const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz);if(d>(kind==='heli'?80:W2.range)||d<.4)return;const a=Math.abs(wrapA(Math.atan2(dx,dz)-yaw));if(a>(kind==='heli'?.9:cone))return;const sc=d*(1+a*2.5)*(kind==='unit'?.6:kind==='car'?1.4:kind==='heli'?.8:1);if(sc<bs&&rayWorld(o.x,o.z,x,z,o.y,y)>=1){bs=sc;best={x,y,z,obj,kind};}};
 for(const p of peds)if(!p.dead&&p.c.root.visible)cons(p.pos.x,p.pos.z,p.pos.y+1.3,p,'ped');for(const arr of[cops,gang,guards,departmentPeople])for(const u of arr)if(!u.dead)cons(u.pos.x,u.pos.z,u.pos.y+1.3,u,'unit');
 for(const c of cars)if(c!==car&&!c.dead)cons(c.pos.x,c.pos.z,c.pos.y+1,c,'car');for(const h of helis)if(!h.dead)cons(h.pos.x,h.pos.z,h.pos.y,h,'heli');
 if(best&&!car)player.yaw=Math.atan2(best.x-player.pos.x,best.z-player.pos.z);if(!car)player.c.aim=.6;const pel=W2.pel||1;
 for(let k=0;k<pel;k++){let end;
  if(best&&Math.random()<W2.acc*(pel>1?.8:1)){end=new V3(best.x+rnd(-.25,.25),best.y+rnd(-.2,.2),best.z+rnd(-.25,.25));const dx=best.x-o.x,dz=best.z-o.z;
   if(best.kind==='ped'){hitPed(best.obj,W2.dmg,dx,dz,false);emit(end.x,end.y,end.z,0,1,0,.25,.3,.6,0x5a0808,false);}
   else if(best.kind==='car'){damageCar(best.obj,W2.dmg*.28,true);emit(end.x,end.y,end.z,rnd(-3,3),rnd(1,4),rnd(-3,3),.25,.12,.08,0xffe080,true,10);if(best.obj.phys){best.obj.body.wakeUp();best.obj.body.applyImpulse(new CV(fx*60,0,fz*60),new CV(end.x-best.obj.body.position.x,end.y-best.obj.body.position.y,end.z-best.obj.body.position.z));}
    if(best.obj.driver==='police'||best.obj.type==='police')crime(5,best.obj.pos.x,best.obj.pos.z,true);else if(best.obj.driver==='ai')crime(4,best.obj.pos.x,best.obj.pos.z);}
   else if(best.kind==='heli'){best.obj.hp-=W2.dmg;emit(end.x,end.y,end.z,0,0,0,.2,.6,.2,0xffe080,true);if(best.obj.hp<=0&&!best.obj.dead){best.obj.dead=true;best.obj.playerCaused=true;best.obj.vel.set(rnd(-3,3),2,rnd(-3,3));crime(80,player.pos.x,player.pos.z,true);toast('CHOPPER DOWN!',1500);}}
   else{hitUnit(best.obj,W2.dmg,dx,dz,false);emit(end.x,end.y,end.z,0,1,0,.25,.3,.6,0x5a0808,false);}}
  else{const a=yaw+rnd(-.06,.06)*(pel>1?3:1),L=W2.range;const ex=o.x+Math.sin(a)*L,ez=o.z+Math.cos(a)*L,f=rayWorld(o.x,o.z,ex,ez,o.y,o.y);end=new V3(o.x+(ex-o.x)*f,o.y+rnd(-.5,.3),o.z+(ez-o.z)*f);if(f<1)for(let q=0;q<3;q++)emit(end.x,end.y,end.z,rnd(-2,2),rnd(1,3),rnd(-2,2),.3,.15,.08,0xffd090,true,9);}
  globalThis.WashHouse?.contactTrace(o,end);tracer(o,end);}
 emit(o.x,o.y,o.z,0,0,0,.05,.5,1,0xffd070,true);muzzleL.position.copy(o);muzzleL.intensity=12;noise(w==='shotgun'?.35:.16,w==='shotgun'?1600:2600,.5);scare(player.pos.x,player.pos.z,30);
 reportGunfire(player);if(player.ammo[w]<=0){toast('OUT OF AMMO',900);cycleWeapon();}}
function startRob(p){if(player.weapon==='fist'){toast('PULL OUT A GUN FIRST',1400);return;}robbing={p,t:0,beep:0};registerIncident('Robbery',p.interact||p.door,{handContact:true,alarm:true});crime(p.heat,p.door.x,p.door.z,true);scare(p.door.x,p.door.z,30);
 const base=p.interact||p.door,yaw=SIDEANG[p.side],fx=Math.sin(yaw),fz=Math.cos(yaw);
 const cp=new V3(base.x-fx*1.16+fz*1.52,0,base.z-fz*1.16-fx*1.52);
 collideWorld(cp,.32);
 if(clerk)removeChar(clerk);
 clerk=makeChar(pickChar(p.kind==='bank'?'mb':'clerk'),{});
 clerk.root.position.set(cp.x,groundY(cp.x,cp.z),cp.z);clerk.yaw=yaw;clerk.hands=1;
 if(p.kind==='bank'){
  for(const s of [-1,1])spawnUnit('guard',base.x+fz*s*4.5,base.z-fx*s*4.5,'guard');
  toast('THE ALARM IS RINGING!',1600);
 }else toast('HANDS UP! EMPTY THE REGISTER!',1600);
}
function updRob(dt){if(!robbing)return;const p=robbing.p;const at=p.interact||p.door;
 if(player.car||player.down>0||player.weapon==='fist'||!canReachPlace(player.pos,at,3.4)||state!=='play'){robbing=null;toast('ROBBERY ABANDONED',1400);if(clerk)clerk.hands=0;return;}
 robbing.t+=dt;robbing.beep-=dt;player.c.aim=.3;if(robbing.beep<=0){robbing.beep=.45;beep(robbing.t%.9<.45?1250:950,.25,.12);}
 if(robbing.t>=p.time){const cash=rint(p.cash[0],p.cash[1]);player.cash+=cash;toast(`+$${cash.toLocaleString()} SCORED!`,2200);if(p.heat2)crime(p.heat2,p.door.x,p.door.z,true);p.cd=p.kind==='bank'?300:150;robbing=null;if(clerk)clerk.hands=0;}}
function openShop(){shopOpen=true;$('shop').style.display='flex';renderShop();}
function renderShop(){const items=[['pistol','Pistol ammo ×36','Reliable sidearm',150],['smg',player.own.smg?'SMG ammo ×120':'SMG + 120 rounds','Spray and pray',player.own.smg?300:1200],['shotgun',player.own.shotgun?'Shotgun shells ×24':'Shotgun + 24 shells','Devastating up close',player.own.shotgun?300:1600],['armor','Body armor','Absorbs 70% of damage',400]];
 const box=$('items');box.innerHTML='';for(const[id,t,s,price]of items){const row=document.createElement('div');row.className='it';const info=document.createElement('div');const b=document.createElement('b');b.textContent=t;const sp=document.createElement('span');sp.textContent=s;info.append(b,sp);
  const btn=document.createElement('button');btn.dataset.item=id;btn.textContent='$'+price;btn.disabled=player.cash<price||(id==='armor'&&player.armor>=100);btn.addEventListener('click',()=>{if(!shopOpen||state!=='play'||player.cash<price||(id==='armor'&&player.armor>=100))return;player.cash-=price;if(id==='pistol')player.ammo.pistol+=36;else if(id==='smg'){player.own.smg=true;player.ammo.smg+=120;}else if(id==='shotgun'){player.own.shotgun=true;player.ammo.shotgun+=24;}else player.armor=100;beep(1200,.08,.15,'sine');renderShop();});row.append(info,btn);box.append(row);}}
$('shopX').addEventListener('click',()=>{shopOpen=false;$('shop').style.display='none';});
function gameOver(kind){if(state!=='play')return;if(policeDesk.open)policeDesk.close();if(kind==='BUSTED')PoliceDepartment.book(player.personId);shopOpen=false;$('shop').style.display='none';player.pendingPunch=null;state='dead';deadT=4.5;deadKind=kind;globalThis.asphaltAgentEvent?.('gameOver',{kind});const b=$('big');b.textContent=kind;b.className='show'+(kind==='BUSTED'?' busted':'');robbing=null;
 if(kind==='BUSTED')player.c.hands=1;else if(!player.car&&!player.c.body)ragdoll(player.c,rnd(-1,1),1,rnd(-1,1));noise(.8,300,.4);}
function respawn(){state='play';$('big').className='';const busted=deadKind==='BUSTED';const lost=busted?Math.round(player.cash*.3):Math.min(player.cash,200);player.cash-=lost;
 if(player.car){const car=player.car;player.car=null;car.driver=null;setCarLights(car,false);}player.hp=100;player.arrestT=0;player.down=0;player.pace=0;player.turn=0;heat=0;wanted=0;evadeT=0;resetDispatch();
 if(busted){player.own.smg=player.own.shotgun=false;player.ammo={pistol:12,smg:0,shotgun:0};player.weapon='fist';player.armor=0;}
 const sp=busted?SPAWN.police:SPAWN.hospital;camInit=false;player.pos.set(sp.x,groundY(sp.x,sp.z),sp.z);player.yaw=sp.yaw;camYaw=sp.yaw;removeChar(player.c);player.c=makePlayerChar();dressPlayerHands();
 for(const arr of[cops,guards])for(const u of arr.slice())removeUnit(u,arr);for(const g of gang)g.hostile=false;
 for(const c of cars.slice())if((c.type==='police'||c.type==='swat')&&!c.keep&&dist2(c.pos,player.pos)<150)removeCar(c);for(const h of helis.slice())removeHeli(h);if(clerk){removeChar(clerk);clerk=null;}
 toast(busted?`BUSTED · BAIL −$${lost} · WEAPONS TAKEN`:`HOSPITAL BILL −$${lost}`,2600);}
/* ================= input ================= */
let cameraMode=0;
function cycleCamera(){cameraMode=(cameraMode+1)%(player.car?.steeringWheel?4:3);camInit=false;}
const keys={};const inp={jx:0,jy:0,fire:false,sprint:false};let joyId=null,joyC=[0,0],dragId=null,dragX=0,dragY=0;
const soundButton=$('sound');
soundButton.addEventListener('click',async e=>{
 if(e.detail>0)soundButton.blur();
 const enabled=soundButton.getAttribute('aria-pressed')==='false';
 if(enabled&&!ac)initAudio();
 if(!ac){toast('Sound unavailable');return;}
 if(enabled&&ac.state!=='running'){
  soundButton.disabled=true;
  try{await ac.resume();}
  catch(e){toast('Sound unavailable');return;}
  finally{soundButton.disabled=false;}
 }
 master.gain.value=enabled ? .55 : 0;
 soundButton.setAttribute('aria-pressed',String(enabled));
 soundButton.textContent=enabled?'Sound on':'Sound off';
});
addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===soundButton)return;if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();if(e.repeat)return;keys[e.code]=true;if(state==='play'&&!caseCamera.enabled){if(e.code==='KeyC'){const a=actionCtx();a&&a.fn();}if(e.code==='KeyE'&&player.car&&!shopOpen)toggleCar();if(e.code==='KeyZ'&&!shopOpen)cycleWeapon();
 if(e.code==='KeyV')cycleCamera();
 if(!shopOpen && (e.code==='BracketLeft'||e.code==='BracketRight'))togglePlayerSignal(player.car,e.code==='BracketLeft'?-1:1);
 if(e.code==='KeyH')toggleHUD();}});
function toggleHUD(){
 const clean=$('ui').classList.toggle('cleanView');
 $('hudMode').textContent=clean?'Show HUD':'Hide HUD';
}
$('viewMode').addEventListener('click',cycleCamera);
for(const [id,direction] of [['signalLeft',-1],['signalRight',1]])$(id).addEventListener('click',()=>togglePlayerSignal(player.car,direction));
$('hudMode').addEventListener('click',toggleHUD);
$('leaveCar').addEventListener('click',()=>{if(state==='play'&&player.car)toggleCar();});
addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{for(const k in keys)keys[k]=false;inp.fire=inp.sprint=false;inp.jx=inp.jy=0;joyId=dragId=null;knob.style.transform='';document.querySelectorAll('#btns .down').forEach(b=>b.classList.remove('down'));});
const joy=$('joy'),knob=$('knob');
function moveJoy(e){let dx=e.clientX-joyC[0],dy=e.clientY-joyC[1];const R=joy.clientWidth*.38,l=Math.hypot(dx,dy);if(l>R){dx*=R/l;dy*=R/l;}inp.jx=dx/R;inp.jy=-dy/R;knob.style.transform=`translate(${dx}px,${dy}px)`;}
joy.addEventListener('pointerdown',e=>{e.preventDefault();joyId=e.pointerId;const r=joy.getBoundingClientRect();joyC=[r.left+r.width/2,r.top+r.height/2];try{joy.setPointerCapture(e.pointerId);}catch(_){}moveJoy(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)moveJoy(e);});const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;inp.jx=inp.jy=0;knob.style.transform='';};joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);
canvas.addEventListener('pointerdown',e=>{if(dragId!==null)return;dragId=e.pointerId;dragX=e.clientX;dragY=e.clientY;try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==dragId)return;lookYaw=clamp(lookYaw-(e.clientX-dragX)*.008,-Math.PI,Math.PI);lookPitch=clamp(lookPitch+(e.clientY-dragY)*.005,-.35,.6);dragX=e.clientX;dragY=e.clientY;});
const dragEnd=e=>{if(e.pointerId===dragId)dragId=null;};canvas.addEventListener('pointerup',dragEnd);canvas.addEventListener('pointercancel',dragEnd);
function holdBtn(el,on,off){el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('down');try{el.setPointerCapture(e.pointerId);}catch(_){}on();});const up=()=>{el.classList.remove('down');off&&off();};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('contextmenu',e=>e.preventDefault());}
holdBtn($('bFire'),()=>inp.fire=true,()=>inp.fire=false);holdBtn($('bSprint'),()=>inp.sprint=true,()=>inp.sprint=false);holdBtn($('bAct'),()=>{const a=actionCtx();a&&a.fn();});holdBtn($('bWep'),()=>{if(state==='play')cycleWeapon();});
$('wep').addEventListener('click',()=>{if(state==='play')cycleWeapon();});
/* ================= minimap ================= */
const mm=$('mm'),mg=mm.getContext('2d'),MMB=document.createElement('canvas'),MAP_SCALE=800/(S+70);
MMB.width=Math.ceil((W+150+HALF)*MAP_SCALE);MMB.height=Math.ceil((FREIGHT.z1+88)*MAP_SCALE);
function buildMinimapBase(){const g=MMB.getContext('2d'),k=MAP_SCALE;g.fillStyle='#6a707a';g.fillRect(0,0,MMB.width,MMB.height);g.fillStyle='#cdb68a';g.fillRect((W+HALF+HALF)*k,0,56*k,MMB.height);g.fillStyle='#1d5866';g.fillRect((W+62+HALF)*k,0,MMB.width,MMB.height);
 const DC={oldtown:'#3a2f2c',midtown:'#2d3038',downtown:'#262a33',docks:'#30302a',suburb:'#2e3a2c',beach:'#3a3036'};
 for(const B of blocks){
  g.fillStyle=B.park?'#3d5a35':DC[B.dist]||'#262b33';
  g.fillRect((B.x0+HALF)*k,(B.z0+HALF)*k,(B.x1-B.x0)*k,(B.z1-B.z0)*k);
  g.fillStyle='rgba(255,255,255,.09)';
  for(const R of B.bld)g.fillRect((R.x0+HALF)*k,(R.z0+HALF)*k,(R.x1-R.x0)*k,(R.z1-R.z0)*k);
  if(B.diagonalPaths){
   const {x,z,half}=B.diagonalPaths;
   const u=(x+HALF)*k,v=(z+HALF)*k,r=half*k;
   g.beginPath();
   g.moveTo(u-r,v-r);g.lineTo(u+r,v+r);
   g.moveTo(u-r,v+r);g.lineTo(u+r,v-r);
   g.strokeStyle='#9da58b';g.lineWidth=1.65;g.stroke();
  }
 }
 g.fillStyle='#b99670';g.fillRect((W+37+HALF)*k,(W*.42-4+HALF)*k,113*k,8*k);
 drawGradeRoads(g,k);
 drawFreightMap(g,k);
 drawHarborMap(g,k);
}
const MICON={store:['$','#ffd040'],bank:['B','#ffd040'],gunshop:['G','#ff8a30'],hospital:['H','#ff4060'],police:['P','#4a8aff'],chop:['C','#40ff80'],spray:['R','#40a8ff']};
function drawMap(){const Wd=300,k=Wd/240,pp=player.car?player.car.pos:player.pos,px=pp.x,pz=pp.z,yaw=camYaw+lookYaw,rot=yaw-Math.PI,cs=Math.cos(rot),sn=Math.sin(rot);
 mg.save();mg.fillStyle='#1a1d22';mg.fillRect(0,0,Wd,Wd);mg.beginPath();mg.arc(150,150,150,0,7);mg.clip();mg.save();mg.translate(150,150);mg.rotate(rot);mg.drawImage(MMB,(-HALF-px)*k,(-HALF-pz)*k,MMB.width*k/MAP_SCALE,MMB.height*k/MAP_SCALE);mg.restore();
 const Tm=(x,z,cr)=>{let dx=(x-px)*k,dz=(z-pz)*k;let X=dx*cs-dz*sn,Y=dx*sn+dz*cs;const l=Math.hypot(X,Y);if(cr&&l>cr){X*=cr/l;Y*=cr/l;}return[150+X,150+Y];};
 const dot=(x,z,c,r,cr=135)=>{if(Math.hypot(x-px,z-pz)*k>cr)return;const[X,Y]=Tm(x,z,cr);mg.fillStyle=c;mg.beginPath();mg.arc(X,Y,r,0,7);mg.fill();mg.lineWidth=3;mg.strokeStyle='#000';mg.stroke();};const fl=Math.floor(time*6)%2;
 for(const c of cars)if(c.driver==='police')dot(c.pos.x,c.pos.z,wanted>0?(fl?'#ff3b3b':'#3b8bff'):'#6fa0ff',8);if(wanted>0)for(const c of cops)if(!c.dead)dot(c.pos.x,c.pos.z,'#3b8bff',5);
 for(const g of gang)if(!g.dead&&g.hostile)dot(g.pos.x,g.pos.z,'#40d040',5);for(const h of helis)if(!h.dead)dot(h.pos.x,h.pos.z,'#ffffff',7);
 mg.font='bold 17px Inter,sans-serif';mg.textAlign='center';mg.textBaseline='middle';
 const rimSlots=new Map(),nearby=[];
 for(const p of places){
  const at=p.road||p.interact||p.door,range=Math.hypot(at.x-px,at.z-pz)*k;
  if(range<=117){nearby.push({p,xy:Tm(at.x,at.z,0)});continue;}
  const angle=Math.atan2(at.z-pz,at.x-px)+rot,slot=(Math.round(angle*18/(2*Math.PI))+36)%18;
  if(!rimSlots.has(slot)||rimSlots.get(slot).range>range){
   const direction=slot*2*Math.PI/18;
   rimSlots.set(slot,{p,range,xy:[150+135*Math.cos(direction),150+135*Math.sin(direction)]});
  }
 }
 for(const {p,xy:[X,Y]} of [...rimSlots.values(),...nearby]){
  const [ch,col]=MICON[p.kind];mg.fillStyle=p.cd>0?'#555':col;mg.beginPath();mg.arc(X,Y,12,0,7);mg.fill();mg.strokeStyle='#000';mg.lineWidth=3;mg.stroke();mg.fillStyle='#111';mg.fillText(ch,X,Y+1);
 }
 const hx=HARBOR.quay.x1,hz=(HARBOR.approach.z0+HARBOR.approach.z1)/2;
 if(Math.hypot(hx-px,hz-pz)*k<=128){
  const [x,y]=Tm(hx,hz,128);
  dot(hx,hz,'#abe1df',10,128);
  mg.font='bold 15px Arial,sans-serif';mg.fillStyle='#193335';mg.fillText('⚓︎',x,y+1);
 }
 const gx=FREIGHT.gates[1].x,gz=FREIGHT.z0+10;
 if(Math.hypot(gx-px,gz-pz)*k<=128){
  const [x,y]=Tm(gx,gz,128);
  dot(gx,gz,'#e6c57e',10,128);
  mg.fillStyle='#263133';mg.fillRect(x-5.5,y-3.5,11,7);
  mg.fillStyle='#e6c57e';
  for(const d of [-2.6,0,2.6])mg.fillRect(x+d-.38,y-2.35,.76,4.7);
 }
 mg.restore();mg.save();mg.translate(150,150);mg.rotate(yaw-(player.car?player.car.h:player.yaw));mg.fillStyle='#fff';mg.strokeStyle='#000';mg.lineWidth=3;mg.beginPath();mg.moveTo(0,-15);mg.lineTo(10,11);mg.lineTo(0,5);mg.lineTo(-10,11);mg.closePath();mg.stroke();mg.fill();mg.restore();}
/* ================= HUD ================= */
let hudCache={};const starEls=[...$('stars').children];
function hud(){const set=(k,v,f)=>{if(hudCache[k]!==v){hudCache[k]=v;f(v);}};
 set('conditions',weather.clockText+' · '+weather.description+' · '+Math.round(weather.temperature)+'°C',v=>$('conditions').textContent=v);
 set('cash',player.cash,v=>$('cash').textContent='$'+v.toLocaleString());set('hp',Math.max(0,Math.round(player.hp)),v=>$('hp').style.width=v+'%');
 set('ar',Math.round(player.armor),v=>{$('arbar').style.display=v>0?'block':'none';$('ar').style.width=v+'%';});
 set('car',player.car?Math.round(player.car.hp/player.car.max*100):-1,v=>{$('carbar').style.display=v<0?'none':'block';if(v>=0)$('chp').style.width=v+'%';});
 set('model',player.car?.spec.modelName||'',v=>{$('vehicleName').textContent=v;});
 set('indicator',player.car?.playerSignal?.direction||0,v=>{
  $('signalLeft').setAttribute('aria-pressed',String(v<0));$('signalRight').setAttribute('aria-pressed',String(v>0));
 });
 set('spd',player.car?Math.round(Math.abs(player.car.speed)*3.6):-1,v=>{$('speedo').style.display=v<0?'none':'block';if(v>=0)$('speedo').firstChild.textContent=v;});
 set('roadLimit',player.car?TRAFFIC_PATROL.limit:null,v=>{$('roadLimit').textContent=v?' · LIMIT '+v:'';});
 set('w',wanted,v=>starEls.forEach((s,i)=>s.classList.toggle('on',i<v)));const L=wanted,nxt=L<5?TH[L+1]:WANTED_MAX;
 set('heat',Math.round(L<5?(heat-TH[L])/(nxt-TH[L])*100:100),v=>$('heat').firstChild.style.width=clamp(v,0,100)+'%');
 set('ev',L>0?Math.round(evadeT/LV.evade[L]*100):0,v=>{$('evade').style.opacity=v>0?1:0;$('evade').firstChild.style.width=v+'%';});set('blink',L>0&&evadeT>1,v=>$('stars').classList.toggle('blink',v));
 const w=player.weapon;set('wep',w+(w==='fist'?'':player.ammo[w])+(player.car?'c':''),()=>{$('wep').firstChild.textContent=WEAP[w].n+' ';$('wep').lastChild.textContent=w==='fist'?'':player.ammo[w];$('leaveCar').hidden=!player.car;$('bFire').disabled=w==='fist'&&!!player.car;$('bFire').textContent=w==='fist'?(player.car?'UNARMED':'PUNCH'):'SHOOT';});
 const a=actionCtx();set('act',a?a.label:'',v=>{
  $('bAct').textContent=v||'ACTION';
  const prompt=$('interaction');
  prompt.hidden=!v||v==='ACTION'||v==='ROB…'||v==='EXIT';
  prompt.lastChild.textContent=v;
 });set('hot',!!(a&&a.hot),v=>$('bAct').classList.toggle('hot',v));set('spr',player.car?'DRIFT':'SPRINT',v=>$('bSprint').textContent=v);
 const obj=wanted>0&&!LAW.seen?'Searching the last sighting area':robbing?'Hold position until the cash is bagged!':L>=4?'Massive heat! Break line of sight and stay out of the searchlight':L>0?(L>=3?'Lose the cops — the respray only works up to 3 stars':'Lose the cops or hit the blue RESPRAY'):qp.get('visit')==='police'&&!player.car?'Old Town headquarters · C at reception for Watch and Cases':player.car?'Sell this car at the green CHOP SHOP, or explore':'Rob a store ($), the bank (B), or jack a car';
 set('obj',obj,v=>$('obj').textContent=v);
 set('prog',robbing?Math.round(robbing.t/robbing.p.time*100):-1,v=>{$('prog').style.display=v<0?'none':'block';if(v>=0){$('prog').lastChild.firstChild.style.width=v+'%';$('prog').firstChild.textContent=robbing.p.kind==='bank'?'CRACKING THE VAULT…':'EMPTYING THE REGISTER…';}});}
/* ================= main loop ================= */
const clock=new THREE.Clock();const camPos=new V3();let camInit=false,mmT=0,lodT=0,fpsAcc=0,fpsN=0,fpsCheck=0;
function cameraClearance(ax,ay,az,bx,by,bz){
 const hit=rayWorld(ax,az,bx,bz,ay,by,.18);return hit<1?Math.max(.04,hit-.015):1;
}
function updateDrivingLight(){
 const car=player.car;
 for(let i=0;i<drivingLights.length;i++){
  const lamp=drivingLights[i];
  lamp.intensity=car&&!car.dead?8*weather.headlights:0;
  if(lamp.intensity<=0)continue;
  const nose=car.spec.L*.5+.06,side=(i===0?-1:1)*car.spec.W*.33;
  lamp.position.set(side,.62,nose).applyQuaternion(car.mesh.quaternion).add(car.mesh.position);
  lamp.target.position.set(side*1.4,.14,nose+18).applyQuaternion(car.mesh.quaternion).add(car.mesh.position);
  lamp.distance=Math.min(HEADLIGHT_RANGE,(car.headlightReach??HEADLIGHT_RANGE)+.85);
 }
}
function step(dt,agentInput=null){time+=dt;WATERT.value=time;
 weather.advance(dt);applyWeatherLight();
 advanceSashes(dt,player.pos);updateCityWorks(dt,player.pos);updateCityMachines(dt,player.pos);updateCoveBeacon(dt);updateSupplyLights();updateForestLOD(dt);
 refreshPhysicalWorld(player.pos.x,player.pos.z);streamBuildingFittings(player.pos);retireSuiteTaps();
 const kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),ky=(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0);const play=state==='play'&&!shopOpen&&!caseCamera.enabled;
 const jx=play?(agentInput?.turn??clamp(inp.jx+kx,-1,1)):0,jy=play?(agentInput?.forward??clamp(inp.jy+ky,-1,1)):0,fire=play&&(agentInput?.fire??(inp.fire||keys.Space)),sprint=play&&(agentInput?.sprint??(inp.sprint||keys.KeyX));
 if(player.pendingPunch&&time>=player.pendingPunch.at){player.pendingPunch.land();player.pendingPunch=null;}player.fireCd-=dt;if(fire)playerAttack();updLights(time);
 lodT-=dt;if(lodT<=0){lodT=.5;physLOD();}
 /* controls before physics */
 for(const c of cars){if(c.dead){c.wreckT+=dt;if(c.burn>0){c.burn-=dt;if(Math.random()<dt*35)emit(c.pos.x+rnd(-.6,.6),c.pos.y+1.3,c.pos.z+rnd(-.6,.6),rnd(-.5,.5),rnd(2,4),rnd(-.5,.5),rnd(.4,.8),.8,1.8,pick([0xff8a20,0xffb040]),true);if(Math.random()<dt*24)emit(c.pos.x,c.pos.y+1.8,c.pos.z,rnd(-.5,.5),rnd(2,4),rnd(-.5,.5),2.2,1.5,5.5,0x302a28,false);if(c.burn<=0)explode(c);}
   else if(c.wreckT<15&&Math.random()<dt*10)emit(c.pos.x,c.pos.y+1.4,c.pos.z,rnd(-.3,.3),rnd(1.5,3),rnd(-.3,.3),2.5,1,4,0x3a3634,false);if(c.phys)physCarControl(c,0,0,true,dt);continue;}
  if(c.hp<c.max*.4&&Math.random()<dt*13){const fx=Math.sin(c.h),fz=Math.cos(c.h);emit(c.pos.x+fx*c.spec.L*.36,c.pos.y+c.spec.hb+.1,c.pos.z+fz*c.spec.L*.36,rnd(-.3,.3),rnd(1,2.5),rnd(-.3,.3),1.6,.6,2.5,c.hp<c.max*.2?0x333030:0x9a9a9a,false);}
  if(c===player.car){drive(c,jy,-jx,sprint,dt);}
  else if(inFreightPort(c.pos.x,c.pos.z)&&(c.driver==='ai'||c.driver==='police'&&(!wanted||!c.dispatched)))driveToFreightExit(c,dt);
  else if(c.driver==='scene')driveSceneCar(c,dt);
  else if(c.driver==='ai'||c.driver==='scene return')aiTraffic(c,dt);
  else if(c.driver==='police'){if(wanted>0){c.siren=c.dispatched&&wanted>=3&&LAW.seen;aiPolice(c,dt);}else{c.siren=false;c.route=null;c.dispatched=false;aiTraffic(c,dt);}}
  else if(c.phys)physCarControl(c,0,0,true,dt);
  updateVehicleSnow(c,dt);if(c.components)updateVehicleAssembly(c,dt);
  updateTurnLamps(c,time);
  if(c.bar){
   const responding=c.siren&&(c.sceneFileId&&c.driver!=='player'||(wanted>0||c.block)&&(c.driver==='police'||c.block));
   const on=responding||c.driver==='police'&&time<c.ticketLightsUntil,f=(time*7|0)%2;
   c.bar.r.material=on&&f?SIREN.onR:SIREN.offR;c.bar.b.material=on&&!f?SIREN.onB:SIREN.offB;
  }
 }
 globalThis.WashHouse?.tick(dt);
 physStep(dt);updateDoorMeshes();
 for(const c of cars){if(c.phys)physCarRead(c);syncCarMesh(c);if(c.spec.form==='roadster'){updateSeatedDriver(c);updateRoadsterDials(c);}c.mesh.visible=dist2(c.pos,player.pos)<230;if(dist2(c.pos,player.pos)<70)updateHeadlights(c,dt);}
 updateDrivingLight();

 applyCarHits();
 wheelBegin();for(const c of cars)pushWheels(c,dt);wheelEnd();
 /* player on foot */
 if(player.car){player.pos.copy(player.car.pos);player.yaw=player.car.h;}
 else if(player.down>0){player.down-=dt;const b=player.c.body;if(b)player.pos.set(b.position.x,b.position.y-.55,b.position.z);updChar(player.c,0,dt,true);if(player.down<=0&&state==='play'){releaseRagdoll(player.c);collideWorld(player.pos,.4);player.c.root.position.set(player.pos.x,groundY(player.pos.x,player.pos.z,player.pos.y),player.pos.z);}}
 else if(!(state==='dead'&&deadKind==='WASTED')){
  const yawTarget=Math.abs(jx)>.12?-jx*(Math.abs(jy)>.3?2.28:2.85):0;
  player.turn=lerp(player.turn||0,yawTarget,1-Math.exp(-14*dt));
  player.yaw+=player.turn*dt;
  const onSand=player.pos.x>W+15&&groundY(player.pos.x,player.pos.z,player.pos.y)<.05;
  let pace=0;
  if(jy>.12)pace=(sprint?6.9:3.9)*Math.min(1,jy*1.2);
  else if(jy<-.12)pace=-1.85*Math.min(1,-jy);
  pace*=onSand?.76:1;
  player.pace=lerp(player.pace||0,pace,1-Math.exp(-(pace?8:14)*dt));
  const speed=player.pace,dx=Math.sin(player.yaw)*speed*dt,dz=Math.cos(player.yaw)*speed*dt;
  const sx=player.pos.x,sz=player.pos.z;
  player.pos.x+=dx;player.pos.z+=dz;
  const hitWall=collideWorld(player.pos,.36,{dx,dz,dt});
  if(hitWall){
   const actual=Math.min(Math.abs(speed),Math.hypot(player.pos.x-sx,player.pos.z-sz)/Math.max(dt,.001));
   player.pace=Math.sign(speed)*actual;
  }
  const spd=player.pace;
  const hit=carHitsBody(player.pos,.3);if(hit&&state==='play'&&hit!==player.car){damagePlayer(Math.hypot(hit.vel.x,hit.vel.z)*1.8);shake=.6;knockPlayer(hit.vel.x*1.1,2+Math.abs(hit.speed)*.2,hit.vel.z*1.1);scare(player.pos.x,player.pos.z,10);if(hit.driver==='ai')hit.wait=2;}
  for(const c of cars){if(c===player.car||!bodyInsideCar(c,player.pos,.3))continue;const dx=player.pos.x-c.pos.x,dz=player.pos.z-c.pos.z;const fx=Math.sin(c.h),fz=Math.cos(c.h);const f=dx*fx+dz*fz,l=dx*fz-dz*fx;const hl=c.spec.L/2+.3,hw=c.spec.W/2+.3;if(Math.abs(f)<hl&&Math.abs(l)<hw){const pf=hl-Math.abs(f),pl=hw-Math.abs(l);if(pf<pl){player.pos.x+=fx*Math.sign(f)*pf;player.pos.z+=fz*Math.sign(f)*pf;}else{player.pos.x+=fz*Math.sign(l)*pl;player.pos.z-=fx*Math.sign(l)*pl;}}}
  player.spd=Math.abs(spd);player.guardT-=dt;player.c.guard=player.guardT>0?1:0;const gy=groundY(player.pos.x,player.pos.z,player.pos.y),R=player.c.root;player.pos.y=gy;R.position.set(player.pos.x,R.position.y+(gy-R.position.y)*Math.min(1,dt*12),player.pos.z);player.c.yaw=player.yaw;player.c.back=spd<0;updChar(player.c,spd<0?1.2:spd,dt,true);
  }
 if(state==='play'&&player.hp<=0)gameOver('WASTED');
 if(state==='dead'){deadT-=dt;if(player.c.body){const b=player.c.body;player.pos.set(b.position.x,b.position.y-.55,b.position.z);}updChar(player.c,0,dt,true);if(deadT<=0)respawn();}
 if(play&&!player.car&&player.weapon!=='fist'&&player.c.aim>0)for(const p of peds){if(p.mode!=='walk'&&p.mode!=='stand')continue;const dx=p.pos.x-player.pos.x,dz=p.pos.z-player.pos.z,d=Math.hypot(dx,dz);if(d<12&&Math.abs(wrapA(Math.atan2(dx,dz)-player.yaw))<.5&&los(player.pos,p.pos)){p.mode='cower';p.c.talk=0;p.cowerT=rnd(3,6);}}
 player.arrestContact=false;updPeds(dt);updUnits(cops,dt);player.arrestT=player.arrestContact?player.arrestT+dt:0;
 if(state==='play'&&player.arrestT>4.2)gameOver('BUSTED');
 updUnits(gang,dt);updUnits(guards,dt);updHelis(dt);manage(dt);updParts(dt);updPickups(dt);updRob(dt);updProps(dt,player.pos.x,player.pos.z);updateStreetLighting(dt,player.pos.x,player.pos.z);updateInteriors(dt,caseCamera.focus?.x??player.pos.x,caseCamera.focus?.z??player.pos.z,caseCamera.focus?.y??player.pos.y);updateOutdoorModels(dt,player.pos.x,player.pos.z);if(clerk)updChar(clerk,0,dt,true);
 for(const T of tracers)if(T.l.visible){T.t-=dt;if(T.t<=0)T.l.visible=false;}muzzleL.intensity=Math.max(0,muzzleL.intensity-dt*150);boomL.intensity=Math.max(0,boomL.intensity-dt*25);
 /* wanted */
 if(state==='play'){updateStreetEncounter(dt);updateDepartment(dt);updateTrafficPatrol(dt);updateLaw(dt);}
 const cleanView=$('ui').classList.contains('cleanView');
 for(const m of markerObjs){
  const at=m.p.road||m.p.interact||m.p.door,d=Math.hypot(at.x-player.pos.x,at.z-player.pos.z);
  const close=d<27&&!cleanView;
  if(m.p.label)m.p.label.visible=close&&d>7;
  m.beam.visible=close;
  m.ring.visible=close;
  m.beam.material.opacity=m.p.cd>0?.02:.055+.024*Math.sin(time*3);
  m.ring.material.opacity=m.p.cd>0?.19:.55;
 }
 /* camera */
 if(dragId===null&&!agentInput?.looking){lookYaw*=Math.exp(-4*dt);lookPitch*=Math.exp(-4*dt);}
 const tgt=player.car?player.car.pos:player.pos;if(player.car){const c=player.car;const vh=Math.hypot(c.vel.x,c.vel.z)>4&&c.speed>0?Math.atan2(c.vel.x,c.vel.z):c.h;camYaw=lerpA(camYaw,lerpA(c.h,vh,.5),1-Math.exp(-4.5*dt));}else camYaw=lerpA(camYaw,player.yaw,1-Math.exp(-9*dt));
 if(cameraMode===3 && !player.car?.steeringWheel)cameraMode=0;
 const aerial=cameraMode===2, low=cameraMode===1,car=player.car,yawC=camYaw+lookYaw;
 const speed=car?Math.hypot(car.vel.x,car.vel.z):0;
 const dist=aerial?25:car?((low?4.7:6.25)+car.spec.L*.39+Math.min(speed,45)*.047):low?3:4.55;
 const height=aerial?35.0:(car?(low?.87:2.02)+car.spec.r*.47:low?1.42:2.16)+lookPitch*2.65;
 const gy=car?Math.max(0,car.mesh.position.y):Math.max(groundY(tgt.x,tgt.z,player.pos.y),player.c.root.position.y);
 const cx=tgt.x-Math.sin(yawC)*dist,cz=tgt.z-Math.cos(yawC)*dist;
 const f=cameraClearance(tgt.x,(car?1.15:1.62)+gy,tgt.z,cx,height+gy,cz);
 const want=new V3(lerp(tgt.x,cx,f),lerp((car?1.15:1.62)+gy,height+gy,f),lerp(tgt.z,cz,f));
 if(!camInit){camPos.copy(want);camInit=true;}
 camPos.lerp(want,1-Math.exp(-(f<.99?23:aerial?4.8:car?8:11)*dt));
 camera.position.copy(camPos);
 if(shake>0){
  camera.position.x+=Math.sin(time*34)*shake*.20;
  camera.position.y+=Math.sin(time*41)*shake*.14;
  shake=Math.max(0,shake-dt*1.8);
 }
 const ahead=aerial?29:low?5:3.0;
 camera.up.set(0,1,0);
 camera.lookAt(tgt.x+Math.sin(yawC)*ahead,(aerial?3:car?1.06:1.43)+gy-lookPitch*1.3,tgt.z+Math.cos(yawC)*ahead);
 if(cameraMode===3 && car.seatedDriver){
  const rotation=car.mesh.quaternion,head=car.seatedDriver.bones[BMAP.Head];
  car.mesh.worldToLocal(head.getWorldPosition(camera.position));
  camera.position.y=clamp(camera.position.y+.085,car.spec.r-.245,car.spec.r-.185);
  camera.position.z+=.15;car.mesh.localToWorld(camera.position);
  const yaw=clamp(lookYaw,-1.35,1.35),pitch=clamp(-.10-lookPitch,-.65,.30);
  want.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).applyQuaternion(rotation);
  camera.up.applyQuaternion(rotation);camera.lookAt(want.add(camera.position));
 }
 const baseFov=cameraMode===3?72:innerWidth<innerHeight?68:low?53:56;
 const fov=baseFov+(aerial?4:car?Math.min(speed,46)*.17:0);
 if(Math.abs(fov-camera.fov)>.01){
  camera.fov=lerp(camera.fov,fov,1-Math.exp(-3.4*dt));
  camera.updateProjectionMatrix();
 }
 globalThis.WashHouse?.portrait(camera);
 updateCaseCamera(dt);
 sky.position.copy(camera.position);
 const viewTarget=caseCamera.focus||tgt;
 sun.position.copy(viewTarget).addScaledVector(keyDirection,250);
 sun.target.position.copy(viewTarget);
 if(POST){PP.final.uniforms.hurt.value=Math.max(0,hurtT>0?hurtT*2.5:0)+(player.hp<30&&state==='play'?(.3+.2*Math.sin(time*5)):0);hurtT-=dt;}
 updateWeatherSound();
 if(ac){const t=ac.currentTime;const c=player.car;if(c){const sp=Math.abs(c.speed),rpm=enginePitch(sp);engG.gain.setTargetAtTime(.06+Math.min(1,Math.abs(jy))*.04,t,.1);engO.frequency.setTargetAtTime(40+rpm*90*(c.type==='sport'?1.4:1),t,.06);engO2.frequency.setTargetAtTime(20+rpm*45,t,.06);engF.frequency.setTargetAtTime(300+rpm*900,t,.1);
   scrG.gain.setTargetAtTime(c.sliding&&sp>5?.12:0,t,.05);}else{engG.gain.setTargetAtTime(0,t,.2);scrG.gain.setTargetAtTime(0,t,.1);}
  let dn=1e9;if(wanted>0)for(const k of cars)if(k.driver==='police')dn=Math.min(dn,dist2(k.pos,tgt));sirG.gain.setTargetAtTime(wanted>=3&&LAW.seen?clamp(1-dn/120,0,1)*.06:0,t,.2);sirO.frequency.setTargetAtTime(760+260*Math.sin(time*Math.PI*2*.9),t,.03);
  let hn=1e9;for(const h of helis)hn=Math.min(hn,h.pos.distanceTo(camera.position));heliG.gain.setTargetAtTime(clamp(1-hn/160,0,1)*.35,t,.2);}
 if(player.car)player.car.sliding=false;
 if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.classList.remove('on');}if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('banner').classList.remove('on');}}
function loop(){
 requestAnimationFrame(loop);
 const elapsed=clock.getDelta(),dt=document.hidden?0:Math.min(elapsed,.25);
 if(window.asphaltAgent?.paused)return;
 if((state==='play'||state==='dead')&&dt>0){
  const steps=Math.ceil(dt/.05);for(let i=0;i<steps;i++)step(dt/steps);hud();mmT-=dt;
  if(mmT<=0){mmT=1/12;drawMap();}
  if(state==='play'&&!qp.has('q')){
   fpsAcc+=elapsed;fpsN++;fpsCheck+=elapsed;
   if(fpsCheck>4&&fpsN>0){
    const fps=fpsN/fpsAcc;
    fpsAcc=fpsN=fpsCheck=0;
    if(fps<26&&QUALITY.level>0){
     QUALITY.level--;
     applyQuality();
     if(sun.shadow.mapSize.x!==QUALITY.shadow){
      sun.shadow.map?.dispose();
      sun.shadow.map=null;
      sun.shadow.mapSize.setScalar(QUALITY.shadow);
     }
     resize();
    }
   }
  }
 }
 if(state==='play'||state==='dead')renderFrame(time);
}
/* ================= boot ================= */
function setLoad(t,p){$('load').textContent=t;if(p!=null)$('lbar').firstChild.style.width=Math.round(p*100)+'%';}
function initGame(){buildMinimapBase();buildMarkers();initializePoliceLives();installTrafficPosts();
 const hp=places.find(p=>p.kind==='hospital'),pp=places.find(p=>p.kind==='police');
 SPAWN.hospital={x:hp.door.x+Math.sin(SIDEANG[hp.side])*.6,z:hp.door.z+Math.cos(SIDEANG[hp.side])*.6,yaw:SIDEANG[hp.side]};SPAWN.police={x:pp.door.x+Math.sin(SIDEANG[pp.side])*.6,z:pp.door.z+Math.cos(SIDEANG[pp.side])*.6,yaw:SIDEANG[pp.side]};
 const streetStart={x:CELL*4-HALF-.88,z:CELL*5+HALF+10,yaw:0};
 const stationVisit=qp.get('visit')==='police';
 const shopVisit=qp.get('visit')==='wash-house'&&globalThis.WashHouse?.destination();
 const start=shopVisit|| (stationVisit?{x:pp.door.x,z:pp.door.z,yaw:SIDEANG[pp.side]+Math.PI}:streetStart);
 player={pos:new V3(start.x,0,start.z),yaw:start.yaw,hp:100,armor:0,cash:250,car:null,fireCd:0,arrestT:0,spd:0,guardT:0,down:0,weapon:'fist',own:{pistol:true,smg:false,shotgun:false},ammo:{pistol:36,smg:0,shotgun:0},c:null};
 player.personId='ah-player';PoliceDepartment.identify(player);player.gloves=false;
 player.c=makePlayerChar();dressPlayerHands();camYaw=player.yaw;
 for(let k=0;k<QUALITY.peds;k++){const p={c:null,pos:new V3(),mode:'walk',t:0,R:null,dir:1,spd:1.4,fleeT:0,fv:new V3(),downT:0,hp:60,cash:0,dead:false};peds.push(p);placePed(p,nearBlock(0,140),k%5===0);}
 seedNeighborhoodWalkers();
 {const s=spawnCar('sport',CELL*4-HALF+1.9,streetStart.z+2.75,0,null);paintCar(s,0x711b29);s.keep=true;s.heroWanted=true;}
 {const c=spawnCar('hatch',CELL*2+5.9,CELL*4+31,Math.PI,null);paintCar(c,0xa27a27);c.keep=true;}
 {const c=spawnCar('van',CELL*2+5.9,CELL*4+39,Math.PI,null);paintCar(c,0x20334b);c.keep=true;}
 parkServiceVehicles(hp,'amb',1);parkServiceVehicles(pp,'police',2);
 {const s=spawnCar('sedan',RIVERSIDE_PARKING.x,RIVERSIDE_PARKING.z,Math.PI/2,null);paintCar(s,0x662934);s.keep=true;s.heroWanted=true;s.heroAsset='maroon-saloon';}
 parkReferenceVehicles();
 addNeighborhoodCars();
 for(let k=0;k<(QUALITY.level>=2?20:14);k++)spawnTraffic(15,420);for(let k=0;k<12;k++)spawnParked();for(const P of PARKED)spawnParked(P.x,P.z,P.h);for(let k=0;k<2;k++)spawnPolice(false);
 for(const p of places)if(p.kind==='hospital')for(const s of[-1,1]){const q=dropPickup('health',p.door.x+Math.cos(SIDEANG[p.side])*s*3,p.door.z-Math.sin(SIDEANG[p.side])*s*3,0);q.fixed=true;}
 {const q=dropPickup('armor',CELL*2.5,CELL*2.5+20,0);q.fixed=true;}
 {const court=blocks.find(B=>B.gang);if(court)for(let k=0;k<4;k++)spawnUnit('gang',court.gang.x+rnd(-10,10),court.gang.z+rnd(-6,6),'gang');}
 state='title';}
async function boot(){resize();state='loading';setLoad('Loading city…',0);
 const mgr=THREE.DefaultLoadingManager;let tot=1,done=0;mgr.onStart=(u,l,t)=>{done=l;tot=t;};mgr.onProgress=(u,l,t)=>{done=l;tot=t;if(state==='loading')setLoad('Loading city & people… '+Math.round(l/t*100)+'%',l/t*.85);};
 await loadSky();
 const cast=await (await fetch('models/cast.json')).json();
 const lowSet=['Male_Adult_07','Police_Male_01','Police_Male_02','Police_Male_03','Police_Male_07','Medical_Female_01','Military_Male_01','Security_Male_01','Male_Adult_10','Male_Adult_03','Medical_Male_01','Male_Adult_01','Male_Adult_04','Male_Adult_08','Business_Male_01','Female_Adult_01','Female_Adult_03','Female_Adult_07','Business_Female_01','Sports_Male_01','Sports_Female_01'];
 const names=Object.keys(cast).filter(n=>QUALITY.level>=2||lowSet.includes(n));
 const L=new THREE.GLTFLoader();const ld=u=>new Promise((res,rej)=>L.load(u,res,undefined,rej));
 initMaterials();
 let anim;try{anim=await ld('models/anim_x.json');}catch(e){console.warn(e);}
 const gl=await Promise.all(names.map(n=>ld('models/'+n+'.json').catch(e=>null)));
 await new Promise(r=>{if(done>=tot)r();else{const o=mgr.onLoad;mgr.onLoad=()=>{o&&o();r();};}});
 setLoad('Rigging people…',.88);await new Promise(r=>setTimeout(r,30));
 addAnimSource('x',anim,0,null);
 names.forEach((n,i)=>{if(!gl[i])return;try{addTemplate(n,gl[i],cast[n],'x',{idle:'idle',walk:'walk',run:'run',talk:'agree'});CAST[n]=cast[n];}catch(e){console.warn(n,e);}});
 for(const n in CAST){const r=CAST[n];(ROLE[r]=ROLE[r]||[]).push(n);if(/Business_Male/.test(n))(ROLE.mb=ROLE.mb||[]).push(n);if(/Business_Female/.test(n))(ROLE.fb=ROLE.fb||[]).push(n);if(/Construction/.test(n))(ROLE.work=ROLE.work||[]).push(n);}
 if(!ROLE.clerk)ROLE.clerk=ROLE.m;for(const r of['cop','swat','army','guard','gang','medic','beach'])if(!ROLE[r])ROLE[r]=ROLE.m;
 setLoad('Building streets…',.92);await new Promise(r=>setTimeout(r,30));state='building';
 await buildCityRest();physInit();indexStatic();physWorld();installWorksPhysics();initProps();initParts();initTracers();initSkids();initCarLenses();initWheels(320);initGame();initWeatherCover();setCityEnvironment();
 refreshPhysicalWorld(player.pos.x,player.pos.z);updProps(.5,player.pos.x,player.pos.z);camera.position.set(302,52,390);camera.lookAt(262,4,312);renderFrame(0);
 $('play').disabled=false;setLoad('Ready',1);}
async function buildCityRest(){const coastReady=loadCoveLayout();SEED=4242;initAwnings();initSigns();initStreetMaterials();initPaving();initInteriors();initWorksMaterials();initRetailFascias();initShopArchitecture();
 const streetBounds=worksRect(W/2-(S+40)/2,W/2+(S+40)/2,W/2-10-(S+20)/2,W/2-10+(S+20)/2);
 const asph=new THREE.Mesh(worksGroundMesh(streetBounds,-.009,7,0,0),MAT.asphalt);asph.receiveShadow=true;scene.add(asph);
 for(const t of [MAT.asphalt.map,MAT.asphalt.normalMap,MAT.asphalt.roughnessMap])t.repeat.set(1,1);
 for(let i=0;i<N;i++){
  for(let j=0;j<N;j++){const x0=i*CELL+HALF,x1=(i+1)*CELL-HALF,z0=j*CELL+HALF,z1=(j+1)*CELL-HALF;const B={i,j,x0,x1,z0,z1,bld:[],park:false,dist:districtOf(i,j)};blocks.push(B);
  streetProps(B);if(i<ORIGINAL_GRID&&j<ORIGINAL_GRID||(i+j)%3===0)streetDetails(B);if(buildWorksBlock(B)||buildAuthoredBlock(B)||reserveGradeBlock(B))continue;const sp=SPECIAL[i+','+j];if(sp&&sp.kind==='park'){B.park=true;park(B);continue;}if(sp){special(B,sp);continue;}
  const R={x0:x0+SW,x1:x1-SW,z0:z0+SW,z1:z1-SW};if(B.dist==='docks'&&(i+j)%3===0){warehouses(B,{x0:R.x0,x1:R.x1,z0:R.z0,z1:(R.z0+R.z1)/2-1});containers(R.x0+1,R.x1-1,(R.z0+R.z1)/2+1,R.z1-1);continue;}fillDistrict(B,R,B.dist);}
  for(let j=0;j<N;j++)planUpperRooms(blocks[i*N+j]);
  finishBuildingProxies();
  if(i%4===3){
   flushBuckets();
   setLoad('Building streets… '+Math.round((i+1)/N*100)+'%',.93+.05*(i+1)/N);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 buildWorksGallery();installCityServices();buildCityDetail();await coastReady;beach();skyline();buildFreightTerminal();buildGradeRoads();buildStreetNetwork();finishStreetDetails();flushBuckets();for(const m of scene.children)if(m.isMesh&&m.material===ATLAS.neon)m.renderOrder=2;plantTrees();buildTrafficLights();flushBuckets();initializeDoorMeshes();}
const startTime=$('startTime'),startWeather=$('startWeather');
if(hasCustomHour){
 startTime.add(new Option(weather.clockText,'custom'));startTime.value='custom';
}else if(['sunrise','sunset','night','noon'].includes(qp.get('light')))startTime.value=qp.get('light');
for(const [key,front] of Object.entries(WEATHER_FRONTS))startWeather.add(new Option(front.label,key));
if(Object.hasOwn(WEATHER_FRONTS,qp.get('weather')))startWeather.value=launchFront;
$('play').addEventListener('click',()=>{
 if(state!=='title')return;
 const hour=startTime.value==='custom'?launchHour:startingHour(startTime.value,weather.day);
 setCityEnvironment(hour,startWeather.value||'clouds',true);
 $('start').style.display='none';$('ui').hidden=false;$('touchViews').hidden=false;
 clock.getDelta();state='play';
});
window.__game={department:PoliceDepartment,cityWorks:CITY_WORKS,services:CITY_SERVICES,step,ff(n){for(let i=0;i<n;i++){step(1/30);}renderFrame(time);},scene,renderer,camera,sun,PH,get player(){return player},cars,peds,cops,gang,helis,places,PROPS,get heat(){return heat},set heat(v){heat=v},get wanted(){return wanted},get state(){return state},keys,inp,toggleCar,startRob,TPL,QUALITY};
loop();boot().catch(e=>{console.error(e);setLoad('Error: '+e.message);});
