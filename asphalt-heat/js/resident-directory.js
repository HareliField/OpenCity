/* Browse an individual life, follow its relationships and meet the resident in the playable city. */
globalThis.ResidentDirectory = (() => {
  let panel = null,
    previous = null,
    selected = null,
    offset = 0;
  const pageSize = 18;
  function element(tag, content, cls) {
    const el = document.createElement(tag);
    if (content != null) el.textContent = content;
    if (cls) el.className = cls;
    return el;
  }
  function button(text, fn) {
    const b = element('button', text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function homeBlock(row) {
    const cue = row.home.toLowerCase();
    const district = /port|harbor/.test(cue)
      ? 'docks'
      : /coast|beach|lighthouse/.test(cue)
        ? 'beach'
        : /old town|ferry|brick passage/.test(cue)
          ? 'oldtown'
          : /eastside|residential|seabright/.test(cue)
            ? 'suburb'
            : /foundry|shop row|wash house/.test(cue)
              ? 'downtown'
              : 'midtown';
    const pool = blocks.filter((b) => b.dist === district && !b.park && b.bld.length);
    const index = Number(row.residentId.slice(-4));
    return pool[index % pool.length] || blocks[0];
  }
  function approach(at, yaw) {
    const placesToStand = [0, 0.7, -0.7, 1.5, -1.5, Math.PI];
    for (const turn of placesToStand) {
      const a = yaw + turn,
        x = at.x + Math.sin(a) * 1.58,
        z = at.z + Math.cos(a) * 1.58;
      const pos = new V3(x, at.y, z);
      pos.y = groundY(x, z, at.y);
      if (
        Math.abs(at.y - pos.y) > 0.85 ||
        rayWorld(at.x, at.z, x, z, at.y + 1.1, pos.y + 1.1, 0.05, true, true) < 1
      )
        continue;
      collideWorld(pos, 0.36);
      if (Math.hypot(pos.x - x, pos.z - z) > 0.38) continue;
      player.pos.copy(pos);
      player.c.root.position.copy(pos);
      player.yaw = camYaw = player.c.yaw = Math.atan2(at.x - pos.x, at.z - pos.z);
      player.c.root.rotation.y = player.yaw;
      player.pace = player.spd = 0;
      lookYaw = 0;
      return true;
    }
    return false;
  }
  function meet(id) {
    const row = ResidentCast.get(id);
    if (!row) return false;
    if (state !== 'play' || player.car || player.down > 0) {
      toast('Meet a resident while you are on foot.', 1800);
      return false;
    }
    if (ResidentCast.excluded(row.personId)) {
      toast(row.name + ' is listed in a homicide file.', 2200);
      return false;
    }
    if (previous?.c) {
      delete previous.c.residentPriority;
      previous = null;
    }
    if (row.residentId === 'AH-R0001') {
      const shop = WashHouse.destination();
      if (!shop) return false;
      player.pos.set(shop.x, shop.y || 0, shop.z);
      player.c.root.position.copy(player.pos);
      player.yaw = camYaw = player.c.yaw = shop.yaw;
      player.c.root.rotation.y = shop.yaw;
      player.pace = player.spd = lookYaw = 0;
      return true;
    }
    let actor = [...peds, ...cops, ...gang, ...guards, ...departmentPeople].find(
      (p) => !p.dead && p.c?.resident?.personId === row.personId
    );
    const car = cars.find(
      (c) => c.castDriver?.personId === row.personId || c.officer?.personId === row.personId
    );
    if (!actor && car) {
      const ok = approach(car.pos, car.h + Math.PI / 2);
      if (ok) toast(row.name + ' · driving', 1400);
      return ok;
    }
    if (!actor) {
      const b = homeBlock(row),
        r = perim(b),
        t = (Number(row.residentId.slice(-4)) * 7.3) % (2 * (r.x1 - r.x0 + (r.z1 - r.z0)));
      const [x, z] = perimPos(r, t);
      const slot = peds
        .filter((p) => !p.dead && !p.cross && !p.neighborhood && !streetPedReserved(p))
        .sort((a, b) => dist2(b.pos, player.pos) - dist2(a.pos, player.pos))[0];
      if (!slot) {
        toast('All nearby pedestrians are occupied.', 1500);
        return false;
      }
      newPedChar(slot, b);
      if (row.personId.startsWith('ah-pd-')) slot.c.directoryOfficer = slot;
      ResidentCast.assign(slot, b.dist, row.personId);
      assignCivilianIdentity(slot);
      slot.pos.set(x, groundY(x, z), z);
      slot.R = r;
      slot.t = t;
      slot.dir = 1;
      slot.dead = false;
      slot.hp = 60;
      slot.fleeT = slot.downT = 0;
      slot.cross = null;
      slot.spd = 1.32 * row.performance.gait;
      slot.c.root.position.copy(slot.pos);
      slot.c.root.visible = true;
      actor = slot;
    }
    const yaw = actor.c.yaw || 0;
    if (!approach(actor.pos, yaw)) {
      toast('This resident is currently out of reach.', 1700);
      return false;
    }
    if (peds.includes(actor) && !streetPedReserved(actor)) {
      actor.mode = 'stand';
      actor.standT = 8 + row.performance.attention;
      actor.c.talk = 0;
      actor.c.yaw = Math.atan2(player.pos.x - actor.pos.x, player.pos.z - actor.pos.z);
    }
    actor.c.root.visible = true;
    actor.c.residentPriority = true;
    previous = actor;
    ResidentCast.tick(0.16, player.pos, QUALITY.level >= 2 ? 9 : 5);
    globalThis.asphaltAgentEvent?.('met-resident', { personId: row.personId, name: row.name });
    return true;
  }
  function open() {
    if (panel || state !== 'play' || shopOpen || player.down > 0) return;
    const dlg = element('dialog', null, 'residentDirectory');
    dlg.setAttribute('aria-label', 'City residents');
    panel = dlg;
    const top = element('header');
    top.append(
      element('h2', 'City residents'),
      button('Close', () => dlg.close())
    );
    const input = element('input');
    input.type = 'search';
    input.placeholder = 'Name, occupation, neighborhood or ID';
    input.setAttribute('aria-label', 'Find a resident');
    const body = element('div', null, 'directoryBody'),
      nav = element('nav'),
      profile = element('article'),
      pager = element('footer');
    profile.setAttribute('aria-live', 'polite');
    function field(title, value) {
      if (value) profile.append(element('h4', title), element('p', value.replace(/\*([^*]+)\*/g, '$1')));
    }
    function show(row) {
      selected = row;
      profile.replaceChildren();
      if (!row) return;
      const comparison = element('div', null, 'residentComparison');
      for (const [folder, label] of [
        ['portraits', 'Photograph'],
        ['standing', 'Standing model']
      ]) {
        const figure = element('figure'),
          image = element('img');
        image.alt = row.name + ' · ' + label;
        image.src = 'assets/residents/' + folder + '/' + row.residentId + '.webp';
        image.width = 133;
        image.height = 186;
        figure.append(image, element('figcaption', label));
        comparison.append(figure);
      }
      const head = element('div', null, 'profileHead'),
        caption = element('div');
      caption.append(
        element('h3', row.name),
        element('p', row.age + ' · ' + row.occupation),
        element('p', row.home)
      );
      caption.append(
        button('Meet in the city', () => {
          dlg.close();
          meet(row.personId);
        })
      );
      if (row.residentId !== 'AH-R0001') {
        const performance = element('select');
        performance.setAttribute('aria-label', 'Movement to preview');
        const labels = {
          wave: 'Greet someone',
          explain: 'Conversation',
          hurt_walk: 'Injured walk',
          get_up: 'Rise from the floor',
          dodge: 'Dodge',
          lift_basket: 'Lift a basket',
          clean_window: 'Clean a window',
          sit_rise: 'Sit and stand'
        };
        for (const k of globalThis.ResidentMotion?.names() || []) {
          const o = element('option', labels[k] || k.replaceAll('_', ' '));
          o.value = k;
          performance.append(o);
        }
        performance.value = 'wave';
        caption.append(
          performance,
          button('Watch movement', () => {
            dlg.close();
            if (meet(row.personId) && previous?.c) {
              previous.standT = Math.max(
                previous.standT || 0,
                ResidentMotion.duration(performance.value) + 0.5
              );
              ResidentMotion.play(previous.c, performance.value);
            }
          })
        );
      }
      head.append(caption);
      profile.append(head, comparison);
      field(row.episode, row.life);
      field('Personality', row.personality);
      field('In their own words', row.voice);
      field('What matters now', row.agenda);
      field('Family', row.family);
      field('City connections', row.connections);
      const related = element('div', null, 'relatedResidents');
      for (const id of new Set([...row.familyIds, ...row.connectionIds])) {
        const r = ResidentCast.get(id);
        if (r) related.append(button(r.name, () => show(r)));
      }
      profile.append(related);
      field('Appearance', row.appearance);
      for (const response of row.reactions) field(response.situation, response.response);
      profile.scrollTop = 0;
    }
    function list() {
      const rows = ResidentCast.search(input.value);
      if (offset >= rows.length) offset = 0;
      nav.replaceChildren();
      pager.replaceChildren();
      for (const row of rows.slice(offset, offset + pageSize)) {
        const b = button(row.name, () => show(row));
        b.append(element('small', row.occupation));
        nav.append(b);
      }
      pager.append(
        element(
          'span',
          rows.length
            ? offset + 1 + '–' + Math.min(rows.length, offset + pageSize) + ' of ' + rows.length
            : 'No matching residents'
        )
      );
      if (offset > 0)
        pager.append(
          button('Previous', () => {
            offset -= pageSize;
            list();
          })
        );
      if (offset + pageSize < rows.length)
        pager.append(
          button('Next', () => {
            offset += pageSize;
            list();
          })
        );
      if (!rows.includes(selected)) show(rows[0]);
    }
    input.addEventListener('input', () => {
      offset = 0;
      list();
    });
    const results = element('section');
    results.append(nav, pager);
    body.append(results, profile);
    dlg.append(top, input, body);
    dlg.addEventListener(
      'close',
      () => {
        shopOpen = false;
        panel = null;
        dlg.remove();
      },
      { once: true }
    );
    document.body.append(dlg);
    shopOpen = true;
    list();
    dlg.showModal();
    input.focus();
  }
  document.getElementById('residentsButton')?.addEventListener('click', open);
  return { open, meet, isOpen: () => !!panel, close: () => panel?.close() };
})();
