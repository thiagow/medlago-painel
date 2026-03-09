interface SendMessageParams {
    domain: string;
    apiKey: string;
    instance: string;
    number: string;
    text: string;
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
    const url = `${cleanDomain}/message/sendText/${instance}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
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
    const EVO_DOMAIN = process.env.EVO_DOMAIN!;
    const EVO_API_KEY = process.env.EVO_API_KEY!;
    const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";

    await sendEvolutionMessage({
        domain: EVO_DOMAIN,
        apiKey: EVO_API_KEY,
        instance: EVO_INSTANCE_BOT,
        number: phone,
        text: "👤 Vou te transferir para um dos nossos atendentes agora. Em breve entrarão em contato com você. Obrigado pela paciência! 😊",
    });
}

// Notificar a equipe sobre nova transferência
export async function sendTeamNotification(
    patientPhone: string,
    summary?: string
): Promise<void> {
    const EVO_DOMAIN = process.env.EVO_DOMAIN!;
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
    const EVO_DOMAIN = process.env.EVO_DOMAIN!;
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
