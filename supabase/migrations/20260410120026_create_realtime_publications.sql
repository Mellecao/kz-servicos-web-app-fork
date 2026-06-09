-- ============================================================================
-- Migration 27: Create Realtime Publications
-- Description: Adiciona tabelas ao Supabase Realtime para receber atualizações
--   em tempo real via WebSocket. Essencial para chat, localização de
--   motoristas e notificações push.
-- ============================================================================

-- +goose Up

-- Localização de motoristas em tempo real (tracking no mapa)
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- Mensagens de chat em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Notificações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- +goose Down
-- ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
-- ALTER PUBLICATION supabase_realtime DROP TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime DROP TABLE driver_locations;
