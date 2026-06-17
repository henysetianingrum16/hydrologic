/* HydroLogic — connectivity + sync.
 * LOCAL MODE (Supabase not configured): records are just kept on-device.
 * CONNECTED MODE: unsynced records are pushed (upsert) to Supabase; master
 * data (stations/wells) is pulled and cached for offline use. */
window.HL = window.HL || {};

HL.sync = (function () {
  let syncing = false;

  function setPill(state, text) {
    const dot = document.getElementById('sync-dot');
    const txt = document.getElementById('sync-text');
    if (!dot || !txt) return;
    dot.className = 'sync-dot is-' + state;
    txt.textContent = text;
  }

  async function refresh() {
    const pending = (await HL.db.unsynced()).length;
    if (HL.auth && HL.auth.localMode()) { setPill('offline', 'Mode lokal'); return; }
    if (syncing) { setPill('syncing', 'Sinkron…'); return; }
    if (!navigator.onLine) { setPill('offline', pending ? `Offline · ${pending} antri` : 'Offline'); return; }
    if (HL.auth && !HL.auth.isAuthed()) {
      setPill('offline', HL.auth.anonymousMode() ? (pending ? `Lokal · ${pending}` : 'Lokal') : 'Belum login');
      return;
    }
    setPill('online', pending ? `${pending} antri` : 'Tersinkron');
  }

  // ---- field mappers: local record -> Supabase row ----
  function dischargeRow(r, uid) {
    return {
      id: r.id, station_id: r.stationId, lokasi: r.lokasi, titik: r.titik, date: r.date,
      width_cm: r.widthCm, segment_width: r.segmentWidth, weather: r.weather, rainfall: r.rainfall,
      note: r.note, segments: r.segments, total_area: r.totalArea, total_q: r.totalQ,
      q_ls: r.qLs, v_mean: r.vMean, gps: r.gps, crew: r.crew, time: r.time,
      created_by: uid, created_at: r.createdAt
    };
  }
  function gwlRow(r, uid) {
    return {
      id: r.id, well_id: r.wellId, area: r.area, z: r.z, stick_up: r.stickUp, date: r.date,
      depth: r.depth, elevation: r.elevation, note: r.note, crew: r.crew, time: r.time,
      created_by: uid, created_at: r.createdAt
    };
  }

  async function flush() {
    const pending = await HL.db.unsynced();
    if (HL.auth && HL.auth.localMode()) {
      // No server — mark as stored so the queue counter stays clean.
      if (pending.length) await HL.db.markSynced(pending.map((p) => p.id));
      refresh(); return;
    }
    const sb = HL.sb();
    if (syncing || !navigator.onLine || !sb || !HL.auth.isAuthed()) { refresh(); return; }
    if (!pending.length) { refresh(); return; }

    syncing = true; refresh();
    const uid = HL.auth.user().id;
    const done = [];
    try {
      const dis = pending.filter((p) => p.type === 'discharge');
      const gwl = pending.filter((p) => p.type === 'gwl');
      if (dis.length) {
        const { error } = await sb.from('discharge_records').upsert(dis.map((r) => dischargeRow(r, uid)));
        if (error) throw error; done.push(...dis.map((r) => r.id));
      }
      if (gwl.length) {
        const { error } = await sb.from('gwl_records').upsert(gwl.map((r) => gwlRow(r, uid)));
        if (error) throw error; done.push(...gwl.map((r) => r.id));
      }
      if (done.length) await HL.db.markSynced(done);
      syncing = false;
      if (done.length) { HL.toast(`${done.length} data tersinkron`, 'ok'); document.dispatchEvent(new CustomEvent('hl:synced')); }
      refresh();
    } catch (e) {
      syncing = false;
      console.warn('sync push failed', e);
      HL.toast('Sinkron gagal — akan dicoba lagi', 'err');
      refresh();
    }
  }

  // ---- pull master data (stations + wells) into HL.* and cache offline ----
  function applyCachedMaster() {
    try {
      const s = JSON.parse(localStorage.getItem('hl_stations') || 'null');
      const w = JSON.parse(localStorage.getItem('hl_wells') || 'null');
      if (Array.isArray(s) && s.length) HL.stations = s;
      if (Array.isArray(w) && w.length) HL.wells = w;
    } catch (e) {}
  }

  async function pullMaster() {
    const sb = HL.sb();
    if (!sb || !navigator.onLine || !HL.auth.isAuthed()) return;
    try {
      const [{ data: st }, { data: wl }] = await Promise.all([
        sb.from('stations').select('*').order('id'),
        sb.from('wells').select('*').order('area').order('id')
      ]);
      if (st && st.length) {
        HL.stations = st.map((s) => ({ id: s.id, lokasi: s.lokasi, titik: s.titik, lat: s.lat, lng: s.lng, active: s.active }));
        localStorage.setItem('hl_stations', JSON.stringify(HL.stations));
      }
      if (wl && wl.length) {
        HL.wells = wl.map((w) => ({ id: w.id, area: w.area, z: Number(w.z), stickUp: Number(w.stick_up), x: w.x, y: w.y, tahun: w.tahun, active: w.active }));
        localStorage.setItem('hl_wells', JSON.stringify(HL.wells));
      }
    } catch (e) { console.warn('pull master failed', e); }
  }

  function init() {
    applyCachedMaster();
    window.addEventListener('online', async () => {
      if (HL.auth && HL.auth.ensureAnonymous) await HL.auth.ensureAnonymous();
      refresh(); pullMaster(); flush();
    });
    window.addEventListener('offline', refresh);
    document.addEventListener('hl:saved', () => { refresh(); flush(); });
    refresh();
    if (navigator.onLine) { pullMaster(); setTimeout(flush, 800); }
  }

  return { init, refresh, flush, pullMaster, setPill };
})();
