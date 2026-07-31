"""News source contract. Every adapter honors the rules in docs/CONCEPTS.md:
point-in-time only, and a run considers only its declared sources.

Two timestamps per row (Sol review 2026-07-30 — a single timestamp could leak):
    event_at_cst  when the thing happens/happened (scheduled release time, or the
                  publish time for a headline)
    known_at_cst  when THIS piece of information became knowable. The point-in-time
                  cut runs on known_at_cst, never event_at_cst.

A scheduled release therefore produces SEPARATE snapshot rows, not one row:
    estimate snapshot   known_at = when the forecast was published (days before);
                        carries estimate/previous only — never the actual
    release snapshot    known_at = the release moment; carries the actual
    revision snapshot   known_at = the revision moment; carries the revised value
This way a replay before the release can see the estimate but never the actual, and
revisions never rewrite the past. For plain headlines, event_at == known_at.

Normalized schema every adapter returns (a pandas DataFrame):
    event_at_cst   datetime, CST tz-naive
    known_at_cst   datetime, CST tz-naive
    source         str  — registry name of the adapter ('fmp_calendar', ...)
    category       str  — adapter bucket ('macro_estimate', 'macro_release',
                          'macro_revision', 'headline', ...)
    headline       str
    body           str  — may be empty
    tickers        str  — comma-separated, may be empty
    meta           str  — JSON string for source-specific extras; must contain only
                          information knowable at known_at_cst
"""
from abc import ABC, abstractmethod

import pandas as pd

NEWS_COLUMNS = ["event_at_cst", "known_at_cst", "source", "category", "headline", "body", "tickers", "meta"]


class NewsSource(ABC):
    """One selectable news source. Config comes from data/news/access.json (git-ignored)."""

    name = "base"

    def __init__(self, config: dict):
        self.config = config or {}

    @abstractmethod
    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        """All rows whose known_at_cst falls within [start_cst, end_cst], normalized."""

    def as_of(self, frame: pd.DataFrame, moment_cst: str) -> pd.DataFrame:
        """Point-in-time view: rows KNOWN at `moment_cst` and not one minute later.

        Cuts on known_at_cst. Stage 3 must ONLY hand the AI news that passed through
        this cut. This is the no-forward-bias rule for 2024 and 2025 in code form.
        """
        return frame[frame["known_at_cst"] <= pd.Timestamp(moment_cst)].reset_index(drop=True)

    def validate(self, frame: pd.DataFrame) -> pd.DataFrame:
        missing = [column for column in NEWS_COLUMNS if column not in frame.columns]
        if missing:
            raise ValueError(f"{self.name}: adapter output missing columns {missing}")
        return frame[NEWS_COLUMNS].sort_values("known_at_cst").reset_index(drop=True)
