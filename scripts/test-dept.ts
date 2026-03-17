import fetch from "node-fetch";

async function run() {
    try {
        const res = await fetch("http://localhost:3000/api/departments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-role": "admin",
                "x-user-id": "1", // Passando ID mock também
            },
            body: JSON.stringify({
                name: "Teste Script",
                description: "Teste via node local",
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
