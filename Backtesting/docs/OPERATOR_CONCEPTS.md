# Operator concepts — Mike's rulings and reasoning (record, do not drift)

These are the concepts Mike laid down for the arena, recorded 2026-07-29 so no future
session re-derives or waters them down. The design doc implements them; this file is
why they exist. When a rule here and convenience collide, this file wins.

## 1. The anti-leakage protocol, per phase (his ruling)

- **2023 (develop):** open book. Development can use known news sources freely —
  generic or specific. Look at anything; this year is for noticing.
- **2024 (tweak):** point-in-time only. At any simulated decision moment the AI may see
  information **up to that minute and nothing after it**. No forward biasing.
- **2025 (final):** absolutely no forward biasing. One frozen run.

## 2. Source lock (his ruling)

If a run uses a single news source, the AI must consider **only that source**. If a set
of sources is provided (more than one can be), only that declared set. Nothing outside
the declared sources may inform the answer — that includes the model's own knowledge of
what happened. Every run manifest must state its declared sources.

## 3. What "tweaking" in 2024 means (his words, paraphrased)

Tweaking is handling known issues — refinement adjustments to the algo or prompts.
2024 may be run **multiple times**, but only in this manner:

> "I noticed this in 2023 — I wonder what happens if I do this" → apply the single
> tweak → run 2024 → look → next tweak when required.

**Single conceptual tests to see results. Not overfitting.** Each 2024 run must be
logged with the hypothesis behind its tweak ("noticed X in 2023, trying Y"), so the
run count and the reasoning stay visible and auditable. Mass parameter sweeps against
2024 are exactly the overfitting this forbids.

## 4. News causality is not "this caused that" (his concept, his example)

News effects arrive through **arms** — indirect chains, possibly several simultaneous:

> CXMT has an IPO announcement → US has a memory shortage → US semiconductors take a
> hit → Nasdaq is affected and drops.

And that is only one arm; others can run at the same time. There may be multiple levels
of effect. Design implication: the event matcher must never assume one news item maps to
one move. Moves can have several contributing arms; a news item can matter only through
its chain. Attribution is recorded as candidate arms with levels, not single causes.

## 5. Web search needs limits (his ruling)

"Up to all web searches" remains an option, but even web search must be limited —
restricted to **known websites** — for one reason above all: **the data needs to be
somewhat repeatable**. News is not an exact science; an unbounded search that returns
different sources every run cannot be tweaked or scored honestly. The web-search
adapter therefore carries a site allowlist, and the allowlist is part of the run
manifest like any other declared source.

## 6. News source selection

Deferred by Mike ("we can discuss this later"). The framework is in place now: embedded
API settings for single news sources, internal interfacing per source, selectable later
by a click. Candidates on the table: Trading Economics, Benzinga, allowlisted web
search. Adding a source means writing one adapter that honors §1, §2, and §5.
