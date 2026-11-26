/* ================= player, input, HUD, loop, boot ================= */
const SPAWN={hospital:null,police:null};
function makePlayerChar(){return makeChar(ROLE.player?ROLE.player[0]:pickChar('m'),{gun:1,shadow:true});}
function nearestCar(r){let best=null,bd=r;for(const c of cars){if(c.dead||Math.abs(c.pos.y-player.pos.y)>2.3)continue;const d=dist2(c.pos,player.pos);if(d<bd){bd=d;best=c;}}return best;}
function nearPlace(){for(const p of places){if(!p.door||p.road)continue;if(Math.hypot((p.interact||p.door).x-player.pos.x,(p.interact||p.door).z-player.pos.z)<2.4)return p;}return null;}
function actionCtx(){if(state!=='play'||shopOpen||player.down>0)return null;if(player.car)return doorInteraction(player.car.pos,4.1,'shutter')||{label:'EXIT',fn:toggleCar};if(robbing)return{label:'ROB…',fn:()=>{}};
 const doorway=doorInteraction(player.pos,1.83);if(doorway)return doorway;
 const p=nearPlace();if(p){if(p.kind==='store'||p.kind==='bank')return p.cd>0?{label:'CLOSED',fn:()=>toast('ALREADY HIT — COME BACK LATER',1500)}:{label:'ROB',fn:()=>startRob(p),hot:1};
  if(p.kind==='gunshop')return{label:'SHOP',fn:openShop,hot:1};if(p.kind==='hospital')return{label:'HEAL',fn:()=>{if(player.hp>=100)toast('YOU ARE FINE',1000);else if(player.cash<100)toast('NEED $100',1000);else{player.cash-=100;player.hp=100;toast('PATCHED UP −$100',1400);}},hot:1};}
 const c=nearestCar(3.6);if(c)return{label:c.driver?'JACK':'ENTER',fn:toggleCar,hot:1};return propInteraction(player.pos)||{label:'ACTION',fn:()=>{}};}
function toggleCar(){
 if(player.car){const c=player.car;c.driver=null;c.ai=null;c.express=null;player.car=null;player.pace=0;player.turn=0;setCarLights(c,false);const lx=Math.cos(c.h),lz=-Math.sin(c.h);const base=Math.max(0,c.mesh.position.y);
  const side=base>2&&!sampleGrade(c.pos.x+lx*2.1,c.pos.z+lz*2.1,base)?-1:1;
  player.pos.set(c.pos.x+lx*2.1*side,base,c.pos.z+lz*2.1*side);
  collideWorld(player.pos,.4);player.yaw=c.h;camYaw=c.h;player.c.root.visible=true;
  if(Math.abs(c.speed)>9){damagePlayer(Math.abs(c.speed)*.6);knockPlayer(c.vel.x*.8,1.5,c.vel.z*.8);}return;}
 const c=nearestCar(3.6);if(!c)return;const lx=Math.cos(c.h)*2.2,lz=-Math.sin(c.h)*2.2;
 if(c.driver==='ai'){ejectPed(c.pos.x+lx,c.pos.z+lz,c.pos.x,c.pos.z);crime(12,c.pos.x,c.pos.z);toast('CARJACKED!',1300);scare(c.pos.x,c.pos.z,15);}
 else if(c.driver==='police'){spawnUnit(c.unit||'cop',c.pos.x+lx,c.pos.z+lz);crime(30,c.pos.x,c.pos.z,true);toast('STOLE A COP CAR!',1300);}
 else if(c.type==='police'||c.type==='swat'){crime(25,c.pos.x,c.pos.z);toast('STOLE A COP CAR!',1300);}
 else{toast(c.type==='sport'?'NICE RIDE':'HOTWIRED',900);if(Math.random()<.35){beep(900,.2,.12);beep(700,.2,.12);crime(4,c.pos.x,c.pos.z);}}
 c.driver='player';c.ai=null;c.express=null;c.route=null;c.block=false;c.keep=false;player.car=c;player.c.root.visible=false;camYaw=c.h;if(!c.phys)physCarOn(c);c.body.wakeUp();setCarLights(c,false);}
