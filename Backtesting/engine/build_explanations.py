"""Explanation-table builder — joins news to events so each event can be attributed.

For every event (active definition), collects the news items from the declared,
normalized news tables in data/news/ that were published inside a lookback window
before the event's end. Attribution starts 'unlabeled'; a later labeling pass (AI or
Mike) marks each candidate direct / arm / unrelated, per docs/CONCEPTS.md section 4 —
direct AND multi-arm both allowed, neither forced.

With no news tables present (the current state — source decision pending) it reports
that plainly and writes nothing.

Run:      python build_explanations.py [--year 2023] [--lookback-minutes 720]
Selftest: python build_explanations.py --selftest   (synthetic in-memory news; proves
          the join and the point-in-time cut without any real or fake data on disk)
"""
import argparse
import json
from pathlib import Path

import pandas as pd

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
NEWS_DIR = Path(__file__).resolve().parent.parent / "data" / "news"
SYMBOLS = ("MES", "MNQ")


def load_events(year: int) -> pd.DataFrame:
    frames = [pd.read_parquet(RESULTS_DIR / "moves" / f"{symbol.lower()}_moves.parquet") for symbol in SYMBOLS]
    moves = pd.concat(frames, ignore_index=True)
    return moves[(moves["year"] == year) & moves["event"]].reset_index(drop=True)


def load_news_tables() -> pd.DataFrame | None:
    tables = sorted(NEWS_DIR.glob("*.parquet"))
    if not tables:
        return None
    return pd.concat([pd.read_parquet(path) for path in tables], ignore_index=True).sort_values("timestamp_cst")


def build(events: pd.DataFrame, news: pd.DataFrame, lookback_minutes: int) -> pd.DataFrame:
    rows = []
    for event in events.itertuples():
        window_start = pd.Timestamp(event.ts_end) - pd.Timedelta(minutes=lookback_minutes)
        # Point-in-time: only information KNOWN at or before the event's end qualifies
        # (known_at_cst, never event_at_cst — a release/revision knowable only later
        # must not explain an earlier move).
        candidates = news[(news["known_at_cst"] > window_start) & (news["known_at_cst"] <= pd.Timestamp(event.ts_end))]
        for item in candidates.itertuples():
            rows.append({
                "event_ts": event.ts_end, "event_kind": event.kind, "event_symbol": event.symbol,
                "event_ret_pct": event.ret_pct, "news_event_at": item.event_at_cst, "news_known_at": item.known_at_cst,
                "news_source": item.source, "news_category": item.category, "headline": item.headline,
                "minutes_before_event_end": (pd.Timestamp(event.ts_end) - pd.Timestamp(item.known_at_cst)).total_seconds() / 60,
                "attribution": "unlabeled",
            })
    return pd.DataFrame(rows)


def selftest() -> None:
    events = pd.DataFrame([
        {"ts_end": pd.Timestamp("2023-05-01 09:30"), "kind": "hour", "symbol": "MES", "ret_pct": -0.9},
    ])
    news = pd.DataFrame([
        {"event_at_cst": pd.Timestamp("2023-05-01 07:30"), "known_at_cst": pd.Timestamp("2023-05-01 07:30"),
         "source": "synthetic", "category": "macro_release", "headline": "release known in window - keep"},
        {"event_at_cst": pd.Timestamp("2023-05-01 07:30"), "known_at_cst": pd.Timestamp("2023-04-26 08:00"),
         "source": "synthetic", "category": "macro_estimate", "headline": "estimate known before lookback - excluded"},
        {"event_at_cst": pd.Timestamp("2023-05-01 07:30"), "known_at_cst": pd.Timestamp("2023-05-15 08:00"),
         "source": "synthetic", "category": "macro_revision", "headline": "LEAK TEST: revision of a pre-event release, known later - must be excluded"},
        {"event_at_cst": pd.Timestamp("2023-05-01 10:00"), "known_at_cst": pd.Timestamp("2023-05-01 10:00"),
         "source": "synthetic", "category": "headline", "headline": "after the event - excluded"},
    ])
    table = build(events, news, lookback_minutes=720)
    assert len(table) == 1 and table.iloc[0]["headline"].startswith("release known in window"), table
    print("selftest OK: 1 of 4 kept; the later-known revision (event_at before the move, known_at after) did NOT leak.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2023)
    parser.add_argument("--lookback-minutes", type=int, default=720)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        selftest()
        return
    news = load_news_tables()
    if news is None:
        print("No normalized news tables in data/news/ — the news-source decision is pending. Nothing to build.")
        return
    events = load_events(args.year)
    table = build(events, news, args.lookback_minutes)
    out = RESULTS_DIR / f"explanations_{args.year}.parquet"
    table.to_parquet(out, index=False)
    print(f"{len(table):,} event-news candidate pairs -> {out.name} (all attribution=unlabeled)")


if __name__ == "__main__":
    main()
