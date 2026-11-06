const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = require('express').Router();

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set (see .env.example)');
  return process.env.JWT_SECRET;
};
const dummyHash = bcrypt.hashSync('x', 10); // equalize timing for unknown users

router.post('/login', (req, res) => {
  const { student_id, password } = req.body || {};
  if (typeof student_id !== 'string' || typeof password !== 'string') return res.status(400).json({ code: 'INVALID_INPUT' });
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  const ok = bcrypt.compareSync(password, user ? user.password_hash : dummyHash);
  if (!user || !ok) return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
  const token = jwt.sign({ id: user.id, role: user.role }, secret(), { expiresIn: '8h' });
  res.json({ token, user: { student_id: user.student_id, name: user.name, role: user.role } });
});

// Role is re-read from the DB so a stale/forged claim can't grant admin.
const auth = (req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!m) return res.status(401).json({ code: 'UNAUTHORIZED' });
  try {
    const { id } = jwt.verify(m[1], secret(), { algorithms: ['HS256'] });
    req.user = req.app.locals.db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  } catch { /* fall through */ }
  if (!req.user) return res.status(401).json({ code: 'UNAUTHORIZED' });
  next();
};
const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ code: 'FORBIDDEN' }));

module.exports = { router, auth, adminOnly };
