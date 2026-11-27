"""Separate the photographed production shells into service panels and actual window openings.

Input is the set of fitted, UV-mapped shells published before disassembly. Source planes
are in metres in the game's +Z-forward coordinates. Clipped corners interpolate the
original UVs and vertex normals. Shared wheels and the unmodified 4K sources keep their UVs.
"""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path

import numpy as np

GAME = Path(__file__).resolve().parents[1]
MODELS = GAME / "models" / "scenery"
BASE_REVISION = "7e2da12"
DIMS = {5121:"u1", 5123:"<u2", 5125:"<u4", 5126:"<f4"}
WIDTH = {"VEC2":2, "VEC3":3, "VEC4":4, "SCALAR":1}
# (longitudinal position, height) for the door lights, (longitudinal position, lateral extent)
# for the front and rear curved windscreens. The seam coordinates follow the orthographic shells.
STUDIES = {
 "saloon": dict(h=1.43, w=.94, base=.35, seam=-.31, front=1.06, rear=-1.45,
    forward=[(-.20,.955),(.78,.946),(.79,1.005),(.59,1.186),(.28,1.319),(-.258,1.345)],
    aft=[(-1.502,1.001),(-.445,.984),(-.432,1.342),(-.65,1.337),(-.983,1.282),(-1.29,1.139)],
    wind=(.533,1.342,.447,.624), back=(-1.76,-1.15,.616,.415), lid=(1.384,2.224,.728,.715,.674)),
 "silver": dict(h=1.43,w=.94,base=.31,seam=-.296,front=.94,rear=-1.28,
    forward=[(-.106,.982),(.75,.928),(.67,1.019),(.31,1.234),(.074,1.315),(-.236,1.342)],
    aft=[(-1.247,1.063),(-.409,1.021),(-.464,1.353),(-.697,1.367),(-.923,1.323),(-1.092,1.238)],
    wind=(.13,.891,.38,.638),back=(-1.71,-1.161,.609,.411),lid=(.968,2.174,.731,.666,.651)),
 "cross": dict(h=1.68,w=.95,base=.39,seam=-.358,front=.866,rear=-1.38,
    forward=[(-.377,1.142),(.533,1.092),(.506,1.215),(.328,1.377),(.077,1.496),(-.388,1.542)],
    aft=[(-1.487,1.249),(-.497,1.151),(-.497,1.536),(-1.141,1.527),(-1.369,1.464),(-1.51,1.322)],
    wind=(-.087,.858,.516,.684),back=(-2.135,-1.892,.53,.486),lid=(.964,2.112,.704,.595,.736)),
 "coupe": dict(h=1.284,w=.975,base=.39,seam=-.806,front=.715,rear=None,
    forward=[(-.672,.949),(.494,.934),(.516,.975),(.24,1.111),(-.114,1.206),(-.677,1.208)],
    aft=[(-1.608,.973),(-.979,.978),(-.980,1.204),(-1.262,1.144),(-1.478,1.046)],
    wind=(.065,.742,.45,.69),back=(-1.951,-1.223,.68,.473),lid=(.809,2.197,.748,.708,.589)),
}
FILES = {"maroon-saloon":"saloon","graphite-city-saloon":"saloon","silver-city-sedan":"silver",
         "brick-red-crossover":"cross","coupe-driveable":"coupe"}

def planes_for_polygon(outline, axes):
    vertices=np.asarray(outline,dtype=float)
    centroid=vertices.mean(axis=0)
    result=[]
    for a,b in zip(vertices,np.roll(vertices,-1,axis=0)):
        edge=b-a
        normal=np.zeros(3)
        normal[axes[0]],normal[axes[1]]=-edge[1],edge[0]
        offset=a[0]*edge[1]-a[1]*edge[0]
        if np.dot(normal[list(axes)],centroid)+offset<0:normal,offset=-normal,-offset
        result.append((normal,offset))
    return result

def partition_face(poly,normal,offset):
    signed=poly[:,:3]@normal+offset
    if min(signed)>=-1e-9:return poly,None
    if max(signed)<=1e-9:return None,poly
    kept,rest=[],[]
    start,ds=poly[-1],signed[-1]
    for end,de in zip(poly,signed):
        if (ds>0)!=(de>0):
            vertex=start+(end-start)*(ds/(ds-de))
            kept.append(vertex);rest.append(vertex)
        (kept if de>=0 else rest).append(end)
        start,ds=end,de
    return tuple(np.asarray(rows) if len(rows)>2 else None for rows in (kept,rest))

