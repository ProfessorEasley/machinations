// src/core/GraphEvent.ts
import { GraphElement } from './GraphElement';

export class GraphEvent {
  static ELEMENT_ADD = 'element_add';
  static ELEMENT_CHANGE = 'element_change';
  static ELEMENT_DISPOSE = 'element_dispose';
  static GRAPH_CHANGE = 'graph_change';
  static GRAPH_RUN = 'run';
  static GRAPH_QUICKRUN = 'quickrun';
  static GRAPH_MULTIPLERUN = 'multiplerun';
  static GRAPH_WARNING = 'warning';
  static GRAPH_ERROR = 'error';

  type: string;
  element?: GraphElement;
  message?: string;

  constructor(type: string, element?: GraphElement, message?: string) {
    this.type = type; // ✅ store the value
    this.element = element;
    this.message = message;
  }
}
