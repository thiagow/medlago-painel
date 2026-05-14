# Debug Guide — Troubleshooting N8N Flows

Checklist e procedimentos para diagnosticar bugs comuns.

---

## 🐛 "Mensagem não respondida" — Checklist

### 1. IA Pausada?

```sql
-- Check if IA is paused
SELECT phone, ai_service, updated_at FROM chats WHERE phone=?;
```

**Se `ai_service='paused'`:**
- Atendente pausou manualmente, OU
- Transfer para humano foi acionado
- **Solução:** `UPDATE chats SET ai_service='ai'` (reativa)

### 2. Redis Travado?

```bash
redis-cli
> LLEN {conversation_id}  # See buffer size
> LRANGE {conversation_id} 0 -1  # See messages
> DEL {conversation_id}  # Clear if stuck (CAREFUL!)
```

**Se há muitas mensagens antigas:**
- Debounce timeout pode estar muito longo
- OU cache não foi limpo
- **Solução:** `DEL conversation_id` após verificar

### 3. Sub-workflow CLINICA CONSOLE Falhou?

```
N8N UI → Executions → Last execution of ENTRADA E SAIDA
Look for error in "acionaMultiagentes" node
```

**Possíveis causas:**
- Workflow ID está errado: `QkojhAJKkRHjxsth`
- Sub-workflow está disabled
- Sub-workflow timed out
- Input format incorreto

### 4. Evolution API Erro?

```
N8N UI → Executions → Find "enviaMensagem" node error
```

**Comum:**
- API key expirada: `E8AC27FE8EDD-4AB7-BC78-F5E1914772BA` (HARDCODED - danger!)
- Instance name errado: `clinicaMedLago` (bot) vs `medlago-agente` (human)
- WhatsApp number format: must be `+55 11 98765-4321`
- Payload JSON invalid

**Solução:**
1. Rotacionar API key
2. Verificar instance name em N8N Set nodes
3. Validar formato de número

### 5. Postgres Connection Lost?

```
N8N UI → Executions → Check credentials "Conexao Postgre"
```

**Sinais:**
- `puxaDadosTelefone` node fails
- `salvaMensagemSaida` node fails
- Cannot read `chats` table

**Solução:**
1. Testar conexão em Postgres credential UI
2. Verificar `DATABASE_URL` em N8N environment
3. Verificar if Postgres server está online

### 6. OpenAI Quota?

```
N8N UI → Executions → Look for OpenAI node errors
```

**Sinais:**
- Audio transcription fails (Whisper)
- Image analysis fails (gpt-4o-mini)
- Message formatting fails (gpt-4.1-mini)

**Solução:**
1. Check OpenAI account quota/billing
2. Verify API key: `iqtbz71A05CuNmUB`
3. Check if rate limit hit

---

## 💬 "Transfer para Humano Não Disparou" — Checklist

### 1. Agent Chamou Tool?

Verificar se agente realmente decidiu transferir:

```
N8N UI → Executions → CLINICA CONSOLE
Look at agente_roteador output
Was "encaminhar_para_atendente_humano" called?
```

**Se não foi chamado:**
- User não pediu para falar com alguém
- Agent decidiu responder sozinho
- Isso é correto!

### 2. HTTP Tool Endpoint?

```
N8N UI → CLINICA CONSOLE → Node "encaminhar_para_atendente_humano"
Check URL: https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica
```

**Se errado:**
- Webhooks não são recebidos
- `webhookRecebeTransferencia` não executa
- Chat não é pausado

**Solução:** Corrigir URL no HTTP Tool node

### 3. Webhook Receiver Ativo?

```
N8N UI → CLINICA CONSOLE → Node "webhookRecebeTransferencia"
Check if node is active (não disabled)
```

**Se disabled:**
- POSTs chegam mas não são processadas
- Chat não é pausado

**Solução:** Enable o nó

### 4. N8N Tem Conectividade Externa?

