/* Fixed-step rigid bodies and suspension. Distances are in metres. */
const PH={w:null,cars:[],hits:[],mat:{},accumulator:0};
const CV=CANNON.Vec3;
const PHYS_DT=1/90;
const PHYS_GROUP={world:1,car:2,prop:4,ragdoll:8};
const _forward=new CV(),_up=new CV(),_velocity=new CV();
const LOCAL_FORWARD=new CV(-1,0,0),LOCAL_UP=new CV(0,1,0);

function physInit(){
 const w=PH.w=new CANNON.World();
 w.gravity.set(0,-9.81,0);
 w.broadphase=new CANNON.SAPBroadphase(w);
 w.allowSleep=true;
 w.solver.iterations=10;
 w.defaultContactMaterial.friction=.5;
 w.defaultContactMaterial.restitution=.04;
 for(const name of ['ground','concrete','sand','car','prop'])PH.mat[name]=new CANNON.Material(name);
 const {ground,concrete,sand,car,prop}=PH.mat;
 for(const [a,b,friction,restitution] of [
  [ground,car,.42,.05],[concrete,car,.5,.05],[sand,car,.68,.025],
  [car,car,.34,.09],[ground,prop,.58,.13],[concrete,prop,.65,.11],
  [sand,prop,.77,.04],[car,prop,.44,.10],[prop,prop,.52,.12]
 ])w.addContactMaterial(new CANNON.ContactMaterial(a,b,{friction,restitution}));
 const g=new CANNON.Body({mass:0,material:ground,collisionFilterGroup:PHYS_GROUP.world});
 g.addShape(new CANNON.Plane());
 g.quaternion.setFromEuler(-Math.PI/2,0,0);
 w.addBody(g);
 PH.ground=g;
 w.addEventListener('preStep',()=>{
  for(const c of PH.cars){
   if(c.body.sleepState===CANNON.Body.SLEEPING)continue;
   applyDrivingForces(c,w.dt);
   c.veh.updateVehicle(w.dt);
  }
 });
}

function physBox(x0,x1,y0,y1,z0,z1,material=PH.mat.concrete){
 const b=new CANNON.Body({mass:0,material,collisionFilterGroup:PHYS_GROUP.world});
 b.addShape(new CANNON.Box(new CV((x1-x0)/2,(y1-y0)/2,(z1-z0)/2)));
 b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
 PH.w.addBody(b);
 return b;
}

function physStep(dt){
 PH.accumulator=Math.min(PH.accumulator+dt,PHYS_DT*6);
 while(PH.accumulator+1e-9>=PHYS_DT){
  if(typeof moveLiftBodies==='function')moveLiftBodies(PHYS_DT);
  if(typeof animateDoorBodies==='function')animateDoorBodies(PHYS_DT);
  if(typeof updateFreightCranes==='function')updateFreightCranes(time-PH.accumulator+PHYS_DT,PHYS_DT);
  PH.w.step(PHYS_DT);
  PH.accumulator=Math.max(0,PH.accumulator-PHYS_DT);
 }
}

