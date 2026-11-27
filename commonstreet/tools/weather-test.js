// The clock, front transitions and exposure map use the same code as normal play.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({});
const source=file=>fs.readFileSync(path.join(__dirname,'..','js',file),'utf8');
vm.runInContext(source('weather.js')+'\n'+source('weather-cover.js'),context);
const {CoastalWeather,WeatherCoverMap,startingHour,vehicleSnowDepth}=vm.runInContext('({CoastalWeather,WeatherCoverMap,startingHour,vehicleSnowDepth})',context);
const advance=(w,seconds,rate=30)=>{for(let i=0;i<seconds*rate;i++)w.advance(1/rate);};
function seeded(seed=41) {
 return ()=>{seed=seed*16807%2147483647;return (seed-1)/2147483646;};
}

const summer=172,winter=355;
assert(startingHour('sunrise',summer)<startingHour('sunrise',winter)-1.5);
assert(startingHour('sunset',summer)>startingHour('sunset',winter)+1.5);
const dawn=new CoastalWeather(summer,startingHour('sunrise',summer),'clear');
const dusk=new CoastalWeather(summer,startingHour('sunset',summer),'clear');
assert(dawn.sun.x>.7 && dusk.sun.x<-.7 && dawn.twilight>.8 && dusk.twilight>.8);
const noon=new CoastalWeather(summer,12,'clear'),night=new CoastalWeather(summer,0,'clear');
assert(noon.sun.y>.9 && noon.lamps===0 && night.direct===0 && night.lamps===1);
assert.equal(noon.wetness,0);
assert.equal(new CoastalWeather(summer,10,'clouds').wetness,0);
const midnight=new CoastalWeather(winter,23.95,'clear');advance(midnight,6);
assert.equal(midnight.clockText,'00:03');assert.equal(midnight.day,winter+1);

const front=new CoastalWeather(172,14,'clear',seeded());
front.setFront('rain');const before=front.cloud;advance(front,1);
assert(front.cloud>before && front.cloud<.25 && front.rain<.12);
advance(front,70);assert(front.rain>.6 && front.wetness>.75);
front.setFront('clear',true);
const wet=front.wetness;advance(front,8);
assert(front.wetness>wet*.65 && front.wetness<wet && front.rain===0);

const drying=new CoastalWeather(summer,12,'rain',seeded());
const afterDark=new CoastalWeather(summer,0,'rain',seeded());
drying.setFront('clear',true);afterDark.setFront('clear',true);
assert.equal(drying.wetness,afterDark.wetness);
advance(drying,60);advance(afterDark,60);
assert(drying.wetness<.08 && afterDark.wetness>.6);

const pack=new CoastalWeather(winter,7,'snow',seeded());
const dusting=pack.snowCover;advance(pack,50);
assert(pack.rain===0 && pack.snowCover>dusting+.10 && pack.temperature<0);
assert(vehicleSnowDepth(.4,pack,true,0,false,1)>.4);
assert.equal(vehicleSnowDepth(.4,pack,false,0,false,1),.4);
assert(vehicleSnowDepth(.4,pack,true,22,true,1)<.4);
pack.setFront('rain',true);
const previousCover=pack.snowCover,previousWater=pack.wetness;advance(pack,15);
assert(pack.snowCover<previousCover && pack.wetness>previousWater+.2 && pack.snow===0);
const mixed=new CoastalWeather(winter,6,'mix');
assert(mixed.rain>.15 && mixed.snow>.15 && mixed.description==='Rain and snow');
const fog=new CoastalWeather(280,8,'fog');
assert(fog.headlights>.6 && fog.trafficPace<noon.trafficPace && fog.extinction>noon.extinction*7);

const storm=new CoastalWeather(summer,17,'storm',seeded(2));
let flashTime=0,delay=0,heard=false;
for(let i=0;i<900&&!heard;i++){
 storm.advance(1/30);
 if(storm.flashAge===0){flashTime=storm.elapsed;delay=storm.strikeMetres/343;}
 if(storm.thunderDue){heard=true;assert(storm.elapsed-flashTime>=delay && storm.elapsed-flashTime<delay+.035);}
}
assert(heard && flashTime>0);
const low=new CoastalWeather(winter,11,'blizzard',seeded()),high=new CoastalWeather(winter,11,'blizzard',seeded());
low.setFront('mix');high.setFront('mix');advance(low,35,30);advance(high,35,120);
for(const key of ['hour','cloud','rain','snow','wetness','snowCover','temperature','gust']){
 assert(Math.abs(low[key]-high[key])<.001,key+' varies with frame rate');
}
const forecast=new CoastalWeather(summer,10,'clouds',seeded());
const fronts=new Set();
for(let i=0;i<9500;i++){forecast.advance(.5);fronts.add(forecast.kind);}
assert(fronts.size>=5 && !fronts.has('snow') && !fronts.has('blizzard'));
const winterForecast=new CoastalWeather(winter,10,'clouds',seeded());
const coldFronts=new Set();
for(let i=0;i<18000;i++){winterForecast.advance(.5);coldFronts.add(winterForecast.kind);}
assert(coldFronts.has('snow') && coldFronts.has('blizzard'));

const cover=new WeatherCoverMap();
cover.stamp({x0:10,x1:16,z0:30,z1:39,h:4.125});
cover.stamp({x0:12,x1:15,z0:32,z1:36,h:8.25});
cover.stamp({x0:10,x1:16,z0:30,z1:39,h:3.25});
assert.equal(cover.heightAt(13,34),8.25);assert.equal(cover.heightAt(11,38),4.125);
assert.equal(cover.heightAt(19,34),0);assert.equal(cover.heightAt(-10000,34),0);
cover.stamp({x0:20,x1:30,z0:40,z1:48},(x,z)=>z<45?(x-20)*.2:0);
assert(cover.heightAt(27,42)>1 && cover.heightAt(27,46)===0);
cover.stamp({x0:38,x1:43,z0:39,z1:44,h:2.5,radius:2.5});
assert.equal(cover.heightAt(40,41),2.5);assert.equal(cover.heightAt(38.5,39.5),0);
console.log('Solar cycle, seasonal fronts, storm delay, melting, drying, frame rates and roof exposure passed.');
