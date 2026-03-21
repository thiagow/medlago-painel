-- =============================================
-- Script de criação das tabelas NPS
-- =============================================

-- Tabela de configuração dos textos do NPS
CREATE TABLE IF NOT EXISTS nps_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valores padrão
INSERT INTO nps_config (key, value) VALUES
  ('enabled', 'true'),
  ('greeting', 'Olá! Seu atendimento com *{agent_name}* foi finalizado. Gostaríamos de saber como foi sua experiência!'),
  ('question', 'De 0 a 10, como você avalia o atendimento?'),
  ('button_bad', '😞 0 a 3'),
  ('button_neutral', '😐 4 a 7'),
  ('button_good', '😍 8 a 10'),
  ('followup_bad', 'Sentimos muito. O que poderíamos ter feito para melhorar?'),
  ('followup_neutral', 'O que poderíamos ter feito diferente?'),
  ('followup_good', 'Que bom! O que você mais gostou no atendimento?'),
  ('thank_you', 'Obrigado pela sua avaliação! Ela é muito importante para nós. ✨')
ON CONFLICT (key) DO NOTHING;

-- Tabela de respostas das avaliações
CREATE TABLE IF NOT EXISTS nps_responses (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    agent_name VARCHAR(150),
    rating VARCHAR(20),
    nps_score INT,
    comment TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Permissões
GRANT ALL ON TABLE nps_config TO public;
GRANT ALL ON TABLE nps_responses TO public;
GRANT USAGE, SELECT ON SEQUENCE nps_config_id_seq TO public;
GRANT USAGE, SELECT ON SEQUENCE nps_responses_id_seq TO public;
