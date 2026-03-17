const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = value;
    }
});

const EVO_DOMAIN = env.EVO_DOMAIN || 'https://medlago.uazapi.com';
const EVO_API_KEY = env.EVO_API_KEY;
const R2_PUBLIC_URL = env.R2_PUBLIC_URL;
const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
const R2_BUCKET_NAME = env.R2_BUCKET_NAME;

console.log('=== CONFIGURAÇÃO ===');
console.log('EVO_DOMAIN:', EVO_DOMAIN);
console.log('EVO_API_KEY:', EVO_API_KEY ? `${EVO_API_KEY.substring(0, 8)}...` : 'NÃO DEFINIDO');
console.log('R2_PUBLIC_URL:', R2_PUBLIC_URL || '(vazio)');
console.log('R2_BUCKET_NAME:', R2_BUCKET_NAME);
console.log('');

// URL pública de áudio mp3 pequeno para teste
const TEST_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// SIMULANDO o que o código vai enviar:
// R2_PUBLIC_URL está configurado? Então a URL seria: ${R2_PUBLIC_URL}/documentos/audio-xxx.webm
const simulatedR2Url = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/documentos/audio-TESTE.webm`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/documentos/audio-TESTE.webm`;

console.log('URL simulada do R2:', simulatedR2Url);
console.log('');

async function testUazapiWithAudio(audioUrl) {
    const url = `${EVO_DOMAIN}/send/media`;
    // Usando número do primeiro chat pausado - MUDE AQUI
    const number = '+55 61 9678-5733'; // número do chat de teste
    
    const payload = {
        number,
        file: audioUrl,
        type: 'myaudio',
    };
    
    console.log(`=== TESTANDO UAZAPI /send/media ===`);
    console.log(`URL Uazapi: ${url}`);
    console.log(`Payload:`, JSON.stringify({ ...payload, file: audioUrl.substring(0, 60) + '...' }));
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'token': EVO_API_KEY,
        },
        body: JSON.stringify(payload),
    });
    
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Resposta: ${text}`);
    
    console.log('\n--- Agora com URL pública de MP3 ---');
    const payload2 = { number, file: TEST_AUDIO_URL, type: 'myaudio' };
    const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY },
        body: JSON.stringify(payload2),
    });
    console.log('Status MP3 público:', res2.status);
    console.log('Resposta:', await res2.text());
}

testUazapiWithAudio(simulatedR2Url).catch(console.error);
