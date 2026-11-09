-- Límite de intentos para ingresar con nombre de usuario: máximo 8 intentos fallidos cada 15 minutos por usuario.
create table if not exists public.login_attempts (id bigserial primary key, uname text not null, ok boolean not null, at timestamptz not null default now());
create index if not exists login_attempts_u on public.login_attempts (lower(uname), at desc);
alter table public.login_attempts enable row level security;   -- nadie la lee desde la web

create or replace function public.login_email(u text, pw text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare e text; h text; fails int;
begin
  select count(*) into fails from public.login_attempts
   where lower(uname) = lower(trim(u)) and not ok and at > now() - interval '15 minutes';
  if fails >= 8 then raise exception 'Demasiados intentos. Espera 15 minutos o ingresa con tu correo.'; end if;
  select au.email, au.encrypted_password into e, h
    from auth.users au join public.profiles p on p.id = au.id
   where lower(p.username) = lower(trim(u)) limit 1;
  if e is not null and h is not null and extensions.crypt(pw, h) = h then
    insert into public.login_attempts(uname, ok) values (trim(u), true);
    return e;
  end if;
  insert into public.login_attempts(uname, ok) values (trim(u), false);
  delete from public.login_attempts where at < now() - interval '2 days';
  return null;
end $$;
revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;
