-- =====================================================================
-- Admin: sumar o quitar SALDO (USD) a mano. Correr DESPUÉS de retos_express.sql. Se puede correr varias veces.
--  - Para premios de lives, sorteos, correcciones, etc. Queda registrado con el motivo.
--  - Al alumno le llega un mensaje en Mensajes avisándole.
-- =====================================================================
create table if not exists public.usd_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usd numeric(10,2) not null check (usd <> 0),
  motivo text not null default '' check (char_length(motivo) <= 120),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.usd_adjustments enable row level security;
drop policy if exists "ajustes usd: ver" on public.usd_adjustments;
create policy "ajustes usd: ver" on public.usd_adjustments for select using (user_id = auth.uid() or public.is_admin());

-- el saldo ahora suma también los ajustes del admin
create or replace function public.usd_balance(p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce((select sum(e.usd) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                          where e.user_id = p_user and e.usd > 0
                            and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) <= now()), 0)
             + coalesce((select sum(usd) from public.usd_adjustments where user_id = p_user), 0)
             - coalesce((select sum(usd) from public.usd_withdrawals where user_id = p_user and status <> 'rechazado'), 0), 2)
$$;
revoke execute on function public.usd_balance(uuid) from public, anon, authenticated;

create or replace function public.admin_adjust_usd(p_username text, p_usd numeric, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.profiles; v numeric := round(coalesce(p_usd, 0), 2); bal numeric; motivo text := left(trim(coalesce(p_reason, '')), 120);
  m text;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if v = 0 then raise exception 'Escribe el monto: 2 para sumar o -2 para quitar.'; end if;
  if abs(v) > 1000 then raise exception 'Eso es demasiado de una vez.'; end if;
  select * into u from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if not found then raise exception 'No encontré a %', p_username; end if;
  bal := public.usd_balance(u.id);
  if bal + v < 0 then raise exception '% tiene US$ % de saldo: no le puedes quitar %.', u.username, bal, abs(v); end if;
  insert into public.usd_adjustments (user_id, usd, motivo) values (u.id, v, motivo);
  m := replace(to_char(abs(v), 'FM999990.00'), '.', ',');
  begin
    insert into public.dm_threads (user_id, open) values (u.id, true) on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body, notified) values (u.id, true,
      case when v > 0 then '💵 Te agregué US$ ' || m || ' a tu saldo' else '💵 Te descontamos US$ ' || m || ' de tu saldo' end
      || coalesce(' · ' || nullif(motivo, ''), '') || '. Lo ves en Saldo y puntos.', true);
  exception when others then null;
  end;
  return jsonb_build_object('username', u.username, 'saldo', bal + v);
end $$;
grant execute on function public.admin_adjust_usd(text, numeric, text) to authenticated;

create or replace function public.admin_usd_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select a.created_at, a.usd, a.motivo, p.username from public.usd_adjustments a join public.profiles p on p.id = a.user_id
    order by a.created_at desc limit 20) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_usd_log() to authenticated;
