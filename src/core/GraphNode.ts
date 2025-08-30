// src/core/GraphNode.ts
import type { Vector3 } from './types/Vector3';
import { GraphElement } from './GraphElement';
import type { GraphSymbol } from './GraphSymbol';

export class GraphNode extends GraphElement {
  name: string;
  label?: string;
  position: Vector3 = { x: 0, y: 0, z: 0 };
  symbol?: GraphSymbol;
  width: number;
  height: number;

  constructor(
    name: string = 'Node',
    width: number = 120,
    height: number = 60,
    label?: string
  ) {
    super();
    this.name = name;
    this.label = label ?? name;
    this.width = width;
    this.height = height;
  }

  override dispose(): void {
    super.dispose();
  }

  override getPosition(): Vector3 {
    return { ...this.position };
  }

  // override getConnection(_referencePoint: Vector3): Vector3 {
  //   // For now, just return node center
  //   return { ...this.position };
  // }

  override getConnection(referencePoint: Vector3): Vector3 {
    void referencePoint; // unused for now
    return { ...this.position };
  }

  override moveBy(dx: number, dy: number, dz: number = 0): void {
    this.moveTo(
      this.position.x + dx,
      this.position.y + dy,
      this.position.z + dz
    );
  }

  override moveTo(x: number, y: number, z: number = 0): void {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
  }

  override generateXML(): string {
    const symbolName = this.symbol ? this.symbol.name : '';
    const labelAttr = this.label ? ` label="${this.label}"` : '';
    return `<Node id="${this.id}" x="${this.position.x}" y="${this.position.y}" z="${this.position.z}"${labelAttr} symbol="${symbolName}" />`;
  }

  // override readXML(xml: any): void {
  //   if (xml && xml.$) {
  //     if (typeof xml.$.id === 'string') this.id = xml.$.id;
  //     if (typeof xml.$.x === 'string') this.position.x = parseFloat(xml.$.x);
  //     if (typeof xml.$.y === 'string') this.position.y = parseFloat(xml.$.y);
  //     if (typeof xml.$.z === 'string') this.position.z = parseFloat(xml.$.z);
  //   }
  // }

  override readXML(xml: {
    $?: { id?: string; x?: string; y?: string; z?: string };
  }): void {
    if (xml.$) {
      if (xml.$.id) this.id = xml.$.id;
      if (xml.$.x) this.position.x = parseFloat(xml.$.x);
      if (xml.$.y) this.position.y = parseFloat(xml.$.y);
      if (xml.$.z) this.position.z = parseFloat(xml.$.z);
    }
  }
}
