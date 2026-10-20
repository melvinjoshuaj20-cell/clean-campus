-- Clean Campus / CleanMap 2.0 Supabase setup
-- Run in Supabase SQL Editor. Then insert approved staff emails in lowercase.
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  note text,
  image_urls text[] not null default '{}',
  status text not null default 'open' check (status in ('open','cleaned')),
  created_at timestamptz not null default now(),
  cleaned_at timestamptz,
  cleaned_by text
);

alter table public.admins enable row level security;
alter table public.reports enable row level security;

-- Internal helper schema is not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower((select auth.jwt() ->> 'email'))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Admin list: users can only see their own email row; the helper checks membership server-side.
drop policy if exists "own admin row" on public.admins;
create policy "own admin row" on public.admins for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')));
grant select on public.admins to authenticated;

-- Reports: students can see their own; approved admins can see all.
drop policy if exists "read own or admin" on public.reports;
create policy "read own or admin" on public.reports for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "students create open reports" on public.reports;
create policy "students create open reports" on public.reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and cleaned_at is null and cleaned_by is null);
-- Do not allow arbitrary table updates from the browser. Status changes go through the RPC below.
drop policy if exists "admin update" on public.reports;
drop policy if exists "admin delete" on public.reports;
create policy "admin delete" on public.reports for delete to authenticated
  using ((select private.is_admin()));
grant select, insert, delete on public.reports to authenticated;

create or replace function public.set_report_status(report_id uuid, new_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Not authorized';
  end if;
  if new_status not in ('open','cleaned') then
    raise exception 'Invalid status';
  end if;
  update public.reports
  set status = new_status,
      cleaned_at = case when new_status = 'cleaned' then now() else null end,
      cleaned_by = case when new_status = 'cleaned' then (select auth.jwt() ->> 'email') else null end
  where id = report_id;
  if not found then raise exception 'Report not found'; end if;
end;
$$;
revoke all on function public.set_report_status(uuid, text) from public, anon;
grant execute on function public.set_report_status(uuid, text) to authenticated;

-- Public bucket means any person who knows an image URL can view it. Use private bucket for sensitive photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-images', 'report-images', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "upload to own folder" on storage.objects;
create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "admin delete photos" on storage.objects;
create policy "admin delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'report-images' and (select private.is_admin()));

-- Enable Realtime for the reports table (safe to run if already included).
do $$ begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
when others then
  if sqlstate <> '42710' then raise; end if;
end $$;
