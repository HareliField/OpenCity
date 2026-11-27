"""Editable hardware stock, sheet-metal roof plant and shop furniture from the supplied photographs."""
import json
import random
import sys
from math import cos, pi, sin
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
from city_modeling import Asset, OUT, SOURCE, TAU, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
metal=material('Galvanised steel','929995',.58,.52,finish='enamel')
edge=material('Zinc folded edges','a5aaa3',.49,.68)
black=material('Iron foot and gasket','3e4140',.77,.52)
tar=material('Bituminous flashing','4d4c46',.91)
wood=material('Sawn pallet wood','846747',.85,finish='joinery')
blue=material('Industrial blue finish','495f64',.63,.39)
card=material('Kraft cardboard','ab9270',.95)
paper=material('Parts label','b9ad92',.87)
paint=[material(n,c,.61,.26) for n,c in [('Biscuit paint','ae9974'),('Green utility enamel','65745c'),('Marine enamel','697e87')]]
lens=material('Wire glass roof light','a1b2b4',.31,.21,alpha=.77,two_sided=True)
wicker=material('Oatmeal linen from the salon','b8afa1',.95,finish='salon-upholstery')
stitch=material('Upholstery piping','a9a18f',.94)
leaf=material('Waxy blue-green leaves','586b4b',.52,two_sided=True)
vein=material('Banana leaf midrib','87906a',.56)
orange=material('Orange sepals','de8431',.55,two_sided=True)
purple=material('Blue corolla','555493',.49,two_sided=True)
soil=material('Dark potting soil','403a2d',.98)
assets=[]


def asset(name,refs,desc):
    a=Asset(name,refs,desc);assets.append(a);return a


def roof_vent():
    a=asset('galvanized-roof-vent',[24,38,59,83,104],'Riveted square upstand, pitch pocket and four-sided gravity exhaust hood.')
    a.box('Tar pocket',(0,0,.027),(.90,.84,.054),tar,.026)
    a.box('Flashing flange',(0,0,.048),(.83,.79,.026),metal,.019)
    a.box('Sheet-metal curb',(0,0,.216),(.63,.59,.329),metal,.012)
    for y in [-.255,.255]:
        for x in [-.29,.29]:a.box('Hood riser',(x,y,.42),(.037,.037,.24),edge,.006)
        for z in [.365,.417,.466]:a.box('Louver blade',(0,y,z),(.56,.054,.015),black,.004)
    a.box('Apron hem',(0,0,.488),(.83,.76,.063),edge,.011)
    vs=[(-.415,-.38,.509),(.415,-.38,.509),(.415,.38,.509),(-.415,.38,.509),
        (-.277,-.23,.653),(.277,-.23,.653),(.277,.23,.653),(-.277,.23,.653)]
    a.mesh('Pitched folded cap',vs,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],metal)
    for i in range(4):a.tube('Folded hip seam',[vs[i],vs[i+4]],.008,edge,7)
    for x in [-.31,-.18,0,.18,.31]:
        for y in [-.36,.36]:a.turn('Roofing screw',x,y,[(.061,.014),(.073,.011)],black,6)
    return a


def skylight():
    a=asset('factory-skylight',[38,59,103],'Ribbed prism glass, inclined glazing and a double-seamed galvanised roof curb.')
    a.box('Roof flashing',(0,0,.035),(1.64,1.15,.07),tar,.025)
    a.box('Standing curb',(0,0,.135),(1.45,.94,.20),metal,.012)
    low,high=.237,.345
    for i in range(2):
        x0=-.672+i*.678;x1=x0+.644
        a.mesh('Wired glazing',[(x0,-.414,low),(x1,-.414,low),(x1,.414,high),(x0,.414,high)],[(0,1,2,3)],lens)
        for j in range(11):
            x=x0+.041+j*.054
            a.tube('Rolled glass bead',[(x,-.409,low+.006),(x,.409,high+.006)],.003,edge,5)
    for x in [-.713,0,.713]:a.tube('Gasket and mullion',[(x,-.458,low),(x,.458,high)],.022,edge,7)
    for y,h in [(-.456,low),(.456,high)]:a.box('End cap',(0,y,h),(1.48,.069,.055),metal,.01)
    for x in [-.714,.714]:
        a.mesh('Glazing skirt',[(x,-.45,.207),(x,.45,.207),(x,.45,high),(x,-.45,low)],[(0,1,2,3) if x<0 else (3,2,1,0)],metal)
    return a


