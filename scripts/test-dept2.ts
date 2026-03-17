import fetch from "node-fetch";

async function run() {
    try {
        const res = await fetch("http://localhost:3001/api/departments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-role": "admin",
                "x-user-id": "1",
            },
            body: JSON.stringify({
                name: "Departamento Automático " + Date.now(),
                description: "Teste via node fetch Pós-Fixação",
            }),
        });

        const text = await res.text();
        console.log("STATUS:", res.status);
        console.log("BODY:", text);
    } catch (err) {
        console.error("FATAL ERROR:", err);
    }
}

run();
