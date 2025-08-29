// src/core/GraphElement.ts
import type { Vector3 } from './types/Vector3';
import type { Graph } from './Graph';
<<<<<<< HEAD
import { GraphConnection } from './GraphConnection';
=======
import type { GraphConnection } from './GraphConnection';
>>>>>>> 837c1f018fe6b583fd83f89ece7bda14111c4ed8

export abstract class GraphElement {
  id: string = '';
  graph?: Graph;
  inputs: GraphConnection[] = [];
  outputs: GraphConnection[] = [];

  dispose(): void {
    this.inputs.forEach(input => input.dispose());
    this.inputs = [];
    this.outputs.forEach(output => output.dispose());
    this.outputs = [];
    this.graph = undefined;
  }

  generateXML(): string {
    // Basic XML representation for a GraphElement
    return `<Element id="${this.id}"></Element>`;
  }

  // readXML(xml: any): void {
  //   if (xml && xml.$ && typeof xml.$.id === 'string') {
  //     this.id = xml.$.id;
  //   }
  // }

  readXML(xml: { $?: { id?: string } }): void {
    if (xml.$?.id) {
      this.id = xml.$.id;
    }
  }

  removeInput(connection: GraphConnection): void {
    this.inputs = this.inputs.filter(input => input !== connection);
  }

  removeOutput(connection: GraphConnection): void {
    this.outputs = this.outputs.filter(output => output !== connection);
  }

  // Must be implemented by subclasses
  abstract getPosition(): Vector3;
  abstract getConnection(referencePoint: Vector3): Vector3;
  abstract moveBy(dx: number, dy: number, dz?: number): void;
  abstract moveTo(x: number, y: number, z?: number): void;
}
