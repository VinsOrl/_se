const router = require('express').Router();
const { createUser, adminOnly } = require('../auth');

router.post('/users', adminOnly, (req, res) =>
  createUser(req, res, (req.body || {}).role === 'admin' ? 'admin' : 'student'));

module.exports = router;