```bash
# From N8N server
curl -X POST https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica \
  -H "Content-Type: application/json" \
  -d '{"whatsapp": "+55 11", "resumo": "test", "motivo": "test"}'
```

**Se não responde:**
- N8N firewall bloqueia
- Webhook URL está down
- CORS issue

**Solução:** Verificar firewall, testar conectividade

---

## 📋 "Agendamento Não Funcionou" — Checklist

### 1. Sub-workflow IDs

Verificar se sub-workflows existem no N8N:

```
N8N UI → Home → Search for:
- "Horarios" (ID: Ti15LiLzS3d4MAFF)
- "Agendamento" (ID: EgvLRy83WG3tdPLp)
- "Cadastra_Paciente" (ID: OGFo2N2azQbrX7Ud)
- "Cancelar" (ID: 5luGQufc0ncksRpK)
```

**Se não encontrado:**
- ID está errado no agente_agendador
- Sub-workflow foi deletado
- Sub-workflow está em outro N8N server

**Solução:** Verificar ID correto, recreate se necessário

### 2. SQL Paciente Não Encontrado

```sql
-- Check if patient exists
SELECT * FROM vw_detalhe_consultas WHERE cpf=? OR phone=?;
```

**Se não existe:**
- Novato usuário → agente chama Cadastra_Paciente
- Se Cadastra_Paciente falha → agendamento falha

**Solução:** Verificar logs do Cadastra_Paciente sub-workflow

### 3. Slots Indisponíveis

```sql
-- Check if doctor has availability
SELECT * FROM ... WHERE medico_id=? AND data >= NOW();
-- (Exact query depends on your schema)
```

**Se vazio:**
- Doctor está com agenda cheia
- Data está no passado
- Doctor não existe

**Solução:** Usar datas futuras, verificar médico existe

### 4. Convenio Inválido

```sql
-- Check if insurance plan is valid
SELECT * FROM convenios WHERE id=? AND ativo=true;
```

**Se não existe:**
- Convenio ID errado
- Convenio foi desativado
- Paciente escolheu plan inválido

**Solução:** Verificar plans ativos no banco

---

## 🧠 "Agente Não Lembra da Conversa" — Checklist

### 1. Memory Tabela Existe?

```sql
SELECT * FROM n8n_chat_histories LIMIT 1;
```

**Se erro:**
- Tabela não foi criada
- N8N não pode conectar ao Postgres

**Solução:** Criar tabela (N8N faz auto-create se credential OK)

### 2. Identifier Format

Verificar se phone format é consistente:

```
N8N Input (Flow 1 → Flow 2):
  identifier: "+55 11 98765-4321"

Postgres (chat histories):
  SELECT * FROM n8n_chat_histories 
  WHERE id LIKE '%+55 11%'
```

**Se format diferente:**
- Flow 1 passa `+55 11 9876-5432` (hiphen)
- Memory procura `+5511987654321` (sem formatting)
- Não encontra histórico anterior

**Solução:** Standardizar format em ambos os flows

### 3. Tabela Limpa?

```sql
-- Check if histories still exist
SELECT COUNT(*) FROM n8n_chat_histories;
SELECT * FROM n8n_chat_histories ORDER BY created_at DESC LIMIT 5;
```

**Se vazio:**
- Alguém rodou `DELETE FROM n8n_chat_histories`
- OU históricos expiraram (database retention policy)

**Solução:** Deixar tabela intacta, verificar retention policies

### 4. Session Expirado?

```sql
SELECT * FROM n8n_chat_histories 
WHERE id=? AND created_at > NOW() - interval '30 days';
```

**Se vazio:**
- Conversa é muito antiga (>30 dias)
- Memory foi expirada

**Solução:** Normal - históricos antigos não são guardados forever

---

## 📦 "Broadcast Não Disparou" — Checklist

### 1. Manual (webhook)

**Flow não recebeu chamada?**
```
N8N UI → disparados-msg-manual-medlago → Executions tab
Verificar se há execução recente com timestamp correto
```

**`broadcast_id` existe no banco?**
```sql
SELECT id, status, template_body FROM broadcasts WHERE id = '{broadcast_id}';
```

