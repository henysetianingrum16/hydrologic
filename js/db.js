/* HydroLogic — IndexedDB storage. All records saved on-device first (offline-first).
   Each record carries a `synced` flag; sync.js flushes unsynced records when online. */
window.HL = window.HL || {};

HL.db = (function () {
  const DB_NAME = 'hydrologic';
  const DB_VER = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('records')) {
          const os = db.createObjectStore('records', { keyPath: 'id' });
          os.createIndex('byType', 'type', { unique: false });
          os.createIndex('byDate', 'date', { unique: false });
          os.createIndex('bySynced', 'synced', { unique: false });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  // id: e.g. WDKK-20260616-0815 / MAT-DH04A-20260616
  function uid(prefix) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    return `${prefix}-${stamp}`;
  }

  async function put(record) {
    if (!record.id) record.id = uid(record.type === 'discharge' ? (record.stationId || 'Q') : 'MAT');
    if (record.synced === undefined) record.synced = 0;
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    const os = await tx('records', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = os.put(record);
      r.onsuccess = () => resolve(record);
      r.onerror = () => reject(r.error);
    });
  }

  async function all() {
    const os = await tx('records', 'readonly');
    return new Promise((resolve, reject) => {
      const r = os.getAll();
      r.onsuccess = () => resolve(r.result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      r.onerror = () => reject(r.error);
    });
  }

  async function byType(type) {
    return (await all()).filter((r) => r.type === type);
  }

  async function unsynced() {
    return (await all()).filter((r) => !r.synced);
  }

  async function markSynced(ids) {
    const os = await tx('records', 'readwrite');
    return Promise.all(ids.map((id) => new Promise((resolve) => {
      const g = os.get(id);
      g.onsuccess = () => {
        const rec = g.result; if (!rec) return resolve();
        rec.synced = 1; rec.syncedAt = new Date().toISOString();
        os.put(rec).onsuccess = () => resolve();
      };
    })));
  }

  async function remove(id) {
    const os = await tx('records', 'readwrite');
    return new Promise((resolve) => { os.delete(id).onsuccess = () => resolve(); });
  }

  // Latest record for a given well (for "compare to last reading").
  async function lastGwl(wellId, beforeId) {
    const recs = (await byType('gwl')).filter((r) => r.wellId === wellId && r.id !== beforeId);
    return recs[0] || null;
  }
  async function lastDischarge(stationId, beforeId) {
    const recs = (await byType('discharge')).filter((r) => r.stationId === stationId && r.id !== beforeId);
    return recs[0] || null;
  }

  return { open, put, all, byType, unsynced, markSynced, remove, uid, lastGwl, lastDischarge };
})();
