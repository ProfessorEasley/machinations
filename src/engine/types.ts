export type GraphElementType =
  | 'Text Label'
  | 'Group'
  | 'Chart'
  | 'Pool'
  | 'Gate'
  | 'Resource Connection'
  | 'State Connection'
  | 'Source'
  | 'Drain'
  | 'Convertor'
  | 'Trader'
  | 'Delay'
  | 'Register'
  | 'End Condition'
  | 'Artifical Intelligence';

export interface GraphElement {
  id: number;
  type: GraphElementType;
  x: number;
  y: number;
  text?: string;
  width?: number;
  height?: number;
  color?: string;
  thickness?: number;
  activation?: 'passive' | 'interactive' | 'automatic' | 'onstart';
  pullMode?: 'pull any' | 'pull all' | 'push any' | 'push all';
  gateType?: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';
  triggerCount?: number;
  lastGateValue?: number;
  resources?: string;
  number?: number;
  max?: number;
  displayLimit?: number;

  resourcesByColor?: Record<string, number>;

  actions?: number;

  inputResources?: Record<string, number>;
  outputResources?: Record<string, number>;
  conversionRate?: Record<string, number>;

  traderInputs?: Record<string, number>;
  traderOutputs?: Record<string, number>;
  isIncompleteTrader?: boolean;

  formula?: string;
  minValue?: number;
  maxValue?: number;
  interactive?: boolean | string;
  startingValue?: number;
  step?: number;
  currentValue?: number;

  queue?: boolean;

  isBlinking?: boolean;

  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  connectedToStart?: number;
  connectedToEnd?: number;
  points?: { x: number; y: number }[];
  dynamicLabelBase?: number;
  dynamicLabelLastDelta?: number;
  dynamicLabelFractionNum?: number;
  dynamicLabelFractionDen?: number;
  lastStartValue?: number;
  conditionSatisfied?: boolean;
  hasUnsatisfiedCondition?: boolean;
  currentPoints?: number;
  hasStarted?: boolean;
  inhibited?: boolean;
  multiplicandValue?: number;
  multiplicandLastSourceValue?: number;
  labelPosition?: number;

  script?: string;

  chartWidth?: number;
  chartHeight?: number;
  chartScaleX?: number;
  chartScaleY?: number;

  chartState?: {
    scaleX: number;
    scaleY: number;
    negScaleY: number;
    defaultScaleX: number;
    defaultScaleY: number;
    dataSeries: Array<{
      connectionId: number;
      color: string;
      color2: string;
      thickness: number;
      name: string;
      data: number[];
      run: number;
    }>;
    tick: number;
    runs: number;
    highLighted: number;
  };
}

export interface ResourceTransfer {
  connectionId: number;
  units: number;
  color: string;
}

export interface FractionalDispatchState {
  connectionId: number;
  accumulator: number;
  lastTick: number;
}

export type LabelKind =
  | 'prob'
  | 'cond'
  | 'interval'
  | 'else'
  | 'empty'
  | 'invalid';

export type ActivationType = 'passive' | 'interactive' | 'automatic' | 'onstart';

export interface TickOptions {
  mode: ActivationType | 'all';
  currentTick: number;
  fractionalDispatch: Map<number, FractionalDispatchState>;
}

export interface SimulationEvent {
  type: 'game_end' | 'resource_transfer';
  payload?: unknown;
}

export interface TickResult {
  nextElements: GraphElement[];
  transfers: ResourceTransfer[];
  events: SimulationEvent[];
}
