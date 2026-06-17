/* HydroLogic — app shell: routing, home, records, init. */
window.HL = window.HL || {};

(function () {
  const view = () => document.getElementById('view');
  let toastTimer = null;

  HL.toast = function (msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, 2600);
  };

  HL.crew = function () {
    return (HL.auth && HL.auth.crewName) ? HL.auth.crewName() : (localStorage.getItem('hl_crew') || 'Crew Lapangan');
  };

  HL.go = function (route) {
    document.querySelectorAll('.navbtn').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));
    const root = view();
    root.scrollTop = 0; window.scrollTo(0, 0);
    if (route === 'discharge') { HL.discharge.reset(); HL.discharge.render(root); }
    else if (route === 'gwl') { HL.gwl.reset(); HL.gwl.render(root); }
    else if (route === 'records') renderRecords(root);
    else if (route === 'dashboard') HL.dashboard.render(root);
    else renderHome(root);
  };

  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  async function renderHome(root) {
    const all = await HL.db.all();
    const today = todayStr();
    const qToday = all.filter((r) => r.type === 'discharge' && r.date === today).length;
    const gToday = all.filter((r) => r.type === 'gwl' && r.date === today).length;
    const pending = (await HL.db.unsynced()).length;

    root.innerHTML = `
    <div class="fade-in">
      <div class="hero">
        <h1>Halo, ${HL.crew()} 👋</h1>
        <p>Pengukuran hari ini tersimpan di perangkat & siap sinkron. Bekerja penuh tanpa sinyal.</p>
      </div>

      <div class="card">
        <div class="stat-row">
          <div class="stat"><b>${qToday}</b><span>Debit hari ini</span></div>
          <div class="stat"><b>${gToday}</b><span>MAT hari ini</span></div>
          <div class="stat"><b>${pending}</b><span>Antri sinkron</span></div>
        </div>
      </div>

      <div class="section-title">Mulai Pengukuran</div>
      <div class="tiles">
        <button class="tile tile--debit" data-route="discharge">
          <span class="tile__ico">🌊</span>
          <span class="tile__t">Debit</span>
          <span class="tile__d">Mid-section, kalkulasi real-time</span>
        </button>
        <button class="tile tile--gwl" data-route="gwl">
          <span class="tile__ico">💧</span>
          <span class="tile__t">Muka Air Tanah</span>
          <span class="tile__d">Input depth, elevasi otomatis</span>
        </button>
        <button class="tile tile--data" data-route="records">
          <span class="tile__ico">📋</span>
          <span class="tile__t">Data Tersimpan</span>
          <span class="tile__d">${all.length} record</span>
        </button>
        <button class="tile tile--report" id="home-report">
          <span class="tile__ico">📄</span>
          <span class="tile__t">Laporan Harian</span>
          <span class="tile__d">PDF → WhatsApp</span>
        </button>
      </div>

      ${HL.auth.localMode() ? '' : `
      <div class="card" style="margin-top:12px">
        <div class="kv"><span class="muted small">Masuk sebagai</span><b class="small">${HL.crew()}</b></div>
        <button class="btn btn--ghost btn--sm" id="home-signout" style="margin-top:8px">Keluar</button>
      </div>`}
    </div>`;

    root.querySelector('#home-report').onclick = () => HL.report.generateDaily(today);
    const so = root.querySelector('#home-signout');
    if (so) so.onclick = async () => { await HL.auth.signOut(); location.reload(); };
  }

  async function renderRecords(root) {
    const all = await HL.db.all();
    const today = todayStr();

    const item = (r) => {
      const isQ = r.type === 'discharge';
      const title = isQ ? `${r.lokasi} — ${r.titik}` : `${r.wellId} · ${r.area}`;
      const val = isQ ? `${fmt(r.qLs, 1)} l/s` : `${fmt(r.elevation, 2)} mdpl`;
      const sync = r.synced ? '<span class="chip chip--ok">✓ sinkron</span>' : '<span class="chip chip--wait">⏳ antri</span>';
      return `<div class="rec rec--col">
        <div class="rec__top">
          <div class="rec__ico ${isQ ? 'debit' : 'gwl'}">${isQ ? '🌊' : '💧'}</div>
          <div class="rec__main">
            <b>${title}</b>
            <span>${r.date} · ${r.time || ''} · ${sync}</span>
          </div>
          <div class="rec__val">${val}</div>
        </div>
        <div class="rec-actions">
          <button class="rec-act" data-view="${r.id}">👁 Lihat</button>
          <button class="rec-act" data-dl="${r.id}">⬇ Unduh</button>
          <button class="rec-act" data-share="${r.id}">💬 WA</button>
          <button class="rec-act rec-act--danger" data-del="${r.id}">🗑 Hapus</button>
        </div>
      </div>`;
    };

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Laporan Harian</div>
      <div class="card">
        <div class="kv"><span class="muted">Tanggal</span><b>${today}</b></div>
        <div class="small muted" style="margin:4px 0 10px">Gabungkan semua pengukuran hari ini jadi 1 PDF (Debit + MAT) dan kirim ke WhatsApp.</div>
        <button class="btn btn--orange" id="rec-daily">📄 Buat & Kirim Laporan Harian</button>
      </div>

      <div class="section-title">Data Tersimpan (${all.length})</div>
      <div class="card">
        ${all.length ? all.map(item).join('') : '<div class="center muted small" style="padding:20px 0">Belum ada data. Mulai dari menu Debit atau MAT.</div>'}
      </div>
    </div>`;

    root.querySelector('#rec-daily').onclick = () => HL.report.generateDaily(today);
    const find = (id) => all.find((r) => r.id === id);
    root.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { const r = find(b.dataset.view); if (r) HL.report.viewSingle(r); });
    root.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => { const r = find(b.dataset.dl); if (r) HL.report.downloadSingle(r); });
    root.querySelectorAll('[data-share]').forEach((b) => b.onclick = () => { const r = find(b.dataset.share); if (r) HL.report.generateSingle(r); });
    root.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => deleteRecord(find(b.dataset.del), root));
  }

  async function deleteRecord(rec, root) {
    if (!rec) return;
    const label = rec.type === 'discharge' ? `${rec.lokasi} (${rec.date})` : `${rec.wellId} (${rec.date})`;
    if (!confirm(`Hapus data ${label}? Tindakan ini tidak bisa dibatalkan.`)) return;
    // Remote delete first (only own rows allowed by RLS); ignore if offline/local.
    const sb = HL.sb && HL.sb();
    if (sb && navigator.onLine && HL.auth.isAuthed()) {
      try {
        const table = rec.type === 'discharge' ? 'discharge_records' : 'gwl_records';
        await sb.from(table).delete().eq('id', rec.id);
      } catch (e) { console.warn('remote delete failed', e); }
    }
    await HL.db.remove(rec.id);
    HL.toast('Data dihapus', 'ok');
    HL.go('records');
  }

  // Global nav delegation (works for bottom nav, back links, tiles).
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-route]');
    if (el) { e.preventDefault(); HL.go(el.dataset.route); }
  });

  document.addEventListener('hl:synced', () => {
    const active = document.querySelector('.navbtn.is-active');
    if (active && ['records', 'home', 'dashboard'].includes(active.dataset.route)) HL.go(active.dataset.route);
  });

  function showNav(show) {
    const n = document.getElementById('bottomnav');
    if (n) n.style.display = show ? 'flex' : 'none';
  }

  async function startApp() {
    showNav(true);
    if (!HL.auth.localMode()) { await HL.sync.pullMaster(); HL.sync.flush(); }
    HL.sync.refresh();
    HL.go('home');
  }

  // ---- Init ----
  async function init() {
    await HL.db.open();
    const auth = await HL.auth.init();   // local mode if Supabase unconfigured
    HL.sync.init();
    if (!auth.authed) {
      showNav(false);                    // configured but not logged in -> login screen
      HL.auth.renderLogin(view(), startApp);
    } else {
      startApp();
    }
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW failed', e); }
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