def pallet():
    a=asset('cargo-pallet',[38,59,109],'Euro-size stringer pallet, bearing blocks, deck boards and inset nail heads.')
    for x in [-.465,0,.465]:
        a.box('Bottom runner',(x,0,.018),(.15,.80,.036),wood,.007)
        for y in [-.318,0,.318]:a.box('Bearing block',(x,y,.067),(.149,.132,.065),wood,.005)
    for y in [-.312,0,.312]:a.box('Cross bearer',(0,y,.107),(1.20,.16,.025),wood,.005)
    for i in range(7):
        x=-.518+i*.173;a.box('Worn deck slat',(x,0,.132),(.15,.80,.026),wood,.005)
        for y in [-.32,.32]:
            for xx in [x-.038,x+.038]:a.turn('Nail head',xx,y,[(.144,.005),(.146,.004)],black,6)
    return a


def drum():
    a=asset('quay-drum',[38,109],'Ribbed closed-head galvanised steel drum with rolled chimes and threaded plugs.')
    profile=[(0,.274),(.011,.299),(.032,.294),(.062,.282),(.117,.280),(.264,.282),(.282,.299),(.297,.302),
             (.312,.283),(.533,.282),(.551,.301),(.567,.302),(.58,.282),(.827,.280),(.853,.292),(.865,.297),(.875,.283)]
    a.turn('Rolled drum body',0,0,profile,metal,36)
    a.ring('Scuffed top chime',(0,0,.874),.284,.009,edge,steps=40)
    for x,y,r in [(.155,.132,.047),(-.172,-.096,.027)]:
        a.turn('Recessed bung well',x,y,[(.874,r+.011),(.882,r+.007),(.884,r)],black,18)
        a.turn('Threaded cap',x,y,[(.882,r),(.894,r*.90)],edge,8)
        a.box('Raised turn bar',(x,y,.898),(r*1.39,.012,.012),metal,.003)
    return a


