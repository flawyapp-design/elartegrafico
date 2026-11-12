-- =====================================================================
-- Contenido y ejercicios del módulo "Velas japonesas" (5 lecciones).
-- Se puede correr varias veces:
--  - El texto solo se pone si la lección está VACÍA (no pisa lo que ya escribiste).
--  - Los ejercicios de pregunta solo se agregan si la lección todavía no tiene preguntas.
-- Al final sale una tabla con lo que quedó en cada lección.
-- =====================================================================

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Qué es una vela: cuerpo y mechas') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Qué es una vela: cuerpo y mechas'; return; end if;
  update public.lessons set body = '### Una vela = un tiempo
- Cada vela resume lo que hizo el precio durante un tiempo fijo: en **H1**, una hora; en **M5**, cinco minutos.
- Mientras ese tiempo corre, la vela se va formando. Cuando termina, queda fija y empieza la siguiente.
### Los 4 precios
- **Apertura:** dónde estaba el precio al empezar.
- **Cierre:** dónde terminó.
- **Máximo:** lo más alto que llegó.
- **Mínimo:** lo más bajo que llegó.
### Cuerpo y mechas
- El **cuerpo** es la parte gruesa, entre la apertura y el cierre.
- Las **mechas** son las líneas finas: muestran hasta dónde llegó el precio, aunque no se quedó ahí.
- Si cerró más arriba de donde abrió, la vela es **alcista** (normalmente verde). Si cerró más abajo, es **bajista** (normalmente roja).
### Lo que te dice una vela
- **Dirección:** hacia dónde se movió el precio.
- **Fuerza:** el tamaño del cuerpo.
- **Rechazo:** las mechas largas muestran dónde el precio llegó y fue devuelto.
- En Boom y Crash vas a ver muchas velas pequeñas y, de vez en cuando, una vela enorme: la vela del **spike**.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 101, 'none', '¿Qué resume una vela de H1?', '{"options": ["Lo que hizo el precio durante una hora", "Lo que hizo el precio durante cinco minutos", "Las operaciones de todos los traders del día"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'Cada vela resume un tiempo fijo: en H1, una hora; en M5, cinco minutos.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 102, 'none', '¿Qué muestran las mechas de una vela?', '{"options": ["Dónde abrió y cerró el precio", "Hasta dónde llegó el precio, aunque no se quedó ahí", "El volumen de la vela"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'El cuerpo va de la apertura al cierre. Las mechas marcan el máximo y el mínimo que alcanzó.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 103, 'none', 'Una vela abrió en 8.500 y cerró en 8.520. ¿Cómo es?', '{"options": ["Bajista", "No se puede saber", "Alcista"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Si el cierre queda más arriba que la apertura, la vela es alcista.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 104, 'none', '¿Qué te indica una mecha larga hacia abajo?', '{"options": ["Que el precio bajó, fue rechazado y volvió a subir", "Que la vela es más fuerte", "Que viene un spike seguro"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'La mecha muestra hasta dónde llegó el precio. Una mecha larga es rechazo: llegó ahí y fue devuelto.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Velas a favor y velas contrarias') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Velas a favor y velas contrarias'; return; end if;
  update public.lessons set body = '### Lo que importa no es el color
En el método no basta con ver si la vela es verde o roja: lo que importa es si va **a favor** o **en contra** de lo que buscamos.
### Depende del mercado
- **Boom:** buscamos compras, porque los spikes son hacia arriba. Vela **a favor** = verde. Vela **contraria** = roja.
- **Crash:** buscamos ventas, porque los spikes son hacia abajo. Vela **a favor** = roja. Vela **contraria** = verde.
### Contrarias seguidas
- Cuando aparecen varias velas contrarias seguidas en **H1**, se forma un **retroceso**.
- Ahí es donde el método empieza a buscar zonas. Lo vemos a fondo en el módulo de entradas.
### Resumen
- En Boom, a favor es verde. En Crash, a favor es roja.
- Varias contrarias seguidas en H1 forman el retroceso.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 101, 'none', 'En Boom, ¿cuál es la vela a favor?', '{"options": ["La roja", "La verde", "Cualquiera con mecha larga"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'En Boom buscamos compras porque los spikes son hacia arriba: la vela a favor es la verde.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 102, 'none', 'En Crash, ¿cuál es la vela contraria?', '{"options": ["La verde", "La roja", "La del spike"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'En Crash buscamos ventas: la vela a favor es la roja y la contraria es la verde, que sube en contra de la venta.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 103, 'none', 'Ves cinco velas rojas seguidas en H1 de Boom. ¿Qué se está formando?', '{"options": ["Un spike", "Una tendencia bajista que nunca vuelve", "Un retroceso"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'En Boom la roja es contraria. Varias contrarias seguidas en H1 forman un retroceso, y ahí el método empieza a buscar zonas.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 104, 'none', '¿Por qué en Crash buscamos ventas?', '{"options": ["Porque las velas rojas son más grandes", "Porque los spikes de Crash son hacia abajo", "Porque el spread es menor"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Los spikes de Crash son hacia abajo; por eso la operación del método es la venta.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Temporalidades: H1 y M5') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Temporalidades: H1 y M5'; return; end if;
  update public.lessons set body = '### Qué es una temporalidad
