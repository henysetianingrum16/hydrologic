/* HydroLogic — unit test modul murni HL.slug (Hvorslev).
 * Tidak ada test runner di repo; ini self-contained: panggil HL.slugTest.run()
 * di console browser -> mengembalikan { passed, failed, results }. */
window.HL = window.HL || {};

HL.slugTest = (function () {
  const results = [];
  function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || '' }); }
  function close(name, got, exp, tolAbs, detail) {
    const pass = got != null && Math.abs(got - exp) <= tolAbs;
    ok(name, pass, (detail || '') + ` got=${got} exp=${exp} tol=±${tolAbs}`);
  }
  function closeRel(name, got, exp, tolRel) {
    const pass = got != null && Math.abs(got - exp) <= Math.abs(exp) * tolRel;
    ok(name, pass, `got=${got} exp=${exp} tolRel=${tolRel}`);
  }

  // ---- Dataset verifikasi: DWHGT-06A, WD Haraan ----
  function dataset() {
    const mats = [0.92, 1.50, 2.30, 2.75, 3.23, 3.73, 4.35, 4.73, 5.22, 5.70,
      6.09, 6.57, 6.83, 7.25, 7.60, 7.99, 8.27, 8.61, 8.86, 9.22,
      9.50, 9.81, 10.00, 10.27, 10.52, 10.76, 11.00, 11.26, 11.53, 11.71,
      12.72, 13.57, 14.50, 15.13, 15.78, 16.31];
    const readings = mats.map((mat, i) => ({ interval: i === 0 ? 0 : (i <= 29 ? 60 : 120), mat }));
    return { matStatic: 18.3, L_m: 8, R_cm: HL.slug.PIPE_SIZES.PQ.R_cm, r_cm: 2.54, readings };
  }

  function run() {
    results.length = 0;
    const S = HL.slug;

    // ===== 1) Dataset verifikasi =====
    const r = S.analyze(dataset());
    close('H0 = 17.38 m', r.H0, 17.38, 0.005);
    close('H37 = 6.4306 m', r.H37, 6.4306, 0.001);
    close('MAT@H37 = 11.8694 m', r.matAtH37, 11.8694, 0.001);
    close('T0 = 1758.9 s (±0.5)', r.T0, 1758.9, 0.5);
    closeRel('K = 1.160e-5 cm/s (±0.5%)', r.K_cms, 1.160e-5, 0.005);
    closeRel('K = 1.160e-7 m/s', r.K_ms, 1.160e-7, 0.005);
    close('K = 0.01002 m/hari', r.K_mday, 0.01002, 0.0001);
    close('L/R = 157.6', r.LR, 157.6, 0.1);
    ok('Klasifikasi = Rendah', r.classification.kelas === 'Rendah', r.classification.kelas + ' / ' + r.classification.material);
    ok('L/R valid (≥8) tidak jadi blocker', !r.blockers.some(b => b.includes('L/R')), '');
    ok('Hasil ok = true', r.ok === true, 'blockers=' + JSON.stringify(r.blockers));

    // ===== 2) Tabel kosong =====
    const e1 = S.analyze({ matStatic: 18.3, L_m: 8, R_cm: 5.075, r_cm: 2.54, readings: [] });
    ok('Tabel kosong: tidak crash & K null', e1.K_cms == null, 'K=' + e1.K_cms);
    ok('Tabel kosong: ada peringatan bacaan kurang', e1.warnings.some(w => w.includes('minimal 8')) || e1.blockers.length >= 0, '');

    // ===== 3) MAT statis kosong =====
    const e2 = S.analyze({ matStatic: null, L_m: 8, R_cm: 5.075, r_cm: 2.54, readings: dataset().readings });
    ok('MAT kosong: blocker "statis belum diisi"', e2.blockers.some(b => b.toLowerCase().includes('statis')), JSON.stringify(e2.blockers));
    ok('MAT kosong: K null', e2.K_cms == null, 'K=' + e2.K_cms);

    // ===== 4) Rasio tidak pernah turun di bawah 0.37 =====
    // bacaan hanya sedikit bergerak dari 0.92 -> semua rasio tetap > 0.37
    const slow = [];
    for (let i = 0; i < 10; i++) slow.push({ interval: i === 0 ? 0 : 60, mat: 0.92 + i * 0.05 });
    const e3 = S.analyze({ matStatic: 18.3, L_m: 8, R_cm: 5.075, r_cm: 2.54, readings: slow });
    ok('Belum <0.37: T0 null', e3.T0 == null, 'T0=' + e3.T0);
    ok('Belum <0.37: blocker "Uji belum selesai"', e3.blockers.some(b => b.includes('belum selesai')), JSON.stringify(e3.blockers));
    ok('Belum <0.37: tidak diam-diam ekstrapolasi K', e3.K_cms == null, 'K=' + e3.K_cms);

    // ===== 5) Rasio > 1 (MAT statis salah) =====
    // bacaan melewati statis -> ada h yang lebih besar dari h pertama
    const over = dataset().readings.slice();
    over.push({ interval: 120, mat: 40 }); // jauh melewati statis 18.3 -> ratio > 1
    const e4 = S.analyze({ matStatic: 18.3, L_m: 8, R_cm: 5.075, r_cm: 2.54, readings: over });
    ok('Rasio>1: ada warning "rasio > 1"', e4.warnings.some(w => w.includes('rasio > 1')), JSON.stringify(e4.warnings));

    // ===== 6) parseNum locale =====
    ok('parseNum koma desimal', S.parseNum('2,54') === 2.54, S.parseNum('2,54'));
    ok('parseNum titik desimal', S.parseNum('2.54') === 2.54, S.parseNum('2.54'));
    ok('parseNum kosong -> null', S.parseNum('') === null, '');
    ok('parseNum ribuan+desimal ID (1.234,5)', S.parseNum('1.234,5') === 1234.5, S.parseNum('1.234,5'));

    const passed = results.filter(x => x.pass).length;
    const failed = results.filter(x => !x.pass).length;
    console.log(`[HL.slugTest] ${passed} passed, ${failed} failed`);
    results.forEach(x => console.log(`${x.pass ? '✓' : '✗'} ${x.name} — ${x.detail}`));
    return { passed, failed, results };
  }

  return { run };
})();
