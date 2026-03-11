/**
 * Script de teste para diagnosticar o erro de envio na Evolution API
 * Executa: npx tsx scripts/test-evolution.ts
 */

import 'dotenv/config';

const EVO_DOMAIN = process.env.EVO_DOMAIN!;
const EVO_API_KEY = process.env.EVO_API_KEY!;
const EVO_API_KEY_HUMANO = process.env.EVO_API_KEY_HUMANO!;
const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || 'medlago_producao';
const EVO_INSTANCE_HUMANO = process.env.EVO_INSTANCE_HUMANO || 'medlago_humano_prod';
const NUMERO_EQUIPE = process.env.NUMERO_EQUIPE!;

console.log("=== DIAGNÓSTICO EVOLUTION API ===\n");

// 1. Verificar variáveis de ambiente
console.log("1. VARIÁVEIS DE AMBIENTE:");
console.log(`   EVO_DOMAIN: "${EVO_DOMAIN}"`);
console.log(`   EVO_API_KEY: "${EVO_API_KEY?.substring(0, 10)}..."`);
console.log(`   EVO_API_KEY_HUMANO: "${EVO_API_KEY_HUMANO?.substring(0, 10)}..."`);
console.log(`   EVO_INSTANCE_BOT: "${EVO_INSTANCE_BOT}"`);
console.log(`   EVO_INSTANCE_HUMANO: "${EVO_INSTANCE_HUMANO}"`);
console.log(`   NUMERO_EQUIPE: "${NUMERO_EQUIPE}"`);
console.log();

// 2. Verificar URL gerada
const urlAtual = `${EVO_DOMAIN}/send/text`;
const domainTrimmed = EVO_DOMAIN.replace(/\/+$/, '');
const urlCorrigida = `${domainTrimmed}/send/text`;

console.log("2. URLs GERADAS:");
console.log(`   URL ATUAL (bug):    "${urlAtual}"`);
console.log(`   URL CORRIGIDA:      "${urlCorrigida}"`);
console.log(`   Tem barra dupla?    ${urlAtual.includes('//message') ? '⚠️  SIM! ESTE É O PROBLEMA!' : '✅ Não'}`);
console.log();

// 3. Teste de conectividade - Verificar instância
async function testInstance(instance: string, apiKey: string, label: string) {
    const url = `${domainTrimmed}/instance/fetchInstances`;
    console.log(`3. TESTANDO CONECTIVIDADE (${label}):`);
    console.log(`   URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'token': apiKey,
            },
        });
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            const instances = Array.isArray(data) ? data : (data.instances || data);
            if (Array.isArray(instances)) {
                console.log(`   Instâncias encontradas: ${instances.length}`);
                instances.forEach((inst: any) => {
                    const name = inst.instance?.instanceName || inst.instanceName || inst.name || JSON.stringify(inst).substring(0, 80);
                    const state = inst.instance?.state || inst.state || 'desconhecido';
                    console.log(`     - ${name} (estado: ${state})`);
                });
            } else {
                console.log(`   Resposta: ${JSON.stringify(data).substring(0, 200)}`);
            }
        } else {
            const errorText = await response.text();
            console.log(`   ❌ Erro: ${errorText.substring(0, 200)}`);
        }
    } catch (error: any) {
        console.log(`   ❌ Erro de conexão: ${error.message}`);
    }
    console.log();
}

// 4. Teste de envio de mensagem com URL corrigida
async function testSendMessage() {
    console.log("4. TESTE DE ENVIO DE MENSAGEM (URL corrigida):");

    const url = `${domainTrimmed}/send/text`;
    const testNumber = NUMERO_EQUIPE;
    const testText = "🧪 Teste de diagnóstico - Evolution API MedLago - pode ignorar";

    console.log(`   URL: ${url}`);
    console.log(`   Número: ${testNumber}`);
    console.log(`   Instância: ${EVO_INSTANCE_HUMANO}`);
    console.log(`   API Key: ${EVO_API_KEY_HUMANO?.substring(0, 10)}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': EVO_API_KEY_HUMANO,
            },
            body: JSON.stringify({
                number: testNumber,
                text: testText,
            }),
        });

        console.log(`   Status: ${response.status}`);
        const responseText = await response.text();
        console.log(`   Resposta: ${responseText.substring(0, 500)}`);

        if (response.ok) {
            console.log(`   ✅ ENVIO BEM SUCEDIDO!`);
        } else {
            console.log(`   ❌ FALHA NO ENVIO`);
        }
    } catch (error: any) {
        console.log(`   ❌ Erro: ${error.message}`);
    }
    console.log();

    // Teste com URL BUGADA (barra dupla) para comparar
    console.log("5. TESTE DE ENVIO COM URL BUGADA (barra dupla):");
    const urlBugada = `${EVO_DOMAIN}/send/text`;
    console.log(`   URL: ${urlBugada}`);

    try {
        const response = await fetch(urlBugada, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': EVO_API_KEY_HUMANO,
            },
            body: JSON.stringify({
                number: testNumber,
                text: testText,
            }),
        });

        console.log(`   Status: ${response.status}`);
        const responseText = await response.text();
        console.log(`   Resposta: ${responseText.substring(0, 500)}`);

        if (response.ok) {
            console.log(`   ✅ ENVIO BEM SUCEDIDO (barra dupla não causou problema)`);
        } else {
            console.log(`   ❌ FALHA - BARRA DUPLA É O PROBLEMA!`);
        }
    } catch (error: any) {
        console.log(`   ❌ Erro: ${error.message}`);
    }
}

async function main() {
    await testInstance(EVO_INSTANCE_BOT, EVO_API_KEY, "Bot");
    await testInstance(EVO_INSTANCE_HUMANO, EVO_API_KEY_HUMANO, "Humano");
    await testSendMessage();

    console.log("\n=== DIAGNÓSTICO COMPLETO ===");
    console.log("Se a URL corrigida funciona e a bugada não, corrija o EVO_DOMAIN");
    console.log("removendo a barra final ou ajuste o código para fazer trim.");
}

main().catch(console.error);
