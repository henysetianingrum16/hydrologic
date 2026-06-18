/* HydroLogic — master data (seeded locally so app works fully offline).
   In production this would sync from the cloud database occasionally. */
window.HL = window.HL || {};

// Discharge monitoring points — only the 3 currently-active points.
HL.stations = [
  { id: 'WDKK',   lokasi: 'WDKK',   titik: 'Hilir Underdrain',   lat: -1.2340, lng: 116.7890 },
  { id: 'DSTF',   lokasi: 'DSTF',   titik: 'Hilir DSTF-Landi',   lat: -1.2455, lng: 116.7712 },
  { id: 'PABRIK', lokasi: 'Pabrik', titik: 'Box Culvert Pabrik',  lat: -1.2298, lng: 116.8015 }
];

// Groundwater monitoring wells (sumur pantau) — full register from Dashboard_MAT.
// Z = ground elevation (mdpl), stickUp in m, x/y = UTM coords, active = status.
HL.wells = [
  { id: 'DH04A', area: 'Badak', z: 220.07, stickUp: 0.50, x: 379414.6, y: 9720816.4, tahun: 2025, active: true },
  { id: 'DH05A', area: 'Badak', z: 224.95, stickUp: 0.44, x: 379431.6, y: 9720974.8, tahun: 2025, active: true },
  { id: 'DH01', area: 'Badak', z: 222.70, stickUp: 0.50, x: 378866.3, y: 9720575.3, tahun: 2025, active: true },
  { id: 'DH01_inactive', area: 'Badak', z: 221.74, stickUp: 0.59, x: 378846.6, y: 9720572.3, tahun: 2022, active: false },
  { id: 'DH01A', area: 'Badak', z: 251.33, stickUp: 0.55, x: 379095.0, y: 9721780.0, tahun: 2022, active: true },
  { id: 'DH02', area: 'Badak', z: 218.69, stickUp: 0.44, x: 379316.7, y: 9720417.5, tahun: 2025, active: true },
  { id: 'DH02_inactive', area: 'Badak', z: 243.75, stickUp: 0.65, x: 379182.4, y: 9720465.8, tahun: 2022, active: false },
  { id: 'DH02A', area: 'Badak', z: 212.41, stickUp: 0.55, x: 379293.0, y: 9721810.0, tahun: 2022, active: true },
  { id: 'DH03', area: 'Badak', z: 256.07, stickUp: 0.50, x: 378915.0, y: 9719790.0, tahun: 2022, active: true },
  { id: 'DH03A', area: 'Badak', z: 226.89, stickUp: 0.30, x: 379685.0, y: 9720920.0, tahun: 2022, active: true },
  { id: 'DH04', area: 'Badak', z: 227.09, stickUp: 0.61, x: 379079.6, y: 9719298.7, tahun: 2022, active: true },
  { id: 'DH05', area: 'Badak', z: 230.24, stickUp: 0.50, x: 378715.4, y: 9720273.8, tahun: 2025, active: true },
  { id: 'DH06', area: 'Badak', z: 208.98, stickUp: 0.45, x: 379302.7, y: 9720216.1, tahun: 2025, active: true },
  { id: 'DH07', area: 'Badak', z: 281.16, stickUp: 0.30, x: 378163.8, y: 9720275.2, tahun: 2022, active: true },
  { id: 'DH09', area: 'Badak', z: 229.91, stickUp: 0.56, x: 378600.2, y: 9720554.7, tahun: 2022, active: true },
  { id: 'DH10_inactive', area: 'Badak', z: 230.24, stickUp: 0.22, x: 378715.4, y: 9720273.8, tahun: 2022, active: false },
  { id: 'DH11', area: 'Badak', z: 276.00, stickUp: 0.61, x: 378089.0, y: 9720813.0, tahun: 2022, active: true },
  { id: 'DH12', area: 'Badak', z: 245.67, stickUp: 0.53, x: 378567.9, y: 9720077.2, tahun: 2022, active: true },
  { id: 'DH13', area: 'Badak', z: 246.06, stickUp: 0.34, x: 378323.3, y: 9720591.1, tahun: 2025, active: true },
  { id: 'DH14', area: 'Badak', z: 245.79, stickUp: 0.87, x: 378639.1, y: 9720825.9, tahun: 2025, active: true },
  { id: 'DH15', area: 'Badak', z: 203.76, stickUp: 0.50, x: 379834.1, y: 9720574.1, tahun: 2025, active: true },
  { id: 'DH16', area: 'Badak', z: 202.58, stickUp: 0.50, x: 379705.6, y: 9720333.7, tahun: 2025, active: true },
  { id: 'DH17', area: 'Badak', z: 203.30, stickUp: 0.50, x: 379317.0, y: 9720579.2, tahun: 2025, active: true },
  { id: 'DH18', area: 'Badak', z: 308.58, stickUp: 0.50, x: 378128.9, y: 9720508.9, tahun: 2025, active: true },
  { id: 'DHRPZ 01', area: 'Haraan', z: 585.71, stickUp: 0.68, x: 376233.6, y: 9721803.1, tahun: null, active: true },
  { id: 'DPTHR04', area: 'Haraan', z: 459.91, stickUp: 0.50, x: 376553.9, y: 9721857.3, tahun: null, active: true },
  { id: 'DPTHR04A', area: 'Haraan', z: 459.79, stickUp: 0.50, x: 376553.1, y: 9721854.2, tahun: null, active: true },
  { id: 'DPTHR05', area: 'Haraan', z: 551.42, stickUp: 0.38, x: 376531.1, y: 9722221.5, tahun: null, active: true },
  { id: 'DKKPZ01', area: 'Kembatang', z: 502.70, stickUp: 0.57, x: 377149.4, y: 9723126.4, tahun: null, active: false },
  { id: 'DKKPZ02', area: 'Kembatang', z: 373.49, stickUp: 0.33, x: 377278.9, y: 9723629.4, tahun: null, active: true },
  { id: 'PTKK01', area: 'Kembatang', z: 396.38, stickUp: 0.66, x: 377430.1, y: 9723439.0, tahun: 2025, active: true },
  { id: 'PTKK02', area: 'Kembatang', z: 484.21, stickUp: 0.43, x: 377244.7, y: 9722911.5, tahun: 2025, active: true },
  { id: 'PTKK03', area: 'Kembatang', z: 409.39, stickUp: 0.50, x: 377113.5, y: 9723414.9, tahun: 2025, active: true },
  { id: 'PTKK04', area: 'Kembatang', z: 608.37, stickUp: 0.50, x: 376877.0, y: 9722990.4, tahun: 2026, active: true },
  { id: 'DMTPZ 01', area: 'Menteu', z: 636.98, stickUp: 0.38, x: 375628.8, y: 9719472.8, tahun: null, active: true }
];

