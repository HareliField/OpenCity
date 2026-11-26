import subprocess,sys,os,re,json
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
R='https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Avatars/'
def get(url,out):
    return subprocess.run(['curl','-s','-f','-L','--max-time','180','-o',out,url]).returncode==0
def one(path):
    name=path.split('/')[-1]
    if os.path.exists(f'out/{name}.done'): return
    fbx=f'out/{name}.fbx'
    if not get(R+path+f'/Export/{name}.fbx',fbx): print('FAIL',name);return
    s=subprocess.run(['strings','-n','5',fbx],capture_output=True,text=True).stdout
    tex=sorted(set(re.findall(r'([A-Za-z0-9_]+_color)\.tga',s)))
    info={'name':name,'tex':{}}
    for t in tex:
        tg=f'out/{t}.tga'
        if not get(R+path+f'/Textures/{t}.tga',tg): print(' notex',t);continue
        im=Image.open(tg); kind=t.split('_')[1]
        sz=1024 if kind in('body','equipment') else 512
        if kind=='opacity': im=im.convert('RGBA')
        else: im=im.convert('RGB')
        im=im.resize((sz,sz),Image.LANCZOS)
        im.save(f'out/{t}.webp',quality=82,method=6)
        if kind in('body','head'): im.resize((256,256)).save(f'out/{t}_prev.jpg')
        info['tex'][kind]=t; os.remove(tg)
    subprocess.run(['/home/claude/tools/node_modules/fbx2gltf/bin/Linux/FBX2glTF','-b','-i',fbx,'-o',f'out/{name}'],capture_output=True)
    json.dump(info,open(f'out/{name}.info','w')); open(f'out/{name}.done','w').close(); print('ok',name,tex,flush=True)
L=[f'Adults/Male_Adult_{i:02d}' for i in range(1,13)]+[f'Adults/Female_Adult_{i:02d}' for i in range(1,11)]+['Professions/'+n for n in ['Business_Male_01','Business_Male_02','Business_Female_01','Business_Female_02','Police_Male_01','Police_Male_02','Police_Female_01','Military_Male_01','Military_Male_02','Security_Male_01','Medical_Male_01','Medical_Female_01','Construction_Male_01','Sports_Male_01','Sports_Female_01']]
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(6) as ex: list(ex.map(one,L))
print('ALLDONE')
