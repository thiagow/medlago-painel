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

async function test(path) {
    const url = `${EVO_DOMAIN.replace(/\/+$/, '')}${path}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': EVO_API_KEY },
            body: JSON.stringify({ number: '5511999999999', text: 'test' })
        });
        console.log(`PATH: ${path} | STATUS: ${res.status} | OK: ${res.ok}`);
        const data = await res.text();
        console.log(`DATA: ${data.substring(0, 100)}`);
    } catch (e) { console.log(`PATH: ${path} | ERROR: ${e.message}`); }
}

async function run() {
    console.log(`DOMAIN: ${EVO_DOMAIN}`);
    console.log(`INSTANCE: ${EVO_INSTANCE}`);
    await test('/message/sendText/' + EVO_INSTANCE);
    await test('/' + EVO_INSTANCE + '/message/sendText');
    await test('/send/text');
}
run();
