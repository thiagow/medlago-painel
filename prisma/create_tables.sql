-- Script para criar as tabelas de autenticação no banco MedLago
-- Execute este script no pgAdmin ou via psql

-- Tabela de perfis
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir perfis iniciais
INSERT INTO roles (name, description) VALUES
  ('admin', 'Acesso total ao sistema'),
  ('atendente', 'Acesso ao painel de atendimento')
ON CONFLICT (name) DO NOTHING;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'atendente',
  active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE
);

-- Criar índice no email para consultas rápidas
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Inserir usuário admin padrão
-- Senha: MedLago@2024 (hash bcrypt - deve ser trocada no primeiro acesso)
INSERT INTO users (name, email, password_hash, role, active, must_change_password)
VALUES (
  'Administrador',
  'admin@medlago.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewn7v4H5q6pDvqza',
  'admin',
  true,
  true
)
ON CONFLICT (email) DO NOTHING;
