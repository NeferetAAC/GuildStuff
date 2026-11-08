create table public.discord_members (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  discord_user_id text not null,
  discord_username text,
  created_at timestamptz not null default now(),
  unique (guild_id, discord_user_id)
);

create table public.discord_characters (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.discord_members(id) on delete cascade,
  character_name text not null,
  class_name text,
  level integer check (level >= 1),
  playstyle text check (playstyle is null or playstyle in ('pvp', 'pve', 'pvx')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index discord_characters_member_name_idx
  on public.discord_characters (member_id, lower(character_name));

alter table public.discord_members enable row level security;
alter table public.discord_characters enable row level security;

revoke all on public.discord_members from anon, authenticated;
revoke all on public.discord_characters from anon, authenticated;

grant all on public.discord_members to service_role;
grant all on public.discord_characters to service_role;

create table public.discord_command_sync (
  id smallint primary key check (id = 1),
  deployment_id text not null,
  synced_at timestamptz not null default now()
);
alter table public.discord_command_sync enable row level security;
revoke all on public.discord_command_sync from anon, authenticated;
grant all on public.discord_command_sync to service_role;