def transverse_shapes(a,b,left,right):
    # The edge of a curved windscreen turns back at its four corners.
    dz=(b-a)*.065
    return [(a,-left*.84),(a+dz,-left),(b-dz,-right),(b,-right*.76),
            (b,right*.76),(b-dz,right),(a+dz,left),(a,left*.84)]

def part_masks(s):
    for name,target in [('Windshield','wind'),('RearGlass','back')]:
        profile=s[target]
        yield name,planes_for_polygon(transverse_shapes(*profile),(2,0))+[(np.array([0,1,0]),-s['h']*.64)]
    for side,letter in [(-1,'L'),(1,'R')]:
        outer=[(np.array([side,0,0]),-s['w']*.55)]
        for key,title in [('forward','Front'),('aft','Rear')]:
            yield 'Glass'+title+letter,planes_for_polygon(s[key],(2,1))+outer
    a,b,wa,wb,low=s['lid']
    yield 'Bonnet',planes_for_polygon(transverse_shapes(a,b,wa,wb),(2,0))+[(np.array([0,1,0]),-low)]
    for side,letter in [(-1,'L'),(1,'R')]:
        end=s['front'];seam=s['seam'];base=s['base']
        front=[(seam+.022,base),(end-.035,base+.018),(end+.005,.91*s['h']/1.43),
               (end-.37,s['h']-.18),(end-.69,s['h']-.037),(seam+.008,s['h']-.043)]
        outer=[(np.array([side,0,0]),-s['w']*.57)]
        yield 'DoorFront'+letter,planes_for_polygon(front,(2,1))+outer
        if s['rear'] is not None:
            start=s['rear']
            aft=[(start+.39,base+.035),(seam-.018,base),(seam-.016,s['h']-.052),
                 (start+.42,s['h']-.105),(start-.03,.992*s['h']/1.43),(start+.06,base+.41)]
            yield 'DoorRear'+letter,planes_for_polygon(aft,(2,1))+outer

def triangle_fan(poly):
    return [np.stack((poly[0],poly[i],poly[i+1])) for i in range(1,len(poly)-1)]

def cut_faces(tris,planes):
    corners=tris[:,:,:3]
    entirely=np.ones(len(tris),bool);possible=entirely.copy()
    for n,d in planes:
        signed=corners@n+d
        possible&=signed.max(axis=1)>=-1e-8
        entirely&=signed.min(axis=1)>=-1e-8
    inside=list(tris[entirely]);outside=list(tris[~possible])
    for poly in tris[possible&~entirely]:
        for n,d in planes:
            poly,cut=partition_face(poly,n,d)
            if cut is not None:outside.extend(triangle_fan(cut))
            if poly is None:break
        if poly is not None:inside.extend(triangle_fan(poly))
    return np.asarray(inside),np.asarray(outside)

