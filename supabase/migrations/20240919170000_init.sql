-- WatchNext v1 schema: pgvector catalog, likes/dislikes, taste, RLS.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  taste_embedding vector(1536),
  liked_vibe_tags text[] not null default '{}',
  onboarding_completed_at timestamptz,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.titles (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  name text not null,
  year integer,
  overview text,
  tagline text,
  genres text[] not null default '{}',
  keywords text[] not null default '{}',
  top_cast text[] not null default '{}',
  poster_path text,
  backdrop_path text,
  vote_average double precision,
  popularity double precision,
  runtime integer,
  original_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

create table if not exists public.title_embeddings (
  title_id uuid primary key references public.titles(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now()
);

create index if not exists titles_popularity_idx on public.titles (popularity desc);
create index if not exists titles_media_type_idx on public.titles (media_type);
create index if not exists titles_name_trgm_idx on public.titles using gin (name gin_trgm_ops);
create index if not exists title_embeddings_hnsw on public.title_embeddings
  using hnsw (embedding vector_cosine_ops);

create table if not exists public.user_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  verdict text not null check (verdict in ('like', 'dislike')),
  source text not null default 'onboarding' check (source in ('onboarding', 'favorite')),
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create table if not exists public.user_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create table if not exists public.user_seen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index if not exists user_likes_user_idx on public.user_likes (user_id);
create index if not exists user_watchlist_user_idx on public.user_watchlist (user_id);
create index if not exists user_seen_user_idx on public.user_seen (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists titles_updated_at on public.titles;
create trigger titles_updated_at
  before update on public.titles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Guest'),
    coalesce(new.raw_app_meta_data->>'provider', '') = 'anonymous'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.match_titles(
  query_embedding vector(1536),
  match_count integer default 15,
  filter_media_type text default null,
  exclude_tmdb_ids integer[] default '{}',
  include_genres text[] default null,
  exclude_genres text[] default null,
  min_year integer default null,
  max_year integer default null
)
returns table (
  id uuid,
  tmdb_id integer,
  media_type text,
  name text,
  year integer,
  overview text,
  genres text[],
  poster_path text,
  backdrop_path text,
  vote_average double precision,
  popularity double precision,
  tagline text,
  top_cast text[],
  distance double precision
)
language sql
stable
as $$
  select
    t.id,
    t.tmdb_id,
    t.media_type,
    t.name,
    t.year,
    t.overview,
    t.genres,
    t.poster_path,
    t.backdrop_path,
    t.vote_average,
    t.popularity,
    t.tagline,
    t.top_cast,
    (e.embedding <=> query_embedding) as distance
  from public.title_embeddings e
  join public.titles t on t.id = e.title_id
  where
    (filter_media_type is null or t.media_type = filter_media_type)
    and not (t.tmdb_id = any (coalesce(exclude_tmdb_ids, '{}')))
    and (include_genres is null or t.genres && include_genres)
    and (exclude_genres is null or not (t.genres && exclude_genres))
    and (min_year is null or coalesce(t.year, 0) >= min_year)
    and (max_year is null or coalesce(t.year, 9999) <= max_year)
  order by e.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 15), 50));
$$;

alter table public.profiles enable row level security;
alter table public.titles enable row level security;
alter table public.title_embeddings enable row level security;
alter table public.user_likes enable row level security;
alter table public.user_watchlist enable row level security;
alter table public.user_seen enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "titles_read" on public.titles;
create policy "titles_read" on public.titles
  for select using (true);

drop policy if exists "embeddings_read" on public.title_embeddings;
create policy "embeddings_read" on public.title_embeddings
  for select using (true);

drop policy if exists "likes_own" on public.user_likes;
create policy "likes_own" on public.user_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watchlist_own" on public.user_watchlist;
create policy "watchlist_own" on public.user_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "seen_own" on public.user_seen;
create policy "seen_own" on public.user_seen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.titles to anon, authenticated, service_role;
grant select on public.title_embeddings to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_likes to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_watchlist to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_seen to anon, authenticated, service_role;
grant execute on function public.match_titles(vector, integer, text, integer[], text[], text[], integer, integer) to anon, authenticated, service_role;
