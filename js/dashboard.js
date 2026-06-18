/* HydroLogic — engineer dashboard (rekap) + grafik fluktuasi.
 * Connected mode: reads ALL crews' data from Supabase. Local mode: IndexedDB. */
window.HL = window.HL || {};

HL.dashboard = (function () {
  let _d = { discharge: [], gwl: [] };   // cached for chart redraws

  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function monthStr() { return new Date().toISOString().slice(0, 7); }
  function dShort(s) { const p = (s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : s; }
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function monthLabel(m) { const p = (m || '').split('-'); return p.length === 2 ? MO[+p[1] - 1] + ' ' + p[0] : m; }

  function normD(r) { return { type: 'discharge', id: r.id, stationId: r.station_id, lokasi: r.lokasi, titik: r.titik, date: r.date, qLs: Number(r.q_ls), rainfall: r.rainfall == null ? null : Number(r.rainfall), crew: r.crew, time: r.time, created_at: r.created_at }; }
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
    records.forEach((r) => { const k = r[key]; if (!map[k] || (r.created_at || '') > (map[k].created_at || '')) map[k] = r; });
    return map;
  }

  // One point per date (latest record of that date). Returns sorted ascending by date.
  function seriesByDate(records, valueKey, extraKey) {
    const byDate = {};
    records.forEach((r) => {
      const d = r.date; if (!d) return;
      if (!byDate[d] || (r.created_at || '') > (byDate[d].created_at || '')) byDate[d] = r;
    });
    return Object.keys(byDate).sort().map((d) => ({
      date: d, y: byDate[d][valueKey], extra: extraKey ? byDate[d][extraKey] : null
    }));
  }

  function countBy(records, key) {
    const c = {}; records.forEach((r) => { c[r[key]] = (c[r[key]] || 0) + 1; }); return c;
  }
  function topKey(counts) {
    let best = null, n = -1; for (const k in counts) if (counts[k] > n) { n = counts[k]; best = k; } return best;
  }

  // ---- SVG charts ----
  function emptyChart(msg) { return `<div class="muted small center" style="padding:26px 0">${msg}</div>`; }

  function lineChart(series, opts) {
    if (!series.length) return emptyChart('Belum ada data');
    const o = Object.assign({ color: '#1565c0', unit: '', bars: false, barColor: '#90caf9', barUnit: 'mm', pad: true }, opts);
    const vw = 320, vh = 178, padL = 38, padR = 14, padT = 16, padB = 30;
    const plotW = vw - padL - padR, plotH = vh - padT - padB;
    const ys = series.map((p) => p.y).filter(Number.isFinite);
    let ymin = Math.min(...ys), ymax = Math.max(...ys);
    if (o.pad) { const m = (ymax - ymin) || Math.abs(ymax) || 1; ymin -= m * 0.12; ymax += m * 0.12; }
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const n = series.length;
    const X = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const Y = (v) => padT + plotH - ((v - ymin) / (ymax - ymin)) * plotH;

    // optional rainfall bars (secondary axis)
    let bars = '';
    if (o.bars) {
      const rains = series.map((p) => (p.extra == null ? 0 : p.extra));
      const rmax = Math.max(1, ...rains);
      const bw = Math.max(3, Math.min(16, plotW / n * 0.5));
      series.forEach((p, i) => {
        const r = p.extra == null ? 0 : p.extra; if (r <= 0) return;
        const h = (r / rmax) * (plotH * 0.55);
        bars += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${o.barColor}" opacity="0.55"/>`;
      });
    }

    const pts = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    let dots = '';
    series.forEach((p, i) => { dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${i === n - 1 ? 3.5 : 2.4}" fill="${o.color}"/>`; });

    // x labels (max ~6)
    let xl = '';
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) xl += `<text x="${X(i).toFixed(1)}" y="${vh - 8}" font-size="7.5" fill="#9aa4b2" text-anchor="middle">${dShort(series[i].date)}</text>`;
    if ((n - 1) % step !== 0) xl += `<text x="${X(n - 1).toFixed(1)}" y="${vh - 8}" font-size="7.5" fill="#9aa4b2" text-anchor="middle">${dShort(series[n - 1].date)}</text>`;

    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#cdd6e3" stroke-width="0.8"/>
      <line x1="${padL}" y1="${padT + plotH}" x2="${vw - padR}" y2="${padT + plotH}" stroke="#cdd6e3" stroke-width="0.8"/>
      <text x="${padL - 4}" y="${padT + 4}" font-size="7.5" fill="#9aa4b2" text-anchor="end">${fmt(ymax, ymax > 50 ? 0 : 1)}</text>
      <text x="${padL - 4}" y="${padT + plotH}" font-size="7.5" fill="#9aa4b2" text-anchor="end">${fmt(ymin, ymin > 50 ? 0 : 1)}</text>
      ${bars}
      <polyline points="${pts}" fill="none" stroke="${o.color}" stroke-width="2"/>
      ${dots}${xl}
    </svg>`;
  }

  function renderDebitChart(stationId) {
    const recs = _d.discharge.filter((r) => r.stationId === stationId);
    const s = seriesByDate(recs, 'qLs', 'rainfall');
    const hasRain = s.some((p) => p.extra != null && p.extra > 0);
    return lineChart(s, { color: '#1565c0', unit: 'l/s', bars: hasRain, barColor: '#64b5f6' });
  }
  function renderGwlChart(wellId) {
    const recs = _d.gwl.filter((r) => r.wellId === wellId);
    const s = seriesByDate(recs, 'elevation');
    return lineChart(s, { color: '#2e7d32', unit: 'mdpl' });
  }

  async function render(root) {
    root.innerHTML = `<div class="fade-in"><div class="section-title">Dashboard</div><div class="card center muted">Memuat data…</div></div>`;
    const { source, discharge, gwl } = await fetchData();
    _d = { discharge, gwl };
    const today = todayStr(), month = monthStr();

    const dToday = discharge.filter((r) => r.date === today).length;
    const gToday = gwl.filter((r) => r.date === today).length;
    const dMonth = discharge.filter((r) => (r.date || '').startsWith(month)).length;
    const gMonth = gwl.filter((r) => (r.date || '').startsWith(month)).length;

    const latestStation = latestBy(discharge, 'stationId');
    const stationCards = HL.stations.filter((s) => s.active !== false).map((s) => {
      const r = latestStation[s.id];
      return `<div class="kv"><span><b>${s.lokasi}</b> <span class="muted small">${s.titik || ''}</span></span>
        <span class="rec__val">${r ? fmt(r.qLs, 1) + ' l/s' : '<span class="muted small">—</span>'}<br/>
        <span class="muted small">${r ? r.date : 'belum ada'}</span></span></div>`;
    }).join('');

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
        return `<div class="rec"><div class="rec__ico ${isQ ? 'debit' : 'gwl'}">${isQ ? '🌊' : '💧'}</div>
          <div class="rec__main"><b>${isQ ? r.lokasi : r.wellId}</b><span>${r.date} · ${r.crew || '—'}</span></div>
          <div class="rec__val">${isQ ? fmt(r.qLs, 1) + ' l/s' : fmt(r.elevation, 2) + ' mdpl'}</div></div>`;
      }).join('');

    // chart defaults: station/well with most records (fallback to first active)
    const qStations = HL.stations.filter((s) => s.active !== false);
    const defQ = topKey(countBy(discharge, 'stationId')) || (qStations[0] && qStations[0].id);
    const gWells = HL.wells.filter((w) => w.active !== false);
    const defG = topKey(countBy(gwl, 'wellId')) || (gWells[0] && gWells[0].id);

    // bulan yang punya data (untuk dropdown rentang export)
    const months = [...new Set([...discharge, ...gwl].map((r) => (r.date || '').slice(0, 7)).filter(Boolean))].sort();
    if (!months.length) months.push(month);
    const defFrom = months[0], defTo = months[months.length - 1];
    const monthOptions = (sel) => months.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${monthLabel(m)}</option>`).join('');

    const banner = source === 'local'
      ? `<div class="card" style="background:#fff4e0"><b class="small">Mode lokal</b><div class="small muted">Menampilkan data perangkat ini saja. Konfigurasikan Supabase untuk rekap semua crew.</div></div>`
      : `<div class="small muted" style="margin:0 2px 8px">Sumber: server · semua crew</div>`;

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Dashboard Rekap</div>
      ${banner}
      <div class="card" style="margin-bottom:12px">
        <label>Download Excel — pilih rentang bulan</label>
        <div class="row">
          <div><span class="field-hint">Dari</span><select id="exp-from">${monthOptions(defFrom)}</select></div>
          <div><span class="field-hint">Sampai</span><select id="exp-to">${monthOptions(defTo)}</select></div>
        </div>
        <button class="btn btn--green" id="dash-export" style="margin-top:10px">⬇ Download Excel</button>
        <div class="field-hint" style="margin-top:4px">Kosongkan/biarkan penuh = semua data.</div>
      </div>
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

      <div class="section-title">Grafik Fluktuasi Debit</div>
      <div class="card">
        <label>Titik</label>
        <select id="dash-q-sel">
          ${qStations.map((s) => `<option value="${s.id}" ${s.id === defQ ? 'selected' : ''}>${s.lokasi} — ${s.titik || ''}</option>`).join('')}
        </select>
        <div class="viz" id="dash-q-chart" style="margin-top:10px">${defQ ? renderDebitChart(defQ) : emptyChart('Belum ada data')}</div>
        <div class="legend"><span><i style="background:#1565c0"></i>Debit (l/s)</span><span><i style="background:#64b5f6"></i>Curah hujan (mm)</span></div>
      </div>

      <div class="section-title">Grafik Fluktuasi Muka Air Tanah</div>
      <div class="card">
        <label>Sumur</label>
        <select id="dash-g-sel">
          ${gWells.map((w) => `<option value="${w.id}" ${w.id === defG ? 'selected' : ''}>${w.id} — ${w.area}</option>`).join('')}
        </select>
        <div class="viz" id="dash-g-chart" style="margin-top:10px">${defG ? renderGwlChart(defG) : emptyChart('Belum ada data')}</div>
        <div class="legend"><span><i style="background:#2e7d32"></i>Elevasi MAT (mdpl)</span></div>
      </div>

      <div class="section-title">Debit Terkini per Titik</div>
      <div class="card">${stationCards || '<div class="muted small center">Belum ada data</div>'}</div>

      <div class="section-title">Cakupan MAT per Area (bulan ini)</div>
      <div class="card">${areaRows || '<div class="muted small center">Belum ada data</div>'}</div>

      <div class="section-title">Aktivitas Terbaru</div>
      <div class="card">${recent || '<div class="muted small center">Belum ada data</div>'}</div>
    </div>`;

    const exp = root.querySelector('#dash-export');
    if (exp) exp.onclick = () => HL.exportExcel({
      from: root.querySelector('#exp-from') ? root.querySelector('#exp-from').value : null,
      to: root.querySelector('#exp-to') ? root.querySelector('#exp-to').value : null
    });

    const qSel = root.querySelector('#dash-q-sel');
    if (qSel) qSel.onchange = (e) => { root.querySelector('#dash-q-chart').innerHTML = renderDebitChart(e.target.value); };
    const gSel = root.querySelector('#dash-g-sel');
    if (gSel) gSel.onchange = (e) => { root.querySelector('#dash-g-chart').innerHTML = renderGwlChart(e.target.value); };
  }

  return { render };
})();
