"""Rectify finishes from the supplied photographs. Run with Pillow and NumPy."""
from pathlib import Path

from math import sin, pi

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GAME = Path(__file__).resolve().parents[1]
PHOTOS = GAME / 'Visual Target References' / 'Natural Photos'
FINISHES = GAME.parent / 'Blender Sources' / 'Finishes'


def crop(number, bounds, size):
    with Image.open(next(PHOTOS.glob(f'{number:03}-*.png'))) as im:
        box = tuple(round(v * (im.width / 800 if i % 2 == 0 else im.height / 450))
                    for i, v in enumerate(bounds))
        return im.convert('RGB').crop(box).resize(size, Image.Resampling.LANCZOS)


def wrap_edges(im, margin):
    """Mirror only the texture margins so adjacent repeats meet at the same sample."""
    a = np.array(im, dtype=float)
    for axis in (0, 1):
        a = np.swapaxes(a, 0, axis)
        width = min(margin, len(a) // 4)
        for k in range(width):
            blend = .5 * (1 - k / width) ** 2
            lo, hi = a[k].copy(), a[-1-k].copy()
            a[k] = lo * (1-blend) + hi * blend
            a[-1-k] = hi * (1-blend) + lo * blend
        a = np.swapaxes(a, 0, axis)
    return Image.fromarray(np.uint8(a))


def finish(name, photo, box, size, rough, relief, tile=True):
    im = crop(photo, box, size)
    if tile:
        im = wrap_edges(im, 18)
    im.save(FINISHES / f'{name}-color.jpg', quality=94, subsampling=0)
    grey = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(.7)), dtype=float) / 255
    low = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(7)), dtype=float) / 255
    height = (grey-low) * relief
    dy, dx = np.gradient(height)
    n = np.dstack((-dx, dy, np.ones_like(dx)))
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(np.uint8(np.clip(n*.5+.5, 0, 1)*255)).save(FINISHES / f'{name}-normal.png')
    # glTF's metallic-roughness texture stores roughness in its green channel.
    values = np.uint8(np.clip(rough + (low-grey)*.4, .04, 1)*255)
    Image.fromarray(values).save(FINISHES / f'{name}-rough.png')