function knockPlayer(vx,vy,vz){if(player.car||player.down>0)return;player.down=2.6;ragdoll(player.c,vx,vy,vz);}
function cycleWeapon(){const order=['fist','pistol','smg','shotgun'];let i=order.indexOf(player.weapon);for(let k=1;k<=4;k++){const w=order[(i+k)%4];if(w==='fist'||(player.own[w]&&player.ammo[w]>0)){player.weapon=w;break;}}}
function playerAttack(){if(player.fireCd>0||shopOpen||player.down>0)return;const w=player.weapon,car=player.car;
 if(w==='fist'&&!car){player.fireCd=WEAP.fist.rate;player.c.punch=0;player.c.guard=1;player.guardT=1.5;let best=null,bd=2.1;const yaw=player.yaw;const cand=[];
  for(const p of peds)if(!p.dead)cand.push([p,'ped']);for(const arr of[cops,gang,guards])for(const u of arr)if(!u.dead)cand.push([u,'unit']);
  for(const[o,k]of cand){const dx=o.pos.x-player.pos.x,dz=o.pos.z-player.pos.z,d=Math.hypot(dx,dz);if(d<bd&&Math.abs(wrapA(Math.atan2(dx,dz)-yaw))<1.1){bd=d;best=[o,k,dx,dz];}}
  if(best){const[o,k,dx,dz]=best;player.yaw=Math.atan2(dx,dz);setTimeout(()=>{if(o.dead)return;noise(.12,240,.6);emit(o.pos.x,1.55,o.pos.z,0,1,0,.15,.15,.4,0xffffff,true);if(k==='ped')hitPed(o,20,dx,dz,true);else hitUnit(o,20,dx,dz,true);},120);}else noise(.08,600,.15);return;}
 const W2=WEAP[w==='fist'?'pistol':w];if(w!=='fist'&&player.ammo[w]<=0){toast('OUT OF AMMO',900);player.weapon='fist';return;}
 if(w==='fist'&&car){toast('SWITCH TO A GUN TO DRIVE-BY',1000);player.fireCd=.5;return;}
 player.fireCd=W2.rate;player.ammo[w]--;lastShot=time;const yaw=car?car.h:player.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
 const o=car?new V3(car.pos.x+fx*(car.spec.L/2+.4),1.2,car.pos.z+fz*(car.spec.L/2+.4)):new V3(player.pos.x+fx*.7-Math.cos(yaw)*.25,player.c.root.position.y+1.42,player.pos.z+fz*.7+Math.sin(yaw)*.25);
 let best=null,bs=1e9;const cone=car?.3:.55;
 const cons=(x,z,y,obj,kind)=>{const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz);if(d>(kind==='heli'?80:W2.range)||d<.4)return;const a=Math.abs(wrapA(Math.atan2(dx,dz)-yaw));if(a>(kind==='heli'?.9:cone))return;const sc=d*(1+a*2.5)*(kind==='unit'?.6:kind==='car'?1.4:kind==='heli'?.8:1);if(sc<bs&&(kind==='heli'||rayWorld(o.x,o.z,x,z)>=1)){bs=sc;best={x,y,z,obj,kind};}};
 for(const p of peds)if(!p.dead&&p.c.root.visible)cons(p.pos.x,p.pos.z,1.3,p,'ped');for(const arr of[cops,gang,guards])for(const u of arr)if(!u.dead)cons(u.pos.x,u.pos.z,1.3,u,'unit');
 for(const c of cars)if(c!==car&&!c.dead)cons(c.pos.x,c.pos.z,1,c,'car');for(const h of helis)if(!h.dead)cons(h.pos.x,h.pos.z,h.pos.y,h,'heli');
 if(best&&!car)player.yaw=Math.atan2(best.x-player.pos.x,best.z-player.pos.z);if(!car)player.c.aim=.6;const pel=W2.pel||1;
 for(let k=0;k<pel;k++){let end;
  if(best&&Math.random()<W2.acc*(pel>1?.8:1)){end=new V3(best.x+rnd(-.25,.25),best.y+rnd(-.2,.2),best.z+rnd(-.25,.25));const dx=best.x-o.x,dz=best.z-o.z;
   if(best.kind==='ped'){hitPed(best.obj,W2.dmg,dx,dz,false);emit(end.x,end.y,end.z,0,1,0,.25,.3,.6,0x5a0808,false);}
   else if(best.kind==='car'){damageCar(best.obj,W2.dmg*.28);emit(end.x,end.y,end.z,rnd(-3,3),rnd(1,4),rnd(-3,3),.25,.12,.08,0xffe080,true,10);if(best.obj.phys){best.obj.body.wakeUp();best.obj.body.applyImpulse(new CV(fx*60,0,fz*60),new CV(end.x-best.obj.body.position.x,end.y-best.obj.body.position.y,end.z-best.obj.body.position.z));}
    if(best.obj.driver==='police'||best.obj.type==='police')crime(5,best.obj.pos.x,best.obj.pos.z,true);else if(best.obj.driver==='ai')crime(4,best.obj.pos.x,best.obj.pos.z);}
   else if(best.kind==='heli'){best.obj.hp-=W2.dmg;emit(end.x,end.y,end.z,0,0,0,.2,.6,.2,0xffe080,true);if(best.obj.hp<=0&&!best.obj.dead){best.obj.dead=true;best.obj.vel.set(rnd(-3,3),2,rnd(-3,3));crime(80,player.pos.x,player.pos.z,true);toast('CHOPPER DOWN!',1500);}}
   else{hitUnit(best.obj,W2.dmg,dx,dz,false);emit(end.x,end.y,end.z,0,1,0,.25,.3,.6,0x5a0808,false);}}
  else{const a=yaw+rnd(-.06,.06)*(pel>1?3:1),L=W2.range;const ex=o.x+Math.sin(a)*L,ez=o.z+Math.cos(a)*L,f=rayWorld(o.x,o.z,ex,ez);end=new V3(o.x+(ex-o.x)*f,o.y+rnd(-.5,.3),o.z+(ez-o.z)*f);if(f<1)for(let q=0;q<3;q++)emit(end.x,end.y,end.z,rnd(-2,2),rnd(1,3),rnd(-2,2),.3,.15,.08,0xffd090,true,9);}
  tracer(o,end);}
 emit(o.x,o.y,o.z,0,0,0,.05,.5,1,0xffd070,true);muzzleL.position.copy(o);muzzleL.intensity=12;noise(w==='shotgun'?.35:.16,w==='shotgun'?1600:2600,.5);scare(player.pos.x,player.pos.z,30);
 for(const c of cops)if(!c.dead&&dist2(c.pos,player.pos)<35){crime(6,player.pos.x,player.pos.z,true);break;}if(player.ammo[w]<=0){toast('OUT OF AMMO',900);cycleWeapon();}}
