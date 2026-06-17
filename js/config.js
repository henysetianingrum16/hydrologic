/* HydroLogic — Supabase configuration.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  ISI DUA NILAI DI BAWAH dari project Supabase kamu:               │
 * │  Supabase Dashboard → Project Settings → API                      │
 * │   • Project URL        → SUPABASE_URL                             │
 * │   • Project API keys → anon public  → SUPABASE_ANON_KEY           │
 * │                                                                   │
 * │  anon key AMAN ditaruh di sini (memang untuk dipakai di browser); │
 * │  keamanan diatur oleh Row Level Security (lihat supabase/schema.sql).│
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Selama masih placeholder, aplikasi berjalan dalam MODE LOKAL:
 * data tersimpan di HP saja, tanpa login & tanpa sync (seperti prototipe awal).
 */
window.HL = window.HL || {};

HL.config = {
  SUPABASE_URL: 'https://ctracgonxxfzarewtiya.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cmFjZ29ueHhmemFyZXd0aXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzYxODEsImV4cCI6MjA5NzIxMjE4MX0.s9enQZANazXwmU2zUIfGbMAp12jw40s5yJBVWeg1dqA'
};

// True only when real values have been filled in.
HL.isConfigured = function () {
  const c = HL.config;
  return !!c.SUPABASE_URL && !!c.SUPABASE_ANON_KEY
    && c.SUPABASE_URL.startsWith('http')
    && !c.SUPABASE_URL.includes('YOUR_')
    && !c.SUPABASE_ANON_KEY.includes('YOUR_');
};

// Lazily create and cache the Supabase client (only when configured).
HL._sb = null;
HL.sb = function () {
  if (!HL.isConfigured()) return null;
  if (!HL._sb && window.supabase) {
    HL._sb = window.supabase.createClient(HL.config.SUPABASE_URL, HL.config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return HL._sb;
};
