"""Benzinga historical news adapter — STUB awaiting source decision + API key.

When activated: GET https://api.benzinga.com/api/v2/news with date range and token;
map each article to a 'headline' row (tickers from the channel/stocks tags), publish
time converted to CST.
"""
import pandas as pd

from .base import NewsSource


class BenzingaSource(NewsSource):
    name = "benzinga"

    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        raise NotImplementedError(
            "Benzinga is not connected yet. Awaiting Mike's source decision; "
            "then set data/news/access.json -> benzinga.api_key and implement fetch()."
        )
