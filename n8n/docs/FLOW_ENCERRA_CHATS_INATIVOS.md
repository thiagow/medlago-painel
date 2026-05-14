# Flow: ENCERRA CHATS INATIVOS — IA

Automação que detecta chats de IA parados há mais de 2 horas e os encerra automaticamente, enviando uma mensagem de despedida.

---

## Info Básica

- **Arquivo:** `n8n/flows/ENCERRA CHATS INATIVOS.json`
- **Tamanho:** 6.9 KB
- **Status:** ⚠️ **INATIVO** (`active: false`) — desabilitado no N8N
- **Trigger:** Schedule — a cada 1 hora
- **Tabelas:** `chats` (SELECT + UPDATE), `chat_messages` (SELECT + INSERT)
- **API:** UazAPI `/send/text`

---

## Propósito

Evitar que chats em estado `ai` fiquem "presos" indefinidamente sem atendimento. Quando o bot não responde há mais de 2 horas (sem nenhuma mensagem nova do paciente), o sistema assume que a conversa foi abandonada e a encerra graciosamente.

---

## Fluxo Passo a Passo

```
[scheduleTrigger]               ← dispara a cada 1 hora
       ↓
[buscaChatsInativos]            ← SELECT chats inativos (ver query abaixo)
       ↓
[verificaSeExistemChats]        ← IF: count > 0?
    YES ↓             NO → [nenhumChatInativo] (NoOp — para aqui)
[enviaMensagemEncerramento]     ← HTTP POST UazAPI /send/text
       ↓
[encerraChat]                   ← UPDATE chats SET status/ai_service/finished
       ↓
[gravaLogEncerramento]          ← INSERT chat_messages (log de auditoria)
```

---

## Query: Chats Inativos

```sql
SELECT c.id, c.phone
FROM chats c
WHERE c.finished = false
  AND c.ai_service = 'active'
  AND (
    SELECT MAX(cm.created_at)
    FROM chat_messages cm
    WHERE cm.chat_id = c.id
      AND cm.direction = 'outbound'   -- última mensagem do bot
  ) < NOW() - INTERVAL '2 hours'
```

**Critérios de inatividade:**
- Chat não está encerrado (`finished = false`)
- IA ainda está ativa (`ai_service = 'active'`)
- Última mensagem de saída do bot tem mais de 2 horas

---

## Mensagem de Encerramento

Enviada via UazAPI para o número do paciente:

> "Olá! Percebemos que nossa conversa ficou um tempo sem atividade. Para garantir um atendimento melhor, encerramos esta sessão. Se precisar de ajuda novamente, é só nos chamar! Clínica MedLago — Lilian 😊"

**Instância UazAPI:** `medlago-agente`  
**Endpoint:** `https://medlago.uazapi.com/send/text`  
**Auth:** `$vars.UAZAPI_TOKEN` (variável N8N — correto, não hardcoded)

---

## UPDATE de Encerramento

```sql
UPDATE chats SET
  ai_service = 'finished',
  status = 'finished',
  finished = true
WHERE id = <chat_id>
```

⚠️ **Nota:** O valor `ai_service = 'finished'` é não-padrão. A máquina de estados oficial usa `ai_service = 'paused'` para chats finalizados. Verificar consistência antes de habilitar.

---

## Log de Auditoria

```sql
INSERT INTO chat_messages (
  chat_id, content, direction, created_at
) VALUES (
  <chat_id>,
  '[Sistema] Chat encerrado automaticamente por inatividade (>2h sem resposta)',
  'outbound',
  NOW()
)
```

---

## Status: Por Que Está Desabilitado?

O flow está com `active: false` no JSON. Possíveis razões:
1. Ainda em fase de testes
2. Valor `ai_service = 'finished'` não consistente com a state machine
3. Mensagem de encerramento pode precisar de revisão

**Para habilitar:** Acessar N8N UI → Flow "ENCERRA CHATS INATIVOS — IA" → Toggle para ativo.

---

## Pontos de Atenção

| Item | Detalhe |
|------|---------|
| `ai_service = 'finished'` | Não é valor padrão — state machine usa `'paused'` em chats encerrados |
| Retries em `enviaMensagem` | 3 tentativas com `continueOnFail: true` |
| Loop | Processa **todos** os chats inativos a cada execução (não é individual) |
| UazAPI token | Usa `$vars.UAZAPI_TOKEN` corretamente (diferente dos flows de broadcast) |

---

## Debug

### "Flow não está encerrando chats"

1. **Flow está ativo?** Verificar em N8N UI se `active: true`
2. **Há chats inativos?** Rodar a query manualmente no Postgres
3. **UazAPI está respondendo?** Testar endpoint manualmente:
   ```bash
   curl -X POST https://medlago.uazapi.com/send/text \
     -H "Authorization: Bearer {UAZAPI_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"number": "+5511987654321", "text": "Teste"}'
   ```
4. **`$vars.UAZAPI_TOKEN` configurado?** Verificar em N8N Settings → Variables

### "Chat aparece como finished mas ai_service errado"

```sql
-- Corrigir inconsistência se necessário
UPDATE chats SET ai_service = 'paused'
WHERE status = 'finished' AND ai_service = 'finished';
```

---

**Referência:** [STATE_MACHINE.md](STATE_MACHINE.md) — estados válidos de `ai_service`
