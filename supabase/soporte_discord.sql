-- =====================================================================
-- Soporte en Discord (tickets)
-- Cuando un alumno escribe en Mensajes de la página, se abre su ticket
-- (hilo privado) en el canal #soporte de Discord. Lo que se escribe en
-- la página se copia al ticket, y lo que se responde en el ticket vuelve
-- al chat de la página. Nada sale en los canales públicos.
-- Necesita discord_afiliados.sql corrido antes. Se puede correr varias veces.
-- =====================================================================

alter table public.dm_threads  add column if not exists dc_thread text;   -- id del hilo en Discord
alter table public.dm_threads  add column if not exists dc_last text;     -- último mensaje de Discord ya copiado a la página
alter table public.dm_messages add column if not exists dc_src boolean not null default false;  -- vino desde Discord (no se reenvía)

-- avisar a la función cuando hay un mensaje nuevo en la página
create or replace function public.soporte_dc_msg() returns trigger
language plpgsql security definer set search_path = public as $$
declare sec text; k text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc'; t text;
begin
  if new.dc_src then return new; end if;
  select dc_thread into t from public.dm_threads where user_id = new.user_id;
  if new.from_admin and t is null then return new; end if;   -- el ticket solo lo abre el alumno
  select cron_secret into sec from public.push_config where id = 1;
  if sec is null then return new; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using 'https://animmecpzvhvnwzjljxg.supabase.co/functions/v1/discord',
            jsonb_build_object('action', 'ticket-msg', 'id', new.id),
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k, 'apikey', k, 'x-cron-secret', sec);
  exception when others then raise notice 'Ticket de Discord no enviado: %', sqlerrm;
  end;
  return new;
end $$;
revoke execute on function public.soporte_dc_msg() from public, anon, authenticated;
drop trigger if exists soporte_dc_msg on public.dm_messages;
create trigger soporte_dc_msg after insert on public.dm_messages
  for each row execute function public.soporte_dc_msg();

-- cada minuto: traer a la página lo que se respondió en los tickets (solo si hay tickets activos)
create or replace function public.soporte_dc_tick() returns void
language plpgsql security definer set search_path = public as $$
declare sec text; k text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc';
begin
  if not exists (select 1 from public.dm_threads where dc_thread is not null and dc_thread <> 'creando' and last_at > now() - interval '7 days') then return; end if;
  select cron_secret into sec from public.push_config where id = 1;
  if sec is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://animmecpzvhvnwzjljxg.supabase.co/functions/v1/discord', '{"action":"ticket-poll"}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k, 'apikey', k, 'x-cron-secret', sec);
end $$;
revoke execute on function public.soporte_dc_tick() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'soporte-discord';
  perform cron.schedule('soporte-discord', '* * * * *', 'select public.soporte_dc_tick()');
exception when others then
  raise notice 'No se pudo programar la revisión de tickets (%). Activa pg_cron y pg_net en Database → Extensions y vuelve a correr este archivo.', sqlerrm;
end $$;
