import { describe, it, expect } from 'vitest';
import type { GraphElement, GraphElementType } from '../types';
import { runSimulation } from '../runner';
import { resetElements } from '../reset';
import {
  SWEEPABLE_PARAMETERS,
  RUNTIME_STATE_FIELDS,
  DYNAMIC_LABEL_SHADOW_FIELDS,
  NON_SWEEPABLE_FIELDS,
  isSweepable,
  type SweepableField,
} from '../sweepable';

/**
 * Evidence for the sweepable-parameter allowlist.
 *
 * Every allowlisted (type, field) pair must have a scenario below showing that
 * two values of the field produce different outcomes, applied the way a sweep
 * would apply them: written into a pristine input model before the run. The
 * exclusion tests pin the opposite for fields that look tunable but are not.
 * If the engine starts or stops honouring a field, these fail and the
 * allowlist has to be revisited.
 */

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const E = (o: Partial<GraphElement>): GraphElement =>
  ({ x: 0, y: 0, ...o }) as GraphElement;

const pool = (id: number, o: Partial<GraphElement> = {}) =>
  E({
    id,
    type: 'Pool',
    activation: 'passive',
    pullMode: 'pull any',
    number: 0,
    ...o,
  });

const flow = (id: number, from: number, to: number, text = '1') =>
  E({
    id,
    type: 'Resource Connection',
    connectedToStart: from,
    connectedToEnd: to,
    text,
  });

/** A comparable fingerprint of a run: pool contents, register values, ticks. */
function outcome(model: GraphElement[], ticks: number, seed = 1): string {
  const r = runSimulation(model, { maxTicks: ticks, seed });
  const values = r.finalState
    .filter(e => e.type === 'Pool' || e.type === 'Register')
    .map(e =>
      e.type === 'Pool'
        ? `${e.id}:${JSON.stringify(e.resourcesByColor ?? {})}`
        : `${e.id}=${e.currentValue}`
    );
  return `${values.join(' ')} ticks=${r.ticksRun} end=${r.endConditionName}`;
}

/** Clone the pristine model and write one field on one element. */
function withField(
  model: GraphElement[],
  id: number,
  field: SweepableField,
  value: unknown
): GraphElement[] {
  const copy = JSON.parse(JSON.stringify(model)) as GraphElement[];
  const el = copy.find(e => e.id === id)!;
  (el as unknown as Record<string, unknown>)[field] = value;
  return copy;
}

interface Scenario {
  model: () => GraphElement[];
  /** Element whose field is written. */
  id: number;
  a: unknown;
  b: unknown;
  ticks: number;
  seed?: number;
}

const sweep = (s: Scenario, field: SweepableField) =>
  [s.a, s.b].map(v =>
    outcome(withField(s.model(), s.id, field, v), s.ticks, s.seed)
  );

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/** 1 Source -> 2 Pool. */
const sourceIntoPool = () => [
  E({ id: 1, type: 'Source', activation: 'automatic' }),
  pool(2),
  flow(3, 1, 2),
];

/** 1 stocked Pool -> 2 Pool that pulls. */
const poolPullsPool = () => [
  pool(1, { number: 100 }),
  pool(2, { activation: 'automatic' }),
  flow(3, 1, 2),
];

/** 1 Pool(100) -> 2 Drain. */
const poolIntoDrain = () => [
  pool(1, { number: 100 }),
  E({ id: 2, type: 'Drain', activation: 'automatic' }),
  flow(3, 1, 2),
];

/**
 * Two inputs, one of them nearly empty, into node 3, which outputs to pool 4.
 * `pull all` stalls once the short input runs dry; `pull any` keeps going.
 */
const twoInputsInto =
  (node: Partial<GraphElement>, outLabel = '1') =>
  () => [
    pool(1, { number: 100 }),
    pool(2, { number: 2 }),
    E({ id: 3, activation: 'automatic', pullMode: 'pull any', ...node }),
    pool(4),
    flow(5, 1, 3),
    flow(6, 2, 3),
    flow(7, 3, 4, outLabel),
  ];

