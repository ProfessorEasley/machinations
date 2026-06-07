import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ToolSideBar.css';
import type { ChartState } from '../utils/ChartUtils';

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
  currentPoints?: number;

  actions?: number;
  minValue?: number;
  maxValue?: number;
  gateType?: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';

  chartWidth?: number;
  chartHeight?: number;
  chartScaleX?: number;
  chartScaleY?: number;
  chartState?: ChartState;

  // Convertor-specific properties
  inputResources?: Record<string, number>; // Resource type -> amount stored
  outputResources?: Record<string, number>; // Resource type -> amount to produce
  conversionRate?: Record<string, number>; // Input resource -> output resource conversion rate

  // Trader-specific properties
  traderInputs?: Record<string, number>; // Resource type -> amount required for trade
  traderOutputs?: Record<string, number>; // Resource type -> amount provided in trade
  isIncompleteTrader?: boolean; // True if trader has < 2 inputs or < 2 outputs

  queue?: boolean;
  formula?: string;
  interactive?: boolean | string;
  startingValue?: number;
  step?: number;
  currentValue?: number;
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
  disabled?: boolean;

  runType?: 'quick' | 'multiple' | null;
  onMultipleRunClick?: () => void;
  onReset?: () => void;
  /** Show Reset below run buttons after Quick/Multiple run completes (canvas frozen). */
  showRunReset?: boolean;
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
    chart: {
      color: string;
      thickness: number;
      text: string;
      scaleX: number;
      scaleY: number;
    };
  };
  isRunning: boolean;
  numRuns?: number;
  visibleRuns?: number;
  seed?: number;
  onNumRunsChange?: (n: number) => void;
  onVisibleRunsChange?: (n: number) => void;
  onSeedChange?: (n: number) => void;
  onRunClick: () => void;
  onToolPropertiesChange?: (
    toolType: string,
    properties: Record<string, unknown>
  ) => void;
  multipleRunsResult?: {
    totalRuns: number;
    outcomes: Array<{ endConditionName: string | null; ticksElapsed: number }>;
  } | null;
  runProgress?: { current: number; total: number } | null;
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

// Color mapping for predefined colors
const COLOR_MAP: Record<string, string> = {
  red: '#FF0000',
  yellow: '#FFFF00',
  blue: '#0000FF',
  orange: '#FFA500',
  green: '#008000',
  purple: '#800080',
  black: '#000000',
  gray: '#808080',
  pink: '#FFC0CB',
};

const COLOR_NAMES = Object.keys(COLOR_MAP);

// Helper function to get color name from hex value (for backwards compatibility)
const getColorNameFromHex = (hex: string): string => {
  const normalizedHex = hex.toUpperCase();
  for (const [name, value] of Object.entries(COLOR_MAP)) {
    if (value.toUpperCase() === normalizedHex) {
      return name;
    }
  }
  // If not found, default to black
  return 'black';
};

// Helper function to render color dropdown
const renderColorDropdown = (
  value: string,
  onChange: (color: string) => void
) => {
  const currentColorName = getColorNameFromHex(value || '#000000');

  return (
    <select
      className="color-select"
      value={currentColorName}
      onChange={e => onChange(COLOR_MAP[e.target.value])}
      style={{ width: '100%', padding: '4px' }}
    >
      {COLOR_NAMES.map(colorName => (
        <option key={colorName} value={colorName}>
          {colorName.charAt(0).toUpperCase() + colorName.slice(1)}
        </option>
      ))}
    </select>
  );
};

