const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = require('express').Router();

const secret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be set to 16+ chars (see .env.example)');
  return process.env.JWT_SECRET;
};
const dummyHash = bcrypt.hashSync('x', 10); // equalize timing for unknown users

// ponytail: in-memory, per-process, per-IP (shared IP behind a proxy); use a store + trust proxy if deployed
const fails = new Map();
const MAX_FAILS = 10, WINDOW = 15 * 60 * 1000;

const limited = (map, ip) => {
  const f = map.get(ip);
  if (f && f.reset < Date.now()) map.delete(ip);
  return !!f && f.n >= MAX_FAILS && f.reset >= Date.now();
};
const bump = (map, ip) => {
  const cur = map.get(ip) || { n: 0, reset: Date.now() + WINDOW };
  map.set(ip, { n: cur.n + 1, reset: cur.reset });
};

router.post('/login', (req, res) => {
  if (limited(fails, req.ip)) return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS' });
  const { student_id, password } = req.body || {};
  if (typeof student_id !== 'string' || typeof password !== 'string') return res.status(400).json({ code: 'INVALID_INPUT' });
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  const ok = bcrypt.compareSync(password, user ? user.password_hash : dummyHash);
  if (!user || !ok) {
    bump(fails, req.ip);
    return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
  }
  fails.delete(req.ip);
  const token = jwt.sign({ id: user.id, role: user.role }, secret(), { expiresIn: '8h' });
  res.json({ token, user: { student_id: user.student_id, name: user.name, role: user.role } });
});

// Shared by public signup (role forced to student) and the admin create-user route.
const createUser = (req, res, role) => {
  const { student_id, name, password } = req.body || {};
  if (typeof student_id !== 'string' || !/^[A-Za-z0-9]{3,20}$/.test(student_id) ||
      typeof name !== 'string' || !name.trim() || name.length > 50 ||
      typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) // bcrypt ignores bytes past 72
    return res.status(400).json({ code: 'INVALID_INPUT' });
  const db = req.app.locals.db;
  if (db.prepare('SELECT 1 FROM users WHERE student_id = ?').get(student_id)) return res.status(409).json({ code: 'STUDENT_ID_TAKEN' });
  db.prepare('INSERT INTO users(student_id,name,password_hash,role) VALUES(?,?,?,?)').run(student_id, name.trim(), bcrypt.hashSync(password, 10), role);
  res.status(201).json({ student_id, name: name.trim(), role });
};

const signups = new Map();
router.post('/register', (req, res) => {
  if (limited(signups, req.ip)) return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS' });
  bump(signups, req.ip);
  createUser(req, res, 'student'); // never trust a client-supplied role
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

module.exports = { createUser, secret, router, auth, adminOnly };
