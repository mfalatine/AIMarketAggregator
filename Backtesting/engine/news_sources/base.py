"""News source contract. Every adapter honors the operator rules in
docs/OPERATOR_CONCEPTS.md: point-in-time only (no item after `as_of` may ever be
returned), and a run considers only its declared sources.

Normalized schema every adapter returns (a pandas DataFrame):
    timestamp_cst  datetime, CST tz-naive — when the item was published/scheduled
    source         str      — registry name of the adapter ('trading_economics', ...)
    category       str      — adapter-defined bucket ('macro_release', 'headline', ...)
    headline       str
    body           str      — may be empty
    tickers        str      — comma-separated, may be empty
    meta           str      — JSON string for source-specific extras (expected/actual, url, ...)
"""
from abc import ABC, abstractmethod

import pandas as pd

NEWS_COLUMNS = ["timestamp_cst", "source", "category", "headline", "body", "tickers", "meta"]


class NewsSource(ABC):
    """One selectable news source. Config comes from data/news/access.json (git-ignored)."""

    name = "base"

    def __init__(self, config: dict):
        self.config = config or {}

    @abstractmethod
    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        """All items published within [start_cst, end_cst], normalized to NEWS_COLUMNS."""

    def as_of(self, frame: pd.DataFrame, moment_cst: str) -> pd.DataFrame:
        """Point-in-time view: items visible at `moment_cst` and not one minute later.

        Stage 3 must ONLY hand the AI news that passed through this cut. This is the
        no-forward-bias rule for 2024 and 2025 in code form.
        """
        return frame[frame["timestamp_cst"] <= pd.Timestamp(moment_cst)].reset_index(drop=True)

    def validate(self, frame: pd.DataFrame) -> pd.DataFrame:
        missing = [column for column in NEWS_COLUMNS if column not in frame.columns]
        if missing:
            raise ValueError(f"{self.name}: adapter output missing columns {missing}")
        return frame[NEWS_COLUMNS].sort_values("timestamp_cst").reset_index(drop=True)
