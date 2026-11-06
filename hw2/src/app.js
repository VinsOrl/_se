const express = require('express');
const path = require('path');
const openDb = require('./db');
const { secret, router: login, auth } = require('./auth');

module.exports = (dbFile) => {
  secret(); // fail at startup, not at first login, if JWT_SECRET is missing/weak
  const app = express();
  app.locals.db = openDb(dbFile);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'" });
    next();
  });
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', login);
  app.use('/api', auth);
  app.use('/api', require('./routes/courses'), require('./routes/leave'), require('./routes/grades'));
  app.use('/api', (req, res) => res.status(404).json({ code: 'NOT_FOUND' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ code: 'FILE_TOO_LARGE' });
    if (err.type === 'entity.parse.failed' || err.name === 'MulterError') return res.status(400).json({ code: 'INVALID_INPUT' });
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR' });
  });
  return app;
};
