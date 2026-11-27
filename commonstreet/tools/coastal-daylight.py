"""Project unobstructed cloud bands and sand grain from the city's reference photographs."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import map_coordinates, gaussian_filter, distance_transform_edt

GAME=Path(__file__).resolve().parents[1]
PHOTOS=GAME/'Visual Target References'/'Natural Photos'

def reference(i):
    with Image.open(next(PHOTOS.glob(f'{i:03d}-*.png'))) as image:
        return image.convert('RGB')

def photo_sky_mask(number):
    # The lower edge follows the roofs, crowns and sea horizon in the supplied view.
    # Leave a feather on the sky side so no silhouette enters the environment texture.
    line={
        1:[(0,73),(22,70),(48,66),(74,82),(94,76),(123,83),(145,89),
           (174,94),(174,73),(222,73),(222,90),(289,96),(289,62),
           (338,62),(340,108),(357,129),(385,129),(399,102),(399,52),
           (441,52),(442,76),(451,49),(472,32),(477,13),(501,9),
           (514,11),(514,6),(541,0),(800,0)],
        63:[(0,151),(356,151),(391,149),(402,137),(419,137),(438,140),
            (458,132),(480,128),(499,123),(523,121),(537,114),(558,102),
            (579,102),(584,89),(613,88),(629,94),(647,100),(671,92),
            (685,79),(720,73),(744,79),(763,81),(783,84),(800,85)]
    }[number]
    mask=Image.new('L',(800,450))
    draw=ImageDraw.Draw(mask)
    draw.polygon([(0,0),(800,0),*reversed(line)],fill=255)
    if number==1:
        draw.line([(28,24),(52,29),(80,44),(102,61),(104,86)],fill=0,width=8)
    valid=np.asarray(mask)>0
    valid[:,[0,-1]]=False
    return np.clip(distance_transform_edt(valid)/23,0,1)**1.15

def daylight():
    w,h=3072,768
    lon=np.broadcast_to((np.arange(w)[None,:]+.5)*np.pi*2/w-np.pi,(h,w))
    alt=np.broadcast_to((h-.5-np.arange(h)[:,None])*np.pi*.5/h,(h,w))
    total=np.zeros((h,w,3),dtype=np.float32)
    weight=np.zeros((h,w),dtype=np.float32)
    # Build continuous cloud cover for directions outside the two measured camera views.
    # Safe strips overlap in bearing and share a common horizon.
    cs=[(63,(6,3,381,146),158,.94),(64,(423,3,793,146),164,.96),
        (110,(533,4,791,117),154,.91),(102,(4,8,375,134),151,1.04)]
    bands=[(63,1.56),(64,-1.56),(110,2.39),(63,.74),(64,-.78),(102,-2.35),(63,3.13),(64,0.0)]
    for n,bearing in bands:
        _,rect,horizon,gain=next(q for q in cs if q[0]==n)
        im=np.asarray(reference(n),dtype=np.float32)/255
        l,top,r,bottom=rect
        a=np.arctan2(np.sin(lon-bearing),np.cos(lon-bearing))
        focal=505.;center=(l+r)/2
        x=center+np.tan(a)*(r-l)/2/np.tan(.67)
        y=horizon-focal*np.tan(alt)/np.maximum(.02,np.cos(a))
        sample=[np.clip(y,top,bottom)*im.shape[0]/450,np.clip(x,l,r)*im.shape[1]/800]
        blend=np.clip(1-np.abs(a)/.67,0,1)**1.4
        blend*=np.clip((y-top+12)/27,0,1)*np.clip((bottom+29-y)/24,0,1)
        for k in range(3):
            col=map_coordinates(im[:,:,k],sample,order=1,mode='nearest')
            total[:,:,k]+=col*gain*blend
        weight+=blend
    with Image.open(GAME/'tex/sky-daylight.jpg') as anc:
        upper=np.asarray(anc.crop((0,0,anc.width,anc.height//2)).resize((w,h)),dtype=np.float32)/255
    # Preserve the upper hemisphere from the environmental probe where the photograph ends.
    field=total/np.maximum(.001,weight[:,:,None])
    fade=np.clip(weight*2.1,0,1)[:,:,None]*np.clip((.49-alt)/.17,0,1)[:,:,None]
    finished=upper*(1-fade)+field*fade
    # Reproject the complete visible sky of each hero view in its actual camera direction.
    # The mask is computed before projection so a sign, tree or tower cannot appear in the clouds.
    for n,bearing,horizon,focal in [(1,-np.pi/2,193,505.),(63,np.pi/2,155,505.)]:
        a=np.arctan2(np.sin(lon-bearing),np.cos(lon-bearing))
        x=400+focal*np.tan(a)
        y=horizon-focal*np.tan(alt)/np.maximum(.01,np.cos(a))
        # Fold the soft cloud formations at the source lens edge while feathering into the zenith.
        sample_y=np.where(y<1.,1.+(1.-y)*.72,y)
        weight=map_coordinates(photo_sky_mask(n),[sample_y,x],order=1,mode='constant')
        weight*=np.clip((y+60)/53,0,1)*np.maximum(0,np.sign(np.cos(a)))
        im=np.asarray(reference(n),dtype=np.float32)/255
        uv=[np.clip(sample_y*im.shape[0]/450,0,im.shape[0]-1),np.clip(x*im.shape[1]/800,0,im.shape[1]-1)]
        for k in range(3):
            sample=map_coordinates(im[:,:,k],uv,order=1,mode='nearest')
            finished[:,:,k]=finished[:,:,k]*(1-weight)+sample*weight
    Image.fromarray(np.uint8(np.clip(finished*255,0,255))).save(GAME/'tex/coastal-clouds.webp',quality=93)

def sand():
    # Rectify a sunlit patch without pier shadow, furniture or the walker in 063.
    im=reference(63)
    coords=((329,318),(249,449),(599,449),(549,318))
    quad=tuple(v for x,y in coords for v in (x*im.width/800,y*im.height/450))
    src=im.transform((768,512),Image.Transform.QUAD,quad,Image.Resampling.BICUBIC)
    a=np.asarray(src,dtype=np.float32)/255
    base=gaussian_filter(a,(16,16,0));grain=a-base
    toned=np.clip(grain*1.34+(base-base.mean(axis=(0,1)))*.40+np.array([.641,.548,.438]),0,1)
    # Opposite edge samples are blended over forty pixels for a continuous granular finish.
    y,x=np.indices(toned.shape[:2]);sx=np.clip(np.minimum(x,767-x)/40,0,1)[:,:,None];sy=np.clip(np.minimum(y,511-y)/40,0,1)[:,:,None]
    toned=toned*sx+np.roll(toned,384,1)*(1-sx)
    toned=toned*sy+np.roll(toned,256,0)*(1-sy)
    col=Image.fromarray(np.uint8(toned*255));col.save(GAME/'tex/pier-sand_d.webp',quality=95)
    h=np.asarray(col.convert('L').filter(ImageFilter.GaussianBlur(.60)),dtype=np.float32)/255
    dy,dx=np.gradient(h)
    norm=np.stack((-dx*3.6,dy*3.6,np.ones_like(h)),axis=-1)
    norm/=np.linalg.norm(norm,axis=2,keepdims=True)
    Image.fromarray(np.uint8((norm*.5+.5)*255)).save(GAME/'tex/pier-sand_n.webp',quality=93)

def timber():
    # Board ends, occluders and the pedestrian's shadow fall outside these quadrilaterals.
    image=reference(64)
    def rectify(points,size):
        uv=tuple(v for x,y in points for v in (x*image.width/800,y*image.height/450))
        return np.asarray(image.transform(size,Image.Transform.QUAD,uv,Image.Resampling.BICUBIC),dtype=np.float32)/255
    def finish(raw,target):
        blur=gaussian_filter(raw,(7,17,0))
        return np.clip(target+1.1*(raw-blur)+.56*(blur-blur.mean(axis=(0,1))),0,1)
    def normal(raw,strength):
        y,x=np.gradient(gaussian_filter(raw.mean(axis=2),.62))
        n=np.stack((-x*strength,y*strength,np.ones_like(x)),axis=2)
        n/=np.linalg.norm(n,axis=2,keepdims=True);return Image.fromarray(np.uint8((.5*n+.5)*255))
    color=np.array([.456,.422,.357])
    boards=finish(rectify([(446,375),(445,448),(799,417),(799,344)],(768,384)),color)
    Image.fromarray(np.uint8(boards*255)).save(GAME/'tex/pier-timber_d.webp',quality=94)
    normal(boards,5.2).save(GAME/'tex/pier-timber_n.webp',quality=94)
    single=finish(rectify([(467,405),(467,415),(780,386),(780,376)],(512,80)),color)
    out=GAME.parent/'Blender Sources'/'Finishes'
    Image.fromarray(np.uint8(single*255)).save(out/'pier-timber-color.jpg',quality=95)
    normal(single,3.7).save(out/'pier-timber-normal.png')
    Image.fromarray(np.uint8((.88+single.mean(axis=2)*.09)*255)).save(out/'pier-timber-rough.png')

if __name__=='__main__':
    daylight();sand();timber()
