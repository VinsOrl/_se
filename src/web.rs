//! WASM layer: turn a [`RequestSpec`] into a real `fetch()` and format the
//! answer the way curl prints it.
//!
//! All browser interaction done via js_sys inline JS — avoids web-sys version drift.

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
pub async fn run(command: &str) -> Result<JsValue, JsValue> {
    let spec = crate::parse(command).map_err(|e| JsValue::from_str(&e))?;
    Ok(send(&spec).await?.into())
}

async fn send(spec: &crate::RequestSpec) -> Result<String, String> {
    // Build a plain JS object with the spec data.
    let obj = js_sys::Object::new();
    set_str(&obj, "method", &spec.method);
    set_str(&obj, "url", &spec.url);
    if spec.verbose  { set_bool(&obj, "verbose", true); }
    if spec.follow   { set_bool(&obj, "follow", true); }
    if let Some(ms) = spec.max_time_ms { set_num(&obj, "max_time_ms", ms as f64); }
    if let Some(ref output) = spec.output     { set_str(&obj, "output", output); }

    // Headers as [[k1,v1],[k2,v2],...]
    let h_arr = js_sys::Array::new();
    for (k, v) in &spec.headers {
        let pair = js_sys::Array::new();
        pair.push(&JsValue::from_str(k));
        pair.push(&JsValue::from_str(v));
        h_arr.push(&pair);
    }
    set_js_val(&obj, "headers", &h_arr);

    if let Some(ref body) = spec.body {
        set_str(&obj, "body", body);
    }

    // Call inline JS fetch helper
    let raw_promise = js_sys::Function::new_with_args("s", r#"return new Promise(function(resolve,reject){
var i={redirect:s.follow?"follow":"manual"};
if(s.method)i.method=s.method;
if(s.body!==undefined&&s.body!==null)i.body=s.body;
var ct=false,h=null;if(s.headers)for(var j=0;j<s.headers.length;j++){ct=ct||s.headers[j][0].toLowerCase()==="content-type";h=h||{};h[s.headers[j][0]]=s.headers[j][1];}
if(h&&!i.headers)i.headers=h;
if(!ct&&h)i.headers["Content-Type"]="application/x-www-form-urlencoded;charset=UTF-8";
var sg=null;if(s.max_time_ms&&s.max_time_ms>0){var ac=new AbortController();sg=ac.signal;setTimeout(function(){ac.abort()},Math.ceil(s.max_time_ms));}if(sg)i.signal=sg;
fetch(s.url,i).then(function(r){return r.arrayBuffer().then(function(b){var a=new Uint8Array(b),bt=null,bl=null;try{bt=new TextDecoder("utf-8",{fatal:true}).decode(a);}catch(e){bl=a.length;}var hd={};r.headers.forEach(function(v,k){hd[k]=v;});resolve({st:r.status,stxt:r.statusText,hdrs:hd,bs:bt,bl:bl,dn:(s.output&&s.output!="-")?s.output:null,rd:r.redirected})}).catch(reject);}).catch(function(e){reject(e.message||String(e));});})"#)
    .call1(&js_sys::global(), &obj).map_err(|e| format!("{e:?}"))?;

    let promise = raw_promise.dyn_into::<js_sys::Promise>()
        .map_err(|_| "fetch didn't return a Promise")?;
    let result: JsValue = JsFuture::from(promise).await.map_err(|e| friendly_error(e))?;
    Ok(format_result(&result))
}

fn set_str(o: &js_sys::Object, k: &str, v: &str) { js_sys::Reflect::set(o, &k.into(), &v.into()).ok(); }
fn set_bool(o: &js_sys::Object, k: &str, v: bool)  { js_sys::Reflect::set(o, &k.into(), &v.into()).ok(); }
fn set_num(o: &js_sys::Object, k: &str, v: f64)    { js_sys::Reflect::set(o, &k.into(), &v.into()).ok(); }
fn set_js_val(o: &js_sys::Object, k: &str, v: &JsValue) { js_sys::Reflect::set(o, &k.into(), v).ok(); }

fn format_result(val: &JsValue) -> String {
    let status = js_sys::Reflect::get(val, &"st".into())
        .ok().and_then(|v| v.as_f64()).unwrap_or(0.0);
    let stxt = js_sys::Reflect::get(val, &"stxt".into())
        .ok().and_then(|v| v.as_string()).unwrap_or_default();
    let rd = js_sys::Reflect::get(val, &"rd".into())
        .ok().and_then(|v| v.as_bool()).unwrap_or(false);
    let dn = js_sys::Reflect::get(val, &"dn".into())
        .ok().and_then(|v| v.as_string());

    let mut out = String::new();
    if rd { out.push_str(&format!("[Redirect via -L: HTTP/1.1 {} {}]\n", status as u16, stxt)); }

    // Headers (verbose)
    if let Ok(hdrs_val) = js_sys::Reflect::get(val, &"hdrs".into()) {
        if let Ok(keys) = js_sys::Reflect::own_keys(&hdrs_val) {
            for key in keys.iter() {
                if let (Some(k), Some(v)) = (key.as_string(), js_sys::Reflect::get(&hdrs_val, &key.into()).ok().and_then(|x| x.as_string())) {
                    out.push_str(&format!("< {k}: {v}\n"));
                }
            }
        }
    }
    out.push('\n');

    if let Some(ref name) = dn {
        if let Some(bl) = js_sys::Reflect::get(val, &"bl".into()).ok().and_then(|v| v.as_f64()) {
            out.push_str(&format!("saved to '{name}' ({} bytes)\n", bl as usize));
        } else {
            out.push_str(&format!("saved to '{name}'\n"));
        }
    } else if let Some(body) = js_sys::Reflect::get(val, &"bs".into()).ok().and_then(|v| v.as_string()) {
        out.push_str(&body);
    } else if let Some(bl) = js_sys::Reflect::get(val, &"bl".into()).ok().and_then(|v| v.as_f64()) {
        out.push_str(&format!("[{} bytes of binary data]\n", bl as usize));
    }
    out
}

fn friendly_error(e: JsValue) -> String {
    let msg = e.as_string().unwrap_or_else(|| format!("{e:?}"));
    if msg.contains("AbortError") || msg.contains("TimeoutError") {
        return "minicurl: (28) Operation timed out".into();
    }
    if msg.contains("Failed to fetch") || msg.contains("NetworkError") {
        return "minicurl: (6) Could not connect — likely blocked by CORS. \
                 Try a CORS-friendly host, e.g. https://httpbin.org/get".into();
    }
    format!("minicurl: {msg}")
}
