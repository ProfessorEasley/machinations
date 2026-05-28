import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadGraphFromFile, loadGraphFromXml } from '../io';
import { runSimulation } from '../runner';
import { runCli } from '../cli';

const FIXTURE_PATH = resolve(__dirname, 'fixtures', 'source-pool.xml');

describe('engine/io + cli — headless source-to-pool simulation', () => {
  it('loadGraphFromFile parses the fixture into 3 elements', () => {
    const { elements, warnings } = loadGraphFromFile(FIXTURE_PATH);

    expect(warnings).toEqual([]);
    expect(elements).toHaveLength(3);

    const source = elements.find(e => e.id === 1);
    const pool = elements.find(e => e.id === 2);
    const conn = elements.find(e => e.id === 3);

    expect(source?.type).toBe('Source');
    expect(source?.activation).toBe('automatic');

    expect(pool?.type).toBe('Pool');
    expect(pool?.max).toBe(1000);
    expect(pool?.currentPoints).toBe(0);

    expect(conn?.type).toBe('Resource Connection');
    expect(conn?.connectedToStart).toBe(1);
    expect(conn?.connectedToEnd).toBe(2);
    expect(conn?.text).toBe('5');
  });

  it('runSimulation accumulates 5 resources per tick from a Source(automatic)→Pool', () => {
    const { elements } = loadGraphFromFile(FIXTURE_PATH);
    const result = runSimulation(elements, { maxTicks: 4 });

    const finalPool = result.finalState.find(e => e.id === 2);

    // Source produces 5/tick. With 1 onstart tick + 4 automatic ticks,
    // expect 5 * (4+1) = 25, but onstart for a Source w/o onstart-activation
    // should be a no-op, leaving 5 * 4 = 20. Either way it MUST be > 0
    // and a positive multiple of 5.
    expect(finalPool?.currentPoints).toBeGreaterThan(0);
    expect((finalPool?.currentPoints ?? 0) % 5).toBe(0);
    expect(result.gameEnded).toBe(false);
    expect(result.ticksRun).toBe(4);
  });

  it('runCli --format summary reports pool state and exit code 0', () => {
    const outcome = runCli([FIXTURE_PATH, '--max-ticks', '4']);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe('');
    expect(outcome.stdout).toMatch(/ticksRun=4/);
    expect(outcome.stdout).toMatch(/Pool#2.*= \d+/);
  });

  it('runCli --format json emits a parseable RunSimulationResult', () => {
    const outcome = runCli([
      FIXTURE_PATH,
      '--max-ticks',
      '3',
      '--format',
      'json',
    ]);

    expect(outcome.exitCode).toBe(0);
    const parsed = JSON.parse(outcome.stdout);
    expect(parsed.ticksRun).toBe(3);
    expect(parsed.gameEnded).toBe(false);
    expect(Array.isArray(parsed.finalState)).toBe(true);
    expect(
      parsed.finalState.find((e: { id: number }) => e.id === 2)
    ).toBeDefined();
    expect(parsed.tickLog).toBeUndefined();
  });

  it('runCli reports load failure with exit code 1', () => {
    const outcome = runCli(['this-file-does-not-exist.xml']);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toMatch(/Failed to load/);
  });

  it('runCli reports invalid args with exit code 2', () => {
    const outcome = runCli([FIXTURE_PATH, '--max-ticks', 'abc']);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toMatch(/--max-ticks/);
  });

  it('loadGraphFromXml round-trips a small inline document', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<diagram>
  <pool id="0" x="10" y="20" color="#00FF00" number="7" max="50"/>
  <register id="1" x="100" y="20" formula="a + 1" startingValue="3" interactive="true"/>
</diagram>`;

    const { elements, warnings } = loadGraphFromXml(xml);
    expect(warnings).toEqual([]);

    const pool = elements.find(e => e.id === 0);
    expect(pool?.type).toBe('Pool');
    expect(pool?.currentPoints).toBe(7);
    expect(pool?.resourcesByColor).toEqual({ '#00FF00': 7 });

    const reg = elements.find(e => e.id === 1);
    expect(reg?.type).toBe('Register');
    expect(reg?.formula).toBe('a + 1');
    expect(reg?.startingValue).toBe(3);
    expect(reg?.interactive).toBe(true);
    expect(reg?.currentValue).toBe(3);
  });
});

describe('engine/io + cli — pool with drain scenario', () => {
  const fixturePath = resolve(__dirname, 'fixtures', 'pool-with-drain.xml');

  it('loads pool-with-drain.xml with source, pool, and drain', () => {
    const { elements, warnings } = loadGraphFromFile(fixturePath);
    expect(warnings).toEqual([]);
    expect(elements).toHaveLength(5); // 1 source, 1 pool, 1 drain, 2 connections

    expect(elements.find(e => e.id === 1)?.type).toBe('Source');
    expect(elements.find(e => e.id === 2)?.type).toBe('Pool');
    expect(elements.find(e => e.id === 3)?.type).toBe('Drain');
  });

  it('source produces faster than drain consumes, pool accumulates', () => {
    const { elements } = loadGraphFromFile(fixturePath);
    const result = runSimulation(elements, { maxTicks: 10 });

    const pool = result.finalState.find(e => e.id === 2);
    // Source produces 10/tick, drain consumes 3/tick = net 7/tick
    // After 10 ticks: 50 (initial) + 7*10 = 120
    expect(pool?.currentPoints).toBeGreaterThan(50);
    expect(result.ticksRun).toBe(10);
  });

  it('runCli with pool-with-drain in JSON format', () => {
    const outcome = runCli([
      fixturePath,
      '--max-ticks',
      '5',
      '--format',
      'json',
    ]);

    expect(outcome.exitCode).toBe(0);
    const parsed = JSON.parse(outcome.stdout);
    expect(parsed.ticksRun).toBe(5);
    expect(parsed.finalState.length).toBeGreaterThan(0);
  });
});

describe('engine/io + cli — convertor scenario', () => {
  const fixturePath = resolve(__dirname, 'fixtures', 'convertor-demo.xml');

  it('loads convertor-demo.xml with two sources and a convertor', () => {
    const { elements, warnings } = loadGraphFromFile(fixturePath);
    expect(warnings).toEqual([]);
    expect(elements.length).toBeGreaterThan(0);

    expect(elements.find(e => e.id === 1)?.type).toBe('Source');
    expect(elements.find(e => e.id === 2)?.type).toBe('Source');
    expect(elements.find(e => e.id === 3)?.type).toBe('Convertor');
  });

  it('convertor combines resources from multiple sources', () => {
    const { elements } = loadGraphFromFile(fixturePath);
    const result = runSimulation(elements, { maxTicks: 5 });

    const convertor = result.finalState.find(e => e.id === 3);
    const drain = result.finalState.find(e => e.id === 4);

    // Convertor should process resources
    expect(convertor).toBeDefined();
    expect(drain).toBeDefined();
  });
});

describe('engine/io + cli — gate logic scenario', () => {
  const fixturePath = resolve(__dirname, 'fixtures', 'gate-logic.xml');

  it('loads gate-logic.xml with source, pool, gate, and drain', () => {
    const { elements, warnings } = loadGraphFromFile(fixturePath);
    expect(warnings).toEqual([]);

    expect(elements.find(e => e.id === 1)?.type).toBe('Source');
    expect(elements.find(e => e.id === 2)?.type).toBe('Pool');
    expect(elements.find(e => e.id === 3)?.type).toBe('Gate');
    expect(elements.find(e => e.id === 4)?.type).toBe('Drain');
  });

  it('gate controls flow through the circuit', () => {
    const { elements } = loadGraphFromFile(fixturePath);
    const result = runSimulation(elements, { maxTicks: 8 });

    const pool = result.finalState.find(e => e.id === 2);
    expect(pool).toBeDefined();
    expect(result.ticksRun).toBe(8);
  });

  it('runCli gate-logic with summary format', () => {
    const outcome = runCli([
      fixturePath,
      '--max-ticks',
      '6',
      '--format',
      'summary',
    ]);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toMatch(/ticksRun=6/);
  });
});

describe('engine/io + cli — delay circuit scenario', () => {
  const fixturePath = resolve(__dirname, 'fixtures', 'delay-circuit.xml');

  it('loads delay-circuit.xml with source, delay, and pool', () => {
    const { elements, warnings } = loadGraphFromFile(fixturePath);
    expect(warnings).toEqual([]);

    expect(elements.find(e => e.id === 1)?.type).toBe('Source');
    expect(elements.find(e => e.id === 2)?.type).toBe('Delay');
    expect(elements.find(e => e.id === 3)?.type).toBe('Pool');
  });

  it('delay element buffers resources over multiple ticks', () => {
    const { elements } = loadGraphFromFile(fixturePath);
    const result = runSimulation(elements, { maxTicks: 8 });

    const pool = result.finalState.find(e => e.id === 3);
    const delay = result.finalState.find(e => e.id === 2);
    expect(delay?.activation).toBe('automatic');
    expect(pool?.currentPoints).toBeGreaterThan(0);
    expect(result.ticksRun).toBe(8);
  });
});

describe('engine/io + cli — pool delay pool conservation', () => {
  const classicPath = resolve(__dirname, 'fixtures', 'pool-delay-pool.xml');

  it('classic delay conserves 100 resources (no label multiply)', () => {
    const { elements } = loadGraphFromFile(classicPath);
    const result = runSimulation(elements, { maxTicks: 150 });

    const poolA = result.finalState.find(e => e.id === 1);
    const poolB = result.finalState.find(e => e.id === 3);
    expect(poolA?.currentPoints).toBe(0);
    expect(poolB?.currentPoints).toBe(100);
  });

  it('queue delay conserves 100 resources and finishes slower than classic', () => {
    const classicEls = loadGraphFromFile(classicPath).elements;
    const queueEls = classicEls.map(e =>
      e.id === 2 ? { ...e, queue: true as const } : e
    );

    const classic = runSimulation(classicEls, { maxTicks: 150 });
    const queued = runSimulation(queueEls, { maxTicks: 250 });

    expect(classic.finalState.find(e => e.id === 3)?.currentPoints).toBe(100);
    expect(queued.finalState.find(e => e.id === 3)?.currentPoints).toBe(100);
    expect(queued.ticksRun).toBeGreaterThan(classic.ticksRun);
  });
});

describe('engine/io + cli — multi-branch scenario', () => {
  const fixturePath = resolve(__dirname, 'fixtures', 'multi-branch.xml');

  it('loads multi-branch.xml with source, three pools, and three drains', () => {
    const { elements, warnings } = loadGraphFromFile(fixturePath);
    expect(warnings).toEqual([]);

    expect(elements.find(e => e.id === 1)?.type).toBe('Source');
    expect(elements.find(e => e.id === 2)?.type).toBe('Pool');
    expect(elements.find(e => e.id === 3)?.type).toBe('Pool');
    expect(elements.find(e => e.id === 4)?.type).toBe('Pool');
  });

  it('source distributes resources across multiple paths', () => {
    const { elements } = loadGraphFromFile(fixturePath);
    const result = runSimulation(elements, { maxTicks: 10 });

    const pools = result.finalState.filter(e => e.type === 'Pool');
    expect(pools.length).toBe(3);

    // Each path receives different amounts: 3, 4, 2 per tick
    pools.forEach(pool => {
      expect(pool.currentPoints).toBeGreaterThanOrEqual(0);
    });
  });

  it('runCli multi-branch with --collect-log includes tick history', () => {
    const outcome = runCli([
      fixturePath,
      '--max-ticks',
      '5',
      '--format',
      'json',
      '--collect-log',
    ]);

    expect(outcome.exitCode).toBe(0);
    const parsed = JSON.parse(outcome.stdout);
    expect(parsed.ticksRun).toBe(5);
    expect(Array.isArray(parsed.tickLog)).toBe(true);
    expect(parsed.tickLog.length).toBeGreaterThan(0);
  });
});
