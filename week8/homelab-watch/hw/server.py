"""Tiny read-only dashboard (stdlib http.server). Only POST /api/fix writes (Phase 6)."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import collectors, store

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>homelab-watch</title>
<style>
:root{color-scheme:dark;--bg:#111418;--card:#1a1f26;--fg:#d8dee6;--mut:#8a94a3;--ok:#3fb950;--warn:#d29922;--crit:#f85149}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.verdict{padding:10px 14px;border-radius:8px;margin:12px 0;font-weight:600;background:var(--card);border-left:6px solid var(--ok)}
.verdict.warn{border-color:var(--warn)}.verdict.crit{border-color:var(--crit)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:var(--card);border-radius:8px;padding:12px}.card h2{font-size:14px;margin:0 0 8px}
.row{padding:2px 0;word-break:break-word}.warn{color:var(--warn)}.crit{color:var(--crit)}
.det{margin:2px 0 4px 18px;color:var(--mut);font:12px monospace;white-space:pre-wrap}
.spark{display:flex;justify-content:space-between;align-items:center;padding:3px 0}
svg{width:160px;height:36px;background:#0d1014;border-radius:4px}polyline{fill:none;stroke:#58a6ff;stroke-width:1.5}
button{background:#238636;color:#fff;border:0;border-radius:4px;padding:2px 8px;margin-left:8px;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:12px}td{padding:2px 4px;border-top:1px solid #262c35}
</style></head><body>
<h1>homelab-watch <span class="mut" id="host"></span></h1><div class="mut" id="when"></div>
<div class="verdict" id="verdict"></div><div class="grid" id="grid"></div>
<script>
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ICON={ok:"✅",warn:"⚠️",crit:"❌"};
const j=async(u,o)=>(await fetch(u,o)).json();
const SPARKS=[["load","CPU load",""],["ram","RAM","%"],["disk","Disk (max)","%"],["temp","Temp (max)","°C"],["gpu","GPU util","%"]];
function spark(pts){
  const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 160 36");
  if(pts.length<2)return s;
  const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1])),t0=pts[0][0],t1=pts[pts.length-1][0];
  const xy=p=>((p[0]-t0)/(t1-t0||1)*156+2).toFixed(1)+","+(34-(p[1]-lo)/(hi-lo||1)*32).toFixed(1);
  const l=document.createElementNS(s.namespaceURI,"polyline");l.setAttribute("points",pts.map(xy).join(" "));
  s.appendChild(l);return s}
async function fix(key){
  let tok=sessionStorage.hwtok||prompt("Fix token (from config.toml)");if(!tok)return;
  const r=await j("/api/fix",{method:"POST",headers:{"X-HW-Token":tok,"Content-Type":"application/json"},body:JSON.stringify({key})});
  if(r.error)sessionStorage.removeItem("hwtok");else sessionStorage.hwtok=tok;
  alert(r.error||r.messages.join("\\n")||"done");load()}
async function load(){
  const [cur,his,fl]=await Promise.all([j("/api/current"),j("/api/history?hours=24"),j("/api/fixlog")]);
  $host.textContent=cur.host;$when.textContent=new Date(cur.ts*1000).toLocaleString()+" · refreshes every 10s";
  const bad=cur.results.filter(r=>r.status!="ok");
  $verdict.className="verdict "+cur.status;
  $verdict.textContent=bad.length?ICON[cur.status]+" "+bad.length+" issue(s): "+bad.map(r=>r.text).join(" · "):"✅ All good";
  const g=$grid;g.replaceChildren();
  const sp=E("div","card");sp.appendChild(E("h2",0,"Last 24h"));
  for(const [k,label,u] of SPARKS){
    const pts=his.filter(h=>k in h.metrics).map(h=>[h.ts,h.metrics[k]]);
    const row=E("div","spark");const last=pts.length?pts[pts.length-1][1].toFixed(1)+u:"–";
    row.append(E("span",0,label+": "+last),spark(pts));sp.appendChild(row)}
  if(his.length<2)sp.appendChild(E("div","mut","Run `hw collect` a few times to build history."));
  g.appendChild(sp);
  const secs={};cur.results.forEach(r=>(secs[r.section]=secs[r.section]||[]).push(r));
  for(const [name,rows] of Object.entries(secs)){
    const c=E("div","card");c.appendChild(E("h2",0,name));
    for(const r of rows){
      const d=E("div","row "+r.status,ICON[r.status]+" "+r.text);
      if(cur.fixable.includes(r.key)){const b=E("button",0,"Fix");b.onclick=()=>fix(r.key);d.appendChild(b)}
      c.appendChild(d);if(r.detail)c.appendChild(E("div","det",r.detail))}
    g.appendChild(c)}
  const fc=E("div","card");fc.appendChild(E("h2",0,"Fix log"));
  if(!fl.length)fc.appendChild(E("div","mut","No fix actions."));
  const t=E("table");for(const f of fl){const tr=E("tr");
    [new Date(f.ts*1000).toLocaleString(),f.target,f.command,f.result].forEach(x=>tr.appendChild(E("td",0,x)));t.appendChild(tr)}
  fc.appendChild(t);g.appendChild(fc);
  if(cur.notes.length){const n=E("div","card");n.appendChild(E("h2",0,"Notes"));cur.notes.forEach(x=>n.appendChild(E("div","row mut",x)));g.appendChild(n)}}
for(const id of ["host","when","verdict","grid"])window["$"+id]=document.getElementById(id);
load();setInterval(load,10000);
</script></body></html>"""


