"""Bank unscheduled-past headlines for 2023's short-list event days.

Resumable: days already present in each output parquet are skipped, so this can run
across multiple days (Alpha Vantage's 25-requests/day budget is respected via
MAX_AV_CALLS_PER_RUN). GDELT self-paces >=6s per query in the adapter.

Outputs (committed data, like the price/calendar layers):
  data/news/gdelt_2023_events.parquet
  data/news/av_2023_events.parquet

Run: python Backtesting/engine/bank_event_headlines.py
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_sources import get_source

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "news"
RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
MAX_AV_CALLS_PER_RUN = 20
GDELT_QUERY = '("stock market" OR "S&P 500" OR "Nasdaq" OR "Federal Reserve")'
SITES = ["reuters.com", "cnbc.com", "marketwatch.com", "finance.yahoo.com", "bloomberg.com",
         "wsj.com", "investing.com", "barrons.com", "federalreserve.gov", "bls.gov"]


def event_days() -> list:
    moves = pd.concat([pd.read_parquet(RESULTS_DIR / "moves" / f"{s}_moves.parquet") for s in ("mes", "mnq")])
    flagged = moves[(moves["year"] == 2023) & moves["percentile_event"]]
    return sorted(pd.to_datetime(flagged["ts_end"]).dt.date.unique())


def banked_days(path: Path) -> set:
    if not path.exists():
        return set()
    return set(pd.read_parquet(path)["event_day"].unique())


def append(path: Path, frame: pd.DataFrame, day) -> None:
    frame = frame.assign(event_day=str(day))
    combined = pd.concat([pd.read_parquet(path), frame]) if path.exists() else frame
    combined.to_parquet(path, index=False)


def main() -> None:
    days = event_days()
    print(f"{len(days)} short-list event days in 2023")

    gdelt_path = DATA_DIR / "gdelt_2023_events.parquet"
    gdelt = get_source("gdelt")
    todo = [d for d in days if str(d) not in banked_days(gdelt_path)]
    print(f"GDELT: {len(todo)} days to bank")
    for day in todo:
        frame = gdelt.validate(gdelt.fetch(f"{day} 00:00", f"{day} 23:59", query=GDELT_QUERY, sites=SITES))
        append(gdelt_path, frame, day)
        print(f"  gdelt {day}: {len(frame)} headlines")

    av_path = DATA_DIR / "av_2023_events.parquet"
    av = get_source("alpha_vantage")
    todo = [d for d in days if str(d) not in banked_days(av_path)][:MAX_AV_CALLS_PER_RUN]
    print(f"AlphaVantage: {len(todo)} days this run (budget {MAX_AV_CALLS_PER_RUN}/day)")
    for day in todo:
        frame = av.validate(av.fetch(f"{day} 00:00", f"{day} 23:59", topics="financial_markets,economy_macro"))
        append(av_path, frame, day)
        print(f"  av {day}: {len(frame)} headlines")

    for path in (gdelt_path, av_path):
        if path.exists():
            stored = pd.read_parquet(path)
            print(f"{path.name}: {len(stored):,} headlines across {stored['event_day'].nunique()} days")


if __name__ == "__main__":
    main()
