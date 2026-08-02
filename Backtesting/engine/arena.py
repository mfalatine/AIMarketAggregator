"""The arena — replays historical days point-in-time, asks a candidate to predict,
scores the predictions against what actually happened, and logs everything.

Protocol enforcement (docs/CONCEPTS.md):
  - Point-in-time: the candidate sees ONLY information up to the decision moment
    (prior sessions; never the day being predicted).
  - Every run carries a manifest: phase, hypothesis (REQUIRED for 2024/2025 runs),
    declared news sources, event-definition snapshot, provider, dates.
  - 2025 refuses to run unless --final is passed, and warns it burns the test year.

Prediction contract (the candidate must answer JSON):
  {"direction": "up|down|flat", "expansion": "yes|no", "gap": "yes|no", "severity": 0-5}
  direction = next session's close vs open; expansion = will the session qualify as an
  event; gap = will the overnight gap into that session qualify as an event;
  severity = 0-5 vs the settable bands in detection_config.json.

Usage:
  python arena.py --phase 2023 --provider mock-momentum --hypothesis "harness smoke"
  python arena.py --phase 2024 --provider claude --prompt-file prompts/v1.txt \
      --hypothesis "noticed X in 2023, trying Y" [--limit 20] [--sources none]

Output: results/runs/<run_id>/manifest.json, records.jsonl, scores.json — and the
run appears on the Backtest tab via make_summary.py.
"""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd

from ai_bridge import ask
from detect_moves import event_definition, CONFIG_PATH

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
RUNS_DIR = RESULTS_DIR / "runs"
SYMBOL = "MES"  # predictions are graded against the S&P micro; MNQ grading can be added per run later

SOURCE_LOCK_HEADER = """SOURCE LOCK: use ONLY the information in this prompt. The declared sources for
this run are: {sources}. Do not use your own knowledge or memory of what markets
actually did, and do not consult anything else. If the prompt does not contain it,
you do not know it.

"""

DEFAULT_PROMPT = """You are predicting the next regular US equity session (S&P 500 futures).
Today is {date}. You know only information available before this session opens.
Recent sessions (oldest first, open->close % moves): {recent}
Prior session moved {prior:+.2f}%. The overnight gap into today is not yet known to you.

Answer ONLY with JSON, no other text:
{{"direction": "up|down|flat", "expansion": "yes|no", "gap": "yes|no", "severity": 0-5}}
direction: today's session close vs open. expansion: will today's session move exceed
{session_threshold}%. gap: will the overnight gap into today exceed {gap_threshold}%.
severity: size of today's move, 0 (dead) to 5 (extreme)."""


def severity_bands() -> dict:
    return {int(k): v for k, v in json.loads(CONFIG_PATH.read_text(encoding="utf-8"))["severity_bands_pct"].items() if k != "_doc"}


def realized_severity(abs_ret_pct: float) -> int:
    score = 0
    for band, edge in sorted(severity_bands().items()):
        if abs_ret_pct >= edge:
            score = band
    return score


def parse_answer(text: str) -> dict | None:
    match = re.search(r"\{[^{}]*\}", text, re.S)
    if not match:
        return None
    try:
        raw = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    direction = str(raw.get("direction", "")).lower()
    if direction not in ("up", "down", "flat"):
        return None
    return {"direction": direction,
            "expansion": str(raw.get("expansion", "no")).lower() == "yes",
            "gap": str(raw.get("gap", "no")).lower() == "yes",
            "severity": max(0, min(5, int(raw.get("severity", 0))))}


def load_actuals() -> pd.DataFrame:
    moves = pd.read_parquet(RESULTS_DIR / "moves" / f"{SYMBOL.lower()}_moves.parquet")
    moves["date"] = pd.to_datetime(moves["ts_end"]).dt.date
    sessions = moves[moves["kind"] == "session"][["date", "ret_pct", "event"]].rename(
        columns={"ret_pct": "session_ret", "event": "session_event"})
    gaps = moves[moves["kind"] == "overnight_gap"][["date", "ret_pct", "event"]].rename(
        columns={"ret_pct": "gap_ret", "event": "gap_event"})
    return sessions.merge(gaps, on="date", how="left").sort_values("date").reset_index(drop=True)