/** 1 Pool -> 2 Gate -> pool 3 on a low value (1-2), pool 4 on a high one. */
const gateWithIntervals =
  (gate: Partial<GraphElement> = {}) =>
  () => [
    pool(1, { number: 1000 }),
    E({
      id: 2,
      type: 'Gate',
      activation: 'automatic',
      gateType: 'deterministic',
      text: 'D6',
      ...gate,
    }),
    pool(3),
    pool(4),
    flow(5, 1, 2),
    flow(6, 2, 3, '1-2'),
    flow(7, 2, 4, '3-6'),
  ];

/** 1 Pool -> 2 Convertor -> 3 Pool, one for one, with plentiful input. */
const convertorLine = () => [
  pool(1, { number: 1000 }),
  E({
    id: 2,
    type: 'Convertor',
    activation: 'automatic',
    pullMode: 'pull any',
  }),
  pool(3),
  flow(4, 1, 2),
  flow(5, 2, 3),
];

/** Two pools swapping one Red for one Blue through 3 Trader. */
const traderSwap = () => [
  pool(1, { color: 'Red', number: 20 }),
  pool(2, { color: 'Blue', number: 20 }),
  E({ id: 3, type: 'Trader', activation: 'automatic', pullMode: 'pull any' }),
  { ...flow(4, 1, 3), color: 'Red' },
  { ...flow(5, 2, 3), color: 'Blue' },
  { ...flow(6, 3, 1), color: 'Blue' },
  { ...flow(7, 3, 2), color: 'Red' },
];

/** 1 Source -> 2 Delay -> 3 Pool. */
const delayLine = () => [
  E({ id: 1, type: 'Source', activation: 'automatic' }),
  E({ id: 2, type: 'Delay', activation: 'automatic', actions: 3 }),
  pool(3),
  flow(4, 1, 2),
  flow(5, 2, 3),
];

const register = (o: Partial<GraphElement> = {}) =>
  E({
    id: 2,
    type: 'Register',
    startingValue: 0,
    minValue: -9999,
    maxValue: 9999,
    formula: '',
    ...o,
  });

/** Register 2 alone. */
const loneRegister = () => [register()];

/** Pool 1 holding 7, read into Register 2 as variable `a`. */
const registerFormula = (formula: string) => () => [
  pool(1, { number: 7 }),
  register({ formula }),
  E({
    id: 3,
    type: 'State Connection',
    connectedToStart: 1,
    connectedToEnd: 2,
    text: 'a',
  }),
];

/** 1 AI fires 2 Source (labelled `src`) into 3 Pool. */
const aiFiresSource = () => [
  E({
    id: 1,
    type: 'Artifical Intelligence',
    activation: 'automatic',
    actions: 1,
    script: 'fire(src)',
  }),
  E({ id: 2, type: 'Source', activation: 'passive', text: 'src' }),
  pool(3),
  flow(4, 2, 3),
];

/** Pool 2 fills each tick and, via State Connection 7, triggers Source 3. */
const triggeredSource = () => [
  E({ id: 1, type: 'Source', activation: 'automatic' }),
  pool(2),
  E({ id: 3, type: 'Source', activation: 'passive' }),
  pool(4),
  flow(5, 1, 2),
  flow(6, 3, 4),
  E({
    id: 7,
    type: 'State Connection',
    connectedToStart: 2,
    connectedToEnd: 3,
    text: '*',
  }),
];

// ---------------------------------------------------------------------------
// Evidence: one scenario per allowlisted entry
// ---------------------------------------------------------------------------