def section(name,study,raw):
    n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
    if doc['asset'].get('extras',{}).get('sectioned'):raise ValueError('Supply the fitted shell before sectioning.')
    blob=bytearray(raw[28+n:]);views=doc['bufferViews'];accessors=doc['accessors']
    def read(i):
        a=accessors[i];v=views[a['bufferView']]
        return np.frombuffer(blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),dtype=DIMS[a['componentType']],
                             count=a['count']*WIDTH[a['type']]).reshape(-1,WIDTH[a['type']]).copy()
    def add(data,kind,atype):
        blob.extend(bytes(-len(blob)%4))
        arr=np.ascontiguousarray(data,dtype=DIMS[kind]);flat=arr.tobytes()
        index=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(flat)})
        blob.extend(flat);ac={'bufferView':index,'componentType':kind,'type':atype,'count':len(arr)}
        if atype=='VEC3':ac.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
        accessors.append(ac);return len(accessors)-1
    prim=doc['meshes'][0]['primitives'][0];attrs=prim['attributes']
    keys=['POSITION']+[k for k in attrs if k!='POSITION']
    values=[read(attrs[k]) for k in keys];spans=np.cumsum([0]+[v.shape[1] for v in values])
    uncut=np.column_stack(values)[read(prim['indices']).reshape(-1,3)]
    names={}
    for label,planes in part_masks(study):
        part,uncut=cut_faces(uncut,planes)
        if len(part)<3:raise ValueError(f'{name} has no usable {label}')
        names[label]=part
    # Keep the nodes with the original unskinned source coordinates. The game pivots linked panels at their seams.
    glass=len(doc['materials'])
    doc['materials'].append({'name':'Laminated and tempered automotive glass','alphaMode':'BLEND','doubleSided':True,
        'pbrMetallicRoughness':{'baseColorFactor':[.40,.53,.57,.34],'roughnessFactor':.105,'metallicFactor':.14}})
    root=next(i for i,o in enumerate(doc['nodes']) if o['name'] in ['VehicleShell','CoupeShell'])
    if 'mesh' in doc['nodes'][root]:
        child=dict(doc['nodes'][root],name='ExteriorBody');doc['nodes'][root]={'name':'VehicleShell','children':[len(doc['nodes'])]}
        doc['nodes'].append(child)
    def make_primitive(tris,material):
        rows,inds=np.unique(np.round(tris.reshape(-1,tris.shape[-1]),6),axis=0,return_inverse=True)
        faces=inds.reshape(-1,3);p=rows[faces,:3]
        faces=faces[np.linalg.norm(np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),axis=1)>1e-11]
        result={'material':material,'attributes':{},'indices':add(faces.reshape(-1,1),5125 if len(rows)>65535 else 5123,'SCALAR')}
        for j,k in enumerate(keys):
            ac=accessors[attrs[k]];channel=rows[:,spans[j]:spans[j+1]]
            if k=='NORMAL':channel=channel/np.maximum(1e-10,np.linalg.norm(channel,axis=1)[:,None])
            result['attributes'][k]=add(channel,ac['componentType'],ac['type'])
        return result
    doc['meshes'][0]['primitives']=[make_primitive(uncut,prim['material'])]
    def plain_material(title,rgba,roughness,metalness):
        index=len(doc['materials'])
        doc['materials'].append({'name':title,'doubleSided':True,'pbrMetallicRoughness':{
            'baseColorFactor':rgba,'roughnessFactor':roughness,'metallicFactor':metalness}})
        return index
    liner=plain_material('Pressed inner body panels',[.056,.064,.066,1],.67,.31)
    felt=plain_material('Bonnet acoustic lining',[.034,.038,.036,1],.96,0)
    trim=plain_material('Engine compartment seal',[.022,.024,.022,1],.81,.04)

    def shell_primitive(vertices,faces,mat):
        xyz=np.asarray(vertices,dtype=float)
        tris=xyz[np.asarray(faces,dtype=int)].reshape(-1,3,3)
        normal=np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0])
        good=np.linalg.norm(normal,axis=1)>1e-10
        normal=normal[good];normal/=np.linalg.norm(normal,axis=1)[:,None]
        points=tris[good].reshape(-1,3)
        faces=np.arange(len(points),dtype=np.uint32).reshape(-1,1)
        return {'material':mat,'indices':add(faces,5125 if len(points)>65535 else 5123,'SCALAR'),
                'attributes':{'POSITION':add(points,5126,'VEC3'),'NORMAL':add(np.repeat(normal,3,axis=0),5126,'VEC3')}}

    # Trace the actual paint surface in (x,z). Each hem and reinforcing rib follows its crown.
    hood=names['Bonnet'][:,:,:3]
    def hood_y(x,z):
        p=hood[:,0];a=hood[:,1]-p;b=hood[:,2]-p
        divisor=a[:,0]*b[:,2]-a[:,2]*b[:,0]
        valid=np.abs(divisor)>1e-10;den=np.where(valid,divisor,1)
        t=((x-p[:,0])*b[:,2]-(z-p[:,2])*b[:,0])/den
        u=(a[:,0]*(z-p[:,2])-a[:,2]*(x-p[:,0]))/den
        inside=valid&(t>=-.003)&(u>=-.003)&(u+t<=1.003)
        if inside.any():return np.max((p[:,1]+a[:,1]*t+b[:,1]*u)[inside])
        corners=hood.reshape(-1,3)
        return corners[np.argmin((corners[:,0]-x)**2+(corners[:,2]-z)**2),1]

    def ruled(rows,mat):
        faces=[]
        for i in range(len(rows)-1):
            k=i*2;faces.extend([(k,k+2,k+3),(k,k+3,k+1)])
        return shell_primitive([v for row in rows for v in row],faces,mat)
    a,b,wa,wb,_=study['lid']
    rim=transverse_shapes(a,b,wa,wb)
    contour=[]
    for (z0,x0),(z1,x1) in zip(rim,rim[1:]+rim[:1]):
        for f in np.linspace(0,1,7,endpoint=False):
            x,z=x0+(x1-x0)*f,z0+(z1-z0)*f
            contour.append((x,hood_y(x,z),z))
    contour.append(contour[0])
    well=[];seals=[]
    middle=(a+b)*.5
    for x,y,z in contour:
        upper=(x*.998,y-.024,middle+(z-middle)*.998)
        lower=(x*.949,max(.222,y-.48),middle+(z-middle)*.952)
        well.append([upper,lower])
        seals.append([(x*.998,y-.018,z),(x*.975,y-.028,middle+(z-middle)*.982)])
    well_mesh=len(doc['meshes'])
    doc['meshes'].append({'name':'Inner wheelhouses and engine bulkheads','primitives':[ruled(well,liner),ruled(seals,trim)]})
    doc['nodes'][root]['children'].append(len(doc['nodes']))
    doc['nodes'].append({'name':'EngineCompartment','mesh':well_mesh})
    for label,tri in names.items():
        mesh=len(doc['meshes']);is_glass='Glass' in label or label=='Windshield'
        polys=[make_primitive(tri,glass if is_glass else prim['material'])]
        if label=='Bonnet':
            inside=tri[:,[0,2,1],:].copy()
            ni=keys.index('NORMAL');begin,end=spans[ni],spans[ni+1]
            inside[:,:,:3]-=.014*inside[:,:,begin:end]
            inside[:,:,begin:end]*=-1
            polys.append(make_primitive(inside,liner))
            polys.append(ruled([[(x,y,z),(x,y-.020,z)] for x,y,z in contour],liner))
            panels=[]
            for side in [-1,1]:
                for f in np.linspace(.13,.86,9):
                    z=a+(b-a)*f
                    x0=side*(.126+.22*f);x1=side*((wa*(1-f)+wb*f)*.82)
                    panels.append([(x0,hood_y(x0,z)-.032,z),(x1,hood_y(x1,z)-.032,z)])
                polys.append(ruled(panels,felt));panels=[]
            for side in [-1,1]:
                pairs=[]
                for f in np.linspace(.09,.93,12):
                    z=a+(b-a)*f;centre=side*(.075+.22*f)
                    pairs.append([(xx,hood_y(xx,z)-.042,z) for xx in (centre-.029,centre+.029)])
                polys.append(ruled(pairs,liner))
        doc['meshes'].append({'name':label,'primitives':polys})
        doc['nodes'][root]['children'].append(len(doc['nodes']));doc['nodes'].append({'name':label,'mesh':mesh})
    doc['asset'].setdefault('extras',{})['sectioned']=True
    # Compact before publishing. The original shell's unused views do not need a second copy in the runtime file.
    used={i for mesh in doc['meshes'] for p in mesh['primitives'] for i in [p['indices'],*p['attributes'].values()]}
    imap={old:i for i,old in enumerate(sorted(used))}
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            p['indices']=imap[p['indices']];p['attributes']={k:imap[i] for k,i in p['attributes'].items()}
    doc['accessors']=[accessors[i] for i in sorted(used)]
    visible={a['bufferView'] for a in doc['accessors']}|{im['bufferView'] for im in doc.get('images',[])}
    vmap={old:i for i,old in enumerate(sorted(visible))};packed=bytearray();new_views=[]
    for i in sorted(visible):
        v=views[i].copy();start=v.get('byteOffset',0);packed.extend(bytes(-len(packed)%4))
        v['byteOffset']=len(packed);packed.extend(blob[start:start+v['byteLength']]);new_views.append(v)
    for a in doc['accessors']+doc.get('images',[]):a['bufferView']=vmap[a['bufferView']]
    doc['bufferViews']=new_views;packed.extend(bytes(-len(packed)%4));doc['buffers'][0]['byteLength']=len(packed)
    text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*(-len(text)%4)
    output=struct.pack('<4sII',b'glTF',2,28+len(text)+len(packed))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(packed),b'BIN\0')+packed
    (MODELS/(name+'.glb')).write_bytes(output)
    print(name,len(names),'separate parts',len(output),'bytes',flush=True)

def update_receipts():
    path = GAME.parent / 'Meshy Sources' / 'Asset Manifest.json'
    manifest = json.loads(path.read_text())
    for asset in manifest['assets'].values():
        records = [(asset, asset['runtime_file'])]
        records.extend((variant, variant['file']) for variant in asset.get('variants', []))
        for record, filename in records:
            if Path(filename).stem in FILES:
                record['runtime_sha256'] = hashlib.sha256((MODELS / filename).read_bytes()).hexdigest()
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input-directory',type=Path)
    args=parser.parse_args()
    for name,spec in FILES.items():
        path='commonstreet/models/scenery/'+name+'.glb'
        raw=(args.input_directory/(name+'.glb')).read_bytes() if args.input_directory else subprocess.check_output(['git','show',BASE_REVISION+':'+path],cwd=GAME)
        section(name,STUDIES[spec],raw)
    update_receipts()
