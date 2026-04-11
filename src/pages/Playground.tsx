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
}

const Playground: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [runType, setRunType] = useState<'quick' | 'multiple' | null>(null);
  const [numRuns, setNumRuns] = useState(100);
  const [visibleRuns, setVisibleRuns] = useState(25);

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
    chart: {
      color: string;
      thickness: number;
      text: string;
      scaleX: number;
      scaleY: number;
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
      activation: 'automatic',
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
    chart: {
      color: '#000000',
      thickness: 2,
      text: '',
      scaleX: 0,
      scaleY: 0,
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
      // During multiple runs the Canvas manages run sequencing internally,
      // so we skip freezing the board between individual runs.
      if (runType === 'multiple') return;
      console.log('🎊 Game ended!');
      setGameEnded(true);
    };

    document.addEventListener('game-end', handleGameEnd as EventListener);

    return () => {
      document.removeEventListener('game-end', handleGameEnd as EventListener);
    };
  }, [runType]);

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
    setIsRunning(false);
    setRunType(null);
    setGameEnded(false);
    // Canvas Block C owns the full board reset when isRunning flips to false
  };

  // Called by Canvas when a Quick Run or Multiple Runs finishes.
  // Only stops the simulation — Canvas already froze the board via gameEndedRef,
  // so Block A will reset on the next run start.
  const handleSimulationComplete = () => {
    setIsRunning(false);
    setRunType(null);
    setGameEnded(false);
  };

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
              runType={runType}
              numRuns={numRuns}
              visibleRuns={visibleRuns}
              onSimulationComplete={handleSimulationComplete}
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
            disabled={false}
            runType={runType}
            numRuns={numRuns}
            visibleRuns={visibleRuns}
            onNumRunsChange={setNumRuns}
            onVisibleRunsChange={setVisibleRuns}
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
