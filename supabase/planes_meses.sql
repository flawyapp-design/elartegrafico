-- =====================================================================
-- Planes por meses (1 / 3 / 6 / 12). Se puede correr varias veces.
-- Arregla: al aprobar un pago de "Oro · 6 meses" (planes que la página arma sola con descuento)
-- el alumno quedaba con la placa según los días (6 meses = Plata, 3 meses = Cobre) y no con el plan que pagó.
-- Ahora la placa sale del nombre del plan: "Oro · 6 meses" → Oro por 180 días.
-- =====================================================================

create or replace function public.review_payment(pid uuid, approve boolean, p_days int default null, p_note text default '')
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
    -- 1) nombre exacto de un plan de Admin → Sitio → Planes
    -- 2) planes de 3/6/12 meses que arma la página sola ("Oro · 6 meses"): se toma el plan base ("Oro")
    -- 3) el nombre empieza por la placa (cobre/plata/oro/diamond)
    -- 4) último recurso: por los días
    np := coalesce(
      (select nullif(lower(x->>'tier'), '') from public.site_settings st, jsonb_array_elements(coalesce(st.data->'plans', '[]'::jsonb)) x
        where st.id = 1 and x->>'name' = r.plan and lower(x->>'tier') in ('cobre','plata','oro','diamond') limit 1),
      (select nullif(lower(x->>'tier'), '') from public.site_settings st, jsonb_array_elements(coalesce(st.data->'plans', '[]'::jsonb)) x
        where st.id = 1 and lower(x->>'tier') in ('cobre','plata','oro','diamond')
          and lower(trim(r.plan)) like lower(trim(regexp_replace(x->>'name', '\s*·.*$', ''))) || ' ·%' limit 1),
      case when lower(trim(r.plan)) like 'diamond%' then 'diamond' when lower(trim(r.plan)) like 'oro%' then 'oro'
           when lower(trim(r.plan)) like 'plata%' then 'plata' when lower(trim(r.plan)) like 'cobre%' then 'cobre' end,
      public.plan_of_days(d));
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

-- revisión: pagos de planes por meses ya aprobados y la placa que tiene hoy cada alumno
-- (si alguno quedó con una placa menor a la que pagó, cámbiala en Admin → Usuarios)
select r.created_at::date as fecha, p.username, r.plan as pago, p.plan as placa_actual, p.premium_until::date as hasta
from public.payment_requests r join public.profiles p on p.id = r.user_id
where r.status = 'aprobado' and r.plan ilike '%·%meses%'
order by r.created_at desc;
