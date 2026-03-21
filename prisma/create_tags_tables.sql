-- Script para criar as tabelas de Tags com segurança
-- Rodar manualmente no banco de dados de produção caso o prisma db push tenha problemas de permissão

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de junção chat_tags
CREATE TABLE IF NOT EXISTS chat_tags (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_by BIGINT,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, tag_id)
);

-- Conceder permissões para o usuário da aplicação (incluindo as sequences do BIGSERIAL)
GRANT ALL ON TABLE tags TO public;
GRANT ALL ON SEQUENCE tags_id_seq TO public;

GRANT ALL ON TABLE chat_tags TO public;
GRANT ALL ON SEQUENCE chat_tags_id_seq TO public;
