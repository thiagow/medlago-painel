const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            acc[key.trim()] = value.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
        }
        return acc;
    }, {});

const EVO_DOMAIN = env.EVO_DOMAIN || '';
const EVO_API_KEY = env.EVO_API_KEY || '';
const EVO_INSTANCE = env.EVO_INSTANCE_BOT || '';

async function test(path, body) {
    const url = `${EVO_DOMAIN.replace(/\/+$/, '')}${path}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY },
            body: JSON.stringify(body)
        });
        console.log(`PATH: ${path} | STATUS: ${res.status}`);
    } catch (e) { console.log(`PATH: ${path} | ERROR: ${e.message}`); }
}

async function run() {
    console.log(`INSTANCE: ${EVO_INSTANCE}`);
    await test(`/message/sendText/${EVO_INSTANCE}`, { number: '5511999999999', text: 'test' });
    await test(`/message/sendMedia/${EVO_INSTANCE}`, { 
        number: '5511999999999', 
        mediaMessage: { mediatype: 'image', media: 'https://placehold.co/600x400.png' }
    });
}
run();