La temporalidad es cuánto tiempo resume cada vela: **M1** un minuto, **M5** cinco minutos, **H1** una hora. En el método usamos **H1** y **M5**.
### Una vela de H1 = doce de M5
Es el mismo movimiento visto con más detalle: mismo inicio, mismo final, mismo máximo y mismo mínimo.
### Para qué usamos cada una
- **H1 — el panorama:** ahí marcamos los fractales y la **zona** donde queremos operar.
- **M5 — el detalle:** ahí ponemos el **stop loss** con precisión, para arriesgar menos en cada operación.
### Recuerda
- 1 vela de H1 = 12 velas de M5.
- La zona se marca en H1. El stop loss se pone en M5.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 101, 'none', '¿Cuántas velas de M5 caben en una vela de H1?', '{"options": ["5", "12", "60"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'Una hora tiene doce periodos de cinco minutos: una vela de H1 contiene doce de M5.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 102, 'none', 'En el método, ¿dónde marcas la zona?', '{"options": ["En H1", "En M5", "En M1"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'En H1 vemos el panorama: ahí van los fractales y la zona.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 103, 'none', '¿Para qué usamos M5?', '{"options": ["Para decidir si el mercado es Boom o Crash", "Para poner el stop loss con precisión", "Para ver el spread"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'M5 muestra el detalle: ahí ajustamos el stop loss para arriesgar menos.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 104, 'none', 'El máximo de una vela de H1 y el máximo de sus 12 velas de M5…', '{"options": ["Son distintos siempre", "Dependen del bróker", "Son el mismo precio"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Es el mismo movimiento con más detalle: mismo inicio, final, máximo y mínimo.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Cambiar de temporalidad sin perder la referencia') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Cambiar de temporalidad sin perder la referencia'; return; end if;
  update public.lessons set body = '### La regla
- **H1 decide dónde y en qué dirección:** la zona y si vas a favor del mercado.
- **M5 solo afina cuándo y dónde va el stop:** no cambia la idea que viste en H1.
### Cómo pasar de H1 a M5 sin perderte
1. Marca tu zona en **H1** con un rectángulo o líneas horizontales.
2. Cambia a **M5**: tus dibujos se quedan en el mismo precio, así que la zona sigue ahí.
3. Busca en M5 el detalle dentro de la zona: dónde se rechazó el precio y dónde tiene sentido el stop loss.
4. Si te pierdes, vuelve a H1 y mira dónde estás dentro de la vela actual.
### Errores que evita esta regla
- Cambiar de idea porque en M5 se ve una vela grande en contra: en M5 hay ruido; la dirección la da H1.
- Poner el stop en M5 fuera de la lógica de la zona de H1.
- Entrar en M5 donde no hay zona marcada en H1.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 101, 'none', 'Ya marcaste una zona de compra en H1 de Boom. En M5 ves tres velas rojas. ¿Qué haces?', '{"options": ["Cambias la idea a venta", "Sigues con la idea de H1 y usas M5 para afinar el stop", "Borras la zona"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'La dirección y la zona las decide H1. M5 solo afina cuándo y dónde va el stop.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 102, 'none', 'Pasas de H1 a M5. ¿Qué pasa con la zona que dibujaste?', '{"options": ["Desaparece y hay que dibujarla otra vez", "Se mueve de precio", "Se queda en el mismo precio"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'Los dibujos están anclados al precio: al cambiar de temporalidad siguen en el mismo nivel.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 103, 'none', '¿Qué temporalidad decide en qué dirección operas?', '{"options": ["H1", "M5", "La que tenga más velas"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'H1 da el panorama: dónde está la zona y la dirección. M5 es para el detalle.');
  end if;
