"""Build the park mosaic, glass transit shelter, vitreous fixture and the diner kitchen in metric Blender collections."""
import json
import sys
from math import cos,pi,sin
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from city_modeling import Asset,OUT,SOURCE,TAU,material,publish
bpy.ops.wm.read_factory_settings(use_empty=True)
stone=material('Limestone coping','ada18b',.83)
sand=material('Stone repair mortar','bdb19c',.89)
metal=material('Drawn stainless steel','b8b8b0',.31,.81)
iron=material('Coated charcoal posts','444d49',.55,.47)
gasket=material('Dense graphite rubber','363b39',.85)
glass=material('Shelter glass','b1c4bc',.125,.05,alpha=.24,two_sided=True)
blue=[material('Sea-glaze '+str(i),c,.38,.04) for i,c in enumerate(['436c75','467a81','608a89','4f737a','658b90','566e73'])]
sandtiles=[material('Ivory tessera '+str(i),c,.61) for i,c in enumerate(['c0b59e','e1d2b5','d1c4aa','c7b99f'])]
paper=material('Printed passenger information','dbd6c6',.84)
green=material('Green enamel','4e6556',.66,.25)
oak=material('Timber bench slats','816b56',.81)
china=material('Warm sanitary porcelain','e1ded1',.21,.035)
seat=material('Duroplast seat','d2cdc1',.35)
teal=material('Cast enamel teal','486663',.48,.22)
brass=material('Machined brass','b49e6c',.35,.68)
coffee=material('Roasted coffee beans','584337',.84)
assets=[]

def asset(name,refs,desc):
    a=Asset(name,refs,desc);assets.append(a);return a

def clipped(poly,axis,edge,low):
    out=[]
    for i,p in enumerate(poly):
        q=poly[(i+1)%len(poly)];in0=p[axis]>=edge if low else p[axis]<=edge
        in1=q[axis]>=edge if low else q[axis]<=edge
        if in0:out.append(p)
        if in1!=in0:
            t=(edge-p[axis])/(q[axis]-p[axis])
            out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return out

def mosaic():
    a=asset('civic-mosaic-basin',[6,19,45,65],'A circular blue-and-ivory tiled basin with a radial coping, a stone sphere, bronze water outlets and a drained service recess.')
    a.turn('Mosaic bed',0,0,[(.013,3.27),(.135,3.29),(.141,3.28)],sand,72)
    wrap=72;inside=3.279;outer=3.62
    for i in range(wrap):
        lo=TAU*i/wrap+.0015;hi=TAU*(i+1)/wrap-.0015
        v=[]
        for h,r in [(.006,outer-.014),(.257,outer),(.279,outer-.03),(.279,inside+.022),(.248,inside),(.135,inside)]:
            v.extend([(r*cos(lo),r*sin(lo),h),(r*cos(hi),r*sin(hi),h)])
        f=[(j,j+1,j+3,j+2) for j in range(0,10,2)]+[(0,2,4,6,8,10),(11,9,7,5,3,1)]
        a.mesh('Limestone radial coping',v,f,stone if i%5 else sand,bevel=.006)
    radius=3.274
    outline=[(radius*cos(TAU*i/96),radius*sin(TAU*i/96)) for i in range(96)]
    # The staggered mosaic courses are individually clipped to the circular well, including the perimeter slivers.
    step=.216;grout=.007
    buckets={}
    for j in range(-16,16):
        for i in range(-17,17):
            x=(i+(j%2)*.5)*step;y=j*step
            p=clipped(outline,0,x+grout,True)
            p=clipped(p,0,x+step-grout,False);p=clipped(p,1,y+grout,True);p=clipped(p,1,y+step-grout,False)
            if len(p)<3:continue
            light=j in [-12,-11,-4,4,12] or abs(x-.30*y+.37)<.265
            palette=sandtiles if light else blue
            mat=palette[(abs(i*19+j*11))%len(palette)]
            vs,fs=buckets.setdefault(mat,([],[]));start=len(vs)
            vs.extend((u,v,.148) for u,v in p);fs.append(tuple(start+n for n in range(len(p))))
    for mat,(vs,fs) in buckets.items():a.mesh('Hand-laid glazed tesserae',vs,fs,mat)
    a.turn('Stone central collar',0,0,[(.148,.359),(.171,.381),(.207,.331),(.244,.244)],stone,30)
    rows=[]
    for j in range(17):
        polar=.07+(pi-.14)*j/16
        rows.append([(.394*sin(polar)*cos(TAU*k/40),.394*sin(polar)*sin(TAU*k/40),.607-.399*cos(polar)) for k in range(41)])
    a.surface('Weathered stone sphere',rows,sand)
    for i in range(4):
        th=TAU*i/4+.36;x,y=1.34*cos(th),1.34*sin(th)
        a.turn('Bronze bubbler',x,y,[(.148,.081),(.157,.104),(.186,.068),(.204,.043)],brass,20)
        a.turn('Bubbler aperture',x,y,[(.202,.034),(.204,.033)],gasket,14)
    x,y=-2.41,-.37
    a.box('Service drain recess',(x,y,.149),(.479,.32,.011),gasket,.004)
    for i in range(8):a.box('Drain bars',(x-.199+i*.057,y,.156),(.023,.299,.016),metal,.005)

