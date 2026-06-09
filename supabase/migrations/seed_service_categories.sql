-- Migration: Seed additional service categories for other_service type
-- Run this in Supabase SQL Editor

INSERT INTO service_categories (name, slug, description, service_type, is_active)
VALUES
  ('Encanador', 'plumber', 'Serviços de encanamento e hidráulica', 'other_service', true),
  ('Pintor', 'painter', 'Serviços de pintura residencial e comercial', 'other_service', true),
  ('Faxineira', 'cleaner', 'Serviços de limpeza e faxina', 'other_service', true),
  ('Montador de Móveis', 'furniture_assembler', 'Montagem e desmontagem de móveis', 'other_service', true),
  ('Técnico de Informática', 'it_technician', 'Suporte técnico e manutenção de computadores', 'other_service', true),
  ('Jardineiro', 'gardener', 'Serviços de jardinagem e paisagismo', 'other_service', true),
  ('Pedreiro', 'mason', 'Serviços de alvenaria e construção', 'other_service', true),
  ('Chaveiro', 'locksmith', 'Serviços de chaveiro e fechaduras', 'other_service', true),
  ('Ar-condicionado', 'ac_technician', 'Instalação e manutenção de ar-condicionado', 'other_service', true),
  ('Marceneiro', 'carpenter', 'Serviços de marcenaria sob medida', 'other_service', true),
  ('Vidraceiro', 'glazier', 'Serviços de vidraçaria e espelhos', 'other_service', true),
  ('Serralheiro', 'welder', 'Serviços de serralheria e soldagem', 'other_service', true),
  ('Dedetizador', 'pest_control', 'Controle de pragas e dedetização', 'other_service', true)
ON CONFLICT (slug) DO NOTHING;
