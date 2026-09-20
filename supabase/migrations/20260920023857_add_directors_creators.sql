-- People metadata for embeddings and title detail.

alter table public.titles add column if not exists directors text[] not null default '{}';
alter table public.titles add column if not exists creators text[] not null default '{}';

drop function if exists public.match_titles(vector, integer, text, integer[], text[], text[], integer, integer);

create function public.match_titles(
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
  directors text[],
  creators text[],
  distance double precision
)
language sql
stable
set search_path = public
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
    t.directors,
    t.creators,
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

grant execute on function public.match_titles(vector, integer, text, integer[], text[], text[], integer, integer) to anon, authenticated, service_role;
