"""Unit tests for check-fork-resolutions.py (stdlib unittest, no install needed).

Run: python3 -m unittest discover -s packages/premaccess/scripts -p 'test_*.py'
"""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "check_fork_resolutions", Path(__file__).with_name("check-fork-resolutions.py")
)
assert _spec and _spec.loader
cfr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cfr)

NESTED = "packages/x/package.json"

TABLE = """# Fork resolutions

| Manifest | Key | Forced to | Fixes | Why | Drop when |
|---|---|---|---|---|---|
| `package.json` | `a@npm:1.0.0` `b@npm:2.0.0` | 1.0.1 2.0.1 | x | `parent` pins `1.0.0` | `parent` >= 1.0.1 |
| `packages/x/package.json` | `body-parser/qs` | 6.16.0 | GHSA | range `^1 \\|\\| ^2` | later |

| Other | Table |
|---|---|
| `package.json` | `ignored` |
"""


class DeclaredPairs(unittest.TestCase):
    def test_reads_only_the_manifest_table(self) -> None:
        self.assertEqual(
            cfr.declared_pairs(TABLE),
            {
                ("package.json", "a@npm:1.0.0"),
                ("package.json", "b@npm:2.0.0"),
                (NESTED, "body-parser/qs"),
            },
        )

    def test_why_column_tokens_are_never_keys(self) -> None:
        keys = {k for _, k in cfr.declared_pairs(TABLE)}
        self.assertNotIn("parent", keys)
        self.assertNotIn("1.0.0", keys)

    def test_row_without_single_manifest_fails_loudly(self) -> None:
        bad = "| Manifest | Key |\n|---|---|\n| no manifest | `k` |\n"
        with self.assertRaises(ValueError):
            cfr.declared_pairs(bad)


class ChangedPairs(unittest.TestCase):
    def test_add_change_and_remove_are_all_fork_changes(self) -> None:
        ours = {"added": "1", "changed": "2", "same": "3"}
        theirs = {"changed": "1", "same": "3", "removed": "9"}
        self.assertEqual(
            cfr.changed_pairs(ours, theirs, "package.json"),
            {("package.json", "added"), ("package.json", "changed"), ("package.json", "removed")},
        )

    def test_deleted_manifest_reads_as_empty(self) -> None:
        self.assertEqual(cfr.resolutions(None), {})


class Evaluate(unittest.TestCase):
    def test_nested_resolution_without_row_is_undeclared(self) -> None:
        errors = cfr.evaluate({(NESTED, "body-parser/qs")}, set())
        self.assertEqual(len(errors), 1)
        self.assertIn("not declared", errors[0])

    def test_same_key_in_another_manifest_does_not_declare_it(self) -> None:
        errors = cfr.evaluate({(NESTED, "k")}, {("package.json", "k")})
        self.assertEqual(len(errors), 2)

    def test_one_dead_key_of_a_multi_key_row_is_stale(self) -> None:
        declared = {("package.json", "a"), ("package.json", "b")}
        errors = cfr.evaluate({("package.json", "a")}, declared)
        self.assertEqual(len(errors), 1)
        self.assertIn("'b'", errors[0])

    def test_exact_match_passes(self) -> None:
        pairs = {("package.json", "a"), (NESTED, "q")}
        self.assertEqual(cfr.evaluate(pairs, set(pairs)), [])


if __name__ == "__main__":
    unittest.main()
