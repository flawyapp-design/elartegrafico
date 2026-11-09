-- Ingresar con nombre de usuario o correo.
-- Devuelve el correo de la cuenta SOLO si la contraseña es correcta (así no se pueden averiguar correos ajenos).
create extension if not exists pgcrypto with schema extensions;
create or replace function public.login_email(u text, pw text) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare e text; h text;
begin
  select au.email, au.encrypted_password into e, h
    from auth.users au join public.profiles p on p.id = au.id
   where lower(p.username) = lower(trim(u)) limit 1;
  if e is null or h is null then return null; end if;
  if extensions.crypt(pw, h) = h then return e; end if;
  return null;
end $$;
revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;
