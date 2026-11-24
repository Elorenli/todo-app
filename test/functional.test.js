'use strict';

/*
 * PRUEBAS FUNCIONALES
 * Recorren la app como lo haría una persona: abrir la página, agregar, completar,
 * filtrar, editar y eliminar tareas. Se comprueba el resultado visible, no el código interno.
 *
 * Límite honesto: estas pruebas usan la API HTTP, no un navegador real. Lo que se ve y se
 * siente en pantalla se revisa con la guía de usabilidad (GUIA_USABILIDAD.md).
 */
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../support/helpers');

describe('Escenario: una persona organiza su día', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  const titles = (list) => list.map((t) => t.title);

  test('flujo completo: agregar, completar, filtrar, editar y eliminar', async () => {
    // 1. Abre la aplicación
    const page = await ctx.request('GET', '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(page.text, /id="add-form"/);
    assert.match(page.text, /id="task-list"/);

    // 2. Al principio no hay tareas
    assert.deepEqual((await ctx.request('GET', '/api/tasks')).json, []);

    // 3. Agrega tres tareas
    for (const title of ['Comprar pan', 'Hacer la tarea', 'Llamar a la abuela']) {
      const res = await ctx.request('POST', '/api/tasks', { title });
      assert.equal(res.status, 201);
    }
    let all = (await ctx.request('GET', '/api/tasks')).json;
    assert.deepEqual(titles(all), ['Comprar pan', 'Hacer la tarea', 'Llamar a la abuela']);
    assert.ok(all.every((t) => t.done === false), 'todas empiezan pendientes');

    // 4. Completa "Hacer la tarea"
    const done = await ctx.request('PUT', '/api/tasks/2', { done: true });
    assert.equal(done.json.done, true);

    // 5. Filtros: pendientes y completadas
    const pending = (await ctx.request('GET', '/api/tasks?filter=active')).json;
    const completed = (await ctx.request('GET', '/api/tasks?filter=completed')).json;
    assert.deepEqual(titles(pending), ['Comprar pan', 'Llamar a la abuela']);
    assert.deepEqual(titles(completed), ['Hacer la tarea']);

    // 6. Corrige el texto de una tarea
    const edited = await ctx.request('PUT', '/api/tasks/1', { title: 'Comprar pan y leche' });
    assert.equal(edited.json.title, 'Comprar pan y leche');

    // 7. Elimina una tarea
    assert.equal((await ctx.request('DELETE', '/api/tasks/3')).status, 204);

    // 8. Estado final
    all = (await ctx.request('GET', '/api/tasks')).json;
    assert.deepEqual(all, [
      { id: 1, title: 'Comprar pan y leche', done: false },
      { id: 2, title: 'Hacer la tarea', done: true },
    ]);
  });

  test('desmarcar una tarea completada la devuelve a pendientes', async () => {
    await ctx.request('POST', '/api/tasks', { title: 'Regar las plantas' });
    await ctx.request('PUT', '/api/tasks/1', { done: true });
    await ctx.request('PUT', '/api/tasks/1', { done: false });
    const pending = (await ctx.request('GET', '/api/tasks?filter=active')).json;
    assert.deepEqual(titles(pending), ['Regar las plantas']);
  });

  test('los espacios de más se limpian al guardar', async () => {
    const res = await ctx.request('POST', '/api/tasks', { title: '   Sacar   la   basura  ' });
    assert.equal(res.json.title, 'Sacar la basura');
  });

  test('los errores llegan en español y con un mensaje claro', async () => {
    const empty = await ctx.request('POST', '/api/tasks', { title: '' });
    assert.equal(empty.json.error, 'El título no puede estar vacío.');

    const long = await ctx.request('POST', '/api/tasks', { title: 'x'.repeat(101) });
    assert.match(long.json.error, /100 caracteres/);

    const missing = await ctx.request('DELETE', '/api/tasks/42');
    assert.equal(missing.json.error, 'No existe la tarea 42.');
  });

  test('se pueden guardar acentos, ñ y emojis', async () => {
    const title = 'Llevar al niño a la piñata 🎉';
    await ctx.request('POST', '/api/tasks', { title });
    const { json } = await ctx.request('GET', '/api/tasks');
    assert.equal(json[0].title, title);
  });

  test('una lista larga (200 tareas) se guarda y se lista completa', async () => {
    for (let i = 1; i <= 200; i++) {
      await ctx.request('POST', '/api/tasks', { title: `Tarea ${i}` });
    }
    const { json } = await ctx.request('GET', '/api/tasks');
    assert.equal(json.length, 200);
    assert.equal(json[199].title, 'Tarea 200');
  });
});

describe('Escenario: la página se carga completa', () => {
  let ctx;
  beforeEach(async () => { ctx = await startTestServer(); });
  afterEach(async () => { await ctx.close(); });

  test('todos los scripts y estilos que pide index.html existen', async () => {
    const page = await ctx.request('GET', '/');
    const refs = [...page.text.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(refs.length >= 3, 'debería referenciar estilo y scripts');
    for (const ref of refs) {
      const res = await ctx.request('GET', ref);
      assert.equal(res.status, 200, `${ref} debería cargarse`);
    }
  });

  test('la página declara idioma español y es adaptable a móviles', async () => {
    const page = await ctx.request('GET', '/');
    assert.match(page.text, /<html lang="es">/);
    assert.match(page.text, /name="viewport"/);
  });

  test('una página que no existe responde 404', async () => {
    const res = await ctx.request('GET', '/no-existe.html');
    assert.equal(res.status, 404);
  });
});
