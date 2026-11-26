"""Build portable bathing-beach furniture in metres with Blender's Python API."""
from math import cos, pi, sin
import json
import bpy
from city_modeling import Asset, OUT, SOURCE, material, publish

bpy.ops.wm.read_factory_settings(use_empty=True)
canvas = material('Tinted sailcloth', 'eee9d8', .93, two_sided=True)
natural = material('Unbleached canvas', 'd9cdb0', .94, two_sided=True)
metal = material('Anodised aluminium', 'a5adac', .36, .76)
ferrule = material('Black rubber ferrule', '49443a', .80)
wood = material('Oiled beech', 'ae8153', .71, finish='joinery')
brass = material('Brass hinge washer', '987744', .40, .66)

def shade():
    a = Asset('canvas-beach-parasol', [2, 39, 48, 107], 'Portable eight-gore sunshade for the bathing areas, with joined canvas seams, ferrules and sprung ribs.')
    a.turn('Telescoping mast', 0, 0, [(0, .020), (.92, .021), (.94, .027), (.99, .027), (1, .019), (2.25, .019)], metal, 16)
    a.turn('Sliding runner', 0, 0, [(1.62, .032), (1.64, .053), (1.70, .047), (1.71, .028)], ferrule, 16)
    for i in range(8):
        theta = i * pi / 4
        def point(t, v):
            # Straight seams meet bellied fabric panels at the hem.
            x = (1-v)*cos(theta) + v*cos(theta+pi/4)
            y = (1-v)*sin(theta) + v*sin(theta+pi/4)
            sag = .050 * sin(pi*v) * t**1.5
            return (1.34*t*x, 1.34*t*y, 2.25 - .23*t - .22*t*t - sag)
        rows = [[point(t/9, v/8) for v in range(9)] for t in range(1, 10)]
        center = [point(.014, v/8) for v in range(9)]
        a.surface('Sewn canopy panel', [center]+rows, canvas if i%2 else natural)
        edge = rows[-1]
        hems = [(x*.996, y*.996, z-.063-.023*sin(pi*k/8)) for k,(x,y,z) in enumerate(edge)]
        a.surface('Hanging valance', [edge, hems], canvas if i%2 else natural)
        a.tube('Bound hem', hems, .0045, natural, 7)
        rib = [point(t, 0) for t in (.020,.25,.48,.73,1)]
        a.tube('Flexible rib', [(x,y,z-.015) for x,y,z in rib], [.010,.008,.007,.0055,.004], metal, 8)
        a.tube('Stretcher', [(0,0,1.68),(rib[2][0],rib[2][1],rib[2][2]-.017)], .006, metal, 8)
        tip = rib[-1]
        a.tube('Tip sleeve', [(tip[0]*.986,tip[1]*.986,tip[2]+.006),(tip[0]*1.004,tip[1]*1.004,tip[2]-.005)], .008, ferrule, 8)
    a.turn('Canopy finial', 0, 0, [(2.235,.046),(2.252,.051),(2.270,.026),(2.306,.013)], brass, 20)
    return a

def chair():
    a = Asset('canvas-deckchair', [2, 48, 107], 'A low folding chair for the bathing areas with an ash frame, woven sling, metal pins and pivot washers.')
    for x in (-.296,.296):
        a.tube('Front folding leg', [(x,-.404,.024),(x,.157,.636)], .024, wood, 8)
        a.tube('Rear folding leg', [(x,.393,.024),(x,-.284,.482)], .023, wood, 8)
        a.tube('Back upright', [(x,-.219,.348),(x,.314,1.035)], .023, wood, 8)
        a.tube('Arm rest', [(x,-.280,.564),(x,-.248,.583),(x,.139,.618)], .026, wood, 10)
        a.tube('Arm stay', [(x,-.195,.354),(x,-.186,.573)], .011, metal, 8)
        for y,z in ((.044,.410),(-.188,.351),(.128,.611)):
            a.tube('Hinge pin', [(x-.030,y,z),(x+.030,y,z)], .009, metal, 10)
            for sign in (-1,1):
                at = x+sign*.026
                a.tube('Press washer', [(at,y,z),(at+sign*.003,y,z)], .015, brass, 12)
        for y in (-.404,.393):
            a.tube('Foot cap', [(x-.027,y,.024),(x+.027,y,.024)], .025, ferrule, 12)
    for y,z in ((-.368,.061),(.356,.067),(-.250,.451),(.313,1.036)):
        a.tube('Cross dowel', [(-.295,y,z),(.295,y,z)], .018, wood, 12)
    # A loose seat and a tensioned back are one continuous sling.
    profile = [(-.265,.446),(-.217,.425),(-.120,.379),(.012,.348),(.117,.357),
               (.170,.425),(.206,.573),(.257,.772),(.303,1.013),(.320,1.035),(.327,1.019)]
    for k in range(9):
        lo = -.263+k*.526/9
        def strip(y,z):
            return [(u,y,z-.024*sin(pi*(u+.263)/.526)*sin(pi*(z-.33)/.72)) for u in (lo,lo+.526/9)]
        a.surface('Woven sling stripe', [strip(y,z) for y,z in profile], canvas if k%3!=2 else natural)
    return a

if __name__ == '__main__':
    assets = [shade(),chair()]
    title = 'Beach furniture'
    publish(assets, {a.name for a in assets}, title)
    rows = [dict(id=a.name,sourceImages=a.refs,description=a.description,parts=len(a.collection.objects),
                 movableParts=list(a.pivots)[1:],runtimeBytes=(OUT/(a.name+'.glb')).stat().st_size) for a in assets]
    (SOURCE/(title+'.json')).write_text(json.dumps(rows,indent=2)+'\n')
