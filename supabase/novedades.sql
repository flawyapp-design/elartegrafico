-- =====================================================================
-- Novedades: panel de atención, certificados, lanzamiento con contador y práctica sin cuenta.
-- Correr DESPUÉS de planes_vitalicio.sql. Se puede correr varias veces.
-- =====================================================================

-- ---------- 1) Panel "qué necesita mi atención" ----------
create or replace function public.admin_attention() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '{}'::jsonb; t boolean;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  r := r || jsonb_build_object('payments', (select count(*) from public.payment_requests where status = 'pendiente'));
  r := r || jsonb_build_object('affiliates', (select count(*) from public.affiliates where status = 'pendiente'));
  r := r || jsonb_build_object('affiliates_old', (select count(*) from public.affiliates a join public.partner_clients c on c.deriv_id = upper(a.deriv_id) where a.status = 'pendiente' and c.tier = 'antiguo'));
  r := r || jsonb_build_object('redemptions', (select count(*) from public.redemptions where status = 'pendiente'));
  r := r || jsonb_build_object('reviews', (select count(*) from public.reviews where not approved));
  begin r := r || jsonb_build_object('dms', (select count(*) from public.dm_messages where not from_admin and read_at is null)); exception when undefined_table then null; end;
  begin r := r || jsonb_build_object('reports', (select count(distinct message_id) from public.room_reports)); exception when undefined_table then null; end;
  -- retos: ¿hay reto en juego y programado para las próximas 24 h?
  r := r || jsonb_build_object(
    'reto_live', exists (select 1 from public.challenges c where c.status = 'publicado' and c.starts_at <= now() and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) > now()),
    'reto_next', (select min(starts_at) from public.challenges where status = 'publicado' and starts_at > now()),
    'reto_drafts', (select count(*) from public.challenges where status <> 'publicado'),
    'retos_on', coalesce((public.rewards_cfg()->>'enabled')::boolean, false));
  -- planes que vencen en los próximos 7 días
  r := r || jsonb_build_object('expiring', (select count(*) from public.profiles where premium_until between now() and now() + interval '7 days'));
  return r;
end $$;
grant execute on function public.admin_attention() to authenticated;

-- ---------- 2) Certificados ----------
create table if not exists public.certificates (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  username text not null,
  course_title text not null,
  lessons int not null default 0,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table public.certificates enable row level security;
drop policy if exists "certificados: propios" on public.certificates;
create policy "certificados: propios" on public.certificates for select using (user_id = auth.uid() or public.is_admin());

-- emitir (o devolver) mi certificado de un curso: solo si aprobé todas sus lecciones publicadas
create or replace function public.claim_certificate(p_course uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.courses; g public.progress; total int; passed int; cert public.certificates; nm text; v_code text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into cert from public.certificates where user_id = auth.uid() and course_id = p_course;
  if found then return to_jsonb(cert) - 'user_id'; end if;
  select * into c from public.courses where id = p_course;
  if not found then raise exception 'Ese curso no existe'; end if;
  select * into g from public.progress where user_id = auth.uid();
  select count(*), count(*) filter (where coalesce((g.data->'done'->(l.id::text)->>'passed')::boolean, false))
    into total, passed
    from public.lessons l join public.modules m on m.id = l.module_id
    where m.course_id = p_course and l.status = 'publicado' and m.status = 'publicado';
  if total = 0 or passed < total then raise exception 'Aún te faltan % lecciones de este curso', greatest(total - passed, 1); end if;
  select username into nm from public.profiles where id = auth.uid();
  loop
    v_code := 'EAG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.certificates x where x.code = v_code);
  end loop;
  insert into public.certificates (code, user_id, course_id, username, course_title, lessons)
  values (v_code, auth.uid(), p_course, nm, c.title, total) returning * into cert;
  return to_jsonb(cert) - 'user_id';
end $$;
grant execute on function public.claim_certificate(uuid) to authenticated;

-- mis certificados
create or replace function public.my_certificates() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(c) - 'user_id' order by c.issued_at), '[]'::jsonb) from public.certificates c where c.user_id = auth.uid() $$;
grant execute on function public.my_certificates() to authenticated;

-- verificación pública (cualquiera con el código)
create or replace function public.verify_certificate(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', c.code, 'username', c.username, 'course_title', c.course_title, 'lessons', c.lessons, 'issued_at', c.issued_at,
    'avatar_url', p.avatar_url, 'country', p.country, 'color', co.color, 'icon', co.icon)
  from public.certificates c join public.profiles p on p.id = c.user_id left join public.courses co on co.id = c.course_id
  where c.code = upper(trim(coalesce(p_code, ''))) and not p.banned $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------- 3) Lanzamiento de la academia con contador ----------
-- Admin → Sitio guarda academyOpenAt (fecha y hora de apertura). A esa hora, la revisión de cada
-- minuto abre la academia sola, arranca la prueba gratis de 7 días y avisa a todos.
create or replace function public.launch_due() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'academyClosed')::boolean and (data->>'academyOpenAt') is not null
    and (data->>'academyOpenAt')::timestamptz <= now() from public.site_settings where id = 1), false) $$;
revoke execute on function public.launch_due() from public, anon, authenticated;

create or replace function public.launch_claim() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.launch_due() then return false; end if;
  update public.site_settings set data = data || jsonb_build_object('academyClosed', false, 'trialFrom', now(), 'launchedAt', now()) where id = 1;
  return true;
end $$;
revoke execute on function public.launch_claim() from public, anon, authenticated;
grant execute on function public.launch_claim() to service_role;

create or replace function public.reto_push_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now())
      or exists (select 1 from public.challenges c where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now())
      or exists (select 1 from public.dm_messages m where not m.from_admin and not m.notified)
      or exists (select 1 from public.room_messages r where r.created_at < now() - make_interval(days => greatest(1, public.room_cfg('roomDays', 7))))
      or public.launch_due()
$$;
revoke execute on function public.reto_push_due() from public, anon, authenticated;

-- ---------- 4) Práctica sin cuenta ----------
-- En Admin → Ejercicios marcas uno como "Pruébalo sin cuenta". Si no hay ninguno, se usa la
-- primera gráfica de prueba gratis.
alter table public.exercises add column if not exists free_try boolean not null default false;

create or replace function public.try_exercise() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(e) from public.exercises e
  where e.free_try or (e.is_demo and e.kind in ('grafica', 'no-operar') and not exists (select 1 from public.exercises x where x.free_try))
  order by e.free_try desc, e.sort limit 1 $$;
grant execute on function public.try_exercise() to anon, authenticated;

create or replace function public.try_grade(ex uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.exercise_answers; t jsonb := public.try_exercise();
begin
  if t is null or (t->>'id')::uuid <> ex then return jsonb_build_object('error', 'no_existe'); end if;
  select * into a from public.exercise_answers where exercise_id = ex;
  return jsonb_build_object('zone', a.zone, 'sl', a.sl, 'answer', coalesce(a.answer, '{}'::jsonb), 'explain', coalesce(a.explain, ''));
end $$;
grant execute on function public.try_grade(uuid) to anon, authenticated;
