'use strict';

/*
 * Lógica pura de la lista de tareas.
 * No toca archivos, red ni el DOM: por eso es fácil de probar con pruebas unitarias.
 * Se usa tanto en el servidor (require) como en el navegador (window.TodoLogic).
 *
 * Regla de oro: ninguna función modifica el arreglo que recibe; siempre devuelve uno nuevo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TodoLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_TITLE_LENGTH = 100;
  const FILTERS = ['all', 'active', 'completed'];

  class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  }

  function normalizeTitle(title) {
    if (typeof title !== 'string') {
      throw new ValidationError('El título debe ser texto.');
    }
    const clean = title.trim().replace(/\s+/g, ' ');
    if (clean.length === 0) {
      throw new ValidationError('El título no puede estar vacío.');
    }
    if (clean.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(`El título no puede superar los ${MAX_TITLE_LENGTH} caracteres.`);
    }
    return clean;
  }

  function indexOfTask(tasks, id) {
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      throw new NotFoundError(`No existe la tarea ${id}.`);
    }
    return index;
  }

  function addTask(tasks, title, id) {
    if (!Number.isInteger(id) || id < 1) {
      throw new ValidationError('El id debe ser un número entero positivo.');
    }
    if (tasks.some((task) => task.id === id)) {
      throw new ValidationError(`Ya existe una tarea con el id ${id}.`);
    }
    const task = { id, title: normalizeTitle(title), done: false };
    return [...tasks, task];
  }

  function updateTask(tasks, id, changes) {
    const index = indexOfTask(tasks, id);
    if (changes === null || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new ValidationError('Los cambios deben ser un objeto.');
    }
    const hasTitle = 'title' in changes;
    const hasDone = 'done' in changes;
    if (!hasTitle && !hasDone) {
      throw new ValidationError('Indica al menos "title" o "done".');
    }

    const updated = { ...tasks[index] };
    if (hasTitle) {
      updated.title = normalizeTitle(changes.title);
    }
    if (hasDone) {
      if (typeof changes.done !== 'boolean') {
        throw new ValidationError('"done" debe ser verdadero o falso.');
      }
      updated.done = changes.done;
    }
    return tasks.map((task, i) => (i === index ? updated : task));
  }

  function toggleTask(tasks, id) {
    const index = indexOfTask(tasks, id);
    return updateTask(tasks, id, { done: !tasks[index].done });
  }

  function deleteTask(tasks, id) {
    indexOfTask(tasks, id);
    return tasks.filter((task) => task.id !== id);
  }

  function filterTasks(tasks, filter = 'all') {
    if (!FILTERS.includes(filter)) {
      throw new ValidationError(`Filtro desconocido: "${filter}". Usa all, active o completed.`);
    }
    if (filter === 'active') return tasks.filter((task) => !task.done);
    if (filter === 'completed') return tasks.filter((task) => task.done);
    return [...tasks];
  }

  function countPending(tasks) {
    return tasks.filter((task) => !task.done).length;
  }

  return {
    MAX_TITLE_LENGTH,
    FILTERS,
    ValidationError,
    NotFoundError,
    normalizeTitle,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    filterTasks,
    countPending,
  };
});
