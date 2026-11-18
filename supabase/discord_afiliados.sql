-- =====================================================================
-- Discord: rol de Afiliado automático
-- El alumno conecta su Discord desde Configuración. Cuando su afiliado
-- queda verificado (o deja de estarlo), la base de datos avisa a la
-- función "discord" y esta le pone o le quita el rol en el servidor.
-- Corre este archivo en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_name text;
alter table public.profiles add column if not exists discord_role boolean not null default false;
create unique index if not exists profiles_discord_id_key on public.profiles(discord_id) where discord_id is not null;

-- aviso a la función cuando cambia el afiliado de alguien que tiene Discord conectado
create or replace function public.discord_aff_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare sec text; k text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc';
begin
  if new.discord_id is null then return new; end if;
  if old.affiliate is not distinct from new.affiliate and old.banned is not distinct from new.banned then return new; end if;
  select cron_secret into sec from public.push_config where id = 1;
  if sec is null then return new; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using 'https://animmecpzvhvnwzjljxg.supabase.co/functions/v1/discord',
            jsonb_build_object('action', 'sync', 'user_id', new.id),
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k, 'apikey', k, 'x-cron-secret', sec);
  exception when others then
    raise notice 'Aviso a Discord no enviado: %', sqlerrm;   -- nunca bloquea la verificación del afiliado
  end;
  return new;
end $$;
revoke execute on function public.discord_aff_changed() from public, anon, authenticated;

drop trigger if exists discord_aff_changed on public.profiles;
create trigger discord_aff_changed after update of affiliate, banned on public.profiles
  for each row execute function public.discord_aff_changed();

-- para el panel de administración: cuántos tienen Discord conectado y cuántos tienen el rol
create or replace function public.admin_discord_stats() returns table(conectados int, con_rol int, afiliados_sin_discord int)
language sql security definer set search_path = public as $$
  select (select count(*) from public.profiles where discord_id is not null)::int,
         (select count(*) from public.profiles where discord_role)::int,
         (select count(*) from public.profiles where affiliate and discord_id is null)::int
  where public.is_admin();
$$;
grant execute on function public.admin_discord_stats() to authenticated;
