# Price data — provenance and schema

Two Parquet files copied 2026-07-29, byte-identical (SHA-256 verified) from the ASDSAI
minute-bar cache at
`HYDRA\ASDSAI\asds\results\cache\minute_bars\`:

| File | Instrument | Rows |
|------|-----------|------|
| `mes_continuous_2021-01-01_2025-12-31.parquet` | Micro E-mini S&P 500 (MES) | 1,767,965 |
| `mnq_continuous_2021-01-01_2025-12-31.parquet` | Micro E-mini Nasdaq-100 (MNQ) | 1,768,695 |

- Columns: `datetime, symbol, o, h, l, c, v` (open/high/low/close/volume).
- **All timestamps CST, tz-naive** (house rule: ET = CST + 1 hour).
- 1-minute bars, continuous series (contract rolls already stitched upstream).
- Range: 2021-01-03 17:00 → 2025-12-31 15:59. Trading days include overnight Globex,
  starting 17:00 CST the prior calendar day. Regular hours are 08:30–14:59 CST.
- Ultimate origin: Databento GLBX.MDP3 1-second data, aggregated to 1 minute in the
  HYDRA pipeline. 1 minute is the finest granularity that exists for this window.

Treat these files as **read-only inputs**. Load via `engine/load_prices.py`.
