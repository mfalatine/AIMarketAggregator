"""Identify the 2023 events (develop year — open book).

An event is a spike or drop per Mike's magnitude settings (detection_config.json) —
see docs/CONCEPTS.md §7. Results are counts of what actually happened, never averages.

Produces:
  results/EVENTS_2023.md    chronological catalog of every 2023 spike/drop
  results/events_2023.json  outcome counts consumed by make_summary.py / the Backtest tab

Run: python Backtesting/engine/identify_events.py  (after detect_moves.py)
"""
import json
from pathlib import Path

import pandas as pd

from detect_moves import event_definition, spike_thresholds

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
SYMBOLS = ("MES", "MNQ")
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def load_moves() -> pd.DataFrame:
    frames = [pd.read_parquet(RESULTS_DIR / "moves" / f"{symbol.lower()}_moves.parquet") for symbol in SYMBOLS]
    moves = pd.concat(frames, ignore_index=True)
    moves["date"] = pd.to_datetime(moves["ts_end"]).dt.date
    return moves


def event_catalog(moves: pd.DataFrame) -> pd.DataFrame:
    """2023 spikes/drops, one row per (date, kind), both symbols side by side."""
    flagged = moves[(moves["year"] == 2023) & moves["event"]]
    rows = []
    # Group by the move's own start time, not just (date, kind): two separate hourly
    # spikes in one day are two events, not one (Sol review 2026-08-01 — the old
    # grouping collapsed 848 symbol-events into 495 rows).
    for (date, kind, ts_start), group in flagged.groupby(["date", "kind", "ts_start"]):
        by_symbol = {row.symbol: row for row in group.itertuples()}
        any_row = next(iter(by_symbol.values()))
        record = {
            "date": date, "kind": kind, "ts_start": ts_start, "ts_end": any_row.ts_end,
            "mes_pct": getattr(by_symbol.get("MES"), "ret_pct", float("nan")),
            "mnq_pct": getattr(by_symbol.get("MNQ"), "ret_pct", float("nan")),
            "direction": any_row.direction,
        }
        for symbol in ("MES", "MNQ"):
            row = by_symbol.get(symbol)
            prefix = symbol.lower()
            record[f"{prefix}_mfe"] = getattr(row, "mfe_pct", float("nan")) if row else float("nan")
            record[f"{prefix}_mae"] = getattr(row, "mae_pct", float("nan")) if row else float("nan")
            record[f"{prefix}_peak_min"] = getattr(row, "time_to_peak_min", float("nan")) if row else float("nan")
        rows.append(record)
    return pd.DataFrame(rows).sort_values(["date", "ts_start"]).reset_index(drop=True)


