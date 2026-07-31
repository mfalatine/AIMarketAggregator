"""Integration test: every USE-verdict news feed through the full contract —
fetch -> normalize -> validate() (schema) -> as_of() (point-in-time cut).

Each test prints PASS/FAIL with the evidence. Alpha Vantage costs 1 of the day's
25 free requests; GDELT self-paces >=6s. Run:
    python Backtesting/engine/test_adapters.py
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_sources import get_source


def check(name, frame, source, expect_min=1):
    frame = source.validate(frame)
    cut_moment = frame["known_at_cst"].median()
    cut = source.as_of(frame, cut_moment)
    leak_free = (cut["known_at_cst"] <= cut_moment).all()
    status = "PASS" if len(frame) >= expect_min and leak_free else "FAIL"
    sample = frame.iloc[0]
    print(f"{name}: {status} — {len(frame)} rows validated; as_of({str(cut_moment)[:16]}) -> {len(cut)} rows, leak-free={leak_free}")
    print(f"   sample: [{sample['category']}] {str(sample['event_at_cst'])[:16]} {sample['headline'][:70]}")
    return status == "PASS"


def main() -> None:
    results = {}

    source = get_source("nasdaq_calendar")
    # 2021-05-12 = the famous Apr-2021 CPI shock morning (4.2% YoY vs 3.6% expected) —
    # inside the healthy pulled range.
    frame = source.fetch("2021-05-10", "2021-05-13")
    cpi = frame[(frame["category"] == "macro_release") & frame["headline"].str.contains("CPI|Consumer Price", case=False)]
    print(f"   [nasdaq detail] CPI release rows in window: {len(cpi)}; " +
          (f"e.g. {cpi.iloc[0]['headline'][:50]} meta={cpi.iloc[0]['meta'][:80]}" if len(cpi) else "NONE"))
    results["nasdaq_calendar"] = check("nasdaq_calendar (local archive)", frame, source, expect_min=20)

    source = get_source("ff_weekly")
    results["ff_weekly"] = check("ff_weekly (live)", source.fetch(), source, expect_min=30)

    source = get_source("gdelt")
    frame = source.fetch("2023-03-10 06:00", "2023-03-10 18:00", query='"Silicon Valley Bank"')
    results["gdelt"] = check("gdelt (2023 SVB day, DOC API)", frame, source, expect_min=1)

    source = get_source("alpha_vantage")
    frame = source.fetch("2023-08-23 00:00", "2023-08-26 00:00", tickers="NVDA")
    results["alpha_vantage"] = check("alpha_vantage (2023 NVDA earnings window)", frame, source, expect_min=3)

    source = get_source("finnhub_news")
    end = pd.Timestamp.now().normalize()
    frame = source.fetch(str(end - pd.Timedelta(days=5)), str(end + pd.Timedelta(days=1)), symbol="AAPL")
    results["finnhub_news"] = check("finnhub_news (live company news)", frame, source, expect_min=1)

    print("\n" + ("ALL PASS" if all(results.values()) else "FAILURES: " + ", ".join(k for k, v in results.items() if not v)))


if __name__ == "__main__":
    main()
