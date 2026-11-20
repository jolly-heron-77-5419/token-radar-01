# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/jolly-heron-77-5419/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/jolly-heron-77-5419/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth — then hands you a web dashboard with the board, a detail view for each protocol and the steps to farm it.

## How it works

The model (radar-2) scores every rankable pre-token protocol from the snapshot's own figures, in four factors:

- **Category multiple** — the median market-cap-to-TVL ratio of the live (token-trading) protocols in the same category, read off the snapshot itself. A DEX dollar and a lending dollar do not price the same, and the snapshot's own live protocols say by how much.
- **Growth** — 1 + clamp(7-day TVL change, −60%, +120%) × 0.6.
- **Maturity** — 0.7 + min(age, 3 years) / 3 years × 0.5. A protocol tracked for years with no token is further along the road to one.
- **Breadth** — 1 + 0.02 per chain, up to 10 chains.

implied = TVL × category multiple × growth × maturity × breadth

The board covers the whole 40-protocol watchlist plus every other rankable pre-token protocol in the snapshot (198 rows: 40 on the watchlist, 158 early finds below the floor), and sets the 24 largest live-token protocols apart with the market's own values. Every row carries a 7-step farm plan derived from the protocol's own record (category, chains, TVL, age), each step naming what it costs and how long it takes.

The dashboard is a static page with no network: search, category and chain filters, sorting by implied value / TVL / growth / age, a detail view per protocol with the model's factor breakdown and live comparables, and a model sandbox that re-ranks the board live as you move the model's constants.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

Node 22.18 or later, standard library only — nothing to install. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Re-running it on the same snapshot writes the same bytes. Open `out/dashboard/index.html` in a browser (it reads `../data.js` beside it).

## Layout

- `main.ts` — the program: reads the snapshot, builds the board, writes the outputs and the dossier.
- `lib/model.ts` — the model: calibration, implied value, farm plans, snapshot parsing, board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied byte for byte from the competition kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol's detail view and a filtered view.

The implied value is this entry's own claim, never make.fun's: it says what a token would be worth if the protocol's record stayed as it is. It does not predict whether or when a token is issued. A protocol is shown as *recording no token*, never as having none.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d5a50dzy&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
