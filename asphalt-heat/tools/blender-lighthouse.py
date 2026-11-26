"""Build the reference lighthouse and export the surfaces carrying the player and rigid bodies."""
import json
import sys
from math import atan2, cos, hypot, pi, sin
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from city_modeling import Asset, OUT, SOURCE, TAU, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
stone = material('Salt-weathered coursed sandstone','ac967a',.91,finish='cove-ashlar')
stucco = material('Keeper house lime render','bdb4a7',.94,finish='keeper-wall')
paving = material('Worn limestone slab','a99f8d',.88,finish='cove-render')
iron = material('Tarred iron at sea','3e403b',.59,.64,finish='cast-iron')
steel = material('Dark blue-black enamel','333d41',.39,.68)
brass = material('Oxidised brass','917c59',.46,.67)
lens = material('Pressed lamp prisms','b4d1c6',.13,.11,alpha=.53,two_sided=True)
glazing = material('Salt mist on lantern glazing','b4bcaf',.18,.07,alpha=.13,two_sided=True)
opal = material('Beacon filament','f8e5b3',.29,.1)
inner = material('Painted stairwell masonry','a2957d',.88,finish='cove-render')
asset = Asset('cove-lighthouse',[32,50,76],'Tapered coursed stone, vented keeper house, four-turn stair and rotating prismatic lantern.')
solids = []
ground, roof, deck = .17,3.32,15.77
segments, stair_count, per_turn = 48,96,24
tread_r, tread_inner = 1.46,.18
door_width, door_height = 1.66,2.24
base_x,base_y=3.45,3.88


def polar(r,t):
    return (r*cos(t),r*sin(t))


def rect(x0,x1,y0,y1):
    return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]


def band(r0,r1,t0,t1):
    return [polar(r0,t0),polar(r1,t0),polar(r1,t1),polar(r0,t1)]


def solid(name,poly,bottom,top,mat,kind='wall',upper=None,uvscale=2.2,cyl_uv=False):
    """Both exports use these same counterclockwise lower and upper loops, in metres."""
    upper = upper if upper is not None else poly
    n=len(poly)
    verts=[(x,y,h) for ring,h in [(poly,bottom),(upper,top)] for x,y in ring]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=asset.mesh(name,verts,faces,mat)
    # Metric UVs wrap across individually removable stonework sections and window reveals.
    uv=obj.data.uv_layers.active
    for face in obj.data.polygons:
        side=face.index-2
        for li,vi in zip(face.loop_indices,face.vertices):
            x,y,z=verts[vi]
            if side<0:
                u,v=x/uvscale,y/uvscale
            else:
                ax,ay=poly[side];bx,by=poly[(side+1)%n];length=hypot(bx-ax,by-ay)
                u=(x*(bx-ax)+y*(by-ay))/(uvscale*length);v=z/uvscale
                if cyl_uv and side in (1,3):
                    start=atan2(ay,ax)%(2*pi);angle=atan2(y,x)%(2*pi)
                    if angle<start-pi:angle+=2*pi
                    if angle>start+pi:angle-=2*pi
                    u=angle*2.41/uvscale
            if mat==stucco and side>=0:
                if abs(y)>base_y-.22:
                    u=(x+base_x)/(2*base_x)
                else:
                    u=(y+base_y)/(2*base_y)
                v=(z-ground)/(roof-ground)
            uv.data[li].uv=(u,v)
    def coords(ring):
        return [[round(x,5),round(-y,5)] for x,y in ring]
    row={'kind':kind,'bottom':round(bottom,6),'top':round(top,6),'footprint':coords(poly)}
    if upper!=poly: row['upper']=coords(upper)
    solids.append(row)
    return obj


def wall(name,x0,x1,y0,y1,z0,z1,mat=stucco):
    return solid(name,rect(x0,x1,y0,y1),z0,z1,mat)


