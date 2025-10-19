import React, { useState, useEffect, useCallback } from 'react';
import './ToolSideBar.css';

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

  actions?: number;
  minValue?: number;
  maxValue?: number;
  gateType?: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';

  queue?: boolean;
  formula?: string;
  interactive?: boolean;
  startingValue?: number;
  step?: number;
  script?: string;
  // Connection properties
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  connectedToStart?: number;
  connectedToEnd?: number;
}

interface ToolSideBarProps {
  selectedTool: string;
  setSelectedTool: React.Dispatch<React.SetStateAction<string>>;
  selectedElement?: GraphElement | null;
  selectedElements?: GraphElement[];
  allElements?: GraphElement[];
  onElementUpdate?: (elementId: number, updates: Partial<GraphElement>) => void;
  canUndo?: boolean;
  canRedo?: boolean;

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
  isRunning: boolean;
  onRunClick: () => void;
  onToolPropertiesChange?: (
    toolType: string,
    properties: Record<string, unknown>
  ) => void;
}

const graphTools = [
  'Select',
  'Text Label',
  'Group',
  'Chart',
  'Pool',
  'Gate',
  'Resource Connection',
  'State Connection',
  'Source',
  'Drain',
  'Convertor',
  'Trader',
  'Delay',
  'Register',
  'End Condition',
  'Artifical Intelligence',
];

const fileTools = [
  'New (N)',
  'Open (O)',
  'Import (I)',
  'Save (S)',
  'Export Selection(E)',
  'Save as SVG (G)',
];

// const runTools = ['Quick Run', 'Multiple Runs'];

