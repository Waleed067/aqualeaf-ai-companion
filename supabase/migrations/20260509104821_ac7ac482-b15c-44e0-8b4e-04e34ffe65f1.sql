
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('plant','fish','unknown')),
  image_url text not null,
  common_name text,
  scientific_name text,
  confidence numeric,
  similar_species jsonb default '[]'::jsonb,
  description text,
  habitat text,
  toxicity text,
  care_guide jsonb default '{}'::jsonb,
  disease jsonb default '{}'::jsonb,
  notes text,
  group_key text,
  created_at timestamptz not null default now()
);
alter table public.scans enable row level security;
create policy "scans_select_own" on public.scans for select using (auth.uid() = user_id);
create policy "scans_insert_own" on public.scans for insert with check (auth.uid() = user_id);
create policy "scans_update_own" on public.scans for update using (auth.uid() = user_id);
create policy "scans_delete_own" on public.scans for delete using (auth.uid() = user_id);
create index scans_user_created on public.scans(user_id, created_at desc);
create index scans_group on public.scans(user_id, group_key);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scan_id uuid not null references public.scans on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "msgs_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "msgs_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "msgs_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);
create index chat_scan_created on public.chat_messages(scan_id, created_at);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scan_id uuid references public.scans on delete cascade,
  title text not null,
  kind text not null check (kind in ('water','feed','other')),
  next_at timestamptz not null,
  interval_days integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.reminders enable row level security;
create policy "rem_select_own" on public.reminders for select using (auth.uid() = user_id);
create policy "rem_insert_own" on public.reminders for insert with check (auth.uid() = user_id);
create policy "rem_update_own" on public.reminders for update using (auth.uid() = user_id);
create policy "rem_delete_own" on public.reminders for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('scans', 'scans', true)
  on conflict (id) do nothing;

create policy "scans_public_read" on storage.objects for select using (bucket_id = 'scans');
create policy "scans_user_insert" on storage.objects for insert with check (
  bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "scans_user_update" on storage.objects for update using (
  bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "scans_user_delete" on storage.objects for delete using (
  bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
);
