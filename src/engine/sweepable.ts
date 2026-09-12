/**
 * Sweepable parameters — the allowlist of element fields a parameter sweep may
 * vary, keyed by element type.
 *
 * A field is sweepable only if all three hold:
 *
 *  1. The engine reads it when computing outcomes. Several fields the
 *     properties panel exposes are never read by any engine pass, so varying
 *     them changes nothing (see {@link NON_SWEEPABLE_FIELDS}).
 *  2. It is model input, not runtime state. Runtime fields are rebuilt by
 *     `resetElements` or by the tick itself; writing them is meaningless at
 *     best and corrupts the run at worst (see {@link RUNTIME_STATE_FIELDS}).
 *  3. Varying it keeps the model's structure intact. Ids, endpoints, element
 *     types, node labels that scripts address, and resource colours define
 *     *which* model this is, so changing them is a different model rather
 *     than a point in a sweep.
 *
 * Every entry below was checked by running the headless engine with two
 * values and confirming the outcome changes. `sweepable.test.ts` pins that
 * evidence, so an entry that stops mattering, or an excluded field that
 * starts to, fails CI and forces this list to be revisited.
 *
 * How to apply a sweep: write the value into the pristine input model, then
 * pass that model to `runSimulation` / `runMultiple`. Every run starts from
 * `resetElements(input)`, so input-side writes persist across a batch, while
 * writes to a `finalState` or to live canvas state are either lost or leak
 * one run's leftovers into the next.
 *
 * Out of scope: run options (`runs`, `maxTicks`, `seed`) are not model
 * parameters. The seed in particular is the replication axis of a batch, not
 * something to sweep alongside model values.
 */

import type { GraphElement, GraphElementType } from './types';

export type SweepValueKind =
  /** Whole number. The engine floors or rounds fractional input. */
  | 'integer'
  /** One of a fixed set of strings, listed in `values`. */
  | 'enum'
  /** Boolean flag. */
  | 'boolean'
  /**
   * A connection label. Sweep the numeric operand inside one fixed label form
   * (for example the N in `N%`, `>N` or `N/4`); changing the form changes the
   * label's meaning, so it is a different model. See each entry's caveat.
   */
  | 'label'
  /** A Register formula over variables `a`–`w`. Sweep whole alternatives. */
  | 'expression'
  /** An AI script. Sweep whole alternative scripts, never fragments. */
  | 'script';

export type SweepableField = keyof GraphElement;

export interface SweepableParameter {
  readonly field: SweepableField;
  readonly kind: SweepValueKind;
  /** For `enum`: only the values the engine actually distinguishes. */
  readonly values?: readonly string[];
  /** Smallest meaningful value, where the engine clamps. */
  readonly min?: number;
  /** What the value controls, in the engine's terms. */
  readonly meaning: string;
  /** Behaviour a sweep designer must know to interpret results correctly. */
  readonly caveat?: string;
}

// ---------------------------------------------------------------------------
// Shared entries
// ---------------------------------------------------------------------------

const ACTIVATION: SweepableParameter = {
  field: 'activation',
  kind: 'enum',
  values: ['automatic', 'passive', 'onstart', 'interactive'],
  meaning:
    'When the element fires: every tick, only when triggered, once on the ' +
    'first tick, or on a player click.',
  caveat:
    'Headless runs have no player, so `interactive` means the element never ' +
    'fires on its own. Sweeping to it is equivalent to disabling the element.',
};

/** Gate, Convertor and Trader only distinguish these two. */
const PULL_ANY_OR_ALL: SweepableParameter = {
  field: 'pullMode',
  kind: 'enum',
  values: ['pull any', 'pull all'],
  meaning:
    '`pull all` acts only when every input can supply its full amount; ' +
    '`pull any` takes whatever is available.',
  caveat:
    'The push modes are not handled by this element type and must not be ' +
    'swept here; only Pools implement pushing.',
};

const ACTIONS: SweepableParameter = {
  field: 'actions',
  kind: 'integer',
  min: 1,
  meaning: 'How many times the element acts per activation.',
  caveat:
    'Extra actions only add throughput when inputs can sustain them. With a ' +
    'starved input the outcome is flat, which reflects the model and not ' +
    'the parameter.',
};

