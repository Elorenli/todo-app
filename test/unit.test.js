'use strict';

/*
 * PRUEBAS UNITARIAS
 * Revisan cada función pequeña de src/todo.js por separado,
 * sin servidor, sin archivos y sin navegador.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/todo');

const sample = () => [
  { id: 1, title: 'Comprar pan', done: false },
  { id: 2, title: 'Estudiar pruebas', done: true },
  { id: 3, title: 'Llamar a mamá', done: false },
];

describe('normalizeTitle', () => {
  test('quita los espacios del inicio y del final', () => {
    assert.equal(T.normalizeTitle('   hola   '), 'hola');
  });

  test('reduce espacios repetidos a uno solo', () => {
    assert.equal(T.normalizeTitle('comprar    pan   y   leche'), 'comprar pan y leche');
  });

  test('rechaza texto vacío o solo espacios', () => {
    assert.throws(() => T.normalizeTitle(''), T.ValidationError);
    assert.throws(() => T.normalizeTitle('     '), T.ValidationError);
    assert.throws(() => T.normalizeTitle('\t\n'), T.ValidationError);
  });

  test('rechaza valores que no son texto', () => {
    for (const value of [42, null, undefined, {}, [], true]) {
      assert.throws(() => T.normalizeTitle(value), T.ValidationError, `debería rechazar ${String(value)}`);
    }
  });

  test('acepta exactamente 100 caracteres y rechaza 101', () => {
    assert.equal(T.normalizeTitle('a'.repeat(100)).length, 100);
    assert.throws(() => T.normalizeTitle('a'.repeat(101)), T.ValidationError);
  });

  test('conserva acentos, ñ y emojis', () => {
    assert.equal(T.normalizeTitle('  Niño al colegio 🎒 '), 'Niño al colegio 🎒');
  });
});

describe('addTask', () => {
  test('agrega una tarea pendiente al final', () => {
    const result = T.addTask([], 'Nueva', 1);
    assert.deepEqual(result, [{ id: 1, title: 'Nueva', done: false }]);
  });

  test('limpia el título antes de guardarlo', () => {
    const result = T.addTask([], '  Nueva   tarea ', 1);
    assert.equal(result[0].title, 'Nueva tarea');
  });

  test('rechaza ids inválidos', () => {
    for (const id of [0, -1, 1.5, '1', NaN, undefined]) {
      assert.throws(() => T.addTask([], 'x', id), T.ValidationError, `id ${String(id)}`);
    }
  });

  test('rechaza un id que ya existe', () => {
    assert.throws(() => T.addTask(sample(), 'x', 2), T.ValidationError);
  });

  test('no modifica el arreglo original', () => {
    const original = sample();
    T.addTask(original, 'Otra', 4);
    assert.equal(original.length, 3);
  });
});

describe('updateTask', () => {
  test('cambia solo el título y mantiene el estado', () => {
    const result = T.updateTask(sample(), 2, { title: 'Estudiar mucho' });
    assert.deepEqual(result[1], { id: 2, title: 'Estudiar mucho', done: true });
  });

  test('cambia solo el estado y mantiene el título', () => {
    const result = T.updateTask(sample(), 1, { done: true });
    assert.deepEqual(result[0], { id: 1, title: 'Comprar pan', done: true });
  });

  test('puede cambiar título y estado a la vez', () => {
    const result = T.updateTask(sample(), 1, { title: 'Pan integral', done: true });
    assert.deepEqual(result[0], { id: 1, title: 'Pan integral', done: true });
  });

  test('lanza NotFoundError si la tarea no existe', () => {
    assert.throws(() => T.updateTask(sample(), 99, { done: true }), T.NotFoundError);
  });

  test('rechaza cambios vacíos o mal formados', () => {
    assert.throws(() => T.updateTask(sample(), 1, {}), T.ValidationError);
    assert.throws(() => T.updateTask(sample(), 1, null), T.ValidationError);
    assert.throws(() => T.updateTask(sample(), 1, []), T.ValidationError);
    assert.throws(() => T.updateTask(sample(), 1, 'done'), T.ValidationError);
  });

  test('rechaza un "done" que no sea booleano', () => {
    assert.throws(() => T.updateTask(sample(), 1, { done: 'yes' }), T.ValidationError);
    assert.throws(() => T.updateTask(sample(), 1, { done: 1 }), T.ValidationError);
  });

  test('rechaza un título vacío al editar', () => {
    assert.throws(() => T.updateTask(sample(), 1, { title: '   ' }), T.ValidationError);
  });

  test('no modifica el arreglo ni la tarea originales', () => {
    const original = sample();
    T.updateTask(original, 1, { title: 'Otro', done: true });
    assert.deepEqual(original, sample());
  });
});

describe('toggleTask', () => {
  test('pasa de pendiente a completada', () => {
    assert.equal(T.toggleTask(sample(), 1)[0].done, true);
  });

  test('pasa de completada a pendiente', () => {
    assert.equal(T.toggleTask(sample(), 2)[1].done, false);
  });

  test('aplicarlo dos veces deja la tarea como estaba', () => {
    assert.deepEqual(T.toggleTask(T.toggleTask(sample(), 1), 1), sample());
  });

  test('lanza NotFoundError si no existe', () => {
    assert.throws(() => T.toggleTask(sample(), 99), T.NotFoundError);
  });
});

describe('deleteTask', () => {
  test('elimina solo la tarea indicada', () => {
    const result = T.deleteTask(sample(), 2);
    assert.deepEqual(result.map((t) => t.id), [1, 3]);
  });

  test('lanza NotFoundError si no existe', () => {
    assert.throws(() => T.deleteTask(sample(), 99), T.NotFoundError);
  });

  test('no modifica el arreglo original', () => {
    const original = sample();
    T.deleteTask(original, 1);
    assert.equal(original.length, 3);
  });
});

describe('filterTasks', () => {
  test('"all" devuelve todas (en una copia)', () => {
    const tasks = sample();
    const result = T.filterTasks(tasks, 'all');
    assert.deepEqual(result, tasks);
    assert.notEqual(result, tasks);
  });

  test('"active" devuelve solo las pendientes', () => {
    assert.deepEqual(T.filterTasks(sample(), 'active').map((t) => t.id), [1, 3]);
  });

  test('"completed" devuelve solo las completadas', () => {
    assert.deepEqual(T.filterTasks(sample(), 'completed').map((t) => t.id), [2]);
  });

  test('sin segundo argumento usa "all"', () => {
    assert.equal(T.filterTasks(sample()).length, 3);
  });

  test('rechaza un filtro desconocido', () => {
    assert.throws(() => T.filterTasks(sample(), 'borradas'), T.ValidationError);
  });

  test('funciona con una lista vacía', () => {
    assert.deepEqual(T.filterTasks([], 'active'), []);
  });
});

describe('countPending', () => {
  test('cuenta solo las pendientes', () => {
    assert.equal(T.countPending(sample()), 2);
  });

  test('devuelve 0 con lista vacía o todo completado', () => {
    assert.equal(T.countPending([]), 0);
    assert.equal(T.countPending([{ id: 1, title: 'x', done: true }]), 0);
  });
});
