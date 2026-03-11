import 'dotenv/config';
import { writeFileSync } from 'fs';

const EVO_DOMAIN = process.env.EVO_DOMAIN || '';
const EVO_API_KEY = process.env.EVO_API_KEY || '';
const EVO_API_KEY_HUMANO = process.env.EVO_API_KEY_HUMANO || '';
const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || 'medlago_producao';
const EVO_INSTANCE_HUMANO = process.env.EVO_INSTANCE_HUMANO || 'medlago_humano_prod';
const NUMERO_EQUIPE = process.env.NUMERO_EQUIPE || '';

const domainTrimmed = EVO_DOMAIN.replace(/\/+$/, '');
const results: any = { env: {}, tests: {} };

results.env = {
    EVO_DOMAIN,
    EVO_INSTANCE_BOT,
    EVO_INSTANCE_HUMANO,
    NUMERO_EQUIPE,
    urlBugada: `${EVO_DOMAIN}/send/text`,
    urlCorrigida: `${domainTrimmed}/send/text`,
    temBarraDupla: `${EVO_DOMAIN}/message/sendText/`.includes('//message'),
};

async function testFetch(label: string, url: string, method: string, apiKey: string, body?: any) {
    try {
        const opts: any = { method, headers: { 'Content-Type': 'application/json', 'token': apiKey } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { }
        results.tests[label] = { url, status: res.status, ok: res.ok, response: json || text };
    } catch (err: any) {
        results.tests[label] = { url, error: err.message };
    }
}

async function main() {
    await testFetch('instancias_bot', `${domainTrimmed}/instance/fetchInstances`, 'GET', EVO_API_KEY);
    await testFetch('instancias_humano', `${domainTrimmed}/instance/fetchInstances`, 'GET', EVO_API_KEY_HUMANO);
    await testFetch('envio_url_corrigida', `${domainTrimmed}/send/text`, 'POST', EVO_API_KEY_HUMANO, { number: NUMERO_EQUIPE, text: 'Teste diagnostico MedLago' });
    await testFetch('envio_url_bugada', `${EVO_DOMAIN}/send/text`, 'POST', EVO_API_KEY_HUMANO, { number: NUMERO_EQUIPE, text: 'Teste diagnostico bugado' });
    await testFetch('envio_bot', `${domainTrimmed}/send/text`, 'POST', EVO_API_KEY, { number: NUMERO_EQUIPE, text: 'Teste diagnostico bot' });

    writeFileSync('scripts/test-output.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('OK - resultados salvos em scripts/test-output.json');
}

main().catch(e => { results.fatalError = e.message; writeFileSync('scripts/test-output.json', JSON.stringify(results, null, 2), 'utf-8'); });
