/* HydroLogic — Groundwater Level (MAT) module.
   Observer inputs only depth GWL (m); elevation = Z − stickUp − depth (auto). */
window.HL = window.HL || {};

HL.gwl = (function () {
  let state = null;

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function blankState() {
    const area = HL.areas()[0];
    return { area, wellId: HL.wellsByArea(area)[0].id, date: todayStr(), depth: '', note: '' };
  }

  function elevation(well, depth) {
    const d = parseFloat(depth);
    if (!Number.isFinite(d)) return null;
    return well.z - well.stickUp - d;
  }

  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

  // ---- Well profile SVG ----
  function wellSVG(well, depth, lastDepth) {
    const vw = 300, vh = 230;
    const d = parseFloat(depth);
    const groundY = 56, bottomY = 200;
    // depth scale: map 0..maxDepth(m) to groundY..bottomY. Use a sensible max.
    const maxD = Math.max(20, (Number.isFinite(d) ? d : 0) * 1.25, (lastDepth || 0) * 1.25);
    const Y = (m) => groundY + (m / maxD) * (bottomY - groundY);
    const cx = 165, boreW = 26;
    const waterY = Number.isFinite(d) ? Y(d) : null;
    const lastY = Number.isFinite(lastDepth) ? Y(lastDepth) : null;

    let waterEls = '';
    if (waterY != null) {
      waterEls = `
        <rect x="${cx - boreW / 2 + 1}" y="${waterY}" width="${boreW - 2}" height="${bottomY - waterY}" fill="#1565c0" opacity="0.3"/>
        <line x1="${cx - 40}" y1="${waterY}" x2="${cx + 40}" y2="${waterY}" stroke="#1565c0" stroke-width="1.6"/>
        <line x1="${cx - 60}" y1="${groundY - 14}" x2="${cx - 60}" y2="${waterY}" stroke="#e65100" stroke-width="1.4"/>
        <text x="${cx - 64}" y="${(groundY - 14 + waterY) / 2}" font-size="9" fill="#e65100" text-anchor="end" font-weight="700">${fmt(d, 2)} m</text>
        <text x="${cx - 64}" y="${(groundY - 14 + waterY) / 2 + 11}" font-size="6.5" fill="#e65100" text-anchor="end">depth</text>`;
    }
    let lastEls = '';
    if (lastY != null) {
      lastEls = `<line x1="${cx - boreW / 2 + 1}" y1="${lastY}" x2="${cx + boreW / 2 - 1}" y2="${lastY}" stroke="#ff9800" stroke-width="1.2" stroke-dasharray="3,2"/>
        <text x="${cx + boreW / 2 + 6}" y="${lastY + 3}" font-size="7" fill="#ff9800">terakhir</text>`;
    }
    const elev = elevation(well, depth);
    let elevEl = '';
    if (elev != null) {
      elevEl = `<rect x="${cx + 22}" y="${(waterY || bottomY) - 9}" width="78" height="18" rx="4" fill="#e8f1fb" stroke="#2563b0" stroke-width="0.6"/>
        <text x="${cx + 61}" y="${(waterY || bottomY) + 3}" font-size="8.5" fill="#1565c0" text-anchor="middle" font-weight="700">${fmt(elev, 2)} mdpl</text>`;
    }

    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="soilp" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#8d6e63" stroke-width="0.5" opacity="0.25"/></pattern></defs>
      <rect x="40" y="${groundY}" width="${cx - boreW / 2 - 40}" height="${bottomY - groundY}" fill="url(#soilp)"/>
      <rect x="${cx + boreW / 2}" y="${groundY}" width="${vw - 30 - (cx + boreW / 2)}" height="${bottomY - groundY}" fill="url(#soilp)"/>
      <rect x="40" y="${groundY - 2}" width="${vw - 70}" height="3" fill="#8d6e63"/>
      <text x="40" y="${groundY - 6}" font-size="7.5" fill="#6d4c41">permukaan tanah · Z ${fmt(well.z, 2)} mdpl</text>
      <rect x="${cx - boreW / 2 - 3}" y="${groundY - 14}" width="${boreW + 6}" height="10" fill="#9aa4b2" stroke="#5b6573" stroke-width="0.6"/>
      <text x="${cx + boreW / 2 + 6}" y="${groundY - 6}" font-size="6.5" fill="#6b7280">stick up ${fmt(well.stickUp, 2)} m</text>
      <rect x="${cx - boreW / 2}" y="${groundY}" width="${boreW}" height="${bottomY - groundY}" fill="#fff" stroke="#aab4c2" stroke-width="0.8"/>
      ${waterEls}${lastEls}${elevEl}
      <text x="${cx}" y="${vh - 6}" font-size="7.5" fill="#6b7280" text-anchor="middle">GWL = Z − stick up − depth</text>
    </svg>`;
  }

  async function render(root) {
    if (!state) state = blankState();
    const well = HL.getWell(state.wellId);
    const elev = elevation(well, state.depth);
    const last = await HL.db.lastGwl(state.wellId);

    let delta = '';
    if (last && elev != null) {
      const dd = elev - last.elevation;
      const cls = dd > 0.005 ? 'chip--up' : dd < -0.005 ? 'chip--down' : 'chip--flat';
      const ar = dd > 0.005 ? '▲' : dd < -0.005 ? '▼' : '▬';
      delta = `<span class="chip ${cls}">${ar} ${fmt(Math.abs(dd), 2)} m</span> <span class="small muted">vs ${fmt(last.elevation, 2)} mdpl (${last.date})</span>`;
    }

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Monitoring Muka Air Tanah</div>

      <div class="card">
        <div class="row">
          <div>
            <label>Area</label>
            <select id="g-area">
              ${HL.areas().map((a) => `<option ${a === state.area ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Sumur</label>
            <select id="g-well">
              ${HL.wellsByArea(state.area).map((w) => `<option value="${w.id}" ${w.id === state.wellId ? 'selected' : ''}>${w.id} — Z ${fmt(w.z, 2)}${w.active ? '' : ' (inaktif)'}</option>`).join('')}
            </select>
          </div>
          <div style="max-width:130px">
            <label>Tanggal</label>
            <input type="date" id="g-date" value="${state.date}"/>
          </div>
        </div>
        <div class="row" style="margin-top:6px">
          <div class="kv"><span class="muted">Elevasi tanah (Z)</span><b>${fmt(well.z, 2)} mdpl</b></div>
          <div class="kv"><span class="muted">Stick up</span><b>${fmt(well.stickUp, 2)} m</b></div>
          <div class="kv"><span class="muted">Konstruksi</span><b>${well.tahun}</b></div>
        </div>
      </div>

      <div class="card">
        <label>Depth GWL (m) — satu-satunya input</label>
        <input class="big" inputmode="decimal" id="g-depth" value="${state.depth}" placeholder="0.00"/>
        <div class="field-hint">Diukur dari top of casing</div>

        <div class="result-bar green" style="margin-top:12px">
          <div>
            <div class="small" style="opacity:.85">GWL ELEVATION (otomatis)</div>
            <div><span class="big-num" id="g-elev">${elev != null ? fmt(elev, 2) : '—'}</span> <span class="unit">mdpl</span></div>
          </div>
          <div class="center" id="g-delta">${delta || '<span class="small" style="opacity:.7">pengukuran pertama</span>'}</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Profil Sumur — ${well.id}</div>
        <div class="viz" id="g-viz">${wellSVG(well, state.depth, last ? last.depth : null)}</div>
      </div>

      <div class="card">
        <label>Catatan lapangan</label>
        <textarea id="g-note" rows="2" placeholder="Kondisi casing, akses, dll.">${state.note}</textarea>
        <div class="row" style="margin-top:12px">
          <button class="btn btn--ghost btn--sm" id="g-reset">Reset</button>
          <button class="btn btn--green" id="g-save">💾 Simpan</button>
        </div>
      </div>
    </div>`;

    bind(root, last);
  }

  function bind(root, last) {
    root.querySelector('#g-area').onchange = (e) => {
      state.area = e.target.value;
      state.wellId = HL.wellsByArea(state.area)[0].id;
      render(root);
    };
    root.querySelector('#g-well').onchange = (e) => { state.wellId = e.target.value; state.depth = ''; render(root); };
    root.querySelector('#g-date').onchange = (e) => { state.date = e.target.value; };
    root.querySelector('#g-note').oninput = (e) => { state.note = e.target.value; };
    root.querySelector('#g-depth').oninput = (e) => {
      state.depth = e.target.value;
      const well = HL.getWell(state.wellId);
      const elev = elevation(well, state.depth);
      root.querySelector('#g-elev').textContent = elev != null ? fmt(elev, 2) : '—';
      root.querySelector('#g-viz').innerHTML = wellSVG(well, state.depth, last ? last.depth : null);
      // live delta
      const dEl = root.querySelector('#g-delta');
      if (last && elev != null) {
        const dd = elev - last.elevation;
        const cls = dd > 0.005 ? 'chip--up' : dd < -0.005 ? 'chip--down' : 'chip--flat';
        const ar = dd > 0.005 ? '▲' : dd < -0.005 ? '▼' : '▬';
        dEl.innerHTML = `<span class="chip ${cls}">${ar} ${fmt(Math.abs(dd), 2)} m</span> <span class="small muted">vs ${fmt(last.elevation, 2)} (${last.date})</span>`;
      }
    };
    root.querySelector('#g-reset').onclick = () => { state = blankState(); render(root); };
    root.querySelector('#g-save').onclick = () => save(root);
  }

  async function save(root) {
    const well = HL.getWell(state.wellId);
    const elev = elevation(well, state.depth);
    if (elev == null) { HL.toast('Isi depth GWL dulu', 'err'); return; }
    if (parseFloat(state.depth) < 0) { HL.toast('Depth tidak boleh negatif', 'err'); return; }
    const rec = {
      type: 'gwl', wellId: well.id, area: well.area, z: well.z, stickUp: well.stickUp,
      date: state.date, depth: parseFloat(state.depth), elevation: elev,
      note: state.note, crew: HL.crew(), time: new Date().toTimeString().slice(0, 5)
    };
    await HL.db.put(rec);
    HL.toast('MAT tersimpan (offline-ready)', 'ok');
    document.dispatchEvent(new CustomEvent('hl:saved'));
    state = blankState();
    HL.go('records');
  }

  return { render, reset() { state = null; }, elevation };
})();
