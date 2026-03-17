const fs = require('fs');
const path = require('path');

// Manuelly parse .env if dotenv is tricky
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) acc[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
        return acc;
    }, {});

const EVO_DOMAIN = env.EVO_DOMAIN || '';
const EVO_API_KEY = env.EVO_API_KEY || '';
const EVO_INSTANCE = env.EVO_INSTANCE_BOT || '';

async function testEndpoint(endpointPath) {
    const url = `${EVO_DOMAIN.replace(/\/+$/, '')}${endpointPath}`;
    console.log(`Testing ${url}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': EVO_API_KEY
            },
            body: JSON.stringify({
                number: '5511999999999',
                text: 'Test message'
            })
        });
        console.log(`Result for ${endpointPath}: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Response: ${text.substring(0, 200)}`);
    } catch (e) {
        console.log(`Error for ${endpointPath}: ${e.message}`);
    }
}

async function run() {
    console.log('--- UAZAPI ENDPOINT TEST ---');
    console.log(`Instance: ${EVO_INSTANCE}`);
    await testEndpoint('/send/text');
    await testEndpoint('/message/sendText');
    await testEndpoint(`/message/sendText/${EVO_INSTANCE}`);
    await testEndpoint(`/${EVO_INSTANCE}/message/sendText`);
}

run();