class StreetVehicle extends CANNON.RaycastVehicle{
 constructor(body,spec){
  super({chassisBody:body,indexRightAxis:2,indexForwardAxis:0,indexUpAxis:1});
  this.spec=spec;
  this.parkingBrake=false;
 }
 updateFriction(dt){
  const wheels=this.wheelInfos;
  for(let i=0;i<wheels.length;i++){
   const wheel=wheels[i];
   const surface=wheel.raycastResult.body?.material;
   const traction=surface===PH.mat.sand?.58:surface===PH.mat.concrete?.83:.76;
   const rear=i>=2;
   wheel.frictionSlip=(rear?this.spec.gripR:this.spec.gripF)*traction*(rear&&this.parkingBrake?.43:1);
   wheel.suspensionForce=Math.min(wheel.suspensionForce,wheel.maxSuspensionForce);
   if(!wheel.raycastResult.body)continue;
   // The stock solver treats brake as an impulse. Limit both longitudinal inputs by tyre load.
   const limit=wheel.suspensionForce*wheel.frictionSlip;
   wheel.brake=Math.min(wheel.brake,limit*dt);
   wheel.engineForce=Math.max(-limit,Math.min(limit,wheel.engineForce));
  }
  super.updateFriction(dt);
 }
 updateVehicle(dt){
  for(const w of this.wheelInfos)w.previousSpin=w.rotation;
  super.updateVehicle(dt);
  this.chassisBody.vectorToWorldFrame(LOCAL_FORWARD,_forward);
  for(let i=0;i<this.wheelInfos.length;i++){
   const wheel=this.wheelInfos[i];
   if(!wheel.raycastResult.body)continue;
   this.chassisBody.getVelocityAtWorldPoint(wheel.raycastResult.hitPointWorld,_velocity);
   const rolling=_velocity.dot(_forward)/wheel.radius;
   const locked=this.parkingBrake&&i>=2;
   wheel.deltaRotation=rolling*dt*(locked?.07:1);
   wheel.rotation=wheel.previousSpin+wheel.deltaRotation;
  }
 }
}

function physCarAdd(c){
 const s=c.spec;
 if(c.body)return;
 const b=new CANNON.Body({mass:s.mass,material:PH.mat.car,collisionFilterGroup:PHYS_GROUP.car});
 const length=s.L/2-.09,width=s.W/2-.09,clear=s.gc+.07;
 // A lower sill and narrower cabin let contact height determine pitch and roll.
 b.addShape(new CANNON.Box(new CV(length,(s.hb-clear)/2,width)),new CV(0,(s.hb+clear)/2-s.com,0));
 const cabin=(s.L-s.hood-s.tr)*.39;
 b.addShape(new CANNON.Box(new CV(cabin,(s.r-s.hb)/2,width-.14)),
   new CV((s.hood-s.tr)/2,(s.r+s.hb)/2-s.com,0));
 b.angularDamping=.27;
 b.linearDamping=.012;
 b.allowSleep=true;
 b.sleepSpeedLimit=.16;
 b.sleepTimeLimit=1.1;
 b.car=c;
 const v=new StreetVehicle(b,s);
 const sag=9.81/(4*s.k);
 const height=s.wr+s.rest-sag-s.com;
 const wheelRate=Math.sqrt(s.k)*.86;
 for(const [axle,side] of [[-1,1],[-1,-1],[1,1],[1,-1]]){
  v.addWheel({
   radius:s.wr,directionLocal:new CV(0,-1,0),axleLocal:new CV(0,0,1),
   chassisConnectionPointLocal:new CV(axle*s.wb,height,side*(s.W/2-.14)),
   isFrontWheel:axle<0,suspensionStiffness:s.k,suspensionRestLength:s.rest,
   dampingRelaxation:wheelRate,dampingCompression:wheelRate*.72,maxSuspensionForce:s.mass*8,
   rollInfluence:s.roll,maxSuspensionTravel:.23
  });
 }
 v.world=PH.w;
 c.body=b;
 c.veh=v;
 c.controls={throttle:0,steer:0,handbrake:false,drivePedal:0,brakePedal:0,gear:1,interlock:false};
 b.addEventListener('collide',e=>{
  const contact=e.contact;
  const iv=contact.getImpactVelocityAlongNormal();
  if(iv<1.9)return;
  const self=contact.bi===b,r=self?contact.ri:contact.rj;
  PH.hits.push({
   car:c,other:e.body,iv,px:b.position.x+r.x,py:b.position.y+r.y,pz:b.position.z+r.z,
   nx:contact.ni.x*(self?1:-1),ny:contact.ni.y*(self?1:-1),nz:contact.ni.z*(self?1:-1)
  });
 });
}

