const router = require('express').Router();

const CAP = 25;
const list = (db, extra, ...args) =>
  db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS enrolled FROM courses c ${extra}`).all(...args);

router.get('/courses', (req, res) => {
  const q = `%${String(req.query.q || '').replace(/[%_\\]/g, '\\$&')}%`;
  const mine = new Set(req.app.locals.db.prepare('SELECT course_id FROM enrollments WHERE user_id = ?').all(req.user.id).map((r) => r.course_id));
  const rows = list(req.app.locals.db,
    `WHERE code LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR name_zh LIKE ? ESCAPE '\\' OR teacher_en LIKE ? ESCAPE '\\' OR teacher_zh LIKE ? ESCAPE '\\' ORDER BY code`,
    q, q, q, q, q);
  res.json(rows.map((c) => ({ ...c, is_enrolled: mine.has(c.id) })));
});

router.get('/my-courses', (req, res) =>
  res.json(list(req.app.locals.db, 'WHERE id IN (SELECT course_id FROM enrollments WHERE user_id = ?) ORDER BY day, start_period', req.user.id)));

router.post('/enroll/:courseId', (req, res) => {
  const db = req.app.locals.db;
  // better-sqlite3 is synchronous, so check + insert is atomic within one request.
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ code: 'COURSE_NOT_FOUND' });
  const mine = db.prepare('SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ?').all(req.user.id);
  const fail = (code) => res.status(409).json({ code });
  if (mine.some((c) => c.id === course.id)) return fail('ALREADY_ENROLLED');
  if (db.prepare('SELECT COUNT(*) n FROM enrollments WHERE course_id = ?').get(course.id).n >= course.capacity) return fail('COURSE_FULL');
  const end = (c) => c.start_period + c.periods;
  if (mine.some((c) => c.day === course.day && c.start_period < end(course) && course.start_period < end(c))) return fail('TIME_CONFLICT');
  if (mine.reduce((s, c) => s + c.credits, course.credits) > CAP) return fail('CREDIT_CAP');
  db.prepare('INSERT INTO enrollments(user_id, course_id) VALUES(?, ?)').run(req.user.id, course.id);
  res.status(201).json({ ok: true });
});

router.delete('/enroll/:courseId', (req, res) => {
  const r = req.app.locals.db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(req.user.id, req.params.courseId);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ code: 'NOT_ENROLLED' });
});

module.exports = router;
