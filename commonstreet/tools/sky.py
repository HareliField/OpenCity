import cv2,numpy as np
im=cv2.imread('h/klop4k.hdr',cv2.IMREAD_UNCHANGED)[:,:,:3].astype(np.float32)[:,:,::-1]  # RGB
H,W,_=im.shape
# find sun column
lum=im.mean(2); sy,sx=np.unravel_index(np.argmax(cv2.GaussianBlur(lum,(0,0),8)),lum.shape); print('sun at',sx,sy,W,H)
# roll so sun is at u=0.25 (we'll map in-engine); keep track
shift=int(W*0.25-sx); im=np.roll(im,shift,axis=1)
v=np.linspace(0,1,H)[:,None]          # 0 top .. .5 horizon
el=np.clip((0.5-v)/0.5,0,1)            # 1 zenith .. 0 horizon
u=np.linspace(0,1,W)[None,:]
az=np.cos((u-0.25)*2*np.pi)            # 1 toward sun
# grading
x=im*0.5
l=x.mean(2,keepdims=True)
sat=1.35; x=np.clip(l+(x-l)*sat,0,None)
warm=np.array([1.55,0.80,0.42],np.float32); cool=np.array([0.50,0.50,0.86],np.float32); mid=np.array([1.15,0.70,0.75],np.float32)
k=(np.clip(1-el*1.25,0,1)**1.6)[:,:,None]
k2=np.clip(el*1.6,0,1)[:,:,None]        # high
sunw=(0.6+0.4*az)[:,:,None]
tint=warm*k*sunw+mid*k*(1-sunw)+(1-k)*(mid*(1-k2)+cool*k2)
tint=tint/ (k*sunw+k*(1-sunw)+(1-k)) 
x=x*tint
# clouds get pink highlights: brighten warm where luminance high & near sun
x[:,:,0]*=1+0.25*np.clip(l[:,:,0]-0.5,0,2)*np.clip(az,0,1)
# below horizon: fade to haze colour
hz=cv2.GaussianBlur(x[int(H*0.49):int(H*0.5)].mean(0,keepdims=True),(0,0),40)
below=(v>0.5)[:,:,None]; fade=np.clip((v-0.5)/0.08,0,1)[:,:,None]
ground=np.array([0.10,0.09,0.10],np.float32)
x=np.where(below,hz*(1-fade)+ground*fade,x)
np.save('sky_lin.npy',x.astype(np.float16))
def aces(x):
    a=2.51;b=.03;c=2.43;d=.59;e=.14
    return np.clip((x*(a*x+b))/(x*(c*x+d)+e),0,1)
ld=(aces(x)**(1/2.2)*255).astype(np.uint8)
cv2.imwrite('sky_prev.jpg',cv2.resize(ld[:,:,::-1],(1520,760))[:440])
# engine textures: backdrop stored *linear-ish pre-tonemap* compressed with gamma so engine tonemaps it like the rest
enc=np.clip(x/4.0,0,1)**(1/2.2)   # stores up to 4.0 radiance
cv2.imwrite('/home/claude/v3/tex/sky.jpg',(enc*255).astype(np.uint8)[:H//2+64][:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,88])
small=cv2.resize(enc,(1024,512),interpolation=cv2.INTER_AREA)
cv2.imwrite('/home/claude/v3/tex/env.jpg',(small*255).astype(np.uint8)[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,88])
print('sun elevation deg',(0.5-sy/H)*180)
