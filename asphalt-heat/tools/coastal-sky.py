"""Recover the low evening sky from references 048 and 050 and complete the unobserved panorama."""
from pathlib import Path
from math import pi

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

GAME=Path(__file__).resolve().parents[1]
PHOTOS=GAME/'Visual Target References'/'Natural Photos'
SUN_AZ=-.423
SUN_ALT=.051


def photo(n):
    return np.asarray(Image.open(next(PHOTOS.glob(f'{n:03}-*.png'))).convert('RGB'),dtype=float)/255


def sampled(im,x,y):
    dx=im.shape[1]/800;dy=im.shape[0]/450
    return np.stack([map_coordinates(im[:,:,c],[y*dy,x*dx],order=1,mode='nearest') for c in range(3)],axis=-1)


def build():
    W,H=2048,1024
    az=(np.arange(W)[None,:]+.5)/W*2*pi-pi
    alt=(.5-(np.arange(H)[:,None]+.5)/H)*pi
    az=np.broadcast_to(az,(H,W));alt=np.broadcast_to(alt,(H,W))
    rel=np.arctan2(np.sin(az-SUN_AZ),np.cos(az-SUN_AZ))
    old=np.asarray(Image.open(GAME/'tex/sky.jpg').convert('RGB').resize((W,H),Image.Resampling.LANCZOS),dtype=float)/255
    # The existing panorama supplies overhead cloud forms. Recover neutral cloud contrast and
    # scale the light sky gradually toward the cooler opposite horizon sampled from 048.
    radiance=4*old**2.2;cloud=np.maximum(0,radiance.mean(axis=2))
    base=np.clip(cloud/(cloud+.64),0,1)**(1/2.2)
    warm=(.5+.5*np.cos(rel))**2*np.exp(-np.maximum(0,alt)*3.4)
    sky=(base*.23+.47)[:,:,None]*np.array([.95,1.04,1.14])
    sky+=warm[:,:,None]*[.21,.14,.045]
    # Sources are rectilinear. Project a band of sky-only pixels back onto spherical directions.
    # All people, architecture, sea and the ground lie below or beside the sampled rectangles.
    for n,center,focal,horizon,xrange,yrange,amplitude in [
        (48,SUN_AZ-np.arctan((741-400)/535),535,192,(112,789),(3,167),.71),
        (50,SUN_AZ-np.arctan((700-400)/459),459,168,(442,795),(2,161),1.)]:
        angle=np.arctan2(np.sin(az-center),np.cos(az-center))
        cs=np.cos(angle);x=400+np.tan(angle)*focal
        y=horizon-np.tan(alt)*focal/np.maximum(.001,cs)
        xa,xb=xrange;ya,yb=yrange
        horizontal=np.clip((x-xa+112)/150,0,1)*np.clip((xb+112-x)/150,0,1)
        upper=np.clip((y-ya+44)/74,0,1)
        blend=((cs>0)*upper*horizontal*amplitude)[:,:,None]
        # Continue the last clear sky row down to the astronomical horizon. A hard lower edge
        # here would put a grey rectangle above the sea for the whole length of the beach.
        source=sampled(photo(n),np.clip(x,xa,xb),np.clip(y,ya,yb))
        sky=sky*(1-blend)+source*blend
    # Feed an inverse filmic response to the real-time HDR backdrop and matching specular environment.
    linear=np.clip(sky,0,.99)**2.2
    qa=2.51-2.43*linear;qb=.03-.59*linear
    rad=(-qb+np.sqrt(qb*qb+.56*linear*qa))/(2*qa)
    disc=(rel*np.cos(SUN_ALT))**2+(alt-SUN_ALT)**2
    rad+=np.exp(-disc/.000024)[:,:,None]*[3.1,2.48,1.48]
    horizon=rad[H//2-1:H//2].copy()
    below=np.clip(-alt/.12,0,1)[:,:,None]
    rad=np.where((alt<0)[:,:,None],horizon*(1-below)+np.array([.19,.18,.17])*below,rad)
    skyout=Image.fromarray(np.uint8(255*np.clip(rad/4,0,1)**(1/2.2)))
    skyout.save(GAME/'tex/sky-coastal-evening.jpg',quality=91,subsampling=0)
    skyout.resize((512,256),Image.Resampling.LANCZOS).save(GAME/'tex/env-coastal-evening.jpg',quality=91)


if __name__=='__main__':
    build()
