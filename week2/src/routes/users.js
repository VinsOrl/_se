const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { createUser, adminOnly } = require('../auth');
const { uploadDir } = require('./leave');

router.use('/users', adminOnly);

router.get('/users', (req, res) =>
  res.json(req.app.locals.db.prepare('SELECT id, student_id, name, role FROM users ORDER BY role, student_id').all()));

router.post('/users', (req, res) => createUser(req, res, (req.body || {}).role === 'admin' ? 'admin' : 'student'));

router.delete('/users/:id', (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ code: 'CANNOT_DELETE_SELF' }); // also guarantees an admin always remains
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) return res.status(404).json({ code: 'USER_NOT_FOUND' });
  const files = db.prepare('SELECT file_path FROM leave_requests WHERE user_id = ? AND file_path IS NOT NULL').all(id);
  db.transaction(() => {
    for (const t of ['enrollments', 'leave_requests', 'grades']) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();
  // file_path is server-generated (uuid + whitelisted ext); basename is belt and braces
  for (const f of files) fs.unlink(path.join(uploadDir, path.basename(f.file_path)), () => {});
  res.json({ ok: true });
});

module.exports = router;
