"""Editable diner furniture, news vendor, record displays and rooftop panels, built with bpy."""
import json
import sys
from math import cos, pi, sin
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from city_modeling import Asset, OUT, SOURCE, TAU, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
chrome = material('Polished tube and edging', 'bfbbb2', .22, .89)
steel = material('Rolled dark metal', '585a55', .48, .72)
rubber = material('Foot pads and gaskets', '302f29', .91)
red = material('Diner oxblood vinyl', '875147', .51)
piping = material('Seat welt', 'a56f5c', .61)
ivory = material('Cream mottled laminate', 'c9c1ab', .52)
plate = material('Thick glazed china', 'e9ddc8', .24)
glass = material('Clear glass condiment jar', 'b7c0b9', .13, .05, alpha=.32, two_sided=True)
wood = material('Dark stained plywood', '75624e', .83)
black = material('Graphite print', '393b39', .89)
brick = material('Oxide news vendor enamel', 'a53f35', .56, .23)
fabric = material('Woven paper labels', 'd9cfb7', .93)
solar = material('Monocrystalline wafer', '32445a', .28, .34)
trace = material('Printed cell fingers', '7f8a92', .41, .53)
paper = [material('Record sleeve '+str(i), c, .84) for i, c in enumerate(
    ['736f60','9c654e','576a75','c5bda4','534d54','868673','676e65','b49a76'])]
assets = []

def make(name, refs, desc):
    a = Asset(name, refs, desc)
    assets.append(a)
    return a

def booth():
    a = make('diner-booth', [1,25,96,111], 'A single banquette with sprung seat, eight stitched ribs, wrapped end caps and a recessed foot plinth.')
    a.box('Rubber kick rail',(0,0,.076),(1.51,.536,.15),rubber,.02)
    a.box('Timber seat box',(0,.027,.224),(1.53,.536,.236),wood,.027)
    a.box('Cushion',(0,-.024,.398),(1.565,.602,.175),red,.067)
    for x in [-.763,.763]:
        a.tube('Seat welt',[(x,.215,.417),(x,.168,.459),(x,-.245,.459),(x,-.306,.420),
                             (x,-.301,.376),(x,-.266,.346)],.007,piping,9)
    a.box('Upholstered back shell',(0,.242,.69),(1.564,.149,.662),red,.055)
    for i in range(9):
        x=-.678+i*.1695
        a.box('Sewn back bolster',(x,.165,.739),(.171,.090,.509),red,.035)
        if i<8:a.tube('Indented seam',[(x+.082,.119,.512),(x+.082,.119,.916),(x+.08,.135,.971)],.0035,piping,6)
    a.box('Top roll',(0,.191,.999),(1.562,.16,.075),red,.034)
    for x in [-.744,.744]:
        a.box('Brushed seat end trim',(x,.059,.267),(.033,.513,.07),chrome,.013)
    return a

