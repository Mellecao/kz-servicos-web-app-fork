-- Regiões de atuação de motoristas em Luanda (aditivo: as regiões antigas permanecem).
-- `normalized_name` é coluna gerada: inserir só `name`.
INSERT INTO public.driver_regions (name)
SELECT v.name
FROM (VALUES
  ('Luanda'), ('Talatona'), ('Belas'), ('Viana'),
  ('Cacuaco'), ('Cazenga'), ('Kilamba Kiaxi'), ('Icolo e Bengo')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.driver_regions r WHERE lower(public.unaccent(r.name)) = lower(public.unaccent(v.name))
);