function startRob(p){if(player.weapon==='fist'){toast('PULL OUT A GUN FIRST',1400);return;}robbing={p,t:0,beep:0};crime(p.heat,p.door.x,p.door.z,true);scare(p.door.x,p.door.z,30);
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
function updRob(dt){if(!robbing)return;const p=robbing.p;const at=p.interact||p.door,d=Math.hypot(at.x-player.pos.x,at.z-player.pos.z);
 if(player.car||d>3.4||state!=='play'){robbing=null;toast('ROBBERY ABANDONED',1400);if(clerk)clerk.hands=0;return;}
 robbing.t+=dt;robbing.beep-=dt;player.c.aim=.3;if(robbing.beep<=0){robbing.beep=.45;beep(robbing.t%.9<.45?1250:950,.25,.12);}
 if(robbing.t>=p.time){const cash=rint(p.cash[0],p.cash[1]);player.cash+=cash;toast(`+$${cash.toLocaleString()} SCORED!`,2200);if(p.heat2)crime(p.heat2,p.door.x,p.door.z,true);p.cd=p.kind==='bank'?300:150;robbing=null;}}
function openShop(){shopOpen=true;$('shop').style.display='flex';renderShop();}
function renderShop(){const items=[['pistol','Pistol ammo ×36','Reliable sidearm',150],['smg',player.own.smg?'SMG ammo ×120':'SMG + 120 rounds','Spray and pray',player.own.smg?300:1200],['shotgun',player.own.shotgun?'Shotgun shells ×24':'Shotgun + 24 shells','Devastating up close',player.own.shotgun?300:1600],['armor','Body armor','Absorbs 70% of damage',400]];
 const box=$('items');box.innerHTML='';for(const[id,t,s,price]of items){const row=document.createElement('div');row.className='it';const info=document.createElement('div');const b=document.createElement('b');b.textContent=t;const sp=document.createElement('span');sp.textContent=s;info.append(b,sp);
  const btn=document.createElement('button');btn.textContent='$'+price;btn.disabled=player.cash<price;btn.addEventListener('click',()=>{if(player.cash<price)return;player.cash-=price;if(id==='pistol')player.ammo.pistol+=36;else if(id==='smg'){player.own.smg=true;player.ammo.smg+=120;}else if(id==='shotgun'){player.own.shotgun=true;player.ammo.shotgun+=24;}else player.armor=100;beep(1200,.08,.15,'sine');renderShop();});row.append(info,btn);box.append(row);}}
$('shopX').addEventListener('click',()=>{shopOpen=false;$('shop').style.display='none';});
function gameOver(kind){if(state!=='play')return;state='dead';deadT=4.5;deadKind=kind;const b=$('big');b.textContent=kind;b.className='show'+(kind==='BUSTED'?' busted':'');robbing=null;
 if(kind==='BUSTED')player.c.hands=1;else if(!player.car&&!player.c.body)ragdoll(player.c,rnd(-1,1),1,rnd(-1,1));noise(.8,300,.4);}
function respawn(){state='play';$('big').className='';const busted=deadKind==='BUSTED';const lost=busted?Math.round(player.cash*.3):Math.min(player.cash,200);player.cash-=lost;
 if(player.car){player.car.driver=null;setCarLights(player.car,false);player.car=null;}player.hp=100;player.arrestT=0;player.down=0;player.pace=0;player.turn=0;heat=0;wanted=0;evadeT=0;resetDispatch();
 if(busted){player.own.smg=player.own.shotgun=false;player.ammo={pistol:12,smg:0,shotgun:0};player.weapon='fist';player.armor=0;}
 const sp=busted?SPAWN.police:SPAWN.hospital;player.pos.set(sp.x,0,sp.z);player.yaw=sp.yaw;camYaw=sp.yaw;removeChar(player.c);player.c=makePlayerChar();
 for(const arr of[cops,guards])for(const u of arr.slice())removeUnit(u,arr);for(const g of gang)g.hostile=false;
 for(const c of cars.slice())if((c.type==='police'||c.type==='swat')&&!c.keep&&dist2(c.pos,player.pos)<150)removeCar(c);for(const h of helis.slice())removeHeli(h);if(clerk){removeChar(clerk);clerk=null;}
 toast(busted?`BUSTED · BAIL −$${lost} · WEAPONS TAKEN`:`HOSPITAL BILL −$${lost}`,2600);}
/* ================= input ================= */
let cameraMode=0;
const keys={};const inp={jx:0,jy:0,fire:false,sprint:false};let joyId=null,joyC=[0,0],dragId=null,dragX=0,dragY=0;
addEventListener('keydown',e=>{if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();if(e.repeat)return;if(e.code==='KeyM'&&state==='play'&&!shopOpen){toggleCityMap();return;}if($('cityMap').open)return;keys[e.code]=true;if(state==='play'){if(e.code==='KeyC'){const a=actionCtx();a&&a.fn();}if(e.code==='KeyZ')cycleWeapon();
 if(e.code==='KeyV'){cameraMode=(cameraMode+1)%3;}
 if(e.code==='KeyH')$('ui').classList.toggle('cleanView');}});
addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{for(const k in keys)keys[k]=false;inp.fire=false;});
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
const mm=$('mm'),mg=mm.getContext('2d');const MMB=document.createElement('canvas');MMB.width=MMB.height=800;
const MAP_SIZE=W+150+2*HALF;
function buildMinimapBase(){
 const g=MMB.getContext('2d'),k=MMB.width/MAP_SIZE;
 const fill=(r,color)=>{
  g.fillStyle=color;
  g.fillRect((r.x0+HALF)*k,(r.z0+HALF)*k,(r.x1-r.x0)*k,(r.z1-r.z0)*k);
 };
 g.fillStyle='#1d5866';
 g.fillRect(0,0,MMB.width,MMB.height);
 fill({x0:-HALF,x1:W+HALF,z0:-HALF,z1:W+HALF},'#686e72');
 g.fillStyle='#ac976c';
 g.beginPath();
 g.moveTo((W+2*HALF)*k,0);
 for(let z=-HALF;z<QUAY_Z;z+=8)g.lineTo((shoreline(z)+HALF)*k,(z+HALF)*k);
 g.lineTo((shoreline(QUAY_Z)+HALF)*k,(QUAY_Z+HALF)*k);
 g.lineTo((W+2*HALF)*k,(QUAY_Z+HALF)*k);
 g.fill();
 fill({x0:W+40,x1:W+150,z0:PIER_Z-4,z1:PIER_Z+4},'#ab926f');
 fill({x0:W+HALF,x1:W+84,z0:QUAY_Z,z1:W+HALF},DISTRICTS.docks.color);
 for(const B of blocks){
  fill(B,B.park?'#415942':DISTRICTS[B.dist].color);
  for(const R of B.bld)fill(R,'rgba(255,255,255,.10)');
 }
 for(const r of CITY_INFILL)fill(r,r.green?'#415942':'#555044');
 drawGradeRoads(g,k);
}
function drawCityMap(){
 const canvas=$('overview'),g=canvas.getContext('2d'),k=canvas.width/MAP_SIZE;
 g.drawImage(MMB,0,0,canvas.width,canvas.width);
 g.textAlign='center';
 g.textBaseline='middle';
 g.lineJoin='round';
 g.font='bold 20px Inter, sans-serif';
 for(const {name,label:[x,z]} of Object.values(DISTRICTS)){
  g.lineWidth=5;
  g.strokeStyle='#202322';
  g.fillStyle='#fff2d5';
  g.strokeText(name,(x+HALF)*k,(z+HALF)*k);
  g.fillText(name,(x+HALF)*k,(z+HALF)*k);
 }
 g.font='bold 15px Inter, sans-serif';
 for(const [label,x,z] of [['ROUTE 6',570,642],['JUNIPER PKWY',130,65],['MARKET CUT',435,473],['DUNE DR',951,262],['FOUNDRY WAY',846,792],['N',28,26]]){
  g.strokeText(label,(x+HALF)*k,(z+HALF)*k);
  g.fillText(label,(x+HALF)*k,(z+HALF)*k);
 }
 const at=player.car?.pos||player.pos;
 g.beginPath();
 g.arc((at.x+HALF)*k,(at.z+HALF)*k,7,0,Math.PI*2);
 g.fillStyle='#fff';
 g.strokeStyle='#1d332e';
 g.fill();g.stroke();
}
function toggleCityMap(){
 const map=$('cityMap');
 if(map.open){map.close();return;}
 for(const key in keys)keys[key]=false;
 inp.fire=false;
 inp.jx=inp.jy=0;
 if(ac)for(const gain of [engG,scrG,sirG,heliG])gain.gain.setTargetAtTime(0,ac.currentTime,.05);
 drawCityMap();
 map.showModal();
}
$('mapOpen').addEventListener('click',()=>{if(state==='play'&&!shopOpen)toggleCityMap();});
$('mapClose').addEventListener('click',()=>toggleCityMap());
const MICON={store:['$','#ffd040'],bank:['B','#ffd040'],gunshop:['G','#ff8a30'],hospital:['H','#ff4060'],police:['P','#4a8aff'],chop:['C','#40ff80'],spray:['R','#40a8ff']};
function drawMap(){const Wd=300,k=Wd/240,pp=player.car?player.car.pos:player.pos,px=pp.x,pz=pp.z,yaw=camYaw+lookYaw,rot=yaw-Math.PI,cs=Math.cos(rot),sn=Math.sin(rot);
 mg.save();mg.fillStyle='#1a1d22';mg.fillRect(0,0,Wd,Wd);mg.beginPath();mg.arc(150,150,150,0,7);mg.clip();mg.save();mg.translate(150,150);mg.rotate(rot);mg.drawImage(MMB,(-HALF-px)*k,(-HALF-pz)*k,MAP_SIZE*k,MAP_SIZE*k);mg.restore();
 const Tm=(x,z,cr)=>{let dx=(x-px)*k,dz=(z-pz)*k;let X=dx*cs-dz*sn,Y=dx*sn+dz*cs;const l=Math.hypot(X,Y);if(cr&&l>cr){X*=cr/l;Y*=cr/l;}return[150+X,150+Y];};
 const dot=(x,z,c,r,cr=135)=>{const[X,Y]=Tm(x,z,cr);mg.fillStyle=c;mg.beginPath();mg.arc(X,Y,r,0,7);mg.fill();mg.lineWidth=3;mg.strokeStyle='#000';mg.stroke();};const fl=Math.floor(time*6)%2;
 for(const c of cars)if(c.driver==='police')dot(c.pos.x,c.pos.z,wanted>0?(fl?'#ff3b3b':'#3b8bff'):'#6fa0ff',8);if(wanted>0)for(const c of cops)if(!c.dead)dot(c.pos.x,c.pos.z,'#3b8bff',5);
 for(const g of gang)if(!g.dead&&g.hostile)dot(g.pos.x,g.pos.z,'#40d040',5);for(const h of helis)if(!h.dead)dot(h.pos.x,h.pos.z,'#ffffff',7);
 mg.font='bold 17px Inter,sans-serif';mg.textAlign='center';mg.textBaseline='middle';
 for(const p of places){const at=p.road||p.door;if(Math.hypot(at.x-px,at.z-pz)>345)continue;const[ch,col]=MICON[p.kind];const[X,Y]=Tm(at.x,at.z,128);mg.fillStyle=p.cd>0?'#555':col;mg.beginPath();mg.arc(X,Y,12,0,7);mg.fill();mg.strokeStyle='#000';mg.lineWidth=3;mg.stroke();mg.fillStyle='#111';mg.fillText(ch,X,Y+1);}
 mg.restore();mg.save();mg.translate(150,150);mg.rotate(yaw-(player.car?player.car.h:player.yaw));mg.fillStyle='#fff';mg.strokeStyle='#000';mg.lineWidth=3;mg.beginPath();mg.moveTo(0,-15);mg.lineTo(10,11);mg.lineTo(0,5);mg.lineTo(-10,11);mg.closePath();mg.stroke();mg.fill();mg.restore();}
