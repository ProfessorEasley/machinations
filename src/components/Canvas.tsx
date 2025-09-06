import React, { useState, useRef } from 'react';

interface CanvasProps {
  selectedTool: string;
}

type GraphElementType =
  | 'Text Label'
  | 'Group'
  | 'Chart'
  | 'Pool'
  | 'Gate'
  | 'Resource Connection'
  | 'State Connection'
  | 'Source'
  | 'Drain'
  | 'Convertor'
  | 'Trader'
  | 'Delay'
  | 'Register'
  | 'End Condition'
  | 'Artifical Intelligence';

interface GraphElement {
  id: number;
  type: GraphElementType;
  x: number;
  y: number;
  text?: string;
}

const Canvas: React.FC<CanvasProps> = ({ selectedTool }) => {
  const [elements, setElements] = useState<GraphElement[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  // const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number[]>([]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Bounding box selection state
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownOnCanvas, setMouseDownOnCanvas] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const placeElement = (
    type: GraphElementType,
    clientX: number,
    clientY: number,
    target: HTMLDivElement
  ) => {
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = Date.now();
    if (type === 'Text Label') {
      setElements(prev => [...prev, { id, type, x, y, text: 'Text Label' }]);
      setEditingId(id);
    } else {
      setElements(prev => [...prev, { id, type, x, y }]);
    }
  };

  // Handle dropping a tool onto the canvas
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const tool = e.dataTransfer.getData('tool') as GraphElementType;
    if (tool) {
      placeElement(tool, e.clientX, e.clientY, e.currentTarget);
    }
  };

  // Allow dropping by preventing default
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Click-to-place handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      selectedTool === 'Select' &&
      e.target === canvasRef.current &&
      !isSelectingBox
    ) {
      setSelectedId([]);
    }
    if (selectedTool && selectedTool !== 'Select') {
      placeElement(
        selectedTool as GraphElementType,
        e.clientX,
        e.clientY,
        e.currentTarget
      );
      setSelectedId([]);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'Select' && e.target === canvasRef.current) {
      setMouseDownOnCanvas(true);
      setIsSelectingBox(false);
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setBoxEnd(null);
    }
  };

  // Text label editing
  const handleTextChange = (id: number, value: string) => {
    setElements(elements =>
      elements.map(el => (el.id === id ? { ...el, text: value } : el))
    );
  };

  const handleElementMouseDown = (e: React.MouseEvent, id: number) => {
    if (selectedTool === 'Select') {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        setSelectedId(prev =>
          prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
        );
      } else {
        setSelectedId([id]);
      }
      setDraggingId(id);
      const el = elements.find(el => el.id === id);
      if (el && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left - el.x,
          y: e.clientY - rect.top - el.y,
        });
      }
    }
  };

  // Mouse move to drag selected element(s) or update bounding box
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'Select' && mouseDownOnCanvas && boxStart) {
      setIsSelectingBox(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    // ...existing drag logic for elements...
    if (selectedTool === 'Select') {
      if (draggingId !== null && dragOffset) {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const newX = e.clientX - rect.left - dragOffset.x;
          const newY = e.clientY - rect.top - dragOffset.y;
          const deltaX =
            newX - (elements.find(el => el.id === draggingId)?.x ?? 0);
          const deltaY =
            newY - (elements.find(el => el.id === draggingId)?.y ?? 0);
          setElements(elements =>
            elements.map(el =>
              selectedId.includes(el.id)
                ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
                : el
            )
          );
        }
      }
    }
  };

  // Mouse up to end dragging or bounding box selection
  const handleMouseUp = () => {
    setMouseDownOnCanvas(false);
    setDragOffset(null);
    setDraggingId(null);
    if (selectedTool === 'Select' && isSelectingBox && boxStart && boxEnd) {
      const x1 = Math.min(boxStart.x, boxEnd.x);
      const y1 = Math.min(boxStart.y, boxEnd.y);
      const x2 = Math.max(boxStart.x, boxEnd.x);
      const y2 = Math.max(boxStart.y, boxEnd.y);
      const selected = elements
        .filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2)
        .map(el => el.id);
      setSelectedId(selected);
      setIsSelectingBox(false);
      setBoxStart(null);
      setBoxEnd(null);
    }
  };

  // Render each element
  const renderElement = (el: GraphElement) => {
    const isSelected = selectedId.includes(el.id);
    switch (el.type) {
      case 'Text Label':
        return editingId === el.id ? (
          <input
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              border: isSelected ? '2px solid #0078d4' : 'none',
              background: 'transparent',
              fontSize: 16,
              outline: 'none',
              minWidth: 40,
              zIndex: isSelected ? 2 : 1,
            }}
            value={el.text || ''}
            autoFocus
            onBlur={() => setEditingId(null)}
            onChange={e => handleTextChange(el.id, e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              fontSize: 16,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              userSelect: 'none',
              border: isSelected ? '2px solid #0078d4' : 'none',
              background: isSelected ? '#e3f2fd' : 'transparent',
              zIndex: isSelected ? 2 : 1,
              padding: isSelected ? '2px' : '0',
            }}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                // Multi-select with Ctrl/Cmd
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              } else {
                e.stopPropagation();
                setEditingId(el.id);
              }
            }}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
          >
            {el.text}
          </span>
        );
      case 'Pool':
        return (
          <svg
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x - 20,
              top: el.y - 20,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
              border: isSelected ? '2px solid #0078d4' : 'none',
              background: isSelected ? '#e3f2fd' : 'transparent',
            }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <circle
              cx={20}
              cy={20}
              r={18}
              fill="#2196f3"
              stroke="#1565c0"
              strokeWidth={2}
            />
            {isSelected && (
              <circle
                cx={20}
                cy={20}
                r={19}
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Source':
        return (
          <svg
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x - 20,
              top: el.y - 20,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
              border: isSelected ? '2px solid #0078d4' : 'none',
              background: isSelected ? '#e3f2fd' : 'transparent',
            }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points="20,5 35,35 5,35"
              fill="#43a047"
              stroke="#1b5e20"
              strokeWidth={2}
            />
            {isSelected && (
              <polygon
                points="20,5 35,35 5,35"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Drain':
        return (
          <svg
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x - 20,
              top: el.y - 20,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
              border: isSelected ? '2px solid #0078d4' : 'none',
              background: isSelected ? '#e3f2fd' : 'transparent',
            }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points="5,5 35,5 20,35"
              fill="#e53935"
              stroke="#b71c1c"
              strokeWidth={2}
            />
            {isSelected && (
              <polygon
                points="5,5 35,5 20,35"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      default:
        return null;
    }
  };

  // Render bounding box selection rectangle
  const renderSelectionBox = () => {
    if (isSelectingBox && boxStart && boxEnd) {
      const left = Math.min(boxStart.x, boxEnd.x);
      const top = Math.min(boxStart.y, boxEnd.y);
      const width = Math.abs(boxEnd.x - boxStart.x);
      const height = Math.abs(boxEnd.y - boxStart.y);
      return (
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            border: '2px dashed #0078d4',
            background: 'rgba(0,120,212,0.08)',
            pointerEvents: 'none',
            zIndex: 99,
          }}
        />
      );
    }
    return null;
  };

  return (
    <div
      ref={canvasRef}
      className="canvas"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'transparent',
        overflow: 'hidden',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={handleMouseUp}
    >
      {elements.map(renderElement)}
      {renderSelectionBox()}
    </div>
  );
};

export default Canvas;
