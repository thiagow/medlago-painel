# N8N Debug — Diagnóstico e Troubleshooting de Fluxos

Checklist e procedimentos para debugar problemas comuns nos fluxos N8N do MedLago.

---

## 🚨 Diagnóstico Rápido: Mensagem Não Respondida

### 1. IA está pausada?

```sql
-- Check chat state
SELECT phone, status, ai_service, finished, assigned_to, updated_at 
FROM chats 
WHERE phone = '{telefone}';
```

**Se `ai_service='paused'`:**
- Transferência de humano foi acionada, OU
- Atendente pausou manualmente
- **Solução:** `UPDATE chats SET ai_service='active', updated_at=NOW() WHERE phone='{telefone}';`

### 2. Há mensagens antigas presas no Redis?

```bash
redis-cli
> LLEN "{phone_number}"         # Ver tamanho do buffer
> LRANGE "{phone_number}" 0 -1  # Ver conteúdo
> DEL "{phone_number}"          # Limpar (⚠️ use com cuidado)
```

**Se tamanho > 20:** há mensagens acumuladas. Limpar e testar nova mensagem.

### 3. Sub-workflow CLINICA CONSOLE falhou?

```
N8N UI → ENTRADA E SAIDA CLINICA (Flow 1)
→ Executions tab
→ Last execution → Look for "acionaMultiagentes" node
→ See error output
```

**Possíveis causas:**
- Workflow ID errado: `QkojhAJKkRHjxsth` (verificar em N8N)
- Sub-workflow está disabled
- Sub-workflow timeout (>30s)
- Input format incorreto (não tem query, identifier, telefone)

### 4. Evolution API retornou erro?

```
N8N UI → ENTRADA E SAIDA CLINICA
→ Find "enviaMensagem" node execution
→ Check error message
```

**Checklist:**
- API key expirada: `E8AC27FE8EDD-4AB7-BC78-F5E1914772BA` (rotate immediately!)
- Instance name errado: `clinicaMedLago` (bot) vs `medlago-agente` (human)
- Número WhatsApp formato: deve ser `+55 11 98765-4321` (com espaços/hífens)
- Payload JSON inválido

**Solução:** Verificar credentials em N8N, confirmar formato de número, testar webhook manualmente.

### 5. Postgres desconectou?

```
N8N UI → Check credential "Conexao Postgre"
→ Test connection
```

**Sinais:**
- `puxaDadosTelefone` node fails
- `salvaMensagemSaida` node fails
- `n8n_chat_histories` queries fail

**Solução:** Testar conexão, verificar DATABASE_URL, reiniciar N8N se necessário.

---

## 📞 Diagnóstico: Transfer para Humano Não Funcionou

### 1. Agente chamou a tool?

```
N8N UI → CLINICA CONSOLE (Flow 2)
→ Executions tab → Last execution
→ Look for node "agente_roteador"
→ See if tool "encaminhar_para_atendente_humano" was called
```

**Se não foi chamado:**
- Usuário não pediu pra falar com alguém
- Agent decidiu responder sozinho (pode estar correto)
- Check the agent thinking/reasoning in logs

### 2. Webhook URL está correta?

```
N8N UI → CLINICA CONSOLE → Node "encaminhar_para_atendente_humano"
Check: https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica
```

**Se diferente:** POSTs não são recebidos. Corrigir URL.

### 3. Webhook receiver está ativo?

```
N8N UI → Look for node "webhookRecebeTransferencia"
Check if node is "enabled" (não disabled)
```

**Se disabled:** POSTs chegam mas não são processadas. Enable.

### 4. N8N tem conectividade externa?

```bash
# From N8N server or local testing
curl -X POST https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica \
  -H "Content-Type: application/json" \
  -d '{"whatsapp": "+55 11 98765-4321", "resumo": "test", "motivo": "test"}'
```

**Se timeout/erro:** N8N firewall bloqueia OU webhook URL está down. Verificar conectividade.

---

## 📅 Diagnóstico: Agendamento Falhou

### 1. Sub-workflows existem?

```
N8N UI → Home → Search for each:
- "Horarios" (ID: Ti15LiLzS3d4MAFF)
- "Agendamento" (ID: EgvLRy83WG3tdPLp)
- "Cadastra_Paciente" (ID: OGFo2N2azQbrX7Ud)
- "Cancelar" (ID: 5luGQufc0ncksRpK)
```

**Se não encontrado:** ID está errado no agente. Verificar ID correto em N8N.

### 2. Paciente existe?

```sql
-- Check patient
SELECT * FROM vw_detalhe_consultas 
WHERE cpf='{cpf}' OR phone='{phone}';
```

**Se vazio:** Paciente novo. Agent deve chamar Cadastra_Paciente.
**Se Cadastra_Paciente falhou:** Agendamento falha.

Verificar logs do sub-workflow Cadastra_Paciente.

### 3. Há slots disponíveis?

```sql
-- Depende do schema exato, mas verificar algo como:
SELECT * FROM agendamentos 
WHERE medico_id=? AND data >= NOW() AND status='disponivel';
```

**Se vazio:** Agenda cheia, datas no passado, ou médico não existe.
**Solução:** Usar datas futuras, verificar médico existe.

### 4. Convênio é válido?

```sql
-- Check insurance plan
SELECT * FROM convenios 
WHERE id=? AND ativo=true;
```

**Se vazio:** Convênio ID errado ou foi desativado.
**Solução:** Verificar planos ativos no banco.

---

## 🧠 Diagnóstico: Agente "Esqueceu" Histórico da Conversa

### 1. Tabela de memória existe?

```sql
SELECT * FROM n8n_chat_histories LIMIT 1;
```

**Se erro:** Tabela não foi criada OU N8N não pode conectar Postgres.
**Solução:** Criar tabela (N8N faz auto-create se credential OK).

