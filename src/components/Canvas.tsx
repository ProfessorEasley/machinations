// src/canvas/Canvas.tsx
import React, { useMemo } from 'react';
import { useGraphStore } from '../store/graphStore';

const Canvas: React.FC = () => {
  const nodes = useGraphStore(s => s.nodes()); // DTOs: {id,x,y,width,height,label}
  const edges = useGraphStore(s => s.edges()); // DTOs: {id,from,to}

  // Fast lookup for edge endpoints
  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  return (
    <svg width="100%" height="100%" style={{ display: 'block' }}>
      {/* Edges behind nodes */}
      {edges.map(e => {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) return null;

        const x1 = from.x + from.width; // right-middle of source
        const y1 = from.y + from.height / 2;
        const x2 = to.x; // left-middle of target
        const y2 = to.y + to.height / 2;

        return (
          <line
            key={e.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="black"
            strokeWidth={1}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(n => (
        <g key={n.id}>
          <rect
            x={n.x}
            y={n.y}
            width={n.width}
            height={n.height}
            fill="white"
            stroke="black"
            rx={10}
            ry={10}
          />
          <text x={n.x + 8} y={n.y + 20} fontSize={12}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default Canvas;
