"""Attach each resident's characteristic listening gesture to their poseable rig."""
import math
import random
import bpy

def listening(rig,person):
    words=person['appearance'].lower()
    r=random.Random('gesture'+person['residentId'])
    peak=r.randint(24,44);end=peak+r.randint(24,42)
    joint,axis,angle='head',2,r.uniform(-4.2,4.2)
    if 'tilt' in words:joint,axis,angle='head',1,-7
    elif 'nod' in words:joint,axis,angle='head',0,6.5
    elif 'shoulder' in words:joint,axis,angle='spine_03',1,3.8
    elif 'sleeve' in words:joint,axis,angle='lowerarm_l',2,4.5
    elif 'finger' in words:joint,axis,angle='index_02_r',0,-21
    elif 'lift a hand' in words:joint,axis,angle='lowerarm_r',0,-9
    bone=rig.pose.bones.get(joint)
    if not bone:return
    bone.rotation_mode='XYZ'
    for frame,value in [(1,0),(peak,math.radians(angle)),(end,0)]:
        bone.rotation_euler[axis]=value;bone.keyframe_insert(data_path='rotation_euler',index=axis,frame=frame)
    action=rig.animation_data.action;action.name=person['name']+' listening'
    action['residentId']=person['residentId'];action['direction']=person['appearance']
    bpy.context.scene.frame_end=end;bpy.context.scene.frame_set(1)
