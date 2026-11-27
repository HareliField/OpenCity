/* Fit a resident's native skeleton to the game's live pose, including procedural and physics poses. */
globalThis.ResidentRig = (() => {
  const pairs = [
    ['pelvis', 'Hips'],
    ['spine_01', 'Spine'],
    ['spine_02', 'Spine1'],
    ['spine_03', 'Spine2'],
    ['neck_01', 'Neck'],
    ['head', 'Head']
  ];
  for (const [side, sideName] of [
    ['l', 'Left'],
    ['r', 'Right']
  ]) {
    for (const [native, source] of [
      ['clavicle', 'Shoulder'],
      ['upperarm', 'Arm'],
      ['lowerarm', 'ForeArm'],
      ['hand', 'Hand'],
      ['thigh', 'UpLeg'],
      ['calf', 'Leg'],
      ['foot', 'Foot'],
      ['ball', 'ToeBase']
    ])
      pairs.push([native + '_' + side, sideName + source]);
    ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((finger, f) => {
      for (let k = 0; k < 3; k++)
        pairs.push([
          finger + '_0' + (k + 1) + '_' + side,
          'Bip01_' + side.toUpperCase() + '_Finger' + f + (k || '')
        ]);
    });
  }
  const directionChild = {
    spine_01: 'spine_02',
    spine_02: 'spine_03',
    spine_03: 'neck_01',
    neck_01: 'head'
  };
  for (const s of ['l', 'r']) {
    for (const [bone, child] of [
      ['clavicle', 'upperarm'],
      ['upperarm', 'lowerarm'],
      ['lowerarm', 'hand'],
      ['hand', 'middle_01'],
      ['thigh', 'calf'],
      ['calf', 'foot'],
      ['foot', 'ball']
    ])
      directionChild[bone + '_' + s] = child + '_' + s;
  }
  const v1 = new THREE.Vector3(),
    v2 = new THREE.Vector3(),
    v3 = new THREE.Vector3(),
    q1 = new THREE.Quaternion(),
    q2 = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  function worldRotation(node, out) {
    return out.setFromRotationMatrix(basis.extractRotation(node.matrixWorld)).normalize();
  }
  function worldPoint(node, out) {
    return out.setFromMatrixPosition(node.matrixWorld);
  }
  function segment(node, end, out) {
    return worldPoint(end, out).sub(worldPoint(node, v3)).normalize();
  }
  function headSection(mesh, template) {
    const g = mesh.geometry;
    if (template.heads.has(g)) return template.heads.get(g);
    const indices = g.attributes.skinIndex,
      weights = g.attributes.skinWeight;
    if (!indices || !weights) return null;
    const facial = mesh.skeleton.bones.map((b) => b.name === 'head' || b.name === 'neck_01');
    const inside = new Uint8Array(indices.count);
    for (let i = 0; i < indices.count; i++) {
      let influence = 0;
      for (const read of ['getX', 'getY', 'getZ', 'getW'])
        if (facial[indices[read](i)]) influence += weights[read](i);
      inside[i] = influence > 0.16 ? 1 : 0;
    }
    const triangles = [];
    for (let i = 0; i < (g.index?.count ?? indices.count); i += 3) {
      const a = g.index ? g.index.getX(i) : i,
        b = g.index ? g.index.getX(i + 1) : i + 1,
        c = g.index ? g.index.getX(i + 2) : i + 2;
      if (inside[a] + inside[b] + inside[c] >= 2) triangles.push(a, b, c);
    }
    let geometry = null;
    if (triangles.length) {
      geometry = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) geometry.setAttribute(name, attr);
      geometry.morphAttributes = g.morphAttributes;
      geometry.morphTargetsRelative = g.morphTargetsRelative;
      geometry.setIndex(triangles);
    }
    template.heads.set(g, geometry);
    return geometry;
  }
  function install(c, template, uniform) {
    const root = THREE.SkeletonUtils.clone(template.scene),
      base = TPL[c.name].scene;
    const target = nodeMap(root),
      source = nodeMap(c.model),
      reference = nodeMap(base);
    const original = [],
      joints = [],
      skeletons = new Set(),
      links = {},
      faces = [];
    let gestureTime = 0;
    base.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const captured = globalThis.ResidentMotion?.bind(root, target, c);
    for (const [name, key] of pairs) {
      const sourceName = BMAP[key] || key;
      if (target[name] && source[sourceName] && reference[sourceName])
        links[name] = {
          native: target[name],
          source: source[sourceName],
          reference: reference[sourceName]
        };
    }
    if (!links.head || !links.pelvis || !links.neck_01)
      throw Error('Resident skeleton is missing its head, neck or pelvis');
    for (const [name, link] of Object.entries(links)) {
      const child = links[directionChild[name]],
        n = link.native;
      if (child) {
        const from = segment(n, child.native, v1),
          to = segment(link.reference, child.reference, v2);
        if (from.lengthSq() > 0.5 && to.lengthSq() > 0.5) {
          const turn = q1.setFromUnitVectors(from, to).multiply(worldRotation(n, q2));
          n.quaternion.copy(worldRotation(n.parent, q2).invert().multiply(turn));
          n.updateWorldMatrix(false, true);
        }
      }
      link.correction = worldRotation(link.reference, new THREE.Quaternion())
        .invert()
        .multiply(worldRotation(n, q1));
      joints.push(link);
    }
    const anchor = uniform ? links.neck_01 : links.pelvis;
    const hipBias =
      uniform || c.seated ? 0 : worldPoint(anchor.native, v1).y - worldPoint(anchor.reference, v2).y;
    let layerMask = 1,
      castShadow = false;
    function hide(mesh, geometry) {
      original.push({ mesh, visible: mesh.visible, geometry: mesh.geometry });
      if (geometry) mesh.geometry = geometry;
      else mesh.visible = false;
    }
    c.model.traverse((o) => {
      if (o.isSkinnedMesh) {
        layerMask = o.layers.mask;
        castShadow ||= o.castShadow;
        if (!uniform) hide(o);
      }
    });
    if (uniform) for (const part of portraitParts(c.model)) hide(part.mesh, part.rest);
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) skeletons.add(o.skeleton);
      if (o.morphTargetDictionary?.Blink !== undefined) faces.push(o);
      o.layers.mask = layerMask;
      o.castShadow = castShadow;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (uniform) {
        const body = /^(body|base)(_|$)/i.test(o.name) || /skin/i.test(o.material.name);
        if (body) {
          const head = headSection(o, template);
          if (head) o.geometry = head;
          else o.visible = false;
        } else if (
          !/hair|brow|lash|eye|iris|cornea|teeth|tongue|beard|moustache|scalp|temple|earring|glasses/i.test(
            o.name + ' ' + o.material.name
          )
        )
          o.visible = false;
      }
    });
    c.root.add(root);
    root.name = c.resident.name + ' | ' + c.resident.residentId;
    const secondary = globalThis.ResidentSecondary?.bind(root, target);
    function update(dt) {
      c.root.updateWorldMatrix(true, true);
      for (const link of joints) {
        const n = link.native,
          w = worldRotation(link.source, q1).multiply(link.correction);
        n.quaternion.copy(worldRotation(n.parent, q2).invert().multiply(w));
        n.updateMatrix();
        n.matrixWorld.multiplyMatrices(n.parent.matrixWorld, n.matrix);
      }
      const parent = root.parent;
      const src = parent.worldToLocal(worldPoint(anchor.source, v1)),
        current = parent.worldToLocal(worldPoint(anchor.native, v2));
      src.y += hipBias;
      root.position.add(src.sub(current));
      root.updateWorldMatrix(false, true);
      captured?.();
      secondary?.update(dt);
      gestureTime += dt;
      const interval = c.resident.performance?.blinkInterval || 4;
      const phase = gestureTime % interval;
      for (const f of faces) {
        f.morphTargetInfluences[f.morphTargetDictionary.Blink] =
          phase < 0.17 ? Math.sin((phase * Math.PI) / 0.17) : 0;
        f.morphTargetInfluences[f.morphTargetDictionary.Speak] = c.talk
          ? Math.abs(Math.sin(gestureTime * 8.8)) * 0.77
          : 0;
      }
    }
    update(0);
    return {
      root,
      bones: target,
      update,
      dispose() {
        for (const part of original) {
          part.mesh.visible = part.visible;
          part.mesh.geometry = part.geometry;
        }
        root.parent?.remove(root);
        for (const s of skeletons) s.dispose();
      }
    };
  }
  return { install };
})();
