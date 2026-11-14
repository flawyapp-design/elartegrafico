-- =====================================================================
-- Pagos con Airtm y Bre-B (Colombia), además de Binance Pay. Se puede correr varias veces.
-- =====================================================================

-- los pagos aceptan los nuevos medios
alter table public.payment_requests drop constraint if exists payment_requests_method_check;
alter table public.payment_requests add constraint payment_requests_method_check
  check (method in ('binance','airtm','breb','otro'));

-- tus datos para recibir (se pueden cambiar luego en Admin → Sitio → Otros medios de pago)
update public.site_settings
set data = coalesce(data, '{}'::jsonb) || '{"airtmUser":"nikoflip","brebKey":"nikoflip.a@gmail.com"}'::jsonb,
    updated_at = now()
where id = 1;

-- revisión
select data->>'binancePayId' as binance, data->>'airtmUser' as airtm, data->>'brebKey' as llave_breb, data->>'copRate' as tasa_cop
from public.site_settings where id = 1;
