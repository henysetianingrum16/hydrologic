# HydroLogic — Setup Supabase (Tahap B)

Panduan menghubungkan aplikasi ke backend Supabase: login per orang + sync data + dashboard semua crew.

> **Sebelum dikonfigurasi**, aplikasi berjalan dalam **mode lokal** (data di HP saja, tanpa login). Setelah langkah di bawah selesai, login & sync otomatis aktif. Aplikasi tidak akan rusak di tengah proses.

---

## 1. Buat project Supabase
1. Buka **supabase.com** → **New project** (gratis).
2. Beri nama (mis. `hydrologic`), set **Database Password** (simpan baik-baik), pilih region terdekat (mis. Singapore).
3. Tunggu project selesai dibuat (~2 menit).

## 2. Jalankan skema database
1. Di project → menu kiri **SQL Editor** → **New query**.
2. Buka file **`supabase/schema.sql`** dari proyek ini, **copy seluruh isinya**, paste ke editor.
3. Klik **Run**. Akan terbuat 5 tabel + RLS + seed (3 titik debit, 35 sumur).
4. Cek **Table Editor** → tabel `stations` & `wells` sudah terisi.

## 3. Ambil URL + anon key, tempel ke aplikasi
1. Di project → **Project Settings → API**.
2. Salin **Project URL** dan **anon public** key.
3. Buka **`js/config.js`**, ganti dua nilai:
   ```js
   HL.config = {
     SUPABASE_URL: 'https://xxxxx.supabase.co',   // Project URL
     SUPABASE_ANON_KEY: 'eyJhbGci...'              // anon public key
   };
   ```
4. Simpan. (anon key memang **aman** ditaruh di sini — keamanan dijaga RLS.)

## 4. Atur autentikasi
1. Di project → **Authentication → Providers → Email** → pastikan **Enabled**.
2. **Authentication → Settings**:
   - Untuk uji coba cepat, **matikan "Confirm email"** supaya akun langsung aktif tanpa verifikasi email.
   - Untuk produksi, biarkan **aktif** (user harus konfirmasi via email).

## 5. Buat akun crew/engineer
Dua cara:
- **Lewat aplikasi:** buka app → tab **Daftar** → isi nama, email, password.
- **Lewat dashboard:** Authentication → **Add user** → isi email & password manual.

Set peran (opsional): di **Table Editor → profiles**, ubah kolom `role` jadi `engineer` atau `admin` untuk yang perlu.

## 6. Deploy & uji
1. Commit perubahan `js/config.js` lalu push (GitHub Pages auto-update).
   > **Naikkan versi cache** di `sw.js` (`hydrologic-v3` → `v4`) supaya HP menarik versi baru.
2. Buka aplikasi → harus muncul **layar login**.
3. Masuk → input debit/MAT → **Simpan**.
4. Cek **Table Editor → discharge_records / gwl_records** → data muncul.
5. Buka menu **Rekap** → dashboard menampilkan data semua crew.

---

## Cara kerja sync (ringkas)
- Data **selalu** disimpan dulu di HP (IndexedDB) → tetap jalan offline.
- Saat **online + login**, data yang belum tersinkron di-*upsert* ke Supabase, lalu ditandai "✓ sinkron".
- Master data (titik & sumur) ditarik dari Supabase saat online dan di-*cache* untuk dipakai offline.
- Indikator di pojok kanan atas: **Tersinkron / X antri / Offline / Belum login / Mode lokal**.

## Keamanan (RLS) — sudah diatur di schema.sql
- Semua user login: **boleh baca** semua record (engineer butuh lihat semua titik) + master data.
- **Insert/ubah/hapus** record hanya untuk **data milik sendiri** (`created_by = auth.uid()`).
- Master `stations`/`wells`: hanya bisa diubah lewat SQL Editor (service role), tidak dari aplikasi.

## Catatan
- **Mengembalikan ke mode lokal:** kosongkan lagi nilai di `js/config.js` (isi `YOUR_...`).
- **Tambah/ubah sumur:** edit tabel `wells` di Supabase (atau jalankan ulang bagian seed di `schema.sql`). Aplikasi akan menariknya otomatis.
- **iPhone:** penyimpanan PWA bisa dihapus jika app tak dibuka ~7 hari — pastikan crew rutin online agar antrian tersinkron.
