-- =====================================================================
-- EAG Charts: quien compró un curso (sin plan) tiene 7 días de prueba de los charts.
-- Los demás registrados siguen con 3 días (o los que pongas en chartTrialDays).
-- Correr en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================
create or replace function public.chart_trial()
returns table(started_at timestamptz, ends_at timestamptz, has_feedback boolean)
language plpgsql volatile security definer set search_path = public as $$
declare d int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select coalesce((data->>'chartTrialDays')::int, 3) into d from public.site_settings where id = 1;
  d := coalesce(d, 3);
  if exists (select 1 from public.user_courses uc where uc.user_id = auth.uid()) then
    d := greatest(d, coalesce((select (data->>'chartCourseTrialDays')::int from public.site_settings where id = 1), 7));
  end if;
  insert into public.chart_trials(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query select t.started_at, t.started_at + make_interval(days => d), t.feedback_at is not null
    from public.chart_trials t where t.user_id = auth.uid();
end $$;
grant execute on function public.chart_trial() to authenticated;
select 'listo' as estado;
