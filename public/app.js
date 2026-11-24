(function () {
  'use strict';

  var logic = window.TodoLogic;
  var state = { tasks: [], filter: 'all', editingId: null };

  var els = {
    form: document.getElementById('add-form'),
    input: document.getElementById('new-title'),
    list: document.getElementById('task-list'),
    counter: document.getElementById('counter'),
    message: document.getElementById('message'),
    empty: document.getElementById('empty'),
    filters: document.querySelectorAll('[data-filter]'),
  };

  // ---------- Comunicación con el servidor ----------

  async function api(method, url, body) {
    var options = { method: method, headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    var res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      throw new Error('No se pudo conectar con el servidor.');
    }
    if (res.status === 204) return null;
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
    return data;
  }

  function showMessage(text) {
    els.message.textContent = text;
  }

  // Ejecuta una acción y muestra el error (si lo hay) en pantalla.
  async function run(action) {
    try {
      await action();
      showMessage('');
    } catch (err) {
      showMessage(err.message);
    }
  }

  // ---------- Dibujar la pantalla ----------
  // Todo el texto del usuario se inserta con textContent: nunca se interpreta como HTML.

  function makeButton(label, className, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener('click', onClick);
    return button;
  }

  function replaceTask(updated) {
    state.tasks = state.tasks.map(function (t) { return t.id === updated.id ? updated : t; });
  }

  function saveEdit(task, value) {
    return run(async function () {
      var updated = await api('PUT', '/api/tasks/' + task.id, { title: value });
      replaceTask(updated);
      state.editingId = null;
      render();
    });
  }

  function renderTask(task) {
    var li = document.createElement('li');
    li.className = 'task' + (task.done ? ' done' : '');
    li.dataset.id = String(task.id);

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', 'Completada: ' + task.title);
    checkbox.addEventListener('change', function () {
      run(async function () {
        var updated = await api('PUT', '/api/tasks/' + task.id, { done: checkbox.checked });
        replaceTask(updated);
        render();
      });
    });
    li.appendChild(checkbox);

    if (state.editingId === task.id) {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-input';
      input.value = task.title;
      input.maxLength = logic.MAX_TITLE_LENGTH;
      input.setAttribute('aria-label', 'Editar título de la tarea');
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveEdit(task, input.value);
        } else if (event.key === 'Escape') {
          state.editingId = null;
          showMessage('');
          render();
        }
      });
      li.appendChild(input);
      li.appendChild(makeButton('Guardar', 'primary', function () { saveEdit(task, input.value); }));
      li.appendChild(makeButton('Cancelar', '', function () {
        state.editingId = null;
        showMessage('');
        render();
      }));
      setTimeout(function () { input.focus(); input.select(); }, 0);
    } else {
      var title = document.createElement('span');
      title.className = 'title';
      title.textContent = task.title;
      title.addEventListener('dblclick', function () {
        state.editingId = task.id;
        render();
      });
      li.appendChild(title);
      li.appendChild(makeButton('Editar', '', function () {
        state.editingId = task.id;
        render();
      }));
      li.appendChild(makeButton('Eliminar', 'danger', function () {
        if (!window.confirm('¿Eliminar "' + task.title + '"?')) return;
        run(async function () {
          await api('DELETE', '/api/tasks/' + task.id);
          state.tasks = state.tasks.filter(function (t) { return t.id !== task.id; });
          render();
        });
      }));
    }
    return li;
  }

  function render() {
    var visible = logic.filterTasks(state.tasks, state.filter);
    els.list.replaceChildren.apply(els.list, visible.map(renderTask));
    els.empty.hidden = visible.length > 0;

    var pending = logic.countPending(state.tasks);
    els.counter.textContent = state.tasks.length === 0
      ? 'Todavía no tienes tareas'
      : pending + (pending === 1 ? ' pendiente' : ' pendientes') + ' de ' + state.tasks.length;

    els.filters.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
    });
  }

  // ---------- Eventos ----------

  els.form.addEventListener('submit', function (event) {
    event.preventDefault();
    run(async function () {
      var created = await api('POST', '/api/tasks', { title: els.input.value });
      state.tasks.push(created);
      els.input.value = '';
      render();
      els.input.focus();
    });
  });

  els.filters.forEach(function (button) {
    button.addEventListener('click', function () {
      state.filter = button.dataset.filter;
      render();
    });
  });

  run(async function () {
    state.tasks = await api('GET', '/api/tasks');
    render();
  });
})();
