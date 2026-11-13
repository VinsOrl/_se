# slugread

Tiny zero-dependency text helpers. Same behavior in Python, JavaScript and Rust.

```bash
pip install slugread
```

```python
from slugread import slugify, truncate, word_count, reading_time

slugify("Crème Brûlée!")        # 'creme-brulee'
truncate("Hello world", 5)      # 'Hello…'
word_count("我爱Rust和Python")   # 5  (each CJK character is one word)
reading_time("one two three", 2) # 2  (minutes, rounded up; default wpm=200)
```

- `slugify` keeps only `a-z0-9` after stripping accents; other characters become `-`.
- `truncate` counts Unicode code points; `n` must be `>= 0`.
- `reading_time` needs `wpm > 0`.

MIT license.
