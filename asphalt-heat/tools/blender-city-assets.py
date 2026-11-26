"""Author the city's editable props and vegetation with headless bpy. Dimensions are metres."""
import json
import random
import sys
from math import cos, pi, sin, sqrt
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
from city_modeling import Asset, OUT, SOURCE, TAU, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)

iron = material('Graphite cast iron','383b38',.65,.68)
cast = material('Weathered casting','49473d',.68,.65,finish='cast-iron')
steel = material('Brushed stainless steel','b2b4ad',.33,.82)
chrome = material('Rolled chrome trim','bfc3c2',.16,.92)
dark = material('Charcoal gasket','262724',.86)
glass = material('Clear plate glass','aec5c4',.075,.12,alpha=.15,two_sided=True)
opal = material('Opal lamp lens','e9e2c9',.31,.07)
enamel = material('Worn steel enamel','b9b5a8',.49,.65,finish='enamel')
wood = material('Oiled cabinet joinery','815035',.61,finish='joinery')
brass = material('Patinated brass','97845c',.51,.65)
cream = material('Warm glazed ceramic','e3ddc9',.38)
motor = material('Municipal blue-green enamel','426866',.51,.43)
rubber = material('Black vulcanised rubber','262824',.88)
rose = material('Dusty rose enamel','ccaaa3',.57,.12)
canvas = material('Weathered orange canvas','b64d30',.82)
white = material('Canvas tape','d5cbb3',.84)
dough = material('Baked pastry crust','c78b46',.61,finish='glazed-pastry')
glaze = material('Caramel glaze','a8713d',.37)
silver = material('Silver dial plates','a6a69b',.38,.68)
label = material('Paper preserve labels','c6b894',.77,image='preserve-label.jpg')
controls = material('Washer program fascia','3b3e3a',.45,.23,image='washer-controls.jpg')
products = [material(n,c,.34,.08) for n,c in [('Olive glass','605a32'),('Amber glass','935629'),('Oxblood glass','763a32'),('Sage glass','627650')]]
polish = [material(n,c,.22,.12) for n,c in [('Carmine lacquer','91404e'),('Blush lacquer','cb979a'),('Burgundy lacquer','562e37'),('Nude lacquer','b89077')]]
plane_bark = material('Mottled avenue bark','736354',.91,finish='plane-bark')
palm_bark = material('Palm trunk scars','8c7661',.91,finish='palm-bark')
leaf = material('Photographed sycamore leaves','748047',.84,image='plane-leaves.png',cutout=True,two_sided=True)
palm_card = material('Distant pinnate leaves','787c4d',.84,image='palm-spray.png',cutout=True,two_sided=True)
frond = [material(n,c,.84,two_sided=True) for n,c in [('Sunlit palm leaf','817c49'),('Mature green palm leaf','61693c'),('Dry palm skirt','806a4c')]]
assets = []


def make(name, refs, description):
    a = Asset(name, refs, description)
    assets.append(a)
    return a


def street_lantern():
    a = make('riverside-lamp',[18,112],'Fluted cast base, swept arm, peaked shade and eight opal lens ribs.')
    a.turn('Octagonal stepped foot',0,0,[(0,.27),(.052,.28),(.074,.26),(.11,.24),(.16,.235),(.19,.21),(.26,.21)],cast,8)
    a.turn('Cast plinth and waist',0,0,[(.24,.204),(.34,.20),(.37,.22),(.41,.19),(.65,.164),(.69,.175),(.74,.14),(.81,.113)],cast,32)
    a.turn('Fluted column',0,0,[(.80,.115),(1.00,.10),(3.92,.071),(4.19,.072),(4.26,.092),(4.34,.066)],iron,48,flute=.105)
    for h,r in [(.18,.216),(.39,.212),(.71,.167),(1.02,.114),(3.93,.083),(4.26,.099)]:
        a.ring('Cast collar', (0,0,h),r,.015,cast)
    # A swept shepherd's crook carries the fitting directly over the pavement.
    p = [(0,0,4.27),(0,0,4.48),(0,-.03,4.68),(0,-.12,4.84),
         (0,-.27,4.92),(0,-.41,4.90),(0,-.52,4.78),(0,-.565,4.61),(0,-.57,4.52)]
    a.tube('Swept neck',p,.034,iron,16)
    a.turn('Bell shade',0,-.57,[(4.39,.216),(4.405,.238),(4.45,.179),(4.48,.144),(4.53,.105),(4.57,.068),(4.60,.04)],cast,32)
    a.turn('Seed-shaped glass',0,-.57,[(4.02,.035),(4.06,.074),(4.14,.127),(4.23,.177),(4.33,.203),(4.39,.190)],opal,32)
    for i in range(8):
        ang = i*TAU/8
        a.tube('Glazing rib',[(r*cos(ang),-.57+r*sin(ang),z) for z,r in
               [(4.02,.034),(4.07,.082),(4.19,.159),(4.32,.205),(4.39,.196)]],.009,iron,6)
    a.turn('Pendant finial',0,-.57,[(3.94,.007),(3.985,.045),(4.025,.036)],brass,16)
    return a


