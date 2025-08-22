import { GraphElement } from './GraphElement';
import { GraphNode } from './GraphNode';
import { GraphConnection } from './GraphConnection';
import { GraphGrammar } from './GraphGrammar';
// No official types for fast-xml-parser
import { XMLParser } from 'fast-xml-parser';

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

// ===== XML element types & helpers =====
interface XmlNodeEl {
  id?: string;
  name?: string;
  label?: string;
  x?: string | number;
  y?: string | number;
  z?: string | number;
  width?: string | number;
  height?: string | number;
}

interface XmlConnectionEl {
  id?: string;
  from?: string;
  to?: string;
  type?: string;
}

interface ParsedGraphDoc {
  Graph?: {
    Elements?: {
      Node?: XmlNodeEl | XmlNodeEl[];
      Connection?: XmlConnectionEl | XmlConnectionEl[];
    };
    Grammar?: {
      name?: string;
    };
  };
}

function toArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
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
    // Remove related connections if element is a node
    if ('position' in element && 'name' in element) {
      // It's a node
      const nodeId = element.id;
      // Remove all connections where this node is source or target
      this.elements = this.elements.filter(e => {
        // Type guard for GraphConnection
        if (
          typeof e === 'object' &&
          e !== null &&
          'source' in e &&
          'target' in e &&
          (e as GraphConnection).source &&
          (e as GraphConnection).target &&
          typeof (e as GraphConnection).source.id === 'string' &&
          typeof (e as GraphConnection).target.id === 'string'
        ) {
          const conn = e as GraphConnection;
          return conn.source.id !== nodeId && conn.target.id !== nodeId;
        }
        return true;
      });
    }
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

  readXML(xml: string): void {
    // Use fast-xml-parser for Node.js compatibility
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const doc = parser.parse(xml) as ParsedGraphDoc;

    this.elements = [];
    const byId = new Map<string, GraphNode>();

    // Parse grammar
    const grammarName = doc.Graph?.Grammar?.name;
    if (typeof grammarName === 'string') {
      this.grammar.name = grammarName;
    }

    // Parse nodes
    const nodesArr = toArray<XmlNodeEl>(doc.Graph?.Elements?.Node);
    nodesArr.forEach(nodeEl => {
      const id = nodeEl.id ?? genId();
      const name = nodeEl.name ?? nodeEl.label ?? 'Node';
      const label = nodeEl.label ?? nodeEl.name ?? 'Node';
      const x = parseFloat(String(nodeEl.x ?? '0'));
      const y = parseFloat(String(nodeEl.y ?? '0'));
      const z = parseFloat(String(nodeEl.z ?? '0'));
      const width = parseFloat(String(nodeEl.width ?? '120'));
      const height = parseFloat(String(nodeEl.height ?? '60'));

      const n = new GraphNode(name, width, height, label);
      n.id = id;
      n.position = { x, y, z };
      n.label = label;
      this.addNode(n);
      byId.set(id, n);
    });

    // Parse connections
    const connsArr = toArray<XmlConnectionEl>(doc.Graph?.Elements?.Connection);
    connsArr.forEach(connEl => {
      const id = connEl.id ?? genId();
      const from = connEl.from;
      const to = connEl.to;
      const type = connEl.type ?? 'default';
      if (!from || !to) return;
      const fromNode = byId.get(from);
      const toNode = byId.get(to);
      if (!fromNode || !toNode) return;

      const c = new GraphConnection(fromNode, toNode);
      c.id = id;
      c.type = type;
      this.addConnection(c);
    });
  }
}
