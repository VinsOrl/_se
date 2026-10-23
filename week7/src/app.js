'use strict';

const path = require('path');
const express = require('express');
const { TodoStore, TodoError } = require('./todoStore');
const { isValidStatus } = require('./validation');

/** Parse a positive integer id from a route param, or return null. */
function parseId(raw) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * Build the Express app. The store is injectable so tests can get a fresh one.
 */
function createApp(store = new TodoStore()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/stats', (_req, res) => res.json(store.stats()));

  app.get('/api/todos', (req, res) => {
    const status = req.query.status ?? 'all';
    if (!isValidStatus(status)) {
      return res.status(400).json({ error: 'status must be one of: all, active, completed' });
    }
    res.json(store.list(status));
  });

  app.post('/api/todos', (req, res, next) => {
    try {
      const todo = store.add(req.body?.title);
      res.status(201).location(`/api/todos/${todo.id}`).json(todo);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/todos/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });
      res.json(store.get(id));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/todos/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });
      const body = req.body ?? {};
      if (!('title' in body) && !('completed' in body)) {
        return res.status(400).json({ error: 'provide title and/or completed' });
      }
      res.json(store.update(id, body));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/todos', (req, res) => {
    if (req.query.completed !== 'true') {
      return res.status(400).json({ error: 'only ?completed=true bulk delete is supported' });
    }
    res.json({ removed: store.clearCompleted() });
  });

  app.delete('/api/todos/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });
      store.remove(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof TodoError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'invalid JSON body' });
    }
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp, parseId };
