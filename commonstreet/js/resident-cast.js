/* Keep a named resident's biography, live actor and streamed appearance together. */
globalThis.ResidentCast = (() => {
  const roster = new Map(),
    pools = new Map(),
    leases = new Map(),
    bindings = new Map(),
    templates = new Map();
  const fixed = new Set([
    'AH-R0001',
    'AH-R0032',
    'AH-R0033',
    'AH-R0034',
    'AH-R0035',
    'AH-R0037',
    'AH-R0038'
  ]);
  let pending = 0,
    clock = 0,
    nextSelection = 0,
    dialogue = null;
  const where = [
    [/Coast Ridge|Lighthouse Cove|Pier Beach/i, 'beach'],
    [/north of the port|South Shore Harbor/i, 'docks'],
    [/Eastside|western residential|Seabright/i, 'suburb'],
    [/Old Town|Ferry Street|brick passage/i, 'oldtown'],
    [/Foundry|shop row|Wash House/i, 'downtown'],
    [/Midtown|Market Flats/i, 'midtown']
  ];
  function addPool(key, row) {
    if (!pools.has(key)) pools.set(key, { rows: [], cursor: 0 });
    pools.get(key).rows.push(row);
  }
  function prepare(rows, url) {
    for (const r of rows) {
      if (!r?.residentId || !r.personId || !r.model || !r.name || roster.has(r.personId))
        throw Error('Invalid or duplicate cast resident ' + r?.personId);
      const row = { ...r, url: new URL(r.model, url).href };
      roster.set(r.personId, row);
      if (fixed.has(r.personId) || r.personId.startsWith('ah-pd-')) continue;
      addPool('any', row);
      addPool(where.find(([pattern]) => pattern.test(r.home))?.[1] || 'midtown', row);
      if (/security|night guard/i.test(r.occupation)) addPool('guard', row);
      if (/clerk|cashier|shop assistant|shopkeeper|teller/i.test(r.occupation)) addPool('clerk', row);
      if (/bank|teller/i.test(r.occupation)) addPool('bank', row);
      if (/drug dealer|street dealer|fence for stolen|gang member|bookmaker/i.test(r.occupation))
        addPool('gang', row);
    }
    for (const pool of pools.values())
      for (let i = pool.rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool.rows[j], pool.rows[i]] = [pool.rows[i], pool.rows[j]];
      }
  }
  async function load() {
    const url = new URL('assets/residents/cast.json', document.baseURI);
    try {
      const res = await fetch(url);
      if (!res.ok) throw Error(res.status + ' ' + url);
      prepare(await res.json(), url);
    } catch (error) {
      console.warn('City resident roster', error);
    }
  }
  function choose(key, blocked) {
    const pool = pools.get(key);
    if (!pool) return null;
    for (let i = 0; i < pool.rows.length; i++) {
      const row = pool.rows[pool.cursor++ % pool.rows.length];
      if (!leases.has(row.personId) && !blocked?.(row.personId)) return row;
    }
    return null;
  }
  function excluded(id) {
    return PoliceDepartment.cases.some(
      (f) =>
        f.kind === 'Homicide' &&
        (f.victim === id || f.victimId === id || f.pendingScene?.victimId === id)
    );
  }
  function lease(owner, row) {
    let live = leases.get(row.personId);
    if (!live) {
      live = new Set();
      leases.set(row.personId, live);
    }
    live.add(owner);
  }
  function release(owner, row) {
    const live = leases.get(row.personId);
    if (!live) return;
    live.delete(owner);
    if (!live.size) leases.delete(row.personId);
  }
  function closeInstance(b) {
    if (b.instance) {
      b.instance.dispose();
      b.instance = null;
      b.template.refs--;
      b.template.seen = clock;
      b.template = null;
    }
  }
  function unbind(c) {
    const b = bindings.get(c);
    if (!b) return;
    closeInstance(b);
    release(c, b.row);
    bindings.delete(c);
    delete c.resident;
  }
  function bind(c, personId, uniform = false) {
    const row = roster.get(personId);
    if (!c || !row || personId === 'AH-R0001') return null;
    if (personId.startsWith('ah-pd-') && !c.directoryOfficer) {
      for (const live of [...(leases.get(personId) || [])]) {
        const cameo = live.directoryOfficer;
        if (!cameo || live === c) continue;
        delete live.directoryOfficer;
        delete live.residentPriority;
        unbind(live);
        assign(cameo, blockOf(cameo.pos.x, cameo.pos.z)?.dist || 'any');
        PoliceDepartment.identify(cameo);
      }
    }
    const old = bindings.get(c);
    if (old?.row === row && old.uniform === uniform) return row;
    unbind(c);
    c.resident = row;
    bindings.set(c, { c, row, uniform, instance: null, wanted: false });
    lease(c, row);
    return row;
  }
  function assign(actor, key = 'any', personId) {
    const row = personId
      ? roster.get(personId)
      : choose(key, excluded) ||
        (['guard', 'clerk', 'bank', 'gang'].includes(key) ? null : choose('any', excluded));
    if (!row || !bind(actor.c, row.personId)) return null;
    if ('tough' in actor) {
      // A reliably assertive response belongs to the dossier across pedestrian-slot recycling.
      actor.tough =
        row.age >= 18 &&
        /refus|stand(?:s)? between|hold(?:s)? (?:their|his|her) ground|insist|interven/i.test(
          row.reactions[0].response + ' ' + row.personality
        );
      actor.startles =
        /feels a room through sound|recognizes it quickly in strangers|signals of discomfort/.test(
          row.personality
        );
    }
    actor.personId = row.personId;
    actor.residentName = row.name;
    actor.castAssigned = row.personId;
    return row;
  }
  function seat(car, visual) {
    if (visual.role === 'player') return;
    let row = car.officer && roster.get(car.officer.personId);
    if (!row) {
      row = car.castDriver || choose('any', excluded);
      if (!row) return;
      if (!car.castDriver) {
        car.castDriver = row;
        lease(car, row);
      }
    }
    // updateSeatedDriver records the actual cloned Rocketbox template on the
    // vehicle. Keep that name for retargeting across its posed steering arms.
    visual.name = visual.name || car.civilianDriverName;
    if (!visual.name) return;
    visual.seated = true;
    visual.root = car.mesh;
    bind(visual, row.personId, !!car.officer);
  }
  function releaseCar(car) {
    if (!car?.castDriver) return null;
    const row = car.castDriver;
    if (car.seatedDriver) unbind(car.seatedDriver);
    release(car, row);
    delete car.castDriver;
    return row.personId;
  }
  function start(row) {
    let entry = templates.get(row.url);
    if (entry && (entry.asset || entry.loading || clock < entry.retry)) return entry;
    if (pending >= 2) return entry;
    if (!entry) {
      entry = { seen: clock, refs: 0, retry: 0 };
      templates.set(row.url, entry);
    }
    entry.loading = true;
    pending++;
    ResidentAssets.load(row.url)
      .then((asset) => {
        entry.asset = asset;
        entry.seen = clock;
      })
      .catch((error) => {
        entry.retry = clock + 20;
        console.warn('Resident appearance', row.residentId, error);
      })
      .finally(() => {
        entry.loading = false;
        pending--;
      });
    return entry;
  }
  function install(b, entry) {
    if (!entry?.asset || b.instance || clock < (b.retry || 0)) return;
    try {
      b.instance = ResidentRig.install(b.c, entry.asset, b.uniform);
      b.template = entry;
      entry.refs++;
    } catch (error) {
      b.retry = clock + 20;
      console.warn('Resident fit', b.row.name, error);
    }
  }
  function select(focus, limit) {
    const near = [];
    for (const b of bindings.values()) {
      const p = b.c.root.position;
      const distance = Math.hypot(p.x - focus.x, p.z - focus.z, (p.y - focus.y) * 1.5);
      if (b.c.root.visible && distance < (b.instance ? 62 : 52)) near.push({ b, distance });
      b.wanted = false;
    }
    near.sort(
      (a, b) =>
        Number(b.b.c.residentPriority === true) - Number(a.b.c.residentPriority === true) ||
        a.distance - b.distance
    );
    for (const { b } of near.slice(0, limit)) {
      b.wanted = true;
      install(b, start(b.row));
    }
    for (const b of bindings.values()) if (!b.wanted) closeInstance(b);
    const unused = [...templates.entries()]
      .filter(([, e]) => !e.loading && !e.refs)
      .sort((a, b) => b[1].seen - a[1].seen);
    for (const [url, e] of unused.slice(4)) {
      templates.delete(url);
      e.asset?.dispose();
    }
  }
  function tick(dt, focus, limit) {
    clock += dt;
    if (clock >= nextSelection) {
      nextSelection = clock + 0.15;
      select(focus, limit);
    }
    for (const b of bindings.values()) {
      if (b.wanted && b.instance && b.c.root.visible) b.instance.update(dt);
      globalThis.ResidentMotion?.tick(b.c, dt);
    }
  }
  function showConversation(p) {
    const row = p.c.resident;
    if (!row || dialogue) return;
    p.mode = 'stand';
    p.standT = Math.max(p.standT || 0, 8 + (row.performance?.attention || 0));
    p.c.talk = 1;
    p.c.yaw = Math.atan2(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
    globalThis.ResidentMotion?.play(
      p.c,
      /listens|quiet|private/.test(row.personality) ? 'look_around' : 'explain'
    );
    const box = document.createElement('dialog');
    box.className = 'hqLift';
    box.dataset.resident = row.personId;
    box.setAttribute('aria-label', 'Conversation with ' + row.name);
    const name = document.createElement('h2'),
      work = document.createElement('p'),
      words = document.createElement('p');
    name.textContent = row.name;
    work.textContent = row.occupation;
    words.textContent = row.voice;
    box.append(name, work, words);
    function button(label, fn) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = label;
      el.onclick = fn;
      box.append(el);
      return el;
    }
    if (row.agenda) {
      const question = button('What are you working toward?', () => {
        words.textContent = row.agenda;
        question.remove();
      });
    }
    if (row.family)
      button('Who do you keep in touch with?', () => {
        words.textContent = row.family;
      });
    for (const r of row.reactions || [])
      button(r.situation, () => {
        words.textContent = r.response;
      });
    button('Goodbye', () => box.close());
    box.addEventListener(
      'close',
      () => {
        dialogue = null;
        shopOpen = false;
        p.c.talk = 0;
        delete p.c.residentTake;
        box.remove();
      },
      { once: true }
    );
    document.body.append(box);
    dialogue = box;
    shopOpen = true;
    box.showModal();
    globalThis.commonstreetAgentEvent?.('dialogue', { personId: row.personId, text: row.voice });
  }
  function interaction(pos, yaw, walkers) {
    let best = null,
      range = 2.05;
    for (const p of walkers) {
      if (
        !p.c?.resident ||
        p.dead ||
        p.cross ||
        !['walk', 'stand'].includes(p.mode) ||
        streetPedReserved(p)
      )
        continue;
      const dx = p.pos.x - pos.x,
        dz = p.pos.z - pos.z,
        d = Math.hypot(dx, dz);
      if (
        d >= range ||
        Math.abs(p.pos.y - pos.y) > 1 ||
        Math.abs(wrapA(Math.atan2(dx, dz) - yaw)) > 1.05
      )
        continue;
      if (rayWorld(pos.x, pos.z, p.pos.x, p.pos.z, pos.y + 1.4, p.pos.y + 1.4, 0, true, true) < 1)
        continue;
      best = p;
      range = d;
    }
    return (
      best && {
        label: 'TALK TO ' + best.c.resident.name.toUpperCase(),
        fn: () => showConversation(best)
      }
    );
  }
  function status(c) {
    const b = bindings.get(c);
    return b ? (b.instance ? 'fitted' : 'distant') : undefined;
  }
  function search(term) {
    const q = String(term).trim().toLowerCase();
    return [...roster.values()].filter(
      (r) =>
        !q ||
        [r.name, r.occupation, r.home, r.personId, r.residentId, r.episode].some((v) =>
          v?.toLowerCase().includes(q)
        )
    );
  }
  function get(id) {
    return roster.get(id) || [...roster.values()].find((r) => r.residentId === id);
  }
  function active(id) {
    return leases.get(id)?.values().next().value || null;
  }
  function modelRoot(c) {
    return bindings.get(c)?.instance?.root;
  }
  function bones(c) {
    return bindings.get(c)?.instance?.bones;
  }
  function conversation() {
    return (
      dialogue && {
        name: 'conversation',
        personId: dialogue.dataset.resident,
        text: dialogue.querySelectorAll('p')[1].textContent,
        choices: [...dialogue.querySelectorAll('button')].map((b) => b.textContent)
      }
    );
  }
  function answer(index) {
    const b = dialogue?.querySelectorAll('button')[index];
    if (b) b.click();
  }

  return {
    load,
    prepare,
    assign,
    bind,
    unbind,
    seat,
    releaseCar,
    tick,
    interaction,
    status,
    search,
    get,
    active,
    modelRoot,
    bones,
    conversation,
    answer,
    excluded
  };
})();