/* ================= HUD ================= */
let hudCache={};const starEls=[...$('stars').children];
function hud(){const set=(k,v,f)=>{if(hudCache[k]!==v){hudCache[k]=v;f(v);}};
 const at=player.car?.pos||player.pos,key=parcelKey(at.x,at.z);
 const district=at.x>W?(at.z>=QUAY_Z?'docks':'beach'):blocks[key].dist;
 set('district',district,v=>$('district').textContent=DISTRICTS[v].name);
 set('cash',player.cash,v=>$('cash').textContent='$'+v.toLocaleString());set('hp',Math.max(0,Math.round(player.hp)),v=>$('hp').style.width=v+'%');
 set('ar',Math.round(player.armor),v=>{$('arbar').style.display=v>0?'block':'none';$('ar').style.width=v+'%';});
 set('car',player.car?Math.round(player.car.hp/player.car.max*100):-1,v=>{$('carbar').style.display=v<0?'none':'block';if(v>=0)$('chp').style.width=v+'%';});
 set('spd',player.car?Math.round(Math.abs(player.car.speed)*3.6):-1,v=>{$('speedo').style.display=v<0?'none':'block';if(v>=0)$('speedo').firstChild.textContent=v;});
 set('w',wanted,v=>starEls.forEach((s,i)=>s.classList.toggle('on',i<v)));const L=wanted,nxt=L<5?TH[L+1]:WANTED_MAX;
 set('heat',Math.round(L<5?(heat-TH[L])/(nxt-TH[L])*100:100),v=>$('heat').firstChild.style.width=clamp(v,0,100)+'%');
 set('ev',L>0?Math.round(evadeT/LV.evade[L]*100):0,v=>{$('evade').style.opacity=v>0?1:0;$('evade').firstChild.style.width=v+'%';});set('blink',L>0&&evadeT>1,v=>$('stars').classList.toggle('blink',v));
 const w=player.weapon;set('wep',w+(w==='fist'?'':player.ammo[w])+(player.car?'c':''),()=>{$('wep').firstChild.textContent=WEAP[w].n+' ';$('wep').lastChild.textContent=w==='fist'?'':player.ammo[w];$('bFire').textContent=w==='fist'&&!player.car?'PUNCH':'SHOOT';});
 const a=actionCtx();set('act',a?a.label:'',v=>{
  $('bAct').textContent=v||'ACTION';
  const prompt=$('interaction');
  prompt.hidden=!v||v==='ACTION'||v==='ROB…'||v==='EXIT';
  prompt.lastChild.textContent=v;
 });set('hot',!!(a&&a.hot),v=>$('bAct').classList.toggle('hot',v));set('spr',player.car?'DRIFT':'SPRINT',v=>$('bSprint').textContent=v);
 const obj=LAW.report&&wanted<2?'Witness calling 911':wanted>0&&!LAW.seen?'Searching the last sighting area':robbing?'Hold position until the cash is bagged!':L>=4?'Massive heat! Break line of sight and stay out of the searchlight':L>0?(L>=3?'Lose the cops — the respray only works up to 3 stars':'Lose the cops or hit the blue RESPRAY'):player.car?'Sell this car at the green CHOP SHOP, or explore':'Rob a store ($), the bank (B), or jack a car';
 set('obj',obj,v=>$('obj').textContent=v);
 set('prog',robbing?Math.round(robbing.t/robbing.p.time*100):-1,v=>{$('prog').style.display=v<0?'none':'block';if(v>=0){$('prog').lastChild.firstChild.style.width=v+'%';$('prog').firstChild.textContent=robbing.p.kind==='bank'?'CRACKING THE VAULT…':'EMPTYING THE REGISTER…';}});}
