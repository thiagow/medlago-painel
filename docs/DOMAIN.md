# Domain Model — MedLago

Glossário semântico e fluxos de negócio. Leia antes de propor mudanças no schema ou APIs de agendamento/conversas.

---

## Entidades Principais

### Chat & Messaging

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **Chat** | Conversa WhatsApp com um paciente | Tem status (`open`, `closed`, `waiting`), assigned_to (atendente), tags, department |
| **ChatMessage** | Mensagem individual | direction (`inbound`, `outbound`), content, media, timestamp, evolutionary tracking |
| **ChatMessageDeleteLog** | Auditoria de deletadas | Soft delete: mensagem deletada não é removida, apenas logged |
| **ChatTag** | Tag aplicada a chat | Categorização (ex: "urgente", "agendado", "resolvido") |

### Agendamento & Clínica

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **Agendamento** | Consulta/procedimento marcado | Status: `agendado`, `realizado`, `cancelado`, `pendente_confirmacao`. **Regra crítica:** cancelado/pendente REQUER campo `motivo` (compliance/auditoria) |
| **Paciente** | Registro de paciente | RG, CPF, datas, contatos (WhatsApp, email, telefone). Pode ter múltiplos agendamentos |
| **Profissional** | Médico/terapeuta | Nome, especialidade, disponibilidade (ou integrada com agendamento) |
| **Convenio** | Plano de saúde | Nome, código, valor de coparticipação |
| **TipoAtendimento** | Classificação de serviço | Consulta, procedimento, retorno, etc. |
| **Department** | Departamento/setor | Agrupa profissionais, agendamentos, permissões de atendente |

### Broadcast & Mensagens em Massa

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **Broadcast** | Campanha de mensagem em massa | Status: `draft`, `scheduled`, `sending`, `sent`, `failed`. Filtros por tags/departments/data |
| **BroadcastRecipient** | Membro da campanha | Links chat/paciente ao broadcast, rastreia status (`pending`, `sent`, `failed`) |
| **MessageTemplate** | Template reutilizável | Variáveis `{{nome}}`, `{{data}}`, suporta media |

### NPS & Feedback

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **NpsConfig** | Configuração de pesquisa NPS | Ativa/desativa, define trigger (ex: após agendamento realizado), mensagem customizada |
| **NpsResponse** | Resposta de NPS enviada | Score (0-10), feedback texto, timestamp |

### Usuários & Controle de Acesso

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **User** | Atendente ou admin | Email, role (`admin` \| `atendente`), departments (many-to-many via UserDepartment) |
| **UserDepartment** | Associação usuário ↔ departamento | Define escopo de acesso (admin pode ver tudo, atendente vê só seu(s) department(s)) |

### Contatos Externos & Transferências

| Entidade | Propósito | Pontos-chave |
|----------|-----------|--------------|
| **ExternalContact** | Contato fora do sistema (ex: especialista externo) | Nome, WhatsApp, especialidade |
| **ChatTransferLog** | Auditoria de transferências | De/para (usuário/contato externo), razão, timestamp |

---

## Glossário PT → EN

Use em comentários de código e documentação técnica:

| PT-BR | EN | Contexto |
|-------|----|----|
| agendamento | appointment | Consulta/procedimento marcado |
| paciente | patient | Pessoa que faz consulta |
| profissional | provider/professional | Médico/terapeuta |
| convenio | health_plan | Plano de saúde |
| tipo_atendimento | service_type | Classificação de consulta |
| atendente | agent/attendant | Operador que responde chats |
| departamento | department | Setor/time |
| motivo | reason | Justificativa para status (ex: cancelamento) |
| disparos | broadcasts | Mensagens em massa |

---

## Fluxos de Negócio

### Fluxo de Conversa (Chat Lifecycle)

```
1. [WhatsApp entrada] → webhook N8N
2. N8N cria/atualiza Chat + ChatMessage (inbound)
3. Chat fica em status "waiting" ou "open"
4. Atendente visualiza em /dashboard/conversations
5. Atendente responde → ChatMessage (outbound) via Evolution API
6. Chat permanece open até:
   - Atendente marca como closed
   - Timeout (configurável, não implementado ainda)
7. ChatMessageDeleteLog registra se mensagens forem deletadas
```

**Pontos críticos:**
- Sempre rastrear direção (`inbound` vs `outbound`)
- Soft delete de mensagens (nunca remover do DB)
- Assignment a atendente é rastreado (audit)

### Fluxo de Agendamento (Appointment Lifecycle)

```
1. Agendamento criado → status "agendado"
2. Transições possíveis:
   - agendado → realizado (pós-consulta)
   - agendado → cancelado (requer motivo)
   - agendado → pendente_confirmacao (requer confirmação do paciente)
   - pendente_confirmacao → agendado (paciente confirmou)
   - pendente_confirmacao → cancelado (requer motivo)
3. Broadcast pode pedir confirmação automaticamente
4. NPS dispara após realizado (se ativo)
```

**Regra crítica (dae998e):**
- Status `cancelado` e `pendente_confirmacao` EXIGEM campo `motivo` preenchido
- Campo `motivo` é obrigatório, não nullable
- Validação acontece em:
  - API ao atualizar status
  - UI não permite submit sem motivo

### Fluxo de Broadcast (Campaign Lifecycle)

```
1. Admin cria broadcast em draft
2. Define filtros: tags, departments, intervalo de data, pacientes específicos
3. Seleciona template (ou cria inline)
4. Preview + confirma
5. Status muda para scheduled (se futura) ou sending
6. Para cada BroadcastRecipient:
   - Envia message via Evolution API
   - Registra status (sent/failed)
   - Rastreia em ChatMessage (direction: outbound, broadcast_id)
7. Analytics: % sent, % failed, taxa de resposta
```

---

## Regras de Negócio Críticas

1. **Motivo obrigatório** em agendamentos `pendente_confirmacao` e `cancelado` (compliance/auditoria)
2. **Dois endpoings WhatsApp separados:** bot IA usa `EVO_INSTANCE_BOT`, atendente usa `EVO_INSTANCE_HUMANO` (isolamento)
3. **Soft delete:** mensagens nunca são deletadas, apenas logged em `ChatMessageDeleteLog`
4. **Presigned URLs:** média no R2 é servida via proxy presigned com TTL 2h (compliance LGPD)
5. **RBAC atendente:** visualiza chats/agendamentos/broadcasts só de seus departments
6. **Timezone:** datas em UTC no DB, frontend converte para timezone do usuário (não implementado ainda)

---

## Entidades Que Mudam Frequentemente

- **Chat status** — conforme IA e atendentes interagem
- **Agendamento status** — consulta realizada, cancelada, confirmada
- **Broadcast status** — enviando, enviado, falhou
- **BroadcastRecipient status** — por mensagem dentro da campanha

**Ao consultar:** sempre filtrar por status correto, não assumir que "existe" significa "ativo".

---

## Campos de Auditoria Implícitos

Esperados mas nem sempre documentados no schema:

- `created_at` — quando registro foi criado
- `updated_at` — última modificação
- `created_by` — usuário que criou (quando relevante)
- `deleted_at` — para soft deletes (chat, mensagem etc.)

Adicionar explicitamente se não existirem.