def run(phase: int, provider: str, hypothesis: str, prompt_template: str,
        sources: str, limit: int | None, final: bool) -> dict:
    if phase == 2025 and not final:
        raise SystemExit("2025 is the SEALED final-test year. Pass --final only for the one frozen run.")
    if phase in (2024, 2025) and not hypothesis.strip():
        raise SystemExit(f"{phase} runs require --hypothesis (docs/CONCEPTS.md section 3).")

    actuals = load_actuals()
    definition = event_definition()
    session_threshold = definition["magnitude"]["spike_thresholds_pct"]["session"]
    gap_threshold = definition["magnitude"]["spike_thresholds_pct"]["overnight_gap"]

    days = actuals[pd.to_datetime(actuals["date"]).dt.year == phase].reset_index(drop=True)
    if limit:
        days = days.head(limit)

    run_id = f"{phase}_{provider}_{datetime.now().strftime('%Y%m%dT%H%M%S')}"
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    records = []
    for i in range(len(days)):
        day = days.iloc[i]
        history = actuals[actuals["date"] < day["date"]].tail(10)
        if history.empty:
            continue
        prior = float(history.iloc[-1]["session_ret"])
        prompt = SOURCE_LOCK_HEADER.format(sources=sources) + prompt_template.format(
            date=day["date"], prior=prior,
            recent=", ".join(f"{value:+.2f}%" for value in history["session_ret"].tail(5)),
            session_threshold=session_threshold, gap_threshold=gap_threshold)
        answer_text = ask(provider, prompt, context={"prior_session_ret_pct": prior})
        prediction = parse_answer(answer_text)
        actual = {"direction": "up" if day["session_ret"] > 0 else "down" if day["session_ret"] < 0 else "flat",
                  "expansion": bool(day["session_event"]),
                  "gap": bool(day["gap_event"]) if pd.notna(day["gap_event"]) else False,
                  "severity": realized_severity(abs(day["session_ret"])),
                  "session_ret": float(day["session_ret"])}
        records.append({"date": str(day["date"]), "prediction": prediction, "actual": actual,
                        "unparseable": prediction is None, "raw_answer": answer_text[:500]})

    graded = [r for r in records if r["prediction"]]
    scores = {
        "days": len(records), "unparseable": sum(r["unparseable"] for r in records),
        "direction_hits": sum(r["prediction"]["direction"] == r["actual"]["direction"] for r in graded),
        "expansion_hits": sum(r["prediction"]["expansion"] == r["actual"]["expansion"] for r in graded),
        "gap_hits": sum(r["prediction"]["gap"] == r["actual"]["gap"] for r in graded),
        "severity_exact": sum(r["prediction"]["severity"] == r["actual"]["severity"] for r in graded),
        "severity_within_1": sum(abs(r["prediction"]["severity"] - r["actual"]["severity"]) <= 1 for r in graded),
    }
    manifest = {"run_id": run_id, "phase": phase, "provider": provider, "hypothesis": hypothesis,
                "declared_sources": sources, "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M CST"),
                "event_definition": definition, "severity_bands_pct": severity_bands(),
                "prompt_template": prompt_template, "graded_symbol": SYMBOL,
                "source_lock_header": SOURCE_LOCK_HEADER.format(sources=sources),
                "cli_isolation": "CLI providers run in an empty temp cwd (no repo access)"}
    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (run_dir / "records.jsonl").write_text("\n".join(json.dumps(r) for r in records) + "\n", encoding="utf-8")
    (run_dir / "scores.json").write_text(json.dumps(scores, indent=2) + "\n", encoding="utf-8")
    print(f"run {run_id}: {scores['days']} days | direction {scores['direction_hits']}/{len(graded)} | "
          f"expansion {scores['expansion_hits']}/{len(graded)} | gap {scores['gap_hits']}/{len(graded)} | "
          f"severity within-1 {scores['severity_within_1']}/{len(graded)}")
    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a scored arena replay.")
    parser.add_argument("--phase", type=int, required=True, choices=(2023, 2024, 2025))
    parser.add_argument("--provider", required=True)
    parser.add_argument("--hypothesis", default="")
    parser.add_argument("--prompt-file", default=None, help="Path to a prompt template; default is the built-in baseline.")
    parser.add_argument("--sources", default="none (price-only)")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--final", action="store_true", help="Required for the single frozen 2025 run.")
    args = parser.parse_args()
    template = Path(args.prompt_file).read_text(encoding="utf-8") if args.prompt_file else DEFAULT_PROMPT
    run(args.phase, args.provider, args.hypothesis, template, args.sources, args.limit, args.final)


if __name__ == "__main__":
    main()