def litter_bin():
    a = make('avenue-bin',[92,109],'Open basket with vented slats, liner, rolled rim and bolted ring foot.')
    a.turn('Liner',0,0,[(.045,.236),(.91,.291),(.925,.285),(.88,.264),(.20,.206)],dark,20)
    for i in range(28):
        th = i*TAU/28
        a.tube('Powder-coated outer stave',[(.25*cos(th),.25*sin(th),.085),(.30*cos(th),.30*sin(th),.90)],.014,iron,6)
    for z,r,thick in [(.044,.255,.021),(.11,.248,.015),(.39,.271,.016),(.84,.297,.016),(.925,.304,.025)]:
        a.ring('Rolled reinforcing band',(0,0,z),r,thick,cast)
    return a


def air_conditioner():
    a = make('window-ac',[18,41,112],'Window-mounted air conditioner with return louvers, fan guard and bent brackets.')
    a.box('Enamel cabinet',(0,0,.18),(.62,.39,.36),enamel,.012)
    a.box('Front recess',(0,-.200,.19),(.577,.018,.275),dark,.009)
    for x in [-.199,.082]:
        for i in range(8):
            a.box('Folded outlet louver',(x,-.214,.083+i*.030),(.184 if x<0 else .311,.034,.014),steel,.003)
    a.box('Vertical divider',(-.075,-.217,.18),(.020,.030,.26),enamel,.003)
    for x in [-.233,.233]:
        a.tube('Folded support stay',[(x,-.125,.023),(x,.195,.012),(x,.19,.22)],.017,iron,6)
    for x in [-.285,.285]:
        for z in [.054,.31]:
            a.tube('Fascia screw',[(x,-.21,z),(x,-.22,z)],.008,chrome,8)
    return a


def roof_fan():
    a = make('condenser-bank',[24,57,95],'Twin fan condenser with louvered coils, guards and independent impellers.')
    a.box('Weathered shell',(0,0,.53),(2.12,1.15,.96),enamel,.033)
    for side in [-1,1]:
        for i in range(15):
            a.box('Coil fins',(0,side*.588,.18+i*.049),(1.95,.046,.021),steel,.002)
        for x in [-.81,0,.83]:
            a.box('Coil upright',(x,side*.605,.52),(.033,.036,.78),enamel,.004)
    for j,x in enumerate([-.51,.51]):
        n = 'Fan'+str(j+1)
        a.pivots[n] = (x,0,1.013)
        a.turn('Impeller well',x,0,[(1.004,.445),(1.023,.445)],dark,32)
        a.turn('Boss',x,0,[(1.023,.1),(1.072,.069)],steel,16,n)
        for i in range(5):
            ang = i*TAU/5
            vs = [(x+r*cos(ang+t),r*sin(ang+t),h) for r,t,h in
                  [(.058,0,1.039),(.31,-.22,1.038),(.395,-.05,1.045),(.363,.31,1.062),(.13,.42,1.066)]]
            a.mesh('Cambered fan blade',vs,[(0,1,2,3,4)],steel,group=n)
        for r in [.115,.19,.265,.337,.414]:
            a.ring('Fan guard hoop',(x,0,1.089),r,.009,iron,steps=32)
        for i in range(4):
            ang = i*pi/4
            a.tube('Guard stay',[(x-.43*cos(ang),-.43*sin(ang),1.083),(x+.43*cos(ang),.43*sin(ang),1.083)],.010,iron,6)
    for x in [-.77,.77]:
        a.box('Vibration sleeper',(x,0,.052),(.20,1.19,.104),rubber,.008)
    return a


def washer():
    a = make('laundry-machine',[26,49,54],'Stainless front-loader with rotating perforated drum, fascia, latch and seals.')
    a.box('Cabinet',(0,0,.548),(.89,.738,1.09),enamel,.019)
    a.box('Plinth',(0,-.027,.072),(.868,.713,.125),rubber,.009)
    a.box('Pressed face',(0,-.373,.483),(.851,.034,.754),steel,.012)
    a.box('Control escutcheon',(0,-.384,.973),(.838,.031,.153),dark,.009)
    a.mesh('Printed program symbols',[(-.389,-.402,.925),(.387,-.402,.925),(.387,-.402,1.018),(-.389,-.402,1.018)],
           [(0,1,2,3)],controls,uvs=[(0,0),(1,0),(1,1),(0,1)])
    z = .502
    a.tube('Door recess',[(0,-.39,z),(0,-.41,z)],.307,dark,48)
    a.ring('Rolled steel door bezel',(0,-.436,z),.275,.033,chrome,(0,1,0),48)
    a.ring('Dark rubber bellows',(0,-.422,z),.247,.023,rubber,(0,1,0),40)
    group = 'Drum'
    a.pivots[group] = (0,-.414,z)
    # The dished drum face and stamped holes have actual parallax behind the clear port.
    a.tube('Drawn drum face',[(0,-.408,z),(0,-.416,z)],.226,steel,40,group)
    for j,r in enumerate([.105,.156,.201]):
        for i in range(12+j*4):
            t = TAU*i/(12+j*4)+j*.20
            a.tube('Perforation',( (r*cos(t),-.416,z+r*sin(t)), (r*cos(t),-.420,z+r*sin(t)) ),.008,dark,6,group)
    for i in range(3):
        t = i*TAU/3
        a.tube('Pressed drum lifter',[(r*cos(t+d),-.423,z+r*sin(t+d)) for r,d in [(.07,0),(.14,.035),(.204,.12)]],.014,silver,8,group)
    a.tube('Clear inspection port',[(0,-.447,z),(0,-.454,z)],.235,glass,44)
    a.box('Door lever',(.291,-.454,z+.016),(.043,.04,.112),iron,.015)
    return a


