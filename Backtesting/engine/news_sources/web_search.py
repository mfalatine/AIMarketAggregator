"""Allowlisted web search adapter — STUB.

Operator rule (docs/OPERATOR_CONCEPTS.md §5): web search must be limited to KNOWN
websites so results are somewhat repeatable. The allowlist is part of the run manifest
like any declared source. An unbounded search cannot be tweaked or scored honestly.
"""
import pandas as pd

from .base import NewsSource

DEFAULT_ALLOWLIST = ["reuters.com", "cnbc.com", "marketwatch.com", "bls.gov", "federalreserve.gov"]


class WebSearchSource(NewsSource):
    name = "web_search"

    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        allowlist = self.config.get("allowlist") or DEFAULT_ALLOWLIST
        raise NotImplementedError(
            "Web search retrieval is not connected yet. It will be restricted to the "
            f"allowlisted sites ({', '.join(allowlist)}) and every returned item must carry "
            "its original publish timestamp so the point-in-time cut can be applied."
        )
