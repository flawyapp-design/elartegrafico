-- Videos en las publicaciones de la comunidad. Se puede correr varias veces.
alter table public.posts add column if not exists video_url text not null default '';
-- Los videos subidos desde Admin van al almacenamiento 'media' (hasta 50 MB por archivo en el plan gratis de Supabase).
-- Para videos más pesados, súbelos a Bunny o YouTube y pega el enlace.
