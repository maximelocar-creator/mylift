-- Suggestions d'amis (amis en commun) — À APPLIQUER PAR MAXIME dans le
-- SQL Editor du dashboard Supabase (après validation).
--
-- POURQUOI UNE FONCTION : la RLS de follows ne montre à chacun que SES
-- propres liens (sondé en prod le 17/07/2026) — c'est voulu et on ne
-- l'affaiblit pas. Cette fonction SECURITY DEFINER calcule les
-- "amis de mes amis" côté serveur et ne renvoie QUE des ids de profils
-- (déjà publics en lecture) + un compteur d'amis en commun. Elle n'expose
-- jamais la liste d'amis de qui que ce soit, ni aucune donnée
-- d'entraînement.
--
-- Rejouable sans risque (create or replace).

create or replace function public.friend_suggestions(max_results int default 20)
returns table (suggested_id uuid, mutual_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  with my_links as (
    -- toute relation existante (pending inclus) : à exclure des suggestions
    select case when follower_id = auth.uid() then following_id else follower_id end as oid
    from follows
    where follower_id = auth.uid() or following_id = auth.uid()
  ),
  my_friends as (
    select distinct case when follower_id = auth.uid() then following_id else follower_id end as fid
    from follows
    where status = 'accepted'
      and (follower_id = auth.uid() or following_id = auth.uid())
  ),
  candidates as (
    -- amis (acceptés) de chaque ami, dédoublonnés par paire (ami, candidat)
    select distinct mf.fid,
      case when f.follower_id = mf.fid then f.following_id else f.follower_id end as cid
    from follows f
    join my_friends mf on mf.fid in (f.follower_id, f.following_id)
    where f.status = 'accepted'
  )
  select cid as suggested_id, count(*) as mutual_count
  from candidates
  where cid <> auth.uid()
    and cid not in (select oid from my_links)
  group by cid
  order by mutual_count desc, cid
  limit max_results;
$$;

grant execute on function public.friend_suggestions(int) to authenticated;
revoke execute on function public.friend_suggestions(int) from anon;
