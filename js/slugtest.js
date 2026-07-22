/* HydroLogic — Slug Test (Hvorslev) UI. Reaktif: hitung ulang tiap input berubah,
 * tanpa tombol "Hitung". Logika angka ada di modul murni HL.slug. */
window.HL = window.HL || {};

HL.slugtest = (function () {
  let state = null;
  let showReg = false;

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function blankState() {
    return {
      lokasi: '', holeId: '', date: todayStr(), jamMulai: '', pencatat: '', jenis: 'Falling head',
      matStatic: '', L: '', pipe: 'PQ', R: HL.slug.PIPE_SIZES.PQ.R_cm, r: 2.54,
      readings: [{ interval: '', mat: '' }, { interval: '', mat: '' }, { interval: '', mat: '' }]
    };
  }

  const P = HL.slug.parseNum;
  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function sci(n) { return (n == null || !Number.isFinite(n)) ? '—' : n.toExponential(2); }

  // Bentuk input untuk modul murni dari state saat ini.
  function buildInput() {
    return {
      matStatic: P(state.matStatic), L_m: P(state.L), R_cm: P(state.R), r_cm: P(state.r),
      readings: state.readings.map((rd) => ({ interval: P(rd.interval), mat: P(rd.mat) }))
    };
  }

  // ---------- Grafik semi-log (SVG murni, palet design system) ----------
  function chartSVG(res) {
    const pts = res.rows.filter((s) => s.ratio != null && s.ratio > 0);
    const dropped = res.rows.length - pts.length;
    if (!pts.length) return { svg: '<div class="muted small center" style="padding:26px 0">Belum ada data untuk digambar</div>', dropped };
    const vw = 340, vh = 240, padL = 42, padR = 16, padT = 16, padB = 34;
    const plotW = vw - padL - padR, plotH = vh - padT - padB;
    const tMax = Math.max(...pts.map((p) => p.tcum), res.T0 || 0) * 1.05 || 1;
    const minR = Math.min(...pts.map((p) => p.ratio));
    const ymin = Math.max(1e-3, Math.min(0.01, minR * 0.8));
    const ymax = Math.max(1.0, ...pts.map((p) => p.ratio));
    const lyMax = Math.log10(ymax), lyMin = Math.log10(ymin);
    const X = (t) => padL + (t / tMax) * plotW;
    const Y = (v) => padT + plotH * (1 - (Math.log10(v) - lyMin) / (lyMax - lyMin));

    let grid = '';
    [1, 0.37, 0.1, 0.01].forEach((v) => {
      if (v > ymax || v < ymin) return;
      const y = Y(v);
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${vw - padR}" y2="${y.toFixed(1)}" stroke="#eef1f6" stroke-width="1"/>`;
      grid += `<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" font-size="8" fill="#9aa4b2" text-anchor="end">${v}</text>`;
    });
    // sumbu
    let axes = `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#cdd6e3" stroke-width="0.8"/>
      <line x1="${padL}" y1="${padT + plotH}" x2="${vw - padR}" y2="${padT + plotH}" stroke="#cdd6e3" stroke-width="0.8"/>`;
    for (let k = 0; k <= 4; k++) { const t = tMax * k / 4; const x = X(t); axes += `<text x="${x.toFixed(1)}" y="${vh - 20}" font-size="7.5" fill="#9aa4b2" text-anchor="middle">${Math.round(t)}</text>`; }
    axes += `<text x="${padL + plotW / 2}" y="${vh - 4}" font-size="8.5" fill="#6b7280" text-anchor="middle">Waktu kumulatif (detik)</text>`;
    axes += `<text x="12" y="${padT + plotH / 2}" font-size="8.5" fill="#6b7280" text-anchor="middle" transform="rotate(-90 12 ${padT + plotH / 2})">h / H₀ (skala log)</text>`;

    // garis referensi 0.37 & T0
    let refs = '';
    if (0.37 >= ymin && 0.37 <= ymax) {
      const y = Y(0.37);
      refs += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${vw - padR}" y2="${y.toFixed(1)}" stroke="#e65100" stroke-width="1" stroke-dasharray="4,3"/>`;
      refs += `<text x="${vw - padR}" y="${(y - 3).toFixed(1)}" font-size="8" fill="#e65100" text-anchor="end">0,37</text>`;
    }
    if (res.T0 != null) {
      const x = X(res.T0);
      refs += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + plotH}" stroke="#673ab7" stroke-width="1" stroke-dasharray="4,3"/>`;
      refs += `<text x="${(x + 3).toFixed(1)}" y="${padT + 8}" font-size="8" fill="#673ab7">T₀=${res.T0.toFixed(0)} s</text>`;
      if (0.37 >= ymin && 0.37 <= ymax) refs += `<circle cx="${x.toFixed(1)}" cy="${Y(0.37).toFixed(1)}" r="4.5" fill="none" stroke="#673ab7" stroke-width="2"/>`;
    }
    // garis regresi (toggle)
    let regline = '';
    if (showReg && res.R2 != null) {
      const rx = [], ry = [];
      pts.forEach((p) => { rx.push(p.tcum); ry.push(Math.log(p.ratio)); });
      const reg = HL.slug.linreg(rx, ry);
      if (reg.slope != null) {
        const yA = Math.exp(reg.intercept), yB = Math.exp(reg.slope * tMax + reg.intercept);
        const ca = Math.min(ymax, Math.max(ymin, yA)), cb = Math.min(ymax, Math.max(ymin, yB));
        regline = `<line x1="${X(0).toFixed(1)}" y1="${Y(ca).toFixed(1)}" x2="${X(tMax).toFixed(1)}" y2="${Y(cb).toFixed(1)}" stroke="#2563b0" stroke-width="1.6" opacity="0.8"/>`;
      }
    }
    // marker data (tanpa garis penghubung) + tooltip native
    let marks = '';
    pts.forEach((p) => {
      const tip = `No ${p.no} · t=${p.tcum}s · MAT=${fmt(p.mat, 2)} m · h=${fmt(p.h, 3)} m · h/H₀=${fmt(p.ratio, 3)}`;
      marks += `<circle cx="${X(p.tcum).toFixed(1)}" cy="${Y(p.ratio).toFixed(1)}" r="3" fill="#1565c0"><title>${tip}</title></circle>`;
    });
    const svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">${grid}${axes}${refs}${regline}${marks}</svg>`;
    return { svg, dropped };
  }

  // ---------- Panel hasil ----------
  function analysisHTML(res) {
    const card = (label, val, sub) => `<div class="card" style="margin:0;padding:12px">
      <div class="small muted">${label}</div><div style="font-size:18px;font-weight:800;color:var(--navy)">${val}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div>`;
    return `<div class="tiles" style="grid-template-columns:1fr 1fr">
      ${card('H₀', fmt(res.H0, 2) + ' m')}
      ${card('H₃₇ (0,37·H₀)', fmt(res.H37, 3) + ' m')}
      ${card('Bacaan MAT saat H₃₇', fmt(res.matAtH37, 3) + ' m')}
      ${card('L / R', fmt(res.LR, 1), res.LR != null && res.LR < 8 ? '⚠ < 8' : 'valid')}
      ${card('T₀ (interpolasi)', res.T0 != null ? res.T0.toFixed(1) + ' s' : '—')}
      ${card('T₀ regresi (pembanding)', res.T0reg != null ? res.T0reg.toFixed(1) + ' s' : '—', res.R2 != null ? 'R² = ' + res.R2.toFixed(3) : '')}
      ${card('K', sci(res.K_cms) + ' cm/s')}
      ${card('K', sci(res.K_ms) + ' m/s', res.K_mday != null ? fmt(res.K_mday, 5) + ' m/hari' : '')}
    </div>`;
  }

  function qualityHTML(res) {
    const dot = (st) => st === 'block' ? '#d32f2f' : st === 'warn' ? '#e65100' : '#4caf50';
    const bg = (st) => st === 'block' ? '#fdeaea' : st === 'warn' ? '#fff5e9' : '#eef7ee';
    const rows = res.checks.map((c) => `<div class="kv" style="background:${bg(c.status)};border-radius:8px;padding:7px 10px;margin-bottom:5px">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot(c.status)};margin-right:7px"></span>${c.label}</span>
      <b class="small">${c.detail}</b></div>`).join('');
    return rows;
  }

  // ---------- Interpretasi (narasi) ----------
  function interpText(res) {
    if (res.K_cms == null) {
      const bl = res.blockers.length ? res.blockers.map((b) => '• ' + b).join('\n') : '• Lengkapi input untuk menghitung K.';
      return 'K belum bisa dihitung.\n\nHal yang perlu dibereskan:\n' + bl;
    }
    const cl = res.classification;
    let s = '';
    s += `Nilai konduktivitas hidrolik (K) hasil uji slug metode Hvorslev:\n`;
    s += `  K = ${sci(res.K_cms)} cm/detik = ${sci(res.K_ms)} m/detik = ${fmt(res.K_mday, 5)} m/hari.\n`;
    s += `Klasifikasi: ${cl.kelas} — material tipikal: ${cl.material}.\n\n`;
    s += `Parameter yang dipakai (agar bisa ditelusuri):\n`;
    s += `  L (screen terendam) = ${fmt(P(state.L), 2)} m, R (lubang bor) = ${fmt(P(state.R), 3)} cm, r (riser) = ${fmt(P(state.r), 3)} cm, T₀ = ${res.T0.toFixed(1)} s, L/R = ${fmt(res.LR, 1)}.\n\n`;
    s += `Kualitas data:\n`;
    s += `  R² regresi semi-log = ${res.R2 != null ? res.R2.toFixed(3) : '—'}; jumlah bacaan = ${res.rows.length}; uji ${res.T0 != null ? 'sudah' : 'belum'} melewati h/H₀ = 0,37.\n`;
    if (res.warnings.length) { s += `\nPeringatan:\n` + res.warnings.map((w) => '  • ' + w).join('\n') + '\n'; }
    s += `\nCatatan asumsi:\n`;
    s += `  • R diambil dari diameter dalam pipa bor (${state.pipe}); lubang bukaan sumur ≈ ID pipa bor.\n`;
    s += `  • Bacaan pertama diperlakukan sebagai t = 0 (tepat setelah slug).\n`;
    s += `  • Muka air statis dari input manual (${fmt(P(state.matStatic), 2)} m dari TOC).\n`;
    return s;
  }

  // ---------- Reaktif: hitung ulang & update bagian turunan ----------
  function recompute(root) {
    const res = HL.slug.analyze(buildInput());
    const staticV = P(state.matStatic);
    // update sel auto di tabel bacaan (tanpa menyentuh input)
    let acc = 0, firstMat = null;
    const trs = root.querySelectorAll('#slug-rows tr');
    state.readings.forEach((rd, i) => {
      const iv = i === 0 ? 0 : (P(rd.interval) || 0);
      const mat = P(rd.mat);
      if (mat != null) acc += iv;
      if (mat != null && firstMat == null) firstMat = mat;
      const tr = trs[i]; if (!tr) return;
      const cells = tr.querySelectorAll('td.calc');
      cells[0].textContent = mat != null ? acc : '—';
      const h = (mat != null && staticV != null) ? Math.abs(staticV - mat) : null;
      cells[1].textContent = h != null ? h.toFixed(3) : '—';
      cells[2].textContent = (h != null && res.H0) ? (h / res.H0).toFixed(3) : '—';
    });
    root.querySelector('#slug-analysis').innerHTML = analysisHTML(res);
    root.querySelector('#slug-quality').innerHTML = qualityHTML(res);
    const ch = chartSVG(res);
    root.querySelector('#slug-chart').innerHTML = ch.svg;
    root.querySelector('#slug-dropnote').textContent = ch.dropped ? `${ch.dropped} titik dengan h/H₀ ≤ 0 tidak tergambar (skala log).` : '';
    root.querySelector('#slug-interp').textContent = interpText(res);
    state._res = res;
  }

  function rowsHTML() {
    return state.readings.map((rd, i) => `
      <tr>
        <td class="seg-idx">${i + 1}</td>
        <td>${i === 0 ? '<span class="calc">0</span>' : `<input inputmode="decimal" data-ri="${i}" data-f="interval" value="${rd.interval}" placeholder="detik"/>`}</td>
        <td class="calc">—</td>
        <td><input inputmode="decimal" data-ri="${i}" data-f="mat" value="${rd.mat}" placeholder="m"/></td>
        <td class="calc">—</td>
        <td class="calc">—</td>
        <td><button class="rec-act rec-act--danger" data-delrow="${i}" style="padding:4px 8px">✕</button></td>
      </tr>`).join('');
  }

  function bindRows(root) {
    root.querySelectorAll('#slug-rows input').forEach((inp) => {
      inp.oninput = (e) => { const i = +e.target.dataset.ri, f = e.target.dataset.f; state.readings[i][f] = e.target.value; recompute(root); };
    });
    root.querySelectorAll('[data-delrow]').forEach((b) => {
      b.onclick = () => { state.readings.splice(+b.dataset.delrow, 1); if (!state.readings.length) state.readings.push({ interval: '', mat: '' }); renderTable(root); };
    });
  }
  function renderTable(root) {
    root.querySelector('#slug-rows').innerHTML = rowsHTML();
    bindRows(root); recompute(root);
  }

  function openPaste(root) {
    HL.modal.open(`
      <h3>Tempel dari Excel</h3>
      <div class="small muted" style="margin-bottom:8px">Tempel 2 kolom: <b>Interval [Tab] Bacaan MAT</b>, atau 1 kolom <b>Bacaan MAT</b> saja (interval otomatis). Koma/titik desimal keduanya diterima.</div>
      <textarea id="paste-area" rows="8" placeholder="0\t0,92\n60\t1,50\n..."></textarea>
      <div class="row" style="margin-top:10px"><button class="btn btn--ghost btn--sm" id="paste-cancel">Batal</button><button class="btn" id="paste-ok">Muat</button></div>`);
    document.getElementById('paste-cancel').onclick = () => HL.modal.close();
    document.getElementById('paste-ok').onclick = () => {
      const txt = document.getElementById('paste-area').value;
      const rows = [];
      txt.split(/\r?\n/).forEach((line) => {
        if (!line.trim()) return;
        const cells = line.split(/\t|;|\s{2,}/).map((c) => c.trim()).filter((c) => c !== '');
        if (!cells.length) return;
        // lewati baris header (tidak ada angka)
        if (cells.every((c) => P(c) == null)) return;
        if (cells.length >= 2) rows.push({ interval: cells[0], mat: cells[1] });
        else rows.push({ interval: '', mat: cells[0] });
      });
      if (rows.length) { if (rows[0]) rows[0].interval = '0'; state.readings = rows; }
      HL.modal.close(); renderTable(root);
    };
  }

  // ---------- Export ----------
  function exportCSV() {
    const res = state._res || HL.slug.analyze(buildInput());
    const L = [];
    L.push('HydroLogic - Slug Test (Hvorslev)');
    L.push(`Lokasi,${state.lokasi}`); L.push(`Hole ID,${state.holeId}`); L.push(`Tanggal,${state.date}`);
    L.push(`Jenis uji,${state.jenis}`); L.push(`Pencatat,${state.pencatat}`);
    L.push(`MAT statis (m),${state.matStatic}`); L.push(`L (m),${state.L}`); L.push(`Pipa bor,${state.pipe}`);
    L.push(`R (cm),${state.R}`); L.push(`r (cm),${state.r}`);
    L.push('');
    L.push(`H0 (m),${fmt(res.H0, 3)}`); L.push(`H37 (m),${fmt(res.H37, 4)}`); L.push(`MAT@H37 (m),${fmt(res.matAtH37, 4)}`);
    L.push(`T0 (s),${res.T0 != null ? res.T0.toFixed(1) : ''}`); L.push(`T0 regresi (s),${res.T0reg != null ? res.T0reg.toFixed(1) : ''}`); L.push(`R2,${res.R2 != null ? res.R2.toFixed(4) : ''}`);
    L.push(`K (cm/s),${res.K_cms != null ? res.K_cms.toExponential(3) : ''}`); L.push(`K (m/s),${res.K_ms != null ? res.K_ms.toExponential(3) : ''}`); L.push(`K (m/hari),${res.K_mday != null ? res.K_mday.toFixed(5) : ''}`);
    L.push(`L/R,${fmt(res.LR, 1)}`); L.push(`Klasifikasi,${res.classification.kelas} - ${res.classification.material}`);
    L.push('');
    L.push('No,Interval (s),Waktu kumulatif (s),Bacaan MAT (m),h (m),h/H0');
    res.rows.forEach((s) => L.push(`${s.no},${s.interval},${s.tcum},${fmt(s.mat, 2)},${fmt(s.h, 3)},${fmt(s.ratio, 4)}`));
    const blob = new Blob([L.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `SlugTest_${state.holeId || 'data'}_${state.date.replace(/-/g, '')}.csv`; a.click();
    HL.toast('CSV diunduh', 'ok');
  }

  function copySummary() {
    const res = state._res || HL.slug.analyze(buildInput());
    const head = `Slug Test (Hvorslev) — ${state.lokasi || '-'} / ${state.holeId || '-'} — ${state.date}\n\n`;
    navigator.clipboard.writeText(head + interpText(res)).then(() => HL.toast('Ringkasan disalin', 'ok'),
      () => HL.toast('Gagal menyalin', 'err'));
  }

  function chartPNG(root) {
    const svg = root.querySelector('#slug-chart svg');
    if (!svg) { HL.toast('Grafik belum ada', 'err'); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const sc = 2, vb = svg.viewBox.baseVal;
      const cv = document.createElement('canvas'); cv.width = vb.width * sc; cv.height = vb.height * sc;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `SlugTest_grafik_${state.holeId || ''}.png`; a.click(); HL.toast('Grafik PNG diunduh', 'ok'); });
    };
    img.onerror = () => HL.toast('Gagal ekspor grafik', 'err');
    img.src = src;
  }

  function exportPDF() {
    const res = state._res || HL.slug.analyze(buildInput());
    if (!window.jspdf) { HL.toast('PDF belum siap', 'err'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 51, 95);
    doc.text('Slug Test — Analisis Hvorslev', 14, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60);
    doc.text(`${state.lokasi || '-'}  •  Hole ID: ${state.holeId || '-'}  •  ${state.date}  •  ${state.jenis}`, 14, 23);
    const lines = interpText(res).split('\n');
    doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
    let y = 34; lines.forEach((ln) => { const w = doc.splitTextToSize(ln, 182); w.forEach((t) => { doc.text(t, 14, y); y += 5; }); });
    doc.save(`SlugTest_${state.holeId || 'data'}_${state.date.replace(/-/g, '')}.pdf`);
    HL.toast('PDF diunduh', 'ok');
  }

  function loadExample() {
    const mats = [0.92, 1.50, 2.30, 2.75, 3.23, 3.73, 4.35, 4.73, 5.22, 5.70, 6.09, 6.57, 6.83, 7.25, 7.60, 7.99, 8.27, 8.61, 8.86, 9.22, 9.50, 9.81, 10.00, 10.27, 10.52, 10.76, 11.00, 11.26, 11.53, 11.71, 12.72, 13.57, 14.50, 15.13, 15.78, 16.31];
    state = blankState();
    state.lokasi = 'WD Haraan'; state.holeId = 'DWHGT-06A'; state.jenis = 'Rising head'; state.matStatic = '18.3'; state.L = '8'; state.pipe = 'PQ'; state.R = HL.slug.PIPE_SIZES.PQ.R_cm; state.r = '2.54';
    state.readings = mats.map((m, i) => ({ interval: i === 0 ? '0' : (i <= 29 ? '60' : '120'), mat: String(m) }));
  }

  // ---------- Render ----------
  function render(root) {
    if (!state) state = blankState();
    const pipeOpts = Object.keys(HL.slug.PIPE_SIZES).map((k) => `<option value="${k}" ${k === state.pipe ? 'selected' : ''}>${k} (R=${HL.slug.PIPE_SIZES[k].R_cm} cm)</option>`).join('');

    root.innerHTML = `
    <div class="fade-in">
      <button class="back-link" data-route="home">← Beranda</button>
      <div class="section-title">Slug Test — Analisis Hvorslev</div>

      <!-- 1. INPUT: identitas -->
      <div class="card">
        <div class="section-title" style="margin-top:0">1 · Input Data</div>
        <div class="row">
          <div><label>Lokasi *</label><input id="s-lokasi" value="${state.lokasi}"/></div>
          <div><label>Hole ID *</label><input id="s-hole" value="${state.holeId}"/></div>
        </div>
        <div class="row">
          <div style="max-width:150px"><label>Tanggal *</label><input type="date" id="s-date" value="${state.date}"/></div>
          <div style="max-width:120px"><label>Jam mulai</label><input type="time" id="s-jam" value="${state.jamMulai}"/></div>
          <div><label>Pencatat</label><input id="s-pencatat" value="${state.pencatat}"/></div>
        </div>
        <label>Jenis uji *</label>
        <select id="s-jenis">
          <option ${state.jenis === 'Falling head' ? 'selected' : ''}>Falling head</option>
          <option ${state.jenis === 'Rising head' ? 'selected' : ''}>Rising head</option>
        </select>
      </div>

      <!-- parameter sumur -->
      <div class="card">
        <div class="section-title" style="margin-top:0">Parameter Sumur</div>
        <div class="row">
          <div><label>Muka air statis (m dari TOC) *</label><input inputmode="decimal" id="s-static" value="${state.matStatic}" placeholder="wajib manual"/></div>
          <div style="max-width:150px"><label>Panjang screen L (m)</label><input inputmode="decimal" id="s-L" value="${state.L}"/></div>
        </div>
        <div class="row">
          <div><label>Ukuran pipa bor</label><select id="s-pipe">${pipeOpts}</select></div>
          <div style="max-width:130px"><label>R lubang bor (cm)</label><input inputmode="decimal" id="s-R" value="${state.R}"/></div>
          <div style="max-width:130px"><label>r riser (cm)</label><input inputmode="decimal" id="s-r" value="${state.r}"/></div>
        </div>
        <div class="field-hint">R terisi otomatis dari pipa bor; boleh ditimpa manual (mis. ada filter pack).</div>
      </div>

      <!-- tabel bacaan -->
      <div class="card">
        <div class="section-title" style="margin-top:0">Tabel Bacaan</div>
        <div class="row" style="margin-bottom:8px">
          <button class="btn btn--ghost btn--sm" id="s-paste">📋 Tempel dari Excel</button>
          <button class="btn btn--ghost btn--sm" id="s-example">Muat contoh</button>
        </div>
        <div style="overflow-x:auto">
        <table class="segtable">
          <thead><tr><th>No</th><th>Interval<br/>detik</th><th>t kum.<br/>detik</th><th>Bacaan<br/>MAT (m)</th><th>h<br/>(m)</th><th>h/H₀</th><th></th></tr></thead>
          <tbody id="slug-rows">${rowsHTML()}</tbody>
        </table>
        </div>
        <button class="btn btn--ghost btn--sm" id="s-addrow" style="margin-top:8px">＋ Tambah baris</button>
      </div>

      <!-- 2. ANALISIS -->
      <div class="card">
        <div class="section-title" style="margin-top:0">2 · Analisis Hvorslev</div>
        <div class="field-hint" style="margin-bottom:8px">K = r²·ln(L/R) / (2·L·T₀). K notasi ilmiah 3 angka penting. Jangan baca K tanpa T₀ &amp; L/R di dekatnya.</div>
        <div id="slug-analysis"></div>
        <div class="section-title">Cek Mutu Data</div>
        <div id="slug-quality"></div>
      </div>

      <!-- 3. GRAFIK -->
      <div class="card">
        <div class="section-title" style="margin-top:0">3 · Grafik Semi-Log</div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="s-reg" style="width:auto" ${showReg ? 'checked' : ''}/> Tampilkan garis regresi</label>
        <div class="viz" id="slug-chart" style="margin-top:8px"></div>
        <div class="field-hint" id="slug-dropnote"></div>
        <button class="btn btn--ghost btn--sm" id="s-png" style="margin-top:8px">⬇ Export grafik PNG</button>
      </div>

      <!-- 4. INTERPRETASI -->
      <div class="card">
        <div class="section-title" style="margin-top:0">4 · Interpretasi</div>
        <pre id="slug-interp" style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.5;margin:0;color:var(--ink)"></pre>
        <div class="row" style="margin-top:12px">
          <button class="btn btn--ghost btn--sm" id="s-copy">Salin ringkasan</button>
          <button class="btn btn--ghost btn--sm" id="s-csv">Export CSV</button>
          <button class="btn btn--green btn--sm" id="s-pdf">Export PDF</button>
        </div>
      </div>
    </div>`;

    bind(root);
    recompute(root);
  }

  function bind(root) {
    const on = (id, ev, fn) => { const el = root.querySelector(id); if (el) el[ev] = fn; };
    // identitas (tidak memengaruhi hitungan -> cukup simpan state)
    on('#s-lokasi', 'oninput', (e) => state.lokasi = e.target.value);
    on('#s-hole', 'oninput', (e) => state.holeId = e.target.value);
    on('#s-date', 'onchange', (e) => state.date = e.target.value);
    on('#s-jam', 'onchange', (e) => state.jamMulai = e.target.value);
    on('#s-pencatat', 'oninput', (e) => state.pencatat = e.target.value);
    on('#s-jenis', 'onchange', (e) => state.jenis = e.target.value);
    // parameter -> recompute
    on('#s-static', 'oninput', (e) => { state.matStatic = e.target.value; recompute(root); });
    on('#s-L', 'oninput', (e) => { state.L = e.target.value; recompute(root); });
    on('#s-R', 'oninput', (e) => { state.R = e.target.value; recompute(root); });
    on('#s-r', 'oninput', (e) => { state.r = e.target.value; recompute(root); });
    on('#s-pipe', 'onchange', (e) => { state.pipe = e.target.value; state.R = HL.slug.PIPE_SIZES[e.target.value].R_cm; root.querySelector('#s-R').value = state.R; recompute(root); });
    // tabel
    on('#s-addrow', 'onclick', () => { state.readings.push({ interval: '', mat: '' }); renderTable(root); });
    on('#s-paste', 'onclick', () => openPaste(root));
    on('#s-example', 'onclick', () => { loadExample(); render(root); });
    on('#s-reg', 'onchange', (e) => { showReg = e.target.checked; recompute(root); });
    on('#s-png', 'onclick', () => chartPNG(root));
    on('#s-copy', 'onclick', () => copySummary());
    on('#s-csv', 'onclick', () => exportCSV());
    on('#s-pdf', 'onclick', () => exportPDF());
    bindRows(root);
  }

  return { render, reset() { /* pertahankan state antar-navigasi */ } };
})();
