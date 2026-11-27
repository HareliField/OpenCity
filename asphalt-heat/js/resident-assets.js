/* Bound the live cast's glTF working set. Identical external resources have one owner pool. */
globalThis.ResidentAssets = (() => {
  const resources = new Map();
  function share(owner, key, load) {
    let r = resources.get(key);
    if (!r) {
      r = { refs: 0, value: null };
      resources.set(key, r);
      r.ready = Promise.resolve()
        .then(load)
        .then((value) => {
          r.value = value;
          return value;
        });
    }
    if (!owner.has(key)) {
      owner.add(key);
      r.refs++;
    }
    return r.ready;
  }
  function release(owner) {
    for (const key of owner) {
      const r = resources.get(key);
      if (r && --r.refs === 0) {
        resources.delete(key);
        r.ready.then(
          (v) => v?.dispose?.(),
          () => {}
        );
      }
    }
    owner.clear();
  }
  function hooks(parser, url, owner) {
    const j = parser.json,
      absolute = (uri) => new URL(uri, url).href;
    const viewKey = (i) => {
      const view = j.bufferViews[i],
        buf = j.buffers[view.buffer];
      if (!buf.uri || buf.uri.startsWith('data:') || view.extensions) return null;
      return [absolute(buf.uri), view.byteOffset || 0, view.byteLength, view.byteStride || 0];
    };
    const accessorKey = (i) => {
      const a = j.accessors[i];
      if (a.bufferView === undefined || a.sparse) return null;
      const view = viewKey(a.bufferView);
      return (
        view && [view, a.byteOffset || 0, a.componentType, a.count, a.type, !!a.normalized, a.min, a.max]
      );
    };
    const buffer = parser.loadBuffer.bind(parser),
      accessor = parser.loadAccessor.bind(parser);
    const texture = parser.loadTexture.bind(parser),
      geometry = parser.loadGeometries.bind(parser);
    // Sculpted positions differ per person. Preserve the common topology, UVs,
    // inverse bind matrices and skinning attributes even on different meshes.
    parser.loadAccessor = (i) => {
      const key = accessorKey(i);
      return key ? share(owner, 'accessor ' + JSON.stringify(key), () => accessor(i)) : accessor(i);
    };
    parser.loadBuffer = (i) => {
      const uri = j.buffers[i].uri;
      return uri && !uri.startsWith('data:')
        ? share(owner, 'buffer ' + absolute(uri), () => buffer(i))
        : buffer(i);
    };
    parser.loadTexture = (i) => {
      const t = j.textures[i],
        img = j.images[t.source];
      if (!img?.uri || img.uri.startsWith('data:') || t.extensions) return texture(i);
      const color = (j.materials || []).some(
        (m) => m.pbrMetallicRoughness?.baseColorTexture?.index === i || m.emissiveTexture?.index === i
      );
      const key = 'texture ' + JSON.stringify([absolute(img.uri), j.samplers?.[t.sampler] || {}, color]);
      return share(owner, key, () => texture(i)).then((tex) => {
        parser.associations.set(tex, { type: 'textures', index: i });
        return tex;
      });
    };
    parser.loadGeometries = (primitives) =>
      Promise.all(
        primitives.map((p) => {
          const attributes = Object.entries(p.attributes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, accessorKey(v)]);
          const indices = p.indices === undefined ? 'non-indexed' : accessorKey(p.indices);
          const read = () => geometry([p]).then((result) => result[0]);
          if (!indices || attributes.some(([, v]) => !v) || p.extensions || p.targets) return read();
          return share(owner, 'geometry ' + JSON.stringify([p.mode ?? 4, indices, attributes]), read);
        })
      );
    return { name: 'ResidentSharedResources' };
  }
  async function load(url) {
    const owner = new Set(),
      loader = new THREE.GLTFLoader();
    loader.register((parser) => hooks(parser, url, owner));
    try {
      const gltf = await loader.loadAsync(url);
      const pooled = new Set([...owner].map((key) => resources.get(key)?.value));
      const privateAssets = new Set(),
        skeletons = new Set(),
        heads = new Map();
      gltf.scene.traverse((node) => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh) skeletons.add(node.skeleton);
        if (!pooled.has(node.geometry)) privateAssets.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          privateAssets.add(material);
          for (const t of Object.values(material))
            if (t?.isTexture && !pooled.has(t)) privateAssets.add(t);
        }
      });
      return {
        scene: gltf.scene,
        heads,
        dispose() {
          for (const g of heads.values()) g?.dispose();
          heads.clear();
          for (const asset of privateAssets) asset.dispose();
          for (const skeleton of skeletons) skeleton.dispose();
          release(owner);
        }
      };
    } catch (error) {
      release(owner);
      throw error;
    }
  }
  return { load, resourceCount: () => resources.size };
})();
