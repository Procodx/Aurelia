-- Tomorrow's Stars. No public policies on purpose: all reads and writes go
-- through the manage-stars edge function (service role), which hides the
-- title and message of any star whose day has not arrived yet.
create table if not exists public.future_stars (
  id text primary key,
  date date not null,
  hint text not null default '',
  title text not null default '',
  message text not null default '',
  tone text not null default 'gold' check (tone in ('gold', 'blue', 'rose', 'violet')),
  created_at timestamptz not null default now()
);

alter table public.future_stars enable row level security;
