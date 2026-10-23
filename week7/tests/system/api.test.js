'use strict';

// System tests: boot the real HTTP server on a random port and exercise the
// public API over the network, exactly like an external client would.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../src/app');
const { TodoStore } = require('../../src/todoStore');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = createApp(new TodoStore()).listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function reset() {
  for (const t of (await call('GET', '/api/todos')).body) await call('DELETE', `/api/todos/${t.id}`);
}

test('GET /api/health returns ok', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: 'ok' });
});

test('POST /api/todos creates a todo (201 + Location)', async () => {
  await reset();
  const r = await call('POST', '/api/todos', { title: '  learn   testing ' });
  assert.equal(r.status, 201);
  assert.equal(r.body.title, 'learn testing');
  assert.equal(r.body.completed, false);
  assert.equal(r.headers.get('location'), `/api/todos/${r.body.id}`);
});

test('POST /api/todos rejects bad input with 400', async () => {
  for (const body of [{}, { title: '' }, { title: '   ' }, { title: 5 }, { title: 'x'.repeat(101) }]) {
    const r = await call('POST', '/api/todos', body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(r.body.error);
  }
});

test('POST /api/todos rejects malformed JSON with 400', async () => {
  const res = await fetch(base + '/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid JSON body');
});

test('GET /api/todos/:id returns one todo, 404 if missing, 400 if id is malformed', async () => {
  await reset();
  const { body: created } = await call('POST', '/api/todos', { title: 'findme' });
  assert.equal((await call('GET', `/api/todos/${created.id}`)).body.title, 'findme');
  assert.equal((await call('GET', '/api/todos/99999')).status, 404);
  assert.equal((await call('GET', '/api/todos/abc')).status, 400);
});

test('PATCH /api/todos/:id updates completed and title', async () => {
  await reset();
  const { body: t } = await call('POST', '/api/todos', { title: 'patch me' });
  const done = await call('PATCH', `/api/todos/${t.id}`, { completed: true });
  assert.equal(done.status, 200);
  assert.equal(done.body.completed, true);
  const renamed = await call('PATCH', `/api/todos/${t.id}`, { title: 'patched' });
  assert.equal(renamed.body.title, 'patched');
  assert.equal(renamed.body.completed, true);
});

test('PATCH validates body and id', async () => {
  await reset();
  const { body: t } = await call('POST', '/api/todos', { title: 'x' });
  assert.equal((await call('PATCH', `/api/todos/${t.id}`, {})).status, 400);
  assert.equal((await call('PATCH', `/api/todos/${t.id}`, { completed: 'yes' })).status, 400);
  assert.equal((await call('PATCH', `/api/todos/${t.id}`, { title: '' })).status, 400);
  assert.equal((await call('PATCH', '/api/todos/99999', { completed: true })).status, 404);
});

test('DELETE /api/todos/:id removes the todo (204) then 404s', async () => {
  await reset();
  const { body: t } = await call('POST', '/api/todos', { title: 'bye' });
  assert.equal((await call('DELETE', `/api/todos/${t.id}`)).status, 204);
  assert.equal((await call('GET', `/api/todos/${t.id}`)).status, 404);
  assert.equal((await call('DELETE', `/api/todos/${t.id}`)).status, 404);
});

test('GET /api/todos filters by status and rejects unknown status', async () => {
  await reset();
  await call('POST', '/api/todos', { title: 'active one' });
  const { body: d } = await call('POST', '/api/todos', { title: 'done one' });
  await call('PATCH', `/api/todos/${d.id}`, { completed: true });

  assert.equal((await call('GET', '/api/todos')).body.length, 2);
  assert.deepEqual((await call('GET', '/api/todos?status=active')).body.map((t) => t.title), ['active one']);
  assert.deepEqual((await call('GET', '/api/todos?status=completed')).body.map((t) => t.title), ['done one']);
  assert.equal((await call('GET', '/api/todos?status=bogus')).status, 400);
});

test('DELETE /api/todos?completed=true clears completed todos; other bulk deletes are refused', async () => {
  await reset();
  await call('POST', '/api/todos', { title: 'keep' });
  const { body: d } = await call('POST', '/api/todos', { title: 'drop' });
  await call('PATCH', `/api/todos/${d.id}`, { completed: true });

  assert.equal((await call('DELETE', '/api/todos')).status, 400);
  const r = await call('DELETE', '/api/todos?completed=true');
  assert.deepEqual(r.body, { removed: 1 });
  assert.deepEqual((await call('GET', '/api/todos')).body.map((t) => t.title), ['keep']);
});

test('GET /api/stats reflects current state', async () => {
  await reset();
  await call('POST', '/api/todos', { title: 'a' });
  const { body: b } = await call('POST', '/api/todos', { title: 'b' });
  await call('PATCH', `/api/todos/${b.id}`, { completed: true });
  assert.deepEqual((await call('GET', '/api/stats')).body, { total: 2, completed: 1, active: 1 });
});

test('unknown /api routes return JSON 404', async () => {
  const r = await call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'not found');
});

test('the static client is served at /', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>Todo App<\/title>/);
});