def hardware_rack():
    a=asset('hardware-stock-rack',[38,66,96,109],'Warehouse shelf bays with paint pails, cartons, folded-steel brackets and conduit.')
    for x in [-1.17,1.17]:
        for y in [-.287,.287]:
            a.box('Angle upright',(x,y,1.015),(.043,.043,2.03),blue,.005)
            for j in range(13):a.box('Adjustment slot',(x,y-.023,.19+j*.129),(.013,.004,.033),black)
            a.box('Welded foot',(x,y,.028),(.11,.10,.056),black,.005)
    for h in [.18,.72,1.27,1.82]:
        a.box('Galvanized rack shelf',(0,0,h),(2.34,.59,.049),metal,.008)
        a.box('Folded shelf nose',(0,-.291,h-.018),(2.37,.044,.052),blue,.004)
    rng=random.Random(38)
    for row,h in enumerate([.205,.745,1.295]):
        for j in range(5):
            x=-.89+j*.444
            if row!=1 and j%3!=2:
                rad=.131 if row==0 else .104;high=.251 if row==0 else .192
                a.turn('Paint pail',x,-.09,[(h,rad*.91),(h+.016,rad),(h+high-.015,rad),(h+high,rad+.003)],paint[(j+row)%3],20)
                a.ring('Lid rim',(x,-.09,h+high),rad,.007,edge,steps=24)
                arc=[(x+rad*cos(pi*k/12),-.09,h+high*.59+.088*sin(pi*k/12)) for k in range(13)]
                a.tube('Wire bail',arc,.005,edge,6)
            else:
                height=rng.uniform(.185,.33);a.box('Fastener carton',(x,-.015,h+height/2),(.34,.31,height),card,.010)
                a.box('Gummed seam',(x,-.015,h+height+.002),(.036,.315,.005),paper)
                a.box('Stock label',(x,-.173,h+height*.61),(.165,.004,.062),paper)
    for j in range(7):
        z=1.89+(j//4)*.052;y=-.16+(j%4)*.095
        a.tube('Bundled conduit',[(-.91,y,z),(.88,y,z)],.025,edge,12)
    return a


def salon_chair():
    a=asset('linen-salon-chair',[23,49],'Curved oatmeal upholstery, rolled seams and four tapered walnut legs.')
    for x in [-.216,.216]:
        for y in [-.181,.181]:
            a.tube('Tapered walnut leg',[(x*1.22,y*1.24,.012),(x,y,.399)],[.018,.032],wood,12)
    # The seat crown and curled back are radial profiles, softly rolled around their edges.
    rows=[]
    for z,rad in [(.335,.83),(.348,.95),(.376,1),(.422,1),(.446,.94),(.451,.75),(.453,.018)]:
        rows.append([(.313*rad*cos(k*TAU/32),.266*rad*sin(k*TAU/32),z) for k in range(33)])
    a.surface('Crowned seat cushion',rows,wicker)
    shape=lambda t,r,z:(r*.354*cos(t),r*.29*sin(t)+.019,z)
    ts=[-.02*pi+1.04*pi*k/28 for k in range(29)]
    def shoulder(t):return .59+.245*(sin(t)**2)
    rows=[]
    for r,low,top in [(1,.376,False),(1.028,.425,False),(1.03,-.026,True),(.994,.0,True),(.925,-.023,True),(.915,.431,False)]:
        rows.append([shape(t,r,shoulder(t)+low if top else low) for t in ts])
    a.surface('Wraparound upholstered arms and back',rows,wicker)
    for end in [0,-1]:
        pts=[row[end] for row in rows];a.mesh('Closed upholstered arm end',pts,[tuple(range(len(pts))) if end==0 else tuple(reversed(range(len(pts))))],wicker)
    a.tube('Hand sewn upper seam',[shape(t,1.005,shoulder(t)-.008) for t in ts],.0055,stitch,6)
    return a


def strelitzia():
    a=asset('strelitzia-planter',[25,29,101],'Bird of paradise with broad split leaves, two flowering spathes and a glazed planter.')
    a.turn('Terracotta planter',0,0,[(0,.129),(.02,.140),(.242,.188),(.26,.199),(.289,.196),(.30,.185)],paint[1],32)
    a.turn('Compost',0,0,[(.283,.174),(.287,.173)],soil,24)
    rng=random.Random(25)
    for i in range(11):
        t=i*2.399+rng.uniform(-.19,.19);axis=Vector((cos(t),sin(t),0));side=Vector((-sin(t),cos(t),0))
        z=.38+rng.random()*.45;reach=.22+rng.random()*.20;mid=axis*.068+Vector((0,0,z));tip=mid+axis*reach+Vector((0,0,.24+rng.random()*.45))
        a.tube('Petiole',[(0,0,.276),mid],[.015,.009],vein,7)
        rows=[]
        for j in range(13):
            u=j/12;ctr=mid.lerp(tip,u)+Vector((0,0,.089*sin(pi*u)))
            w=(.105+.03*rng.random())*sin(pi*(u**.84));skew=.065*sin(pi*u)
            rows.append([ctr-side*w+axis*skew-Vector((0,0,w*.27)),ctr,ctr+side*w+axis*(skew*.8)-Vector((0,0,w*.25))])
        a.surface('Broad ribbed leaf',rows,leaf)
        a.tube('Leaf midrib',[q[1] for q in rows],.004,vein,6)
    for sign,h in [(-1,1.02),(1,1.29)]:
        pt=Vector((.11*sign,.043,h));a.tube('Flower stalk',[(0,0,.277),(.067*sign,.020,.82),pt],[.012,.011,.008],vein,8)
        a.tube('Boat-shaped spathe',[pt+Vector((-.040,0,-.028)),pt,pt+Vector((.116,0,.009)),pt+Vector((.210,0,.04))],[.005,.029,.018,.002],leaf,9)
        for k in range(7):
            dx=.045+k*.016;sy=(-1)**k*.012;start=pt+Vector((k*.013,0,.01))
            q=[start,start+Vector((dx*.30,sy,.078)),start+Vector((dx,sy*.8,.153+.016*(k%3))),start+Vector((dx*.50,sy-.014,.083))]
            a.mesh('Sepal or purple corolla',q,[(0,1,2,3)],orange if k<5 else purple)
    return a


def coat_rail():
    a=asset('coat-rail',[89,107],'Steel sales rail with wooden hangers, lined wool and suede jackets, and folded stock.')
    cloth=[material(name,tint,.96,image=f'coat-weave-{i}.jpg') for i,(name,tint) in enumerate([
        ('Charcoal worsted','59575a'),('Brown wool','785f4f'),('Twill navy','475164'),
        ('Peat suede','917352'),('Heather-grey wool','77756d'),('Indigo denim','566675')])]
    for x in [-.787,.787]:
        for y in [-.235,.235]:
            a.box('Foot plug',(x,y,.018),(.055,.053,.035),black,.008)
            a.tube('Blackened steel upright',[(x,y,.033),(x,y,2.064)],.015,black,9)
        for h in [.095,.19,2.036]:a.tube('Upper and lower end rail',[(x,-.248,h),(x,.248,h)],.015,black,9)
        a.tube('Clothes bar bracket',[(x,-.235,1.889),(x,.235,1.889)],.014,black,9)
    for z,y in [(1.885,0),(.091,-.236),(.091,.236),(.187,-.202),(.187,.202)]:
        a.tube('Long tubular rail',[(-.801,y,z),(.801,y,z)],.015,metal if z>1 else black,12)
    a.box('Hardwood display ledge',(0,0,2.073),(1.65,.53,.052),wood,.009)
    rng=random.Random(89)
    for j in range(12):
        x=-.693+j*.126+rng.uniform(-.006,.006)
        hem=.64+rng.uniform(0,.22);mat=cloth[[0,0,1,3,4,0,5,2,1,3,1,4][j]]
        phase=rng.uniform(0,TAU);thick=rng.uniform(.041,.054)
        rows=[]
        for z,w,k in [(hem,.205,.83),(hem+.034,.206,.88),(hem+.32,.214,1.0),
                      (1.48,.228,1.02),(1.57,.244,.95),(1.68,.214,.91),(1.746,.112,.61),(1.766,.074,.43)]:
            ring=[]
            for n in range(29):
                t=TAU*n/28
                fold=.006*cos(6*t+phase)+.004*sin(9*t+z)
                dx=(thick*k+fold)*cos(t)
                y=w*sin(t)+.012*cos(2*t+phase)
                ring.append((x+dx,y,z+.008*sin(5*t+phase)*(z<1.0)))
            rows.append(ring)
        a.surface('Draped jacket front and back',rows,mat)
        for side in [-1,1]:
            a.tube('Tailored sleeve',[(x,side*.192,1.655),(x+.006,side*.226,1.54),
                (x+.015,side*.236,1.35),(x+.018,side*.239,1.08),(x+.029,side*.214,.96)],
                [.047,.064,.050,.043,.042],mat,12)
            a.tube('Turned lapel',[(x+.039,side*.104,1.716),(x+.058,side*.136,1.612),
                                   (x+.063,side*.091,1.56),(x+.058,side*.031,1.40)],[.016,.029,.021,.008],mat,7)
            a.tube('Hanger shoulder',[(x,0,1.777),(x,side*.105,1.745),(x,side*.225,1.671)],
                   [.017,.022,.014],wood,8)
        a.tube('Hook',[(x,0,1.77),(x,0,1.828),(x,-.020,1.856),(x,-.019,1.885),
                    (x,0,1.909),(x,.021,1.897),(x,.023,1.88)],.0048,edge,7)
        for h in [1.139,1.27,1.40]:a.box('Horn button',(x+thick+.008,-.023,h),(.011,.019,.020),black,.004)
    for j in range(3):
        for k in range(2+j%2):
            h=2.123+k*.041
            a.box('Folded shirt',(-.04+j*.252+.012*sin(k+j),.025,h),(.215,.335,.048),cloth[(j+k+2)%6],.019)
    a.box('Inventory box',(-.382,.062,2.143),(.257,.29,.087),blue,.012)
    a.box('Fitted lid',(-.382,.062,2.192),(.268,.301,.020),blue,.006)
    return a


def delivery_truck():
    from delivery_body import build_truck
    return build_truck(asset)


if __name__=='__main__':
    for fn in [roof_vent,skylight,pallet,drum,hardware_rack,salon_chair,strelitzia,coat_rail,delivery_truck]:fn()
    publish(assets,{a.name for a in assets},'District fittings')
    (SOURCE/'District fittings.json').write_text(json.dumps([
        {'id':a.name,'sourceImages':a.refs,'description':a.description,'parts':len(a.collection.objects),
         'movableParts':list(a.pivots)[1:],'runtimeBytes':(OUT/(a.name+'.glb')).stat().st_size} for a in assets],indent=2)+'\n')