function positionChassis(c,x,z,h,speed,referenceY=null){
 const b=c.body;
 const y=typeof groundY==='function'?groundY(x,z,referenceY):0;
 b.position.set(x,c.spec.com+y+.018,z);
 b.quaternion.setFromEuler(0,h+Math.PI/2,0);
 b.velocity.set(Math.sin(h)*speed,0,Math.cos(h)*speed);
 b.angularVelocity.set(0,0,0);
 b.force.set(0,0,0);
 b.torque.set(0,0,0);
 b.aabbNeedsUpdate=true;
 c.steerA=0;
 c.controls.drivePedal=0;
 c.controls.brakePedal=0;
 c.controls.gear=speed<0?-1:1;
 c.controls.interlock=false;
 for(const w of c.veh.wheelInfos){
  w.suspensionLength=c.spec.rest-9.81/(4*c.spec.k);
  w.raycastResult.reset();
  w.rotation=w.deltaRotation=w.steering=0;
 }
}

function physCarOn(c){
 if(c.phys)return;
 physCarAdd(c);
 positionChassis(c,c.pos.x,c.pos.z,c.h,c.speed,c.pos.y??null);
 PH.w.addBody(c.body);
 PH.cars.push(c);
 c.phys=true;
 if(!c.driver&&Math.abs(c.speed)<.1){
  c.body.position.y-=.018;
  c.body.sleep();
 }else c.body.wakeUp();
}

function physCarOff(c){
 if(!c.phys)return;
 PH.w.removeBody(c.body);
 const i=PH.cars.indexOf(c);
 if(i>=0)PH.cars.splice(i,1);
 c.phys=false;
}

function physCarRead(c){
 const b=c.body;
 b.quaternion.vmult(LOCAL_FORWARD,_forward);
 b.quaternion.vmult(LOCAL_UP,_up);
 const hl=Math.hypot(_forward.x,_forward.z)||1;
 c.h=Math.atan2(_forward.x,_forward.z);
 c.pos.set(b.position.x,Math.max(0,b.position.y-c.spec.com),b.position.z);
 c.vel.set(b.velocity.x,b.velocity.y,b.velocity.z);
 c.speed=(b.velocity.x*_forward.x+b.velocity.z*_forward.z)/hl;
 c.upY=_up.y;
 c.air=c.veh.numWheelsOnGround===0;
}

function physCarSet(c,x,z,h,speed=0){
 c.pos.set(x,0,z);
 c.h=h;
 c.speed=speed;
 if(!c.phys)return;
 positionChassis(c,x,z,h,speed);
 c.body.wakeUp();
}

function physCarControl(c,throttle,steer,handbrake){
 Object.assign(c.controls,{throttle,steer,handbrake});
 if(Math.abs(throttle)>.04||Math.abs(steer)>.04)c.body.wakeUp();
}

function clampSteeringSpeed(speed){return Math.min(1,Math.max(0,(speed-5.5)/11));}

