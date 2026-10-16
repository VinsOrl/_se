use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Instant;

/// Count primes <= n with a sieve of Eratosthenes.
fn count_primes(n: usize) -> usize {
    if n < 2 {
        return 0;
    }
    let mut sieve = vec![true; n + 1];
    sieve[0] = false;
    sieve[1] = false;
    let mut i = 2;
    while i * i <= n {
        if sieve[i] {
            let mut j = i * i;
            while j <= n {
                sieve[j] = false;
                j += i;
            }
        }
        i += 1;
    }
    sieve.iter().filter(|&&p| p).count()
}

fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let mut it = pair.splitn(2, '=');
        match (it.next(), it.next()) {
            (Some(k), Some(v)) if k == key => Some(v.to_string()),
            _ => None,
        }
    })
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes());
}

fn handle(mut stream: TcpStream) {
    let mut buf = [0u8; 2048];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let req = String::from_utf8_lossy(&buf[..n]);
    let target = req
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");
    let (path, query) = target.split_once('?').unwrap_or((target, ""));

    match path {
        "/health" => {
            let host = std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".into());
            let body = format!(
                "{{\"service\":\"rust-service\",\"status\":\"ok\",\"container\":\"{}\"}}",
                host
            );
            respond(&mut stream, "200 OK", &body);
        }
        "/primes" => {
            let limit = query_param(query, "n")
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(1_000_000)
                .min(20_000_000);
            let start = Instant::now();
            let count = count_primes(limit);
            let ms = start.elapsed().as_secs_f64() * 1000.0;
            let body = format!(
                "{{\"service\":\"rust-service\",\"limit\":{},\"primes\":{},\"elapsed_ms\":{:.2}}}",
                limit, count, ms
            );
            respond(&mut stream, "200 OK", &body);
        }
        _ => respond(&mut stream, "404 Not Found", "{\"error\":\"not found\"}"),
    }
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".into());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("failed to bind");
    println!("rust-service listening on {}", addr);
    for stream in listener.incoming().flatten() {
        thread::spawn(move || handle(stream));
    }
}
