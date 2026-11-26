"""Sample calibrated ground surfaces, roofing and retail fabrics from the district photographs."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter

GAME=Path(__file__).resolve().parents[1]
PHOTOS=GAME/'Visual Target References'/'Natural Photos'
FINISHES=GAME.parent/'Blender Sources'/'Finishes'


def planar_patch(number,corners,size):
    """Four corners follow the plane clockwise from the upper left in an 800 × 450 preview."""
    with Image.open(next(PHOTOS.glob(f'{number:03}-*.png'))) as photo:
        xy=np.asarray(corners)*[photo.width/800,photo.height/450]
        equations=[];values=[]
        for (u,v),(x,y) in zip([(0,0),(size,0),(size,size),(0,size)],xy):
            equations.extend(([u,v,1,0,0,0,-u*x,-v*x],[0,0,0,u,v,1,-u*y,-v*y]))
            values.extend((x,y))
        coeff=np.linalg.solve(equations,values)
        return np.asarray(photo.convert('RGB').transform((size,size),Image.Transform.PERSPECTIVE,
                          coeff,Image.Resampling.BICUBIC),dtype=float)


def join_edges(a,width):
    a=a.copy()
    for ax in [0,1]:
        b=np.swapaxes(a,0,ax)
        for i in range(width):
            v=.5*(1-i/width)**2
            lo=b[i].copy();hi=b[-1-i].copy()
            b[i]=lo*(1-v)+hi*v;b[-1-i]=hi*(1-v)+lo*v
    return a


def normal(height,relief):
    dy,dx=np.gradient(height*relief)
    a=np.dstack((-dx,dy,np.ones_like(dx)));a/=np.linalg.norm(a,axis=2)[:,:,None]
    return np.uint8(np.clip((a*.5+.5)*255,0,255))


def asphalt():
    # Stay inside the curb, clear of the double yellow line, cars and vertical reflections.
    # The source road converges on (641,177). Remove its illumination before relighting it in 3D.
    pieces=[];size=512
    for i,(left,right,top,bottom) in enumerate([(294,598,330,447),(190,382,364,446),
                                              (369,572,353,441),(227,431,344,443)]):
        f=(top-177)/(bottom-177)
        patch=planar_patch(66,[(641+(left-641)*f,top),(641+(right-641)*f,top),(right,bottom),(left,bottom)],size)
        grey=patch.mean(axis=2)
        grain=grey-gaussian_filter(grey,16)+.17*(gaussian_filter(grey,16)-gaussian_filter(grey,59))
        pieces.append(np.rot90(join_edges(grain,24),i))
    h=join_edges(np.block([[pieces[0],pieces[1]],[pieces[2],pieces[3]]]),29)
    # Sub-pixel aggregate in the original scan supplies the closest quarter metre of detail.
    scan=np.asarray(Image.open(GAME/'tex/asphalt_d.webp').convert('L').resize((1024,1024)),dtype=float)
    h+=.46*(scan-gaussian_filter(scan,2.2))
    albedo=np.clip(np.array([88,87,84])[None,None,:]+h[:,:,None]*1.39,0,255).astype('uint8')
    rough=np.uint8(np.clip(209+h*.52,144,243));directory=GAME/'tex'
    Image.fromarray(albedo).save(directory/'street-asphalt_d.webp',quality=95)
    Image.fromarray(normal(h/255,2.65)).save(directory/'street-asphalt_n.webp',quality=93)
    Image.fromarray(rough).save(directory/'street-asphalt_r.webp',quality=94)


def workshop():
    roof=planar_patch(38,[(222,281),(287,276),(301,332),(236,339)],512)
    light=roof.mean(axis=2);grit=light-gaussian_filter(light,9)+.36*(gaussian_filter(light,9)-light.mean())
    grit=join_edges(grit,27);rgb=np.clip([105,101,94]+grit[:,:,None]*1.04,0,255).astype('uint8')
    Image.fromarray(rgb).save(GAME/'tex/quay-roof_d.webp',quality=93)
    Image.fromarray(normal(grit/255,3.7)).save(GAME/'tex/quay-roof_n.webp',quality=91)
    p=planar_patch(38,[(647,136),(665,139),(665,156),(648,152)],144).mean(axis=2)
    detail=join_edges(np.clip(p-gaussian_filter(p,6),-9,9),12)
    Image.fromarray(np.uint8(np.clip([209,210,204]+detail[:,:,None]*.61,0,255))).save(FINISHES/'white-cargo-skin.jpg',quality=94)
    weave=np.asarray(Image.open(FINISHES/'salon-upholstery-color.jpg').convert('L'),dtype=float)
    fibre=weave-gaussian_filter(weave,3.2)
    for i,(r,g,b) in enumerate([(59,60,62),(80,64,52),(48,59,73),(118,88,60),(89,87,78),(62,75,87)]):
        tex=np.clip(np.array([r,g,b])+fibre[:,:,None]*.72,0,255).astype('uint8')
        Image.fromarray(tex).save(FINISHES/f'coat-weave-{i}.jpg',quality=94)


def supply_front():
    # Four surveyed corners of the photographed corrugated elevation, excluding its roof.
    square=planar_patch(38,[(256.2,156.1),(525.8,144.6),(517.9,207.4),(259.45,223.7)],1024)
    face=Image.fromarray(np.uint8(square)).resize((896,235),Image.Resampling.LANCZOS)
    face.crop((230,35,472,99)).resize((512,139),Image.Resampling.LANCZOS).save(GAME/'tex/harbor-fascia.webp',quality=96)
    field=np.asarray(face,dtype=float).copy()
    # Remove the products, sign and apertures. Those parts have depth and separate materials in game.
    for l,t,r,b in [(8,187,220,235),(86,47,139,117),(222,22,480,235),(505,177,703,235),
                    (567,48,661,116),(719,93,846,235),(751,0,809,57)]:
        for x in range(l,r):
            u=143+(x-l)%58
            rows=field[t:b,u].copy()
            if b>184:rows[max(0,184-t):]=field[max(t,184):b,856+(x%16)]
            field[t:b,x]=rows
    # Lift the persistent camera-side shade, keep uneven fasteners, weathered joints and base grime.
    shade=gaussian_filter(field.mean(axis=(1,2)),13)
    field+=np.clip((177-shade)*.41,-14,23)[:,None,None]
    field=np.clip(field*.75+np.array([195,193,181])*.25,0,255)
    detail=field.mean(axis=2)-gaussian_filter(field.mean(axis=2),2.6)
    Image.fromarray(np.uint8(field)).save(GAME/'tex/harbor-sheet_d.webp',quality=96)
    Image.fromarray(normal(detail/255,4.2)).save(GAME/'tex/harbor-sheet_n.webp',quality=94)


if __name__=='__main__':
    asphalt()
    workshop()
    supply_front()
