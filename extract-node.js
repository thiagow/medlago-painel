const fs = require('fs');
const file = 'c:\\Projetos\\MedLago\\medlago-app\\src\\Fluxos\\CLINICA CONSOLE.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const node = data.nodes.find(n => n.name.toLowerCase().includes('encaminhar_para_atendente_humano'));
if (node) {
    fs.writeFileSync('c:\\Projetos\\MedLago\\medlago-app\\node-dump.json', JSON.stringify(node, null, 2));
} else {
    fs.writeFileSync('c:\\Projetos\\MedLago\\medlago-app\\node-dump.json', "Node not found.");
}
