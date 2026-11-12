-- =====================================================================
-- Pagos en el chat privado. Correr DESPUÉS de chat.sql. Se puede correr varias veces.
--  - Cuando un alumno registra un pago, le llega a El Arte Gráfico un mensaje en el chat privado de ese alumno
--    (con el plan, el monto, la orden y su nota). Te llega el aviso al celular igual que cualquier mensaje.
--  - El alumno puede seguir escribiendo en ese mismo chat si el pago se demora.
--  - Cuando apruebas o rechazas el pago, le queda un mensaje tuyo en ese chat con el resultado.
-- =====================================================================

create or replace function public.pago_al_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text; c text;
begin
  if tg_op = 'INSERT' then
    select title into c from public.courses where id = new.course_id;
    txt := '💳 Registré un pago: ' || coalesce('curso ' || c, nullif(new.plan, ''), 'plan')
           || coalesce(' · ' || nullif(new.amount, ''), '') || ' · orden ' || new.order_id
           || coalesce(E'\n' || nullif(trim(new.note), ''), '');
    insert into public.dm_threads (user_id, open) values (new.user_id, true)
      on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body) values (new.user_id, false, left(txt, 1500));
  elsif tg_op = 'UPDATE' and old.status = 'pendiente' and new.status <> 'pendiente' then
    txt := case when new.status = 'aprobado'
      then '✅ Tu pago de la orden ' || new.order_id || ' fue aprobado y ya tienes tu acceso. ¡Bienvenido!'
      else '❌ Tu pago de la orden ' || new.order_id || ' no se pudo confirmar.'
           || coalesce(' Motivo: ' || nullif(trim(new.admin_note), '') || '.', '')
           || ' Escríbeme por aquí y lo revisamos.' end;
    insert into public.dm_threads (user_id, open) values (new.user_id, true)
      on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body, notified) values (new.user_id, true, left(txt, 1500), true);
  end if;
  return new;
exception when others then
  return new;   -- si el chat falla, el pago igual se registra
end $$;

drop trigger if exists pago_al_chat on public.payment_requests;
create trigger pago_al_chat after insert or update of status on public.payment_requests
  for each row execute function public.pago_al_chat();
