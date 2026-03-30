-- ============================================================
-- SCRIPT DE MIGRAÇÃO: Funcionalidade de Apagar Mensagem
-- Gerado em: 2026-03-30
-- ATENÇÃO: Revisar antes de executar em produção.
--          Todos os comandos usam IF NOT EXISTS / IF EXISTS para
--          que seja seguro executar mais de uma vez sem erros.
-- ============================================================

-- 1. Adicionar campo uazapi_message_id à tabela chat_messages
--    Armazena o ID retornado pela UAZAPI ao enviar uma mensagem
--    (usado para chamar /message/delete)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS uazapi_message_id VARCHAR(255);

-- 2. Adicionar campos de soft delete à tabela chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- 3. Criar tabela de log de exclusões de mensagens
--    Equivalente à chat_transfer_logs — trilha de auditoria completa
CREATE TABLE IF NOT EXISTS chat_message_delete_logs (
  id               BIGSERIAL    PRIMARY KEY,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  message_id       BIGINT       NOT NULL,          -- ID da mensagem excluída (chat_messages.id)
  chat_id          BIGINT       NOT NULL,           -- ID do chat (chats.id)
  conversation_id  TEXT,                            -- conversation_id do chat (para correlação)
  deleted_by       BIGINT,                          -- FK implícita para users.id
  user_name        TEXT         NOT NULL,           -- Nome do usuário que excluiu
  original_content TEXT,                            -- Conteúdo original da mensagem
  media_type       VARCHAR(50)                      -- Tipo de mídia, se havia anexo
);

-- 4. Index para busca por message_id e chat_id (consultas de auditoria)
CREATE INDEX IF NOT EXISTS idx_chat_message_delete_logs_message_id
  ON chat_message_delete_logs (message_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_delete_logs_chat_id
  ON chat_message_delete_logs (chat_id);

-- ============================================================
-- Validação pós execução (rodar para confirmar):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'chat_messages'
--   AND column_name IN ('uazapi_message_id', 'deleted_at', 'deleted_by');
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name = 'chat_message_delete_logs';
-- ============================================================
