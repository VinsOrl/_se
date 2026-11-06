const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { adminOnly } = require('../auth');

const dir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(dir, { recursive: true });

// Extension comes from our own whitelist, never from the client filename.
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
const MAGIC = { '.png': '89504e47', '.jpg': 'ffd8ff', '.gif': '47494638', '.webp': '52494646' };
const upload = multer({
  storage: multer.diskStorage({ destination: dir, filename: (req, f, cb) => cb(null, crypto.randomUUID() + EXT[f.mimetype]) }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, cb) => (EXT[f.mimetype] ? cb(null, true) : cb(Object.assign(new Error('bad file'), { code: 'INVALID_FILE' }))),
});

function magicOk(f) {
  const fd = fs.openSync(f.path, 'r'), buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return buf.toString('hex').startsWith(MAGIC[path.extname(f.filename)]);
}

const TYPES = ['sick', 'personal', 'official', 'other'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Wraps multer so its errors become coded JSON responses.
const parse = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'INVALID_FILE') return res.status(400).json({ code: 'INVALID_FILE' });
    next(err);
  });

router.post('/leave', parse, (req, res) => {
  const { type, date_from, date_to, reason } = req.body;
  const f = req.file;
  const bad = (code) => { if (f) fs.unlink(f.path, () => {}); return res.status(400).json({ code }); };
  if (!TYPES.includes(type) || !isDate(date_from) || !isDate(date_to) || date_from > date_to ||
      typeof reason !== 'string' || !reason.trim() || reason.length > 500) return bad('INVALID_INPUT');
  if (f && !magicOk(f)) return bad('INVALID_FILE');
  const r = req.app.locals.db.prepare('INSERT INTO leave_requests(user_id,type,date_from,date_to,reason,file_path) VALUES(?,?,?,?,?,?)')
    .run(req.user.id, type, date_from, date_to, reason.trim(), f ? f.filename : null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get('/leave', (req, res) => {
  const admin = req.user.role === 'admin';
  res.json(req.app.locals.db.prepare(
    `SELECT l.*, u.student_id, u.name FROM leave_requests l JOIN users u ON u.id = l.user_id ${admin ? '' : 'WHERE l.user_id = ?'} ORDER BY l.id DESC`)
    .all(...(admin ? [] : [req.user.id])));
});

router.patch('/leave/:id', adminOnly, (req, res) => {
  const status = (req.body || {}).status;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ code: 'INVALID_INPUT' });
  const r = req.app.locals.db.prepare('UPDATE leave_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ code: 'NOT_FOUND' });
});

module.exports = router;
