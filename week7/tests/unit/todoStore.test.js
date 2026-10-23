'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TodoStore, TodoError } = require('../../src/todoStore');

function expectTodoError(fn, code) {
  assert.throws(fn, (err) => err instanceof TodoError && err.code === code);
}

test('add creates a todo with incrementing ids and defaults', () => {
  const store = new TodoStore();
  const a = store.add('first');
  const b = store.add('second');
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.equal(a.completed, false);
  assert.ok(!Number.isNaN(Date.parse(a.createdAt)));
});

test('add normalizes the title and rejects invalid ones', () => {
  const store = new TodoStore();
  assert.equal(store.add('  spaced   out ').title, 'spaced out');
  expectTodoError(() => store.add(''), 'VALIDATION');
  expectTodoError(() => store.add(undefined), 'VALIDATION');
  assert.equal(store.stats().total, 1);
});

test('list filters by status', () => {
  const store = new TodoStore();
  store.add('a');
  const b = store.add('b');
  store.update(b.id, { completed: true });
  assert.equal(store.list('all').length, 2);
  assert.deepEqual(store.list('active').map((t) => t.title), ['a']);
  assert.deepEqual(store.list('completed').map((t) => t.title), ['b']);
});

test('returned todos are copies, so callers cannot mutate store state', () => {
  const store = new TodoStore();
  const t = store.add('x');
  t.title = 'hacked';
  assert.equal(store.get(t.id).title, 'x');
});

test('get throws NOT_FOUND for unknown ids', () => {
  expectTodoError(() => new TodoStore().get(99), 'NOT_FOUND');
});

test('update changes title and completed independently', () => {
  const store = new TodoStore();
  const t = store.add('old');
  assert.equal(store.update(t.id, { title: 'new' }).title, 'new');
  const done = store.update(t.id, { completed: true });
  assert.equal(done.completed, true);
  assert.equal(done.title, 'new');
});

test('update validates input and unknown ids', () => {
  const store = new TodoStore();
  const t = store.add('x');
  expectTodoError(() => store.update(t.id, { title: '   ' }), 'VALIDATION');
  expectTodoError(() => store.update(t.id, { completed: 'yes' }), 'VALIDATION');
  expectTodoError(() => store.update(999, { completed: true }), 'NOT_FOUND');
});

test('remove deletes a todo and throws for unknown ids', () => {
  const store = new TodoStore();
  const t = store.add('x');
  store.remove(t.id);
  assert.equal(store.list().length, 0);
  expectTodoError(() => store.remove(t.id), 'NOT_FOUND');
});

test('clearCompleted removes only completed todos and reports the count', () => {
  const store = new TodoStore();
  const a = store.add('a');
  store.add('b');
  const c = store.add('c');
  store.update(a.id, { completed: true });
  store.update(c.id, { completed: true });
  assert.equal(store.clearCompleted(), 2);
  assert.deepEqual(store.list().map((t) => t.title), ['b']);
  assert.equal(store.clearCompleted(), 0);
});

test('stats counts total, active and completed', () => {
  const store = new TodoStore();
  assert.deepEqual(store.stats(), { total: 0, completed: 0, active: 0 });
  const a = store.add('a');
  store.add('b');
  store.update(a.id, { completed: true });
  assert.deepEqual(store.stats(), { total: 2, completed: 1, active: 1 });
});