**Há recipients pendentes?**
```sql
SELECT status, COUNT(*) FROM broadcast_recipients 
WHERE broadcast_id = '{broadcast_id}' GROUP BY status;
```

**Webhook URL correta no app?**
- Path esperado: `ce6d35bb-e4b4-4bf8-9579-0d46697b6c88`

### 2. Agendado (schedule)

**Status é 'pending' e no range de 1h?**
```sql
SELECT id, status, scheduled_at,
  CASE WHEN scheduled_at BETWEEN NOW() - INTERVAL '1 HOUR' AND NOW() 
    THEN 'NO RANGE' ELSE 'FORA DO RANGE' END AS situacao
FROM broadcasts WHERE status IN ('pending', 'processing');
```

**É horário comercial?** (08:00–16:59 no timezone do servidor N8N)

**Flow está ativo?** N8N UI → Toggle ativo

### 3. Token UazAPI expirado/inválido

```bash
curl -X POST https://medlago.uazapi.com/send/text \
  -H "Authorization: Bearer 2d114856-315c-433a-96fb-5012c852c3c1" \
  -H "Content-Type: application/json" \
  -d '{"number": "+5511987654321", "text": "Teste"}'
```

**Se 401/403:** Token expirado ou inválido. Renovar e atualizar no flow.

---

## 📅 "Tool de Agendamento Falhou" — Checklist

### 1. Médico não foi encontrado

```sql
-- Verificar nome exato no banco
SELECT id, nome FROM public.profissionais 
WHERE UNACCENT(UPPER(nome)) LIKE UNACCENT(UPPER('%{nome_buscado}%'));
```

Se o fuzzy match retornar distância > 0.8, o resultado será NULL e o agendamento falhará.

### 2. Token iGUT expirado

```sql
SELECT token, expires_at, 
  CASE WHEN expires_at > NOW() THEN 'VÁLIDO' ELSE 'EXPIRADO' END AS status
FROM config_tokens WHERE service = 'igut_api';
```

**Se expirado:**
```sql
UPDATE config_tokens 
SET token = '{novo_token}', expires_at = NOW() + INTERVAL '30 days'
WHERE service = 'igut_api';
```

### 3. Slot não aparece mas médico existe

```sql
-- Verificar tabela espelho
SELECT * FROM igut_horarios_espelho 
WHERE UNACCENT(UPPER(nome_medico)) LIKE UNACCENT(UPPER('%{nome}%'))
LIMIT 10;
```

Se vazio: sincronização de `igut_horarios_espelho` com iGUT pode estar desatualizada.

### 4. CPF inválido

O flow valida `cpf.length !== 11` após strip de não-dígitos. Garantir que o CPF passado pelo agente tem exatamente 11 dígitos.

---

## 🔕 "Chats Inativos Não Estão Sendo Encerrados" — Checklist

### 1. Flow está ativo?

```
N8N UI → "ENCERRA CHATS INATIVOS — IA"
→ Verificar toggle ativo/inativo
→ Status atual: INATIVO (active: false no JSON)
```

### 2. Há chats inativos que deveriam ser encerrados?

```sql
SELECT c.id, c.phone, MAX(cm.created_at) AS ultima_mensagem_bot
FROM chats c
JOIN chat_messages cm ON cm.chat_id = c.id AND cm.direction = 'outbound'
WHERE c.finished = false AND c.ai_service = 'active'
GROUP BY c.id, c.phone
HAVING MAX(cm.created_at) < NOW() - INTERVAL '2 hours';
```

### 3. UazAPI está respondendo?

```bash
curl -X POST https://medlago.uazapi.com/send/text \
  -H "Authorization: Bearer {UAZAPI_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"number": "+5511987654321", "text": "Teste"}'
```

### 4. `$vars.UAZAPI_TOKEN` está configurado?

```
N8N UI → Settings → Variables
Verificar se UAZAPI_TOKEN está definido
```

---

## 🔴 "API Key Hardcoded" — Security Alert

