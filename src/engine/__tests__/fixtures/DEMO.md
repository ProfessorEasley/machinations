# Demo XML Scenarios

Three small graphs intended for a CEO walkthrough. Each XML is loadable in the **UI** (drag-and-drop or XML import) **and** runnable headlessly via the **CLI** — both paths share the same engine and produce identical numbers.

## Files

| File                       | Story                                       | Highlights                                          |
| -------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `demo-resource-engine.xml` | Gold Mine fills Treasury, Upkeep drains it  | Net flow, starting balance, basic Source/Pool/Drain |
| `demo-production-line.xml` | Materials → Build Queue (Delay) → Inventory | Delay holds batches for 3 ticks before release      |
| `demo-win-condition.xml`   | Score reaches 50 → Victory                  | End Condition stops the run automatically           |

## Running headlessly

From the repo root:

```powershell
npx tsx src/engine/cli.ts <path-to-xml> --max-ticks <N> --format summary
# or --format json for machine-readable output
```

> Use `npx tsx ...` (not `npm run sim --`) so flags pass through correctly.

## Loading in the UI

1. `npm run dev`
2. In the editor, use the XML import / file picker to load the chosen `demo-*.xml`.
3. Click **Run** and watch the on-canvas counts — they will match the headless numbers below.

---

## Demo 1 — Resource Engine

```
[Gold Mine] --10/tick-> [Treasury (start 50)] --3/tick-> [Upkeep]
```

Every tick: +10 from the mine, -3 to upkeep, **net +7**.

**Verified headless output** (drain pulls 3/tick → net +7/tick on top of starting 50)

```
$ npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/demo-resource-engine.xml --max-ticks 1 --format summary
  Pool#2 "Treasury" = 57

$ ... --max-ticks 5
  Pool#2 "Treasury" = 85

$ ... --max-ticks 10
  Pool#2 "Treasury" = 120
```

**Talking point:** "The same XML on the canvas shows the Treasury counter ticking up to 120. Headless gives you the exact same number — no UI required. And the +7/tick (not +10) proves the drain is doing its job."

---

## Demo 2 — Production Line

```
[Materials] --10/tick-> [Build Queue (delay=3)] --all-> [Inventory]
```

The Delay holds each arriving batch for 3 ticks before releasing it. Early in the run, **Inventory stays at 0** while batches accumulate inside the queue. Once the first batch matures, Inventory starts climbing.

**Verified headless output**

```
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/demo-production-line.xml --max-ticks 1 --format summary
$ ... --max-ticks 2
  Pool#3 "Inventory" = 0          # batches still in the queue

$ ... --max-ticks 4
  Pool#3 "Inventory" = 10         # first batch released

$ ... --max-ticks 8
  Pool#3 "Inventory" = 50         # steady-state release
```

**Talking point:** “Notice Inventory is empty for the first few ticks, then jumps. That delay is exactly what production lines, build orders, or research timers look like in real systems.”

---

## Demo 3 — Win Condition

```
[Score Source] --5/tick-> [Score]  ===>=50===>  [Victory]
```

A State Connection feeds the Score into an End Condition with the threshold `>= 50`. As soon as Score hits 50, the run terminates — `gameEnded` becomes `true`.

**Verified headless output**

```
$ npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/demo-win-condition.xml --max-ticks 50 --format summary
Simulation finished: ticksRun=10 gameEnded=true

Final state:
  Pool#2 "Score" = 50 (#228B22:50)
```

Even though we asked for `--max-ticks 50`, the run stopped at tick 10 because the win condition fired.

**Talking point:** “We don’t need to babysit the simulator. The graph itself encodes the win condition; the engine stops the moment it’s met. CI can run a thousand of these in under a second.”

---

## Demo flow (suggested)

1. **Open `demo-resource-engine.xml` in the UI** — show the live counter, then run the same file headlessly to prove the numbers match.
2. **Open `demo-production-line.xml`** — point out the Delay pattern, then show the headless tick-by-tick progression (0 → 10 → 50).
3. **Open `demo-win-condition.xml`** — let the run finish on its own; show the headless `gameEnded=true` and `ticksRun=10`.

The whole story: _one XML, two execution paths, identical results — UI for stakeholders, CLI for automation._