end $$;

do $$
declare lid uuid; eid uuid;
begin
  select id into lid from public.lessons where lower(trim(title)) = lower('Práctica: leer secuencias de velas') order by created_at limit 1;
  if lid is null then raise notice 'No encontré la lección: %', 'Práctica: leer secuencias de velas'; return; end if;
  update public.lessons set body = '### Qué vas a practicar
Leer varias velas seguidas como una historia, no una por una.
### Qué mirar en cada secuencia
1. **Mercado:** ¿es Boom o Crash? Eso decide qué vela va a favor y cuál es contraria.
2. **A favor o contrarias:** ¿cuántas contrarias seguidas hay? Varias seguidas en H1 forman un retroceso.
3. **Fuerza:** ¿los cuerpos se hacen más grandes o más pequeños?
4. **Rechazo:** ¿aparecen mechas largas? Muestran dónde el precio fue devuelto.
5. **Temporalidad:** confirma la idea en H1 y mira el detalle en M5.
### Cómo hacerlo en los ejercicios
- Lee la secuencia antes de responder. Di en voz alta qué ves: mercado, dirección y dónde hubo rechazo.
- Si te equivocas, revisa la repetición vela por vela y busca qué parte de la secuencia leíste mal.' where id = lid and coalesce(trim(body), '') = '';
  if not exists (select 1 from public.exercises where lesson_id = lid and kind in ('opcion', 'calculo')) then
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 101, 'none', 'En Boom ves: verde grande, roja, roja, roja, roja con mecha larga abajo. ¿Qué describe mejor la secuencia?', '{"options": ["Un retroceso de velas contrarias que muestra rechazo abajo al final", "Una tendencia alcista fuerte", "Un spike de Crash"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 0}'::jsonb, 'En Boom las rojas son contrarias: cuatro seguidas forman retroceso, y la mecha larga abajo muestra rechazo.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 102, 'none', 'Los cuerpos de las velas contrarias se hacen cada vez más pequeños. ¿Qué te dice?', '{"options": ["Que el retroceso está ganando fuerza", "Que el retroceso está perdiendo fuerza", "Nada, el tamaño no importa"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 1}'::jsonb, 'El tamaño del cuerpo es la fuerza: cuerpos cada vez menores indican que ese movimiento se debilita.');
    insert into public.exercises (lesson_id, kind, sort, tf_sl, prompt, data) values (lid, 'opcion', 103, 'none', '¿Qué es lo primero que defines al leer una secuencia?', '{"options": ["El color de la última vela", "El lote", "Si el mercado es Boom o Crash"]}'::jsonb) returning id into eid;
    insert into public.exercise_answers (exercise_id, answer, explain) values (eid, '{"correct": 2}'::jsonb, 'El mercado decide qué velas van a favor y cuáles son contrarias; sin eso no puedes leer la secuencia.');
  end if;
end $$;

select l.title as leccion, length(coalesce(l.body, '')) > 0 as tiene_texto,
       (select count(*) from public.exercises e where e.lesson_id = l.id and e.kind = 'opcion') as preguntas,
       (select count(*) from public.exercises e where e.lesson_id = l.id and e.kind not in ('opcion', 'calculo')) as graficas
from public.lessons l where lower(trim(l.title)) in ('qué es una vela: cuerpo y mechas', 'velas a favor y velas contrarias', 'temporalidades: h1 y m5', 'cambiar de temporalidad sin perder la referencia', 'práctica: leer secuencias de velas') order by l.sort;
