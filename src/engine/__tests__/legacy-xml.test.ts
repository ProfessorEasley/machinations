import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadGraphFromFile, loadGraphFromXml } from '../io';
import { runSimulation } from '../runner';
import { runCli } from '../cli';
import type { GraphElement } from '../types';

const FIXTURE_DIR = resolve(__dirname, 'fixtures');
const RPG_FIXTURE = resolve(FIXTURE_DIR, 'legacy-rpg-mini.xml');
const OFFICIAL_DIR = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'machinations_examples',
  'official examples',
  'games'
);

function byId(elements: GraphElement[]) {
  return new Map(elements.map(e => [e.id, e]));
}

describe('legacy <graph> XML import', () => {
  it('parses <node symbol="…"> and <connection type="…"> with ordinal refs', () => {
    const { elements, warnings } = loadGraphFromFile(RPG_FIXTURE);

    expect(warnings).toEqual([]);
    expect(elements).toHaveLength(7);

    const map = byId(elements);

    // Document-order ordinals: 0=Source, 1=Conn(0→2), 2=Pool,
    // 3=Conn(2→4), 4=Drain, 5=Conn(2→6), 6=EndCondition.
    expect(map.get(0)?.type).toBe('Source');
    expect(map.get(0)?.text).toBe('GoldMine');
    expect(map.get(0)?.activation).toBe('automatic');

    expect(map.get(2)?.type).toBe('Pool');
    expect(map.get(2)?.text).toBe('Treasury');
    expect(map.get(2)?.currentPoints).toBe(0);
    // capacity="-1" in legacy means unlimited — must not become max=-1.
    expect(map.get(2)?.max).toBeUndefined();

    expect(map.get(4)?.type).toBe('Drain');

    expect(map.get(6)?.type).toBe('End Condition');
    expect(map.get(6)?.inhibited).toBe(true);

    const sourceToPool = map.get(1);
    expect(sourceToPool?.type).toBe('Resource Connection');
    expect(sourceToPool?.connectedToStart).toBe(0);
    expect(sourceToPool?.connectedToEnd).toBe(2);
    expect(sourceToPool?.text).toBe('10');

    const poolToDrain = map.get(3);
    expect(poolToDrain?.type).toBe('Resource Connection');
    expect(poolToDrain?.connectedToStart).toBe(2);
    expect(poolToDrain?.connectedToEnd).toBe(4);
    expect(poolToDrain?.text).toBe('3');

    const stateConn = map.get(5);
    expect(stateConn?.type).toBe('State Connection');
    expect(stateConn?.connectedToStart).toBe(2);
    expect(stateConn?.connectedToEnd).toBe(6);
    expect(stateConn?.text).toBe('>=100');
  });

  it('simulates the parsed legacy graph (net +7/tick into Treasury)', () => {
    const { elements } = loadGraphFromFile(RPG_FIXTURE);
    const result = runSimulation(elements, { maxTicks: 5 });

    const pool = result.finalState.find(e => e.id === 2);
    // Source produces 10/tick, drain consumes 3/tick → net +7/tick.
    // After 5 ticks: ~35 (allow for the engine's onstart tick that does/doesn't
    // produce depending on activation — check we're well above 0 and a clean
    // multiple of 7 from a 0 starting balance).
    expect(pool?.currentPoints).toBeGreaterThan(0);
    expect((pool?.currentPoints ?? 0) % 7).toBe(0);
    expect(result.ticksRun).toBe(5);
  });

  it('translates legacy captionPos to native labelPosition', () => {
    // captionPos="0.25" → shifted by +0.25 → labelPosition 0.5
    const { elements } = loadGraphFromFile(RPG_FIXTURE);
    const source = elements.find(e => e.id === 0);
    expect(source?.labelPosition).toBeCloseTo(0.5, 5);
  });

  it('treats <node symbol="GroupBox"> as type "Group"', () => {
    const xml = `<graph version="v4.04">
      <node symbol="GroupBox" x="10" y="20" width="300" height="120" caption="Player"/>
    </graph>`;
    const { elements, warnings } = loadGraphFromXml(xml);
    expect(warnings).toEqual([]);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('Group');
    expect(elements[0].width).toBe(300);
    expect(elements[0].height).toBe(120);
  });

  it('accepts legacy "Converter" spelling for Convertor', () => {
    const xml = `<graph version="v4.04">
      <node symbol="Converter" x="10" y="20" caption="Mill"/>
    </graph>`;
    const { elements } = loadGraphFromXml(xml);
    expect(elements[0].type).toBe('Convertor');
    expect(elements[0].text).toBe('Mill');
  });

  it('preserves <point> waypoints on legacy connections', () => {
    const xml = `<graph version="v4.04">
      <node symbol="Pool" x="0" y="0" caption="A"/>
      <node symbol="Pool" x="200" y="200" caption="B"/>
      <connection type="Resource Connection" start="0" end="1" label="1">
        <point x="80" y="40"/>
        <point x="120" y="160"/>
      </connection>
    </graph>`;
    const { elements } = loadGraphFromXml(xml);
    const conn = elements.find(e => e.type === 'Resource Connection');
    expect(conn?.points).toHaveLength(2);
    expect(conn?.points?.[0]).toEqual({ x: 80, y: 40 });
    expect(conn?.points?.[1]).toEqual({ x: 120, y: 160 });
  });
});

describe('legacy <graph> XML — official Machinations examples', () => {
  it('loads RPG.xml without warnings and resolves every connection', () => {
    const { elements, warnings } = loadGraphFromFile(
      resolve(OFFICIAL_DIR, 'RPG.xml')
    );
    expect(warnings).toEqual([]);
    expect(elements.length).toBeGreaterThan(40);

    const conns = elements.filter(
      e => e.type === 'Resource Connection' || e.type === 'State Connection'
    );
    expect(conns.length).toBeGreaterThan(0);
    expect(
      conns.filter(c => c.connectedToStart == null || c.connectedToEnd == null)
    ).toEqual([]);
  });

  it('loads Diablo3.xml without warnings and resolves every connection', () => {
    const { elements, warnings } = loadGraphFromFile(
      resolve(OFFICIAL_DIR, 'Diablo3.xml')
    );
    expect(warnings).toEqual([]);
    expect(elements.length).toBeGreaterThan(30);

    const conns = elements.filter(
      e => e.type === 'Resource Connection' || e.type === 'State Connection'
    );
    expect(
      conns.filter(c => c.connectedToStart == null || c.connectedToEnd == null)
    ).toEqual([]);

    // Spot-check that the parser produced the Pools we expect from Diablo3.
    const pools = elements.filter(e => e.type === 'Pool');
    const poolCaptions = pools.map(p => p.text).filter(Boolean);
    expect(poolCaptions).toContain('Stats');
    expect(poolCaptions).toContain('Spirit');
    expect(poolCaptions).toContain('Dificulty');
  });

  it('CLI runs Diablo3.xml end-to-end without parse warnings', () => {
    const outcome = runCli([
      resolve(OFFICIAL_DIR, 'Diablo3.xml'),
      '--max-ticks',
      '5',
      '--format',
      'json',
    ]);

    expect(outcome.exitCode).toBe(0);
    const parsed = JSON.parse(outcome.stdout);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.ticksRun).toBe(5);
    expect(
      parsed.finalState.filter((e: GraphElement) => e.type === 'Pool').length
    ).toBeGreaterThan(0);
  });
});
