"""Trading Economics economic-calendar adapter — STUB awaiting source decision + API key.

When activated: GET https://api.tradingeconomics.com/calendar/country/united states
with date range and `c=<api_key>`; map each release to a 'macro_release' row whose
meta JSON carries expected/previous/actual. Release times arrive in UTC or ET —
convert to CST (ET = CST + 1 hour) before returning.
"""
import pandas as pd

from .base import NewsSource


class TradingEconomicsSource(NewsSource):
    name = "trading_economics"

    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        raise NotImplementedError(
            "Trading Economics is not connected yet. Awaiting Mike's source decision; "
            "then set data/news/access.json -> trading_economics.api_key and implement fetch()."
        )
