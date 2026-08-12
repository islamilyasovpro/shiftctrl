-- ShiftCtrl — schéma de base de données
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller > Run

create extension if not exists "pgcrypto";

-- ── Clients / sites ─────────────────────────────────────────────
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  indemnite numeric not null default 0,
  day_start time not null default '08:00',
  day_end time not null default '16:00',
  night_start time not null default '22:00',
  night_end time not null default '06:00',
  created_at timestamptz not null default now()
);

alter table sites enable row level security;

create policy "sites_select_own" on sites for select using (auth.uid() = user_id);
create policy "sites_insert_own" on sites for insert with check (auth.uid() = user_id);
create policy "sites_update_own" on sites for update using (auth.uid() = user_id);
create policy "sites_delete_own" on sites for delete using (auth.uid() = user_id);

-- ── Shifts ──────────────────────────────────────────────────────
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  type text not null check (type in ('jour', 'nuit')),
  transport text not null default 'aucun' check (transport in ('conducteur', 'passager', 'aucun')),
  status text not null default 'prevu' check (status in ('preste', 'prevu', 'annule')),
  created_at timestamptz not null default now()
);

alter table shifts enable row level security;

create policy "shifts_select_own" on shifts for select using (auth.uid() = user_id);
create policy "shifts_insert_own" on shifts for insert with check (auth.uid() = user_id);
create policy "shifts_update_own" on shifts for update using (auth.uid() = user_id);
create policy "shifts_delete_own" on shifts for delete using (auth.uid() = user_id);

create index if not exists shifts_user_date_idx on shifts (user_id, date);

-- ── Taux & primes (une ligne par utilisateur) ─────────────────────
create table if not exists rates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  taux_jour numeric not null default 14,
  taux_nuit numeric not null default 17,
  prime numeric not null default 19,
  updated_at timestamptz not null default now()
);

alter table rates enable row level security;

create policy "rates_select_own" on rates for select using (auth.uid() = user_id);
create policy "rates_insert_own" on rates for insert with check (auth.uid() = user_id);
create policy "rates_update_own" on rates for update using (auth.uid() = user_id);
