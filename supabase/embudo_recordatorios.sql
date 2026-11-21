-- Embudo de alumnos (Administración → Embudo) y recordatorio automático para hacerse Miembro verificado.

-- ===================== Recordatorio automático =====================
alter table public.profiles add column if not exists member_reminders int not null default 0;   -- cuántos recordatorios se le enviaron
alter table public.profiles add column if not exists member_reminded_at timestamptz;             -- el último

create table if not exists public.member_reminder_cfg (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  day1 int not null default 2 check (day1 between 1 and 60),    -- primer recordatorio: X días después de registrarse
  day2 int not null default 9 check (day2 between 0 and 90),    -- segundo recordatorio (0 = no enviar segundo)
  max_age int not null default 45 check (max_age between 7 and 365)  -- no escribir a cuentas más viejas que esto
);
insert into public.member_reminder_cfg (id) values (1) on conflict (id) do nothing;
alter table public.member_reminder_cfg enable row level security;
-- sin políticas: se lee y cambia con las funciones de admin

-- texto del recordatorio (los dos caminos: no tengo cuenta / ya tengo cuenta de Deriv)
create or replace function public.member_reminder_text(p_name text, p_second boolean)
returns text language plpgsql stable security definer set search_path = public as $$
declare link text;
begin
  select nullif(trim(data->>'derivRefUrl'), '') into link from public.site_settings where id = 1;
  link := coalesce(link, 'https://t.deriv.link/?t=ZX9736UCRTEQ');
  return (case when p_second then '¡Hola ' || coalesce(nullif(p_name,''),'') || '! Te escribimos de nuevo porque todavía no eres Miembro verificado de El Arte Gráfico 🙌'
               else '¡Hola ' || coalesce(nullif(p_name,''),'') || '! Bienvenido a El Arte Gráfico 👋 Te contamos cómo hacerte Miembro verificado (es gratis):' end) || chr(10) || chr(10)
    || '✅ Con eso desbloqueas: retos express con premios en dólares, puntos completos en todos los retos, funciones extra de EAG Charts y el rol de Miembro verificado en Discord.' || chr(10) || chr(10)
    || '🆕 SI NO TIENES CUENTA DE DERIV' || chr(10)
    || '1. Ábrela con el enlace de la comunidad: ' || link || chr(10)
    || '2. Copia tu ID de cliente (arriba a la derecha en Deriv) y pégalo en la página de Miembro verificado. Se verifica solo.' || chr(10) || chr(10)
    || '🔁 SI YA TIENES CUENTA DE DERIV (no te registres otra vez)' || chr(10)
    || '1. Entra a Deriv y abre el Live Chat de soporte.' || chr(10)
    || '2. Pide el cambio de afiliado/IB (retagging): "Hola, quiero solicitar el cambio de afiliado/IB de mi cuenta de Deriv. Quiero asociar mi cuenta al siguiente Partner: ' || link || '"' || chr(10)
    || '3. Cuando Deriv te confirme, pega tu ID en la página de Miembro verificado.' || chr(10) || chr(10)
    || '👉 https://elartegrafico.com/#miembro' || chr(10)
    || 'Cualquier duda, respóndenos aquí mismo.';
end $$;
revoke execute on function public.member_reminder_text(text, boolean) from public, anon, authenticated;

-- enviar un recordatorio a una persona (mensaje en su chat + notificación al celular)
create or replace function public.member_reminder_send(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare pr record; second boolean; body text; sec text;
  k text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc';
begin
  select id, username, member_reminders into pr from public.profiles where id = p_user;
  if pr.id is null then return false; end if;
  second := coalesce(pr.member_reminders, 0) >= 1;
  body := public.member_reminder_text(pr.username, second);
  insert into public.dm_threads (user_id, open, topic) values (p_user, true, 'Miembro verificado')
    on conflict (user_id) do update set open = true, last_at = now(), topic = case when public.dm_threads.topic = '' then 'Miembro verificado' else public.dm_threads.topic end;
  insert into public.dm_messages (user_id, from_admin, body, notified) values (p_user, true, body, true);
  update public.dm_threads set last_at = now() where user_id = p_user;
  update public.profiles set member_reminders = coalesce(member_reminders, 0) + 1, member_reminded_at = now() where id = p_user;
  -- notificación al celular (queda también en la campana)
  select cron_secret into sec from public.push_config where id = 1;
  if sec is not null then
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)'
        using 'https://animmecpzvhvnwzjljxg.supabase.co/functions/v1/send-push',
              jsonb_build_object('action', 'dm-user', 'user_id', p_user, 'text', case when second then 'Todavía puedes hacerte Miembro verificado (gratis). Te dejamos los pasos.' else 'Hazte Miembro verificado gratis: te dejamos los pasos en tu chat.' end),
              jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k, 'apikey', k, 'x-cron-secret', sec);
    exception when others then raise notice 'Notificación no enviada: %', sqlerrm;
    end;
  end if;
  return true;
end $$;
revoke execute on function public.member_reminder_send(uuid) from public, anon, authenticated;

