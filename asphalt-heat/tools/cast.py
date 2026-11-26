import subprocess,json,os,shutil
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
A='Adults/';P='Professions/'
CAST={ # name: (ratio, bodyTexSize, role)
 'Male_Adult_07':(1,1024,'player'),
 'Male_Adult_01':(.55,512,'m'),'Male_Adult_02':(.55,512,'m'),'Male_Adult_04':(.55,512,'m'),'Male_Adult_05':(.55,512,'m'),'Male_Adult_08':(.55,512,'m'),'Male_Adult_09':(.55,512,'m'),'Male_Adult_11':(.55,512,'m'),'Male_Adult_12':(.55,512,'m'),
 'Business_Male_01':(.55,512,'m'),'Business_Male_02':(.55,512,'m'),'Construction_Male_01':(.55,512,'m'),'Male_Adult_03':(.6,512,'clerk'),
 'Female_Adult_01':(.55,512,'f'),'Female_Adult_02':(.55,512,'f'),'Female_Adult_03':(.55,512,'f'),'Female_Adult_05':(.55,512,'f'),'Female_Adult_06':(.55,512,'f'),'Female_Adult_07':(.55,512,'f'),'Female_Adult_09':(.55,512,'f'),
 'Business_Female_01':(.55,512,'f'),'Business_Female_02':(.55,512,'f'),
 'Sports_Male_01':(.55,512,'beach'),'Sports_Female_01':(.55,512,'beach'),
 'Male_Adult_10':(.6,512,'gang'),'Male_Adult_06':(.6,512,'gang'),
 'Police_Male_01':(.7,512,'cop'),'Police_Male_02':(.7,512,'swat'),'Military_Male_01':(.7,512,'army'),'Security_Male_01':(.65,512,'guard'),'Medical_Male_01':(.55,512,'medic'),'Medical_Female_01':(.55,512,'medic')}
OUT='/home/claude/v3/models/'
def one(kv):
    n,(r,sz,role)=kv
    res=subprocess.run(['node','conv.mjs',n,str(r),OUT+n+'.json'],capture_output=True,text=True)
    info=json.load(open(f'/home/claude/rb/out/{n}.info'))
    for kind,t in info['tex'].items():
        im=Image.open(f'/home/claude/rb/out/{t}.webp')
        s=sz if kind in('body','equipment') else (512 if kind in('head','opacity') else 256)
        if role!='player' and kind=='head': s=384
        if im.size[0]>s: im=im.resize((s,s),Image.LANCZOS)
        im.save(OUT+'ctex/'+t+'.webp',quality=80,method=6)
    return res.stdout.strip().split('\n')[-1]+' '+res.stderr[-200:]
with ThreadPoolExecutor(6) as ex:
    for l in ex.map(one,CAST.items()): print(l)
json.dump({k:v[2] for k,v in CAST.items()},open(OUT+'cast.json','w'))
