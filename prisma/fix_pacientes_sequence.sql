-- ============================================================
-- SCRIPT DE REPARO: Restaurar Autoincremento na Tabela Pacientes
-- Executar este script no DBeaver, pgAdmin ou psql como SUPERUSER
-- ============================================================

-- 1. Cria a sequence de IDs para a tabela pacientes
CREATE SEQUENCE IF NOT EXISTS pacientes_id_seq;

-- 2. Vincula a sequence como valor padrão da coluna id
-- IMPORTANTE: Se der erro de permissão, certifique-se de estar logado como dono da tabela ou postgres
ALTER TABLE pacientes ALTER COLUMN id SET DEFAULT nextval('pacientes_id_seq');

-- 3. Sincroniza o contador da sequence com o maior ID já existente
-- Isso evita erros de "Unique Constraint" ao tentar inserir IDs que já existem
SELECT setval('pacientes_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM pacientes;

-- 4. (Opcional) Garante que o usuário da aplicação tenha permissão na nova sequence
GRANT USAGE, SELECT ON SEQUENCE pacientes_id_seq TO user_medlago_app;
