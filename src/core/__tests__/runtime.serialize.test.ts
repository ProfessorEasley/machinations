import { describe, it, expect } from 'vitest';
import { GraphRuntime } from '../../core/adapters/runtime';
import { Graph } from '../../core/Graph';

describe('GraphRuntime (serialize/deserialize)', () => {
  it('round-trips a simple graph', () => {
    const rt1 = new GraphRuntime(new Graph());
    const n1 = rt1.addNode({ x: 10, y: 20, label: 'N1' });
    const n2 = rt1.addNode({ x: 200, y: 30, label: 'N2' });
    const e  = rt1.addEdge(n1.id, n2.id, 'flow');
    expect(e).toBeTruthy();

    const json = rt1.serialize();

    const rt2 = new GraphRuntime(new Graph());
    rt2.deserialize(json);

    // nodes restored
    const nodes = rt2.getNodes();
    expect(nodes.length).toBe(2);
    const a = nodes.find(n => n.label === 'N1')!;
    const b = nodes.find(n => n.label === 'N2')!;
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(b.x).toBe(200);
    expect(b.y).toBe(30);

    // edge restored
    const edges = rt2.getEdges();
    expect(edges.length).toBe(1);
    expect([a.id, b.id]).toContain(edges[0].from);
    expect([a.id, b.id]).toContain(edges[0].to);
  });
});