const EVIDENCE: Record<string, Scenario> = {
  'Pool.number': { model: sourceIntoPool, id: 2, a: 0, b: 50, ticks: 20 },
  'Pool.max': { model: sourceIntoPool, id: 2, a: 7, b: 12, ticks: 20 },
  'Pool.activation': {
    model: poolPullsPool,
    id: 2,
    a: 'automatic',
    b: 'passive',
    ticks: 10,
  },
  'Pool.pullMode': {
    model: twoInputsInto({ type: 'Pool', number: 0 }),
    id: 3,
    a: 'pull any',
    b: 'pull all',
    ticks: 8,
  },

  'Gate.gateType': {
    model: gateWithIntervals(),
    id: 2,
    a: 'deterministic',
    b: 'dice',
    ticks: 60,
    seed: 3,
  },
  'Gate.text': {
    model: gateWithIntervals({ gateType: 'dice' }),
    id: 2,
    a: 'D6',
    b: 'D2',
    ticks: 60,
    seed: 3,
  },
  'Gate.actions': { model: gateWithIntervals(), id: 2, a: 1, b: 4, ticks: 20 },
  'Gate.activation': {
    model: gateWithIntervals(),
    id: 2,
    a: 'automatic',
    b: 'passive',
    ticks: 20,
  },
  'Gate.pullMode': {
    model: twoInputsInto({ type: 'Gate', gateType: 'deterministic' }, ''),
    id: 3,
    a: 'pull any',
    b: 'pull all',
    ticks: 10,
  },

  'Source.activation': {
    model: sourceIntoPool,
    id: 1,
    a: 'automatic',
    b: 'onstart',
    ticks: 10,
  },

  'Drain.activation': {
    model: poolIntoDrain,
    id: 2,
    a: 'automatic',
    b: 'passive',
    ticks: 10,
  },

  'Convertor.actions': { model: convertorLine, id: 2, a: 1, b: 3, ticks: 10 },
  'Convertor.activation': {
    model: convertorLine,
    id: 2,
    a: 'automatic',
    b: 'passive',
    ticks: 10,
  },
  'Convertor.pullMode': {
    model: twoInputsInto({ type: 'Convertor' }),
    id: 3,
    a: 'pull any',
    b: 'pull all',
    ticks: 10,
  },

  'Trader.activation': {
    model: traderSwap,
    id: 3,
    a: 'automatic',
    b: 'passive',
    ticks: 5,
  },
  'Trader.pullMode': {
    model: traderSwap,
    id: 3,
    a: 'pull any',
    b: 'pull all',
    ticks: 5,
  },

  'Delay.actions': { model: delayLine, id: 2, a: 1, b: 6, ticks: 12 },
  'Delay.queue': { model: delayLine, id: 2, a: false, b: true, ticks: 12 },

  'Register.startingValue': {
    model: loneRegister,
    id: 2,
    a: 0,
    b: 42,
    ticks: 5,
  },
  'Register.minValue': {
    model: registerFormula('a-100'),
    id: 2,
    a: -9999,
    b: 0,
    ticks: 3,
  },
  'Register.maxValue': {
    model: registerFormula('a*2'),
    id: 2,
    a: 9999,
    b: 10,
    ticks: 3,
  },
  'Register.formula': {
    model: registerFormula('a*2'),
    id: 2,
    a: 'a*2',
    b: 'a*3',
    ticks: 3,
  },

  'Artifical Intelligence.script': {
    model: aiFiresSource,
    id: 1,
    a: 'fire(src)',
    b: '',
    ticks: 10,
  },
  'Artifical Intelligence.activation': {
    model: aiFiresSource,
    id: 1,
    a: 'automatic',
    b: 'passive',
    ticks: 10,
  },

  'Resource Connection.text': {
    model: sourceIntoPool,
    id: 3,
    a: '1',
    b: '3',
    ticks: 20,
  },

  'State Connection.text': {
    model: triggeredSource,
    id: 7,
    a: '*',
    b: '25%',
    ticks: 200,
    seed: 5,
  },
};

const ALL_TYPES: GraphElementType[] = [
  'Text Label',
  'Group',
  'Chart',
  'Pool',
  'Gate',
  'Resource Connection',
  'State Connection',
  'Source',
  'Drain',
  'Convertor',
  'Trader',
  'Delay',
  'Register',
  'End Condition',
  'Artifical Intelligence',
];

const allowlisted = ALL_TYPES.flatMap(type =>
  SWEEPABLE_PARAMETERS[type].map(param => ({ type, param }))
);

describe('sweepable allowlist — every entry changes the outcome', () => {
  it('covers every element type', () => {
    expect(Object.keys(SWEEPABLE_PARAMETERS).sort()).toEqual(
      [...ALL_TYPES].sort()
    );
  });

  it('has an evidence scenario for every allowlisted entry', () => {
    const missing = allowlisted
      .map(({ type, param }) => `${type}.${param.field}`)
      .filter(key => !EVIDENCE[key]);
    expect(missing).toEqual([]);
  });

  it('has no evidence scenario for a field that is not allowlisted', () => {
    const stale = Object.keys(EVIDENCE).filter(key => {
      const dot = key.lastIndexOf('.');
      return !isSweepable(
        key.slice(0, dot) as GraphElementType,
        key.slice(dot + 1) as SweepableField
      );
    });
    expect(stale).toEqual([]);
  });

  it('lists each field at most once per type, with values for every enum', () => {
    for (const type of ALL_TYPES) {
      const fields = SWEEPABLE_PARAMETERS[type].map(p => p.field);
      expect(new Set(fields).size).toBe(fields.length);
      for (const p of SWEEPABLE_PARAMETERS[type]) {
        if (p.kind === 'enum') expect(p.values?.length).toBeGreaterThan(1);
      }
    }
  });

  for (const { type, param } of allowlisted) {
    const key = `${type}.${param.field}`;
    const s = EVIDENCE[key];
    it(`${key}: ${String(s?.a)} vs ${String(s?.b)}`, () => {
      const [a, b] = sweep(s, param.field);
      expect(b).not.toBe(a);
    });
  }
});

