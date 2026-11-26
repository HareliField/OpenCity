"""Meter-scale serviceable engines and cabin trim for the reference cars and civilian fleet."""
import json
from math import cos, sin, pi

import bpy
from city_modeling import Asset, OUT, SOURCE, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
cast=material('Cast aluminium','8e908b',.55,.69)
steel=material('Zinc plated steel','9fa19b',.35,.79)
block=material('Heat stained casting','66635a',.69,.51)
poly=material('Moulded charcoal polymer','393d3d',.65,.09)
rubber=material('Textured black rubber','292d2d',.91)
brass=material('Warm hardware','a19263',.55,.6)
red=material('Battery positive boot','9a4940',.68)
cap=material('Oil and coolant labels','b6a666',.67)
vessel=material('Coolant reservoir','d5d1bd',.50)
cloth=material('Graphite seat cloth','45484a',.94)
stitch=material('Seat piping','5b5d5c',.83)
dash=material('Soft touch fascia','34383a',.76)
panel=material('Brushed dashboard trim','747779',.49,.47)
dial=material('Instrument dial face','202626',.42)
cream=material('Instrument index and markings','d6d2bd',.62)
carpet=material('Footwell carpet','373739',.98)
assets=[]

def new(name,description):
    a=Asset(name,[1,18,30,38,66,72,112],description)
    assets.append(a)
    return a