def rail(a,b,low,high,width,name='Gallery guard panel'):
    dx,dy=b[0]-a[0],b[1]-a[1];l=hypot(dx,dy);ox,oy=-dy*width/(2*l),dx*width/(2*l)
    # Guard bars block a body across the whole panel. Only their fabricated rails are rendered.
    outline=[(a[0]-ox,a[1]-oy),(b[0]-ox,b[1]-oy),(b[0]+ox,b[1]+oy),(a[0]+ox,a[1]+oy)]
    solids.append({'kind':'guard','bottom':round(low,6),'top':round(high,6),'footprint':[[round(x,5),round(-y,5)] for x,y in outline]})
    asset.tube(name,[(a[0],a[1],high),(b[0],b[1],high)],width/2,iron,9)


def build():
    solid('Door threshold and worn apron',rect(-5.18,-base_x,-1.55,1.55),.018,ground,paving,'floor')
    for ya,yb in [(-base_y,-1.55),(1.55,base_y)]:
        solid('Keeper house side apron',rect(-4.78,-base_x,ya,yb),.018,ground,paving,'floor')
    solid('Foyer floor',rect(-base_x,base_x,-base_y,base_y),.018,ground,paving,'floor')
    wall('West jamb north',-base_x,-base_x+.20,-base_y,-door_width/2,ground,roof)
    wall('West jamb south',-base_x,-base_x+.20,door_width/2,base_y,ground,roof)
    wall('Head of doorway',-base_x,-base_x+.20,-door_width/2,door_width/2,ground+door_height,roof)
    wall('Seaward masonry',base_x-.20,base_x,-base_y,base_y,ground,roof)
    # An actual vent in the south wall has louvers, insect screen and a weathered surround.
    wall('Keeper north wall',-base_x,base_x,base_y-.2,base_y,ground,roof)
    for xa,xb,ha,hb in [(-base_x,-1.55,ground,roof),(-.99,base_x,ground,roof),
                          (-1.55,-.99,ground,1.70),(-1.55,-.99,2.13,roof)]:
        wall('Vented keeper wall',xa,xb,-base_y,-base_y+.2,ha,hb)
    asset.box('Vent gauze',(-1.27,-base_y+.11,1.91),(.55,.018,.42),steel)
    for i in range(8):
        asset.box('Louver',(-1.27,-base_y-.025,1.72+i*.055),(.61,.09,.027),brass,.009)
    for x in [-1.585,-.955]: asset.box('Vent flange',(x,-base_y-.015,1.92),(.039,.041,.49),iron)
    for z in [1.68,2.16]: asset.box('Vent flange',(-1.27,-base_y-.015,z),(.64,.041,.04),iron)
    # Shadowed shelf on the foyer's east wall, analog circuit indicator and conduit.
    wall('Keeper shelf',base_x-.76,base_x-.19,-1.25,1.25,.84,.98,paving)
    asset.box('Switch enclosure',(base_x-.24,-.53,1.31),(.115,.43,.46),iron,.025)
    asset.turn('Incoming conduit',base_x-.25,-.53,[(1.50,.027),(3.25,.027)],steel,8)
    for i in range(4):
        asset.box('Ceramic fuse',(base_x-.313,-.65+i*.084,1.34),(.069,.041,.13),opal,.012)
    for side in [-1,1]:
        asset.box('Paint-worn door lining',(-base_x-.019,side*(door_width/2+.03),ground+door_height/2),(.1,.06,door_height+.07),iron,.012)
    asset.box('Keeper door drip cap',(-base_x-.065,0,ground+door_height+.08),(.19,door_width+.24,.052),steel,.016)
    cap_x,cap_y=base_x+.065,base_y+.065
    def square(t):
        x,y=cos(t),sin(t);r=min(cap_x/max(abs(x),1e-8),cap_y/max(abs(y),1e-8));return (r*x,r*y)
    corners=[atan2(y,x)%(2*pi) for x in [-cap_x,cap_x] for y in [-cap_y,cap_y]]
    angles=sorted({0.,2*pi,*corners,*[TAU*i/segments for i in range(segments)]})
    for t0,t1 in zip(angles,angles[1:]):
        solid('Roof slab around tower opening',[polar(2.46,t0),square(t0),square(t1),polar(2.46,t1) ],roof-.12,roof+.038,paving,'floor')
    # Avoid a solid cylinder. Split the shell at the measured slit heights and leave the reveals open.
    def r(h):return 2.62-(h-roof)/(deck-roof)*.82
    windows=[(4.36,5.2,24),(7.98,8.82,38),(11.78,12.65,13)]
    levels=sorted([roof,deck-.16,*[h for lo,hi,s in windows for h in (lo,hi)]])
    for low,high in zip(levels,levels[1:]):
        for k in range(segments):
            t0,t1=TAU*k/segments,TAU*(k+1)/segments
            if any(lo<=low and high<=hi and k in (s,s+1) for lo,hi,s in windows):
                if k==next(s for lo,hi,s in windows if lo<=low and high<=hi):
                    point=polar(r(low)-.08,t1)
                    asset.tube('Window mullion',[(*point,low),(*point,high)],.021,iron,8)
                continue
            solid('Tapered ashlar shell',band(r(low)-.22,r(low),t0,t1),low,high,stone,
                  upper=band(r(high)-.22,r(high),t0,t1),uvscale=2.47,cyl_uv=True)
    for z in [roof+.08,roof+.29,deck-.28]:
        asset.ring('Projecting cut-stone collar',(0,0,z),r(z)+.018,.064,stone,steps=64)
    # The centre newel, four helical flights and an inner rail, with full walking width outside the rail.
    circle=[polar(.182,TAU*k/16) for k in range(16)]
    solid('Cast central newel',circle,ground,deck,iron)
    rise=(deck-ground)/stair_count;hand=[]
    for i in range(stair_count):
        t0=pi+TAU*i/per_turn;t1=t0+TAU/per_turn;h=ground+(i+1)*rise
        solid('Iron spiral tread %02d'%(i+1),band(tread_inner,tread_r,t0,t1),h-.09,h,iron,'floor',uvscale=.85)
        # Nosing and punched grip strips give the treads a readable leading edge.
        for inset,width in [(.015,.021),(.048,.010)]:
            t=t0+inset
            asset.tube('Tread grip',[(*polar(.44,t),h+.003),(*polar(1.42,t),h+.003)],width/2,steel,6)
        th=t0+.025
        if i%3==0:
            pt=polar(.37,th);asset.tube('Newel baluster',[(*pt,h),(*pt,h+.84)],.022,iron,8)
        hand.append((*polar(.37,t0),h+.82))
    hand.append((*polar(.37,pi+TAU*stair_count/per_turn),deck+.82))
    asset.tube('Continuous helical handrail',hand,.036,brass,10)
    # The annular gallery and partial landing leave head and shoulder clearance over the last fourteen treads.
    for k in range(per_turn):
        t0=pi+TAU*k/per_turn;t1=t0+TAU/per_turn
        solid('External gallery floor',band(tread_r,2.62,t0,t1),deck-.15,deck,iron,'floor')
        if k<per_turn//2-2:
            solid('Top landing',band(tread_inner,tread_r,t0,t1),deck-.09,deck,iron,'floor')
        pt,other=polar(2.55,t0),polar(2.55,t1)
        rail(pt,other,deck,deck+1.04,.058)
        asset.tube('Gallery mid rail',[(*pt,deck+.53),(*other,deck+.53)],.021,iron,8)
        asset.tube('Riveted guard stanchion',[(*pt,deck+.02),(*pt,deck+1.07)],.034,iron,9)
        asset.turn('Stanchion shoe',*pt,[(deck,.076),(deck+.085,.057)],steel,10)
    for z,rad in [(deck-.16,2.61),(deck-.04,2.64),(deck+.11,1.57)]:
        asset.ring('Gallery rim',(0,0,z),rad,.041,iron,steps=48)
    # Keep the western side open onto the gallery. A visitor can reach the seaward side by the outside ring.
    hood=18.27; cage_r=1.56
    for k in range(12):
        a,b=TAU*k/12,TAU*(k+1)/12;pt=polar(cage_r,a);other=polar(cage_r,b)
        asset.tube('Lantern glazing bar',[(*pt,deck),(*pt,hood)],.044,steel,10)
        if k not in (5,6):
            solid('Lantern plate glass',band(cage_r-.018,cage_r+.018,a,b),deck+.06,hood-.05,glazing,'glass')
            asset.tube('Glazing crossbar',[(*pt,deck+.83),(*other,deck+.83)],.022,steel,8)
            asset.tube('Lantern diagonal brace',[(*pt,deck+.12),(*other,hood-.11)],.018,iron,7)
    # The optic's spindle rests on the newel. Opposed bull's-eye panels rotate as a single optical assembly.
    asset.turn('Lamp pedestal',0,0,[(deck,.23),(deck+.12,.31),(deck+.16,.24),(deck+.89,.145),(deck+.99,.28)],iron,24)
    h=deck+1.49
    asset.pivots['LampOptic']=(0,0,h)
    asset.turn('Filament globe',0,0,[(h-.30,.09),(h-.21,.14),(h,.18),(h+.20,.14),(h+.31,.075)],opal,24,'LampOptic')
    for i in range(19):
        dz=(i-9)*.056;rad=.355+.17*cos(dz*pi)
        asset.turn('Annular Fresnel prism',0,0,[(h+dz-.029,rad-.048),(h+dz-.012,rad),(h+dz+.023,rad-.013),(h+dz+.027,rad-.045)],lens,36,'LampOptic')
    for sign in [-1,1]:
        for i in range(6):
            asset.ring('Fresnel bullseye',(sign*(.49-i*.009),0,h),.045+i*.052,.018,lens,normal=(1,0,0),steps=32,group='LampOptic')
    for z in [h-.58,h+.58]:asset.ring('Optic carrier',(0,0,z),.39,.032,brass,group='LampOptic')
    for k in range(4):
        pt=polar(.39,pi/4+TAU*k/4)
        asset.tube('Carrier rod',[(*pt,h-.58),(*pt,h+.58)],.025,brass,8,group='LampOptic')
    asset.turn('Spun storm hood',0,0,[(hood-.055,1.57),(hood,1.69),(hood+.095,1.65),
               (hood+.18,1.55),(hood+.37,1.48),(hood+.62,1.24),(hood+.80,.95),(hood+.97,.54),(hood+1.04,.19)],steel,48)
    for i in range(12):
        th=TAU*i/12
        asset.tube('Hood seam',[(*polar(rad,th),hood+dz) for dz,rad in [(.09,1.65),(.36,1.49),(.62,1.25),(.81,.95),(.98,.55),(1.04,.19)]],.018,iron,7)
    asset.turn('Lightning finial',0,0,[(hood+1.03,.14),(hood+1.13,.11),(hood+1.18,.14),(hood+1.28,.145),
                   (hood+1.35,.09),(hood+1.42,.06),(hood+1.66,.012)],brass,20)
    # A lens guard protects the lens without sealing the stair opening below it.
    solids.append({'kind':'guard','bottom':deck+.70,'top':deck+2.19,
                   'footprint':[[round(.55*cos(TAU*i/16),5),round(-.55*sin(TAU*i/16),5)] for i in range(16)]})
    # The crown remains a collision roof above the viewing gallery.
    solid('Lantern ceiling',[polar(1.66,TAU*i/24) for i in range(24)],hood-.06,hood+.01,steel)
    return {'door':{'x':-base_x,'width':door_width,'height':door_height,'floor':ground},
            'gallery':deck,'steps':stair_count,'stepsPerTurn':per_turn,'stairRadius':tread_r,'solids':solids}


if __name__=='__main__':
    layout=build()
    publish([asset],{asset.name},'Lighthouse Cove')
    (OUT/'cove-layout.json').write_text(json.dumps(layout,separators=(',',':'))+'\n')
    entry={'id':asset.name,'sourceImages':asset.refs,'description':asset.description,'parts':len(asset.collection.objects),
           'movableParts':list(asset.pivots)[1:],'runtimeBytes':(OUT/(asset.name+'.glb')).stat().st_size}
    (SOURCE/'Lighthouse Cove.json').write_text(json.dumps([entry],indent=2)+'\n')
