/* HydroLogic — authentication (Supabase email/password).
 * If Supabase isn't configured -> LOCAL MODE: no login, app works as before. */
window.HL = window.HL || {};

HL.auth = (function () {
  let _user = null;     // supabase user
  let _profile = null;  // { full_name, role }

  function localMode() { return !HL.isConfigured(); }
  function user() { return _user; }
  function isAuthed() { return localMode() || !!_user; }
  function role() { return _profile?.role || 'crew'; }

  // Crew display name: profile name (online) → cached → local fallback.
  function crewName() {
    if (_profile?.full_name) return _profile.full_name;
    return localStorage.getItem('hl_crew') || 'Crew Lapangan';
  }

  async function loadProfile() {
    const sb = HL.sb(); if (!sb || !_user) return;
    try {
      const { data } = await sb.from('profiles').select('full_name, role').eq('id', _user.id).maybeSingle();
      if (data) { _profile = data; if (data.full_name) localStorage.setItem('hl_crew', data.full_name); }
    } catch (e) { /* offline: keep cached name */ }
  }

  function anonymousMode() { return !localMode() && HL.config.ANONYMOUS === true; }
  function isAnonymous() { return !!(_user && _user.is_anonymous); }

  // Create a background anonymous session — ONLINE ONLY (never blocks offline startup).
  async function ensureAnonymous() {
    if (!anonymousMode() || _user || !navigator.onLine) return;
    const sb = HL.sb(); if (!sb) return;
    try {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      _user = data.user;
    } catch (e) {
      console.warn('anonymous sign-in gagal (aktifkan di Supabase):', e.message || e);
    }
  }

  async function init() {
    if (localMode()) return { authed: true, localMode: true };
    const sb = HL.sb();
    if (!sb) return { authed: true, localMode: false };  // supabase lib tak termuat -> jalan lokal
    try {
      const { data } = await sb.auth.getSession();        // baca localStorage (tanpa jaringan)
      _user = data?.session?.user || null;
    } catch (e) { _user = null; }
    await ensureAnonymous();                               // offline -> dilewati, tidak menggantung
    if (_user && !_user.is_anonymous) await loadProfile();
    sb.auth.onAuthStateChange((_evt, session) => {
      _user = session?.user || null;
      if (_user && !_user.is_anonymous) loadProfile();
      else if (!_user) _profile = null;
    });
    // Mode anonim tidak pernah memblokir dengan layar login.
    return { authed: anonymousMode() || !!_user, localMode: false };
  }

  async function signIn(email, password) {
    const sb = HL.sb();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _user = data.user; await loadProfile();
    return _user;
  }

  async function signUp(email, password, fullName) {
    const sb = HL.sb();
    const { data, error } = await sb.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    // Depending on project settings, email confirmation may be required.
    if (data.session) { _user = data.user; await loadProfile(); }
    return data;
  }

  async function signOut() {
    const sb = HL.sb(); if (sb) await sb.auth.signOut();
    _user = null; _profile = null;
  }

  // ---- Login screen ----
  function renderLogin(root, onDone) {
    root.innerHTML = `
    <div class="fade-in" style="max-width:420px;margin:0 auto">
      <div class="hero" style="text-align:center">
        <img src="assets/icons/icon-192.png" alt="" style="width:64px;height:64px;border-radius:14px;background:#fff;padding:5px;margin-bottom:8px"/>
        <h1>HydroLogic</h1>
        <p>Masuk untuk mulai monitoring</p>
      </div>
      <div class="card">
        <div id="auth-tabs" class="row" style="margin-bottom:6px">
          <button class="btn btn--ghost btn--sm" data-tab="in">Masuk</button>
          <button class="btn btn--ghost btn--sm" data-tab="up">Daftar</button>
        </div>
        <div id="auth-name-wrap" style="display:none">
          <label>Nama Lengkap</label>
          <input id="auth-name" placeholder="Nama pengukur"/>
        </div>
        <label>Email</label>
        <input id="auth-email" type="email" inputmode="email" placeholder="nama@perusahaan.com"/>
        <label>Password</label>
        <input id="auth-pass" type="password" placeholder="••••••••"/>
        <div id="auth-err" class="field-hint" style="color:var(--red);min-height:14px"></div>
        <button class="btn" id="auth-submit" style="margin-top:8px">Masuk</button>
        <div class="small muted center" style="margin-top:10px">Akun dibuat oleh admin atau lewat "Daftar".</div>
      </div>
    </div>`;

    let mode = 'in';
    const $ = (s) => root.querySelector(s);
    const setMode = (m) => {
      mode = m;
      $('#auth-name-wrap').style.display = m === 'up' ? 'block' : 'none';
      $('#auth-submit').textContent = m === 'up' ? 'Daftar' : 'Masuk';
      root.querySelectorAll('[data-tab]').forEach((b) =>
        b.classList.toggle('btn', b.dataset.tab === m) || b.classList.toggle('btn--ghost', b.dataset.tab !== m));
      $('#auth-err').textContent = '';
    };
    root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => setMode(b.dataset.tab));
    setMode('in');

    $('#auth-submit').onclick = async () => {
      const email = $('#auth-email').value.trim();
      const pass = $('#auth-pass').value;
      const name = $('#auth-name').value.trim();
      const err = $('#auth-err');
      if (!email || !pass) { err.textContent = 'Email & password wajib diisi'; return; }
      $('#auth-submit').disabled = true; err.textContent = '';
      try {
        if (mode === 'up') {
          const r = await signUp(email, pass, name);
          if (!r.session) { err.style.color = 'var(--green)'; err.textContent = 'Cek email untuk konfirmasi, lalu Masuk.'; setMode('in'); $('#auth-submit').disabled = false; return; }
        } else {
          await signIn(email, pass);
        }
        onDone();
      } catch (e) {
        err.style.color = 'var(--red)';
        err.textContent = e.message || 'Gagal masuk';
        $('#auth-submit').disabled = false;
      }
    };
  }

  return { init, ensureAnonymous, signIn, signUp, signOut, renderLogin, user, isAuthed, localMode, anonymousMode, isAnonymous, crewName, role, loadProfile };
})();
