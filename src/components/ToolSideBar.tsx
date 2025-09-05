import React, { useState } from 'react';
import './ToolSideBar.css';

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

const ToolSideBar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Graph' | 'Edit' | 'File' | 'Run'>(
    'Graph'
  );
  const [selectedTool, setSelectedTool] = useState<string>('Select');

  const handleDragStart = (e: React.DragEvent, tool: string) => {
    e.dataTransfer.setData('tool', tool);
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
      {/* <div className="sidebar-divider"></div>
      <div className="section-divider"></div> */}
      <div className="machinations-label">Machinations</div>

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
    </div>
  );
};

export default ToolSideBar;
