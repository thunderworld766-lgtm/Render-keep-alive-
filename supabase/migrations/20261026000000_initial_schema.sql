create extension if not exists pgcrypto;

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  current_state text not null default 'unknown'
    check (current_state in ('live', 'down', 'unknown')),
  status_code integer,
  response_time_ms integer
);

create table if not exists public.check_history (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  checked_at timestamptz not null default now(),
  state text not null check (state in ('live', 'down', 'unknown')),
  status_code integer,
  response_time_ms integer,
  error_message text
);

create index if not exists check_history_website_checked_at_idx
  on public.check_history (website_id, checked_at desc);

alter table public.websites enable row level security;
alter table public.check_history enable row level security;

revoke all on public.websites from anon, authenticated;
revoke all on public.check_history from anon, authenticated;
