/* HydroLogic — export ke Excel (.xlsx) memakai SheetJS.
 * Kolom dibuat mirip file Excel asli: Rekap Debit + Rekap MAT + Detail per segmen. */
window.HL = window.HL || {};

HL.exportExcel = (function () {

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

  // Normalisasi baris cloud (snake_case) & lokal (camelCase) ke satu bentuk.
  function normD(r) {
    return {
      date: r.date, lokasi: r.lokasi, stationId: r.station_id ?? r.stationId, titik: r.titik,
      qLs: num(r.q_ls ?? r.qLs), rainfall: r.rainfall ?? null, widthCm: num(r.width_cm ?? r.widthCm),
      totalArea: num(r.total_area ?? r.totalArea), vMean: num(r.v_mean ?? r.vMean),
      weather: r.weather, crew: r.crew, time: r.time, segments: r.segments || []
    };
  }
  function normG(r) {
    return {
      date: r.date, wellId: r.well_id ?? r.wellId, area: r.area, z: num(r.z),
      stickUp: num(r.stick_up ?? r.stickUp), depth: num(r.depth), elevation: num(r.elevation),
      crew: r.crew, time: r.time
    };
  }

  async function fetchAll() {
    const sb = HL.sb();
    if (sb && navigator.onLine && HL.auth.isAuthed()) {
      try {
        const [{ data: d }, { data: g }] = await Promise.all([
          sb.from('discharge_records').select('*').order('date'),
          sb.from('gwl_records').select('*').order('date')
        ]);
        return { source: 'cloud', discharge: (d || []).map(normD), gwl: (g || []).map(normG) };
      } catch (e) { console.warn('export fetch failed', e); }
    }
    const all = await HL.db.all();
    return {
      source: 'local',
      discharge: all.filter((r) => r.type === 'discharge').map(normD),
      gwl: all.filter((r) => r.type === 'gwl').map(normG)
    };
  }

  function sortByDate(a, b) { return (a.date || '').localeCompare(b.date || ''); }

  return async function exportExcel() {
    if (!window.XLSX) { HL.toast('Library Excel belum termuat', 'err'); return; }
    HL.toast('Menyiapkan Excel…');
    const { discharge, gwl } = await fetchAll();
    if (!discharge.length && !gwl.length) { HL.toast('Belum ada data untuk diekspor', 'err'); return; }

    const wb = XLSX.utils.book_new();

    // ---- Sheet 1: Rekap Debit ----
    const rd = discharge.slice().sort(sortByDate).map((r) => ({
      'Tanggal': r.date, 'Lokasi': r.lokasi, 'ID Titik': r.stationId,
      'Debit (l/s)': r.qLs, 'Curah Hujan (mm)': r.rainfall,
      'Lebar (cm)': r.widthCm, 'Luas (m2)': r.totalArea, 'V rata2 (m/s)': r.vMean,
      'Cuaca': r.weather, 'Pengukur': r.crew, 'Waktu': r.time
    }));
    const ws1 = XLSX.utils.json_to_sheet(rd.length ? rd : [{ 'Tanggal': '', 'Lokasi': '' }]);
    ws1['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Debit');

    // ---- Sheet 2: Rekap MAT ----
    const rg = gwl.slice().sort(sortByDate).map((r) => {
      const w = HL.getWell ? HL.getWell(r.wellId) : null;
      return {
        'Tanggal': r.date, 'Hole Id': r.wellId, 'Area': r.area,
        'Z (mdpl)': r.z, 'Stick Up (m)': r.stickUp, 'Depth GWL (m)': r.depth,
        'GWL Elevation (mdpl)': r.elevation, 'X': w ? w.x : null, 'Y': w ? w.y : null,
        'Pengukur': r.crew, 'Waktu': r.time
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(rg.length ? rg : [{ 'Tanggal': '', 'Hole Id': '' }]);
    ws2['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 12 }, { wch: 18 }, { wch: 11 }, { wch: 12 }, { wch: 16 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap MAT');

    // ---- Sheet 3: Detail Debit per Segmen ----
    const det = [];
    discharge.slice().sort(sortByDate).forEach((r) => {
      (r.segments || []).forEach((s, i) => det.push({
        'Tanggal': r.date, 'Lokasi': r.lokasi, 'ID Titik': r.stationId, 'Segmen': i + 1,
        'Jarak (cm)': num(s.dist), 'Kedalaman (cm)': num(s.depth), 'Kecepatan (m/s)': num(s.vel),
        'Luas (m2)': num(s.area), 'Debit (l/s)': s.q != null ? num(s.q) * 1000 : null
      }));
    });
    if (det.length) {
      const ws3 = XLSX.utils.json_to_sheet(det);
      ws3['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 11 }, { wch: 13 }, { wch: 14 }, { wch: 10 }, { wch: 11 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Detail Debit per Segmen');
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(wb, `Rekap_HydroLogic_${stamp}.xlsx`);
    HL.toast('Excel terunduh', 'ok');
  };
})();
