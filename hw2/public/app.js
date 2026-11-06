const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get token() { return sessionStorage.getItem('token'); },
  get user() { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } },
};
let msg = null; // {code|key, kind}
const L = () => (getLang() === 'zh-TW' ? 'zh' : 'en');
const pick = (o, f) => o[`${f}_${L()}`];
const fmtDate = (s) => new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(s.slice(0, 10) + 'T00:00:00'));
const fmtNum = (n, d = 1) => new Intl.NumberFormat(getLang(), { maximumFractionDigits: d }).format(n);

function show(key, kind) { msg = key ? { key, kind } : null; renderMsg(); }
function renderMsg() {
  const el = $('#msg');
  el.textContent = msg ? t(msg.key) : '';
  el.className = msg ? msg.kind : '';
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  if (opts.json) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
  let res;
  try { res = await fetch('/api' + path, { ...opts, headers }); } catch { throw { code: 'NETWORK' }; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') logout(false);
    throw { code: data.code || 'SERVER_ERROR' };
  }
  return data;
}
const fail = (e) => show('err.' + (e.code || 'SERVER_ERROR'), 'err');

function logout(announce = true) {
  sessionStorage.clear();
  $('#login-form').reset();
  location.hash = '#/login';
  route();
  if (announce) show('loggedOut', 'ok');
}

