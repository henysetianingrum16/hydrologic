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

  HL.crew = function () { return localStorage.getItem('hl_crew') || 'Crew Lapangan'; };

  HL.go = function (route) {
    document.querySelectorAll('.navbtn').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));
    const root = view();
    root.scrollTop = 0; window.scrollTo(0, 0);
    if (route === 'discharge') { HL.discharge.reset(); HL.discharge.render(root); }
    else if (route === 'gwl') { HL.gwl.reset(); HL.gwl.render(root); }
    else if (route === 'records') renderRecords(root);
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
    </div>`;

    root.querySelector('#home-report').onclick = () => HL.report.generateDaily(today);
  }

  async function renderRecords(root) {
    const all = await HL.db.all();
    const today = todayStr();

    const item = (r) => {
      const isQ = r.type === 'discharge';
      const title = isQ ? `${r.lokasi} — ${r.titik}` : `${r.wellId} · ${r.area}`;
      const val = isQ ? `${fmt(r.qLs, 1)} l/s` : `${fmt(r.elevation, 2)} mdpl`;
      const sync = r.synced ? '<span class="chip chip--ok">✓ sinkron</span>' : '<span class="chip chip--wait">⏳ antri</span>';
      return `<div class="rec">
        <div class="rec__ico ${isQ ? 'debit' : 'gwl'}">${isQ ? '🌊' : '💧'}</div>
        <div class="rec__main">
          <b>${title}</b>
          <span>${r.date} · ${r.time || ''} · ${sync}</span>
        </div>
        <div class="rec__val">${val}<br/><button class="back-link" data-pdf="${r.id}">PDF</button></div>
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
    root.querySelectorAll('[data-pdf]').forEach((b) => {
      b.onclick = async () => {
        const rec = all.find((r) => r.id === b.dataset.pdf);
        if (rec) HL.report.generateSingle(rec);
      };
    });
  }

  // Global nav delegation (works for bottom nav, back links, tiles).
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-route]');
    if (el) { e.preventDefault(); HL.go(el.dataset.route); }
  });

  document.addEventListener('hl:synced', () => {
    const active = document.querySelector('.navbtn.is-active');
    if (active && (active.dataset.route === 'records' || active.dataset.route === 'home')) HL.go(active.dataset.route);
  });

  // ---- Init ----
  async function init() {
    await HL.db.open();
    HL.sync.init();
    HL.go('home');
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW failed', e); }
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
