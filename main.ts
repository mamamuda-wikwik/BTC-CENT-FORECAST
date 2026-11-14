// btc-cent-forecast-01 entry (Node 22, standard library only).
//
// Model: persistence with a small short-horizon mean-reversion fade.
//   guess = last * (1 - 0.15 * r15)
// where r15 = ln(last / close 15 minutes before the checkpoint).
// The last 15 minutes' move partially reverses over the next 4 hours:
// the fade beat persistence in backtests on 158 Coinbase BTC-USD 1-minute
// cases (Oct 16 - Nov 14 2026, +0.14% MAE, positive in every quarter) and
// on 23 cases reconstructed from the competition's own Orca pool recording
// (Nov 7 - Nov 11 2026, +2.25% MAE), while staying nearly neutral on the
// six sealed practice cases (-0.34% MAE). Momentum, 72h trend and
// mean-reversion to the 72h mean all LOST to persistence on the same data,
// so the fade is kept deliberately small (0.15): it is a microstructure
// correction, not a trend bet. See README.md for the full backtest table.
//
// IO contract (same as the kit's starter): read every <id>.in in the input
// directory (MAKEFUN_INPUT_DIR or /input), in name order, and write
// <id>.out to the output directory (MAKEFUN_OUTPUT_DIR or /output):
// {"forecasts":[{"case":"<id>","price":<number>}]}. Deterministic, no
// randomness, no network, runs in milliseconds per case.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** How much of the last 15 minutes' log-move to fade (backtested, see README). */
const FADE_BETA = 0.15;
/** Minutes of recent move to fade. */
const FADE_WINDOW_MINUTES = 15;
/**
 * Safety rail: the fade never moves the guess by more than 0.5% of the
 * price. The largest 15-minute move in any backtest case (158 Coinbase
 * cases, 23 Orca cases) shifted the guess by 0.31%, so the cap never binds
 * on ordinary data — it only guards against a flash move in the last
 * 15 minutes dragging the forecast with it.
 */
const FADE_CAP = 0.005;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/**
 * Forecast for one market: the checkpoint close, faded by 15% of the
 * last-15-minutes log-move. If the case holds fewer than 16 prices the
 * fade cannot be measured and the guess is plain persistence.
 */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const last = m.prices[m.prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  if (m.prices.length <= FADE_WINDOW_MINUTES) return price5(last);
  const anchor = m.prices[m.prices.length - 1 - FADE_WINDOW_MINUTES] as number;
  if (typeof anchor !== 'number' || !Number.isFinite(anchor) || anchor <= 0) return price5(last);
  const r15 = Math.log(last / anchor);
  const fade = Math.max(-FADE_CAP, Math.min(FADE_CAP, FADE_BETA * r15));
  return price5(last * (1 - fade));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
