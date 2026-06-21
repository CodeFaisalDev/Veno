-- Create usage_tracker table
create table if not exists public.usage_tracker (
  id uuid primary key default gen_random_uuid(),
  map_enabled boolean not null default true,
  map_loads_this_month integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.usage_tracker enable row level security;

-- Policy to allow authenticated users to select
create policy "Allow authenticated users to read usage tracker"
  on public.usage_tracker for select
  to authenticated
  using (true);

-- Insert configuration record
insert into public.usage_tracker (id, map_enabled, map_loads_this_month)
values ('00000000-0000-0000-0000-000000000000', true, 0)
on conflict (id) do nothing;

-- Enable cron extension (pg_cron is enabled by default in extensions schema on Supabase)
create extension if not exists pg_cron with schema extensions;

-- Schedule reset of map loads
select cron.schedule(
  'reset-map-loads',
  '0 0 1 * *', -- at midnight on the 1st of every month
  $$
    update public.usage_tracker
    set map_loads_this_month = 0,
        map_enabled = true,
        updated_at = now()
    where id = '00000000-0000-0000-0000-000000000000';
  $$
);
