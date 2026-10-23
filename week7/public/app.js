(() => {
  const $ = (sel) => document.querySelector(sel);
  const listEl = $('#todo-list');
  const emptyEl = $('#empty');
  const errorEl = $('#error');
  const countEl = $('#count');
  const inputEl = $('#new-title');
  let filter = 'all';

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'request failed');
    return data;
  }

  function showError(message) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function render(todos, stats) {
    listEl.innerHTML = '';
    for (const todo of todos) {
      const li = document.createElement('li');
      li.dataset.id = todo.id;
      if (todo.completed) li.classList.add('done');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', `Toggle ${todo.title}`);
      checkbox.addEventListener('change', () => toggle(todo.id, checkbox.checked));

      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = todo.title;

      const del = document.createElement('button');
      del.className = 'delete';
      del.type = 'button';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete ${todo.title}`);
      del.addEventListener('click', () => remove(todo.id));

      li.append(checkbox, title, del);
      listEl.append(li);
    }
    emptyEl.hidden = todos.length > 0;
    countEl.textContent = `${stats.active} item${stats.active === 1 ? '' : 's'} left`;
  }

  async function refresh() {
    const [todos, stats] = await Promise.all([
      api(`/api/todos?status=${filter}`),
      api('/api/stats'),
    ]);
    render(todos, stats);
  }

  async function toggle(id, completed) {
    try {
      await api(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) });
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/api/todos/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  }

  $('#add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/todos', { method: 'POST', body: JSON.stringify({ title: inputEl.value }) });
      inputEl.value = '';
      showError('');
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  });

  document.querySelectorAll('.filters button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      filter = btn.dataset.filter;
      document.querySelectorAll('.filters button').forEach((b) => b.classList.toggle('active', b === btn));
      await refresh();
    });
  });

  $('#clear-completed').addEventListener('click', async () => {
    try {
      await api('/api/todos?completed=true', { method: 'DELETE' });
      await refresh();
    } catch (err) {
      showError(err.message);
    }
  });

  refresh().catch((err) => showError(err.message));
})();