def outcome_counts(moves: pd.DataFrame) -> dict:
    """What actually happened around 2023 events — counts, not averages."""
    year = moves[moves["year"] == 2023]
    stats = {}

    # 1) After a gap event: did the session close in the gap's direction? Did the
    #    session itself become an event?
    gap_rows = []
    for symbol in SYMBOLS:
        sym = year[year["symbol"] == symbol]
        gaps = sym[(sym["kind"] == "overnight_gap") & sym["event"]]
        sessions = sym[sym["kind"] == "session"].set_index("date")
        for gap in gaps.itertuples():
            if gap.date in sessions.index:
                session = sessions.loc[gap.date]
                gap_rows.append({"continued": (gap.ret_pct > 0) == (session["ret_pct"] > 0),
                                 "session_event": bool(session["event"])})
    gaps_frame = pd.DataFrame(gap_rows)
    if len(gaps_frame):
        stats["after_gap_event"] = {
            "gap_events": len(gaps_frame),
            "session_closed_gap_direction": int(gaps_frame["continued"].sum()),
            "session_reversed": int((~gaps_frame["continued"]).sum()),
            "session_was_also_event": int(gaps_frame["session_event"].sum()),
        }

    # 2) After an AM event: PM direction and whether PM was itself an event.
    am_rows = []
    for symbol in SYMBOLS:
        sym = year[year["symbol"] == symbol]
        ams = sym[(sym["kind"] == "am_leg") & sym["event"]]
        pms = sym[sym["kind"] == "pm_leg"].set_index("date")
        for am in ams.itertuples():
            if am.date in pms.index:
                pm = pms.loc[am.date]
                am_rows.append({"continued": (am.ret_pct > 0) == (pm["ret_pct"] > 0),
                                "pm_event": bool(pm["event"])})
    am_frame = pd.DataFrame(am_rows)
    if len(am_frame):
        stats["after_am_event"] = {
            "am_events": len(am_frame),
            "pm_same_direction": int(am_frame["continued"].sum()),
            "pm_opposite": int((~am_frame["continued"]).sum()),
            "pm_was_also_event": int(am_frame["pm_event"].sum()),
        }

    # 3) Day-of-week counts of events (both symbols counted separately).
    flagged = year[year["event"]]
    weekday_counts = pd.to_datetime(flagged["ts_end"]).dt.weekday.value_counts().sort_index()
    stats["events_by_weekday"] = {WEEKDAYS[day]: int(count) for day, count in weekday_counts.items()}

    # 4) Back-to-back: how often a session event was followed by another session event
    #    the next trading day. POINTER INFO ONLY (volatility is a pointer, not a
    #    director — CONCEPTS.md §7).
    pair_total, pair_repeat = 0, 0
    for symbol in SYMBOLS:
        sessions = year[(year["symbol"] == symbol) & (year["kind"] == "session")].sort_values("ts_start").reset_index(drop=True)
        next_event = sessions["event"].shift(-1)
        pairs = sessions[sessions["event"] & next_event.notna()]
        pair_total += len(pairs)
        pair_repeat += int(next_event[pairs.index].sum())
    stats["pointer_back_to_back"] = {"session_events": pair_total, "next_session_also_event": pair_repeat}
    return stats


def write_events_markdown(catalog: pd.DataFrame) -> None:
    definition = event_definition()
    thresholds = spike_thresholds()
    lines = ["# 2023 spikes and drops — price-identified (develop year)\n",
             f"Event definition mode: **{definition['mode']}** (engine/detection_config.json). "
             f"Magnitude settings: " + ", ".join(f"{kind} {value}%" for kind, value in thresholds.items()) + ". "
             f"Percentile settings: top {definition['percentile']['top_percent']}% vs trailing {definition['percentile']['trailing_years']} years.\n",
             "This is the list to hold against news sources: what happened on these days?\n",
             "In/out guidance per event (entry at event end, in its direction, to the kind's",
             "horizon): `MFE/MAE/peak` = max % it ran your way / max % against you / minutes to",
             "the favorable peak. News attribution: **pending Mike's source decision.**\n",
             "| Date | Day | Kind | MES % | MNQ % | MES MFE/MAE/peak | MNQ MFE/MAE/peak | News |",
             "|---|---|---|---|---|---|---|---|"]
    for row in catalog.itertuples():
        day = WEEKDAYS[pd.Timestamp(row.date).weekday()]
        kind_label = f"{row.kind} {pd.Timestamp(row.ts_start).strftime('%H:%M')}" if row.kind == "hour" else row.kind
        mes = f"{row.mes_pct:+.2f}" if pd.notna(row.mes_pct) else "—"
        mnq = f"{row.mnq_pct:+.2f}" if pd.notna(row.mnq_pct) else "—"
        def guidance(prefix):
            mfe = getattr(row, f"{prefix}_mfe")
            if pd.isna(mfe):
                return "—"
            return f"{mfe:.2f} / {getattr(row, f'{prefix}_mae'):.2f} / {getattr(row, f'{prefix}_peak_min'):.0f}m"
        lines.append(f"| {row.date} | {day} | {kind_label} | {mes} | {mnq} | {guidance('mes')} | {guidance('mnq')} | pending |")
    (RESULTS_DIR / "EVENTS_2023.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    moves = load_moves()
    catalog = event_catalog(moves)
    stats = outcome_counts(moves)
    write_events_markdown(catalog)
    payload = {"event_definition": event_definition(), "event_days": int(catalog["date"].nunique()),
               "events": len(catalog), "outcomes": stats}
    (RESULTS_DIR / "events_2023.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"2023: {payload['events']} events on {payload['event_days']} distinct days -> EVENTS_2023.md")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
