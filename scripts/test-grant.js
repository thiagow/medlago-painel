const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5436/medlago?sslmode=disable'
});

async function run() {
    await client.connect();
    try {
        console.log("Attempting to grant privileges...");
        await client.query("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO user_medlago_app;");
        await client.query("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO user_medlago_app;");
        console.log("SUCCESS");
    } catch (e) {
        console.log("FAIL", e.message);
    } finally {
        await client.end();
    }
}
run();
