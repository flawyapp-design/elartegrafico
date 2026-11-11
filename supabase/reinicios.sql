-- ---------- REINICIAR PUNTOS Y AVANCE DE LOS ALUMNOS (solo admin) ----------
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.
-- Cada reinicio sube la "versión" del progreso (rv). Si un alumno tenía la página abierta,
-- su navegador ya no puede volver a subir los datos viejos: el servidor los ignora.

create or replace function public.progress_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if coalesce((new.data->>'rv')::int, 0) < coalesce((old.data->>'rv')::int, 0) then
    return null;            -- datos de antes del reinicio: se ignoran
  end if;
  return new;
end $$;
drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before update on public.progress
  for each row execute function public.progress_guard();

-- p_user: un alumno (o null = TODOS)
-- p_what: 'puntos' (solo puntos, deja las lecciones aprobadas) | 'todo' (lecciones, módulos, puntos, logros, práctica)
-- p_feedback: también borra sus reseñas de módulos · p_demo: también reinicia sus 5 gráficas de prueba gratis
drop function if exists public.admin_reset_progress(uuid, text, boolean, boolean);
create function public.admin_reset_progress(p_user uuid, p_what text, p_feedback boolean default false, p_demo boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if p_what not in ('puntos','todo') then raise exception 'Opción no válida'; end if;
  if p_what = 'puntos' then
    update public.progress g
       set xp = 0,
           data = g.data || jsonb_build_object('xp', 0, 'rv', coalesce((g.data->>'rv')::int, 0) + 1, 'px', '[]'::jsonb),
           updated_at = now()
     where p_user is null or g.user_id = p_user;
  else
    update public.progress g
       set xp = 0, data = jsonb_build_object('rv', coalesce((g.data->>'rv')::int, 0) + 1), updated_at = now()
     where p_user is null or g.user_id = p_user;
  end if;
  get diagnostics n = row_count;
  if p_feedback and to_regclass('public.module_feedback') is not null then
    execute 'delete from public.module_feedback where $1 is null or user_id = $1' using p_user;
  end if;
  if p_demo then
    update public.profiles set demo_used = 0 where p_user is null or id = p_user;
  end if;
  return n;
end $$;
grant execute on function public.admin_reset_progress(uuid, text, boolean, boolean) to authenticated;
