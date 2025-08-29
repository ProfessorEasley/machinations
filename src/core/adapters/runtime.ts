import { Graph } from '../Graph';
import { GraphNode } from '../GraphNode';
import { GraphConnection } from '../GraphConnection';

export type NodeDTO = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

export type EdgeDTO = {
  id: string;
  from: string;
  to: string;
  type?: string;
};

export class GraphRuntime {
  graph: Graph;

  constructor(graph?: Graph) {
    this.graph = graph ?? new Graph();
  }

  addNode(p: {
    x: number;
    y: number;
    label?: string;
    width?: number;
    height?: number;
  }): NodeDTO {
    const n = new GraphNode(p.label ?? 'Node', p.width ?? 120, p.height ?? 60);
    n.position = { x: p.x, y: p.y, z: 0 };
    this.graph.addNode(n);
    return this.asNodeDTO(n);
  }

  moveNode(id: string, x: number, y: number) {
    const n = this.graph.getNode(id);
    if (!n) return;
    n.moveTo(x, y, n.position.z);
  }

  addEdge(fromId: string, toId: string, type?: string): EdgeDTO | null {
    const from = this.graph.getNode(fromId);
    const to = this.graph.getNode(toId);
    if (!from || !to) return null;
    const e = new GraphConnection(from, to);
    if (type) e.type = type;
    this.graph.addConnection(e);
    return this.asEdgeDTO(e);
  }

  getNodes(): NodeDTO[] {
    return this.graph.nodes().map(this.asNodeDTO);
  }

  getEdges(): EdgeDTO[] {
    return this.graph.connections().map(this.asEdgeDTO);
  }

  serialize() {
    return this.graph.toJSON();
  }

  deserialize(json: unknown) {
    this.graph.fromJSON(json);
  }

  private asNodeDTO = (n: GraphNode): NodeDTO => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.width,
    height: n.height,
<<<<<<< HEAD
    label: n.name,
=======
    label: n.label ?? n.name,
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8
  });

  private asEdgeDTO = (e: GraphConnection): EdgeDTO => ({
    id: e.id,
    from: e.source.id,
    to: e.target.id,
    type: typeof e.type === 'string' ? e.type : undefined,
  });
}