const TRADER_WARNING =
  'Treat Trader sweep results as unreliable for now. In every trade tested, ' +
  'including a matched two-way colour swap, the trader consumed its inputs ' +
  'and delivered nothing. That is either a modelling rule not yet ' +
  'understood or an engine defect, and it needs investigating separately.';

const CONNECTION_LABEL_WRITE_RULE =
  'Write rule: when writing a new label, also clear every field in ' +
  '`DYNAMIC_LABEL_SHADOW_FIELDS`. The engine keeps a runtime shadow of the ' +
  'label once a modifier has touched it, and `resetElements` rebuilds the ' +
  'label from that shadow, so a label written over a stale shadow is ' +
  'silently reverted, and a range label such as `1-5` is flattened to a ' +
  'plain number. The engine recreates the shadow from the new label on the ' +
  'next tick.';

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

export const SWEEPABLE_PARAMETERS: Readonly<
  Record<GraphElementType, readonly SweepableParameter[]>
> = {
  Pool: [
    {
      field: 'number',
      kind: 'integer',
      min: 0,
      meaning: 'Starting resources, placed in the pool at the start of a run.',
      caveat:
        'This is the starting quantity. The panel field labelled ' +
        '"Resources" is the token colour picker (`resources`) and is not a ' +
        'quantity. Do not sweep `resourcesByColor` or `currentPoints` ' +
        'either: the reset rebuilds both from `number`.',
    },
    {
      field: 'max',
      kind: 'integer',
      min: 0,
      meaning: 'Capacity. Inflow beyond it is refused.',
      caveat:
        'Leave `max` undefined for unlimited. Legacy XML encodes unlimited as ' +
        '`capacity="-1"`, which the importer maps to undefined; never write ' +
        '-1 into the model directly.',
    },
    ACTIVATION,
    {
      field: 'pullMode',
      kind: 'enum',
      values: ['pull any', 'pull all', 'push any', 'push all'],
      meaning:
        'Whether the pool pulls from its inputs or pushes to its outputs, ' +
        'and whether it needs every connection to be satisfiable first.',
    },
  ],

  Gate: [
    {
      field: 'gateType',
      kind: 'enum',
      values: ['deterministic', 'dice'],
      meaning:
        '`dice` rolls a random value each time; `deterministic` counts ' +
        '1, 2, 3 and wraps. The value is matched against condition and ' +
        'interval labels on the outputs.',
      caveat:
        'Only matters when the outputs carry conditions (`>3`) or intervals ' +
        '(`1-2`); with weight or percentage outputs the gate type has no ' +
        'effect. `skill`, `multiplayer` and `strategy` are accepted but ' +
        'behave exactly like `deterministic`, so they are excluded as ' +
        'duplicates.',
    },
    {
      field: 'text',
      kind: 'label',
      meaning:
        'Number of dice sides for a `dice` gate, written `D<n>` (for ' +
        'example `D6`, `D20`). Without it, the widest output interval is ' +
        'used, falling back to 6.',
      caveat:
        'Sweep only the `n` in `D<n>`. A dice count is ignored: `2D6` rolls ' +
        'one six-sided die, not two, so do not sweep counts until that is ' +
        'fixed.',
    },
    ACTIONS,
    ACTIVATION,
    PULL_ANY_OR_ALL,
  ],

  Source: [ACTIVATION],

  Drain: [ACTIVATION],

  Convertor: [ACTIONS, ACTIVATION, PULL_ANY_OR_ALL],

  Trader: [
    { ...ACTIVATION, caveat: `${ACTIVATION.caveat} ${TRADER_WARNING}` },
    {
      ...PULL_ANY_OR_ALL,
      caveat: `${PULL_ANY_OR_ALL.caveat} ${TRADER_WARNING}`,
    },
  ],

  Delay: [
    {
      field: 'actions',
      kind: 'integer',
      min: 1,
      meaning: 'Hold time: how many ticks each batch waits before release.',
      caveat:
        'Delay reuses the `actions` field for its hold time, and the panel ' +
        'labels it "Actions". It is not an action count here.',
    },
    {
      field: 'queue',
      kind: 'boolean',
      meaning:
        '`true` holds one batch at a time and makes later arrivals wait; ' +
        '`false` holds every batch in parallel.',
    },
  ],

  Register: [
    {
      field: 'startingValue',
      kind: 'integer',
      meaning:
        'Initial value, and the value the register holds each tick when no ' +
        'formula applies.',
      caveat:
        'A formula replaces this value rather than adding to it. Register ' +
        'values are floored to integers, so fractional values are truncated.',
    },
    {
      field: 'minValue',
      kind: 'integer',
      meaning: 'Lower clamp on the register value.',
      caveat: 'Defaults to -9999 when unset, not to minus infinity.',
    },
    {
      field: 'maxValue',
      kind: 'integer',
      meaning: 'Upper clamp on the register value.',
      caveat: 'Defaults to 9999 when unset, not to infinity.',
    },
    {
      field: 'formula',
      kind: 'expression',
      meaning:
        'Expression over the values of incoming state connections labelled ' +
        '`a` to `w`.',
      caveat:
        'Ignored when the register has no incoming state connections, and ' +
        'ignored entirely for interactive registers.',
    },
  ],

  'Artifical Intelligence': [
    {
      field: 'script',
      kind: 'script',
      meaning:
        'The automated player’s policy: conditional commands that fire named ' +
        'nodes each time the element activates.',
      caveat:
        'Scripts address nodes by their label text, so renaming nodes breaks ' +
        'them. `actions` is excluded: repeat activations of one node within ' +
        'a tick collapse into one, so it had no measurable effect.',
    },
    ACTIVATION,
  ],

  'Resource Connection': [
    {
      field: 'text',
      kind: 'label',
      meaning:
        'Flow amount per activation. Accepted forms: a number (`3`), a ' +
        'fraction dispatched over ticks (`1/4`), a random integer range ' +
        '(`1-5`), a product (`2*3`), or arithmetic. On gate outputs: a ' +
        'relative weight, a percentage (`30%`), a condition (`>3`), an ' +
        'interval (`1-2`) or `else`. On convertor outputs: a percentage ' +
        'chance. On delay outputs: a release cap, or `all`. On convertor and ' +
        'trader inputs: the cost.',
      caveat:
        'Gate percentages are normalised when they do not sum to 100 and no ' +
        '`else` output exists: `30%` and `30%` behave exactly like `50%` and ' +
        '`50%`. A swept percentage is a relative weight unless the outputs ' +
        'sum to 100 or include `else`. Convertor output percentages, by ' +
        'contrast, are independent probabilities. Conversion ratios live ' +
        'here, as input cost and output yield, not in `conversionRate`. ' +
        CONNECTION_LABEL_WRITE_RULE,
    },
  ],

  'State Connection': [
    {
      field: 'text',
      kind: 'label',
      meaning:
        'A condition (`>19`, `==0`) or interval (`3-6`) threshold: into an ' +
        'End Condition it ends the run, and into a resource connection or ' +
        'node it blocks flow until satisfied. A trigger (`*`) or trigger ' +
        'chance (`25%`) into a node fires it. A modifier (`+2`, `-1`) into a ' +
        'register offsets it.',
      caveat:
        'Register variable letters (`a`–`w`) are structural wiring, not ' +
        'values, and must not be swept. Sweep only the numeric operand of ' +
        'a threshold, chance or modifier. A modifier does not accumulate on a ' +
        'formula-driven register: the value is recomputed every tick as the ' +
        'starting value or formula result plus that tick’s modifiers. It ' +
        'accumulates only on interactive registers. Modifiers into a Pool ' +
        'have no effect, because the engine applies modifier deltas only to ' +
        'registers.',
    },
  ],

  // Termination is controlled by the incoming State Connection's threshold.
  'End Condition': [],

  // Visual only.
  'Text Label': [],
  Group: [],
  Chart: [],
};

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------

