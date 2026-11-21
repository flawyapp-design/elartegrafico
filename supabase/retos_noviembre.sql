-- 10 retos programados del 20 al 30 de noviembre de 2026 (hora Colombia, UTC-5)
-- Cada uno sale publicado a su hora (y se envía la notificación), dura 20 horas, vale 100 puntos y tiene 5 cupos de ganadores.
-- Son de tipo "cuestionario": la respuesta correcta queda guardada aparte y solo se revela al cerrar.

do $$
declare r record; cid uuid;
begin
  for r in select * from (values
    ('2026-11-20 21:00-05'::timestamptz, 'Gestión de riesgo: ¿cuánto arriesgar?',
     'Tienes una cuenta de 500 USD y sigues la regla del 1 % de riesgo por operación. ¿Cuánto es lo máximo que deberías perder si tu stop loss se activa?',
     '["50 USD","5 USD","25 USD","1 USD"]'::jsonb, 1,
     'El 1 % de 500 USD son 5 USD. Arriesgar poco por operación te permite aguantar rachas perdedoras sin quemar la cuenta.'),
    ('2026-11-21 09:00-05', 'Boom y Crash: ¿hacia dónde va el spike?',
     'En los índices Boom (por ejemplo Boom 1000), ¿hacia dónde salen los spikes (velas grandes y repentinas)?',
     '["Hacia abajo","Hacia arriba","A veces arriba y a veces abajo","Los Boom no tienen spikes"]', 1,
     'En Boom los spikes son hacia arriba y el precio va bajando poco a poco entre spikes. En Crash es al revés: spikes hacia abajo.'),
    ('2026-11-22 18:30-05', 'Soportes y resistencias',
     'Un nivel que antes frenó al precio por arriba (resistencia) se rompe con fuerza y el precio vuelve a tocarlo desde arriba. ¿Cómo suele comportarse ese nivel ahora?',
     '["Desaparece y ya no sirve","Sigue siendo resistencia","Puede actuar como soporte","Siempre se vuelve a romper"]', 2,
     'Es el "cambio de polaridad": una resistencia rota suele convertirse en soporte en el retesteo (y un soporte roto en resistencia).'),
    ('2026-11-23 12:00-05', 'Relación riesgo/beneficio',
     'Entras en compra con stop loss a 20 pips y take profit a 60 pips. ¿Cuál es tu relación riesgo/beneficio?',
     '["1:2","1:3","3:1","1:1"]', 1,
     'Arriesgas 20 para ganar 60: 60 ÷ 20 = 3, o sea 1:3. Con 1:3 puedes acertar solo 1 de cada 4 operaciones y aun así no perder.'),
    ('2026-11-24 20:00-05', 'Temporalidades: el panorama completo',
     'Quieres operar en M5. ¿Qué es lo más recomendable antes de buscar la entrada?',
     '["Mirar solo M1 para entrar rápido","Revisar una temporalidad mayor (H1 o H4) para ver la tendencia y las zonas","Cambiar de mercado cada 5 minutos","Ignorar las temporalidades mayores"]', 1,
     'El análisis multitemporal: la temporalidad mayor te da la dirección y las zonas importantes, y la menor te da el momento de entrada.'),
    ('2026-11-25 08:30-05', 'Forex: el pip',
     'En el par EUR/USD el precio pasa de 1.08500 a 1.08750. ¿Cuántos pips se movió?',
     '["2,5 pips","250 pips","25 pips","0,25 pips"]', 2,
     'En EUR/USD un pip es el cuarto decimal (0.0001). La diferencia es 0.00250, o sea 25 pips (el quinto decimal es la fracción de pip).'),
    ('2026-11-26 15:00-05', 'Psicología: después de una pérdida',
     'Acabas de perder dos operaciones seguidas y sientes que tienes que recuperar ya. ¿Qué es lo más sano según tu plan de trading?',
     '["Doblar el lote para recuperar rápido","Abrir varias operaciones a la vez","Pausar, revisar qué pasó y seguir solo con entradas de tu plan","Quitar el stop loss para no perder más"]', 2,
     'Operar por venganza es la forma más rápida de quemar una cuenta. Pausa, analiza y vuelve solo cuando el plan te dé una entrada.'),
    ('2026-11-27 19:30-05', 'Velas japonesas: la mecha',
     'Una vela cierra cerca de su apertura pero deja una mecha inferior muy larga, justo encima de una zona de soporte. ¿Qué suele indicar?',
     '["Que los vendedores tienen el control total","Rechazo del precio: los compradores defendieron la zona","Que el mercado está cerrado","Nada, las mechas no importan"]', 1,
     'Una mecha larga abajo (tipo martillo / pin bar) muestra que el precio bajó pero fue rechazado y empujado hacia arriba: señal de que la zona se defendió.'),
    ('2026-11-28 10:00-05', 'Sintéticos: ¿cuándo se pueden operar?',
     'Los índices sintéticos de Deriv (Volatility, Boom, Crash, Step…), ¿en qué horario están disponibles?',
     '["Solo de lunes a viernes","Las 24 horas, los 7 días de la semana","Solo cuando abre Nueva York","Solo fines de semana"]', 1,
     'Los sintéticos funcionan 24/7, incluso fines de semana y festivos, porque no dependen de un mercado real. El forex sí cierra el fin de semana.'),
    ('2026-11-29 17:00-05', 'Stop loss bien puesto',
     'Compras en una zona de soporte. ¿Dónde tiene más sentido poner el stop loss?',
     '["Justo encima del precio de entrada","Un poco por debajo de la zona de soporte","Muy lejos, sin ningún criterio","No hace falta stop loss en sintéticos"]', 1,
     'El stop va donde tu idea deja de ser válida: si el precio rompe la zona de soporte, la compra ya no tiene sentido. Un poco por debajo te protege del ruido.')
  ) as t(starts, title, question, options, correct, explain)
  loop
    insert into public.challenges (title, kind, question, options, points, max_winners, starts_at, ends_at, status)
    values (r.title, 'opcion', r.question, r.options, 100, 5, r.starts, r.starts + interval '20 hours', 'publicado')
    returning id into cid;
    insert into public.challenge_keys (challenge_id, correct, explain) values (cid, r.correct, r.explain);
  end loop;
end $$;

select title, to_char(starts_at at time zone 'America/Bogota', 'DD Mon HH24:MI') as sale, to_char(ends_at at time zone 'America/Bogota', 'DD Mon HH24:MI') as cierra
from public.challenges where starts_at >= '2026-11-20 20:00-05' order by starts_at;
