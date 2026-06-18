# Multiple Runs

Runs a diagram many times in a row and reports the aggregate outcome. Since
simulations involve randomness (dice, chance gates), a single run isn't
representative — batching N runs surfaces the actual distribution: which end
condition triggers most often and the average number of ticks per run.

The batch runs headlessly (no per-tick animation). While it runs you get a live
progress bar and a counter; you can pause, resume, or cancel. On completion it
renders a results table grouping outcomes by end condition with counts, percentages,
and average ticks.

**How it's wired:**

- `Canvas.tsx` — drives the batch loop, records a `RunOutcome` per run, dispatches a `multiple-runs-progress` event after each run, and calls `onMultipleRunsComplete` at the end. Pause/resume is handled with a flag checked between runs.
- `Playground.tsx` — owns the state, listens for the progress event, and wires Canvas to the sidebar.
- `ToolSideBar.tsx` — renders the progress bar, pause/resume/cancel controls, and the final results table.

## Running and testing

```bash
npm install        # first-time setup
npm run dev        # start the dev server, open the printed URL
npm test           # run the test suite
npx tsc --noEmit   # type-check
```

Manual test:

1. Open a sample from `public/examples/` (e.g. `endcondition.xml`).
2. Go to the **Run** tab → **Multiple Runs**, set a run count, start it.
3. Confirm the progress bar and counter update; test **Pause** / **Resume** / **Cancel**.
4. Verify the results table shows the per-end-condition breakdown after completion.
