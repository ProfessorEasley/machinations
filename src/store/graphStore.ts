// src/store/graphStore.ts
import { create } from 'zustand';
import { GraphRuntime } from '../core/adapters/runtime';

type State = {
  rt: GraphRuntime;
  tool: 'select' | 'add-node' | 'connect';
  camera: { x: number; y: number; zoom: number };
};
type Actions = {
  addNode: (x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addEdge: (from: string, to: string) => void;
  nodes: () => ReturnType<GraphRuntime['getNodes']>;
  edges: () => ReturnType<GraphRuntime['getEdges']>;
};

export const useGraphStore = create<State & Actions>((set, get) => ({
  rt: new GraphRuntime(),
  tool: 'select',
  camera: { x: 0, y: 0, zoom: 1 },

  addNode: (x, y) => {
    get().rt.addNode({ x, y });
    set({});
  },
  moveNode: (id, x, y) => {
    get().rt.moveNode(id, x, y);
    set({});
  },
  addEdge: (f, t) => {
    get().rt.addEdge(f, t);
    set({});
  },

  nodes: () => get().rt.getNodes(),
  edges: () => get().rt.getEdges(),
}));
