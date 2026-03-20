-- Migração SEGURA: apenas adiciona colunas, nunca remove dados
-- Execute: npx prisma db execute --file ./prisma/migrations/add_status_tracking_fields.sql

-- 1. Adicionar campo 'status' com valores:
--    "ai" | "waiting" | "human" | "finished" | "transferred_external"
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS status VARCHAR(30);

-- 2. Adicionar 'finished_at' — quando o atendimento foi finalizado
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- 3. Adicionar 'finished_by' — ID do usuário que finalizou (FK implícita para users.id)
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS finished_by BIGINT;

-- 4. Popular 'status' com base nos valores existentes de 'ai_service' e 'finished'
--    Isso garante que registros antigos tenham status definido
UPDATE chats
SET status = CASE
  WHEN finished = true AND EXISTS (
    SELECT 1 FROM chat_transfer_logs ctl
    WHERE ctl.chat_id = chats.id
      AND ctl.transfer_type = 'external'
  ) THEN 'transferred_external'
  WHEN finished = true THEN 'finished'
  WHEN ai_service = 'waiting'                                         THEN 'waiting'
  WHEN ai_service = 'paused' AND (finished IS NULL OR finished = false) THEN 'human'
  WHEN ai_service IN ('active', 'true') OR ai_service IS NULL         THEN 'ai'
  ELSE 'ai'
END
WHERE status IS NULL;

-- 5. Índice para facilitar queries de relatórios
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats (status);
CREATE INDEX IF NOT EXISTS idx_chats_finished_at ON chats (finished_at);
