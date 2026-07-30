"""Web search adapter with per-site limiters — STUB.

Rule (docs/CONCEPTS.md §5, Mike): search can be general, but each site in the limiter
list can be turned on or off individually — the site list is the only repeatability
control we have. An unrestricted comparison mode exists to see what limiting changes;
unrestricted runs are labeled comparison runs and are never scored runs. The active
limiter configuration goes into the run manifest like any declared source.
"""
import pandas as pd

from .base import NewsSource

# Default limiters: site -> on/off. Edit in data/news/access.json -> web_search.sites.
DEFAULT_SITES = {
    "reuters.com": True,
    "cnbc.com": True,
    "marketwatch.com": True,
    "bls.gov": True,
    "federalreserve.gov": True,
}


class WebSearchSource(NewsSource):
    name = "web_search"

    def active_sites(self) -> list[str]:
        sites = self.config.get("sites") or DEFAULT_SITES
        return sorted(site for site, enabled in sites.items() if enabled)

    def is_unrestricted(self) -> bool:
        return bool(self.config.get("unrestricted"))

    def fetch(self, start_cst: str, end_cst: str) -> pd.DataFrame:
        mode = ("UNRESTRICTED comparison mode (never scored)" if self.is_unrestricted()
                else f"limited to sites turned on: {', '.join(self.active_sites())}")
        raise NotImplementedError(
            f"Web search retrieval is not connected yet. This run would be {mode}. Every "
            "returned item must carry its original publish timestamp so the point-in-time "
            "cut can be applied."
        )
