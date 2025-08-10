// src/core/GraphConnectionType.ts

// Keep this flexible for now. You can expand to an enum or richer type later.
export type GraphConnectionType =
  | 'default'
  | 'flow'
  | 'resource'
  | 'trigger'
  | 'inhibitor';
