/* Working assemblies from the editable Blender collection. Cycles continue while art streams. */
const CITY_MACHINES={washers:[],moving:[]};

function placeCityMachine(id,x,y,z,yaw,dims){
 if(!['laundry-machine','barber-pole','condenser-bank','municipal-pump','grocery-cooler'].includes(id))return null;
 const m={id,x,y,z,yaw,dims,phase:0,left:0,right:0,target:0,remaining:0,water:0,discharge:0,parts:null};
 if(id==='laundry-machine')CITY_MACHINES.washers.push(m);
 if(id==='laundry-machine'||id==='grocery-cooler'){
  const front=dims[2]/2+.46,sine=Math.sin(yaw),cosine=Math.cos(yaw);
  const control=(l,label,use,radius)=>worksPanel(x+l*cosine+front*sine,y,z-l*sine+front*cosine,label,use,radius);
  if(id==='laundry-machine'){
   control(0,()=>m.remaining>0?'STOP WASHER':'RUN WASHER',()=>{
    if(m.remaining>0){m.remaining=0;m.discharge=0;toast('Wash cycle stopped',1200);return;}
    if(!cityPowerAt(x,z))return toast('No power at washer',1400);
    if(pressureAtFixture(m)<.12)return toast('Washer waiting for water',1400);
    m.remaining=40;toast('Washer filling',1200);
   },.64);
  }else{
   for(const side of [-1,1])control(side*dims[0]*.265,
    ()=>m.target===side?'CLOSE COOLER':'OPEN '+(side<0?'LEFT':'RIGHT')+' COOLER',
    ()=>{m.target=m.target===side?0:side;},.53);
  }
 }
 return m;
}

function bindCityMachine(m,node){
 const names={'laundry-machine':['Drum'],'condenser-bank':['Fan1','Fan2'],'municipal-pump':['Coupling'],
  'grocery-cooler':['LeftDoor','RightDoor'],'barber-pole':['Rotor']};
 m.parts=names[m.id].map(name=>node.getObjectByName(name));
 if(m.parts.some(p=>!p))return;
 m.origins=m.parts.map(p=>p.position.x);
 CITY_MACHINES.moving.push(m);
}
function advanceLaundry(m,dt){
 m.discharge=0;
 if(!cityPowerAt(m.x,m.z))return;
 // A stopped, part-full machine drains before the next cycle. Every litre joins its lot's sanitary line.
 if(m.remaining<=0){
  const drain=Math.min(m.water,dt*1.6);
  m.water-=drain;m.discharge=dt>0?drain/dt:0;
  return;
 }
 const pressure=pressureAtFixture(m);
 if(m.remaining>32){
  if(pressure<.12)return;
  const supplied=Math.min(12-m.water,dt*1.5*pressure);
  m.water+=Math.max(0,supplied);
  m.remaining=Math.max(32,m.remaining-dt*pressure);
 }else{
  m.phase+=dt*(m.remaining>12?3.7:16.5)*(m.remaining>12&&Math.floor(m.remaining/4)%2===0?-1:1);
  if(m.remaining<=12){
   const drain=Math.min(m.water,dt*1.6);
   m.water-=drain;m.discharge=dt>0?drain/dt:0;
  }
  m.remaining=Math.max(0,m.remaining-dt);
 }
}
function updateCityMachines(dt,pos){
 for(const m of CITY_MACHINES.washers)advanceLaundry(m,dt);
 for(const m of CITY_MACHINES.moving){
  if(Math.abs(m.x-pos.x)>82||Math.abs(m.z-pos.z)>82)continue;
  const [a,b]=m.parts;
  if(m.id==='grocery-cooler'){
   const speed=dt*1.65;
   for(const [key,sign] of [['left',-1],['right',1]]){
    const goal=m.target===sign?1:0,delta=clamp(goal-m[key],-speed,speed);
    m[key]+=delta;
   }
   a.position.x=m.origins[0]+m.left*.743;b.position.x=m.origins[1]-m.right*.743;
  }else if(m.id==='laundry-machine'){
   a.rotation.z=m.phase;
  }else{
   if(!cityPowerAt(m.x,m.z))continue;
   if(m.id==='municipal-pump'){
    if(CITY_WORKS.grid&&CITY_WORKS.pump)a.rotation.x+=dt*14;
   }else if(m.id==='condenser-bank'){
    a.rotation.y+=dt*12;b.rotation.y+=dt*11.7;
   }else a.rotation.y+=dt*1.1;
  }
 }
}
