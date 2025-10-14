import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Canvas.css';

interface CanvasProps {
  selectedTool: string;
  elements?: GraphElement[];
  selectedElementIds?: number[];
  onElementsChange?: (elements: GraphElement[]) => void;
  onSelectionChange?: (selectedIds: number[]) => void;

  onElementUpdate?: (elementId: number, updates: Partial<GraphElement>) => void;
  onElementSelection?: (element: GraphElement | null) => void;
  //externalElementUpdate?: {
    //elementId: number;
    //updates: Partial<GraphElement>;
  //} | null;
  toolProperties?: {
    textLabel: { text: string; color: string };
    group: { text: string; color: string };
    pool: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
      number: number;
      max: number;
      displayLimit: number;
    };
    gate: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      type: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';
    };
    resourceConnection: {
      color: string;
      thickness: number;
      text: string;
      minValue: number;
      maxValue: number;
    };
    stateConnection: {
      color: string;
      thickness: number;
      text: string;
      minValue: number;
      maxValue: number;
    };
    source: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    convertor: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    trader: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    drain: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
    };
    delay: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      queue: boolean;
    };
    register: {
      color: string;
      thickness: number;
      formula: string;
      minValue: number;
      maxValue: number;
      interactive: boolean;
      startingValue: number;
      step: number;
    };
    endCondition: {
      color: string;
      thickness: number;
      text: string;
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
    };
    artificialIntelligence: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      script: string;
    };
  };
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
  color?: string;
  thickness?: number;
  activation?: 'passive' | 'interactive' | 'automatic' | 'onstart';
  pullMode?: 'pull any' | 'pull all' | 'push any' | 'push all';
  resources?: string;
  number?: number;
  max?: number;
  displayLimit?: number;
  // For connection elements
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Connection tracking
  connectedToStart?: number; // ID of element this connection starts from
  connectedToEnd?: number; // ID of element this connection ends at
}

