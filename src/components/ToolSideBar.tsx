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
  toolProperties?: { text: string; color: string };
  onToolPropertiesChange?: (properties: {
    text: string;
    color: string;
  }) => void;
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

    // Show tool-specific properties when Text Label or Group tool is selected
    if (selectedTool === 'Text Label' || selectedTool === 'Group') {
      return (
        <div className="element-properties-panel">
          <label>
            Label
            <input
              type="text"
              value={toolProperties?.text || ''}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange({
                    text: e.target.value,
                    color: toolProperties?.color || '#000000',
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
              value={toolProperties?.color || '#000000'}
              onChange={e => {
                if (onToolPropertiesChange) {
                  onToolPropertiesChange({
                    text: toolProperties?.text || '',
                    color: e.target.value,
                  });
                }
              }}
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
