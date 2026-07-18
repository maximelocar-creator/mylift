-- Notifications PUSH — À APPLIQUER PAR MAXIME dans le SQL Editor Supabase.
-- Rejouable sans risque (create or replace / if not exists).
--
-- Architecture :
--   1. push_tokens : un token Expo par utilisateur (RLS owner-only), écrit
--      par l'app native au login (notifs.registerForPushIfBuilt).
--   2. notify_user() SECURITY DEFINER : insère dans notifications (la policy
--      INSERT est fermée aux clients — c'est ce chemin serveur qui était
--      prévu) puis envoie le push via l'API Expo (pg_net, extension HTTP
--      officielle Supabase).
--   3. Triggers sur likes / comments / follows : demande d'ami, acceptation,
--      like, commentaire. Filtres anti-bruit pour la réciprocité
--      AUTO-CONVERGENTE du modèle AMIS (cf. CLAUDE.md) : l'écho inverse
--      créé par une acceptation ne renotifie personne.
--
-- PRÉREQUIS : activer l'extension pg_net (Dashboard → Database → Extensions
-- → chercher "pg_net" → Enable), ou laisser la ligne ci-dessous le faire.

create extension if not exists pg_net;

-- 1. Table des tokens push -------------------------------------------------
create table if not exists public.push_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_own_select" on public.push_tokens;
create policy "push_tokens_own_select" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens_own_insert" on public.push_tokens;
create policy "push_tokens_own_insert" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_tokens_own_update" on public.push_tokens;
create policy "push_tokens_own_update" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_tokens_own_delete" on public.push_tokens;
create policy "push_tokens_own_delete" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- 2. Insertion de notification + envoi push --------------------------------
create or replace function public.notify_user(
  target uuid,
  ntype text,
  ntitle text,
  nbody text,
  npayload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ptoken text;
begin
  -- Notification in-app (id text côté schéma, généré ici)
  insert into notifications (id, user_id, type, payload)
  values (
    'id-' || substr(md5(random()::text), 1, 7) || '-' || floor(extract(epoch from now()) * 1000)::text,
    target, ntype, npayload
  );

  -- Push Expo (si l'utilisateur a un token enregistré)
  select token into ptoken from push_tokens where user_id = target;
  if ptoken is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', ptoken,
        'title', ntitle,
        'body', nbody,
        'sound', 'default',
        'data', npayload
      )
    );
  end if;
end;
$$;

-- 3. Triggers ---------------------------------------------------------------

-- LIKE sur un post → notifie le owner du post (jamais soi-même)
create or replace function public.on_like_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  post_owner uuid;
  actor_name text;
  post_title text;
begin
  select owner_id, title into post_owner, post_title from posts where id = new.post_id;
  if post_owner is null or post_owner = new.user_id then return new; end if;
  select username into actor_name from profiles where id = new.user_id;
  perform notify_user(
    post_owner, 'like',
    'Nouveau like ❤️',
    coalesce('@' || actor_name, 'Quelqu''un') || ' a aimé « ' || coalesce(post_title, 'ton post') || ' »',
    jsonb_build_object('post_id', new.post_id, 'actor_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_like_notify on public.likes;
create trigger trg_like_notify after insert on public.likes
  for each row execute function public.on_like_notify();

-- COMMENTAIRE sur un post → notifie le owner du post (jamais soi-même)
create or replace function public.on_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  post_owner uuid;
  actor_name text;
begin
  select owner_id into post_owner from posts where id = new.post_id;
  if post_owner is null or post_owner = new.user_id then return new; end if;
  select username into actor_name from profiles where id = new.user_id;
  perform notify_user(
    post_owner, 'comment',
    'Nouveau commentaire 💬',
    coalesce('@' || actor_name, 'Quelqu''un') || ' : ' || left(new.text, 120),
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'actor_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_comment_notify on public.comments;
create trigger trg_comment_notify after insert on public.comments
  for each row execute function public.on_comment_notify();

-- DEMANDE D'AMI (insert pending) → notifie le destinataire.
-- Filtre réciprocité : si un lien inverse existe déjà (dans n'importe quel
-- statut), c'est l'écho auto-convergent d'une acceptation → silence.
create or replace function public.on_follow_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
begin
  if new.status <> 'pending' then return new; end if;
  if exists (
    select 1 from follows
    where follower_id = new.following_id and following_id = new.follower_id
  ) then
    return new; -- écho de réciprocité, pas une vraie demande
  end if;
  select username into actor_name from profiles where id = new.follower_id;
  perform notify_user(
    new.following_id, 'friend_request',
    'Demande d''ami 🤝',
    coalesce('@' || actor_name, 'Quelqu''un') || ' souhaite devenir ami',
    jsonb_build_object('actor_id', new.follower_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_follow_request_notify on public.follows;
create trigger trg_follow_request_notify after insert on public.follows
  for each row execute function public.on_follow_request_notify();

-- ACCEPTATION (pending → accepted) → notifie le demandeur initial.
-- Filtre réciprocité : si le lien inverse est DÉJÀ accepted, cette
-- acceptation-ci est la convergence automatique → silence.
create or replace function public.on_follow_accept_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
begin
  if old.status <> 'pending' or new.status <> 'accepted' then return new; end if;
  if exists (
    select 1 from follows
    where follower_id = new.following_id and following_id = new.follower_id
      and status = 'accepted'
  ) then
    return new; -- convergence auto, déjà notifié à la vraie acceptation
  end if;
  select username into actor_name from profiles where id = new.following_id;
  perform notify_user(
    new.follower_id, 'friend_accepted',
    'Demande acceptée ✅',
    coalesce('@' || actor_name, 'Ton ami') || ' a accepté ta demande — vous êtes amis',
    jsonb_build_object('actor_id', new.following_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_follow_accept_notify on public.follows;
create trigger trg_follow_accept_notify after update on public.follows
  for each row execute function public.on_follow_accept_notify();