HL.getStation = (id) => HL.stations.find((s) => s.id === id);
HL.getWell = (id) => HL.wells.find((w) => w.id === id);
// Areas ordered by well count (Badak first). Wells: active first, then by id.
// Areas derived dynamically from wells (known ones first, then any new area).
HL.areas = () => {
  const order = ['Badak', 'Kembatang', 'Haraan', 'Menteu'];
  const present = [...new Set(HL.wells.map((w) => w.area).filter(Boolean))];
  return [...order.filter((a) => present.includes(a)), ...present.filter((a) => !order.includes(a)).sort()];
};
HL.wellsByArea = (area) => HL.wells.filter((w) => w.area === area)
  .sort((a, b) => (b.active - a.active) || a.id.localeCompare(b.id));

// Auto segment width rule (cm) from the manual form.
HL.segmentWidth = (riverWidthCm) => {
  if (!riverWidthCm || riverWidthCm <= 0) return null;
  if (riverWidthCm <= 50) return 12.5;
  if (riverWidthCm <= 300) return 25;
  return 50; // wider channels: fall back to 50 cm
};
HL.segmentCount = (riverWidthCm) => {
  const w = HL.segmentWidth(riverWidthCm);
  return w ? Math.ceil(riverWidthCm / w) : 0;
};
