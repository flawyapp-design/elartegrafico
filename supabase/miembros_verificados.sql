-- =====================================================================
-- Miembros verificados (antes "afiliados")
-- 1) Los retos express (premios en dólares) son solo para miembros verificados.
-- 2) Cualquier alumno puede abrir el chat contigo para hacerse miembro:
--    le llega una respuesta automática con tu enlace de Deriv y los pasos.
-- Corre este archivo en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

-- 1) retos express solo para miembros verificados (se puede apagar en Admin → Retos)
create or replace function public.express_solo_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.challenges; cfg jsonb := public.rewards_cfg(); m boolean;
begin
  select * into c from public.challenges where id = new.challenge_id;
  if c.express and coalesce((cfg->>'expressOnlyMembers')::boolean, true) then
    select affiliate into m from public.profiles where id = new.user_id;
    if not coalesce(m, false) then
      raise exception 'Los retos express son solo para miembros verificados de la comunidad';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists express_solo_miembros on public.challenge_entries;
create trigger express_solo_miembros before insert on public.challenge_entries
  for each row execute function public.express_solo_miembros();

-- 2) "Quiero ser miembro verificado": abre la conversación y responde solo con los pasos
create or replace function public.dm_member_start() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); p public.profiles; link text; reply text; n int;
begin
  if u is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.profiles where id = u;
  if p.banned then raise exception 'Tu cuenta está suspendida'; end if;
  if p.affiliate then raise exception 'Ya eres miembro verificado de la comunidad'; end if;
  select count(*) into n from public.dm_messages where user_id = u and not from_admin and created_at > now() - interval '10 minutes';
  if n >= 3 then return jsonb_build_object('ok', true, 'repeat', true); end if;

  insert into public.dm_threads (user_id, open, topic) values (u, true, 'Miembro verificado')
  on conflict (user_id) do update set open = true, last_at = now(), topic = 'Miembro verificado';

  insert into public.dm_messages (user_id, from_admin, body, notified)
  values (u, false, 'Hola, quiero ser miembro verificado de la comunidad.', false);

  if not exists (select 1 from public.dm_messages where user_id = u and from_admin and body like '¡Qué bueno que quieras ser parte%' and created_at > now() - interval '1 day') then
    select nullif(trim(data->>'derivRefUrl'), '') into link from public.site_settings where id = 1;
    reply := '¡Qué bueno que quieras ser parte de la comunidad! Así te haces miembro verificado:' || chr(10) || chr(10)
      || '🆕 SI NO TIENES CUENTA DE DERIV' || chr(10)
      || '1. Ábrela con el enlace de la comunidad: ' || coalesce(link, 'https://t.deriv.link/?t=ZX9736UCRTEQ') || chr(10)
      || '2. Copia tu ID de cliente (está arriba a la derecha en Deriv) y pégalo en el recuadro de arriba de este chat. Se verifica solo.' || chr(10) || chr(10)
      || '🔁 SI YA TIENES CUENTA DE DERIV (no te registres otra vez)' || chr(10)
      || '1. Entra a Deriv y abre el Live Chat de soporte.' || chr(10)
      || '2. Pide el cambio de afiliado/IB (retagging). Puedes escribir: "Hola, quiero solicitar el cambio de afiliado/IB de mi cuenta de Deriv. Quiero asociar mi cuenta al siguiente Partner: ' || coalesce(link, 'https://t.deriv.link/?t=ZX9736UCRTEQ') || '"' || chr(10)
      || '3. Si te piden el enlace del nuevo afiliado, envíaselo (es el mismo de arriba).' || chr(10)
      || '4. Espera la confirmación de Deriv y luego pega tu ID en el recuadro de arriba.' || chr(10) || chr(10)
      || 'Con eso nos ayudas a crecer y desbloqueas: retos express con premios en dólares, puntos completos en todos los retos, funciones extra de EAG Charts y el rol de Miembro verificado en Discord.' || chr(10) || chr(10)
      || 'Cualquier duda, escríbenos aquí.';
    insert into public.dm_messages (user_id, from_admin, body, notified) values (u, true, reply, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.dm_member_start() from public, anon;
grant execute on function public.dm_member_start() to authenticated;
