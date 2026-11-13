import json
import pathlib
import unittest

import slugread

CASES = json.loads(
    (pathlib.Path(__file__).parents[2] / "tests" / "cases.json").read_text("utf-8")
)


class SharedCases(unittest.TestCase):
    def test_cases(self):
        for case in CASES:
            with self.subTest(case=case):
                self.assertEqual(getattr(slugread, case["fn"])(*case["args"]), case["out"])

    def test_bad_args(self):
        self.assertRaises(ValueError, slugread.truncate, "x", -1)
        self.assertRaises(ValueError, slugread.reading_time, "x", 0)


if __name__ == "__main__":
    unittest.main()