const pages = {
  async courses() {
    const q = $('#q')?.value || '';
    const rows = await api('/courses?q=' + encodeURIComponent(q));
    const body = rows.map((c) => {
      const state = c.is_enrolled ? t('enrolled') : c.enrolled >= c.capacity ? t('full') : t('open');
      const btn = c.is_enrolled ? `<button class="alt" data-drop="${c.id}">${t('drop')}</button>` : `<button data-add="${c.id}">${t('add')}</button>`;
      return `<tr><td>${esc(c.code)}</td><td>${esc(pick(c, 'name'))}</td><td>${esc(pick(c, 'teacher'))}</td><td>${c.credits}</td>
        <td>${t('day.' + c.day)} ${c.start_period}-${c.start_period + c.periods - 1}</td><td>${c.enrolled}/${c.capacity}</td><td>${state}</td><td>${btn}</td></tr>`;
    }).join('');
    return `<input id="q" value="${esc(q)}" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}">
      <div class="table-wrap"><table><tr><th>${t('code')}</th><th>${t('name')}</th><th>${t('teacher')}</th><th>${t('credits')}</th><th>${t('time')}</th><th>${t('seats')}</th><th>${t('status')}</th><th></th></tr>${body}</table></div>`;
  },
  async timetable() {
    const rows = await api('/my-courses');
    let grid = '';
    for (let p = 1; p <= 8; p++) {
      grid += `<tr><th>${p}</th>`;
      for (let d = 1; d <= 7; d++) {
        const c = rows.find((r) => r.day === d && p >= r.start_period && p < r.start_period + r.periods);
        grid += c ? `<td class="slot">${esc(pick(c, 'name'))}</td>` : '<td></td>';
      }
      grid += '</tr>';
    }
    const head = [1, 2, 3, 4, 5, 6, 7].map((d) => `<th>${t('day.' + d)}</th>`).join('');
    return `<p><b>${t('totalCredits')}:</b> <span id="total">${rows.reduce((s, r) => s + r.credits, 0)}</span></p>
      <div class="table-wrap"><table><tr><th>${t('period')}</th>${head}</tr>${grid}</table></div>`;
  },
  async leave() {
    const rows = await api('/leave');
    const admin = store.user.role === 'admin';
    const opts = ['sick', 'personal', 'official', 'other'].map((k) => `<option value="${k}">${t('type.' + k)}</option>`).join('');
    const form = admin ? '' : `<form id="leave-form" class="card"><h3>${t('leave.new')}</h3>
      <label>${t('type')}<select name="type">${opts}</select></label>
      <div class="row"><label>${t('from')}<input type="date" name="date_from" required></label><label>${t('to')}<input type="date" name="date_to" required></label></div>
      <label>${t('reason')}<textarea name="reason" maxlength="500" required></textarea></label>
      <label>${t('proof')}<input type="file" name="file" id="file" accept="image/*"></label>
      <div id="pv" hidden><img id="preview" alt=""><button type="button" class="alt" id="rm">${t('remove')}</button></div>
      <button>${t('submit')}</button></form>`;
    const body = rows.map((r) => `<tr>${admin ? `<td>${esc(r.student_id)} ${esc(r.name)}</td>` : ''}<td>${t('type.' + r.type)}</td>
      <td>${fmtDate(r.date_from)} – ${fmtDate(r.date_to)}</td><td>${esc(r.reason)}</td><td>${t('status.' + r.status)}</td>
      ${admin ? `<td><button data-set="approved" data-id="${r.id}">${t('approve')}</button> <button class="alt" data-set="rejected" data-id="${r.id}">${t('reject')}</button></td>` : ''}</tr>`).join('');
    return `${form}<h3>${t('myRequests')}</h3><div class="table-wrap"><table><tr>${admin ? `<th>${t('student')}</th>` : ''}<th>${t('type')}</th><th>${t('time')}</th><th>${t('reason')}</th><th>${t('status')}</th>${admin ? '<th></th>' : ''}</tr>${body}</table></div>`;
  },
  async grades() {
    const sems = ['112-1', '112-2', '113-1', '113-2', '114-1', '114-2', '115-1'];
    const sem = $('#sem')?.value || sems[0];
    const { rows, average } = await api('/grades?semester=' + sem);
    const body = rows.map((r) => `<tr><td>${esc(pick(r, 'course_name'))}</td><td>${r.credits}</td><td>${r.score}</td></tr>`).join('');
    return `<label>${t('semester')} <select id="sem">${sems.map((s) => `<option${s === sem ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
      <table><tr><th>${t('course')}</th><th>${t('credits')}</th><th>${t('score')}</th></tr>${body}</table>
      <p><b>${t('average')}:</b> <span id="avg">${average == null ? '-' : fmtNum(average)}</span></p>`;
  },
};

let seq = 0; // drop stale async renders
async function route() {
  const mine = ++seq;
  const page = location.hash.slice(2);
  const loggedIn = !!store.token;
  if (!loggedIn || !pages[page]) {
    if (loggedIn) { location.hash = '#/courses'; return; }
    $('#login').hidden = false; $('#view').hidden = true; $('#nav').hidden = true; $('#logout').hidden = true;
    return;
  }
  $('#login').hidden = true; $('#nav').hidden = false; $('#logout').hidden = false; $('#view').hidden = false;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.hash === '#/' + page));
  try {
    const html = await pages[page]();
    if (mine !== seq) return;
    $('#view').innerHTML = html; afterRender(page);
  } catch (e) { if (mine === seq) fail(e); }
}

function afterRender(page) {
  if (page === 'leave') {
    const file = $('#file');
    if (!file) return;
    const clear = () => { file.value = ''; $('#pv').hidden = true; $('#preview').removeAttribute('src'); };
    file.onchange = () => {
      const f = file.files[0];
      if (!f) return clear();
      const r = new FileReader();
      r.onload = () => { $('#preview').src = r.result; $('#pv').hidden = false; };
      r.readAsDataURL(f);
    };
    $('#rm').onclick = clear;
  }
}

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === 'login-form') {
      const f = Object.fromEntries(new FormData(e.target));
      const d = await api('/login', { method: 'POST', json: f });
      sessionStorage.setItem('token', d.token); sessionStorage.setItem('user', JSON.stringify(d.user));
      show(null); location.hash = '#/courses'; route();
    } else if (e.target.id === 'leave-form') {
      const body = new FormData(e.target);
      if (!body.get('file')?.size) body.delete('file');
      await api('/leave', { method: 'POST', body });
      show('submitted', 'ok'); route();
    }
  } catch (err) { fail(err); }
});

document.addEventListener('click', async (e) => {
  const d = e.target.dataset;
  try {
    if (d.add) await api('/enroll/' + d.add, { method: 'POST' });
    else if (d.drop) await api('/enroll/' + d.drop, { method: 'DELETE' });
    else if (d.set) await api('/leave/' + d.id, { method: 'PATCH', json: { status: d.set } });
    else return;
    show(null); route();
  } catch (err) { fail(err); route(); }
});

document.addEventListener('input', (e) => { if (e.target.id === 'q') route().then(() => { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); });
document.addEventListener('change', (e) => { if (e.target.id === 'sem') route(); });
$('#lang').onchange = (e) => { setLang(e.target.value); renderMsg(); route(); };
$('#logout').onclick = () => logout();
window.addEventListener('hashchange', () => { show(null); route(); });

setLang(getLang());
$('#lang').value = getLang();
if (!store.token) location.hash = '#/login';
route();
