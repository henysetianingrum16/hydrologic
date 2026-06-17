/* HydroLogic — Discharge module (debit permukaan sesaat, metode mid-section).
   Observer inputs only depth (cm) + velocity (m/s) per segment; everything else auto. */
window.HL = window.HL || {};

HL.discharge = (function () {
  let state = null;

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function blankState() {
    return {
      stationId: HL.stations[0].id,
      date: todayStr(),
      widthCm: 95,
      weather: 'Cerah',
      rainfall: '',
      note: '',
      segments: [] // {dist, depth, vel}
    };
  }

  // Build segment scaffold from river width using the auto width rule.
  function buildSegments() {
    const W = parseFloat(state.widthCm) || 0;
    const sw = HL.segmentWidth(W);
    const n = HL.segmentCount(W);
    const old = state.segments;
    const segs = [];
    for (let i = 1; i <= n; i++) {
      const dist = Math.min(i * sw, W);
      const prev = old[i - 1] || {};
      segs.push({ dist: +dist.toFixed(1), depth: prev.depth ?? '', vel: prev.vel ?? '' });
    }
    state.segments = segs;
    return { sw, n, W };
  }

  // Mid-section / mean-section calc, replicating the manual Excel form.
  function calc() {
    const pts = [{ dist: 0, depth: 0 }].concat(
      state.segments.map((s) => ({ dist: +s.dist || 0, depth: parseFloat(s.depth) || 0 }))
    );
    let totalArea = 0, totalQ = 0;
    const rows = state.segments.map((s, i) => {
      const cur = pts[i + 1], prev = pts[i];
      const area = (cur.depth + prev.depth) * (cur.dist - prev.dist) / 2 * 0.0001; // m²
      const vel = parseFloat(s.vel) || 0;
      const q = area * vel; // m³/s
      totalArea += area; totalQ += q;
      return { area, q, vel, depth: cur.depth, dist: cur.dist };
    });
    const qLs = totalQ * 1000;
    const vMean = totalArea > 0 ? totalQ / totalArea : 0;
    return { rows, totalArea, totalQ, qLs, vMean, pts };
  }

  // ---- Cross-section SVG (velocity shown as proportional dots) ----
  function crossSectionSVG(c) {
    const W = parseFloat(state.widthCm) || 1;
    const maxDepth = Math.max(10, ...c.pts.map((p) => p.depth));
    const vw = 320, vh = 190, padL = 34, padR = 14, padT = 24, padB = 30;
    const plotW = vw - padL - padR, plotH = vh - padT - padB;
    const X = (d) => padL + (d / W) * plotW;
    const Y = (depth) => padT + (depth / maxDepth) * plotH;
    const vmax = Math.max(0.01, ...c.rows.map((r) => r.vel));

    const bed = c.pts.map((p) => `${X(p.dist).toFixed(1)},${Y(p.depth).toFixed(1)}`).join(' ');
    const water = `${X(0)},${Y(0)} ` + bed + ` ${X(W)},${Y(0)}`;

    let dashes = '', dots = '';
    c.rows.forEach((r) => {
      const x = X(r.dist);
      dashes += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${Y(r.depth).toFixed(1)}" stroke="#9fb3cc" stroke-width="0.5" stroke-dasharray="2,2"/>`;
      if (r.vel > 0) {
        const rad = 2.5 + (r.vel / vmax) * 5.5;
        const cy = Y(r.depth * 0.55);
        dots += `<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="#e64a19" opacity="0.9"/>`;
      }
    });

    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#cdd6e3" stroke-width="0.8"/>
      <line x1="${padL}" y1="${Y(0)}" x2="${vw - padR}" y2="${Y(0)}" stroke="#1565c0" stroke-width="1.4"/>
      <polygon points="${water}" fill="#2563b0" opacity="0.16"/>
      <polyline points="${bed}" fill="none" stroke="#6d4c41" stroke-width="2"/>
      ${dashes}${dots}
      <text x="${padL}" y="14" font-size="8" fill="#6b7280">Kedalaman (cm) · skala 0–${maxDepth.toFixed(0)}</text>
      <text x="${padL - 4}" y="${Y(0) + 3}" font-size="7" fill="#9aa4b2" text-anchor="end">0</text>
      <text x="${padL - 4}" y="${padT + plotH}" font-size="7" fill="#9aa4b2" text-anchor="end">${maxDepth.toFixed(0)}</text>
      <text x="${X(0)}" y="${vh - 16}" font-size="7" fill="#9aa4b2" text-anchor="middle">0</text>
      <text x="${X(W)}" y="${vh - 16}" font-size="7" fill="#9aa4b2" text-anchor="middle">${W} cm</text>
      <text x="${(padL + vw - padR) / 2}" y="${vh - 4}" font-size="8" fill="#6b7280" text-anchor="middle">Jarak dari tepi (cm)</text>
    </svg>`;
  }

  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

  function deltaHTML(qLs, last) {
    if (!last) return '<span class="small" style="opacity:.7">pengukuran pertama</span>';
    const d = qLs - last.qLs;
    const cls = d > 0.05 ? 'chip--up' : d < -0.05 ? 'chip--down' : 'chip--flat';
    const ar = d > 0.05 ? '▲' : d < -0.05 ? '▼' : '▬';
    return `<span class="chip ${cls}">${ar} ${fmt(Math.abs(d), 1)} l/s</span> <span class="small muted">vs ${fmt(last.qLs, 1)} (${last.date})</span>`;
  }

  async function render(root) {
    if (!state) state = blankState();
    buildSegments();
    const c = calc();
    const st = HL.getStation(state.stationId);
    const sw = HL.segmentWidth(state.widthCm);
    const last = await HL.db.lastDischarge(state.stationId);
    state._last = last;
    const delta = deltaHTML(c.qLs, last);

    const segRows = state.segments.map((s, i) => `
      <tr>
        <td class="seg-idx">${i + 1}</td>
        <td class="calc">${fmt(s.dist, 1)}</td>
        <td><input inputmode="decimal" data-seg="${i}" data-f="depth" value="${s.depth}" placeholder="0"/></td>
        <td><input inputmode="decimal" data-seg="${i}" data-f="vel" value="${s.vel}" placeholder="0"/></td>
        <td class="calc">${fmt(c.rows[i].area, 4)}</td>
        <td class="calc">${fmt(c.rows[i].q * 1000, 2)}</td>
      </tr>`).join('');

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Pengukuran Debit — Mid-Section</div>

      <div class="card">
        <div class="row">
          <div>
            <label>Lokasi / Titik</label>
            <select id="d-station">
              ${HL.stations.map((s) => `<option value="${s.id}" ${s.id === state.stationId ? 'selected' : ''}>${s.lokasi} — ${s.titik}</option>`).join('')}
            </select>
          </div>
          <div style="max-width:130px">
            <label>Tanggal</label>
            <input type="date" id="d-date" value="${state.date}"/>
          </div>
        </div>
        <div class="row">
          <div>
            <label>Lebar Sungai (cm)</label>
            <input inputmode="decimal" id="d-width" value="${state.widthCm}"/>
            <div class="field-hint">Segmen: <b>${sw ?? '—'} cm</b> × <b>${state.segments.length}</b></div>
          </div>
          <div style="max-width:120px">
            <label>Cuaca</label>
            <select id="d-weather">
              ${['Cerah', 'Berawan', 'Hujan'].map((w) => `<option ${w === state.weather ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
          </div>
          <div style="max-width:110px">
            <label>Hujan (mm)</label>
            <input inputmode="decimal" id="d-rain" value="${state.rainfall}" placeholder="0"/>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Input per Segmen</div>
        <table class="segtable">
          <thead><tr><th>Seg</th><th>Jarak<br/>cm</th><th>Dalam<br/>cm</th><th>V<br/>m/s</th><th>Luas<br/>m²</th><th>Debit<br/>l/s</th></tr></thead>
          <tbody id="d-rows">${segRows}</tbody>
        </table>
        <div class="legend"><span><i style="background:#e64a19;border-radius:50%"></i>Titik = kecepatan (besar = cepat)</span></div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Sketsa Penampang Melintang</div>
        <div class="viz" id="d-viz">${crossSectionSVG(c)}</div>
      </div>

      <div class="card">
        <div class="result-bar">
          <div>
            <div class="small" style="opacity:.85">TOTAL DEBIT</div>
            <div><span class="big-num" id="d-q">${fmt(c.qLs, 1)}</span> <span class="unit">l/s</span></div>
            <div class="small" style="opacity:.85" id="d-q2">= ${fmt(c.totalQ, 4)} m³/s</div>
          </div>
          <div class="center">
            <div id="d-delta">${delta}</div>
            <div class="small" style="opacity:.85;margin-top:6px">A = <span id="d-area">${fmt(c.totalArea, 4)}</span> m² · V̄ = <span id="d-vmean">${fmt(c.vMean, 3)}</span> m/s</div>
          </div>
        </div>
        <label>Catatan lapangan</label>
        <textarea id="d-note" rows="2" placeholder="Kondisi aliran, sumbatan, kekeruhan…">${state.note}</textarea>
        <div class="row" style="margin-top:12px">
          <button class="btn btn--ghost btn--sm" id="d-reset">Reset</button>
          <button class="btn btn--green" id="d-save">💾 Simpan</button>
        </div>
      </div>
    </div>`;

    bind(root);
  }

  // Update only the live numbers + SVG without rebuilding inputs (keeps focus).
  function liveUpdate(root) {
    const c = calc();
    root.querySelector('#d-viz').innerHTML = crossSectionSVG(c);
    root.querySelector('#d-q').textContent = fmt(c.qLs, 1);
    root.querySelector('#d-q2').textContent = `= ${fmt(c.totalQ, 4)} m³/s`;
    root.querySelector('#d-delta').innerHTML = deltaHTML(c.qLs, state._last);
    root.querySelector('#d-area').textContent = fmt(c.totalArea, 4);
    root.querySelector('#d-vmean').textContent = fmt(c.vMean, 3);
    // recompute per-row calc cells
    const trs = root.querySelectorAll('#d-rows tr');
    trs.forEach((tr, i) => {
      const cells = tr.querySelectorAll('td.calc');
      cells[1].textContent = fmt(c.rows[i].area, 4);
      cells[2].textContent = fmt(c.rows[i].q * 1000, 2);
    });
  }

  function bind(root) {
    root.querySelector('#d-station').onchange = (e) => { state.stationId = e.target.value; render(root); };
    root.querySelector('#d-date').onchange = (e) => { state.date = e.target.value; };
    root.querySelector('#d-weather').onchange = (e) => { state.weather = e.target.value; };
    root.querySelector('#d-rain').oninput = (e) => { state.rainfall = e.target.value; };
    root.querySelector('#d-note').oninput = (e) => { state.note = e.target.value; };
    root.querySelector('#d-width').oninput = (e) => { state.widthCm = e.target.value; render(root); };
    root.querySelectorAll('#d-rows input').forEach((inp) => {
      inp.oninput = (e) => {
        const i = +e.target.dataset.seg, f = e.target.dataset.f;
        state.segments[i][f] = e.target.value;
        liveUpdate(root);
      };
    });
    root.querySelector('#d-reset').onclick = () => { state = blankState(); render(root); };
    root.querySelector('#d-save').onclick = () => save(root);
  }

  async function save(root) {
    const c = calc();
    const measured = state.segments.filter((s) => s.depth !== '' && s.vel !== '');
    if (!measured.length) { HL.toast('Isi minimal satu segmen dulu', 'err'); return; }
    if (c.qLs <= 0) { HL.toast('Debit masih 0 — cek input', 'err'); return; }
    const st = HL.getStation(state.stationId);
    const rec = {
      type: 'discharge', stationId: state.stationId, lokasi: st.lokasi, titik: st.titik,
      date: state.date, widthCm: parseFloat(state.widthCm),
      segmentWidth: HL.segmentWidth(state.widthCm),
      weather: state.weather, rainfall: state.rainfall === '' ? null : parseFloat(state.rainfall),
      note: state.note,
      segments: state.segments.map((s, i) => ({
        dist: +s.dist, depth: parseFloat(s.depth) || 0, vel: parseFloat(s.vel) || 0,
        area: c.rows[i].area, q: c.rows[i].q
      })),
      totalArea: c.totalArea, totalQ: c.totalQ, qLs: c.qLs, vMean: c.vMean,
      gps: { lat: st.lat, lng: st.lng }, crew: HL.crew(), time: new Date().toTimeString().slice(0, 5)
    };
    await HL.db.put(rec);
    HL.toast('Debit tersimpan (offline-ready)', 'ok');
    document.dispatchEvent(new CustomEvent('hl:saved'));
    state = blankState();
    HL.go('records');
  }

  return { render, _calc: calc, reset() { state = null; } };
})();
