-- Script SQL para criar as tabelas do módulo de Broadcast
-- Executar manualmente no banco de dados de produção
-- APENAS adiciona novas tabelas, sem tocar nas existentes

CREATE TABLE IF NOT EXISTS message_templates (
  id             BIGSERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  body           TEXT,
  image_url      TEXT,
  image_caption  VARCHAR(1024),
  active         BOOLEAN NOT NULL DEFAULT true,
  created_by     BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id               BIGSERIAL PRIMARY KEY,
  template_id      BIGINT NOT NULL REFERENCES message_templates(id),
  status           VARCHAR(50) NOT NULL DEFAULT 'draft',
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count       INT NOT NULL DEFAULT 0,
  failed_count     INT NOT NULL DEFAULT 0,
  created_by       BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id            BIGSERIAL PRIMARY KEY,
  broadcast_id  BIGINT NOT NULL REFERENCES broadcasts(id),
  patient_id    BIGINT NOT NULL,
  phone         VARCHAR(50) NOT NULL,
  name          VARCHAR(200),
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  error         TEXT
);

-- Permissões para as Sequences (necessário para o autoincrement de ID)
GRANT ALL ON SEQUENCE message_templates_id_seq TO public;
GRANT ALL ON SEQUENCE broadcasts_id_seq TO public;
GRANT ALL ON SEQUENCE broadcast_recipients_id_seq TO public;

-- Permissões para as Tabelas
GRANT ALL ON TABLE message_templates TO public;
GRANT ALL ON TABLE broadcasts TO public;
GRANT ALL ON TABLE broadcast_recipients TO public;