// ---------------------------------------------------------------------------
// Exclusions: editable-looking fields the engine ignores
// ---------------------------------------------------------------------------

describe('sweepable allowlist — excluded fields have no effect', () => {
  const noEffect = (label: string, s: Scenario, field: SweepableField) =>
    it(label, () => {
      const [a, b] = sweep(s, field);
      expect(b).toBe(a);
    });

  noEffect(
    'Convertor.conversionRate is never read',
    { model: convertorLine, id: 2, a: undefined, b: { Black: 5 }, ticks: 10 },
    'conversionRate'
  );
  noEffect(
    'Register.step is canvas-only',
    { model: loneRegister, id: 2, a: 1, b: 25, ticks: 5 },
    'step'
  );
  noEffect(
    'Pool.resources is a token colour, not a quantity',
    { model: sourceIntoPool, id: 2, a: undefined, b: 'Red', ticks: 20 },
    'resources'
  );
  noEffect(
    'Pool.displayLimit is rendering only',
    { model: sourceIntoPool, id: 2, a: undefined, b: 3, ticks: 20 },
    'displayLimit'
  );
  noEffect(
    'Source.actions is ignored',
    { model: sourceIntoPool, id: 1, a: 1, b: 5, ticks: 20 },
    'actions'
  );
  noEffect(
    'Drain.actions is ignored',
    { model: poolIntoDrain, id: 2, a: 1, b: 5, ticks: 10 },
    'actions'
  );
  noEffect(
    'Trader.actions shows no effect',
    { model: traderSwap, id: 3, a: 1, b: 3, ticks: 5 },
    'actions'
  );
  noEffect(
    'AI actions collapse: repeat activations within a tick count once',
    { model: aiFiresSource, id: 1, a: 1, b: 3, ticks: 10 },
    'actions'
  );
  noEffect(
    'Resource Connection maxValue is never read',
    { model: sourceIntoPool, id: 3, a: undefined, b: 0, ticks: 20 },
    'maxValue'
  );
  noEffect(
    'Resource Connection minValue is never read',
    { model: sourceIntoPool, id: 3, a: undefined, b: 5, ticks: 20 },
    'minValue'
  );

  for (const mode of ['passive', 'onstart', 'interactive'] as const) {
    noEffect(
      `Delay.activation is ignored (automatic vs ${mode})`,
      { model: delayLine, id: 2, a: 'automatic', b: mode, ticks: 12 },
      'activation'
    );
  }

  for (const alias of ['skill', 'multiplayer', 'strategy'] as const) {
    noEffect(
      `Gate.gateType '${alias}' behaves exactly like 'deterministic'`,
      {
        model: gateWithIntervals(),
        id: 2,
        a: 'deterministic',
        b: alias,
        ticks: 60,
        seed: 3,
      },
      'gateType'
    );
  }
});

// ---------------------------------------------------------------------------
// Runtime state: excluded because sweeping it is meaningless or corrupting
// ---------------------------------------------------------------------------