const ToolSideBar: React.FC<ToolSideBarProps> = ({
  selectedTool,
  setSelectedTool,
  selectedElement,
  selectedElements = [],
  allElements = [],
  onElementUpdate,
  canUndo = false,
  canRedo = false,
  toolProperties,
  onToolPropertiesChange,
  isRunning,
  onRunClick,
}) => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>(
    'Graph'
  );

  const [clipboard, setClipboard] = useState<GraphElement[]>([]);

  const canCopy = selectedElements.length > 0;
  const canPaste = clipboard.length > 0;
  const canDelete = selectedElements.length > 0;

  //edit
  // Edit operation handlers
  const handleSelectAll = useCallback(() => {
    console.log('Select All clicked');
    const selectAllEvent = new CustomEvent('canvas-select-all');
    document.dispatchEvent(selectAllEvent);
  }, []);

  const handleCopy = useCallback(() => {
    if (!canCopy) return;

    setClipboard([...selectedElements]);

    const resetEvent = new CustomEvent('canvas-reset-paste-count');
    document.dispatchEvent(resetEvent);

    console.log(`Copied ${selectedElements.length} elements to clipboard`);
  }, [canCopy, selectedElements]);

  const handlePaste = useCallback(() => {
    if (!canPaste) return;

    const pasteEvent = new CustomEvent('canvas-paste-elements', {
      detail: { elements: clipboard },
    });
    document.dispatchEvent(pasteEvent);
    console.log(`Pasted ${clipboard.length} elements from clipboard`);
  }, [canPaste, clipboard]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;

    console.log('Undo button clicked');
    const undoEvent = new CustomEvent('canvas-undo');
    document.dispatchEvent(undoEvent);
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;

    console.log('Redo button clicked');
    const redoEvent = new CustomEvent('canvas-redo');
    document.dispatchEvent(redoEvent);
  }, [canRedo]);

  const handleZoom = useCallback(() => {
    console.log('Zoom clicked');
    const zoomEvent = new CustomEvent('canvas-zoom-fit');
    document.dispatchEvent(zoomEvent);
  }, []);

  const handleDelete = useCallback(() => {
    if (!canDelete) return;

    const deleteEvent = new CustomEvent('canvas-delete-selected');
    document.dispatchEvent(deleteEvent);
    console.log(`Deleted ${selectedElements.length} elements`);
  }, [canDelete, selectedElements.length]);

  //edit
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'a':
            event.preventDefault();
            handleSelectAll();
            break;
          case 'c':
            if (canCopy) {
              event.preventDefault();
              handleCopy();
            }
            break;
          case 'v':
            if (canPaste) {
              event.preventDefault();
              handlePaste();
            }
            break;
          case 'z':
            event.preventDefault();
            if (event.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            event.preventDefault();
            handleRedo();
            break;
          case 'm':
            event.preventDefault();
            handleZoom();
            break;
        }
      }
      if (event.key === 'Delete' && canDelete) {
        event.preventDefault();
        handleDelete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    canCopy,
    canPaste,
    canDelete,
    canUndo,
    canRedo,
    handleSelectAll,
    handleCopy,
    handlePaste,
    handleUndo,
    handleRedo,
    handleZoom,
    handleDelete,
  ]);

  const handleDragStart = (e: React.DragEvent, tool: string) => {
    e.dataTransfer.setData('tool', tool);
  };

  const handleElementPropertyChange = (
    property: keyof GraphElement,
    value: string
  ) => {
    if (selectedElement && onElementUpdate) {
      onElementUpdate(selectedElement.id, { [property]: value });
    }
  };

  const renderToolButtons = () => {
    switch (activeTab) {
      case 'Graph':
        return (
          <>
            {graphTools.map(tool => (
              <button
                key={tool}
                className={selectedTool === tool ? 'selected' : ''}
                onClick={() => setSelectedTool(tool)}
                draggable
                onDragStart={e => handleDragStart(e, tool)}
              >
                {tool}
              </button>
            ))}
          </>
        );
      //edit
      case 'Edit':
        return (
          <div className="edit-tools">
            <button
              className="edit-button"
              onClick={handleSelectAll}
              disabled={allElements.length === 0}
              title="Select All (Ctrl+A)"
            >
              Select All (A)
            </button>
            <button
              className="edit-button"
              onClick={handleCopy}
              disabled={!canCopy}
              title="Copy (Ctrl+C)"
            >
              Copy (C)
            </button>
            <button
              className="edit-button"
              onClick={handlePaste}
              disabled={!canPaste}
              title="Paste (Ctrl+V)"
            >
              Paste (V)
            </button>
            <button
              className="edit-button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo (Z)
            </button>
            <button
              className="edit-button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              Redo (Y)
            </button>
            <button
              className="edit-button"
              onClick={handleZoom}
              title="Zoom (Ctrl+M)"
            >
              Zoom (M)
            </button>
            <button
              className="edit-button"
              onClick={handleDelete}
              disabled={!canDelete}
              title="Delete Selected (Delete)"
            >
              Delete
            </button>
          </div>
        );
      case 'File':
        return (
          <>
            {fileTools.map(tool => (
              <button
                key={tool}
                className={selectedTool === tool ? 'selected' : ''}
                onClick={() => setSelectedTool(tool)}
              >
                {tool}
              </button>
            ))}
          </>
        );
      case 'Run':
        return (
          <>
            {/* The "Quick Run" button is now a toggle */}
            <button onClick={onRunClick}>
              {isRunning ? 'Stop' : 'Quick Run'}
            </button>
            <button
              onClick={() => {
                /* Logic for multiple runs if needed */
              }}
            >
              Multiple Runs
            </button>
            <label>
              Runs <input type="number" defaultValue={100} />
            </label>
            <label>
              Visible Runs <input type="number" defaultValue={25} />
            </label>
          </>
        );
    }
  };

  const renderPropertiesPanel = () => {
    // Show element-specific properties when a Text Label or Group is selected
    if (
      selectedElement &&
      (selectedElement.type === 'Text Label' ||
        selectedElement.type === 'Group')
    ) {
      return (
        <div className="element-properties-panel">
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label text"
            />
          </label>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
        </div>
      );
    }

    // Show Pool-specific properties when Pool is selected
    if (selectedElement && selectedElement.type === 'Pool') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Pool</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="text"
              value={selectedElement.resources || ''}
              onChange={e =>
                handleElementPropertyChange('resources', e.target.value)
              }
              placeholder="Enter resources"
            />
          </label>
          <label>
            Number
            <input
              type="number"
              value={selectedElement.number || 0}
              onChange={e =>
                handleElementPropertyChange('number', e.target.value)
              }
              min="0"
            />
          </label>
          <label>
            Max
            <input
              type="number"
              value={selectedElement.max || 100}
              onChange={e => handleElementPropertyChange('max', e.target.value)}
              min="0"
            />
          </label>
          <label>
            Display Limit
            <input
              type="number"
              value={selectedElement.displayLimit || 10}
              onChange={e =>
                handleElementPropertyChange('displayLimit', e.target.value)
              }
              min="1"
            />
          </label>
        </div>
      );
    }

    // Show Gate-specific properties when Gate is selected
    if (selectedElement && selectedElement.type === 'Gate') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Gate</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Type
            <div className="button-group">
              {[
                'deterministic',
                'dice',
                'skill',
                'multiplayer',
                'strategy',
              ].map(type => (
                <button
                  key={type}
                  className={`activation-button ${selectedElement.gateType === type ? 'active' : ''}`}
                  onClick={() => handleElementPropertyChange('gateType', type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </label>
        </div>
      );
    }

    // Show Source-specific properties when Source is selected
    if (selectedElement && selectedElement.type === 'Source') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Source</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="text"
              value={selectedElement.resources || ''}
              onChange={e =>
                handleElementPropertyChange('resources', e.target.value)
              }
              placeholder="Enter resources"
            />
          </label>
        </div>
      );
    }

    // Show Drain-specific properties when Drain is selected
    if (selectedElement && selectedElement.type === 'Drain') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Drain</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
        </div>
      );
    }

    // Show Convertor-specific properties when Convertor is selected
    if (selectedElement && selectedElement.type === 'Convertor') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Convertor</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="text"
              value={selectedElement.resources || ''}
              onChange={e =>
                handleElementPropertyChange('resources', e.target.value)
              }
              placeholder="Enter resources"
            />
          </label>
        </div>
      );
    }

    // Show Trader-specific properties when Trader is selected
    if (selectedElement && selectedElement.type === 'Trader') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Trader</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="text"
              value={selectedElement.resources || ''}
              onChange={e =>
                handleElementPropertyChange('resources', e.target.value)
              }
              placeholder="Enter resources"
            />
          </label>
        </div>
      );
    }

    // Show Delay-specific properties when Delay is selected
    if (selectedElement && selectedElement.type === 'Delay') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Delay</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedElement.queue || false}
              onChange={e =>
                handleElementPropertyChange(
                  'queue',
                  e.target.checked.toString()
                )
              }
            />
            Queue
          </label>
        </div>
      );
    }

    // Show Register-specific properties when Register is selected
    if (selectedElement && selectedElement.type === 'Register') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Register</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Formula
            <input
              type="text"
              value={selectedElement.formula || ''}
              onChange={e =>
                handleElementPropertyChange('formula', e.target.value)
              }
              placeholder="Enter formula"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={selectedElement.minValue ?? -9999}
              onChange={e =>
                handleElementPropertyChange('minValue', e.target.value)
              }
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={selectedElement.maxValue ?? 9999}
              onChange={e =>
                handleElementPropertyChange('maxValue', e.target.value)
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedElement.interactive || false}
              onChange={e =>
                handleElementPropertyChange(
                  'interactive',
                  e.target.checked.toString()
                )
              }
            />
            Interactive
          </label>
          {selectedElement.interactive && (
            <>
              <label>
                Starting Value
                <input
                  type="number"
                  value={selectedElement.startingValue || 0}
                  onChange={e =>
                    handleElementPropertyChange('startingValue', e.target.value)
                  }
                />
              </label>
              <label>
                Step
                <input
                  type="number"
                  value={selectedElement.step || 1}
                  onChange={e =>
                    handleElementPropertyChange('step', e.target.value)
                  }
                />
              </label>
            </>
          )}
        </div>
      );
    }

    // Show End Condition-specific properties when End Condition is selected
    if (selectedElement && selectedElement.type === 'End Condition') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">End Condition</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Actions
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={selectedElement.pullMode || 'pull any'}
              onChange={e =>
                handleElementPropertyChange('pullMode', e.target.value)
              }
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
        </div>
      );
    }

    // Show Artificial Intelligence-specific properties when Artificial Intelligence is selected
    if (selectedElement && selectedElement.type === 'Artifical Intelligence') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Artificial Intelligence</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${selectedElement.activation === activation ? 'active' : ''}`}
                    onClick={() =>
                      handleElementPropertyChange('activation', activation)
                    }
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions/Turn
            <input
              type="number"
              value={selectedElement.actions || 1}
              onChange={e =>
                handleElementPropertyChange('actions', e.target.value)
              }
              min="1"
            />
          </label>
          <label>
            Script
            <textarea
              value={selectedElement.script || ''}
              onChange={e =>
                handleElementPropertyChange('script', e.target.value)
              }
              placeholder="Enter script"
              rows={6}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </label>
        </div>
      );
    }

    // Show Resource Connection-specific properties when Resource Connection is selected
    if (selectedElement && selectedElement.type === 'Resource Connection') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Resource Connection</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={selectedElement.minValue ?? -999}
              onChange={e =>
                handleElementPropertyChange('minValue', e.target.value)
              }
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={selectedElement.maxValue ?? 999}
              onChange={e =>
                handleElementPropertyChange('maxValue', e.target.value)
              }
            />
          </label>
        </div>
      );
    }

    // Show State Connection-specific properties when State Connection is selected
    if (selectedElement && selectedElement.type === 'State Connection') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">State Connection</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={selectedElement.color || '#000000'}
              onChange={e =>
                handleElementPropertyChange('color', e.target.value)
              }
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={selectedElement.thickness || 2}
              onChange={e =>
                handleElementPropertyChange('thickness', e.target.value)
              }
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={selectedElement.text || ''}
              onChange={e =>
                handleElementPropertyChange('text', e.target.value)
              }
              placeholder="Enter label"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={selectedElement.minValue ?? -999}
              onChange={e =>
                handleElementPropertyChange('minValue', e.target.value)
              }
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={selectedElement.maxValue ?? 999}
              onChange={e =>
                handleElementPropertyChange('maxValue', e.target.value)
              }
            />
          </label>
        </div>
      );
    }

    // Show tool-specific properties when Text Label tool is selected
    if (selectedTool === 'Text Label') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Text Label</div>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.textLabel?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('textLabel', {
                    text: e.target.value,
                    color: toolProperties?.textLabel?.color || '#000000',
                  });
                }
              }}
              placeholder="Enter label text"
            />
          </label>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.textLabel?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('textLabel', {
                    text: toolProperties?.textLabel?.text || '',
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show tool-specific properties when Group tool is selected
    if (selectedTool === 'Group') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Group</div>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.group?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('group', {
                    text: e.target.value,
                    color: toolProperties?.group?.color || '#000000',
                  });
                }
              }}
              placeholder="Enter label text"
            />
          </label>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.group?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('group', {
                    text: toolProperties?.group?.text || '',
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show Pool tool properties when Pool tool is selected
    if (selectedTool === 'Pool') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Pool</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.pool?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.pool?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.pool?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.pool?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('pool', {
                          ...toolProperties?.pool,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.pool?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="text"
              value={toolProperties?.pool?.resources || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    resources: e.target.value,
                  });
                }
              }}
              placeholder="Enter resources"
            />
          </label>
          <label>
            Number
            <input
              type="number"
              value={toolProperties?.pool?.number || 0}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    number: parseInt(e.target.value) || 0,
                  });
                }
              }}
              min="0"
            />
          </label>
          <label>
            Max
            <input
              type="number"
              value={toolProperties?.pool?.max || 100}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    max: parseInt(e.target.value) || 100,
                  });
                }
              }}
              min="0"
            />
          </label>
          <label>
            Display Limit
            <input
              type="number"
              value={toolProperties?.pool?.displayLimit || 10}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    displayLimit: parseInt(e.target.value) || 10,
                  });
                }
              }}
              min="1"
            />
          </label>
        </div>
      );
    }

    if (selectedTool === 'Gate') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Gate</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.gate?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.gate?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.gate?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.gate?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('gate', {
                          ...toolProperties?.gate,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.gate?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.gate?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Type
            <div className="button-group">
              {[
                'deterministic',
                'dice',
                'skill',
                'multiplayer',
                'strategy',
              ].map(type => (
                <button
                  key={type}
                  className={`activation-button ${toolProperties?.gate?.type === type ? 'active' : ''}`}
                  onClick={() => {
                    if (onToolPropertiesChange) {
                      onToolPropertiesChange('gate', {
                        ...toolProperties?.gate,
                        type: type as
                          | 'deterministic'
                          | 'dice'
                          | 'skill'
                          | 'multiplayer'
                          | 'strategy',
                      });
                    }
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </label>
        </div>
      );
    }

    // Show Resource Connection tool properties
    if (selectedTool === 'Resource Connection') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Flow</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.resourceConnection?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.resourceConnection?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.resourceConnection?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={toolProperties?.resourceConnection?.minValue ?? -999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    minValue: parseInt(e.target.value) || -999,
                  });
                }
              }}
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={toolProperties?.resourceConnection?.maxValue ?? 999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    maxValue: parseInt(e.target.value) || 999,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show State Connection tool properties
    if (selectedTool === 'State Connection') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">State</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.stateConnection?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.stateConnection?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.stateConnection?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={toolProperties?.stateConnection?.minValue ?? -999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    minValue: parseInt(e.target.value) || -999,
                  });
                }
              }}
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={toolProperties?.stateConnection?.maxValue ?? 999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    maxValue: parseInt(e.target.value) || 999,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show Source tool properties
    if (selectedTool === 'Source') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Source</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.source?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.source?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.source?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.source?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('source', {
                          ...toolProperties?.source,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.source?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.source?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="color"
              className="color-input"
              value={toolProperties?.source?.resources || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    resources: e.target.value,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show Convertor tool properties
    if (selectedTool === 'Convertor') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Convertor</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.convertor?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.convertor?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.convertor?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.convertor?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('convertor', {
                          ...toolProperties?.convertor,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.convertor?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.convertor?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="color"
              className="color-input"
              value={toolProperties?.convertor?.resources || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    resources: e.target.value,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show Trader tool properties
    if (selectedTool === 'Trader') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Trader</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.trader?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.trader?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.trader?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.trader?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('trader', {
                          ...toolProperties?.trader,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.trader?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.trader?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
          <label>
            Resources
            <input
              type="color"
              className="color-input"
              value={toolProperties?.trader?.resources || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    resources: e.target.value,
                  });
                }
              }}
            />
          </label>
        </div>
      );
    }

    // Show Drain tool properties
    if (selectedTool === 'Drain') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Drain</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.drain?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.drain?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.drain?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.drain?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('drain', {
                          ...toolProperties?.drain,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.drain?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.drain?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
        </div>
      );
    }

    if (selectedTool === 'Delay') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Delay</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.delay?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.delay?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.delay?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.delay?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('delay', {
                          ...toolProperties?.delay,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.delay?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={toolProperties?.delay?.queue || false}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    queue: e.target.checked,
                  });
                }
              }}
            />
            Queue
          </label>
        </div>
      );
    }

    // Show Register tool properties
    if (selectedTool === 'Register') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Register</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.register?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.register?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Formula
            <input
              type="text"
              value={toolProperties?.register?.formula || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    formula: e.target.value,
                  });
                }
              }}
              placeholder="Enter formula"
            />
          </label>
          <label>
            Min Value
            <input
              type="number"
              value={toolProperties?.register?.minValue ?? -9999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    minValue: parseInt(e.target.value) || -9999,
                  });
                }
              }}
            />
          </label>
          <label>
            Max Value
            <input
              type="number"
              value={toolProperties?.register?.maxValue ?? 9999}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    maxValue: parseInt(e.target.value) || 9999,
                  });
                }
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={toolProperties?.register?.interactive || false}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    interactive: e.target.checked,
                  });
                }
              }}
            />
            Interactive
          </label>
          {toolProperties?.register?.interactive && (
            <>
              <label>
                Starting Value
                <input
                  type="number"
                  value={toolProperties?.register?.startingValue || 0}
                  onChange={e => {
                    if (onToolPropertiesChange) {
                      onToolPropertiesChange('register', {
                        ...toolProperties?.register,
                        startingValue: parseInt(e.target.value) || 0,
                      });
                    }
                  }}
                />
              </label>
              <label>
                Step
                <input
                  type="number"
                  value={toolProperties?.register?.step || 1}
                  onChange={e => {
                    if (onToolPropertiesChange) {
                      onToolPropertiesChange('register', {
                        ...toolProperties?.register,
                        step: parseInt(e.target.value) || 1,
                      });
                    }
                  }}
                />
              </label>
            </>
          )}
        </div>
      );
    }

    // Show End Condition tool properties
    if (selectedTool === 'End Condition') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">End Condition</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.endCondition?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.endCondition?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.endCondition?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Actions
            <input
              type="number"
              value={toolProperties?.endCondition?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Pull Mode
            <select
              value={toolProperties?.endCondition?.pullMode || 'pull any'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    pullMode: e.target.value as
                      | 'pull any'
                      | 'pull all'
                      | 'push any'
                      | 'push all',
                  });
                }
              }}
            >
              <option value="pull any">Pull Any</option>
              <option value="pull all">Pull All</option>
              <option value="push any">Push Any</option>
              <option value="push all">Push All</option>
            </select>
          </label>
        </div>
      );
    }

    // Show Artificial Intelligence tool properties
    if (selectedTool === 'Artifical Intelligence') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Artificial Intelligence</div>
          <label>
            Color
            <input
              type="color"
              className="color-input"
              value={toolProperties?.artificialIntelligence?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    color: e.target.value,
                  });
                }
              }}
            />
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.artificialIntelligence?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    thickness: parseInt(e.target.value) || 2,
                  });
                }
              }}
              min="1"
              max="10"
            />
          </label>
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.artificialIntelligence?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Activation
            <div className="button-group">
              {['passive', 'interactive', 'automatic', 'onstart'].map(
                activation => (
                  <button
                    key={activation}
                    className={`activation-button ${toolProperties?.artificialIntelligence?.activation === activation ? 'active' : ''}`}
                    onClick={() => {
                      if (onToolPropertiesChange) {
                        onToolPropertiesChange('artificialIntelligence', {
                          ...toolProperties?.artificialIntelligence,
                          activation: activation as
                            | 'passive'
                            | 'interactive'
                            | 'automatic'
                            | 'onstart',
                        });
                      }
                    }}
                  >
                    {activation}
                  </button>
                )
              )}
            </div>
          </label>
          <label>
            Actions/Turn
            <input
              type="number"
              value={toolProperties?.artificialIntelligence?.actions || 1}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    actions: parseInt(e.target.value) || 1,
                  });
                }
              }}
              min="1"
            />
          </label>
          <label>
            Script
            <textarea
              value={toolProperties?.artificialIntelligence?.script || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    script: e.target.value,
                  });
                }
              }}
              placeholder="Enter script"
              rows={6}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </label>
        </div>
      );
    }

    // Default properties panel for other tools
    return (
      <div className="properties-panel">
        <label>
          Name <input type="text" />
        </label>
        <label>
          Author <input type="text" />
        </label>
        <label>
          Time Mode
          <select>
            <option>asynchronous</option>
            <option>synchronous</option>
            <option>turn-based</option>
          </select>
        </label>
        <label>
          Interval <input type="number" defaultValue={1.0} />
        </label>
        <label>
          Distribution
          <select>
            <option>instantaneous</option>
            <option>fixed speed</option>
          </select>
        </label>
        <label>
          Color Coding <input type="checkbox" /> Color Coded
        </label>
        <label>
          Dice <input type="text" defaultValue="D6" />
        </label>
        <label>
          Skill <input type="text" />
        </label>
        <label>
          Multiplayer <input type="text" />
        </label>
        <label>
          Strategy <input type="text" />
        </label>
        <label>
          Width <input type="number" defaultValue={600} />
        </label>
        <label>
          Height <input type="number" defaultValue={560} />
        </label>
      </div>
    );
  };

  return (
    <div className="tool-sidebar">
      <div className="tab-buttons">
        {(['Graph', 'Edit', 'File', 'Run'] as const).map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tool-buttons">{renderToolButtons()}</div>
      {
        /* <div className="sidebar-divider"></div>*/
        <div className="section-divider"></div>
      }
      <div className="machinations-label">Machinations</div>

      {renderPropertiesPanel()}
    </div>
  );
};

export default ToolSideBar;