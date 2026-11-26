"""Build the metric joinery, clay, timber and iron fittings used inside the streamed city."""
from math import cos, sin, pi
import json
import bpy
from city_modeling import Asset, OUT, SOURCE, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
wood = material('Oiled timber', '876645', .70, finish='joinery')
cream = material('Linen and cotton', 'e3d9c5', .93)
fabric = material('Washed blue linen', '687d85', .96, image='coat-weave-1.jpg')
grey = material('Glazed porcelain', 'd0ccc1', .36)
steel = material('Brushed nickel', 'b0ae9e', .38, .72)
dark = material('Enamelled iron', '373e3b', .66, .36)
iron = material('Waterworks casting', '66635c', .78, .44, finish='cast-iron')
clay = material('Fired terracotta', 'ab7358', .93)
weathered = material('Pier timber grain', '867969', .87, finish='joinery')
paper = material('Cream drawing stock', 'ded6c6', .95)
blue = material('Drafting traces', '657988', .82)
green = material('Painted sage cabinets', '88958a', .79)
assets=[]
def asset(name,refs,desc):
    a=Asset(name,refs,desc)
    assets.append(a)
    return a

def mattress():
    a=asset('apartment-bed',[10,17,18,89],'Laminated timber bedstead, sprung mattress, quilted linen, welted pillows and turned feet.')
    for x in (-.62,.62):
        for y in (-.86,.86):
            a.turn('Turned oak foot',x,y,[(.0,.044),(.039,.048),(.097,.039),(.209,.057)],wood,12)
        a.box('Bed rail',(x,0,.235),(.073,1.96,.139),wood,.009)
    for y in (-.941,.937):
        a.box('End rail',(0,y,.234),(1.22,.065,.145),wood,.010)
    for k in range(11):
        a.box('Bent slat',(0,-.84+k*.165,.257),(1.31,.074,.023),wood,.006)
    a.box('Headboard panel',(0,.954,.512),(1.38,.060,.664),wood,.035)
    a.box('Mattress core',(0,-.024,.382),(1.319,1.859,.239),cream,.069)
    for z in (.286,.475):
        ring=[(-.575,-.914,z),(.563,-.914,z),(.645,-.827,z),(.645,.806,z),(.56,.89,z),
              (-.56,.89,z),(-.645,.809,z),(-.645,-.835,z),(-.575,-.914,z)]
        a.tube('Sewn mattress welt',ring,.007,cream,8)
    rows=[]
    for j in range(15):
        y=-.927+j*1.28/14;row=[]
        for i in range(21):
            x=-.672+i*1.344/20
            fold=.015*sin(21*x+2.8*y)+.007*sin(37*x-7*y)
            edge=max(0,(abs(x)-.553)/.119)
            row.append((x,y,.507+fold*(.45+edge)-.143*edge**1.65))
        rows.append(row)
    a.surface('Draped woven cover',rows,fabric)
    for x in (-.315,.315):
        rows=[]
        for j in range(11):
            y=.388+j*.411/10;row=[]
            for i in range(13):
                u=i/12;v=j/10;px=x+(u-.5)*.56
                loft=.093*max(0,sin(pi*u)*sin(pi*v))**.64
                row.append((px,y,.51+loft+.007*cos(7*u+2*v)))
            rows.append(row)
        a.surface('Filled linen pillow',rows,cream)
        a.box('Pillow edge',(x,.593,.50),(.55,.401,.034),cream,.016)
    return a

