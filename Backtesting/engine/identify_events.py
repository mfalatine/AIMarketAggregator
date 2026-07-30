"""Identify the 2023 events (develop year — open book) and first price-only patterns.

Reads the Stage 1 move catalog and produces:
  results/EVENTS_2023.md    chronological catalog of every significant 2023 event,
                            ready for the news-source conversation ("what happened
                            on these days?")
  results/events_2023.json  pattern stats consumed by make_summary.py / the Backtest tab

2023 only, per protocol: this is the year we are allowed to stare at.
Run: python Backtesting/engine/identify_events.py  (after detect_moves.py)
"""
import json
from pathlib import Path

import pandas as pd

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
SYMBOLS = ("MES", "MNQ")
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def load_moves() -> pd.DataFrame:
    frames = [pd.read_parquet(RESULTS_DIR / "moves" / f"{symbol.lower()}_moves.parquet") for symbol in SYMBOLS]
    moves = pd.concat(frames, ignore_index=True)
    moves["date"] = pd.to_datetime(moves["ts_end"]).dt.date
    return moves


def event_catalog(moves: pd.DataFrame) -> pd.DataFrame:
    """Significant 2023 events, one row per (date, kind), both symbols side by side."""
    flagged = moves[(moves["year"] == 2023) & moves["significant"]]
    rows = []
    for (date, kind), group in flagged.groupby(["date", "kind"]):
        by_symbol = {row.symbol: row for row in group.itertuples()}
        any_row = next(iter(by_symbol.values()))
        rows.append({
            "date": date, "kind": kind, "ts_start": any_row.ts_start, "ts_end": any_row.ts_end,
            "mes_pct": getattr(by_symbol.get("MES"), "ret_pct", float("nan")),
            "mnq_pct": getattr(by_symbol.get("MNQ"), "ret_pct", float("nan")),
            "direction": any_row.direction,
        })
    return pd.DataFrame(rows).sort_values(["date", "ts_start"]).reset_index(drop=True)


def pattern_stats(moves: pd.DataFrame) -> dict:
    """First price-only patterns on 2023 (both symbols pooled)."""
    year = moves[moves["year"] == 2023]
    stats = {}

    # 1) Overnight gap follow-through: after a significant gap, does the session continue?
    gap_rows = []
    for symbol in SYMBOLS:
        sym = year[year["symbol"] == symbol]
        gaps = sym[(sym["kind"] == "overnight_gap") & sym["significant"]]
        sessions = sym[sym["kind"] == "session"].set_index("date")
        for gap in gaps.itertuples():
            if gap.date in sessions.index:
                session = sessions.loc[gap.date]
                gap_rows.append({"gap": gap.ret_pct, "session": session["ret_pct"],
                                 "continued": (gap.ret_pct > 0) == (session["ret_pct"] > 0)})
    gap_frame = pd.DataFrame(gap_rows)
    if len(gap_frame):
        stats["gap_follow_through"] = {
            "events": len(gap_frame),
            "continuation_rate_pct": round(100 * gap_frame["continued"].mean(), 1),
            "avg_session_after_gap_up": round(gap_frame[gap_frame["gap"] > 0]["session"].mean(), 2),
            "avg_session_after_gap_down": round(gap_frame[gap_frame["gap"] < 0]["session"].mean(), 2),
        }

    # 2) AM leg -> PM leg: after a significant morning, what does the afternoon do?
    am_rows = []
    for symbol in SYMBOLS:
        sym = year[year["symbol"] == symbol]
        ams = sym[(sym["kind"] == "am_leg") & sym["significant"]]
        pms = sym[sym["kind"] == "pm_leg"].set_index("date")
        for am in ams.itertuples():
            if am.date in pms.index:
                pm = pms.loc[am.date]
                am_rows.append({"am": am.ret_pct, "pm": pm["ret_pct"],
                                "continued": (am.ret_pct > 0) == (pm["ret_pct"] > 0)})
    am_frame = pd.DataFrame(am_rows)
    if len(am_frame):
        stats["am_to_pm"] = {
            "events": len(am_frame),
            "continuation_rate_pct": round(100 * am_frame["continued"].mean(), 1),
            "avg_pm_after_sig_am": round(am_frame["pm"].mean(), 2),
        }

    # 3) Day-of-week distribution of all significant 2023 events.
    flagged = year[year["significant"]]
    weekday_counts = pd.to_datetime(flagged["ts_end"]).dt.weekday.value_counts().sort_index()
    stats["events_by_weekday"] = {WEEKDAYS[day]: int(count) for day, count in weekday_counts.items()}

    # 4) Volatility clustering: |next session| after a significant session vs typical.
    cluster_rows = []
    for symbol in SYMBOLS:
        sessions = year[(year["symbol"] == symbol) & (year["kind"] == "session")].sort_values("ts_start").reset_index(drop=True)
        next_abs = sessions["ret_pct"].abs().shift(-1)
        cluster_rows.append(pd.DataFrame({"sig": sessions["significant"], "next_abs": next_abs}))
    cluster = pd.concat(cluster_rows).dropna()
    stats["vol_clustering"] = {
        "avg_next_session_abs_after_significant": round(cluster[cluster["sig"]]["next_abs"].mean(), 2),
        "avg_next_session_abs_otherwise": round(cluster[~cluster["sig"]]["next_abs"].mean(), 2),
    }
    return stats


def write_events_markdown(catalog: pd.DataFrame) -> None:
    lines = ["# 2023 significant events — price-identified (develop year)\n",
             "Every move in 2023 that landed in the top 5% versus the 2021-2022 baseline.",
             "This is the list to hold against news sources: what happened on these days?\n",
             "| Date | Day | Kind | MES % | MNQ % |", "|---|---|---|---|---|"]
    for row in catalog.itertuples():
        day = WEEKDAYS[pd.Timestamp(row.date).weekday()]
        mes = f"{row.mes_pct:+.2f}" if pd.notna(row.mes_pct) else "—"
        mnq = f"{row.mnq_pct:+.2f}" if pd.notna(row.mnq_pct) else "—"
        lines.append(f"| {row.date} | {day} | {row.kind} | {mes} | {mnq} |")
    (RESULTS_DIR / "EVENTS_2023.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    moves = load_moves()
    catalog = event_catalog(moves)
    stats = pattern_stats(moves)
    write_events_markdown(catalog)
    payload = {"event_days": int(catalog["date"].nunique()), "events": len(catalog), "patterns": stats}
    (RESULTS_DIR / "events_2023.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"2023: {payload['events']} significant events on {payload['event_days']} distinct days -> EVENTS_2023.md")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
