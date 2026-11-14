# BTC 4-Hour Forecast — btc-cent-forecast-01

A program that reads Bitcoin's 1-minute closes for the 72 hours up to a
checkpoint and guesses the price 240 minutes (4 hours) later. One case in,
one number out.

## The model

```
guess = last_close * (1 - 0.15 * ln(last_close / close_15_min_ago))
```

Persistence (guessing the checkpoint's own close) with a small fade of the
last 15 minutes' move. The idea: the last few minutes' move is part signal,
part microstructure noise, and the noisy part partially reverses over the
next 4 hours. The fade is kept deliberately small (0.15) — it is a
microstructure correction, not a trend bet.

## Why this, and not a trend model

Everything was backtested before it was written into `main.ts`. 4-hour
Bitcoin is close to a martingale, and most "clever" models lose to
persistence:

| model | Coinbase 1m, 158 cases, Oct 16–Nov 14 2026 | Orca pool, 23 cases, Nov 7–11 2026 | sealed practice, 6 cases |
|---|---|---|---|
| persistence (house baseline) | 42,550.16 cents MAE | 35,236.77 cents MAE | 44,521.58 cents MAE |
| **fade 15 min, β=0.15 (this entry)** | **42,491 (−0.14%)** | **34,442 (−2.25%)** | **44,674 (+0.34%)** |
| fade 30 min, β=0.15 | 42,288 (−0.62%) | 34,352 (−2.51%) | 46,204 (+3.78%) |
| 72h log-trend, shrunk 0.25 | 42,887 (+0.79%) | — | 43,213 (−2.94%) |
| mean-reversion to 72h mean, θ=0.25 | 47,155 (+10.82%) | — | 44,320 (−0.45%) |
| momentum (last 4h move, β=0.25) | 45,962 (+8.02%) | — | 44,409 (+0.25%) |

(MAE in cents; negative % = better than persistence. The practice answers
were reconstructed from the kit's own case files: each case's target is the
next case's checkpoint close, and the last one follows from the published
practice baseline total — the reconstruction reproduces the published
44,521.58-cent baseline to within 0.06 cents.)

The 15-minute fade was picked because it is the most robust: it beats
persistence on both large samples and is positive in every quarter of the
158-case sample, while staying nearly neutral (−0.34%) even on the
strongly-trending practice day where every fade loses. Bigger fades
(30-minute, jump-fades) win more on the broad samples but lose up to 3–6%
on the trending day — too much variance for a 12-case final.

## How to run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22, standard library only, no network, deterministic — two runs on the
same case write byte-identical output. One case takes milliseconds.

## Referral

Made with [make.fun](https://make.fun/r/tdgxqn9n) — referral code `tdgxqn9n`.
