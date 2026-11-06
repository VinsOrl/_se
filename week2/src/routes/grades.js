const router = require('express').Router();

router.get('/grades', (req, res) => {
  const { semester } = req.query;
  if (typeof semester !== 'string' || !/^\d{3}-[12]$/.test(semester)) return res.status(400).json({ code: 'INVALID_INPUT' });
  const rows = req.app.locals.db.prepare('SELECT * FROM grades WHERE user_id = ? AND semester = ? ORDER BY id').all(req.user.id, semester);
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  const average = credits ? rows.reduce((s, r) => s + r.score * r.credits, 0) / credits : null; // credit-weighted
  res.json({ rows, average });
});

module.exports = router;
