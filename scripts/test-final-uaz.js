const fs = require('fs');
const path = require('path');

// Ler o arquivo .env manualmente para garantir fidelidade
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const EVO_DOMAIN = 'https://medlago.uazapi.com';
const EVO_API_KEY = env.EVO_API_KEY;

async function testOfficialEndpoint() {
    const url = `${EVO_DOMAIN}/send/text`;
    const body = {
        number: '5511999999999', // Número para teste
        text: 'Teste de conexão MedLago via Uazapi'
    };

    console.log(`\n--- TESTE ESPECÍFICO UAZAPI ---`);
    console.log(`URL: ${url}`);
    console.log(`Headers: { "token": "REDACTED" }`);
    console.log(`Body: ${JSON.stringify(body)}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': EVO_API_KEY
            },
            body: JSON.stringify(body)
        });

        console.log(`\nRESULTADO:`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        const text = await response.text();
        console.log(`Corpo da Resposta: ${text}`);
        
        try {
            const json = JSON.parse(text);
            if (json.status === 200 || json.success === true) {
                console.log(`\n✅ O endpoint respondeu corretamente (sucesso semântico).`);
            } else if (text.includes("the number") && text.includes("not on WhatsApp")) {
                console.log(`\n✅ O endpoint está correto! O erro de 'número não está no WhatsApp' confirma que a API recebeu e processou a chamada.`);
            }
        } catch (e) {
            // Not JSON
        }

    } catch (error) {
        console.error(`\n❌ Erro na requisição: ${error.message}`);
    }
}

testOfficialEndpoint();
