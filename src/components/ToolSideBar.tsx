import React, { useState } from 'react';
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
  onElementUpdate?: (elementId: number, updates: Partial<GraphElement>) => void;
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
  };
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

const editTools = [
  'Select All (A)',
  'Copy (C)',
  'Paste (V)',
  'Undo (Z)',
  'Redo (Y)',
  'Zoom (M)',
];

const fileTools = [
  'New (N)',
  'Open (O)',
  'Import (I)',
  'Save (S)',
  'Export Selection(E)',
  'Save as SVG (G)',
];

const runTools = ['Quick Run', 'Multiple Runs'];

const ToolSideBar: React.FC<ToolSideBarProps> = ({
  selectedTool,
  setSelectedTool,
  selectedElement,
  onElementUpdate,
  toolProperties,
  onToolPropertiesChange,
}) => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>(
    'Graph'
  );
  // const [selectedTool, setSelectedTool] = useState<string>('Select');

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
      case 'Edit':
        return (
          <>
            {editTools.map(tool => (
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
            {runTools.map(tool => (
              <button
                key={tool}
                className={selectedTool === tool ? 'selected' : ''}
                onClick={() => setSelectedTool(tool)}
              >
                {tool}
              </button>
            ))}
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

    // Show tool-specific properties when Text Label tool is selected
    if (selectedTool === 'Text Label') {
      return (
        <div className="element-properties-panel">
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
