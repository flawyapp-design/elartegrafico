-- ---------- PAUSAR LOS PAGOS ----------
-- Cuando en Admin → Pagos pones "Pausar los pagos", nadie puede registrar un pago nuevo (ni desde la web ni a mano).
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.
create or replace function public.payment_requests_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce((select (data->>'paymentsOff')::boolean from public.site_settings where id = 1), false) then
    raise exception 'Los pagos están pausados por ahora. Te avisaremos cuando abran.';
  end if;
  if (select count(*) from public.payment_requests where user_id = new.user_id and status = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por confirmar. Espera a que los revisemos.';
  end if;
  return new;
end $$;
