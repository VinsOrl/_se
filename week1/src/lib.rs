//! miniCurl core: turn a curl-style command line into a [`RequestSpec`].
//!
//! Pure Rust, no web dependencies — so it unit-tests natively (`cargo test`)
//! and ships to the browser via [`web`](self::web) (WASM).

#[cfg(target_arch = "wasm32")]
mod web;

pub const METHODS: [&str; 7] = ["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH", "OPTIONS"];

#[derive(Debug, Clone, PartialEq)]
pub struct RequestSpec {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub follow: bool,
    pub max_time_ms: Option<u64>,
    pub output: Option<String>,
    pub silent: bool,
    pub verbose: bool,
}

impl Default for RequestSpec {
    fn default() -> Self {
        RequestSpec {
            method: "GET".into(),
            url: String::new(),
            headers: Vec::new(),
            body: None,
            follow: false,
            max_time_ms: None,
            output: None,
            silent: false,
            verbose: false,
        }
    }
}

/// Which quote type is currently active (at most one).
#[derive(Clone, Copy, PartialEq)]
enum QChar {
    Double,
    Single,
}

impl QChar {
    fn matching(self) -> char {
        match self {
            QChar::Double => '"',
            QChar::Single => '\'',
        }
    }
}

/// Split a command line on whitespace, honoring single and double quotes.
/// The tokenizer does not support mixed nesting — `-H "k 'v'"` pushes `k`,
/// then opens single-quote for ` v`. Quotes of one type inside another are
/// treated as openers (shell behavior), so the outer closing quote finds a
/// different char and remains unclosed until its own match.
pub fn tokenize(input: &str) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut started = false;
    let mut qopen: Option<QChar> = None; // which quote is open (at most one)

    for ch in input.chars() {
        if let Some(q) = qopen {
            if ch == q.matching() {
                // Close the matching quote — push accumulated content
                out.push(std::mem::take(&mut cur));
                started = false;
                qopen = None;
            } else {
                // Inside this quote: accumulate literally (including other quote chars)
                cur.push(ch);
            }
        } else if ch == '"' {
            // Clear any accumulated content — quote starts a fresh token boundary.
            // Shell behavior: -H "value" is ONE token, not "-H" + "value".
            if started {
                out.push(std::mem::take(&mut cur));
                started = false;
            }
            qopen = Some(QChar::Double);
        } else if ch == '\'' {
            if started {
                out.push(std::mem::take(&mut cur));
                started = false;
            }
            qopen = Some(QChar::Single);
        } else if ch.is_whitespace() {
            if started {
                out.push(std::mem::take(&mut cur));
                started = false;
            }
        } else {
            cur.push(ch);
            started = true;
        }
    }
    if qopen.is_some() {
        return Err("unterminated quote — close your '\"' or '''".into());
    }
    if started {
        out.push(cur);
    }
    Ok(out)
}

/// Parse a curl-style command line into a [`RequestSpec`].
pub fn parse(input: &str) -> Result<RequestSpec, String> {
    let args = tokenize(input)?;

    // Normalize `--flag=value` (e.g. `--max-time=0.5`) into two tokens so the
    // loop below handles them like separate `-f val`. Skip when the value portion
    // starts with a quote character — that's data being passed to the flag, not
    // a second option (real shell quoting never nests `"..."` inside `'...'`).
    let mut expanded = Vec::with_capacity(args.len() * 2);
    for a in args {
        if let Some((flag, val)) = a.split_once('=') {
            if flag.starts_with("-") && !val.starts_with(['\'', '"']) {
                expanded.push(flag.to_string());
                expanded.push(val.to_string());
                continue;
            }
        }
        expanded.push(a);
    }

    let mut spec = RequestSpec::default();
    let mut have_url = false;
    let mut explicit_method = false;

    let mut i = 0;
    while i < expanded.len() {
        let arg = expanded[i].clone();
        let value = |i: &mut usize| -> Result<String, String> {
            *i += 1;
            expanded.get(*i)
                .cloned()
                .ok_or_else(|| format!("option '{arg}' needs a value"))
        };
        match arg.as_str() {
            "-s" | "--silent" => spec.silent = true,
            "-v" | "--verbose" => spec.verbose = true,
            "-L" | "--location" => spec.follow = true,
            "-X" | "--request" => {
                let m = value(&mut i)?.to_ascii_uppercase();
                if !METHODS.contains(&m.as_str()) {
                    return Err(format!("invalid method '{m}' (try: {})", METHODS.join(" / ")));
                }
                spec.method = m;
                explicit_method = true;
            }
            "-H" | "--header" => {
                let h = value(&mut i)?;
                let (k, v) = h
                    .split_once(':')
                    .ok_or_else(|| format!("bad header '{h}' (expected 'Name: value')"))?;
                spec.headers.push((k.trim().into(), v.trim().into()));
            }
            "-d" | "--data" => spec.body = Some(value(&mut i)?),
            "-o" | "--output" => spec.output = Some(value(&mut i)?),
            "--max-time" => spec.max_time_ms = Some(parse_seconds(&value(&mut i)?)?),
            other if other.starts_with('-') && other.len() > 1 => {
                return Err(format!(
                    "unknown option '{other}' (supported: -X, -H, -d, -o, -s, -v, -L, --max-time)"
                ));
            }
            _ => {
                if have_url {
                    return Err("one URL per command — drop the extra URL".into());
                }
                spec.url = arg;
                have_url = true;
            }
        }
        i += 1;
    }

    if !have_url {
        return Err("missing URL — try: https://httpbin.org/get -v".into());
    }
    if !explicit_method && spec.body.is_some() {
        spec.method = "POST".into(); // curl behavior: -d implies POST
    }
    if spec.output.as_deref() == Some("-") {
        spec.output = None; // `-o -` = stdout, which is our output pane
    }
    Ok(spec)
}

fn parse_seconds(s: &str) -> Result<u64, String> {
    let f: f64 = s.parse().map_err(|_| format!("invalid number '{s}'"))?;
    if f < 0.0 || f > 3600.0 {
        return Err(format!("--max-time out of range (0..3600): {s}"));
    }
    Ok((f * 1000.0) as u64)
}
