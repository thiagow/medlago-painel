import 'dotenv/config';

const EVO_DOMAIN = process.env.EVO_DOMAIN || '';
const EVO_API_KEY = process.env.EVO_API_KEY || '';
const EVO_API_KEY_HUMANO = process.env.EVO_API_KEY_HUMANO || '';
const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || 'medlago_producao';
const EVO_INSTANCE_HUMANO = process.env.EVO_INSTANCE_HUMANO || 'medlago_humano_prod';
const NUMERO_EQUIPE = process.env.NUMERO_EQUIPE || '';

const domainTrimmed = EVO_DOMAIN.replace(/\/+$/, '');

async function main() {
    console.log("--- DIAGNOSTICO EVOLUTION API ---");
    console.log("");
    console.log("EVO_DOMAIN:", JSON.stringify(EVO_DOMAIN));
    console.log("EVO_INSTANCE_BOT:", JSON.stringify(EVO_INSTANCE_BOT));
    console.log("EVO_INSTANCE_HUMANO:", JSON.stringify(EVO_INSTANCE_HUMANO));
    console.log("NUMERO_EQUIPE:", JSON.stringify(NUMERO_EQUIPE));
    console.log("");

    const urlBugada = `${EVO_DOMAIN}/send/text`;
    const urlCorrigida = `${domainTrimmed}/send/text`;
    console.log("URL ATUAL (possivel bug):", urlBugada);
    console.log("URL CORRIGIDA:", urlCorrigida);
    console.log("Tem barra dupla?:", urlBugada.includes('//message'));
    console.log("");

    // Teste 1: Listar instancias com API Key Bot
    console.log("--- TESTE 1: Listar instancias (API Key Bot) ---");
    try {
        const url = `${domainTrimmed}/instance/fetchInstances`;
        console.log("URL:", url);
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY },
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Resposta:", text.substring(0, 500));
    } catch (err: any) {
        console.log("ERRO:", err.message);
    }
    console.log("");

    // Teste 2: Listar instancias com API Key Humano
    console.log("--- TESTE 2: Listar instancias (API Key Humano) ---");
    try {
        const url = `${domainTrimmed}/instance/fetchInstances`;
        console.log("URL:", url);
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY_HUMANO },
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Resposta:", text.substring(0, 500));
    } catch (err: any) {
        console.log("ERRO:", err.message);
    }
    console.log("");

    // Teste 3: Envio com URL CORRIGIDA
    console.log("--- TESTE 3: Envio com URL CORRIGIDA ---");
    try {
        const url = `${domainTrimmed}/send/text`;
        console.log("URL:", url);
        const body = { number: NUMERO_EQUIPE, text: "Teste diagnostico - Evolution API MedLago" };
        console.log("Body:", JSON.stringify(body));
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY_HUMANO },
            body: JSON.stringify(body),
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Resposta:", text.substring(0, 500));
    } catch (err: any) {
        console.log("ERRO:", err.message);
    }
    console.log("");

    // Teste 4: Envio com URL BUGADA (barra dupla)
    console.log("--- TESTE 4: Envio com URL BUGADA (barra dupla) ---");
    try {
        const url = `${EVO_DOMAIN}/send/text`;
        console.log("URL:", url);
        const body = { number: NUMERO_EQUIPE, text: "Teste diagnostico bugado" };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY_HUMANO },
            body: JSON.stringify(body),
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Resposta:", text.substring(0, 500));
    } catch (err: any) {
        console.log("ERRO:", err.message);
    }
    console.log("");

    // Teste 5: Envio com instancia BOT
    console.log("--- TESTE 5: Envio com instancia BOT ---");
    try {
        const url = `${domainTrimmed}/send/text`;
        console.log("URL:", url);
        const body = { number: NUMERO_EQUIPE, text: "Teste diagnostico bot" };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY },
            body: JSON.stringify(body),
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Resposta:", text.substring(0, 500));
    } catch (err: any) {
        console.log("ERRO:", err.message);
    }

    console.log("");
    console.log("--- FIM DIAGNOSTICO ---");
}

main().catch(e => console.log("ERRO FATAL:", e));
