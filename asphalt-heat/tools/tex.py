import subprocess,os,numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
OUT='/home/claude/v3/tex/'
# name: (asset, diffuse size, normal size, grey?, rough?)
T={'asphalt':('asphalt_02',1024,1024,0,1),'sidewalk':('concrete_pavement',1024,512,0,1),'plaza':('concrete_tiles_02',1024,512,0,0),
 'brick_red':('red_brick_03',1024,512,0,0),'brick_dark':('brick_wall_10',1024,512,0,0),'brick_orange':('brick_wall_006',1024,512,0,0),'brick_tan':('yellow_brick',1024,512,0,0),'brick_factory':('factory_brick',1024,512,0,0),
 'stucco':('white_stucco',512,512,1,0),'plaster':('painted_plaster_wall',512,512,1,0),'concrete':('concrete_wall_008',1024,512,1,0),'panels':('concrete_slab_wall',1024,512,1,0),
 'tiles_dark':('rectangular_facade_tiles',1024,512,0,0),'stone_dark':('large_sandstone_blocks',1024,512,0,0),'stone_light':('white_sandstone_blocks_02',1024,512,0,0),
 'corrugated':('corrugated_iron',512,512,1,0),'container':('container_side',512,512,1,0),'shutter':('painted_metal_shutter',512,512,1,0),
 'sand':('coast_sand_01',1024,512,0,0),'grass':('leafy_grass',1024,512,0,0),'planks':('brown_planks_09',1024,512,0,0),
 'roof_clay':('clay_roof_tiles',512,512,0,0),'roof_gravel':('gravel_concrete',512,256,0,0)}
def dl(a,m):
    f=f'src/{a}_{m}.jpg'
    if not os.path.exists(f):
        r=subprocess.run(['curl','-s','-f','-o',f,f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{a}/{a}_{m}_1k.jpg'])
        if r.returncode: return None
    return f
def one(kv):
    n,(a,ds,ns,grey,rough)=kv
    d=dl(a,'diff'); nm=dl(a,'nor_gl')
    im=Image.open(d).convert('RGB').resize((ds,ds),Image.LANCZOS)
    if grey:
        g=np.asarray(im).astype(np.float32).mean(2);g=g/np.percentile(g,90)*235;im=Image.fromarray(np.clip(g,0,255).astype(np.uint8)).convert('RGB')
    im.save(OUT+n+'_d.webp',quality=78,method=6)
    if nm: Image.open(nm).convert('RGB').resize((ns,ns),Image.LANCZOS).save(OUT+n+'_n.webp',quality=82,method=6)
    if rough:
        r=dl(a,'rough')
        if r: Image.open(r).convert('L').resize((512,512),Image.LANCZOS).save(OUT+n+'_r.webp',quality=75)
    return n,bool(nm)
with ThreadPoolExecutor(8) as ex: print(list(ex.map(one,T.items())))
