"""Register photographed facial detail to the sculpt's front UVs using landmark pairs."""
import numpy as np

def coordinates(obj):
    arr=np.empty(len(obj.data.vertices)*3,dtype=np.float32)
    obj.data.vertices.foreach_get('co',arr);return arr.reshape(-1,3)
def smoothstep(lo,hi,points):
    t=np.clip((points-lo)/(hi-lo),0,1)
    return t*t*(3-2*t)
