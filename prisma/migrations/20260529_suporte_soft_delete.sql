-- Soft delete para suporte_tickets
-- Segurança de dados: exclusão lógica preserva histórico

ALTER TABLE suporte_tickets
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- Índice parcial para performance nas queries de listagem (filtra só não-deletados)
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_deleted_at
  ON suporte_tickets (deleted_at)
  WHERE deleted_at IS NULL;
