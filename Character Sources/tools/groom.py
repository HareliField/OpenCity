"""Lay editable strands over each fitted hair mass and shape the fringe independently."""
import math
import random
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from build_cast import linear_colour

def groom(rig,person,colours):
    scene=bpy.context.scene
    hair=next((o for o in scene.objects if o.name.startswith('Hair_')),None)
    if not hair:return
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=hair.evaluated_get(deps);tree=BVHTree.FromObject(hair,deps)
    corners=[Vector(p) for p in evaluated.bound_box]
    xmin,xmax=min(p.x for p in corners),max(p.x for p in corners)
    zmin,zmax=min(p.z for p in corners),max(p.z for p in corners)
    width=xmax-xmin;height=zmax-zmin
    if min(width,height)<.01:return
    rng=random.Random(person['residentId']+' hair')
    curve=bpy.data.curves.new('Individual hair strands','CURVE');curve.dimensions='3D'
    curve.resolution_u=2;curve.bevel_resolution=1;curve.bevel_depth=.00031
    strand=bpy.data.objects.new('Individual hair strands',curve);scene.collection.objects.link(strand)
    colour=linear_colour(colours['Hair']);material=bpy.data.materials.new('Strand pigment')
    material.diffuse_color=colour;material.use_nodes=True
    bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=colour;bs.inputs['Roughness'].default_value=.4
    curve.materials.append(material)
    def add(points):
        spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
        for i,(p,co) in enumerate(zip(spline.bezier_points,points)):
            p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
            p.radius=.92-(i/(len(points)-1))**2*.83
    part=rng.uniform(-.18,.18)*width
    for _ in range(250):
        start=rng.uniform(xmin*.83,xmax*.83);top=zmax-rng.uniform(.03,.55)*height
        sign=1 if start>part else -1
        reach=rng.uniform(.05,.18)*width;length=rng.uniform(.08,.30)*height
        points=[]
        for i in range(6):
            t=i/5
            x=start+sign*reach*(t**.76);z=top-length*t
            loc,n,_,_=tree.ray_cast((x,-1,z),(0,1,0))
            if loc is None or points and (loc-points[-1]).length>.028:break
            points.append(loc+n*(.00075+.0006*math.sin(math.pi*t)))
        if len(points)>2:add(points)
    if 'fringe' in person['appearance'].lower():
        body=next(o for o in scene.objects if o.name=='Body');surface=BVHTree.FromObject(body,deps)
        eyes=next(o for o in scene.objects if o.name=='Eyes').evaluated_get(deps)
        brow=max(p[2] for p in eyes.bound_box)+.011
        for _ in range(190):
            x0=rng.uniform(-.23,.22)*width;x1=x0+width*rng.uniform(.06,.22)
            top=zmax-height*rng.uniform(.12,.26);end=brow+rng.uniform(-.008,.014)
            points=[]
            for i in range(7):
                t=i/6;x=x0+(x1-x0)*t;z=top*(1-t)+end*t
                a,_,_,_=tree.ray_cast((x,-1,z),(0,1,0));b,_,_,_=surface.ray_cast((x,-1,z),(0,1,0))
                hits=[q for q in (a,b) if q is not None]
                if not hits:break
                front=min(q.y for q in hits)-.001-.002*math.sin(math.pi*t);points.append(Vector((x,front,z)))
            if len(points)>3:add(points)
    rest=strand.matrix_world.copy();strand.parent=rig;strand.parent_type='BONE';strand.parent_bone='head'
    bpy.context.view_layer.update();strand.matrix_world=rest
