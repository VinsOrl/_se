import init, { run } from './pkg/minicurl.js';
await init();

const out = document.getElementById('out');
const input = document.getElementById('cmd');

const EXAMPLES = [
  'https://httpbin.org/get -v',
  'https://httpbin.org/post -d "name=lin&course=SE115"',
  'https://httpbin.org/headers -H "X-Week: 1" -H "X-Lang: Rust"',
  'https://httpbin.org/status/404 -s',
  'https://httpbin.org/get --max-time 2',
];
for (const cmd of EXAMPLES) {
  const b = document.createElement('button');
  b.textContent = cmd;
  b.onclick = () => { input.value = cmd; exec(); };
  document.getElementById('examples').appendChild(b);
}

const history = [];
let hIdx = -1;

function print(text, cls) {
  if (!text) return;
  const line = document.createElement('span');
  if (cls) line.className = cls;
  line.textContent = text;
  out.appendChild(line);
  out.appendChild(document.createTextNode('\n'));
  out.scrollTop = out.scrollHeight;
}

async function exec() {
  const cmd = input.value.trim();
  if (!cmd) return;
  input.value = '';
  history.push(cmd);
  hIdx = history.length;
  print(`minicurl> ${cmd}`, 'cmd');
  try {
    print(await run(cmd));
  } catch (e) {
    print(String(e.message ?? e), 'err');
  }
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') exec();
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (hIdx > 0) input.value = history[--hIdx];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (hIdx < history.length - 1) input.value = history[++hIdx];
    else { hIdx = history.length; input.value = ''; }
  }
});
