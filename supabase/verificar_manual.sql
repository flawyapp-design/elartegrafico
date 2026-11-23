-- Admin: hacer (o quitar) Miembro verificado a cualquier alumno desde Mensajes, aunque no haya enviado la solicitud.
create or replace function public.admin_member_get(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.affiliates; m boolean;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select affiliate into m from public.profiles where id = p_user;
  select * into a from public.affiliates where user_id = p_user;
  return jsonb_build_object('member', coalesce(m, false), 'status', a.status, 'deriv_id', a.deriv_id, 'note', a.admin_note);
end $$;
revoke execute on function public.admin_member_get(uuid) from public, anon;
grant execute on function public.admin_member_get(uuid) to authenticated;

create or replace function public.admin_member_set(p_user uuid, p_on boolean, p_deriv text default null, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare d text := nullif(upper(regexp_replace(coalesce(p_deriv, ''), '\s', '', 'g')), '');
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Ese alumno no existe'; end if;
  if d is not null and char_length(d) not between 3 and 40 then raise exception 'El ID de Deriv no es válido'; end if;
  if p_on then
    insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
    values (p_user, coalesce(d, 'MANUAL'), 'verificado', left(coalesce(nullif(p_note, ''), 'Verificado a mano por el admin'), 300), now(), now())
    on conflict (user_id) do update set deriv_id = coalesce(d, public.affiliates.deriv_id), status = 'verificado',
      admin_note = left(coalesce(nullif(p_note, ''), 'Verificado a mano por el admin'), 300), reviewed_at = now();
  else
    update public.affiliates set status = 'rechazado', admin_note = left(coalesce(nullif(p_note, ''), 'Verificación quitada por el admin'), 300), reviewed_at = now()
    where user_id = p_user;
  end if;
  update public.profiles set affiliate = p_on where id = p_user;
  return public.admin_member_get(p_user);
end $$;
revoke execute on function public.admin_member_set(uuid, boolean, text, text) from public, anon;
grant execute on function public.admin_member_set(uuid, boolean, text, text) to authenticated;
