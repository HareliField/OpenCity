"""Blender mesh and export utilities for the Asphalt Heat object library."""
from collections import defaultdict
from math import cos, pi, sin, sqrt
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

GAME = Path(__file__).resolve().parents[1]
SOURCE = GAME.parent / 'Blender Sources'
FINISHES = SOURCE / 'Finishes'
OUT = GAME / 'models' / 'scenery'
TAU = 2*pi


def rgb(hex_value):
    def linear(c):
        c = int(c,16)/255
        return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
    return tuple(linear(hex_value[i:i+2]) for i in (0,2,4)) + (1.0,)


def material(name, color, roughness=.7, metal=0, finish=None, image=None, alpha=1, cutout=False, two_sided=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = not (two_sided or cutout)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = rgb(color)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Alpha'].default_value = alpha
    mat.diffuse_color = (*rgb(color)[:3], alpha)

    def read(filename, scalar=False):
        node = nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(FINISHES/filename), check_existing=True)
        if scalar:
            node.image.colorspace_settings.name = 'Non-Color'
        return node

    if finish or image:
        tex = read(f'{finish}-color.jpg' if finish else image)
        links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if cutout:
            # A threshold exports as glTF MASK, including depth and shadow passes.
            cut = nodes.new('ShaderNodeMath')
            cut.operation = 'GREATER_THAN'
            cut.inputs[1].default_value = .43
            links.new(tex.outputs['Alpha'], cut.inputs[0])
            links.new(cut.outputs[0], bs.inputs['Alpha'])
    if finish:
        norm = nodes.new('ShaderNodeNormalMap')
        norm.inputs['Strength'].default_value = .72
        links.new(read(f'{finish}-normal.png', True).outputs[0],norm.inputs['Color'])
        links.new(norm.outputs[0],bs.inputs['Normal'])
        links.new(read(f'{finish}-rough.png', True).outputs[0],bs.inputs['Roughness'])
    return mat


class Asset:
    def __init__(self, name, references, description):
        self.name, self.refs, self.description = name, references, description
        self.collection = bpy.data.collections.new(name)
        self.collection.asset_mark()
        self.collection.asset_data.description = description
        self.collection['reference_images'] = references
        self.pivots = {'Frame': (0,0,0)}

    def mesh(self, name, verts, faces, mat, smooth=False, bevel=0, uvs=None, group='Frame'):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(mat)
        if bevel:
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES')
            bm.to_mesh(mesh)
            bm.free()
        mesh.update()
        obj = bpy.data.objects.new(name,mesh)
        self.collection.objects.link(obj)
        obj['assembly'] = group
        uv_layer = mesh.uv_layers.new(name='UVMap')
        lo = [min(v.co[j] for v in mesh.vertices) for j in range(3)]
        span = [max(.00001,max(v.co[j] for v in mesh.vertices)-lo[j]) for j in range(3)]
        for poly in mesh.polygons:
            poly.use_smooth = smooth
            n = poly.normal
            major = max(range(3),key=lambda k:abs(n[k]))
            a,b = ((1,2),(0,2),(0,1))[major]
            for k,vi in zip(poly.loop_indices,poly.vertices):
                v = mesh.vertices[vi].co
                uv_layer.data[k].uv = uvs[vi] if uvs else ((v[a]-lo[a])/span[a],(v[b]-lo[b])/span[b])
        return obj

    def box(self,name,at,size,mat,bevel=0,group='Frame'):
        x,y,z = at
        w,d,h = (v/2 for v in size)
        vs = [(x+i*w,y+j*d,z+k*h) for k in (-1,1) for j in (-1,1) for i in (-1,1)]
        fs = [(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)]
        return self.mesh(name,vs,fs,mat,bevel=bevel,group=group)

    def surface(self,name,rows,mat,group='Frame',smooth=True):
        width = len(rows[0])
        vs = [p for row in rows for p in row]
        fs = [(i*width+j,i*width+j+1,(i+1)*width+j+1,(i+1)*width+j)
              for i in range(len(rows)-1) for j in range(width-1)]
        return self.mesh(name,vs,fs,mat,smooth=smooth,group=group)

    def tube(self,name,points,radii,mat,sides=12,group='Frame',flute=0):
        path = [Vector(p) for p in points]
        radii = [radii]*len(path) if isinstance(radii,(float,int)) else radii
        vs, uvs = [], []
        s = 0
        total = sum((b-a).length for a,b in zip(path,path[1:]))
        previous = None
        for i,p in enumerate(path):
            if i:
                s += (p-path[i-1]).length
            direction = (path[min(len(path)-1,i+1)]-path[max(0,i-1)]).normalized()
            if previous is None:
                seed = Vector((1,0,0)) if abs(direction.x)<.82 else Vector((0,1,0))
                radial = (seed-direction*direction.dot(seed)).normalized()
            else:
                radial = (previous-direction*direction.dot(previous)).normalized()
            tangent = direction.cross(radial).normalized()
            previous = radial
            for j in range(sides+1):
                theta = TAU*j/sides
                r = radii[i]*(1+flute*cos(theta*12))
                vs.append(p + r*(radial*cos(theta)+tangent*sin(theta)))
                uvs.append((j/sides,s/max(.00001,total)))
        n = sides+1
        fs = [(i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j) for i in range(len(path)-1) for j in range(sides)]
        fs.extend((tuple(range(sides-1,-1,-1)),tuple((len(path)-1)*n+j for j in range(sides))))
        return self.mesh(name,vs,fs,mat,smooth=True,uvs=uvs,group=group)

    def turn(self,name,x,y,profile,mat,sides=24,group='Frame',flute=0):
        return self.tube(name,[(x,y,z) for z,r in profile],[r for z,r in profile],mat,sides,group,flute)

    def ring(self,name,center,radius,wire,mat,normal=(0,0,1),steps=32,group='Frame'):
        c,axis = Vector(center),Vector(normal).normalized()
        cross = Vector((1,0,0)) if abs(axis.x)<.85 else Vector((0,1,0))
        a = (cross-axis*axis.dot(cross)).normalized()
        b = axis.cross(a)
        points = [c+radius*(a*cos(i*TAU/steps)+b*sin(i*TAU/steps)) for i in range(steps+1)]
        return self.tube(name,points,wire,mat,7,group)


