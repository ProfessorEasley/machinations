import { RegisterExpression } from '../utils/RegisterExpression';
import { parseAiScript, selectAiCommand } from '../utils/aiScript';
import {
  createInitialChartState,
  createChartDataSeries,
  autoExpandScaleY,
  autoExpandNegScaleY,
} from '../utils/ChartUtils';
import type {
  GraphElement,
  ResourceTransfer,
  TickOptions,
  TickResult,
  DelaySlot,
} from './types';
import {
  getElementValue,
  isResourceLikeConnection,
  classifyLabel,
  parseCond,
  parseInterval,
  parseConnectionLabel,
  handleDecimalResourceDispatch,
  recordTransfer,
  shouldActivateTrigger,
  isTriggerOutput,
  applyDynamicResourceLabelsMutable,
  chooseGateOutputs,
  getBaseInputAmountFromMultiplyLabel,
} from './helpers';
import { random } from './rng';

// ---------------------------------------------------------------------------
// Pure helpers used only inside tick
// ---------------------------------------------------------------------------

function evaluateStateCondition(
  connection: GraphElement,
  elementMap: Map<number, GraphElement>
): { evaluated: boolean; satisfied: boolean } {
  if (connection.connectedToStart == null)
    return { evaluated: false, satisfied: false };
  const startEl = elementMap.get(connection.connectedToStart);
  if (!startEl) return { evaluated: false, satisfied: false };
  const labelText = (connection.text ?? '').trim();
  const kind = classifyLabel(labelText);
  if (kind === 'cond') {
    const fn = parseCond(labelText);
    if (fn) return { evaluated: true, satisfied: fn(getElementValue(startEl)) };
  } else if (kind === 'interval') {
    const range = parseInterval(labelText);
    if (range) {
      const v = getElementValue(startEl);
      return { evaluated: true, satisfied: v >= range[0] && v <= range[1] };
    }
  }
  return { evaluated: false, satisfied: false };
}

function updateStateConnectionVisualState(elementsList: GraphElement[]): void {
  const elementMap = new Map<number, GraphElement>(
    elementsList.map(el => [el.id, el])
  );
  const targetStates = new Map<number, boolean>();

  for (const connection of elementsList) {
    if (
      connection.type !== 'State Connection' ||
      connection.connectedToStart == null ||
      connection.connectedToEnd == null
    ) {
      if (
        connection.type !== 'Resource Connection' &&
        'hasUnsatisfiedCondition' in connection
      ) {
        connection.hasUnsatisfiedCondition = false;
      }
      continue;
    }
    const { evaluated, satisfied } = evaluateStateCondition(
      connection,
      elementMap
    );
    if (evaluated) {
      connection.conditionSatisfied = satisfied;
      connection.hasUnsatisfiedCondition = !satisfied;
      const prev = targetStates.get(connection.connectedToEnd);
      targetStates.set(
        connection.connectedToEnd,
        prev === undefined ? satisfied : prev && satisfied
      );
    } else {
      connection.hasUnsatisfiedCondition = false;
      connection.conditionSatisfied = undefined;
    }
  }

  targetStates.forEach((allSatisfied, targetId) => {
    const target = elementMap.get(targetId);
    if (target) target.hasUnsatisfiedCondition = !allSatisfied;
  });
}

function applyStateConnectionDelta(target: GraphElement, delta: number): void {
  if (!delta || !target) return;
  if (target.type === 'Pool') {
    if (!target.resourcesByColor) target.resourcesByColor = {};
    const colorKey = target.color || '#000000';
    const currentVal = target.resourcesByColor[colorKey] || 0;
    const max = target.max ?? Infinity;
    const currentTotal = getElementValue(target);
    const space = max - currentTotal;
    const actualDelta = delta > 0 ? Math.min(delta, space) : delta;
    const nextVal = Math.max(0, currentVal + actualDelta);
    target.resourcesByColor[colorKey] = nextVal;
    target.currentPoints = Object.values(target.resourcesByColor).reduce(
      (a, b) => a + b,
      0
    );
    return;
  }
  if (target.type === 'Register') {
    const min = target.minValue ?? -Infinity;
    const max = target.maxValue ?? Infinity;
    const next = (target.currentValue ?? 0) + delta;
    target.currentValue = Math.min(Math.max(next, min), max);
  }
}

function processIncompleteTrader(
  trader: GraphElement,
  inputConns: GraphElement[],
  outputConns: GraphElement[],
  elementMap: Map<number, GraphElement>,
  transfers?: ResourceTransfer[]
): void {
  const requiredInputs = new Map<number, number>();
  for (const c of inputConns) {
    const amount = parseConnectionLabel(c.text);
    if (amount > 0) requiredInputs.set(c.id, amount);
  }
  const outputAmounts = new Map<number, number>();
  for (const c of outputConns) {
    const amount = parseConnectionLabel(c.text);
    if (amount > 0) outputAmounts.set(c.id, amount);
  }

  if (trader.pullMode === 'pull all') {
    let canTrade = true;
    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const conn = inputConns.find(c => c.id === connId);
      if (!conn) {
        canTrade = false;
        break;
      }
      const el = conn.connectedToStart
        ? elementMap.get(conn.connectedToStart)
        : undefined;
      if (!el) {
        canTrade = false;
        break;
      }
      if (el.type === 'Source') continue;
      if (el.type === 'Pool' && (el.currentPoints ?? 0) < requiredAmount) {
        canTrade = false;
        break;
      }
      if (el.type !== 'Pool') {
        canTrade = false;
        break;
      }
    }
    if (!canTrade) return;

    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const conn = inputConns.find(c => c.id === connId);
      if (!conn) continue;
      const el = elementMap.get(conn.connectedToStart!);
      if (!el) continue;
      if (el.type === 'Pool') {
        el.currentPoints = Math.max(
          0,
          (el.currentPoints ?? 0) - requiredAmount
        );
        recordTransfer(transfers, conn, requiredAmount, el);
      } else if (el.type === 'Source') {
        recordTransfer(transfers, conn, requiredAmount, el);
      }
    }

    if (inputConns.length > 1 && outputConns.length === 1) {
      let totalInput = 0;
      for (const amount of requiredInputs.values()) totalInput += amount;
      const outConn = outputConns[0];
      const outEl = elementMap.get(outConn.connectedToEnd!);
      if (outEl?.type === 'Pool') {
        const current = outEl.currentPoints ?? 0;
        const max = outEl.max ?? Infinity;
        const accepted = Math.min(totalInput, max - current);
        if (accepted > 0 && transfers)
          recordTransfer(transfers, outConn, accepted, trader);
        outEl.currentPoints = Math.min(current + totalInput, max);
      }
    } else if (inputConns.length === 1 && outputConns.length > 1) {
      const inputAmount = requiredInputs.values().next().value || 0;
      for (const outConn of outputConns) {
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const accepted = Math.min(inputAmount, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + inputAmount, max);
        }
      }
    } else {
      for (const [connId, outputAmount] of outputAmounts.entries()) {
        const outConn = outputConns.find(c => c.id === connId);
        if (!outConn) continue;
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const accepted = Math.min(outputAmount, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + outputAmount, max);
        }
      }
    }
  } else {
    // pull any
    let canTrade = true;
    let minTrades = Infinity;
    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const stored = trader.traderInputs![`conn_${connId}`] || 0;
      if (stored < requiredAmount) {
        canTrade = false;
        break;
      }
      minTrades = Math.min(minTrades, Math.floor(stored / requiredAmount));
    }
    if (!canTrade || minTrades <= 0) return;

    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const key = `conn_${connId}`;
      trader.traderInputs![key] =
        (trader.traderInputs![key] || 0) - requiredAmount * minTrades;
    }

    if (inputConns.length > 1 && outputConns.length === 1) {
      let totalInputPerTrade = 0;
      for (const amount of requiredInputs.values())
        totalInputPerTrade += amount;
      const outConn = outputConns[0];
      const outEl = elementMap.get(outConn.connectedToEnd!);
      if (outEl?.type === 'Pool') {
        const current = outEl.currentPoints ?? 0;
        const max = outEl.max ?? Infinity;
        const totalOutput = totalInputPerTrade * minTrades;
        const accepted = Math.min(totalOutput, max - current);
        if (accepted > 0 && transfers)
          recordTransfer(transfers, outConn, accepted, trader);
        outEl.currentPoints = Math.min(current + totalOutput, max);
      }
    } else if (inputConns.length === 1 && outputConns.length > 1) {
      const inputAmount = requiredInputs.values().next().value || 0;
      for (const outConn of outputConns) {
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const totalOutput = inputAmount * minTrades;
          const accepted = Math.min(totalOutput, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + totalOutput, max);
        }
      }
    } else {
      for (const [connId, outputAmount] of outputAmounts.entries()) {
        const outConn = outputConns.find(c => c.id === connId);
        if (!outConn) continue;
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const totalOutput = outputAmount * minTrades;
          const accepted = Math.min(totalOutput, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + totalOutput, max);
        }
      }
    }
  }
}

