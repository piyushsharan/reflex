#!/usr/bin/env python3
"""Offline analytics for REFLEX reaction-history CSV exports.

Usage:
  python tools/analyze_reaction.py reflex-reaction-history.csv
  python tools/analyze_reaction.py reflex-reaction-history.csv --json
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def load_results(path: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"reaction_ms", "date_iso"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("CSV must contain reaction_ms and date_iso columns.")
        for line, row in enumerate(reader, start=2):
            try:
                ms = float(row["reaction_ms"])
                if not math.isfinite(ms) or ms <= 0:
                    raise ValueError
                timestamp = datetime.fromisoformat(row["date_iso"].replace("Z", "+00:00"))
            except (TypeError, ValueError):
                raise ValueError(f"Invalid reaction result on CSV line {line}.") from None
            results.append({"ms": ms, "at": timestamp.isoformat()})
    return results


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    values = [item["ms"] for item in results]
    if not values:
        return {"count": 0, "average_ms": None, "median_ms": None,
                "best_ms": None, "slowest_ms": None, "stddev_ms": None,
                "p90_ms": None, "trend": "not enough data"}
    ordered = sorted(results, key=lambda item: item["at"])
    trend = "not enough data"
    if len(ordered) >= 4:
        midpoint = len(ordered) // 2
        first = statistics.mean(item["ms"] for item in ordered[:midpoint])
        recent = statistics.mean(item["ms"] for item in ordered[midpoint:])
        trend = "improving" if recent < first else "slower" if recent > first else "steady"
    return {
        "count": len(values),
        "average_ms": round(statistics.mean(values), 2),
        "median_ms": round(statistics.median(values), 2),
        "best_ms": round(min(values), 2),
        "slowest_ms": round(max(values), 2),
        "stddev_ms": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
        "p90_ms": round(percentile(values, 0.9) or 0, 2),
        "trend": trend,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path)
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args()
    try:
        summary = summarize(load_results(args.csv_file))
    except (OSError, ValueError) as error:
        parser.error(str(error))
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print("REFLEX reaction analysis")
        print(f"Results:       {summary['count']}")
        for key, label in (("average_ms", "Average"), ("median_ms", "Median"),
                           ("best_ms", "Best"), ("slowest_ms", "Slowest"),
                           ("stddev_ms", "Std deviation"), ("p90_ms", "90th percentile")):
            value = summary[key]
            print(f"{label + ':':16}{'—' if value is None else f'{value:.2f} ms'}")
        print(f"Trend:         {summary['trend']}")
        print("\nNote: this is descriptive analysis, not hardware-calibrated measurement.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
