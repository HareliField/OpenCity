// Highest surface open to the sky, shared by precipitation, paving and tyres.
// Each RG texel is a height in sixteenths of a metre. Zero also shelters the cellar.
const WEATHER_MAP_SIZE=1024, WEATHER_CELL=1.5, WEATHER_ORIGIN=-96;
const weatherCeilings=[];
class WeatherCoverMap {
 constructor() { this.pixels=new Uint8Array(WEATHER_MAP_SIZE*WEATHER_MAP_SIZE*4); }
 cell(v) { return Math.floor((v-WEATHER_ORIGIN)/WEATHER_CELL); }
 heightAt(x,z) {
  const col=this.cell(x),row=this.cell(z);
  if (col<0||row<0||col>=WEATHER_MAP_SIZE||row>=WEATHER_MAP_SIZE) return 0;
  const i=(row*WEATHER_MAP_SIZE+col)*4;
  return (this.pixels[i]*256+this.pixels[i+1])/16;
 }
 stamp(r,heightAt) {
  const left=Math.max(0,this.cell(r.x0)),right=Math.min(WEATHER_MAP_SIZE-1,this.cell(r.x1));
  const top=Math.max(0,this.cell(r.z0)),bottom=Math.min(WEATHER_MAP_SIZE-1,this.cell(r.z1));
  const cx=(r.x0+r.x1)*.5,cz=(r.z0+r.z1)*.5;
  // Only fill texels contained by a round obstacle. A pole or small rock
  // otherwise casts a square one-and-a-half-metre snow-free patch beside it.
  const radius=r.radius===undefined?Infinity:Math.max(0,r.radius-WEATHER_CELL*Math.SQRT1_2);
  for (let row=top;row<=bottom;row++) {
   const z=WEATHER_ORIGIN+(row+.5)*WEATHER_CELL;
   if (z<r.z0||z>r.z1) continue;
   for (let col=left;col<=right;col++) {
    const x=WEATHER_ORIGIN+(col+.5)*WEATHER_CELL;
    if (x<r.x0||x>r.x1||(x-cx)**2+(z-cz)**2>=radius*radius) continue;
    const h=Math.round((heightAt?heightAt(x,z):r.h)*16), i=(row*WEATHER_MAP_SIZE+col)*4;
    if (h<=this.pixels[i]*256+this.pixels[i+1]) continue;
    this.pixels[i]=h>>8; this.pixels[i+1]=h&255;
   }
  }
 }
}
function buildWeatherCover() {
 const map=new WeatherCoverMap();
 for (const b of blocks) for (const r of b.bld){
  if(r.construction){for(const l of r.levels)map.stamp({...l.rect,h:l.h});}
  else if(r.obb && r.normal?.y>.1){
   const n=r.normal,p=r.obb.p;
   const edge=(Math.abs(n.x)+Math.abs(n.z))*WEATHER_CELL*.5;
   map.stamp(r,(x,z)=>p.y+(r.obb.h*.5-n.x*(x-p.x)-n.z*(z-p.z)-edge)/n.y);
  }else map.stamp(r);
 }
 for (const r of weatherCeilings) map.stamp(r);
 for (const floor of CITY_WORKS.floors) map.stamp({...floor,h:floor.y});
 for (const deck of STREET.steps) if(deck.y>.35) map.stamp({...deck,h:deck.y});
 for (const r of STATIC) if (!r.obb && !r.convex && r.h>.35) map.stamp(r);
 for (const r of CITY_WORKS.pitchedRoofs||[]) map.stamp(r,(x,z)=>{
  const inset=Math.min(x-r.x0,r.x1-x,z-r.z0,r.z1-z,r.run);
  return r.eave+r.rise*Math.max(0,inset)/r.run;
 });
 stampCoveRoof(map);
 for (const route of GRADE_ROADS.routes) for (const s of route.sections) {
  const pad=s.half+.2;
  map.stamp({x0:Math.min(s.a.x,s.b.x)-pad,x1:Math.max(s.a.x,s.b.x)+pad,
   z0:Math.min(s.a.z,s.b.z)-pad,z1:Math.max(s.a.z,s.b.z)+pad},(x,z)=>{
    const q=gradeCoordinates(s,x,z);
    return q.along>=-.06&&q.along<=1.06&&q.range<=pad?q.height:0;
   });
 }
 return map;
}
