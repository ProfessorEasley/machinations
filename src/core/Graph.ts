import { GraphElement } from './GraphElement';
import { GraphNode } from './GraphNode';
import { GraphConnection } from './GraphConnection';
import { GraphGrammar } from './GraphGrammar';

const genId = (() => {
  let i = 0;
  return () => `e_${++i}`;
})();

function isNode(e: GraphElement): e is GraphNode {
  return 'position' in e && 'name' in e;
}

function isConnection(e: GraphElement): e is GraphConnection {
  return 'source' in e && 'target' in e;
}

export class Graph {
  elements: GraphElement[] = [];
  grammar: GraphGrammar = new GraphGrammar();

  // ===== Generic element API =====
  addElement(element: GraphElement): void {
    if (!element.id) element.id = genId();
    this.elements.push(element);
    element.graph = this;
  }

  removeElement(element: GraphElement): void {
    this.elements = this.elements.filter(e => e !== element);
    element.graph = undefined;
    element.dispose?.();
  }

  // ===== Node/Connection convenience API =====
  addNode(node: GraphNode): void {
    this.addElement(node);
  }

  addConnection(conn: GraphConnection): void {
    this.addElement(conn);
  }

  getNode(id: string): GraphNode | undefined {
    return this.elements.find(e => e.id === id && isNode(e)) as
      | GraphNode
      | undefined;
  }

  getConnection(id: string): GraphConnection | undefined {
    return this.elements.find(e => e.id === id && isConnection(e)) as
      | GraphConnection
      | undefined;
  }

  nodes(): GraphNode[] {
    return this.elements.filter(isNode) as GraphNode[];
  }

  connections(): GraphConnection[] {
    return this.elements.filter(isConnection) as GraphConnection[];
  }

  // ===== JSON Persistence =====
  toJSON() {
    return {
      grammar: { name: this.grammar.name },
      nodes: this.nodes().map(n => ({
        id: n.id,
        name: n.name,
        position: { ...n.position },
        width: n.width,
        height: n.height,
      })),
      connections: this.connections().map(c => ({
        id: c.id,
        from: c.source.id,
        to: c.target.id,
        type: typeof c.type === 'string' ? c.type : 'default',
      })),
    };
  }

  fromJSON(json: unknown) {
    if (typeof json !== 'object' || json === null) return;

    const data = json as {
      nodes?: Array<{
        id?: string;
        name?: string;
        width?: number;
        height?: number;
        position?: { x: number; y: number; z: number };
      }>;
      connections?: Array<{
        id?: string;
        from: string;
        to: string;
        type?: string;
      }>;
      grammar?: { name?: string };
    };

    this.elements = [];
    const byId = new Map<string, GraphNode>();

    // Recreate nodes
    for (const jn of data.nodes ?? []) {
      const n = new GraphNode(
        jn.name ?? 'Node',
        jn.width ?? 120,
        jn.height ?? 60
      );
      n.id = jn.id ?? genId();
      n.position = jn.position ?? { x: 0, y: 0, z: 0 };
      this.addNode(n);
      byId.set(n.id, n);
    }

    // Recreate connections
    for (const jc of data.connections ?? []) {
      const from = byId.get(jc.from);
      const to = byId.get(jc.to);
      if (!from || !to) continue;
      const c = new GraphConnection(from, to);
      c.id = jc.id ?? genId();
      c.type = jc.type ?? c.type;
      this.addConnection(c);
    }

    if (data.grammar?.name) this.grammar.name = data.grammar.name;
  }

  // ===== Optional XML =====
  generateXML(): string {
    const elementsXML = this.elements.map(e => e.generateXML()).join('\n');
    return `<Graph>
  <Elements>
${elementsXML}
  </Elements>
  <Grammar name="${this.grammar.name}" />
</Graph>`;
  }

  readXML(xml: unknown): void {
    void xml; // placeholder
  }
}
