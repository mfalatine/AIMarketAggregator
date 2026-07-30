"""Stage 1 — move detector. Prices only: no AI, no news, deterministic.

Scans MES and MNQ 1-minute bars and catalogs moves per timeframe kind:
    session       RTH open (08:30) -> RTH close (14:59), per trading day
    overnight_gap prior RTH close -> today's RTH open
    am_leg        RTH open -> midday (11:44 close)
    pm_leg        midday -> RTH close
    hour          non-overlapping RTH buckets from 08:30 (the last bucket, 14:30-14:59,
                  is a half hour and is kept)
    week          last session close of ISO week -> prior week's last session close
    sunday_gap    prior week's last RTH close -> first Globex bar of the new week (Sun 17:00+)

Significance (2023-2025 only): |move| >= the 95th percentile of |move| for the same
symbol+kind over the trailing two calendar years (2023 vs 2021-22, 2024 vs 2022-23,
2025 vs 2023-24). Trailing-only baselines — no forward bias (docs/CONCEPTS.md §1).

Output: results/moves/<symbol>_moves.parquet, one row per move, all kinds in one file.
Run:    python Backtesting/engine/detect_moves.py
"""
from pathlib import Path

import pandas as pd

from load_prices import FILES, load_minutes, rth_only

MOVES_DIR = Path(__file__).resolve().parent.parent / "results" / "moves"
MIDDAY = "11:44"


def _move(kind, ts_start, ts_end, price_start, price_end):
    ret = (price_end / price_start - 1) * 100
    return {"kind": kind, "ts_start": ts_start, "ts_end": ts_end, "price_start": price_start,
            "price_end": price_end, "ret_pct": ret,
            "direction": "up" if ret > 0 else "down" if ret < 0 else "flat"}


def session_frame(rth: pd.DataFrame) -> pd.DataFrame:
    """One row per trading day with open/close/midday bars."""
    rth = rth.assign(session=rth["datetime"].dt.date, hhmm=rth["datetime"].dt.strftime("%H:%M"))
    grouped = rth.groupby("session")
    frame = pd.DataFrame({
        "ts_open": grouped["datetime"].first(), "open": grouped["open"].first(),
        "ts_close": grouped["datetime"].last(), "close": grouped["close"].last(),
    })
    midday = rth[rth["hhmm"] <= MIDDAY].groupby("session").agg(ts_mid=("datetime", "last"), mid=("close", "last"))
    return frame.join(midday).reset_index()


def detect(symbol: str) -> pd.DataFrame:
    minutes = load_minutes(symbol)
    rth = rth_only(minutes)
    sessions = session_frame(rth)
    moves = []

    for row in sessions.itertuples():
        moves.append(_move("session", row.ts_open, row.ts_close, row.open, row.close))
        moves.append(_move("am_leg", row.ts_open, row.ts_mid, row.open, row.mid))
        moves.append(_move("pm_leg", row.ts_mid, row.ts_close, row.mid, row.close))
    for prev, cur in zip(sessions.itertuples(), sessions.iloc[1:].itertuples()):
        moves.append(_move("overnight_gap", prev.ts_close, cur.ts_open, prev.close, cur.open))

    minutes_from_open = (rth["datetime"].dt.hour * 60 + rth["datetime"].dt.minute) - (8 * 60 + 30)
    hourly = rth.assign(session=rth["datetime"].dt.date, bucket=minutes_from_open // 60)
    for (_, _), bars in hourly.groupby(["session", "bucket"]):
        moves.append(_move("hour", bars["datetime"].iloc[0], bars["datetime"].iloc[-1],
                           bars["open"].iloc[0], bars["close"].iloc[-1]))

    weekly = sessions.assign(week=pd.to_datetime(sessions["session"]).dt.strftime("%G-W%V"))
    last_of_week = weekly.groupby("week").last().reset_index()
    for prev, cur in zip(last_of_week.itertuples(), last_of_week.iloc[1:].itertuples()):
        moves.append(_move("week", prev.ts_close, cur.ts_close, prev.close, cur.close))
    globex = minutes.assign(week=minutes["datetime"].dt.strftime("%G-W%V"))
    sunday_open = globex[(globex["datetime"].dt.weekday == 6) & (globex["datetime"].dt.hour >= 17)]
    first_sunday_bar = sunday_open.groupby("week").first().reset_index()
    close_by_week = dict(zip(last_of_week["week"], zip(last_of_week["ts_close"], last_of_week["close"])))
    weeks = sorted(close_by_week)
    for row in first_sunday_bar.itertuples():
        prior_weeks = [week for week in weeks if week < row.week]
        if not prior_weeks:
            continue
        prior_ts, prior_close = close_by_week[prior_weeks[-1]]
        moves.append(_move("sunday_gap", prior_ts, row.datetime, prior_close, row.open))

    frame = pd.DataFrame(moves)
    frame.insert(0, "symbol", symbol)
    frame["year"] = pd.to_datetime(frame["ts_end"]).dt.year
    frame["abs_ret"] = frame["ret_pct"].abs()

    frame["baseline_p95"] = float("nan")
    frame["significant"] = False
    for year in (2023, 2024, 2025):
        trailing = frame[frame["year"].isin([year - 2, year - 1])]
        for kind, baseline in trailing.groupby("kind")["abs_ret"]:
            p95 = baseline.quantile(0.95)
            mask = (frame["year"] == year) & (frame["kind"] == kind)
            frame.loc[mask, "baseline_p95"] = p95
            frame.loc[mask, "significant"] = frame.loc[mask, "abs_ret"] >= p95
    return frame.drop(columns=["abs_ret"]).sort_values(["kind", "ts_start"]).reset_index(drop=True)


def main() -> None:
    MOVES_DIR.mkdir(parents=True, exist_ok=True)
    for symbol in FILES:
        frame = detect(symbol)
        out = MOVES_DIR / f"{symbol.lower()}_moves.parquet"
        frame.to_parquet(out, index=False)
        flagged = frame[frame["significant"]]
        print(f"{symbol}: {len(frame):,} moves cataloged -> {out.name}")
        for kind, count in flagged.groupby("kind").size().items():
            print(f"  significant {kind}: {count}")


if __name__ == "__main__":
    main()