const ToolSideBar: React.FC<ToolSideBarProps> = ({
  selectedTool,
  setSelectedTool,
  disabled,
  selectedElement,
  selectedElements = [],
  allElements = [],
  onElementUpdate,
  canUndo = false,
  canRedo = false,
  toolProperties,
  onToolPropertiesChange,
  isRunning,
  runType,
  numRuns = 100,
  visibleRuns = 25,
  seed = 1,
  onNumRunsChange,
  onVisibleRunsChange,
  onSeedChange,
  onRunClick,
  onMultipleRunClick,
  onReset,
  showRunReset = false,
  multipleRunsResult,
  runProgress,
}) => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>(
    'Graph'
  );

  const [clipboard, setClipboard] = useState<GraphElement[]>([]);

  const canCopy = selectedElements.length > 0;
  const canPaste = clipboard.length > 0;
  const canDelete = selectedElements.length > 0;
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const [xmlImportError, setXmlImportError] = useState<string>('');

  const handleXmlImportClick = useCallback(() => {
    setXmlImportError('');
    xmlFileInputRef.current?.click();
  }, []);

  const handleXmlFileChosen = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      // allow picking the same file again
      event.target.value = '';

      if (!file) return;

      try {
        setXmlImportError('');
        const xmlText = await file.text();

        // ✅ Send XML to whoever actually imports (Canvas/app state/etc.)
        // Make sure your Canvas (or parent) listens for this event.
        document.dispatchEvent(
          new CustomEvent('canvas-import-xml', {
            detail: { xmlText, fileName: file.name },
          })
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setXmlImportError(msg);
      }
    },
    []
  );

  // When simulation starts, automatically switch to the Run tab
  useEffect(() => {
    if (isRunning) {
      setActiveTab('Run');
    }
  }, [isRunning]);

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

      if (!isCtrlOrCmd && activeTab === 'File') {
        switch (event.key.toLowerCase()) {
          case 'n':
            event.preventDefault();
            document.dispatchEvent(new CustomEvent('canvas-new-document'));
            break;
          case 's':
            event.preventDefault();
            document.dispatchEvent(new CustomEvent('canvas-save-xml'));
            break;
          case 'e':
            event.preventDefault();
            document.dispatchEvent(
              new CustomEvent('canvas-export-selection-xml', {
                detail: { elements: selectedElements },
              })
            );
            break;
          case 'g':
            event.preventDefault();
            document.dispatchEvent(new CustomEvent('canvas-export-svg'));
            break;
          case 'o':
          case 'i':
            event.preventDefault();
            handleXmlImportClick();
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
    selectedElements,
    handleSelectAll,
    handleCopy,
    handlePaste,
    handleUndo,
    handleRedo,
    handleZoom,
    handleDelete,
    handleXmlImportClick,
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
            {fileTools.map(tool => {
              const isImport = tool.startsWith('Import');
              const isOpen = tool.startsWith('Open');
              const isNew = tool.startsWith('New');
              const isSave = tool.startsWith('Save (');
              const isExportSel = tool.startsWith('Export Selection');
              const isSaveSvg = tool.startsWith('Save as SVG');

              return (
                <button
                  key={tool}
                  className={selectedTool === tool ? 'selected' : ''}
                  onClick={() => {
                    setSelectedTool(tool);
                    if (isImport || isOpen) handleXmlImportClick();
                    else if (isNew) {
                      document.dispatchEvent(
                        new CustomEvent('canvas-new-document')
                      );
                    } else if (isSave) {
                      document.dispatchEvent(
                        new CustomEvent('canvas-save-xml')
                      );
                    } else if (isExportSel) {
                      document.dispatchEvent(
                        new CustomEvent('canvas-export-selection-xml', {
                          detail: { elements: selectedElements },
                        })
                      );
                    } else if (isSaveSvg) {
                      document.dispatchEvent(
                        new CustomEvent('canvas-export-svg')
                      );
                    }
                  }}
                >
                  {tool}
                </button>
              );
            })}
          </>
        );

      case 'Run': {
        let runsResultRows: Array<[string, number]> = [];
        let runsTotal = 0;
        if (multipleRunsResult && !isRunning) {
          const counts = new Map<string, number>();
          for (const o of multipleRunsResult.outcomes) {
            const key = o.endConditionName ?? '(No end condition)';
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          runsTotal = multipleRunsResult.totalRuns;
          runsResultRows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        }

        return (
          <>
            {isRunning ? (
              // When running, show Reset button in place of the button that was clicked
              <>
                {runType === 'quick' ? (
                  <button onClick={onReset} className="reset-button">
                    Reset
                  </button>
                ) : (
                  <button onClick={onRunClick}>Quick Run</button>
                )}
                {runType === 'multiple' ? (
                  <button onClick={onReset} className="reset-button">
                    Reset
                  </button>
                ) : (
                  <button onClick={onMultipleRunClick}>Multiple Runs</button>
                )}
              </>
            ) : (
              // When not running, show normal buttons
              <>
                <button onClick={onRunClick}>Quick Run</button>
                <button onClick={onMultipleRunClick}>Multiple Runs</button>
              </>
            )}
            {showRunReset && (
              <button onClick={onReset} className="reset-button">
                Reset
              </button>
            )}
            {!isRunning && !showRunReset && (
              <>
                <label>
                  Runs{' '}
                  <input
                    type="number"
                    min={1}
                    value={numRuns}
                    onChange={e =>
                      onNumRunsChange?.(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                  />
                </label>
                <label>
                  Visible Runs{' '}
                  <input
                    type="number"
                    min={1}
                    value={visibleRuns}
                    onChange={e =>
                      onVisibleRunsChange?.(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                  />
                </label>
                <label title="Same model + same seed + same tick count always produces the same outcome. Change the seed to explore a different but reproducible run.">
                  Seed{' '}
                  <input
                    type="number"
                    value={seed}
                    onChange={e =>
                      onSeedChange?.(Math.floor(Number(e.target.value)) || 0)
                    }
                  />
                </label>
              </>
            )}
            {runType === 'multiple' && isRunning && runProgress && (
              <p className="runs-progress">
                Running {runProgress.current}/{runProgress.total}&hellip;
              </p>
            )}
            {runsResultRows.length > 0 && (
              <div className="multiple-runs-results">
                <span className="runs-results-title">
                  Results &mdash; {runsTotal} run{runsTotal !== 1 ? 's' : ''}
                </span>
                <table className="runs-results-table">
                  <thead>
                    <tr>
                      <th>Outcome</th>
                      <th>#</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsResultRows.map(([name, count]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{count}</td>
                        <td>{((count / runsTotal) * 100).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }
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
              onFocus={e => {
                // Clear "Text Label" placeholder text when focused
                if (e.target.value === 'Text Label') {
                  handleElementPropertyChange('text', '');
                }
              }}
              placeholder="Text Label"
            />
          </label>
          <label>
            Color
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
          </label>
        </div>
      );
    }
    // Show Chart-specific properties when Chart is selected (element)
    if (selectedElement && selectedElement.type === 'Chart') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Chart</div>
          <label>
            Color
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            Scale X (0 is auto-scale, set value to fix range)
            <input
              type="number"
              value={selectedElement.chartScaleX ?? 0}
              onChange={e => {
                if (onElementUpdate) {
                  const value = parseInt(e.target.value) || 0;
                  onElementUpdate(selectedElement.id, {
                    chartScaleX: value,
                    chartState: undefined,
                  });
                }
              }}
              min="0"
            />
          </label>
          <label>
            Scale Y (0 is auto-scale, set value to fix range)
            <input
              type="number"
              value={selectedElement.chartScaleY ?? 0}
              onChange={e => {
                if (onElementUpdate) {
                  const value = parseInt(e.target.value) || 0;
                  onElementUpdate(selectedElement.id, {
                    chartScaleY: value,
                    chartState: undefined,
                  });
                }
              }}
              min="0"
            />
          </label>
        </div>
      );
    }

    // Show Chart tool properties when Chart tool is selected
    if (selectedTool === 'Chart') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Chart</div>
          <label>
            Color
            {renderColorDropdown(
              toolProperties?.chart?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('chart', {
                    ...toolProperties?.chart,
                    color: color,
                  });
                }
              }
            )}
          </label>
          <label>
            Thickness
            <input
              type="number"
              value={toolProperties?.chart?.thickness || 2}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('chart', {
                    ...toolProperties?.chart,
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
              value={toolProperties?.chart?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('chart', {
                    ...toolProperties?.chart,
                    text: e.target.value,
                  });
                }
              }}
              placeholder="Enter label"
            />
          </label>
          <label>
            Scale X (0 is auto-scale, set value to fix range)
            <input
              type="number"
              value={toolProperties?.chart?.scaleX ?? 0}
              onChange={e => {
                if (onToolPropertiesChange) {
                  const value = parseInt(e.target.value) || 0;
                  onToolPropertiesChange('chart', {
                    ...toolProperties?.chart,
                    scaleX: value,
                  });
                }
              }}
              min="0"
            />
          </label>
          <label>
            Scale Y (0 is auto-scale, set value to fix range)
            <input
              type="number"
              value={toolProperties?.chart?.scaleY ?? 0}
              onChange={e => {
                if (onToolPropertiesChange) {
                  const value = parseInt(e.target.value) || 0;
                  onToolPropertiesChange('chart', {
                    ...toolProperties?.chart,
                    scaleY: value,
                  });
                }
              }}
              min="0"
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(
              selectedElement.resources || '#000000',
              color => handleElementPropertyChange('resources', color)
            )}
          </label>
          <label>
            Number
            <input
              type="number"
              value={
                selectedElement.number !== undefined
                  ? selectedElement.number
                  : ''
              }
              onChange={e => {
                const numValue =
                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0;

                if (onElementUpdate && selectedElement) {
                  // ✅ FIX: Update BOTH 'number' (start value) AND 'currentPoints' (visual value)
                  onElementUpdate(selectedElement.id, {
                    number: numValue,
                    currentPoints: numValue,
                  });
                }
              }}
              onFocus={e => {
                if (e.target.value === '0' || e.target.value === '') {
                  e.target.value = '';
                }
              }}
              onBlur={e => {
                if (e.target.value === '') {
                  if (onElementUpdate && selectedElement) {
                    // ✅ FIX: Reset both values on blur if empty
                    onElementUpdate(selectedElement.id, {
                      number: 0,
                      currentPoints: 0,
                    });
                  }
                }
              }}
              placeholder="0"
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(
              selectedElement.resources || '#000000',
              color => handleElementPropertyChange('resources', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(
              selectedElement.resources || '#000000',
              color => handleElementPropertyChange('resources', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(
              selectedElement.resources || '#000000',
              color => handleElementPropertyChange('resources', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#ffffff', color =>
              handleElementPropertyChange('color', color)
            )}
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
              checked={Boolean(selectedElement.queue)}
              onChange={e => {
                if (selectedElement && onElementUpdate) {
                  onElementUpdate(selectedElement.id, {
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

    // Show Register-specific properties when Register is selected
    if (selectedElement && selectedElement.type === 'Register') {
      return (
        <div className="element-properties-panel">
          <div className="machinations-label">Register</div>
          <label>
            Color
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
              checked={
                selectedElement.interactive === true ||
                selectedElement.interactive === 'true'
              }
              onChange={e => {
                if (onElementUpdate) {
                  onElementUpdate(selectedElement.id, {
                    interactive: e.target.checked,
                  });
                }
              }}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
            {renderColorDropdown(selectedElement.color || '#000000', color =>
              handleElementPropertyChange('color', color)
            )}
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
              onFocus={e => {
                // Clear "Text Label" placeholder text when focused
                if (e.target.value === 'Text Label') {
                  if (onToolPropertiesChange) {
                    onToolPropertiesChange('textLabel', {
                      text: '',
                      color: toolProperties?.textLabel?.color || '#000000',
                    });
                  }
                }
              }}
              placeholder="Text Label"
            />
          </label>
          <label>
            Color
            {renderColorDropdown(
              toolProperties?.textLabel?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('textLabel', {
                    text: toolProperties?.textLabel?.text || '',
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.group?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('group', {
                    text: toolProperties?.group?.text || '',
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.pool?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.pool?.resources || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    resources: color,
                  });
                }
              }
            )}
          </label>
          <label>
            Number
            <input
              type="number"
              value={toolProperties?.pool?.number || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('pool', {
                    ...toolProperties?.pool,
                    number:
                      e.target.value === '' ? 0 : parseInt(e.target.value) || 0,
                  });
                }
              }}
              onFocus={e => {
                if (e.target.value === '0' || e.target.value === '') {
                  e.target.value = '';
                }
              }}
              onBlur={e => {
                if (e.target.value === '') {
                  e.target.value = '0';
                  if (onToolPropertiesChange) {
                    onToolPropertiesChange('pool', {
                      ...toolProperties?.pool,
                      number: 0,
                    });
                  }
                }
              }}
              placeholder="0"
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
            {renderColorDropdown(
              toolProperties?.gate?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('gate', {
                    ...toolProperties?.gate,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.resourceConnection?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('resourceConnection', {
                    ...toolProperties?.resourceConnection,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.stateConnection?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('stateConnection', {
                    ...toolProperties?.stateConnection,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.source?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.source?.resources || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('source', {
                    ...toolProperties?.source,
                    resources: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.convertor?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.convertor?.resources || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('convertor', {
                    ...toolProperties?.convertor,
                    resources: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.trader?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.trader?.resources || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('trader', {
                    ...toolProperties?.trader,
                    resources: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.drain?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('drain', {
                    ...toolProperties?.drain,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.delay?.color || '#ffffff',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('delay', {
                    ...toolProperties?.delay,
                    color: color,
                  });
                }
              }
            )}
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
              disabled
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
            {renderColorDropdown(
              toolProperties?.register?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('register', {
                    ...toolProperties?.register,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.endCondition?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('endCondition', {
                    ...toolProperties?.endCondition,
                    color: color,
                  });
                }
              }
            )}
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
            {renderColorDropdown(
              toolProperties?.artificialIntelligence?.color || '#000000',
              color => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange('artificialIntelligence', {
                    ...toolProperties?.artificialIntelligence,
                    color: color,
                  });
                }
              }
            )}
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
    <div className={`tool-sidebar ${disabled ? 'sidebar-disabled' : ''}`}>
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
      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: 'none' }}
        onChange={handleXmlFileChosen}
      />

      {xmlImportError && (
        <div
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 9999,
            background: 'white',
            padding: 8,
            border: '1px solid #ccc',
          }}
        >
          <b>XML Import Error:</b> {xmlImportError}
        </div>
      )}
    </div>
  );
};

export default ToolSideBar;
