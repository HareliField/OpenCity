/* Retarget the shared CMU takes to each resident's measured standing skeleton. */
globalThis.ResidentMotion = (() => {
  let data = null,
    loading = null;
  const kids = { spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'head' };
  for (const side of ['l', 'r'])
    for (const [a, b] of [
      ['clavicle', 'upperarm'],
      ['upperarm', 'lowerarm'],
      ['lowerarm', 'hand'],
      ['hand', 'middle_01'],
      ['thigh', 'calf'],
      ['calf', 'foot'],
      ['foot', 'ball']
    ])
      kids[a + '_' + side] = b + '_' + side;
  async function load() {
    if (!loading)
      loading = Promise.all(
        ['motion-bank.json', 'motion-bank.bin'].map(async (path) => {
          const response = await fetch(new URL('assets/residents/' + path, document.baseURI));
          if (!response.ok) throw Error(String(response.status));
          return path.endsWith('json') ? response.json() : response.arrayBuffer();
        })
      )
        .then(([bank, buffer]) => {
          for (const clip of Object.values(bank.clips)) {
            clip.rotations = new Int16Array(buffer, clip.q, clip.frames * bank.bones.length * 4);
            clip.positions = new Float32Array(buffer, clip.root, clip.frames * 3);
          }
          data = bank;
          return bank;
        })
        .catch((error) => {
          console.warn('Resident motion library', error);
          loading = null;
          return null;
        });
    return loading;
  }
  function duration(key) {
    const c = data?.clips[key];
    return c ? (c.frames - 1) / c.fps : 0;
  }
  function play(c, key, repeat = false) {
    if (!c?.resident || !data?.clips[key]) return false;
    c.residentTake = { key, repeat, elapsed: 0 };
    return true;
  }
  function bind(root, nodes, c) {
    root.updateMatrixWorld(true);
    const bones = Object.fromEntries(Object.entries(nodes).filter(([, n]) => n.isBone)),
      native = {};
    for (const [name, bone] of Object.entries(bones)) {
      const child = bones[kids[name]];
      native[name] = {
        q: bone.getWorldQuaternion(new THREE.Quaternion()),
        point: bone.getWorldPosition(new THREE.Vector3()),
        axis: child
          ? child
              .getWorldPosition(new THREE.Vector3())
              .sub(bone.getWorldPosition(new THREE.Vector3()))
              .normalize()
          : null
      };
    }
    const leg =
      native.thigh_l.point.distanceTo(native.calf_l.point) +
      native.calf_l.point.distanceTo(native.foot_l.point);
    const toe = native.ball_l.point.y,
      corrections = new Map();
    const p = new THREE.Vector3(),
      q0 = new THREE.Quaternion(),
      q1 = new THREE.Quaternion(),
      ownerQ = new THREE.Quaternion(),
      parentQ = new THREE.Quaternion();
    function sample(out, r, offset) {
      return out
        .set(r[offset] / 32767, r[offset + 1] / 32767, r[offset + 2] / 32767, r[offset + 3] / 32767)
        .normalize();
    }
    return () => {
      const take = c.residentTake,
        clip = data?.clips[take?.key];
      if (!clip || c.body) return;
      let fix = corrections.get(clip);
      if (!fix) {
        fix = data.bones.map((name, i) => {
          const b = native[name];
          if (!b) return null;
          const to = new THREE.Vector3().fromArray(clip.directions[i]);
          const q =
            b.axis && to.lengthSq() > 0.5
              ? new THREE.Quaternion().setFromUnitVectors(b.axis, to)
              : new THREE.Quaternion();
          return q.multiply(b.q);
        });
        corrections.set(clip, fix);
      }
      const end = duration(take.key),
        elapsed = take.repeat ? take.elapsed % Math.max(0.01, end) : Math.min(take.elapsed, end);
      const frame = elapsed * clip.fps,
        lo = Math.min(clip.frames - 1, Math.floor(frame)),
        hi = Math.min(clip.frames - 1, lo + 1),
        t = frame - lo;
      const mix =
        take.key === 'get_up'
          ? 1
          : Math.min(1, elapsed / 0.16, take.repeat ? 1 : (end - elapsed) / 0.18);
      root.parent.getWorldQuaternion(ownerQ);
      for (let i = 0; i < data.bones.length; i++) {
        const n = bones[data.bones[i]];
        if (!n || !fix[i]) continue;
        const count = data.bones.length,
          r = clip.rotations;
        sample(q0, r, 4 * (lo * count + i)).slerp(sample(q1, r, 4 * (hi * count + i)), t);
        q0.multiply(fix[i]).premultiply(ownerQ);
        n.parent.getWorldQuaternion(parentQ);
        q0.premultiply(parentQ.invert());
        n.quaternion.slerp(q0, Math.max(0, mix));
        n.updateWorldMatrix(false, false);
      }
      const at = root.parent.worldToLocal(bones.pelvis.getWorldPosition(p));
      const desired =
        toe + leg * (clip.positions[3 * lo + 1] * (1 - t) + clip.positions[3 * hi + 1] * t);
      root.position.y += (desired - at.y) * Math.max(0, mix);
      root.updateWorldMatrix(false, true);
    };
  }
  function tick(c, dt) {
    const t = c.residentTake;
    if (!t) return;
    t.elapsed += dt;
    if (!t.repeat && t.elapsed > duration(t.key)) delete c.residentTake;
  }
  return { load, bind, play, tick, duration, names: () => Object.keys(data?.clips || {}) };
})();