def engine(kind):
    configs={'transverse':('inline four',1,4),'v-bank':('twin-bank eight',2,4),
             'boxer':('opposed six',2,3),'diesel':('commercial inline six',1,6)}
    title,banks,cylinders=configs[kind]
    a=new('engine-'+kind,'Service bay with '+title+' layout, rocker covers, manifolds, oil pan, battery, radiator and cooling fan.')
    a.box('Lower bay pan',(0,0,.025),(1.43,.87,.048),rubber,.021)
    for side in [-1,1]:
        a.box('Longitudinal frame rail',(side*.652,0,.129),(.095,.86,.18),cast,.017)
        a.box('Wheelhouse flange',(side*.688,0,.278),(.058,.836,.255),poly,.024)
        a.tube('Suspension turret lip',[(side*.63,.015,.278),(side*.63,.015,.337)],[.113,.088],cast,22)
        for j in range(3):
            ang=j*2*pi/3
            a.turn('Strut stud',side*.63+.066*cos(ang),.015+.066*sin(ang),[(.332,.011),(.346,.011)],steel,6)
    a.box('Firewall',(0,.402,.244),(1.32,.047,.416),poly,.017)
    a.box('Cast oil pan',(-.037,.028,.139),(.61,.41,.192),block,.042)
    a.box('Engine crankcase',(-.037,.048,.253),(.66,.42,.209),cast,.033)
    for b in range(banks):
        y=.016 if banks==1 else (b-.5)*(.40 if kind=='boxer' else .269)
        h=.390 if kind!='boxer' else .309
        a.box('Cylinder head',(-.055,y,h),(.658,.218 if banks>1 else .27,.090),cast,.021)
        a.box('Rocker cover',(-.055,y,h+.068),(.665,.182 if banks>1 else .227,.082),poly,.034)
        for i in range(cylinders):
            x=-.335+.55*i/(cylinders-1)
            a.box('Coil pack',(x,y,h+.116),(.064,.080,.037),rubber,.009)
            a.tube('Insulated coil lead',[(x,y+.018,h+.125),(x+.008,y+.055,h+.140),
                   (x+.017,y+.103,h+.103),(x+.035,y+.115,h+.06)],.0065,rubber,8)
            runnerY=y-.098 if b==0 else y+.092;sg=-1 if b==0 else 1
            a.tube('Curved manifold runner',[(x,runnerY,h+.018),(x,runnerY+sg*.065,h+.034),
                   (x+.027,runnerY+sg*.119,h-.006),(x+.045,runnerY+sg*.153,h-.085)],
                   [.030,.034,.033,.032],cast,12)
            for oy in [-.078,.078]:a.turn('Cover bolt',x,y+oy,[(h+.097,.009),(h+.109,.009)],steel,6)
        for n in range(4):a.box('Cover stiffening rib',(-.064,y+(n-1.5)*.032,h+.106),(.595,.006,.008),poly,.003)
    a.turn('Oil filler cap',.184,.037,[(.514,.029),(.528,.033),(.538,.028)],cap,18)
    a.box('Battery case',(.462,.220,.246),(.251,.245,.254),poly,.010)
    a.box('Battery lid',(.462,.220,.379),(.261,.250,.023),rubber,.008)
    a.box('Battery hold down',(.462,.220,.396),(.032,.269,.012),steel,.003)
    for x,mat in [(.38,red),(.544,steel)]:
        a.turn('Battery terminal',x,.147,[(.390,.019),(.404,.016)],mat,12)
        a.tube('Battery cable',[(x,.147,.403),(x+.037,.105,.402),(x+.048,.03,.344),(x+.082,-.05,.282)],.009,mat,8)
    a.box('Air filter housing',(-.50,.207,.29),(.204,.240,.176),poly,.018)
    for k in range(6):a.box('Filter lid rib',(-.58+.031*k,.21,.385),(.009,.196,.015),poly,.004)
    a.tube('Intake elbow',[(-.514,.086,.33),(-.472,-.010,.32),(-.379,-.066,.331),(-.264,-.079,.34)],
           [.053,.052,.046,.043],rubber,18)
    for k in range(5):a.ring('Intake bellows',(-.459+k*.016,-.015-k*.008,.323),.048,.0035,poly,(.87,-.48,0),14)
    a.box('Radiator core',(0,-.345,.26),(1.13,.069,.350),poly,.012)
    for j in range(24):a.box('Radiator fin',(0,-.387,.102+j*.013),(.993,.009,.004),cast)
    for x in [-.55,.55]:a.box('Radiator tank',(x,-.340,.263),(.078,.087,.357),rubber,.018)
    a.box('Fan shroud',(0,-.288,.257),(.411,.024,.371),poly,.024)
    y=-.267;cx=.016;cz=.256;group='CoolingFan';a.pivots[group]=(cx,y,cz)
    a.ring('Fan guard',(cx,y-.020,cz),.171,.010,poly,(0,1,0))
    a.tube('Fan motor',[(cx,y-.014,cz),(cx,y+.030,cz)],.04,rubber,18,group)
    for k in range(7):
        ang=k*2*pi/7
        points=[(cx+r*cos(ang+t),y+.006*sin(t),cz+r*sin(ang+t)) for r,t in
                [(.037,-.07),(.15,-.07),(.167,.27),(.147,.44),(.045,.20)]]
        a.mesh('Cooling blade',points,[(0,1,2,3,4),(4,3,2,1,0)],poly,group=group)
    a.tube('Coolant top hose',[(.535,-.337,.414),(.426,-.288,.428),(.348,-.221,.385),(.233,-.179,.353)],
           [.027,.031,.030,.026],rubber,14)
    for p,n in [((.49,-.315,.422),(.88,-.43,0)),((.271,-.195,.366),(.89,-.41,.22))]:
        a.ring('Worm-drive hose clamp',p,.0285,.003,steel,n,16)
    a.turn('Expansion bottle',-.50,-.118,[(.159,.062),(.181,.080),(.281,.077),(.319,.046),(.341,.035)],vessel,18)
    a.turn('Pressure cap',-.50,-.118,[(.339,.034),(.353,.042),(.357,.034)],cap,16)
    a.tube('Alternator body',[(.265,-.143,.219),(.368,-.143,.219)],.073,cast,22)
    for y,z,r in [(-.12,.217,.052),(.108,.186,.080),(.055,.351,.047)]:
        a.tube('Accessory pulley',[(.356,y,z),(.383,y,z)],[r,r*.99],rubber,22)
    a.tube('Serpentine belt',[(.382,-.161,.235),(.382,-.149,.179),(.382,.073,.109),(.382,.170,.156),
           (.382,.143,.255),(.382,.087,.387),(.382,.021,.384),(.382,-.161,.235)],.0065,rubber,7)
    return a