### Localização 1: Evolution API (CRÍTICO)

```
ENTRADA E SAIDA CLINICA.json
→ [Set node que define `evoAPIKey`]
→ Value: E8AC27FE8EDD-4AB7-BC78-F5E1914772BA
```

### Localização 2: UazAPI Token (Broadcasts)

```
disparados-msg-manual-medlago.json   → [Variáveis] → evoAPIKey
disparos-msg-agendado-medlago.json   → [Variáveis] → evoAPIKey
→ Value: 2d114856-315c-433a-96fb-5012c852c3c1
```

**Nota:** `ENCERRA CHATS INATIVOS` usa `$vars.UAZAPI_TOKEN` corretamente — os outros deveriam fazer o mesmo.

### Risco

- Keys em plaintext no JSON
- Visíveis em git history
- Expostas se JSON vazar

### Solução

1. **Rotacionar keys imediatamente** (Evolution API + UazAPI providers)
2. **Mover para N8N Variables:**
   - Settings → Variables → Criar `UAZAPI_TOKEN`, `EVO_API_KEY`
   - Referenciar como `$vars.UAZAPI_TOKEN` nos flows
3. **Remover de git history:**
   ```bash
   git filter-branch --tree-filter 'find . -name "*.json" -exec sed -i "s/E8AC27FE8EDD-4AB7-BC78-F5E1914772BA/REDACTED/g" {} \;'
   ```

---

## 🔧 Procedimentos Úteis

### Limpar Redis Buffer

```bash
redis-cli
> KEYS conversation_*  # See all conversation buffers
> DEL conversation_id1 conversation_id2 ...  # Delete specific ones
> FLUSHDB  # NUCLEAR: clear everything (BE CAREFUL!)
```

### Testar Webhook Manualmente

```bash
curl -X POST https://n8n.example.com/webhook/0c81666b... \
  -H "evo-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "remoteJid": "+55 11 98765-4321",
    "message": "Teste",
    "messageType": "text"
  }'
```

### Forçar Reativar IA

```sql
UPDATE chats 
SET ai_service='ai', updated_at=NOW() 
WHERE phone='+55 11 98765-4321';
```

### Ver Últimas 5 Execuções de Flow

```
N8N UI → ENTRADA E SAIDA CLINICA
→ Executions tab
→ Scroll down para ver histórico
```

### Testar Sub-workflow Manualmente

```
N8N UI → CLINICA CONSOLE
→ Find test trigger (chatTrigger node)
→ Click "Run"
→ Input manual query
→ See execution
```

---

## 📱 Chat State Reference

Quando chat está em que estado:

| Estado | Quando | N8N Faz | App Mostra |
|--------|--------|---------|-----------|
| IA respondendo | Fresh chat | Chama CLINICA CONSOLE | "Chat com IA" |
| IA pausa | Atendente pausou ou transfer disparou | Bloqueia chamada | "Transferring..." |
| Humano responde | `ai_service='paused'` e atendente escolhe | Só registra | "Conversation com humano" |
| Finished | Atendente marca como pronto | Nada | "Archived" |

Detalhes em [STATE_MACHINE.md](STATE_MACHINE.md)

---

## 📞 Escalar para Desenvolvedor N8N

Se tudo acima falhar:

1. **Collect:**
   - Exact timestamp da falha
   - Último log do N8N Execution
   - Número de telefone afetado
   - Que tipo de mensagem (text/audio/image)
   - Erro exato (screenshot)

2. **Check:**
   - N8N logs for that execution
   - Postgres logs (connection errors)
   - Evolution API status page
   - OpenAI API status page

3. **Escalate:**
   - Abrir issue no repo com logs
   - Contactar N8N support se problem é com N8N
   - Contactar Evolution API se problem é com webhook

---

**Rápido:** Se mensagem simples não responde → redis/pause/IA gateway.  
**Complexo:** Se agendamento falha → sub-workflow dependencies.  
**Segurança:** Se expose keys → rotate + move to credentials.
