/**
 * Servidor estático que envia TODAS as respostas com headers anti-cache.
 * Use quando quiser que F5 / Ctrl+F5 sempre carregue a versão mais recente.
 *
 * Uso: node scripts/serve-no-cache.js
 * Depois abra: http://localhost:3080/index.html
 * Ou para o Next.js: use "npm run dev" e abra http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3080;
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');

function findFile(urlPath) {
  const semBarra = urlPath.replace(/^\/|^\\/, '').replace(/^(\.\.(\/|\\))+/, '');
  const fromRoot = path.join(rootDir, semBarra);
  const fromPublic = path.join(publicDir, semBarra);
  return { fromRoot, fromPublic };
}

const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const { fromRoot, fromPublic } = findFile(urlPath);

  function tryRead(filePath, next) {
    fs.readFile(filePath, (err, data) => {
      if (err) return next();
      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';

      if (ext === '.html' && data) {
        const timestamp = Date.now();
        const injected = Buffer.from(`\n<!-- atualizado ${timestamp} -->\n`, 'utf8');
        const endTag = Buffer.from('</html>', 'utf8');
        const idx = data.lastIndexOf(endTag);
        const newData = idx !== -1
          ? Buffer.concat([data.subarray(0, idx), injected, data.subarray(idx)])
          : Buffer.concat([data, injected]);
        res.writeHead(200, { ...NO_CACHE_HEADERS, 'Content-Type': contentType });
        res.end(newData);
      } else {
        res.writeHead(200, { ...NO_CACHE_HEADERS, 'Content-Type': contentType });
        res.end(data);
      }
    });
  }

  tryRead(fromRoot, () => {
    tryRead(fromPublic, () => {
      res.writeHead(404, { ...NO_CACHE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado');
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n  Servidor sem cache: http://localhost:${PORT}/index.html`);
  console.log('  F5 e Ctrl+F5 vão sempre trazer a versão mais recente.\n');
});