/* ================= main loop ================= */
const clock=new THREE.Clock();const camPos=new V3();let camInit=false,mmT=0,lodT=0,fpsAcc=0,fpsN=0,fpsCheck=0;
function cameraClearance(ax,ay,az,bx,by,bz){
 const x0=parcelAxis(CITY_X,Math.min(ax,bx)-.25),x1=parcelAxis(CITY_X,Math.max(ax,bx)+.25);
 const z0=parcelAxis(CITY_Z,Math.min(az,bz)-.25),z1=parcelAxis(CITY_Z,Math.max(az,bz)+.25);
 let f=1;
 for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const r of blocks[x*N+z].bld){
  const t=segRect(ax,az,bx-ax,bz-az,{x0:r.x0-.22,x1:r.x1+.22,z0:r.z0-.22,z1:r.z1+.22});
  if(t>=0&&t<f&&lerp(ay,by,t)<(r.h||12)+.24&&lerp(ay,by,t)>(r.y0||0)-.24)f=Math.max(.06,t-.08);
 }
 return f;
}
function step(dt){time+=dt;WATERT.value=time;
 refreshPhysicalWorld(player.pos.x,player.pos.z);
 const kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),ky=(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0);const play=state==='play'&&!shopOpen&&!$('cityMap').open;
 const jx=play?clamp(inp.jx+kx,-1,1):0,jy=play?clamp(inp.jy+ky,-1,1):0,fire=play&&(inp.fire||keys.Space),sprint=play&&(inp.sprint||keys.KeyX);
 player.fireCd-=dt;if(fire)playerAttack();updLights(time);
 lodT-=dt;if(lodT<=0){lodT=.5;physLOD();}
 /* controls before physics */
 for(const c of cars){if(c.dead){c.wreckT+=dt;if(c.burn>0){c.burn-=dt;if(Math.random()<.75)emit(c.pos.x+rnd(-.6,.6),1.3,c.pos.z+rnd(-.6,.6),rnd(-.5,.5),rnd(2,4),rnd(-.5,.5),rnd(.4,.8),.8,1.8,pick([0xff8a20,0xffb040]),true);if(Math.random()<.45)emit(c.pos.x,1.8,c.pos.z,rnd(-.5,.5),rnd(2,4),rnd(-.5,.5),2.2,1.5,5.5,0x302a28,false);if(c.burn<=0)explode(c);}
   else if(c.wreckT<15&&Math.random()<.2)emit(c.pos.x,1.4,c.pos.z,rnd(-.3,.3),rnd(1.5,3),rnd(-.3,.3),2.5,1,4,0x3a3634,false);if(c.phys)physCarControl(c,0,0,true,dt);continue;}
  if(c.hp<c.max*.4&&Math.random()<.25){const fx=Math.sin(c.h),fz=Math.cos(c.h);emit(c.pos.x+fx*c.spec.L*.36,c.spec.hb+.1,c.pos.z+fz*c.spec.L*.36,rnd(-.3,.3),rnd(1,2.5),rnd(-.3,.3),1.6,.6,2.5,c.hp<c.max*.2?0x333030:0x9a9a9a,false);}
  if(c===player.car){drive(c,jy,-jx,sprint,dt);}
  else if(c.driver==='ai')aiTraffic(c,dt);
  else if(c.driver==='police'){if(wanted>0){c.siren=c.dispatched&&wanted>=3&&LAW.seen;aiPolice(c,dt);}else{c.siren=false;c.route=null;c.dispatched=false;aiTraffic(c,dt);}}
  else if(c.phys)physCarControl(c,0,0,true,dt);
  if(c.bar){const on=c.siren&&(wanted>0||c.block)&&(c.driver==='police'||c.block);const f=(time*7|0)%2;c.bar.r.material=on&&f?SIREN.onR:SIREN.offR;c.bar.b.material=on&&!f?SIREN.onB:SIREN.offB;}}
 physStep(dt);updateDoorMeshes();
 for(const c of cars){if(c.phys)physCarRead(c);syncCarMesh(c);c.mesh.visible=dist2(c.pos,player.pos)<230;}
 applyCarHits();
 wheelBegin();for(const c of cars)pushWheels(c,dt);wheelEnd();
 /* player on foot */
 if(player.car){player.pos.copy(player.car.pos);player.yaw=player.car.h;}
 else if(player.down>0){player.down-=dt;const b=player.c.body;if(b)player.pos.set(b.position.x,Math.max(0,b.position.y-.55),b.position.z);updChar(player.c,0,dt,true);if(player.down<=0&&state==='play'){releaseRagdoll(player.c);collideWorld(player.pos,.4);player.c.root.position.set(player.pos.x,groundY(player.pos.x,player.pos.z,player.pos.y),player.pos.z);}}
 else if(!(state==='dead'&&deadKind==='WASTED')){
  const yawTarget=Math.abs(jx)>.12?-jx*(Math.abs(jy)>.3?2.28:2.85):0;
  player.turn=lerp(player.turn||0,yawTarget,1-Math.exp(-14*dt));
  player.yaw+=player.turn*dt;
  const onSand=isSand(player.pos.x,player.pos.z);
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
  const hit=carHitsBody(player.pos,.3);if(hit&&state==='play'&&hit!==player.car){damagePlayer(Math.abs(hit.speed)*1.8);shake=.6;knockPlayer(hit.vel.x*1.1,2+Math.abs(hit.speed)*.2,hit.vel.z*1.1);scare(player.pos.x,player.pos.z,10);if(hit.driver==='ai')hit.wait=2;}
  for(const c of cars){if(c===player.car)continue;const dx=player.pos.x-c.pos.x,dz=player.pos.z-c.pos.z;const fx=Math.sin(c.h),fz=Math.cos(c.h);const f=dx*fx+dz*fz,l=dx*fz-dz*fx;const hl=c.spec.L/2+.3,hw=c.spec.W/2+.3;if(Math.abs(f)<hl&&Math.abs(l)<hw){const pf=hl-Math.abs(f),pl=hw-Math.abs(l);if(pf<pl){player.pos.x+=fx*Math.sign(f)*pf;player.pos.z+=fz*Math.sign(f)*pf;}else{player.pos.x+=fz*Math.sign(l)*pl;player.pos.z-=fx*Math.sign(l)*pl;}}}
  player.spd=Math.abs(spd);player.guardT-=dt;player.c.guard=player.guardT>0?1:0;const gy=groundY(player.pos.x,player.pos.z,player.pos.y),R=player.c.root;player.pos.y=gy;R.position.set(player.pos.x,R.position.y+(gy-R.position.y)*Math.min(1,dt*12),player.pos.z);player.c.yaw=player.yaw;player.c.back=spd<0;updChar(player.c,spd<0?1.2:spd,dt,true);
  if(state==='play'&&!cops.some(c=>!c.dead&&dist2(c.pos,player.pos)<1.8))player.arrestT=Math.max(0,player.arrestT-dt*2);}
 if(state==='play'){if(player.hp<=0)gameOver('WASTED');else if(player.arrestT>4.2&&!player.car&&wanted>=3)gameOver('BUSTED');}
 if(state==='dead'){deadT-=dt;if(player.c.body){const b=player.c.body;player.pos.set(b.position.x,0,b.position.z);}updChar(player.c,0,dt,true);if(deadT<=0)respawn();}
 if(play&&!player.car&&player.weapon!=='fist'&&player.c.aim>0)for(const p of peds){if(p.mode!=='walk'&&p.mode!=='stand')continue;const dx=p.pos.x-player.pos.x,dz=p.pos.z-player.pos.z,d=Math.hypot(dx,dz);if(d<12&&Math.abs(wrapA(Math.atan2(dx,dz)-player.yaw))<.5){p.mode='cower';p.c.talk=0;p.cowerT=rnd(3,6);}}
 updPeds(dt);updUnits(cops,dt);updUnits(gang,dt);updUnits(guards,dt);updHelis(dt);manage(dt);updParts(dt);updPickups(dt);updRob(dt);updProps(dt,player.pos.x,player.pos.z);updateStreetLighting(dt,player.pos.x,player.pos.z);updateInteriors(dt,player.pos.x,player.pos.z);updateOutdoorModels(dt,player.pos.x,player.pos.z);if(clerk)updChar(clerk,0,dt,true);
 for(const T of tracers)if(T.l.visible){T.t-=dt;if(T.t<=0)T.l.visible=false;}muzzleL.intensity=Math.max(0,muzzleL.intensity-dt*150);boomL.intensity=Math.max(0,boomL.intensity-dt*25);
 /* wanted */
 if(state==='play')updateLaw(dt);
 const cleanView=$('ui').classList.contains('cleanView');
 for(const m of markerObjs){
  const at=m.p.road||m.p.door,d=Math.hypot(at.x-player.pos.x,at.z-player.pos.z);
  const close=d<27&&!cleanView;
  if(m.p.label)m.p.label.visible=close&&d>7;
  m.beam.visible=close;
  m.ring.visible=close;
  m.beam.material.opacity=m.p.cd>0?.02:.055+.024*Math.sin(time*3);
  m.ring.material.opacity=m.p.cd>0?.19:.55;
 }
 if(player.car&&state==='play'){const c=player.car;for(const p of places){if(!p.road)continue;if(Math.hypot(c.pos.x-p.road.x,c.pos.z-p.road.z)>4.5||Math.abs(c.speed)>9)continue;
   if(p.kind==='chop'){if(wanted>0){if(toastT<=0)toast('LOSE THE COPS FIRST',1400);}else{const pay=Math.round(c.spec.val*(.35+.65*c.hp/c.max)/10)*10;player.cash+=pay;toast(`+$${pay} SOLD FOR PARTS`,2200);beep(1400,.1,.15,'sine');player.car=null;player.pos.set(p.road.x,0,p.road.z);player.c.root.visible=true;removeCar(c);break;}}
   if(p.kind==='spray'){if(wanted===0){if(toastT<=0)toast('NO HEAT ON THIS CAR',1000);}else if(wanted>=4){if(toastT<=0)toast("TOO HOT — EVEN THE SPRAY SHOP WON'T TOUCH IT",1600);}else{const price=250*wanted;if(player.cash>=price){player.cash-=price;heat=0;wanted=0;evadeT=0;resetDispatch();c.hp=c.max;paintCar(c,pick(carColors));toast(`FRESH PAINT −$${price} · COPS LOST`,2000);for(const k of cars)if(k.driver==='police'){k.route=null;k.ai=null;}}else if(toastT<=0)toast(`NEED $${price}`,1200);}}}}
 /* camera */
 if(dragId===null){lookYaw*=Math.exp(-4*dt);lookPitch*=Math.exp(-4*dt);}
 const tgt=player.car?player.car.pos:player.pos;if(player.car){const c=player.car;const vh=Math.hypot(c.vel.x,c.vel.z)>4&&c.speed>0?Math.atan2(c.vel.x,c.vel.z):c.h;camYaw=lerpA(camYaw,lerpA(c.h,vh,.5),1-Math.exp(-4.5*dt));}else camYaw=lerpA(camYaw,player.yaw,1-Math.exp(-9*dt));
 const aerial=cameraMode===2, low=cameraMode===1,car=player.car,yawC=camYaw+lookYaw;
 const speed=car?Math.hypot(car.vel.x,car.vel.z):0;
 const dist=aerial?25:car?((low?4.7:6.25)+car.spec.L*.39+Math.min(speed,45)*.047):low?3:4.55;
 const height=aerial?35.0:(car?(low?.87:2.02)+car.spec.r*.47:low?1.42:2.16)+lookPitch*2.65;
 const gy=car?Math.max(0,car.mesh.position.y):Math.max(groundY(tgt.x,tgt.z,player.pos.y),player.c.root.position.y);
 const cx=tgt.x-Math.sin(yawC)*dist,cz=tgt.z-Math.cos(yawC)*dist;
 const f=cameraClearance(tgt.x,(car?1.15:1.62)+gy,tgt.z,cx,height+gy,cz);
 const want=new V3(lerp(tgt.x,cx,f),height+gy,lerp(tgt.z,cz,f));
 if(!camInit){camPos.copy(want);camInit=true;}
 camPos.lerp(want,1-Math.exp(-(f<.99?23:aerial?4.8:car?8:11)*dt));
 camera.position.copy(camPos);
 if(shake>0){
  camera.position.x+=Math.sin(time*34)*shake*.20;
  camera.position.y+=Math.sin(time*41)*shake*.14;
  shake=Math.max(0,shake-dt*1.8);
 }
 const ahead=aerial?29:low?5:3.0;
 camera.lookAt(tgt.x+Math.sin(yawC)*ahead,(aerial?3:car?1.06:1.43)+gy-lookPitch*1.3,tgt.z+Math.cos(yawC)*ahead);
 const baseFov=innerWidth<innerHeight?68:low?53:56;
 const fov=baseFov+(aerial?4:car?Math.min(speed,46)*.17:0);
 if(Math.abs(fov-camera.fov)>.01){
  camera.fov=lerp(camera.fov,fov,1-Math.exp(-3.4*dt));
  camera.updateProjectionMatrix();
 }
 sky.position.copy(camera.position);
 sun.position.copy(tgt).addScaledVector(SUNDIR,250);
 sun.target.position.copy(tgt);
 if(POST){PP.final.uniforms.hurt.value=Math.max(0,hurtT>0?hurtT*2.5:0)+(player.hp<30&&state==='play'?(.3+.2*Math.sin(time*5)):0);hurtT-=dt;}
 if(ac){const t=ac.currentTime;const c=player.car;if(c){const sp=Math.abs(c.speed),gear=Math.min(5,Math.floor(sp/9)),rpm=.25+(sp-gear*9)/9*.75+(gear===0?0:.15);engG.gain.setTargetAtTime(.06+Math.min(1,Math.abs(jy))*.04,t,.1);engO.frequency.setTargetAtTime(40+rpm*90*(c.type==='sport'?1.4:1),t,.06);engO2.frequency.setTargetAtTime(20+rpm*45,t,.06);engF.frequency.setTargetAtTime(300+rpm*900,t,.1);
   scrG.gain.setTargetAtTime(c.sliding&&sp>5?.12:0,t,.05);c.sliding=false;}else{engG.gain.setTargetAtTime(0,t,.2);scrG.gain.setTargetAtTime(0,t,.1);}
  let dn=1e9;if(wanted>0)for(const k of cars)if(k.driver==='police')dn=Math.min(dn,dist2(k.pos,tgt));sirG.gain.setTargetAtTime(wanted>=3&&LAW.seen?clamp(1-dn/120,0,1)*.06:0,t,.2);sirO.frequency.setTargetAtTime(760+260*Math.sin(time*Math.PI*2*.9),t,.03);
  let hn=1e9;for(const h of helis)hn=Math.min(hn,h.pos.distanceTo(camera.position));heliG.gain.setTargetAtTime(clamp(1-hn/160,0,1)*.35,t,.2);}
 if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.classList.remove('on');}if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('banner').classList.remove('on');}}
