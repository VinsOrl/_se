use serde_json::Value;

#[test]
fn shared_cases() {
    let cases: Vec<Value> =
        serde_json::from_str(include_str!("../../tests/cases.json")).unwrap();
    for c in &cases {
        let a = c["args"].as_array().unwrap();
        let s = a[0].as_str().unwrap();
        let num = |i: usize| a.get(i).map(|v| v.as_u64().unwrap() as usize);
        let got = match c["fn"].as_str().unwrap() {
            "slugify" => Value::from(slugread::slugify(s)),
            "truncate" => Value::from(slugread::truncate(s, num(1).unwrap())),
            "word_count" => Value::from(slugread::word_count(s)),
            "reading_time" => Value::from(slugread::reading_time(
                s,
                num(1).unwrap_or(slugread::DEFAULT_WPM),
            )),
            f => panic!("unknown fn {f}"),
        };
        assert_eq!(got, c["out"], "{c}");
    }
}

#[test]
#[should_panic]
fn zero_wpm_panics() {
    slugread::reading_time("x", 0);
}
