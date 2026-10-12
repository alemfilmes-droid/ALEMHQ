-- Medição do Bloco 3 — SOMENTE LEITURA, só totais (nenhum nome, texto ou valor).
-- Rodar (Terminal, na pasta do projeto):
--   npx supabase db query --linked -f docs/medicao-pautas.sql -o csv

begin read only;

select
  (select count(*) from public.pautas where not is_standalone) as pautas_no_quadro_antes,
  (select count(*) from public.pautas where not is_standalone
     and (board_column <> 'entregue' or updated_at >= now() - interval '30 days')) as pautas_no_quadro_depois,
  (select count(*) from public.pautas where not is_standalone and board_column = 'entregue') as entregues_total,
  (select count(*) from storage.objects where bucket_id in ('avatars', 'company-logos')) as fotos_e_logos,
  (select round(avg((metadata->>'size')::numeric) / 1024) from storage.objects where bucket_id in ('avatars', 'company-logos')) as kb_medio_por_imagem,
  (select round(max((metadata->>'size')::numeric) / 1024) from storage.objects where bucket_id in ('avatars', 'company-logos')) as kb_maior_imagem;

rollback;
