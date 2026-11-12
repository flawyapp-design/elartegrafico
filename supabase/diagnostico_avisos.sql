-- =====================================================================
-- Diagnóstico de las notificaciones de los retos. Solo LEE, no cambia nada.
-- Córrelo y mándame una captura de la tabla que sale.
-- =====================================================================
create temp table if not exists _diag (n int, revision text, resultado text);
truncate _diag;
do $$
declare r record; t text;
begin
  -- 1) extensiones
  insert into _diag select 1, 'Extensión pg_cron', coalesce((select 'activa ' || extversion from pg_extension where extname = 'pg_cron'), '❌ NO activa');
  insert into _diag select 2, 'Extensión pg_net', coalesce((select 'activa ' || extversion from pg_extension where extname = 'pg_net'), '❌ NO activa');
  -- 2) clave de los avisos
  insert into _diag select 3, 'Clave cron_secret en push_config',
    case when (select cron_secret from public.push_config where id = 1) is null then '❌ vacía (sin esto no se envía nada)' else 'ok' end;
  insert into _diag select 4, 'Celulares suscritos a notificaciones', (select count(*)::text from public.push_subs);
  -- 3) tarea programada y sus últimas ejecuciones
  begin
    execute $q$select coalesce(string_agg(jobname || ' · ' || schedule || ' · ' || case when active then 'activa' else '❌ apagada' end, ' | '), '❌ no existe')
               from cron.job where jobname = 'retos-avisos'$q$ into t;
    insert into _diag values (5, 'Tarea retos-avisos', t);
    execute $q$select coalesce(string_agg(to_char(d.start_time at time zone 'America/Bogota', 'DD/MM HH24:MI') || ' ' || d.status || coalesce(' · ' || left(d.return_message, 120), ''), ' | ' order by d.start_time desc), 'sin ejecuciones')
               from (select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'retos-avisos')
                     order by start_time desc limit 3) d$q$ into t;
    insert into _diag values (6, 'Últimas 3 ejecuciones', t);
    execute $q$select count(*)::text from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'retos-avisos')
               and status <> 'succeeded' and start_time > now() - interval '24 hours'$q$ into t;
    insert into _diag values (7, 'Ejecuciones con error (24 h)', t);
  exception when others then insert into _diag values (5, 'Tarea programada', '❌ ' || sqlerrm);
  end;
  -- 4) respuestas de la función send-push (pg_net)
  begin
    execute $q$select coalesce(string_agg(to_char(created at time zone 'America/Bogota', 'DD/MM HH24:MI') || ' · ' || coalesce(status_code::text, 'sin respuesta')
                 || coalesce(' · ' || left(coalesce(error_msg, content::text), 140), ''), ' | ' order by created desc), 'sin llamadas')
               from (select * from net._http_response order by created desc limit 4) x$q$ into t;
    insert into _diag values (8, 'Últimas respuestas de send-push', t);
  exception when others then insert into _diag values (8, 'Respuestas de send-push', '❌ ' || sqlerrm);
  end;
  -- 5) retos de hoy
  for r in select c.title, c.status, c.notify, c.express, c.starts_at, c.notified_at, c.results_notified_at,
                  public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) cierre
           from public.challenges c where c.starts_at > now() - interval '30 hours' order by c.starts_at loop
    insert into _diag values (9, 'Reto: ' || r.title,
      r.status || ' · avisar: ' || case when r.notify then 'sí' else '❌ NO' end
      || ' · sale ' || to_char(r.starts_at at time zone 'America/Bogota', 'DD/MM HH24:MI')
      || ' · cierra ' || to_char(r.cierre at time zone 'America/Bogota', 'DD/MM HH24:MI')
      || ' · aviso publicado: ' || coalesce(to_char(r.notified_at at time zone 'America/Bogota', 'HH24:MI'), 'NO')
      || ' · aviso resultados: ' || coalesce(to_char(r.results_notified_at at time zone 'America/Bogota', 'HH24:MI'), 'no'));
  end loop;
  -- 6) ¿la revisión de cada minuto funciona?
  begin
    insert into _diag select 10, 'Prueba de reto_push_due()', case when public.reto_push_due() then 'hay avisos pendientes ahora' else 'ok (nada pendiente)' end;
  exception when others then insert into _diag values (10, 'Prueba de reto_push_due()', '❌ ' || sqlerrm);
  end;
end $$;
select revision, resultado from _diag order by n, revision;