def barber_pole():
    a = make('barber-pole',[13,15,73],'Wall-mounted chrome globe, clear sleeve and spiral painted rotor.')
    a.box('Wall plate',(0,.103,.47),(.12,.038,.80),iron,.019)
    for z in [.14,.77]:
        a.tube('Standoff',[(0,.13,z),(0,-.06,z)],.031,chrome,12)
    y = -.085
    a.turn('Lower spun cap',0,y,[(0,.031),(.036,.066),(.078,.118),(.117,.139),(.146,.122)],chrome,32)
    a.turn('Upper spun cap',0,y,[(.746,.121),(.77,.139),(.815,.128),(.85,.10),(.884,.057),(.895,.018)],chrome,32)
    a.pivots['Rotor'] = (0,y,.44)
    a.turn('Painted sleeve',0,y,[(.136,.095),(.753,.095)],cream,40,'Rotor')
    for base,mat in [(-.25,polish[0]),(-.133,motor),(-.018,polish[0]),(.100,motor),(.215,polish[0]),(.332,motor),(.445,polish[0]),(.563,motor),(.68,polish[0])]:
        rows=[]
        for i in range(49):
            t = i/48
            lo,hi = max(.139,base+t*.232),min(.748,base+.050+t*.232)
            if lo>=hi:
                continue
            theta=TAU*t
            rows.append([(.097*cos(theta),y+.097*sin(theta),z) for z in [lo,hi]])
        if len(rows)>1:
            a.surface('Spiral enamel stripe',rows,mat,'Rotor')
    a.turn('Protective glass tube',0,y,[(.145,.113),(.749,.113)],glass,40)
    return a


def manicure_set():
    a = make('manicure-tools',[23,27,53],'Articulated task lamp, padded hand rest, polish rack and brush cup.')
    a.turn('Task lamp foot',-.27,.07,[(0,.09),(.014,.095),(.027,.074),(.037,.028)],brass,24)
    path=[(-.27,.07,.036),(-.266,.07,.15),(-.24,.07,.30),(-.17,.07,.435),(-.09,.07,.476),(.048,.07,.482)]
    a.tube('Gooseneck',path,.009,chrome,10)
    a.box('Lamp reflector',(.065,.067,.479),(.162,.044,.022),steel,.009)
    a.box('Opal diffuser',(.067,.067,.469),(.14,.036,.006),opal,.002)
    a.box('Padded wrist rest',(-.015,-.09,.034),(.312,.103,.066),rose,.025)
    a.box('Polish tray',(.236,.060,.014),(.224,.15,.025),cream,.008)
    for j in range(2):
        for i in range(4):
            x,y = .16+i*.046,.025+j*.066
            a.turn('Nail lacquer',x,y,[(.027,.017),(.032,.020),(.078,.02),(.086,.012)],polish[(i+j)%4],12)
            a.turn('Screw cap',x,y,[(.083,.011),(.13,.012)],dark,12)
    a.turn('Brush cup',.365,.102,[(0,.035),(.079,.032)],chrome,16)
    for j in range(5):
        x,y=.365+.015*cos(j),.102+.014*sin(j)
        tip=(x+.03*cos(j),y+.034*sin(j),.178+.008*j)
        a.tube('Manicure brush',[(x,y,.052),tip],.003,wood,6)
        a.tube('Brush bristles',[tip,(tip[0]+.005*cos(j),tip[1]+.005*sin(j),tip[2]+.019)], [.004,.001],dark,6)
    return a



def nail_desk():
    a=make('nail-workstation',[23,27,53],'Rounded pink base, stone worktop, working-height drawer pedestal and chrome pulls.')
    for x in [-.56,.31]:
        a.box('Enamel pedestal',(x,0,.436),(.14 if x<0 else .42,.53,.858),rose,.035)
    a.box('Rounded writing surface',(0,0,.895),(1.31,.668,.074),cream,.034)
    for i in range(3):
        z=.235+i*.230
        a.box('Drawer face',(.31,-.272,z),(.377,.024,.215),rose,.010)
        a.tube('Drawer pull',[(.25,-.286,z+.057),(.25,-.309,z+.057),(.37,-.309,z+.057),(.37,-.286,z+.057)],.007,chrome,8)
    a.box('Rear apron',(0,.24,.79),(1.10,.045,.17),rose,.012)
    return a

