-- EAG Charts · Grupo general: quién leyó cada mensaje ("Visto por …")
-- Devuelve hasta dónde leyó cada persona del grupo (solo los que leyeron desde p_min en adelante).
create or replace function public.chat_group_reads(p_min bigint default 0)
returns table(user_id uuid, username text, avatar_url text, last_id bigint)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.username, p.avatar_url, r.last_id
  from public.chart_reads r join public.profiles p on p.id = r.user_id
  where auth.uid() is not null and r.room = 'g:general' and r.last_id >= coalesce(p_min, 0)
  order by r.last_id desc
  limit 500
$$;
revoke execute on function public.chat_group_reads(bigint) from public, anon;
grant execute on function public.chat_group_reads(bigint) to authenticated;

-- ============ @menciones: se guardan para avisarle a la persona aunque no estuviera conectada ============
create table if not exists public.chart_mentions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  msg_id bigint not null references public.chart_msgs(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen boolean not null default false,
  unique (user_id, msg_id)
);
create index if not exists chart_mentions_user on public.chart_mentions (user_id, seen, id desc);
alter table public.chart_mentions enable row level security;
drop policy if exists "mis menciones" on public.chart_mentions;
create policy "mis menciones" on public.chart_mentions for select using (user_id = auth.uid());

create or replace function public.chart_msgs_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.room <> 'g:general' or position('@' in coalesce(new.body,'')) = 0 then return new; end if;
  insert into public.chart_mentions (user_id, msg_id, sender)
  select p.id, new.id, new.sender
  from (select distinct lower(m[1]) as n from regexp_matches(new.body, '@([[:alnum:]_.\-]{2,40})', 'g') as m limit 20) t
  join public.profiles p on lower(p.username) = t.n
  where p.id <> new.sender
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists chart_msgs_mentions_t on public.chart_msgs;
create trigger chart_msgs_mentions_t after insert on public.chart_msgs for each row execute function public.chart_msgs_mentions();

-- mis menciones sin ver (con quién y qué dijo) y marcarlas vistas
create or replace function public.chat_my_mentions() returns table(id bigint, msg_id bigint, sender uuid, username text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.id, x.msg_id, x.sender, p.username, left(m.body, 200), m.created_at
  from public.chart_mentions x join public.chart_msgs m on m.id = x.msg_id join public.profiles p on p.id = x.sender
  where x.user_id = auth.uid() and not x.seen and m.created_at > now() - interval '7 days'
  order by x.id desc limit 20
$$;
create or replace function public.chat_mentions_seen() returns void
language sql security definer set search_path = public as $$
  update public.chart_mentions set seen = true where user_id = auth.uid() and not seen
$$;
revoke execute on function public.chat_my_mentions() from public, anon;
revoke execute on function public.chat_mentions_seen() from public, anon;
grant execute on function public.chat_my_mentions() to authenticated;
grant execute on function public.chat_mentions_seen() to authenticated;
