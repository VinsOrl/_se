// UI only. Logic lives in lib.js.
const $ = (id) => document.getElementById(id);
const KEY = 'qi-form', HIST = 'qi-history';
const FIELDS = ['type', 'date', 'seller', 'sTax', 'sContact', 'client', 'cContact', 'taxMode', 'discount', 'note'];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode / quota: just don't persist */ } },
};

const blank = () => ({ type: 'quote', date: QI.localDate(), taxMode: 'none', items: [{ name: '', qty: 1, price: '' }] });
let st = Object.assign(blank(), store.get(KEY, {}));
if (!Array.isArray(st.items) || !st.items.length) st.items = blank().items;

function renderItems() {
  $('items').innerHTML = st.items.map((it, i) =>
    `<div class="row" data-i="${i}">
      <input data-k="name" placeholder="Item 品名" value="${QI.esc(it.name)}">
      <input data-k="qty" type="number" min="0" step="any" placeholder="Qty" value="${QI.esc(it.qty)}">
      <input data-k="price" type="number" min="0" step="any" placeholder="Price" value="${QI.esc(it.price)}">
      <button type="button" data-del="${i}" aria-label="Remove item">×</button></div>`).join('');
}

function fillForm() {
  FIELDS.forEach((f) => { $(f).value = st[f] ?? ''; });
  renderItems();
}

function number() {
  const d = st.date || QI.localDate(); // date input can be cleared
  return QI.docNumber(st.type, d, QI.nextSeq(store.get(HIST, []), st.type, d));
}

function preview() {
  const e = QI.esc, t = QI.calcTotals(st.items, st.taxMode, st.discount);
  const title = st.type === 'invoice' ? '請款單' : '報價單';
  const rows = t.lines.map((l) => `<tr><td>${e(l.name)}</td><td class="n">${l.qty}</td>
    <td class="n">${QI.formatMoney(l.price)}</td><td class="n">${QI.formatMoney(l.amount)}</td></tr>`).join('');
  const tax = st.taxMode === 'none' ? '' : `<div><span>${st.taxMode === 'exclusive' ? '營業稅 5%' : '內含稅 5%'}</span><span>${QI.formatMoney(t.tax)}</span></div>`;
  $('doc').innerHTML = `<h1>${title}</h1>
    <div class="meta"><span>No. ${number()}</span><span>${e(st.date)}</span></div>
    <div class="parties">
      <div><b>賣方</b><br>${e(st.seller)}<br>${st.sTax ? '統編 ' + e(st.sTax) + '<br>' : ''}${e(st.sContact)}</div>
      <div><b>客戶</b><br>${e(st.client)}<br>${e(st.cContact)}</div></div>
    <table><thead><tr><th>品名</th><th class="n">數量</th><th class="n">單價</th><th class="n">金額</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot">
      <div><span>小計</span><span>${QI.formatMoney(t.sum)}</span></div>
      ${t.discount ? `<div><span>折扣</span><span>- ${QI.formatMoney(t.discount)}</span></div>` : ''}
      ${st.taxMode === 'none' ? '' : `<div><span>未稅金額</span><span>${QI.formatMoney(t.subtotal)}</span></div>`}
      ${tax}
      <div class="grand"><span>總計</span><span>${QI.formatMoney(t.total)}</span></div></div>
    <div class="cap">大寫金額：${QI.toChineseCapital(t.total)}</div>
    ${st.note ? `<div class="note">${e(st.note)}</div>` : ''}`;
}

function changed() { store.set(KEY, st); preview(); }

$('f').addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.closest('.row')) st.items[el.closest('.row').dataset.i][el.dataset.k] = el.value;
  else if (FIELDS.includes(el.id)) st[el.id] = el.value;
  el.classList.remove('bad');
  $('items').classList.remove('bad');
  changed();
});

$('f').addEventListener('click', (ev) => {
  const del = ev.target.dataset.del;
  if (del === undefined) return;
  st.items.splice(+del, 1);
  if (!st.items.length) st.items = blank().items;
  renderItems(); changed();
});

$('add').onclick = () => { st.items.push({ name: '', qty: 1, price: '' }); renderItems(); changed(); };

$('clear').onclick = () => { st = blank(); $('msg').textContent = ''; fillForm(); changed(); };

$('print').onclick = () => {
  document.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
  const missing = QI.validate({ seller: st.seller, client: st.client, items: st.items });
  if (missing.length) {
    const label = { seller: 'seller 賣方', client: 'client 客戶', items: 'at least one valid item 至少一個有效項目 (name, qty > 0, price ≥ 0)' };
    $('msg').textContent = 'Missing: ' + missing.map((k) => label[k]).join('; ');
    missing.forEach((k) => $(k === 'items' ? 'items' : k).classList.add('bad'));
    return;
  }
  $('msg').textContent = '';
  const n = number(); // already shown in preview
  store.set(HIST, store.get(HIST, []).concat(n));
  window.print();
  preview(); // advance to the next number
};

fillForm();
preview();
