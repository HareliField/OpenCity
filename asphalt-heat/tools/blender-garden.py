"""Build the editable cottage joinery, tile edges and street fittings from photographs 010 and 017."""
import json
import sys
from math import cos,pi,sin
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from city_modeling import Asset,OUT,SOURCE,TAU,material,publish
bpy.ops.wm.read_factory_settings(use_empty=True)
cream=material('Old ivory joinery','d4ccae',.80)
grey=material('Weathered zinc','909792',.52,.55)
iron=material('Dark security grille','464a45',.70,.47)
wood=material('Weathered crossarm','827356',.86)
porcelain=material('Porcelain insulator','a8a69a',.38)
glass=material('Residential sash glazing','7e9899',.18,.18,alpha=.32,two_sided=True)
cloth=material('Linen curtains','b9b3a1',.96)
earth=[material('Fired terracotta '+str(i),c,.86) for i,c in enumerate(['a57251','96654a','8a5941','996447'])]
lamp=material('Pearl roadway lens','c8c7ac',.26,.13)
assets=[]

def asset(name,ref,desc):
    a=Asset(name,ref,desc);assets.append(a);return a

def sash():
    a=asset('garden-sash',[10,17,84],'Timber sash with inset glass, six narrow steel grille bars and folded linen side curtains.')
    for x in [-.67,.67]:a.box('Painted jamb',(x,0,.59),(.075,.162,1.18),cream,.011)
    for z in [.043,1.139]:a.box('Outer sill or head',(0,0,z),(1.397,.175,.086),cream,.009)
    for x in [-.31,.308]:
        a.box('Single glazed pane',(x,.012,.59),(.601,.014,.99),glass)
    for x in [-.616,-.018,.615]:a.box('Sash stile',(x,.018,.589),(.036,.044,1.014),grey,.004)
    for z in [.088,.538,1.086]:a.box('Putty glazing rail',(0,.018,z),(1.238,.046,.028),grey,.003)
    for j in range(7):
        x=-.513+j*.171
        a.tube('Forged window bar',[(x,-.104,.09),(x,-.104,1.085)],.007,iron,7)
    for z in [.241,.871]:a.tube('Horizontal stay',[(-.604,-.105,z),(.604,-.105,z)],.009,iron,8)
    for side in [-1,1]:
        rows=[]
        for z,w in [(.143,.108),(.593,.099),(1.045,.189)]:
            rows.append([(side*(.59-w*n/10),.083+.018*cos(n*pi*.57),z+.012*sin(n*pi*.31)) for n in range(11)])
        if side>0:rows=[row[::-1] for row in rows]
        a.surface('Gathered curtain',rows,cloth)

def roof_trim():
    a=asset('garden-roof-edge',[10,17,46,84],'Individually bedded barrel ridge tiles, courses of eave tiles, verge boards and half-round gutters.')
    # The game scales this measured 8.50 × 11.90 m roof around the same gable and eave sections.
    w,d,rise=4.25,5.95,1.84
    for side in [-1,1]:
        a.box('Eave fascia',(side*(w-.059),0,.14),(.068,2*d,.205),cream,.009)
        for y in [-d+.035,d-.035]:
            a.tube('Gable verge board',[(side*(w-.041),y,.226),(0,y,rise+.18)],[.057,.069],cream,8)
        pts=[(side*(w+.016+.080*cos(t*pi/10)),0,.114-.080*sin(t*pi/10)) for t in range(11)]
        a.surface('Rolled gutter',[[(x,-d,z) for x,_,z in pts],[(x,d,z) for x,_,z in pts]],grey,smooth=True)
        for y in [-5.45,-4.02,-2.48,-.92,.62,2.17,3.71,5.23]:
            a.tube('Gutter strap',[(side*(w-.039),y,.18),(side*(w+.035),y,.065),(side*(w+.102),y,.112)],.009,grey,7)
        for i in range(53):
            y=-d+.129+i*(2*d-.268)/52
            rows=[]
            for u,k in [(0,1),(.145,.978),(.29,.93)]:
                row=[]
                for n in range(11):
                    t=n*pi/10
                    row.append((side*(w-u),y+.096*k*cos(t),.246+u*rise/w+.045*k*sin(t)))
                rows.append(row if side>0 else row[::-1])
            a.surface('Curved pantile mouth',rows,earth[(i*11+(side+1))%4])
    for i in range(40):
        y=-d+i*(2*d-.31)/39
        rows=[]
        for v,r in [(y,.126),(y+.031,.129),(y+.335,.112)]:
            rows.append([(r*cos(j*pi/12),v,rise+.204+r*.70*sin(j*pi/12)) for j in range(13)])
        a.surface('Overlapping ridge cap',rows,earth[(i*7)%4])
    return a

