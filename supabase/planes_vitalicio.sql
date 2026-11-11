-- =====================================================================
-- Diamond VITALICIO. Correr después de planes_diamond.sql. Se puede correr varias veces.
--  - El plan Diamond (100 USDT) pasa a ser de por vida: en Admin → Sitio → Planes queda
--    con "vitalicio" en los días (por dentro son 36500 días).
--  - Permite aprobar pagos de planes vitalicios.
-- =====================================================================

-- los pagos aceptan planes vitalicios
alter table public.payment_requests drop constraint if exists payment_requests_days_check;
alter table public.payment_requests add constraint payment_requests_days_check check (days between 1 and 36500);

-- el plan Diamond de la página de precios queda vitalicio
update public.site_settings s set data = jsonb_set(s.data, '{plans}', (
    select jsonb_agg(case when lower(coalesce(x->>'tier','')) = 'diamond' or (x->>'price') ~ '^\s*100(\D|$)'
      then x || '{"tier":"diamond","days":36500}'::jsonb else x end order by o)
    from jsonb_array_elements(s.data->'plans') with ordinality t(x, o)))
where s.id = 1 and jsonb_typeof(s.data->'plans') = 'array' and jsonb_array_length(s.data->'plans') > 0;

-- quien ya tenga Diamond queda de por vida
update public.profiles set premium_until = now() + interval '36500 days'
where plan = 'diamond' and premium_until > now() and premium_until < now() + interval '30 years';

-- aprobar pagos (igual que antes, pero acepta hasta 36500 días)
drop function if exists public.review_payment(uuid, boolean, int, text);
create function public.review_payment(pid uuid, approve boolean, p_days int default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; d int; hasta timestamptz; cur public.profiles; np text;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into r from public.payment_requests where id = pid for update;
  if not found then raise exception 'El pago no existe'; end if;
  if r.status <> 'pendiente' then raise exception 'Este pago ya fue revisado'; end if;
  if approve and r.course_id is not null then
    insert into public.user_courses (user_id, course_id, source) values (r.user_id, r.course_id, 'pago') on conflict do nothing;
    update public.payment_requests set status = 'aprobado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'aprobado', 'course_id', r.course_id);
  elsif approve then
    d := coalesce(p_days, r.days);
    if d < 1 or d > 36500 then raise exception 'Días no válidos'; end if;
    select * into cur from public.profiles where id = r.user_id;
    -- la placa sale del plan elegido (Admin → Sitio → Planes); si no tiene, de los días
    np := coalesce((select nullif(lower(x->>'tier'), '') from public.site_settings st, jsonb_array_elements(coalesce(st.data->'plans', '[]'::jsonb)) x
                    where st.id = 1 and x->>'name' = r.plan and lower(x->>'tier') in ('cobre','plata','oro','diamond') limit 1), public.plan_of_days(d));
    -- si ya tiene un plan mayor y sigue activo, se queda con el mayor
    if cur.premium_until is not null and cur.premium_until > now() and public.plan_num(cur.plan) > public.plan_num(np) then np := cur.plan; end if;
    update public.profiles
       set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => d), plan = np
     where id = r.user_id returning premium_until into hasta;
    update public.payment_requests set status = 'aprobado', days = d, admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'aprobado', 'premium_until', hasta, 'plan', np);
  else
    update public.payment_requests set status = 'rechazado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'rechazado');
  end if;
end $$;
grant execute on function public.review_payment(uuid, boolean, int, text) to authenticated;

-- revisión: así quedan tus planes
select x->>'name' as plan, x->>'days' as dias, x->>'price' as precio, x->>'tier' as placa
from public.site_settings, jsonb_array_elements(data->'plans') x where id = 1;
