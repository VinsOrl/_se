use minicurl::{parse, tokenize};
use minicurl::RequestSpec;

fn spec(input: &str) -> RequestSpec {
    parse(input).unwrap_or_else(|e| panic!("parse({input:?}) failed: {e}"))
}

#[test]
fn bare_url_is_get() {
    let s = spec("https://example.com");
    assert_eq!(s.method, "GET");
    assert_eq!(s.url, "https://example.com");
    assert!(s.body.is_none());
}

#[test]
fn x_overrides_method() {
    assert_eq!(spec("https://e.com -X delete").method, "DELETE");
    assert!(parse("https://e.com -X FOO").is_err());
}

#[test]
fn data_implies_post() {
    let s = spec("https://e.com -d a=1");
    assert_eq!(s.method, "POST");
    assert_eq!(s.body.as_deref(), Some("a=1"));
}

#[test]
fn explicit_get_with_data_stays_get() {
    let s = spec("https://e.com -X GET -d a=1");
    assert_eq!(s.method, "GET");
}

#[test]
fn headers_repeatable_and_trimmed() {
    // Consistent single quotes (no mixed nesting)
    let s = spec("https://e.com -H 'X-One: 1' -H 'X-Two : 2'");
    assert_eq!(
        s.headers,
        vec![
            ("X-One".into(), "1".into()),
            ("X-Two".into(), "2".into()),
        ]
    );
    assert!(parse("https://e.com -H no-colon").is_err());
}

#[test]
fn headers_with_double_quotes() {
    // Use single-quoted raw string so double quotes are literal in the content
    let s = spec(r#"https://e.com -H "Content-Type: application/json""#);
    assert_eq!(s.headers, vec![("Content-Type".into(), "application/json".into())]);
}

#[test]
fn data_with_single_quoted_json() {
    // curl usage: -d '{"key": "value"}'
    // After shell processes single quotes, our tokenizer sees literal double-quotes inside.
    let s = spec(r#"https://e.com -d '{"key": "value"}'"#);
    assert_eq!(s.method, "POST");
}

#[test]
fn max_time_seconds_to_ms() {
    assert_eq!(spec("https://e.com --max-time 2").max_time_ms, Some(2000));
    assert_eq!(spec("https://e.com --max-time=0.5").max_time_ms, Some(500));
    assert!(parse("https://e.com --max-time abc").is_err());
}

#[test]
fn output_and_flags() {
    let s = spec("https://e.com -o file.bin -s -v -L");
    assert_eq!(s.output.as_deref(), Some("file.bin"));
    assert!(s.silent && s.verbose && s.follow);
    // `-o -` means stdout, which in the browser is the output pane
    assert!(spec("https://e.com -o -").output.is_none());
}

#[test]
fn errors() {
    assert!(parse("").is_err());       // no URL
    assert!(parse("https://a.com https://b.com").is_err()); // two URLs
    assert!(parse("https://e.com --bogus").is_err());        // unknown flag
    assert!(parse("https://e.com -X").is_err());             // missing value
    assert!(parse("https://e.com -H 'X: 1").is_err());       // unterminated quote
}

#[test]
fn tokenizer_double_quoted() {
    let got = tokenize(r#"a "b c" d e f"#).unwrap();
    assert_eq!(got, vec!["a".to_string(), "b c".to_string(), "d".to_string(), "e".to_string(), "f".to_string()]);
}

#[test]
fn tokenizer_single_quoted() {
    let got = tokenize("a 'b c' d e f").unwrap();
    assert_eq!(got, vec!["a".to_string(), "b c".to_string(), "d".to_string(), "e".to_string(), "f".to_string()]);
}

#[test]
fn tokenizer_preserves_spaces_inside_quotes() {
    // Quotes don't nest — different quote types toggle open/closed independently
    let input = r#"a "b c" 'd e' f"#;
    let got = tokenize(input).unwrap();
    // After closing double-quote, pushed "b c". Space found nothing to push.
    // Single-quote opened fresh token boundary for "d", space accumulated inside, "e" too.
    // Closing single-quote pushes "de". Final 'f' gets pushed at end.
    assert_eq!(got.len(), 4); // ["a", "b c", "d e", "f"] (space preserved inside quotes)
    assert_eq!(got[0], "a");
    assert_eq!(got[1], "b c"); // space preserved because quote clears cur at open
    assert_eq!(got[2], "d e");
    assert_eq!(got[3], "f");
}

#[test]
fn tokenizer_flag_with_quoted_value() {
    // -H "Content-Type: value" should be ONE token "-H", then "Content-Type: value"
    let got = tokenize(r#"-H "Content-Type: application/json""#).unwrap();
    assert_eq!(got, vec!["-H".to_string(), "Content-Type: application/json".to_string()]);
}
