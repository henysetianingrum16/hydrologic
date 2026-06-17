/* HydroLogic — engineer dashboard (rekap).
 * Connected mode: reads ALL crews' data from Supabase.
 * Local mode: reads this device's records from IndexedDB (with a note). */
window.HL = window.HL || {};

HL.dashboard = (function () {
  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function monthStr() { return new Date().toISOString().slice(0, 7); }

  // Normalize a Supabase row to the local record shape used by the UI.
  function normD(r) { return { type: 'discharge', id: r.id, stationId: r.station_id, lokasi: r.lokasi, titik: r.titik, date: r.date, qLs: Number(r.q_ls), crew: r.crew, time: r.time, created_at: r.created_at }; }
  function normG(r) { return { type: 'gwl', id: r.id, wellId: r.well_id, area: r.area, date: r.date, elevation: Number(r.elevation), depth: Number(r.depth), crew: r.crew, time: r.time, created_at: r.created_at }; }

  async function fetchData() {
    const sb = HL.sb();
    if (sb && navigator.onLine && HL.auth.isAuthed()) {
      try {
        const [{ data: d }, { data: g }] = await Promise.all([
          sb.from('discharge_records').select('*').order('date', { ascending: false }).limit(500),
          sb.from('gwl_records').select('*').order('date', { ascending: false }).limit(500)
        ]);
        return { source: 'cloud', discharge: (d || []).map(normD), gwl: (g || []).map(normG) };
      } catch (e) { console.warn('dashboard fetch failed', e); }
    }
    const all = await HL.db.all();
    return { source: 'local', discharge: all.filter((r) => r.type === 'discharge'), gwl: all.filter((r) => r.type === 'gwl') };
  }

  function latestBy(records, key) {
    const map = {};
    records.forEach((r) => {
      const k = r[key];
      if (!map[k] || (r.created_at || '') > (map[k].created_at || '')) map[k] = r;
    });
    return map;
  }

  async function render(root) {
    root.innerHTML = `<div class="fade-in"><div class="section-title">Dashboard</div><div class="card center muted">Memuat data…</div></div>`;
    const { source, discharge, gwl } = await fetchData();
    const today = todayStr(), month = monthStr();

    const dToday = discharge.filter((r) => r.date === today).length;
    const gToday = gwl.filter((r) => r.date === today).length;
    const dMonth = discharge.filter((r) => (r.date || '').startsWith(month)).length;
    const gMonth = gwl.filter((r) => (r.date || '').startsWith(month)).length;

    const latestStation = latestBy(discharge, 'stationId');
    const latestWell = latestBy(gwl, 'wellId');

    const stationCards = HL.stations.filter((s) => s.active !== false).map((s) => {
      const r = latestStation[s.id];
      return `<div class="kv"><span><b>${s.lokasi}</b> <span class="muted small">${s.titik || ''}</span></span>
        <span class="rec__val">${r ? fmt(r.qLs, 1) + ' l/s' : '<span class="muted small">—</span>'}<br/>
        <span class="muted small">${r ? r.date : 'belum ada'}</span></span></div>`;
    }).join('');

    // GWL: show how many wells measured this month per area
    const areas = HL.areas();
    const areaRows = areas.map((a) => {
      const wellsIn = HL.wells.filter((w) => w.area === a && w.active !== false).length;
      const measured = new Set(gwl.filter((r) => r.area === a && (r.date || '').startsWith(month)).map((r) => r.wellId)).size;
      return `<div class="kv"><span><b>${a}</b></span><span class="rec__val">${measured} / ${wellsIn}<br/><span class="muted small">terukur bln ini</span></span></div>`;
    }).join('');

    const recent = [...discharge, ...gwl]
      .sort((a, b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''))
      .slice(0, 8).map((r) => {
        const isQ = r.type === 'discharge';
        return `<div class="rec">
          <div class="rec__ico ${isQ ? 'debit' : 'gwl'}">${isQ ? '🌊' : '💧'}</div>
          <div class="rec__main"><b>${isQ ? r.lokasi : r.wellId}</b>
            <span>${r.date} · ${r.crew || '—'}</span></div>
          <div class="rec__val">${isQ ? fmt(r.qLs, 1) + ' l/s' : fmt(r.elevation, 2) + ' mdpl'}</div>
        </div>`;
      }).join('');

    const banner = source === 'local'
      ? `<div class="card" style="background:#fff4e0">
           <b class="small">Mode lokal</b>
           <div class="small muted">Menampilkan data perangkat ini saja. Konfigurasikan Supabase untuk rekap semua crew.</div>
         </div>`
      : `<div class="small muted" style="margin:0 2px 8px">Sumber: server · semua crew</div>`;

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Dashboard Rekap</div>
      ${banner}
      <div class="card">
        <div class="stat-row">
          <div class="stat"><b>${dToday}</b><span>Debit hari ini</span></div>
          <div class="stat"><b>${gToday}</b><span>MAT hari ini</span></div>
        </div>
        <div class="divider"></div>
        <div class="stat-row">
          <div class="stat"><b>${dMonth}</b><span>Debit bln ini</span></div>
          <div class="stat"><b>${gMonth}</b><span>MAT bln ini</span></div>
        </div>
      </div>

      <div class="section-title">Debit Terkini per Titik</div>
      <div class="card">${stationCards || '<div class="muted small center">Belum ada data</div>'}</div>

      <div class="section-title">Cakupan MAT per Area (bulan ini)</div>
      <div class="card">${areaRows || '<div class="muted small center">Belum ada data</div>'}</div>

      <div class="section-title">Aktivitas Terbaru</div>
      <div class="card">${recent || '<div class="muted small center">Belum ada data</div>'}</div>
    </div>`;
  }

  return { render };
})();
