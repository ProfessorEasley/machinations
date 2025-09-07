import React, { useState, useRef, useEffect } from 'react';

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
  width?: number;
  height?: number;
  // For connection elements
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Connection tracking
  connectedToStart?: number; // ID of element this connection starts from
  connectedToEnd?: number; // ID of element this connection ends at
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
  const [justCompletedBoxSelection, setJustCompletedBoxSelection] =
    useState(false);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizingId, setResizingId] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Connection creation state
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectionType, setConnectionType] = useState<GraphElementType | null>(
    null
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle escape key to cancel connection creation
      if (e.key === 'Escape' && isCreatingConnection) {
        setIsCreatingConnection(false);
        setConnectionStart(null);
        setConnectionEnd(null);
        setConnectionType(null);
      }

      // Handle delete key to remove selected elements
      if (e.key === 'Delete' && selectedId.length > 0) {
        setElements(prev => prev.filter(el => !selectedId.includes(el.id)));
        setSelectedId([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCreatingConnection, selectedId]);

  // Helper function to find the closest element to a point
  const findClosestElement = (
    x: number,
    y: number,
    excludeId?: number
  ): GraphElement | null => {
    const threshold = 60; // Maximum distance to consider an element "close"
    let closestElement: GraphElement | null = null;
    let closestDistance = threshold;

    elements.forEach(element => {
      if (element.id === excludeId) return;

      // Skip connection elements
      if (
        element.type === 'Resource Connection' ||
        element.type === 'State Connection'
      )
        return;

      const elementX = element.x;
      const elementY = element.y;
      let elementWidth = 40; // Default size for most elements
      let elementHeight = 40;

      // Adjust for different element types
      if (element.type === 'Group') {
        elementWidth = element.width || 200;
        elementHeight = element.height || 150;
      }

      // Calculate distance to element center
      const centerX = elementX + elementWidth / 2;
      const centerY = elementY + elementHeight / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestElement = element;
      }
    });

    return closestElement;
  };

  // Helper function to find the closest edge point of an element
  const findClosestEdgePoint = (
    x: number,
    y: number,
    element: GraphElement
  ): { x: number; y: number } => {
    const elementWidth = element.type === 'Group' ? element.width || 200 : 40;
    const elementHeight = element.type === 'Group' ? element.height || 150 : 40;

    const left = element.x;
    const right = element.x + elementWidth;
    const top = element.y;
    const bottom = element.y + elementHeight;

    // Calculate distances to each edge
    const distances = {
      left: Math.abs(x - left),
      right: Math.abs(x - right),
      top: Math.abs(y - top),
      bottom: Math.abs(y - bottom),
    };

    // Find the closest edge
    const closestEdge = Object.keys(distances).reduce((a, b) =>
      distances[a as keyof typeof distances] <
      distances[b as keyof typeof distances]
        ? a
        : b
    );

    // Calculate the connection point on the closest edge
    let connectionX = x;
    let connectionY = y;

    switch (closestEdge) {
      case 'left':
        connectionX = left;
        connectionY = Math.max(top, Math.min(bottom, y));
        break;
      case 'right':
        connectionX = right;
        connectionY = Math.max(top, Math.min(bottom, y));
        break;
      case 'top':
        connectionX = Math.max(left, Math.min(right, x));
        connectionY = top;
        break;
      case 'bottom':
        connectionX = Math.max(left, Math.min(right, x));
        connectionY = bottom;
        break;
    }

    return { x: connectionX, y: connectionY };
  };

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
    } else if (type === 'Group') {
      setElements(prev => [
        ...prev,
        { id, type, x, y, width: 200, height: 150 },
      ]);
    } else if (type === 'Resource Connection' || type === 'State Connection') {
      // Start connection creation
      setIsCreatingConnection(true);
      setConnectionStart({ x, y });
      setConnectionEnd({ x, y });
      setConnectionType(type);
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
    // Don't clear selection if we just completed a box selection
    if (justCompletedBoxSelection) {
      setJustCompletedBoxSelection(false);
      return;
    }

    // Only clear selection if clicking directly on canvas (not on elements) and not using Ctrl/Cmd
    if (
      selectedTool === 'Select' &&
      e.target === canvasRef.current &&
      !isSelectingBox &&
      !e.ctrlKey &&
      !e.metaKey
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

      // If not holding Ctrl/Cmd, clear selection when starting box selection
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedId([]);
      }
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

  // Mouse move to drag selected element(s) or update bounding box or resize or create connection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'Select' && mouseDownOnCanvas && boxStart) {
      setIsSelectingBox(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // Handle connection creation
    if (isCreatingConnection && connectionStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setConnectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }

    // Handle resize
    if (isResizing) {
      // Check if it's arrow resize
      if (resizeHandle === 'start' || resizeHandle === 'end') {
        handleArrowResizeMove(e);
      } else {
        handleResizeMove(e);
      }
      return;
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

          // Update elements and connections in one operation
          setElements(prevElements => {
            const updatedElements = prevElements.map(el =>
              selectedId.includes(el.id)
                ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
                : el
            );

            // Update connections for moved elements
            return updatedElements.map(element => {
              // Skip if this is not a connection element
              if (
                element.type !== 'Resource Connection' &&
                element.type !== 'State Connection'
              ) {
                return element;
              }

              const updatedElement = { ...element };
              let needsUpdate = false;

              // Check if this connection is connected to any moved element
              selectedId.forEach(movedId => {
                const movedElement = updatedElements.find(
                  el => el.id === movedId
                );
                if (!movedElement) return;

                if (element.connectedToStart === movedId) {
                  console.log(
                    'Updating connection start for element',
                    movedId,
                    'connection',
                    element.id
                  );
                  // Find the closest edge point for the start element
                  const startEdgePoint = findClosestEdgePoint(
                    element.endX || element.x, // Use the other end as reference
                    element.endY || element.y,
                    movedElement
                  );
                  updatedElement.startX = startEdgePoint.x;
                  updatedElement.startY = startEdgePoint.y;
                  updatedElement.x = updatedElement.startX;
                  updatedElement.y = updatedElement.startY;
                  needsUpdate = true;
                }

                if (element.connectedToEnd === movedId) {
                  console.log(
                    'Updating connection end for element',
                    movedId,
                    'connection',
                    element.id
                  );
                  // Find the closest edge point for the end element
                  const endEdgePoint = findClosestEdgePoint(
                    element.startX || element.x, // Use the other end as reference
                    element.startY || element.y,
                    movedElement
                  );
                  updatedElement.endX = endEdgePoint.x;
                  updatedElement.endY = endEdgePoint.y;
                  needsUpdate = true;
                }
              });

              return needsUpdate ? updatedElement : element;
            });
          });
        }
      }
    }
  };

  // Mouse up to end dragging or bounding box selection or resize or create connection
  const handleMouseUp = () => {
    setMouseDownOnCanvas(false);
    setDragOffset(null);
    setDraggingId(null);

    // Handle connection creation end
    if (
      isCreatingConnection &&
      connectionStart &&
      connectionEnd &&
      connectionType
    ) {
      const id = Date.now();

      // Find closest elements to start and end points
      const startElement = findClosestElement(
        connectionStart.x,
        connectionStart.y
      );
      const endElement = findClosestElement(connectionEnd.x, connectionEnd.y);

      console.log('Connection creation:', {
        startElement: startElement?.id,
        endElement: endElement?.id,
        startPos: { x: connectionStart.x, y: connectionStart.y },
        endPos: { x: connectionEnd.x, y: connectionEnd.y },
      });

      // Calculate connection points relative to element edges
      let finalStartX = connectionStart.x;
      let finalStartY = connectionStart.y;
      let finalEndX = connectionEnd.x;
      let finalEndY = connectionEnd.y;

      if (startElement) {
        const startEdgePoint = findClosestEdgePoint(
          connectionStart.x,
          connectionStart.y,
          startElement
        );
        finalStartX = startEdgePoint.x;
        finalStartY = startEdgePoint.y;
      }

      if (endElement) {
        const endEdgePoint = findClosestEdgePoint(
          connectionEnd.x,
          connectionEnd.y,
          endElement
        );
        finalEndX = endEdgePoint.x;
        finalEndY = endEdgePoint.y;
      }

      setElements(prev => [
        ...prev,
        {
          id,
          type: connectionType,
          x: finalStartX,
          y: finalStartY,
          startX: finalStartX,
          startY: finalStartY,
          endX: finalEndX,
          endY: finalEndY,
          connectedToStart: startElement?.id,
          connectedToEnd: endElement?.id,
        },
      ]);
      setIsCreatingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
      setConnectionType(null);
      return;
    }

    // Handle resize end
    if (isResizing) {
      handleResizeEnd();
      return;
    }

    if (selectedTool === 'Select' && isSelectingBox && boxStart && boxEnd) {
      const x1 = Math.min(boxStart.x, boxEnd.x);
      const y1 = Math.min(boxStart.y, boxEnd.y);
      const x2 = Math.max(boxStart.x, boxEnd.x);
      const y2 = Math.max(boxStart.y, boxEnd.y);
      const selected = elements
        .filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2)
        .map(el => el.id);
      // Add to existing selection instead of replacing it
      setSelectedId(prev => {
        const newSelection = [...prev];
        selected.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
      setIsSelectingBox(false);
      setBoxStart(null);
      setBoxEnd(null);
      setJustCompletedBoxSelection(true);
    }
  };

  // Handle resize start
  const handleResizeStart = (
    e: React.MouseEvent,
    id: number,
    handle: string
  ) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizingId(id);
    setResizeHandle(handle);

    const element = elements.find(el => el.id === id);
    if (element && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setResizeStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: element.width || 200,
        height: element.height || 150,
      });
    }
  };

  // Handle resize during mouse move
  const handleResizeMove = (e: React.MouseEvent) => {
    if (isResizing && resizingId && resizeStart && resizeHandle) {
      const element = elements.find(el => el.id === resizingId);
      if (element && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        let newWidth = element.width || 200;
        let newHeight = element.height || 150;
        let newX = element.x;
        let newY = element.y;

        const deltaX = currentX - resizeStart.x;
        const deltaY = currentY - resizeStart.y;

        switch (resizeHandle) {
          case 'se': // Southeast
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            break;
          case 'sw': // Southwest
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            newX = element.x + (element.width || 200) - newWidth;
            break;
          case 'ne': // Northeast
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newY = element.y + (element.height || 150) - newHeight;
            break;
          case 'nw': // Northwest
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newX = element.x + (element.width || 200) - newWidth;
            newY = element.y + (element.height || 150) - newHeight;
            break;
        }

        setElements(prev =>
          prev.map(el =>
            el.id === resizingId
              ? { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
              : el
          )
        );
      }
    }
  };

  // Handle resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizingId(null);
    setResizeHandle(null);
    setResizeStart(null);
  };

  // Handle arrow resize start
  const handleArrowResizeStart = (
    e: React.MouseEvent,
    id: number,
    handle: 'start' | 'end'
  ) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizingId(id);
    setResizeHandle(handle);

    const element = elements.find(el => el.id === id);
    if (element && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setResizeStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: 0, // Not used for arrows
        height: 0, // Not used for arrows
      });
    }
  };

  // Handle arrow resize during mouse move
  const handleArrowResizeMove = (e: React.MouseEvent) => {
    if (
      isResizing &&
      resizingId &&
      resizeStart &&
      resizeHandle &&
      (resizeHandle === 'start' || resizeHandle === 'end')
    ) {
      const element = elements.find(el => el.id === resizingId);
      if (element && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        setElements(prev =>
          prev.map(el => {
            if (el.id === resizingId) {
              if (resizeHandle === 'start') {
                return {
                  ...el,
                  startX: currentX,
                  startY: currentY,
                  x: currentX,
                  y: currentY,
                };
              } else {
                return {
                  ...el,
                  endX: currentX,
                  endY: currentY,
                };
              }
            }
            return el;
          })
        );
      }
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
      case 'Group':
        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width || 200,
              height: el.height || 150,
              border: '2px dashed #666',
              background: isSelected ? 'rgba(0,120,212,0.1)' : 'transparent',
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
            }}
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
            {/* Resize handles */}
            {isSelected && (
              <>
                {/* Southeast handle */}
                <div
                  style={{
                    position: 'absolute',
                    right: -4,
                    bottom: -4,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    cursor: 'se-resize',
                    zIndex: 3,
                  }}
                  onMouseDown={e => handleResizeStart(e, el.id, 'se')}
                />
                {/* Southwest handle */}
                <div
                  style={{
                    position: 'absolute',
                    left: -4,
                    bottom: -4,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    cursor: 'sw-resize',
                    zIndex: 3,
                  }}
                  onMouseDown={e => handleResizeStart(e, el.id, 'sw')}
                />
                {/* Northeast handle */}
                <div
                  style={{
                    position: 'absolute',
                    right: -4,
                    top: -4,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    cursor: 'ne-resize',
                    zIndex: 3,
                  }}
                  onMouseDown={e => handleResizeStart(e, el.id, 'ne')}
                />
                {/* Northwest handle */}
                <div
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: -4,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    cursor: 'nw-resize',
                    zIndex: 3,
                  }}
                  onMouseDown={e => handleResizeStart(e, el.id, 'nw')}
                />
              </>
            )}
          </div>
        );
      case 'Gate':
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
              points="20,5 35,20 20,35 5,20"
              fill="#ff9800"
              stroke="#e65100"
              strokeWidth={2}
            />
            {isSelected && (
              <polygon
                points="20,5 35,20 20,35 5,20"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Convertor':
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
              points="5,5 35,20 5,35"
              fill="#9c27b0"
              stroke="#4a148c"
              strokeWidth={2}
            />
            <line
              x1="5"
              y1="5"
              x2="5"
              y2="35"
              stroke="#4a148c"
              strokeWidth={2}
            />
            {isSelected && (
              <polygon
                points="5,5 35,20 5,35"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'End Condition':
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
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              fill="#f44336"
              stroke="#b71c1c"
              strokeWidth={2}
            />
            <rect x="12" y="12" width="16" height="16" fill="#b71c1c" />
            {isSelected && (
              <rect
                x="5"
                y="5"
                width="30"
                height="30"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Artifical Intelligence':
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
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              fill="#4caf50"
              stroke="#2e7d32"
              strokeWidth={2}
            />
            <text
              x="20"
              y="22"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="10"
              fontWeight="bold"
            >
              AP
            </text>
            {isSelected && (
              <rect
                x="5"
                y="5"
                width="30"
                height="30"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Register':
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
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              fill="#607d8b"
              stroke="#37474f"
              strokeWidth={2}
            />
            <text
              x="20"
              y="22"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
            >
              x
            </text>
            {isSelected && (
              <rect
                x="5"
                y="5"
                width="30"
                height="30"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Delay':
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
              cx="20"
              cy="20"
              r="15"
              fill="#ff5722"
              stroke="#d84315"
              strokeWidth={2}
            />
            <text
              x="20"
              y="22"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
            >
              8
            </text>
            {isSelected && (
              <circle
                cx="20"
                cy="20"
                r="15"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Trader':
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
              points="8,5 32,5 28,35 4,35"
              fill="#795548"
              stroke="#3e2723"
              strokeWidth={2}
            />
            {isSelected && (
              <polygon
                points="8,5 32,5 28,35 4,35"
                fill="none"
                stroke="#0078d4"
                strokeWidth={2}
              />
            )}
          </svg>
        );
      case 'Resource Connection':
        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: Math.min(el.startX || el.x, el.endX || el.x) - 5,
              top: Math.min(el.startY || el.y, el.endY || el.y) - 5,
              width: Math.abs((el.endX || el.x) - (el.startX || el.x)) + 10,
              height: Math.abs((el.endY || el.y) - (el.startY || el.y)) + 10,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
            }}
            onMouseDown={e => {
              e.stopPropagation();
              if (selectedTool === 'Select') {
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
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <marker
                  id={`arrowhead-${el.id}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
                </marker>
              </defs>
              <line
                x1={
                  (el.startX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y1={
                  (el.startY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                x2={
                  (el.endX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y2={
                  (el.endY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                stroke="#333"
                strokeWidth="2"
                markerEnd={`url(#arrowhead-${el.id})`}
              />
              {isSelected && (
                <line
                  x1={
                    (el.startX || el.x) -
                    Math.min(el.startX || el.x, el.endX || el.x) +
                    5
                  }
                  y1={
                    (el.startY || el.y) -
                    Math.min(el.startY || el.y, el.endY || el.y) +
                    5
                  }
                  x2={
                    (el.endX || el.x) -
                    Math.min(el.startX || el.x, el.endX || el.x) +
                    5
                  }
                  y2={
                    (el.endY || el.y) -
                    Math.min(el.startY || el.y, el.endY || el.y) +
                    5
                  }
                  stroke="#0078d4"
                  strokeWidth="3"
                  markerEnd={`url(#arrowhead-${el.id})`}
                />
              )}
            </svg>
            {/* Resize handles for arrows */}
            {isSelected && (
              <>
                {/* Start point handle */}
                <div
                  style={{
                    position: 'absolute',
                    left:
                      (el.startX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.startY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    borderRadius: '50%',
                    cursor: 'move',
                    zIndex: 3,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                {/* End point handle */}
                <div
                  style={{
                    position: 'absolute',
                    left:
                      (el.endX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.endY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    borderRadius: '50%',
                    cursor: 'move',
                    zIndex: 3,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      case 'State Connection':
        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: Math.min(el.startX || el.x, el.endX || el.x) - 5,
              top: Math.min(el.startY || el.y, el.endY || el.y) - 5,
              width: Math.abs((el.endX || el.x) - (el.startX || el.x)) + 10,
              height: Math.abs((el.endY || el.y) - (el.startY || el.y)) + 10,
              cursor: selectedTool === 'Select' ? 'move' : 'pointer',
              zIndex: isSelected ? 2 : 1,
            }}
            onMouseDown={e => {
              e.stopPropagation();
              if (selectedTool === 'Select') {
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
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <marker
                  id={`arrowhead-dashed-${el.id}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                </marker>
              </defs>
              <line
                x1={
                  (el.startX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y1={
                  (el.startY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                x2={
                  (el.endX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y2={
                  (el.endY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                stroke="#666"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd={`url(#arrowhead-dashed-${el.id})`}
              />
              {isSelected && (
                <line
                  x1={
                    (el.startX || el.x) -
                    Math.min(el.startX || el.x, el.endX || el.x) +
                    5
                  }
                  y1={
                    (el.startY || el.y) -
                    Math.min(el.startY || el.y, el.endY || el.y) +
                    5
                  }
                  x2={
                    (el.endX || el.x) -
                    Math.min(el.startX || el.x, el.endX || el.x) +
                    5
                  }
                  y2={
                    (el.endY || el.y) -
                    Math.min(el.startY || el.y, el.endY || el.y) +
                    5
                  }
                  stroke="#0078d4"
                  strokeWidth="3"
                  strokeDasharray="5,5"
                  markerEnd={`url(#arrowhead-dashed-${el.id})`}
                />
              )}
            </svg>
            {/* Resize handles for arrows */}
            {isSelected && (
              <>
                {/* Start point handle */}
                <div
                  style={{
                    position: 'absolute',
                    left:
                      (el.startX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.startY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    borderRadius: '50%',
                    cursor: 'move',
                    zIndex: 3,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                {/* End point handle */}
                <div
                  style={{
                    position: 'absolute',
                    left:
                      (el.endX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.endY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                    width: 8,
                    height: 8,
                    background: '#0078d4',
                    border: '1px solid white',
                    borderRadius: '50%',
                    cursor: 'move',
                    zIndex: 3,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Render connection being created
  const renderConnectionPreview = () => {
    if (isCreatingConnection && connectionStart && connectionEnd) {
      const left = Math.min(connectionStart.x, connectionEnd.x) - 5;
      const top = Math.min(connectionStart.y, connectionEnd.y) - 5;
      const width = Math.abs(connectionEnd.x - connectionStart.x) + 10;
      const height = Math.abs(connectionEnd.y - connectionStart.y) + 10;

      return (
        <svg
          style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            pointerEvents: 'none',
            zIndex: 99,
          }}
        >
          <defs>
            <marker
              id="arrowhead-preview"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
            </marker>
          </defs>
          <line
            x1={connectionStart.x - left + 5}
            y1={connectionStart.y - top + 5}
            x2={connectionEnd.x - left + 5}
            y2={connectionEnd.y - top + 5}
            stroke="#333"
            strokeWidth="2"
            strokeDasharray={
              connectionType === 'State Connection' ? '5,5' : 'none'
            }
            markerEnd="url(#arrowhead-preview)"
          />
        </svg>
      );
    }
    return null;
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
      {renderConnectionPreview()}
      {renderSelectionBox()}
    </div>
  );
};

export default Canvas;