function applyDrivingForces(c,dt){
 const {veh:v,spec:s,body:b,controls:u}=c;
 b.quaternion.vmult(LOCAL_FORWARD,_forward);
 const speed=b.velocity.dot(_forward),absSpeed=Math.abs(speed),playerDriving=c.driver==='player';
 const sign=Math.abs(u.throttle)>.035?Math.sign(u.throttle):0;
 if(!sign||sign===u.gear)u.interlock=false;
 // Hold the brake until released before engaging the opposite gear in the player's car.
 if(sign&&sign*speed<-.85)u.interlock=playerDriving;
 const braking=sign&&(sign*speed<-.65||u.interlock);
 if(sign&&!braking)u.gear=sign;
 const targetDrive=braking?0:Math.abs(u.throttle);
 const targetBrake=braking?Math.abs(u.throttle):0;
 u.drivePedal+=(targetDrive-u.drivePedal)*(1-Math.exp(-dt*(targetDrive>u.drivePedal?(playerDriving?5.8:10):28)));
 u.brakePedal+=(targetBrake-u.brakePedal)*(1-Math.exp(-dt*(playerDriving?31:22)));

 const speedLimit=playerDriving
  ?Math.min(.68,Math.atan(2*s.wb*9.1/(absSpeed*absSpeed+5.5))+.025)
  :Math.min(.61,Math.atan(2*s.wb*8.2/(absSpeed*absSpeed+7))+.024);
 const targetSteer=u.steer*speedLimit;
 c.steerA+=(targetSteer-c.steerA)*(1-Math.exp(-dt*(Math.abs(targetSteer)>Math.abs(c.steerA)?7:11)));
 // Ackermann steering gives the inside front wheel a smaller turning radius.
 const angle=Math.abs(c.steerA),turn=Math.sign(c.steerA);
 const radius=2*s.wb/Math.max(.0001,Math.tan(angle));
 for(let i=0;i<2;i++){
  const side=i===0?1:-1;
  const wheelAngle=angle<.001?0:turn*Math.atan(2*s.wb/Math.max(.5,radius-turn*side*(s.W/2-.14)));
  v.setSteeringValue(wheelAngle,i);
 }

 const reverse=u.gear<0;
 const max=(reverse?(playerDriving?6.3:8):playerDriving?Math.min(s.max,40):s.max)*(c.hp<c.max*.35?.70:1);
 const throttle=u.handbrake?u.drivePedal*.35:u.drivePedal;
 const power=Math.max(0,1-Math.pow(absSpeed/max,2.25));
 const progressive=playerDriving?(.44+.24*Math.min(1,absSpeed/22))*(1-.21*Math.abs(u.steer)*clampSteeringSpeed(absSpeed)):1;
 const force=-u.gear*throttle*s.F*power*progressive*(reverse?.49:1);
 const frontShare=s.awd?.46:s.fwd?1:0;
 const drag=.37*absSpeed*absSpeed;
 const stopped=absSpeed<.65&&!sign;
 const holding=stopped&&!c.driver;
 v.parkingBrake=u.handbrake;
 for(let i=0;i<4;i++){
  const rear=i>=2;
  const share=rear?1-frontShare:frontShare;
  const pedalForce=playerDriving?(rear?2.15:3.02):(rear?1.48:2.36);
  const coast=playerDriving&&!sign&&!u.handbrake?.25+Math.min(.41,absSpeed*.016):.048;
  const brake=b.mass*(u.brakePedal*pedalForce+(holding?1.35:coast));
  const surface=v.wheelInfos[i].raycastResult.body?.material;
  const resistance=surface===PH.mat.sand?.46:.11;
  v.applyEngineForce(force*share*.5,i);
  v.setBrake((brake+drag*.25+(absSpeed>1?b.mass*resistance:0)+(rear&&u.handbrake?b.mass*3.4:0))*dt,i);
 }
 c.braking=u.brakePedal>.10||u.handbrake;
}

function physDyn(shape,mass,x,y,z,offset){
 const b=new CANNON.Body({mass,material:PH.mat.prop,collisionFilterGroup:PHYS_GROUP.prop});
 b.addShape(shape);
 // Keep the rigid body's centre inside its volume so falling objects tumble about their mass.
 b.position.set(x+(offset?.x||0),y+(offset?.y||0),z+(offset?.z||0));
 b.allowSleep=true;
 b.sleepSpeedLimit=.2;
 b.sleepTimeLimit=1;
 b.angularDamping=.24;
 b.linearDamping=.035;
 PH.w.addBody(b);
 return b;
}
function physRemove(b){if(b&&b.world)PH.w.removeBody(b);}
function physImpulseRadial(x,y,z,r,force,skip){
 for(const b of PH.w.bodies){
  if(b.type!==1||b===skip)continue;
  const dx=b.position.x-x,dy=b.position.y-y+.6,dz=b.position.z-z;
  const d=Math.hypot(dx,dy,dz);
  if(d>r)continue;
  const dd=Math.max(d,.5),f=1-d/r,dv=Math.min(force/1400*f,14)*(b.mass<200?1.6:1);
  b.wakeUp();
  b.applyImpulse(new CV(dx/dd*dv*b.mass,(dy/dd+.6)*dv*b.mass*.6,dz/dd*dv*b.mass),
    new CV(.3*(Math.random()-.5),.1,.3*(Math.random()-.5)));
 }
}
