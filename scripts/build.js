const fs = require('node:fs');
const path = require('node:path');
const output = 'dist';
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync('.')) {
  if (entry.endsWith('.html') || ['aluno', 'img', 'guia-roas.md', 'acesso.js', 'sessao-calculadora.js'].includes(entry)) {
    fs.cpSync(entry, path.join(output, entry), { recursive: true });
  }
}