def drawing_desk():
    a=asset('studio-drafting-desk',[16,21,30,57,70],'A municipal drawing desk with trestles, plan rolls, lamp, set square and pencil tray.')
    for x in (-.54,.54):
        for y in (-.25,.25):
            a.tube('Splayed trestle leg',[(x,y*1.24,.022),(x,y*.60,.706)],.025,dark,10)
        a.tube('Trestle stretcher',[(x,-.26,.26),(x,.26,.26)],.016,dark,9)
    a.box('Timber drawing surface',(0,0,.731),(1.34,.71,.054),wood,.012)
    a.box('Pinned plan sheet',(-.12,-.025,.760),(.743,.493,.004),paper,.001)
    for ix in range(5):
        for iy in range(3):
            x=-.424+ix*.131;y=-.168+iy*.119
            a.box('Plan block',(x,y,.764),(.081 if iy==1 else .096,.064,.0014),blue)
    for k in range(3):
        y=.20+k*.039
        a.tube('Rolled drawings',[(-.39,y,.788+k*.007),(.24,y,.788+k*.007)],.024,paper,12)
    a.turn('Lamp foot',.488,.202,[(.761,.082),(.777,.082),(.788,.061)],steel,20)
    a.tube('Anglepoise arm',[(.488,.202,.788),(.506,.199,.966),(.352,.168,1.111)],.014,dark,10)
    a.turn('Lamp shade',.352,.168,[(1.061,.076),(1.096,.061),(1.132,.026)],green,22)
    a.turn('Bulb diffuser',.352,.168,[(1.054,.064),(1.065,.071)],cream,16)
    a.box('Brush tray',(.442,-.206,.782),(.193,.071,.040),dark,.006)
    for i in range(4):
        a.tube('Pencil',[(.366,-.22+i*.011,.807),(.512,-.214+i*.011,.808)],.003,wood,7)
    return a

def galley():
    a=asset('apartment-galley',[18,25,41,89,111],'Two kitchen cabinets, rolled-rim sink, bridge tap, drain, electric hob and tiled splashback.')
    w=1.55
    a.box('Recessed plinth',(0,.014,.052),(w-.12,.507,.105),dark,.012)
    a.box('Plywood carcass',(0,0,.499),(w,.557,.789),wood,.009)
    for x in (-.567,-.183,.201,.576):
        a.box('Drawer front',(x,-.283,.762),(.362,.027,.197),green,.006)
        a.box('Door frame',(x,-.283,.403),(.362,.028,.502),green,.006)
        a.box('Raised cabinet field',(x,-.303,.403),(.270,.015,.411),green,.004)
        a.tube('Cabinet pull',[(x-.061,-.299,.769),(x-.061,-.329,.769),
                               (x+.061,-.329,.769),(x+.061,-.299,.769)],.007,steel,8)
    # Separate countertop pieces meet a genuinely concave sink bowl.
    x0,x1,y0,y1=-.649,-.109,-.190,.184
    for l,r,b,t in [(-.799,x0,-.303,.302),(x1,.799,-.303,.302),(x0,x1,-.303,y0),(x0,x1,y1,.302)]:
        a.box('Counter edge',((l+r)/2,(b+t)/2,.913),(r-l,t-b,.040),grey,.005)
    cx,cy=(x0+x1)/2,(y0+y1)/2
    rings=[]
    for z,w,d in [(.936,.276,.195),(.924,.258,.175),(.889,.241,.159),(.786,.199,.119),(.766,.120,.073),(.756,.027,.024)]:
        ring=[]
        for i in range(33):
            angle=i*2*pi/32
            def rounded(v):return (1 if v>=0 else -1)*abs(v)**.43
            ring.append((cx+w*rounded(cos(angle)),cy+d*rounded(sin(angle)),z))
        rings.append(ring)
    a.surface('Pressed stainless bowl',rings,steel)
    a.turn('Sink waste strainer',cx,cy,[(.754,.026),(.758,.027)],dark,18)
    a.tube('Curved spout',[(cx,.228,.932),(cx,.231,1.076),(cx,.190,1.119),
                           (cx,.093,1.118),(cx,.073,1.082)],.012,steel,14)
    for s in (-1,1):
        x=cx+s*.091;a.turn('Tap bonnet',x,.226,[(.933,.022),(.965,.016)],steel,14)
        a.tube('Tap lever',[(x,.226,.967),(x+s*.038,.229,.980)],.005,steel,8)
    a.box('Hob plate',(.390,-.013,.941),(.584,.481,.012),dark,.005)
    for x in (.245,.538):
        for y in (-.145,.104):
            for rad in (.040,.060,.081):
                a.ring('Heating coil',(x,y,.952),rad,.0025,steel,(0,0,1),22)
    for i in range(9):
        for j in range(2):
            a.box('Glazed wall tile',(-.700+i*.176,.277,1.023+j*.170),(.171,.014,.166),grey,.002)
    return a

