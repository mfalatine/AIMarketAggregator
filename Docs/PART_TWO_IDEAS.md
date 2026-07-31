# Part Two — captured ideas (Mike, 2026-07-31: "capture all the ideas for part two")

Secondary to Part One (the arena/news work in Backtesting/). Nothing here is decided;
these are the recorded springboards for when Part One is done.

## 1. Calendar / FF-scraper retrofit
Six architecture options + the reference-plate ruling live in
[FUTUREFeature_ForexScrapperConnection.md](FUTUREFeature_ForexScrapperConnection.md).
Option 6 (fold into AMA as a Calendar tab) is Mike's lean. A full working copy of the
scraper is in `Reference/ForexFactoryScraper/` for mining.

## 2. The local-only springboard
The calendar/live-polling asymmetry (only a machine that runs a puller has fresh
actuals) may argue that **AMA becomes local-only**: the customer gets an exe plus
accompanying files — bundled history parquet and other components — instead of a
Netlify deployment. Not decided; it would supersede the parity rule's two-app model.

## 3. The virtual desktop as the single home
Mike's idea (not fleshed out, his words): everything — app, pullers, history, arena —
lives on one cloud virtual desktop; single point of contact; history updates when it
is turned on; most likely a single user at a time, workarounds exist if not.

What already exists for this:
- **VirtualDesktop1** — a Kamatera VDI already on Mike's account
  (the account is down to this one server).
- **KamateraShutDown** (`C:\Users\micha\source\repos\KamateraShutDown`) — Mike's own
  scheduler app (Python GUI + built exe): powers the VDI on/off on a daily clock,
  auto-launches/kills RDP, weekend blackout, eSignal single-license guard. This IS
  the cost control for "expensive if always on."
- The wake→catch-up→serve→sleep pattern matches the resumable pullers built in Part
  One (designed to backfill after downtime).

Open items when this wakes:
- The decide-first test: does Nasdaq's bot-wall accept the Kamatera datacenter IP?
  (Five minutes, run from VirtualDesktop1.)
- Known flags, Mike aware, deliberately unaddressed for now: the scheduler's saved
  config is enabled with a leftover 13:31→13:32 test window (would bounce the server
  if launched as-is), and the scheduler repo has ~430 uncommitted lines from May 8.

## 4. Common components (build once, both parts share)
Calendar schema + two-timestamp point-in-time contract, the pulled Nasdaq archive and
polite resumable puller, the impact mapping (event name → tier), key-gate/protected-
key patterns, and the per-deployment setup story (his local / packaged exe / cloud).