/**
 * Fields holding simulation state, never model input. Sweeping any of these
 * is rejected. They are rebuilt by `resetElements` or recomputed every tick,
 * so a write is either discarded or, worse, carried into a later run. A
 * deterministic gate's `lastGateValue` is the cautionary case: while the reset
 * failed to clear it, an injected value shifted every run in a batch.
 */
export const RUNTIME_STATE_FIELDS: readonly SweepableField[] = [
  // Explicitly called out: meaningless to sweep and state-corrupting.
  'isBlinking',
  'delaySlots',
  'currentValue',
  'lastGateValue',
  // Delay pipeline.
  'delayPendingArrivals',
  'delayWaitQueue',
  // Pool contents, rebuilt from `number` on reset.
  'resourcesByColor',
  'currentPoints',
  // Convertor and Trader buffers.
  'inputResources',
  'outputResources',
  'traderInputs',
  'traderOutputs',
  'isIncompleteTrader',
  // Activation bookkeeping.
  'triggerCount',
  'hasStarted',
  // Recomputed from state connections every tick.
  'inhibited',
  'conditionSatisfied',
  'hasUnsatisfiedCondition',
  // Modifier and multiplier bookkeeping.
  'multiplicandValue',
  'multiplicandLastSourceValue',
  'lastStartValue',
  // Chart data accumulated across runs.
  'chartState',
];

