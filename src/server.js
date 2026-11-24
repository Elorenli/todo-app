'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const logic = require('./todo');
const { Store } = require('./store');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SHARED_LOGIC_FILE = path.join(__dirname, 'todo.js');
const MAX_BODY_BYTES = 10 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true; // se sigue leyendo (sin guardar) para poder responder bien
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (tooLarge) {
        return reject(new HttpError(413, 'La petición es demasiado grande.'));
      }
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) {
        return reject(new logic.ValidationError('Falta el cuerpo JSON de la petición.'));
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return reject(new logic.ValidationError('El cuerpo de la petición no es JSON válido.'));
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject(new logic.ValidationError('El cuerpo debe ser un objeto JSON.'));
      }
      resolve(parsed);
    });
  });
}

async function handleApi(req, res, url, store) {
  const match = url.pathname.match(/^\/api\/tasks(?:\/(\d+))?$/);
  if (!match) {
    throw new HttpError(404, 'Ruta de API no encontrada.');
  }

  // ---- /api/tasks ----
  if (match[1] === undefined) {
    if (req.method === 'GET') {
      const filter = url.searchParams.get('filter') || 'all';
      const { tasks } = store.load();
      return sendJson(res, 200, logic.filterTasks(tasks, filter));
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const data = store.load();
      const tasks = logic.addTask(data.tasks, body.title, data.nextId);
      store.save({ tasks, nextId: data.nextId + 1 });
      return sendJson(res, 201, tasks[tasks.length - 1]);
    }
    throw new HttpError(405, 'Método no permitido.', { Allow: 'GET, POST' });
  }

  // ---- /api/tasks/:id ----
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) {
    throw new logic.NotFoundError(`No existe la tarea ${match[1]}.`);
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const changes = {}; // solo se aceptan title y done; cualquier otro campo (como id) se ignora
    if ('title' in body) changes.title = body.title;
    if ('done' in body) changes.done = body.done;

    const data = store.load();
    const tasks = logic.updateTask(data.tasks, id, changes);
    store.save({ tasks, nextId: data.nextId });
    return sendJson(res, 200, tasks.find((task) => task.id === id));
  }

  if (req.method === 'DELETE') {
    const data = store.load();
    const tasks = logic.deleteTask(data.tasks, id);
    store.save({ tasks, nextId: data.nextId });
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }

  throw new HttpError(405, 'Método no permitido.', { Allow: 'PUT, DELETE' });
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'Método no permitido.', { Allow: 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new HttpError(400, 'Ruta inválida.');
  }
  if (pathname.includes('\0')) {
    throw new HttpError(400, 'Ruta inválida.');
  }

  let filePath;
  if (pathname === '/shared/todo.js') {
    filePath = SHARED_LOGIC_FILE; // la misma lógica que usa el servidor
  } else {
    if (pathname === '/') pathname = '/index.html';
    filePath = path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      throw new HttpError(403, 'Acceso denegado.');
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      return sendJson(res, 404, { error: 'No encontrado.' });
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': content.length,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}

function handleError(err, res, silent) {
  let status = 500;
  let message = 'Error interno del servidor.';
  let headers = {};

  if (err instanceof logic.ValidationError) {
    status = 400;
    message = err.message;
  } else if (err instanceof logic.NotFoundError) {
    status = 404;
    message = err.message;
  } else if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    headers = err.headers;
  } else if (!silent) {
    console.error(err); // el detalle real solo va al registro, nunca al cliente
  }

  if (res.headersSent) {
    return res.end();
  }
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  sendJson(res, status, { error: message });
}

function createServer({ dataFile = path.join(__dirname, '..', 'data', 'tasks.json'), silent = false } = {}) {
  const store = new Store(dataFile);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url, store);
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      handleError(err, res, silent);
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer({ dataFile: process.env.DATA_FILE || undefined }).listen(port, () => {
    console.log(`Lista de tareas lista en http://localhost:${port}`);
  });
}

module.exports = { createServer };