def cabin():
    a=new('passenger-cabin','Seats with rails and headrests, passenger footwells, working-depth steering wheel, instruments, handbrake and door lining.')
    a.box('Pressed floor pan',(0,0,.023),(1.53,2.16,.047),rubber,.020)
    for sx in [-1,1]:
        for yy in [-.60,.69]:a.box('Floor mat',(sx*.39,yy,.058),(.55,.52,.021),carpet,.026)
        x=.397*sx
        for u in [-.165,.165]:a.box('Adjuster rail',(x+u,-.072,.115),(.034,.540,.073),cast,.008)
        a.box('Sprung seat squab',(x,-.074,.196),(.542,.526,.164),cloth,.058)
        a.box('Seatback',(x,.156,.467),(.502,.133,.559),cloth,.056)
        for u in [-.218,.218]:
            a.box('Squab bolster',(x+u,-.059,.268),(.094,.443,.112),cloth,.040)
            a.box('Seatback bolster',(x+u,.108,.495),(.090,.112,.420),cloth,.035)
        for j in range(5):
            a.box('Seat quilting',(x+(j-2)*.072,.083,.467),(.009,.004,.334),stitch,.0018)
        for u in [-.079,.079]:a.turn('Headrest post',x+u,.161,[(.741,.010),(.805,.010)],steel,10)
        a.box('Headrest',(x,.154,.838),(.253,.124,.153),cloth,.038)
        for y in [.841]:
            a.box('Rear head restraint',(x,y,.756),(.246,.109,.146),cloth,.033)
        a.box('Belt receptacle',(x-sx*.273,.112,.249),(.032,.052,.113),poly,.009)
        a.box('Buckle button',(x-sx*.273,.112,.307),(.028,.040,.010),red,.003)
    a.box('Rear seat',(0,.714,.236),(1.38,.476,.194),cloth,.050)
    a.box('Rear back squab',(0,.910,.463),(1.36,.139,.428),cloth,.050)
    a.box('Tunnel console',(0,-.333,.210),(.209,.649,.264),dash,.034)
    a.tube('Gear lever',[(0,-.431,.344),(0,-.409,.419)],.011,steel,10)
    a.box('Shift knob',(0,-.410,.426),(.050,.051,.054),poly,.016)
    a.tube('Handbrake',[(-.049,-.252,.34),(-.051,-.112,.38)],.015,rubber,10)
    a.box('Parcel shelf',(0,.990,.663),(1.39,.173,.023),dash,.008)
    a.box('Dashboard shell',(0,-.863,.615),(1.437,.347,.213),dash,.053)
    a.box('Glovebox lid',(.408,-.691,.596),(.506,.032,.153),dash,.015)
    a.box('Glovebox handle',(.412,-.666,.644),(.110,.020,.015),panel,.004)
    for x in [-.601,-.138,.132,.601]:
        a.box('Air vent bezel',(x,-.683,.686),(.118,.015,.042),panel,.005)
        for j in range(3):a.box('Vent louvre',(x,-.673,.673+j*.012),(.102,.010,.004),poly,.001)
    a.box('Cluster binnacle',(-.374,-.805,.746),(.390,.161,.126),dash,.042)
    for x,r in [(-.46,.052),(-.337,.052),(-.248,.035)]:
        a.tube('Recessed dial',[(x,-.729,.737),(x,-.717,.737)],r,dial,28)
        for j in range(10):
            ang=.58+j*.52
            a.tube('Index',[(x+r*.74*cos(ang),-.715,.737+r*.74*sin(ang)),(x+r*.90*cos(ang),-.715,.737+r*.90*sin(ang))],.0016,cream,6)
        a.tube('Gauge pointer',[(x,-.713,.737),(x-.6*r,-.712,.737-.18*r)],.0019,red,6)
    center=(-.374,-.54,.657)
    a.tube('Steering column',[(-.374,-.79,.607),center],.04,dash,14)
    a.ring('Steering rim',center,.145,.014,rubber,(0,.88,.47),30)
    for dx,dz in [(-.132,.009),(.132,.009),(0,-.117)]:
        a.tube('Steering spoke',[center,(center[0]+dx,-.54-dz*.43,center[2]+dz)],.013,panel,8)
    a.box('Steering hub',center,(.113,.043,.070),poly,.015)
    for x in [-.45,-.367,-.296]:
        a.box('Pedal pad',(x,-.86,.165),(.041,.054,.017),rubber,.005)
    return a

if __name__=='__main__':
    for kind in ('transverse','v-bank','boxer','diesel'):engine(kind)
    cabin()
    publish(assets,{a.name for a in assets},'Vehicle mechanical assemblies')
    rows=[dict(id=a.name,sourceImages=a.refs,description=a.description,parts=len(a.collection.objects),
               movableParts=list(a.pivots)[1:],runtimeBytes=(OUT/(a.name+'.glb')).stat().st_size) for a in assets]
    (SOURCE/'Vehicle mechanical assemblies.json').write_text(json.dumps(rows,indent=2)+'\n')
