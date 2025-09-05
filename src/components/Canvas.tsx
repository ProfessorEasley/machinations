import React, { useState } from 'react';

interface CanvasProps {
  selectedTool: string;
}

interface TextLabel {
  id: number;
  x: number;
  y: number;
  text: string;
}

const Canvas: React.FC<CanvasProps> = ({ selectedTool }) => {
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Handle dropping a tool onto the canvas
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const tool = e.dataTransfer.getData('tool');
    if (tool === 'Text Label') {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newLabel: TextLabel = {
        id: Date.now(),
        x,
        y,
        text: 'Edit me',
      };
      setLabels([...labels, newLabel]);
      setEditingId(newLabel.id);
    }
  };

  // Allow dropping by preventing default
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Optional: Also allow click-to-place if "Text Label" is selected
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'Text Label') {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newLabel: TextLabel = {
        id: Date.now(),
        x,
        y,
        text: 'Edit me',
      };
      setLabels([...labels, newLabel]);
      setEditingId(newLabel.id);
    }
  };

  const handleTextChange = (id: number, value: string) => {
    setLabels(
      labels.map(label => (label.id === id ? { ...label, text: value } : label))
    );
  };

  return (
    <div
      className="canvas"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'transparent',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
    >
      {labels.map(label =>
        editingId === label.id ? (
          <input
            key={label.id}
            style={{
              position: 'absolute',
              left: label.x,
              top: label.y,
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              outline: 'none',
              minWidth: 40,
            }}
            value={label.text}
            autoFocus
            onBlur={() => setEditingId(null)}
            onChange={e => handleTextChange(label.id, e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            key={label.id}
            style={{
              position: 'absolute',
              left: label.x,
              top: label.y,
              fontSize: 16,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(label.id);
            }}
          >
            {label.text}
          </span>
        )
      )}
    </div>
  );
};

export default Canvas;