def build():
    FINISHES.mkdir(parents=True, exist_ok=True)
    finish('joinery', 93, (302,334,415,382), (384,180), .61, 5.5)
    finish('enamel', 26, (18,287,130,320), (256,100), .39, 1.7)
    finish('cast-iron', 112, (116,239,128,257), (80,132), .69, 2.4)
    finish('plane-bark', 18, (98,147,111,229), (96,320), .90, 5)
    finish('palm-bark', 82, (219,121,233,219), (80,254), .91, 5)
    finish('glazed-pastry', 93, (319,305,343,315), (96,56), .55, 3)
    crop(26, (20,196,106,209), (256,38)).save(FINISHES/'washer-controls.jpg', quality=95)
    crop(96, (408,144,424,159), (64,64)).save(FINISHES/'preserve-label.jpg', quality=95)
    # Independent window panes are placed behind the physical reveals. Keep the view out of the masonry.
    windows = [(18,(207,32,224,65)),(18,(261,32,278,62)),(18,(314,33,329,68)),(18,(471,32,493,68)),
               (13,(475,98,492,126)),(13,(555,99,571,130)),(13,(406,99,421,129)),(13,(587,92,599,123))]
    glass = Image.new('RGB',(512,512))
    for i,(number,box) in enumerate(windows):
        glass.paste(crop(number,box,(128,256)),(i%4*128,i//4*256))
    glass.save(GAME/'tex/shop-sash-panes.jpg', quality=92)
    # One metre of the existing scanned wall spans about five stretchers. Match its albedo
    # to the exposed masonry between the sash rows in 018, retaining the scan's mortar relief.
    palette=crop(18,(305,80,503,97),(256,32))
    mean=np.asarray(palette).mean(axis=(0,1))
    scan=Image.open(GAME/'tex/brick_red_d.webp').convert('RGB')
    base=np.asarray(scan.resize((352,352),Image.Resampling.LANCZOS),dtype=float)
    base=np.clip(base*.86*mean/base.mean(axis=(0,1))+.14*mean,0,255)
    normal=np.asarray(Image.open(GAME/'tex/brick_red_n.webp').convert('RGB').resize((352,352),Image.Resampling.LANCZOS))
    def pattern(tile):
        return np.tile(tile,(2,3,1))[:528,:1056]
    pat=pattern(base)
    mottling=np.asarray(palette.convert('L').resize((1056,528),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(21)),dtype=float)
    pat*=np.clip(.86+.14*mottling/mottling.mean(),.91,1.10)[:,:,None]
    Image.fromarray(np.uint8(np.clip(pat,0,255))).save(GAME/'tex/riverside-brick_d.webp',quality=91)
    Image.fromarray(pattern(normal)).save(GAME/'tex/riverside-brick_n.webp',quality=90)
    # Aged shop notices, book jackets and the manicure print use just the printed surfaces.
    prints=Image.new('RGB',(768,512))
    for i,(number,bounds) in enumerate([(49,(298,199,339,285)),(27,(197,232,235,250)),
              (27,(191,263,241,297)),(53,(315,284,332,308)),(53,(334,294,349,316)),(53,(350,289,363,314))]):
        prints.paste(crop(number,bounds,(256,256)),(i%3*256,i//3*256))
    prints.save(GAME/'tex/shop-prints.jpg',quality=92)
    # Linoleum and terrazzo meet at real joints. Preserve the soft mottling of floor 093,
    # removing the baked directional falloff before laying down its joint pattern.
    floor=crop(93,(48,365,176,411),(512,256))
    a=np.asarray(floor,dtype=float)
    diffuse=np.asarray(floor.filter(ImageFilter.GaussianBlur(22)),dtype=float)
    neutral=np.clip((a-diffuse)*.63+np.array([119,113,105]),0,255)
    field=wrap_edges(Image.fromarray(np.uint8(neutral)),22).resize((512,512),Image.Resampling.BICUBIC)
    edge=ImageDraw.Draw(field)
    for j in [0,255,511]:
        edge.line([(0,j),(511,j)],fill=(77,76,70),width=2);edge.line([(j,0),(j,511)],fill=(77,76,70),width=2)
    field.save(GAME/'tex/market-floor_d.webp',quality=90)
    height=np.array(field.convert('L').filter(ImageFilter.GaussianBlur(.8)),dtype=float)/255
    dy,dx=np.gradient(height);n=np.dstack((-dx*3,dy*3,np.ones_like(dx)));n/=np.linalg.norm(n,axis=-1,keepdims=True)
    Image.fromarray(np.uint8((n*.5+.5)*255)).save(GAME/'tex/market-floor_n.webp',quality=88)
    # Photographic pendants and fixtures in the shop windows need their own materials. Surface areas only.
    im = Image.open(GAME/'tex/plane-leaves.webp').convert('RGBA')
    im.thumbnail((512,512))
    im.save(FINISHES/'plane-leaves.png',optimize=True)
    # The distant palm samples the same pinnate blade arrangement as the high-detail mesh.
    palm = Image.new('RGBA',(224,512))
    pen = ImageDraw.Draw(palm)
    pen.line((112,511,112,2),fill=(109,101,60,255),width=3)
    for j in range(34):
        t=(j+.7)/35
        y=512*(1-t)
        span=17+85*sin(pi*t**.85)
        for side in [-1,1]:
            x=112+side*span
            c=65+(j*13+side*5)%24
            pen.polygon([(112,y+2),(112+side*span*.54,y-9),(x,y-21),(112+side*span*.60,y-1),(112,y+4)],fill=(c+11,c+12,c-18,255))
            pen.line((112,y+2,x,y-21),fill=(c+21,c+19,c-8,255),width=1)
    palm.save(FINISHES/'palm-spray.png',optimize=True)


if __name__ == '__main__':
    build()
