"""Build the domestic and workplace fittings for occupied upper storeys."""
from math import cos, pi, sin
import json
import bpy
from city_modeling import Asset, OUT, SOURCE, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
enamel=material('Ivory enamel', 'd9d7c9', .38)
plastic=material('Warm refrigerator liner', 'e3e5d8', .51)
steel=material('Brushed steel', '929b9a', .32, .78)
seal=material('Door gasket', '40443c', .87)
wood=material('Oak bedside cabinet', '927152', .70, finish='joinery')
pottery=material('Glazed green earthenware', '708478', .34)
paper=material('Book leaves', 'd7c7a3', .84)
ink=material('Cloth binding', '51423a', .90)
cloth=material('Pleated linen', 'e1d5b4', .95)
frost=material('Shelf glass', 'abbeb4', .15, .12, alpha=.47, two_sided=True)
brass=material('Knurled brass', '967548', .42, .75)
tile=material('Porcelain mosaic', 'acb9ba', .48)
mirror=material('Silver mirror', 'c7d1ce', .045, .97)
assets=[]

def new(name, refs, description):
    asset=Asset(name, refs, description)
    assets.append(asset)
    return asset

def refrigerator():
    a=new('flat-refrigerator',[18,25,26,89,111],'Hollow enamel refrigerator with lined cabinet, shelf rails, clear shelves, stocked bins and a hinged door.')
    a.pivots['ColdDoor']=(-.297,-.278,.12)
    for x in (-.28,.28):
        a.box('Side panel',(x,.011,.835),(.038,.553,1.618),enamel,.009)
        for y in (-.206,.206):a.turn('Adjustable foot',x*.91,y,[(0,.029),(.037,.031)],seal,12)
    a.box('Back insulation',(0,.262,.836),(.542,.057,1.604),enamel,.008)
    for h in (.063,1.619):a.box('Top and base',(0,.012,h),(.542,.551,.055),plastic,.009)
    for h in (.29,.65,.98,1.32):
        a.box('Pressed shelf',(0,.007,h),(.524,.46,.015),frost,.005)
        a.box('Shelf front rail',(0,-.222,h),(.525,.014,.024),steel,.003)
        for x in (-.258,.258):a.box('Runner',(x,.015,h-.017),(.019,.440,.025),plastic,.004)
    for x in (-.134,.134):
        a.box('Produce drawer',(x,-.018,.189),(.235,.408,.172),plastic,.013)
        a.box('Recessed handle',(x,-.220,.207),(.141,.013,.022),seal,.004)
    for i in range(5):
        x=-.165+(i%3)*.133
        y=.10-(i//3)*.17
        a.turn('Preserve jar',x,y,[(.667,.041),(.682,.045),(.759,.044),(.777,.034)],pottery,16)
        a.turn('Tin lid',x,y,[(.777,.037),(.787,.038)],brass,16)
    for x in (-.12,.062):
        a.box('Paper milk carton',(x,.044,1.079),(.079,.082,.179),paper,.003)
        a.box('Folded carton top',(x,.044,1.175),(.079,.014,.018),plastic,.002)
    d='ColdDoor'
    a.box('Door insulation',(0,-.291,.846),(.594,.047,1.591),plastic,.012,d)
    a.box('Painted door skin',(0,-.314,.846),(.601,.044,1.607),enamel,.017,d)
    for x in (-.274,.274):a.box('Magnetic seal',(x,-.258,.846),(.016,.024,1.536),seal,.004,d)
    for h in (.088,1.605):a.box('Magnetic seal',(0,-.258,h),(.553,.024,.016),seal,.004,d)
    a.tube('Opening handle',[(.243,-.331,.799),(.243,-.361,.823),(.243,-.361,1.093),(.243,-.331,1.117)],.012,steel,12,d)
    for h in (.39,.85,1.28):
        a.box('Door bin base',(0,-.217,h),(.468,.085,.023),plastic,.005,d)
        a.box('Bin front rail',(0,-.174,h+.047),(.470,.012,.091),plastic,.006,d)
    for h in (.118,1.583):a.turn('Hinge barrel',-.297,-.278,[(h,.009),(h+.034,.009)],steel,12)

def tea():
    a=new('breakfast-tray',[18,25,89,90,111],'An electric kettle, ceramic mugs, saucers and a lipped wooden breakfast tray.')
    a.box('Tray bottom',(0,0,.009),(.50,.319,.018),wood,.006)
    for x in (-.248,.248):a.box('Raised tray rim',(x,0,.022),(.010,.316,.034),wood,.003)
    for y in (-.156,.156):a.box('Raised tray rim',(0,y,.023),(.493,.009,.036),wood,.003)
    x,y=-.112,.021
    a.turn('Cordless base',x,y,[(.018,.076),(.034,.082),(.042,.073)],seal,24)
    a.turn('Kettle shell',x,y,[(.041,.067),(.051,.076),(.145,.082),(.204,.059),(.214,.041)],enamel,28)
    a.turn('Kettle cap',x,y,[(.213,.047),(.223,.045),(.229,.029)],steel,24)
    a.turn('Lid button',x,y,[(.226,.016),(.244,.014)],seal,16)
    a.tube('Kettle handle',[(x-.066,y,.091),(x-.102,y,.085),(x-.111,y,.154),(x-.089,y,.198),(x-.047,y,.208)],.011,seal,12)
    a.tube('Pouring spout',[(x+.055,y,.167),(x+.097,y,.207),(x+.104,y,.214)],[.026,.019,.018],steel,16)
    for x,y in ((.104,.063),(.132,-.069)):
        a.turn('Saucer',x,y,[(.018,.032),(.020,.056),(.025,.054),(.023,.035)],enamel,24)
        a.turn('Cup',x,y,[(.024,.027),(.032,.036),(.103,.040),(.105,.038),(.098,.036),(.035,.031),(.032,.014)],pottery,24)
        a.tube('Cup handle',[(x+.034,y,.089),(x+.056,y,.094),(x+.062,y,.079),(x+.057,y,.060),(x+.033,y,.050)],.0043,pottery,10)

def bedside():
    a=new('bedside-lamp',[10,17,22,47,89],'Bedside cabinet with a drawer, turned lamp, pleated shade and two clothbound books.')
    for x in (-.232,.232):
        for y in (-.155,.155):a.turn('Tapered foot',x,y,[(0,.019),(.135,.028)],wood,12)
    a.box('Nightstand carcass',(0,0,.348),(.506,.348,.432),wood,.008)
    a.box('Drawer front',(0,-.18,.458),(.476,.024,.15),wood,.005)
    a.turn('Drawer escutcheon',0,-.197,[(.450,.011),(.468,.011)],brass,10)
    a.box('Drawer pull',(0,-.205,.454),(.071,.012,.013),brass,.004)
    a.box('Cabinet top',(0,0,.575),(.535,.374,.026),wood,.008)
    x,y=-.115,.043
    a.turn('Lamp base',x,y,[(.587,.075),(.606,.081),(.618,.054),(.633,.031),(.665,.022),(.697,.043),(.743,.034),(.781,.014)],pottery,24)
    a.turn('Lamp socket',x,y,[(.781,.018),(.817,.017)],brass,14)
    rows=[]
    for h,r in ((.784,.137),(.800,.135),(.969,.077),(.978,.077)):
        rows.append([(x+(r+.004*(k%2))*cos(k*pi/40),y+(r+.004*(k%2))*sin(k*pi/40),h) for k in range(81)])
    a.surface('Pleated fabric shade',rows,cloth)
    for h,r in ((.784,.138),(.978,.078)):a.ring('Shade rim',(x,y,h),r,.0028,brass,(0,0,1),60)
    a.turn('Opal bulb',x,y,[(.807,.016),(.835,.031),(.854,.030),(.874,.013)],enamel,20)
    for k in range(2):
        z=.589+k*.026
        a.box('Book covers',(.139,.023,z+.012),(.148,.191,.026),ink,.003)
        a.box('Visible leaves',(.143,.017,z+.012),(.143,.185,.019),paper,.002)

def washstand():
    a=new('flat-washstand',[10,17,25,47,89],'A china basin, chromed trap, towel rail and silvered mirror for small washrooms.')
    a.box('Mirror backing',(0,.179,1.397),(.465,.021,.541),wood,.009)
    a.box('Mirror glass',(0,.162,1.397),(.454,.010,.532),mirror,.006)
    profiles=[(.736,.104,.068),(.827,.234,.161),(.876,.251,.177),(.884,.242,.165),
              (.857,.227,.147),(.795,.177,.096),(.769,.056,.038),(.762,.021,.018)]
    rings=[[(w*cos(i*pi/20),.003+d*sin(i*pi/20),h) for i in range(41)] for h,w,d in profiles]
    a.surface('Ceramic bowl',rings,enamel)
    a.turn('Waste grate',0,.003,[(.760,.023),(.768,.025)],steel,20)
    a.tube('Exposed waste trap',[(0,.003,.76),(0,.003,.556),(0,.085,.518),(0,.118,.565),(0,.187,.58)],.017,steel,14)
    a.tube('Mixer spout',[(0,.135,.868),(0,.134,.970),(0,.108,1.006),(0,.034,1.006),(0,.027,.986)],.011,steel,12)
    for x in (-.064,.064):a.turn('Cross handle',x,.132,[(.869,.018),(.892,.020),(.91,.014)],brass,14)
    for x in (-.189,.189):
        a.tube('Basin bracket',[(x,.171,.744),(x,.165,.81),(x,-.071,.835)],.012,steel,10)
    a.tube('Towel rail',[(-.196,.182,.578),(-.196,.085,.578),(.196,.085,.578),(.196,.182,.578)],.008,steel,12)
    a.box('Folded hand towel',(-.098,.079,.475),(.122,.017,.204),cloth,.006)
    # Wall escutcheons locate the asset on the finished floor even in rooms without exposed pipe chases.
    for x in (-.085,.085):a.tube('Supply pipe',[(x,.169,.004),(x,.169,.712),(x,.120,.847)],.009,steel,10)

def shower():
    a=new('shower-tray',[17,22,47,78,89],'Low shower tray with tiled threshold, mixer, riser, rail, rose and slotted drain.')
    a.box('Drain bed',(0,0,.037),(.862,.763,.061),enamel,.012)
    for x in (-.422,.422):a.box('Tray kerb',(x,0,.061),(.032,.764,.058),tile,.006)
    for y in (-.368,.368):a.box('Tray kerb',(0,y,.061),(.819,.033,.058),tile,.006)
    a.turn('Drain grate',.18,.16,[(.068,.039),(.072,.039)],steel,20)
    for i in range(-2,3):a.box('Drain slot',(.18+i*.010,.16,.072),(.003,.039,.001),seal)
    a.tube('Exposed shower riser',[(0,.345,.986),(0,.345,1.940),(0,.298,1.999),(0,.118,2.004)],.011,steel,14)
    a.turn('Shower rose',0,.122,[(1.931,.076),(1.944,.077),(1.969,.040),(1.992,.014)],steel,24)
    for i in range(12):
        a.turn('Rose nozzle',.054*cos(i*pi/6),.122+.054*sin(i*pi/6),[(1.926,.003),(1.933,.003)],seal,8)
    a.tube('Mixing valve',[(-.101,.337,1.012),(.101,.337,1.012)],.024,steel,14)
    for x in (-.098,.098):a.tube('Mixer handle',[(x,.337,1.013),(x,.276,1.044)],.014,brass,10)
    for h in (1.12,1.78):a.tube('Riser stay',[(0,.376,h),(0,.344,h)],.016,steel,12)

if __name__=='__main__':
    refrigerator();tea();bedside();washstand();shower()
    title='Domestic fittings'
    publish(assets,{a.name for a in assets},title)
    rows=[dict(id=a.name,sourceImages=a.refs,description=a.description,parts=len(a.collection.objects),
               movableParts=list(a.pivots)[1:],runtimeBytes=(OUT/(a.name+'.glb')).stat().st_size) for a in assets]
    (SOURCE/(title+'.json')).write_text(json.dumps(rows,indent=2)+'\n')
