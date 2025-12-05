import type { Vector3 } from './types/Vector3';
import { GraphElement } from './GraphElement';
import type { GraphConnectionType } from './GraphConnectionType';
import { GraphNode } from './GraphNode';

export class GraphConnection extends GraphElement {
  source: GraphNode;
  target: GraphNode;
  type: GraphConnectionType | string = 'default';
  points: Vector3[] = [];
  totalLength: number = 0;

  constructor(source: GraphNode, target: GraphNode) {
    super();
    this.source = source;
    this.target = target;

    // Keep I/O lists on nodes up to date
    this.source.outputs.push(this);
    this.target.inputs.push(this);

    // Initialize endpoints
    this.points = [
      { ...this.source.getPosition() },
      { ...this.target.getPosition() },
    ];
  }

  dispose(): void {
    this.source.removeOutput(this);
    this.target.removeInput(this);
    this.points.length = 0;
    super.dispose();
  }

  // --- Abstracts from GraphElement (now implemented) ---

  // Use the midpoint as a representative “position” for the connection
  getPosition(): Vector3 {
    const a = this.source.getPosition();
    const b = this.target.getPosition();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
  }

  // Return the closer endpoint to the given reference (simple & fast)
  getConnection(referencePoint: Vector3): Vector3 {
    const a = this.source.getPosition();
    const b = this.target.getPosition();
    const da =
      (a.x - referencePoint.x) ** 2 +
      (a.y - referencePoint.y) ** 2 +
      (a.z - referencePoint.z) ** 2;
    const db =
      (b.x - referencePoint.x) ** 2 +
      (b.y - referencePoint.y) ** 2 +
      (b.z - referencePoint.z) ** 2;
    return da <= db ? a : b;
  }

  // Connections don’t move independently of their nodes
  moveBy(): void {}
  moveTo(): void {}

  // --- Geometry helpers for rendering ---
  calculateStartPosition(): void {
    this.points[0] = { ...this.source.getPosition() };
  }

  calculateEndPosition(): void {
    this.points[this.points.length - 1] = { ...this.target.getPosition() };
  }

  calculateTotalLength(): void {
    let length = 0;
    for (let i = 1; i < this.points.length; i++) {
      const dx = this.points[i].x - this.points[i - 1].x;
      const dy = this.points[i].y - this.points[i - 1].y;
      const dz = this.points[i].z - this.points[i - 1].z;
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    this.totalLength = length;
  }

  getPositionOnLine(ratio: number): Vector3 {
    const a = this.source.getPosition();
    const b = this.target.getPosition();
    return {
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
      z: a.z + (b.z - a.z) * ratio,
    };
  }

  // --- Basic (de)serialization placeholders ---
  generateXML(): string {
    return `<Connection id="${this.id}" from="${this.source.id}" to="${this.target.id}" type="${this.type}" />`;
  }

  readXML(xml: { $?: { id?: string } }): void {
    if (xml.$?.id) this.id = xml.$.id;
  }
}
