// test-transfer.ts
async function test() {
    try {
        const res = await fetch("http://localhost:3000/api/chats/79/transfer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ reason: "Motivo Teste", summary: "Resumo Teste" })
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}
test();
