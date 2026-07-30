# Arena concepts — the rules and reasoning (record, do not drift)

The concept record for the arena, started 2026-07-29. Concepts land here from either
direction — Mike's rulings or AI-contributed concepts (most will be AI-contributed
unless Mike has tweaks himself — his clarification 2026-07-29). Each entry says where
it came from. When a rule here and convenience collide, this file wins.

## 1. The anti-leakage protocol, per phase (Mike's ruling)

- **2023 (develop):** open book. Development can use known news sources freely —
  generic or specific. Look at anything; this year is for noticing.
- **2024 (tweak):** point-in-time only. At any simulated decision moment the AI may see
  information **up to that minute and nothing after it**. No forward biasing.
- **2025 (final):** absolutely no forward biasing. One frozen run.

## 2. Source lock (Mike's ruling)

If a run uses a single news source, the AI must consider **only that source**. If a set
of sources is provided (more than one can be), only that declared set. Nothing outside
the declared sources may inform the answer — that includes the model's own knowledge of
what happened. Every run manifest must state its declared sources.

## 3. What "tweaking" in 2024 means (Mike's words, paraphrased)

Tweaking is handling known issues — refinement adjustments to the algo or prompts.
2024 may be run **multiple times**, but only in this manner:

> "I noticed this in 2023 — I wonder what happens if I do this" → apply the single
> tweak → run 2024 → look → next tweak when required.

**Single conceptual tests to see results. Not overfitting.** Each 2024 run must be
logged with the hypothesis behind its tweak ("noticed X in 2023, trying Y"), so the
run count and the reasoning stay visible and auditable. Mass parameter sweeps against
2024 are exactly the overfitting this forbids. (The logging requirement is
AI-contributed; the tweak discipline is Mike's.)

## 4. News causality: direct AND arms (Mike's concept, his example and correction)

Some news is **direct**: the Fed speaking is direct; earnings can be direct — though
they do not need to be. Other news acts through **arms** — indirect chains, possibly
several simultaneous:

> CXMT has an IPO announcement → US has a memory shortage → US semiconductors take a
> hit → Nasdaq is affected and drops.

And that is only one arm; others can run at the same time. There may be multiple levels
of effect. Design implication: the event matcher supports both. It may record a direct
one-to-one attribution when the link is direct, and candidate contributing arms with
levels when it is not — it must never *force* everything into a single-cause shape, and
must never *forbid* direct attribution either.

## 5. Web search limiters (Mike's concept)

Web search can be general, but with **limiters**: a list of sites that can be turned
**on or off individually**. Repeatability is the reason — news is not an exact science,
and the site list is really the only control we have over what a search returns. At the
same time, **leave it open to see differences**: an unrestricted comparison mode exists
so we can measure what limiting actually changes. Scored runs declare their exact
limiter configuration (which sites were on) in the run manifest; unrestricted runs are
labeled as comparison runs, not scored runs.

## 6. News source selection

Deferred by Mike ("we can discuss this later"). The framework is in place: embedded
API settings for single news sources, internal interfacing per source, selectable later
by a click. Candidates on the table: Trading Economics, Benzinga, limited web search.
Adding a source means writing one adapter that honors §1, §2, and §5.
