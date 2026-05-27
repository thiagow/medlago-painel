-- Migration: Módulo de Suporte (Help Desk / Ticketing)
-- Cria as tabelas: suporte_tickets, suporte_ticket_anexos, suporte_ticket_respostas

-- ── Tabela principal de tickets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suporte_tickets (
    id            BIGSERIAL     PRIMARY KEY,
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    ticket_number VARCHAR(20)    NOT NULL UNIQUE,
    titulo        VARCHAR(255)   NOT NULL,
    descricao     TEXT           NOT NULL,
    tipo          VARCHAR(20)    NOT NULL,      -- 'bug' | 'erro' | 'melhoria' | 'duvida'
    prioridade    VARCHAR(20)    NOT NULL,      -- 'baixa' | 'media' | 'alta' | 'critica'
    status        VARCHAR(20)    NOT NULL DEFAULT 'aberto',  -- 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado'
    video_url     TEXT,
    created_by    BIGINT         NOT NULL,      -- FK implícita → users.id
    resolved_by   BIGINT,                       -- FK implícita → users.id
    resolved_at   TIMESTAMPTZ(6)
);

-- ── Tabela de anexos (imagens no R2) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suporte_ticket_anexos (
    id          BIGSERIAL     PRIMARY KEY,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    ticket_id   BIGINT         NOT NULL,        -- FK → suporte_tickets.id
    file_name   VARCHAR(255)   NOT NULL,
    file_size   INTEGER        NOT NULL,        -- bytes
    mime_type   VARCHAR(100)   NOT NULL,
    r2_key      TEXT           NOT NULL,        -- chave no bucket R2
    uploaded_by BIGINT         NOT NULL         -- FK → users.id
);

-- ── Tabela de respostas / thread ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suporte_ticket_respostas (
    id          BIGSERIAL     PRIMARY KEY,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    ticket_id   BIGINT         NOT NULL,        -- FK → suporte_tickets.id
    mensagem    TEXT           NOT NULL,
    created_by  BIGINT         NOT NULL,        -- FK → users.id
    is_admin    BOOLEAN        NOT NULL DEFAULT FALSE
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_created_by   ON suporte_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_status       ON suporte_tickets(status);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_prioridade   ON suporte_tickets(prioridade);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_created_at   ON suporte_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_suporte_anexos_ticket_id     ON suporte_ticket_anexos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_suporte_respostas_ticket_id  ON suporte_ticket_respostas(ticket_id);