def make_handler(cfg, db_path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def send(self, code, body, ctype="application/json"):
            data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            u = urlparse(self.path)
            con = store.connect(db_path)
            try:
                if u.path == "/":
                    self.send(200, PAGE, "text/html")
                elif u.path == "/api/current":
                    snap = collectors.collect_all(cfg)
                    snap["fixable"] = fixable_keys(cfg, snap)
                    self.send(200, snap)
                elif u.path == "/api/history":
                    try:
                        hours = float(parse_qs(u.query).get("hours", ["24"])[0])
                    except ValueError:
                        return self.send(400, {"error": "bad hours"})
                    self.send(200, store.history(con, hours))
                elif u.path == "/api/fixlog":
                    self.send(200, store.fix_log(con))
                else:
                    self.send(404, {"error": "not found"})
            finally:
                con.close()

        def do_POST(self):
            if urlparse(self.path).path != "/api/fix":
                return self.send(404, {"error": "not found"})
            from . import fix
            rem = cfg["remediation"]
            if self.client_address[0] not in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
                return self.send(403, {"error": "localhost only"})
            if not (rem["enabled"] and rem["mode"] == "ask"):
                return self.send(403, {"error": "remediation mode is not 'ask'"})
            if not fix.token_ok(rem["token"], self.headers.get("X-HW-Token", "")):
                return self.send(403, {"error": "bad or missing token"})
            try:
                n = int(self.headers.get("Content-Length", 0))
                key = json.loads(self.rfile.read(n))["key"]
            except Exception:
                return self.send(400, {"error": "bad request"})
            con = store.connect(db_path)
            try:
                snap = collectors.collect_all(cfg)
                plans = [p for p in fix.plan(snap, cfg) if p["key"] == key]
                if not plans:
                    return self.send(404, {"error": "no allowlisted fix for that issue"})
                _, msgs = fix.apply(con, cfg, snap, collectors.collect_all, mode="auto",
                                    only=plans[0]["target"])
                self.send(200, {"messages": msgs or ["attempt limit reached or nothing to do"]})
            finally:
                con.close()

    return Handler


def fixable_keys(cfg, snap):
    rem = cfg["remediation"]
    if not (rem["enabled"] and rem["mode"] == "ask"):
        return []
    from . import fix
    return [p["key"] for p in fix.plan(snap, cfg)]


def serve(cfg, host, port, db_path=store.DB_PATH):
    srv = ThreadingHTTPServer((host, port), make_handler(cfg, db_path))
    print(f"hw dashboard on http://{host}:{port}/  (Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
