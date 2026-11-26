"""Project unobstructed cloud bands and sand grain from the city's reference photographs."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import map_coordinates, gaussian_filter

GAME=Path(__file__).resolve().parents[1]
PHOTOS=GAME/'Visual Target References'/'Natural Photos'

def reference(i):
    with Image.open(next(PHOTOS.glob(f'{i:03d}-*.png'))) as image:
        return image.convert('RGB')

def pixels(im, rect):
    x,y,X,Y=rect
    return im.crop((round(x*im.width/800),round(y*im.height/450),round(X*im.width/800),round(Y*im.height/450)))

def daylight():
    w,h=3072,768
    lon=np.broadcast_to((np.arange(w)[None,:]+.5)*np.pi*2/w-np.pi,(h,w))
    alt=np.broadcast_to((h-.5-np.arange(h)[:,None])*np.pi*.5/h,(h,w))
    total=np.zeros((h,w,3),dtype=np.float32)
    weight=np.zeros((h,w),dtype=np.float32)
    # The left seaward sky in 063 and the right sky in 064 are free of roofs, lamps and the sun.
    # Rectangles use an 800 by 450 working frame. Each bearing samples a photographed formation.
    cs=[(63,(6,3,381,146),158,.94),(64,(423,3,793,146),164,.96),
        (110,(533,4,791,117),154,.91),(102,(4,8,375,134),151,1.04)]
    bands=[(63,1.56),(64,-1.56),(110,2.39),(63,.74),(64,-.78),(102,-2.35),(63,3.13),(64,0.0)]
    for n,bearing in bands:
        _,rect,horizon,gain=next(q for q in cs if q[0]==n)
        im=np.asarray(reference(n),dtype=np.float32)/255
        l,top,r,bottom=rect
        a=np.arctan2(np.sin(lon-bearing),np.cos(lon-bearing))
        # The supplied images are perspective views with a horizontal FOV near 70 degrees.
        focal=505.;center=(l+r)/2
        x=center+focal*np.tan(a)
        y=horizon-focal*np.tan(alt)/np.maximum(.02,np.cos(a))
        sample=[np.clip(y,top,bottom)*im.shape[0]/450,np.clip(x,l,r)*im.shape[1]/800]
        blend=np.clip(1-np.maximum(0,np.abs(x-center)-(r-l)*.33)/((r-l)*.51),0,1)
        blend*=np.maximum(np.cos(a),0)*np.clip((y+74)/(top+74),0,1)
        for k in range(3):
            col=map_coordinates(im[:,:,k],sample,order=1,mode='nearest')
            total[:,:,k]+=col*gain*blend
        weight+=blend
    with Image.open(GAME/'tex/sky-daylight.jpg') as anc:
        upper=np.asarray(anc.crop((0,0,anc.width,anc.height//2)).resize((w,h)),dtype=np.float32)/255
    # Preserve the upper hemisphere from the environmental probe where the photograph ends.
    field=total/np.maximum(.001,weight[:,:,None])
    fade=np.minimum(1,weight)[:,:,None]*np.clip((.43-alt)/.16,0,1)[:,:,None]
    finished=upper*(1-fade)+field*fade
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

if __name__=='__main__':
    daylight();sand()
