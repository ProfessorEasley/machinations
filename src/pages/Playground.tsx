import React from 'react';
import { useState } from 'react';
import TopBar from '../components/TopBar';
import ToolSideBar from '../components/ToolSideBar';
import './Playground.css';
import Canvas from '../components/Canvas';

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
  // Pool-specific properties
  thickness?: number;
  activation?: 'passive' | 'interactive' | 'automatic' | 'onstart';
  pullMode?: 'pull any' | 'pull all' | 'push any' | 'push all';
  resources?: string;
  number?: number;
  max?: number;
  displayLimit?: number;
  // Connection properties
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  connectedToStart?: number;
  connectedToEnd?: number;
}

const Playground: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string>('Select');
  const [selectedElement, setSelectedElement] = useState<GraphElement | null>(
    null
  );
  const [externalElementUpdate, setExternalElementUpdate] = useState<{
    elementId: number;
    updates: Partial<GraphElement>;
  } | null>(null);
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

  const handleElementUpdate = (
    elementId: number,
    updates: Partial<GraphElement>
  ) => {
    // Update the selected element state
    if (selectedElement && selectedElement.id === elementId) {
      setSelectedElement({ ...selectedElement, ...updates });
    }
    // Trigger external update in Canvas
    setExternalElementUpdate({ elementId, updates });
  };

  const handleElementSelection = (element: GraphElement | null) => {
    setSelectedElement(element);
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
  React.useEffect(() => {
    if (externalElementUpdate) {
      // Reset after a short delay to allow Canvas to process the update
      const timer = setTimeout(() => {
        setExternalElementUpdate(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [externalElementUpdate]);

  return (
    <div className="playground-wrapper">
      <TopBar />
      <div className="playground-body">
        <div className="canvas-section">
          <div className="grid-canvas">
            <Canvas
              selectedTool={selectedTool}
              onElementUpdate={handleElementUpdate}
              onElementSelection={handleElementSelection}
              externalElementUpdate={externalElementUpdate}
              toolProperties={toolProperties}
            />
          </div>
        </div>
        <div className="right-panel">
          <ToolSideBar
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            selectedElement={selectedElement}
            onElementUpdate={handleElementUpdate}
            toolProperties={toolProperties}
            onToolPropertiesChange={handleToolPropertiesChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Playground;