-- quiénes deben recibir recordatorio hoy
create or replace function public.member_reminder_due(p_limit int default 60)
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p, public.member_reminder_cfg c
  where c.id = 1 and c.enabled
    and coalesce(p.role, 'user') <> 'admin' and not coalesce(p.banned, false)
    and not coalesce(p.affiliate, false)
    and (p.premium_until is null or p.premium_until < now())
    and p.created_at < now() - make_interval(days => c.day1)
    and p.created_at > now() - make_interval(days => c.max_age)
    and not exists (select 1 from public.affiliates a where a.user_id = p.id and a.status in ('pendiente','verificado'))
    -- si ya está hablando con soporte en los últimos 3 días, no le escribimos
    and not exists (select 1 from public.dm_messages m where m.user_id = p.id and not m.from_admin and m.created_at > now() - interval '3 days')
    and (
      coalesce(p.member_reminders, 0) = 0
      or (coalesce(p.member_reminders, 0) = 1 and c.day2 > 0 and p.member_reminded_at < now() - make_interval(days => greatest(c.day2 - c.day1, 3)))
    )
  order by p.created_at
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;
revoke execute on function public.member_reminder_due(int) from public, anon, authenticated;

-- lo corre Supabase todos los días a las 10:20 a. m. (hora Colombia)
create or replace function public.member_reminder_tick() returns int
language plpgsql security definer set search_path = public as $$
declare u uuid; n int := 0;
begin
  for u in select * from public.member_reminder_due(60) loop
    if public.member_reminder_send(u) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.member_reminder_tick() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'recordatorio-miembro';
  perform cron.schedule('recordatorio-miembro', '20 15 * * *', 'select public.member_reminder_tick()');
exception when others then
  raise notice 'No se pudo programar el recordatorio (%). Activa pg_cron y pg_net en Database → Extensions y vuelve a correr este archivo.', sqlerrm;
end $$;

-- admin: ver y cambiar la configuración, y enviar a mano
create or replace function public.admin_reminder_cfg(p_enabled boolean default null, p_day1 int default null, p_day2 int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; due int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  update public.member_reminder_cfg set enabled = coalesce(p_enabled, enabled), day1 = coalesce(p_day1, day1), day2 = coalesce(p_day2, day2) where id = 1;
  select * into c from public.member_reminder_cfg where id = 1;
  select count(*) into due from public.member_reminder_due(200);
  return jsonb_build_object('enabled', c.enabled, 'day1', c.day1, 'day2', c.day2, 'due', due,
    'sent_7d', (select count(*) from public.profiles where member_reminded_at > now() - interval '7 days'),
    'converted', (select count(*) from public.profiles where member_reminders > 0 and coalesce(affiliate, false)));
end $$;
grant execute on function public.admin_reminder_cfg(boolean, int, int) to authenticated;

create or replace function public.admin_reminder_send(p_users uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare u uuid; n int := 0;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  foreach u in array coalesce(p_users, '{}') loop
    if public.member_reminder_send(u) then n := n + 1; end if;
    exit when n >= 100;
  end loop;
  return n;
end $$;
grant execute on function public.admin_reminder_send(uuid[]) to authenticated;

-- ===================== Embudo =====================
-- p_days: registrados en los últimos N días (0 = todos)
drop function if exists public.admin_funnel(int);
create function public.admin_funnel(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare since timestamptz := case when coalesce(p_days, 0) > 0 then now() - make_interval(days => p_days) else '-infinity'::timestamptz end;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  with base as (
    select p.id, p.username, p.country, p.created_at, p.affiliate, p.premium_until, p.plan, p.member_reminders, p.member_reminded_at,
      u.last_sign_in_at, u.email::text as email,
      (exists (select 1 from public.chart_trials t where t.user_id = p.id) or exists (select 1 from public.chart_state s where s.user_id = p.id)
        or exists (select 1 from public.chart_presence c where c.user_id = p.id)) as charts,
      exists (select 1 from public.challenge_entries e where e.user_id = p.id) as retos,
      (select a.status from public.affiliates a where a.user_id = p.id) as aff_status
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p.role, 'user') <> 'admin' and not coalesce(p.banned, false) and p.created_at >= since
  )
  select jsonb_build_object(
    'registrados', (select count(*) from base),
    'activos7', (select count(*) from base where last_sign_in_at > now() - interval '7 days'),
    'charts', (select count(*) from base where charts),
    'retos', (select count(*) from base where retos),
    'pendientes', (select count(*) from base where aff_status = 'pendiente' and not coalesce(affiliate, false)),
    'miembros', (select count(*) from base where coalesce(affiliate, false)),
    'plan', (select count(*) from base where premium_until > now()),
    'sin_verificar', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select id, username, email, country, created_at, last_sign_in_at, charts, retos, aff_status, member_reminders, member_reminded_at
        from base where not coalesce(affiliate, false) and (premium_until is null or premium_until < now()) order by created_at desc limit 300) x), '[]'::jsonb),
    'miembros_sin_plan', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select id, username, email, country, created_at, last_sign_in_at, charts, retos
        from base where coalesce(affiliate, false) and (premium_until is null or premium_until < now()) order by created_at desc limit 300) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;
grant execute on function public.admin_funnel(int) to authenticated;

select 'listo' as estado, (select count(*) from public.member_reminder_due(200)) as recibirian_recordatorio_hoy;
