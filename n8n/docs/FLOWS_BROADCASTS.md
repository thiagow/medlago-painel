# Flows: Broadcasts — Disparo em Massa de Mensagens WhatsApp

Dois fluxos complementares para disparo de mensagens em massa para listas de pacientes. Um é acionado manualmente via webhook (pelo app), o outro roda automaticamente por agendamento.

---

## Arquivos

- `n8n/flows/disparados-msg-manual-medlago.json` (13.5 KB) — disparo manual
- `n8n/flows/disparos-msg-agendado-medlago.json` (18.3 KB) — disparo automático agendado

---

## Arquitetura Compartilhada

Ambos os flows compartilham a mesma lógica de envio:

```
Busca recipients não-enviados
       ↓
Loop por recipient
       ↓
Personaliza template          ← substitui {nome}, {hoje}, {amanha}
       ↓
Delay aleatório 10–40s        ← anti-spam WhatsApp
       ↓
Tem imagem?
  SIM → Envia imagem (UazAPI /send/media) → Delay 10–40s → Envia texto
  NÃO → Envia texto diretamente (UazAPI /send/text)
       ↓
Marca recipient: 'sent' ou 'error'
       ↓
[próximo recipient...]
       ↓
Quando acabar: marca broadcast: 'completed'
```

---

## API UazAPI — Envio de Mensagens

**Base URL:** `https://medlago.uazapi.com`

**Endpoints:**
```http
POST /send/text
{
  "number": "+5511987654321",
  "text": "Olá {nome}..."
}

POST /send/media  
{
  "number": "+5511987654321",
  "mediaUrl": "https://...",
  "caption": "Texto opcional"
}
```

**Auth:** Header `Authorization: Bearer {token}` com token UazAPI.

### ⚠️ Segurança — Token Hardcoded

Ambos os flows de broadcast têm o token UazAPI **hardcoded em plaintext**:
```
Token: 2d114856-315c-433a-96fb-5012c852c3c1
```

Isso é inconsistente com `ENCERRA CHATS INATIVOS` que usa `$vars.UAZAPI_TOKEN` corretamente.

**Ação recomendada:** Mover para N8N Variables (`$vars.UAZAPI_TOKEN`) em ambos os flows.

---

## Flow 1: disparados-msg-manual-medlago

### Trigger

**Webhook POST** — path: `ce6d35bb-e4b4-4bf8-9579-0d46697b6c88`

```
URL: https://{n8n-host}/webhook/ce6d35bb-e4b4-4bf8-9579-0d46697b6c88
```

Acionado pelo app Next.js quando um atendente/admin inicia um broadcast manualmente.

### Input (POST body)

```json
{
  "broadcast_id": "uuid-do-broadcast",
  "template": {
    "body": "Olá {nome}! Sua consulta está marcada para {amanha}.",
    "image_url": "https://storage.example.com/banner.jpg"
  }
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `broadcast_id` | UUID | ID do broadcast em `broadcasts` table |
| `template.body` | string | Template com placeholders `{nome}`, `{hoje}`, `{amanha}` |
| `template.image_url` | string | URL de imagem (opcional — string vazia = sem imagem) |

### Fluxo Completo

```
[Webhook]
  ↓
[Variáveis]               ← extrai template, broadcast_id, image_url; define evoAPIKey
  ↓
[buscaListaDisparo]       ← SELECT recipients não-enviados
  ↓
[Loop Over Items]
  ├─ branch 0 (done): → [marcaBroadcastConcluido]
  └─ branch 1 (item):
       ↓
       [formataMensagem]  ← substitui placeholders, extrai telefone
       ↓
       [Wait] 10–40s
       ↓
       [temImagem?]
         SIM: [EnviaImagem] → [Wait2] 10–40s → [EnviaMensagem]
         NÃO: [EnviaMensagem]
       ↓
       sucesso: [marcaEnviado] → [voltaLoop]
       erro:    [marcaErro]   → [voltaLoop]
```

### Query de Recipients

```sql
SELECT r.id, r.broadcast_id, r.phone, r.name, r.status
FROM broadcast_recipients r
WHERE r.broadcast_id = '{broadcast_id}'
  AND r.status NOT IN ('sent')
```

Pega todos que ainda não foram enviados, incluindo `error` (permite retry).

### Template Personalização

```javascript
const hoje = new Date().toLocaleDateString('pt-BR');
const amanha = new Date(Date.now() + 86400000).toLocaleDateString('pt-BR');

mensagem = template.body
  .replace(/{nome}/g, recipient.name)
  .replace(/{hoje}/g, hoje)
  .replace(/{amanha}/g, amanha);
```

**Placeholders disponíveis:**
- `{nome}` → nome do recipient
- `{hoje}` → data de hoje (DD/MM/YYYY)
- `{amanha}` → data de amanhã (DD/MM/YYYY)

### Update de Status

```sql
-- Sucesso
UPDATE broadcast_recipients SET status = 'sent', sent_at = NOW() WHERE id = '{id}'

