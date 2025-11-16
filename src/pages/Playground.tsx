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
type ConnectionPoint = { x: number; y: number };
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

  formula?: string;
  minValue?: number;
  maxValue?: number;
  interactive?: boolean | string;
  startingValue?: number;
  step?: number;
  currentValue?: number;

  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  connectedToStart?: number;
  connectedToEnd?: number;
  points?: ConnectionPoint[];
  // Simulation state properties
  hasStarted?: boolean;
  currentPoints?: number;
  triggerCount?: number;
  lastGateValue?: number;
  // End Condition properties
  inhibited?: boolean;
  isBlinking?: boolean;
  // Convertor properties
  inputResources?: Record<string, number>;
  outputResources?: Record<string, number>;
  conversionRate?: Record<string, number>;
  // Trader properties
  traderInputs?: Record<string, number>;
  traderOutputs?: Record<string, number>;
  isIncompleteTrader?: boolean;
  isDisabledByState?: boolean;
  isStateConditionDisabled?: boolean;
}

const Playground: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [runType, setRunType] = useState<'quick' | 'multiple' | null>(null);

  const [gameEnded, setGameEnded] = useState(false);

  const [selectedTool, setSelectedTool] = useState<string>('Select');
  const [selectedElementIds, setSelectedElementIds] = useState<number[]>([]);
  const [selectedElement, setSelectedElement] = useState<GraphElement | null>(
    null
  );

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
      activation: 'automatic',
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
      activation: 'automatic',
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
      activation: 'automatic',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    convertor: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'automatic',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    trader: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'automatic',
      actions: 1,
      pullMode: 'pull any',
      resources: '',
    },
    drain: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'automatic',
      actions: 1,
      pullMode: 'pull any',
    },
    delay: {
      color: '#000000',
      thickness: 2,
      text: '',
      activation: 'automatic',
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
      activation: 'automatic',
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

  useEffect(() => {
    const handleGameEnd = () => {
      console.log('🎊 Game ended!');
      setGameEnded(true);
    };

    document.addEventListener('game-end', handleGameEnd as EventListener);

    return () => {
      document.removeEventListener('game-end', handleGameEnd as EventListener);
    };
  }, []);

  const handleRunClick = () => {
    if (!isRunning) {
      // Starting quick run
      setRunType('quick');
      setIsRunning(true);
      setGameEnded(false);
    } else {
      // Stopping
      //setIsRunning(false);
      //setRunType(null);
      handleReset();
    }
  };

  const handleMultipleRunClick = () => {
    if (!isRunning) {
      // Starting multiple run
      setRunType('multiple');
      setIsRunning(true);
      setGameEnded(false);
    }
  };

  const handleReset = () => {
    // Stop the simulation
    setIsRunning(false);
    setRunType(null);
    setGameEnded(false);
    // Keep runType so we know which button to show when running again

    // Reset all elements to initial state
    const resetElements = elements.map((el: GraphElement) => {
      const reset: Partial<GraphElement> = {
        hasStarted: false,
        triggerCount: 0,
        lastGateValue: undefined,
      };

      // Reset Pool resources to starting value
      if (el.type === 'Pool') {
        reset.currentPoints = el.number ?? 0;
      }

      // Reset Register to starting value
      if (el.type === 'Register') {
        if (el.interactive === true || el.interactive === 'true') {
          reset.currentValue = el.startingValue || 0;
        } else {
          reset.currentValue = 0;
        }
      }

      // Reset EndCondition state
      if (el.type === 'End Condition') {
        reset.inhibited = true;
        reset.isBlinking = false;
      }

      // Clear stored resources in Converter and Trader
      if (el.type === 'Convertor') {
        reset.inputResources = {};
        reset.outputResources = {};
        reset.conversionRate = {};
      }

      if (el.type === 'Trader') {
        reset.traderInputs = {};
        reset.traderOutputs = {};
      }

      return { ...el, ...reset };
    });

    setElements(resetElements);
  };

  const handleElementUpdate = (
    elementId: number,
    updates: Partial<GraphElement>
  ) => {
    const targetElement = elements.find(el => el.id === elementId);
    const isStateConnection = targetElement?.type === 'State Connection';
    const resourceConnection = isStateConnection
      ? elements.find(
          el =>
            el.id === targetElement?.connectedToEnd &&
            el.type === 'Resource Connection'
        )
      : null;

    const newElements = elements.map(el => {
      if (el.id === elementId) {
        return { ...el, ...updates };
      }
      if (
        resourceConnection &&
        el.id === resourceConnection.id &&
        updates.text !== undefined &&
        typeof targetElement?.text !== 'undefined'
      ) {
        const previousValue = parseLabelNumber(targetElement?.text);
        const nextValue = parseLabelNumber(updates.text);
        const resourceBase = parseLabelNumber(el.text);
        if (
          previousValue !== null &&
          nextValue !== null &&
          resourceBase !== null
        ) {
          const delta = nextValue - previousValue;
          const updatedValue = resourceBase + delta;
          return { ...el, text: formatLabelNumber(updatedValue) };
        }
      }
      return el;
    });

    setElements(newElements);

    if (selectedElement && selectedElement.id === elementId) {
      setSelectedElement({ ...selectedElement, ...updates });
    } else if (
      selectedElement &&
      resourceConnection &&
      selectedElement.id === resourceConnection.id &&
      updates.text !== undefined
    ) {
      const updatedSelected = newElements.find(
        el => el.id === selectedElement.id
      );
      if (updatedSelected) {
        setSelectedElement(updatedSelected);
      }
    }
  };

  const handleSelectionChange = useCallback(
    (newSelectedIds: number[]) => {
      setSelectedElementIds(newSelectedIds);
      if (newSelectedIds.length === 1) {
        const element = elements.find(el => el.id === newSelectedIds[0]);
        setSelectedElement(element || null);
      } else {
        setSelectedElement(null);
      }
    },
    [elements]
  );

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
      <TopBar isRunning={isRunning} onRunClick={handleRunClick} />
      <div className="playground-body">
        <div className="canvas-section">
          <div className="grid-canvas">
            <Canvas
              isRunning={isRunning && !gameEnded}
              selectedTool={selectedTool}
              elements={elements}
              selectedElementIds={selectedElementIds}
              onElementsChange={setElements}
              onSelectionChange={handleSelectionChange}
              onElementUpdate={handleElementUpdate}
              onElementSelection={handleElementSelection}
              onToolChange={setSelectedTool}
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
            isRunning={isRunning}
            runType={runType}
            onRunClick={handleRunClick}
            onMultipleRunClick={handleMultipleRunClick}
            onReset={handleReset}
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

const parseLabelNumber = (value?: string | number | null): number | null => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalised = trimmed.startsWith('+')
    ? trimmed.slice(1)
    : trimmed;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatLabelNumber = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return `${rounded}`;
};
