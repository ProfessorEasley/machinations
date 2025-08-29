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
<<<<<<< HEAD

=======
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
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
<<<<<<< HEAD

=======
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
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
<<<<<<< HEAD
=======

  it('removes a node and its connections', () => {
    const a = rt.addNode({ x: 0, y: 0, label: 'A' });
    const b = rt.addNode({ x: 100, y: 0, label: 'B' });
    rt.addEdge(a.id, b.id, 'flow');
    rt.graph.removeElement(rt.graph.getNode(a.id)!);
    expect(rt.getNodes().length).toBe(1);
    expect(rt.getEdges().length).toBe(0);
  });

  it('removes a connection only', () => {
    const a = rt.addNode({ x: 0, y: 0, label: 'A' });
    const b = rt.addNode({ x: 100, y: 0, label: 'B' });
    const e = rt.addEdge(a.id, b.id, 'flow');
    rt.graph.removeElement(rt.graph.getConnection(e!.id)!);
    expect(rt.getEdges().length).toBe(0);
    expect(rt.getNodes().length).toBe(2);
  });

  it('does not allow duplicate node IDs', () => {
    const n1 = rt.addNode({ x: 0, y: 0, label: 'A' });
    const n2 = rt.addNode({ x: 10, y: 10, label: 'B' });
    n2.id = n1.id; // force duplicate
    // The graph should still treat them as separate objects, but only one should be found by getNode
    const found = rt.graph.getNode(n1.id);
    expect(found).toBeDefined();
    // There should not be more than one node with the same ID in the graph's node list
    const allWithId = rt.getNodes().filter(n => n.id === n1.id);
    expect(allWithId.length).toBe(1);
  });

  it('serializes and deserializes an empty graph with XML', () => {
    const xml = rt.graph.generateXML();
    const rt2 = new GraphRuntime(new Graph());
    rt2.graph.readXML(xml);
    expect(rt2.getNodes().length).toBe(0);
    expect(rt2.getEdges().length).toBe(0);
  });

  it('serializes and deserializes a graph with nodes and edges using XML', () => {
    const a = rt.addNode({ x: 0, y: 0, label: 'A' });
    const b = rt.addNode({ x: 100, y: 0, label: 'B' });
    rt.addEdge(a.id, b.id, 'flow');
    const xml = rt.graph.generateXML();
    const rt2 = new GraphRuntime(new Graph());
    rt2.graph.readXML(xml);
    expect(rt2.getNodes().length).toBe(2);
    expect(rt2.getEdges().length).toBe(1);
    // Check node labels and positions
    const nodes = rt2.getNodes();
    expect(
      nodes.some(n => n.label === 'A' && n.x === 0 && n.y === 0)
    ).toBeTruthy();
    expect(
      nodes.some(n => n.label === 'B' && n.x === 100 && n.y === 0)
    ).toBeTruthy();
    // Check edge type
    const edge = rt2.getEdges()[0];
    expect(edge.type).toBe('flow');
  });

  it('serializes and deserializes grammar name with XML', () => {
    rt.graph.grammar.name = 'testGrammar';
    const xml = rt.graph.generateXML();
    const rt2 = new GraphRuntime(new Graph());
    rt2.graph.readXML(xml);
    expect(rt2.graph.grammar.name).toBe('testGrammar');
  });

  it('serializes and deserializes an empty graph with JSON', () => {
    const json = rt.serialize();
    const rt2 = new GraphRuntime(new Graph());
    rt2.deserialize(json);
    expect(rt2.getNodes().length).toBe(0);
    expect(rt2.getEdges().length).toBe(0);
  });

  it('serializes and deserializes a graph with nodes and edges with JSON', () => {
    const a = rt.addNode({ x: 0, y: 0, label: 'A' });
    const b = rt.addNode({ x: 100, y: 0, label: 'B' });
    rt.addEdge(a.id, b.id, 'flow');
    const json = rt.serialize();
    const rt2 = new GraphRuntime(new Graph());
    rt2.deserialize(json);
    expect(rt2.getNodes().length).toBe(2);
    expect(rt2.getEdges().length).toBe(1);
  });

  it('does not break on invalid deserialization data', () => {
    const rt2 = new GraphRuntime(new Graph());
    rt2.deserialize(undefined);
    expect(rt2.getNodes().length).toBe(0);
    expect(rt2.getEdges().length).toBe(0);
    rt2.deserialize({});
    expect(rt2.getNodes().length).toBe(0);
    expect(rt2.getEdges().length).toBe(0);
  });

  it('moves node by delta', () => {
    const n = rt.addNode({ x: 10, y: 10 });
    const nodeObj = rt.graph.getNode(n.id)!;
    nodeObj.moveBy(5, 5);
    expect(nodeObj.position.x).toBe(15);
    expect(nodeObj.position.y).toBe(15);
  });

  it('moves node to position', () => {
    const n = rt.addNode({ x: 10, y: 10 });
    const nodeObj = rt.graph.getNode(n.id)!;
    nodeObj.moveTo(100, 200);
    expect(nodeObj.position.x).toBe(100);
    expect(nodeObj.position.y).toBe(200);
  });

  it('connection position is midpoint between nodes', () => {
    const a = rt.addNode({ x: 0, y: 0 });
    const b = rt.addNode({ x: 100, y: 100 });
    const e = rt.addEdge(a.id, b.id);
    const connObj = rt.graph.getConnection(e!.id)!;
    const pos = connObj.getPosition();
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(50);
  });

  it('connection getConnection returns closer endpoint', () => {
    const a = rt.addNode({ x: 0, y: 0 });
    const b = rt.addNode({ x: 100, y: 0 });
    const e = rt.addEdge(a.id, b.id);
    const connObj = rt.graph.getConnection(e!.id)!;
    const ref = { x: 10, y: 0, z: 0 };
    const closer = connObj.getConnection(ref);
    expect(closer.x).toBe(0);
    expect(closer.y).toBe(0);
  });

  it('connection getPositionOnLine returns correct ratio', () => {
    const a = rt.addNode({ x: 0, y: 0 });
    const b = rt.addNode({ x: 100, y: 0 });
    const e = rt.addEdge(a.id, b.id);
    const connObj = rt.graph.getConnection(e!.id)!;
    const pos = connObj.getPositionOnLine(0.5);
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(0);
  });
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
});
