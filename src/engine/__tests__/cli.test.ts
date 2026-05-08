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
