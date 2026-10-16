const express = require('express');
const os = require('os');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Health check: also proves the API can reach PostgreSQL
app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT version() AS version, now() AS time');
    res.json({
      service: 'node-api',
      status: 'ok',
      node: process.version,
      container: os.hostname(),
      db: r.rows[0].version.split(' ').slice(0, 2).join(' '),
      time: r.rows[0].time,
    });
  } catch (err) {
    res.status(503).json({ service: 'node-api', status: 'db-error', error: err.message });
  }
});

app.get('/api/notes', async (_req, res) => {
  try {
    const r = await pool.query('SELECT id, content, created_at FROM notes ORDER BY id DESC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const content = (req.body && req.body.content || '').toString().trim();
  if (!content) return res.status(400).json({ error: 'content is required' });
  if (content.length > 500) return res.status(400).json({ error: 'content too long (max 500)' });
  try {
    const r = await pool.query(
      'INSERT INTO notes (content) VALUES ($1) RETURNING id, content, created_at',
      [content]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const r = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
    res.status(r.rowCount ? 204 : 404).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`node-api listening on :${port}`));
