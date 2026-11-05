-- Nomes e descrições das categorias em português de Angola.
-- Só atualiza texto (por slug); não apaga nem cria categorias. Slugs e ids ficam intactos.
-- O app Prestador já aceita os nomes novos (e os antigos como alias).
UPDATE public.service_categories AS c
SET name = v.name, description = v.description
FROM (VALUES
  ('plumber',       'Canalizador',          'Serviços de canalização e hidráulica'),
  ('cleaner',       'Limpeza geral',        'Serviços de limpeza geral'),
  ('housekeeper',   'Empregada doméstica',  'Serviço de limpeza e arrumação doméstica'),
  ('ac_technician', 'Ar condicionado',      'Instalação e manutenção de ar condicionado'),
  ('carpenter',     'Carpinteiro',          'Serviços de carpintaria por medida'),
  ('pest_control',  'Controlo de pragas',   'Controlo de pragas e desinfestação'),
  ('welder',        'Serralheiro',          'Serviços de serralharia e soldadura'),
  ('electrician',   'Eletricista',          'Serviços de eletricidade')
) AS v(slug, name, description)
WHERE c.slug = v.slug;
