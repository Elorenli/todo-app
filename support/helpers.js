'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer } = require('../src/server');

/*
 * Arranca un servidor real en un puerto libre, con su propio archivo de datos
 * temporal, para que cada prueba empiece desde cero y no toque datos reales.
 */
async function startTestServer({ dir } = {}) {
  const dataDir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'));
  const dataFile = path.join(dataDir, 'tasks.json');
  const server = createServer({ dataFile, silent: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, urlPath, body) {
    const init = { method, headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(base + urlPath, init);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // no era JSON (por ejemplo, una página HTML)
    }
    return { status: res.status, headers: res.headers, text, json };
  }

  // Envía la ruta tal cual, sin que el cliente la "limpie" (útil para probar rutas maliciosas).
  function rawRequest(method, rawPath) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, method, path: rawPath },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  async function close({ keepData = false } = {}) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (!keepData) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  return { base, dataDir, dataFile, request, rawRequest, close };
}

module.exports = { startTestServer };
