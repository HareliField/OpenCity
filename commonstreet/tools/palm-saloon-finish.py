"""Bake the rear elevation in photograph 001 onto the existing four-door saloon's UV islands."""
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

GAME=Path(__file__).resolve().parents[1]
MODELS=GAME/'models/scenery'
doc_bytes=(MODELS/'maroon-saloon.glb').read_bytes()
size=struct.unpack_from('<I',doc_bytes,12)[0]
gltf=json.loads(doc_bytes[20:20+size])
raw=doc_bytes[28+size:]
views=gltf['bufferViews']

def view(i):
    v=views[i];start=v.get('byteOffset',0)
    return raw[start:start+v['byteLength']]

def accessor(i):
    a=gltf['accessors'][i]
    channels={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    return np.frombuffer(view(a['bufferView']),dtype=dtype,offset=a.get('byteOffset',0),
                         count=a['count']*channels).reshape(a['count'],channels)

def bitmap(i):
    return Image.open(io.BytesIO(view(gltf['images'][i]['bufferView']))).convert('RGB')

def ramp(a,low,high):
    return np.clip((a-low)/(high-low),0,1)

paint=np.asarray(bitmap(1),dtype=np.float32)
r,g,b=paint.transpose(2,0,1)
mask=ramp(r-g,3,14)*ramp(r-b,4,17)*(1-ramp(r,145,190))
tone=.27*r+.46*g+.27*b
charcoal=np.stack([.47*tone+4,.53*tone+8,.60*tone+12],axis=-1)
finish=paint+mask[:,:,None]*(charcoal-paint)
photo=np.asarray(Image.open(next((GAME/'Visual Target References/Natural Photos').glob('001-*'))).convert('RGB'))
primitive=gltf['meshes'][0]['primitives'][0]
positions=accessor(primitive['attributes']['POSITION'])
texcoords=accessor(primitive['attributes']['TEXCOORD_0'])*[finish.shape[1]-1,finish.shape[0]-1]
indices=accessor(primitive['indices']).reshape(-1,3)
# Project only rear-facing triangles. Chrome, windows, grime and panel seams elsewhere keep their original measured UVs.
for tri in indices:
    p=positions[tri]
    if p[:,2].min()>-1.87 or p[:,1].max()<.25 or p[:,1].min()>1.0:continue
    norm=np.cross(p[1]-p[0],p[2]-p[0]);length=np.linalg.norm(norm)
    if length<1e-8 or -norm[2]/length<.24:continue
    uv=texcoords[tri];origin=uv[0];m=np.stack([uv[1]-origin,uv[2]-origin],axis=-1)
    if abs(np.linalg.det(m))<.025:continue
    x0,y0=np.maximum(0,np.floor(uv.min(axis=0))).astype(int)
    x1,y1=np.minimum([finish.shape[1]-1,finish.shape[0]-1],np.ceil(uv.max(axis=0))).astype(int)
    yy,xx=np.mgrid[y0:y1+1,x0:x1+1]
    weight=(np.stack([xx+.5,yy+.5],axis=-1)-origin)@np.linalg.inv(m).T
    keep=(weight[:,:,0]>=-.008)&(weight[:,:,1]>=-.008)&(weight.sum(axis=-1)<=1.008)
    if not keep.any():continue
    points=p[0]+weight@(p[1:]-p[0])
    px,py,pz=points.transpose(2,0,1)
    # Source image is 1672 by 941. The lens sees the back of the northbound car, so its right is model -X.
    u=np.clip(838.2-127.0*px,719,955).astype(int)
    v=np.clip(682.2-140.2*py,528,660).astype(int)
    alpha=ramp(-pz,1.88,2.14)*ramp(py,.258,.40)*(1-ramp(py,.91,1.02))*(1-ramp(abs(px),.858,.96))*ramp(-norm[2]/length,.24,.66)
    blend=(alpha*keep)[:,:,None]
    region=finish[y0:y1+1,x0:x1+1]
    region+=blend*(photo[v,u].astype(np.float32)-region)

orm=np.asarray(bitmap(2),dtype=np.float32)
small=np.asarray(Image.fromarray(np.uint8(mask*255)).resize((orm.shape[1],orm.shape[0]),Image.Resampling.LANCZOS))/255
orm[:,:,1]=(1-small)*orm[:,:,1]+small*67
orm[:,:,2]=(1-small)*orm[:,:,2]+small*112
new={}
for i,pixels,fmt in [(1,finish,'JPEG'),(2,orm,'PNG')]:
    stream=io.BytesIO();im=Image.fromarray(np.uint8(np.clip(pixels,0,255)))
    im.save(stream,fmt,**({'quality':94,'subsampling':0} if fmt=='JPEG' else {'optimize':True}))
    new[gltf['images'][i]['bufferView']]=stream.getvalue()
binary=bytearray()
for i,v in enumerate(views):
    content=new[i] if i in new else view(i)
    while len(binary)%4:binary.append(0)
    v['byteOffset']=len(binary);v['byteLength']=len(content);binary.extend(content)
while len(binary)%4:binary.append(0)
gltf['buffers'][0]['byteLength']=len(binary)
gltf['materials'][0]['name']='Deep graphite lacquer and smoked glazing'
gltf['nodes'][1]['name']='GraphiteBody'
gltf['asset']['extras']={'reference':'001-palm-avenue-drive.png','sourceMesh':'maroon-saloon','finish':'Graphite paint with projected rear light and panel evidence'}
header=json.dumps(gltf,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
total=28+len(header)+len(binary)
(MODELS/'graphite-city-saloon.glb').write_bytes(struct.pack('<4sIIII',b'glTF',2,total,len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary)

