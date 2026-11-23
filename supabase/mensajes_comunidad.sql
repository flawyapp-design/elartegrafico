-- Mensajes de Miembro verificado con el enfoque de comunidad (sin "afiliado" ni "partner"):
-- vincular la cuenta de Deriv a El Arte Gráfico para que Deriv, como broker, sepa que eres de la comunidad
-- y tengas respaldo: ayuda con depósitos y retiros, y soporte con tu cuenta.

-- 1) Respuesta automática del chat "Quiero ser miembro"
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
    link := coalesce(link, 'https://t.deriv.link/?t=ZX9736UCRTEQ');
    reply := '¡Qué bueno que quieras ser parte de la comunidad! 🙌' || chr(10) || chr(10)
      || 'Ser miembro verificado es vincular tu cuenta de Deriv a El Arte Gráfico. Así Deriv, como broker, sabe que eres parte de nuestra comunidad y tú tienes nuestro respaldo: te ayudamos con depósitos y retiros y te damos soporte con tu cuenta. Es gratis y tus condiciones en Deriv no cambian.' || chr(10) || chr(10)
      || '🆕 SI NO TIENES CUENTA DE DERIV' || chr(10)
      || '1. Ábrela con el enlace de la comunidad: ' || link || chr(10)
      || '2. Copia tu ID de cliente (está arriba a la derecha en Deriv) y pégalo en el recuadro de arriba de este chat. Se verifica solo.' || chr(10) || chr(10)
      || '🔁 SI YA TIENES CUENTA DE DERIV (no te registres otra vez)' || chr(10)
      || '1. Entra a Deriv y abre el Live Chat de soporte.' || chr(10)
      || '2. Pide que vinculen tu cuenta a la comunidad. Puedes escribir: "Hola, soy parte de la comunidad El Arte Gráfico y quiero que mi cuenta de Deriv quede vinculada a ella (cambio de IB / retagging). Este es el enlace de la comunidad: ' || link || '"' || chr(10)
      || '3. Si te piden el enlace, envíaselo (es el mismo de arriba).' || chr(10)
      || '4. Espera la confirmación de Deriv y luego pega tu ID en el recuadro de arriba.' || chr(10) || chr(10)
      || 'Además desbloqueas: retos express con premios en dólares, puntos completos en todos los retos, funciones extra de EAG Charts y el rol de Miembro verificado en Discord.' || chr(10) || chr(10)
      || 'Cualquier duda, escríbenos aquí.';
    insert into public.dm_messages (user_id, from_admin, body, notified) values (u, true, reply, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.dm_member_start() from public, anon;
grant execute on function public.dm_member_start() to authenticated;

-- 2) Recordatorio automático (embudo)
create or replace function public.member_reminder_text(p_name text, p_second boolean)
returns text language plpgsql stable security definer set search_path = public as $$
declare link text;
begin
  select nullif(trim(data->>'derivRefUrl'), '') into link from public.site_settings where id = 1;
  link := coalesce(link, 'https://t.deriv.link/?t=ZX9736UCRTEQ');
  return (case when p_second then '¡Hola ' || coalesce(nullif(p_name,''),'') || '! Te escribimos de nuevo porque todavía no eres Miembro verificado de El Arte Gráfico 🙌'
               else '¡Hola ' || coalesce(nullif(p_name,''),'') || '! Bienvenido a El Arte Gráfico 👋 Te contamos cómo hacerte Miembro verificado (es gratis):' end) || chr(10) || chr(10)
    || '🤝 Vinculas tu cuenta de Deriv a la comunidad: así Deriv, como broker, sabe que eres de El Arte Gráfico y tú tienes nuestro respaldo con depósitos, retiros y soporte. Tus condiciones en Deriv no cambian.' || chr(10) || chr(10)
    || '✅ Además desbloqueas: retos express con premios en dólares, puntos completos en todos los retos, funciones extra de EAG Charts y el rol de Miembro verificado en Discord.' || chr(10) || chr(10)
    || '🆕 SI NO TIENES CUENTA DE DERIV' || chr(10)
    || '1. Ábrela con el enlace de la comunidad: ' || link || chr(10)
    || '2. Copia tu ID de cliente (arriba a la derecha en Deriv) y pégalo en la página de Miembro verificado. Se verifica solo.' || chr(10) || chr(10)
    || '🔁 SI YA TIENES CUENTA DE DERIV (no te registres otra vez)' || chr(10)
    || '1. Entra a Deriv y abre el Live Chat de soporte.' || chr(10)
    || '2. Pide que vinculen tu cuenta a la comunidad: "Hola, soy parte de la comunidad El Arte Gráfico y quiero que mi cuenta de Deriv quede vinculada a ella (cambio de IB / retagging). Este es el enlace de la comunidad: ' || link || '"' || chr(10)
    || '3. Cuando Deriv te confirme, pega tu ID en la página de Miembro verificado.' || chr(10) || chr(10)
    || '👉 https://elartegrafico.com/#miembro' || chr(10)
    || 'Cualquier duda, respóndenos aquí mismo.';
end $$;
revoke execute on function public.member_reminder_text(text, boolean) from public, anon, authenticated;
