/* HydroLogic — Slug Test (analisis Hvorslev): MODUL MURNI.
 * Tanpa dependensi UI/DOM — semua fungsi bisa diuji langsung (lihat js/slug.test.js).
 *
 * Rumus (semua panjang cm, waktu detik, hasil cm/detik):
 *   K = r² · ln(L / R) / (2 · L · T0)
 * Turunan: K[m/s] = K[cm/s]/100 ; K[m/hari] = K[m/s]·86400.
 */
window.HL = window.HL || {};

HL.slug = (function () {

  // Konstanta ukuran pipa bor. Sumber: dimensi nominal casing/rod bor standar
  // (wireline diamond drilling: AQ/BQ/NQ/HQ/PQ). R = ID/2 dalam cm = ID(mm)/20.
  // Asumsi: lubang bukaan sumur ≈ diameter dalam pipa bor.
  const PIPE_SIZES = {
    AQ: { od_mm: 44.7, id_mm: 37.3, R_cm: 1.865 },
    BQ: { od_mm: 55.7, id_mm: 46.1, R_cm: 2.305 },
    NQ: { od_mm: 70.0, id_mm: 60.2, R_cm: 3.010 },
    HQ: { od_mm: 89.0, id_mm: 78.0, R_cm: 3.900 },
    PQ: { od_mm: 114.5, id_mm: 101.5, R_cm: 5.075 }
  };

  // Parse angka locale-Indonesia: terima koma atau titik desimal, buang spasi/pemisah ribuan sederhana.
  // '' / null / non-numerik -> null.
  function parseNum(v) {
    if (v == null) return null;
    let s = String(v).trim();
    if (s === '') return null;
    s = s.replace(/\s+/g, '');
    // kalau ada koma dan titik, anggap titik = ribuan, koma = desimal (format Indonesia)
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // Regresi linier y = slope·x + intercept, dengan R².
  function linreg(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: null, intercept: null, r2: null, n };
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
    if (sxx === 0) return { slope: null, intercept: null, r2: null, n };
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    let ssres = 0;
    for (let i = 0; i < n; i++) { const e = ys[i] - (slope * xs[i] + intercept); ssres += e * e; }
    const r2 = syy === 0 ? null : 1 - ssres / syy;
    return { slope, intercept, r2, n };
  }

  // Klasifikasi material berdasarkan K [m/detik].
  function classify(K_ms) {
    if (K_ms == null || !Number.isFinite(K_ms)) return { kelas: '—', material: '—' };
    if (K_ms >= 1e-2) return { kelas: 'Sangat tinggi', material: 'Kerikil, pasir kasar' };
    if (K_ms >= 1e-4) return { kelas: 'Tinggi', material: 'Pasir bersih' };
    if (K_ms >= 1e-6) return { kelas: 'Sedang', material: 'Pasir halus, pasir lanauan' };
    if (K_ms >= 1e-8) return { kelas: 'Rendah', material: 'Lanau, lanau lempungan' };
    return { kelas: 'Sangat rendah', material: 'Lempung (praktis kedap)' };
  }

  /* analyze(input)
   * input = {
   *   matStatic : number|null   // muka air statis (m dari TOC), WAJIB dari user
   *   L_m       : number|null   // panjang screen terendam (m)
   *   R_cm      : number|null   // jari-jari lubang bor (cm)
   *   r_cm      : number|null   // jari-jari pipa/riser (cm)
   *   readings  : [{ interval:number|null, mat:number|null }]  // baris kosong (mat null) diabaikan
   * }
   * Mengembalikan objek hasil lengkap + blockers[] (merah) + warnings[] (kuning).
   */
  function analyze(input) {
    const out = {
      ok: false, blockers: [], warnings: [], checks: [],
      rows: [], H0: null, H37: null, matAtH37: null,
      T0: null, T0reg: null, R2: null,
      K_cms: null, K_ms: null, K_mday: null, LR: null,
      classification: { kelas: '—', material: '—' }
    };
    const matStatic = input.matStatic;
    const L_m = input.L_m, R_cm = input.R_cm, r_cm = input.r_cm;
    const L_cm = L_m != null ? L_m * 100 : null;

    // baris valid = punya bacaan MAT numerik (baris kosong di tengah diabaikan)
    const valid = (input.readings || []).filter((rd) => rd && rd.mat != null && Number.isFinite(rd.mat));

    // waktu kumulatif (baris pertama = 0)
    let acc = 0;
    const series = valid.map((rd, i) => {
      const iv = (i === 0) ? 0 : (Number.isFinite(rd.interval) ? rd.interval : 0);
      acc += iv;
      return { no: i + 1, interval: iv, tcum: acc, mat: rd.mat };
    });
    out.rows = series;

    // L/R (butuh L & R)
    if (L_cm != null && R_cm != null && R_cm > 0) out.LR = L_cm / R_cm;

    // ---- blockers dasar ----
    const hasStatic = matStatic != null && Number.isFinite(matStatic);
    if (!hasStatic) out.blockers.push('Muka air statis belum diisi — K tidak bisa dihitung.');
    if (out.LR != null && out.LR < 8) out.blockers.push('TIDAK VALID — L/R < 8, rumus Hvorslev bentuk ini tidak berlaku.');
    if (series.length < 8) out.warnings.push('Kurang — minimal 8 bacaan agar kurva terbaca (sekarang ' + series.length + ').');

    // Butuh minimal data + static untuk lanjut hitung rasio
    if (!hasStatic || series.length < 1) { out.checks = buildChecks(out, series, null); return out; }

    // H0 dari bacaan pertama (tcum = 0)
    const first = series[0];
    out.H0 = Math.abs(matStatic - first.mat);
    if (out.H0 === 0) { out.blockers.push('H₀ = 0 — bacaan pertama sama dengan muka air statis.'); out.checks = buildChecks(out, series, null); return out; }

    const sign = (matStatic - first.mat) > 0 ? 1 : -1; // arah simpangan bacaan pertama
    out.H37 = 0.37 * out.H0;
    out.matAtH37 = matStatic - sign * out.H37;

    // rasio per baris
    series.forEach((s) => { s.h = Math.abs(matStatic - s.mat); s.ratio = s.h / out.H0; });

    // cek rasio wajar & monotonisitas
    if (series.some((s) => s.ratio > 1 + 1e-6)) out.warnings.push('Ada rasio > 1 — muka air statis kemungkinan salah.');
    let naik = false;
    for (let i = 1; i < series.length; i++) { if (series[i].ratio > series[i - 1].ratio * 1.05) { naik = true; break; } }
    if (naik) out.warnings.push('Ada bacaan naik di tengah kurva — cek pencatatan atau pengaruh luar.');

    // ---- T0 dari interpolasi linier pada rasio = 0.37 ----
    let n = 0;
    for (const s of series) { if (s.ratio > 0.37) n++; else break; }
    if (n === 0) {
      out.blockers.push('Bacaan pertama sudah di bawah 0,37 — data tidak wajar.');
    } else if (n >= series.length) {
      out.blockers.push('Uji belum selesai — lanjutkan sampai h/H₀ < 0,37 (T₀ tidak terdefinisi).');
    } else {
      const i = n - 1;             // baris terakhir dengan rasio > 0.37
      const a = series[i], b = series[i + 1];
      out.T0 = a.tcum + (a.ratio - 0.37) / (a.ratio - b.ratio) * (b.tcum - a.tcum);
    }

    // ---- regresi ln(rasio) vs t (pembanding) pada bagian dengan rasio > 0 ----
    const rx = [], ry = [];
    series.forEach((s) => { if (s.ratio > 0) { rx.push(s.tcum); ry.push(Math.log(s.ratio)); } });
    const reg = linreg(rx, ry);
    out.R2 = reg.r2;
    if (reg.slope != null && reg.slope < 0) out.T0reg = -1 / reg.slope;

    // ---- K (butuh T0, L, R, r) ----
    if (out.T0 != null && out.T0 > 0 && L_cm != null && R_cm != null && R_cm > 0 && r_cm != null && L_cm > 0) {
      out.K_cms = (r_cm * r_cm) * Math.log(L_cm / R_cm) / (2 * L_cm * out.T0);
      out.K_ms = out.K_cms / 100;
      out.K_mday = out.K_ms * 86400;
      out.classification = classify(out.K_ms);
    }

    // ---- cek mutu tambahan (warning) ----
    if (out.R2 != null && out.R2 < 0.95) out.warnings.push('Kurva melengkung (R² regresi ' + out.R2.toFixed(3) + ' < 0,95) — kemungkinan skin/clogging atau MAT statis kurang tepat.');
    if (out.T0 != null && out.T0reg != null) {
      const diff = Math.abs(out.T0 - out.T0reg) / out.T0;
      if (diff > 0.20) out.warnings.push('Dua metode T₀ berbeda jauh (' + (diff * 100).toFixed(0) + '%) — periksa data.');
    }

    out.ok = out.blockers.length === 0 && out.K_cms != null;
    out.checks = buildChecks(out, series, reg);
    return out;
  }

  // Ringkasan cek mutu terstruktur untuk panel UI (status: ok|warn|block).
  function buildChecks(out, series, reg) {
    const c = [];
    c.push({ label: 'L / R ≥ 8', status: out.LR == null ? 'warn' : (out.LR < 8 ? 'block' : 'ok'),
      detail: out.LR == null ? 'L atau R belum lengkap' : ('L/R = ' + out.LR.toFixed(1)) });
    c.push({ label: 'Muka air statis terisi', status: (out.H0 != null || out.matAtH37 != null) ? 'ok' : (out.blockers.some(b => b.includes('statis')) ? 'block' : 'ok'),
      detail: out.blockers.some(b => b.includes('statis')) ? 'Belum diisi' : 'OK' });
    c.push({ label: 'Jumlah bacaan ≥ 8', status: series.length >= 8 ? 'ok' : 'warn', detail: series.length + ' bacaan' });
    c.push({ label: 'Uji selesai (ada rasio < 0,37)', status: out.T0 != null ? 'ok' : 'block',
      detail: out.T0 != null ? 'OK' : 'Belum melewati 0,37' });
    c.push({ label: 'Rasio wajar (≤ 1,0)', status: out.warnings.some(w => w.includes('rasio > 1')) ? 'warn' : 'ok',
      detail: out.warnings.some(w => w.includes('rasio > 1')) ? 'Ada rasio > 1' : 'OK' });
    c.push({ label: 'Monotonisitas (turun konsisten)', status: out.warnings.some(w => w.includes('naik di tengah')) ? 'warn' : 'ok',
      detail: out.warnings.some(w => w.includes('naik di tengah')) ? 'Ada bacaan naik' : 'OK' });
    c.push({ label: 'Kelurusan (R² ≥ 0,95)', status: out.R2 == null ? 'warn' : (out.R2 < 0.95 ? 'warn' : 'ok'),
      detail: out.R2 == null ? '—' : ('R² = ' + out.R2.toFixed(3)) });
    let tstat = 'ok', tdet = '—';
    if (out.T0 != null && out.T0reg != null) { const d = Math.abs(out.T0 - out.T0reg) / out.T0; tstat = d > 0.20 ? 'warn' : 'ok'; tdet = 'selisih ' + (d * 100).toFixed(0) + '%'; }
    else { tstat = 'warn'; tdet = 'T₀ pembanding belum ada'; }
    c.push({ label: 'Kesesuaian T₀ (≤ 20%)', status: tstat, detail: tdet });
    return c;
  }

  return { PIPE_SIZES, parseNum, linreg, classify, analyze };
})();
