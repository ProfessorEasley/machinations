# CEO Demo — Full Workflow (One File)

**Demo file:** `src/engine/__tests__/fixtures/probabilistic-race.xml`

Use this single graph for the entire walkthrough — UI (Normal → Quick → Multiple) and CLI (Quick → Multiple). Both paths share the same engine; numbers match when you use the same seed.

---

## What the graph models

```
[Coin] --1/tick--> [Feeder] --all--> [Gate 50/50]
                                        ├─► [Heads] -->=5--> [Heads Win]
                                        └─► [Tails] -->=5--> [Tails Win]
```

A coin source feeds a feeder pool. Each tick, the gate pulls everything and splits it 50/50 between **Heads** and **Tails**. Whichever pool reaches **5 first** triggers its end condition and ends the run. The winner is random per run, but **fully reproducible** with a seed.

**Why this one file works for every demo step:**

| Step              | What you show                                       |
| ----------------- | --------------------------------------------------- |
| Normal Run        | Animated tokens, gate splitting, race to 5          |
| Quick Run         | Instant finish + modal with winner and elapsed time |
| Multiple Runs     | Outcome distribution (~50/50 over 100 runs)         |
| CLI quick run     | Same single-run outcome as Quick Run                |
| CLI multiple runs | Same aggregate report as Multiple Runs              |

---

## Before the meeting (~5 min)

### 1. Start the app

```powershell
cd e:\machinations
npm install          # skip if already done
npm run dev
```

Browser opens to the Playground editor.

### 2. Open a terminal for CLI

Keep it visible beside the browser for Part 2.

### 3. Load the demo file

**Option A — drag and drop:** drag `probabilistic-race.xml` onto the canvas.

**Option B — File tab:** sidebar → **File** → **Import** (or **Open**) → select:

```
src/engine/__tests__/fixtures/probabilistic-race.xml
```

You should see: Coin → Feeder → Gate → Heads / Tails → two end conditions.

### 4. Set seed (important for CLI parity)

Sidebar → **Run** tab → set **Seed** to `42`.

Leave **Runs** at `100` for later. Click **Reset** if a prior run left the board frozen.

---

## Part 1 — UI (~8 min)

### Step 1 — Normal Run (animated)

|              |                                                              |
| ------------ | ------------------------------------------------------------ |
| **Where**    | Top bar → **▶ Run**                                         |
| **Duration** | ~8–10 seconds (1 tick per second)                            |
| **Reset**    | Top bar **■ Stop** or sidebar **Reset** before the next step |

**What to say:**

> "Designers build the economy as a diagram — sources, pools, gates, win conditions. Hit Run and watch it play out tick by tick."

**What to point at:**

- Feeder counter climbing each tick
- Gate splitting traffic to Heads (green) and Tails (red)
- Run ending when one pool hits 5 — canvas freezes on the winner

**Note:** The top bar shows **Run (R)** but the keyboard shortcut is not wired — click the button.

---

### Step 2 — Quick Run (instant result)

|                  |                                              |
| ---------------- | -------------------------------------------- |
| **Where**        | Sidebar → **Run** tab → **Quick Run**        |
| **Prerequisite** | Board not frozen — click **Reset** if needed |
| **Seed**         | `42` (already set)                           |

**What to say:**

> "Same model, no waiting — Quick Run fast-forwards to the end state."

**What happens:**

- Simulation batches ticks in the background (~100 per frame)
- A modal appears: **Run complete** with **Time** and **Result** (e.g. `Heads Win` or `Tails Win`)
- Click **OK** to dismiss

**With seed 42**, CLI will report the same winner (see Part 2).

---

### Step 3 — Multiple Runs (balance analysis)

|              |                         |
| ------------ | ----------------------- |
| **Where**    | Sidebar → **Run** tab   |
| **Settings** | Runs: `100`, Seed: `42` |
| **Action**   | **Multiple Runs**       |

**What to say:**

> "Game balance is probabilistic — we need hundreds of runs, not one lucky roll. Same seed gives the same distribution every time."

**What to point at:**

- Progress bar (`42/100`, etc.)
- Live outcome tally while running
- Final **Results** table: outcome name, count, %, average steps

