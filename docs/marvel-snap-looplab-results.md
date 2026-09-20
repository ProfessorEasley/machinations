# Marvel Snap Economy Model — Looplab

## Purpose

This model represents a simplified Marvel Snap progression loop across 150 player sessions. It connects session rewards, match outcomes, cube movement, card upgrades, Collection Level rewards, card acquisition, and Wild Boosters.

The model is implemented in Looplab's native XML format at:

`public/examples/marvel-snap-looplab.xml`

## Systems included

- Sessions: one session is started each tick and the run ends at 150 sessions.
- Matches: each completed session creates five match attempts.
- Results: each match has a 55% win chance and a 45% loss chance.
- Cubes: wins add a random 1–6 Cubes; losses request a random 1–6 Cube reduction.
- Income: each session gives 100 Credits and 18 Boosters.
- Wild Boosters: each match has a 10% chance to add 6 extra Boosters.
- Card upgrades: Common through Infinity upgrades use the modeled Marvel Snap Credit costs, Booster costs, and Collection Level gains.
- Collection rewards: every 120 Collection Levels gives 3,000 Tokens, 1,000 Credits, and 100 Boosters.
- Card supply: every 50 Collection Levels unlocks one Common Card, and 3,000 Tokens buys one Common Card.
- Charts: Credits/Tokens, Booster stock, collection progression, match results/Cubes, and Wild Booster outcomes.

## Looplab migration changes

The economy rules are unchanged, but several event paths were rewritten for Looplab's engine:

- Match and Wild Booster gates now pull from explicit attempt pools.
- Legacy `\\\*` trigger chains were replaced with direct converter outputs.
- Collection Level cache rewards are emitted directly by the claim converter.
- Random Cube gains and losses use Looplab's supported `1-6` connection range.

These changes preserve the intended system while avoiding legacy Flash trigger behavior that does not map directly to Looplab.

## Model assumptions

- Starting state: 500 Credits, 12 Common Cards, and 0 Cubes.
- Run length: 150 sessions. The End Condition is reached when Sessions Played equals 150.
- Completed gameplay: 149 completed sessions × 5 matches = 745 resolved matches. The 150th session starts on the ending tick, so its five match attempts are not resolved.
- Win/loss probability: 55% / 45%.
- Cube result: random 1–6 gain or loss. This approximates snapping and retreating.
- Booster stock is pooled rather than assigned to individual cards.
- Card choice and upgrade priority are automatic.
- Collection rewards and Token purchases are simplified model assumptions.

## Ten-run results

Command:

```bash
npm run sim:marvel-snap -- --runs 10 --seed 42
```

| Run | Seed | Matches | Wins-Losses | Win % | Credits | Boosters |  CL | Cubes | Wild % | Cards | Caches |
| --: | ---: | ------: | ----------: | ----: | ------: | -------: | --: | ----: | -----: | ----: | -----: |
|   1 |   42 |     745 |     412-333 |  55.3 |      75 |    1,669 | 359 |   346 |   12.6 |    21 |      2 |
|   2 |   43 |     745 |     419-326 |  56.2 |      75 |    1,495 | 359 |   322 |    8.7 |    21 |      2 |
|   3 |   44 |     745 |     428-317 |  57.4 |      75 |    1,585 | 359 |   409 |   10.7 |    21 |      2 |
|   4 |   45 |     745 |     429-316 |  57.6 |      75 |    1,525 | 359 |   424 |    9.4 |    21 |      2 |
|   5 |   46 |     745 |     402-343 |  54.0 |      75 |    1,543 | 359 |   181 |    9.8 |    21 |      2 |
|   6 |   47 |     745 |     423-322 |  56.8 |      75 |    1,549 | 359 |   364 |    9.9 |    21 |      2 |
|   7 |   48 |     745 |     435-310 |  58.4 |      75 |    1,627 | 359 |   421 |   11.7 |    21 |      2 |
|   8 |   49 |     745 |     408-337 |  54.8 |      75 |    1,513 | 359 |   296 |    9.1 |    21 |      2 |
|   9 |   50 |     745 |     411-334 |  55.2 |      75 |    1,489 | 359 |   270 |    8.6 |    21 |      2 |
|  10 |   51 |     745 |     408-337 |  54.8 |      75 |    1,567 | 359 |   304 |   10.3 |    21 |      2 |

### Result summary

- All 10 runs reached the End of Run condition at 150 sessions.
- Every run resolved 745 matches.
- Average win rate: 56.0%.
- Average Wild Booster rate: 10.1%.
- Final Credits: 75 in every run.
- Final Boosters: 1,556 average; range 1,489–1,669.
- Collection Level: 359 in every run.
- Final Cubes: 334 average; range 181–424.
- Cards owned: 21 in every run.
- Collection Level caches claimed: 2 in every run.

## Analysis

Credits are the main progression bottleneck. Each run ends with only 75 Credits, while more than 1,400 Boosters remain. Match volume produces enough Boosters to support more upgrades, but the player cannot spend them without additional Credits.

Collection Level and card ownership are stable across runs because the economy path is mostly deterministic. Match randomness changes the win/loss total, Cube balance, and Wild Booster amount, but those changes do not materially alter upgrade progress because Boosters are already above the amount the Credit supply can spend.

Cube results show the largest spread. Final Cubes range from 181 to 424 because both match results and Cube stakes are random. This demonstrates that the repeated runs are genuinely different even though Collection Level stays stable.

The observed averages support the probability settings. The 56.0% average win rate is close to the modeled 55%, and the 10.1% Wild Booster rate is close to the modeled 10%.

The main design implication is that increasing match frequency alone does not meaningfully increase card progression once Boosters stop being scarce. More Credits, cheaper upgrades, or a different Credit reward curve would have a larger effect on Collection Level than adding more Booster rewards.

## What I learned

Porting the model showed that matching the visible diagram is not enough; event timing, gate inputs, and feedback paths must also match the simulation engine. Rebuilding the legacy triggers as explicit Looplab pools and converters made the model easier to test, reproduce, and explain.

\## Screenshots and report

\### Final Looplab model

!\[Final Marvel Snap Looplab model](marvel-snap/images/model-overview.png)

\### Quick Run results

!\[Quick Run results](marvel-snap/images/quick-run-results.png)

\### Multiple Run results

!\[Multiple Runs result 1](marvel-snap/images/multiple-runs-01.png)

!\[Multiple Runs result 2](marvel-snap/images/multiple-runs-02.png)

!\[Multiple Runs result 3](marvel-snap/images/multiple-runs-03.png)

\### Detailed report

\[Download the complete PDF report](marvel-snap/Marvel_Snap_Looplab_Model_Report_Kaushiki_Joshi.pdf)

##

## Run and verify

```bash
npm install
npm run sim:marvel-snap -- --runs 10 --seed 42
npm test -- --run src/engine/\\\_\\\_tests\\\_\\\_/marvel-snap-model.test.ts
npm run build
```

To view the model in Looplab:

1. Run `npm run dev`.
2. Open Looplab in the browser.
3. Import or drag in `public/examples/marvel-snap-looplab.xml`.
4. Use Quick Run for one simulation or Multiple Runs for repeated simulations.