describe('sweepable allowlist — runtime state is never sweepable', () => {
  it('excludes the named runtime fields from every element type', () => {
    for (const field of [
      'isBlinking',
      'delaySlots',
      'currentValue',
      'lastGateValue',
    ] as const) {
      expect(RUNTIME_STATE_FIELDS).toContain(field);
      for (const type of ALL_TYPES) {
        expect(isSweepable(type, field)).toBe(false);
      }
    }
  });

  it('allowlists no runtime-state or label-shadow field', () => {
    const forbidden = new Set<SweepableField>([
      ...RUNTIME_STATE_FIELDS,
      ...DYNAMIC_LABEL_SHADOW_FIELDS,
    ]);
    const leaks = allowlisted
      .filter(({ param }) => forbidden.has(param.field))
      .map(({ type, param }) => `${type}.${param.field}`);
    expect(leaks).toEqual([]);
  });

  it('allowlists no field documented as dead, visual or structural', () => {
    const excludedEverywhere: SweepableField[] = [
      'conversionRate',
      'step',
      'resources',
      'displayLimit',
      'interactive',
      'color',
      'id',
      'type',
      'connectedToStart',
      'connectedToEnd',
    ];
    for (const field of excludedEverywhere) {
      expect(NON_SWEEPABLE_FIELDS[field]).toBeTruthy();
      for (const type of ALL_TYPES) {
        expect(isSweepable(type, field)).toBe(false);
      }
    }
  });

  it('reset overwrites delaySlots, currentValue and isBlinking', () => {
    const [delay, reg, end] = resetElements([
      E({
        id: 1,
        type: 'Delay',
        delaySlots: [{ ticksRemaining: 1, amount: 500, color: '#000000' }],
      }),
      register({ id: 2, startingValue: 3, currentValue: 999 }),
      E({ id: 3, type: 'End Condition', isBlinking: true }),
    ]);
    expect(delay.delaySlots).toEqual([]);
    expect(reg.currentValue).toBe(3);
    expect(end.isBlinking).toBe(false);
  });

  it('never allowlists lastGateValue, whatever the reset does with it', () => {
    // A deterministic gate's counter is runtime state. Left in the model it
    // either carries into the next run or is discarded by the reset; neither
    // makes it a parameter, so the allowlist must exclude it either way.
    expect(RUNTIME_STATE_FIELDS).toContain('lastGateValue');
    expect(isSweepable('Gate', 'lastGateValue')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Behaviour a sweep harness must respect
// ---------------------------------------------------------------------------

describe('sweepable allowlist — connection label write rule', () => {
  /** Register 4 modifies Resource Connection 3, creating label bookkeeping. */
  const modified = (conn: Partial<GraphElement>) => [
    E({ id: 1, type: 'Source', activation: 'automatic' }),
    pool(2),
    { ...flow(3, 1, 2), ...conn },
    register({ id: 4 }),
    E({
      id: 5,
      type: 'State Connection',
      connectedToStart: 4,
      connectedToEnd: 3,
      text: '+1',
    }),
  ];
  const clearedShadow = Object.fromEntries(
    DYNAMIC_LABEL_SHADOW_FIELDS.map(f => [f, undefined])
  );

  it('a label written over a stale shadow is silently reverted', () => {
    const fresh = outcome(modified({ text: '2' }), 20);
    const stale = outcome(modified({ text: '2', dynamicLabelBase: 1 }), 20);
    expect(stale).not.toBe(fresh);
    expect(stale).toBe(outcome(modified({ text: '1' }), 20));
  });

  it('clearing the shadow makes the new label take effect', () => {
    const fresh = outcome(modified({ text: '2' }), 20);
    const cleared = outcome(
      modified({ text: '2', dynamicLabelBase: 1, ...clearedShadow }),
      20
    );
    expect(cleared).toBe(fresh);
  });

  it('a stale shadow flattens a range label to a plain number', () => {
    const flattened = outcome(
      modified({ text: '1-5', dynamicLabelBase: 1 }),
      20
    );
    expect(flattened).toBe(outcome(modified({ text: '1' }), 20));
  });
});

describe('sweepable allowlist — gate percentages are relative weights', () => {
  const split = (a: string, b: string, extra?: string) =>
    outcome(
      [
        pool(1, { number: 100000 }),
        E({ id: 2, type: 'Gate', activation: 'automatic', gateType: 'dice' }),
        pool(3),
        pool(4),
        pool(5),
        flow(6, 1, 2),
        flow(7, 2, 3, a),
        flow(8, 2, 4, b),
        ...(extra ? [flow(9, 2, 5, extra)] : []),
      ],
      500,
      11
    );

  it('normalises percentages that do not sum to 100', () => {
    expect(split('30%', '30%')).toBe(split('50%', '50%'));
  });

  it('routes the remainder to an else output when one exists', () => {
    expect(split('30%', '30%', 'else')).not.toBe(split('50%', '50%', 'else'));
  });
});