def restaurant_table():
    a = make('diner-table',[1,25,90,96],'Rounded laminate and chromed edge, porcelain cups, plates and a wire condiment caddy.')
    a.turn('Weighted flared base',0,0,[(0,.245),(.021,.259),(.038,.244),(.064,.108),(.077,.077)],steel,28)
    a.turn('Chrome column',0,0,[(.063,.077),(.103,.050),(.686,.050),(.709,.118)],chrome,24)
    a.box('Brushed edge strip',(0,0,.735),(1.125,.768,.053),chrome,.025)
    a.box('Laminate top',(0,0,.761),(1.117,.762,.024),ivory,.011)
    base=.774
    for x,y in [(-.308,-.096),(.312,.108)]:
        a.turn('White saucer',x,y,[(base,.074),(base+.007,.098),(base+.012,.093),(base+.014,.075)],plate,30)
        a.turn('Coffee cup',x,y,[(base+.013,.039),(base+.022,.047),(base+.081,.058),
               (base+.093,.058),(base+.0934,.052),(base+.082,.052)],plate,30)
        a.turn('Coffee surface',x,y,[(base+.078,.052),(base+.080,.0515)],wood,28)
        a.ring('Loop handle',(x+.063,y,base+.055),.027,.0065,plate,(0,1,0),22)
        a.tube('Teaspoon handle',[(x-.073,y-.067,base+.012),(x+.060,y-.079,base+.0125)],.003,chrome,7)
        a.box('Teaspoon bowl',(x+.067,y-.08,base+.014),(.033,.018,.0065),chrome,.0031)
    for x,r in [(-.067,.0215),(.053,.022)]:
        a.turn('Shaker contents',x,.233,[(base+.009,r),(base+.076,r-.001)],ivory if x<0 else wood,14)
        a.turn('Glass shaker',x,.233,[(base,.0245),(base+.013,.025),(base+.077,.024),(base+.092,.018)],glass,16)
        a.turn('Perforated cap',x,.233,[(base+.083,.019),(base+.092,.021),(base+.099,.014)],chrome,15)
    a.turn('Sauce bottle',0,.297,[(base,.022),(base+.061,.029),(base+.083,.022),(base+.095,.012),
           (base+.123,.012),(base+.126,.015)],brick,18)
    a.turn('Sauce bottle stopper',0,.297,[(base+.121,.015),(base+.139,.014)],plate,14)
    for y in [.195,.332]:
        a.tube('Wire caddy side',[(-.099,y,base+.006),(-.097,y,base+.044),(.092,y,base+.044),(.094,y,base+.006)],.004,chrome,8)
    return a

def stool():
    a = make('diner-stool',[1,25,90],'Pedestal stool with a round vinyl seat, tubular foot ring, bearings and a chromed skirt.')
    a.turn('Foot flange',0,0,[(0,.159),(.017,.17),(.028,.15),(.044,.060)],chrome,28)
    a.turn('Column',0,0,[(.031,.054),(.529,.043),(.554,.084),(.575,.103)],chrome,28)
    a.ring('Foot ring',(0,0,.224),.17,.014,chrome,steps=36)
    for n in range(3):
        v=TAU*n/3
        a.tube('Welded spoke',[(.032*cos(v),.032*sin(v),.191),(.166*cos(v),.166*sin(v),.223)],.008,chrome,8)
    a.turn('Chrome seat skirt',0,0,[(.559,.126),(.591,.211),(.639,.210)],chrome,32)
    a.turn('Sprung vinyl seat',0,0,[(.623,.209),(.632,.222),(.669,.223),(.703,.205),(.715,.154),(.719,.04)],red,36)
    a.ring('Rolled seam',(0,0,.653),.219,.004,piping,steps=36)
    return a

def news_vendor():
    a = make('corner-news-vendor',[1,30,43],'Folded steel coin newspaper box with a sloping cap, paper window, lever, latch and welded feet.')
    for x in [-.232,.232]:
        for y in [-.143,.143]:
            a.box('Foot',(x,y,.032),(.089,.115,.064),rubber,.011)
            a.box('Folded leg',(x,y,.139),(.065,.066,.219),brick,.009)
    a.box('Paper housing',(0,0,.580),(.563,.387,.697),brick,.016)
    a.box('Cap skirt',(0,-.002,.943),(.593,.416,.055),brick,.017)
    a.box('Customer door',(0,-.199,.569),(.492,.027,.543),brick,.014)
    a.box('Window gasket',(-.014,-.218,.623),(.367,.011,.308),rubber,.007)
    a.box('Folded front page',(-.014,-.226,.623),(.339,.004,.285),fabric,.003)
    a.box('Masthead ink',(-.014,-.2285,.721),(.276,.0015,.024),black)
    for row in range(7):
        for col in [-1,1]:
            a.box('Newsprint column',(col*.082-.014,-.2283,.674-row*.024),(.118-(row%3)*.009,.0014,.0045),black)
    a.box('Glass face',(-.014,-.231,.623),(.345,.003,.288),glass,.001)
    a.box('Coin receiver',(.195,-.221,.807),(.081,.048,.191),steel,.009)
    a.box('Coin slot',(.195,-.247,.838),(.032,.003,.004),rubber)
    a.tube('Handle',[(.179,-.220,.517),(.179,-.265,.515),(.178,-.267,.401),(.177,-.219,.400)],.009,chrome,9)
    return a