function processCompleteTrader(
  trader: GraphElement,
  inputConns: GraphElement[],
  outputConns: GraphElement[],
  elementMap: Map<number, GraphElement>,
  transfers?: ResourceTransfer[]
): void {
  const requiredInputs = new Map<number, number>();
  for (const c of inputConns) {
    const amount = parseConnectionLabel(c.text);
    if (amount > 0) requiredInputs.set(c.id, amount);
  }
  const outputAmounts = new Map<number, number>();
  for (const c of outputConns) {
    const amount = parseConnectionLabel(c.text);
    if (amount > 0) outputAmounts.set(c.id, amount);
  }

  const inputInfo = inputConns.map(c => ({
    connId: c.id,
    amount: requiredInputs.get(c.id) || 0,
    sourcePoolId: c.connectedToStart
      ? elementMap.get(c.connectedToStart)?.id
      : undefined,
    color: c.color,
  }));

  const outputInfo = outputConns.map(c => ({
    connId: c.id,
    destPoolId: c.connectedToEnd
      ? elementMap.get(c.connectedToEnd)?.id
      : undefined,
    color: c.color,
  }));

  const allColors = [
    ...inputInfo.map(i => i.color || '#000000'),
    ...outputInfo.map(o => o.color || '#000000'),
  ];
  const hasColorDifferentiation = new Set(allColors).size > 1;

  const createInputOutputMapping = (): Map<number, number> => {
    const mapping = new Map<number, number>();
    const usedOutputs = new Set<number>();
    for (const input of inputInfo) {
      let bestMatch: number | null = null;
      let bestScore = -1;
      for (const output of outputInfo) {
        if (usedOutputs.has(output.connId)) continue;
        if (
          input.sourcePoolId &&
          output.destPoolId &&
          input.sourcePoolId === output.destPoolId
        )
          continue;
        let score = 1;
        if (input.color && output.color && input.color !== output.color)
          score += 10;
        if (
          input.sourcePoolId &&
          output.destPoolId &&
          input.sourcePoolId !== output.destPoolId
        )
          score += 5;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = output.connId;
        }
      }
      if (bestMatch !== null) {
        mapping.set(input.connId, bestMatch);
        usedOutputs.add(bestMatch);
      }
    }
    return mapping;
  };

  if (trader.pullMode === 'pull all') {
    let canTrade = true;
    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const conn = inputConns.find(c => c.id === connId);
      if (!conn) {
        canTrade = false;
        break;
      }
      const el = conn.connectedToStart
        ? elementMap.get(conn.connectedToStart)
        : undefined;
      if (!el) {
        canTrade = false;
        break;
      }
      if (el.type === 'Source') continue;
      if (el.type === 'Pool' && (el.currentPoints ?? 0) < requiredAmount) {
        canTrade = false;
        break;
      }
      if (el.type !== 'Pool') {
        canTrade = false;
        break;
      }
    }
    if (!canTrade) return;

    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const conn = inputConns.find(c => c.id === connId);
      if (!conn) continue;
      const el = elementMap.get(conn.connectedToStart!);
      if (!el) continue;
      if (el.type === 'Pool') {
        el.currentPoints = Math.max(
          0,
          (el.currentPoints ?? 0) - requiredAmount
        );
        recordTransfer(transfers, conn, requiredAmount, el);
      } else if (el.type === 'Source') {
        if (transfers) recordTransfer(transfers, conn, requiredAmount, el);
      }
    }

    if (!hasColorDifferentiation) {
      let totalInput = 0;
      for (const input of inputInfo) totalInput += input.amount;
      if (outputConns.length > 0) {
        const outConn = outputConns[0];
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const accepted = Math.min(totalInput, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + totalInput, max);
        }
      }
    } else {
      const mapping = createInputOutputMapping();
      for (const input of inputInfo) {
        const outputConnId = mapping.get(input.connId);
        if (outputConnId === undefined) continue;
        const outConn = outputConns.find(c => c.id === outputConnId);
        if (!outConn) continue;
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const accepted = Math.min(input.amount, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + input.amount, max);
        }
      }
    }
  } else {
    // pull any
    let canTrade = true;
    let minTrades = Infinity;
    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const stored = trader.traderInputs![`conn_${connId}`] || 0;
      if (stored < requiredAmount) {
        canTrade = false;
        break;
      }
      minTrades = Math.min(minTrades, Math.floor(stored / requiredAmount));
    }
    if (!canTrade || minTrades <= 0) return;

    for (const [connId, requiredAmount] of requiredInputs.entries()) {
      const key = `conn_${connId}`;
      trader.traderInputs![key] =
        (trader.traderInputs![key] || 0) - requiredAmount * minTrades;
    }

    if (!hasColorDifferentiation) {
      let totalInputPerTrade = 0;
      for (const input of inputInfo) totalInputPerTrade += input.amount;
      if (outputConns.length > 0) {
        const outConn = outputConns[0];
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const totalOutput = totalInputPerTrade * minTrades;
          const accepted = Math.min(totalOutput, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + totalOutput, max);
        }
      }
    } else {
      const mapping = createInputOutputMapping();
      for (const input of inputInfo) {
        const outputConnId = mapping.get(input.connId);
        if (outputConnId === undefined) continue;
        const outConn = outputConns.find(c => c.id === outputConnId);
        if (!outConn) continue;
        const outEl = elementMap.get(outConn.connectedToEnd!);
        if (outEl?.type === 'Pool') {
          const current = outEl.currentPoints ?? 0;
          const max = outEl.max ?? Infinity;
          const totalOutput = input.amount * minTrades;
          const accepted = Math.min(totalOutput, max - current);
          if (accepted > 0 && transfers)
            recordTransfer(transfers, outConn, accepted, trader);
          outEl.currentPoints = Math.min(current + totalOutput, max);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// simulateTick — the main exported pure function
// ---------------------------------------------------------------------------

export function simulateTick(
  elementsToUpdate: GraphElement[],
  activationType: 'automatic' | 'onstart' | 'interactive',
  options: TickOptions,
  interactiveElementId?: number
): TickResult {
  const { fractionalDispatch } = options;
  const currentTick = options.currentTick + 1;

  const transfers: ResourceTransfer[] = [];
  const events: TickResult['events'] = [];

  const nextElements = JSON.parse(
    JSON.stringify(elementsToUpdate)
  ) as GraphElement[];
  const elementMap = new Map<number, GraphElement>(
    nextElements.map(el => [el.id, el])
  );
  const forcedActivationIds = new Set<number>();
  const aiScriptCache = new Map<number, ReturnType<typeof parseAiScript>>();

  const getElementLabel = (element: GraphElement): string | undefined => {
    const withName = element as GraphElement & {
      name?: string;
      label?: string;
    };
    return element.text ?? withName.name ?? withName.label;
  };

  const labelToElement = new Map<string, GraphElement>();
  for (const element of nextElements) {
    const label = getElementLabel(element);
    if (label && !labelToElement.has(label)) labelToElement.set(label, element);
  }

  const resolveElementByIdentifier = (
    identifier: string
  ): GraphElement | undefined => {
    const trimmed = identifier.trim();
    if (!trimmed) return undefined;
    const byLabel = labelToElement.get(trimmed);
    if (byLabel) return byLabel;
    const id = Number(trimmed);
    if (!Number.isNaN(id)) return elementMap.get(id);
    return undefined;
  };

  const getValueForIdentifier = (identifier: string): number =>
    getElementValue(resolveElementByIdentifier(identifier));

  const queueForcedActivation = (identifier: string) => {
    const target = resolveElementByIdentifier(identifier);
    if (target) forcedActivationIds.add(target.id);
  };

  const isForcedActivation = (element: GraphElement): boolean =>
    forcedActivationIds.has(element.id);

  const registerDeltaById = new Map<number, number>();

  // ---- inhibition check ----
  const isConnectionInhibitedByState = (conn: GraphElement): boolean => {
    if (conn.type !== 'Resource Connection') return false;

    for (const sc of nextElements.filter(
      el => el.type === 'State Connection' && el.connectedToEnd === conn.id
    )) {
      const label = (sc.text ?? '').trim();
      const kind = classifyLabel(label);
      if (kind === 'cond' || kind === 'interval') {
        const startEl = elementMap.get(sc.connectedToStart!);
        if (!startEl) continue;
        const val = getElementValue(startEl);
        let satisfied = false;
        if (kind === 'cond') {
          const fn = parseCond(label);
          if (fn) satisfied = fn(val);
        } else {
          const rng = parseInterval(label);
          if (rng) satisfied = val >= rng[0] && val <= rng[1];
        }
        if (!satisfied) return true;
      }
    }

    const startNodeId = conn.connectedToStart;
    if (startNodeId != null) {
      for (const sc of nextElements.filter(
        el =>
          el.type === 'State Connection' && el.connectedToEnd === startNodeId
      )) {
        const label = (sc.text ?? '').trim();
        const kind = classifyLabel(label);
        if (kind === 'cond' || kind === 'interval') {
          const srcEl = elementMap.get(sc.connectedToStart!);
          if (!srcEl) continue;
          const val = getElementValue(srcEl);
          let satisfied = false;
          if (kind === 'cond') {
            const fn = parseCond(label);
            if (fn) satisfied = fn(val);
          } else {
            const rng = parseInterval(label);
            if (rng) satisfied = val >= rng[0] && val <= rng[1];
          }
          if (!satisfied) return true;
        }
      }
    }

    return false;
  };

  const updateAllConnectionInhibitionState = () => {
    for (const conn of nextElements) {
      if (conn.type === 'Resource Connection') {
        const isInhibited = isConnectionInhibitedByState(conn);
        conn.inhibited = isInhibited;
        conn.hasUnsatisfiedCondition = isInhibited;
      }
    }
  };

  // ---- color helpers ----
  const normalizeColor = (c?: string) => c || '#000000';

  const getResCount = (el: GraphElement, color: string): number =>
    el.resourcesByColor?.[color] || 0;

  const modResCount = (el: GraphElement, color: string, delta: number) => {
    if (!el.resourcesByColor) el.resourcesByColor = {};
    const current = el.resourcesByColor[color] || 0;
    el.resourcesByColor[color] =
      Math.round(Math.max(0, current + delta) * 100) / 100;
    el.currentPoints = Object.values(el.resourcesByColor).reduce(
      (a, b) => a + b,
      0
    );
  };

  const canTakeUnits = (
    start: GraphElement,
    units: number,
    color: string
  ): boolean => {
    if (units <= 0) return false;
    if (start.type === 'Source') return true;
    if (start.type === 'Pool') return getResCount(start, color) >= units;
    return false;
  };

  const takeUnits = (
    start: GraphElement,
    units: number,
    color: string
  ): number => {
    if (units <= 0) return 0;
    if (start.type === 'Source') return units;
    if (start.type === 'Pool') {
      const have = getResCount(start, color);
      const used = Math.min(have, units);
      modResCount(start, color, -used);
      return used;
    }
    return 0;
  };

  const deliverUnits = (
    outConn: GraphElement,
    units: number,
    sourceElement?: GraphElement
  ) => {
    if (units <= 0) return;
    const end = elementMap.get(outConn.connectedToEnd!);
    if (!end) return;
    const color = normalizeColor(outConn.color);
    if (outConn.type === 'Resource Connection') {
      if (transfers) recordTransfer(transfers, outConn, units, sourceElement);
    } else if (transfers) {
      transfers.push({ connectionId: outConn.id, units, color });
    }
    if (outConn.type === 'State Connection') {
      end.triggerCount = (end.triggerCount ?? 0) + units;
      return;
    }
    if (end.type === 'Pool') {
      const currentTotal = end.currentPoints ?? 0;
      const max = end.max ?? Infinity;
      const accepted = Math.min(units, max - currentTotal);
      if (accepted > 0) modResCount(end, color, accepted);
      return;
    }
    if (end.type === 'Delay') {
      if (!end.delayPendingArrivals) end.delayPendingArrivals = [];
      end.delayPendingArrivals.push({ amount: units, color });
    }
  };

  /** Intervals to hold each batch (Machinations: property on the retarder; UI "Actions"). */
  const getDelayIntervalTicks = (delay: GraphElement): number =>
    Math.max(1, Math.floor(delay.actions ?? 1));

  const flushDelayPendingToSlots = (delay: GraphElement) => {
    const pending = delay.delayPendingArrivals ?? [];
    delay.delayPendingArrivals = [];
    for (const p of pending) {
      const N = getDelayIntervalTicks(delay);
      if (delay.queue) {
        const slots = delay.delaySlots ?? [];
        if (slots.length === 0) {
          delay.delaySlots = [
            {
              ticksRemaining: N,
              amount: p.amount,
              color: p.color,
              skipDecrementOnce: true,
            },
          ];
        } else {
          if (!delay.delayWaitQueue) delay.delayWaitQueue = [];
          delay.delayWaitQueue.push(p);
        }
      } else {
        if (!delay.delaySlots) delay.delaySlots = [];
        delay.delaySlots.push({
          ticksRemaining: N,
          amount: p.amount,
          color: p.color,
          skipDecrementOnce: true,
        });
      }
    }
  };

  const releaseDelaySlot = (delay: GraphElement, slot: DelaySlot) => {
    const outputConns = nextElements.filter(
      c =>
        c.connectedToStart === delay.id &&
        (c.type === 'State Connection' ||
          (isResourceLikeConnection(c) && !c.inhibited))
    );
    const resourceOuts = outputConns.filter(isResourceLikeConnection);
    if (resourceOuts.length > 0) {
      const conn = resourceOuts[0];
      const labelValue = parseConnectionLabel(conn.text);
      const flow = handleDecimalResourceDispatch(
        conn,
        labelValue,
        fractionalDispatch,
        currentTick
      );
      const toSend = slot.amount * flow;
      if (toSend > 0) deliverUnits(conn, toSend, delay);
    }
    for (const sc of outputConns) {
      if (sc.type !== 'State Connection') continue;
      const raw = (sc.text ?? '').trim();
      if (shouldActivateTrigger(raw) || isTriggerOutput(raw)) {
        deliverUnits(sc, 1, delay);
      }
    }
  };

  // ==========================================================================
  // PASS 0: Initialization (onstart only)
  // ==========================================================================
  if (activationType === 'onstart') {
    for (const element of nextElements) {
      if (element.type === 'Pool') {
        if (!element.resourcesByColor) {
          element.resourcesByColor = {};
          const startVal =
            typeof element.number === 'string'
              ? parseInt(element.number) || 0
              : element.number || 0;
          if (startVal > 0) {
            const poolColor = normalizeColor(element.color);
            element.resourcesByColor[poolColor] = startVal;
            element.currentPoints = startVal;
          } else {
            element.currentPoints = 0;
          }
        }
      }
      if (element.type === 'End Condition') {
        element.inhibited = true;
        element.isBlinking = false;
      }
      if (element.type === 'Convertor' && !element.inputResources)
        element.inputResources = {};
      if (element.type === 'Trader') {
        if (!element.traderInputs) element.traderInputs = {};
        if (!element.traderOutputs) element.traderOutputs = {};
      }
      if (element.type === 'Chart') {
        const defaultScaleX = element.chartScaleX ?? 0;
        const defaultScaleY = element.chartScaleY ?? 0;
        if (!element.chartState) {
          element.chartState = createInitialChartState(
            defaultScaleX,
            defaultScaleY
          );
        }
        element.chartState.runs += 1;
        element.chartState.highLighted = element.chartState.runs - 1;
        element.chartState.tick = 0;
        const inputConnections = nextElements.filter(
          conn =>
            conn.type === 'State Connection' &&
            conn.connectedToEnd === element.id
        );
        for (const conn of inputConnections) {
          const sourceElement = elementMap.get(conn.connectedToStart!);
          const initialValue = sourceElement
            ? getElementValue(sourceElement)
            : 0;
          const name = sourceElement?.text || '';
          const series = createChartDataSeries(
            conn.id,
            conn.color || '#000000',
            conn.thickness || 2,
            name,
            initialValue,
            element.chartState.highLighted
          );
          element.chartState.dataSeries.push(series);
        }
      }
    }
  }

  // Reset tick flags
  for (const el of nextElements) {
    if (el.type === 'State Connection') el.conditionSatisfied = undefined;
    if (el.hasUnsatisfiedCondition) el.hasUnsatisfiedCondition = false;
  }
  updateAllConnectionInhibitionState();

  // ==========================================================================
  // PASS 0.5: State Connections (Modifiers & Triggers)
  // ==========================================================================
  for (const connection of nextElements) {
    if (
      connection.type !== 'State Connection' ||
      connection.connectedToStart == null ||
      connection.connectedToEnd == null
    )
      continue;
    const startEl = elementMap.get(connection.connectedToStart);
    const endEl = elementMap.get(connection.connectedToEnd);
    if (!startEl || !endEl) continue;
    if (endEl.type === 'End Condition') continue;
    if (endEl.type === 'Resource Connection') continue;

    const rawLabel = (connection.text ?? '').trim();
    const kind = classifyLabel(rawLabel);

    if (kind === 'prob' || kind === 'empty') {
      const perUnit = parseConnectionLabel(rawLabel);
      if (endEl.type === 'Register') {
        let delta = perUnit;
        if (startEl.type === 'Pool') delta = perUnit * getElementValue(startEl);
        if (delta !== 0)
          registerDeltaById.set(
            endEl.id,
            (registerDeltaById.get(endEl.id) ?? 0) + delta
          );
      }
    }

    const isLabelTrigger =
      shouldActivateTrigger(rawLabel) || isTriggerOutput(rawLabel);
    if (startEl.type === 'Gate' || isLabelTrigger) {
      endEl.triggerCount = (endEl.triggerCount ?? 0) + 1;
    }
  }

  applyDynamicResourceLabelsMutable(nextElements);

  // ==========================================================================
  // PASS 0.8: Artificial Intelligence
  // ==========================================================================
  const consumePassiveTrigger = (el: GraphElement) => {
    if ((el.triggerCount ?? 0) > 0) {
      el.triggerCount = (el.triggerCount ?? 0) - 1;
      return true;
    }
    return false;
  };

  for (const ai of nextElements) {
    if (ai.type !== 'Artifical Intelligence') continue;
    const isForced = isForcedActivation(ai);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (ai.activation === 'automatic') active = true;
        else if (ai.activation === 'passive' && consumePassiveTrigger(ai))
          active = true;
      } else if (activationType === 'interactive') {
        if (ai.activation === 'interactive' && interactiveElementId === ai.id)
          active = true;
      } else if (activationType === 'onstart') {
        if (ai.activation === 'onstart' && !ai.hasStarted) active = true;
      }
    }
    if (!active) continue;
    const actions = Math.max(1, ai.actions ?? 1);
    const cachedLines = aiScriptCache.get(ai.id);
    const lines = cachedLines ?? parseAiScript(ai.script ?? '');
    if (!cachedLines) aiScriptCache.set(ai.id, lines);
    for (let a = 0; a < actions; a++) {
      const command = selectAiCommand(lines, getValueForIdentifier);
      if (!command) break;
      if (command.type === 'fire') {
        command.targets.forEach(queueForcedActivation);
      } else {
        const choices = command.targets;
        if (choices.length > 0) {
          queueForcedActivation(choices[Math.floor(random() * choices.length)]);
        }
      }
    }
    if (activationType === 'onstart') ai.hasStarted = true;
  }

  // ==========================================================================
  // PASS 1: Pools
  // ==========================================================================
  for (const pool of nextElements) {
    if (pool.type !== 'Pool') continue;
    const isForced = isForcedActivation(pool);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (pool.activation === 'automatic') active = true;
        else if (pool.activation === 'passive' && consumePassiveTrigger(pool))
          active = true;
      } else if (activationType === 'interactive') {
        if (
          pool.activation === 'interactive' &&
          interactiveElementId === pool.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (pool.activation === 'onstart' && !pool.hasStarted) active = true;
      }
    }
    if (!active) continue;

    // PULL
    const inputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToEnd === pool.id &&
        !c.inhibited
    );
    const validInputs = inputConns.filter(c => {
      const start = elementMap.get(c.connectedToStart!);
      return !start || start.type !== 'Source';
    });
    const requirements = validInputs
      .map(conn => {
        const labelValue = parseConnectionLabel(conn.text);
        const units = handleDecimalResourceDispatch(
          conn,
          labelValue,
          fractionalDispatch,
          currentTick
        );
        return {
          conn,
          units,
          color: normalizeColor(conn.color),
          startEl: elementMap.get(conn.connectedToStart!),
        };
      })
      .filter(r => r.startEl && r.units > 0);

    if (pool.pullMode === 'pull all') {
      if (requirements.every(r => canTakeUnits(r.startEl!, r.units, r.color))) {
        requirements.forEach(r => {
          const taken = takeUnits(r.startEl!, r.units, r.color);
          const space = (pool.max ?? Infinity) - (pool.currentPoints ?? 0);
          const accepted = Math.min(taken, space);
          modResCount(pool, r.color, accepted);
          recordTransfer(transfers, r.conn, accepted, r.startEl);
        });
      }
    } else {
      for (const r of requirements) {
        if (canTakeUnits(r.startEl!, r.units, r.color)) {
          const taken = takeUnits(r.startEl!, r.units, r.color);
          const space = (pool.max ?? Infinity) - (pool.currentPoints ?? 0);
          const accepted = Math.min(taken, space);
          modResCount(pool, r.color, accepted);
          recordTransfer(transfers, r.conn, accepted, r.startEl);
          break;
        }
      }
    }

    // PUSH
    if (pool.pullMode === 'push any' || pool.pullMode === 'push all') {
      const outputConns = nextElements.filter(
        c =>
          isResourceLikeConnection(c) &&
          c.connectedToStart === pool.id &&
          !c.inhibited
      );
      const outputs = outputConns
        .map(conn => {
          const labelValue = parseConnectionLabel(conn.text);
          const units = handleDecimalResourceDispatch(
            conn,
            labelValue,
            fractionalDispatch,
            currentTick
          );
          return {
            conn,
            units,
            color: normalizeColor(conn.color),
            endEl: elementMap.get(conn.connectedToEnd!),
          };
        })
        .filter(o => o.endEl && o.units > 0);

      if (pool.pullMode === 'push all') {
        const allAvail = outputs.every(
          o => getResCount(pool, o.color) >= o.units
        );
        if (allAvail) {
          outputs.forEach(o => {
            let canDeliver = true;
            if (o.endEl!.type === 'Pool') {
              const cap =
                (o.endEl!.max ?? Infinity) - (o.endEl!.currentPoints ?? 0);
              if (cap < o.units) canDeliver = false;
            }
            if (canDeliver) {
              modResCount(pool, o.color, -o.units);
              if (o.endEl!.type === 'Pool')
                modResCount(o.endEl!, o.color, o.units);
              else if (o.endEl!.type === 'Delay') {
                if (!o.endEl!.delayPendingArrivals)
                  o.endEl!.delayPendingArrivals = [];
                o.endEl!.delayPendingArrivals.push({
                  amount: o.units,
                  color: o.color,
                });
              }
              recordTransfer(transfers, o.conn, o.units, pool);
            }
          });
        }
      } else {
        for (const o of outputs) {
          if (getResCount(pool, o.color) >= o.units) {
            let canDeliver = true;
            if (o.endEl!.type === 'Pool') {
              const cap =
                (o.endEl!.max ?? Infinity) - (o.endEl!.currentPoints ?? 0);
              if (cap < o.units) canDeliver = false;
            }
            if (canDeliver) {
              modResCount(pool, o.color, -o.units);
              if (o.endEl!.type === 'Pool')
                modResCount(o.endEl!, o.color, o.units);
              else if (o.endEl!.type === 'Delay') {
                if (!o.endEl!.delayPendingArrivals)
                  o.endEl!.delayPendingArrivals = [];
                o.endEl!.delayPendingArrivals.push({
                  amount: o.units,
                  color: o.color,
                });
              }
              recordTransfer(transfers, o.conn, o.units, pool);
            }
          }
        }
      }
    }
    if (activationType === 'onstart') pool.hasStarted = true;
  }

  // ==========================================================================
  // PASS 2: Gates
  // ==========================================================================
  for (const gate of nextElements) {
    if (gate.type !== 'Gate') continue;
    const isForced = isForcedActivation(gate);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (gate.activation === 'automatic') active = true;
        else if (gate.activation === 'passive' && consumePassiveTrigger(gate))
          active = true;
      } else if (activationType === 'interactive') {
        if (
          gate.activation === 'interactive' &&
          interactiveElementId === gate.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (gate.activation === 'onstart' && !gate.hasStarted) active = true;
      }
    }
    if (
      !active ||
      (!isForced && activationType !== 'onstart' && gate.hasStarted)
    )
      continue;

    const inputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToEnd === gate.id &&
        !c.inhibited
    );
    const outputConns = nextElements.filter(
      c =>
        (isResourceLikeConnection(c) || c.type === 'State Connection') &&
        c.connectedToStart === gate.id &&
        !(c.type === 'Resource Connection' && c.inhibited)
    );
    const actions = Math.max(1, gate.actions ?? 1);

    for (let a = 0; a < actions; a++) {
      const inputs = inputConns
        .map(conn => ({
          conn,
          units: parseConnectionLabel(conn.text),
          color: normalizeColor(conn.color),
          startEl: elementMap.get(conn.connectedToStart!),
        }))
        .filter(i => i.startEl && i.units > 0);

      if (gate.pullMode === 'pull all') {
        const allAvail = inputs.every(i =>
          canTakeUnits(i.startEl!, i.units, i.color)
        );
        if (!allAvail) break;
        inputs.forEach(i => {
          const taken = takeUnits(i.startEl!, i.units, i.color);
          if (taken > 0) {
            recordTransfer(transfers, i.conn, taken, i.startEl);
            for (let k = 0; k < taken; k++) {
              chooseGateOutputs(gate, outputConns).forEach(out =>
                deliverUnits(out, 1, i.startEl)
              );
            }
          }
        });
      } else {
        for (const i of inputs) {
          if (canTakeUnits(i.startEl!, i.units, i.color)) {
            const taken = takeUnits(i.startEl!, i.units, i.color);
            if (taken > 0) {
              recordTransfer(transfers, i.conn, taken, i.startEl);
              for (let k = 0; k < taken; k++) {
                chooseGateOutputs(gate, outputConns).forEach(out =>
                  deliverUnits(out, 1, i.startEl)
                );
              }
            }
          }
        }
      }
    }
    if (activationType === 'onstart') gate.hasStarted = true;
  }

  // ==========================================================================
  // PASS 2.5: Sources
  // ==========================================================================
  for (const source of nextElements) {
    if (source.type !== 'Source') continue;
    const isForced = isForcedActivation(source);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (source.activation === 'automatic') active = true;
        else if (
          source.activation === 'passive' &&
          consumePassiveTrigger(source)
        )
          active = true;
      } else if (activationType === 'interactive') {
        if (
          source.activation === 'interactive' &&
          interactiveElementId === source.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (source.activation === 'onstart' && !source.hasStarted)
          active = true;
      }
    }
    const canRun =
      isForced || activationType !== 'onstart' || !source.hasStarted;
    if (active && canRun) {
      const outputConns = nextElements.filter(
        c =>
          isResourceLikeConnection(c) &&
          c.connectedToStart === source.id &&
          !c.inhibited
      );
      outputConns.forEach(conn => {
        const labelValue = parseConnectionLabel(conn.text);
        if (labelValue > 0) {
          const amount = handleDecimalResourceDispatch(
            conn,
            labelValue,
            fractionalDispatch,
            currentTick
          );
          if (amount > 0) deliverUnits(conn, amount, source);
        }
      });
      if (activationType === 'onstart') source.hasStarted = true;
    }
  }

  // ==========================================================================
  // PASS 2.7: Drains
  // ==========================================================================
  for (const drain of nextElements) {
    if (drain.type !== 'Drain') continue;
    const isForced = isForcedActivation(drain);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (drain.activation === 'automatic') active = true;
        else if (drain.activation === 'passive' && consumePassiveTrigger(drain))
          active = true;
      } else if (activationType === 'interactive') {
        if (
          drain.activation === 'interactive' &&
          interactiveElementId === drain.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (drain.activation === 'onstart' && !drain.hasStarted) active = true;
      }
    }
    const canRun =
      isForced || activationType !== 'onstart' || !drain.hasStarted;
    if (active && canRun) {
      const inputConns = nextElements.filter(
        c =>
          isResourceLikeConnection(c) &&
          c.connectedToEnd === drain.id &&
          !c.inhibited
      );
      inputConns.forEach(conn => {
        const startEl = elementMap.get(conn.connectedToStart!);
        const labelValue = parseConnectionLabel(conn.text);
        const color = normalizeColor(conn.color);
        if (startEl && labelValue > 0) {
          const amount = handleDecimalResourceDispatch(
            conn,
            labelValue,
            fractionalDispatch,
            currentTick
          );
          if (amount > 0 && canTakeUnits(startEl, amount, color)) {
            const taken = takeUnits(startEl, amount, color);
            recordTransfer(transfers, conn, taken, startEl);
            const stateOuts = nextElements.filter(
              c =>
                c.type === 'State Connection' &&
                c.connectedToStart === drain.id &&
                (isTriggerOutput(c.text) || shouldActivateTrigger(c.text))
            );
            stateOuts.forEach(out => {
              const target = elementMap.get(out.connectedToEnd!);
              if (target) target.triggerCount = (target.triggerCount ?? 0) + 1;
            });
          }
        }
      });
      if (activationType === 'onstart') drain.hasStarted = true;
    }
  }

  // ==========================================================================
  // PASS 3: Convertors
  // ==========================================================================
  for (const convertor of nextElements) {
    if (convertor.type !== 'Convertor') continue;
    const isForced = isForcedActivation(convertor);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (convertor.activation === 'automatic') active = true;
        else if (
          convertor.activation === 'passive' &&
          consumePassiveTrigger(convertor)
        )
          active = true;
      } else if (activationType === 'interactive') {
        if (
          convertor.activation === 'interactive' &&
          interactiveElementId === convertor.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (convertor.activation === 'onstart' && !convertor.hasStarted)
          active = true;
      }
    }
    if (!active) continue;

    if (!convertor.inputResources) convertor.inputResources = {};
    const inputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToEnd === convertor.id &&
        !c.inhibited
    );
    const outputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToStart === convertor.id &&
        !c.inhibited
    );
    if (inputConns.length === 0 || outputConns.length === 0) {
      if (activationType === 'onstart') convertor.hasStarted = true;
      continue;
    }

    const actions = Math.max(1, convertor.actions ?? 1);
    for (let a = 0; a < actions; a++) {
      const inputs = inputConns
        .map(conn => ({
          conn,
          units: parseConnectionLabel(conn.text),
          color: normalizeColor(conn.color),
          key: conn.text || 'default',
          startEl: elementMap.get(conn.connectedToStart!),
        }))
        .filter(i => i.units > 0);

      const outputs = outputConns
        .map(conn => {
          const raw = (conn.text ?? '').trim();
          const percentMatch = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
          const probability = percentMatch
            ? Math.min(1, Math.max(0, parseFloat(percentMatch[1]) / 100))
            : undefined;
          return {
            conn,
            units: percentMatch ? 1 : parseConnectionLabel(conn.text),
            probability,
            color: normalizeColor(conn.color),
            endEl: elementMap.get(conn.connectedToEnd!),
          };
        })
        .filter(o => o.units > 0);

      const anyMultiplicandInputZero = inputConns.some(
        conn =>
          (conn.text ?? '').includes('*') &&
          parseConnectionLabel(conn.text) === 0
      );
      const ratios = inputs
        .filter(i => (i.conn.text ?? '').includes('*'))
        .map(i => {
          const base = getBaseInputAmountFromMultiplyLabel(i.conn.text);
          return base != null && base > 0 ? Math.floor(i.units / base) : 1;
        });
      const speedFactor = anyMultiplicandInputZero
        ? 0
        : ratios.length > 0
          ? Math.min(...ratios)
          : 1;

      let canConvert = !anyMultiplicandInputZero;
      if (canConvert && convertor.pullMode === 'pull all') {
        canConvert = inputs.every(i => {
          const stored = convertor.inputResources![i.key] || 0;
          if (stored >= i.units) return true;
          return i.startEl && canTakeUnits(i.startEl, i.units, i.color);
        });
      } else if (canConvert) {
        canConvert = inputs.some(i => {
          const stored = convertor.inputResources![i.key] || 0;
          if (stored >= i.units) return true;
          return i.startEl && canTakeUnits(i.startEl, i.units, i.color);
        });
      }

      if (canConvert) {
        inputs.forEach(i => {
          let amountNeeded = i.units;
          const stored = convertor.inputResources![i.key] || 0;
          if (stored >= amountNeeded) {
            convertor.inputResources![i.key] = stored - amountNeeded;
            amountNeeded = 0;
          } else if (stored > 0) {
            amountNeeded -= stored;
            convertor.inputResources![i.key] = 0;
          }
          if (amountNeeded > 0 && i.startEl) {
            if (
              convertor.pullMode === 'pull all' ||
              canTakeUnits(i.startEl, amountNeeded, i.color)
            ) {
              const taken = takeUnits(i.startEl, amountNeeded, i.color);
              if (taken < amountNeeded && convertor.pullMode === 'pull any') {
                convertor.inputResources![i.key] =
                  (convertor.inputResources![i.key] || 0) + taken;
              }
              if (taken > 0)
                recordTransfer(transfers, i.conn, taken, i.startEl);
            }
          }
        });
        outputs.forEach(o => {
          if (typeof o.probability === 'number' && random() > o.probability)
            return;
          deliverUnits(o.conn, o.units * speedFactor, convertor);
        });
      } else {
        if (convertor.pullMode === 'pull any') {
          for (const inputConn of inputConns) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            const req = inputs.find(i => i.conn.id === inputConn.id);
            if (!req) continue;
            if (
              inputElement?.type === 'Pool' &&
              getResCount(inputElement, req.color) > 0
            ) {
              const available = Math.min(
                req.units,
                getResCount(inputElement, req.color)
              );
              if (available > 0) {
                modResCount(inputElement, req.color, -available);
                recordTransfer(transfers, inputConn, available, inputElement);
                const resourceKey = inputConn.text || 'default';
                convertor.inputResources![resourceKey] =
                  (convertor.inputResources![resourceKey] || 0) + available;
              }
            }
          }
        }
      }
    }
    if (activationType === 'onstart') convertor.hasStarted = true;
  }

  // ==========================================================================
  // PASS 4: Traders
  // ==========================================================================
  for (const trader of nextElements) {
    if (trader.type !== 'Trader') continue;
    if (!trader.traderInputs) trader.traderInputs = {};
    if (!trader.traderOutputs) trader.traderOutputs = {};

    const inputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToEnd === trader.id &&
        !c.inhibited
    );
    const outputConns = nextElements.filter(
      c =>
        isResourceLikeConnection(c) &&
        c.connectedToStart === trader.id &&
        !c.inhibited
    );
    const triggerConns = nextElements.filter(
      c => c.type === 'State Connection' && c.connectedToEnd === trader.id
    );
    if (inputConns.length === 0 || outputConns.length === 0) {
      if (activationType === 'onstart') trader.hasStarted = true;
      continue;
    }

    const isIncomplete = inputConns.length < 2 || outputConns.length < 2;
    trader.isIncompleteTrader = isIncomplete;

    let isActivated = false;
    if (triggerConns.length > 0) {
      if ((trader.triggerCount ?? 0) > 0) {
        isActivated = true;
        trader.triggerCount = (trader.triggerCount ?? 0) - 1;
      }
    }
    if (!isActivated) {
      for (const inputConn of inputConns) {
        const el = inputConn.connectedToStart
          ? elementMap.get(inputConn.connectedToStart)
          : undefined;
        if (el) {
          if (el.type === 'Source') {
            isActivated = true;
            break;
          }
          if (el.type === 'Pool' && (el.currentPoints ?? 0) > 0) {
            isActivated = true;
            break;
          }
        }
      }
    }

    const isForced = isForcedActivation(trader);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (trader.activation === 'automatic') active = true;
        else if (
          trader.activation === 'passive' &&
          consumePassiveTrigger(trader)
        )
          active = true;
      } else if (activationType === 'interactive') {
        if (
          trader.activation === 'interactive' &&
          interactiveElementId === trader.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (trader.activation === 'onstart' && !trader.hasStarted)
          active = true;
      }
    }
    const canFire =
      isForced || activationType !== 'onstart' || !trader.hasStarted;

    if (trader.pullMode === 'pull any' && active && canFire) {
      for (const inputConn of inputConns) {
        const inputElement = inputConn.connectedToStart
          ? elementMap.get(inputConn.connectedToStart)
          : undefined;
        const amount = parseConnectionLabel(inputConn.text);
        const color = normalizeColor(inputConn.color);
        if (inputElement?.type === 'Pool') {
          const avail = Math.min(amount, getResCount(inputElement, color));
          if (avail > 0) {
            modResCount(inputElement, color, -avail);
            const key = `conn_${inputConn.id}`;
            trader.traderInputs![key] =
              (trader.traderInputs![key] || 0) + avail;
            recordTransfer(transfers, inputConn, avail, inputElement);
          }
        } else if (inputElement?.type === 'Source') {
          const key = `conn_${inputConn.id}`;
          trader.traderInputs![key] = (trader.traderInputs![key] || 0) + amount;
          recordTransfer(transfers, inputConn, amount, inputElement);
        }
      }
    }

    if (!(isActivated && active && canFire)) {
      if (activationType === 'onstart') trader.hasStarted = true;
      continue;
    }

    const actions = Math.max(1, trader.actions ?? 1);
    for (let a = 0; a < actions; a++) {
      if (isIncomplete) {
        processIncompleteTrader(
          trader,
          inputConns,
          outputConns,
          elementMap,
          transfers
        );
      } else {
        processCompleteTrader(
          trader,
          inputConns,
          outputConns,
          elementMap,
          transfers
        );
      }
    }
    if (activationType === 'onstart') trader.hasStarted = true;
  }

  // ==========================================================================
  // PASS 4.5: Delay (retarder)
  // ==========================================================================
  for (const delay of nextElements) {
    if (delay.type !== 'Delay') continue;
    const isForced = isForcedActivation(delay);
    let active = isForced;
    if (!active) {
      if (activationType === 'automatic') {
        if (delay.activation === 'automatic') active = true;
        else if (delay.activation === 'passive' && consumePassiveTrigger(delay))
          active = true;
      } else if (activationType === 'interactive') {
        if (
          delay.activation === 'interactive' &&
          interactiveElementId === delay.id
        )
          active = true;
      } else if (activationType === 'onstart') {
        if (delay.activation === 'onstart' && !delay.hasStarted) active = true;
      }
    }
    if (!active) continue;

    flushDelayPendingToSlots(delay);

    const kept: DelaySlot[] = [];
    const released: DelaySlot[] = [];
    for (const slot of delay.delaySlots ?? []) {
      if (slot.skipDecrementOnce) {
        slot.skipDecrementOnce = false;
        kept.push(slot);
        continue;
      }
      if (slot.ticksRemaining > 0) slot.ticksRemaining--;
      if (slot.ticksRemaining <= 0) released.push(slot);
      else kept.push(slot);
    }
    delay.delaySlots = kept;

    for (const slot of released) {
      releaseDelaySlot(delay, slot);
      delay.triggerCount = (delay.triggerCount ?? 0) + 1;
    }

    if (delay.queue) {
      while (
        (delay.delaySlots?.length ?? 0) === 0 &&
        (delay.delayWaitQueue?.length ?? 0) > 0
      ) {
        const next = delay.delayWaitQueue!.shift()!;
        const N = getDelayIntervalTicks(delay);
        delay.delaySlots = [
          {
            ticksRemaining: N,
            amount: next.amount,
            color: next.color,
            skipDecrementOnce: true,
          },
        ];
      }
    }

    if (activationType === 'onstart') delay.hasStarted = true;
  }

  // ==========================================================================
  // PASS 5: Registers
  // ==========================================================================
  for (const register of nextElements) {
    if (register.type !== 'Register') continue;
    const min = register.minValue ?? -9999;
    const max = register.maxValue ?? 9999;
    const delta = registerDeltaById.get(register.id) ?? 0;
    const isInteractive =
      register.interactive === true || register.interactive === 'true';
    if (register.currentValue === undefined)
      register.currentValue = register.startingValue ?? 0;

    if (isInteractive) {
      if (delta !== 0) applyStateConnectionDelta(register, delta);
      continue;
    }

    let baseValue = register.startingValue ?? 0;
    const inputConns = nextElements.filter(
      c => c.type === 'State Connection' && c.connectedToEnd === register.id
    );
    if (inputConns.length > 0 && register.formula) {
      try {
        const variables = new Array(23).fill(0);
        for (const conn of inputConns) {
          const label = (conn.text || '').trim().toLowerCase();
          if (label.length === 1 && RegisterExpression.isVariable(label)) {
            const idx = label.charCodeAt(0) - 97;
            const src = elementMap.get(conn.connectedToStart!);
            variables[idx] = getElementValue(src);
          }
        }
        const postfix = RegisterExpression.toPostfix(register.formula);
        const val = RegisterExpression.evaluate(postfix, variables);
        baseValue = Math.floor(Math.min(Math.max(val, min), max));
      } catch {
        baseValue = 0;
      }
    }
    const nextVal = baseValue + delta;
    register.currentValue = Math.min(Math.max(Math.floor(nextVal), min), max);
  }

  // ==========================================================================
  // PASS 6: End Conditions
  // ==========================================================================
  for (const endCond of nextElements) {
    if (endCond.type !== 'End Condition') continue;
    const inputConns = nextElements.filter(
      c => c.type === 'State Connection' && c.connectedToEnd === endCond.id
    );
    if (inputConns.length === 0) continue;

    let allMet = true;
    for (const conn of inputConns) {
      const startEl = elementMap.get(conn.connectedToStart!);
      const label = (conn.text || '').trim();
      const kind = classifyLabel(label);
      if (startEl && kind === 'cond') {
        const fn = parseCond(label);
        if (fn) {
          const val = getElementValue(startEl);
          const satisfied = fn(val);
          conn.conditionSatisfied = satisfied;
          conn.hasUnsatisfiedCondition = !satisfied;
          if (!satisfied) allMet = false;
        }
      } else if (startEl && kind === 'interval') {
        const range = parseInterval(label);
        if (range) {
          const val = getElementValue(startEl);
          const satisfied = val >= range[0] && val <= range[1];
          conn.conditionSatisfied = satisfied;
          conn.hasUnsatisfiedCondition = !satisfied;
          if (!satisfied) allMet = false;
        }
      }
    }

    const wasInhibited = endCond.inhibited;
    endCond.inhibited = !allMet;

    if (
      wasInhibited &&
      !endCond.inhibited &&
      (activationType === 'automatic' || activationType === 'onstart')
    ) {
      endCond.isBlinking = true;
      events.push({
        type: 'game_end',
        payload: { message: endCond.text || 'Victory!' },
      });
    }
  }

  updateStateConnectionVisualState(nextElements);

  // ==========================================================================
  // PASS 7: Chart data collection
  // ==========================================================================
  for (const chart of nextElements) {
    if (chart.type !== 'Chart' || !chart.chartState) continue;
    if (activationType !== 'automatic') continue;

    chart.chartState.tick += 1;

    const inputConnections = nextElements.filter(
      conn =>
        conn.type === 'State Connection' && conn.connectedToEnd === chart.id
    );
    for (const conn of inputConnections) {
      const sourceElement = elementMap.get(conn.connectedToStart!);
      if (!sourceElement) continue;
      let value = getElementValue(sourceElement);
      const labelValue = parseFloat(conn.text || '1') || 1;
      value = value * labelValue;
      if (isNaN(value)) value = 0;

      if (
        chart.chartState.defaultScaleX > 0 &&
        chart.chartState.tick > chart.chartState.defaultScaleX
      )
        continue;
      if (
        chart.chartState.defaultScaleY > 0 &&
        value > chart.chartState.defaultScaleY
      )
        continue;

      const series = chart.chartState.dataSeries.find(
        s =>
          s.connectionId === conn.id && s.run === chart.chartState!.highLighted
      );
      if (series) {
        series.data.push(value);
        if (chart.chartState.defaultScaleY === 0) {
          chart.chartState.scaleY = autoExpandScaleY(
            chart.chartState.scaleY,
            value
          );
        }
        if (chart.chartState.defaultScaleY >= 0 && value < 0) {
          chart.chartState.negScaleY = autoExpandNegScaleY(
            chart.chartState.negScaleY,
            value
          );
        }
      }
    }

    if (
      chart.chartState.defaultScaleX <= 0 &&
      chart.chartState.tick > chart.chartState.scaleX &&
      chart.chartState.scaleX <= (chart.chartWidth || 200) - 10
    ) {
      chart.chartState.scaleX += 10;
    }
  }

  return { nextElements, transfers, events };
}
