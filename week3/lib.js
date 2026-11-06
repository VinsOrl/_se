// Pure logic. Browser: window.QI. Node: module.exports.
(function (root) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }; // bad/negative -> 0
  const r2 = (n) => Math.round(n * 100) / 100;

  function calcTotals(items, taxMode, discount) {
    const lines = (items || []).map((i) => {
      const qty = num(i && i.qty), price = num(i && i.price);
      return { name: (i && i.name) || '', qty, price, amount: r2(qty * price) };
    });
    const sum = r2(lines.reduce((s, l) => s + l.amount, 0));
    const d = Math.min(Math.max(num(discount), 0), sum);
    const base = Math.round(sum - d); // ponytail: whole-dollar base so totals add up; sub-dollar cents are rounded away
    let subtotal = base, tax = 0;
    if (taxMode === 'exclusive') tax = Math.round(base * 0.05);
    else if (taxMode === 'inclusive') { subtotal = Math.round(base / 1.05); tax = base - subtotal; }
    return { lines, sum, discount: d, subtotal, tax, total: taxMode === 'exclusive' ? base + tax : base };
  }

  const D = '零壹貳參肆伍陸柒捌玖', U = ['', '拾', '佰', '仟'], BIG = ['', '萬', '億', '兆'];
  function toChineseCapital(n) {
    n = Math.round(Number(n)) || 0;
    if (n <= 0) return '零元整';
    const groups = [];
    for (; n > 0; n = Math.floor(n / 10000)) groups.push(n % 10000); // low -> high
    let out = '', zero = false;
    for (let g = groups.length - 1; g >= 0; g--) {
      const s = String(groups[g]).padStart(4, '0');
      if (groups[g] === 0) { zero = true; continue; }
      for (let i = 0; i < 4; i++) {
        const d = +s[i];
        if (d === 0) { zero = true; continue; }
        if (zero && out) out += '零';
        zero = false;
        out += D[d] + U[3 - i];
      }
      out += BIG[g];
    }
    return out + '元整';
  }

  const formatMoney = (n) => 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('en-US');

  const ymd = (date) => typeof date === 'string' ? date.replace(/-/g, '') : localDate(date).replace(/-/g, '');
  function localDate(d) { // local date, NOT toISOString (UTC)
    d = d || new Date();
    const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const prefix = (type, date) => (type === 'invoice' ? 'INV' : 'QT') + '-' + ymd(date) + '-';
  const docNumber = (type, date, seq) => prefix(type, date) + String(seq).padStart(3, '0');
  const nextSeq = (history, type, date) =>
    (history || []).filter((h) => String(h).startsWith(prefix(type, date))).length + 1;

  function validate(doc) {
    const missing = [];
    if (!String(doc.seller || '').trim()) missing.push('seller');
    if (!String(doc.client || '').trim()) missing.push('client');
    const ok = (doc.items || []).some((i) =>
      String(i.name || '').trim() && Number(i.qty) > 0 && i.price !== '' && Number(i.price) >= 0);
    if (!ok) missing.push('items');
    return missing;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const QI = { calcTotals, toChineseCapital, formatMoney, docNumber, nextSeq, localDate, validate, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = QI;
  else root.QI = QI;
})(typeof window !== 'undefined' ? window : globalThis);
