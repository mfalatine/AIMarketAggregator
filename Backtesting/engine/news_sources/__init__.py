"""Registry of selectable news sources.

Usage:
    from news_sources import get_source, load_access_config
    source = get_source('trading_economics', load_access_config())
    frame = source.validate(source.fetch('2023-01-01', '2023-12-31'))

Access config lives in data/news/access.json (git-ignored; copy access.example.json).
A run's declared sources — including the web-search allowlist — go into its manifest;
the AI may consider ONLY those (docs/CONCEPTS.md §2).
"""
import json
from pathlib import Path

from .alpha_vantage import AlphaVantageSource
from .base import NEWS_COLUMNS, NewsSource
from .benzinga import BenzingaSource
from .ff_weekly import FFWeeklySource
from .finnhub_news import FinnhubNewsSource
from .gdelt import GdeltSource
from .nasdaq_calendar import NasdaqCalendarSource
from .trading_economics import TradingEconomicsSource
from .web_search import WebSearchSource

SOURCES = {source.name: source for source in (
    NasdaqCalendarSource, FFWeeklySource, GdeltSource, AlphaVantageSource, FinnhubNewsSource,
    TradingEconomicsSource, BenzingaSource, WebSearchSource)}
ACCESS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "news" / "access.json"


def load_access_config() -> dict:
    if ACCESS_PATH.exists():
        return json.loads(ACCESS_PATH.read_text(encoding="utf-8"))
    return {}


def get_source(name: str, access_config: dict | None = None) -> NewsSource:
    if name not in SOURCES:
        raise KeyError(f"Unknown news source '{name}'. Available: {sorted(SOURCES)}")
    config = (access_config if access_config is not None else load_access_config()).get(name, {})
    return SOURCES[name](config)
