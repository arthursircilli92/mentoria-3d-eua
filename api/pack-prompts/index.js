const { readFileSync } = require('node:fs');
const path = require('node:path');

module.exports = async function handler(req, res) {
 if (req.method !== 'GET') return res.status(405).end();
 try {
 const html = readFileSync(path.join(process.cwd(), 'dist', 'pack-prompts', 'index.html'), 'utf-8');
 res.setHeader('Content-Type', 'text/html; charset=utf-8');
 res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
 res.status(200).send(html);
 } catch (err) {
 console.error('Erro ao servir index do pack:', err.message);
 res.status(500).send('Erro interno ao carregar página.');
 }
};