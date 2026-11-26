"""Headless Blender reconstruction of the white two-axle dry-freight truck in photograph 038.
The wheel prototype has its axle along X. Its companion cab faces +Z after glTF export.
"""
from math import cos, pi, sin
from mathutils import Vector
from city_modeling import material


def build_truck(asset):
    a=asset('harbor-box-truck',[38,59],'Riveted dry-freight box, rolled rear door, separately glazed cab and independently spinning commercial wheels.')
    white=material('Warm white fleet enamel','dbd9cf',.38,.23)
    cargo=material('Aged white aluminium cargo skin','c7c8c1',.59,.31,image='white-cargo-skin.jpg')
    silver=material('Brushed rub rail','abaea7',.43,.69)
    black=material('Chassis and rubber','363935',.78,.19)
    rubber=material('Commercial tyre compound','30312e',.95)
    cast=material('Cast steel','707671',.65,.5)
    glass=material('Blue smoked cab glass','657777',.17,.21,alpha=.74,two_sided=True)
    vinyl=material('Charcoal vinyl','474b49',.82)
    orange=material('Amber marker','d29443',.26,.18)
    red=material('Red stop lens','a74239',.27,.17)
    head=material('Fluted headlamp glass','ccc8b4',.21,.30)
    plate=material('Ivory registration plate','d8cbb6',.51)
    def xyz(pt):
        x,y,z=pt
        return (x,-z,y)
    def box(name,at,size,mat,bevel=0,group='Frame'):
        return a.box(name,xyz(at),(size[0],size[2],size[1]),mat,bevel,group)
    def line(name,pts,rad,mat,side=10,group='Frame'):
        return a.tube(name,[xyz(pt) for pt in pts],rad,mat,side,group)
    def face(name,pts,mat,group='Frame'):
        idx=tuple(range(len(pts)))
        vs=[Vector(xyz(pt)) for pt in pts]
        centre=sum(vs,Vector())/len(vs)
        normal=sum((vs[j].cross(vs[(j+1)%len(vs)]) for j in idx),Vector())
        if normal.dot(centre-Vector(xyz((0,1.08,1.45))))<0:idx=idx[::-1]
        return a.mesh(name,vs,[idx],mat,group=group)
    axle,r=1.92,.397
    for side in [-1,1]:
        box('Ladder chassis',(.512*side,.547,-.012),(.113,.235,5.92),black,.009)
        for z in [-2.06,-1.64,.84,1.71]:box('Cab and body outrigger',(.702*side,.739,z),(.38,.108,.09),cast,.008)
    for z in [-2.71,-1.19,-.11,1.00,2.65]:box('Crossmember',(0,.548,z),(1.13,.21,.095),cast,.013)
    for z in [-axle,axle]:line('Axle tube',[(-.90,r,z),(.90,r,z)],.062,cast,18)
    box('Fuel tank',(-.695,.566,-.43),(.437,.34,1.08),cast,.071)
    for z in [-.757,-.096]:box('Tank strap',(-.695,.56,z),(.450,.352,.044),black,.042)
    # Bed and outer corners surround the photo's smooth white box.
    box('Box floor',(0,.947,-1.015),(2.16,.178,4.44),silver,.018)
    for side in [-1,1]:
        box('Bonded cargo side',(side*1.051,2.018,-1.025),(.024,2.062,4.402),cargo,.010)
        for k in range(10):
            box('Internal rubbing strip',(side*1.022,1.122+k*.183,-1.025),(.028,.034,4.32),silver,.004)
    box('Freight bulkhead',(0,2.018,1.162),(2.105,2.058,.045),white,.012)
    for j in range(18):
        box('Cargo floor board',(-.975+j*.115,1.052,-1.025),(.113,.018,4.33),cast,.003)
    a.pivots['Bonnet']=xyz((0,1.359,2.251))
    a.pivots['Windshield']=xyz((0,1.375,2.263))
    box('Roof cap',(0,3.039,-1.026),(2.163,.065,4.443),silver,.016)
    for s in [-1,1]:
        for y in [1.052,1.164,3.004]:box('Rolled side rail',(s*1.068,y,-1.025),(.033,.056,4.42),silver,.008)
        for z in [-3.197,1.148]:box('Corner extrusion',(s*1.071,2.034,z),(.047,2.045,.078),silver,.011)
        for j in range(5):
            z=-3.02+j*.964
            box('Cargo panel seam',(s*1.064,2.05,z),(.010,1.99,.010),silver,.002)
            for k in range(10):
                y=1.211+k*.191
                line('Panel rivet',[(s*1.065,y,z),(s*1.071,y,z)],.0092,silver,8)
        for z in [-3.056,-1.27,.955]:box('Amber running light',(s*1.090,1.126,z),(.027,.040,.123),orange,.010)
    for j in range(11):
        name='CargoSlat%02d'%j;y=1.155+j*.172
        a.pivots[name]=xyz((0,y,-3.239))
        box('Roll-up door board',(0,y,-3.239),(1.946,.174,.032),cargo,.006,name)
        box('Interlocking rolled hem',(0,y+.081,-3.261),(1.932,.012,.018),silver,.003,name)
        for x in [-.866,.866]:
            box('Door hinge strap',(x,y,-3.216),(.052,.092,.015),cast,.005,name)
    for x in [-.968,.968]:box('Roll-up guide',(x,2.026,-3.269),(.035,1.929,.039),silver,.007)
    for x in [-.311,.311]:box('Tail lift bracket',(x,.782,-3.13),(.084,.358,.112),black,.008)
    box('Rear underrun bar',(0,.54,-3.30),(2.12,.139,.090),silver,.016)
    box('Step edge',(0,.88,-3.272),(2.14,.11,.14),black,.009)
    for s in [-1,1]:
        box('Rear tail lamp backing',(s*.80,.922,-3.274),(.32,.127,.085),black,.011)
        box('Rear red lens',(s*.795,.922,-3.322),(.24,.083,.018),red,.009)
        box('Rear mudflap',(s*.862,.407,-2.46),(.464,.54,.035),rubber,.013)
    box('Tail number plate',(0,.918,-3.327),(.343,.122,.012),plate,.008)
    # Side panels follow a true circular opening over the front suspension axle.
    for side in [-1,1]:
        x=.884*side; z0,z1=.997,3.276
        roof=[(x,1.287,z0),(x,1.354,1.51),(x,1.257,2.27),(x,1.206,3.01),(x,1.07,z1)]
        lower=[(x,.64,z1),(x,.599,2.34)]
        lower += [(x,r+.471*sin(t*pi/32),axle+.471*cos(t*pi/32)) for t in range(33)]
        lower.extend([(x,.522,1.445),(x,.53,z0)])
        face('Stamped wing and recessed sill',roof+lower,white)
        for n in range(32):
            t=n*pi/32;u=(n+1)*pi/32
            yz=lambda d,ang:(r+d*sin(ang),axle+d*cos(ang))
            outer=side*.895;inner=side*.691
            y0,z0=yz(.474,t);y1,z1=yz(.474,u)
            face('Inner arch liner',[(outer,y0,z0),(inner,y0,z0),(inner,y1,z1),(outer,y1,z1)],black)
        edgepoints=[(side*.904,r+.473*sin(t*pi/26),axle+.473*cos(t*pi/26)) for t in range(27)]
        line('Beaded fender opening',edgepoints,.018,white,7)
        outline=[(side*.899,.583,1.094),(side*.899,1.25,1.082),(side*.824,2.149,1.15),
                 (side*.82,2.173,1.70),(side*.888,1.38,2.266),(side*.898,1.21,2.222)]
        line('Door jamb',outline,.010,black,6)
        pane=[(side*.887,1.422,1.123),(side*.828,2.108,1.185),(side*.823,2.119,1.69),(side*.882,1.414,2.189)]
        for j in range(4):line('Door window rubber',[pane[j],pane[(j+1)%4]],.024,black,8)
        letter='R' if side>0 else 'L'
        pane_id='GlassFront'+letter
        a.pivots[pane_id]=xyz((side*.887,1.422,1.123))
        face('Door side glass',pane,glass,pane_id)
        box('Pull handle',(side*.906,1.294,1.231),(.055,.047,.153),black,.012)
        box('Turn marker',(side*.902,1.122,2.726),(.026,.049,.102),orange,.008)
        line('Mirror mount',[(side*.882,1.533,2.037),(side*1.046,1.567,2.05),(side*1.095,1.63,1.996)],.023,black)
        box('Mirror casing',(side*1.096,1.712,1.992),(.114,.265,.136),black,.039)
        box('Mirror face',(side*1.096,1.712,1.928),(.099,.234,.015),silver,.016)
        box('Entry tread',(side*.868,.428,1.256),(.26,.082,.68),black,.019)
        for j in range(7):box('Anti-slip tread rib',(side*.883,.472,1.0+j*.081),(.216,.009,.012),cast)
        box('Seat base',(side*.426,.99,1.374),(.49,.15,.506),vinyl,.064)
        box('Seatback',(side*.426,1.301,1.134),(.466,.642,.128),vinyl,.062)
    box('Cab rear panel',(0,1.335,1.059),(1.756,1.626,.103),white,.022)
    box('Cab roof',(0,2.155,1.433),(1.698,.092,.714),white,.048)
    glass_pts=[(-.850,1.375,2.263),(.850,1.375,2.263),(.801,2.107,1.695),(-.801,2.107,1.695)]
    for i in range(4):
        line('Windshield rubber',[glass_pts[i],glass_pts[(i+1)%4]],.032,black)
        if i%2:line('Rolled windshield post',[glass_pts[i],glass_pts[(i+1)%4]],.049,white)
    face('Laminated front light',glass_pts,glass,'Windshield')
    for x in [-.458,.405]:
        line('Wiper blade',[(x-.26,1.418,2.224),(x+.283,1.447,2.194)],.014,black,7)
        line('Wiper arm',[(x+.175,1.356,2.278),(x-.086,1.431,2.207)],.010,black,7)
    bonnet=[(-.861,1.359,2.251),(.861,1.359,2.251),(.876,1.186,3.209),(.798,1.126,3.291),(-.798,1.126,3.291),(-.876,1.186,3.209)]
    face('Sloping bonnet',bonnet,white,'Bonnet')
    for side in [-1,1]:line('Hood pressing',[(side*.651,1.368,2.259),(side*.685,1.194,3.172)],.016,white,10,'Bonnet')
    box('Front grille surround',(0,.918,3.249),(1.723,.441,.147),white,.069)
    box('Inset cooling grille',(0,.934,3.324),(.939,.275,.022),black,.016)
    for k in range(5):box('Horizontal grille bar',(0,.825+k*.052,3.338),(.920,.014,.012),silver,.004)
    for s in [-1,1]:
        box('Front light surround',(s*.672,.998,3.308),(.346,.158,.077),black,.025)
        box('Fluted main lens',(s*.647,.998,3.349),(.261,.124,.016),head,.016)
        box('Indicator',(s*.803,.993,3.344),(.045,.113,.023),orange,.007)
    box('Front bumper',(0,.624,3.237),(1.802,.183,.201),black,.042)
    box('Front number plate',(0,.629,3.349),(.352,.123,.014),plate,.006)
    box('Dashboard',(0,1.268,2.108),(1.642,.195,.265),vinyl,.058)
    # Prototype mesh and hub share the same axle pivot as all four game suspension wheels.
    group='WheelPrototype';a.pivots[group]=(0,0,0)
    rings=[(-.117,.017),(-.116,.245),(-.108,.344),(-.083,.383),(-.055,r),(.058,r),
           (.094,.384),(.114,.352),(.124,.266),(.132,.255),(.144,.243),(.142,.21),(.113,.168),(.135,.09),(.144,.022)]
    for i,((x0,r0),(x1,r1)) in enumerate(zip(rings,rings[1:])):
        rows=[[xyz((x,rad*sin(2*pi*j/48),rad*cos(2*pi*j/48))) for j in range(49)] for x,rad in [(x0,r0),(x1,r1)]]
        a.surface('Steel wheel barrel' if i>7 else 'Commercial tread',rows,cast if i>7 else rubber,group)
    for k in range(8):
        t=2*pi*k/8
        line('Stamped rim aperture',[(.131,.19*sin(t),.19*cos(t)),(.138,.19*sin(t),.19*cos(t))],.030,black,13,group)
        line('Hex wheel nut',[(.126,.106*sin(t+.24),.106*cos(t+.24)),(.15,.106*sin(t+.24),.106*cos(t+.24))],.017,silver,6,group)
    return a
