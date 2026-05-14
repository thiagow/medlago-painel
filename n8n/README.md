# N8N Flows — MedLago

Documentação centralizada de todos os fluxos de automação N8N do chatbot clínico.

---

## 📁 Estrutura

```
n8n/
├── flows/
│   ├── ENTRADA E SAIDA CLINICA.json       (91 KB) — Gateway WhatsApp
│   ├── CLINICA CONSOLE.json               (173 KB) — Multi-agente IA
│   ├── ENCERRA CHATS INATIVOS.json        (6.8 KB) — Encerra chats parados
│   ├── Tool - Horarios.json               (4.9 KB) — Busca slots disponíveis
│   ├── Tool - Agendamento.json            (12 KB)  — Cria agendamento
│   ├── Tool - Cadastrar Paciente.json     (7.5 KB) — Registra paciente
│   ├── Tool - Busca Agenda.json           (3.0 KB) — Consulta consultas
│   ├── disparados-msg-manual-medlago.json (14 KB)  — Broadcast manual
│   └── disparos-msg-agendado-medlago.json (18 KB)  — Broadcast agendado
├── docs/
│   ├── OVERVIEW.md                        — Arquitetura geral
│   ├── FLOW_ENTRADA_SAIDA.md              — Flow 1: gateway de mensagens
│   ├── FLOW_CLINICA_CONSOLE.md            — Flow 2: IA multi-agente
│   ├── FLOW_ENCERRA_CHATS_INATIVOS.md     — Flow: encerramento automático
│   ├── FLOWS_TOOLS_AGENDAMENTO.md         — 4 tools de agendamento
│   ├── FLOWS_BROADCASTS.md                — 2 flows de broadcast
│   ├── STATE_MACHINE.md                   — Máquina de estados de chats
│   ├── INTEGRATION.md                     — Integração N8N ↔ Next.js app
│   └── DEBUG_GUIDE.md                     — Diagnóstico de bugs
└── README.md
```

---

## 🗂️ Catálogo de Fluxos

### Fluxos Principais (Chatbot WhatsApp)

| Flow | Arquivo | Trigger | Propósito |
|------|---------|---------|-----------|
| ENTRADA E SAIDA CLINICA | `ENTRADA E SAIDA CLINICA.json` | Webhook (Evolution API) | Gateway: recebe mensagens, normaliza, chama IA, envia resposta |
| CLINICA CONSOLE | `CLINICA CONSOLE.json` | Sub-workflow call | Brain IA: roteador → FAQ / agendamento / transfer humano |

**Docs:** [FLOW_ENTRADA_SAIDA.md](docs/FLOW_ENTRADA_SAIDA.md) · [FLOW_CLINICA_CONSOLE.md](docs/FLOW_CLINICA_CONSOLE.md)

---

### Tools de Agendamento (Sub-workflows da IA)

Chamados pelo `agente_agendador` dentro de CLINICA CONSOLE.

| Flow | Arquivo | Propósito |
|------|---------|-----------|
| Tool - Horarios | `Tool - Horarios.json` | Busca slots disponíveis em `igut_horarios_espelho` |
| Tool - Agendamento | `Tool - Agendamento.json` | Cria agendamento (iGUT API + banco local) |
| Tool - Cadastrar Paciente | `Tool - Cadastrar Paciente.json` | Registra paciente (iGUT API + banco local) |
| Tool - Busca Agenda | `Tool - Busca Agenda.json` | Consulta agendamentos existentes via iGUT |

**Doc:** [FLOWS_TOOLS_AGENDAMENTO.md](docs/FLOWS_TOOLS_AGENDAMENTO.md)

---

### Automações de Chat

| Flow | Arquivo | Trigger | Status |
|------|---------|---------|--------|
| ENCERRA CHATS INATIVOS | `ENCERRA CHATS INATIVOS.json` | Schedule (hourly) | ⚠️ INATIVO |

Encerra automaticamente chats com IA que ficaram mais de 2h sem resposta.  
**Doc:** [FLOW_ENCERRA_CHATS_INATIVOS.md](docs/FLOW_ENCERRA_CHATS_INATIVOS.md)

---

### Broadcasts (Disparo em Massa)

| Flow | Arquivo | Trigger | Propósito |
|------|---------|---------|-----------|
| disparados-msg-manual | `disparados-msg-manual-medlago.json` | Webhook (app) | Disparo manual acionado pelo app |
| disparos-msg-agendado | `disparos-msg-agendado-medlago.json` | Schedule (:05/h) | Disparo automático de campanhas agendadas |