**Expected result (seed 42, 100 runs):**

| Outcome   | ~%   |
| --------- | ---- |
| Tails Win | ~56% |
| Heads Win | ~44% |

Average steps: ~8.7

Optional: **Pause** / **Resume** / **Cancel** if you want to show control mid-batch.

Click **Reset** when done before switching to CLI.

---

## Part 2 — CLI (~5 min)

Use `npx tsx` so flags pass through correctly on Windows (prefer this over `npm run sim --` with space-separated flags).

All commands run from the repo root:

```powershell
cd e:\machinations
```

### Step 4 — CLI quick run (single run)

```powershell
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --seed 42 --format summary
```

**Expected output (seed 42):**

```
Simulation finished: ticksRun=9 gameEnded=true seed=42
Outcome: Tails Win

Final state:
  Pool#2 "Feeder" = 1
  Pool#6 "Heads" = 3
  Pool#7 "Tails" = 5
```

**What to say:**

> "The UI Quick Run modal and this terminal output are the same simulation — one XML, two execution paths."

JSON variant (optional):

```powershell
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --seed 42 --format json
```

---

### Step 5 — CLI multiple runs (batch report)

```powershell
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42 --format summary
```

**Expected output (seed 42):**

```
Multiple runs: 100 seed=42
Average steps: 8.69

Outcomes:
  Outcome                          #        %
  Tails Win                           56     56.0
  Heads Win                           44     44.0
```

**What to say:**

> "This is what CI runs overnight — thousands of balance checks, reproducible, no UI required."

JSON variant (optional):

```powershell
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42 --format json
```

---

## Closing line

> **One diagram. Three ways to run it in the browser. The same engine on the command line. Identical math — UI for stakeholders, CLI for automation.**

---

## Quick reference

| Mode          | UI location                 | CLI equivalent                                            |
| ------------- | --------------------------- | --------------------------------------------------------- |
| Normal Run    | Top bar **▶ Run**          | _(no direct equivalent — use Quick Run or `--max-ticks`)_ |
| Quick Run     | Run tab → **Quick Run**     | `--seed 42` (default `--runs 1`)                          |
| Multiple Runs | Run tab → **Multiple Runs** | `--runs 100 --seed 42`                                    |

### CLI flags (this demo)

| Flag               | Value   | Purpose                                                 |
| ------------------ | ------- | ------------------------------------------------------- |
| `--seed 42`        | 42      | Same outcomes as UI; run _i_ in a batch uses `seed + i` |
| `--runs 100`       | 100     | Multiple-runs aggregate report                          |
| `--format summary` | summary | Human-readable (default)                                |
| `--format json`    | json    | Machine-readable for pipelines                          |

Full CLI docs: [`src/engine/CLI.md`](src/engine/CLI.md)

---

## Troubleshooting

| Problem                    | Fix                                                    |
| -------------------------- | ------------------------------------------------------ |
| Canvas frozen after a run  | Sidebar → **Reset**                                    |
| CLI flags ignored via npm  | Use `npx tsx src/engine/cli.ts ...` or `--flag=value`  |
| UI and CLI outcomes differ | Confirm **Seed** is `42` in the Run tab before UI runs |
| Run tab buttons disabled   | Another simulation is active — **Reset** first         |
| Dev server won't start     | `npm install` then `npm run dev`                       |
| Import fails               | Use the path above; file must be valid XML             |

---

## Timing cheat sheet

| Section               | Time        |
| --------------------- | ----------- |
| Setup + load file     | 3 min       |
| UI: Normal Run        | 2 min       |
| UI: Quick Run         | 1 min       |
| UI: Multiple Runs     | 2 min       |
| CLI: quick + multiple | 3 min       |
| Q&A buffer            | 4 min       |
| **Total**             | **~15 min** |

---

## Pre-flight checklist

- [ ] `npm run dev` running
- [ ] `probabilistic-race.xml` loaded on canvas
- [ ] Run tab **Seed** set to `42`
- [ ] Terminal open at repo root
- [ ] Both CLI commands tested once (see Steps 4–5)
- [ ] Browser DevTools closed (avoids console noise)
- [ ] Projector / screen layout checked (browser + terminal side by side)
