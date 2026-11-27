/* Sweep the moving body against the current head, torso and limbs on this floor. */
globalThis.ResidentContact = (() => {
  const native = { Spine2: 'spine_03', Head: 'head' };
  for (const [a, b] of [
    ['Left', 'l'],
    ['Right', 'r']
  ])
    for (const [k, n] of [
      ['Thigh', 'thigh'],
      ['Calf', 'calf'],
      ['Foot', 'foot'],
      ['Arm', 'upperarm'],
      ['ForeArm', 'lowerarm'],
      ['Hand', 'hand']
    ])
      native[a + k] = n + '_' + b;
  const cache = new WeakMap(),
    v = new THREE.Vector3(),
    point = [0, 0, 0];
  const bones = [
    ['Spine2', 'Head', 0.145],
    ['LeftThigh', 'Spine2', 0.155],
    ['RightThigh', 'Spine2', 0.155],
    ['LeftThigh', 'LeftCalf', 0.087],
    ['LeftCalf', 'LeftFoot', 0.067],
    ['RightThigh', 'RightCalf', 0.087],
    ['RightCalf', 'RightFoot', 0.067],
    ['LeftArm', 'LeftForeArm', 0.067],
    ['LeftForeArm', 'LeftHand', 0.054],
    ['RightArm', 'RightForeArm', 0.067],
    ['RightForeArm', 'RightHand', 0.054]
  ];
  function segments(actor) {
    const c = actor.c,
      existing = cache.get(c);
    if (existing?.time === time) return existing.parts;
    const fitted = ResidentCast.bones(c),
      nodes = c.bones || {},
      parts = [],
      coords = new Map();
    function get(key) {
      if (coords.has(key)) return coords.get(key);
      const n = fitted?.[native[key]] || nodes[key];
      if (!n) return null;
      n.getWorldPosition(v);
      const a = [v.x, v.y, v.z];
      coords.set(key, a);
      return a;
    }
    for (const [from, to, r] of bones) {
      const a = get(from),
        b = get(to);
      if (a && b) parts.push([a, b, r]);
    }
    if (!parts.length || (!actor.c.body && actor.mode !== 'gettingUp')) {
      const a = actor.pos;
      parts.unshift([[a.x, a.y + 0.32, a.z], [a.x, a.y + 1.32, a.z], 0.18]);
    }
    cache.set(c, { time, parts });
    return parts;
  }
  function push(p, r, y, motion, owner = null) {
    const x0 = motion.startX,
      z0 = motion.startZ;
    if (!Number.isFinite(x0) || !Number.isFinite(z0)) return null;
    const dx = p.x - x0,
      dz = p.z - z0,
      span = Math.hypot(dx, dz);
    const visible = [...peds, ...cops, ...guards, ...gang, ...departmentPeople];
    if (owner && !player.car) visible.push(player);
    const candidates = [];
    let stopDistance = Infinity;
    for (const actor of visible) {
      if (
        actor === owner ||
        !actor.c ||
        !actor.c.root.visible ||
        (!actor.c.resident && actor !== player)
      )
        continue;
      if (
        Math.abs(actor.pos.y - y) > 1.85 ||
        Math.hypot(actor.pos.x - x0, actor.pos.z - z0) > span + r + 0.95
      )
        continue;
      if (span > 0 && !actor.c.body && actor.mode !== 'gettingUp' && Math.abs(actor.pos.y - y) < 0.75) {
        const ax = actor.pos.x - x0,
          az = actor.pos.z - z0,
          forward = (ax * dx + az * dz) / span,
          side = Math.abs(ax * dz - az * dx) / span;
        if (forward > 0 && side < 0.145) {
          const contact = forward - Math.sqrt(Math.max(0, (r + 0.23) ** 2 - side ** 2));
          stopDistance = Math.min(stopDistance, Math.max(0, contact));
        }
      }
      for (const [a, b, rad] of segments(actor)) {
        if (Math.max(a[1], b[1]) + rad < y + 0.08 || Math.min(a[1], b[1]) - rad > y + 1.63) continue;
        candidates.push([a, b, rad]);
      }
    }
    if (!candidates.length) return null;
    // Small bounded substeps prevent tunnelling even if a long timestep crosses a whole arm.
    // An intentional straight approach to a standing person's chest ends at contact.
    // Turning and off-centre approaches keep their tangent for stepping around the person.
    if (stopDistance < span) {
      p.x = x0 + (dx * stopDistance) / span;
      p.z = z0 + (dz * stopDistance) / span;
      return { x: -dx / span, z: -dz / span };
    }
    const steps = Math.max(1, Math.ceil(span / 0.115));
    let x = x0,
      z = z0,
      hit = null;
    for (let step = 0; step < steps; step++) {
      x += dx / steps;
      z += dz / steps;
      for (const [a, b, rad] of candidates) {
        const bx = b[0] - a[0],
          bz = b[2] - a[2],
          t = clamp(((x - a[0]) * bx + (z - a[2]) * bz) / (bx * bx + bz * bz || 1), 0, 1);
        point[0] = a[0] + bx * t;
        point[2] = a[2] + bz * t;
        let nx = x - point[0],
          nz = z - point[2],
          d = Math.hypot(nx, nz);
        if (d >= r + rad) continue;
        if (d < 1e-6) {
          nx = span ? -dx / span : 1;
          nz = span ? -dz / span : 0;
          d = 0;
        } else {
          nx /= d;
          nz /= d;
        }
        x += nx * (r + rad - d + 0.0005);
        z += nz * (r + rad - d + 0.0005);
        hit = { x: nx, z: nz };
      }
    }
    if (hit) {
      p.x = x;
      p.z = z;
    }
    return hit;
  }
  return { push };
})();
