import unittest

from tools.analyze_reaction import summarize


class ReactionAnalyticsTests(unittest.TestCase):
    def test_empty_results(self):
        self.assertEqual(summarize([])["count"], 0)
        self.assertIsNone(summarize([])["average_ms"])

    def test_summary_statistics(self):
        rows = [
            {"ms": 200.0, "at": "2026-01-01T10:00:00"},
            {"ms": 300.0, "at": "2026-01-02T10:00:00"},
            {"ms": 250.0, "at": "2026-01-03T10:00:00"},
            {"ms": 150.0, "at": "2026-01-04T10:00:00"},
        ]
        result = summarize(rows)
        self.assertEqual(result["count"], 4)
        self.assertEqual(result["average_ms"], 225.0)
        self.assertEqual(result["best_ms"], 150.0)
        self.assertEqual(result["trend"], "improving")


if __name__ == "__main__":
    unittest.main()
