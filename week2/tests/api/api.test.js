process.env.JWT_SECRET = 'test-secret-0123456789';
process.env.UPLOAD_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'nqu-up-'));
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const createApp = require('../../src/app');
const { dict } = require('../../public/i18n.js');

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nqu-')), 'test.db');
const app = createApp(dbFile);
const db = app.locals.db;
const tokens = {};
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const cid = (code) => db.prepare('SELECT id FROM courses WHERE code = ?').get(code).id;
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

before(async () => {
  for (const [who, sid] of [['a', '111210529'], ['b', '111210555'], ['admin', 'admin']]) {
    const r = await request(app).post('/api/login').send({ student_id: sid, password: 'demo1234' });
    tokens[who] = r.body.token;
  }
});

test('login ok / fail', async () => {
  const ok = await request(app).post('/api/login').send({ student_id: '111210529', password: 'demo1234' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const bad = await request(app).post('/api/login').send({ student_id: '111210529', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, 'INVALID_CREDENTIALS');
  assert.equal((await request(app).post('/api/login').send({ student_id: { $ne: 1 }, password: 'x' })).status, 400);
});

test('no / forged token -> 401', async () => {
  assert.equal((await request(app).get('/api/courses')).status, 401);
  assert.equal((await request(app).get('/api/courses').set('Authorization', 'Bearer abc')).status, 401);
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ id: 3, role: 'admin' }, 'wrong-secret');
  assert.equal((await request(app).get('/api/courses').set('Authorization', `Bearer ${forged}`)).status, 401);
  const none = jwt.sign({ id: 3 }, '', { algorithm: 'none' });
  assert.equal((await request(app).get('/api/courses').set('Authorization', `Bearer ${none}`)).status, 401);
});

test('course search', async () => {
  const r = await request(app).get('/api/courses?q=calc').set(as('a'));
  assert.deepEqual(r.body.map((c) => c.code), ['MA101']);
  assert.equal((await request(app).get('/api/courses?q=微積').set(as('a'))).body.length, 1);
  assert.equal((await request(app).get('/api/courses?q=%25').set(as('a'))).body.length, 0); // % is literal
});

test('enroll, duplicate, drop', async () => {
  const id = cid('CS101');
  assert.equal((await request(app).post(`/api/enroll/${id}`).set(as('a'))).status, 201);
  const dup = await request(app).post(`/api/enroll/${id}`).set(as('a'));
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'ALREADY_ENROLLED');
  assert.equal((await request(app).get('/api/my-courses').set(as('a'))).body.length, 1);
  assert.equal((await request(app).get('/api/my-courses').set(as('b'))).body.length, 0);
  assert.equal((await request(app).delete(`/api/enroll/${id}`).set(as('a'))).status, 200);
  assert.equal((await request(app).delete(`/api/enroll/${id}`).set(as('a'))).body.code, 'NOT_ENROLLED');
});

test('time conflict', async () => {
  await request(app).post(`/api/enroll/${cid('CS101')}`).set(as('a'));
  const r = await request(app).post(`/api/enroll/${cid('CS202')}`).set(as('a'));
  assert.equal(r.body.code, 'TIME_CONFLICT');
  await request(app).delete(`/api/enroll/${cid('CS101')}`).set(as('a'));
});

test('course full', async () => {
  const id = cid('CS999');
  assert.equal((await request(app).post(`/api/enroll/${id}`).set(as('a'))).status, 201);
  assert.equal((await request(app).post(`/api/enroll/${id}`).set(as('b'))).body.code, 'COURSE_FULL');
  await request(app).delete(`/api/enroll/${id}`).set(as('a'));
});

test('credit cap 25', async () => {
  const ins = db.prepare('INSERT INTO courses(code,name_en,name_zh,teacher_en,teacher_zh,credits,day,start_period,periods,capacity) VALUES(?,?,?,?,?,3,7,?,1,10)');
  const ids = [];
  for (let p = 1; p <= 8; p++) ids.push(ins.run('X' + p, 'x', 'x', 't', 't', p).lastInsertRowid);
  ids.push(db.prepare('INSERT INTO courses(code,name_en,name_zh,teacher_en,teacher_zh,credits,day,start_period,periods,capacity) VALUES(?,?,?,?,?,3,6,8,1,10)')
    .run('X9', 'x', 'x', 't', 't').lastInsertRowid);
  const codes = [];
  for (const id of ids) codes.push((await request(app).post(`/api/enroll/${id}`).set(as('b'))).body.code);
  assert.equal(codes.slice(0, 8).every((c) => c === undefined), true);
  assert.equal(codes[8], 'CREDIT_CAP'); // 8*3=24, +3 = 27 > 25
});

