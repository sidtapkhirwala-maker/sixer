"""
calibrate_bounds.py

Sample many random XIs, compute their raw team metrics, and print
percentile-based bounds you can paste into season_engine.py.
"""

import sqlite3
import random
import statistics
from season_engine import compute_team_metrics
from random_xi_test import fetch_random_xi

DB_PATH = r"C:\Users\SiddharthTapkhirwala\Desktop\sixer\sixer.db"
N_SAMPLES = 2000


def percentile(sorted_vals, p):
    """Simple percentile: p in 0..100."""
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        metrics_by_key = {
            "Bat_run_power": [],
            "Bat_boundary_power": [],
            "Bowl_wicket_power": [],
            "Bowl_econ_power": [],
        }

        print(f"Sampling {N_SAMPLES} random XIs...")
        for i in range(N_SAMPLES):
            xi = fetch_random_xi(conn)
            raw = compute_team_metrics(xi)
            for k, v in raw.items():
                metrics_by_key[k].append(v)
            if (i + 1) % 500 == 0:
                print(f"  ...{i+1} done")

        print("\nRaw metric distributions across {} random XIs:".format(N_SAMPLES))
        print("=" * 78)
        print(f"{'Metric':<22} {'p5':>10} {'p25':>10} {'p50':>10} {'p75':>10} {'p95':>10}")
        print("-" * 78)

        suggested_bounds = {}
        for key, vals in metrics_by_key.items():
            vals_sorted = sorted(vals)
            p5  = percentile(vals_sorted, 5)
            p25 = percentile(vals_sorted, 25)
            p50 = percentile(vals_sorted, 50)
            p75 = percentile(vals_sorted, 75)
            p95 = percentile(vals_sorted, 95)
            print(f"{key:<22} {p5:>10.3f} {p25:>10.3f} {p50:>10.3f} {p75:>10.3f} {p95:>10.3f}")
            suggested_bounds[key] = (p5, p95)

        print("\nSuggested bounds (paste into normalise_team_metrics):")
        print("=" * 78)
        print("bounds = {")
        for key, (lo, hi) in suggested_bounds.items():
            print(f'    "{key}": ({lo:.3f}, {hi:.3f}),')
        print("}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()