'use strict';

const { validateTitle } = require('./validation');

class TodoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TodoError';
    this.code = code; // 'VALIDATION' | 'NOT_FOUND'
  }
}

/** In-memory todo store. Pure logic, no HTTP — easy to unit test. */
class TodoStore {
  constructor() {
    this.todos = new Map();
    this.nextId = 1;
  }

  add(title) {
    const result = validateTitle(title);
    if (!result.valid) throw new TodoError('VALIDATION', result.error);
    const todo = {
      id: this.nextId++,
      title: result.value,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.set(todo.id, todo);
    return { ...todo };
  }

  list(status = 'all') {
    const all = [...this.todos.values()].map((t) => ({ ...t }));
    if (status === 'active') return all.filter((t) => !t.completed);
    if (status === 'completed') return all.filter((t) => t.completed);
    return all;
  }

  get(id) {
    const todo = this.todos.get(id);
    if (!todo) throw new TodoError('NOT_FOUND', `todo ${id} not found`);
    return { ...todo };
  }

  update(id, changes = {}) {
    const todo = this.todos.get(id);
    if (!todo) throw new TodoError('NOT_FOUND', `todo ${id} not found`);

    if ('title' in changes) {
      const result = validateTitle(changes.title);
      if (!result.valid) throw new TodoError('VALIDATION', result.error);
      todo.title = result.value;
    }
    if ('completed' in changes) {
      if (typeof changes.completed !== 'boolean') {
        throw new TodoError('VALIDATION', 'completed must be a boolean');
      }
      todo.completed = changes.completed;
    }
    return { ...todo };
  }

  remove(id) {
    if (!this.todos.delete(id)) throw new TodoError('NOT_FOUND', `todo ${id} not found`);
  }

  clearCompleted() {
    let removed = 0;
    for (const [id, todo] of this.todos) {
      if (todo.completed) {
        this.todos.delete(id);
        removed++;
      }
    }
    return removed;
  }

  stats() {
    const total = this.todos.size;
    const completed = [...this.todos.values()].filter((t) => t.completed).length;
    return { total, completed, active: total - completed };
  }
}

module.exports = { TodoStore, TodoError };
