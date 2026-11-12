-- =====================================================================
-- Textos y ejercicios del módulo "La plataforma: Deriv y MT5" (6 lecciones).
-- Se puede correr varias veces:
--  - El texto de la lección solo se pone si la lección está VACÍA (no pisa lo que ya escribiste).
--  - Los ejercicios solo se agregan si esa lección todavía no tiene ejercicios de pregunta o cálculo.
-- Al final sale una tabla con lo que quedó en cada lección.
-- =====================================================================

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Abrir cuenta en Deriv: demo y real') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Abrir cuenta en Deriv: demo y real'; return; end if;
  update public.lessons set body = '### Lo que tienes que saber
- Deriv es el bróker de los índices sintéticos Boom y Crash. Funcionan las 24 horas, todos los días.
- La cuenta **demo** usa dinero virtual. Es donde practicas sin riesgo.
- La cuenta **real** pide tus datos verdaderos. Para retirar, Deriv verifica tu identidad y tu domicilio.
- El enlace de registro de la academia es un enlace de socio: Deriv le paga una comisión a El Arte Gráfico.
### Recomendación
- Termina Fundamentos y practica en demo antes de pasar a real.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 1, 'none', '¿Para qué sirve la cuenta demo?', '{"options": ["Para ganar dinero real más rápido", "Para practicar con dinero virtual sin arriesgar el tuyo", "Para retirar sin verificar identidad"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'La demo usa dinero virtual: es para aprender y practicar sin riesgo.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 2, 'none', 'Vas a abrir tu cuenta real. ¿Qué datos pones?', '{"options": ["Tus datos reales, porque para retirar te los verifican", "Cualquier nombre, después se cambia", "Los de un familiar"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'Deriv verifica identidad y domicilio para los retiros: con datos falsos no podrías sacar tu dinero.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', '¿Cuándo conviene pasar a una cuenta real?', '{"options": ["El primer día, para no perder tiempo", "Cuando un amigo gane", "Después de terminar Fundamentos y practicar en demo"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Primero aprendes la plataforma y practicas en demo; el dinero real va después.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Instalar MT5 y entrar a la cuenta de sintéticos') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Instalar MT5 y entrar a la cuenta de sintéticos'; return; end if;
  update public.lessons set body = '### Lo que tienes que saber
- La cuenta MT5 se crea dentro de Deriv. Para Boom y Crash necesitas la cuenta de **índices derivados** (el nombre puede cambiar; fíjate en que incluya índices derivados).
- Deriv te da tres datos: **login**, **contraseña** y **servidor**. Guárdalos en un lugar seguro y no se los compartas a nadie.
- Descarga MT5 solo desde el enlace de Deriv o la tienda oficial de tu celular.
- Para comprobar que entraste bien, busca Boom 1000 o Crash 1000 en la Observación del mercado.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 1, 'none', 'Entraste a MT5 y no aparece Boom 1000 en la lista. ¿Qué pasó lo más probable?', '{"options": ["Boom 1000 ya no existe", "Entraste a otra cuenta o a otro servidor", "Hay que pagar para verlo"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Boom y Crash solo aparecen en la cuenta de índices derivados y en su servidor de Deriv.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 2, 'none', '¿Qué tres datos necesitas para entrar a MT5?', '{"options": ["Login, contraseña y servidor", "Correo, cédula y teléfono", "Usuario de Deriv y código SMS"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'MT5 pide el número de login, la contraseña de esa cuenta y el servidor de Deriv.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', 'Alguien en un grupo te pide tu login y tu contraseña de MT5 "para ayudarte". ¿Qué haces?', '{"options": ["Se los das si tiene buenas reseñas", "Le das solo la contraseña", "No se los das a nadie"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Con esos datos cualquiera puede operar tu cuenta. Nunca los compartas.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Recorrido por MT5') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Recorrido por MT5'; return; end if;
  update public.lessons set body = '### Las partes que vas a usar
- **Observación del mercado:** la lista de símbolos. Clic derecho, Especificación, para ver lote mínimo, contrato y swap.
- **Temporalidad:** cuánto tiempo representa cada vela (M1, M5, H1, H4, D1…).
- **Herramientas de dibujo:** línea horizontal y rectángulo para marcar zonas.
- **Caja de herramientas:** saldo, operaciones abiertas, historial y diario de errores.
- **Plantilla:** guarda tu configuración del gráfico para no repetirla.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 1, 'none', '¿Dónde ves el lote mínimo de Boom 1000?', '{"options": ["En el Historial", "Clic derecho en el símbolo, Especificación", "En la barra de temporalidades"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'La ventana Especificación muestra lote mínimo, tamaño del contrato y swap de cada símbolo.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 2, 'none', 'Cambias de H1 a M5. ¿Qué cambió?', '{"options": ["Cada vela ahora representa 5 minutos en vez de 1 hora", "Cambiaste de símbolo", "Cambiaste de cuenta"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'La temporalidad es cuánto tiempo representa cada vela; el símbolo y la cuenta siguen iguales.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', 'Una orden no se abrió y no sabes por qué. ¿Dónde miras?', '{"options": ["En la plantilla", "En Observación del mercado", "En la pestaña Diario de la caja de herramientas"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'El Diario registra los errores y el motivo por el que una orden no entró.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Saldo, equidad, margen, apalancamiento, lote y punto') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Saldo, equidad, margen, apalancamiento, lote y punto'; return; end if;
  update public.lessons set body = '### Los números de tu cuenta
- **Saldo:** tu dinero sin contar operaciones abiertas.
- **Equidad:** saldo más la ganancia o pérdida de lo abierto.
- **Lote:** el tamaño de la operación. En Boom y Crash (contrato 1), 1 lote = 1 USD por cada 1,00 de movimiento.
- **Margen:** lo que el bróker reserva para mantener la operación. El apalancamiento lo hace más pequeño, pero no reduce tu riesgo.
- **Margen libre y stop out:** si la equidad cae demasiado, el bróker cierra tus operaciones.
### Cómo elegir el lote
- **Lote = riesgo en USD ÷ distancia del stop** (con contrato 1).
- Ejemplo: arriesgas 10 USD y tu stop está a 25,00 → 0,40 lotes.
- Revisa siempre la Especificación del símbolo en MT5: el contrato puede cambiar.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'calculo', 1, 'none', '', '{"template": "Quieres arriesgar {riesgo} USD y tu stop está a {stop} del precio. El contrato es 1. ¿Qué lote usas?", "vars": "riesgo=5..50:5; stop=10..50:5", "unit": "lotes", "decimals": 2}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"formula": "riesgo/stop", "tol_pct": 1}'::jsonb, 'Lote = riesgo en USD ÷ distancia del stop (con contrato 1).');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'calculo', 2, 'none', '', '{"template": "Tu saldo es {saldo} USD y tienes una operación abierta ganando {g} USD. ¿Cuál es tu equidad?", "vars": "saldo=200..2000:100; g=1..40:1", "unit": "USD", "decimals": 2}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"formula": "saldo+g", "tol_pct": 1}'::jsonb, 'Equidad = saldo + ganancia o pérdida de lo que tienes abierto.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', 'Subes el apalancamiento de 1:100 a 1:500 con el mismo lote. ¿Qué pasa con lo que ganas o pierdes por movimiento?', '{"options": ["Se multiplica por 5", "No cambia; solo baja el margen", "Se divide entre 5"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Lo que ganas o pierdes por movimiento lo decide el lote. El apalancamiento solo cambia cuánto margen se bloquea.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 4, 'none', 'Tienes una operación abierta perdiendo. ¿Cuál número baja?', '{"options": ["La equidad", "El saldo", "El apalancamiento"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'El saldo solo cambia al cerrar. La equidad refleja en vivo lo que va ganando o perdiendo lo abierto.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Abrir, modificar y cerrar una operación') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Abrir, modificar y cerrar una operación'; return; end if;
  update public.lessons set body = '### Los botones que tienes que dominar
- **Orden a mercado:** entra ya al precio actual. Compra si esperas que suba, venta si esperas que baje.
- **Stop loss (SL):** el precio donde aceptas perder. **Take profit (TP):** donde tomas la ganancia. En la academia nunca se opera sin stop.
- **Modificar:** arrastra las líneas en el gráfico o doble clic en la operación.
- **Pendientes:** Limit entra en un precio mejor que el actual; Stop entra cuando el precio rompe un nivel.
- **Cerrar:** la X en la operación. Puedes cerrar solo una parte.
- **Historial:** ahí quedan todas tus operaciones para revisarlas.
### Practica en demo
- Repite abrir, modificar y cerrar en la cuenta demo hasta que te salga sin pensar.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 1, 'none', 'Quieres comprar, pero solo si el precio baja hasta tu zona, que está por debajo del precio actual. ¿Qué orden usas?', '{"options": ["Buy Stop", "Compra a mercado", "Buy Limit"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Buy Limit compra en un precio mejor (más bajo) que el actual. Buy Stop compra cuando el precio sube y rompe un nivel.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 2, 'none', '¿Cuándo pones el stop loss?', '{"options": ["Al abrir la operación, antes de enviarla", "Cuando la operación ya va perdiendo", "No hace falta en demo"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'El stop se define antes de entrar: es parte del plan, no una reacción.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', '¿Dónde revisas el resultado de una operación que ya cerraste?', '{"options": ["En Observación del mercado", "En Historial", "En el Diario"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Historial guarda entrada, salida y resultado de cada operación cerrada.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Costos: spread y swap') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Costos: spread y swap'; return; end if;
  update public.lessons set body = '### Los dos costos de operar
- **Bid** es el precio de venta y **ask** el de compra. La diferencia es el **spread**.
- Toda operación abre perdiendo el spread: con 0,20 lotes y un spread de 1,00 (ejemplo), arrancas en −0,20 USD.
- Mientras más pequeño es tu objetivo, más pesa el spread.
- **Swap:** cobro o pago por dejar una operación abierta de un día al siguiente. Lo ves en la Especificación del símbolo y en la columna Swap de Operaciones.
- Deriv tiene una cuenta MT5 sin swap. Compara sus condiciones antes de elegirla.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'calculo', 1, 'none', '', '{"template": "El spread es {spread} y abres {lote} lotes con contrato 1. ¿Cuántos USD vas perdiendo justo al abrir?", "vars": "spread=0.5..3:0.5; lote=0.2..1:0.1", "unit": "USD", "decimals": 2}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"formula": "spread*lote", "tol_pct": 1}'::jsonb, 'Al abrir pierdes el spread: spread × lote × contrato.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 2, 'none', 'Acabas de comprar y la operación ya sale en negativo, aunque el precio no se movió. ¿Por qué?', '{"options": ["El bróker te robó", "Por el spread: compraste al ask y se valora al bid", "MT5 tiene un error"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Compras al ask y la operación se valora al bid: arrancas perdiendo justo el spread.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 3, 'none', '¿Qué es el swap?', '{"options": ["Un cobro o pago por mantener la operación abierta de un día al siguiente", "La diferencia entre compra y venta", "La comisión por retirar"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'El swap se aplica por cada día que la operación queda abierta. La diferencia entre compra y venta es el spread.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 4, 'none', '¿Dónde ves el swap de Boom 1000?', '{"options": ["En el Diario", "En la plantilla", "Clic derecho en el símbolo, Especificación"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'La Especificación del símbolo muestra el swap para compras y para ventas.');
  end if;
end $$;

select l.title as leccion, length(coalesce(l.body, '')) > 0 as tiene_texto,
       (select count(*) from public.exercises e where e.lesson_id = l.id and e.kind in ('opcion', 'calculo')) as ejercicios
from public.lessons l where lower(trim(l.title)) in ('abrir cuenta en deriv: demo y real', 'instalar mt5 y entrar a la cuenta de sintéticos', 'recorrido por mt5', 'saldo, equidad, margen, apalancamiento, lote y punto', 'abrir, modificar y cerrar una operación', 'costos: spread y swap') order by l.sort;