-- Erro
UPDATE broadcast_recipients SET status = 'error', error = '{mensagem_erro}' WHERE id = '{id}'
```

### Finalização

```sql
UPDATE broadcasts SET status = 'completed' WHERE id = '{broadcast_id}'
```

---

## Flow 2: disparos-msg-agendado-medlago

### Trigger

**Schedule** — todo `:05` de cada hora (ex: 08:05, 09:05, ... 16:05)

### Gate: Horário Comercial

```javascript
const hora = new Date().getHours(); // UTC local do servidor N8N
if (hora < 8 || hora >= 17) {
  // Para a execução — fora do horário comercial
  return false;
}
```

**Executa apenas entre 08:00 e 16:59.** Broadcasts agendados para horários fora desse range são pulados até o próximo dia útil.

### Busca de Broadcasts Pendentes

```sql
SELECT id, template_body, image_url, scheduled_at
FROM broadcasts
WHERE status = 'pending'
  AND scheduled_at <= NOW()
  AND scheduled_at >= NOW() - INTERVAL '1 HOUR'
```

**Grace window de 1 hora:** broadcasts com `scheduled_at` mais antigo que 1 hora são ignorados (evita disparar campanhas muito atrasadas).

### Transição de Estado do Broadcast

```
pending → processing → completed
```

```sql
-- Ao iniciar processamento (evita double-processing)
UPDATE broadcasts SET status = 'processing' WHERE id = '{id}'

-- Ao finalizar todos os recipients
UPDATE broadcasts SET status = 'completed' WHERE id = '{id}'
```

### Loop Duplo

```
[Loop Over Broadcasts]    ← loop externo: um por broadcast
  └─ [Loop Over Items]    ← loop interno: um por recipient
       └─ mesma lógica de envio do flow manual
```

O loop externo garante que um único schedule run pode processar múltiplos broadcasts simultâneos.

---

## Tabelas

| Tabela | Operação | Quando |
|--------|---------|--------|
| `broadcasts` | SELECT | busca broadcasts pending |
| `broadcasts` | UPDATE status='processing' | ao iniciar (scheduled only) |
| `broadcasts` | UPDATE status='completed' | ao finalizar |
| `broadcast_recipients` | SELECT | busca recipients não-enviados |
| `broadcast_recipients` | UPDATE status='sent' | após envio bem-sucedido |
| `broadcast_recipients` | UPDATE status='error' | após falha |

### Schema Esperado

```sql
-- broadcasts
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY,
  status VARCHAR,          -- 'pending' | 'processing' | 'completed'
  template_body TEXT,      -- template com placeholders
  image_url TEXT,          -- URL de imagem (opcional)
  scheduled_at TIMESTAMPTZ -- null = manual, datetime = agendado
);

-- broadcast_recipients
CREATE TABLE broadcast_recipients (
  id UUID PRIMARY KEY,
  broadcast_id UUID REFERENCES broadcasts(id),
  phone VARCHAR,           -- número no formato aceito pela UazAPI
  name VARCHAR,            -- nome para substituição de {nome}
  status VARCHAR,          -- 'pending' | 'sent' | 'error'
  sent_at TIMESTAMPTZ,
  error TEXT
);
```

---

## Comportamento de Retry

| Cenário | Comportamento |
|---------|--------------|
| Falha na UazAPI (texto) | 5 retentativas automáticas, 5s entre tentativas |
| Falha na UazAPI (imagem) | 5 retentativas automáticas, 5s entre tentativas |
| Após retentativas esgotadas | marca recipient como `status='error'` e continua |
| Recipient em `error` | será re-processado no próximo disparo (manual requery) |

---

## Debug

### "Broadcast manual não disparou"

1. **Webhook foi chamado?**
   ```
   N8N UI → disparados-msg-manual-medlago → Executions tab
   Verificar se há execução recente
   ```
2. **`broadcast_id` existe?**
   ```sql
   SELECT * FROM broadcasts WHERE id = '{broadcast_id}';
   ```
3. **Há recipients pendentes?**
   ```sql
   SELECT status, COUNT(*) FROM broadcast_recipients 
   WHERE broadcast_id = '{broadcast_id}' GROUP BY status;
   ```
4. **Webhook URL no app está correto?**
   - Path esperado: `ce6d35bb-e4b4-4bf8-9579-0d46697b6c88`

### "Broadcast agendado não disparou"

1. **Status é 'pending'?**
   ```sql
   SELECT id, status, scheduled_at FROM broadcasts WHERE status = 'pending';
   ```
2. **`scheduled_at` está no range?**
   ```sql
   SELECT NOW() AS agora, scheduled_at,
     CASE WHEN scheduled_at BETWEEN NOW() - INTERVAL '1 HOUR' AND NOW() THEN 'DENTRO DO RANGE' ELSE 'FORA' END AS situacao
   FROM broadcasts WHERE id = '{id}';
   ```
3. **É horário comercial no servidor N8N?** (08:00–16:59 no timezone do servidor)
4. **Flow está ativo?** Verificar N8N UI → Toggle ativo

### "Mensagens enviadas mas aparece como 'error'"

1. **UazAPI está respondendo?**
   ```bash
   curl -X POST https://medlago.uazapi.com/send/text \
     -H "Authorization: Bearer 2d114856-315c-433a-96fb-5012c852c3c1" \
     -H "Content-Type: application/json" \
     -d '{"number": "+5511987654321", "text": "Teste"}'
   ```
2. **Formato do número:** deve ser `+55DDDNÚMERO` sem espaços
3. **Token expirado?** Atualizar token nos flows ou mover para `$vars.UAZAPI_TOKEN`

### "Template não está substituindo placeholders"

Verificar se o template usa exatamente `{nome}`, `{hoje}`, `{amanha}` (com chaves, minúsculas, sem espaços).

---

**Próxima leitura:**
- Configuração de broadcasts no app: rotas em `src/app/api/broadcasts/`
- Debug geral: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