const Canvas: React.FC<CanvasProps> = ({
  selectedTool,
  elements: externalElements,
  selectedElementIds: externalSelectedIds,
  onElementsChange,
  onSelectionChange,
  onElementUpdate,
  onElementSelection,
  //externalElementUpdate,
  toolProperties,
}) => {
  const [internalElements, setInternalElements] = useState<GraphElement[]>([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>([]);
  
  const elements = externalElements ?? internalElements;
  const selectedId = externalSelectedIds ?? internalSelectedIds;
  
  const setElements = useCallback((newElements: GraphElement[] | ((prev: GraphElement[]) => GraphElement[])) => {
    const updatedElements = typeof newElements === 'function' 
      ? newElements(elements) 
      : newElements;
      
    if (onElementsChange) {
      onElementsChange(updatedElements);
    } else {
      setInternalElements(updatedElements);
    }
  }, [elements, onElementsChange]);
  
  const setSelectedId = useCallback((newSelection: number[] | ((prev: number[]) => number[])) => {
    const updatedSelection = typeof newSelection === 'function' 
      ? newSelection(selectedId) 
      : newSelection;
      
    if (onSelectionChange) {
      onSelectionChange(updatedSelection);
    } else {
      setInternalSelectedIds(updatedSelection);
    }
  }, [selectedId, onSelectionChange]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggedElements, setDraggedElements] = useState<GraphElement[] | null>(null);
  const [pasteCount, setPasteCount] = useState(0);

  // Bounding box selection state
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownOnCanvas, setMouseDownOnCanvas] = useState(false);
  const [justCompletedBoxSelection, setJustCompletedBoxSelection] = useState(false);

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
  const [connectionStart, setConnectionStart] = useState<{ x: number; y: number } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [connectionType, setConnectionType] = useState<GraphElementType | null>(null);

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.length > 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        e.preventDefault();
        setElements(prev => prev.filter(el => !selectedId.includes(el.id)));
        setSelectedId([]);
      }
    };

    //edit
    const handleSelectAll = () => {
      const allIds = elements.map(el => el.id);
      setSelectedId(allIds);
      console.log('Selected all elements:', allIds.length);
    };

    const handleDeleteSelected = () => {
      if (selectedId.length > 0) {
        setElements(prev => prev.filter(el => !selectedId.includes(el.id)));
        setSelectedId([]);
        console.log('Deleted selected elements');
      }
    };

    const handlePasteElements = (event: CustomEvent) => {
      const { elements: clipboardElements } = event.detail;
      if (clipboardElements && clipboardElements.length > 0) {
        const maxId = Math.max(...elements.map(el => el.id), 0);
        const offset = (pasteCount + 1) * 20;
        
        const pastedElements = clipboardElements.map((el: GraphElement, index: number) => ({
          ...el,
          id: maxId + index + 1,
          x: el.x + offset,
          y: el.y + offset,
          connectedToStart: undefined,
          connectedToEnd: undefined,
        }));
        
        setElements(prev => [...prev, ...pastedElements]);
        setSelectedId(pastedElements.map((el: { id: any; }) => el.id));
        setPasteCount(prev => prev + 1);
        console.log('Pasted elements with offset:', offset);
      }
    };

    const handleResetPasteCount = () => {
      setPasteCount(0);
      console.log('Reset paste count on new copy');
    };

    const handleUndo = () => {
      console.log('Undo event received in Canvas');
    };
    
    
    const handleRedo = () => {
      console.log('Redo event received in Canvas');
    };

    const handleZoomFit = () => {
      console.log('Zoom to fit triggered');
      if (elements.length === 0) return;
      
      const bounds = elements.reduce(
        (acc, el) => ({
          minX: Math.min(acc.minX, el.x),
          minY: Math.min(acc.minY, el.y),
          maxX: Math.max(acc.maxX, el.x + (el.width || 40)),
          maxY: Math.max(acc.maxY, el.y + (el.height || 40)),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
      const canvasWidth = canvasRef.current?.clientWidth || 800;
      const canvasHeight = canvasRef.current?.clientHeight || 600;
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;
      
      const scaleX = (canvasWidth - 100) / contentWidth;
      const scaleY = (canvasHeight - 100) / contentHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      
      console.log('Zoom calculated:', { bounds, scale, canvasWidth, canvasHeight });
      
      const zoomEvent = new CustomEvent('canvas-zoom-update', {
        detail: { bounds, scale, elementCount: elements.length }
      });
      document.dispatchEvent(zoomEvent);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('canvas-select-all', handleSelectAll);
    document.addEventListener('canvas-delete-selected', handleDeleteSelected);
    document.addEventListener('canvas-paste-elements', handlePasteElements as EventListener);
    document.addEventListener('canvas-reset-paste-count', handleResetPasteCount);
    document.addEventListener('canvas-undo', handleUndo);
    document.addEventListener('canvas-redo', handleRedo);
    document.addEventListener('canvas-zoom-fit', handleZoomFit);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('canvas-select-all', handleSelectAll);
      document.removeEventListener('canvas-delete-selected', handleDeleteSelected);
      document.removeEventListener('canvas-paste-elements', handlePasteElements as EventListener);
      document.removeEventListener('canvas-reset-paste-count', handleResetPasteCount);
      document.removeEventListener('canvas-undo', handleUndo);
      document.removeEventListener('canvas-redo', handleRedo);
      document.removeEventListener('canvas-zoom-fit', handleZoomFit);
    };
  }, [isCreatingConnection, selectedId, elements, setElements, setSelectedId, pasteCount]);

  useEffect(() => {
    if (onElementSelection) {
      if (selectedId.length === 1) {
        const element = elements.find(el => el.id === selectedId[0]);
        onElementSelection(element || null);
      } else if (selectedId.length === 0) {
        onElementSelection(null);
      }
    }
  }, [selectedId.length, selectedId[0]]);

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
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          text: toolProperties?.textLabel?.text || 'Text Label',
          color: toolProperties?.textLabel?.color || '#000000',
        },
      ]);
      setEditingId(id);
    } else if (type === 'Group') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          width: 200,
          height: 150,
          text: toolProperties?.group?.text || '',
          color: toolProperties?.group?.color || '#000000',
        },
      ]);
    } else if (type === 'Pool') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          ...toolProperties?.pool,
        },
      ]);
    } else if (type === 'Resource Connection' || type === 'State Connection') {
      setIsCreatingConnection(true);
      setConnectionStart({ x, y });
      setConnectionEnd({ x, y });
      setConnectionType(type);
    } else if (type === 'Source') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,

          ...toolProperties?.source,
          // color: toolProperties?.source?.color,
          // thickness: toolProperties?.source?.thickness,
          // text: toolProperties?.source?.text,
          // activation: toolProperties?.source?.activation,
          // actions: toolProperties?.source?.actions,
          // pullMode: toolProperties?.source?.pullMode,
          // resources: toolProperties?.source?.resources,
        },
      ]);
    } else if (type === 'Gate') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.gate?.color,
          thickness: toolProperties?.gate?.thickness,
          text: toolProperties?.gate?.text,
          activation: toolProperties?.gate?.activation,
          actions: toolProperties?.gate?.actions,
          pullMode: toolProperties?.gate?.pullMode,
          gateType: toolProperties?.gate?.type,
        },
      ]);
    } else if (type === 'Drain') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.drain?.color,
          thickness: toolProperties?.drain?.thickness,
          text: toolProperties?.drain?.text,
          activation: toolProperties?.drain?.activation,
          actions: toolProperties?.drain?.actions,
          pullMode: toolProperties?.drain?.pullMode,
        },
      ]);
    } else if (type === 'Convertor') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.convertor?.color,
          thickness: toolProperties?.convertor?.thickness,
          text: toolProperties?.convertor?.text,
          activation: toolProperties?.convertor?.activation,
          actions: toolProperties?.convertor?.actions,
          pullMode: toolProperties?.convertor?.pullMode,
          resources: toolProperties?.convertor?.resources,
        },
      ]);
    } else if (type === 'Trader') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.trader?.color,
          thickness: toolProperties?.trader?.thickness,
          text: toolProperties?.trader?.text,
          activation: toolProperties?.trader?.activation,
          actions: toolProperties?.trader?.actions,
          pullMode: toolProperties?.trader?.pullMode,
          resources: toolProperties?.trader?.resources,
        },
      ]);
    } else if (type === 'Delay') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.delay?.color,
          thickness: toolProperties?.delay?.thickness,
          text: toolProperties?.delay?.text,
          activation: toolProperties?.delay?.activation,
          actions: toolProperties?.delay?.actions,
          queue: toolProperties?.delay?.queue,
        },
      ]);
    } else if (type === 'Register') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.register?.color,
          thickness: toolProperties?.register?.thickness,
          formula: toolProperties?.register?.formula,
          minValue: toolProperties?.register?.minValue,
          maxValue: toolProperties?.register?.maxValue,
          interactive: toolProperties?.register?.interactive,
          startingValue: toolProperties?.register?.startingValue,
          step: toolProperties?.register?.step,
        },
      ]);
    } else if (type === 'End Condition') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.endCondition?.color,
          thickness: toolProperties?.endCondition?.thickness,
          text: toolProperties?.endCondition?.text,
          actions: toolProperties?.endCondition?.actions,
          pullMode: toolProperties?.endCondition?.pullMode,
        },
      ]);
    } else if (type === 'Artifical Intelligence') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.artificialIntelligence?.color,
          thickness: toolProperties?.artificialIntelligence?.thickness,
          text: toolProperties?.artificialIntelligence?.text,
          activation: toolProperties?.artificialIntelligence?.activation,
          actions: toolProperties?.artificialIntelligence?.actions,
          script: toolProperties?.artificialIntelligence?.script,
        },
      ]);
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
    // Notify parent component of the change
    if (onElementUpdate) {
      onElementUpdate(id, { text: value });
    }
  };

  // Get currently selected element
  const getSelectedElement = (): GraphElement | null => {
    if (selectedId.length === 1) {
      return elements.find(el => el.id === selectedId[0]) || null;
    }
    return null;
  };

  // Handle external updates from parent component
  //React.useEffect(() => {
    //if (externalElementUpdate) {
      //setElements(prevElements =>
        //prevElements.map(el =>
          //el.id === externalElementUpdate.elementId
            //? { ...el, ...externalElementUpdate.updates }
            //: el
        //)
      //);
    //}
  //}, [externalElementUpdate]);

  // Expose selected element to parent
  React.useEffect(() => {
    const selectedEl = getSelectedElement();
    if (onElementSelection) {
      onElementSelection(selectedEl);
    }
  }, [selectedId, elements, onElementSelection]);

  const handleElementMouseDown = (e: React.MouseEvent, id: number) => {
    if (selectedTool === 'Select') {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        setSelectedId(prev =>
          prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
        );
      } else {
        if (selectedId.includes(id)) {
        } else {
          setSelectedId([id]);
        }
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
          const baseElements = draggedElements || elements;
          const draggingElement = baseElements.find(el => el.id === draggingId);
          
          if (!draggingElement) return;
          
          const deltaX = newX - draggingElement.x;
          const deltaY = newY - draggingElement.y;
    
          const updatedElements = baseElements.map(el =>
            selectedId.includes(el.id)
              ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
              : el
          );
    
          const finalElements = updatedElements.map(element => {
            if (element.type !== 'Resource Connection' && element.type !== 'State Connection') {
              return element;
            }
    
            const updatedElement = { ...element };
            let needsUpdate = false;
    
            selectedId.forEach(movedId => {
              const movedElement = updatedElements.find(el => el.id === movedId);
              if (!movedElement) return;
    
              if (element.connectedToStart === movedId) {
                const startEdgePoint = findClosestEdgePoint(
                  element.endX || element.x,
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
                const endEdgePoint = findClosestEdgePoint(
                  element.startX || element.x,
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
    
          setDraggedElements(finalElements);
        }
      }
    }
  };

  // Mouse up to end dragging or bounding box selection or resize or create connection
  const handleMouseUp = () => {
    const wasDragging = draggingId !== null && dragOffset !== null;
    if (wasDragging && draggedElements) {
      setElements(draggedElements);
      setDraggedElements(null);
    }

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
          ...(connectionType === 'Resource Connection'
            ? toolProperties?.resourceConnection
            : {}),
          ...(connectionType === 'State Connection'
            ? toolProperties?.stateConnection
            : {}),
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
            className={`text-label-input ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              color: el.color || '#000000',
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
            className={`text-label-span ${selectedTool === 'Select' ? 'selectable' : 'clickable'} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              color: el.color || '#000000',
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
            className={`svg-element pool-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              className={`pool-circle ${isSelected ? 'selected' : ''}`}
              fill="none"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth="2"
            />
          </svg>
        );
      case 'Source':
        return (
          <svg
            key={el.id}
            className={`svg-element source-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`source-triangle ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Drain':
        return (
          <svg
            key={el.id}
            className={`svg-element drain-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'} // Add this
              stroke={isSelected ? '#0078d4' : el.color || '#000000'} // Add this
              className={`drain-triangle ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Group':
        return (
          <div
            key={el.id}
            className={`group-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              width: el.width || 200,
              height: el.height || 150,
              borderColor: el.color || '#666',
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
            {/* Group text content */}
            {el.text && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: el.color || '#000000',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                {el.text}
              </div>
            )}
            {/* Resize handles */}
            {isSelected && (
              <>
                {/* Southeast handle */}
                <div
                  className="resize-handle se"
                  onMouseDown={e => handleResizeStart(e, el.id, 'se')}
                />
                {/* Southwest handle */}
                <div
                  className="resize-handle sw"
                  onMouseDown={e => handleResizeStart(e, el.id, 'sw')}
                />
                {/* Northeast handle */}
                <div
                  className="resize-handle ne"
                  onMouseDown={e => handleResizeStart(e, el.id, 'ne')}
                />
                {/* Northwest handle */}
                <div
                  className="resize-handle nw"
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
            className={`svg-element gate-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`gate-diamond ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Convertor':
        return (
          <svg
            key={el.id}
            className={`svg-element convertor-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`convertor-shape ${isSelected ? 'selected' : ''}`}
            />
            <line x1="5" y1="5" x2="5" y2="35" className="convertor-line" />
          </svg>
        );
      case 'End Condition':
        return (
          <svg
            key={el.id}
            className={`svg-element end-condition-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`end-condition-rect ${isSelected ? 'selected' : ''}`}
            />
            <rect
              x="12"
              y="12"
              width="16"
              height="16"
              fill={el.color || '#000000'}
              className="end-condition-inner-rect"
            />
          </svg>
        );
      case 'Artifical Intelligence':
        return (
          <svg
            key={el.id}
            className={`svg-element ai-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`ai-rect ${isSelected ? 'selected' : ''}`}
            />
            <text x="20" y="22" className="ai-text">
              AP
            </text>
          </svg>
        );
      case 'Register':
        return (
          <svg
            key={el.id}
            className={`svg-element register-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`register-rect ${isSelected ? 'selected' : ''}`}
            />
            <text x="20" y="22" className="register-text">
              x
            </text>
          </svg>
        );
      case 'Delay':
        return (
          <svg
            key={el.id}
            className={`svg-element delay-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`delay-circle ${isSelected ? 'selected' : ''}`}
            />
            <text x="20" y="22" className="delay-text">
              8
            </text>
          </svg>
        );
      case 'Trader':
        return (
          <svg
            key={el.id}
            className={`svg-element trader-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
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
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`trader-polygon ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Resource Connection':
        return (
          <div
            key={el.id}
            className={`connection-container ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: Math.min(el.startX || el.x, el.endX || el.x) - 5,
              top: Math.min(el.startY || el.y, el.endY || el.y) - 5,
              width: Math.abs((el.endX || el.x) - (el.startX || el.x)) + 10,
              height: Math.abs((el.endY || el.y) - (el.startY || el.y)) + 10,
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
            <svg className="connection-svg">
              <defs>
                <marker id={`arrowhead-${el.id}`} className="arrow-marker">
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill={el.color || '#000000'}
                    className="arrow-polygon"
                  />
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
                stroke={isSelected ? '#0078d4' : el.color || '#333'}
                strokeWidth={isSelected ? 3 : 2}
                className={`connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-${el.id})`}
              />
            </svg>
            {/* Resize handles for arrows */}
            {isSelected && (
              <>
                {/* Start point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.startX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.startY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                {/* End point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.endX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.endY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
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
            className={`connection-container ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: Math.min(el.startX || el.x, el.endX || el.x) - 5,
              top: Math.min(el.startY || el.y, el.endY || el.y) - 5,
              width: Math.abs((el.endX || el.x) - (el.startX || el.x)) + 10,
              height: Math.abs((el.endY || el.y) - (el.startY || el.y)) + 10,
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
            <svg className="connection-svg">
              <defs>
                <marker
                  id={`arrowhead-dashed-${el.id}`}
                  className="arrow-marker"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill={el.color || '#000000'}
                    className="dashed-arrow-polygon"
                  />
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
                stroke={isSelected ? '#0078d4' : el.color || '#666'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={isSelected ? '5,5' : '5,5'}
                className={`state-connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-dashed-${el.id})`}
              />
            </svg>
            {/* Resize handles for arrows */}
            {isSelected && (
              <>
                {/* Start point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.startX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.startY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                {/* End point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.endX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.endY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
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
          className="connection-preview"
          style={{
            left,
            top,
            width,
            height,
          }}
        >
          <defs>
            <marker id="arrowhead-preview" className="arrow-marker">
              <polygon points="0 0, 10 3.5, 0 7" className="arrow-polygon" />
            </marker>
          </defs>
          <line
            x1={connectionStart.x - left + 5}
            y1={connectionStart.y - top + 5}
            x2={connectionEnd.x - left + 5}
            y2={connectionEnd.y - top + 5}
            className={`connection-line ${connectionType === 'State Connection' ? 'state-connection-line' : ''}`}
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
          className="selection-box"
          style={{
            left,
            top,
            width,
            height,
          }}
        />
      );
    }
    return null;
  };

  const displayElements = draggedElements || elements;

  return (
    <div
      ref={canvasRef}
      className="canvas"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={handleMouseUp}
    >
      {displayElements.map(renderElement)}
      {elements.map(renderElement)}
      {renderConnectionPreview()}
      {renderSelectionBox()}
    </div>
  );
};

export default Canvas;
