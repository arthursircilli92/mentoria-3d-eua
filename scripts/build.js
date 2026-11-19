const fs = require('node:fs');
const path = require('node:path');
const output = 'dist';

fs.mkdirSync(output, { recursive: true });

// Arquivos e pastas da raiz que devem ser copiados
const rootEntries = ['aluno', 'img', 'guia-roas.md', 'acesso.js', 'sessao-calculadora.js'];

for (const entry of fs.readdirSync('.')) {
  if (entry.endsWith('.html') || rootEntries.includes(entry)) {
    fs.cpSync(entry, path.join(output, entry), { recursive: true });
  }
}

// Copiar subdiretório pack-prompts (exceto node_modules se existir)
const packSrc = 'pack-prompts';
const packDest = path.join(output, 'pack-prompts');
if (fs.existsSync(packSrc)) {
  fs.cpSync(packSrc, packDest, {
    recursive: true,
    filter: (src) => !src.includes('node_modules')
  });
  console.log('✓ pack-prompts copiado para dist/');
} else {
  console.warn('⚠ Diretório pack-prompts não encontrado na raiz do projeto');
}

console.log('Build concluído com sucesso.');