-- ---------- RESEÑA OBLIGATORIA AL TERMINAR UN MÓDULO ----------
-- Al aprobar todas las lecciones de un módulo, el alumno debe dejar su reseña (estrellas, cómo le pareció
-- y qué se puede mejorar) para abrir el módulo siguiente. Solo tú (admin) las ves.
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.

alter table public.modules add column if not exists ask_feedback boolean not null default true;

create table if not exists public.module_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  liked text not null check (char_length(liked) between 3 and 1500),
  improve text not null check (char_length(improve) between 3 and 1500),
  created_at timestamptz not null default now(),
  unique (user_id, module_id)
);
create index if not exists module_feedback_mod_idx on public.module_feedback (module_id, created_at desc);
alter table public.module_feedback enable row level security;

drop policy if exists "reseñas: ver las propias" on public.module_feedback;
create policy "reseñas: ver las propias" on public.module_feedback for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "reseñas: dejar la propia" on public.module_feedback;
create policy "reseñas: dejar la propia" on public.module_feedback for insert
  with check (user_id = auth.uid());
drop policy if exists "reseñas: admin" on public.module_feedback;
create policy "reseñas: admin" on public.module_feedback for all
  using (public.is_admin()) with check (public.is_admin());

-- lista para el admin (con usuario, país y módulo)
drop function if exists public.admin_module_feedback();
create function public.admin_module_feedback() returns table(id uuid, module_id uuid, module_title text, username text, country text,
  premium boolean, rating int, liked text, improve text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select f.id, f.module_id, m.title, p.username, p.country, coalesce(p.premium_until > now(), false),
    f.rating, f.liked, f.improve, f.created_at
  from public.module_feedback f join public.profiles p on p.id = f.user_id join public.modules m on m.id = f.module_id
  order by f.created_at desc limit 1000;
end $$;
grant execute on function public.admin_module_feedback() to authenticated;