test('leave: create, non-image rejected, oversize rejected', async () => {
  const f = { type: 'sick', date_from: '2026-01-01', date_to: '2026-01-02', reason: 'flu' };
  const ok = await request(app).post('/api/leave').set(as('a')).field(f).attach('file', png, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(ok.status, 201);
  const noFile = await request(app).post('/api/leave').set(as('a')).field(f);
  assert.equal(noFile.status, 201);
  const txt = await request(app).post('/api/leave').set(as('a')).field(f).attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
  assert.equal(txt.body.code, 'INVALID_FILE');
  const fake = await request(app).post('/api/leave').set(as('a')).field(f).attach('file', Buffer.from('<script>'), { filename: 'a.png', contentType: 'image/png' });
  assert.equal(fake.body.code, 'INVALID_FILE'); // content isn't a PNG
  const big = await request(app).post('/api/leave').set(as('a')).field(f).attach('file', Buffer.concat([png, Buffer.alloc(2.1 * 1024 * 1024)]), { filename: 'a.png', contentType: 'image/png' });
  assert.equal(big.status, 413);
  const badDate = await request(app).post('/api/leave').set(as('a')).field({ ...f, date_to: '2025-01-01' });
  assert.equal(badDate.body.code, 'INVALID_INPUT');
  const mine = await request(app).get('/api/leave').set(as('a'));
  assert.equal(mine.body.length, 2);
  assert.equal(mine.body[0].status, 'pending');
  assert.equal((await request(app).get('/api/leave').set(as('b'))).body.length, 0);
});

test('leave PATCH: student 403, admin ok', async () => {
  const id = (await request(app).get('/api/leave').set(as('a'))).body[0].id;
  assert.equal((await request(app).patch(`/api/leave/${id}`).set(as('a')).send({ status: 'approved' })).status, 403);
  assert.equal((await request(app).patch(`/api/leave/${id}`).set(as('admin')).send({ status: 'bogus' })).status, 400);
  assert.equal((await request(app).patch(`/api/leave/${id}`).set(as('admin')).send({ status: 'approved' })).status, 200);
  assert.equal((await request(app).get('/api/leave').set(as('admin'))).body.length, 2);
});

test('grades only own', async () => {
  const a = await request(app).get('/api/grades?semester=112-1').set(as('a'));
  const b = await request(app).get('/api/grades?semester=112-1').set(as('b'));
  const uid = (who) => db.prepare('SELECT id FROM users WHERE student_id = ?').get(who).id;
  assert.ok(a.body.rows.length > 0 && a.body.rows.every((r) => r.user_id === uid('111210529')));
  assert.ok(b.body.rows.every((r) => r.user_id === uid('111210555')));
  assert.ok(typeof a.body.average === 'number');
  assert.equal((await request(app).get('/api/grades?semester=x').set(as('a'))).status, 400);
});

test('register: creates student only, validates, rejects duplicates', async () => {
  const good = { student_id: 'new0001', name: 'New Kid', password: 'longenough1', role: 'admin' };
  const r = await request(app).post('/api/register').send(good);
  assert.equal(r.status, 201);
  assert.equal(r.body.role, 'student'); // client-supplied role ignored
  const lg = await request(app).post('/api/login').send({ student_id: 'new0001', password: 'longenough1' });
  assert.equal(lg.body.user.role, 'student');
  assert.equal((await request(app).post('/api/register').send(good)).body.code, 'STUDENT_ID_TAKEN');
  for (const bad of [{ ...good, student_id: 'x' }, { ...good, student_id: 'a b!', }, { ...good, student_id: 'ok123', password: 'short' },
                     { ...good, student_id: 'ok124', name: '' }, { ...good, student_id: 'ok125', password: 'é'.repeat(37) }, { ...good, student_id: { a: 1 } }])
    assert.equal((await request(app).post('/api/register').send(bad)).status, 400);
});

test('admin creates users; students cannot', async () => {
  const body = { student_id: 'staff001', name: 'Staff', password: 'longenough1', role: 'admin' };
  assert.equal((await request(app).post('/api/users').send(body)).status, 401);
  assert.equal((await request(app).post('/api/users').set(as('a')).send(body)).status, 403);
  const r = await request(app).post('/api/users').set(as('admin')).send(body);
  assert.equal(r.status, 201);
  assert.equal(r.body.role, 'admin');
  const s = await request(app).post('/api/users').set(as('admin')).send({ ...body, student_id: 'stud0002', role: 'whatever' });
  assert.equal(s.body.role, 'student');
  assert.equal((await request(app).post('/api/users').set(as('admin')).send(body)).body.code, 'STUDENT_ID_TAKEN');
});

test('login rate limit and JWT_SECRET required', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await request(app).post('/api/login').send({ student_id: '111210529', password: 'bad' });
  assert.equal(last.status, 429);
  assert.equal((await request(app).post('/api/login').send({ student_id: '111210529', password: 'demo1234' })).status, 429);
  const s = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
  assert.throws(() => createApp(':memory:'), /JWT_SECRET/);
  process.env.JWT_SECRET = s;
});

test('i18n: dictionaries have identical keys', () => {
  assert.deepEqual(Object.keys(dict.en).sort(), Object.keys(dict['zh-TW']).sort());
});

test('i18n: every error code the API can return has a translation', () => {
  for (const c of ['INVALID_CREDENTIALS', 'UNAUTHORIZED', 'FORBIDDEN', 'ALREADY_ENROLLED', 'COURSE_FULL', 'TIME_CONFLICT', 'CREDIT_CAP', 'INVALID_INPUT', 'INVALID_FILE', 'FILE_TOO_LARGE', 'COURSE_NOT_FOUND', 'NOT_ENROLLED', 'NOT_FOUND', 'TOO_MANY_ATTEMPTS', 'STUDENT_ID_TAKEN', 'SERVER_ERROR'])
    assert.ok(dict.en['err.' + c], c);
});