def pastry_case():
    a = make('patisserie-case',[93,96,106,111],'Curved plate-glass case with walnut panels, trays, croissants, rolls and ring doughnuts.')
    a.box('Walnut cabinet',(0,0,.309),(2.10,.83,.60),wood,.025)
    a.box('Scuffed kick plate',(0,-.009,.050),(2.11,.85,.097),cast,.009)
    for x in [-.99,0,.99]:
        a.box('Raised panel stile',(x,-.422,.306),(.069,.033,.465),wood,.009)
    for z in [.122,.535,.593]:
        a.box('Raised panel rail',(0,-.428,z),(2.05,.039,.045),wood,.008)
    curve = [(-.412,.594),(-.417,.77),(-.408,.953),(-.378,1.096),(-.321,1.204),(-.222,1.286),(-.095,1.324),(.343,1.324)]
    a.surface('Bent display glazing',[[(x,y,z) for y,z in curve] for x in [-1.018,1.018]],glass)
    for x in [-1.025,1.025]:
        a.tube('Chromed end rim',[(x,y,z) for y,z in curve],.017,chrome,10)
        vs=[(x,y,z) for y,z in curve]+[(x,.343,.594)]
        a.mesh('End glass',vs,[tuple(range(len(vs)))],glass)
        a.tube('Rear upright',[(x,.343,.597),(x,.343,1.323)],.022,iron,10)
    for z in [.589,.86,1.091]:
        a.box('Display shelf',(0,-.012,z),(2.014,.64,.021),silver,.003)
    rng = random.Random(93)
    for shelf,z in enumerate([.605,.876,1.107]):
        for j,x in enumerate([-.734,-.242,.245,.727]):
            a.box('Baking tray',(x,-.024,z+.010),(.435,.438,.019),steel,.004)
            for k in range(4):
                px,py=x+(k%2-.5)*.193,-.025+(k//2-.5)*.195
                q=.86+rng.random()*.18
                if (j+shelf)%3==0:
                    a.ring('Yeasted ring', (px,py,z+.056),.047*q,.026*q,dough,steps=18)
                    a.ring('Glaze crown',(px,py,z+.071),.049*q,.017*q,glaze,steps=18)
                elif (j+shelf)%3==1:
                    arc=[(-.077,-.039,.019),(-.065,-.008,.032),(-.035,.014,.044),(0,.022,.048),(.036,.012,.043),(.063,-.011,.032),(.077,-.04,.018)]
                    a.tube('Folded croissant',[(px+dx*q,py+dy*q,z+.018+dz*q) for dx,dy,dz in arc],
                           [v*q for v in [.009,.024,.037,.039,.036,.025,.010]],dough,10)
                    for dx in [-.037,0,.037]:
                        a.tube('Toasted fold',[(px+dx-.007,py-.010,z+.075),(px+dx,py+.018,z+.099),(px+dx+.009,py+.043,z+.077)],.004,glaze,5)
                else:
                    a.turn('Brioche roll',px,py,[(z+.021,.043*q),(z+.038,.069*q),(z+.061,.064*q),(z+.083,.043*q),(z+.091,.010*q)],dough,14)
    return a


def grocery_cooler():
    a = make('grocery-cooler',[29,96,101],'Two-door refrigerated cabinet with sliding glass, lit shelf rails and individually stocked glass bottles.')
    a.box('Insulated back',(0,.375,1.04),(1.78,.11,2.08),cream,.018)
    for x in [-.85,.85]:
        a.box('Cabinet side',(x,0,1.04),(.08,.84,2.08),enamel,.017)
        a.box('Interior light',(x*.934,-.285,1.10),(.016,.019,1.65),opal,.003)
    a.box('Compressor housing',(0,0,.132),(1.77,.83,.264),steel,.012)
    a.box('Header',(0,0,2.012),(1.77,.83,.136),enamel,.014)
    for i in range(7):
        a.box('Air intake',(0,-.418,.048+i*.023),(1.55,.018,.009),dark,.002)
    for j,z in enumerate([.289,.62,.96,1.29,1.62]):
        a.box('Shelf liner',(0,-.004,z),(1.60,.596,.018),cream,.004)
        a.tube('Shelf retaining rail',[(-.79,-.303,z+.039),(.79,-.303,z+.039)],.009,chrome,6)
        for i in range(13):
            if (i+j*3)%11==7:
                continue
            x,y = -.738+i*.123,-.09+.045*((i+j)%2)
            h=.178+((i+j*2)%3)*.030
            a.turn('Beverage bottle',x,y,[(z+.012,.041),(z+.024,.048),(z+h*.69,.047),(z+h*.83,.029),(z+h,.018)],products[(i+j)%4],10)
            a.turn('Crimped bottle cap',x,y,[(z+h,.021),(z+h+.018,.020)],brass,10)
            a.turn('Paper product label',x,y,[(z+.05,.0486),(z+.118,.0486)],label,10)
    for z in [.259,1.956]:
        for y in [-.421,-.455]:
            a.box('Bypass track',(0,y,z),(1.66,.024,.019),steel,.003)
    for side in [-1,1]:
        name = 'LeftDoor' if side<0 else 'RightDoor'
        x=side*.407
        a.pivots[name]=(side*.817,-.427,.252)
        a.box('Clear cooler glazing',(x,-.418,1.104),(.771,.012,1.67),glass,group=name)
        for xx in [x-.399,x+.399]:
            a.box('Door stile',(xx,-.425,1.108),(.034,.041,1.71),iron,.005,name)
        for zz in [.27,1.948]:
            a.box('Door rail',(x,-.425,zz),(.82,.041,.033),iron,.005,name)
        u=x-side*.338
        a.tube('Cooler pull',[(u,-.431,.825),(u,-.453,.864),(u,-.453,1.357),(u,-.431,1.396)],.010,chrome,10,name)
        if side>0:
            for obj in a.collection.objects:
                if obj.get('assembly')==name:
                    for v in obj.data.vertices:
                        v.co.y-=.061
    return a


def pump():
    a = make('municipal-pump',[],'Foot-mounted end-suction pump, cooling fins, coupling guard and flanged discharge. Internal engineering is inferred.')
    a.box('Steel skid',(0,0,.070),(1.90,.78,.14),iron,.018)
    for x in [-.54,.56]:
        a.box('Bolted foot',(x,0,.184),(.42,.48,.23),motor,.015)
        for dx in [-.16,.16]:
            for y in [-.25,.25]:
                a.turn('Anchor nut',x+dx,y,[(.135,.03),(.163,.03)],brass,6)
    a.tube('Electric motor barrel',[(-.826,0,.504),(-.773,0,.504),(-.335,0,.504),(-.255,0,.504)],[.19,.249,.248,.17],motor,28)
    for i in range(22):
        ang=i*TAU/22
        a.tube('Cast cooling fin',[(-.75,.246*cos(ang),.504+.246*sin(ang)),(-.35,.243*cos(ang),.504+.243*sin(ang))],.016,motor,6)
    a.box('Junction box',(-.50,0,.790),(.283,.219,.119),motor,.012)
    a.tube('Drive coupling',[(-.265,0,.504),(.169,0,.504)],.090,chrome,20,'Coupling')
    a.pivots['Coupling']=(0,0,.504)
    for i in range(6):
        t=i*TAU/6
        a.tube('Coupling insert',[(-.13,.09*cos(t),.504+.09*sin(t)),(.033,.09*cos(t),.504+.09*sin(t))],.021,rubber,8,'Coupling')
    for x in [-.17,-.047,.080,.167]:
        pts=[(x,.143*cos(i*pi/16),.504+.143*sin(i*pi/16)) for i in range(17)]
        a.tube('Coupling guard rib',pts,.009,brass,6)
    for j in range(7):
        t=j*pi/6
        a.tube('Coupling guard stay',[(-.174,.148*cos(t),.504+.148*sin(t)),(.173,.148*cos(t),.504+.148*sin(t))],.007,brass,6)
    a.tube('Pump casing',[(.14,0,.50),(.24,0,.50),(.43,0,.50),(.56,0,.50),(.64,0,.50)],[.13,.25,.314,.269,.144],motor,32)
    a.tube('Suction pipe',[(.59,0,.504),(.86,0,.504)],.118,steel,20)
    a.tube('Suction flange',[(.846,0,.504),(.897,0,.504)],.183,motor,24)
    a.tube('Discharge neck',[(.42,-.145,.58),(.42,-.20,.70),(.42,-.20,.900)],.112,motor,20)
    a.turn('Discharge flange',.42,-.20,[(.873,.164),(.921,.164)],motor,24)
    for j in range(8):
        t=j*TAU/8
        a.turn('Flange stud',.42+.139*cos(t),-.20+.139*sin(t),[(.916,.014),(.935,.015)],brass,6)
        a.tube('Face bolt',[(.891,.152*cos(t),.504+.152*sin(t)),(.911,.152*cos(t),.504+.152*sin(t))],.018,brass,6)
    return a


def life_station():
    a = make('life-ring-station',[4,63,75,82],'Boardwalk life ring with four canvas bands, grab line, rope hooks and bolted timber post.')
    a.box('Salt-worn post',(0,.125,.704),(.108,.122,1.408),wood,.008)
    a.box('Cap rail',(0,.13,1.425),(.154,.164,.046),cast,.008)
    z=.904
    a.ring('Flotation ring',(0,-.018,z),.245,.067,canvas,(0,1,0),40)
    for j in range(4):
        theta=TAU*j/4+.30
        a.tube('White canvas band',[(.245*cos(theta+t),-.018,z+.245*sin(theta+t)) for t in [-.16,-.08,0,.08,.16]],.0689,white,12)
    for j in range(4):
        theta=TAU*j/4+.30
        pts=[]
        for i in range(11):
            f=i/10
            r=.30+.075*sin(pi*f)
            pts.append((r*cos(theta+f*pi/2),-.033-.018*sin(pi*f),z+r*sin(theta+f*pi/2)))
        a.tube('Perimeter grab line',pts,.010,white,7)
    for x in [-.13,.13]:
        a.tube('Cradle hook',[(x,.102,.70),(x,-.055,.69),(x,-.097,.724)],.018,steel,8)
    return a


def water_meter():
    a = make('service-meter',[10,17,22,84,108],'Exterior meter box with glass dial, service conduit, clamps and weather head.')
    a.box('Meter socket',(0,.019,.62),(.322,.18,.415),enamel,.016)
    a.tube('Round dial barrel',[(0,-.073,.641),(0,-.118,.641)],.113,steel,32)
    a.tube('Ivory register',[(0,-.121,.641),(0,-.126,.641)],.093,cream,32)
    for i in range(16):
        ang=i*TAU/16
        a.tube('Scale graduation',[(r*cos(ang),-.128,.641+r*sin(ang)) for r in [.069,.082]],.002,iron,5)
    a.tube('Meter pointer',[(0,-.13,.641),(.035,-.131,.691)],.004,iron,5)
    a.ring('Glass retaining ring',(0,-.133,.641),.093,.010,chrome,(0,1,0))
    a.tube('Meter cover',[(0,-.134,.641),(0,-.145,.641)],.089,glass,32)
    a.tube('Galvanised riser',[(.078,.03,.017),(.078,.03,.423)],.023,steel,12)
    a.tube('Weather head',[(-.074,.03,.818),(-.074,.03,1.147),(-.089,.016,1.182),(-.112,-.025,1.18)],.024,steel,12)
    for y in [.145,.357,.987]:
        a.box('Wall clamp',(.077 if y<.42 else -.074,.034,y),(.098,.055,.022),iron,.004)
    return a


def plane_tree(low=False):
    name='sycamore-distant' if low else 'avenue-sycamore'
    a=make(name,[14,18,34,92,112],'Forking avenue sycamore with a lightly pruned crown and separate alpha-cut leaf clusters.')
    rng=random.Random(34)
    a.tube('Trunk',[(0,0,0),(.045,-.028,.18),(-.04,.018,1.34),(-.075,.065,2.38),(.054,.113,3.26),(.21,.12,4.21)],[.233,.210,.159,.137,.094,.045],plane_bark,8 if low else 14)
    tips=[]
    for j in range(7):
        theta=j*2.40+rng.uniform(-.16,.16)
        e=Vector((cos(theta),sin(theta),0))
        lateral=Vector((-sin(theta),cos(theta),0))
        root=Vector((.045,.098,2.35+j*.184))
        fork=root+e*(.44+j*.065)+Vector((0,0,.96+j*.058))
        crown=fork+e*(.70+rng.random()*.40)+Vector((0,0,.73+rng.random()*.70))
        a.tube('Primary scaffold limb',[root,(root+fork)*.5+e*.09,fork,crown],[.115-j*.007,.08,.057,.019],plane_bark,6 if low else 9)
        for sign in [-1,1]:
            tip=crown+lateral*(sign*(.48+rng.random()*.46))+e*(.13+rng.random()*.42)+Vector((0,0,.42+rng.random()*.87))
            mid=crown*.51+tip*.49+e*.055
            if not low:
                a.tube('Forked limb',[fork,crown,mid,tip],[.042,.031,.020,.006],plane_bark,6)
            tips.append((mid,tip,e,lateral))
    vs,fs,uvs=[],[],[]
    # Small bent leaf sprays are distributed along branches. The open intervals reveal branch structure.
    for mid,tip,e,side in tips:
        for j in range(4 if low else 14):
            f=rng.uniform(-.5,1.32)
            c=mid.lerp(tip,f)+side*rng.uniform(-.61,.61)+e*rng.uniform(-.35,.38)+Vector((0,0,rng.uniform(-.30,.30)))
            theta=rng.random()*TAU
            wide=(1.48 if low else .79)*rng.uniform(.79,1.16)
            h=Vector((cos(theta),sin(theta),rng.uniform(-.27,.27)))*wide*.50
            v=Vector((-sin(theta)*.40,cos(theta)*.40,rng.uniform(.49,.93)))*wide*.64
            i=len(vs)
            vs.extend([c-h-v,c+h-v,c+h+v,c-h+v,c+e*.082])
            uvs.extend([(0,0),(1,0),(1,1),(0,1),(.5,.5)])
            fs.extend([(i,i+1,i+4),(i+1,i+2,i+4),(i+2,i+3,i+4),(i+3,i,i+4)])
    a.mesh('Leaf sprays',vs,fs,leaf,smooth=True,uvs=uvs)
    return a


def palm_tree(low=False):
    a=make('palm-distant' if low else 'coastal-date-palm',[5,8,37,82,92],'Scarred leaning trunk, persistent dry skirt and folded, tapered individual leaflets.')
    rng=random.Random(82)
    crown=Vector((.49,.13,8.49))
    def trunk(z):
        return (.49*(z/8.49)**1.62,.13*(z/8.49)**1.85,z)
    heights=[0,.10,.28,1.8,4.2,6.7,8.18,8.49]
    radii=[.249,.245,.218,.173,.152,.141,.164,.181]
    a.tube('Tall tapering bole',[trunk(z) for z in heights],radii,palm_bark,8 if low else 14)
    if not low:
        for i in range(39):
            z=.30+i*.207
            x,y,_=trunk(z)
            r=.14+.065*(1-z/8.52)**2
            a.turn('Leaf base scars',x,y,[(z-.021,r*.985),(z,r+.009),(z+.025,r*.991)],palm_bark,14)
    verts=[[] for _ in frond]
    faces=[[] for _ in frond]
    for k in range(19):
        age=k//7
        angle=k*2.39996+rng.uniform(-.12,.12)
        axis=Vector((cos(angle),sin(angle),0))
        side=Vector((-sin(angle),cos(angle),0))
        length=rng.uniform(2.00,2.68) if age<2 else rng.uniform(.7,1.28)
        rise=[1.87,1.02,.35][age]*rng.uniform(.8,1.12)
        fall=[1.83,2.21,2.34][age]*rng.uniform(.86,1.15)
        def at(t):
            return crown + axis*(length*t)+side*(.20*t*t)+Vector((0,0,rise*t*1.90-fall*t*t*1.65))
        if low:
            vs,fs,uvs=[],[],[]
            for i in range(8):
                t=i/7
                r=at(t)
                for j,u in enumerate([-.5,0,.5]):
                    vs.append(r+side*(u*(1.32 if age<2 else .66))+Vector((0,0,-abs(u)*.47)))
                    uvs.append((u+.5,t))
                if i:
                    k=3*i
                    fs.extend([(k-3,k-2,k+1,k),(k-2,k-1,k+2,k+1)])
            a.mesh('Curved frond spray',vs,fs,palm_card,smooth=True,uvs=uvs)
            continue
        n=15
        a.tube('Arched rachis',[at(i/n) for i in range(n+1)],[.038*(1-i/n)+.004 for i in range(n+1)],frond[age],5 if low else 7)
        n=12 if low else 31
        for j in range(n):
            t=.08+.89*j/n
            reach=(.13+.52*sin(pi*(t**.83))) * (1 if age<2 else .53)
            for sign in [-1,1]:
                r=at(t)
                tip=r+side*(sign*reach)+axis*(.26*(1-t)+.07)+Vector((0,0,-.16-.35*sin(pi*t)))
                mid=r.lerp(tip,.51)+Vector((0,0,.065))
                width=(.030 if low else .019)*(.30+sin(pi*t)*.70)
                i=len(verts[age])
                verts[age].extend([r-axis*width,r+axis*width,mid+axis*width,tip,mid-axis*width,mid+Vector((0,0,.012))])
                faces[age].extend([(i,i+1,i+5),(i+1,i+2,i+5),(i+2,i+3,i+5),(i+3,i+4,i+5),(i+4,i,i+5)])
    for j,m in enumerate(frond):
        if not verts[j]:
            continue
        a.mesh('Individually folded leaflets',verts[j],faces[j],m,smooth=True)
    return a


def book_cart():
    a=make('booksellers-table',[18,41,53,67,112],'Two-tier oak window table with jacketed books, page blocks and face-out paperback stands.')
    a.box('Table top',(0,0,.80),(1.58,.58,.055),wood,.011)
    a.box('Lower shelf',(0,0,.23),(1.50,.52,.034),wood,.006)
    for x in [-.698,.698]:
        for y in [-.222,.222]:
            a.box('Oak leg',(x,y,.395),(.069,.066,.79),wood,.006)
    covers=[material('Book jacket '+str(i),c,.75) for i,c in enumerate(['52604e','864b46','4a6473','a48362','d1bb91','4c4a42'])]
    for j in range(2):
        for i in range(10):
            x=-.669+i*.143;y=.104 if j else .058;z=.25 if j else .837
            h=.17+(i*7%5)*.011;d=.121 if j else .148
            for k in range(3 if j else 2):
                xx=x+k*.035
                mat=covers[(i+2*k+j)%len(covers)]
                a.box('Deckled leaves',(xx,y,z+h/2),(.024,d-.008,h-.005),cream,.0015)
                for dx in [-.014,.014]:
                    a.box('Book cover',(xx+dx,y,z+h/2),(.003,d,h),mat)
                a.box('Printed spine',(xx,y-d/2,z+h/2),(.031,.005,h),mat,.001)
                a.box('Spine title block',(xx,y-d/2-.003,z+h*.71),(.023,.002,.029),cream)
    for i,x in enumerate([-.52,-.16,.24,.59]):
        y=-.152;h=.21+.023*(i%2)
        a.box('Face-out paperback',(x,y,.834+h/2),(.154,.027,h),covers[(i+2)%6],.001)
        a.box('Display title',(x,y-.014,.835+h*.74),(.111,.002,.016),cream)
        a.box('Display illustration',(x,y-.015,.835+h*.45),(.115,.003,.066),covers[(i+4)%6])
        a.tube('Brass book rest',[(x-.078,y-.023,.827),(x-.076,y-.038,.851),(x+.078,y-.038,.851)],.005,brass,6)
    return a


def coffee_machine():
    a=make('espresso-machine',[11,25,96,99,111],'Twin-group espresso maker with steam wands, drip tray, gauge, cup rail and porcelain cups.')
    a.box('Machine plinth',(0,0,.078),(.72,.47,.141),rubber,.020)
    a.box('Enamel boiler case',(0,.081,.303),(.69,.286,.402),enamel,.044)
    a.box('Polished fascia',(0,-.062,.390),(.639,.043,.153),chrome,.012)
    for i in range(15):
        a.box('Drip tray bar',(-.288+i*.041,-.137,.157),(.017,.174,.009),chrome,.003)
    for x in [-.160,.148]:
        a.turn('Group head',x,-.093,[(.238,.041),(.253,.060),(.281,.053),(.317,.067),(.348,.065)],chrome,20)
        a.tube('Portafilter handle',[(x,-.106,.263),(x+.078,-.202,.253),(x+.106,-.238,.250)],[.012,.020,.021],dark,10)
        a.tube('Double spout',[(x-.023,-.099,.239),(x-.028,-.12,.227)],.007,chrome,7)
    for side in [-1,1]:
        x=side*.286
        a.tube('Steam wand',[(x,-.061,.352),(x+side*.027,-.107,.317),(x+side*.014,-.148,.181)],.008,chrome,8)
        a.tube('Steam knob',[(x,-.080,.406),(x,-.105,.406)],.028,dark,16)
    a.tube('Pressure gauge',[(0,-.088,.399),(0,-.093,.399)],.030,cream,20)
    a.tube('Gauge pointer',[(0,-.095,.4),(.012,-.095,.412)],.0018,iron,5)
    for x in [-.295,.295]:
        a.tube('Warming rail',[(x,-.041,.492),(x,-.041,.528),(x,.178,.528),(x,.178,.490)],.007,chrome,7)
    for x in [-.215,-.089,.039,.171]:
        a.turn('Stacked demitasse',x,.073,[(.501,.036),(.546,.029),(.555,.024),(.559,.032),(.602,.025)],cream,14)
    return a


def flower_box():
    a=make('florists-trug',[14,20,67,89,104],'Timber planting crate with individual stems, foliage and yellow or ochre flower heads.')
    a.box('Inner planter',(0,0,.258),(1.00,.47,.49),dark,.012)
    for z in [.084,.224,.369,.473]:
        for side in [-1,1]:
            a.box('Slatted crate side',(0,side*.242,z),(1.038,.026,.097),wood,.006)
            a.box('Crate end',(side*.508,0,z),(.031,.478,.097),wood,.005)
    rng=random.Random(67)
    petals=[material('Marigold yellow','d6a12d',.81,two_sided=True),material('Marigold ochre','ba6b26',.83,two_sided=True)]
    for i in range(36):
        x,y=rng.uniform(-.466,.466),rng.uniform(-.197,.197);h=rng.uniform(.58,.78)
        dx,dy=rng.uniform(-.05,.05),rng.uniform(-.045,.045)
        a.tube('Flower stem',[(x,y,.444),(x+dx*.5,y+dy*.4,h-.10),(x+dx,y+dy,h)],.0034,frond[1],5)
        for side in [-1,1]:
            a.mesh('Leaf',[(x,y,h-.14),(x+.038*side,y-.012,h-.11),(x+.072*side,y+.016,h-.071),(x+.033*side,y+.024,h-.105)],[(0,1,2,3)],frond[1])
        x+=dx;y+=dy
        for k in range(6):
            th=k*TAU/6
            vs=[(x,y,h-.011),(x+.018*cos(th-.4),y+.018*sin(th-.4),h+.007),(x+.029*cos(th),y+.029*sin(th),h+.016),(x+.018*cos(th+.4),y+.018*sin(th+.4),h+.011)]
            a.mesh('Marigold petal',vs,[(0,1,2,3)],petals[(i//5)%2])
    return a


def main():
    for builder in [street_lantern,litter_bin,air_conditioner,roof_fan,washer,barber_pole,manicure_set,nail_desk,pastry_case,
                    grocery_cooler,pump,life_station,water_meter,book_cart,coffee_machine,flower_box,plane_tree,palm_tree]:
        builder()
    plane_tree(True)
    palm_tree(True)
    publish(assets,{a.name for a in assets})
    manifest=[]
    for a in assets:
        manifest.append({'id':a.name,'sourceImages':a.refs,'description':a.description,'parts':len(a.collection.objects),
                         'movableParts':list(a.pivots)[1:],'runtimeBytes':(OUT/(a.name+'.glb')).stat().st_size})
    (SOURCE/'City object library.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__=='__main__':
    main()