**Doc:** [FLOWS_BROADCASTS.md](docs/FLOWS_BROADCASTS.md)

---

## 🚀 Quick Start

### Para Entender o Sistema

1. [OVERVIEW.md](docs/OVERVIEW.md) — arquitetura geral (5 min)
2. [STATE_MACHINE.md](docs/STATE_MACHINE.md) — estados de chat (4 min)
3. [INTEGRATION.md](docs/INTEGRATION.md) — como N8N + app se comunicam (6 min)

### Para Bugs

- Mensagem não respondida → [DEBUG_GUIDE.md](docs/DEBUG_GUIDE.md)
- Agendamento falhou → [FLOWS_TOOLS_AGENDAMENTO.md](docs/FLOWS_TOOLS_AGENDAMENTO.md#debug)
- Broadcast não disparou → [FLOWS_BROADCASTS.md](docs/FLOWS_BROADCASTS.md#debug)

### Para Implementar Features

1. Ler doc do flow relevante
2. Editar no N8N UI → exportar JSON → commitar
3. Atualizar doc se lógica crítica mudou

---

## 📊 Tabelas Postgres Usadas por Cada Flow

| Tabela | Flows que Escrevem | Flows que Leem |
|--------|-------------------|----------------|
| `chats` | ENTRADA E SAIDA, ENCERRA CHATS INATIVOS | ENTRADA E SAIDA, CLINICA CONSOLE |
| `chat_messages` | ENTRADA E SAIDA, ENCERRA CHATS INATIVOS | ENCERRA CHATS INATIVOS |
| `n8n_chat_histories` | CLINICA CONSOLE | CLINICA CONSOLE |
| `agendamentos` | Tool - Agendamento | — |
| `pacientes` | Tool - Agendamento, Tool - Cadastrar Paciente | — |
| `igut_horarios_espelho` | — (sync externa) | Tool - Horarios |
| `config_tokens` | — | Tool - Agendamento, Cadastrar Paciente, Busca Agenda |
| `broadcasts` | disparos-manual, disparos-agendado | disparos-agendado |
| `broadcast_recipients` | disparos-manual, disparos-agendado | disparos-manual, disparos-agendado |

---

## ⚠️ Alertas de Segurança

### API Key Evolution Hardcoded (CRÍTICO)
- **Arquivo:** `ENTRADA E SAIDA CLINICA.json`
- **Key:** `E8AC27FE8EDD-4AB7-BC78-F5E1914772BA`
- **Ação:** Rotacionar + mover para N8N Credentials

### Token UazAPI Hardcoded (Broadcasts)
- **Arquivos:** `disparados-msg-manual-medlago.json`, `disparos-msg-agendado-medlago.json`
- **Token:** `2d114856-315c-433a-96fb-5012c852c3c1`
- **Ação:** Mover para `$vars.UAZAPI_TOKEN` (consistente com ENCERRA CHATS INATIVOS)

---

## 📚 Índice de Documentação

| Documento | Quando Consultar |
|-----------|-----------------|
| [OVERVIEW.md](docs/OVERVIEW.md) | Primeira vez no projeto |
| [FLOW_ENTRADA_SAIDA.md](docs/FLOW_ENTRADA_SAIDA.md) | Bug em entrada/saída de mensagens |
| [FLOW_CLINICA_CONSOLE.md](docs/FLOW_CLINICA_CONSOLE.md) | Bug em IA ou roteamento de agentes |
| [FLOW_ENCERRA_CHATS_INATIVOS.md](docs/FLOW_ENCERRA_CHATS_INATIVOS.md) | Configurar encerramento automático |
| [FLOWS_TOOLS_AGENDAMENTO.md](docs/FLOWS_TOOLS_AGENDAMENTO.md) | Agendamento via IA / iGUT API |
| [FLOWS_BROADCASTS.md](docs/FLOWS_BROADCASTS.md) | Disparo de mensagens em massa |
| [STATE_MACHINE.md](docs/STATE_MACHINE.md) | Estados e transições de chats |
| [INTEGRATION.md](docs/INTEGRATION.md) | Como N8N e app se sincronizam |
| [DEBUG_GUIDE.md](docs/DEBUG_GUIDE.md) | Qualquer bug ou falha |

---

**Última atualização:** 2026-05-14
