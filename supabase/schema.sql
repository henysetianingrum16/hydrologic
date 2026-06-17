-- ============================================================
-- HydroLogic — Supabase schema, RLS, seed, trigger.
-- Jalankan SELURUH file ini di Supabase Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ---------- MASTER: stations (titik debit) ----------
create table if not exists public.stations (
  id     text primary key,
  lokasi text not null,
  titik  text,
  lat    double precision,
  lng    double precision,
  active boolean not null default true
);

-- ---------- MASTER: wells (sumur pantau) ----------
create table if not exists public.wells (
  id       text primary key,
  area     text not null,
  z        numeric,
  stick_up numeric,
  x        double precision,
  y        double precision,
  tahun    integer,
  active   boolean not null default true
);

-- ---------- profiles (1:1 dengan auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'crew',   -- 'crew' | 'engineer' | 'admin'
  created_at timestamptz not null default now()
);

-- ---------- discharge_records ----------
create table if not exists public.discharge_records (
  id            text primary key,           -- id dari klien (untuk dedupe saat sync)
  station_id    text references public.stations(id),
  lokasi        text,
  titik         text,
  date          date not null,
  width_cm      numeric,
  segment_width numeric,
  weather       text,
  rainfall      numeric,
  note          text,
  segments      jsonb,
  total_area    numeric,
  total_q       numeric,
  q_ls          numeric,
  v_mean        numeric,
  gps           jsonb,
  crew          text,
  "time"        text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index if not exists discharge_date_idx    on public.discharge_records(date);
create index if not exists discharge_station_idx on public.discharge_records(station_id);

-- ---------- gwl_records ----------
create table if not exists public.gwl_records (
  id         text primary key,
  well_id    text references public.wells(id),
  area       text,
  z          numeric,
  stick_up   numeric,
  date       date not null,
  depth      numeric,
  elevation  numeric,
  note       text,
  crew       text,
  "time"     text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists gwl_date_idx on public.gwl_records(date);
create index if not exists gwl_well_idx on public.gwl_records(well_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.stations          enable row level security;
alter table public.wells             enable row level security;
alter table public.profiles          enable row level security;
alter table public.discharge_records enable row level security;
alter table public.gwl_records       enable row level security;

-- Master data: semua user login boleh BACA (write hanya lewat SQL editor / service role).
drop policy if exists "read stations" on public.stations;
create policy "read stations" on public.stations for select to authenticated using (true);

drop policy if exists "read wells" on public.wells;
create policy "read wells" on public.wells for select to authenticated using (true);

-- Profiles: semua login boleh baca (untuk tampilkan nama pengukur); ubah hanya milik sendiri.
drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "upsert own profile" on public.profiles;
create policy "upsert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

-- Records: semua login boleh BACA semua (engineer butuh lihat semua titik).
-- INSERT/UPDATE/DELETE hanya untuk data milik sendiri.
drop policy if exists "read discharge" on public.discharge_records;
create policy "read discharge" on public.discharge_records for select to authenticated using (true);
drop policy if exists "insert own discharge" on public.discharge_records;
create policy "insert own discharge" on public.discharge_records for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "update own discharge" on public.discharge_records;
create policy "update own discharge" on public.discharge_records for update to authenticated using (created_by = auth.uid());
drop policy if exists "delete own discharge" on public.discharge_records;
create policy "delete own discharge" on public.discharge_records for delete to authenticated using (created_by = auth.uid());

drop policy if exists "read gwl" on public.gwl_records;
create policy "read gwl" on public.gwl_records for select to authenticated using (true);
drop policy if exists "insert own gwl" on public.gwl_records;
create policy "insert own gwl" on public.gwl_records for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "update own gwl" on public.gwl_records;
create policy "update own gwl" on public.gwl_records for update to authenticated using (created_by = auth.uid());
drop policy if exists "delete own gwl" on public.gwl_records;
create policy "delete own gwl" on public.gwl_records for delete to authenticated using (created_by = auth.uid());

-- ============================================================
-- Auto-buat profile saat user baru daftar
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED master data (3 titik debit aktif + 35 sumur pantau)
-- ============================================================
insert into public.stations (id, lokasi, titik, lat, lng, active) values
  ('WDKK',   'WDKK',   'Hilir Underdrain',  -1.2340, 116.7890, true),
  ('DSTF',   'DSTF',   'Hilir DSTF-Landi',  -1.2455, 116.7712, true),
  ('PABRIK', 'Pabrik', 'Box Culvert Pabrik',-1.2298, 116.8015, true)
on conflict (id) do update set
  lokasi=excluded.lokasi, titik=excluded.titik, lat=excluded.lat, lng=excluded.lng, active=excluded.active;

insert into public.wells (id, area, z, stick_up, x, y, tahun, active) values
  ('DH04A','Badak',220.07,0.50,379414.6,9720816.4,2025,true),
  ('DH05A','Badak',224.95,0.44,379431.6,9720974.8,2025,true),
  ('DH01','Badak',222.70,0.50,378866.3,9720575.3,2025,true),
  ('DH01_inactive','Badak',221.74,0.59,378846.6,9720572.3,2022,false),
  ('DH01A','Badak',251.33,0.55,379095.0,9721780.0,2022,true),
  ('DH02','Badak',218.69,0.44,379316.7,9720417.5,2025,true),
  ('DH02_inactive','Badak',243.75,0.65,379182.4,9720465.8,2022,false),
  ('DH02A','Badak',212.41,0.55,379293.0,9721810.0,2022,true),
  ('DH03','Badak',256.07,0.50,378915.0,9719790.0,2022,true),
  ('DH03A','Badak',226.89,0.30,379685.0,9720920.0,2022,true),
  ('DH04','Badak',227.09,0.61,379079.6,9719298.7,2022,true),
  ('DH05','Badak',230.24,0.50,378715.4,9720273.8,2025,true),
  ('DH06','Badak',208.98,0.45,379302.7,9720216.1,2025,true),
  ('DH07','Badak',281.16,0.30,378163.8,9720275.2,2022,true),
  ('DH09','Badak',229.91,0.56,378600.2,9720554.7,2022,true),
  ('DH10_inactive','Badak',230.24,0.22,378715.4,9720273.8,2022,false),
  ('DH11','Badak',276.00,0.61,378089.0,9720813.0,2022,true),
  ('DH12','Badak',245.67,0.53,378567.9,9720077.2,2022,true),
  ('DH13','Badak',246.06,0.34,378323.3,9720591.1,2025,true),
  ('DH14','Badak',245.79,0.87,378639.1,9720825.9,2025,true),
  ('DH15','Badak',203.76,0.50,379834.1,9720574.1,2025,true),
  ('DH16','Badak',202.58,0.50,379705.6,9720333.7,2025,true),
  ('DH17','Badak',203.30,0.50,379317.0,9720579.2,2025,true),
  ('DH18','Badak',308.58,0.50,378128.9,9720508.9,2025,true),
  ('DHRPZ 01','Haraan',585.71,0.68,376233.6,9721803.1,null,true),
  ('DPTHR04','Haraan',459.91,0.50,376553.9,9721857.3,null,true),
  ('DPTHR04A','Haraan',459.79,0.50,376553.1,9721854.2,null,true),
  ('DPTHR05','Haraan',551.42,0.38,376531.1,9722221.5,null,true),
  ('DKKPZ01','Kembatang',502.70,0.57,377149.4,9723126.4,null,false),
  ('DKKPZ02','Kembatang',373.49,0.33,377278.9,9723629.4,null,true),
  ('PTKK01','Kembatang',396.38,0.66,377430.1,9723439.0,2025,true),
  ('PTKK02','Kembatang',484.21,0.43,377244.7,9722911.5,2025,true),
  ('PTKK03','Kembatang',409.39,0.50,377113.5,9723414.9,2025,true),
  ('PTKK04','Kembatang',608.37,0.50,376877.0,9722990.4,2026,true),
  ('DMTPZ 01','Menteu',636.98,0.38,375628.8,9719472.8,null,true)
on conflict (id) do update set
  area=excluded.area, z=excluded.z, stick_up=excluded.stick_up,
  x=excluded.x, y=excluded.y, tahun=excluded.tahun, active=excluded.active;

-- Selesai. Lihat Table Editor untuk memastikan data master masuk.
