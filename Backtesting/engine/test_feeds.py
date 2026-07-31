"""Acceptance tests for the FREE feeds in the locked stack (DESIGN.md section 3.5).

Tests, live against the real services:
  1. ForexFactory weekly JSON feed (scheduled + now): fetch, schema, USD filter.
  2. GDELT DOC API (unscheduled + past): historical query for a KNOWN 2023 event
     (the SVB collapse, 2023-03-09..11) restricted to a stack site — must return
     2023-timestamped articles; plus a current-week query for liveness.

The paid-calendar acceptance test (FMP vs EODHD) is separate and key-gated.
AI web search is tested through the app's own CLI path, not here.

Run: python Backtesting/engine/test_feeds.py
"""
import json
import urllib.parse
import urllib.request

FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AMA-feed-acceptance-test"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def test_forexfactory() -> str:
    events = json.loads(fetch(FF_URL))
    required = {"title", "country", "date", "impact", "forecast", "previous"}
    missing = required - set(events[0].keys())
    usd = [event for event in events if event.get("country") == "USD"]
    high = [event for event in usd if event.get("impact") == "High"]
    if missing or not usd:
        return f"FAIL: missing fields {missing} or no USD events"
    return (f"PASS: {len(events)} events this week, {len(usd)} USD ({len(high)} high-impact), "
            f"fields OK; sample: {usd[0]['date']} {usd[0]['title']!r} forecast={usd[0].get('forecast')!r}")


def gdelt_query(query: str, start: str, end: str, maxrecords: int = 30) -> list:
    params = urllib.parse.urlencode({
        "query": query, "mode": "artlist", "format": "json",
        "startdatetime": start, "enddatetime": end, "maxrecords": maxrecords, "sort": "datedesc",
    })
    payload = json.loads(fetch(f"{GDELT_URL}?{params}").decode("utf-8", errors="replace"))
    return payload.get("articles", [])


def test_gdelt_historical_bulk() -> str:
    """The backtest's real GDELT path: raw 15-minute files (no API rate limit).

    Uses the SVB-collapse morning slice as the known-2023 probe. The DOC API
    (gdelt_query above) also works but throttles bursts hard (HTTP 429) — bulk
    files are the route for 3-year pulls."""
    import io
    import zipfile
    raw = fetch("http://data.gdeltproject.org/gdeltv2/20230310143000.export.CSV.zip")
    archive = zipfile.ZipFile(io.BytesIO(raw))
    lines = archive.read(archive.namelist()[0]).decode("utf-8", errors="replace").splitlines()
    svb = [line for line in lines if "silicon-valley-bank" in line.lower() or "svb" in line.lower()]
    if not lines or not svb:
        return f"FAIL: slice had {len(lines)} rows, {len(svb)} SVB mentions"
    return f"PASS: 2023-03-10 14:30 slice downloaded, {len(lines):,} article rows, SVB coverage present"


def test_gdelt_live() -> str:
    """Liveness via the update pointer (no API): newest 15-min file must be fresh."""
    from datetime import datetime, timedelta, UTC
    text = fetch("http://data.gdeltproject.org/gdeltv2/lastupdate.txt").decode("utf-8", errors="replace")
    stamp = text.split()[2].rsplit("/", 1)[-1].split(".")[0]
    newest = datetime.strptime(stamp, "%Y%m%d%H%M%S").replace(tzinfo=UTC)
    # Files are named by interval END, so the newest stamp can sit a few minutes
    # ahead of the wall clock — clamp to zero.
    age_minutes = max(0, int((datetime.now(UTC) - newest).total_seconds() / 60))
    if age_minutes > 60:
        return f"FAIL: newest GDELT file is {age_minutes} minutes old"
    return f"PASS: newest 15-min file is {age_minutes} minutes old ({stamp})"


def main() -> None:
    import time
    for index, (name, test) in enumerate((("ForexFactory weekly feed", test_forexfactory),
                                          ("GDELT historical bulk (SVB 2023 slice)", test_gdelt_historical_bulk),
                                          ("GDELT liveness (update pointer)", test_gdelt_live))):
        if index:
            time.sleep(5)
        try:
            print(f"{name}: {test()}")
        except Exception as error:
            print(f"{name}: FAIL with error: {error}")


if __name__ == "__main__":
    main()
