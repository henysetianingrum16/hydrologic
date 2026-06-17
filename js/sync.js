/* HydroLogic — connectivity + sync status.
   Prototype: "sync" is simulated (no real backend yet) but the offline queue,
   online/offline detection, and status indicator are fully wired. */
window.HL = window.HL || {};

HL.sync = (function () {
  let syncing = false;

  function setPill(state, text) {
    const dot = document.getElementById('sync-dot');
    const txt = document.getElementById('sync-text');
    if (!dot || !txt) return;
    dot.className = 'sync-dot is-' + state;
    txt.textContent = text;
  }

  async function refresh() {
    const pending = (await HL.db.unsynced()).length;
    if (syncing) { setPill('syncing', 'Sinkron…'); return; }
    if (!navigator.onLine) {
      setPill('offline', pending ? `Offline · ${pending} antri` : 'Offline');
    } else {
      setPill('online', pending ? `${pending} antri` : 'Tersinkron');
    }
  }

  // Simulated push: in production, POST unsynced records to the cloud DB here.
  async function flush() {
    if (syncing || !navigator.onLine) return;
    const pending = await HL.db.unsynced();
    if (!pending.length) { refresh(); return; }
    syncing = true; refresh();
    await new Promise((r) => setTimeout(r, 900)); // simulate network
    await HL.db.markSynced(pending.map((p) => p.id));
    syncing = false;
    HL.toast(`${pending.length} data tersinkron ke server`, 'ok');
    refresh();
    document.dispatchEvent(new CustomEvent('hl:synced'));
  }

  function init() {
    window.addEventListener('online', () => { refresh(); flush(); });
    window.addEventListener('offline', refresh);
    document.addEventListener('hl:saved', () => { refresh(); flush(); });
    refresh();
    if (navigator.onLine) setTimeout(flush, 1200);
  }

  return { init, refresh, flush, setPill };
})();
