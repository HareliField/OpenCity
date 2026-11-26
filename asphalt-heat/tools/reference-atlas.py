"""Rebuild the exterior window bays from the city's own Natural Photos (Pillow and NumPy)."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GAME = Path(__file__).resolve().parents[1]
PHOTOS = GAME / 'Visual Target References' / 'Natural Photos'
TILE = 384
# Each entry is one complete storey and bay. Corners run clockwise from top left,
# in the 800 x 450 review frame. The last rectangle bounds the glazing in the rectified tile.
BAYS = [
    [(18, [(296,12),(350,12),(350,84),(296,84)], (.25,.26,.69,.82)),
     (18, [(350,12),(405,12),(405,84),(350,84)], (.25,.26,.68,.81)),
     (41, [(566,68),(631,68),(631,146),(566,146)], (.39,.27,.84,.94)),
     (11, [(291,46),(374,46),(374,137),(291,137)], (.34,.25,.86,.88))],
    [(13, [(447,74),(519,70),(519,145),(447,149)], (.24,.27,.89,.89)),
     (13, [(520,70),(600,66),(600,139),(520,143)], (.23,.28,.88,.90)),
     (104, [(680,42),(724,53),(720,100),(674,90)], (.21,.28,.83,.82)),
     (13, [(382,74),(446,73),(446,148),(382,150)], (.25,.26,.85,.88))],
    [(16, [(468,67),(531,76),(523,170),(463,158)], (.15,.27,.88,.83)),
     (16, [(532,77),(597,86),(583,181),(524,170)], (.13,.27,.84,.84)),
     (16, [(599,87),(664,96),(647,195),(584,181)], (.13,.28,.85,.85)),
     (16, [(665,96),(733,106),(713,210),(648,195)], (.12,.27,.86,.85))],
    [(94, [(214,91),(291,90),(301,206),(236,208)], (.04,.21,.94,.94)),
     (94, [(291,90),(361,90),(365,205),(301,206)], (.045,.20,.95,.94)),
     (94, [(362,90),(435,89),(432,204),(365,205)], (.045,.21,.96,.94)),
     (94, [(435,89),(509,89),(502,202),(432,204)], (.045,.21,.95,.94))],
]
def build():
    atlas = Image.new('RGB', (4*TILE, 4*TILE))
    relief = Image.new('RGB', atlas.size)
    for row, family in enumerate(BAYS):
        for col, (number, corners, window) in enumerate(family):
            with Image.open(next(PHOTOS.glob(f'{number:03}-*.png'))) as src:
                scale = (src.width/800, src.height/450)
                quad = [v*scale[k] for i in (0,3,2,1) for k,v in enumerate(corners[i])]
                tile = src.convert('RGB').transform((TILE,TILE), Image.Transform.QUAD, quad, Image.Resampling.BICUBIC)
            surface = Image.new('L', (TILE,TILE), 201)
            glazing = Image.new('L', surface.size)
            outer = tuple(round(v*TILE) for v in window)
            ImageDraw.Draw(surface).rectangle(outer, fill=85, outline=205, width=4)
            x0,y0,x1,y1 = outer
            inner = (x0+5,y0+5,x1-5,y1-5)
            ImageDraw.Draw(glazing).rectangle(inner, fill=239)
            if row < 2:
                for axis in ('x','y'):
                    cx,cy = (x0+x1)//2, (y0+y1)//2
                    edge = (cx-1,y0,cx+1,y1) if axis=='x' else (x0,cy-1,x1,cy+1)
                    ImageDraw.Draw(glazing).rectangle(edge,fill=0)
                    ImageDraw.Draw(surface).rectangle(edge,fill=171)
            values = np.asarray(surface.filter(ImageFilter.GaussianBlur(2)),dtype=float)/255
            dy,dx = np.gradient(values)
            normals = np.stack((np.clip(.5-dx*3,0,1),np.clip(.5+dy*3,0,1),np.asarray(glazing)/255),axis=2)
            pos=(col*TILE,row*TILE)
            atlas.paste(tile,pos)
            relief.paste(Image.fromarray(np.uint8(normals*255)),pos)
    atlas.save(GAME/'tex/reference-bays.jpg',quality=93,subsampling=0)
    relief.save(GAME/'tex/reference-bays-material.png',optimize=True)

if __name__=='__main__':
    build()
