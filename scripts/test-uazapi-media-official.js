const fs = require('fs');
const path = require('path');

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

async function testMediaEndpoint() {
    const url = `${EVO_DOMAIN}/send/media`;
    const body = {
        number: '5511999999999',
        options: { delay: 1200, presence: "composing" },
        mediaMessage: {
            mediatype: 'image',
            media: 'https://placehold.co/600x400.png',
            caption: 'Teste de mídia MedLago'
        }
    };

    console.log(`\n--- TESTE ESPECÍFICO MEDIA UAZAPI ---`);
    console.log(`URL: ${url}`);
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

    } catch (error) {
        console.error(`\n❌ Erro na requisição: ${error.message}`);
    }
}

testMediaEndpoint();
