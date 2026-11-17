-- =====================================================================
-- EAG Charts: alertas técnicas (cierre de vela, RSI, cruce de medias y spike).
-- Amplía la tabla chart_alerts. Correr una vez en Supabase → SQL Editor (se puede repetir).
-- Después hay que actualizar la función send-push (el código va aparte).
-- =====================================================================
alter table public.chart_alerts drop constraint if exists chart_alerts_kind_check;
alter table public.chart_alerts add constraint chart_alerts_kind_check
  check (kind in ('nivel','zona','cierre','rsi','cruce','spike'));
alter table public.chart_alerts alter column price drop not null;
alter table public.chart_alerts add column if not exists tf int not null default 60;          -- temporalidad en segundos
alter table public.chart_alerts add column if not exists cond text;                          -- arriba/abajo, alcista/bajista
alter table public.chart_alerts add column if not exists params jsonb not null default '{}'::jsonb; -- RSI: n, lv · medias: f, s · spike: min
alter table public.chart_alerts add column if not exists repeat boolean not null default false;    -- avisar cada vez, no solo una

select 'listo' as estado;