def yard_pole():
    a=asset('garden-utility-pole',[17,22,52,60,84],'Tapered timber distribution pole, two bolted crossarms and three porcelain line pins.')
    a.turn('Tapered pole',0,0,[(0,.137),(.22,.139),(5.42,.094),(7.18,.079)],wood,18)
    for h in [6.69,6.82]:
        a.box('Wood crossarm',(0,0,h),(1.39,.11,.081),wood,.010)
        a.tube('Bolted tie',[(-.58,0,h-.05),(0,.025,h-.37),(.58,0,h-.05)],.012,grey,7)
    for x in [-.564,0,.564]:
        a.turn('Galvanized pin',x,0,[(6.87,.016),(7.04,.014)],grey,10)
        a.turn('Porcelain spool',x,0,[(6.93,.039),(6.95,.071),(6.97,.061),(6.992,.037),(7.011,.068),(7.034,.052),(7.043,.030)],porcelain,18)
    for i in range(9):
        side=(-1)**i;h=2.4+i*.40
        a.tube('Service climbing peg',[(0,0,h),(side*.178,0,h),(side*.181,0,h+.018)],.009,grey,7)
    a.box('Service head',(0,-.097,3.68),(.123,.094,.21),iron,.016)

def quay_light():
    a=asset('dock-street-lamp',[38,59,66,83],'Galvanized tapered column, swept outreach arm, service door and oval roadway luminaire.')
    a.turn('Foundation flange',0,0,[(0,.188),(.04,.187),(.064,.149)],grey,20)
    a.turn('Tapered shaft',0,0,[(.051,.119),(.37,.114),(5.90,.071),(7.47,.052)],grey,18)
    a.box('Inspection cover',(0,-.113,.585),(.107,.011,.271),grey,.017)
    a.tube('Swept tubular bracket',[(0,0,7.29),(0,-.23,7.57),(0,-.92,7.76),(0,-1.62,7.76),(0,-1.88,7.69)],
           [.05,.047,.042,.036,.034],grey,12)
    rows=[]
    for z,r in [(7.62,.64),(7.68,1),(7.78,.84),(7.825,.33),(7.83,.015)]:
        rows.append([(.17*r*cos(TAU*k/28),-1.98+.353*r*sin(TAU*k/28),z) for k in range(29)])
    a.surface('Cast cobrahead shell',rows,grey)
    rows=[]
    for z,r in [(7.541,.02),(7.565,.55),(7.622,.82),(7.658,.75)]:
        rows.append([(.17*r*cos(TAU*k/24),-2.009+.347*r*sin(TAU*k/24),z) for k in range(25)])
    a.surface('Prismatic roadway refractor',rows,lamp)
    for i in range(3):a.box('Rear heat fin',(0,-1.79+.04*i,7.741),(.192,.012,.065),grey,.003)
    for x in [-.120,.120]:
        for y in [-.10,.10]:a.turn('Hex hold-down nut',x,y,[(.044,.014),(.066,.013)],iron,6)

if __name__=='__main__':
    for build in [sash,roof_trim,yard_pole,quay_light]:build()
    publish(assets,{a.name for a in assets},'Garden cottages')
    (SOURCE/'Garden cottages.json').write_text(json.dumps([
        {'id':a.name,'sourceImages':a.refs,'description':a.description,'parts':len(a.collection.objects),
         'movableParts':list(a.pivots)[1:],'runtimeBytes':(OUT/(a.name+'.glb')).stat().st_size} for a in assets],indent=2)+'\n')
