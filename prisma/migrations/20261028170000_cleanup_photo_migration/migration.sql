-- Limpeza da migração de fotos (28/10/2026).

-- Tabela temporária usada para comprimir as fotos importadas.
DROP TABLE IF EXISTS "photo_compress_tmp";

-- 17 fotos importadas que se perderam na primeira tentativa de compressão:
-- o registro aponta para um arquivo que não existe mais no Blob.
DELETE FROM "uploaded_files" WHERE "path" IN (
  'veiculos/saidas/2026-04-27/saida_right_out_798516.jpg',
  'veiculos/entradas/2026-04-10/montana_20260410_back_736311.jpg',
  'veiculos/saidas/2026-08-25/toro_20260825_back_out_737180.jpg',
  'veiculos/saidas/2026-04-14/saida_left_out_044116.jpg',
  'veiculos/entradas/2026-04-08/logan_20260408_back_691580.jpg',
  'veiculos/entradas/2026-04-17/montana_20260417_dashboard_769312.jpg',
  'veiculos/entradas/2026-04-10/montana_20260410_back_734915.jpg',
  'veiculos/saidas/2026-03-31/saida_foto_2026-03-31_0005.jpg',
  'veiculos/saidas/2026-08-25/toro_20260825_front_out_737178.jpg',
  'veiculos/entradas/2026-08-17/logan_20260817_back_in_735632.jpg',
  'veiculos/entradas/2026-04-17/montana_20260417_back_767595.jpg',
  'veiculos/entradas/2026-04-10/montana_20260410_front_744600.jpg',
  'veiculos/saidas/2026-03-31/saida_foto_2026-03-31_0006.jpg',
  'veiculos/entradas/2026-09-16/strada_20260916_front_in_893450.jpg',
  'veiculos/saidas/2026-08-26/montana_20260826_front_out_419905.jpg',
  'veiculos/entradas/2026-04-10/montana_20260410_left_751389.jpg',
  'veiculos/entradas/2026-08-03/toro_20260803_front_in_467906.jpg'
);
