// One second of simulation advances local solar time by one minute.
const WEATHER_FRONTS = {
 clear:    {label:'Clear',           cloud:.09, water:0,   wind:2,    sight:1550, offset:2,  next:['clouds','clouds','fog']},
 clouds:   {label:'Scattered clouds',cloud:.41, water:0,   wind:4,    sight:1250, offset:0,  next:['clear','overcast','overcast','fog']},
 overcast: {label:'Overcast',        cloud:.89, water:0,   wind:5.5,  sight:890,  offset:-3, next:['clouds','drizzle','rain','mix','snow']},
 fog:      {label:'Sea fog',         cloud:.65, water:0,   wind:1.2,  sight:95,   offset:-1, next:['clouds','overcast','drizzle']},
 drizzle:  {label:'Drizzle',         cloud:.86, water:.22, wind:3.7,  sight:440,  offset:-2, next:['overcast','rain','fog','mix']},
 rain:     {label:'Rain',            cloud:.94, water:.68, wind:7.3,  sight:320,  offset:-2, next:['drizzle','storm','overcast','mix']},
 storm:    {label:'Thunderstorm',    cloud:.99, water:1,   wind:15,   sight:165,  offset:-4, next:['rain','rain','drizzle']},
 mix:      {label:'Rain and snow',   cloud:.93, water:.47, wind:5.6,  sight:310,  offset:-3, next:['snow','rain','overcast']},
 snow:     {label:'Snow',            cloud:.93, water:.57, wind:4.1,  sight:270,  offset:-5, next:['overcast','mix','blizzard']},
 blizzard: {label:'Blizzard',        cloud:.99, water:1,   wind:17.5, sight:73,   offset:-7, next:['snow','snow','overcast']}
};
const COAST_LATITUDE = 40 * Math.PI / 180;
const WEATHER_TAU = 2 * Math.PI;
function vehicleSnowDepth(depth, weather, exposed, speed, running, dt) {
 const snowfall=exposed?weather.snow*.014*(1-depth):0;
 const loss=Math.max(0,weather.temperature)*.0014+(exposed?weather.rain*.024:0)
           +Math.abs(speed)*.007+(running?.0024:0);
 return Math.min(1,Math.max(0,depth+dt*(snowfall-loss*depth)));
}
function weatherRamp(lo, hi, value) {
 const t = Math.max(0, Math.min(1, (value-lo)/(hi-lo)));
 return t*t*(3-2*t);
}
// NOAA's fractional-year declination, with +x east and +z south.
function solarDeclination(day, hour) {
 const g = WEATHER_TAU * (day-1+(hour-12)/24) / 365;
 return .006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)
        -.002697*Math.cos(3*g)+.001480*Math.sin(3*g);
}
function celestialDirection(declination, angle, out) {
 const cd = Math.cos(declination), sd = Math.sin(declination), meridian = cd*Math.cos(angle);
 const sl = Math.sin(COAST_LATITUDE), cl = Math.cos(COAST_LATITUDE);
 out.x = -cd*Math.sin(angle);
 out.y = sl*sd+cl*meridian;
 out.z = sl*meridian-cl*sd;
}
function startingHour(choice, day) {
 const dec = solarDeclination(day,12);
 const halfDay = Math.acos(-Math.tan(COAST_LATITUDE)*Math.tan(dec))*12/Math.PI;
 if (choice==='sunrise') return 12-halfDay+.18;
 if (choice==='sunset') return 12+halfDay-.22;
 if (choice==='noon') return 12;
 if (choice==='night') return 23;
 return 10;
}

