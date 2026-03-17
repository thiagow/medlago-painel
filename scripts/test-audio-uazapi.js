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

const EVO_DOMAIN = env.EVO_DOMAIN || 'https://medlago.uazapi.com';
const EVO_API_KEY = env.EVO_API_KEY;

// URL de áudio público para teste
const TEST_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
// Use seu número de teste real aqui:
const TEST_NUMBER = env.TEST_PHONE || '5561999999999';

async function testPayload(name, body) {
    const url = `${EVO_DOMAIN}/send/media`;
    console.log(`\n=== TESTE: ${name} ===`);
    console.log(`Payload:`, JSON.stringify(body, null, 2));
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'token': EVO_API_KEY,
        },
        body: JSON.stringify(body),
    });
    
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Resposta: ${text}`);
    return response.status;
}

async function main() {
    // Formato 1 - Atual (nosso código após última correção)
    await testPayload('Formato atual: file + type=myaudio', {
        number: TEST_NUMBER,
        file: TEST_AUDIO_URL,
        type: 'myaudio',
    });

    // Formato 2 - mediaMessage com myaudio
    await testPayload('mediaMessage + mediatype=myaudio', {
        number: TEST_NUMBER,
        mediaMessage: {
            mediatype: 'myaudio',
            media: TEST_AUDIO_URL,
        }
    });

    // Formato 3 - file + myaudio direto
    await testPayload('file + myaudio (sem type)', {
        number: TEST_NUMBER,
        file: TEST_AUDIO_URL,
        mediatype: 'myaudio',
    });
}

main().catch(console.error);
