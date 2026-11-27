// Record a fitted resident in the active city simulation for the loopback review server.
(() => {
  const film = document.createElement('button');
  film.type = 'button';
  film.textContent = 'Film selected resident';
  film.style.cssText =
    'position:fixed;bottom:88px;right:8px;z-index:995;padding:5px;background:#28372e;color:white;font:12px system-ui';
  document.body.append(film);
  film.onclick = async () => {
    if (film.disabled) return;
    film.disabled = true;
    const actor = [...peds, ...cops, ...departmentPeople].find((a) => a.c?.residentPriority);
    const visible = player?.c.root.visible,
      pr = renderer.getPixelRatio(),
      size = renderer.getSize(new THREE.Vector2()),
      lens = camera.fov;
    try {
      if (
        state !== 'play' ||
        !asphaltAgent.paused ||
        $('sound').textContent.trim() !== 'Sound off' ||
        !actor
      )
        throw Error('Meet a resident in paused, muted agent gameplay first.');
      for (let n = 0; n < 160 && ResidentCast.status(actor.c) !== 'fitted'; n++) {
        ResidentCast.tick(0.17, player.pos, QUALITY.level >= 2 ? 9 : 5);
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
      if (ResidentCast.status(actor.c) !== 'fitted') throw Error('The fitted character did not arrive.');
      const width = 864,
        height = 576,
        still = 24,
        frames = 104,
        canvas = document.getElementById('c');
      const copy = document.createElement('canvas');
      copy.width = width;
      copy.height = height;
      const context = copy.getContext('2d');
      const start = actor.c.yaw;
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      postResize(width, height);
      for (let i = 1; i <= frames; i++) {
        if (i === still && actor.mode === 'stand') actor.standT = 0.02;
        for (let s = 0; s < 2; s++) step(1 / 48, { forward: 0, turn: 0, fire: false, sprint: false });
        player.c.root.visible = false;
        const target = actor.pos,
          g = ResidentCast.modelRoot(actor.c),
          head = g?.getObjectByName('head');
        const headHeight = head?.getWorldPosition(new V3()).y - target.y;
        const mid = target.y + (headHeight > 0 ? 0.52 * headHeight : 0.86),
          yaw = lerpA(start, actor.c.yaw, Math.min(1, Math.max(0, (i - still) / 31))) + 0.38;
        let a = yaw,
          d = 2.55;
        for (const turn of [0, -0.65, 0.65, -1.35, 1.35, Math.PI]) {
          const current = yaw + turn,
            t = rayWorld(
              target.x,
              target.z,
              target.x + Math.sin(current) * 2.65,
              target.z + Math.cos(current) * 2.65,
              mid,
              mid + 0.47,
              0.05,
              true,
              true
            );
          if (t > 0.83) {
            a = current;
            d = Math.min(2.55, t * 2.65 - 0.1);
            break;
          }
        }
        camera.position.set(target.x + Math.sin(a) * d, mid + 0.37, target.z + Math.cos(a) * d);
        camera.fov = THREE.MathUtils.radToDeg(
          2 * Math.atan((Math.max(1.32, headHeight || 1.55) * 0.65) / d)
        );
        camera.lookAt(target.x, mid, target.z);
        camera.updateProjectionMatrix();
        renderFrame(time);
        context.drawImage(canvas, 0, 0, width, height);
        const blob = await new Promise((resolve) => copy.toBlob(resolve, 'image/jpeg', 0.91));
        const result = await fetch('/__frames/cast/' + String(i).padStart(4, '0'), {
          method: 'POST',
          body: blob
        });
        if (!result.ok) throw Error('Frame write failed ' + result.status);
        film.textContent = 'Recording ' + i + ' / ' + frames;
      }
      film.textContent = 'Saved ' + actor.c.resident.name + ' · 104 frames';
    } catch (error) {
      film.textContent = String(error.message);
    } finally {
      if (player) player.c.root.visible = visible;
      renderer.setPixelRatio(pr);
      renderer.setSize(size.x, size.y, false);
      camera.fov = lens;
      resize();
      camInit = false;
      film.disabled = false;
    }
  };
})();
