"""Build the sourced forty-foot intermodal container with individually pivoted end doors."""
import json

import bpy

from city_modeling import Asset, OUT, SOURCE, material, publish


def freight_box():
    a = Asset('intermodal-container', [9, 38, 59, 66, 83, 109],
              'Forty-foot dry cargo box, folded steel shell, plywood deck, corner castings and two cam-locked end doors.')
    enamel = material('Container enamel', 'ece9df', .67, .32, two_sided=True)
    zinc = material('Galvanized locking hardware', 'aba99c', .46, .68)
    dark = material('Door gasket and casting apertures', '383b35', .83)
    wood = material('Plywood cargo floor', '856b4e', .92, finish='joinery')
    end, side, height = 6.08, 1.22, 2.60
    a.box('Plywood load deck', (0, 0, .097), (11.99, 2.30, .074), wood)
    for k in range(19):
        a.box('Crossmember', (-5.77+k*.64, 0, .046), (.080, 2.32, .085), zinc)
    for sign in (-1, 1):
        y = sign*(side-.033)
        for z in (.068, height-.053):
            a.box('Longitudinal rail', (0, y, z), (12.05, .066, .106), enamel)
        stations = []
        for fold in range(48):
            for fraction, inset in ((0,.055),(.17,.055),(.33,.009),(.65,.009),(.81,.055)):
                x = -5.984+(fold+fraction)*11.968/48
                stations.append([(x,sign*(side-inset),.115),(x,sign*(side-inset),height-.091)])
        stations.append([(5.984,sign*(side-.055),.115),(5.984,sign*(side-.055),height-.091)])
        a.surface('Pressed side sheet', stations if sign>0 else stations[::-1], enamel, smooth=False)
    roof = []
    for k in range(53):
        for fraction, offset in ((0,.019),(.28,.019),(.43,.006),(.68,.006),(.82,.019)):
            x = -6.004+(k+fraction)*12.008/53
            roof.append([(x,y,height-offset) for y in (1.164, 0, -1.164)])
    roof.append([(6.004,y,height-.019) for y in (1.164,0,-1.164)])
    a.surface('Beaded roof sheet', roof, enamel, smooth=False)
    for x in (-end+.063, end-.063):
        for y in (-side+.059, side-.059):
            a.box('Corner post', (x,y,height*.5), (.092,.102,height-.205), enamel)
            for z in (.060,height-.061):
                a.box('Corner casting', (x,y,z), (.126,.118,.121), enamel, .009)
                a.box('Twistlock socket', (x,y,z+.061), (.073,.043,.002), dark, .006)
                a.box('Side aperture', (x,y+(.060 if y>0 else -.060),z), (.059,.002,.039), dark, .006)
    a.box('Closed end wall', (-end+.073,0,1.31), (.038,2.31,2.42), enamel)
    for k in range(13):
        a.box('End pressing', (-end+.044,-1.12+.181*k,1.30), (.051,.083,2.32), enamel, .008)
    for z in (.074,height-.062):
        a.box('Door sill and header', (end-.051,0,z), (.102,2.30,.11), enamel)
    for hand in (-1,1):
        leaf = 'DoorPort' if hand<0 else 'DoorStarboard'
        a.pivots[leaf] = (end-.046,hand*1.148,.134)
        y = hand*.567
        a.box('Perimeter seal', (end-.068,y,1.313), (.044,1.141,2.385), dark, .006, leaf)
        a.box('Leaf skin', (end-.065,y,1.312), (.058,1.103,2.342), enamel, .005, leaf)
        for z in (.288,.806,1.342,1.876,2.326):
            a.box('Pressed horizontal door rib', (end-.027,y,z), (.042,.926,.086), enamel, .012, leaf)
        for z in (.32,1.28,2.29):
            a.box('Hinge strap', (end-.012,hand*1.061,z), (.024,.214,.067), zinc, .008, leaf)
            a.tube('Hinge pin', [(end-.047,hand*1.149,z-.055),(end-.047,hand*1.149,z+.055)], .024, zinc, 10)
        for along in (.303,.86):
            yy=hand*along
            a.tube('Cam lock rod', [(end-.006,yy,.164),(end-.006,yy,2.445)], .018, zinc, 10, leaf)
            for z in (.23,.64,1.76,2.39):
                a.box('Rod guide bracket', (end+.008,yy,z), (.042,.071,.041), zinc, .004, leaf)
            a.tube('Folding handle', [(end+.009,yy,.804),(end+.057,yy,.786),(end+.061,yy-hand*.225,.749)], .014, zinc, 10, leaf)
    return a


def receiving_carton():
    a = Asset('receiving-carton', [9, 38, 59, 83, 86, 103],
              'Folded kraft shipping carton, taped closure, delivery label and a printed handling mark.')
    kraft = material('Kraft fibre', 'b68c5c', .94)
    edge = material('Cut corrugated edge', '917249', .97)
    tape = material('Brown packing tape', 'a18257', .44)
    label = material('Shipping label paper', 'e0dfc9', .91)
    print_ink = material('Package ink', '4a5148', .85)
    w,d,h=.486,.356,.325
    for sign in (-1,1):
        a.box('Long folded side', (0,sign*(d/2-.002),h/2), (w,.004,h), kraft, .00065)
        a.box('Short folded end', (sign*(w/2-.002),0,h/2), (.004,d-.007,h), kraft, .00065)
        a.box('Top closure flap', (0,sign*d/4,h-.0015), (w-.002,d/2-.0008,.003), kraft, .0004)
        a.box('Bottom closure flap', (0,sign*d/4,.0015), (w-.002,d/2-.0008,.003), edge)
        a.box('Tape folded over end', (sign*(w/2+.0005),0,h-.035), (.001,.043,.07), tape)
    a.box('Tape over centre seam', (0,0,h+.0004), (w+.001,.043,.0008), tape)
    a.box('Self adhesive shipping label', (.080,-d/2-.00045,.211), (.140,.0009,.084), label)
    for i,width in enumerate([.075,.059,.044]):
        a.box('Address line', (.020+width/2,-d/2-.00096,.238-i*.008), (width,.00028,.0028), print_ink)
    for i in range(24):
        a.box('Item barcode', (.018+i*.0051,-d/2-.00098,.183), (.0012+(i*7%4)*.00052,.00028,.018), print_ink)
    for x in (-.167,-.135):
        a.box('Handling arrow stem', (x,-d/2-.00055,.077), (.004,.0007,.031), print_ink)
        a.mesh('Handling arrow head', [(x-.008,-d/2-.001,.090),(x+.008,-d/2-.001,.090),(x,-d/2-.001,.103)],
               [(0,1,2)], print_ink)
    a.box('Handling mark base', (-.151,-d/2-.00055,.057), (.057,.0007,.004), print_ink)
    return a


if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assets = [freight_box(),receiving_carton()]
    title = 'Intermodal freight'
    publish(assets, {asset.name for asset in assets}, title)
    rows = [dict(id=asset.name, sourceImages=asset.refs, description=asset.description,
               parts=len(asset.collection.objects), movableParts=list(asset.pivots)[1:],
               runtimeBytes=(OUT/(asset.name+'.glb')).stat().st_size) for asset in assets]
    (SOURCE/(title+'.json')).write_text(json.dumps(rows, indent=2)+'\n')
