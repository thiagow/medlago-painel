import { prisma } from "@/lib/prisma";

interface SendMessageParams {
    domain: string;
    apiKey: string;
    instance: string;
    number: string;
    text: string;
}

export interface SendMediaOptions {
    domain: string;
    apiKey: string;
    instance: string;
    number: string;
    mediaUrl: string;
    mediaType: "image" | "video" | "audio" | "document" | string;
    fileName?: string;
    caption?: string;
}

export async function sendEvolutionMessage({
    domain,
    apiKey,
    instance,
    number,
    text,
}: SendMessageParams): Promise<void> {
    // Remove barras finais do domain para evitar barra dupla na URL (ex: domain/ + /message = domain//message → 404)
    const cleanDomain = domain.replace(/\/+$/, '');
    const url = `${cleanDomain}/send/text`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            token: apiKey,
        },
        body: JSON.stringify({ number, text }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(
            `Evolution API error (${response.status}): ${error}`
        );
    }
}

// Enviar mensagem de transferência para o paciente
export async function sendPatientTransferMessage(
    phone: string
): Promise<void> {
    const EVO_DOMAIN = (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";

    console.log(`Enviando mensagem de transferência para o paciente no número original: ${phone}`);

    try {
        await sendEvolutionMessage({
            domain: EVO_DOMAIN,
            apiKey: EVO_API_KEY,
            instance: EVO_INSTANCE_BOT,
            number: phone,
            text: "✅ *Atendimento Transferido*\n\nEstamos transferindo o seu atendimento para um de nossos atendentes. Eles entrarão em contato em instantes!",
        });
        console.log("Mensagem de transferência para paciente enviada com sucesso.");
    } catch (error) {
        console.error("Falha ao enviar mensagem de transferência para paciente:", error);
        throw error;
    }
}

// Enviar mensagem quando atendimento for finalizado manualmente (amigável)
export async function sendChatFinishedMessage(
    phone: string
): Promise<void> {
    const EVO_DOMAIN = (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";

    console.log(`Enviando mensagem de finalização para o paciente: ${phone}`);

    try {
        await sendEvolutionMessage({
            domain: EVO_DOMAIN,
            apiKey: EVO_API_KEY,
            instance: EVO_INSTANCE_BOT,
            number: phone,
            text: "Seu atendimento foi finalizado. ✨\n\nAgradecemos o contato. Se precisar de mais alguma ajuda, basta nos chamar novamente!",
        });
    } catch (err: any) {
        console.error("Falha ao enviar mensagem amigável de finalização:", err.message);
    }
}

// Notificar a equipe sobre nova transferência
export async function sendTeamNotification(
    patientPhone: string,
    summary?: string
): Promise<void> {
    const EVO_DOMAIN = (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";
    const NUMERO_EQUIPE = process.env.NUMERO_EQUIPE!;

    if (!NUMERO_EQUIPE) {
        console.error("ERRO CRÍTICO: Variável de ambiente NUMERO_EQUIPE não está definida!");
    } else {
        console.log(`Enviando notificação para a equipe no número: ${NUMERO_EQUIPE}`);
    }

    const cleanPhone = patientPhone.split('@')[0];
    const message = summary
        ? `🔔 *Nova solicitação de atendimento humano*\n\n📱 Paciente: ${cleanPhone}\n\n📝 Resumo: ${summary}`
        : `🔔 *Nova solicitação de atendimento humano*\n\n📱 Paciente: ${cleanPhone}\n\nPor favor, entre em contato com o paciente.`;

    try {
        await sendEvolutionMessage({
            domain: EVO_DOMAIN,
            apiKey: EVO_API_KEY,
            instance: EVO_INSTANCE_BOT,
            number: NUMERO_EQUIPE,
            text: message,
        });
        console.log("Notificação para a equipe enviada com sucesso.");
    } catch (error) {
        console.error("Falha ao enviar notificação para a equipe:", error);
        throw error; // Re-throw para ser pego pela rota
    }
}


// Enviar mensagem de reativação da IA
export async function sendReactivationMessage(phone: string): Promise<void> {
    const EVO_DOMAIN = (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";

    await sendEvolutionMessage({
        domain: EVO_DOMAIN,
        apiKey: EVO_API_KEY,
        instance: EVO_INSTANCE_BOT,
        number: phone,
        text: "🤖 O atendimento automático foi reativado! Estou pronto para ajudá-lo novamente. Como posso te ajudar? 😊",
    });
}

// Enviar Mídia (Imagem, Áudio, Arquivo)
export async function sendMediaMessage(options: SendMediaOptions): Promise<void> {
    const { domain, apiKey, instance, number, mediaUrl, mediaType, fileName, caption } = options;
    const cleanDomain = domain.replace(/\/+$/, '');
    const url = `${cleanDomain}/send/media`;

    // Payload no formato Uazapi: campo "file" (URL ou base64), "type", "caption", "fileName"
    // Uazapi usa "myaudio" para áudios em vez de "audio"
    const uazapiType = mediaType === 'audio' ? 'myaudio' : mediaType;
    const payload: any = {
        number,
        file: mediaUrl,
        type: uazapiType,
    };

    if (fileName) payload.fileName = fileName;
    if (caption) payload.caption = caption;

    console.log(`[Uazapi] Payload Media (${mediaType}):`, JSON.stringify({ ...payload, file: "TRUNCATED_URL" }));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'token': apiKey,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Uazapi] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`Falha ao enviar mídia Evolution API (Status ${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`[Uazapi] Resposta Media:`, JSON.stringify(responseData));
    return responseData;
}

// ─── NPS Survey ────────────────────────────────────────────────────────────────

/**
 * Envia a pesquisa de satisfação NPS ao paciente via Uazapi.
 * Usa os textos configurados no banco (tabela nps_config).
 * Cria um registro em nps_responses com status 'pending'.
 */
export async function sendNpsSurvey(
    phone: string,
    agentName: string,
    chatId: bigint
): Promise<void> {
    const EVO_DOMAIN = (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE = process.env.EVO_INSTANCE_BOT || 'medlago_producao';

    // Buscar configurações do banco
    const configs = await prisma.npsConfig.findMany();
    const cfg: Record<string, string> = {};
    for (const c of configs) cfg[c.key] = c.value;

    if (cfg.enabled !== 'true') {
        // NPS desativado: envia apenas mensagem de despedida normal
        await sendEvolutionMessage({
            domain: EVO_DOMAIN,
            apiKey: EVO_API_KEY,
            instance: EVO_INSTANCE,
            number: phone,
            text: "Seu atendimento foi finalizado. ✨\n\nAgradecemos o contato!",
        });
        return;
    }

    const greeting = (cfg.greeting || 'Seu atendimento foi finalizado!').replace('{agent_name}', agentName);
    const question = cfg.question || 'De 0 a 10, como você avalia o atendimento?';
    const btnBad     = cfg.button_bad     || '😞 0 a 3';
    const btnNeutral = cfg.button_neutral || '😐 4 a 7';
    const btnGood    = cfg.button_good    || '😍 8 a 10';

    // 1. Enviar saudação em texto
    await sendEvolutionMessage({
        domain: EVO_DOMAIN,
        apiKey: EVO_API_KEY,
        instance: EVO_INSTANCE,
        number: phone,
        text: greeting,
    });

    // 2. Enviar botões via /send/menu no formato Uazapi
    const menuUrl = `${EVO_DOMAIN}/send/menu`;
    const payload = {
        number: phone,
        type: "button",
        text: question,
        choices: [
            `${btnBad}|nps_bad`,
            `${btnNeutral}|nps_neutral`,
            `${btnGood}|nps_good`
        ]
    };

    const menuRes = await fetch(menuUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: EVO_API_KEY },
        body: JSON.stringify(payload),
    });

    if (!menuRes.ok) {
        const err = await menuRes.text();
        console.error('[NPS] Erro ao enviar botões:', err);
        // Não lança erro — continua para registrar mesmo assim
    }

    // 3. Criar registro pendente em nps_responses
    await prisma.npsResponse.create({
        data: {
            chat_id: chatId,
            phone,
            agent_name: agentName,
            status: 'pending',
        },
    });

    console.log(`[NPS] Pesquisa enviada para ${phone}, chat #${chatId}`);
}