def bake_contacts(asset):
    # Raycast in physical metres against every solid part. Do not bake glass or moving shadows.
    verts,faces=[],[]
    solid=[]
    for obj in asset.collection.objects:
        mat=obj.data.materials[0]
        alpha=mat.node_tree.nodes.get('Principled BSDF').inputs['Alpha']
        if alpha.is_linked or alpha.default_value<.99 or mat.name=='Keeper house lime render':
            colors=obj.data.color_attributes.new(name='Local occlusion',type='BYTE_COLOR',domain='POINT')
            obj.data.color_attributes.active_color=colors
            for value in colors.data:
                value.color=(1,1,1,1)
            continue
        solid.append(obj)
        if obj['assembly']!='Frame':
            continue
        offset=len(verts)
        verts.extend(v.co.copy() for v in obj.data.vertices)
        faces.extend([offset+i for i in p.vertices] for p in obj.data.polygons)
    tree=BVHTree.FromPolygons(verts,faces)
    samples=16
    rays=[Vector((sqrt(1-u)*cos(i*2.399963),sqrt(1-u)*sin(i*2.399963),sqrt(u)))
          for i in range(samples) for u in [(i+.5)/samples]]
    radius=.58 if asset.name in ('patisserie-case','grocery-cooler','municipal-pump','condenser-bank') else .27
    normal_axis=Vector((0,0,1))
    for obj in solid:
        me=obj.data
        colors=me.color_attributes.new(name='Local occlusion',type='BYTE_COLOR',domain='POINT')
        me.color_attributes.active_color=colors
        for v in me.vertices:
            norm=v.normal.normalized()
            orient=normal_axis.rotation_difference(norm)
            pt=v.co+norm*.0028
            blocked=0
            for direction in rays:
                _,_,_,dist=tree.ray_cast(pt,orient@direction,radius)
                if dist is not None:
                    blocked+=1-(dist/radius)**.75
            q=1-.64*blocked/samples
            colors.data[v.index].color=(q,q,q,1)


def publish(assets, runtime, library="City object library"):
    """Pack named editable source collections. Bake world-space parts into one mesh per working pivot."""
    scene = bpy.context.scene
    scene.name = library
    for i,asset in enumerate(assets):
        if not any(t in asset.name for t in ('palm','sycamore')):
            bake_contacts(asset)
        exhibit = bpy.data.objects.new(asset.name,None)
        scene.collection.objects.link(exhibit)
        exhibit.instance_type = 'COLLECTION'
        exhibit.instance_collection = asset.collection
        exhibit.location = ((i%4)*10,(i//4)*12,0)
    for im in bpy.data.images:
        if im.filepath and not im.packed_file:
            im.pack()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(library+'.blend')),compress=True)
    export = bpy.data.collections.new('Runtime export')
    scene.collection.children.link(export)
    for asset in assets:
        if asset.name not in runtime:
            continue
        groups = defaultdict(list)
        # A mesh with disconnected pieces retains its individual materials and UV islands.
        for obj in asset.collection.objects:
            groups[obj['assembly']].append(obj)
        parts = []
        for name,objects in groups.items():
            for prev in bpy.context.selected_objects:
                prev.select_set(False)
            pivot = Vector(asset.pivots[name])
            clones = []
            for obj in objects:
                clone = obj.copy()
                clone.data = obj.data.copy()
                export.objects.link(clone)
                clone.select_set(True)
                clones.append(clone)
            active = clones[0]
            bpy.context.view_layer.objects.active = active
            if len(clones)>1:
                bpy.ops.object.join()
            active.name = name
            active.data.transform(Matrix.Translation(-pivot))
            active.location = pivot
            parts.append(active)
        for obj in parts:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/f'{asset.name}.glb'),export_format='GLB',
                                  use_selection=True,export_animations=False,export_cameras=False,
                                  export_lights=False,export_vertex_color='ACTIVE',export_extras=False,export_yup=True,export_tangents=False)
        for obj in parts:
            bpy.data.objects.remove(obj,do_unlink=True)
