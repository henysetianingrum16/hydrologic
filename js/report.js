/* HydroLogic — PDF report generator (jsPDF, offline) + WhatsApp share.
   1 page for Debit, 1 page for GWL; bundled into one PDF when both exist. */
window.HL = window.HL || {};

HL.report = (function () {
  const A4 = { w: 210, h: 297 };
  const M = 14; // margin mm
  let _logo = null;

  const C = {
    navy: [22, 51, 95], blue: [37, 99, 176], teal: [42, 169, 184],
    green: [46, 125, 50], green2: [76, 175, 80], orange: [230, 81, 0],
    ink: [26, 31, 41], muted: [107, 114, 128], line: [223, 227, 234],
    soft: [245, 247, 249], white: [255, 255, 255], red: [211, 47, 47]
  };

  function loadLogo() {
    if (_logo) return Promise.resolve(_logo);
    // Small droplet icon (96px) keeps the embedded image tiny; embedded once via alias.
    return fetch('assets/icons/icon-96.png')
      .then((r) => r.blob())
      .then((b) => new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => { _logo = fr.result; res(_logo); };
        fr.readAsDataURL(b);
      }))
      .catch(() => null);
  }

  function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function dateLong(s) {
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const [y, m, d] = s.split('-');
    return `${+d} ${months[+m - 1]} ${y}`;
  }

  function header(doc, color, title, subtitle, page, total, crew, date) {
    doc.setFillColor(...color);
    doc.rect(0, 0, A4.w, 26, 'F');
    if (_logo) { try { doc.addImage(_logo, 'PNG', M, 5, 16, 16, 'hl-logo', 'FAST'); } catch (e) {} }
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(title, M + 20, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(subtitle, M + 20, 18.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(dateLong(date || ''), A4.w - M, 10, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Hal. ${page} / ${total}`, A4.w - M, 16, { align: 'right' });
    doc.text(`Crew: ${crew}`, A4.w - M, 21, { align: 'right' });
  }

  function footer(doc, idText) {
    doc.setDrawColor(...C.line); doc.line(M, A4.h - 18, A4.w - M, A4.h - 18);
    doc.setTextColor(...C.muted); doc.setFontSize(7.5);
    doc.text('Diukur: ____________   Diverifikasi: ____________', M, A4.h - 12);
    doc.setTextColor(160, 168, 178); doc.setFontSize(7);
    doc.text(`Dibuat otomatis oleh HydroLogic · ${idText} · GPS terverifikasi`, M, A4.h - 7);
  }

  function metaStrip(doc, y, pairs) {
    doc.setFillColor(...C.soft); doc.rect(M, y, A4.w - 2 * M, 12, 'F');
    let x = M + 4;
    pairs.forEach((p) => {
      doc.setTextColor(...C.muted); doc.setFontSize(7);
      doc.text(p[0].toUpperCase(), x, y + 4.5);
      doc.setTextColor(...C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(String(p[1]), x, y + 9.5);
      doc.setFont('helvetica', 'normal');
      x += p[2] || 42;
    });
  }

  // ---------- DEBIT PAGE ----------
  function dischargePage(doc, rec, page, total) {
    header(doc, C.navy, 'LAPORAN MONITORING DEBIT HARIAN', 'Debit Permukaan Sesaat — Metode Mid-Section', page, total, rec.crew, rec.date);
    metaStrip(doc, 28, [
      ['Lokasi', rec.lokasi, 38], ['Titik', rec.titik, 60],
      ['Cuaca', rec.weather, 30], ['Curah Hujan', (rec.rainfall ?? '—') + ' mm', 40]
    ]);

    // Hero
    let y = 46;
    doc.setFillColor(235, 242, 251); doc.roundedRect(M, y, 86, 28, 2, 2, 'F');
    doc.setTextColor(...C.muted); doc.setFontSize(8); doc.text('TOTAL DEBIT', M + 5, y + 6);
    doc.setTextColor(...C.blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
    doc.text(fmt(rec.qLs, 1), M + 5, y + 19);
    doc.setFontSize(11); doc.text('l/s', M + 42, y + 19);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); doc.setFontSize(8);
    doc.text(`= ${fmt(rec.totalQ, 4)} m³/s`, M + 5, y + 25);

    // secondary metric boxes
    const boxes = [
      ['Lebar Sungai', rec.widthCm + ' cm'], ['Jumlah Segmen', rec.segments.length + ' seg'],
      ['Luas Penampang', fmt(rec.totalArea, 4) + ' m²'], ['V rata-rata', fmt(rec.vMean, 3) + ' m/s']
    ];
    let bx = M + 92;
    boxes.forEach((b, i) => {
      const col = i % 2, rw = Math.floor(i / 2);
      const x = bx + col * 49, by = y + rw * 14;
      doc.setFillColor(...C.soft); doc.roundedRect(x, by, 46, 12, 1.5, 1.5, 'F');
      doc.setTextColor(...C.muted); doc.setFontSize(7); doc.text(b[0], x + 3, by + 4.5);
      doc.setTextColor(...C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(b[1], x + 3, by + 9.5); doc.setFont('helvetica', 'normal');
    });

    // Cross-section sketch
    y = 80;
    doc.setTextColor(...C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Sketsa Penampang Melintang', M, y);
    doc.setFont('helvetica', 'normal');
    const cs = { x: M, y: y + 3, w: 86, h: 44 };
    doc.setDrawColor(...C.line); doc.setFillColor(250, 251, 253);
    doc.roundedRect(cs.x, cs.y, cs.w, cs.h, 2, 2, 'FD');
    drawCrossSection(doc, rec, cs);

    // 7-day note / trend box (placeholder bars from stored or single point)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
    doc.text('Catatan Lapangan', M + 92, y);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(...C.line); doc.setFillColor(250, 251, 253);
    doc.roundedRect(M + 92, y + 3, 90, 44, 2, 2, 'FD');
    doc.setTextColor(...C.muted); doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(rec.note || 'Tidak ada catatan.', 84);
    doc.text(noteLines.slice(0, 5), M + 96, y + 10);
    doc.setFontSize(7.5);
    doc.text(`Waktu ukur: ${rec.time} · GPS ${fmt(rec.gps.lat,4)}, ${fmt(rec.gps.lng,4)}`, M + 96, y + 42);

    // Detail table
    y = 134;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
    doc.text('Detail Pengukuran per Segmen', M, y);
    doc.setFont('helvetica', 'normal');
    const cols = [['Seg', 16], ['Jarak (cm)', 30], ['Dalam (cm)', 30], ['Kecepatan (m/s)', 38], ['Luas (m²)', 34], ['Debit (l/s)', 34]];
    let ty = y + 4, tx = M;
    doc.setFillColor(...C.navy); doc.rect(M, ty, A4.w - 2 * M, 7, 'F');
    doc.setTextColor(...C.white); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    cols.forEach((c) => { doc.text(c[0], tx + 2, ty + 4.8); tx += c[1]; });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.ink);
    ty += 7;
    rec.segments.forEach((s, i) => {
      if (i % 2) { doc.setFillColor(...C.soft); doc.rect(M, ty, A4.w - 2 * M, 6, 'F'); }
      tx = M;
      const vals = [i + 1, fmt(s.dist, 1), fmt(s.depth, 1), fmt(s.vel, 2), fmt(s.area, 4), fmt(s.q * 1000, 2)];
      doc.setFontSize(8.5);
      vals.forEach((v, j) => { doc.text(String(v), tx + 2, ty + 4.2); tx += cols[j][1]; });
      ty += 6;
    });
    doc.setFillColor(228, 245, 230); doc.rect(M, ty, A4.w - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
    doc.text('TOTAL', M + 2, ty + 4.8);
    doc.text(fmt(rec.totalArea, 4), M + 16 + 30 + 30 + 38 + 2, ty + 4.8);
    doc.text(fmt(rec.qLs, 2), M + 16 + 30 + 30 + 38 + 34 + 2, ty + 4.8);
    doc.setFont('helvetica', 'normal');

    footer(doc, `ID: ${rec.id}`);
  }

  function drawCrossSection(doc, rec, box) {
    const W = rec.widthCm || 1;
    const pts = [{ dist: 0, depth: 0 }].concat(rec.segments.map((s) => ({ dist: s.dist, depth: s.depth })));
    const maxDepth = Math.max(5, ...pts.map((p) => p.depth));
    const padX = 8, padTop = 6, padBot = 8;
    const X = (d) => box.x + padX + (d / W) * (box.w - 2 * padX);
    const Y = (dep) => box.y + padTop + (dep / maxDepth) * (box.h - padTop - padBot);
    const vmax = Math.max(0.01, ...rec.segments.map((s) => s.vel));
    // water polygon
    doc.setFillColor(37, 99, 176); doc.setDrawColor(37, 99, 176);
    const poly = [[X(0), Y(0)]].concat(pts.map((p) => [X(p.dist), Y(p.depth)])).concat([[X(W), Y(0)]]);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.16 }));
    polygon(doc, poly, 'F');
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
    // bed line
    doc.setDrawColor(109, 76, 65); doc.setLineWidth(0.5);
    for (let i = 1; i < pts.length; i++) doc.line(X(pts[i - 1].dist), Y(pts[i - 1].depth), X(pts[i].dist), Y(pts[i].depth));
    // water surface
    doc.setDrawColor(21, 101, 192); doc.setLineWidth(0.5); doc.line(X(0), Y(0), X(W), Y(0));
    // velocity dots
    doc.setFillColor(230, 74, 25);
    rec.segments.forEach((s) => {
      if (s.vel > 0) { const r = 0.7 + (s.vel / vmax) * 1.6; doc.circle(X(s.dist), Y(s.depth * 0.55), r, 'F'); }
    });
    doc.setLineWidth(0.2);
    doc.setTextColor(...C.muted); doc.setFontSize(6);
    doc.text('0', box.x + 2, box.y + box.h - 2);
    doc.text(W + ' cm', box.x + box.w - 10, box.y + box.h - 2);
    doc.text('● titik = kecepatan', box.x + 3, box.y + 4);
  }

  function polygon(doc, pts, style) {
    const lines = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.lines(lines, pts[0][0], pts[0][1], [1, 1], style, true);
  }

  // ---------- GWL PAGE ----------
  function gwlPage(doc, recs, page, total) {
    const crew = recs[0].crew, date = recs[0].date, area = recs[0].area;
    header(doc, C.navy, 'LAPORAN MONITORING MUKA AIR TANAH', 'Groundwater Level — Sumur Pantau Harian', page, total, crew, date);
    const totalWells = HL.wellsByArea(area).length;
    metaStrip(doc, 28, [
      ['Area', area, 40], ['Sumur Diukur', `${recs.length} dari ${totalWells}`, 45],
      ['Tanggal', dateLong(date), 70]
    ]);

    // summary cards
    let y = 46;
    doc.setFillColor(235, 242, 251); doc.roundedRect(M, y, 55, 24, 2, 2, 'F');
    doc.setTextColor(...C.muted); doc.setFontSize(7.5); doc.text('SUMUR TERUKUR', M + 4, y + 6);
    doc.setTextColor(...C.blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text(String(recs.length), M + 4, y + 18);
    doc.setFontSize(10); doc.text('/ ' + totalWells, M + 20, y + 18);
    doc.setFont('helvetica', 'normal');

    const elevs = recs.map((r) => r.elevation);
    doc.setFillColor(...C.soft); doc.roundedRect(M + 60, y, 55, 24, 2, 2, 'F');
    doc.setTextColor(...C.muted); doc.setFontSize(7.5); doc.text('GWL TERTINGGI', M + 64, y + 6);
    doc.setTextColor(...C.blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(fmt(Math.max(...elevs), 2), M + 64, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text('mdpl', M + 64, y + 22);

    doc.setFillColor(...C.soft); doc.roundedRect(M + 120, y, 56, 24, 2, 2, 'F');
    doc.setTextColor(...C.muted); doc.setFontSize(7.5); doc.text('GWL TERENDAH', M + 124, y + 6);
    doc.setTextColor(...C.orange); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(fmt(Math.min(...elevs), 2), M + 124, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text('mdpl', M + 124, y + 22);

    // table
    y = 80;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.ink);
    doc.text('Hasil Pengukuran', M, y); doc.setFont('helvetica', 'normal');
    const cols = [['Hole ID', 32], ['Z (mdpl)', 32], ['Stick Up (m)', 32], ['Depth GWL (m)', 38], ['GWL (mdpl)', 38]];
    let ty = y + 4, tx = M;
    doc.setFillColor(...C.navy); doc.rect(M, ty, A4.w - 2 * M, 7, 'F');
    doc.setTextColor(...C.white); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    cols.forEach((c) => { doc.text(c[0], tx + 2, ty + 4.8); tx += c[1]; });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.ink); ty += 7;
    recs.forEach((r, i) => {
      if (i % 2) { doc.setFillColor(...C.soft); doc.rect(M, ty, A4.w - 2 * M, 6, 'F'); }
      tx = M;
      const vals = [r.wellId, fmt(r.z, 2), fmt(r.stickUp, 2), fmt(r.depth, 2), fmt(r.elevation, 2)];
      doc.setFontSize(8.5);
      vals.forEach((v, j) => { doc.text(String(v), tx + 2, ty + 4.2); tx += cols[j][1]; });
      ty += 6;
    });

    // notes
    ty += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Catatan Lapangan', M, ty);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(...C.line); doc.setFillColor(250, 251, 253);
    doc.roundedRect(M, ty + 3, A4.w - 2 * M, 26, 2, 2, 'FD');
    doc.setTextColor(...C.muted); doc.setFontSize(8.5);
    const notes = recs.filter((r) => r.note).map((r) => `${r.wellId}: ${r.note}`).join('  •  ') || 'Tidak ada catatan.';
    doc.text(doc.splitTextToSize(notes, A4.w - 2 * M - 8), M + 4, ty + 10);

    footer(doc, `ID: MAT-${area.toUpperCase()}-${date.replace(/-/g, '')} · ${recs.length} sumur`);
  }

  // ---------- ENTRY POINTS ----------
  async function build(opts) {
    await loadLogo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pages = opts.pages; // [{type:'discharge', rec} | {type:'gwl', recs}]
    pages.forEach((p, i) => {
      if (i > 0) doc.addPage();
      if (p.type === 'discharge') dischargePage(doc, p.rec, i + 1, pages.length);
      else gwlPage(doc, p.recs, i + 1, pages.length);
    });
    return doc;
  }

  async function share(doc, filename) {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename, text: 'Laporan monitoring HydroLogic' });
        return 'shared';
      } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    doc.save(filename);
    return 'downloaded';
  }

  // Daily report: bundle today's discharge records + today's gwl records.
  async function generateDaily(date) {
    const all = await HL.db.all();
    const dQ = all.filter((r) => r.type === 'discharge' && r.date === date);
    const dG = all.filter((r) => r.type === 'gwl' && r.date === date);
    if (!dQ.length && !dG.length) { HL.toast('Belum ada data untuk tanggal ini', 'err'); return null; }
    const pages = [];
    dQ.forEach((rec) => pages.push({ type: 'discharge', rec }));
    if (dG.length) {
      // group gwl by area → one page per area
      const byArea = {};
      dG.forEach((r) => { (byArea[r.area] = byArea[r.area] || []).push(r); });
      Object.values(byArea).forEach((recs) => pages.push({ type: 'gwl', recs }));
    }
    const doc = await build({ pages });
    const fname = `Laporan_HydroLogic_${date.replace(/-/g, '')}.pdf`;
    const result = await share(doc, fname);
    HL.toast(result === 'shared' ? 'Laporan dibagikan' : result === 'downloaded' ? 'PDF diunduh' : 'Dibatalkan',
      result === 'cancelled' ? 'err' : 'ok');
    return result;
  }

  async function generateSingle(rec) {
    const pages = rec.type === 'discharge' ? [{ type: 'discharge', rec }] : [{ type: 'gwl', recs: [rec] }];
    const doc = await build({ pages });
    const fname = `${rec.type === 'discharge' ? 'Debit' : 'MAT'}_${(rec.stationId || rec.wellId)}_${rec.date.replace(/-/g, '')}.pdf`;
    const result = await share(doc, fname);
    HL.toast(result === 'shared' ? 'Laporan dibagikan' : result === 'downloaded' ? 'PDF diunduh' : 'Dibatalkan',
      result === 'cancelled' ? 'err' : 'ok');
    return result;
  }

  return { generateDaily, generateSingle, build };
})();