/**
 * The runtime shadow the engine keeps of a resource connection's label once a
 * modifier touches it. Never sweep these directly; clear them whenever a
 * swept label is written, as the Resource Connection write rule requires.
 */
export const DYNAMIC_LABEL_SHADOW_FIELDS: readonly SweepableField[] = [
  'dynamicLabelBase',
  'dynamicLabelLastDelta',
  'dynamicLabelFractionNum',
  'dynamicLabelFractionDen',
];

/**
 * Model fields that are not sweepable, with the reason. Covers fields a user
 * can edit that the engine never reads, and structural or visual fields.
 */
export const NON_SWEEPABLE_FIELDS: Readonly<
  Partial<Record<SweepableField, string>>
> = {
  conversionRate:
    'Never read by the engine; the importer and serializer carry it through ' +
    'untouched. Conversion ratios come from the input and output ' +
    'connection labels.',
  step:
    'Canvas-only increment for clicking an interactive register. The ' +
    'engine never reads it, so it has no effect on a headless run.',
  resources:
    'Token colour for the transfer animation on Pools, Sources, Convertors ' +
    'and Traders. Not a quantity; the starting quantity is `number`.',
  displayLimit: 'Rendering cap on how many tokens a pool draws.',
  interactive:
    'Switches a register between formula-driven and player-driven. A mode ' +
    'change, not a value: an interactive register ignores its formula and ' +
    'only accumulates modifiers, since a headless run has no player.',
  color:
    'Resource identity. Pools and connections match resources by colour, ' +
    'so changing it rewires which resources flow where.',
  text:
    'On nodes, the name that AI scripts target and outcome reports use, ' +
    'so changing it rewires the model. Sweepable only where listed: Gate ' +
    'dice sides and connection labels.',
  actions:
    'Sweepable only on Gate, Convertor and Delay. Sources, Drains, Traders ' +
    'and AI elements showed no effect from it, and End Conditions never ' +
    'read it, even though the panel shows the field on all of them.',
  activation:
    'Sweepable wherever listed. Delays ignore it: all four modes released ' +
    'identically. Registers and End Conditions have no activation.',
  pullMode:
    'Sweepable only on Pool, Gate, Convertor and Trader. Sources, Drains ' +
    'and End Conditions never read it, even though the panel shows it.',
  minValue:
    'Sweepable only on Registers. The panel also shows it on connections, ' +
    'where the engine never reads it.',
  maxValue:
    'Sweepable only on Registers. The panel also shows it on connections, ' +
    'where the engine never reads it.',
  id: 'Structural: element identity.',
  type: 'Structural: element kind.',
  connectedToStart: 'Structural: connection endpoint.',
  connectedToEnd: 'Structural: connection endpoint.',
  x: 'Layout.',
  y: 'Layout.',
  width: 'Layout.',
  height: 'Layout.',
  thickness: 'Visual.',
  labelPosition: 'Visual.',
  points: 'Visual: connection waypoints.',
  chartWidth: 'Visual.',
  chartHeight: 'Visual.',
  chartScaleX: 'Visual.',
  chartScaleY: 'Visual.',
};

/** Look up the allowlist entry for a field on an element type, if any. */
export function getSweepableParameter(
  type: GraphElementType,
  field: SweepableField
): SweepableParameter | undefined {
  return SWEEPABLE_PARAMETERS[type].find(p => p.field === field);
}

/** True when a sweep may vary `field` on elements of `type`. */
export function isSweepable(
  type: GraphElementType,
  field: SweepableField
): boolean {
  return getSweepableParameter(type, field) !== undefined;
}
