"""Resumable, polite bulk pull of Nasdaq's (unofficial) economic calendar history.

Coverage: events 2021-01-01 .. 2025-12-31. The endpoint is date-shifted by one
(query date D returns the events OF D-1 — verified against the 2023-03-10 NFP:
311K actual vs 205K consensus appeared under query date 2023-03-11), so this
script queries D+1 and stores under the EVENT date D.

Politeness contract (Mike ratified 2026-07-31; the FF scraper died at 108k
requests/day — we run ~480 per session, one session per day, 4 sessions total):
  - <= MAX_REQUESTS_PER_SESSION per run (default 480)
  - 2.0-3.5 s random spacing, browser headers
  - STOP IMMEDIATELY on 403/429 or 3 consecutive failures — never retry into a ban

Resumable: each event date is saved as data/news/nasdaq_calendar_raw/YYYY-MM-DD.json
(raw response verbatim — normalization happens later, raw is the truth). Existing
files are skipped, so rerunning continues where the last session stopped.

Run (one session): python Backtesting/engine/pull_nasdaq_calendar.py
"""
import json
import random
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "news" / "nasdaq_calendar_raw"
START, END = date(2021, 1, 1), date(2025, 12, 31)
MAX_REQUESTS_PER_SESSION = 480
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nasdaq.com/market-activity/economic-calendar",
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pending = []
    day = START
    while day <= END:
        if not (OUT_DIR / f"{day.isoformat()}.json").exists():
            pending.append(day)
        day += timedelta(days=1)
    total_days = (END - START).days + 1
    print(f"{total_days - len(pending)}/{total_days} event dates already stored; {len(pending)} remaining")
    if not pending:
        print("Pull complete — nothing to do.")
        return

    session = pending[:MAX_REQUESTS_PER_SESSION]
    consecutive_failures = 0
    done = 0
    for event_date in session:
        query_date = event_date + timedelta(days=1)  # endpoint's +1 shift
        url = f"https://api.nasdaq.com/api/calendar/economicevents?date={query_date.isoformat()}"
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status in (403, 429):
                    print(f"STOP: HTTP {response.status} at {event_date} — halting session to avoid a ban.")
                    break
                body = response.read().decode("utf-8", errors="replace")
            payload = json.loads(body)
            (OUT_DIR / f"{event_date.isoformat()}.json").write_text(
                json.dumps({"event_date": event_date.isoformat(), "query_date": query_date.isoformat(),
                            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"), "response": payload}) + "\n",
                encoding="utf-8")
            consecutive_failures = 0
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(session)} this session ({event_date})")
        except urllib.error.HTTPError as error:
            if error.code in (403, 429):
                print(f"STOP: HTTP {error.code} at {event_date} — halting session to avoid a ban.")
                break
            consecutive_failures += 1
            print(f"  fail {event_date}: HTTP {error.code} ({consecutive_failures} consecutive)")
            if consecutive_failures >= 3:
                print("STOP: 3 consecutive failures — halting session.")
                break
        except Exception as error:
            consecutive_failures += 1
            print(f"  fail {event_date}: {str(error)[:120]} ({consecutive_failures} consecutive)")
            if consecutive_failures >= 3:
                print("STOP: 3 consecutive failures — halting session.")
                break
        time.sleep(random.uniform(2.0, 3.5))
    stored = len(list(OUT_DIR.glob("*.json")))
    print(f"Session done: {done} fetched this run; {stored}/{total_days} event dates stored total.")
    if stored < total_days:
        print(f"Run again (tomorrow) for the next session; {total_days - stored} dates remain.")


if __name__ == "__main__":
    main()