### 2. Identifier (phone) tem formato consistente?

```sql
-- Check if phone formats match
SELECT DISTINCT id FROM n8n_chat_histories 
WHERE id LIKE '%+55%' LIMIT 5;
```

**Problema comum:**
- Flow 1 passa: `+55 11 98765-4321` (com espaços/hífens)
- Flow 2 procura: `+5511987654321` (sem formatting)
- Não encontra histórico anterior

**Solução:** Standardizar formato de telefone em ambos os flows (remover hífens/espaços ou manter consistente).

### 3. Tabela foi limpada?

```sql
-- Check if histories exist
SELECT COUNT(*) FROM n8n_chat_histories;
SELECT * FROM n8n_chat_histories 
ORDER BY created_at DESC LIMIT 5;
```

**Se vazio:** Alguém rodou `DELETE` ou históricos expiraram.
**Solução:** Deixar tabela intacta, não limpar sem razão.

### 4. Sessão expirou?

```sql
-- Check if history is recent
SELECT * FROM n8n_chat_histories 
WHERE id='{identifier}' 
AND created_at > NOW() - interval '30 days';
```

**Se vazio:** Conversa é muito antiga (>30 dias). Memory foi expirada (normal).

---

## 🔐 Checklist: Segurança

### API Key Hardcoded em Plaintext (⚠️ CRITICAL)

**Localização:**
```
n8n/flows/ENTRADA E SAIDA CLINICA.json
→ Set node que define `evoAPIKey`
→ Value: E8AC27FE8EDD-4AB7-BC78-F5E1914772BA
```

**Risco:** Key em plaintext, visível em git history, exposto se JSON vaza.

**Ação Imediata:**
1. Rotacionar chave na Evolution API provider
2. Mover para N8N Credentials (UI, não hardcode)
3. Remover key antiga de git history:
   ```bash
   git filter-branch --tree-filter 'find . -name "*.json" -exec sed -i "s/E8AC27FE8EDD-4AB7-BC78-F5E1914772BA/REDACTED/g" {} \;'
   ```

---

## 🛠️ Procedimentos Utilitários

### Testar Webhook Manualmente

```bash
curl -X POST "https://n8n.example.com/webhook/0c81666b-84ce-47e2-be56-e793a9e5ab3a-10-10" \
  -H "evo-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "remoteJid": "+55 11 98765-4321",
    "message": "Teste de mensagem",
    "messageType": "text"
  }'
```

### Forçar Reativar IA

```sql
UPDATE chats 
SET ai_service='active', updated_at=NOW() 
WHERE phone='+55 11 98765-4321';
```

Próxima mensagem do usuário será respondida.

### Limpar Buffer Redis

```bash
redis-cli
> KEYS conversation_*           # Ver todos os buffers
> LLEN {conversation_id}        # Ver tamanho de um
> DEL {conversation_id}         # Limpar um
> FLUSHDB                       # NUCLEAR: limpar tudo (cuidado!)
```

### Ver Últimas Execuções de um Flow

```
N8N UI → Navigate to flow
→ Click "Executions" tab
→ Ver lista com timestamps e status (success/error)
→ Click um para ver detalhe
```

### Testar Sub-workflow Manualmente

```
N8N UI → CLINICA CONSOLE
→ Look for debug trigger node (chatTrigger se existe)
→ Click "Run"
→ Input: {"query": "...", "identifier": "+55 11...", "telefone": "+55 11..."}
→ Ver resultado de execução
```

---

## 📋 Tipos de Mensagem Suportados

| Tipo | Handler | Saída | Falha Comum |
|------|---------|-------|------------|
| `text` | Redis buffer → reconstruct | Texto como-é | Redis overflow |
| `audio` | HTTP fetch → Whisper | Texto transcrito | API key OpenAI vencida |
| `image` | HTTP fetch → gpt-4o-mini | Descrição da imagem | Image base64 inválido |
| `sticker` | HTTP fetch → gpt-4o-mini | Significado | Fetch URL falha |
| `document` | HTTP fetch → PDF extract | Texto extraído | PDF password-protected |
| (outros) | `noOp` | N/A | Descartado (normal) |

---

## 🔍 Checklist Antes de Escalar para Dev N8N

1. ✅ Confirmar state atual: `SELECT * FROM chats WHERE phone=?`
2. ✅ Confirmar Redis: `LLEN` tem conteúdo recente?
3. ✅ Confirmar memory: `SELECT * FROM n8n_chat_histories WHERE id=?`
4. ✅ Ver última execução: N8N UI → Executions tab
5. ✅ Testar webhook manualmente: `curl` com payload simples
6. ✅ Confirmar conectividade: ping Evolution API
7. ✅ Confirmar API keys: não expiradas em N8N credentials
8. ✅ Confirmar database: Postgres connection alive

**Se tudo acima OK e bug persiste:** É problema interno do N8N. Escalate com:
- Timestamp exato da falha
- Telefone afetado
- Payload que causou
- Screenshot do erro em N8N Executions

---

## 📚 Referência Cruzada

- Chat state machine: `n8n/docs/STATE_MACHINE.md`
- Flow 1 detalhes: `n8n/docs/FLOW_ENTRADA_SAIDA.md`
- Flow 2 detalhes: `n8n/docs/FLOW_CLINICA_CONSOLE.md`
- Integração com app: `n8n/docs/INTEGRATION.md`

---

**Rápido:** Mensagem não responde → Redis/AI paused/credentials  
**Médio:** Transfer não funciona → webhook URL/receiver active/connectivity  
**Complexo:** Agendamento falha → sub-workflow IDs/patient/slots/convenio  
**Segurança:** Keys em plaintext → rotate + move to credentials imediatamente
