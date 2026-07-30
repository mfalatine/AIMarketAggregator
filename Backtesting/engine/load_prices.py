"""Canonical loader for the arena's 1-minute price data.

All timestamps are CST, tz-naive (house rule: ET = CST + 1 hour).
Run directly for a coverage self-check:  python load_prices.py
"""
from pathlib import Path

import pandas as pd

PRICES_DIR = Path(__file__).resolve().parent.parent / "data" / "prices"
FILES = {
    "MES": PRICES_DIR / "mes_continuous_2021-01-01_2025-12-31.parquet",
    "MNQ": PRICES_DIR / "mnq_continuous_2021-01-01_2025-12-31.parquet",
}
RTH_OPEN = "08:30"   # regular-hours open, CST
RTH_LAST = "14:59"   # last regular-hours minute, CST


def load_minutes(symbol: str, start: str | None = None, end: str | None = None) -> pd.DataFrame:
    """1-minute bars for 'MES' or 'MNQ', optionally sliced by date (inclusive).

    Returns columns: datetime, symbol, open, high, low, close, volume.
    """
    df = pd.read_parquet(FILES[symbol.upper()])
    df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    if start:
        df = df[df["datetime"] >= pd.Timestamp(start)]
    if end:
        df = df[df["datetime"] <= pd.Timestamp(end) + pd.Timedelta(days=1) - pd.Timedelta(minutes=1)]
    return df.reset_index(drop=True)


def aggregate(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Aggregate 1-minute bars to a coarser timeframe, e.g. '60min', '1D', 'W-FRI'."""
    out = (
        df.set_index("datetime")
        .resample(rule)
        .agg(open=("open", "first"), high=("high", "max"), low=("low", "min"),
             close=("close", "last"), volume=("volume", "sum"))
        .dropna(subset=["open"])
        .reset_index()
    )
    out["symbol"] = df["symbol"].iloc[0]
    return out


def rth_only(df: pd.DataFrame) -> pd.DataFrame:
    """Regular trading hours only (08:30-14:59 CST)."""
    t = df["datetime"].dt.strftime("%H:%M")
    return df[(t >= RTH_OPEN) & (t <= RTH_LAST)].reset_index(drop=True)


if __name__ == "__main__":
    for symbol in FILES:
        df = load_minutes(symbol)
        by_year = df[df["datetime"].dt.year >= 2023].groupby(df["datetime"].dt.year).size()
        print(f"{symbol}: {len(df):,} rows | {df['datetime'].min()} -> {df['datetime'].max()}")
        for year, rows in by_year.items():
            print(f"  {year}: {rows:,} minute bars")
        daily = aggregate(rth_only(load_minutes(symbol, "2023-01-01", "2025-12-31")), "1D")
        print(f"  2023-2025 RTH daily bars: {len(daily):,}")