def record_bin():
    a=make('record-browser',[30,89,99],'Two timber LP bins containing individual printed sleeves, divider tabs, etched vinyl discs and a sloped browsing lip.')
    for x in [-.469,.469]:
        for y in [-.232,.232]:
            a.box('Rack leg',(x,y,.356),(.041,.044,.711),steel,.005)
    a.box('Slatted lower shelf',(0,0,.255),(.979,.518,.041),wood,.006)
    a.box('Display bottom',(0,0,.675),(.997,.553,.055),wood,.009)
    for x in [-.488,0,.488]:a.box('Divider cheek',(x,.016,.788),(.023,.557,.222),wood,.008)
    for y,h in [(-.266,.142),(.273,.280)]:
        a.box('Bin lip',(0,y,.700+h/2),(.997,.024,h),wood,.009)
    for lane in [-1,1]:
        for j in range(12):
            x=lane*.246+.016*sin(j*.78)
            y=-.220+j*.0403
            obj=a.box('12 inch album sleeve',(x,y,.841),(.310,.008,.316),paper[(j+lane+8)%8],.003)
            # A sloping row leaves the jacket titles visible behind each cover.
            tilt=.10+.03*sin(j+lane)
            for v in obj.data.vertices:v.co.y+=(v.co.z-.69)*tilt
            if j==0:
                a.box('Cover title',(x,y-.001,.935),(.237,.004,.019),fabric,.002)
                a.ring('Record label on cover',(x,y+.005,.848),.055,.004,fabric,(0,1,0),26)
            if j in [4,9]:
                a.box('Tabbed section divider',(x,y+.012,1.015),(.107,.012,.082),fabric,.005)
    return a

def pv_array():
    a=make('coastal-solar-array',[12,35,66],'Two tilted coastal photovoltaic modules with visible cell lattice, raised south legs, cable and inverter.')
    slope=.20
    def h(y):return .235+(y+.78)*slope
    for x in [-.81,.81]:
        for y in [-.65,.65]:
            a.box('Ballast shoe',(x,y,.045),(.26,.20,.09),wood,.013)
            a.tube('Mounting foot',[(x,y,.068),(x,y,h(y))],.024,steel,8)
    for lane in [-1,1]:
        cx=lane*.497
        vs=[(cx+x,y,h(y)) for x,y in [(-.48,-.78),(.48,-.78),(.48,.78),(-.48,.78)]]
        a.mesh('Blue cell laminate',vs,[(0,1,2,3)],solar)
        for n in range(4):
            p,q=vs[n],vs[(n+1)%4];a.tube('Aluminium panel rim',[p,q],.014,chrome,8)
        for i in range(1,6):
            x=cx-.48+i*.16
            a.tube('Cell bus',[ (x,-.769,h(-.769)+.003),(x,.769,h(.769)+.003)],.0024,trace,5)
        for j in range(1,10):
            y=-.78+j*.156
            a.tube('Cell spacing',[(cx-.466,y,h(y)+.003),(cx+.466,y,h(y)+.003)],.0024,trace,5)
    a.box('DC junction enclosure',(.17,.524,.104),(.257,.128,.132),steel,.01)
    a.tube('Curved cable',[(-.353,.637,h(.637)-.006),(-.324,.580,.129),(-.083,.544,.112),(.144,.525,.109)],.008,rubber,7)
    return a

if __name__=='__main__':
    for build in [booth, restaurant_table, stool, news_vendor, record_bin, pv_array]:
        build()
    publish(assets,{a.name for a in assets},'Palm Street interiors')
    rows=[{'id':a.name,'sourceImages':a.refs,'description':a.description,'parts':len(a.collection.objects),
           'movableParts':list(a.pivots)[1:],'runtimeBytes':(OUT/(a.name+'.glb')).stat().st_size} for a in assets]
    (SOURCE/'Palm Street interiors.json').write_text(json.dumps(rows,indent=2)+'\n')

