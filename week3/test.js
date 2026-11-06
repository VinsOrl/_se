const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./lib.js');

const items = [{ name: 'a', qty: 2, price: 1000 }, { name: 'b', qty: 1, price: 500 }]; // sum 2500

test('totals: none / exclusive / inclusive', () => {
  assert.deepEqual(pick(Q.calcTotals(items, 'none', 0)), { sum: 2500, subtotal: 2500, tax: 0, total: 2500 });
  assert.deepEqual(pick(Q.calcTotals(items, 'exclusive', 0)), { sum: 2500, subtotal: 2500, tax: 125, total: 2625 });
  assert.deepEqual(pick(Q.calcTotals(items, 'inclusive', 0)), { sum: 2500, subtotal: 2381, tax: 119, total: 2500 });
});
const pick = ({ sum, subtotal, tax, total }) => ({ sum, subtotal, tax, total });

test('discount: before tax, clamped', () => {
  const t = Q.calcTotals(items, 'exclusive', 500); // base 2000, tax 100
  assert.equal(t.tax, 100); assert.equal(t.total, 2100);
  assert.equal(Q.calcTotals(items, 'none', 99999).discount, 2500);
  assert.equal(Q.calcTotals(items, 'none', 99999).total, 0);
  assert.equal(Q.calcTotals(items, 'none', -5).discount, 0);
});

test('bad numbers count as 0', () => {
  const t = Q.calcTotals([{ qty: 'x', price: 5 }, { qty: 2, price: null }, { qty: 3, price: '10' }], 'none', 'abc');
  assert.equal(t.total, 30);
  assert.equal(Q.calcTotals(null, 'none').total, 0);
});

test('line amounts keep 2 decimals', () => {
  assert.equal(Q.calcTotals([{ qty: 3, price: 0.1 }], 'none').lines[0].amount, 0.3);
});

test('chinese capital', () => {
  const c = { 0: '零元整', 1050: '壹仟零伍拾元整', 12345: '壹萬貳仟參佰肆拾伍元整', 100000: '壹拾萬元整',
    10005: '壹萬零伍元整', 100200: '壹拾萬零貳佰元整', 10500: '壹萬零伍佰元整',
    100000005: '壹億零伍元整', 1234567890: '壹拾貳億參仟肆佰伍拾陸萬柒仟捌佰玖拾元整' };
  for (const [n, s] of Object.entries(c)) assert.equal(Q.toChineseCapital(+n), s, n);
});

test('formatMoney', () => assert.equal(Q.formatMoney(10500), 'NT$ 10,500'));

test('doc number + sequence', () => {
  assert.equal(Q.docNumber('quote', '2026-11-07', 1), 'QT-20261107-001');
  assert.equal(Q.docNumber('invoice', new Date(2026, 10, 7), 12), 'INV-20261107-012');
  const h = ['QT-20261107-001', 'QT-20261107-002', 'INV-20261107-001', 'QT-20261106-001'];
  assert.equal(Q.nextSeq(h, 'quote', '2026-11-07'), 3);
  assert.equal(Q.nextSeq(h, 'invoice', '2026-11-07'), 2);
  assert.equal(Q.nextSeq([], 'quote', '2026-11-07'), 1);
});

test('localDate uses local time, not UTC', () => {
  assert.equal(Q.localDate(new Date(2026, 0, 1, 0, 30)), '2026-01-01'); // UTC would be 2025-12-31 in Asia/Taipei
});

test('validate', () => {
  const ok = { seller: 'me', client: 'you', items: [{ name: 'x', qty: 1, price: 0 }] };
  assert.deepEqual(Q.validate(ok), []);
  assert.deepEqual(Q.validate({ seller: ' ', client: '', items: [] }), ['seller', 'client', 'items']);
  assert.deepEqual(Q.validate({ ...ok, items: [{ name: 'x', qty: 0, price: 5 }] }), ['items']);
  assert.deepEqual(Q.validate({ ...ok, items: [{ name: 'x', qty: 1, price: '' }] }), ['items']);
  assert.deepEqual(Q.validate({ ...ok, items: [{ name: '', qty: 1, price: 5 }] }), ['items']);
});

test('esc blocks HTML injection', () =>
  assert.equal(Q.esc('<img onerror="x">&\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;'));
