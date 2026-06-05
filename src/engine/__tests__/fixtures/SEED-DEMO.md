# Seed & Determinism Demo

A walkthrough proving requirement (2): **all runs must be deterministic** — the same model, seed, and tick count always produce the same outcome. This is what makes it possible to debug, reproduce bugs, and compare balance changes once a model gets complex.

The seed drives **every** probabilistic decision in the engine: converter output probabilities (e.g. `65%`), dice gates, trigger chances, register `D` (dice) rolls, and random AI picks. Same seed → same random stream → same result, every time.

## Where the seed lives

| Surface        | How to set the seed                                           |
| -------------- | ------------------------------------------------------------- |
| **UI**         | _Run_ tab in the right sidebar → **Seed** field (default `1`) |
| **CLI**        | `--seed N` flag                                               |
| **Engine API** | `runSimulation(elements, { seed: N })`                        |

When no seed is set, the engine falls back to `Math.random()` (non-deterministic). The UI always passes a seed, so UI runs are deterministic by default.

## Running headlessly

From the repo root:

```powershell
npx tsx src/engine/cli.ts <path-to-xml> --seed <N> --max-ticks <N> --format summary
```

Or via the npm script. On Windows PowerShell, npm only forwards `--flag=value` form (the CLI reads them back from `npm_config_*`):

```powershell
npm run sim --silent -- <path-to-xml> --seed=<N> --max-ticks=<N>
```

The summary line echoes the seed so every result is self-documenting: `Simulation finished: ticksRun=2000 gameEnded=false seed=42`.

---

## Demo model — `space_example1.xml`

```
[mine] --20/tick--> [minerals] --100--> [build] --65%--> [planets]
                         |                                   |
                         +--1*10--> [shipyards] <--+10 state--+
[minerals] --25--> [explore] ... --> [ships]
```

The `build` converter routes its output to `planets` only **65% of the time**. That single probabilistic edge is enough to make an unseeded run differ every time — and a seeded run identical every time.

> The `build` / `explore` converters must be **automatic** for the `65%` path to fire headlessly. If they are interactive, no random draws occur and the seed has nothing to influence.

### Property 1 — Reproducible (same seed → same outcome)

Run seed `42` twice. The numbers are byte-for-byte identical.

```
$ npm run sim --silent -- "machinations_examples/official examples/examples/space_example1.xml" --seed=42 --max-ticks=2000
Simulation finished: ticksRun=2000 gameEnded=false seed=42

Final state:
  Pool#0  "minerals"  = 0
  Pool#2  "ships"     = 15 (Black:15)
  Pool#10 "planets"   = 8 (Black:8)
  Pool#16 "shipyards" = 1926 (Black:1926)

$ ... --seed=42 --max-ticks=2000      # run again
  Pool#2  "ships"     = 15 (Black:15)     # identical
  Pool#16 "shipyards" = 1926 (Black:1926) # identical
```

### Property 2 — Seed-sensitive (different seed → different outcome)

Switch to seed `7`. The probabilistic `65%` draws resolve differently, so the totals shift.

```
$ ... --seed=7 --max-ticks=2000
Simulation finished: ticksRun=2000 gameEnded=false seed=7

Final state:
  Pool#0  "minerals"  = 0
  Pool#2  "ships"     = 9 (Black:9)        # was 15 with seed 42
  Pool#10 "planets"   = 8 (Black:8)
  Pool#16 "shipyards" = 1927 (Black:1927)  # was 1926 with seed 42
```

| Seed | minerals | ships | planets | shipyards |
| ---- | -------- | ----- | ------- | --------- |
| 42   | 0        | 15    | 8       | 1926      |
| 7    | 0        | 9     | 8       | 1927      |
| 42   | 0        | 15    | 8       | 1926      |

**Talking point:** "Seed 42 gives the exact same result every single run, so I can reproduce a bug or re-verify a balance tweak. Change the seed and I get a different — but equally repeatable — playthrough. That's the difference between 'it works on my machine' and a result anyone on the team can reproduce."

---

## Comparing balance changes

Because runs are reproducible, you can isolate the effect of a model change instead of chasing RNG noise:

1. Run the model at a fixed seed, record the totals.
2. Make a balance change (e.g. `65%` → `80%`).
3. Re-run at the **same** seed. Any difference in the output is caused by your change, not by luck.

For statistics across many playthroughs, vary the seed (e.g. `1..100`) — each seed is an independent, reproducible run, which is exactly what the `numberOfRuns` / Multiple Runs feature consumes.

---

## How it works (one generator)

All randomness flows through a single seeded PRNG (`src/engine/rng.ts`, mulberry32). `runSimulation` calls `setSeed(seed)` before the run, so the random stream restarts from the seed each time. The UI does the same at the start of every Run / Quick Run / Multiple Runs.

Covered by tests:

- `src/engine/__tests__/rng.test.ts` — the generator: deterministic sequence, reseed, bounds, `Math.random` fallback.
- `src/engine/__tests__/runner.test.ts` — a probabilistic model: same seed → identical `finalState`, different seeds → different outcomes, reproducible even after other seeds run in between.
