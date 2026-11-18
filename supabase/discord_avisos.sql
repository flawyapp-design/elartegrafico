-- =====================================================================
-- Avisos también en Discord (webhooks)
-- Lo que hoy llega como notificación al celular (retos, noticias, clases
-- en vivo, avisos) se publica también en los canales de Discord que elijas.
-- Los enlaces de los webhooks quedan guardados donde solo el servidor los ve.
-- Corre este archivo en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

alter table public.push_config add column if not exists dc_general text;   -- canal para todos (#anuncios)
alter table public.push_config add column if not exists dc_miembros text;  -- canal solo Miembros verificados (retos express)
alter table public.push_config add column if not exists dc_premium text;   -- canal para planes (opcional)

-- guardar (solo admin). null = dejarlo como está; texto vacío = quitar ese canal.
create or replace function public.admin_set_discord_hooks(p_general text, p_miembros text, p_premium text) returns void
language plpgsql security definer set search_path = public as $$
declare ok text := '^https://(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$';
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if coalesce(p_general,'') <> '' and p_general !~ ok then raise exception 'El enlace del canal general no es un webhook de Discord'; end if;
  if coalesce(p_miembros,'') <> '' and p_miembros !~ ok then raise exception 'El enlace del canal de miembros no es un webhook de Discord'; end if;
  if coalesce(p_premium,'') <> '' and p_premium !~ ok then raise exception 'El enlace del canal premium no es un webhook de Discord'; end if;
  update public.push_config set
    dc_general  = case when p_general  is null then dc_general  else nullif(trim(p_general), '')  end,
    dc_miembros = case when p_miembros is null then dc_miembros else nullif(trim(p_miembros), '') end,
    dc_premium  = case when p_premium  is null then dc_premium  else nullif(trim(p_premium), '')  end
  where id = 1;
  if not found then raise exception 'Primero activa las notificaciones (Admin → Notificaciones)'; end if;
end $$;
grant execute on function public.admin_set_discord_hooks(text, text, text) to authenticated;

-- ver cuáles están puestos (solo admin; no devuelve el enlace completo)
create or replace function public.admin_discord_hooks() returns table(general boolean, miembros boolean, premium boolean, general_tail text, miembros_tail text, premium_tail text)
language sql security definer set search_path = public as $$
  select dc_general is not null, dc_miembros is not null, dc_premium is not null,
         right(dc_general, 6), right(dc_miembros, 6), right(dc_premium, 6)
  from public.push_config where id = 1 and public.is_admin();
$$;
grant execute on function public.admin_discord_hooks() to authenticated;
