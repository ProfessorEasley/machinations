import { describe, it, expect, beforeEach } from 'vitest';
import { GraphRuntime } from '../adapters/runtime';
import { Graph } from '../Graph';

describe('GraphRuntime (basic)', () => {
  let rt: GraphRuntime;

  beforeEach(() => {
    rt = new GraphRuntime(new Graph());
  });

  it('adds a node with defaults', () => {
    const n = rt.addNode({ x: 10, y: 20 });
    expect(n.id).toBeTruthy();
    expect(n.label).toBe('Node');
    expect(n.x).toBe(10);
    expect(n.y).toBe(20);
    expect(n.width).toBe(120);
    expect(n.height).toBe(60);

    const nodes = rt.getNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe(n.id);
  });

  it('adds a node with custom label/size', () => {
    const n = rt.addNode({ x: 0, y: 0, label: 'A', width: 200, height: 80 });
    expect(n.label).toBe('A');
    expect(n.width).toBe(200);
    expect(n.height).toBe(80);
  });

  it('moves a node', () => {
    const n = rt.addNode({ x: 5, y: 5, label: 'MoveMe' });
    rt.moveNode(n.id, 50, 60);
    const after = rt.getNodes().find(x => x.id === n.id)!;
    expect(after.x).toBe(50);
    expect(after.y).toBe(60);
  });

  it('creates an edge between nodes', () => {
    const a = rt.addNode({ x: 0, y: 0, label: 'A' });
    const b = rt.addNode({ x: 100, y: 0, label: 'B' });

    const e = rt.addEdge(a.id, b.id, 'flow');
    expect(e).toBeTruthy();
    expect(e!.from).toBe(a.id);
    expect(e!.to).toBe(b.id);
    expect(rt.getEdges().length).toBe(1);
  });

  it('does not create an edge if endpoints missing', () => {
    const e = rt.addEdge('missing', 'also-missing');
    expect(e).toBeNull();
    expect(rt.getEdges().length).toBe(0);
  });
});