function loop(){
 requestAnimationFrame(loop);
 const elapsed=clock.getDelta(),dt=Math.min(elapsed,.05);
 if($('cityMap').open)return;
 if(state!=='loading'&&state!=='building'){
  step(dt);hud();mmT-=dt;
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
 if(state!=='loading'&&state!=='building')renderFrame(time);
}
/* ================= boot ================= */
function setLoad(t,p){$('load').textContent=t;if(p!=null)$('lbar').firstChild.style.width=Math.round(p*100)+'%';}
function initGame(){buildMinimapBase();buildMarkers();
 const hp=places.find(p=>p.kind==='hospital'),pp=places.find(p=>p.kind==='police');
 SPAWN.hospital={x:hp.door.x+Math.sin(SIDEANG[hp.side])*.6,z:hp.door.z+Math.cos(SIDEANG[hp.side])*.6,yaw:SIDEANG[hp.side]};SPAWN.police={x:pp.door.x+Math.sin(SIDEANG[pp.side])*.6,z:pp.door.z+Math.cos(SIDEANG[pp.side])*.6,yaw:SIDEANG[pp.side]};
 const row=blocks[3*N+5],start={x:row.x1-.9,z:row.z0+10,yaw:0};
 player={pos:new V3(start.x,0,start.z),yaw:start.yaw,hp:100,armor:0,cash:250,car:null,fireCd:0,arrestT:0,spd:0,guardT:0,down:0,weapon:'fist',own:{pistol:true,smg:false,shotgun:false},ammo:{pistol:36,smg:0,shotgun:0},c:null};
 player.c=makePlayerChar();camYaw=player.yaw;
 for(let k=0;k<QUALITY.peds;k++){const p={c:null,pos:new V3(),mode:'walk',t:0,R:null,dir:1,spd:1.4,fleeT:0,fv:new V3(),downT:0,hp:60,cash:0,dead:false};peds.push(p);placePed(p,nearBlock(0,140),k%5===0);}
 {const s=spawnCar('sport',row.x1+1.9,start.z+2.75,Math.PI,null);paintCar(s,0x711b29);s.keep=true;s.heroWanted=true;}
 {const c=spawnCar('van',W+22,QUAY_Z+58,Math.PI,null);paintCar(c,0xa18855);c.keep=true;}
 for(let k=0;k<(QUALITY.level>=2?20:14);k++)spawnTraffic(15,420);
 for(let k=0;k<12;k++)spawnParked();
 for(let k=0;k<2;k++)spawnPolice(false);
 {const d=hp.door,yo=SIDEANG[hp.side];const a=spawnCar('amb',d.x+Math.sin(yo)*(SW+2.6)-Math.cos(yo)*7,d.z+Math.cos(yo)*(SW+2.6)+Math.sin(yo)*7,yo+Math.PI/2,null);a.keep=true;}
 {const d=pp.door,yo=SIDEANG[pp.side];for(const s of[-1,1])spawnCar('police',d.x+Math.sin(yo)*(SW+2.6)+Math.cos(yo)*s*7,d.z+Math.cos(yo)*(SW+2.6)-Math.sin(yo)*s*7,yo+Math.PI/2,null).keep=true;}
 for(const p of places)if(p.kind==='hospital')for(const s of[-1,1]){const q=dropPickup('health',p.door.x+Math.cos(SIDEANG[p.side])*s*3,p.door.z-Math.sin(SIDEANG[p.side])*s*3,0);q.fixed=true;}
 {const q=dropPickup('armor',CITY_X[2]+29,CITY_Z[2]+47,0);q.fixed=true;}
 {const court=blocks.find(B=>B.gang);if(court)for(let k=0;k<4;k++)spawnUnit('gang',court.gang.x+rnd(-10,10),court.gang.z+rnd(-6,6),'gang');}
 state='title';}
async function boot(){resize();state='loading';setLoad('Loading city…',0);
 const mgr=THREE.DefaultLoadingManager;let tot=1,done=0;mgr.onProgress=(u,l,t)=>{done=l;tot=t;if(state==='loading')setLoad('Loading city & people… '+Math.round(l/t*100)+'%',l/t*.85);};
 await new Promise(r=>loadSky(r));
 const cast=await (await fetch('models/cast.json')).json();
 const lowSet=['Male_Adult_07','Police_Male_01','Police_Male_02','Military_Male_01','Security_Male_01','Male_Adult_10','Male_Adult_03','Medical_Male_01','Male_Adult_01','Male_Adult_04','Male_Adult_08','Business_Male_01','Female_Adult_01','Female_Adult_03','Female_Adult_07','Business_Female_01','Sports_Male_01','Sports_Female_01'];
 const names=Object.keys(cast).filter(n=>QUALITY.level>=2||lowSet.includes(n));
 const L=new THREE.GLTFLoader();const ld=u=>new Promise((res,rej)=>L.load(u,res,undefined,rej));
 initMaterials();
 let anim;try{anim=await ld('models/anim_x.json');}catch(e){console.warn(e);}
 const gl=await Promise.all(names.map(n=>ld('models/'+n+'.json').catch(e=>null)));
 await new Promise(r=>{if(mgr.itemsLoaded===mgr.itemsTotal)r();else{const o=mgr.onLoad;mgr.onLoad=()=>{o&&o();r();};setTimeout(r,20000);}});
 setLoad('Rigging people…',.88);await new Promise(r=>setTimeout(r,30));
 addAnimSource('x',anim,0,null);
 names.forEach((n,i)=>{if(!gl[i])return;try{addTemplate(n,gl[i],cast[n],'x',{idle:'idle',walk:'walk',run:'run',talk:'agree'});CAST[n]=cast[n];}catch(e){console.warn(n,e);}});
 for(const n in CAST){const r=CAST[n];(ROLE[r]=ROLE[r]||[]).push(n);if(/Business_Male/.test(n))(ROLE.mb=ROLE.mb||[]).push(n);if(/Business_Female/.test(n))(ROLE.fb=ROLE.fb||[]).push(n);if(/Construction/.test(n))(ROLE.work=ROLE.work||[]).push(n);}
 if(!ROLE.clerk)ROLE.clerk=ROLE.m;for(const r of['cop','swat','army','guard','gang','medic','beach'])if(!ROLE[r])ROLE[r]=ROLE.m;
 setLoad('Building streets…',.92);await new Promise(r=>setTimeout(r,30));state='building';
 await buildCityRest();physInit();indexStatic();physWorld();initProps();initParts();initTracers();initSkids();initCarLenses();initWheels(320);initGame();
 refreshPhysicalWorld(player.pos.x,player.pos.z);updProps(.5,player.pos.x,player.pos.z);camera.position.set(player.pos.x+56,52,player.pos.z+65);camera.lookAt(player.pos.x+16,4,player.pos.z-14);renderFrame(0);
 $('play').disabled=false;setLoad('Ready',1);}
async function buildCityRest(){SEED=4242;initAwnings();initSigns();initStreetMaterials();initInteriors();
 prepareStreetInfill();prepareGradeRoads();
 const asph=new THREE.Mesh(new THREE.PlaneGeometry(S+40,S+40),MAT.asphalt);asph.rotation.x=-Math.PI/2;asph.position.set(W/2,0,W/2);asph.receiveShadow=true;scene.add(asph);
 {const uv=asph.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(S+40)/7,uv.getY(i)*(S+40)/7);for(const t of[MAT.asphalt.map,MAT.asphalt.normalMap,MAT.asphalt.roughnessMap])t.repeat.set(1,1);}
 for(let i=0;i<N;i++){
  for(let j=0;j<N;j++){const {x0,x1,z0,z1}=parcelBounds(i,j);const B={i,j,x0,x1,z0,z1,bld:[],park:false,dist:districtOf(i,j)};blocks.push(B);
  {const g=new THREE.PlaneGeometry(x1-x0,z1-z0);const uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*(x1-x0)/3.2,uv.getY(k)*(z1-z0)/3.2);g.rotateX(-Math.PI/2);g.translate((x0+x1)/2,.15,(z0+z1)/2);addGeo(MAT.sidewalk,g,false);}
  for(const[a,b,c,d,ry]of[[x0,x1,z1,z1,0],[x0,x1,z0,z0,Math.PI],[x1,x1,z0,z1,Math.PI/2],[x0,x0,z0,z1,-Math.PI/2]]){const Ln=Math.max(b-a,d-c);const g=new THREE.PlaneGeometry(Ln,.15);const uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*Ln/2,uv.getY(k)*.075);g.rotateY(ry);g.translate((a+b)/2,.075,(c+d)/2);addGeo(MAT.curb,g,false);}
  streetProps(B);const reserve=reserveGradeBlock(B);if(reserve){plantRoadReserve(B,reserve);continue;}
  if((B.dist!=='suburb'&&(i+j)%3===0)||(i>=3&&i<=4&&j>=3&&j<=5))streetDetails(B);
  if(buildAuthoredBlock(B))continue;const id=i+','+j,sp=SPECIAL[id];if(sp&&sp.kind==='park'){B.park=true;park(B);continue;}if(sp){special(B,sp);continue;}
  if(PUBLIC_GREEN.has(id)){publicGreen(B);continue;}
  const R={x0:x0+SW,x1:x1-SW,z0:z0+SW,z1:z1-SW};if(B.dist==='docks'&&(i+j)%3===0){warehouses(B,{x0:R.x0,x1:R.x1,z0:R.z0,z1:(R.z0+R.z1)/2-1});containers(R.x0+1,R.x1-1,(R.z0+R.z1)/2+1,R.z1-1);continue;}fillDistrict(B,R,B.dist);}
  if(i%4===3){
   flushBuckets();
   setLoad('Building streets… '+Math.round((i+1)/N*100)+'%',.93+.05*(i+1)/N);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 beach();skyline();roadMarkings();buildGradeRoads();buildStreetInfill();finishStreetDetails();flushBuckets();for(const m of scene.children)if(m.isMesh&&m.material===ATLAS.neon)m.renderOrder=2;plantTrees();buildTrafficLights();initializeDoorMeshes();}
$('play').addEventListener('click',()=>{$('start').style.display='none';$('ui').hidden=false;if(!ac)initAudio();else ac.resume&&ac.resume();if(state==='title'){state='play';}});
window.__game={step,ff(n){for(let i=0;i<n;i++){step(1/30);}renderFrame(time);},scene,renderer,camera,sun,PH,get player(){return player},cars,peds,cops,gang,helis,places,PROPS,get heat(){return heat},set heat(v){heat=v},get wanted(){return wanted},get state(){return state},keys,inp,toggleCar,startRob,TPL,QUALITY};
loop();boot().catch(e=>{console.error(e);setLoad('Error: '+e.message);});