class CoastalWeather {
 constructor(day, hour, kind='clouds', random=Math.random) {
  this.random=random;
  this.day=day; this.hour=hour; this.elapsed=0;
  this.sun={}; this.moon={};
  this.windAngle=.34; this.travelX=0; this.travelZ=0;
  this.strike=0; this.flashAge=Infinity; this.thunderIn=Infinity;
  this.setFront(kind,true);
  this.settleGround();
 }
 settleGround() {
  this.wetness=Math.min(.98,this.rain*1.3);
  this.snowCover=this.snow*.85;
 }
 get seasonalTemperature() {
  return 11.5-12.5*Math.cos(WEATHER_TAU*(this.day-24)/365);
 }
 frontTemperature(kind) {
  const p=WEATHER_FRONTS[kind];
  const daily=Math.cos((this.hour-15)*Math.PI/12)*(4-2.7*p.cloud);
  const t=this.seasonalTemperature+daily+p.offset;
  if (kind==='snow'||kind==='blizzard') return Math.min(-1.6,t);
  if (kind==='mix') return .8;
  if (kind==='rain'||kind==='drizzle'||kind==='storm') return Math.max(3.5,t);
  return t;
 }
 setFront(kind, instant=false) {
  if (!Object.hasOwn(WEATHER_FRONTS,kind)) throw new Error('Unknown weather '+kind);
  const p=WEATHER_FRONTS[kind];
  this.kind=kind;
  this.frontRemaining=85+this.random()*125;
  this.targetAngle=this.windAngle+(this.random()-.5)*1.65;
  if (instant) {
   this.cloud=p.cloud; this.water=p.water; this.wind=p.wind; this.extinction=1.73/p.sight;
   this.temperature=this.frontTemperature(kind);
   this.electricity=kind==='storm'?1:0;
   this.flashAge=this.thunderIn=Infinity;
   this.nextStrike=3+this.random()*8;
   this.updateLight();
  }
 }
 nextFront() {
  const air=this.seasonalTemperature+2*Math.cos((this.hour-15)*Math.PI/12);
  const choices=WEATHER_FRONTS[this.kind].next.filter(kind=>{
   if (kind==='snow'||kind==='blizzard'||kind==='mix') return air<6;
   if (kind==='storm') return air>7;
   if (kind==='fog') return this.hour<11||this.hour>18;
   return true;
  });
  this.setFront(choices[Math.floor(this.random()*choices.length)]||'overcast');
 }
 updateLight() {
  const dec=solarDeclination(this.day,this.hour), angle=(this.hour-12)*Math.PI/12;
  celestialDirection(dec,angle,this.sun);
  // A synodic orbit gives the moon an independent rising time and illuminated fraction.
  this.lunarAngle=WEATHER_TAU*(this.day+this.hour/24-6)/29.5306;
  celestialDirection(dec*Math.cos(this.lunarAngle)+.09*Math.sin(this.lunarAngle),angle-this.lunarAngle,this.moon);
  this.moonFraction=(1-Math.cos(this.lunarAngle))*.5;
  this.daylight=weatherRamp(-.135,.22,this.sun.y);
  this.twilight=weatherRamp(-.23,-.045,this.sun.y)*(1-weatherRamp(.025,.37,this.sun.y));
  this.direct=weatherRamp(-.015,.17,this.sun.y)*(1-.97*weatherRamp(.48,.98,this.cloud));
  const frozen=1-weatherRamp(-.9,2.5,this.temperature);
  this.snow=this.water*frozen;
  this.rain=this.water*(1-frozen);
  this.lamps=1-weatherRamp(-.035,.17,this.sun.y*(1-.81*this.cloud*this.cloud));
  const lowVisibility=1-weatherRamp(160,650,1.73/this.extinction);
  this.headlights=Math.max(this.lamps,lowVisibility*.88,weatherRamp(.12,.66,this.water)*.78);
  this.trafficPace=1-.24*lowVisibility-.19*this.snow-.10*this.rain;
  this.gust=this.wind*(1+.18*Math.sin(this.elapsed*.61)+.13*Math.sin(this.elapsed*.21+.8));
  this.windX=this.gust*Math.cos(this.windAngle); this.windZ=this.gust*Math.sin(this.windAngle);
  this.flash=Math.exp(-this.flashAge*6.4);
 }
 advance(dt) {
  this.elapsed+=dt;
  this.hour+=dt/60;
  if (this.hour>=24) {this.day+=Math.floor(this.hour/24); this.hour%=24;}
  this.frontRemaining-=dt;
  if (this.frontRemaining<=0) this.nextFront();
  const p=WEATHER_FRONTS[this.kind];
  const blend=1-Math.exp(-dt/13), thermal=1-Math.exp(-dt/22);
  this.cloud+=(p.cloud-this.cloud)*blend;
  this.water+=(p.water-this.water)*blend;
  this.extinction+=(1.73/p.sight-this.extinction)*blend;
  this.wind+=(p.wind-this.wind)*blend;
  this.windAngle+=(this.targetAngle-this.windAngle)*thermal;
  this.temperature+=(this.frontTemperature(this.kind)-this.temperature)*thermal;
  this.electricity+=((this.kind==='storm'?1:0)-this.electricity)*blend;
  this.flashAge+=dt; this.thunderDue=false;
  if (this.thunderIn!==Infinity && (this.thunderIn-=dt)<=0) {this.thunderDue=true; this.thunderIn=Infinity;}
  if (this.electricity>.55 && (this.nextStrike-=dt)<=0) {
   this.strike++; this.strikeAngle=this.random()*WEATHER_TAU;
   this.strikeMetres=580+this.random()*2300;
   this.flashAge=0; this.thunderIn=this.strikeMetres/343;
   this.nextStrike=10+this.random()*24;
  }
  this.updateLight();
  this.travelX+=this.windX*dt; this.travelZ+=this.windZ*dt;
  const melt=Math.min(this.snowCover,dt*(Math.max(0,this.temperature)*.00034+this.rain*.004));
  this.snowCover=Math.min(1,Math.max(0,this.snowCover+dt*this.snow*.013*(1-this.snowCover)-melt));
  const sunHeat=this.direct*weatherRamp(.02,.60,this.sun.y);
  const warmth=weatherRamp(0,26,this.temperature);
  const evaporation=.003+.00024*Math.max(0,this.gust)+.044*sunHeat*(.66+.34*warmth);
  this.wetness=Math.max(0,Math.min(1,this.wetness+dt*(this.rain*.062*(1-this.wetness)-evaporation*this.wetness)+melt*.8));
 }
 get description() {
  if (this.water>.12) {
   if (this.snow>.12 && this.rain>.10) return 'Rain and snow';
   if (this.snow>this.rain) return this.gust>12 && this.snow>.67?'Blizzard':'Snow';
   if (this.electricity>.52) return 'Thunderstorm';
   return this.rain>.36?'Rain':'Drizzle';
  }
  if (1.73/this.extinction<210) return 'Sea fog';
  return this.cloud>.72?'Overcast':this.cloud>.22?'Scattered clouds':'Clear';
 }
 get clockText() {
  const minute=Math.floor(this.hour*60+1e-7)%1440;
  return String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
 }
 snapshot() {
  const round=n=>Math.round(n*100)/100;
  return {clock:this.clockText,hour:round(this.hour),day:this.day,conditions:this.description,front:this.kind,
   temperatureC:round(this.temperature),windMps:round(this.gust),visibilityM:Math.round(1.73/this.extinction),
   rain:round(this.rain),snow:round(this.snow),wetness:round(this.wetness),snowCover:round(this.snowCover),
   sunlight:round(this.direct),streetlights:round(this.lamps),headlights:round(this.headlights),lightningStrikes:this.strike};
 }
}