def shelter():
    a=asset('glazed-bus-shelter',[17,45,65,72],'Three transparent windscreen bays, cantilever roof with glazing clips, timetable cabinet, and a timber passenger bench.')
    for x in [-1.71,-.577,.577,1.71]:
        a.box('Hold-down plate',(x,.462,.021),(.127,.142,.042),metal,.009)
        a.box('Glazing mullion',(x,.462,1.055),(.053,.067,2.076),iron,.009)
    for k in range(3):
        x=-1.141+k*1.141;a.box('Rear glass light',(x,.463,1.043),(1.078,.011,1.667),glass,.004)
        a.box('Bird-safe glazing dots',(x,.451,1.19),(1.066,.004,.013),paper)
        for dx in [-.493,.493]:
            for h in [.269,1.79]:a.turn('Glazing clamp',x+dx,.471,[(h,.017),(h+.050,.017)],metal,10)
    for x in [-1.71,1.71]:
        a.box('End return glazing',(x,.047,1.048),(.012,.735,1.643),glass,.004)
        a.box('Return upright',(x,-.329,1.076),(.043,.050,2.095),iron,.006)
        a.box('End sash rail',(x,.053,1.867),(.042,.822,.048),iron,.004)
    for y in [-.552,.566]:a.box('Aluminium roof edge',(0,y,2.136),(3.576,.059,.116),iron,.013)
    for x in [-1.761,1.761]:a.box('Fascia end',(x,.001,2.138),(.051,1.164,.115),iron,.011)
    a.box('Laminated shelter canopy',(0,.010,2.172),(3.540,1.137,.061),green,.021)
    for x in [-1.22,.61]:
        a.box('Bench cantilever',(x,.145,.238),(.049,.075,.465),iron,.007)
        a.box('Bench seat bracket',(x,.063,.430),(.052,.396,.042),iron,.006)
    for j in range(4):a.box('Seat lath',(-.31,-.081+j*.083,.457),(2.47,.070,.039),oak,.009)
    for j in range(2):a.box('Back lath',(-.31,.187,.655+j*.094),(2.47,.034,.072),oak,.008)
    a.box('Information case',(1.124,.414,1.243),(.661,.069,.965),iron,.017)
    a.box('Schedule sheet',(1.124,.372,1.243),(.599,.012,.895),paper,.004)
    a.box('Green header',(1.124,.364,1.615),(.584,.004,.102),green)
    for j in range(7):a.box('Timetable ruling',(1.13,.362,1.509-j*.079),(.469-.025*(j%3),.003,.007),iron)
    return a

