'use strict';

/*
 * PRUEBAS DE INTEGRACIÓN
 * Comprueban que las piezas trabajan juntas: petición HTTP -> servidor -> lógica -> archivo de datos.
 * Aquí se usa un servidor real y un archivo JSON real (temporal).
 */
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startTestServer } = require('../support/helpers');

describe('API + almacenamiento', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  const readDisk = () => JSON.parse(fs.readFileSync(ctx.dataFile, 'utf8'));

  test('POST crea la tarea y la guarda en el archivo', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: 'Comprar pan' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.json, { id: 1, title: 'Comprar pan', done: false });

    const disk = readDisk();
    assert.deepEqual(disk.tasks, [{ id: 1, title: 'Comprar pan', done: false }]);
    assert.equal(disk.nextId, 2);
  });

  test('GET devuelve las tareas guardadas', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Una' });
    await ctx.request('POST', '/api/tasks', { title: 'Dos' });
    const res = await ctx.request('GET', '/api/tasks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.map((t) => t.title), ['Una', 'Dos']);
  });

  test('GET sin tareas devuelve una lista vacía (no un error)', async () => {
    const res = await ctx.request('GET', '/api/tasks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, []);
  });

  test('PUT actualiza la tarea y el cambio queda en el archivo', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Vieja' });
    const res = await ctx.request('PUT', '/api/tasks/1', { title: 'Nueva', done: true });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { id: 1, title: 'Nueva', done: true });
    assert.deepEqual(readDisk().tasks, [{ id: 1, title: 'Nueva', done: true }]);
  });

  test('DELETE responde 204 y quita la tarea del archivo', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Borrar' });
    const res = await ctx.request('DELETE', '/api/tasks/1');
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.deepEqual(readDisk().tasks, []);
  });

  test('GET ?filter filtra en el servidor', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'A' });
    await ctx.request('POST', '/api/tasks', { title: 'B' });
    await ctx.request('PUT', '/api/tasks/2', { done: true });

    const active = await ctx.request('GET', '/api/tasks?filter=active');
    const completed = await ctx.request('GET', '/api/tasks?filter=completed');
    assert.deepEqual(active.json.map((t) => t.title), ['A']);
    assert.deepEqual(completed.json.map((t) => t.title), ['B']);
  });

  test('GET con un filtro inválido responde 400', async () => {
    const res = await ctx.request('GET', '/api/tasks?filter=borradas');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Filtro desconocido/);
  });

  test('los datos sobreviven a un reinicio del servidor', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Persistente' });
    await ctx.close({ keepData: true });

    ctx = await startTestServer({ dir: ctx.dataDir }); // mismo archivo, servidor nuevo
    const res = await ctx.request('GET', '/api/tasks');
    assert.deepEqual(res.json, [{ id: 1, title: 'Persistente', done: false }]);
  });

  test('no deja archivos temporales junto a los datos', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'x' });
    assert.deepEqual(fs.readdirSync(ctx.dataDir), ['tasks.json']);
  });
});

describe('Manejo de errores de la API', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  test('JSON mal formado -> 400', async () => {
    const res = await ctx.request('POST', '/api/tasks', '{esto no es json');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /JSON/);
  });

  test('cuerpo ausente -> 400', async () => {
    const res = await ctx.request('POST', '/api/tasks');
    assert.equal(res.status, 400);
  });

  test('cuerpo que no es un objeto -> 400', async () => {
    for (const body of ['[]', 'null', '"texto"', '5']) {
      const res = await ctx.request('POST', '/api/tasks', body);
      assert.equal(res.status, 400, `cuerpo ${body}`);
    }
  });

  test('título vacío -> 400 y no se guarda nada', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: '   ' });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /vacío/);
    assert.equal(fs.existsSync(ctx.dataFile), false);
  });

  test('título que no es texto -> 400', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: 123 });
    assert.equal(res.status, 400);
  });

  test('PUT y DELETE sobre una tarea inexistente -> 404', async () => {
    const put = await ctx.request('PUT', '/api/tasks/99', { done: true });
    const del = await ctx.request('DELETE', '/api/tasks/99');
    assert.equal(put.status, 404);
    assert.equal(del.status, 404);
  });

  test('un id gigantesco -> 404 (no rompe el servidor)', async () => {
    const res = await ctx.request('DELETE', '/api/tasks/99999999999999999999999');
    assert.equal(res.status, 404);
  });

  test('ruta de API que no existe -> 404 en JSON', async () => {
    const res = await ctx.request('GET', '/api/usuarios');
    assert.equal(res.status, 404);
    assert.ok(res.json.error);
  });

  test('método no permitido -> 405 con cabecera Allow', async () => {
    const res = await ctx.request('PATCH', '/api/tasks');
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, POST');
  });

  test('archivo de datos dañado -> 500 sin revelar detalles internos', async () => {
    fs.writeFileSync(ctx.dataFile, '{{{ basura');
    const res = await ctx.request('GET', '/api/tasks');
    assert.equal(res.status, 500);
    assert.equal(res.json.error, 'Error interno del servidor.');
    assert.ok(!res.text.includes(ctx.dataFile), 'no debe filtrar la ruta del archivo');
  });
});

describe('Frontend <-> backend', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  test('el servidor entrega la misma lógica que usa el navegador', async () => {
    const res = await ctx.request('GET', '/shared/todo.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.match(res.text, /TodoLogic/);
  });

  test('las tareas de la API tienen los campos que el frontend necesita', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Forma' });
    const { json } = await ctx.request('GET', '/api/tasks');
    assert.deepEqual(Object.keys(json[0]).sort(), ['done', 'id', 'title']);
    assert.equal(typeof json[0].id, 'number');
    assert.equal(typeof json[0].title, 'string');
    assert.equal(typeof json[0].done, 'boolean');
  });
});