def clay_units():
    a=asset('bond-brick',[14,18,34,41,67,80,95,104,112],'Weathered facing stretcher with irregular arrises and a recessed mortar bed.')
    a.box('Fired stretcher',(0,0,.0315),(.205,.094,.063),clay,.0028)
    a=asset('mission-pantile',[1,10,17,46,84],'Overlapping clay pan and cap in the hipped eaves of Marina Coffee.')
    profile=[(-.125,.025),(-.111,.015),(-.070,.004),(-.020,.011),(.003,.030),
             (.016,.067),(.038,.089),(.062,.097),(.084,.089),(.105,.064),(.125,.025)]
    rows=[]
    for j in range(7):
        y=-.196+j*.392/6
        rows.append([(x*(1-.065*j/6),y,z+.007*j/6) for x,z in profile])
    a.surface('Curved top',rows,clay)
    under=[[(x,y,z-.014) for x,y,z in row] for row in rows]
    a.surface('Underside',under[::-1],clay)
    for k in (0,-1):
        a.surface('Cut clay edge',[rows[k],under[k]],clay, smooth=False)

def street_units():
    a=asset('municipal-cover',[1,9,14,38,59],'Cast-iron frame and cover, cast diamonds, lifting sockets and anchor lugs.')
    a.turn('Sanded-in outer frame',0,0,[(0,.412),(.051,.412),(.064,.388),(.065,.375)],iron,48)
    a.turn('Cast cover',0,0,[(.048,.363),(.063,.364),(.069,.355)],iron,48)
    a.ring('Turned bearing rim',(0,0,.069),.338,.005,steel,(0,0,1),48)
    for i in range(-5,6):
        for j in range(-6,7):
            x=i*.056+(j%2)*.028;y=j*.043
            if x*x+y*y>.290**2 or abs(y)<.042:continue
            a.tube('Raised diamond tread',[(x-.018,y-.007,.069),(x,y+.007,.072),(x+.018,y-.007,.069)],.0038,iron,6)
    for x in (-.268,.268):
        a.box('Recessed lifting socket',(x,0,.069),(.020,.055,.003),dark,.001)
        for dx in (-.014,.014):a.box('Socket rim',(x+dx,0,.071),(.005,.062,.006),iron,.001)
    for x in (-.25,.25):
        for y in (-.235,.235):a.turn('Frame anchor',x,y,[(.062,.011),(.069,.010)],steel,6)
    a=asset('pier-board',[5,61,63,64,75,82],'Individual eased pier plank with four countersunk carriage screws at the joists.')
    a.box('Treated deck plank',(0,0,.036),(2.70,.151,.072),weathered,.0028)
    for x in (-1.25,1.25):
        for y in (-.042,.042):
            a.turn('Screw head',x,y,[(.071,.0062),(.0723,.006)],iron,10)
            a.box('Driver slot',(x,y,.0724),(.006,.001,.0004),dark)
    return a

if __name__=='__main__':
    mattress();drawing_desk();galley();clay_units();street_units()
    publish(assets,{a.name for a in assets},'Building and paving components')
    rows=[dict(id=a.name,sourceImages=a.refs,description=a.description,parts=len(a.collection.objects),
               movableParts=list(a.pivots)[1:],runtimeBytes=(OUT/(a.name+'.glb')).stat().st_size) for a in assets]
    (SOURCE/'Building and paving components.json').write_text(json.dumps(rows,indent=2)+'\n')

