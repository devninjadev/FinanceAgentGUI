import json
import tempfile
import unittest
from pathlib import Path

from scripts import world_memory_harness as harness


class WorldMemoryHarnessTests(unittest.TestCase):
    def test_build_checks_marks_warn_when_threshold_breached(self) -> None:
        rows = [
            {"Metric": "Brief entries", "Value": 100},
            {"Metric": "Orphan briefs with metadata", "Value": 40},
            {"Metric": "Cleanup candidates", "Value": 2},
            {"Metric": "Legacy blank issues", "Value": 1},
            {"Metric": "Issue dedupe fill rate", "Value": "94.0%"},
            {"Metric": "Brief dedupe fill rate", "Value": "96.0%"},
            {"Metric": "Recent entries (30d)", "Value": 0},
        ]
        checks = harness._build_checks(
            rows=rows,
            days=30,
            max_cleanup_candidates=0,
            max_legacy_blank_issues=0,
            max_orphan_brief_ratio=25.0,
            min_issue_dedupe_fill=95.0,
            min_brief_dedupe_fill=95.0,
            min_recent_entries=1,
        )
        status_by_check = {item["check"]: item["status"] for item in checks}
        self.assertEqual(status_by_check["Cleanup candidates"], "warn")
        self.assertEqual(status_by_check["Legacy blank issues"], "warn")
        self.assertEqual(status_by_check["Orphan brief ratio"], "warn")
        self.assertEqual(status_by_check["Issue dedupe fill rate"], "warn")
        self.assertEqual(status_by_check["Brief dedupe fill rate"], "pass")
        self.assertEqual(status_by_check["Recent entries volume"], "warn")

    def test_main_strict_returns_nonzero_when_warn_exists(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            exit_code = harness.main(
                [
                    "--base-dir",
                    tmpdir,
                    "--db-file",
                    "world_issue_log.sqlite3",
                    "--strict",
                    "--min-recent-entries",
                    "1",
                ]
            )
            self.assertEqual(exit_code, 1)

    def test_main_json_output_writes_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "harness_result.json"
            exit_code = harness.main(
                [
                    "--base-dir",
                    tmpdir,
                    "--db-file",
                    "world_issue_log.sqlite3",
                    "--format",
                    "json",
                    "--out",
                    str(out_path),
                ]
            )
            self.assertEqual(exit_code, 0)
            self.assertTrue(out_path.exists())
            payload = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertIn("checks", payload)
            self.assertIn("audit_rows", payload)
            self.assertIn("exit_code", payload)


if __name__ == "__main__":
    unittest.main()