def wc():
    a=asset('ceramic-cistern',[17,22,84],'Compact gravity cistern with a hollow vitreous bowl, seat, push button, shutoff and flexible supply.')
    a.box('Bolted pedestal',(0,.049,.128),(.247,.339,.250),china,.075)
    a.box('Soil connection',(0,.187,.171),(.17,.235,.157),china,.043)
    rows=[]
    for h,rx,ry,dy in [(.092,.115,.162,.033),(.205,.119,.183,.039),(.282,.154,.231,.003),
                       (.362,.196,.272,-.027),(.385,.201,.276,-.034),(.391,.184,.252,-.034),
                       (.359,.159,.221,-.026),(.291,.114,.141,.006),(.247,.055,.083,.043)]:
        rows.append([(rx*cos(TAU*j/42),dy+ry*sin(TAU*j/42),h) for j in range(43)])
    a.surface('Cast vitreous bowl',rows,china)
    rings=[[(rx*cos(TAU*j/42),-.037+ry*sin(TAU*j/42),h) for j in range(43)]
        for h,rx,ry in [(.391,.200,.268),(.410,.201,.269),(.418,.191,.257),(.416,.142,.198),(.391,.143,.198)]]
    a.surface('Pressed elliptical seat',rings,seat)
    a.box('Close-coupled cistern',(0,.237,.579),(.375,.182,.367),china,.051)
    a.box('Cistern lid',(0,.238,.770),(.387,.193,.044),china,.019)
    a.turn('Bright push button',0,.225,[(.791,.028),(.798,.027)],metal,20)
    for x in [-.077,.077]:a.box('Seat hinge',(x,.169,.398),(.041,.091,.034),metal,.009)
    a.tube('Flexible supply',[(.162,.195,.471),(.196,.199,.409),(.20,.223,.225),(.237,.294,.166)],.009,metal,8)
    a.ring('Service valve wheel',(.234,.281,.177),.030,.006,brass,(0,1,0),20)
    return a

def espresso():
    a=asset('diner-espresso',[25,90,96,99,111],'Two-group espresso machine with stepped cast side cheeks, portafilters, steam pipe, gauge, drip tray and cups.')
    a.box('Service feet',(0,0,.031),(.636,.375,.058),gasket,.019)
    a.box('Lower casing',(0,.001,.109),(.679,.414,.103),teal,.035)
    a.box('Drip tray',(0,-.099,.166),(.569,.197,.027),metal,.008)
    for j in range(9):a.box('Perforation row',(0,-.173+j*.018,.180),(.489,.005,.002),gasket)
    for side in [-1,1]:
        x=side*.309
        vs=[(x+s*.025,y,h) for s in [-1,1] for y,h in [(-.196,.12),(-.17,.343),(-.122,.382),(.169,.376),(.207,.128)]]
        fs=[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]
        a.mesh('Cast side panel',vs,fs,teal,bevel=.008)
    a.box('Upper boiler jacket',(0,.037,.331),(.599,.302,.095),metal,.025)
    a.box('Rear service panel',(0,.177,.232),(.606,.042,.136),teal,.012)
    for x in [-.133,.129]:
        a.turn('Group head',x,-.112,[(.242,.041),(.252,.056),(.292,.055)],metal,20)
        a.tube('Portafilter handle',[(x,-.14,.255),(x+.028,-.236,.246),(x+.042,-.282,.240)],[.009,.011,.010],gasket,9)
        a.turn('Espresso cup',x,-.095,[(.181,.022),(.189,.028),(.224,.038),(.228,.037),(.2284,.030)],china,22)
        a.turn('Filled cup',x,-.095,[(.222,.030),(.223,.030)],coffee,18)
        a.ring('Cup handle',(x+.04,-.095,.204),.014,.004,china,(0,1,0),18)
    a.tube('Steam wand',[(.243,-.068,.306),(.276,-.156,.289),(.284,-.177,.200)],.007,metal,8)
    for i in range(6):a.box('Selector key',(-.189+i*.074,-.119,.338),(.025,.016,.018),gasket,.004)
    a.ring('Front dial bezel',(.241,-.117,.342),.022,.006,brass,(0,1,0),24)
    return a

if __name__=='__main__':
    for build in [mosaic,shelter,wc,espresso]:build()
    publish(assets,{a.name for a in assets},'Civic and service fittings')
    rows=[{'id':a.name,'sourceImages':a.refs,'description':a.description,'parts':len(a.collection.objects),
           'movableParts':list(a.pivots)[1:],'runtimeBytes':(OUT/(a.name+'.glb')).stat().st_size} for a in assets]
    (SOURCE/'Civic and service fittings.json').write_text(json.dumps(rows,indent=2)+'\n')

