"""Tiny text helpers: slugify, truncate, word_count, reading_time."""

import math
import re
import unicodedata

__all__ = ["slugify", "truncate", "word_count", "reading_time"]
__version__ = "0.1.0"

_MARKS = re.compile("[\u0300-\u036f]")
_NON_ALNUM = re.compile("[^a-z0-9]+")
# Same whitespace set as Rust's char::is_whitespace, so all languages split identically.
_WS = re.compile("[\t-\r \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+")
_CJK = re.compile(
    "[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0002ffff]"
)


def slugify(text: str) -> str:
    """Lowercase, strip accents, turn every run of non [a-z0-9] into '-', trim '-'."""
    text = _MARKS.sub("", unicodedata.normalize("NFD", text.lower()))
    return _NON_ALNUM.sub("-", text).strip("-")


def truncate(text: str, n: int) -> str:
    """Cut to n characters and append an ellipsis if anything was cut."""
    if n < 0:
        raise ValueError("n must be >= 0")
    return text[:n] + "\u2026" if len(text) > n else text


def word_count(text: str) -> int:
    """Count words; each CJK character (Han, Hiragana, Katakana) counts as one."""
    cjk = len(_CJK.findall(text))
    rest = _WS.split(_CJK.sub(" ", text))
    return cjk + sum(any(c.isalnum() for c in w) for w in rest)


def reading_time(text: str, wpm: int = 200) -> int:
    """Minutes to read text at wpm words per minute, rounded up."""
    if wpm <= 0:
        raise ValueError("wpm must be > 0")
    return math.ceil(word_count(text) / wpm)
