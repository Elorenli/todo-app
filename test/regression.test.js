'use strict';

/*
 * PRUEBAS DE REGRESIÓN
 * Cada prueba protege algo que ya funcionaba (o un error típico de este tipo de app) para que
 * no se rompa en cambios futuros. Se ejecutan en cada cambio (ver .github/workflows/ci.yml).
 * Cada una lleva un código REG-xxx para citarla en el informe.
 */
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../src/todo');
const { startTestServer } = require('../support/helpers');

describe('Regresión: lógica', () => {
  test('REG-001: editar el título NO cambia si la tarea estaba completada', () => {
    const tasks = [{ id: 1, title: 'Vieja', done: true }];
    assert.equal(T.updateTask(tasks, 1, { title: 'Nueva' })[0].done, true);
  });

  test('REG-002: marcar como completada NO cambia el título', () => {
    const tasks = [{ id: 1, title: 'Intacto', done: false }];
    assert.equal(T.toggleTask(tasks, 1)[0].title, 'Intacto');
  });

  test('REG-003: las funciones no modifican los datos que reciben', () => {
    const tasks = Object.freeze([Object.freeze({ id: 1, title: 'x', done: false })]);
    // Con datos congelados, cualquier intento de modificar lanzaría un error en modo estricto.
    assert.doesNotThrow(() => {
      T.addTask(tasks, 'y', 2);
      T.updateTask(tasks, 1, { title: 'z', done: true });
      T.toggleTask(tasks, 1);
      T.deleteTask(tasks, 1);
      T.filterTasks(tasks, 'active');
    });
  });
});

describe('Regresión: servidor', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  test('REG-004: un id NO se reutiliza después de borrar la última tarea', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Primera' });
    await ctx.request('POST', '/api/tasks', { title: 'Segunda' });
    await ctx.request('DELETE', '/api/tasks/2');
    const third = await ctx.request('POST', '/api/tasks', { title: 'Tercera' });
    assert.equal(third.json.id, 3);
  });

  test('REG-015: tras borrar una tarea que no es la última, se puede seguir creando sin ids repetidos', async () => {
    for (const title of ['A', 'B', 'C']) {
      await ctx.request('POST', '/api/tasks', { title });
    }
    await ctx.request('DELETE', '/api/tasks/1');
    const d = await ctx.request('POST', '/api/tasks', { title: 'D' });
    const e = await ctx.request('POST', '/api/tasks', { title: 'E' });
    assert.equal(d.status, 201);
    assert.equal(e.status, 201);
    assert.deepEqual([d.json.id, e.json.id], [4, 5]);

    const ids = (await ctx.request('GET', '/api/tasks')).json.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, 'no debe haber ids repetidos');
  });

  test('REG-005: un título de solo espacios se rechaza', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: '      ' });
    assert.equal(res.status, 400);
  });

  test('REG-006: un PUT no puede cambiar el id de una tarea', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Mía' });
    const res = await ctx.request('PUT', '/api/tasks/1', { id: 999, title: 'Mía v2' });
    assert.equal(res.json.id, 1);
    assert.equal((await ctx.request('GET', '/api/tasks')).json[0].id, 1);
  });

  test('REG-007: un PUT con campos desconocidos no los guarda', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Limpia' });
    await ctx.request('PUT', '/api/tasks/1', { done: true, admin: true });
    const { json } = await ctx.request('GET', '/api/tasks');
    assert.deepEqual(Object.keys(json[0]).sort(), ['done', 'id', 'title']);
  });

  test('REG-008: editar una tarea ya eliminada devuelve 404 y no rompe el servidor', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Efímera' });
    await ctx.request('DELETE', '/api/tasks/1');
    const res = await ctx.request('PUT', '/api/tasks/1', { title: 'Zombi' });
    assert.equal(res.status, 404);
    assert.equal((await ctx.request('GET', '/api/tasks')).status, 200);
  });

  test('REG-009: una petición enorme se rechaza con 413 y el servidor sigue vivo', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: 'x'.repeat(50 * 1024) });
    assert.equal(res.status, 413);
    const after = await ctx.request('GET', '/api/tasks');
    assert.equal(after.status, 200);
  });

  test('REG-010: no se pueden leer archivos fuera de public/ (path traversal)', async () => {
    const attempts = ['/..%2fpackage.json', '/..%2f..%2fetc%2fpasswd', '/%2e%2e%2fsrc%2fserver.js', '/..%2fsrc%2fstore.js'];
    for (const attempt of attempts) {
      const res = await ctx.rawRequest('GET', attempt);
      assert.notEqual(res.status, 200, `${attempt} no debe responder 200`);
      assert.ok(!res.text.includes('"name": "lista-de-tareas"'), `${attempt} no debe filtrar package.json`);
      assert.ok(!res.text.includes('createServer'), `${attempt} no debe filtrar el código del servidor`);
    }
  });

  test('REG-011: una ruta con byte nulo o mal codificada no tumba el servidor', async () => {
    const bad = await ctx.rawRequest('GET', '/%00');
    const worse = await ctx.rawRequest('GET', '/%E0%A4%A');
    assert.equal(bad.status, 400);
    assert.equal(worse.status, 400);
    assert.equal((await ctx.request('GET', '/api/tasks')).status, 200);
  });

  test('REG-012: el HTML en un título se guarda como texto y se entrega como JSON seguro', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await ctx.request('POST', '/api/tasks', { title: evil });
    const res = await ctx.request('GET', '/api/tasks');
    assert.equal(res.json[0].title, evil);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });
});

describe('Regresión: frontend', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  test('REG-013: app.js nunca inserta texto del usuario como HTML (anti-XSS)', () => {
    assert.ok(!/\.innerHTML\s*=/.test(appSource), 'no debe usar innerHTML');
    assert.ok(!/insertAdjacentHTML|document\.write|outerHTML\s*=/.test(appSource), 'no debe usar APIs que interpretan HTML');
    assert.match(appSource, /textContent/);
  });

  test('REG-014: el formulario sigue teniendo etiqueta accesible y límite de longitud', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.match(html, /<label for="new-title"/);
    assert.match(html, new RegExp(`maxlength="${T.MAX_TITLE_LENGTH}"`));
  });
});
