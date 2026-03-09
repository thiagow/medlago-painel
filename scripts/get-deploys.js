const { execSync } = require('child_process');
const fs = require('fs');

try {
    const result = execSync('npx netlify api listSiteDeploys --data "{\\"site_id\\": \\"2287d9ab-7e51-4743-a19c-4fa95102997e\\"}"', { encoding: 'utf8', stdio: 'pipe' });
    const deploys = JSON.parse(result);
    let out = "=== RECENT DEPLOYS ===\n";
    deploys.slice(0, 3).forEach(d => {
        out += `- ID:     ${d.id}\n`;
        out += `- State:  ${d.state}\n`;
        out += `- Title:  ${d.title}\n`;
        out += `- Error:  ${d.error_message || 'None'}\n`;
        out += `- Time:   ${d.created_at}\n`;
        out += `- URL:    ${d.deploy_ssl_url}\n`;
        out += "------------------------\n";
    });
    fs.writeFileSync('deploy_status_clean.txt', out, 'utf8');
    console.log("Success! check deploy_status_clean.txt");
} catch (e) {
    console.error("Failed to fetch deploys:", e.message);
}
