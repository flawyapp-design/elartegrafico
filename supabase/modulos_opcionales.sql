-- Módulos opcionales: el alumno puede saltarlos y no bloquean los módulos siguientes.
-- Pégalo en Supabase → SQL Editor → Run.
alter table public.modules add column if not exists optional boolean not null default false;
alter table public.modules add column if not exists optional_note text not null default '';

-- «La plataforma: Deriv y MT5» queda opcional
update public.modules
   set optional = true,
       optional_note = 'Si ya tienes cuenta en Deriv y sabes usar MT5, puedes saltarlo. No es necesario para abrir los módulos siguientes.'
 where title = 'La plataforma: Deriv y MT5';

select title, optional, sort from public.modules order by sort;
