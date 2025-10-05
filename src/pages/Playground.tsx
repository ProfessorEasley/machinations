import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';
import Canvas from '../components/Canvas';
import { useHistory } from '../hooks/useHistory';

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
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    connectedToStart?: number;
    connectedToEnd?: number;
  }

  const Playground: React.FC = () => {
    const [selectedTool, setSelectedTool] = useState<string>('Select');
    const [selectedElementIds, setSelectedElementIds] = useState<number[]>([]);
    const [selectedElement, setSelectedElement] = useState<GraphElement | null>(null);
    
    const {
      state: elements,
      setState: setElements,
      undo,
      redo,
      canUndo,
      canRedo,
    } = useHistory<GraphElement[]>([]);
  
  const [toolProperties, setToolProperties] = useState<{
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
  }>({
    textLabel: { text: '', color: '#000000' },
    group: { text: '', color: '#000000' },
    pool: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      pullMode: 'pull any',
      resources: '',
      number: 0,
      max: 100,
      displayLimit: 10,
    },
    gate: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      pullMode: 'pull any',
      type: 'deterministic',
    },
    resourceConnection: {
      color: '#000000',
      thickness: 2,
      text: '',
      minValue: -999,
      maxValue: 999,
    },
    stateConnection: {
      color: '#000000',
      thickness: 2,
      text: '',
      minValue: -999,
      maxValue: 999,
    },
    source: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    convertor: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    trader: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    drain: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      pullMode: 'pull any',
    },
    delay: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      queue: false,
    },
    register: {
      color: '#000000',
      thickness: 2,
      formula: '',
      minValue: -9999,
      maxValue: 9999,
      interactive: false,
      startingValue: 0,
      step: 1,
    },
    endCondition: {
      color: '#000000',
      thickness: 2,
      text: '',
      actions: 1,
      pullMode: 'pull any',
    },
    artificialIntelligence: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'passive',
      actions: 1,
      script: '',
    },
  });

  useEffect(() => {
    const handleUndo = () => {
      console.log('Undo triggered from event');
      undo();
    };

    const handleRedo = () => {
      console.log('Redo triggered from event');
      redo();
    };

    document.addEventListener('canvas-undo', handleUndo);
    document.addEventListener('canvas-redo', handleRedo);

    return () => {
      document.removeEventListener('canvas-undo', handleUndo);
      document.removeEventListener('canvas-redo', handleRedo);
    };
  }, [undo, redo]);

  const handleElementUpdate = (
    elementId: number,
    updates: Partial<GraphElement>
  ) => {
    const newElements = elements.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(newElements);
    
    if (selectedElement && selectedElement.id === elementId) {
      setSelectedElement({ ...selectedElement, ...updates });
    }
    
  };

  const handleSelectionChange = useCallback((newSelectedIds: number[]) => {
    setSelectedElementIds(newSelectedIds);
    if (newSelectedIds.length === 1) {
      const element = elements.find(el => el.id === newSelectedIds[0]);
      setSelectedElement(element || null);
    } else {
      setSelectedElement(null);
    }
  }, [elements]);

  const handleElementSelection = (element: GraphElement | null) => {
    setSelectedElement(element);
  };

  const getSelectedElements = (): GraphElement[] => {
    return elements.filter(el => selectedElementIds.includes(el.id));
  };

  const handleToolPropertiesChange = (
    toolType: string,
    properties: Record<string, unknown>
  ) => {
    setToolProperties(prev => ({
      ...prev,
      [toolType]: { ...prev[toolType as keyof typeof prev], ...properties },
    }));
  };

  // Clear external update after it's been processed
  //React.useEffect(() => {
    //if (externalElementUpdate) {
      // Reset after a short delay to allow Canvas to process the update
      //const timer = setTimeout(() => {
        //setExternalElementUpdate(null);
      //}, 0);
      //return () => clearTimeout(timer);
    //}
  //}, [externalElementUpdate]);

  return (
    <div className="playground-wrapper">
      <TopBar />
      <div className="playground-body">
        <div className="canvas-section">
          <div className="grid-canvas">
            <Canvas
              selectedTool={selectedTool}
              elements={elements}
              selectedElementIds={selectedElementIds}
              onElementsChange={setElements}
              onSelectionChange={handleSelectionChange}
              onElementUpdate={handleElementUpdate}
              onElementSelection={handleElementSelection}
              //externalElementUpdate={externalElementUpdate}
              toolProperties={toolProperties}
            />
          </div>
        </div>
        <div className="right-panel">
          <ToolSideBar
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            selectedElement={selectedElement}
            selectedElements={getSelectedElements()}
            allElements={elements}
            onElementUpdate={handleElementUpdate}
            toolProperties={toolProperties}
            onToolPropertiesChange={handleToolPropertiesChange}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>
    </div>
  );
};

export default Playground;
