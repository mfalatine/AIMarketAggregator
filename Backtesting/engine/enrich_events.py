"""Enrich event rows with trade-guidance measurements from prices (no AI, no news).

For every move that qualifies under EITHER definition (magnitude or percentile), we
assume entry at the event's end price, direction = the event's direction, and measure
forward to a horizon:

    hour / am_leg / pm_leg / overnight_gap -> same day's RTH close
    session                               -> next session's RTH close
    sunday_gap                            -> next RTH close after the Sunday open
    week                                  -> 7 calendar days after entry

Added columns (all measured over that horizon, in the event's direction):
    mfe_pct          max favorable excursion — how far it kept going your way
    mae_pct          max adverse excursion — how far it pulled against you first
    time_to_peak_min minutes from entry to the favorable extreme (hold-time guidance)
    fwd_ret_pct      signed move from entry to horizon close, in event direction
    mae_usd          MAE in dollars per one micro contract (MES $5/pt, MNQ $2/pt)
    mfe_usd          MFE in dollars per one micro contract

News attribution intentionally absent — pending Mike's news-source decision.
Run: python Backtesting/engine/enrich_events.py   (after detect_moves.py; rewrites
the moves parquet in place with the new columns)
"""
from pathlib import Path

import numpy as np
import pandas as pd

from load_prices import FILES, load_minutes, rth_only

MOVES_DIR = Path(__file__).resolve().parent.parent / "results" / "moves"
POINT_VALUE = {"MES": 5.0, "MNQ": 2.0}
ENRICH_COLUMNS = ["mfe_pct", "mae_pct", "time_to_peak_min", "fwd_ret_pct", "mae_usd", "mfe_usd"]


def horizon_end(row, rth_close_by_date: dict, sorted_dates: list):
    date = pd.Timestamp(row.ts_end).date()
    later = [d for d in sorted_dates if d >= date]
    if row.kind in ("hour", "am_leg", "pm_leg", "overnight_gap"):
        return rth_close_by_date.get(date)
    if row.kind == "session":
        following = [d for d in sorted_dates if d > date]
        return rth_close_by_date.get(following[0]) if following else None
    if row.kind == "sunday_gap":
        following = [d for d in sorted_dates if d > date]
        return rth_close_by_date.get(following[0]) if following else None
    if row.kind == "week":
        return pd.Timestamp(row.ts_end) + pd.Timedelta(days=7)
    return None


def enrich(symbol: str) -> pd.DataFrame:
    moves = pd.read_parquet(MOVES_DIR / f"{symbol.lower()}_moves.parquet")
    minutes = load_minutes(symbol)
    rth = rth_only(minutes)
    rth_close_by_date = rth.groupby(rth["datetime"].dt.date)["datetime"].last().to_dict()
    sorted_dates = sorted(rth_close_by_date)
    times = minutes["datetime"].to_numpy()
    highs = minutes["high"].to_numpy()
    lows = minutes["low"].to_numpy()
    closes = minutes["close"].to_numpy()

    for column in ENRICH_COLUMNS:
        moves[column] = float("nan")

    targets = moves[moves["magnitude_event"] | moves["percentile_event"]]
    point_value = POINT_VALUE[symbol]
    for index, row in targets.iterrows():
        end = horizon_end(row, rth_close_by_date, sorted_dates)
        if end is None:
            continue
        start_index = int(np.searchsorted(times, np.datetime64(pd.Timestamp(row.ts_end)), side="right"))
        stop_index = int(np.searchsorted(times, np.datetime64(pd.Timestamp(end)), side="right"))
        if stop_index <= start_index:
            continue
        entry = row.price_end
        window_high = highs[start_index:stop_index]
        window_low = lows[start_index:stop_index]
        up = row.ret_pct > 0
        favorable = (window_high - entry) if up else (entry - window_low)
        adverse = (entry - window_low) if up else (window_high - entry)
        peak_index = int(np.argmax(favorable))
        mfe_points = max(float(favorable.max()), 0.0)
        mae_points = max(float(adverse.max()), 0.0)
        fwd = float(closes[stop_index - 1] - entry) * (1 if up else -1)
        moves.loc[index, "mfe_pct"] = mfe_points / entry * 100
        moves.loc[index, "mae_pct"] = mae_points / entry * 100
        moves.loc[index, "time_to_peak_min"] = (pd.Timestamp(times[start_index + peak_index]) - pd.Timestamp(row.ts_end)).total_seconds() / 60
        moves.loc[index, "fwd_ret_pct"] = fwd / entry * 100
        moves.loc[index, "mae_usd"] = mae_points * point_value
        moves.loc[index, "mfe_usd"] = mfe_points * point_value
    moves.to_parquet(MOVES_DIR / f"{symbol.lower()}_moves.parquet", index=False)
    return moves


def main() -> None:
    for symbol in FILES:
        moves = enrich(symbol)
        done = moves["mfe_pct"].notna().sum()
        print(f"{symbol}: enriched {done:,} event rows with MFE/MAE/time-to-peak/fwd/USD")


if __name__ == "__main__":
    main()
